# Production Readiness Action Plan

Date: 2026-03-23

Related audit: `audits/2026-03-23-production-readiness-audit.md`

Goal: turn the audit findings into a practical delivery plan that reduces production risk in the right order.

Guiding rule: fix tenant/security boundary issues first, then permission consistency, then durability and platform hardening.

## Phase 1: Quick Wins This Week

These are the highest-value changes that should happen first because they directly reduce exposure.

### 1. Disable or lock down public registration

What to do:

- Remove open self-registration from production.
- Replace it with invite-only onboarding or admin-created users.
- Stop accepting client-supplied `tenantId` and `roleId` in public-facing auth flows.

Why this matters:

- This closes one of the biggest tenant-boundary risks immediately.

Definition of done:

- `/api/auth/register` is either disabled in production or protected by an invite token / admin flow.
- New users cannot choose their own tenant or role.

### 2. Protect every currently public tenant-data endpoint

What to do:

- Add auth and permission checks to:
  - `/api/users`
  - `/api/accounts/options`
  - `/api/products/options`
  - `/api/products/master-data`
  - `/api/__dbcheck`
- Remove any fallback tenant resolution from these routes.

Why this matters:

- This prevents anonymous access to internal data and closes easy information leaks.

Definition of done:

- All tenant-scoped API routes require auth.
- Tenant identity always comes from the authenticated user context, not query params or fallback logic.

### 3. Remove write behavior from unauthenticated `GET` routes

What to do:

- Remove `ensureNoneDirectDistributorAccount` from public product option loading.
- Remove `ensureCanonicalAccountTypes` from public account option loading.
- Move those repairs into migrations, admin-only maintenance flows, or controlled startup jobs.

Why this matters:

- `GET` requests should not mutate data.
- This reduces abuse risk and makes the system easier to reason about.

Definition of done:

- Public or read-only routes no longer create, update, reassign, or delete records.

### 4. Fix the product permission bug

What to do:

- Remove `products.read` from all write authorization checks.
- Use explicit permission checks for create, update, and delete actions.

Why this matters:

- This is a direct privilege-escalation bug.

Definition of done:

- Read-only users can no longer create or delete products.
- Permission tests exist for product create/update/delete behavior.

### 5. Remove auth/debug logging from production paths

What to do:

- Remove token-preview and cookie-debug logs from login and auth-check routes.
- Remove partial session token values from audit metadata if not strictly required.

Why this matters:

- Lowers log sensitivity and reduces security noise.

Definition of done:

- Auth routes log only necessary operational/audit information.

## Phase 2: Medium-Sized Refactors This Month

These changes take more coordination but should still happen before a production launch.

### 1. Add CSRF protection for all cookie-authenticated mutations

What to do:

- Add CSRF tokens and validate them on state-changing requests.
- Also enforce trusted `Origin` and `Referer` checks where appropriate.
- Revisit whether `SameSite=None` is truly required.

Why this matters:

- Protects logged-in users from unwanted cross-site actions.

Definition of done:

- All mutating cookie-authenticated routes reject requests that fail CSRF checks.
- Cookie settings are aligned with real browser/session requirements.

### 2. Standardize route authorization patterns

What to do:

- Audit all write routes and convert inconsistent `withAuth` usage to `withPermissions` where business authorization is required.
- Focus first on tickets, reports, products, and other admin/data-management surfaces.
- Create a route-review checklist so future endpoints follow the same pattern.

Why this matters:

- The current issue is not only one bug; it is inconsistent authorization strategy.

Definition of done:

- All write routes use explicit permission checks unless there is a documented reason not to.
- Ticket and report routes have clear permission models.

### 3. Replace in-memory report storage with real persistence

What to do:

- Move reports from `lib/reports-store.ts` into the database.
- Add `tenantId`, creator metadata, timestamps, and permission-based access rules.
- Ensure reports survive restarts and deploys.

Why this matters:

- In-memory state is not production-safe for business data.

Definition of done:

