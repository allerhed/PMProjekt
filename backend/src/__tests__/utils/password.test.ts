import { hashPassword, comparePassword, validatePasswordPolicy } from '../../utils/password';

describe('Password utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password with bcrypt', async () => {
      const hash = await hashPassword('TestPassword123!');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('TestPassword123!');
      expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
    });

    it('should produce different hashes for the same password', async () => {
      const hash1 = await hashPassword('TestPassword123!');
      const hash2 = await hashPassword('TestPassword123!');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const hash = await hashPassword('TestPassword123!');
      const result = await comparePassword('TestPassword123!', hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const hash = await hashPassword('TestPassword123!');
      const result = await comparePassword('WrongPassword!', hash);
      expect(result).toBe(false);
    });
  });

  describe('validatePasswordPolicy', () => {
    it('should accept valid passwords', () => {
      expect(validatePasswordPolicy('Password123!')).toBeNull();
      expect(validatePasswordPolicy('Str0ng@Pass')).toBeNull();
    });

    it('should reject passwords shorter than 8 characters', () => {
      const result = validatePasswordPolicy('Pa1!');
      expect(result).toBeTruthy();
    });

    it('should reject passwords without uppercase', () => {
      const result = validatePasswordPolicy('password123!');
      expect(result).toBeTruthy();
    });

    it('should reject passwords without lowercase', () => {
      const result = validatePasswordPolicy('PASSWORD123!');
      expect(result).toBeTruthy();
    });

    it('should reject passwords without numbers', () => {
      const result = validatePasswordPolicy('PasswordABC!');
      expect(result).toBeTruthy();
    });

    it('should reject passwords without special characters', () => {
      const result = validatePasswordPolicy('Password123');
      expect(result).toBeTruthy();
    });

    it('should reject passwords containing the email', () => {
      const result = validatePasswordPolicy('john@test.comPass1!', 'john@test.com');
      expect(result).toBeTruthy();
    });
  });
});
