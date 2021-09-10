import { Service, Inject, Container } from 'typedi';
import * as _ from 'lodash';
import { environment } from '../../environment';
import { logger } from '@aitheon/core-server';
import { getDeploymentSpec, defaultNamespace, getSecretSpec, getConfigSpec, getServiceSpec, defaultName } from './graph.defaults';
import { K8sService } from '../k8s/k8s.service';
import { ProjectDBsService } from '../builds/project-dbs.service';
import { Transporter, TransporterService, Action, Event, param } from '@aitheon/transporter';
import { BuildsService } from '../builds/builds.service';
import { FlattenGraph, FlattenGraphNode } from '@aitheon/system-graph-server';
import { createHmac } from 'crypto';
import { GraphNodeDeploySchema, GraphNodeDeploy } from './graph-node-deploy.model';
import * as aws from 'aws-sdk';
import * as  elasticsearch from 'elasticsearch';
import * as mongosee from 'mongoose';
import { writeFile } from 'fs';
import { AosDeploymentService } from '../aos-deployment/aos-deployment.sevice';
import { DeviceInfo } from '../aos-deployment/device-info';
const awsHttpClient = require('http-aws-es');

@Service()
@Transporter()
export class GraphsService extends TransporterService {

  @Inject(type => K8sService)
  k8sService: K8sService;

  @Inject(type => ProjectDBsService)
  projectDBsService: ProjectDBsService;

  @Inject(type => BuildsService)
  buildsService: BuildsService;

  @Inject(type => AosDeploymentService)
  aosDeploymentService: AosDeploymentService;

  systemGraphTransporterUri = `SYSTEM_GRAPH${environment.production ? '' : '_DEV'}`;
  creatorsStudioTransporterUri = `CREATORS_STUDIO${environment.production ? '' : '_DEV'}`;

  elasticsearchClient: elasticsearch.Client;

  constructor() {
    super(Container.get('TransporterBroker'));

    const options = {
      hosts: [environment.elasticSearchHost], // array of amazon es hosts (required)
      connectionClass: awsHttpClient, // use this connector (required)
      awsConfig: new aws.Config({ region: 'eu-west-1', credentials: new aws.SharedIniFileCredentials(), }), // set an aws config e.g. for multiple clients to different regions
    };
    this.elasticsearchClient = new elasticsearch.Client(options);

  }

  @Event()
  async publish(graph: FlattenGraph) {

    // writeFile('graph-deploy.json', JSON.stringify(graph, undefined, 2), (err) => {
    //   console.log('Graph debug done');
    // });

    const nodes = graph.graphNodes
      .filter((graphNode: FlattenGraphNode) => (graphNode.node.type === 'USER_NODE' || graphNode.node.type === 'CORE_NODE')
        && !!graphNode.node.release);

    const graphNodeIds = nodes.map((graphNode: FlattenGraphNode) => graphNode._id);
    if (graphNodeIds.length > 0) {
      const query = { organization: graph.organization, graphNode: { $not: { $in: graphNodeIds } } } as any;
      if (graph.graphId) {
        query.graph = graph.graphId;
      }
      const nodesToTerminate = await GraphNodeDeploySchema.find(query);
      for (let index = 0; index < nodesToTerminate.length; index++) {
        const nodeToTerminate = nodesToTerminate[index];
        let device: any;
        if (nodeToTerminate.deviceDeployment) {
          const deviceNode = nodes.find(node => node.graphId === nodeToTerminate.graphNode.toString());
          device = deviceNode && deviceNode.device;
        }
        await this.terminateGraphNode(nodeToTerminate.organization, nodeToTerminate, device);
      }
    }

    const serviceNodes = graph.graphNodes
      .filter((graphNode: FlattenGraphNode) => graphNode.node.type === 'SERVICE_NODE')
      .reduce((result: any, graphNode) => (result[graphNode._id] = graphNode, result), {});

    nodes.forEach(async (graphNode: FlattenGraphNode) => {
      await this.startGraphNode(graph.organization, graphNode, graph.connections, serviceNodes);
    });
  }

