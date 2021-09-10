import { Service, Inject } from 'typedi';
import { SimulatorSchema, Simulator, SimulatorType, SimulatorStatus } from './simulator.model';
import * as _ from 'lodash';
import { environment } from '../../environment';
import { logger } from '@aitheon/core-server';
import { ServicesService } from '../services/services.service';
import { SettingsService } from '../settings/settings.service';
import * as JSONStream from 'json-stream';
import * as path from 'path';
import { cloneDeep } from 'lodash';
import * as Api from 'kubernetes-client';
import { K8sService } from '../k8s/k8s.service';
import { Project } from '@aitheon/creators-studio-server';
import { ProjectDBsService } from '../builds/project-dbs.service';
import * as slug from 'slug';

@Service()
export class SimulatorsService {

  @Inject()
  settingsService: SettingsService;

  @Inject()
  k8sService: K8sService;

  @Inject()
  projectDBsService: ProjectDBsService;

  buildsNamespace = 'ai-build-server';
  simulatorsNamespace = 'ai-creators-studio';

  deploymentTemplate = require(path.resolve('./server/modules/simulators/templates/apps/deployment.json'));
  serviceTemplate = require(path.resolve('./server/modules/simulators/templates/apps/service.json'));
  ingressTemplate = require(path.resolve('./server/modules/simulators/templates/apps/ingress.json'));

  logsStreams: { [simulatorId: string]: { stream?: any, requested: boolean } } = {};

  constructor() {
    this.initEvents();
  }

  initEvents() {
    // ServerRedis.subClient.subscribe([
    //   'BUILD_SERVER.SIMULATORS.DETAIL',
    //   'BUILD_SERVER.SIMULATORS.START',
    //   'BUILD_SERVER.SIMULATORS.START6',
    //   'BUILD_SERVER.SIMULATORS.STOP',
    //   'BUILD_SERVER.SIMULATORS.RESTART',
    //   'BUILD_SERVER.SIMULATORS.LOGS',
    // ], (err: any, count: number) => {
    //   logger.info('ServerRedis, subscribed. Count:', count, err || '');
    // });
    // ServerRedis.subClient.on('message', async (channel, message) => {
    //   message = JSON.parse(message);

    //   switch (channel) {
    //     case 'BUILD_SERVER.SIMULATORS.START':
    //     case 'BUILD_SERVER.SIMULATORS.START6':
    //       this.startSimulator(message.project, message.sessionId, message.gitInit || true, message.device);
    //       break;
    //     case 'BUILD_SERVER.SIMULATORS.STOP':
    //       this.stopSimulator(message.project, message.sessionId);
    //       break;
    //     case 'BUILD_SERVER.SIMULATORS.RESTART':
    //       this.restartSimulator(message.project, message.sessionId);
    //       break;
    //     case 'BUILD_SERVER.SIMULATORS.DETAIL':
    //       this.simulatorDetail(message.project, message.sessionId);
    //       break;
    //     case 'BUILD_SERVER.SIMULATORS.LOGS':
    //       this.simulatorLogs(message.project, message.sessionId);
    //       break;
    //   }
    // });
  }

  async simulatorDetail(project: Project, sessionId: string) {
    const data = { sessionId: sessionId, projectId: project._id } as any;

    const simulator = await SimulatorSchema.findOne({ project: project._id, sessionId: sessionId, $or: [{ status: SimulatorStatus.RUNNING }, { status: SimulatorStatus.PENDING }] });
    if (!simulator) {
      data.status = SimulatorStatus.NOT_RUNNING;
      return this.sendResponse(`BUILD_SERVER.SIMULATORS.DETAIL.RESPONSE`, data);
    }
    const resultDetail = await this.k8sService.podStatusByLabel(`app=simulator-${ simulator._id }`, this.simulatorsNamespace);
    if (resultDetail) {
      data.status = resultDetail;
      data.simulatorId = simulator._id;
      data.deviceId = simulator.deviceId;
      this.sendResponse(`BUILD_SERVER.SIMULATORS.DETAIL.RESPONSE`, data);
    }
  }

