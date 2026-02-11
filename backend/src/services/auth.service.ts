import pool from '../config/database';
import { hashPassword, comparePassword, validatePasswordPolicy } from '../utils/password';
import { generateToken, JwtPayload } from '../utils/jwt';
import { generateResetToken, hashToken } from '../utils/crypto';
import { createOrganization, findOrganizationBySubdomain } from '../models/organization.model';
import {
  createUser,
  findUserByEmail,
  updateLastLogin,
  incrementFailedLogins,
  lockAccount,
  resetFailedLogins,
  isAccountLocked,
  updateUser,
  UserRow,
} from '../models/user.model';
import { createResetToken, findValidResetToken, markTokenUsed } from '../models/passwordResetToken.model';
import { UserRole } from '../types';
import { logger } from '../utils/logger';
import { RegisterInput, LoginInput } from '../validators/auth.validators';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthResult {
  user: Omit<UserRow, 'password_hash'>;
  token: string;
  organization?: { id: string; name: string; subdomain: string };
}

function sanitizeUser(user: UserRow): Omit<UserRow, 'password_hash'> {
  const { password_hash, ...safe } = user;
  return safe;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  // Validate password policy
  const policyError = validatePasswordPolicy(input.password, input.email);
  if (policyError) {
    throw Object.assign(new Error(policyError), { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  // Check subdomain uniqueness
  const existingOrg = await findOrganizationBySubdomain(input.subdomain);
  if (existingOrg) {
    throw Object.assign(new Error('Subdomain is already taken'), { statusCode: 409, code: 'CONFLICT' });
  }

  // Check email uniqueness
  const existingUser = await findUserByEmail(input.email);
  if (existingUser) {
    throw Object.assign(new Error('Email is already registered'), { statusCode: 409, code: 'CONFLICT' });
  }

  // Create org and user in a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orgResult = await client.query(
      'INSERT INTO organizations (name, subdomain) VALUES ($1, $2) RETURNING *',
      [input.organizationName, input.subdomain],
    );
    const org = orgResult.rows[0];

    const passwordHash = await hashPassword(input.password);
    const userResult = await client.query(
      `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [org.id, input.email, passwordHash, input.firstName, input.lastName, UserRole.ORG_ADMIN],
    );
    const user = userResult.rows[0];

    await client.query('COMMIT');

    const tokenPayload: JwtPayload = {
      userId: user.id,
      organizationId: org.id,
      role: user.role,
      email: user.email,
    };
    const token = generateToken(tokenPayload);

    logger.info({ userId: user.id, orgId: org.id }, 'New organization registered');

    return {
      user: sanitizeUser(user),
      token,
      organization: { id: org.id, name: org.name, subdomain: org.subdomain },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  if (!user.is_active) {
    throw Object.assign(new Error('Account is deactivated'), { statusCode: 401, code: 'ACCOUNT_INACTIVE' });
  }

  // Check account lockout
  if (await isAccountLocked(user)) {
    const lockRemaining = Math.ceil(
      (new Date(user.locked_until!).getTime() - Date.now()) / 60000,
    );
    throw Object.assign(
      new Error(`Account is locked. Try again in ${lockRemaining} minutes.`),
      { statusCode: 423, code: 'ACCOUNT_LOCKED' },
    );
  }

  // Verify password
  const isValid = await comparePassword(input.password, user.password_hash);
  if (!isValid) {
    const attempts = await incrementFailedLogins(user.id);
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await lockAccount(user.id, LOCKOUT_MINUTES);
      logger.warn({ userId: user.id, attempts }, 'Account locked after failed login attempts');
    }
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  // Successful login: reset failed attempts and update last login
  await resetFailedLogins(user.id);
  await updateLastLogin(user.id);

  const tokenPayload: JwtPayload = {
    userId: user.id,
    organizationId: user.organization_id,
    role: user.role as UserRole,
    email: user.email,
  };
  const token = generateToken(tokenPayload);

  logger.info({ userId: user.id }, 'User logged in');

  return { user: sanitizeUser(user), token };
}

export async function forgotPassword(email: string): Promise<void> {
  // Always succeed (prevent email enumeration)
  const user = await findUserByEmail(email);
  if (!user) {
    logger.debug({ email }, 'Password reset requested for non-existent email');
    return;
  }

  const { token, tokenHash } = generateResetToken();
  await createResetToken(user.id, tokenHash);

  // TODO: Send email with reset link (Phase 5)
  logger.info({ userId: user.id, token }, 'Password reset token generated (dev: token logged)');
}

export async function resetPassword(tokenRaw: string, newPassword: string): Promise<void> {
  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) {
    throw Object.assign(new Error(policyError), { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  const tokenHash = hashToken(tokenRaw);
  const resetToken = await findValidResetToken(tokenHash);
  if (!resetToken) {
    throw Object.assign(new Error('Invalid or expired reset token'), { statusCode: 400, code: 'INVALID_TOKEN' });
  }

  const passwordHash = await hashPassword(newPassword);
  await updateUser(resetToken.user_id, { password_hash: passwordHash });
  await markTokenUsed(resetToken.id);
  await resetFailedLogins(resetToken.user_id);

  logger.info({ userId: resetToken.user_id }, 'Password reset completed');
}
