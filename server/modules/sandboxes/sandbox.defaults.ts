import { environment } from '../../environment';
import { ProjectDB } from '../builds/project-db.model';
import { extend } from 'lodash';
import { Build } from '../builds/build.model';
// import { SandboxResource } from './sandbox-resource';
import { Sandbox } from '@aitheon/creators-studio-server';
import { User } from '@aitheon/core-server';
import { SandboxResource, SandboxType } from './sandbox-type.model';
import { SandboxHotTemplate } from './sandbox-hot-template.model';
import { SandboxSettings } from './settings/sandbox-settings.model';
import { SandboxVolume } from './sandbox-volume.model';

/**
 * Kubernetes Namespace
 */
export const defaultNamespace = 'ai-creators-studio';


const defaultLabels = (sandbox: Sandbox | SandboxHotTemplate) => {
  return {
    'sandbox': sandbox._id,
    'sandbox-type': (sandbox.type as SandboxType)._id
  };
};

const defaultAnnotations = (sandbox: Sandbox | SandboxHotTemplate) => {
  return {
    // 'user': (sandbox.user as any)._id,
  };
};

export const defaultName = (sandbox: Sandbox | SandboxHotTemplate) => {
  return `sandbox-${sandbox._id}`;
};

const defaultMetadata = (sandbox: Sandbox | SandboxHotTemplate) => {
  return {
    name: defaultName(sandbox),
    labels: defaultLabels(sandbox),
    annotations: defaultAnnotations(sandbox),
  };
};

const vsCodePort = 8080;
const runnerPort = 3002;
const webViewPort = 3000;
const nodeRedPort = 1880;

/**
 * Default kubernetes values used to create a deployment
 */
export const getDeploymentSpec = (
  sandbox: Sandbox | SandboxHotTemplate,
  includeUserData: boolean,
  sandboxType: SandboxType,
  sandboxSettings: SandboxSettings,
  sandboxVolumeId?: string
) => {
  const annotations = defaultAnnotations(sandbox) as any;
  const labels = defaultLabels(sandbox) as any;
  if (!includeUserData) {
    labels['available'] = 'true';
  } else {
    labels['user'] = (sandbox as any).user._id;
    const organization = (sandbox as Sandbox).organization;
    if (organization) {
      labels['organization'] = organization;
    }
  }
  const deployment = {
    apiVersion: 'extensions/v1beta1',
    kind: 'Deployment',
    metadata: {
      name: defaultName(sandbox),
      labels: labels,
      annotations: annotations,
    },
    spec: {
      replicas: 1,
      strategy: {
        type: 'Recreate'
      },
      template: {
        metadata: {
          labels: defaultLabels(sandbox),
          annotations: annotations
        },
        spec: {
          containers: [
            {
              env: [
                {
                  name: 'GIT_SSH_COMMAND',
                  value: 'ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no'
                },
                {
                  name: 'NPM_TOKEN',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'npmconfig',
                      key: 'token'
                    }
                  },
                },
                {
                  name: 'NPM_PROJECTS_TOKEN',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'npmconfig',
                      key: 'projects-token-readonly'
                    }
                  },
                },
                {
                  name: 'RABBITMQ_URI',
                  value: environment.production ? environment.rabbitmq.uri : environment.rabbitmq.uri.replace('localhost', 'ai-rabbitmq.ai-rabbitmq.svc.cluster.local')
                },
              ],
              envFrom: [
                {
                  configMapRef: {
                    name: `sandbox-${sandbox._id}`
                  }
                }
              ],
              image: `${environment.ecrAccount}/sandbox:${sandboxSettings.sandboxVersion}`,
              imagePullPolicy: 'IfNotPresent',
              name: `sandbox-${sandbox._id}`,
              ports: [
                // http application
                { containerPort: webViewPort },
                // runner
                { containerPort: runnerPort },
                // vs code
                { containerPort: vsCodePort },
                { containerPort: nodeRedPort }
              ],
              securityContext: {
                runAsUser: 1000
              },
              resources: {
                limits: {
                  cpu: sandboxType.resource.cpu,
                  memory: sandboxType.resource.memory
                },
                requests: {
                  cpu: sandboxType.resource.cpu,
                  memory: sandboxType.resource.memory
                }
              },
              volumeMounts: [] as Array<any>
            },
            {
              env: [
                {
                  name: 'NODE_ENV',
                  value: 'production'
                },
                {
                  name: 'GIT_SSH_COMMAND',
                  value: 'ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no'
                },
                {
                  name: 'NPM_PROJECTS_TOKEN',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'npmconfig',
                      key: 'projects-token-readonly'
                    }
                  },
                },
                {
                  name: 'MONGODB_URI',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'shared-config',
                      key: 'MONGODB_URI'
                    }
                  }
                },
                {
                  name: 'RABBITMQ_URI',
                  value: environment.production ? environment.rabbitmq.uri : environment.rabbitmq.uri.replace('localhost', 'ai-rabbitmq.ai-rabbitmq.svc.cluster.local')
                },
              ],
              envFrom: [
                {
                  configMapRef: {
                    name: `sandbox-${sandbox._id}`
                  }
                }
              ],
              image: `${environment.ecrAccount}/ai-creators-studio-runner:${sandboxSettings.sandboxRunnerVersion}`,
              imagePullPolicy: 'IfNotPresent',
              securityContext: {
                runAsUser: 1000
              },
              name: `sandbox-${sandbox._id}-runner`,
              volumeMounts: [] as Array<any>
            }
          ],
          securityContext: {
            fsGroup: 1000
          },
          /**
           * Hardware node to select
           */
          nodeSelector: {
            'kops.k8s.io/instancegroup': sandboxType.nodeSelector
          },
          /**
           * Checker nodes with tain keys
           */
          tolerations: [
            {
              key: 'dedicated',
              operator: 'Equal',
              value: sandboxType.nodeSelector,
              effect: 'NoSchedule'
            }
          ],
          volumes: [
            {
              name: 'config-volume',
              configMap: {
                name: defaultName(sandbox)
              }
            }
          ] as Array<any>,
          terminationGracePeriodSeconds: 5,
        }
      }
    }
  };
  if (includeUserData) {
    applyPVCforDeployment(sandbox, deployment, sandboxVolumeId);
  }
  return deployment;
};

