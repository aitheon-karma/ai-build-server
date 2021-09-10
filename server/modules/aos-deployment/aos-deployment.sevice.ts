import { Service, Inject } from 'typedi';
import { ArtifactsService } from '../builds/artifacts.service';
import { environment } from '../../environment';
import { FlattenGraphNode, Project } from '@aitheon/system-graph-server';
import { WebSocketManager } from './websocket-manager';
import { DeviceInfo } from './device-info';
import { logger } from '@aitheon/core-server';
import { graphNodeJson, graphAppEdgeSettings  } from '../graphs/graph.defaults';

@Service()
export class AosDeploymentService {

  @Inject(type => WebSocketManager)
  webSocketManager: WebSocketManager;

  @Inject(type => ArtifactsService)
  artifactsService: ArtifactsService;

  constructor() {
  }

  async deployArtifactsBinary(graphNode: FlattenGraphNode) {
    try {

      const project: Project = graphNode.node.project;
      const device = graphNode.device as DeviceInfo;
      if (!device || !project) {
        throw new Error(`Invalid AOS Graph Node for deployment: ${graphNode._id}`);
      }
      logger.info(`[deployArtifactsBinary] Deploying binary artifacts to ${device._id}. GraphNode ${graphNode._id}.`);
      this.webSocketManager.createWebsocketClient(device);

      this.webSocketManager.logs(device, `[deployArtifactsBinary] Generating message header...`);
      const artifactId = `release-${graphNode.node.release.toString()}`;
      const packageFile = await this.artifactsService.getArtifact(environment.rootReleasesName, project._id.toString(), artifactId);
      const magicString = new Buffer('AITHEONX');
      const messageHeader = new Buffer(32);

      const messageJSONStr = JSON.stringify({
        type: 'PACKAGE.DEPLOY',
        project: {
          _id: project._id.toString(),
          slug: project.slug,
          name: project.name,
          projectType: project.projectType,
          runtime: graphNode.node.runtime,
          language: project.language
        },
        restartOnExit: true,
        runOnStartup: true,
        isSimulator: true
      });
      const messageJSON = new Buffer(messageJSONStr);

      this.webSocketManager.logs(device, `[deployArtifactsBinary] Generating message info... `);
      messageHeader.writeUInt32BE(messageJSON.byteLength, 0);
      messageHeader.writeUInt32BE(packageFile.byteLength, 4);
      this.webSocketManager.logs(device, `[deployArtifactsBinary] Concat package...`);
      const message = Buffer.concat([magicString, messageHeader, messageJSON, packageFile]);

      this.webSocketManager.logs(device, `
            ------
            [deployArtifactsBinary] Sending package...
            [${messageJSONStr}]
            [${ magicString.length}][${messageHeader.byteLength}][${messageJSON.byteLength}][${packageFile.byteLength}]
            Message Size: ${ message.byteLength}
            ------
            `);

      await this.webSocketManager.sendBytes(device, message);
      this.webSocketManager.logs(device, `[deployArtifactsBinary] Package sent.`);
      this.webSocketManager.logs(device, `
            ------
            Waiting device response...
            ------
            `);

    } catch (err) {
      console.error('[deployArtifactsBinary]', err);
    }
  }

  async deployArtifactsByUrl(graphNode: FlattenGraphNode, nodeConnections: any[], organization: string) {
    try {

      const project: Project = graphNode.node.project;
      const device = graphNode.device as DeviceInfo;
      if (!device || !project) {
        throw new Error(`Invalid AOS Graph Node for deployment: ${graphNode._id}`);
      }
      logger.info(`[deployArtifactsByUrl] Deploying artifacts by URL to ${device._id}. GraphNode ${graphNode._id}.`);
      this.webSocketManager.createWebsocketClient(device);

      this.webSocketManager.logs(device, `[deployArtifactsByUrl] Generating message...`);
      const artifactId = `release-${graphNode.node.release.toString()}`;
      const packageUrl = this.artifactsService.buildHttpsArtifactFullName(environment.rootReleasesName, project._id.toString(), artifactId);

      const msgDeployByUrl = {
        project: {
          _id: project._id.toString(),
          slug: project.slug,
          name: project.name,
          projectType: project.projectType,
          runtime: graphNode.node.runtime,
          language: project.language
        },
        restartOnExit: true,
        runOnStartup: true,
        isSimulator: true,
        url: packageUrl
      } as any;

      if (project.projectType === Project.ProjectTypeEnum.APP) {
        msgDeployByUrl.graphNode = {
          graphNodeJson: graphNodeJson(graphNode, nodeConnections),
          graphAppSettings: graphAppEdgeSettings(graphNode._id.toString(), organization)
        };
      }

      this.webSocketManager.logs(device, `
            ------
            [deployArtifactsByUrl] Sending package by URL...
            [${JSON.stringify(msgDeployByUrl)}]
            ------
            `);

      await this.webSocketManager.send(device, { type: 'PACKAGE.DEPLOY_URL', data: msgDeployByUrl });
      this.webSocketManager.logs(device, `[deployArtifactsByUrl] Package sent`);
      this.webSocketManager.logs(device, `
            ------
            [deployArtifactsByUrl] Waiting device response...
            ------
            `);

    } catch (err) {
      console.error('[deployArtifactsByUrl]', err);
    }
  }

  async startAosDeployment() {

  }

  async stopAosDeployment(device: DeviceInfo, projectId: string) {
    try {
      await this.webSocketManager.send(device, { type: 'PACKAGE.STOP', data: { project: { _id: projectId } } });
    } catch (err) {
      this.webSocketManager.logs(device, `[stopProject] Error: ${JSON.stringify(err)}`);
    }
  }

  async deleteAosDeployment() {

  }

  static isAosDeployment(graphNode: FlattenGraphNode): boolean {
    return graphNode.node.runtime === 'AOS';
  }

}