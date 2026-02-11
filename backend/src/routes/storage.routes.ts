import { Router, Request, Response } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import mime from 'mime-types';
import config from '../config';
import { writeFile } from '../services/storage.service';
import { logger } from '../utils/logger';
import type { UploadTokenPayload } from '../services/storage.service';

const router = Router();

/**
 * PUT /upload/:token
 * Accepts a raw file body and writes it to local storage.
 * The token is a JWT containing the key, contentType, and contentLength.
 * No auth middleware — the signed token IS the authorization (mimics presigned URLs).
 */
router.put(
  '/upload/:token',
  express.raw({ type: () => true, limit: '50mb' }),
  async (req: Request, res: Response) => {
    try {
      const token = req.params.token as string;

      // Verify the upload token
      let payload: UploadTokenPayload;
      try {
        payload = jwt.verify(token, config.jwt.secret as string) as unknown as UploadTokenPayload;
      } catch {
        res.status(403).json({ error: 'Invalid or expired upload token' });
        return;
      }

      if (payload.purpose !== 'storage-upload') {
        res.status(403).json({ error: 'Invalid token purpose' });
        return;
      }

      const body = req.body as Buffer;
      if (!body || body.length === 0) {
        res.status(400).json({ error: 'Empty request body' });
        return;
      }

      // Write file to local storage
      await writeFile(payload.key, body, payload.contentType);

      logger.debug({ key: payload.key, size: body.length }, 'Local upload completed');
      res.status(200).json({ success: true });
    } catch (err) {
      logger.error({ err }, 'Local upload failed');
      res.status(500).json({ error: 'Upload failed' });
    }
  },
);

/**
 * GET /files/:encodedKey
 * Serves a file from local storage.
 * The key is base64url-encoded in the URL path.
 * No auth middleware — mimics public presigned download URLs.
 */
router.get('/files/:encodedKey', async (req: Request, res: Response) => {
  try {
    const encodedKey = req.params.encodedKey as string;
    const key = Buffer.from(encodedKey, 'base64url').toString('utf-8');

    // Prevent path traversal
    const filePath = path.resolve(config.storage.localPath, key);
    if (!filePath.startsWith(path.resolve(config.storage.localPath))) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Relax security headers for file serving (mimics S3/CDN behavior)
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ error: 'File not found' });
      }
    });
  } catch (err) {
    logger.error({ err }, 'Local file serve failed');
    res.status(500).json({ error: 'File serve failed' });
  }
});

export default router;
