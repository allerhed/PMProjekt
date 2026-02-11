import { Request, Response, NextFunction } from 'express';

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const nested = value as Record<string, unknown>;
    sanitizeObjectInPlace(nested);
    return nested;
  }
  return value;
}

function sanitizeObjectInPlace(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    obj[key] = sanitizeValue(obj[key]);
  }
}

export function inputSanitizer(req: Request, _res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    next();
    return;
  }

  // Sanitize body (reassignable in Express v5)
  if (req.body && typeof req.body === 'object') {
    sanitizeObjectInPlace(req.body as Record<string, unknown>);
  }

  // req.query and req.params are read-only getters in Express v5,
  // so we sanitize their values in-place rather than reassigning
  if (req.query && typeof req.query === 'object') {
    sanitizeObjectInPlace(req.query as Record<string, unknown>);
  }

  next();
}
