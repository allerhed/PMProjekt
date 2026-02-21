import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { inputSanitizer } from './middleware/inputSanitizer';
import { requestIdMiddleware } from './middleware/requestId';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
import { authenticate } from './middleware/authenticate';
import { sendSuccess } from './utils/response';
import * as taskModel from './models/task.model';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import taskCommentRoutes from './routes/taskComment.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import blueprintRoutes from './routes/blueprint.routes';
import taskPhotoRoutes from './routes/taskPhoto.routes';
import protocolRoutes from './routes/protocol.routes';
import organizationRoutes from './routes/organization.routes';
import storageRoutes from './routes/storage.routes';
import productRoutes from './routes/product.routes';
import taskProductRoutes from './routes/taskProduct.routes';
import { adminRouter as adminCustomFieldRoutes, publicRouter as publicCustomFieldRoutes } from './routes/customField.routes';
import reportRoutes from './routes/report.routes';
import publicSigningRoutes from './routes/publicSigning.routes';
import projectNoteRoutes from './routes/projectNote.routes';
import backupRoutes from './routes/backup.routes';
import bugReportRoutes from './routes/bugReport.routes';
import config from './config';

const app = express();

// Trust proxy (behind Nginx in production)
if (config.env === 'production') {
  app.set('trust proxy', 1);
}

// Security
app.use(helmet());
app.use(cors({
  origin: config.env === 'production'
    ? [process.env.FRONTEND_URL || 'https://taskproof.work', 'https://api.taskproof.work']
    : ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ms-blob-type'],
}));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Input sanitization
app.use(inputSanitizer);

// Request tracking
app.use(requestIdMiddleware);

// Logging
if (config.env !== 'test') {
  app.use(morgan('short'));
}

// Routes
app.use(healthRoutes);

// API Routes
if (config.env !== 'test') {
  app.use('/api/v1', apiLimiter);
}
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/public/sign', publicSigningRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/projects/:projectId/tasks', taskRoutes);
app.use('/api/v1/projects/:projectId/tasks/:taskId/comments', taskCommentRoutes);
app.use('/api/v1/projects/:projectId/tasks/:taskId/photos', taskPhotoRoutes);
app.use('/api/v1/projects/:projectId/blueprints', blueprintRoutes);
app.use('/api/v1/projects/:projectId/protocols', protocolRoutes);
app.use('/api/v1/projects/:projectId/notes', projectNoteRoutes);

// Standalone route — Express 5 doesn't match multi-segment paths on mounted routers
app.get('/api/v1/users/me/tasks', authenticate, async (req, res, next) => {
  try {
    const tasks = await taskModel.findTasksByUser(req.user!.userId, req.user!.organizationId);
    sendSuccess(res, { tasks });
  } catch (err) {
    next(err);
  }
});

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/storage', storageRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/projects/:projectId/tasks/:taskId/products', taskProductRoutes);
app.use('/api/v1/admin/custom-fields', adminCustomFieldRoutes);
app.use('/api/v1/admin/reports', reportRoutes);
app.use('/api/v1/admin/backups', backupRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/custom-fields', publicCustomFieldRoutes);
app.use('/api/v1/bug-reports', bugReportRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
