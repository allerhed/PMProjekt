# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Construction project management platform replacing paper-based workflows for task tracking, deficiency management, and protocol (report) generation. The full specification is in `construction-management-platform-spec.md`.

**Current state:** Specification only — no implementation code exists yet. The spec defines the complete technical architecture, database schema, API endpoints, and deployment model.

## Planned Technology Stack

- **Frontend:** React 18+ / TypeScript, Tailwind CSS, React Query, Zustand, React Router, PWA (service workers)
- **Backend:** Node.js 20 LTS / Express.js / TypeScript, JWT auth (HttpOnly cookies), bcrypt
- **Database:** PostgreSQL 16+ with pg-pool, node-pg-migrate for migrations
- **Storage:** Azure Blob Storage (SAS URLs for uploads/downloads)
- **Email:** SMTP via Nodemailer
- **Infrastructure:** Docker Compose (dev), Azure VM + ACR (prod)

## Planned Project Structure

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

## Development Commands (Once Implemented)

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

9 tables: `users`, `organizations`, `projects`, `blueprints`, `tasks`, `task_photos`, `task_comments`, `protocols`, `audit_log`, `password_reset_tokens`. All primary keys are UUIDs. Full schema with indexes is in the spec document under "Database Schema".

## Key Constraints from Spec

- bcrypt cost factor: 12
- Password reset tokens expire in 1 hour
- Blueprint coordinates normalized 0-1 (location_x, location_y on tasks)
- Protocol PDFs generated server-side and stored in Azure Blob Storage
- Storage limit tracked per organization (default 10 GB)
- Target: API p95 < 200ms, page load FCP < 2s, PDF generation < 15s
