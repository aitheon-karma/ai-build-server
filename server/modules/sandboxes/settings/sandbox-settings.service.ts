import { Service, Inject, Container } from 'typedi';
import * as _ from 'lodash';
import { Transporter, TransporterService, Action, Event, param } from '@aitheon/transporter';
import { SandboxSettings, SandboxSettingsSchema } from './sandbox-settings.model';

@Service()
@Transporter()
export class SandboxSettingsService extends TransporterService {

  constructor() {
    super(Container.get('TransporterBroker'));
    this.seed();
  }

  async find(): Promise<SandboxSettings> {
    return SandboxSettingsSchema.findOne();
  }

  async save(settings: SandboxSettings): Promise<SandboxSettings> {
    return SandboxSettingsSchema.findOneAndUpdate({}, settings, { new: true, upsert: true });
  }

  async updateRunnerImage(sandboxRunnerVersion: string) {
    return SandboxSettingsSchema.findOneAndUpdate({}, { $set: { sandboxRunnerVersion }}, { new: true, upsert: true });
  }

  async updateSandboxImage(sandboxVersion: string) {
    return SandboxSettingsSchema.findOneAndUpdate({}, { $set: { sandboxVersion }}, { new: true, upsert: true });
  }

  async seed() {
    const count = await SandboxSettingsSchema.count({});
    if (count === 0) {
      await new SandboxSettingsSchema({
        sandboxVersion: '1.31.0',
        sandboxRunnerVersion: '1.71.0',
        defaultVolumeSize: 20
      }).save();
    }
  }

}