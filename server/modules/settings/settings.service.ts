import { Service, Inject } from 'typedi';
import { SettingsSchema, Settings } from './settings.model';
import * as _ from 'lodash';
import { MailerService, SendMailOptions } from '../core/mailer.service';
import * as path from 'path';
import { User } from '@aitheon/core-server';
import { environment } from '../../environment';
import { logger } from '@aitheon/core-server';

@Service()
export class SettingsService {

  @Inject()
  mailerService: MailerService;

  async create(settings: Settings): Promise<Settings> {
    return new Promise<Settings>(async (resolve, reject) => {
     try {
      const settingsSchema = new SettingsSchema(settings);
      settings = await settingsSchema.save();
      resolve(settings);
     } catch (err) {
       reject(err);
     }
    });
  }

  async update(build: Settings): Promise<Settings> {
    return new Promise<Settings>(async (resolve, reject) => {
      try {
        build = await SettingsSchema.update({ _id: build._id }, build, { new: true });
        resolve(build);
      } catch (err) {
        reject(err);
      }
    });
  }

  async find(): Promise<Settings[]> {
    return SettingsSchema.find();
  }

  async findById(id: string): Promise<Settings> {
    return SettingsSchema.findById(id);
  }

  async findByType(buildType: string): Promise<Settings> {
    return SettingsSchema.findOne({ type: buildType });
  }



}
