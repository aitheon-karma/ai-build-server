import { environment } from '../../environment';

export class WebSocketOptions {
  domain!: string;
  maxMessageSize: number;
  simulator!: {
    _id: string;
  };
  secure!: boolean;

  constructor() {
    this.maxMessageSize = 512000 * 1000;
    this.domain = process.env.DOMAIN || 'dev.aitheon.com';
    this.secure = true;
    this.simulator = {
      _id: `${ environment.service._id }`
    };
  }
}