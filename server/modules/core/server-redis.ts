import * as Redis from 'ioredis';
import { environment } from '../../environment';

class ServerRedis {

  subClient: Redis.Redis;
  pubClient: Redis.Redis;

  constructor() {
    this.subClient = new Redis(environment.redis.port as number, environment.redis.host);
    this.pubClient = new Redis(environment.redis.port as number, environment.redis.host);
  }
}

export default new ServerRedis();
