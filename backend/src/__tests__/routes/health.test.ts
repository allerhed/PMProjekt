import request from 'supertest';
import app from '../../app';

describe('Health endpoints', () => {
  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.requestId).toBeDefined();
      expect(res.body.meta.timestamp).toBeDefined();
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
