import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = statusCode === 500 ? 'An unexpected error occurred' : err.message;

  logger.error({
    err,
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
  }, 'Request error');

  sendError(res, statusCode, code, message);
}