export const applyPVCforDeployment = (sandbox: Sandbox | SandboxHotTemplate, deployment: any, sandboxVolumeId: string) => {
  const vsCodeContainer = deployment.spec.template.spec.containers[0];
  const runnerContainer = deployment.spec.template.spec.containers[1];

  const configVolumeMount = {
    name: 'config-volume',
    mountPath: `/home/coder/.gitconfig`,
    subPath: '.gitconfig'
  } as any;
  const giteaSshMount = {
    name: 'gitea-ssh',
    readOnly: false,
    mountPath: '/home/coder/.ssh'
  } as any;
  const workspaceMount = {
    name: 'workspace-data',
    mountPath: `/home/coder/workspace`,
    subPath: 'workspace-data',
    readOnly: false
  };
  const localShareMount = {
    name: 'workspace-data',
    mountPath: `/home/coder/.local/share`,
    subPath: 'share',
    readOnly: false
  };
  runnerContainer.volumeMounts.push(giteaSshMount);
  runnerContainer.volumeMounts.push(configVolumeMount);
  runnerContainer.volumeMounts.push(workspaceMount);
  runnerContainer.volumeMounts.push(localShareMount);

  vsCodeContainer.volumeMounts.push(giteaSshMount);
  vsCodeContainer.volumeMounts.push(configVolumeMount);
  vsCodeContainer.volumeMounts.push(workspaceMount);
  vsCodeContainer.volumeMounts.push(localShareMount);

  deployment.spec.template.spec.volumes.push({
    name: 'gitea-ssh',
    secret: {
      secretName: defaultName(sandbox),
      defaultMode: 256
    }
  } as any);

  const workspaceDataVolume = {
    name: 'workspace-data',
    persistentVolumeClaim: {
      claimName: `sandbox-volume-${sandboxVolumeId}`
    }
  };
  deployment.spec.template.spec.volumes.push(workspaceDataVolume);

};

export const getPVC = (sandboxVolume: SandboxVolume, size: number) => {
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: {
      name: `sandbox-volume-${sandboxVolume._id.toString()}`,
      labels: {
        'sandbox-volume': sandboxVolume._id.toString()
      },
      annotations: {
        user: sandboxVolume.user.toString(),
        organization: sandboxVolume.organization.toString(),
      }
    },
    spec: {
      accessModes: [
        'ReadWriteOnce'
      ],
      resources: {
        requests: {
          storage: `${size}Gi`
        }
      },
      storageClassName: 'gp2-multi'
    }
  };
};


