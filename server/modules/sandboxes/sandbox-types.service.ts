import Container, { Service, Inject } from 'typedi';
import { MailerService, SendMailOptions } from '../core/mailer.service';
import * as path from 'path';
import { Transporter, TransporterService, Action, Event, param } from '@aitheon/transporter';
import { logger, User, Organization } from '@aitheon/core-server';
import { SandboxType, SandboxTypeSchema } from './sandbox-type.model';
import { environment } from '../../environment';


@Service()
@Transporter()
export class SandboxTypesService extends TransporterService {

  types = [{
    displayText: 'Basic',
    description: '2 CPU \n 8 GB Memory \n 20 Gb Persistent Storage',
    // tslint:disable-next-line:max-line-length
    image: 'https://isabel-data.s3.eu-west-1.amazonaws.com/DRIVE/DOCUMENTS/5d6ccada5ee1730019423dca.svg?AWSAccessKeyId=AKIAJ4SOUDVXZNLMVWWA&Expires=1882980426&Signature=urTjnIN1pJk2k3dzwV4p0%2FAG9mI%3D',
    resource: {
      cpu: 1.8,
      memory: '7480Mi',
      storage: '16Gi',
    },
    nodeSelector: 'sandboxes-basic',
    hotLoadedCount: 0
  },
  {
    displayText: 'Developer',
    description: '4 CPU \n 16 GB Memory \n 20 Gb Persistent Storage',
    // tslint:disable-next-line:max-line-length
    image: 'https://isabel-data.s3.eu-west-1.amazonaws.com/DRIVE/DOCUMENTS/5d70c8065ee1730019423e2c.svg?AWSAccessKeyId=AKIAJ4SOUDVXZNLMVWWA&Expires=1883241846&Signature=sOzMPg3Il66WFbS5%2Fp9k1shd1xI%3D',
    resource: {
      cpu: 3.8,
      memory: '15380Mi',
      storage: '32Gi',
    },
    nodeSelector: 'sandboxes-developer',
    hotLoadedCount: 0
  },
  {
    displayText: 'Scientist',
    description: '4 CPU \n 16 GB Memory + GPU \n 20 Gb Persistent Storage',
    // tslint:disable-next-line:max-line-length
    image: 'https://isabel-data.s3.eu-west-1.amazonaws.com/DRIVE/DOCUMENTS/5d70d3d35ee1730019423e34.svg?AWSAccessKeyId=AKIAJ4SOUDVXZNLMVWWA&Expires=1883244867&Signature=latr%2FY0sLtTKeCN0tursGvrA07Y%3D',
    resource: {
      cpu: 3.8,
      memory: '15380Mi',
      storage: '32Gi',
    },
    nodeSelector: 'sandboxes-scientist',
    hotLoadedCount: 0,
    disabled: true,
  }] as SandboxType[];


  constructor() {
    super(Container.get('TransporterBroker'));
    this.seed();
  }

  @Action()
  async list(): Promise<SandboxType[]> {
   return SandboxTypeSchema.find();
  }

  @Action()
  async getById(id: string): Promise<SandboxType> {
   return SandboxTypeSchema.findById(id);
  }

  findOne() {
    return SandboxTypeSchema.findOne();
  }

  async seed() {
    const count = await SandboxTypeSchema.count({});
    if (count === 0) {
      await SandboxTypeSchema.insertMany(this.types);
    }
  }

}
