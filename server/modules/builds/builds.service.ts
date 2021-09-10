import { Service, Inject, Container } from 'typedi';
import { BuildSchema, Build, BuildType, BuildStatus } from './build.model';
import * as _ from 'lodash';
import { MailerService, SendMailOptions } from '../core/mailer.service';
import * as path from 'path';
import { User } from '@aitheon/core-server';
import { logger } from '@aitheon/core-server';
import { ServicesService } from '../services/services.service';
import { SettingsService } from '../settings/settings.service';
import { K8sService } from '../k8s/k8s.service';
import * as JSONStream from 'json-stream';
import * as fs from '../core/fs';
import { GitService } from './git.service';
import * as YAML from 'yamljs';
import { EcrService } from './ecr.service';
// import ServerRedis from '../core/server-redis';
import { environment } from '../../environment';
import { ProjectDBsService } from './project-dbs.service';
import { Transporter, TransporterService, Action, param } from '@aitheon/transporter';
import { Project } from '@aitheon/creators-studio-server';
import { CIConfig } from './ci-config';
import { SandboxHotTemplatesService } from '../sandboxes/sandbox-hot-templates.service';
import { SandboxSettingsService } from '../sandboxes/settings/sandbox-settings.service';
import { S3Service } from './s3.service';
import { ArtifactsService } from './artifacts.service';

@Service()
@Transporter()
export class BuildsService extends TransporterService {

  @Inject(type => MailerService)
  mailerService: MailerService;

  @Inject(type => SettingsService)
  settingsService: SettingsService;

  @Inject(type => ServicesService)
  servicesService: ServicesService;

  @Inject(type => GitService)
  gitService: GitService;

  @Inject(type => K8sService)
  k8sService: K8sService;

  @Inject(type => EcrService)
  ecrService: EcrService;

  @Inject(type => S3Service)
  s3Service: S3Service;

  @Inject(type => ArtifactsService)
  artifactsService: ArtifactsService;

  @Inject(type => ProjectDBsService)
  projectDBsService: ProjectDBsService;

  @Inject(type => SandboxHotTemplatesService)
  sandboxHotTemplatesService: SandboxHotTemplatesService;

  @Inject(type => SandboxSettingsService)
  sandboxSettingsService: SandboxSettingsService;

  basicJob = require(path.resolve('./server/assets/basic-job.json'));

  readonly buildsNamespace = 'ai-build-server';
  readonly simulatorsNamespace = 'ai-creators-studio';
  systemGraphTransportUri = `SYSTEM_GRAPH${ environment.production ? '' : '_DEV' }`;

  constructor() {
    super(Container.get('TransporterBroker'));
  }

  private async nextBuild(build?: Build) {
    logger.debug('[nextBuild]', JSON.stringify(build));
    if (build) {
      const query = { _id: { $ne: build._id.toString() }, $or: [{ status: BuildStatus.IN_PROGRESS }, { status: BuildStatus.PENDING }] } as any;
      if (build.service) {
        query.service = build.service;
      }
      if (build.project) {
        query.project = build.project;
      }
      if (build.type === BuildType.AITHEON_LIB ||  build.type === BuildType.USER_LIB) {
        query.gitUrl = build.gitUrl;
      }
      const queue = await BuildSchema.find(query, '_id');
      if (queue.length > 0) {
        const queuePromises = queue.map((b: Build) => { return this.cancel(b._id); });
        await Promise.all(queuePromises);
      }
      return this.build(build);
    }

    const totalInProgress = await BuildSchema.count({ status: BuildStatus.IN_PROGRESS });
    if (totalInProgress >= environment.maxConcurrentBuilds) {
      return;
    }

    const pendingBuilds = await BuildSchema.find({ status: BuildStatus.PENDING }).sort({ createdAt: -1 }).limit(1);
    if (pendingBuilds.length > 0) {
      return this.build(pendingBuilds[0]);
    }
  }

  async cancel(id: string) {
    await BuildSchema.findOneAndUpdate({ _id: id }, { $set: { status: BuildStatus.CANCELED, endDate: new Date() }});
    try {
      await this.cleanupBuild(id);
    } catch (err) {
      // Pending build
      if (err.code !== 404) {
        throw err;
      }
    }
    const build = await BuildSchema.findById(id, '-output');
    this.notifyDevs(build);
  }

