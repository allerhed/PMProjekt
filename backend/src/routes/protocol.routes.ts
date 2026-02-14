import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { protocolLimiter } from '../middleware/rateLimiter';
import { sendSuccess, sendError } from '../utils/response';
import { UserRole } from '../types';
import { generateProtocolSchema } from '../validators/protocol.validators';
import { createSigningLinkSchema } from '../validators/protocolSignature.validators';
import * as protocolModel from '../models/protocol.model';
import * as protocolSignatureModel from '../models/protocolSignature.model';
import * as projectModel from '../models/project.model';
import * as storageService from '../services/storage.service';
import { startProtocolGeneration } from '../services/protocol.service';
import { sendEmail } from '../services/email.service';
import { renderProtocolSigning } from '../services/emailTemplate.service';
import { param } from '../utils/params';

const router = Router({ mergeParams: true });

// All protocol routes require authentication
router.use(authenticate);

// Helper: verify project access
async function verifyProjectAccess(req: Request, res: Response): Promise<boolean> {
  const project = await projectModel.findProjectById(
    param(req.params.projectId),
    req.user!.organizationId,
  );
  if (!project) {
    sendError(res, 404, 'NOT_FOUND', 'Project not found');
    return false;
  }
  return true;
}

// GET /api/v1/projects/:projectId/protocols — list protocols
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await verifyProjectAccess(req, res))) return;

    const protocols = await protocolModel.findProtocolsByProject(
      param(req.params.projectId),
      req.user!.organizationId,
    );

    // Generate download URLs for completed protocols
    const protocolsWithUrls = await Promise.all(
      protocols.map(async (pr) => ({
        ...pr,
        download_url: pr.file_url && pr.status === 'completed'
          ? await storageService.generatePresignedDownloadUrl(pr.file_url)
          : null,
      })),
    );

    sendSuccess(res, { protocols: protocolsWithUrls });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:projectId/protocols/generate — generate a protocol
router.post(
  '/generate',
  protocolLimiter,
  authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PROJECT_MANAGER),
  validate(generateProtocolSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await verifyProjectAccess(req, res))) return;

      const protocolId = await startProtocolGeneration({
        projectId: param(req.params.projectId),
        organizationId: req.user!.organizationId,
        userId: req.user!.userId,
        name: req.body.name,
        filters: req.body.filters || {},
        ipAddress: (req.ip as string || ''),
      });

      sendSuccess(res, { protocolId, status: 'generating' }, 202);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/projects/:projectId/protocols/:protocolId — get protocol status/detail
router.get('/:protocolId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const protocol = await protocolModel.findProtocolById(
      param(req.params.protocolId),
      req.user!.organizationId,
    );

    if (!protocol || protocol.project_id !== param(req.params.projectId)) {
      sendError(res, 404, 'NOT_FOUND', 'Protocol not found');
      return;
    }

    const downloadUrl = protocol.file_url && protocol.status === 'completed'
      ? await storageService.generatePresignedDownloadUrl(protocol.file_url)
      : null;

    sendSuccess(res, {
      protocol: {
        ...protocol,
        download_url: downloadUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:projectId/protocols/:protocolId/signing-links — create signing link
router.post(
  '/:protocolId/signing-links',
  validate(createSigningLinkSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const protocolId = param(req.params.protocolId);

      const protocol = await protocolModel.findProtocolById(protocolId, req.user!.organizationId);
      if (!protocol || protocol.project_id !== param(req.params.projectId)) {
        sendError(res, 404, 'NOT_FOUND', 'Protocol not found');
        return;
      }

      if (protocol.status !== 'completed') {
        sendError(res, 400, 'NOT_READY', 'Protocol PDF has not been generated yet');
        return;
      }

      // Generate token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await protocolSignatureModel.createSigningToken(protocolId, token, tokenHash, 7);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const signingUrl = `${frontendUrl}/sign/${token}`;

      // Send email if provided
      if (req.body.email) {
        const emailContent = renderProtocolSigning({
          protocolName: protocol.name,
          signingUrl,
        });
        sendEmail({
          to: req.body.email,
          ...emailContent,
        });
      }

      sendSuccess(res, { signingUrl, token }, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/projects/:projectId/protocols/:protocolId/signatures — list signatures
router.get(
  '/:protocolId/signatures',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const protocolId = param(req.params.protocolId);

      const protocol = await protocolModel.findProtocolById(protocolId, req.user!.organizationId);
      if (!protocol || protocol.project_id !== param(req.params.projectId)) {
        sendError(res, 404, 'NOT_FOUND', 'Protocol not found');
        return;
      }

      const signatures = await protocolSignatureModel.findSignaturesByProtocol(protocolId);
      sendSuccess(res, { signatures });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
