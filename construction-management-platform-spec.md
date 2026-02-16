# Construction Management Platform - Complete Technical Specification

**Version:** 2.0
**Date:** 2026-02-15
**Target Audience:** Development Team (Claude Code)
**Deployment Model:** Single-tenant SaaS
**Production URL:** https://taskproof.work
**API URL:** https://api.taskproof.work
**Initial Scale:** 5-10 organizations, <100 users each

---

## Executive Summary

A web-based construction project management platform that replaces paper-based workflows for task tracking, deficiency management, and protocol generation. The system enables field teams to document issues with photos, assign work to contractors via email without requiring accounts, and automatically generate professional reports sorted by responsibility.

**Core Value Proposition:** Reduce punch list creation time by 70% and eliminate redundant paperwork through real-time cloud collaboration.

---

## Problem Statement

Construction project managers waste 50%+ of their administrative time on manual paperwork - creating handwritten punch lists, photographing issues separately, manually typing protocols, and chasing contractors for updates via phone calls and text messages. This paper-based approach leads to:

- Lost documentation when paper is damaged or misplaced
- Delays in communicating deficiencies to responsible parties
- Inability to track completion status in real-time
- Hours spent manually compiling status reports
- Difficulty accessing historical project data for analysis

**Who is affected:** Project managers, site supervisors, field engineers, and subcontractors on construction sites (50-500 person projects).

**Impact of not solving:** Projects run 2-4 weeks over schedule due to communication delays, contractors charge for re-visits due to unclear deficiency documentation, and companies cannot analyze historical data to improve processes.

---

## Goals

1. **Reduce punch list creation time by 70%** - From 3 hours to <1 hour for a 100-item list (measured via time tracking in pilot phase)
2. **Eliminate paper protocols** - 100% of protocols generated digitally with zero manual transcription (measured by protocol generation method)
3. **Decrease deficiency resolution time by 30%** - From average 14 days to <10 days (measured by task creation-to-completion timestamps)
4. **Enable offline field work** - Users can create tasks without connectivity, with automatic sync when online (measured by successful offline task creation rate)
5. **Achieve 80% weekly active user rate** - Within 30 days of onboarding (measured by weekly login analytics)

---

## Non-Goals

1. **Full-featured accounting/invoicing** - Focus on field operations, not financial management (integrate with external systems via export)
2. **Native mobile apps at launch** - Progressive Web App provides sufficient mobile experience; native apps are Phase 2
3. **Multi-language support initially** - Swedish/English only at launch; additional languages based on market demand
4. **3D BIM model integration** - Focus on 2D blueprints; 3D viewing is future consideration
5. **Offline blueprint downloads** - Blueprints require connectivity; only task creation/editing works offline

---

## User Personas & Stories

### Super Admin (Platform Management)
**Profile:** Internal operations team managing multiple client organizations
**Technical comfort:** High
**Primary goals:** System stability, customer success, resource monitoring

**User Stories:**
- As a Super Admin, I want to provision new organization accounts so that sales can onboard clients within 15 minutes of contract signing
- As a Super Admin, I want to monitor storage utilization across all organizations so that I can plan infrastructure scaling before hitting capacity limits
- As a Super Admin, I want to view system-wide health metrics (uptime, error rates, active users) so that I can proactively address issues before they affect customers
- As a Super Admin, I want to reset organization admin passwords so that I can provide emergency access recovery

### Organization Admin (Company Management)
**Profile:** IT coordinator or office manager at construction company
**Technical comfort:** Medium
**Primary goals:** User management, company-wide configuration

**User Stories:**
- As an Organization Admin, I want to invite users via email and assign roles so that new employees can access the system their first day
- As an Organization Admin, I want to deactivate users who leave the company so that former employees cannot access sensitive project data
- As an Organization Admin, I want to reset user passwords so that I can help employees regain access without involving support
- As an Organization Admin, I want to view usage statistics (logins, active users, tasks created) so that I can measure adoption and identify power users for best practice sharing
- As an Organization Admin, I want to upload company branding (logo, colors) so that generated reports reflect our professional identity

### Project Manager (Project-Level Control)
**Profile:** Licensed professional managing 2-5 active construction projects
**Technical comfort:** Medium
**Primary goals:** Project tracking, contractor coordination, report generation

**User Stories:**
- As a Project Manager, I want to create new projects with blueprints and contractor lists so that field teams can immediately start documenting deficiencies
- As a Project Manager, I want to generate PDF protocols filtered by trade (electrical, plumbing, etc.) so that I can send each contractor only their relevant items
- As a Project Manager, I want to see completion statistics (% closed by trade, aging of open items) so that I can identify bottlenecks and allocate resources
- As a Project Manager, I want to receive email notifications when contractors mark items complete so that I can schedule verification inspections
- As a Project Manager, I want to assign project manager rights to junior staff so that they can manage smaller projects independently

### Field User (Basic Access)
**Profile:** Site supervisor, foreman, or engineer documenting issues in the field
**Technical comfort:** Low-Medium (smartphone user)
**Primary goals:** Quick issue documentation, photo capture, assignment tracking

**User Stories:**
- As a Field User, I want to create deficiency tasks with photos in <60 seconds so that I can document issues without interrupting site walks
- As a Field User, I want to mark issue locations on blueprints by tapping so that contractors can easily locate problems
- As a Field User, I want to assign tasks to contractors from a dropdown so that responsible parties are immediately notified
- As a Field User, I want to filter "My Open Tasks" so that I can focus on items requiring my attention
- As a Field User, I want to add follow-up photos to existing tasks so that I can document progression over multiple visits
- As a Field User, I want to work offline and auto-sync when connected so that poor site connectivity doesn't block my workflow

### External Contractor (No Account Required)
**Profile:** Subcontractor employee receiving task notifications
**Technical comfort:** Low
**Primary goals:** Understand work requirements, communicate completion

**User Stories:**
- As an External Contractor, I want to receive email notifications with issue details and photos so that I understand what needs repair without needing app access
- As an External Contractor, I want to reply to task emails to mark items complete or request clarification so that I can update status without creating an account
- As an External Contractor, I want to click email links to view blueprint locations so that I can find the issue on a large site

---

## Technical Architecture

### Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Tailwind CSS for styling
- React Query for server state management
- React Router for navigation
- Zustand for client state
- PWA capabilities (service workers, offline support, installability)

**Backend:**
- Node.js 20 LTS with Express.js
- TypeScript for type safety
- JWT authentication with bcrypt password hashing
- Multer for file upload handling
- Node-cron for scheduled tasks (email digest, storage cleanup)

**Database:**
- PostgreSQL 16+ (primary data store)
- Connection pooling via pg-pool
- Full-text search for task/project queries
- JSONB columns for flexible metadata storage

**File Storage:**
- Azure Blob Storage (photos, blueprints, generated PDFs, backups)
- SAS URLs for secure direct uploads/downloads
- Local filesystem provider for development (switchable via `STORAGE_PROVIDER` env var)

**Email Service:**
- SMTP via Nodemailer
- Mailhog for development, configurable SMTP for production
- Email parsing via webhook for contractor replies (planned)