  async restart(id: string) {
    let build = await BuildSchema.findOne({ _id: id }, '-_id -output -imagePushed -startDate -endDate -status -createdAt -startDate -endDate -fullImageName').lean();
    build = await new BuildSchema(build).save();
    return this.nextBuild(build);
  }

  @Action()
  async createUserBuild(@param({ type: 'any' }) build: Build, @param({ type: 'any' }) ssh?: { privateKey: string, publicKey: string }): Promise<Build> {
    return this.create(build, ssh);
  }

  @Action()
  async tagUserProject(@param({ type: 'string' }) buildId: string, @param({ type: 'string' }) tag: string, @param({ type: 'string' }) headCommit: string): Promise<void> {

    const build = await this.findById(buildId, false);

    if (build.artifactsBuild && build.artifactsPushed) {
      const s3ObjectPath = this.artifactsService.buildArtifactsName(environment.rootBuildsName, build.project.toString(), build._id.toString());
      const s3Object = await this.s3Service.getObject(s3ObjectPath);
      if (!s3Object) {
        throw new Error('No S3 object');
      }
      await this.artifactsService.tagArtifact(s3ObjectPath, build.project.toString(), tag);
    } else {
      const imageName = environment.appsNamespace;
      const ecrImage = await this.ecrService.getImageByTag(imageName, headCommit);
      if (!ecrImage) {
        throw new Error('No ECR image');
      }
      await this.ecrService.tagImage(ecrImage, tag);
    }
  }

  async create(build: Build, ssh?: { privateKey: string, publicKey: string }): Promise<Build> {
    return new Promise<Build>(async (resolve, reject) => {
      try {
        build.status = BuildStatus.PENDING;
        build.gitBranch = build.gitBranch || 'master';
        switch (build.type) {
          case BuildType.AITHEON_SERVICE:
            build.gitUrl = build.service.gitUrl;
            build.k8sNamespace = build.service.k8sNamespace;
            build.imageName = build.service.k8sNamespace;
            build.name = build.service._id;
            build.maxTries = parseInt(environment.maxTries.toString());
            build.requireDeploy = true;
            break;
          case BuildType.USER_SERVICE:
            // build.gitUrl = this.getUsersRepoUrl(build.project._id);
            if (build.project.appStoreSettings && build.project.appStoreSettings.slugName) {
              const prefix = build.project.projectType === 'INTERFACE' ? 'interfaces' : 'apps';
              build.ingressSlug = `/${ prefix }/${ build.project.appStoreSettings.slugName }`;
              build.npmClientLibName = build.project.appStoreSettings.slugName;
            }
            build.projectSpec = {
              projectType: build.project.projectType,
              language: build.project.language,
              slug: build.project.slug
            };
            if (build.project.runtime === 'AOS') {
              build.artifactsBuild = true;
            }
            build.name = build.project.name;
            build.k8sNamespace = environment.appsNamespace;
            build.imageName = environment.appsNamespace;
            // `${ build.service.k8sNamespace }/${ build.project._id }`
            build.maxTries = 1;
            // build.requireDeploy = build.project.projectType !== ProjectType.COMPUTE_NODE;
            build.requireDeploy = false;
            build.ssh = ssh;
            break;
          case BuildType.AITHEON_LIB:
            build.maxTries = 1;
            build.requireDeploy = false;
            // nothing for now
            break;
          case BuildType.USER_LIB: {
            build.name = build.project.name;
            build.maxTries = 1;
            build.ssh = ssh;
            build.requireDeploy = false;
            break;
          }
        }
        const buildSchema = new BuildSchema(build);
        build = await buildSchema.save();
        if (build.type === BuildType.AITHEON_SERVICE || build.type === BuildType.AITHEON_LIB) {
          this.notifyDevs(build);
        }
        this.nextBuild(build);
        resolve(build);
      } catch (err) {
        reject(err);
      }
    });
  }

  // getUsersRepoUrl(username: string, repoName: string) {
  //   return `ssh://git@gitea.gitea.svc.cluster.local/${ username }/${ repoName }.git`;
  // }