export const getSecretSpec = (sandbox: Sandbox, ssh: { publicKey: string, privateKey: string }) => {
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: defaultMetadata(sandbox),
    type: 'Opaque',
    data: {
      'id_rsa.pub': Buffer.from(ssh.publicKey).toString('base64'),
      'id_rsa': Buffer.from(ssh.privateKey).toString('base64')
    }
  };
};


export const getConfigSpec = (
  sandbox: Sandbox | SandboxHotTemplate, includeUserData: boolean,
  initRepositories?: Array<{ username: string, repositoryName: string }>,
  domain?: string,
  token?: string,
  organization?: string,
) => {
  const config = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: defaultMetadata(sandbox),
    type: 'Opaque',
    data: {
      SANDBOX_ID: sandbox._id,
      BASE_PATH: `/sandboxes/${sandbox._id}/`,
      CPU_RESOURCES: Math.round((sandbox.type as SandboxType).resource.cpu).toString(),
      RAM_RESOURCES: (sandbox.type as SandboxType).resource.memory.replace('Mi', ''),
      IO_RESOURCES: '0.25'
    } as any
  };
  if (includeUserData) {
    const user = (sandbox as Sandbox).user as any as User;
    config.data.USER = user._id;
    config.data['.gitconfig'] = `[user]\n\tname = ${user.profile.firstName} ${user.profile.lastName}\n\temail = ${user.email}\n`;
    config.data.INIT_REPOSITORIES = JSON.stringify(initRepositories || []);
    config.data['sandbox.json'] = JSON.stringify({
      domain,
      token,
      sandbox: sandbox._id,
      organization,
      user: { _id: user._id, email: user.email }
    });
  }

  return config;
};


export const getServiceSpec = (sandbox: Sandbox | SandboxHotTemplate) => {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: defaultMetadata(sandbox),
    spec: {
      ports: [
        {
          port: vsCodePort,
          targetPort: vsCodePort,
          name: 'http'
        }
      ],
      selector: defaultLabels(sandbox)
    }
  };
};


// export const getIngressSpec = (sandbox: Sandbox | SandboxHotTemplate) => {
//   const annotations = {
//     'kubernetes.io/ingress.class': 'nginx',
//     'nginx.ingress.kubernetes.io/rewrite-target': '/$1',
//     'nginx.ingress.kubernetes.io/proxy-read-timeout': '86400',
//     'nginx.ingress.kubernetes.io/proxy-send-timeout': '86400',
//     'alb.ingress.kubernetes.io/scheme': 'internet-facing'
//   } as any;
//   // if (environment.production) {
//   //   annotations['nginx.ingress.kubernetes.io/auth-url'] = `http://ai-creators-studio.ai-creators-studio.svc.cluster.local:3000/api/sandboxes/${ sandbox._id }/auth`;
//   // }
//   const metadata = extend(defaultMetadata(sandbox), { annotations });
//   return {
//     apiVersion: 'extensions/v1beta1',
//     kind: 'Ingress',
//     metadata: metadata,
//     spec: {
//       rules: [
//         {
//           http: {
//             paths: [
//               {
//                 path: `/sandboxes/${sandbox._id}/?(.*)`,
//                 backend: {
//                   serviceName: defaultName(sandbox),
//                   servicePort: vsCodePort
//                 }
//               },
//               {
//                 path: `/sandboxes/${sandbox._id}/node-red/?(.*)`,
//                 backend: {
//                   serviceName: defaultName(sandbox),
//                   servicePort: nodeRedPort
//                 }
//               },
//             ]
//           }
//         }
//       ]
//     }
//   };
// };

export const projectGitContainer = (projectId: string, contextName: string, mountPath: string) => {
  return {
    'name': `clone-repo-${projectId}`,
    'image': 'alpine/git',
    'args': [
      'clone',
      '--single-branch',
      '--',
      `ssh://git@git-server.ai-creators-studio.svc.cluster.local:2222/git-server/repos/project-${projectId}.git`,
      mountPath
    ],
    'volumeMounts': [
      {
        'name': contextName,
        'mountPath': mountPath
      },
      {
        'name': 'ssh-key',
        'mountPath': '/home/coder/.ssh'
      }
    ],
    'env': [
      {
        'name': 'GIT_SSH_COMMAND',
        'value': 'ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no'
      }
    ]
  };
};

