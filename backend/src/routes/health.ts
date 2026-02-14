import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, { status: 'ok' });
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW()');
    sendSuccess(res, {
      status: 'ready',
      database: {
        connected: true,
        timestamp: result.rows[0].now,
      },
    });
  } catch (_err) {
    sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Database connection failed');
  }
});

export default router;