  async update(build: Build): Promise<Build> {
    return new Promise<Build>(async (resolve, reject) => {
      try {
        build = await BuildSchema.update({ _id: build._id }, build, { new: true });
        resolve(build);
      } catch (err) {
        reject(err);
      }
    });
  }

  async find(limit: number = 20): Promise<Build[]> {
    return BuildSchema.find({}, '-output').sort({ createdAt: -1 }).limit(limit);
  }

  @Action()
  async findByProject(@param({ type: 'string' }) projectId: string, @param({ type: 'number' }) skip: number = 0, @param({ type: 'number' }) limit: number = 20): Promise<Build[]> {
    return BuildSchema.find({ project: projectId }, '-output').sort({ createdAt: -1 }).skip(skip).limit(limit);
  }

  @Action()
  async findByIdAction(@param({ type: 'string' }) buildId: string, @param({ type: 'boolean' }) includeOutput: boolean = true): Promise<Build> {
    return this.findById(buildId, includeOutput);
  }

  async findById(@param({ type: 'string' }) buildId: string, @param({ type: 'boolean' }) includeOutput: boolean = true): Promise<Build> {
    const projection = {
      output: { $slice: -500 }
    } as any;
    if (!includeOutput) {
      projection.output = 0;
    }
    return BuildSchema.findById(buildId, projection);
  }

