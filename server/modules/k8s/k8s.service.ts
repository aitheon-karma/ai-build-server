import { Service, Inject } from 'typedi';
import { BuildSchema, Build, BuildType, BuildStatus } from '../builds/build.model';
import * as _ from 'lodash';
import { environment } from '../../environment';
import { logger } from '@aitheon/core-server';
import * as JSONStream from 'json-stream';
import * as path from 'path';
import * as Api from 'kubernetes-client';

@Service()
export class K8sService {

  // @Inject()
  // settingsService: SettingsService;

  client: Api.ApiRoot;
  // buildsNamespace = 'ai-build-server';
  // simulatorsNamespace = 'ai-creators-studio';

  constructor() {
    // console.log('[k8s]:', environment.k8s);
    this.client = new Api.Client1_10({
      config: {
        url: `https://${ environment.k8s.host }:${ environment.k8s.port }`,
        auth: {
          user: environment.k8s.username,
          pass: environment.k8s.password
        },
        insecureSkipTlsVerify: true
      },
      version: '1.10'
    });
  }

  async createJob(name: string, job: any, namespace: string) {
    try {
      await this.client.apis.batch.v1.namespaces(namespace).jobs.post({ body: job });
      const stream = this.client.apis.batch.v1.watch.namespaces(namespace).jobs(name).getStream();
      const jsonStream = new JSONStream();
      stream.pipe(jsonStream);
      return jsonStream;
    } catch (err) {
      logger.error('[K8sService][createJob]', err);
      throw err;
    }
  }

  async watchDeploymentStatus(name: string, namespace: string) {
    try {
      const stream = this.client.apis.extensions.v1beta1.namespaces(namespace).deployments(name).status.getStream();
      const jsonStream = new JSONStream();
      stream.pipe(jsonStream);
      return jsonStream;
    } catch (err) {
      logger.error('[K8sService][createJob]', err);
      throw err;
    }
  }

  async cleanupJob(name: string, namespace: string) {
    try {
      await this.client.apis.batch.v1.namespaces(namespace).jobs(name).delete({ body: { kind: 'DeleteOptions', apiVersion: 'batch/v1', propagationPolicy: 'Foreground' } });
    } catch (err) {
      logger.error('[K8sService][cleanupJob]', err);
      if (err.statusCode !== 404) {
        throw err;
      }
    }
  }

  async deletePod(namespace: string, label: string) {
    try {
      const result = await this.client.api.v1.namespaces(namespace).pods.delete({ qs: { labelSelector: label } });
      logger.info('[K8sService][deletePod] result', JSON.stringify(result));
    } catch (err) {
      logger.error('[K8sService][deletePod]', err);
      if (err.statusCode !== 404) {
        throw err;
      }
    }
  }

  async proxyPod(namespace: string, name: string) {
    try {
      const result = await this.client.api.v1.namespaces(namespace).pods(name).proxy('').get();
      logger.info('[K8sService][proxyPod] result', JSON.stringify(result));
    } catch (err) {
      logger.error('[K8sService][proxyPod]', err);
      if (err.statusCode !== 404) {
        throw err;
      }
    }
  }

