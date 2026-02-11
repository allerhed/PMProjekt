import request from 'supertest';

// Mock express-rate-limit to bypass rate limiting in tests
jest.mock('express-rate-limit', () => {
  return () => (_req: unknown, _res: unknown, next: () => void) => next();
});

// Mock the database module
jest.mock('../../config/database', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  return { __esModule: true, default: mockPool };
});

// Mock user model
jest.mock('../../models/user.model');
jest.mock('../../models/organization.model');
jest.mock('../../models/passwordResetToken.model');

import app from '../../app';

import pool from '../../config/database';
import * as userModel from '../../models/user.model';
import * as orgModel from '../../models/organization.model';
import { hashPassword } from '../../utils/password';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new organization and user', async () => {
      (orgModel.findOrganizationBySubdomain as jest.Mock).mockResolvedValue(null);
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'org-1', name: 'Test Co', subdomain: 'test' }] }) // INSERT org
          .mockResolvedValueOnce({ rows: [{
            id: 'user-1', organization_id: 'org-1', email: 'john@test.com',
            first_name: 'John', last_name: 'Doe', role: 'org_admin',
            is_active: true, password_hash: 'hashed', failed_login_attempts: 0,
            locked_until: null, last_login_at: null,
            created_at: new Date(), updated_at: new Date(),
          }] }) // INSERT user
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          organizationName: 'Test Co',
          subdomain: 'test',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.organization).toBeDefined();
      // Check HttpOnly cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith('token='))
        : cookies;
      expect(tokenCookie).toContain('HttpOnly');
    });

    it('should reject registration with missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'john@test.com' }); // missing required fields

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          organizationName: 'Test Co',
          subdomain: 'test',
          firstName: 'John',
          lastName: 'Doe',
          email: 'not-an-email',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject registration with duplicate subdomain', async () => {
      (orgModel.findOrganizationBySubdomain as jest.Mock).mockResolvedValue({ id: 'existing' });
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          organizationName: 'Test Co',
          subdomain: 'taken',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should reject weak passwords', async () => {
      (orgModel.findOrganizationBySubdomain as jest.Mock).mockResolvedValue(null);
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          organizationName: 'Test Co',
          subdomain: 'test',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          password: 'weak',
        });

      // Zod validation catches min 8 chars first
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const hash = await hashPassword('Password123!');
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1', organization_id: 'org-1', email: 'john@test.com',
        password_hash: hash, first_name: 'John', last_name: 'Doe',
        role: 'org_admin', is_active: true, failed_login_attempts: 0,
        locked_until: null, last_login_at: null,
        created_at: new Date(), updated_at: new Date(),
      });
      (userModel.resetFailedLogins as jest.Mock).mockResolvedValue(undefined);
      (userModel.updateLastLogin as jest.Mock).mockResolvedValue(undefined);
      (userModel.isAccountLocked as jest.Mock).mockResolvedValue(false);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'john@test.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('should reject invalid credentials', async () => {
      const hash = await hashPassword('Password123!');
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1', organization_id: 'org-1', email: 'john@test.com',
        password_hash: hash, first_name: 'John', last_name: 'Doe',
        role: 'org_admin', is_active: true, failed_login_attempts: 0,
        locked_until: null,
      });
      (userModel.isAccountLocked as jest.Mock).mockResolvedValue(false);
      (userModel.incrementFailedLogins as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'john@test.com', password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for inactive accounts', async () => {
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1', is_active: false, email: 'john@test.com',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'john@test.com', password: 'Password123!' });

      expect(res.status).toBe(401);
    });

    it('should reject login for locked accounts', async () => {
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1', is_active: true, email: 'john@test.com',
        password_hash: 'hash', locked_until: new Date(Date.now() + 60000),
        failed_login_attempts: 5,
      });
      (userModel.isAccountLocked as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'john@test.com', password: 'Password123!' });

      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('should return 401 for non-existent email', async () => {
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'noone@test.com', password: 'Password123!' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear the auth cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Cookie should be cleared
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should return 200 even for non-existent email', async () => {
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'unknown@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 without auth cookie', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });
  });

  describe('Validation', () => {
    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'john@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
