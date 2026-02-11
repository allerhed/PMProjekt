import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { inputSanitizer } from './middleware/inputSanitizer';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
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
import config from './config';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: config.env === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/projects/:projectId/tasks', taskRoutes);
app.use('/api/v1/projects/:projectId/tasks/:taskId/comments', taskCommentRoutes);
app.use('/api/v1/projects/:projectId/tasks/:taskId/photos', taskPhotoRoutes);
app.use('/api/v1/projects/:projectId/blueprints', blueprintRoutes);
app.use('/api/v1/projects/:projectId/protocols', protocolRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/storage', storageRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
