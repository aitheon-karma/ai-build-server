export const environment = {
  production: true,
  authURI: `http://ai-auth.ai-auth.svc.cluster.local:${ process.env.AI_AUTH_SERVICE_PORT || 3000 }`,

  mailer: {
    host: 'ai-mail.ai-mail.svc.cluster.local',
    port: '25',
    from: process.env.MAILER_FROM || '"Aitheon" <no-reply@aitheon.com>',
    auth: {
      user: process.env.MAILER_EMAIL_ID || 'testuser',
      pass: process.env.MAILER_PASSWORD || '9j8js7pi37a4'
    },
    tls: {
      rejectUnauthorized: false
    }
  },
  gitServer: {
    url: process.env.GIT_SERVER_URL || 'git-server.ai-creators-studio.svc.cluster.local',
    port: 2222,
    username: 'Aitheon Build Server',
    email: 'contact@aitheon.com'
  },
  redis: {
    host: process.env.REDIS_HOST || 'ai-redis.ai-redis.svc.cluster.local',
    port: process.env.REDIS_PORT || 6379
  },
  rabbitmq: {
    uri: process.env.RABBITMQ_URI || `amqp://ai-rabbit:Ne&ZTeFeYCqqQRK3s7qF@ai-rabbitmq.ai-rabbitmq.svc.cluster.local:5672`
  }
};