// import { Graph, GraphNode } from './graph';
import { environment } from '../../environment';
import { ProjectDB } from '../builds/project-db.model';
import { Build } from '../builds/build.model';
import { Graph, FunctionalGraphNode, FlattenGraphNode, Project } from '@aitheon/system-graph-server';

/**
 * Kubernetes Namespace
 */
export const defaultNamespace = 'graphs';


const defaultLabels = (graphNode: FlattenGraphNode) => {
  return {
    'graph': (graphNode as any).graphId,
    'graph-node': graphNode._id,
    'project': graphNode.node.project._id,
    // 'release': graphNode.node.release
  };
};

const defaultAnnotations = (graphNode: any) => {
  return {
    // 'graph-name': graph.name,
    'graph-node-name': graphNode.graphNodeName,
  };
};

export const defaultName = (graphNodeId: string) => {
  return `graph-node-${ graphNodeId }`;
};

const defaultMetadata = (graphNode: FlattenGraphNode) => {
  return {
    name: defaultName(graphNode._id),
    labels: defaultLabels(graphNode),
    annotations: defaultAnnotations(graphNode),
  };
};

/**
 * Default kubernetes values used to create a deployment
 */
export const getDeploymentSpec = (graphNode: FlattenGraphNode, releaseHash: string, organization: string) => {
  const labels = defaultLabels(graphNode) as any;
  labels['graph-organization'] = organization;

  const annotations = defaultAnnotations(graphNode) as any;
  annotations['release-hash'] = releaseHash;

  return {
    apiVersion: 'extensions/v1beta1',
    kind: 'Deployment',
    metadata: {
      name: defaultName(graphNode._id),
      labels: labels,
      annotations: annotations,
    },
    spec: {
      replicas: 1,
      revisionHistoryLimit: 0,
      strategy: {
        type: 'RollingUpdate',
        rollingUpdate: {
          maxUnavailable: 0,
          maxSurge: 1
        }
      },
      template: {
        metadata: {
          labels: labels,
          annotations: annotations
        },
        spec: {
          containers: [
            {
              env: [
                {
                  name: 'NODE_ENV',
                  value: 'production'
                },
                {
                  name: 'GRAPH_NODE_ID',
                  valueFrom: {
                    configMapKeyRef: {
                      name: defaultName(graphNode._id),
                      key: 'GRAPH_NODE_ID'
                    }
                  }
                },
                {
                  name: 'GRAPH_ID',
                  valueFrom: {
                    configMapKeyRef: {
                      name: defaultName(graphNode._id),
                      key: 'GRAPH_ID'
                    }
                  }
                },
                {
                  name: 'ORGANIZATION_ID',
                  value: organization
                }
              ],
              envFrom: [
                {
                  secretRef: {
                    name: `graph-node-${ graphNode._id }`
                  }
                }
              ],
              image: `${ environment.ecrAccount }/ai-creators-studio-apps:release-${ graphNode.node.release }`,
              imagePullPolicy: 'Always',
              name: `project-${ graphNode.node.project._id }`,
              ports: [
                {
                  containerPort: 3000
                }
              ],
              resources: {
                /**
                 * Settings only limits to run a much a possible on single node
                 */
                limits: {
                  cpu: '0.1',
                  memory: '128Mi'
                },
                requests: {
                  cpu: '0.05',
                  memory: '64Mi'
                }
              },
              volumeMounts: [
                {
                  name: defaultName(graphNode._id),
                  mountPath: `/opt/app/graph-node.json`,
                  subPath: 'graph-node.json'
                },
                {
                  name: defaultName(graphNode._id),
                  mountPath: `/opt/app/graph-app-settings.js`,
                  subPath: 'graph-app-settings.js'
                }
              ]
            }
          ],
          /**
           * Hardware node to select
           */
          nodeSelector: {
            'kops.k8s.io/instancegroup': 'graphs-node'
          },
          /**
           * Checker nodes with tain keys
           */
          tolerations: [
            {
              key: 'dedicated',
              operator: 'Equal',
              value: 'graphs-node',
              effect: 'NoSchedule'
            }
          ],
          volumes: [
            {
              name: defaultName(graphNode._id),
              configMap: {
                name: defaultName(graphNode._id)
              }
            }
          ]
        }
      }
    }
  };
};



