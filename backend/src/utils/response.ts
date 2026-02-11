import { Response } from 'express';
import { ApiResponse, ApiError, PaginationMeta } from '../types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  pagination?: PaginationMeta,
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.req.requestId,
      ...(pagination ? { pagination } : {}),
    },
  };
  res.status(statusCode).json(response);
}

export function sendPaginated<T>(
  res: Response,
  data: T,
  pagination: PaginationMeta,
): void {
  const response = {
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.req.requestId,
      pagination,
    },
  };
  res.status(200).json(response);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  const error: ApiError = { code, message };
  if (details) error.details = details;

  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.req?.requestId || 'unknown',
    },
  };
  res.status(statusCode).json(response);
}
