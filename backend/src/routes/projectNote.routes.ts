import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { sendSuccess, sendError } from '../utils/response';
import { param } from '../utils/params';
import { createNoteSchema, updateNoteSchema } from '../validators/projectNote.validators';
import * as noteModel from '../models/projectNote.model';
import * as projectModel from '../models/project.model';

const router = Router({ mergeParams: true });

router.use(authenticate);

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

// GET /api/v1/projects/:projectId/notes
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await verifyProjectAccess(req, res))) return;
    const sortBy = (req.query.sortBy as string) || 'created_at';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const notes = await noteModel.findNotesByProject(
      param(req.params.projectId),
      req.user!.organizationId,
      sortBy,
      sortOrder,
    );
    sendSuccess(res, { notes });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:projectId/notes
router.post('/', validate(createNoteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await verifyProjectAccess(req, res))) return;
    const note = await noteModel.createNote({
      projectId: param(req.params.projectId),
      content: req.body.content,
      createdBy: req.user!.userId,
    });
    sendSuccess(res, { note }, 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/projects/:projectId/notes/:noteId
router.put('/:noteId', validate(updateNoteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await noteModel.findNoteById(
      param(req.params.noteId),
      req.user!.organizationId,
    );
    if (!existing || existing.project_id !== param(req.params.projectId)) {
      sendError(res, 404, 'NOT_FOUND', 'Note not found');
      return;
    }
    const note = await noteModel.updateNote(param(req.params.noteId), req.body.content);
    sendSuccess(res, { note });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/projects/:projectId/notes/:noteId
router.delete('/:noteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await noteModel.findNoteById(
      param(req.params.noteId),
      req.user!.organizationId,
    );
    if (!existing || existing.project_id !== param(req.params.projectId)) {
      sendError(res, 404, 'NOT_FOUND', 'Note not found');
      return;
    }
    await noteModel.deleteNote(param(req.params.noteId));
    sendSuccess(res, { message: 'Note deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
