export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'Knowlens',
  baseUrl:
    process.env.BASE_URL && process.env.BASE_URL.trim() !== ''
      ? process.env.BASE_URL.trim()
      : undefined, // 可选：完整的基础URL，如 http://localhost:3000（空字符串视为未配置）

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/knowlens',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // JWT
  jwt: {
    secret:
      process.env.JWT_SECRET || 'your-jwt-secret-key-at-least-32-characters',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 阿里云 OSS
  aliyun: {
    oss: {
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      region: process.env.ALIYUN_OSS_REGION || 'oss-cn-hangzhou',
      bucket: process.env.ALIYUN_OSS_BUCKET,
      endpoint:
        process.env.ALIYUN_OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com',
    },
    sms: {
      accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
      signName: process.env.ALIYUN_SMS_SIGN_NAME, // 可选，短信认证服务会使用默认签名
      templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE, // 可选，短信认证服务会使用默认模板
      region: process.env.ALIYUN_SMS_REGION || 'cn-hangzhou',
      endpoint: process.env.ALIYUN_SMS_ENDPOINT, // 可选，默认使用短信认证服务 endpoint
    },
  },

  // Moonshot AI
  moonshot: {
    apiKey: process.env.MOONSHOT_API_KEY,
    baseURL: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1',
    model: process.env.MOONSHOT_MODEL || 'moonshot-v1-k2',
    timeout: parseInt(process.env.MOONSHOT_TIMEOUT || '60000', 10),
    maxRetries: parseInt(process.env.MOONSHOT_MAX_RETRIES || '2', 10),
    retryDelay: parseInt(process.env.MOONSHOT_RETRY_DELAY || '1000', 10),
  },

  // 科大讯飞
  xfyun: {
    appId: process.env.XFYUN_APP_ID,
    secretKey: process.env.XFYUN_SECRET_KEY,
    apiKey: process.env.XFYUN_API_KEY,
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
});