  async simulatorLogs(project: Project, sessionId: string) {
    const simulator = await SimulatorSchema.findOne({ project: project._id, sessionId: sessionId, $or: [{ status: SimulatorStatus.RUNNING }, { status: SimulatorStatus.PENDING }] });
    if (!simulator) {
      return;
    }

    if (!this.logsStreams[simulator._id.toString()] || !this.logsStreams[simulator._id.toString()].requested) {
      this.logsStreams[simulator._id.toString()] = { requested: true };
      const logStream = await this.k8sService.watchLogsByLabel(`app=simulator-${ simulator._id }`, this.simulatorsNamespace);
      if (logStream) {
        this.logsStreams[simulator._id.toString()].stream = logStream;
        logStream.on('data', async (event: any) => {
          const output = event.toString();
          this.sendResponse(`BUILD_SERVER.SIMULATORS.LOGS.RESPONSE`, { output: output, sessionId: sessionId, projectId: project._id });
        });
      }
    } else {
      const currentLogs = await this.k8sService.getLogsByLabel(`app=simulator-${ simulator._id }`, this.simulatorsNamespace);
      this.sendResponse(`BUILD_SERVER.SIMULATORS.LOGS.RESPONSE`, { output: currentLogs.body, sessionId: sessionId, projectId: project._id });
    }
  }

  async find(project: string, sessionId: string, status: SimulatorStatus)  {
    return SimulatorSchema.findOne({ project, sessionId, status });
  }

  async stopSimulator(project: Project, sessionId: string) {
    const simulator = await SimulatorSchema.findOne({ project: project._id, sessionId: sessionId, $or: [{ status: SimulatorStatus.RUNNING }, { status: SimulatorStatus.PENDING }] });
    if (!simulator) {
      return;
    }
    simulator.status = SimulatorStatus.STOPPED;
    await simulator.save();
    const id = simulator._id.toString();
    if (this.logsStreams[id] && this.logsStreams[id].stream) {
      this.logsStreams[id].stream.abort();
      delete this.logsStreams[id];
    }
    await this.cleanupSimulator(simulator._id);
    this.sendResponse(`BUILD_SERVER.SIMULATORS.DETAIL.RESPONSE`, { status: SimulatorStatus.STOPPED, sessionId: sessionId, projectId: project._id });
  }

  getSimulatorType(project: Project) {
    switch (project.projectType) {
      case Project.ProjectTypeEnum.COMPUTE_NODE:
        return project.language === Project.LanguageEnum.CPP ? SimulatorType.ISAAC : SimulatorType.NODEJS;
      case Project.ProjectTypeEnum.ROBOT:
        return SimulatorType.ISAAC;
      case Project.ProjectTypeEnum.SERVICE:
      case Project.ProjectTypeEnum.INTERFACE:
      default:
        return SimulatorType.NODEJS;
    }
  }

