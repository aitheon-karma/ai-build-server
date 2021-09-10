import { Service, Inject, Container } from 'typedi';
import * as _ from 'lodash';
import { environment } from '../../environment';
import { logger, User } from '@aitheon/core-server';
import { getDeploymentSpec, defaultNamespace, getConfigSpec, getServiceSpec, getSecretSpec, getPVC, applyPVCforDeployment, defaultName } from './sandbox.defaults';
import { K8sService } from '../k8s/k8s.service';
import { ProjectDBsService } from '../builds/project-dbs.service';
import { Transporter, TransporterService, Action, Event, param } from '@aitheon/transporter';
import { BuildsService } from '../builds/builds.service';
import { BuildType, Build } from '../builds/build.model';
import { uniqBy, pick } from 'lodash';
// import { SandboxResource } from './sandbox-resource';
import { Sandbox } from '@aitheon/creators-studio-server';
import { SandboxTypesService } from './sandbox-types.service';
import { SandboxHotTemplatesService } from './sandbox-hot-templates.service';
import { Types } from 'mongoose';
import { SandboxType } from './sandbox-type.model';
import { SandboxSettingsService } from './settings/sandbox-settings.service';
import { ISandboxHotTemplate } from './sandbox-hot-template.model';
import { SandboxSettings } from './settings/sandbox-settings.model';
import { SandboxVolumesService } from './sandbox-volumes.service';

@Service()
@Transporter()
export class SandboxesService extends TransporterService {

  @Inject(type => K8sService)
  k8sService: K8sService;

  @Inject(type => ProjectDBsService)
  projectDBsService: ProjectDBsService;

  @Inject(type => BuildsService)
  buildsService: BuildsService;

  @Inject(type => SandboxTypesService)
  sandboxTypesService: SandboxTypesService;

  @Inject(type => SandboxHotTemplatesService)
  sandboxHotTemplatesService: SandboxHotTemplatesService;

  @Inject(type => SandboxSettingsService)
  sandboxSettingsService: SandboxSettingsService;

  @Inject(type => SandboxVolumesService)
  sandboxVolumesService: SandboxVolumesService;

  constructor() {
    super(Container.get('TransporterBroker'));

    if (environment.production) {
      setInterval(() => {
        this.seedHotSandboxesV2();
      }, 15 * 60 * 1000);
    }
    // setTimeout(() => {
    //   this.seedHotSandboxesV2();
    // }, 10000);
  }

  creatorsStudioTransportUri = `CREATORS_STUDIO`;

  async seedHotSandboxesV2() {
    try {
      const settings = await this.sandboxSettingsService.find();
      const types = await this.sandboxTypesService.list();
      types.forEach(async (sandboxType: SandboxType) => {
        if (!sandboxType.disabled) {
          await this.seedHotSandboxByType(sandboxType, settings);
        }
      });
    } catch (err) {
      logger.info(`[seedHotSandboxesV2]`, err);
    }
  }

  async seedHotSandboxByType(sandboxType: SandboxType, settings: SandboxSettings) {
    try {
      const running = await this.sandboxHotTemplatesService.findByType(sandboxType._id);
      const notAllocated = running.filter((template: ISandboxHotTemplate) => !template.allocated);
      if (running.length === sandboxType.hotLoadedCount) {
        logger.info(`[seedHotSandboxByType] SandboxType: ${ sandboxType.displayText } is full. Running: ${ running.length }; Required: ${ sandboxType.hotLoadedCount }`);
      } else if (running.length > sandboxType.hotLoadedCount && notAllocated.length > 0) {
        // we did a scale down and have not used sandboxes, so terminating them
        logger.info(`[seedHotSandboxByType] SandboxType: ${ sandboxType.displayText } is out of hot load count. Terminatin not allocated: ${ notAllocated.length }`);
        notAllocated.forEach(async (template: ISandboxHotTemplate) => {
          this.terminate({ _id: template._id } as any);
        });
      } else if (running.length < sandboxType.hotLoadedCount) {
        const sandboxesToCreateCount = sandboxType.hotLoadedCount - running.length;
        logger.info(`[seedHotSandboxByType] SandboxType: ${ sandboxType.displayText } Require to fill. Create Count: ${ sandboxesToCreateCount }/${ sandboxType.hotLoadedCount }`);
        Array.from({ length: sandboxesToCreateCount }, async () => {
          await this.sandboxHotTemplatesService.prepareHotTemplate(sandboxType, settings);
        });
      } else {
        logger.info(`[seedHotSandboxByType] SandboxType: ${ sandboxType.displayText }; Nothing to do for this type, bye. HotLoadedCount:${ sandboxType.hotLoadedCount }`);
      }
    } catch (err) {
      logger.info(`[seedHotSandboxByType]`, err);
    }
  }