- Reports are durable, tenant-scoped, and permissioned.
- Report CRUD works the same after restart or redeploy.

### 4. Add security headers at the app or platform layer

What to do:

- Add:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `Referrer-Policy`
  - `X-Content-Type-Options`
  - framing protection (`X-Frame-Options` or CSP `frame-ancestors`)
- Verify them in deployed responses, not just local config.

Why this matters:

- This is standard production hardening.

Definition of done:

- Security headers are present and validated in staging/production.

### 5. Strengthen release verification

What to do:

- Make critical integration tests part of CI.
- Ensure release pipelines fail if the highest-risk tests are skipped.
- Keep `build`, `lint`, and unit tests, but do not treat them as enough by themselves.

Why this matters:

- Passing builds are useful, but they are not enough for production confidence on complex reconciliation workflows.

Definition of done:

- CI runs representative integration coverage for auth, tenant boundaries, reconciliation, and imports.

## Phase 3: Deeper Architecture Improvements Later

These are the larger structural improvements that will make the system safer and easier to maintain long term.

### 1. Centralize tenant and authorization enforcement

What to do:

- Create a stricter server-side pattern where:
  - tenant context always comes from authenticated identity
  - permissions are required explicitly per route/action
  - fallback tenant resolution is allowed only in dev tooling, never in app runtime
- Reduce the chance that future endpoints accidentally bypass the rules.

Why this matters:

- The current problems are symptoms of authorization logic being too distributed and too easy to bypass.

Long-term result:

- Safer defaults and fewer route-by-route mistakes.

### 2. Separate maintenance/normalization work from customer request paths

What to do:

- Move auto-repair logic, canonicalization, and data-healing tasks into:
  - migrations
  - admin-only jobs
  - scheduled maintenance tasks
- Keep normal user APIs focused on serving requests, not quietly repairing state.

Why this matters:

- Production systems are more predictable when read paths stay read-only and maintenance tasks are explicit.

Long-term result:

- Fewer side effects, better observability, and lower operational risk.

### 3. Formalize security controls as part of platform architecture

What to do:

- Add a documented security baseline covering:
  - authentication/session policy
  - RBAC standards
  - CSRF standards
  - audit logging rules
  - security headers
  - internal-only health/admin endpoints
- Add recurring security review checkpoints for new modules.

Why this matters:

- This project has grown into a system where security can no longer live as scattered route-level decisions.

Long-term result:

- Security becomes part of the architecture, not just a cleanup item.

### 4. Expand production-readiness governance

What to do:

- Define a release checklist with required approvals for:
  - security review
  - integration test pass
  - migration review
  - rollback readiness
  - observability/alerting checks
- Add staging verification steps that mirror production usage.

Why this matters:

- Production readiness is partly code quality, but also process discipline.

Long-term result:

- Safer launches and fewer last-minute surprises.

## Suggested Delivery Order

### Week 1

- Disable public registration.
- Protect public tenant-data endpoints.
- Remove write-on-read behavior.
- Fix product RBAC bug.
- Remove auth debug logging.

### Weeks 2-4

- Add CSRF protection.
- Standardize route authorization patterns.
- Move reports to durable tenant-scoped storage.
- Add security headers.
- Expand CI to include critical integration coverage.

### Later

- Centralize auth/tenant enforcement.
- Move maintenance logic out of request paths.
- Formalize platform security standards.
- Add a full production release governance checklist.

## Recommended Ownership Split

- Security/authentication: registration, CSRF, session policy, security headers.
- API/backend: route authorization refactors, tenant enforcement cleanup, report persistence.
- QA/release: CI upgrades, integration test enforcement, release checklist.
- Product/admin workflow: invite-based onboarding and role assignment rules.

## Success Criteria

This project is much closer to production-ready when all of the following are true:

- Anonymous users cannot access tenant data or create accounts.
- Authenticated users can only perform actions their role explicitly allows.
- Cookie-authenticated mutations are protected against CSRF.
- Reports and other business records are durable and tenant-scoped.
- Staging/CI verifies the highest-risk workflows before release.