  async watchLogsByLabel(label: string, namespace: string): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      try {
        let pods = await this.client.api.v1.namespaces(namespace).pods.get({ qs: { labelSelector: label } });
        logger.debug('[watchLogsByJob] pods:', pods.body.items.length);
        if (pods.body.items.length === 0) {
          return;
        }
        pods = pods.body.items.filter((p: any) => { return !p.metadata.labels['deleting']; });
        if (pods.length === 0) {
          return;
        }
        const pod = pods[0];
        const podName = pod.metadata.name;
        const podStatus = await this.waitLoggablePod(podName, namespace);
        if (!podStatus) {
          return;
        }
        const stream = this.client.api.v1.namespaces(namespace).pods(podName).log.getStream({ qs: { follow: true } });
        return resolve(stream);

      } catch (err) {
        logger.error('[K8sService][watchLogs]', err);
        reject(err);
      }
    });
  }

  async getLogsByLabel(label: string, namespace: string): Promise<any> {
    try {
      let pods = await this.client.api.v1.namespaces(namespace).pods.get({ qs: { labelSelector: label } });
      logger.debug('[watchLogsByJob] pods:', pods.body.items.length);
      if (pods.body.items.length === 0) {
        return;
      }
      pods = pods.body.items.filter((p: any) => { return !p.metadata.labels['deleting']; });
      if (pods.length === 0) {
        return;
      }
      const pod = pods[0];
      const podName = pod.metadata.name;
      const podStatus = await this.waitLoggablePod(podName, namespace);
      if (!podStatus) {
        return;
      }
      const logs = this.client.api.v1.namespaces(namespace).pods(podName).log.get();
      return logs;

    } catch (err) {
      logger.error('[K8sService][getLogsByLabel]', err);
      throw err;
    }
  }

  async waitLoggablePod(podName: string, namespace?: string) {
    try {
      const success = ['Running', 'Completed', 'Succeeded'];
      const error = ['CrashLoopBackOff', 'Failed'];

      const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const checkStatus = async (): Promise<any> => {
        const result = await this.client.api.v1.namespaces(namespace).pods(podName).status.get();
        const status = result.body.status.phase;
        // logger.info(`Pod [${podName}] status: `, status);
        if (success.indexOf(status) > -1) {
          return true;
        } else if (error.indexOf(status) > -1) {
          return false;
        }

        await timeout(3000);
        return await checkStatus();
      };
      return checkStatus();

    } catch (err) {
      logger.error('[K8sService][waitLoggablePod]', err);
      throw err;
    }
  }

  //   Pending	The Pod has been accepted by the Kubernetes system, but one or more of the Container images has not been created. This includes time before being scheduled as well as time spent downloading images over the network, which could take a while.
  // Running	The Pod has been bound to a node, and all of the Containers have been created. At least one Container is still running, or is in the process of starting or restarting.
  // Succeeded	All Containers in the Pod have terminated in success, and will not be restarted.
  // Failed	All Containers in the Pod have terminated, and at least one Container has terminated in failure. That is, the Container either exited with non-zero status or was terminated by the system.
  // Unknown	For some reason the state of the Pod could not be obtained, typically due to an error in communicating with the host of the Pod.
  // Completed	The pod has run to completion as there’s nothing to keep it running eg. Completed Jobs.
  // CrashLoopBackOff	This means that one of the containers in the pod has exited unexpectedly, and perhaps with a non-zero error code even after restarting due to restart policy.


  async applyNamespace(data: any, namespace: string) {
    let result;
    try {
      result = await this.client.api.v1.namespaces.post({ body: data });
    } catch (err) {
      // 409
      if (err.statusCode != 409) {
        throw err;
      }
      result = await this.client.api.v1.namespaces(namespace).put({ body: data });
    }
    console.log('Apply shared-config');
    await this.copySecret({ name: 'shared-config', namespace: 'default'}, { name: 'shared-config', namespace: namespace });
    return result;
  }

  async copySecret(from: { name: string, namespace: string }, to: { name: string, namespace: string }) {
    const secret = await this.client.api.v1.namespaces(from.namespace).secrets(from.name).get();
    secret.body.metadata = {
      name: to.name,
      namespace: to.namespace
    };
    try {
      const result = await this.client.api.v1.namespaces(to.namespace).secrets.post({ body: secret.body });
    } catch (err) {
      // 409
      if (err.statusCode != 409) {
        throw err;
      }
      await this.client.api.v1.namespaces(to.namespace).secrets(to.name).put({ body: secret.body });
    }
    console.log(`Added shared-config secret: ${ to.namespace }`);
    logger.debug(`[K8S] Added shared-config secret: ${ to.namespace }.`);
  }

  async applySecret(data: any, namespace: string) {
    try {
      const result = await this.client.api.v1.namespaces(namespace).secrets(data.metadata.name).patch({ body: data });
    } catch (err) {
      // 404
      if (err.statusCode != 404) {
        throw err;
      }
      await this.client.api.v1.namespaces(namespace).secrets.post({ body: data });
    }
  }

  async getSecret(namespace: string, name: string) {
    const secret = await this.client.api.v1.namespaces(namespace).secrets(name).get();
    return secret.body;
  }

  async getDeployment(name: string, namespace: string) {
    let result;
    try {
      result = await this.client.apis.extensions.v1beta1.namespaces(namespace).deployments(name).get();
    } catch (err) {
      if (err.statusCode != 404) {
        throw err;
      }
    }
    return result;
  }

  async getDeployments(label: string, namespace: string) {
    let result;
    try {
      result = await this.client.apis.extensions.v1beta1.namespaces(namespace).deployments.get({ qs: { labelSelector: label }});
    } catch (err) {
      if (err.statusCode != 404) {
        throw err;
      }
    }
    return result;
  }

  async applyConfig(data: any, namespace: string) {
    let result;
    try {
      result = await this.client.api.v1.namespaces(namespace).configmaps.post({ body: data });
    } catch (err) {
      if (err.statusCode != 409) {
        throw err;
      }
    }
    if (!result) {
      result = await this.client.api.v1.namespaces(namespace).configmaps(data.metadata.name).put({ body: data });
    }
    return result;
  }

  async podStatusByLabel(label: string, namespace: string) {
    let result;
    try {
      result = await this.client.api.v1.namespaces(namespace).pods.get({ qs: { labelSelector: label } });
    } catch (err) {
      if (err.statusCode != 404) {
        throw err;
      }
    }

    if (!result || result.body.items.length === 0) {
      return;
    }

    const pod = result.body.items[0];
    if (pod.metadata.labels['deleting'] === 'true') {
      return;
    }
    return pod.status.phase.toUpperCase();
  }

  async applyDeployment(data: any, namespace: string) {
    let result;
    try {
      result = await this.client.apis.extensions.v1beta1.namespaces(namespace).deployment.post({ body: data });
    } catch (err) {
      if (err.statusCode != 409) {
        throw err;
      }
    }
    if (!result) {
      result = await this.client.apis.extensions.v1beta1.namespaces(namespace).deployments(data.metadata.name).put({ body: data });
    }
    return result;
  }

  async patchDeployment(data: any, namespace: string) {
    return await this.client.apis.extensions.v1beta1.namespaces(namespace).deployments(data.metadata.name).patch({ body: data });
  }

  async putDeployment(data: any, namespace: string) {
    return await this.client.apis.extensions.v1beta1.namespaces(namespace).deployments(data.metadata.name).put({ body: data });
  }

  async getNodes(label: string) {
    const result =  this.client.api.v1.nodes.get({ qs: { labelSelector: label }});
    return result;
  }

  async watchNodes(label: string) {
    const stream =  this.client.api.v1.nodes.getStream({ watch: true, qs: { labelSelector: label }});
    const jsonStream = new JSONStream();
    stream.pipe(jsonStream);
    return jsonStream;
  }

  async deleteDeployment(name: any, namespace: string) {
    let result;
    try {
      result = await this.client.apis.extensions.v1beta1.namespaces(namespace).deployments(name).delete({ body: { kind: 'DeleteOptions', apiVersion: 'extensions/v1beta1', propagationPolicy: 'Foreground', gracePeriodSeconds: 0 } });
    } catch (err) {
      if (err.statusCode != 404) {
        throw err;
      }
    }
    return result;
  }

  async applyService(data: any, namespace: string) {
    let result;
    try {
      result = await this.client.api.v1.namespaces(namespace).services.post({ body: data });
    } catch (err) {
      if (err.statusCode != 409) {
        throw err;
      }
    }
    if (!result) {
      result = await this.client.api.v1.namespaces(namespace).services(data.metadata.name).patch({ body: data });
    }
    return result;
  }

  async applyLimitRange(data: any, namespace: string) {
    let result;
    try {
      result = await this.client.api.v1.namespaces(namespace).limitranges.post({ body: data });
    } catch (err) {
      if (err.statusCode != 409) {
        throw err;
      }
    }
    if (!result) {
      result = await this.client.api.v1.namespaces(namespace).limitranges(data.metadata.name).patch({ body: data });
    }
    return result;
  }

  async deleteService(name: any, namespace: string) {
    let result;
    try {
      result = await this.client.api.v1.namespaces(namespace).services(name).delete();
    } catch (err) {
      if (err.statusCode != 404) {
        throw err;
      }
    }
    return result;
  }

  async deleteSecret(name: any, namespace: string) {
    let result;
    try {
      result = await this.client.api.v1.namespaces(namespace).secrets(name).delete();
    } catch (err) {
      if (err.statusCode != 404) {
        throw err;
      }
    }
    return result;
  }

  async deleteConfig(name: any, namespace: string) {
    let result;
    try {
      result = await this.client.api.v1.namespaces(namespace).configmaps(name).delete();
    } catch (err) {
      if (err.statusCode != 404) {
        throw err;
      }
    }
    return result;
  }

  async applyIngress(data: any, namespace: string) {
    let result;
    try {
      result = await this.client.apis.extensions.v1beta1.namespaces(namespace).ingresses.post({ body: data });
    } catch (err) {
      if (err.statusCode != 409) {
        throw err;
      }
    }
    if (!result) {
      result = await this.client.apis.extensions.v1beta1.namespaces(namespace).ingresses(data.metadata.name).patch({ body: data });
    }
    return result;
  }

  async deleteIngress(name: any, namespace: string) {
    let result;
    try {
      result = await this.client.apis.extensions.v1beta1.namespaces(namespace).ingresses(name).delete();
    } catch (err) {
      if (err.statusCode != 404) {
        throw err;
      }
    }
    return result;
  }

  async applyPvc(data: any, namespace: string) {
    let result;
    try {
      result = await this.client.api.v1.namespaces(namespace).persistentvolumeclaims.post({ body: data });
    } catch (err) {
      if (err.statusCode != 409) {
        throw err;
      }
    }
    // if (!result) {
    //   result = await this.client.api.v1.namespaces(namespace).persistentvolumeclaims(data.metadata.name).patch({ body: data });
    // }
    return result;
  }


  async deletePvc(name: any, namespace: string) {
    try {
      await this.client.api.v1.namespaces(namespace).persistentvolumeclaims(name).delete();
    } catch (err) {
      if (err.statusCode != 404) {
        throw err;
      }
    }
  }

  async markPodDeleted(label: string, namespace: string) {
    try {
      const podResult = await this.client.api.v1.namespaces(namespace).pods.get({ qs: { labelSelector: label } });
      if (podResult.body.items.length > 0) {
        const pod = podResult.body.items[0];
        pod.metadata.labels['deleting'] = 'true';
        delete pod.status;
        await this.client.api.v1.namespaces(namespace).pods(pod.metadata.name).patch({ body: pod });
      }
    } catch (err) {
      throw err;
    }
  }

  async deletePodByLabel(label: string, namespace: string) {
    try {
      const result = await this.client.api.v1.namespaces(namespace).pods.delete({ qs: { labelSelector: label } });
      console.log('result: ', result);
    } catch (err) {
      if (err.statusCode != 404) {
        throw err;
      }
    }
  }



}