  @Action()
  async create(
    @param({ type: 'any' }) payload: {
      sandboxType: string, user: User,
      organization: string,
      ssh: { publicKey: string, privateKey: string },
      initRepositories?: Array<{ username: string, repositoryName: string }>,
      forceNew?: boolean,
      token?: string
    }) {
    const sandbox = {
      type: payload.sandboxType,
      user: payload.user,
      organization: payload.organization,
    } as any;
    try {

      logger.info(`[SandboxService] Create sandbox type ${ payload.sandboxType }`);

      const availableHotSandbox = await this.sandboxHotTemplatesService.findOneByType(payload.sandboxType as any);
      const sandboxType = await this.sandboxTypesService.getById(sandbox.type as any);

      // const requireNewContainer = availableHotSandbox === null || payload.forceNew;
      const requireNewContainer = true;

      logger.info(`[SandboxService] requireNewContainer=${ requireNewContainer }`);

      if (requireNewContainer) {
        sandbox._id = Types.ObjectId().toHexString();
        sandbox.status = 'PENDING';
        sandbox.type = sandboxType;
        sandbox.hotLoaded = false;
        await this.createUserSandbox(sandbox, payload.ssh, process.env.DOMAIN, payload.token, payload.organization, payload.initRepositories);
        logger.info(`[SandboxService] Sandbox[${sandbox._id}] Created`);
      } else {
        sandbox._id = availableHotSandbox._id.toString();
        sandbox.status = 'RUNNING';
        sandbox.hotLoaded = true;
        const data = {
          user: payload.user,
          organization: payload.organization,
          ssh: payload.ssh,
          initRepositories: payload.initRepositories || [],
          domain: process.env.DOMAIN,
          token: payload.token
        };
        logger.info(`[SandboxService] Calling sandbox to setup user ${ sandbox._id }`);
        await this.broker.call(`SANDBOX_${availableHotSandbox._id}.SandboxService.setupUser`, data);

        logger.info(`[SandboxService] Setup done ${ sandbox._id }`);
        const deploymentResult = await this.k8sService.getDeployment(defaultName(sandbox), defaultNamespace);
        const deployment = deploymentResult.body;
        delete deployment.metadata.labels['available'];
        deployment.metadata.labels['user'] = payload.user._id.toString();
        if (payload.organization) {
          deployment.metadata.labels['organization'] = payload.organization;
        }

        let sandboxVolume = await this.sandboxVolumesService.findActiveByUser(sandbox.user, sandbox.organization);
        if (!sandboxVolume) {
          const settings = await this.sandboxSettingsService.find();
          sandboxVolume = await this.sandboxVolumesService.create(sandbox.user, sandbox.organization, settings.defaultVolumeSize);
        }
        applyPVCforDeployment(sandbox, deployment, sandboxVolume._id);
        await this.k8sService.putDeployment(deployment, defaultNamespace);
        logger.info(`[SandboxService] Deployment updated ${ sandbox._id }`);

        await this.sandboxHotTemplatesService.allocate(availableHotSandbox._id);
      }
      return sandbox;

    } catch (err) {
      logger.error(`[SandboxService] Sandbox Error`, err);
      throw err;
    }
  }

  async createUserSandbox(
    sandbox: Sandbox,
    ssh: { publicKey: string, privateKey: string },
    domain: string,
    token: string,
    organization?: string,
    initRepositories?: Array<{ username: string, repositoryName: string }>
  ) {
    const sandboxType = sandbox.type as any as SandboxType;
    const settings = await this.sandboxSettingsService.find();
    let sandboxVolume = await this.sandboxVolumesService.findActiveByUser(sandbox.user, sandbox.organization);
    if (!sandboxVolume) {
      sandboxVolume = await this.sandboxVolumesService.create(sandbox.user, sandbox.organization, settings.defaultVolumeSize);
    }
    const deployment = getDeploymentSpec(sandbox, true, sandboxType, settings, sandboxVolume._id);
    const secret = getSecretSpec(sandbox, ssh);
    const config = getConfigSpec(sandbox, true, initRepositories, domain, token, organization);
    const service = getServiceSpec(sandbox);


    await this.k8sService.applySecret(secret, defaultNamespace);
    await this.k8sService.applyConfig(config, defaultNamespace);
    await this.k8sService.applyDeployment(deployment, defaultNamespace);
    await this.k8sService.applyService(service, defaultNamespace);
  }

  @Event()
  async updateStatus(payload: { sandboxId: string, status: string }): Promise<void> {
    logger.info(`[SANDBOX_HOT_TEMPLATE_${payload.sandboxId}] status=${payload.status}`);
    if (payload.status === 'SHUTTING_DOWN_READY') {
      await this.terminateReadySandbox(payload.sandboxId);
    }
    await this.sandboxHotTemplatesService.setStatus(payload.sandboxId, payload.status);
  }

  @Event()
  async terminate(sandbox: Sandbox) {
    try {

      await this.terminateReadySandbox(sandbox._id);
    } catch (err) {
      logger.error(`[SandboxService] Sandbox Error`, err);
    }
  }

  async terminateReadySandbox(sandboxId: string) {
    try {

      logger.info(`[SandboxService] Sandbox[${ sandboxId }] Deleting deployments and configs`);

      const name = defaultName({ _id: sandboxId } as Sandbox);
      await this.k8sService.deleteSecret(name, defaultNamespace);
      await this.k8sService.deleteConfig(name, defaultNamespace);
      await this.k8sService.deleteDeployment(name, defaultNamespace);
      await this.k8sService.deleteService(name, defaultNamespace);

      const hotLoadedTemplate = await this.sandboxHotTemplatesService.remove(sandboxId);
      if (hotLoadedTemplate) {
        // wait 1 minute and try schedule another hot sandbox if it was a hot loaded
        setTimeout(async () => {
          const settings = await this.sandboxSettingsService.find();
          this.seedHotSandboxByType(hotLoadedTemplate.type, settings);
        }, 60 * 1000);
      }

      logger.info(`[SandboxService] Sandbox[${ sandboxId }] Terminated`);

      this.broker.emit('SandboxesService.updateStatus', { sandboxId, status: 'TERMINATED' }, [this.creatorsStudioTransportUri]);

    } catch (err) {
      logger.error(`[SandboxService] Sandbox Error`, err);
    }
  }

}