import { resolve } from 'path';
import { existsSync } from 'fs';

const envPath = resolve('.env');
if (existsSync(envPath)) {
  const env = require('dotenv').config({ path: resolve('.env') });
  if (env.error) {
    console.error(env.error);
  }
}


import * as _ from 'lodash';
import * as base from './base';
import * as production from './production';

let environment = base.environment;
if (process.env.NODE_ENV === 'production') {
  environment = _.assign(base.environment, production.environment);
} else {
  environment = base.environment;
}
export { environment };
