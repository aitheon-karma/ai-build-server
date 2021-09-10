import { Service, Inject, Container } from 'typedi';
import * as _ from 'lodash';
import { Transporter, TransporterService, Action, Event, param } from '@aitheon/transporter';
import { SandboxVolume, SandboxVolumeSchema } from './sandbox-volume.model';
import { K8sService } from '../k8s/k8s.service';
import { defaultNamespace, getPVC } from './sandbox.defaults';
import { SandboxSettingsService } from './settings/sandbox-settings.service';

@Service()
export class SandboxVolumesService {

  @Inject(type => K8sService)
  k8sService: K8sService;

  @Inject(type => SandboxSettingsService)
  sandboxSettingsService: SandboxSettingsService;

  constructor() {
  }

  async findActiveByUser(user: string, organization?: string): Promise<SandboxVolume> {
    // tslint:disable-next-line:no-null-keyword
    const query = { user, terminatedAt: { $eq: null } } as any;
    if (organization) {
      query.organization = organization;
    }
    return SandboxVolumeSchema.findOne(query);
  }

  async create(user: string, organization: string, size: number): Promise<SandboxVolume> {
    const sandboxVolume = await new SandboxVolumeSchema({ user, organization, size }).save();
    const pvc = getPVC(sandboxVolume, size);
    await this.k8sService.applyPvc(pvc, defaultNamespace);
    return sandboxVolume;
  }

  async terminate(sandboxVolumeId: string) {
    return SandboxVolumeSchema.findOneAndUpdate({}, { $set: { terminatedAt: new Date() }}, { new: true });
  }


}