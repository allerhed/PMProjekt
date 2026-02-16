# Remaining Implementation Plan

Remaining work from the spec, prioritized by impact. Items are grouped into phases.

---

## Phase A: Wire Up Email Notifications (High Priority) -- DONE

The email service (`sendEmail`) works, all 5 Handlebars templates exist, but only protocol signing actually sends. Four notification types need wiring.

### A1. Password reset email -- DONE
- **File:** `backend/src/services/auth.service.ts`
- **Change:** Replaced the TODO comment with `renderPasswordReset` + `sendEmail`, using `config.frontendUrl` + token.

### A2. User invitation email -- DONE
- **File:** `backend/src/routes/user.routes.ts`
- **Change:** After creating user, calls `renderUserInvitation` + `sendEmail` with org name, role, and login URL.

### A3. Task assignment email to contractor -- DONE
- **File:** `backend/src/routes/task.routes.ts`
- **Change:** After creating a task with `assignedToContractorEmail`, sends `renderTaskAssignment` email with project/task details.

### A4. Task completed email to project manager -- DONE
- **File:** `backend/src/routes/task.routes.ts`
- **Change:** When task status changes to `completed`, looks up the project creator (PM) and sends `renderTaskCompleted` email.

### A5. Add `FRONTEND_URL` config -- DONE
- **File:** `backend/src/config/index.ts`
- **Change:** Added `frontendUrl` from `FRONTEND_URL` env var (default `http://localhost:5173`).

### A6. Log login actions to audit log -- DONE
- **File:** `backend/src/routes/auth.routes.ts`
- **Change:** Added `logAuditAction` call on successful login so weekly stats can count logins.

---

## Phase B: Enhance Admin Stats (Medium Priority) -- DONE

### B1. Add `usersByRole` breakdown to stats -- DONE
- **File:** `backend/src/services/stats.service.ts`
- **Change:** Added query grouping active users by role. Added `usersByRole`, `taskCompletionRate` to `OrgStats`.

### B2. Add weekly activity metrics to stats -- DONE
- **File:** `backend/src/services/stats.service.ts`
- **Change:** Added audit_log query for past 7 days counting logins, tasks created, tasks completed. Added `weeklyLogins`, `weeklyTasksCreated`, `weeklyTasksCompleted` to `OrgStats`.

### B3. Add `GET /admin/users/activity` endpoint -- DONE
- **File:** `backend/src/routes/admin.routes.ts` + `backend/src/services/stats.service.ts`
- **Change:** New endpoint + `getUserActivity()` function returning per-user activity (login count, tasks created, tasks completed) from audit_log, filterable by `startDate`/`endDate`.

### B4. Enhance system health endpoint -- DONE
- **File:** `backend/src/routes/admin.routes.ts`
- **Change:** Added `storage.connected`, `storage.responseTimeMs` (pings Azure or checks local fs), and `activeUsers` (users with login in past 24h).

---

## Phase C: Frontend Config & Quality -- DONE

### C1. PWA manifest + service worker -- DONE
- **Files:** `frontend/vite.config.ts`, `frontend/index.html`, `frontend/public/pwa-*.png`
- **Change:** Added `vite-plugin-pwa` with Workbox service worker (precache static assets, NetworkFirst for API), web manifest, PWA meta tags, app icons.

### C2. Offline task queue (IndexedDB + background sync) -- DEFERRED
- Not implemented. Requires significant architectural work for offline-first with conflict resolution.

### C3. Code splitting (React.lazy / dynamic imports) -- DONE
- **File:** `frontend/src/App.tsx`
- **Change:** All 18 page components converted from static imports to `React.lazy()` with `<Suspense>` fallback. Each page now loads as a separate chunk.

### C4. Accessibility audit (ARIA labels) -- DONE
- **Files:** `Modal.tsx`, `Toast.tsx`, `Spinner.tsx`, `Sidebar.tsx`, `TopBar.tsx`
- **Changes:** Modal: `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-label="Close"`, Escape key handler. Toast: `role="alert"`/`role="status"`, `aria-live="polite"`. Spinner: `role="status"`, `aria-label="Loading"`. Sidebar: `aria-label="Main navigation"`. TopBar: `aria-label="Toggle navigation"`.

### C5. Frontend unit tests (Jest + RTL) -- DONE
- **53 tests across 6 suites**, all passing.
- Fixed Jest config: `setupFilesAfterEnv` (was `setupFilesAfterSetup`), `tsconfig.test.json` for CJS compat, `import.meta.env` handling, TextEncoder polyfill for react-router-dom v7.
- Test suites: Spinner, Button, Modal, Toast, authStore, LoginPage.

### C6. Playwright E2E tests -- DONE
- **Files:** `playwright.config.ts`, `e2e/auth.spec.ts`
- **Change:** Playwright configured with Chromium, auto-starts Vite dev server. E2E tests cover: login/register/forgot-password page rendering, protected route redirect, invalid login error display, auth page navigation, PWA manifest/meta tags.

---

## Phase D: Monitoring & Integrations (Lower Priority -- Deferred)

### D1. Sentry error tracking integration
### D2. Monitoring/alerting (PagerDuty/Slack)
### D3. Contractor email reply webhook
### D4. SSO (SAML/OAuth)
### D5. WebSocket real-time updates
