import { Service, Inject } from 'typedi';
import { ServiceSchema, Service as ServiceDTO } from './service.model';
import * as _ from 'lodash';

@Service()
export class ServicesService {

  async findById(id: string): Promise<ServiceDTO> {
    return ServiceSchema.findById(id);
  }

  async findByGitUrl(gitUrl: string): Promise<ServiceDTO> {
    return ServiceSchema.findOne({ gitUrl });
  }

}
