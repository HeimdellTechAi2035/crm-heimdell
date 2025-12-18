import 'dotenv/config';

// Dev mode: auto-disable features without keys
const devTestMode = process.env.DEV_TEST_MODE === 'true';
const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
const hasTwilioKeys = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
const hasDatabase = !!process.env.DATABASE_URL && process.env.DATABASE_ENABLED !== 'false';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // Dev mode flags
  devTestMode,
  features: {
    redis: process.env.REDIS_ENABLED === 'true' || (!devTestMode && process.env.REDIS_ENABLED !== 'false'),
    ai: devTestMode ? hasOpenAiKey : (process.env.AI_ENABLED !== 'false'),
    twilio: devTestMode ? hasTwilioKeys : (process.env.TWILIO_ENABLED === 'true'),
    drive: process.env.DRIVE_ENABLED === 'true',
    dropbox: process.env.DROPBOX_ENABLED === 'true',
    database: devTestMode ? hasDatabase : true,
  },
  
  database: {
    url: process.env.DATABASE_URL!,
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  },
  
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'Heimdell CRM <noreply@heimdell.com>',
  },
  
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },
  
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: process.env.RATE_LIMIT_TIMEWINDOW || '15m',
  },
  
  ai: {
    defaultMonthlyLimit: parseInt(process.env.DEFAULT_AI_MONTHLY_LIMIT || '10000', 10),
  },
};

