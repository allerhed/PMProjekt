import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = req.headers['x-request-id'] as string || randomUUID();
  next();
}
