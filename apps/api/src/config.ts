import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  jwt: {
    secret: process.env.JWT_SECRET || 'heimdell-dev-secret-change-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://heimdell:heimdell_dev_password@localhost:5432/heimdell_crm',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.livemail.co.uk',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false',
    defaultFrom: process.env.SMTP_DEFAULT_FROM || 'andrew@remoteability.org',
  },

  encryptionKey: process.env.APP_ENCRYPTION_KEY || '',

  features: {
    ai: !!process.env.OPENAI_API_KEY,
    database: process.env.ENABLE_DATABASE !== 'false',
    redis: process.env.ENABLE_REDIS !== 'false',
    email: !!process.env.SMTP_HOST,
  },

  devTestMode: process.env.DEV_TEST_MODE === 'true' || process.env.NODE_ENV === 'development',

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
};

export type Config = typeof config;
