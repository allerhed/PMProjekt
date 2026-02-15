# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Construction project management platform replacing paper-based workflows for task tracking, deficiency management, and protocol (report) generation. The full specification is in `construction-management-platform-spec.md`.

**Current state:** Implemented and deployed to production at https://taskproof.work.

## Planned Technology Stack

- **Frontend:** React 18+ / TypeScript, Tailwind CSS, React Query, Zustand, React Router, PWA (service workers)
- **Backend:** Node.js 20 LTS / Express.js / TypeScript, JWT auth (HttpOnly cookies), bcrypt
- **Database:** PostgreSQL 16+ with pg-pool, node-pg-migrate for migrations
- **Storage:** Azure Blob Storage (SAS URLs for uploads/downloads)
- **Email:** SMTP via Nodemailer
- **Infrastructure:** Docker Compose (dev), Azure VM + ACR (prod)

## Project Structure

```
frontend/          # React app served via Nginx container
  src/components/  # React components
  src/pages/       # Page-level components
  src/context/     # Auth context and state
  src/services/    # API client
backend/           # Express.js API server
  src/routes/      # API endpoint handlers
  src/middleware/   # Auth, validation, rate limiting
  src/services/    # Business logic layer
  src/models/      # Database models
  src/config/      # Configuration
  migrations/      # PostgreSQL migrations (node-pg-migrate)
database/          # init.sql for schema setup
```

## Development Commands

```bash
# Start all services
docker-compose up

# Backend
cd backend && npm install
npm run dev          # Development server with hot reload
npm test             # Jest + Supertest
npm run lint         # ESLint

# Frontend
cd frontend && npm install
npm run dev          # Vite dev server
npm test             # Jest + React Testing Library
npm run build        # Production build
```

## Architecture Decisions

- **Three-container deployment:** frontend (Nginx), backend (Node.js on port 3000), database (PostgreSQL on port 5432). All communicate over internal Docker network.
- **Single-tenant SaaS:** Multi-organization support with tenant isolation via `organization_id` on all data tables.
- **Four user roles** with hierarchical permissions: `super_admin` > `org_admin` > `project_manager` > `field_user`.
- **External contractors** interact via email only — no accounts required. Contractor replies are parsed and added as task comments.
- **File uploads** use Azure Blob SAS URLs (client uploads directly to Azure Blob Storage, not through the backend). Allowed types: JPG, PNG, PDF only.
- **JWT stored in HttpOnly cookies** (not localStorage). 7-day expiry with refresh at 50% lifetime.
- **Offline-first PWA:** Field users can create/edit tasks offline; changes sync automatically when connectivity returns.

## API Conventions

- Base path: `/api/v1`
- All responses use envelope format: `{ success, data, error, meta: { timestamp, requestId } }`
- Pagination via `?page=1&limit=50` query params
- Rate limits: 100 req/min general, 5 req/min for auth endpoints

## Database Schema

10 tables: `users`, `organizations`, `projects`, `blueprints`, `tasks`, `task_photos`, `task_comments`, `protocols`, `audit_log`, `password_reset_tokens`, `bug_reports`. All primary keys are UUIDs. Full schema with indexes is in the spec document under "Database Schema".

## Key Constraints from Spec

- bcrypt cost factor: 12
- Password reset tokens expire in 1 hour
- Blueprint coordinates normalized 0-1 (location_x, location_y on tasks)
- Protocol PDFs generated server-side and stored in Azure Blob Storage
- Storage limit tracked per organization (default 10 GB)
- Target: API p95 < 200ms, page load FCP < 2s, PDF generation < 15s

## Known Pitfalls

### Bug Reporter library is designed to be portable

The bug reporter lives in `frontend/src/lib/bug-reporter/` and is intentionally isolated — its core types have zero app imports. The library exports `BugReporterProvider`, `useBugReporter`, `BugReportButton`, and `BeetleIcon`. The app integrates it in `AppLayout.tsx` by wrapping the layout in `<BugReporterProvider>` and bridging `onSubmit` to the app's API layer. If extracting to a separate package, only the `lib/bug-reporter/` directory is needed.

### Database migrations must match model interfaces

Every column referenced in a `backend/src/models/*.model.ts` interface **must** have a corresponding migration in `backend/migrations/`. The production database is managed exclusively by `node-pg-migrate` — there is no other mechanism to add columns.

When adding a new column to a model interface or writing code that reads/writes a column, always verify a migration exists for it. Past incidents where this was missed:

- `tasks.task_number` — referenced in task queries but missing from schema (migration `008`)
- `tasks.annotation_x/y/width/height/page` — referenced in task creation but missing (migration `009`)
- `organizations.logo_thumbnail_url` — referenced by confirm-logo endpoint but missing (migration `010`)

**Checklist when adding new features:**
1. Add the column to the TypeScript interface in `backend/src/models/`
2. Create a numbered migration in `backend/migrations/` (e.g. `011_add-feature.js`)
3. Include both `exports.up` and `exports.down`
4. If backfilling existing rows, do it in the migration's `up` function

### Nginx `.mjs` MIME type for pdfjs-dist worker

The frontend uses `pdfjs-dist` for PDF/blueprint rendering. The library loads a web worker from a `.mjs` file (e.g. `pdf.worker-<hash>.mjs`). Nginx's default `mime.types` does not include `.mjs`, so it serves these files as `application/octet-stream`. Combined with the `X-Content-Type-Options: nosniff` security header, browsers refuse to execute the worker as a JavaScript module.

The fix is in `frontend/Dockerfile` — a `sed` command patches `/etc/nginx/mime.types` to register `.mjs` as `application/javascript`. If the Dockerfile is rewritten or the base image changes, ensure this patch is preserved.

