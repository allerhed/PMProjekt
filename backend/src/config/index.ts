import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  db: {
    url: process.env.DATABASE_URL || 'postgresql://construction_admin:devpass@localhost:5432/construction_manager',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    expiry: process.env.JWT_EXPIRY || '7d',
  },

  storage: {
    provider: (process.env.STORAGE_PROVIDER || 'local') as 'local' | 'azure',
    localPath: process.env.STORAGE_LOCAL_PATH || path.resolve(__dirname, '../../uploads'),
    publicUrl: process.env.STORAGE_PUBLIC_URL || `http://localhost:${process.env.PORT || '3000'}`,
  },

  azure: {
    storage: {
      accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
      accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
      container: process.env.AZURE_STORAGE_CONTAINER || 'files',
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    },
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  email: {
    sender: process.env.EMAIL_SENDER || 'dev@constructionapp.com',
    webhookSecret: process.env.EMAIL_WEBHOOK_SECRET || 'dev-webhook-secret',
    smtpHost: process.env.SMTP_HOST || 'localhost',
    smtpPort: parseInt(process.env.SMTP_PORT || '1025', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};

// Validate critical config in production
if (config.env === 'production') {
  const required = ['JWT_SECRET', 'DATABASE_URL'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  if (config.jwt.secret === 'dev-secret-key-change-in-production') {
    throw new Error('JWT_SECRET must be changed from default in production');
  }
}

export default config;
