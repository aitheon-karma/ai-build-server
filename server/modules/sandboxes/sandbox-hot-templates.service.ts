import { Service, Inject, Container } from 'typedi';
import * as _ from 'lodash';
import { SandboxHotTemplateSchema, SandboxHotTemplate, ISandboxHotTemplate  } from './sandbox-hot-template.model';
import { SandboxType } from './sandbox-type.model';
import { getDeploymentSpec, defaultNamespace, getConfigSpec, getServiceSpec, getSecretSpec, getPVC, defaultName } from './sandbox.defaults';
import { K8sService } from '../k8s/k8s.service';
import { SandboxSettings } from './settings/sandbox-settings.model';
import { environment } from '../../environment';

@Service()
export class SandboxHotTemplatesService {

  k8sService: K8sService;

  constructor() {
    this.k8sService = Container.get(K8sService);
  }

  async findOneByType(sandboxType: string) {
    return SandboxHotTemplateSchema.findOne({ type: sandboxType, status: 'RUNNING', allocated: false }).sort('-createdAt');
  }

  async findByType(sandboxType: string) {
    return SandboxHotTemplateSchema.find({ type: sandboxType }).sort('-createdAt');
  }

  async allocate(templateId: string) {
    return SandboxHotTemplateSchema.updateOne({ _id: templateId }, { $set: { allocated: true }});
  }

  async remove(templateId: string) {
    return SandboxHotTemplateSchema.findOneAndRemove({ _id: templateId }).populate('type');
  }

  async setStatus(sandboxId: string, status: string) {
    return SandboxHotTemplateSchema.updateOne({ _id: sandboxId }, { $set: { status }});
  }

  async prepareHotTemplate(sandboxType: SandboxType, settings: SandboxSettings) {
    const sandboxHotTemplate = new SandboxHotTemplateSchema({
      type: sandboxType,
      status: 'PENDING',
      allocated: false
    });
    const deployment = getDeploymentSpec(sandboxHotTemplate, false, sandboxType, settings);
    const config = getConfigSpec(sandboxHotTemplate, false);
    const service = getServiceSpec(sandboxHotTemplate);
    // const pvc = getPVC(sandboxHotTemplate, sandboxType.resource.storage);

    await sandboxHotTemplate.save();

    // await this.k8sService.applyPvc(pvc, defaultNamespace);
    await this.k8sService.applyConfig(config, defaultNamespace);
    await this.k8sService.applyDeployment(deployment, defaultNamespace);
    await this.k8sService.applyService(service, defaultNamespace);
    // await this.k8sService.applyIngress(ingress, defaultNamespace);

    return sandboxHotTemplate;
  }

  async updateHotTemplates(sandboxSettings: SandboxSettings) {
    const templates =  await SandboxHotTemplateSchema.find({ status: 'RUNNING' });
    await Promise.all(templates.map(async (template: ISandboxHotTemplate) => {

      const deploymentResult = await this.k8sService.getDeployment(defaultName(template), defaultNamespace);
      const deployment = deploymentResult.body;

      const sandbox = deployment.spec.template.spec.containers.find((c: any) => c.name === `sandbox-${template._id}`);
      const sandboxRunner = deployment.spec.template.spec.containers.find((c: any) => c.name === `sandbox-${template._id}-runner`);

      if (template.sandboxVersion === sandboxSettings.sandboxVersion && template.sandboxRunnerVersion === sandboxSettings.sandboxRunnerVersion) {
        return console.log(`[SandboxHotTemplate] Images update not required ${ template._id}`);
      }
      template.status = 'PENDING';
      template.sandboxVersion = sandboxSettings.sandboxVersion;
      template.sandboxRunnerVersion = sandboxSettings.sandboxRunnerVersion;
      await template.save();

      const sandboxImage = `${ environment.ecrAccount }/sandbox:${ sandboxSettings.sandboxVersion }`;
      const sandboxRunnerImage = `${ environment.ecrAccount }/ai-creators-studio-runner:${ sandboxSettings.sandboxRunnerVersion }`;
      sandbox.image = sandboxImage;
      sandboxRunner.image = sandboxRunnerImage;
      await this.k8sService.putDeployment(deployment, defaultNamespace);

      console.log(`[SandboxHotTemplate] Images update ${ template._id}`);
    }));
  }


  async terminateAllTemplates() {
    SandboxHotTemplateSchema.find().cursor().eachAsync((async (template: ISandboxHotTemplate) => {
      try {
        await this.remove(template._id);
        console.log(`[SandboxHotTemplate] Sandbox[${ template._id}] Deleting deployments and configs`);
        const name = defaultName(template);
        await this.k8sService.deleteSecret(name, defaultNamespace);
        await this.k8sService.deleteConfig(name, defaultNamespace);
        await this.k8sService.deleteDeployment(name, defaultNamespace);
        await this.k8sService.deleteService(name, defaultNamespace);
        console.log(`[SandboxService] Sandbox[${template._id}] Terminated`);
      } catch (err) {
        console.error(`[SandboxService] Sandbox Error`, err);
      }
      console.log(`[SandboxHotTemplate] Terminated ${ template._id}`);
    }));
  }

}
