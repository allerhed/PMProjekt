import jwt from 'jsonwebtoken';
import { Response } from 'express';
import config from '../config';
import { UserRole } from '../types';

export interface JwtPayload {
  userId: string;
  organizationId: string;
  role: UserRole;
  email: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiry as string | number,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload & { iat: number; exp: number } {
  return jwt.verify(token, config.jwt.secret) as JwtPayload & { iat: number; exp: number };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Check if token has passed 50% of its lifetime (3.5 days)
 */
export function shouldRefreshToken(iat: number, exp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const lifetime = exp - iat;
  const elapsed = now - iat;
  return elapsed > lifetime * 0.5;
}