  async build(build: Build) {
    try {
      const job = _.cloneDeep(this.basicJob);
      const name = `build-${build._id.toString()}`;
      job.metadata.name = name;
      job.spec.template.metadata.name = name;

      job.spec.backoffLimit = build.maxTries;

      // branch build by default
      const initContaineBuildArgs = job.spec.template.spec.initContainers[0].args = [
        `apk apk update && apk add --no-cache git openssh &&\ngit clone ${ build.gitUrl } /context &&\n cd /context && git checkout ${ build.headCommit || build.gitBranch } --detach`
      ];

      console.log(`Build using ${ build.headCommit || build.gitBranch }`);

      job.spec.template.spec.initContainers[0].command = ['sh', '-c'];
      job.spec.template.spec.initContainers[0].args = initContaineBuildArgs;

      const imageName = build.imageName;
      const branch = environment.webhook.branch.toLowerCase();
      const imageTag = build.headCommit ? build.headCommit : `${ branch }`;
      const fullImageName = `${ environment.ecrAccount }/${ imageName }:${ imageTag }`;
      await BuildSchema.updateOne({ _id: build._id }, { $set: { fullImageName: fullImageName }});
      const token = environment.npm.token;
      const projects_token = environment.npm.projects_token;
      job.spec.template.spec.containers[0].args = [
        '--dockerfile=/context/Dockerfile',
        '--context=/context',
        `--build-arg=NPM_TOKEN=${token}`,
        `--build-arg=NPM_PROJECTS_TOKEN=${projects_token}`
      ];

      const args = job.spec.template.spec.containers[0].args;

      let ciConfig;
      if (build.type === BuildType.AITHEON_LIB) {
         ciConfig = await this.parseCIConfig(build);
      }

      if (environment.buildResources) {
        if (build.type === BuildType.USER_SERVICE) {
          job.spec.template.spec.containers[0].resources = {
            limits: {
              cpu: process.env.BUILD_LIMIT_CPU || '0.95',
              memory: process.env.BUILD_LIMIT_MEMORY || '2048Mi'
            },
            requests: {
              cpu: process.env.BUILD_REQUEST_CPU || '0.95',
              memory: process.env.BUILD_REQUEST_MEMORY || '2048Mi'
            }
          };
        } else if ((build.type === BuildType.AITHEON_LIB || build.type === BuildType.USER_LIB) && ciConfig && ciConfig.resources) {
          job.spec.template.spec.containers[0].resources = {
            limits: {
              cpu: ciConfig.resources.cpu,
              memory: ciConfig.resources.memory
            },
            requests: {
              cpu: ciConfig.resources.cpu,
              memory: ciConfig.resources.memory
            }
          };
        }
        else {
          job.spec.template.spec.containers[0].resources = environment.buildResources;
        }
      }

      const kanikoContainer = job.spec.template.spec.containers[0];
      if ((build.type === BuildType.USER_SERVICE || build.type === BuildType.USER_LIB)) {
        const buildSecret = this.getSecretSpec(build);

        if (build.artifactsBuild) {

          if (build.projectSpec.projectType === Project.ProjectTypeEnum.APP.toString()) {
            args.push(`--build-arg=PROJECT_ID=${build.project.toString()}`);
          } else {
            const s3ArtifactUrl = this.artifactsService.buildS3ArtifactsFullName(environment.rootBuildsName, build.project.toString(), build._id.toString());
            build.dockerfile += `

            RUN /aos-build-entrypoint.sh -p ${ build.projectSpec.slug} -i ${build.project.toString()} -r ${s3ArtifactUrl} -t ${build.projectSpec.projectType}
            `;
          }

          build.artifactsUrl = this.artifactsService.buildHttpsArtifactFullName(environment.rootBuildsName, build.project.toString(), build._id.toString());
          await BuildSchema.updateOne({ _id: build._id }, { $set: { artifactsUrl: build.artifactsUrl } });
        }
        const buildConfig = this.getConfigSpec(build);

        await this.k8sService.applySecret(buildSecret, this.buildsNamespace);
        await this.k8sService.applyConfig(buildConfig, this.buildsNamespace);

        job.spec.template.spec.volumes.push( {
          name: `${ name }-config`,
          configMap: {
            name: name
          }
        });

        kanikoContainer.volumeMounts.push({
          name: `${ name }-config`,
          mountPath: `/context/Dockerfile`,
          subPath: 'Dockerfile'
        });
      }

      kanikoContainer.env.push({
        name: 'BUILD_ID',
        value: build._id.toString()
      });

      if (build.type === BuildType.AITHEON_SERVICE && build.headCommit) {
        const ecrImage = await this.ecrService.getImageByTag(build.imageName, build.headCommit);
        if (ecrImage) {
          // skip build and do only deploy
          if (build.requireDeploy) {
            this.ecrService.tagImage(ecrImage, branch);
            await this.updateOutput(build, 'Image already builded. Skip build. Starting deploy...\n');
            // async tag image with branch name
            await this.deploy(build._id);
          }
          await this.updateStatus(build, BuildStatus.SUCCESS, true, true);
          this.nextBuild();
          return;
        }
      }

      const hasCacheLayer = await this.ecrService.hasCacheLayer(imageName);
      if (hasCacheLayer) {
        args.push('--cache=true');
        args.push(`--cache-repo=${ environment.ecrAccount }/${ imageName }/cache`);
      }
      if (build.type === BuildType.AITHEON_SERVICE) {
        args.push(`--destination=${ fullImageName }`);
        args.push(`--destination=${ environment.ecrAccount }/${ imageName }:${ build.gitBranch }`);
        args.push(`--build-arg=NPM_CLIENT_LIB_NAME=${ build.k8sNamespace.replace('ai-', '') }`);
      } else if (build.type === BuildType.USER_SERVICE) {
        args.push(build.artifactsBuild ? '--no-push' : `--destination=${ fullImageName }`);
        if (build.npmClientLibName) {
          args.push(`--build-arg=NPM_CLIENT_LIB_NAME=${ build.npmClientLibName }`);
        } else {
          args.push(`--build-arg=NPM_CLIENT_LIB_NAME=template`);
          args.push(`--build-arg=NPM_IGNORE_PUBLISH=true`);
        }
      } else if (build.type === BuildType.AITHEON_LIB) {
        if (!ciConfig || ciConfig && ciConfig.internal && !ciConfig.internal.pushImage) {
          args.push(`--no-push`);
        } else {
          args.push(`--destination=${ fullImageName }`);
        }
      } else if (build.type === BuildType.USER_LIB) {
        args.push(`--no-push`);
      }

      const sharedConfig = await this.k8sService.getSecret(this.buildsNamespace, 'shared-config');
      const MONGODB_URI = Buffer.from(sharedConfig.data.MONGODB_URI, 'base64').toString('utf8');
      args.push(`--build-arg=MONGODB_URI=${ MONGODB_URI }`);
      args.push(`--build-arg=BUILD_ID=${ build._id.toString() }`);

      job.spec.template.spec.volumes.push({
        'name': 'ssh-key',
        'secret': {
          'defaultMode': 256,
          'secretName': (build.type === BuildType.AITHEON_SERVICE || build.type === BuildType.AITHEON_LIB) ? 'ssh-github' : `build-${ build._id }`
        }
      });
      const jobStream = await this.k8sService.createJob(name, job, this.buildsNamespace);

      build.status = BuildStatus.IN_PROGRESS;
      await BuildSchema.updateOne({ _id: build._id }, {  $set: { startDate: new Date(), status: build.status } });

      if (build.type === BuildType.AITHEON_SERVICE || build.type === BuildType.AITHEON_LIB) {
        this.notifyDevs(build);
      }

      jobStream.on('data', async (event: any) => {
        // tslint:disable-next-line:no-null-keyword
        const output = `[JOB][${name}] Event=${event.type}; Status: ${JSON.stringify(event.object.status, null, 2)}`;
        await this.updateOutput(build, output);

        if (event.type === 'ADDED') {
          const logsStream = await this.k8sService.watchLogsByLabel(`job-name=${ name }`, this.buildsNamespace);
          if (logsStream) {
            logsStream.on('data', async (event: any) => {
              const output = event.toString();
              // logger.info('event logs:', output);
              await this.updateOutput(build, output);
            });
          }
        } else if (event.type === 'MODIFIED') {
          build = await BuildSchema.findById(build._id, '-output');
          if (build.status === BuildStatus.SUCCESS || build.status === BuildStatus.ERROR || build.status === BuildStatus.CANCELED) {
            return;
          }

          if (event.object.status.succeeded >= 1) {
            if (!build.imagePushed && !build.artifactsPushed) {
              await this.updateOutput(build, build.requireDeploy ? 'Build finished. Starting deploy...\n' : 'Build finished. Deploy as a Service not required \n');
              if (build.requireDeploy) {
                await this.deploy(build._id);
              }
              const postBuild = _.get(build, 'ciConfig.internal.actions.postBuild', []);
              const stages = _.get(build, 'ciConfig.internal.stages', []);
              if (stages.includes(environment.webhook.branch)) {
                for (const postBuildAction of postBuild) {
                  await this.updateOutput(build, 'Post build actons \n');
                  await this.broker.call(postBuildAction, { build });
                }
              }
              if (build.type === BuildType.USER_LIB) {
                try {
                  const latestBuild = await BuildSchema.findById(build._id).lean();
                  const libName = latestBuild.output.find((o: string) => o.substr(0, environment.userLibPrefix.length + 2) === `+ ${environment.userLibPrefix}`);
                  build.npmLibName = libName.substr(2).trim();
                } catch (err) {
                  logger.error('[BuildService.build]: could not parse lib name');
                }
              }
              await this.updateStatus(build, BuildStatus.SUCCESS, true, true);
              if (build.type === BuildType.AITHEON_SERVICE) {
                this.notifySystemGraph(build);
              }
              this.cleanupBuild(build._id);
              this.nextBuild();
            }
          } else if (event.object.status.failed >= build.maxTries) {
            await this.updateStatus(build, BuildStatus.ERROR);
            this.cleanupBuild(build._id);
            this.nextBuild();
          }
        }
      });
    } catch (err) {
      logger.info('[Deploy]', err);
    }
  }