**Container Orchestration:**
- Docker Compose for local development
- Azure VM with Docker Compose for production
- Azure Container Registry (ACR) for image storage
- Nginx reverse proxy with SSL (Let's Encrypt)

**Monitoring & Logging:**
- Pino structured logging
- Health check endpoints (/health, /ready)

### Container Architecture

**Three-container deployment:**

1. **Frontend Container** (`frontend:latest`)
   - Nginx serving static React build
   - Gzip compression enabled
   - Security headers configured
   - Reverse proxy to backend API
   - Port: 80/443 (SSL via Let's Encrypt)

2. **Backend Container** (`backend:latest`)
   - Node.js Express application
   - JWT validation middleware
   - Rate limiting (100 req/min per IP)
   - CORS configuration for frontend origin
   - Port: 3000 (internal)

3. **Database Container** (`postgres:16-alpine`)
   - PostgreSQL with persistent volume
   - Automated backups to Azure Blob Storage (configurable schedule)
   - Connection limit: 100 concurrent
   - Port: 5432 (internal network only)

**Container Communication:**
- Frontend → Backend: HTTP via internal Docker network
- Backend → Database: PostgreSQL protocol via internal network
- Backend → Azure Blob Storage: HTTPS via Azure SDK
- External → Frontend: HTTPS via Nginx with SSL termination

**Resource Allocation (per organization instance):**
- Frontend: 0.5 vCPU, 512 MB RAM
- Backend: 1 vCPU, 1 GB RAM
- Database: 1 vCPU, 2 GB RAM, 20 GB SSD

**Scaling Strategy:**
- Horizontal: Deploy additional backend containers behind load balancer
- Vertical: Increase VM/container resources for database under heavy load
- Database: Managed PostgreSQL (Azure Database for PostgreSQL) for high availability in Phase 2

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'project_manager', 'field_user')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_users_org_email (organization_id, email),
  INDEX idx_users_role (role)
);
```

### Organizations Table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(50) NOT NULL UNIQUE, -- e.g., acme.taskproof.work
  logo_url VARCHAR(500),
  primary_color VARCHAR(7), -- Hex color for branding
  storage_used_bytes BIGINT DEFAULT 0,
  storage_limit_bytes BIGINT DEFAULT 10737418240, -- 10 GB default
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_organizations_subdomain (subdomain)
);
```

### Projects Table
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  start_date DATE,
  target_completion_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_projects_org_status (organization_id, status),
  INDEX idx_projects_dates (start_date, target_completion_date)
);
```

### Blueprints Table
```sql
CREATE TABLE blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL, -- Azure Blob Storage URL
  file_size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  width_pixels INT,
  height_pixels INT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_blueprints_project (project_id)
);
```

### Tasks Table
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'verified')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  trade VARCHAR(50), -- e.g., "Electrical", "Plumbing", "HVAC"
  location_x FLOAT, -- Blueprint coordinate (0-1 normalized)
  location_y FLOAT, -- Blueprint coordinate (0-1 normalized)
  assigned_to_user UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_contractor_email VARCHAR(255), -- For external contractors
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  verified_at TIMESTAMP,

  INDEX idx_tasks_project_status (project_id, status),
  INDEX idx_tasks_assigned (assigned_to_user, status),
  INDEX idx_tasks_contractor (assigned_to_contractor_email),
  INDEX idx_tasks_trade (trade, status)
);
```

### Task Photos Table
```sql
CREATE TABLE task_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_url VARCHAR(500) NOT NULL, -- Azure Blob Storage URL
  file_size_bytes BIGINT NOT NULL,
  thumbnail_url VARCHAR(500), -- Small preview
  caption VARCHAR(500),
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_task_photos_task (task_id)
);
```

### Task Comments Table
```sql
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  external_email VARCHAR(255), -- If from contractor reply
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_task_comments_task (task_id, created_at)
);
```

### Protocols Table (Generated Reports)
```sql
CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  filters JSONB, -- Store filter criteria: { "trade": "Electrical", "status": "open" }
  file_url VARCHAR(500) NOT NULL, -- Azure Blob Storage URL to PDF
  file_size_bytes BIGINT NOT NULL,
  generated_by UUID REFERENCES users(id),
  generated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_protocols_project (project_id, generated_at)
);
```

### Audit Log Table
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- e.g., "user.created", "task.completed"
  resource_type VARCHAR(50), -- e.g., "task", "user", "project"
  resource_id UUID,
  metadata JSONB, -- Additional context
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_audit_log_org_time (organization_id, created_at),
  INDEX idx_audit_log_user (user_id, created_at)
);
```

### Password Reset Tokens Table
```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_reset_tokens_user (user_id),
  INDEX idx_reset_tokens_expiry (expires_at)
);
```

### Products Table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  article_number VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50),
  price DECIMAL(12,2),
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Task Products Table
```sql
CREATE TABLE task_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(12,2) DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Custom Fields Table
```sql
CREATE TABLE custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  options JSONB,
  is_required BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Custom Field Values Table
```sql
CREATE TABLE custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(task_id, field_id)
);
```

### Backups Table
```sql
CREATE TABLE backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  file_key VARCHAR(500),
  file_size_bytes BIGINT,
  error_message TEXT,
  triggered_by VARCHAR(20) NOT NULL CHECK (triggered_by IN ('manual', 'scheduled')),
  initiated_by UUID REFERENCES users(id),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Backup Settings Table
```sql
CREATE TABLE backup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  schedule_enabled BOOLEAN DEFAULT false,
  schedule_cron VARCHAR(100) DEFAULT '0 3 * * *',
  retention_days INT DEFAULT 30,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Bug Reports Table
```sql
CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  screenshot_key VARCHAR(500),
  page_url VARCHAR(500),
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Project Notes Table
```sql
CREATE TABLE project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255),
  content TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Specifications

### Authentication & Authorization

**JWT Token Structure:**
```json
{
  "userId": "uuid",
  "organizationId": "uuid",
  "role": "project_manager",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234654290
}
```

**Token Expiry:** 7 days
**Refresh Strategy:** Issue new token at 50% lifetime (3.5 days)
**Storage:** HttpOnly cookie (not localStorage for security)

**Authorization Middleware:**
- Super Admin: Full platform access
- Org Admin: All resources within their organization
- Project Manager: Projects they created or are assigned to
- Field User: Read all projects in org, write only assigned tasks

### API Endpoints

**Base URL:** `https://api.taskproof.work/api/v1` (production)
**Development:** `http://localhost:3000/api/v1`

**Response Format:**
```json
{
  "success": true,
  "data": { /* payload */ },
  "error": null,
  "meta": {
    "timestamp": "2026-02-11T10:30:00Z",
    "requestId": "uuid"
  }
}
```

**Error Format:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": { "field": "email" }
  },
  "meta": {
    "timestamp": "2026-02-11T10:30:00Z",
    "requestId": "uuid"
  }
}
```

---

### Auth Endpoints

#### POST /auth/register
**Description:** Register new organization (first user becomes org admin)
**Authentication:** None
**Request:**
```json
{
  "organizationName": "ACME Construction",
  "subdomain": "acme",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@acme.com",
  "password": "SecurePass123!"
}
```
**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@acme.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "org_admin"
    },
    "organization": {
      "id": "uuid",
      "name": "ACME Construction",
      "subdomain": "acme"
    },
    "token": "jwt-token-here"
  }
}
```

