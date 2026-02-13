import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: Record<string, string> = {};
        err.issues.forEach((e) => {
          const path = e.path.map(String).join('.');
          details[path] = e.message;
        });
        sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request data', details);
        return;
      }
      next(err);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Express 5: req.query is a read-only getter, so validate without reassigning
      schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: Record<string, string> = {};
        err.issues.forEach((e) => {
          const path = e.path.map(String).join('.');
          details[path] = e.message;
        });
        sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', details);
        return;
      }
      next(err);
    }
  };
}
