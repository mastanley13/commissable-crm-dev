# Production Readiness Audit

Date: 2026-03-23

Scope: application/API security, authorization, data isolation, operational readiness, persistence, and release gating.

Verdict: not production ready yet.

The codebase has a solid baseline in a few areas: `npm test`, `npm run build`, and `npm run lint` all passed during this audit. The main blockers are not compile failures. They are production-risk issues in access control, tenant isolation, CSRF exposure, public data surfaces, and a few non-durable or debug-oriented implementations that are still reachable in the live app.

## What I verified

- Read core auth, middleware, server utility, DB, storage, and representative API routes.
- Checked public and semi-public endpoints for auth and tenant isolation.
- Reviewed product, ticket, report, and account option flows for RBAC consistency.
- Ran `npm test`, `npm run build`, and `npm run lint`.

## Highest-Priority Findings

### 1. Public self-registration can create active users in arbitrary tenants

Severity: Critical

Evidence:

- `app/api/auth/register/route.ts:8-163` exposes a public `POST` handler that creates a user, activates the account immediately, creates a session, and returns authenticated user data.
- `app/api/auth/register/route.ts:18-19` accepts `tenantId` and `roleId` from the request body.
- `app/api/auth/register/route.ts:37` resolves the tenant through `resolveTenantId`.
- `lib/server-utils.ts:15-39` returns any explicit tenant id, then falls back to `DEFAULT_TENANT_ID`, then the first tenant in the database.

Impact:

- Anyone who can reach the endpoint can self-provision a user.
- A caller can target a specific tenant by passing `tenantId`.
- In a B2B multi-tenant CRM, this is a direct tenant boundary breach unless self-signup is intentionally part of the product and tightly controlled.

Required fix before production:

- Remove public registration entirely or gate it behind invite tokens / admin-only workflows.
- Ignore request-supplied `tenantId` and `roleId` for public flows.
- Delete development fallbacks from production code paths.

### 2. Multiple unauthenticated endpoints expose tenant data, and some perform writes on `GET`

Severity: Critical

Evidence:

- `app/api/users/route.ts:8-56` has no auth wrapper and returns users plus role metadata for any resolved tenant.
- `app/api/products/master-data/route.ts:8-52` has no auth wrapper and returns product families/subtypes for any resolved tenant.
- `app/api/products/options/route.ts:10-48` has no auth wrapper, resolves tenant from query string, and returns active vendor/distributor accounts plus revenue types.
- `app/api/products/options/route.ts:15` calls `ensureNoneDirectDistributorAccount` inside a public `GET`, so the route can mutate DB state without authentication.
- `app/api/accounts/options/route.ts:115-159` has no auth wrapper and returns account types, industries, parent accounts, active users, and default admin owner ids.
- `app/api/accounts/options/route.ts:119` calls `ensureCanonicalAccountTypes`, and `app/api/accounts/options/route.ts:28-113` shows that this `GET` can create, update, reassign, and delete account type records.
- `app/api/__dbcheck/route.ts:7-11` exposes database health publicly.
- All of the tenant-resolving routes above rely on `lib/server-utils.ts:15-39`.

Impact:

- Unauthenticated callers can enumerate users, owner ids, account names, product metadata, and system state.
- Public `GET` requests should not perform writes; that creates a CSRF and abuse surface even before authentication is considered.
- The DB health endpoint gives attackers a simple probe for environment and uptime state.

Required fix before production:

- Put these routes behind `withAuth` or `withPermissions`.
- Remove `resolveTenantId` fallback behavior from production routes.
- Move write-on-read normalization jobs out of public request handlers.
- Restrict health checks to internal infrastructure or protected admin routes.

### 3. Session cookies are configured for cross-site use, but mutating APIs have no CSRF protection

Severity: High

Evidence:

- `lib/auth.ts:240-248` sets the `session-token` cookie with `sameSite: 'none'` in production.
- `app/api/auth/login/route.ts:145-152` sets the same cookie attributes directly on login.
- `lib/api-auth.ts:23-46` authenticates requests by cookie/session token only.
- The auth wrapper does not validate `Origin`, `Referer`, or any CSRF token before calling mutating handlers.

Impact:

- With `SameSite=None`, browsers can send the session cookie on cross-site requests.
- Since mutation endpoints rely on cookie auth and do not perform CSRF checks, a malicious site can potentially drive authenticated actions from a victim browser.

Required fix before production:

- Prefer `SameSite=Lax` unless there is a hard cross-site requirement.
- Add CSRF protection for state-changing routes.
- At minimum, enforce trusted `Origin` / `Referer` on cookie-authenticated mutations.

### 4. Product mutation RBAC is incorrect: `products.read` grants create/delete access

Severity: High

Evidence:

