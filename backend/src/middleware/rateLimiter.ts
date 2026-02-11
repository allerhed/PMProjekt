import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response';
import { Request, Response } from 'express';

export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(res, 429, 'RATE_LIMITED', 'Too many upload requests. Please try again later.');
  },
});

export const protocolLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendError(res, 429, 'RATE_LIMITED', 'Too many protocol generation requests. Please try again later.');
  },
});