#### POST /auth/login
**Description:** Authenticate user and return JWT
**Authentication:** None
**Request:**
```json
{
  "email": "john@acme.com",
  "password": "SecurePass123!"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "user": { /* user object */ },
    "token": "jwt-token-here",
    "expiresAt": "2026-02-18T10:30:00Z"
  }
}
```

#### POST /auth/forgot-password
**Description:** Request password reset email
**Authentication:** None
**Request:**
```json
{
  "email": "john@acme.com"
}
```
**Response:** 200 OK (always returns success even if email not found)

#### POST /auth/reset-password
**Description:** Reset password with token from email
**Authentication:** None
**Request:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass456!"
}
```
**Response:** 200 OK

#### POST /auth/refresh
**Description:** Refresh JWT token
**Authentication:** Valid JWT
**Response:** 200 OK with new token

---

### User Management Endpoints

#### GET /users
**Description:** List users in organization
**Authentication:** Org Admin, Super Admin
**Query Params:** `?role=field_user&isActive=true&page=1&limit=50`
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "Jane",
        "lastName": "Smith",
        "role": "field_user",
        "isActive": true,
        "lastLoginAt": "2026-02-10T14:20:00Z",
        "createdAt": "2026-01-15T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 120,
      "totalPages": 3
    }
  }
}
```

#### POST /users
**Description:** Create new user (invite)
**Authentication:** Org Admin, Super Admin
**Request:**
```json
{
  "email": "newuser@example.com",
  "firstName": "Bob",
  "lastName": "Johnson",
  "role": "field_user"
}
```
**Response:** 201 Created (sends invitation email)

#### PATCH /users/:userId
**Description:** Update user details
**Authentication:** Org Admin (own org), Super Admin (all orgs), User (own profile only)
**Request:**
```json
{
  "firstName": "Robert",
  "role": "project_manager",
  "isActive": false
}
```
**Response:** 200 OK

#### DELETE /users/:userId
**Description:** Soft delete user (sets isActive=false)
**Authentication:** Org Admin, Super Admin
**Response:** 204 No Content

#### POST /users/:userId/reset-password
**Description:** Admin-initiated password reset
**Authentication:** Org Admin, Super Admin
**Response:** 200 OK (sends reset email)

---

### Project Endpoints

#### GET /projects
**Description:** List projects
**Authentication:** Required
**Query Params:** `?status=active&page=1&limit=20`
**Authorization:**
- Org Admin/Super Admin: All projects in org
- Project Manager/Field User: Only assigned projects
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "name": "Downtown Office Building",
        "description": "12-story mixed-use development",
        "address": "123 Main St, Stockholm",
        "status": "active",
        "startDate": "2026-01-01",
        "targetCompletionDate": "2026-12-31",
        "stats": {
          "totalTasks": 145,
          "openTasks": 32,
          "completedTasks": 113,
          "completionRate": 0.78
        },
        "createdAt": "2025-12-15T10:00:00Z"
      }
    ],
    "pagination": { /* standard */ }
  }
}
```

#### POST /projects
**Description:** Create new project
**Authentication:** Org Admin, Project Manager
**Request:**
```json
{
  "name": "Highway Bridge Renovation",
  "description": "Full structural rehab",
  "address": "E4 Highway, Västerås",
  "startDate": "2026-03-01",
  "targetCompletionDate": "2026-09-30"
}
```
**Response:** 201 Created

#### GET /projects/:projectId
**Description:** Get project details
**Authentication:** Required
**Response:** 200 OK (includes full project data + statistics)

#### PATCH /projects/:projectId
**Description:** Update project
**Authentication:** Org Admin, Project Creator
**Request:** Partial project object
**Response:** 200 OK

#### DELETE /projects/:projectId
**Description:** Soft delete (archive) project
**Authentication:** Org Admin, Super Admin
**Response:** 204 No Content

---

### Blueprint Endpoints

#### GET /projects/:projectId/blueprints
**Description:** List blueprints for project
**Authentication:** Required
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "blueprints": [
      {
        "id": "uuid",
        "name": "Ground Floor Plan",
        "fileUrl": "https://<storage>.blob.core.windows.net/...",
        "thumbnailUrl": "https://<storage>.blob.core.windows.net/.../thumb.jpg",
        "fileSizeBytes": 2457600,
        "mimeType": "application/pdf",
        "widthPixels": 3000,
        "heightPixels": 2000,
        "uploadedAt": "2026-01-20T11:00:00Z"
      }
    ]
  }
}
```

#### POST /projects/:projectId/blueprints/upload-url
**Description:** Get presigned URL (SAS URL) for blueprint upload
**Authentication:** Project Manager, Org Admin
**Request:**
```json
{
  "fileName": "floor-plan-1.pdf",
  "fileSize": 2457600,
  "mimeType": "application/pdf"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://<storage>.blob.core.windows.net/...?sig=...",
    "blueprintId": "uuid",
    "expiresAt": "2026-02-11T11:00:00Z"
  }
}
```

#### POST /projects/:projectId/blueprints/:blueprintId/confirm
**Description:** Confirm successful upload and process blueprint
**Authentication:** Project Manager, Org Admin
**Response:** 200 OK (triggers thumbnail generation)

#### DELETE /projects/:projectId/blueprints/:blueprintId
**Description:** Delete blueprint
**Authentication:** Project Manager, Org Admin
**Response:** 204 No Content

---

### Task Endpoints