  async notifySystemGraph(build: Build) {
    const payload = {
      service: build.service,
      inputs: build.transporter ? build.transporter.inputsService : [],
      outputs: build.transporter ? build.transporter.outputsService : [],
      nodeChannels: build.transporter ? build.transporter.nodeChannels : [],
    };
    this.broker.emit('NodesService.saveServiceNode', payload, [this.systemGraphTransportUri]);
  }

  async cleanupBuild(buildId: string) {
    const name = `build-${buildId.toString()}`;
    this.k8sService.cleanupJob(name, this.buildsNamespace);
    this.k8sService.deleteSecret(name, this.buildsNamespace);
    this.k8sService.deleteConfig(name, this.buildsNamespace);
  }

  getSecretSpec(build: Build) {
    return {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: `build-${ build._id }`
      },
      type: 'Opaque',
      data: {
        'id_rsa.pub': Buffer.from(build.ssh.publicKey).toString('base64'),
        'id_rsa': Buffer.from(build.ssh.privateKey).toString('base64')
      }
    };
  }

  getConfigSpec(build: Build) {
    return {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `build-${ build._id }`
      },
      type: 'Opaque',
      data: {
        Dockerfile: build.dockerfile,
        BUILD_ID: build._id
      }
    };
  }

  async deployByTag(serviceId: string, imageTag: string) {
    try {
      const service = await this.servicesService.findById(serviceId);
      const build = {
        type: BuildType.AITHEON_SERVICE,
        service: service,
        gitBranch: environment.webhook.branch,
        headCommit: imageTag,
        notifyEmails: [] as any
      } as Build;
      const result = await this.create(build);
      // await this.nextBuild(result);
      return result;
    } catch (err) {
      logger.info('[deployByTag]', err);
    }
  }

  private async updateStatus(build: Build, status: BuildStatus, ended: boolean = true, buildResultPushed: boolean = false) {
    build.status = status;
    build.artifactsBuild ? build.artifactsPushed = buildResultPushed : build.imagePushed = buildResultPushed;

    const toUpdate = { $set: { status: status, imagePushed: build.imagePushed, artifactsPushed: build.artifactsPushed, npmLibName: build.npmLibName } } as any;
    if (ended) {
      toUpdate.endDate = new Date();
    }

    await BuildSchema.updateOne({ _id: build._id }, toUpdate);
    if (build.type === BuildType.USER_SERVICE) {
      // ServerRedis.pubClient.publish(`${ environment.service._id }.BUILDS.STATUS`, JSON.stringify({ build: { _id: build._id, status, project: build.project }, sessionId: build.sessionId }));
      // this.broker.emit('GraphsService.nodeBuilded', { build: { _id: build._id, status }});
    } else if (build.type === BuildType.AITHEON_SERVICE || build.type === BuildType.AITHEON_LIB) {
      this.notifyDevs(build);
    }
  }

  private async notifyDevs(build: Build) {
    try {
      if (build.notifyEmails.length === 0) {
        return;
      }
      const subject = `Aitheon deployment: ${ build.name } - ${ build.status }`;
      const emailHtml = await this.mailerService.renderHtml(path.resolve(`./dist/modules/builds/templates/build-status.html`), {
        subject,
        build
      });
      build.notifyEmails.forEach(async (email: string) => {
       try {
        const options = new SendMailOptions(email, subject, emailHtml);
        logger.debug(`[notifyDevs][${ build._id.toString() }] send email to: `, email);
        await this.mailerService.send(options);
       } catch (err) {
        logger.error(`[notifyDevs] cant notify: ${ email }`, err);
       }
      });
    } catch (err) {
      logger.error('[notifyDevs]', err);
    }
  }

  private async updateOutput(build: Build, output: string) {
    await BuildSchema.updateOne({ _id: build._id }, { $push: { output } });
    if (build.type === BuildType.USER_SERVICE) {
      // ServerRedis.pubClient.publish(`${ environment.service._id }.BUILDS.OUTPUT.UPDATE`, JSON.stringify({ build: { output, project: build.project }, sessionId: build.sessionId }));
    }
  }

  async parseCIConfig(build: Build): Promise<CIConfig> {
    const buildPath = path.resolve(`builds/${ build._id }`);
    await this.gitService.clone(build.gitUrl, buildPath, build.type, build.headCommit);
    const ciPath = `${ buildPath }/.ai-ci.yaml`;
    if (await fs.exists(ciPath)) {
      const yaml = (await fs.readFile(ciPath)).toString();
      const ciConfig = YAML.parse(yaml);
      build.ciConfig = ciConfig;
      await BuildSchema.updateOne({ _id: build._id }, { $set: { ciConfig }});
      return ciConfig;
    }
  }

  async deploy(buildId: string) {
    const buildPath = path.resolve(`builds/${ buildId }`);
    try {
      const build = await this.findById(buildId);

      await fs.rimraf(buildPath);
      await fs.ensureDir(buildPath);

      if (!environment.production && build.type === BuildType.USER_SERVICE) {
        build.gitUrl = `ssh://git@${ environment.gitServer.url }:${ environment.gitServer.port }/git-server/repos/project-${build.project}.git`;
      }

      await this.gitService.clone(build.gitUrl, buildPath, build.type, build.headCommit);
      if (!(await fs.exists(`${ buildPath }/k8s`))) {
        logger.warn('[Deploy] Build do not have any k8s settings, skip deploy.');
        return;
      }
      const k8sFilesPaths = (await fs.readdir(`${ buildPath }/k8s`)).filter((name) => name.endsWith('.yaml')).sort() as any;
      const k8sFiles = [];
      for (const item of k8sFilesPaths) {
        k8sFiles.push(YAML.parse((await fs.readFile(`${ buildPath }/k8s/${ item }`)).toString()));
      }

      logger.info('Deploy files:', JSON.stringify(k8sFilesPaths, undefined, 2));

      for (const k8s of k8sFiles) {
        try {
          switch (k8s.kind) {
            case 'Namespace':
              this.tuneNamespace(k8s, build);
              const namespace = await this.k8sService.applyNamespace(k8s,  k8s.metadata.name);
              await this.updateOutput(build, `Namespace applied. [${ _.get(namespace, 'body.metadata.uid') }] \n`);
              break;
            case 'ConfigMap':
              // config for diff env
              const configBranch = _.get(k8s, 'metadata.annotations.branch');
              if (configBranch && configBranch != build.gitBranch) {
                break;
              }
              this.tuneConfig(k8s, build);
              const config = await this.k8sService.applyConfig(k8s, build.k8sNamespace);
              await this.updateOutput(build, `Config applied. [${ _.get(config, 'body.metadata.uid') }] \n`);
              break;
            case 'Deployment':
              await this.tuneDeployment(k8s, build);
              const deployment = await this.k8sService.applyDeployment(k8s,  build.k8sNamespace);
              await this.updateOutput(build, `Deployment applied. [${ _.get(deployment, 'body.metadata.uid') }] \n`);
              if (build.type === BuildType.USER_SERVICE) {
                const name = `project-${ build.project }`;
                await this.k8sService.deletePod(environment.appsNamespace, `app=${ name }`);
              }
              break;
            case 'Service':
              this.tuneService(k8s, build);
              const service = await this.k8sService.applyService(k8s, build.k8sNamespace);
              await this.updateOutput(build, `Service applied. [${ _.get(service, 'body.metadata.uid') }] \n`);
              break;
            case 'Ingress':
              this.tuneIngress(k8s, build);
              const ingress = await this.k8sService.applyIngress(k8s, build.k8sNamespace);
              await this.updateOutput(build, `Ingress applied. [${ _.get(ingress, 'body.metadata.uid') }] \n`);
              break;
            case 'LimitRange':
              const limitRange = await this.k8sService.applyLimitRange(k8s, build.k8sNamespace);
              await this.updateOutput(build, `Limit Range applied. [${ _.get(limitRange, 'body.metadata.uid') }] \n`);
              break;
            case 'PersistentVolumeClaim':
              const pvc = await this.k8sService.applyPvc(k8s, build.k8sNamespace);
              await this.updateOutput(build, `Persistent Volume Claim applied. [${ _.get(pvc, 'body.metadata.uid') }] \n`);
              break;
          }
        } catch (err) {
          await this.updateOutput(build, err.toString());
          await this.updateStatus(build, BuildStatus.ERROR);
        }
      }
      await fs.rimraf(buildPath);
      logger.debug('[Deploy] Build cleanup');

    } catch (err) {
      logger.error('[Deploy]', err);
      await fs.rimraf(buildPath);
      throw err;
    }
  }

  @Action()
  async updateRunnerImage(@param({ type: 'any' }) build: Build) {
    const sandboxRunnerVersion = build.headCommit;
    const settings = await this.sandboxSettingsService.updateRunnerImage(sandboxRunnerVersion);
    logger.debug('[Deploy] updateRunnerImage', sandboxRunnerVersion);
    this.sandboxHotTemplatesService.updateHotTemplates(settings);
    return true;
  }

  @Action()
  async updateSandboxImage(@param({ type: 'any' }) build: Build) {
    const sandboxVersion = build.headCommit;
    const settings = await this.sandboxSettingsService.updateSandboxImage(sandboxVersion);
    logger.debug('[Deploy] sandboxVersion', sandboxVersion);
    this.sandboxHotTemplatesService.updateHotTemplates(settings);
    return true;
  }

  private async tuneDeployment(deployment: any, build: Build) {
    if (build.type === BuildType.USER_SERVICE) {

      const projectDB = await this.projectDBsService.ensureDbConnection(build.project);

      deployment.spec.template.spec.containers[0].image = build.fullImageName;
      const name = `project-${ build.project }`;
      deployment.metadata.name = name;
      deployment.metadata.labels = { 'app': name };
      deployment.spec.template.metadata.labels = { 'app': name, 'deploy-at': new Date().toISOString() };

      const logsConfig = await this.k8sService.getSecret(this.buildsNamespace, 'logs-config');

      deployment.spec.template.spec.containers.forEach((c: any) => {
        if (c.envFrom) {
          c.envFrom = [
            { 'configMapRef': { 'name': name } }
          ];
        }
        if (!c.env) {
          c.env = [];
        }
        const dbIndex = c.env.findIndex((e: any) => { return e.name === 'MONGODB_URI'; });
        const connectionString = `mongodb://${ projectDB.username }:${ projectDB.password }@ai-mongo.ai-mongo.svc.cluster.local:27017/${ projectDB.name }?authSource=admin`;
        const value = { 'name': 'MONGODB_URI', 'value': connectionString};
        dbIndex === -1 ? c.env.push(value) : c.env[dbIndex] = value;

        c.env.push({
          name: 'LOGS_MONGODB_URI',
          value: Buffer.from(logsConfig.data.LOGS_MONGODB_URI, 'base64').toString('utf8')
        });

      });
    } else if (build.type === BuildType.AITHEON_SERVICE) {
      if (!deployment.spec.template.metadata.annotations) {
        deployment.spec.template.metadata.annotations = {};
      }
      deployment.spec.template.metadata.annotations['deployed-at'] = new Date().toISOString();
      deployment.spec.template.spec.containers.forEach((c: any) => {
        if (c.name === build.k8sNamespace) {
          c.image = build.fullImageName;
        }
      });
    }
  }

  private tuneNamespace(namespace: any, build: Build) {
    if (build.type === BuildType.USER_SERVICE) {
      namespace.metadata.name = environment.appsNamespace;
    }
  }

  private tuneConfig(config: any, build: Build) {
    if (build.type === BuildType.USER_SERVICE) {
      const name = `project-${ build.project }`;
      config.metadata.name = name;
      if (!config.data) {
        config.data = {};
      }
      config.data.PROJECT_ID = build.project;
      config.data.PROJECT_NAME = build.name;
    }
  }

  private tuneService(service: any, build: Build) {
    if (build.type === BuildType.USER_SERVICE) {
      const name = `project-${ build.project }`;
      service.metadata.name = name;
      service.spec.selector = { 'app': name };
    }
  }

  private tuneIngress(ingress: any, build: Build) {
    if (build.type === BuildType.USER_SERVICE) {
      const name = `project-${ build.project }`;
      ingress.metadata.name = name;
      ingress.metadata.labels = { 'app': name };

      const idRoute = `/apps/${ build.project }`;
      const routes = {
        'http': {
          'paths': [
            {
              'path': `${ idRoute }/?(.*)`,
              'backend': {
                'serviceName': name,
                'servicePort': 3000
              }
            }
          ]
        }
      };
      if (build.ingressSlug && build.ingressSlug != idRoute) {
        routes.http.paths.push({
          'path': `${ build.ingressSlug }/?(.*)`,
          'backend': {
            'serviceName': name,
            'servicePort': 3000
          }
        });
        ingress.metadata.annotations['nginx.ingress.kubernetes.io/configuration-snippet'] = `proxy_set_header X-BASE-HREF ${ build.ingressSlug }/;\n`;
      } else {
        ingress.metadata.annotations['nginx.ingress.kubernetes.io/configuration-snippet'] = `proxy_set_header X-BASE-HREF /apps/${ build.project }/;\n`;
      }
      ingress.spec.rules = [routes];

    }
  }

}
