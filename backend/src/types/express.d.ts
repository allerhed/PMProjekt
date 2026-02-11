import { UserRole } from './index';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        userId: string;
        organizationId: string;
        role: UserRole;
        email: string;
      };
      pagination?: {
        page: number;
        limit: number;
        offset: number;
      };
    }
  }
}

export {};