- `app/api/products/route.ts:18-23` defines `PRODUCT_MUTATION_PERMISSIONS` and includes `"products.read"`.
- `app/api/products/route.ts:268-276` uses `hasAnyPermission(req.user, PRODUCT_MUTATION_PERMISSIONS)` to authorize product creation.
- `app/api/products/[productId]/route.ts:12-17` defines the same permission list.
- `app/api/products/[productId]/route.ts:600-607` uses the same `hasAnyPermission(...)` check for deletion.

Impact:

- A read-only product user can create and delete products.
- This is a direct privilege escalation inside an otherwise permissioned system.

Required fix before production:

- Split read and write permissions cleanly.
- Use `withPermissions` with only mutation scopes for POST/PATCH/DELETE.
- Add regression tests for permission matrices on create/update/delete.

### 5. Ticket creation/listing and report CRUD are under-protected; reports are also non-durable and not tenant-scoped

Severity: High

Evidence:

- `app/api/tickets/route.ts:273-319` allows ticket creation with `withAuth` only.
- `app/api/tickets/route.ts:493-510` allows ticket listing with `withAuth` only.
- `app/api/reports/route.ts:24-40` lists reports with `withAuth` only.
- `app/api/reports/route.ts:123-140` creates reports with `withAuth` only.
- `app/api/reports/[reportId]/route.ts:8-56` allows read/update/delete with `withAuth` only.
- `lib/reports-store.ts:14-52` stores reports in process memory.
- `lib/reports-store.ts:25-32` and `lib/reports-store.ts:64-89` operate on a global in-memory array with no tenant dimension.

Impact:

- Any authenticated user can create and browse tickets, regardless of business role.
- Reports are shared process-global state, not tenant-isolated records.
- Report data disappears on restart/redeploy and can bleed across tenants while the process is alive.

Required fix before production:

- Add explicit permissions for ticket create/list and all report actions.
- Move reports into tenant-scoped durable storage.
- Add tenant-aware authorization tests for report and ticket routes.

## Important Secondary Findings

### 6. Auth endpoints still contain sensitive debug logging

Severity: Medium

Evidence:

- `app/api/auth/login/route.ts:102-115` writes partial session token data into audit metadata.
- `app/api/auth/login/route.ts:154-163` logs session token previews, cookie expiry, and permission counts.
- `app/api/auth/me/route.ts:8-31` logs cookie presence, token preview, user name, and permission details.

Impact:

- These logs increase the blast radius of log access and make incident review noisier.
- Token fragments, permission details, and auth flow diagnostics do not belong in production request logs by default.

Recommended fix:

- Remove debug logs or gate them behind an explicit development-only flag.
- Keep audit logs focused on actor, action, entity, and request ids, not token material.

### 7. Security headers are not configured

Severity: Medium

Evidence:

- `next.config.mjs:1-17` contains no `headers()` configuration for CSP, HSTS, frame protection, or referrer policy.
- No corresponding security-header configuration was found during the audit in app config files.

Impact:

- The app is missing standard browser-side hardening layers that are expected in production.

Recommended fix:

- Add at least `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` or `frame-ancestors`, `Referrer-Policy`, and `X-Content-Type-Options`.
- If hosted behind a proxy/CDN, define the ownership of these headers clearly and verify them in deployed responses.

### 8. The default test gate does not run critical integration flows

Severity: Medium

Evidence:

- `npm test` passed during this audit, but 75 tests were skipped because they require `RUN_INTEGRATION_TESTS=1`.

Impact:

- The local quality signal is good for unit/logic coverage but not strong enough for production release confidence on high-risk workflows like reconciliation, matching, imports, and lifecycle automation.

Recommended fix:

- Add an always-on CI stage for representative integration coverage.
- Fail release builds when core reconciliation/auth/tenant-boundary tests are skipped.

## Additional Observations

- Build health is currently good: `npm test`, `npm run build`, and `npm run lint` all passed in this audit run.
- The Prisma schema shows consistent use of `tenantId` across core models, which is the right foundation.
- The main production gaps are enforcement and exposure at the route layer, not schema design or compile stability.

## Recommended Release Checklist

- Remove or lock down public registration.
- Require auth and tenant-safe authorization on `/api/users`, `/api/accounts/options`, `/api/products/options`, `/api/products/master-data`, and `/api/__dbcheck`.
- Eliminate write side effects from unauthenticated `GET` handlers.
- Fix product RBAC so read permission never authorizes writes.
- Add CSRF protection for all cookie-authenticated mutations.
- Replace in-memory reports with tenant-scoped persistent storage and permission checks.
- Strip auth debug logs from production paths.
- Add production security headers and verify them in deployment.
- Promote key integration tests into mandatory CI gates.

## Suggested Ordering

1. Fix tenant-boundary and public-route issues.
2. Fix CSRF and RBAC defects.
3. Replace non-durable report storage and add missing permissions.
4. Remove debug logging and add security headers.
5. Strengthen CI gates for integration flows.
