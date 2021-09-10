export const environment = {
  /**
   * Identify itself. Current MicroService Name and ID in Database
   */
  service: {
    _id: 'BUILD_SERVER',
    name: 'Build server',
    url: '/build-server',
    description: 'build server',
    serviceType: 'any',
    envStatus: 'ALPHA',
    iconClass: 'fa fa-file'
  },
  /**
   * App running port
   */
  port: process.env.PORT || 3000,
  /**
   * App environment
   */
  production: false,
  /**
   * Logger
   */
  log: {
    format: process.env.LOG_FORMAT || 'combined',
    fileLogger: {
      level: 'debug',
      directoryPath: process.env.LOG_DIR_PATH || (process.cwd() + '/logs/'),
      fileName: process.env.LOG_FILE || 'app.log',
      maxsize: 10485760,
      maxFiles: 2,
      json: false
    }
  },
  /**
   * Database connection information
   */
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost/isabel'
  },
  authURI: `https://dev.aitheon.com/auth`,
  mintTransferEmailFactor: 'aic@aitheon.com',

  mailer: {
    host: 'localhost',
    port: '2525',
    from: '"DEV Isabel - FedoraLabs" <no-reply@testingdomain.io>',
    auth: {
      user: process.env.MAILER_EMAIL_ID || 'testuser',
      pass: process.env.MAILER_PASSWORD || '9j8js7pi37a4'
    },
    tls: {
      rejectUnauthorized: false
    }
  },
  k8s: {
    host: process.env.KUBERNETES_SERVICE_HOST,
    port: process.env.KUBERNETES_SERVICE_PORT_HTTPS,
    username: process.env.KUBERNETES_SERVICE_USERNAME,
    password: process.env.KUBERNETES_SERVICE_PASSWORD
  },
  npm: {
    token: process.env.NPM_TOKEN,
    projects_token: process.env.NPM_PROJECTS_TOKEN
  },
  gitServer: {
    url: process.env.GIT_SERVER_URL || '127.0.0.1',
    port: 2222,
    username: 'Aitheon Build Server',
    email: 'contact@aitheon.com'
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
  },
  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'NBVKwe83cQPV2DdnraMWU0Vipoyws6iI',
    branch: process.env.WEBHOOK_BRANCH || 'master',
    libBranches:  process.env.LIB_BRANCHES || '',
    libsToBuild: process.env.LIBS_TO_BUILD || ''
  },
  maxConcurrentBuilds: process.env.MAX_CONCURRENT_BUILDS || 1,
  maxTries: process.env.MAX_TRIES || 1,
  awsRegion: 'eu-west-1',
  s3BucketName: 'isabel-data',
  rootBuildsName: 'BUILDS',
  rootReleasesName: 'RELEASES',
  ecrAccount: '890606282206.dkr.ecr.eu-west-1.amazonaws.com',
  appsNamespace: 'ai-creators-studio-apps',
  rabbitmq: {
    uri: process.env.RABBITMQ_URI || `amqp://ai-rabbit:Ne&ZTeFeYCqqQRK3s7qF@localhost:5672`,
    logLevel: 'info'
  },
  elasticSearchHost: process.env.ELASTIC_SEARCH_HOST || 'https://search-dev-logs-muxlme4qpnjihg37awfgndg44m.eu-west-1.es.amazonaws.com/',
  buildResources: {
    limits: {
      cpu: process.env.BUILD_LIMIT_CPU || '1.9',
      memory: process.env.BUILD_LIMIT_MEMORY || '7680Mi'
    },
    requests: {
      cpu: process.env.BUILD_REQUEST_CPU || '1.9',
      memory: process.env.BUILD_REQUEST_MEMORY || '7680Mi'
    }
  },
  userLibPrefix: '@aitheon-projects/'
};
