import { generateToken, verifyToken, shouldRefreshToken } from '../../utils/jwt';
import { UserRole } from '../../types';

describe('JWT utilities', () => {
  const mockPayload = {
    userId: 'test-user-id',
    organizationId: 'test-org-id',
    role: UserRole.PROJECT_MANAGER,
    email: 'test@example.com',
  };

  describe('generateToken', () => {
    it('should generate a valid JWT string', () => {
      const token = generateToken(mockPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.organizationId).toBe(mockPayload.organizationId);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw for an invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });

    it('should throw for a tampered token', () => {
      const token = generateToken(mockPayload);
      const tampered = token.slice(0, -5) + 'xxxxx';
      expect(() => verifyToken(tampered)).toThrow();
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return false when token is fresh', () => {
      const now = Math.floor(Date.now() / 1000);
      const iat = now;
      const exp = now + 7 * 24 * 60 * 60; // 7 days
      expect(shouldRefreshToken(iat, exp)).toBe(false);
    });

    it('should return true when token is past 50% lifetime', () => {
      const now = Math.floor(Date.now() / 1000);
      const iat = now - 4 * 24 * 60 * 60; // 4 days ago
      const exp = iat + 7 * 24 * 60 * 60; // 7 day lifetime
      expect(shouldRefreshToken(iat, exp)).toBe(true);
    });

    it('should return false when token is at exactly 50%', () => {
      const now = Math.floor(Date.now() / 1000);
      const lifetime = 7 * 24 * 60 * 60;
      const iat = now - Math.floor(lifetime * 0.5);
      const exp = iat + lifetime;
      // At exactly 50%, elapsed equals lifetime*0.5 so > is false
      expect(shouldRefreshToken(iat, exp)).toBe(false);
    });
  });
});