  async startSimulator(project: Project, sessionId: string, onlyGitInit: boolean = true, device?: any) {
    try {
      let simulator = await SimulatorSchema.findOne({ project: project._id, sessionId: sessionId, $or: [{ status: SimulatorStatus.RUNNING }, { status: SimulatorStatus.PENDING }] });
      if (simulator) {
        logger.warn(`[startSimulator] project:[${project._id}]; session[${ sessionId }] Already has running simulator`);
        await this.stopSimulator(project, sessionId);
      }

      simulator = await new SimulatorSchema({
        project: project._id,
        sessionId: sessionId,
        deviceId: device ? device._id : undefined,
        type: this.getSimulatorType(project), status: SimulatorStatus.PENDING
      }).save();

      const deploymentSpec = cloneDeep(this.deploymentTemplate);
      const serviceSpec = cloneDeep(this.serviceTemplate);
      const ingressSpec = cloneDeep(this.ingressTemplate);

      const name = `simulator-${ simulator._id }`;
      simulator.name = name;

      deploymentSpec.metadata.name = name;
      deploymentSpec.metadata.labels.app = name;
      deploymentSpec.metadata.labels['simulator'] = 'true';
      deploymentSpec.metadata.labels['project'] = project._id;
      deploymentSpec.metadata.labels['session'] = sessionId;
      deploymentSpec.spec.template.metadata.labels.app = name;
      deploymentSpec.spec.template.metadata.labels['simulator'] = 'true';
      deploymentSpec.spec.template.spec.containers[0].name = name;

      const projectDB = await this.projectDBsService.ensureDbConnection(project._id);
      const logsConfig = await this.k8sService.getSecret(this.buildsNamespace, 'logs-config');

      const serviceContainer = deploymentSpec.spec.template.spec.containers[0];
      const dbIndex = serviceContainer.env.findIndex((e: any) => { return e.name === 'MONGODB_URI'; });
      const connectionString = `mongodb://${ projectDB.username }:${ projectDB.password }@ai-mongo.ai-mongo.svc.cluster.local:27017/${ projectDB.name }?authSource=admin`;
      const value = { 'name': 'MONGODB_URI', 'value': connectionString};
      dbIndex === -1 ? serviceContainer.env.push(value) : serviceContainer.env[dbIndex] = value;


      serviceContainer.env.push({
        name: 'LOGS_MONGODB_URI',
        value: Buffer.from(logsConfig.data.LOGS_MONGODB_URI, 'base64').toString('utf8')
      });
      serviceContainer.env.push({
        name: 'SIMULATOR_ID',
        value: simulator._id.toString()
      });

      const safeProjectName = project.name.replace(/\s/gi, '_');
      // const onlyGitInit = !environment.production || gitInit;
      if (onlyGitInit) {
        this.setGitInitContainer(deploymentSpec, project, safeProjectName, simulator);
      }
      const basePath = 'apps-simulator';
      switch (simulator.type) {
        case SimulatorType.GAZEBO:
          deploymentSpec.spec.template.spec.containers[0].image = `${ environment.ecrAccount }/simulator-gazebo`;
          deploymentSpec.spec.template.spec.containers[0].env.push({ name: 'BASEPATH', value: `/${ basePath }/${ simulator._id }/` });
          delete deploymentSpec.spec.template.spec.containers[0].command;
          delete deploymentSpec.spec.template.spec.containers[0].args;
          break;
        case SimulatorType.ISAAC:
            delete deploymentSpec.spec.template.spec.containers[0].command;
            delete deploymentSpec.spec.template.spec.containers[0].args;
            deploymentSpec.spec.template.spec.containers[0].image = `${ environment.ecrAccount }/isaacbuild`;
            deploymentSpec.spec.template.spec.containers[0].args = [];
            if (!onlyGitInit) {
              deploymentSpec.spec.template.spec.containers[0].volumeMounts[0].subPath = `${ sessionId }/${ project.name }`;
              deploymentSpec.spec.template.spec.containers[0].volumeMounts[0].mountPath = `/src/workspace/apps/${ safeProjectName }`;
            }
            if (project.dependencies && project.dependencies.length > 0) {
              project.dependencies.forEach((dep: { version: string, project: string }) => {
                this.addDependencies(simulator, deploymentSpec, dep);
              });
            }
            deploymentSpec.spec.template.spec.volumes.push({
              name: 'isaac-build-cache',
              persistentVolumeClaim: {
                claimName: 'isaac-build-cache'
              }
            });
            deploymentSpec.spec.template.spec.containers[0].volumeMounts.push({
              name: 'isaac-build-cache',
              mountPath: '/root'
            });
            // SERIAL_NUMBER
            if (device) {
              deploymentSpec.spec.template.spec.containers[0].env.push({ name: 'SERIAL_NUMBER', value: device.serialNumber });
              deploymentSpec.spec.template.spec.containers[0].env.push({ name: 'DEVICE_ID', value: device._id });
              deploymentSpec.spec.template.spec.containers[0].env.push({ name: 'AOS_TOKEN', value: device.aosToken });
            }
          break;
        case SimulatorType.NODEJS:
        default:
          deploymentSpec.spec.template.spec.containers[0].image = `${ environment.ecrAccount }/simulator-nodejs`;
          // dont map volume when we doing git init
          if (!onlyGitInit) {
            deploymentSpec.spec.template.spec.containers[0].volumeMounts[0].subPath = `${ sessionId }/${ project.name }`;
          }
          break;
      }

      deploymentSpec.spec.template.spec.containers[0].env.push({ name: 'PROJECT_ID', value: project._id });
      deploymentSpec.spec.template.spec.containers[0].env.push({ name: 'PROJECT_NAME', value: project.name });

      serviceSpec.metadata.name = name;
      serviceSpec.spec.selector.app = name;

      ingressSpec.metadata.name = name;
      ingressSpec.metadata.labels.app = name;

      ingressSpec.metadata.annotations['nginx.ingress.kubernetes.io/configuration-snippet'] = `proxy_set_header X-BASE-HREF /${ basePath }/${ simulator._id }/;\n`;
      ingressSpec.spec.rules[0].http.paths[0].path = `/${ basePath }/${ simulator._id }/?(.*)`;
      ingressSpec.spec.rules[0].http.paths[0].backend.serviceName = name;

      const deployment = await this.k8sService.applyDeployment(deploymentSpec, this.simulatorsNamespace);
      const service = await this.k8sService.applyService(serviceSpec, this.simulatorsNamespace);
      const ingress = await this.k8sService.applyIngress(ingressSpec, this.simulatorsNamespace);

      this.sendResponse(`BUILD_SERVER.SIMULATORS.DETAIL.RESPONSE`, { status: SimulatorStatus.PENDING, sessionId: sessionId, projectId: project._id, simulatorId: simulator._id });
    } catch (err) {
      logger.error('[createSimulator]', err);
    }
  }