  @Event()
  async stop(flatternGraph: FlattenGraph) {

    // const nodes = graph.graphNodes
    //   .filter((graphNode: FunctionalGraphNode) => (graphNode.node.type === 'USER_NODE' || graphNode.node.type === 'CORE_NODE'));
    // graphNodes

    const filteredUniqGraphNodes = _.uniq(flatternGraph.graphNodes.filter((graphNode: any) => (graphNode.node.type === 'USER_NODE' || graphNode.node.type === 'CORE_NODE')));
    const graphIds = filteredUniqGraphNodes.map((graphNode: any) => graphNode.graphId);

    if (graphIds.length === 0) {
      return;
    }
    const nodes = await GraphNodeDeploySchema.find({ graph: { $in: graphIds } });

    nodes.forEach(async (graphNodeDeploy: GraphNodeDeploy) => {
      logger.info(`[GraphService] GraphNode Stopping Graph=${graphNodeDeploy.graph}; GraphNode=${graphNodeDeploy.graphNode}`);
      try {
        let device: DeviceInfo;
        if (graphNodeDeploy.deviceDeployment) {
          const graphNode = filteredUniqGraphNodes.find(node => node._id.toString() === graphNodeDeploy.graphNode.toString());
          if (!graphNode) {
            throw new Error(`Invalid graph node deployment ${JSON.stringify(GraphNodeDeploy)}`);
          }
          device = graphNode.device;
        }

        await this.terminateGraphNode(flatternGraph.organization, graphNodeDeploy, device);
      } catch (err) {
        logger.error(`[GraphService] GraphNode[${graphNodeDeploy.graph}] on stop error`, err);
      }
    });
  }

  @Event()
  async publishGraphNode(event: { organization: string, graphNode: FlattenGraphNode, connections: any[] }) {
    await this.startGraphNode(event.organization, event.graphNode, event.connections, {});
  }

  @Event()
  async stopGraphNode(event: { organization: string, graphNode: FlattenGraphNode }) {
    try {
      const graphNodeDeploy = await GraphNodeDeploySchema.findOne({ graphNode: event.graphNode });
      if (!graphNodeDeploy) {
        logger.error(`[GraphService]: GraphNode ${ event.graphNode } was never deployed `);
        return;
      }
      logger.info(`[GraphService] GraphNode Stopping Graph=${ graphNodeDeploy.graph }; GraphNode=${event.graphNode._id}`);
      await this.terminateGraphNode(event.organization, graphNodeDeploy, event.graphNode.device);
    } catch (err) {
      logger.error(`[GraphService] GraphNode[${ event.graphNode }] on stop error`, err);
    }
  }

  @Action()
  async getNodeLogs(@param({ type: 'string' }) graphNodeId: string) {
    const label = `graph-node=${graphNodeId}`;
    const result = await this.k8sService.getLogsByLabel(label, defaultNamespace);
    return result ? result.body : '';
  }

