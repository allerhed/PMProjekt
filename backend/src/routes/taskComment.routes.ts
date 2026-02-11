import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { parsePagination } from '../middleware/pagination';
import { sendSuccess, sendError } from '../utils/response';
import { createCommentSchema } from '../validators/comment.validators';
import * as commentModel from '../models/comment.model';
import * as taskModel from '../models/task.model';
import { param } from '../utils/params';

const router = Router({ mergeParams: true });

router.use(authenticate);

// GET /api/v1/projects/:projectId/tasks/:taskId/comments
router.get('/', parsePagination, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verify task exists and belongs to user's org
    const task = await taskModel.findTaskById(param(req.params.taskId), req.user!.organizationId);
    if (!task || task.project_id !== param(req.params.projectId)) {
      sendError(res, 404, 'NOT_FOUND', 'Task not found');
      return;
    }

    const { comments, total } = await commentModel.findCommentsByTask(
      param(req.params.taskId),
      { limit: req.pagination!.limit, offset: req.pagination!.offset },
    );

    sendSuccess(res, { comments }, 200, {
      page: req.pagination!.page,
      limit: req.pagination!.limit,
      total,
      totalPages: Math.ceil(total / req.pagination!.limit),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:projectId/tasks/:taskId/comments
router.post('/', validate(createCommentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verify task exists and belongs to user's org
    const task = await taskModel.findTaskById(param(req.params.taskId), req.user!.organizationId);
    if (!task || task.project_id !== param(req.params.projectId)) {
      sendError(res, 404, 'NOT_FOUND', 'Task not found');
      return;
    }

    const comment = await commentModel.createComment({
      taskId: param(req.params.taskId),
      userId: req.user!.userId,
      commentText: req.body.commentText,
    });

    sendSuccess(res, { comment }, 201);
  } catch (err) {
    next(err);
  }
});

export default router;
