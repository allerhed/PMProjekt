import app from './app';
import config from './config';
import { logger } from './utils/logger';
import { initBackupScheduler } from './services/backup.service';
import pool from './config/database';

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'Server started');
  initBackupScheduler();
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received');
  server.close(async () => {
    logger.info('Server closed');
    await pool.end();
    logger.info('Database pool closed');
    process.exit(0);
  });
  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