  @Action()
  async getLogs(
    @param({ type: 'string', optional: true }) graphId: string,
    @param({ type: 'string', optional: true }) graphNodeId: string,
    @param({ type: 'string', optional: true }) organization: string,
    @param({ type: 'string', optional: true }) scrollId: string,
    @param({ type: 'number', optional: true }) size: number = 100,
    @param({ type: 'number', optional: true }) from: number = 0
  ) {
    try {
      let rawData;
      if (scrollId && scrollId != 'new') {
        rawData = await this.elasticsearchClient.scroll({
          scrollId,
          scroll: '30s'
        });
      } else {
        const query = [];
        if (graphId) {
          query.push(`kubernetes.labels.graph:"${graphId}"`);
        }
        if (graphNodeId) {
          query.push(`kubernetes.labels.graph-node:"${graphNodeId}"`);
        }
        if (organization) {
          query.push(`kubernetes.labels.graph-organization:"${organization}"`);
        }
        if (query.length === 0) {
          return { data: [], total: 0, scrollId: undefined };
        }
        const elasticQuery = query.join(' AND ');
        rawData = await this.elasticsearchClient.search({
          q: elasticQuery,
          size,
          from,
          scroll: scrollId === 'new' ? '30s' : undefined,
          sort: '@timestamp:desc',
          _source: ['@timestamp', 'kubernetes.labels', 'stream', 'log']
        });
      }
      const data = rawData.hits.hits.map((hit: any) => {
        return { timestamp: hit._source['@timestamp'], log: hit._source.log, graphNodeId: hit._source.kubernetes.labels['graph-node'] || '', stream: hit._source.stream };
      });
      return { data, total: (rawData.hits.total as any).value, scrollId: rawData._scroll_id };
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async terminateGraphNode(organization: string, graphNodeDeploy: GraphNodeDeploy, device?: DeviceInfo) {
    try {

      if (graphNodeDeploy.deviceDeployment) {
        await this.aosDeploymentService.stopAosDeployment(device, graphNodeDeploy.project.toString());
      } else {
        const name = defaultName(graphNodeDeploy.graphNode);
        await this.k8sService.deleteSecret(name, defaultNamespace);
        await this.k8sService.deleteConfig(name, defaultNamespace);
        await this.k8sService.deleteDeployment(name, defaultNamespace);
        await this.k8sService.deleteService(name, defaultNamespace);
      }

      logger.info(`[GraphService] GraphNode[${graphNodeDeploy.graphNode}] Terminated`);
      await GraphNodeDeploySchema.deleteMany({ organization, graphNode: graphNodeDeploy.graphNode });
      this.broker.emit(`GraphsService.graphNodeStatus`, { graphNodeId: graphNodeDeploy.graphNode, status: 'TERMINATED' }, this.systemGraphTransporterUri);

    } catch (err) {
      logger.error(`[GraphService] GraphNode[${graphNodeDeploy.graphNode}] termination Error`, err);
      this.broker.emit(`GraphsService.graphNodeStatus`, { graphNodeId: graphNodeDeploy.graphNode, status: 'ERROR' }, this.systemGraphTransporterUri);
    }
  }

  private async startGraphNode(organization: string, graphNode: FlattenGraphNode, connections: any[], serviceNodes: { [key: string]: any }) {
    try {
      const projectDB = await this.projectDBsService.ensureDbConnectionByGraphNode(graphNode._id);
      const nodeConnections = connections.filter((connection: any) => connection.source.graphNode === graphNode._id || connection.target.graphNode === graphNode._id);

      nodeConnections.forEach((conn: any) => {
        const serviceNode = serviceNodes[conn.target.graphNode];
        if (serviceNode) {
          conn.target.service = serviceNode.node.service;
        }
      });

      const hmac = createHmac('sha1', graphNode.node.release);
      const releaseHash = hmac.update(JSON.stringify({ connections: nodeConnections, settings: ((graphNode as any).settings) || {} })).digest('hex');

      const deviceDeployment = AosDeploymentService.isAosDeployment(graphNode);
      if (deviceDeployment) {
        this.aosDeploymentService.deployArtifactsByUrl(graphNode, nodeConnections, organization);
      } else {
        const deployment = getDeploymentSpec(graphNode, releaseHash, organization);
        const secret = getSecretSpec(graphNode, projectDB);
        const config = getConfigSpec(graphNode, nodeConnections);
        const service = getServiceSpec(graphNode);

        await this.k8sService.applySecret(secret, defaultNamespace);
        await this.k8sService.applyConfig(config, defaultNamespace);
        await this.k8sService.applyDeployment(deployment, defaultNamespace);
        await this.k8sService.applyService(service, defaultNamespace);
      }

      const graphId = (graphNode as any).graphId;
      const graphNodeDeploy = { graph: graphId, organization, graphNode: graphNode._id };

      await GraphNodeDeploySchema.updateOne(graphNodeDeploy, {
        ...graphNodeDeploy,
        project: graphNode.node.project._id,
        releaseHash: releaseHash,
        release: graphNode.node.release,
        deviceDeployment: deviceDeployment,
        device: deviceDeployment ? graphNode.device._id : undefined
      }, { upsert: true });

      logger.info(`[GraphService] GraphNode[${graphNode._id}] Deploy PENDING`);
      this.broker.emit(`GraphsService.graphNodeStatus`, { graphNodeId: graphNode._id, status: 'PENDING' }, this.systemGraphTransporterUri);
      // TODO: replace with real running status
      setTimeout(() => {
        this.broker.emit(`GraphsService.graphNodeStatus`, { graphNodeId: graphNode._id, status: 'RUNNING' }, this.systemGraphTransporterUri);
      }, 10 * 1000);

    } catch (err) {
      logger.error(`[GraphService] GraphNode[${graphNode._id}] nodeBuilded Error`, err);
      this.broker.emit(`GraphsService.graphNodeStatus`, { graphNodeId: graphNode._id, status: 'ERROR' }, this.systemGraphTransporterUri);
    }
  }

}