#### GET /projects/:projectId/tasks
**Description:** List tasks with filtering
**Authentication:** Required
**Query Params:** `?status=open&trade=Electrical&assignedToMe=true&page=1&limit=50`
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "uuid",
        "title": "Fix electrical outlet #42",
        "description": "Outlet not grounded properly",
        "status": "open",
        "priority": "high",
        "trade": "Electrical",
        "blueprintId": "uuid",
        "blueprintName": "2nd Floor Plan",
        "locationX": 0.45,
        "locationY": 0.62,
        "assignedToUser": {
          "id": "uuid",
          "name": "John Electrician"
        },
        "assignedToContractorEmail": "contractor@electrical.com",
        "photoCount": 3,
        "commentCount": 2,
        "createdBy": {
          "id": "uuid",
          "name": "Jane Manager"
        },
        "createdAt": "2026-02-10T09:30:00Z",
        "updatedAt": "2026-02-11T08:15:00Z",
        "completedAt": null
      }
    ],
    "pagination": { /* standard */ }
  }
}
```

#### POST /projects/:projectId/tasks
**Description:** Create new task
**Authentication:** Required
**Request:**
```json
{
  "title": "Repair cracked drywall",
  "description": "Visible crack in ceiling drywall",
  "priority": "normal",
  "trade": "Drywall",
  "blueprintId": "uuid",
  "locationX": 0.33,
  "locationY": 0.78,
  "assignedToContractorEmail": "info@drywall-pros.com"
}
```
**Response:** 201 Created (sends email notification to contractor)

#### GET /tasks/:taskId
**Description:** Get task details with photos and comments
**Authentication:** Required
**Response:** 200 OK (includes photos[] and comments[])

#### PATCH /tasks/:taskId
**Description:** Update task
**Authentication:** Task Creator, Assigned User, Project Manager, Org Admin
**Request:**
```json
{
  "status": "completed",
  "description": "Updated description"
}
```
**Response:** 200 OK

#### POST /tasks/:taskId/photos/upload-url
**Description:** Get presigned URL for photo upload
**Authentication:** Required
**Request:**
```json
{
  "fileName": "issue-photo-1.jpg",
  "fileSize": 524288,
  "mimeType": "image/jpeg"
}
```
**Response:** 200 OK (similar to blueprint upload)

#### POST /tasks/:taskId/photos/:photoId/confirm
**Description:** Confirm photo upload
**Authentication:** Required
**Response:** 200 OK (triggers thumbnail generation)

#### POST /tasks/:taskId/comments
**Description:** Add comment to task
**Authentication:** Required
**Request:**
```json
{
  "commentText": "Checked on site, will fix tomorrow"
}
```
**Response:** 201 Created

#### DELETE /tasks/:taskId
**Description:** Delete task
**Authentication:** Task Creator, Project Manager, Org Admin
**Response:** 204 No Content

---

### Protocol (Report) Endpoints

#### POST /projects/:projectId/protocols/generate
**Description:** Generate PDF protocol with filters
**Authentication:** Project Manager, Org Admin
**Request:**
```json
{
  "name": "Electrical Punch List - Week 6",
  "filters": {
    "trade": "Electrical",
    "status": "open",
    "priority": ["high", "critical"]
  },
  "groupBy": "trade",
  "sortBy": "priority"
}
```
**Response:** 202 Accepted
```json
{
  "success": true,
  "data": {
    "protocolId": "uuid",
    "status": "generating",
    "estimatedCompletionSeconds": 15
  }
}
```

#### GET /projects/:projectId/protocols/:protocolId
**Description:** Get protocol status and download URL
**Authentication:** Required
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Electrical Punch List - Week 6",
    "status": "completed",
    "fileUrl": "https://<storage>.blob.core.windows.net/.../protocol.pdf",
    "fileSizeBytes": 1048576,
    "generatedAt": "2026-02-11T10:45:00Z"
  }
}
```

#### GET /projects/:projectId/protocols
**Description:** List generated protocols
**Authentication:** Required
**Response:** 200 OK (list of protocols)

---

### Admin Statistics Endpoints

#### GET /admin/organizations/:orgId/stats
**Description:** Organization-level statistics
**Authentication:** Org Admin (own org), Super Admin (all orgs)
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 45,
      "active": 42,
      "byRole": {
        "org_admin": 2,
        "project_manager": 8,
        "field_user": 35
      }
    },
    "projects": {
      "total": 12,
      "active": 8,
      "completed": 4
    },
    "tasks": {
      "total": 1456,
      "open": 234,
      "completed": 1222,
      "completionRate": 0.84
    },
    "storage": {
      "usedBytes": 8589934592,
      "limitBytes": 10737418240,
      "usagePercent": 80
    },
    "activity": {
      "lastWeek": {
        "logins": 187,
        "tasksCreated": 45,
        "tasksCompleted": 67
      }
    }
  }
}
```

#### GET /admin/organizations/:orgId/users/activity
**Description:** User activity report
**Authentication:** Org Admin, Super Admin
**Query Params:** `?startDate=2026-02-01&endDate=2026-02-11`
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "loginCount": 23,
        "tasksCreated": 12,
        "tasksCompleted": 8,
        "lastLoginAt": "2026-02-11T08:30:00Z"
      }
    ]
  }
}
```