  private addDependencies(simulator: Simulator, deploymentSpec: any, dep: { version: string, project: string }) {
    if (simulator.type === SimulatorType.ISAAC) {
      const contextName = `context-${ dep.project.toString() }`;
      // TODO: BROKEN LOGIC. Reconsider or populate name if needed
      // const safeProjectName = dep.project.name.replace(/\s/gi, '_');
      console.error(`[Simulator.Service.addDependencies] is broken ${dep.project.toString()}`);
      const safeProjectName = '';
      const mountPath =  `/src/workspace/aros_packages/${ safeProjectName }`;
      const initProjectContainer = this.projectGitContainer(dep.project.toString(), contextName, mountPath);

      if (initProjectContainer.volumeMounts.findIndex((v: any) => { return v.name === contextName; }) === -1) {
        initProjectContainer.volumeMounts.push({
          name: contextName,
          mountPath: mountPath
        });
      }
      this.addSshKeyAndContext(deploymentSpec, contextName);
      if (!deploymentSpec.spec.template.spec.initContainers) {
        deploymentSpec.spec.template.spec.initContainers = [];
      }
      deploymentSpec.spec.template.spec.initContainers.push(initProjectContainer);
      const simulatorContainer = deploymentSpec.spec.template.spec.containers.find((c: any) => { return c.name === simulator.name; });
      if (!simulatorContainer.volumeMounts) {
        simulatorContainer.volumeMounts = [];
      }
      simulatorContainer.volumeMounts.push({
        name: contextName,
        mountPath: mountPath,
      });
    }
  }

  private addSshKeyAndContext(deploymentSpec: any, contextName: string) {
    const volumeIndex = deploymentSpec.spec.template.spec.volumes.findIndex((v: any) => v.name === 'ssh-key');
    if (volumeIndex === -1) {
      deploymentSpec.spec.template.spec.volumes.push({
        'name': 'ssh-key',
        'secret': {
          'defaultMode': 256,
          'secretName': 'ssh-key'
        }
      });
    }
    const contextIndex = deploymentSpec.spec.template.spec.volumes.findIndex((v: any) => v.name === contextName);
    if (contextIndex === -1) {
      deploymentSpec.spec.template.spec.volumes.push({
        'name': contextName,
        'emptyDir': {}
      });
    }
  }

