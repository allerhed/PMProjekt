import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { param } from '../utils/params';
import { validate } from '../middleware/validate';
import { submitSignatureSchema } from '../validators/protocolSignature.validators';
import * as protocolSignatureModel from '../models/protocolSignature.model';
import * as protocolModel from '../models/protocol.model';
import * as storageService from '../services/storage.service';

const router = Router();

// GET /api/v1/public/sign/:token — get protocol info for signing
router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = param(req.params.token);

    const sigRecord = await protocolSignatureModel.findByToken(token);
    if (!sigRecord) {
      sendError(res, 404, 'NOT_FOUND', 'Signing link not found or expired');
      return;
    }

    if (sigRecord.signed_at) {
      sendError(res, 400, 'ALREADY_SIGNED', 'This protocol has already been signed');
      return;
    }

    const protocol = await protocolModel.findProtocolById(sigRecord.protocol_id);
    if (!protocol || protocol.status !== 'completed' || !protocol.file_url) {
      sendError(res, 404, 'NOT_FOUND', 'Protocol not available');
      return;
    }

    const downloadUrl = await storageService.generatePresignedDownloadUrl(protocol.file_url);

    sendSuccess(res, {
      protocolName: protocol.name,
      generatedAt: protocol.generated_at,
      downloadUrl,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/public/sign/:token — submit signature
router.post(
  '/:token',
  validate(submitSignatureSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = param(req.params.token);

      const sigRecord = await protocolSignatureModel.findByToken(token);
      if (!sigRecord) {
        sendError(res, 404, 'NOT_FOUND', 'Signing link not found or expired');
        return;
      }

      if (sigRecord.signed_at) {
        sendError(res, 400, 'ALREADY_SIGNED', 'This protocol has already been signed');
        return;
      }

      const { signerName, signerEmail, signatureData } = req.body;

      await protocolSignatureModel.submitSignature(
        sigRecord.id,
        signerName,
        signerEmail,
        signatureData,
      );

      sendSuccess(res, { message: 'Protocol signed successfully' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