#### GET /admin/system/health
**Description:** System health metrics
**Authentication:** Super Admin only
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 864000,
    "database": {
      "connected": true,
      "responseTimeMs": 12
    },
    "storage": {
      "connected": true,
      "responseTimeMs": 45
    },
    "memory": {
      "usedMB": 512,
      "totalMB": 1024
    },
    "activeUsers": 87
  }
}
```

---

## Security Requirements

### Password Policy
- Minimum 8 characters
- Must contain: 1 uppercase, 1 lowercase, 1 number, 1 special character
- Cannot contain email address
- Hashed with bcrypt (cost factor 12)
- Password reset tokens expire after 1 hour
- Maximum 5 failed login attempts before 15-minute lockout

### JWT Security
- HS256 algorithm
- 256-bit secret key (stored in environment variable)
- Token expiry: 7 days
- HttpOnly cookies (not accessible to JavaScript)
- Secure flag enabled (HTTPS only)
- SameSite=Strict to prevent CSRF

### Data Protection
- All API requests over HTTPS (TLS 1.3)
- Database connections encrypted
- Azure Blob Storage files encrypted at rest
- SAS URLs expire after 15 minutes
- No sensitive data in logs (passwords, tokens filtered)

### CORS Configuration
```javascript
{
  origin: ['https://taskproof.work'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
```

### Rate Limiting
- Authentication endpoints: 5 requests/minute per IP
- File upload endpoints: 10 requests/minute per user
- API endpoints: 100 requests/minute per user
- Protocol generation: 3 requests/minute per user (resource-intensive)

### Input Validation
- Email format validation (RFC 5322)
- File type whitelist: images (jpg, png), PDFs
- Maximum file sizes: Photos 10 MB, Blueprints 50 MB
- SQL injection prevention via parameterized queries
- XSS prevention via input sanitization and Content-Security-Policy headers

---

## Frontend Specifications

### Progressive Web App (PWA)

**Manifest Configuration:**
```json
{
  "name": "TaskProof",
  "short_name": "TaskProof",
  "description": "Construction project task management",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e40af",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Service Worker Capabilities:**
- Cache static assets (JS, CSS, images)
- Cache API responses for tasks and projects
- Offline task creation with queue sync
- Background sync for photo uploads
- Push notifications for task assignments (Phase 2)

**Offline Functionality:**
- Users can create/edit tasks offline
- Changes queued in IndexedDB
- Automatic sync when connectivity restored
- Visual indicator for offline status
- Conflicts resolved by "last write wins" (with warning)

### Responsive Design Breakpoints
- Mobile: 320px - 767px (primary field use)
- Tablet: 768px - 1023px
- Desktop: 1024px+

### Key UI Components

**Task Creation Form:**
- Title input (required)
- Description textarea
- Priority dropdown
- Trade dropdown (custom values allowed)
- Blueprint selector with preview
- Location marker (tap blueprint to place pin)
- Photo upload (multiple, drag-drop or camera)
- Contractor email input
- Submit button (disabled during upload)

**Blueprint Viewer:**
- Zoom controls (pinch-to-zoom on mobile)
- Pan (drag or touch)
- Task markers overlaid on blueprint
- Marker colors by status (red=open, yellow=in_progress, green=completed)
- Click marker to view task details
- Add task button (tap location to create)

**Protocol Generator:**
- Filter panel (trade, status, priority, date range)
- Preview table (tasks matching filters)
- Group by selector (trade, status, priority)
- Sort by selector
- Generate PDF button
- Download/email options

**Admin Dashboard:**
- User table with search/filter
- Quick actions (deactivate, reset password)
- Storage gauge (visual bar)
- Activity charts (line graph of daily logins/tasks)
- Project health summary cards

---

## Email Notifications

### Email Templates

**Task Assignment (to contractor without account):**
```
Subject: New Task Assigned: [Task Title]

Hello,

You have been assigned a new task for project: [Project Name]

Task: [Task Title]
Description: [Description]
Priority: [Priority]
Location: [Address]

View blueprints and photos: [Link to public task view]

To mark this task complete, simply reply to this email.

Questions? Reply to this email to discuss with the project manager.

---
TaskProof | [Organization Name]
```

**Task Completed Notification (to project manager):**
```
Subject: Task Completed: [Task Title]

Hello [Manager Name],

[Contractor Name] has marked the following task as completed:

Task: [Task Title]
Project: [Project Name]
Completed: [Date/Time]

Review and verify: [Link to task]

---
TaskProof | [Organization Name]
```

**Password Reset:**
```
Subject: Reset Your Password

Hello [First Name],

Click the link below to reset your password:
[Reset Link]

This link expires in 1 hour.

If you didn't request this, ignore this email.

---
TaskProof
```

**User Invitation:**
```
Subject: You've Been Invited to TaskProof

Hello [First Name],

[Admin Name] has invited you to join [Organization Name] on TaskProof.

Click here to set your password and get started:
[Setup Link]

Role: [Role]

---
TaskProof
```

### Email Parsing (Contractor Replies)

**Webhook Endpoint:** POST /webhooks/email-reply (planned — not yet implemented)
**Processing Logic:**
1. Extract sender email from headers
2. Parse "In-Reply-To" header to identify task ID
3. Extract plain text body (ignore quoted replies)
4. Create comment on task with external_email
5. If body contains "complete", "completed", or "done", update task status to "completed"
6. Send confirmation email to contractor

---

## Deployment Specifications

### Environment Variables

**Frontend Container:**
```bash
VITE_API_URL=/api/v1  # Relative path, proxied by Nginx
```

**Backend Container:**
```bash
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@db:5432/construction_manager
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# JWT
JWT_SECRET=<256-bit-secret>
JWT_EXPIRY=7d

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=<azure-connection-string>
AZURE_STORAGE_CONTAINER=uploads
STORAGE_PROVIDER=azure  # or "local" for development

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
EMAIL_FROM=noreply@taskproof.work

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Frontend URL (for CORS and email links)
FRONTEND_URL=https://taskproof.work
```

**Database Container:**
```bash
POSTGRES_USER=construction_admin
POSTGRES_PASSWORD=<from-secrets-manager>
POSTGRES_DB=construction_manager
POSTGRES_MAX_CONNECTIONS=100
```

### Docker Compose (Development)

```yaml
version: '3.9'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3001:80"
    depends_on:
      - backend
    environment:
      VITE_API_URL: /api/v1

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - database
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://construction_admin:devpass@database:5432/construction_manager
      JWT_SECRET: dev-secret-key-change-in-production
      STORAGE_PROVIDER: local
      FRONTEND_URL: http://localhost:3001
    volumes:
      - ./backend:/app
      - /app/node_modules

  database:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: construction_admin
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: construction_manager
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  postgres_data:
```

### Production Deployment (Azure VM)

**Infrastructure:**
- Azure VM (Standard B2s or B2ms) running Docker Compose
- Azure Container Registry (ACR) for storing Docker images
- Azure Blob Storage for file uploads, blueprints, PDFs, and backups
- Nginx with Let's Encrypt SSL certificates
- Custom domains: `taskproof.work` (frontend) + `api.taskproof.work` (backend)

**Deployment Process:**
1. Build and push Docker images to ACR
2. SSH into Azure VM
3. Pull latest images from ACR
4. Run `docker-compose up -d` with production environment file
5. Nginx handles SSL termination and reverse proxy

**docker-compose.prod.yml:**
```yaml
version: '3.9'

services:
  frontend:
    image: <acr-name>.azurecr.io/taskproof-frontend:latest
    restart: always
    ports:
      - "443:443"
      - "80:80"
    depends_on:
      - backend
    volumes:
      - ./ssl:/etc/nginx/ssl
      - ./nginx.conf:/etc/nginx/conf.d/default.conf

  backend:
    image: <acr-name>.azurecr.io/taskproof-backend:latest
    restart: always
    env_file: .env.production
    depends_on:
      - database

  database:
    image: postgres:16-alpine
    restart: always
    env_file: .env.production
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**SSL Configuration:**
- Let's Encrypt certificates via certbot
- Auto-renewal via cron job
- Nginx configured for TLS 1.2+ with strong ciphers

### CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run backend tests
        run: cd backend && npm test
      - name: Run frontend tests
        run: cd frontend && npm test

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Login to ACR
        uses: azure/docker-login@v1
        with:
          login-server: ${{ secrets.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}
      - name: Build and push backend
        run: |
          cd backend
          docker build -t ${{ secrets.ACR_LOGIN_SERVER }}/taskproof-backend:latest .
          docker push ${{ secrets.ACR_LOGIN_SERVER }}/taskproof-backend:latest
      - name: Build and push frontend
        run: |
          cd frontend
          docker build -t ${{ secrets.ACR_LOGIN_SERVER }}/taskproof-frontend:latest .
          docker push ${{ secrets.ACR_LOGIN_SERVER }}/taskproof-frontend:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Azure VM
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VM_HOST }}
          username: ${{ secrets.VM_USER }}
          key: ${{ secrets.VM_SSH_KEY }}
          script: |
            cd /app
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml up -d
```

---

## Database Migrations

**Migration Tool:** node-pg-migrate

**Initial Migration (001_initial_schema.sql):**
```sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(50) NOT NULL UNIQUE,
  logo_url VARCHAR(500),
  primary_color VARCHAR(7),
  storage_used_bytes BIGINT DEFAULT 0,
  storage_limit_bytes BIGINT DEFAULT 10737418240,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_organizations_subdomain ON organizations(subdomain);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'project_manager', 'field_user')),
  is_active BOOLEAN DEFAULT true,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_org_email ON users(organization_id, email);
CREATE INDEX idx_users_role ON users(role);

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  start_date DATE,
  target_completion_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_org_status ON projects(organization_id, status);
CREATE INDEX idx_projects_dates ON projects(start_date, target_completion_date);

-- Blueprints table
CREATE TABLE blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  width_pixels INT,
  height_pixels INT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_blueprints_project ON blueprints(project_id);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'verified')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  trade VARCHAR(50),
  location_x FLOAT,
  location_y FLOAT,
  assigned_to_user UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_contractor_email VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  verified_at TIMESTAMP
);

CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_user, status);
CREATE INDEX idx_tasks_contractor ON tasks(assigned_to_contractor_email);
CREATE INDEX idx_tasks_trade ON tasks(trade, status);

-- Full-text search on tasks
CREATE INDEX idx_tasks_search ON tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Task photos table
CREATE TABLE task_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_url VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  thumbnail_url VARCHAR(500),
  caption VARCHAR(500),
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_photos_task ON task_photos(task_id);

-- Task comments table
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  external_email VARCHAR(255),
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id, created_at);

-- Protocols table
CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  filters JSONB,
  file_url VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  generated_by UUID REFERENCES users(id),
  generated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_protocols_project ON protocols(project_id, generated_at);

-- Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org_time ON audit_log(organization_id, created_at);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at);

-- Password reset tokens table
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_reset_tokens_expiry ON password_reset_tokens(expires_at);

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Migration Execution:**
```bash
# Run migrations
npm run migrate up

# Rollback last migration
npm run migrate down

# Create new migration
npm run migrate create add_column_name
```

---

## Testing Requirements

### Backend Unit Tests
**Framework:** Jest + Supertest
**Coverage Target:** 80%+

**Test Categories:**
1. **Authentication tests** (auth.test.js)
   - Valid login returns JWT
   - Invalid credentials return 401
   - Expired token returns 401
   - Password reset flow completes successfully
   - Rate limiting blocks after 5 failed attempts

2. **Authorization tests** (authorization.test.js)
   - Org Admin can access own org resources only
   - Field User cannot delete projects
   - Super Admin can access all organizations

3. **Task CRUD tests** (tasks.test.js)
   - Create task with valid data succeeds
   - Update task status triggers notifications
   - Delete task removes associated photos
   - Filter tasks by trade returns correct results

4. **File upload tests** (uploads.test.js)
   - Presigned URL generation works
   - File size validation rejects >10 MB photos
   - Invalid MIME types rejected

5. **Protocol generation tests** (protocols.test.js)
   - PDF generation includes filtered tasks
   - Grouping by trade produces correct sections
   - Empty filters generate all tasks

### Frontend Unit Tests
**Framework:** Jest + React Testing Library
**Coverage Target:** 70%+

**Test Categories:**
1. **Component tests**
   - TaskForm validates required fields
   - BlueprintViewer renders markers correctly
   - AdminDashboard displays statistics

2. **Integration tests**
   - Login flow stores JWT cookie
   - Task creation uploads photo and creates task
   - Offline task queues and syncs when online

### E2E Tests
**Framework:** Playwright
**Critical Paths:**
1. User registration → project creation → task creation → protocol generation
2. Task assignment → contractor email → reply via email → status update
3. Offline task creation → connectivity restored → sync confirmation

---

## Performance Requirements

### Response Time Targets
- API endpoints: <200ms (p95)
- Database queries: <50ms (p95)
- Page load time: <2 seconds (First Contentful Paint)
- Blueprint rendering: <1 second for 2000x3000px image

### Scalability Targets
- 100 concurrent users per organization instance
- 1000 tasks per project
- 50 MB protocol PDF generation in <15 seconds
- 10,000 total users across all organizations at launch

### Resource Optimization
- Image thumbnails: 200x200px for task photos
- Blueprint thumbnails: 300x400px for list views
- Photo compression: JPEG quality 85
- Database connection pooling: min 2, max 10 per backend instance
- Azure Blob Storage lifecycle: Configurable retention for backups (default 30 days)

---

## Monitoring & Observability

### Application Metrics
- Request rate (requests/minute)
- Error rate (errors/minute)
- Response time (p50, p95, p99)
- Queue depth (offline sync queue)

### Business Metrics (Admin Dashboard)
- Daily Active Users (DAU)
- Tasks created per day
- Tasks completed per day
- Average task resolution time
- Protocol generation count
- Storage utilization trend

### Alerts
- Error rate >1% for 5 minutes → PagerDuty
- Response time p95 >500ms for 10 minutes → Slack
- Database connection pool exhausted → PagerDuty
- Storage utilization >90% → Email admin
- Failed login rate >100/hour → Security alert

### Logging Standards
**Log Levels:**
- ERROR: System failures, unhandled exceptions
- WARN: Degraded performance, retry attempts
- INFO: User actions, API requests
- DEBUG: Detailed execution flow (dev only)

**Structured Log Format:**
```json
{
  "timestamp": "2026-02-11T10:30:00Z",
  "level": "INFO",
  "service": "backend",
  "requestId": "uuid",
  "userId": "uuid",
  "organizationId": "uuid",
  "message": "Task created",
  "metadata": {
    "taskId": "uuid",
    "projectId": "uuid"
  }
}
```

---

## Success Metrics

### Leading Indicators (Track Weekly)
1. **User Activation Rate:** % of invited users who create first task within 7 days (Target: >80%)
2. **Task Creation Rate:** Tasks created per active user per week (Target: >5)
3. **Photo Attachment Rate:** % of tasks with at least 1 photo (Target: >70%)
4. **Protocol Generation Frequency:** Protocols generated per project per week (Target: >1)

### Lagging Indicators (Track Monthly)
1. **Task Completion Rate:** % of tasks completed within 14 days (Target: >85%)
2. **User Retention:** % of users active in month 2 who were active in month 1 (Target: >90%)
3. **Customer Churn:** % of organizations who cancel within 6 months (Target: <10%)
4. **Time Savings:** Average reduction in punch list creation time vs baseline (Target: 70% reduction)

### Qualitative Metrics (Survey Quarterly)
1. **Net Promoter Score (NPS):** "How likely are you to recommend this platform?" (Target: >50)
2. **Feature Satisfaction:** 5-point scale ratings for key features (Target: >4.0 average)
3. **Support Ticket Volume:** Tickets per 100 active users (Target: <5)

---

## Open Questions

1. **[Engineering]** Should we implement real-time updates via WebSockets for task status changes, or is polling every 30 seconds sufficient for MVP?
   - Tradeoff: WebSockets add complexity but improve UX for teams monitoring same project simultaneously

2. **[Design]** What level of blueprint annotation should be supported beyond simple pin drops? (Free-hand drawing, shapes, measurement tools)
   - Impacts development timeline by 2-4 weeks if full annotation suite required

3. **[Product]** Should external contractors be able to upload photos when marking tasks complete via email, or require them to create accounts for photo uploads?
   - Email attachment parsing adds complexity; account creation reduces friction

4. **[Legal]** What data retention policy should apply to archived projects? (1 year, 3 years, indefinite)
   - Impacts storage costs and compliance requirements

5. **[Business]** Should pricing tier limits be enforced (storage, users, projects) in the application code, or handled externally via sales/billing?
   - Determines whether to build quota enforcement into MVP

6. **[Engineering]** Should we use PostgreSQL full-text search or integrate Elasticsearch for task/project search?
   - Elasticsearch better performance but adds operational complexity and cost

7. **[Security]** Should we implement IP whitelisting for organization admins to restrict login access to office networks?
   - Requested by enterprise prospects but conflicts with field usage

---

## Timeline Considerations

### Phase 1: MVP (Completed)
**Deliverables:**
- User authentication and role-based access
- Project and task CRUD operations
- Blueprint viewer with location marking
- Photo uploads with thumbnail generation
- Email notifications for task assignments
- Basic protocol generation (PDF with task list)
- Admin dashboard with usage statistics
- Responsive web UI (mobile-optimized)
- Deployed to Azure VM with Docker Compose

### Phase 2: Enhancement (Completed)
**Deliverables:**
- Product catalog with Excel import/export
- Custom fields system with visual form builder
- Task numbering and blueprint annotations (redlining)
- Multiple draggable markers on blueprints
- Protocol PDF signing with public access tokens
- Blueprint PDF embedding in protocol reports
- Project notes feature
- User profile management (name, email, password)
- My Tasks page and admin task report
- Database backup system (manual + scheduled, full + selective restore)
- Bug reporter with admin management page
- Inline task editing
- Organization logo upload with branding
- SSL and custom domains (taskproof.work)
- Bulk user import from Excel

### Phase 3: Scale (Future)
**Deliverables:**
- PWA offline capabilities with sync
- Contractor email reply parsing
- Multi-tenant architecture migration
- SSO (SAML/OAuth) integration
- Advanced analytics dashboard
- API for third-party integrations
- Performance optimization and load testing

**Dependencies:**
- Single-tenant deployment on Azure (Week 1) ✅
- Design mockups approval (Week 2) ✅
- Database schema finalization (Week 2) ✅

### Hard Deadlines
- **None specified** - MVP launch when feature-complete and stable

### Phasing Considerations
- MVP and Phase 2 are complete and in production
- Phase 3 deferred until user feedback and demand validated
- Offline PWA support is the highest-priority Phase 3 item for field users

---

## Appendix: Implementation Status

**Last Updated:** 2026-02-15
**Overall Status:** Production — deployed and live at https://taskproof.work. All MVP features plus significant post-MVP enhancements implemented.

### Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation & Infrastructure | Done |
| 2 | Authentication System | Done |
| 3 | Core Domain (Projects, Tasks, Comments) | Done |
| 4 | File Handling (Azure Blob Storage, Blueprints, Photos, Thumbnails) | Done |
| 5 | Email & Protocol PDF Generation | Done |
| 6 | Frontend Auth & App Shell | Done |
| 7 | Frontend Core Pages (Projects, Tasks, Comments, Users) | Done |
| 8 | Frontend File Upload & Blueprint Viewer | Done |
| 9 | Admin Dashboard, Protocol UI & Polish | Done |
| 10 | MinIO Presigned URL Fix (dev environment) | Done |
| 11 | Local Filesystem Storage Provider | Done |
| 12 | User Profile & Password Management | Done |
| 13 | Product Catalog & Task-Product Linking | Done |
| 14 | Task Numbering & Blueprint Annotation (Redlining) | Done |
| 15 | Custom Fields System (Visual Form Builder) | Done |
| 16 | User Card Management & Inline Protocol Report | Done |
| 17 | Task Sorting & Blueprint Protection | Done |
| 18 | My Tasks Page, Admin Task Report, Contractor Assignment | Done |
| 19 | Protocol PDF Signing (Token-based Public Access) | Done |
| 20 | Project Notes & Blueprint PDF Embedding in Protocols | Done |
| 21 | Migration to Azure & Database Backup System | Done |
| 22 | SSL & Custom Domains (taskproof.work) | Done |
| 23 | Bug Reporter Library & Admin Bug Reports Page | Done |
| 24 | Product Excel Import/Export & Blueprint Delete Confirmation | Done |
| 25 | Inline Task Editing (Title, Description, Priority, Trade) | Done |
| 26 | Multiple Draggable Markers for Blueprint Annotations | Done |
| 27 | Bulk User Import from Excel | Done |
| 28 | Selective Backup Restore (Full or Per-Table) | Done |

### Architecture Summary

- **Backend:** Express.js/TypeScript with 15+ route modules, JWT auth (HttpOnly cookies), bcrypt, Zod validation, Pino logging, Helmet security headers, rate limiting, node-cron for scheduled backups
- **Frontend:** React 18/TypeScript with Vite, Tailwind CSS, React Query, Zustand, React Router v7, pdfjs-dist for PDF rendering
- **Database:** PostgreSQL 16 with 18+ tables, triggers, indexes, node-pg-migrate migrations
- **Storage:** Dual-mode storage provider (local filesystem for dev, Azure Blob Storage for production) — switchable via `STORAGE_PROVIDER` env var
- **Email:** Nodemailer with Mailhog (dev) / SMTP (prod), HTML+text email templates
- **PDF:** PDFKit-based protocol generation with trade-grouped task tables, blueprint embedding, signing support
- **Testing:** 123 backend tests across 11 suites (Jest + Supertest), all passing
- **Deployment:** Azure VM with Docker Compose, ACR, SSL via Let's Encrypt

### Post-MVP Features Implemented

**User Profile Page:**
- Users can edit their own first name, last name, and email
- Password change with current password verification

**Product Catalog:**
- Full CRUD for products (article number, name, description, unit, price, category)
- Link products to tasks with quantity tracking
- Excel import/export for bulk product management
- Template download for standardized imports

**Task Numbering & Annotations:**
- Auto-incrementing task numbers per project (e.g., #001, #002)
- Blueprint annotation/redlining: tasks store annotation coordinates (x, y, width, height, page)
- Multiple draggable markers on blueprints for precise positioning

**Custom Fields System:**
- Visual Google Forms-style form builder for organization admins
- Field types: text, number, select, multi-select, date, checkbox
- Fields attached to tasks with per-task values
- Drag-and-drop ordering of fields

**Protocol Enhancements:**
- Blueprint PDF pages embedded in protocol reports
- Protocol PDF signing with token-based public access URLs
- Inline protocol report view with PDF export (dom-to-image-more)

**Project Notes:**
- Rich text notes per project
- Notes displayed on project detail page

**Admin Features:**
- My Tasks page: filterable personal task dashboard
- Admin task report: organization-wide task statistics
- User card management
- Bug reporter: in-app bug reporting with screenshot capture
- Bug reports admin page with status management
- Bulk user import from Excel with template download

**Database Backup System:**
- Manual and scheduled (cron-based) database backups
- Backups stored in Azure Blob Storage
- Configurable retention period (auto-cleanup of expired backups)
- Full restore or selective per-table restore
- Download backup archives
- Backup settings with schedule configuration

**Organization Branding:**
- Logo upload with thumbnail generation (Azure Blob Storage image upload, not URL field)
- Logo displayed in protocols and app header

**Infrastructure:**
- Migrated from AWS to Azure (VM + Blob Storage + ACR)
- SSL certificates via Let's Encrypt
- Custom domains: taskproof.work + api.taskproof.work
- App rebranded as TaskProof

### Key Implementation Details

**Local Storage Provider:**
The development environment stores files on the backend's local filesystem instead of requiring Azure Blob Storage. The frontend is unchanged — it receives presigned URLs pointing to the backend itself:
- Upload: JWT-signed token in URL → `PUT /api/v1/storage/upload/{token}` → saves to `./uploads/`
- Download: Base64url-encoded key → `GET /api/v1/storage/files/{key}` → serves from `./uploads/`
- Switch to Azure Blob: set `STORAGE_PROVIDER=azure` and configure `AZURE_STORAGE_CONNECTION_STRING`

**Blueprint PDF Support:**
Blueprints can be JPG, PNG, or PDF. PDF blueprints render via pdfjs-dist in the viewer. Image blueprints support zoom/pan/markers. The Nginx Dockerfile patches `.mjs` MIME types to support pdfjs-dist worker files.

**Seed Data (all passwords: `Password123!`):**

| Email | Role |
|-------|------|
| super@demo.com | super_admin |
| admin@demo.com | org_admin |
| pm@demo.com | project_manager |
| field@demo.com | field_user |
| field2@demo.com | field_user |

### Deferred to Future

- PWA manifest and service worker (offline support)
- IndexedDB offline task queue
- Contractor email reply parsing (webhook)
- SSO (SAML/OAuth)
- WebSocket real-time updates
- Sentry error tracking
- Playwright E2E tests
- Load testing
- Accessibility audit
- Multi-tenant architecture migration

---

## Appendix: Development Checklist

### Backend Implementation
- [x] Initialize Node.js TypeScript project with Express
- [x] Configure ESLint, Prettier, and TypeScript compiler
- [x] Set up PostgreSQL connection with pg-pool
- [x] Implement JWT authentication middleware
- [x] Create database migration scripts (node-pg-migrate)
- [x] Build user authentication endpoints (register, login, reset)
- [x] Build user management endpoints (CRUD with role checks)
- [x] Build project endpoints (CRUD with authorization)
- [x] Build blueprint upload flow (presigned URLs)
- [x] Build task endpoints (CRUD with filtering)
- [x] Build task photo upload flow
- [x] Build task comment endpoints
- [x] Build protocol generation service (PDF library)
- [x] Build admin statistics endpoints
- [x] Configure Azure Blob Storage SDK for file operations
- [x] Configure SMTP email sending (Mailhog for dev)
- [x] Implement email templates (task assignment, password reset)
- [ ] Create email webhook endpoint for contractor replies (deferred)
- [x] Add rate limiting middleware
- [x] Add request logging middleware
- [x] Add error handling middleware
- [x] Implement health check endpoints
- [x] Write unit tests for auth logic
- [x] Write unit tests for authorization checks
- [x] Write unit tests for task business logic
- [x] Write integration tests for API endpoints
- [ ] Configure Sentry error tracking (deferred)
- [x] Create Dockerfile for backend
- [x] Build product catalog endpoints (CRUD, Excel import/export)
- [x] Build custom fields endpoints (form builder, values)
- [x] Build backup system (create, restore, schedule, download)
- [x] Build bug reports endpoints
- [x] Build project notes endpoints
- [x] Build protocol signing with public access tokens
- [x] Build user profile update and password change endpoints
- [x] Build bulk user import from Excel

### Frontend Implementation
- [x] Initialize React TypeScript project with Vite
- [x] Configure Tailwind CSS
- [x] Set up React Router for navigation
- [x] Implement authentication context (JWT storage)
- [x] Build login page
- [x] Build registration page
- [x] Build password reset flow
- [x] Build user management page (admin)
- [x] Build organization settings page (admin)
- [x] Build project list page
- [x] Build project creation form
- [x] Build project detail page
- [x] Build task list with filtering
- [x] Build task creation form with photo upload
- [x] Build task detail page with comments
- [x] Build blueprint viewer component (zoom, pan, markers)
- [x] Build protocol generator interface
- [x] Build admin dashboard with statistics
- [ ] Implement PWA manifest and service worker (deferred)
- [ ] Implement offline task queue with IndexedDB (deferred)
- [x] Add loading states and error handling
- [x] Add form validation
- [ ] Write component tests
- [ ] Write integration tests for critical flows
- [ ] Optimize bundle size (code splitting)
- [ ] Add accessibility attributes (ARIA labels)
- [x] Create Dockerfile for frontend (Nginx)
- [x] Test responsive design on mobile devices
- [x] Build user profile page (name/email editing, password change)
- [x] Build product catalog page (CRUD, Excel import/export)
- [x] Build custom fields form builder (drag-drop, visual editor)
- [x] Build My Tasks page (personal task dashboard)
- [x] Build admin task report page
- [x] Build backup management page (create, restore, schedule, settings)
- [x] Build bug reporter component (in-app reporting with screenshots)
- [x] Build bug reports admin page
- [x] Build project notes interface
- [x] Build inline task editing (title, description, priority, trade)
- [x] Build multiple draggable blueprint markers
- [x] Build protocol signing and public access view
- [x] Build selective backup restore (full vs per-table)

### Database Implementation
- [x] Write initial migration (001_initial_schema.sql)
- [x] Add database triggers for updated_at columns
- [x] Create indexes for common queries
- [x] Set up automated backup system (manual + scheduled, stored in Azure Blob Storage)
- [x] Create seed data script for development
- [x] Implement selective backup restore (full or per-table)
- [x] Add migrations for products, custom fields, backups, bug reports, project notes tables
- [ ] Test migration rollback procedures

### DevOps Implementation
- [x] Create Azure account and configure credentials
- [x] Set up Azure Container Registry (ACR)
- [x] Create Azure Blob Storage container with encryption
- [x] Configure SMTP for email sending
- [x] Write docker-compose.yml for local development
- [x] Write docker-compose.prod.yml for Azure VM deployment
- [x] Configure SSL certificates (Let's Encrypt) for taskproof.work and api.taskproof.work
- [x] Set up Nginx reverse proxy with SSL termination
- [x] Create GitHub Actions CI/CD workflow
- [x] Test disaster recovery procedures (backup and restore)
- [ ] Set up monitoring/alerting for critical metrics
- [ ] Document deployment process

### Testing & Quality Assurance
- [x] Manual test: User registration and login
- [x] Manual test: Project creation and task workflow
- [x] Manual test: Blueprint upload and marker placement
- [x] Manual test: Photo upload and thumbnail generation
- [x] Manual test: Protocol PDF generation
- [x] Manual test: Email notifications sending (via Mailhog)
- [x] Manual test: Admin user management
- [ ] Manual test: Offline task creation and sync (deferred to post-MVP)
- [x] Manual test: Responsive design on mobile
- [ ] Playwright E2E test: Complete user journey
- [ ] Load test: 100 concurrent users creating tasks
- [x] Security test: SQL injection attempts (parameterized queries)
- [x] Security test: XSS attempts (input sanitization)
- [x] Security test: JWT manipulation
- [ ] Accessibility audit with axe DevTools

---

## Conclusion

This specification provides a complete blueprint for building a modern, cloud-native construction management platform. The architecture prioritizes simplicity for MVP launch while maintaining flexibility for future enhancements. Key design decisions include single-tenant deployment for customer isolation, PostgreSQL for reliability, and Progressive Web App approach for cross-platform compatibility without native app complexity.

**Current Status:** Production — live at https://taskproof.work. The platform is fully deployed on Azure infrastructure with SSL, custom domains, and automated database backups. All MVP features plus significant post-MVP enhancements are implemented, including product catalog, custom fields, protocol signing, bug reporting, Excel import/export, selective backup restore, and multiple blueprint annotation markers.

**Next Steps:**
1. Gather user feedback from production usage
2. Implement PWA offline support based on field user needs
3. Add contractor email reply parsing for automated status updates
4. Evaluate SSO integration for enterprise customers
5. Performance optimization and load testing

---

**Document Version:** 2.0
**Last Updated:** 2026-02-15
**Prepared By:** J.A.R.V.I.S. Technical Specification System
**Prepared For:** Claude Code Implementation Team
