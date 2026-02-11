import { Pool } from 'pg';
import config from './index';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: config.db.url,
  min: config.db.poolMin,
  max: config.db.poolMax,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

export default pool;
