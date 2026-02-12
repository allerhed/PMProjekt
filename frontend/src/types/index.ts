// User roles
export const UserRole = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  PROJECT_MANAGER: 'project_manager',
  FIELD_USER: 'field_user',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TaskStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  VERIFIED: 'verified',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const ProjectStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

// Domain types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  organizationId: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string | null;
  storageUsedBytes: number;
  storageLimitBytes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  address: string | null;
  status: ProjectStatus;
  startDate: string | null;
  targetCompletionDate: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  imageDownloadUrl: string | null;
  thumbnailDownloadUrl: string | null;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  stats?: ProjectStats;
}

export interface ProjectStats {
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  verifiedTasks: number;
  completionRate: number;
}

export interface Task {
  id: string;
  projectId: string;
  taskNumber: number;
  projectName?: string;
  blueprintId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  trade: string | null;
  locationX: number | null;
  locationY: number | null;
  assignedToUser: { id: string; name: string } | null;
  assignedToContractorEmail: string | null;
  createdBy: { id: string; name: string };
  photoCount: number;
  commentCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  verifiedAt: string | null;
  annotationX: number | null;
  annotationY: number | null;
  annotationWidth: number | null;
  annotationHeight: number | null;
  annotationPage: number | null;
}

export interface Blueprint {
  id: string;
  projectId: string;
  name: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileSizeBytes: number;
  mimeType: string;
  widthPixels: number | null;
  heightPixels: number | null;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TaskPhoto {
  id: string;
  taskId: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileSizeBytes: number;
  caption: string | null;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string | null;
  userName: string | null;
  externalEmail: string | null;
  commentText: string;
  createdAt: string;
}

export interface Protocol {
  id: string;
  projectId: string;
  name: string;
  filters: Record<string, unknown>;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  status: 'generating' | 'completed' | 'failed';
  generatedBy: string;
  generatedAt: string;
}

export interface Product {
  id: string;
  organizationId: string;
  productId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  imageDownloadUrl: string | null;
  thumbnailDownloadUrl: string | null;
  link: string | null;
  comment: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskProduct {
  id: string;
  taskId: string;
  productId: string;
  addedBy: string | null;
  createdAt: string;
  productName: string;
  productProductId: string | null;
  productDescription: string | null;
  productImageUrl: string | null;
  productThumbnailUrl: string | null;
  productLink: string | null;
  productComment: string | null;
  imageDownloadUrl: string | null;
  thumbnailDownloadUrl: string | null;
}

// API response types
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string; details?: Record<string, unknown> } | null;
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}