export const getSecretSpec = (graphNode: FlattenGraphNode, projectDB: ProjectDB) => {
  const connectionString = `mongodb://${ projectDB.username }:${ projectDB.password }@ai-mongo.ai-mongo.svc.cluster.local:27017/${ projectDB.name }?authSource=admin`;
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: defaultMetadata(graphNode),
    type: 'Opaque',
    data: {
      MONGODB_URI: Buffer.from(connectionString).toString('base64'),
      RABBITMQ_URI: Buffer.from(`amqp://ai-rabbit:Ne&ZTeFeYCqqQRK3s7qF@ai-rabbitmq.ai-rabbitmq.svc.cluster.local:5672`).toString('base64'),
    }
  };
};

export const graphNodeJson = (graphNode: FlattenGraphNode, connections: any) => {
  return JSON.stringify({ _id: graphNode._id, connections: connections, settings: ((graphNode as any).settings || {}) });
};

export const getConfigSpec = (graphNode: FlattenGraphNode, connections: any) => {
  const data = {
    GRAPH_ID: (graphNode as any).graphId,
    GRAPH_NODE_ID: graphNode._id,
    'graph-node.json': graphNodeJson(graphNode, connections),
    'graph-app-settings.js': graphAppSettings(),
  };

  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: defaultMetadata(graphNode),
    type: 'Opaque',
    data
  };
};


export const getServiceSpec = (graphNode: FlattenGraphNode) => {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: defaultMetadata(graphNode),
    spec: {
      ports: [
        {
          port: 3000,
          targetPort: 3000,
          name: 'http'
        }
      ],
      selector: {
        'graph-node': graphNode._id
      }
    }
  };
};

export const graphAppEdgeSettings = (graphNodeId: string, organization: string) => {
  const settings = `{
    functionGlobalContext: {
      env: {
        PWD: '.',
        NODE_ENV: 'dev',
        RABBITMQ_URI: '${environment.rabbitmq.uri.replace('ai-rabbitmq.ai-rabbitmq.svc.cluster.local', 'localhost')}',
        GRAPH_NODE_ID: '${graphNodeId}',
        ORGANIZATION_ID: ${organization}
      }
    },
    flowFile: 'flows.json',
    userDir: '.',
    editorTheme: {
      header: {
        title: 'Graph App',
        image: null,
        url: null,
      },
      page: {
        title: 'Aitheon Graph App',
        favicon: null,
        css: null,
      },
      menu: {
        'menu-item-help': false,
        'menu-item-node-red-version': false
      },
    },
    disableEditor: true,
    uiPort: 5000
  }`;
  return `module.exports = ${ settings }`;
};

export const graphAppSettings = () => {
  const settings = `{
    functionGlobalContext: {
      env: {
        PWD: '/opt/app',
        NODE_ENV: 'production',
        MONGODB_URI: process.env.MONGODB_URI,
        RABBITMQ_URI: process.env.RABBITMQ_URI,
        DEBUG: process.env.DEBUG,
        DEBUG_PWD: process.env.DEBUG_PWD,
        GRAPH_NODE_ID: process.env.GRAPH_NODE_ID,
        BUILD_ID: process.env.BUILD_ID,
        ORGANIZATION_ID: process.env.ORGANIZATION_ID
      }
    },
    flowFile: '/opt/app/flows.json',
    userDir: '/opt/app',
    editorTheme: {
      header: {
        title: 'Graph App',
        image: null,
        url: null,
      },
      page: {
        title: 'Aitheon Graph App',
        favicon: null,
        css: null,
      },
      menu: {
        'menu-item-help': false,
        'menu-item-node-red-version': false
      },
    },
    disableEditor: true,
    uiPort: 3000
  }`;
  return `module.exports = ${ settings }`;
};