  private projectGitContainer(projectId: string, contextName: string, mountPath: string) {
    return {
      'name': `clone-repo-${ projectId }`,
      'image': 'alpine/git',
      'args': [
        'clone',
        '--single-branch',
        '--',
        `ssh://git@git-server.ai-creators-studio.svc.cluster.local:2222/git-server/repos/project-${ projectId }.git`,
        mountPath
      ],
      'volumeMounts': [
        {
          'name': contextName,
          'mountPath': mountPath
        },
        {
          'name': 'ssh-key',
          'mountPath': '/root/.ssh'
        }
      ],
      'env': [
        {
          'name': 'GIT_SSH_COMMAND',
          'value': 'ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no'
        }
      ]
    };
  }

  private setGitInitContainer(deploymentSpec: any, project: Project, safeProjectName: string, simulator: Simulator) {
    if (!deploymentSpec.spec.template.spec.initContainers) {
      deploymentSpec.spec.template.spec.initContainers = [];
    }
    const contextName = 'context';
    let mountPath = '/opt/app';
    if (project.projectType === Project.ProjectTypeEnum.COMPUTE_NODE || project.projectType === Project.ProjectTypeEnum.ROBOT) {
      mountPath = `/src/workspace/apps/${ safeProjectName }`;
    }
    const initProjectContainer = this.projectGitContainer(project._id, contextName, mountPath);

    if (initProjectContainer.volumeMounts.findIndex((v: any) => { return v.name === contextName; }) === -1) {
      initProjectContainer.volumeMounts.push({
        name: contextName,
        mountPath
      });
    }


    this.addSshKeyAndContext(deploymentSpec, contextName);

    deploymentSpec.spec.template.spec.initContainers.push(initProjectContainer);

    const simulatorContainer = deploymentSpec.spec.template.spec.containers.find((c: any) => { return c.name === simulator.name; });
    if (!simulatorContainer.volumeMounts) {
      simulatorContainer.volumeMounts = [];
    }
    simulatorContainer.volumeMounts.push({
      name: contextName,
      mountPath,
    });

    // const tempIndex = simulatorContainer.volumeMounts.findIndex((vm: any) => { return  vm.name === 'ai-creators-studio-data'; });
    // simulatorContainer.volumeMounts.splice(tempIndex, 1);

    return deploymentSpec;
  }

  async cleanupSimulator(simulatorId: string) {
    const name = `simulator-${ simulatorId }`;
    try {
      await this.k8sService.markPodDeleted(`app=simulator-${ simulatorId }`, this.simulatorsNamespace);
      await this.k8sService.deleteDeployment(name, this.simulatorsNamespace);
      await this.k8sService.deleteService(name, this.simulatorsNamespace);
      await this.k8sService.deleteIngress(name, this.simulatorsNamespace);
    } catch (err) {
      throw err;
    }
  }

  async restartSimulator(project: Project, sessionId: string) {
    const simulator = await SimulatorSchema.findOne({ project: project._id, sessionId: sessionId, $or: [{ status: SimulatorStatus.RUNNING }, { status: SimulatorStatus.PENDING }] });
    if (!simulator) {
      return;
    }
    const id = simulator._id.toString();
    if (this.logsStreams[id] && this.logsStreams[id].stream) {
      this.logsStreams[id].stream.abort();
      delete this.logsStreams[id];
    }
    await this.k8sService.deletePodByLabel(`app=simulator-${ simulator._id }`, this.simulatorsNamespace);
    const data = { sessionId: sessionId, projectId: project._id, simulatorId: simulator._id, status: SimulatorStatus.PENDING } as any;
    return this.sendResponse(`BUILD_SERVER.SIMULATORS.DETAIL.RESPONSE`, data);
  }

  private sendResponse(event: string, data: any) {
    // return ServerRedis.pubClient.publish(event, JSON.stringify(data));
  }

}