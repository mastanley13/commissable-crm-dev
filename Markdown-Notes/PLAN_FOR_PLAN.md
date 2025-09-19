I scanned the Markdown-Notes and current plans to align priorities. Here’s a clear, execution-ready order focused on themes and the exact files to work in.

### 0) Establish a single source of truth (start here)
- Files:
  - Primary: `Markdown-Notes/COMPREHENSIVE_MILESTONE_1_PRODUCTION_PLAN.md`
  - Gatekeepers: `Markdown-Notes/CONTRACT_COMPLIANCE_REVIEW.md`, `Markdown-Notes/Missing_Considerations.md`
  - Archive/reference: `Markdown-Notes/MILESTONE_1_COMPLETION_PLAN.md`, `Markdown-Notes/Core Foundation Specifications - Milestone 1.txt`, `Markdown-Notes/Executive Summary - Commissable and Strategix AI Overview.txt`
- Actions:
  - Declare the “Comprehensive” plan as canonical.
  - Keep “Contract Compliance” and “Missing Considerations” as live checklists.
  - Mark the older completion plan as reference-only to avoid drift.

### 1) Infra + DB foundation (Prisma + Cloud SQL Proxy)
- Files:
  - `prisma/schema.prisma` (complete Tenants, AccountTypes, Users, Accounts, Contacts, Groups, Activities, TablePreferences, AuditLogs)
  - `.env` (local only), `package.json` (add scripts), `next.config.mjs`
  - Reference: `Markdown-Notes/GoogleCloudIdeas.md`
- Actions:
  - Finalize schema + indexes for performance requirements.
  - Plan local dev connection via proxy; set migration and generate routines.

### 2) AuthN + RBAC baseline
- Files:
  - `app/api/auth/[...nextauth]/route.ts` (create)
  - `lib/rbac.ts` (create), `middleware.ts` (route guards), `Markdown-Notes/COMPREHENSIVE_MILESTONE_1_PRODUCTION_PLAN.md` (Auth section)
- Actions:
  - Implement 4 roles and session timeout rules.
  - Define resource/action matrix for Accounts/Contacts first.

### 3) Cross-cutting concerns (before APIs)
- Files:
  - `lib/api-utils.ts` (centralized error handling), `lib/validation/*` (zod schemas), `lib/audit.ts` (audit writer)
  - `Markdown-Notes/Missing_Considerations.md` (security items to track)
- Actions:
  - Add validation for email/phone/url/state/zip.
  - Wire audit logging helper (user, tenant, IP, UA, session).

### 4) Core APIs: Accounts and Contacts (CRUD + RBAC + Audit)
- Files:
  - `app/api/accounts/route.ts`, `app/api/accounts/[id]/route.ts`
  - `app/api/contacts/route.ts`, `app/api/contacts/[id]/route.ts`
- Actions:
  - Enforce tenant scoping and salesperson ownership filtering.
  - Contacts auto-populate from Account; record audits.

### 5) Table Preferences system (contract dynamic tables)
- Files:
  - `app/api/table-preferences/[pageType]/route.ts` (create)
  - `components/dynamic-table.tsx`, `components/list-header.tsx`, `hooks/useTablePreferences.ts` (create)
  - Reference: `Markdown-Notes/TABLE_CUSTOMIZATION_IMPLEMENTATION.md`
- Actions:
  - Implement show/hide, reorder, resize (80–400px), sort/filter persistence per user/page.

### 6) Detail pages with tabs (Accounts, Contacts)
- Files:
  - `app/(dashboard)/accounts/[id]/page.tsx` (+ child tab components)
  - `app/(dashboard)/contacts/[id]/page.tsx`
- Actions:
  - Inline edit + 2s auto-save; copy shipping→billing; tabs: Contacts/Opportunities/Groups/Activities.
  - “Map integration ready” placeholder component and props.

### 7) Supporting APIs: Groups and Activities
- Files:
  - `app/api/groups/route.ts`, `app/api/groups/[id]/route.ts`
  - `app/api/activities/route.ts`, `app/api/activities/[id]/route.ts`
- Actions:
  - Group membership management; Activities timeline with allowed types.

### 8) Import/Export (role-dependent) + CSV templates
- Files:
  - `app/api/accounts/export/route.ts`, `app/api/contacts/export/route.ts`
  - `lib/import-export.ts`, templates under `public/templates/*`
- Actions:
  - Restrict to Admin/SalesManagement; generate CSV templates per spec.

### 9) Performance, security hardening, and ops
- Files:
  - `middleware.ts` (security headers, basic rate limits)
  - Logging: `lib/logger.ts`; Error tracking config (e.g., Sentry)
  - Tests: `tests/performance.test.ts`, `tests/rbac.test.ts`, `tests/validation.test.ts`
  - Reference: `Markdown-Notes/Missing_Considerations.md`
- Actions:
  - Index review, pagination caps, connection pooling.
  - Security headers/CORS, copy-protection for Accounting, monitoring hooks.

### 10) Acceptance testing + docs
- Files:
  - `Markdown-Notes/COMPREHENSIVE_MILESTONE_1_PRODUCTION_PLAN.md` (acceptance checklist)
  - User docs under `Markdown-Notes/*` (Accounts, Contacts, CSV usage)
- Actions:
  - Execute contract test matrix (performance, RBAC, audit, UX).
  - Finalize user docs for Milestone 1 sign-off.

### Work-in-progress limits (recommendation)
- Parallel tracks: 2 max (Backend API + Table Preferences), then UI detail pages.
- “Done” criteria: code + tests + docs + acceptance box checked in the canonical plan.

- Canonicalize plan docs, then DB/Auth/RBAC, then core APIs, then tables, then detail pages, then supporting APIs, then import/export, then perf/security/testing, then docs/sign-off.