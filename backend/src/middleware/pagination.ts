import { Request, Response, NextFunction } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(req: Request, _res: Response, next: NextFunction): void {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = (page - 1) * limit;

  req.pagination = { page, limit, offset };
  next();
}
