# Commissable CRM - Application Review (2026-01-02)

## Scope

This review focuses on correctness, security posture, RBAC/auth consistency, build/deploy readiness, repo hygiene, and documentation quality based on the current repository state.

## Local Commands Run (This Pass)

- `npm test`: PASS
- `npm run lint`: PASS (2 warnings)
  - `app/(dashboard)/products/page.tsx`: `useCallback` dependency array includes `showWarning` unnecessarily
  - `components/two-stage-delete-dialog.tsx`: `useEffect` missing deps `disallowActiveDelete`, `onDeactivate`
- `npm run build`: PASS (same warnings as lint)
- `npm audit --production`: FAIL (4 high vulnerabilities; `glob`, `jws`, `qs`, `xlsx`; no fix available for `xlsx`)

## Strengths / What's Working Well

- Clear overall stack choice and organization: Next.js 14 + TS + Prisma; a lot of core CRM functionality is implemented (Accounts/Contacts/Opportunities/Revenue Schedules/Reconciliation/etc.).
- Centralized auth helpers exist (`lib/auth.ts`, `lib/api-auth.ts`) and many API routes are wrapped consistently.
- Session model is solid in principle (opaque tokens stored server-side; bcrypt hashing).
- Good volume of operational tooling and documentation (runbooks, scripts, reconciliation tooling).

---

## Critical Issues (Fix First)

### 1) Secrets / credentials committed in the repo

**Why it matters:** This is an immediate security risk and should be treated as an incident (credentials must be rotated, and the repo scanned for other secrets).

**Evidence (examples):**
- `docs/runbooks/Cloud_SQL_Proxy_Launch_Guide.md` includes a plaintext DB password.
- `docs/runbooks/DEPLOYMENT_GUIDE.md` includes plaintext DB credentials.
- `scripts/clone_prod_to_staging.ps1` and `scripts/clone_prod_to_staging.sh` echo the constructed `DATABASE_URL` (including password) to stdout.
- `cookies.txt` is tracked by git (`git ls-files`), which is high-risk even if it is "just local".

**Recommendation:**
- Rotate the affected DB users/passwords immediately.
- Remove secrets from documentation and scripts (replace with placeholders).
- Add secret scanning (pre-commit + CI) and block merges when secrets are detected.
- Consider rewriting history if secrets were committed historically (this requires a coordinated, deliberate process).

---

### 2) Authorization helper footgun: `withPermissions()` defaults to ANY-of

**Why it matters:** Many routes appear to pass a list like `["x.manage", "x.view"]` expecting BOTH. The current implementation defaults to ANY-of, which can grant overly-broad access (including write access to view-only users) if not used carefully.

**Evidence:**
- `lib/api-auth.ts` sets `requireAll = false` by default.
- Reconciliation mutations using `["reconciliation.manage", "reconciliation.view"]` are authorized if the user has only `reconciliation.view`:
  - `app/api/reconciliation/deposits/import/route.ts` (creates deposits + line items + import job)
  - `app/api/reconciliation/deposits/[depositId]/finalize/route.ts` (finalizes deposit + marks matches reconciled)
  - `app/api/reconciliation/deposits/[depositId]/unfinalize/route.ts` (reopens finalized deposit + recomputes schedules)
  - `app/api/reconciliation/deposits/[depositId]/auto-match/route.ts` (writes matches and updates line items)
  - `app/api/reconciliation/deposits/[depositId]/auto-match/preview/route.ts` (expensive compute; may be OK, but still likely intended to be manage-only)
- Other examples of "list looks like ALL, but is ANY":
  - `app/api/accounts/summary/route.ts` uses `withPermissions(["accounts.reassign", "accounts.bulk"])` but likely expects both (contrast: `app/api/accounts/reassignment-preview/route.ts` checks both codes explicitly).
  - `app/api/search/route.ts` uses `withPermissions(['accounts.manage','accounts.read','contacts.manage','contacts.read'])` and then returns BOTH Accounts + Contacts suggestions without per-entity permission filtering.

**Recommendation:**
- Establish a convention: when passing multiple permissions in a single guard, use `{ requireAll: true }` unless you explicitly want ANY-of.
- Consider making `{ requireAll: true }` the default and opting into ANY-of explicitly (less footgun-y).
- Audit every `withPermissions()` call site; treat state-changing endpoints as "manage-only" (do not include view perms on writes).

---

### 3) AuthN/AuthZ gaps on several API endpoints (middleware is not sufficient)

**Why it matters:** `middleware.ts` only checks for the presence of a `session-token` cookie. If an API route does not validate the session in its handler, a request with any cookie value can pass middleware and reach the route logic.

**High-risk endpoints (no `withAuth`/`withPermissions`/`getCurrentUser`):**
- `app/api/accounts/options/route.ts` (also performs DB mutations on GET; see below)
- `app/api/products/options/route.ts`
- `app/api/products/master-data/route.ts`
- `app/api/users/route.ts`
- `app/api/__dbcheck/route.ts` (health endpoint becomes "auth by cookie presence")

These routes call `resolveTenantId()` (from `lib/server-utils.ts`), which contains explicit development/fallback behavior (e.g., fall back to the first tenant in the DB when unauthenticated).

**Recommendation:**
- Wrap these endpoints in `withAuth()`/`withPermissions()` (or use `getCurrentUser()` + explicit permission checks).
- Remove dev fallback tenant resolution paths from production code paths, or gate them behind a strict dev-only flag.

---

## High Priority Issues

### 4) Public registration endpoint + role/tenant selection in request body

**Why it matters:** `/api/auth/register` is listed as a public route in `middleware.ts`. It accepts `tenantId` and `roleId` from the client request body. Even if guessing a UUID role ID is hard, this is a risky design for a production CRM.

**Evidence:**
- `middleware.ts` marks `/register` and `/api/auth/register` as public.
- `app/api/auth/register/route.ts` accepts `tenantId` and `roleId`.

**Recommendation:**
- Disable public self-registration for production (use invitations, admin-created users, or an allowlisted onboarding flow).
- Do not accept `roleId` from unauthenticated clients; assign default roles server-side or via admin-only flows.

---

### 5) RBAC "source of truth" inconsistency (permissions, docs, seeds, UI, API)

**Why it matters:** Authorization becomes fragile if permission codes differ across:
- DB seed(s)
- UI checks
- API guards
- documentation

**Evidence:**
- `prisma/seed.ts` seeds a limited permission set (`accounts.read`, `accounts.manage`, etc.).
- `scripts/seed-permissions.ts` seeds a broader/different taxonomy (`accounts.view.all`, `opportunities.view.assigned`, `tickets.view.all`, etc.).
- The codebase uses both sets (example: `app/api/opportunities/route.ts` checks `opportunities.view.all`, `opportunities.edit.all`, etc., which are not in `prisma/seed.ts`).
- Some UI checks reference permission codes that appear not to be seeded anywhere (example: `app/(dashboard)/import-export-demo/page.tsx` checks `accounts.import`/`contacts.import`).

**Recommendation:**
- Establish a single canonical permission list (code constants) and generate:
  - DB seed/upsert script from it
  - docs table from it
  - type-safe helpers from it
- Add a test that fails if a permission code is used in app/API but is not in the canonical list.

---

### 6) Products module: privilege escalation + commission % unit drift

**Why it matters:** The Products module has a concrete permission bug that can grant write/delete to read-only users, plus inconsistent validation of commission percent values that can silently corrupt data.

**Evidence:**
- `app/api/products/route.ts` defines `PRODUCT_MUTATION_PERMISSIONS` including `"products.read"`, and POST checks `hasAnyPermission()` across that list.
- `app/api/products/[productId]/route.ts` defines `PRODUCT_MUTATION_PERMISSIONS` including `"products.read"`, and DELETE checks `hasAnyPermission()` across that list.
- Commission percent validation is inconsistent:
  - Create flow validates `commissionPercent` as `0..100` in `app/api/products/route.ts`
  - Update flows validate `commissionPercent` as `0..1` (while returning an error message that still says `0..100`) in:
    - `app/api/products/[productId]/route.ts` (PATCH)
    - `app/api/products/bulk-update/route.ts` (POST)

**Recommendation:**
- Remove `"products.read"` from mutation permission lists and add explicit tests for permission boundaries.
- Standardize commission percent storage/contract (pick either `0..100` percent OR `0..1` fraction) and enforce it in:
  - API validation
  - UI display/inputs
  - computations that depend on commission
- Add a one-time data migration to normalize existing values.

---

### 7) Dependency vulnerabilities (audit shows high severity)

**Evidence:**
- `npm audit --production` reports 4 high vulnerabilities: `glob`, `jws`, `qs`, `xlsx` (no fix available for `xlsx` as of audit time).
- `lib/deposit-import/parse-file.ts` imports `xlsx` and parses whole spreadsheets in-memory.

**Recommendation:**
- Treat spreadsheet parsing as untrusted input: add size/row limits and timeouts.
- Track `xlsx` advisories and plan a replacement/upgrade strategy.
- Add dependency monitoring (CI) and regular upgrade cadence.

---

## Medium Priority Issues / Gaps

### 8) GET endpoints with side effects (surprising + hard to cache)

**Evidence:**
- `app/api/accounts/options/route.ts` calls `ensureCanonicalAccountTypes()` which can create/update/delete account type records and re-point accounts/contacts.
- `app/api/products/options/route.ts` calls `ensureNoneDirectDistributorAccount()` (mutating behavior) on GET.

**Recommendation:**
- Move canonicalization/repair work into migrations, explicit admin actions, or one-time ops scripts (not GET request handlers).

---

### 9) Logging/debug output in auth endpoints

**Evidence:**
- `app/api/auth/login/route.ts` and `app/api/auth/me/route.ts` emit verbose `console.log` output (including token previews / permission dumps).

**Recommendation:**
- Remove or gate debug logging behind an explicit debug flag.
- Ensure logs do not include token material or sensitive identifiers in production.

---

### 10) Session `lastSeenAt` write amplification

**Evidence:**
- `lib/auth.ts` updates `userSession.lastSeenAt` on every authenticated request.

**Recommendation:**
- Throttle updates (e.g., update at most once per N minutes) to reduce DB write load.

---

### 11) Cloud SQL connectivity approach needs hardening

**Evidence:**
- `lib/cloudsql.ts` starts a local proxy via `@google-cloud/cloud-sql-connector` and binds a Unix socket under `/tmp/cloudsql/...`.

**Concerns:**
- Not cross-platform (Windows local dev + unix socket path).
- Operational complexity for serverless runtimes (cold starts, proxy lifecycle).
- Hard-coded `IpAddressTypes.PUBLIC`.

**Recommendation:**
- Decide on a single supported production strategy (Cloud SQL Auth Proxy sidecar vs connector vs Prisma Data Proxy) and document it clearly.
- Make socket paths portable (`os.tmpdir()`), and allow `PRIVATE`/`PUBLIC` selection via env.

---

### 12) Build/lint hygiene

**Evidence:**
- `npm run build` succeeds, but the lint/typecheck phase reports React hooks warnings:
  - `app/(dashboard)/products/page.tsx`
  - `components/two-stage-delete-dialog.tsx`

**Recommendation:**
- Treat new warnings as regressions (especially hook deps) and either fix or suppress with justification.
- Keep CI gates for `npm test`, `npm run lint`, `npm run build`.

---

## Repo Hygiene / Process Improvements

- Several patch/temp artifacts are tracked: `patch.diff`, `rsd_v2.patch`, `temp.txt`, `package-lock.backup.json`, etc. (`git ls-files` confirms they are committed).
- Large "recovery" dumps under `docs/incidents/git-reset-recovery/lost-found-other/` dominate the largest tracked files list; these may contain sensitive code/data and should be curated or removed.
- Consider Git LFS for screenshots if repo size becomes a problem, or move design reference assets under a single documented directory with clear intent.

---

## Suggested Next Steps (Pragmatic Order)

1. Rotate leaked credentials + remove secrets from docs/scripts; add secret scanning.
2. Fix auth gaps (`accounts/options`, `products/options`, `products/master-data`, `users`, `__dbcheck`) and remove production tenant fallbacks (`lib/server-utils.ts`).
3. Audit `withPermissions()` usage and fix any endpoints where view-only roles can mutate data (especially Reconciliation).
4. Unify RBAC permission taxonomy (single canonical list) and add a drift test.
5. Fix Products authorization bug (`products.read` granting mutations) and standardize commission percent units.
6. Address `npm audit` findings (replace/contain `xlsx` risk) and add dependency monitoring.

---

## Module Reviews (Detailed)

Note: There are older status/review documents under `docs/notes/` (for example `Accounts_Section_Review.md`, `Opportunities_Implementation_Status_Report.md`, `Products_Implementation_Status_Report.md`). Several appear partially out of date vs current implementation; treat them as historical notes unless re-validated against the code.

### Accounts

**Entry points**
- UI: `app/(dashboard)/accounts/page.tsx`, `app/(dashboard)/accounts/[accountId]/page.tsx`, archive views under `app/(dashboard)/admin/archive/accounts/*`
- API: `app/api/accounts/route.ts`, `app/api/accounts/[accountId]/route.ts`, `app/api/accounts/options/route.ts`, `app/api/accounts/bulk-reassign/route.ts`, `app/api/accounts/reassignment-preview/route.ts`, `app/api/accounts/summary/route.ts`

**Data model / lifecycle**
- `Account.status` is the primary lifecycle control (`Active` / `Inactive` / `Archived`); there is no `deletedAt` for accounts (`prisma/schema.prisma`).
- Soft delete uses status `Archived` (see `lib/deletion.ts` and `app/api/accounts/[accountId]/route.ts`).
- Unique constraint: `@@unique([tenantId, accountName])` (account name uniqueness per tenant).

**Authorization snapshot (as implemented)**
- `app/api/accounts/route.ts`:
  - GET: `withPermissions(['accounts.manage','accounts.read'])` (ANY-of)
  - POST: `withPermissions(['accounts.manage'])`
- `app/api/accounts/[accountId]/route.ts`:
  - GET: `withPermissions(['accounts.manage','accounts.read'])` (ANY-of)
  - PATCH: `withPermissions(['accounts.manage'])`
  - DELETE: `withPermissions(['accounts.manage'])`, plus permanent delete requires `accounts.delete` inside the handler
- `app/api/accounts/options/route.ts`: no auth wrapper (Critical #3)
- `app/api/accounts/bulk-reassign/route.ts`: uses `getCurrentUser()` + custom permission checks (`validateManagerReassignmentPermission`)
- `app/api/accounts/reassignment-preview/route.ts`: uses `getCurrentUser()` + explicit `hasPermission()` checks
- `app/api/accounts/summary/route.ts`: `withPermissions(['accounts.reassign','accounts.bulk'])` (ANY-of)

**Key issues / gaps**
- Unauthenticated, mutating GET: `app/api/accounts/options/route.ts` calls `ensureCanonicalAccountTypes()` and can update/delete account types and re-point accounts/contacts.
- Tenant boundary risk: `resolveTenantId()` falls back to the first tenant in the database if unauthenticated (`lib/server-utils.ts`), which is unsafe for production endpoints.
- Bulk reassignment special users are implemented as string sentinels (`'house'`, `'unassigned'`) in `lib/special-users.ts`, but `Account.ownerId` is a UUID column; `app/api/accounts/bulk-reassign/route.ts` sets `ownerId` to `body.newOwnerId` before special handling, which likely fails when `newOwnerId` is `'house'` or `'unassigned'`.
- Tenant scoping inconsistencies: several update/delete operations in reassignment helpers use `where: { id: ... }` without tenantId checks (`lib/special-users.ts`, `app/api/accounts/bulk-reassign/route.ts`). IDs are UUIDs so cross-tenant collision is unlikely, but consistent tenant scoping is still recommended.
- Permission intent mismatch: `app/api/accounts/summary/route.ts` uses `withPermissions(["accounts.reassign", "accounts.bulk"])` but `withPermissions()` is ANY-of by default.
- Deletion bypass control: `app/api/accounts/[accountId]/route.ts` accepts `bypassConstraints=true` on soft delete. Ensure only Admins (or a dedicated permission) can bypass dependency checks.
- Commission-transfer logic is hard to reason about and may have query scoping issues:
  - `transferAccountCommissions()` in `app/api/accounts/bulk-reassign/route.ts` uses `updateMany()` operations without explicit `tenantId` filters and attempts to set `updatedById: undefined` (risking no-op/contract confusion).

**Recommendations**
- Secure `app/api/accounts/options/route.ts` with `withPermissions()` and move canonicalization into a migration or admin-only action.
- Replace sentinel "special user" IDs with a schema-consistent representation (e.g., `ownerId = null` for house/unassigned, or actual UUID system users).
- Add tenantId to every write query as a defense-in-depth pattern.
- Standardize reassignment permissions and ensure ALL intended permissions are actually required (`requireAll: true` where needed).

---

### Contacts

**Entry points**
- UI: `app/(dashboard)/contacts/page.tsx`, `app/(dashboard)/contacts/[contactId]/page.tsx`, archive views under `app/(dashboard)/admin/archive/contacts/*`
- API: `app/api/contacts/route.ts`, `app/api/contacts/[id]/route.ts`, `app/api/contacts/options/route.ts`

**Data model / lifecycle**
- `Contact.deletedAt` is the soft-delete mechanism; there is no contact status enum (`prisma/schema.prisma`).
- `Contact.isPrimary` describes primary contact, not activity status.

**Authorization snapshot (as implemented)**
- `app/api/contacts/route.ts`:
  - GET: `withPermissions(['contacts.read','contacts.manage'])` (ANY-of)
  - POST: `withPermissions(['contacts.create','contacts.manage'])` (ANY-of)
- `app/api/contacts/[id]/route.ts`:
  - GET: `withPermissions(['contacts.manage','contacts.read'])` (ANY-of)
  - PATCH: `withPermissions(['contacts.manage'])`
  - DELETE: `withPermissions(['contacts.delete','contacts.manage'])` (ANY-of) with `stage` and `bypassConstraints` query params
- `app/api/contacts/options/route.ts`: `withPermissions(['contacts.read','contacts.manage'])` (ANY-of)

**Key issues / gaps**
- "Active" semantics are inconsistent across list/detail:
  - List rows set `active: contact.isPrimary` in `app/api/contacts/route.ts` (primary contact treated as active).
  - Detail uses `active: contact.deletedAt === null` in `app/api/contacts/[id]/route.ts` (soft-delete treated as inactive).
  - `lib/row-state.ts` further treats `isPrimary` as "active-like", which can cause most contacts to appear inactive and eligible for delete UI actions.
- Business rule drift risk: contact records store both `accountTypeId` (FK) and `contactType` (string). The create flow derives the string from the account type name; if account types are renamed, the string can become stale.
- No schema constraint enforces "only one primary contact per account". If the UI/business expects exactly one, enforce it in code or add a DB constraint.
- Deletion constraints likely incorrect/overly strict:
  - `app/api/contacts/[id]/route.ts` blocks deleting a contact if the *account* has opportunities (counts by `accountId`), even if the contact is not tied to any opportunity role/ticket.
- Permanent deletion cascade is incomplete:
  - Contact can be referenced by `Ticket.contactId` and `OpportunityRole.contactId` (both exist in schema). The permanent delete flow deletes activities and group memberships, but does not address tickets or opportunity roles; this can cause FK constraint errors or leave inconsistent references.

**Recommendations**
- Split lifecycle fields cleanly: keep `isPrimary` separate from `active` (use `deletedAt === null` for active), and update table UI logic accordingly.
- Rework deletion constraints to check actual dependencies of the contact (tickets, opportunity roles, created templates, etc.) rather than blocking by account-level opportunity count.
- Ensure permanent delete either:
  - is blocked with a clear constraint report, or
  - performs a well-defined cascade/cleanup that matches schema constraints.
- If "primary contact" is a uniqueness rule, enforce it on create/update and provide an explicit "Set as Primary" action that demotes any existing primary contact.

---

### Opportunities

**Entry points**
- UI: `app/(dashboard)/opportunities/page.tsx`, `app/(dashboard)/opportunities/[opportunityId]/page.tsx`, archive views under `app/(dashboard)/admin/archive/opportunities/*`
- API:
  - Core: `app/api/opportunities/route.ts`, `app/api/opportunities/[opportunityId]/route.ts`
  - Products/line items: `app/api/opportunities/[opportunityId]/line-items/*`, `app/api/opportunities/line-items/[lineItemId]/route.ts`
  - Roles: `app/api/opportunities/[opportunityId]/roles/route.ts`, `app/api/opportunities/roles/[roleId]/route.ts`
  - Revenue schedules: `app/api/opportunities/[opportunityId]/revenue-schedules/create/route.ts`, `app/api/opportunities/[opportunityId]/revenue-schedules/deposit-matches/route.ts`

**Data model / lifecycle**
- Opportunity uses both `status` (Open/OnHold/Closed...) and an `active` boolean (`prisma/schema.prisma`).
- Opportunity line items store snapshots of key product attributes (`OpportunityProduct.*Snapshot` fields).

**Authorization snapshot (as implemented)**
- `app/api/opportunities/route.ts`:
  - GET: `withPermissions(OPPORTUNITY_VIEW_PERMISSIONS)` + additional scoping (assigned vs all), but "view any" includes `accounts.read` and `accounts.manage`
  - POST: `withPermissions(["opportunities.create","opportunities.manage","accounts.manage","accounts.create","contacts.manage"])` (ANY-of)
- `app/api/opportunities/[opportunityId]/route.ts`:
  - GET: `withPermissions(OPPORTUNITY_VIEW_PERMISSIONS)` + assigned/all checks
  - PATCH: `withPermissions(OPPORTUNITY_EDIT_PERMISSIONS)` + assigned/all checks
  - DELETE: `withPermissions(OPPORTUNITY_DELETE_PERMISSIONS)`
- Related mutation routes also include Accounts permissions in their "edit any" sets:
  - Line items: `app/api/opportunities/[opportunityId]/line-items/*`, `app/api/opportunities/line-items/[lineItemId]/route.ts`
  - Roles: `app/api/opportunities/[opportunityId]/roles/route.ts`
  - Revenue schedule generation: `app/api/opportunities/[opportunityId]/revenue-schedules/create/route.ts`

**Key issues / gaps**
- Permissions are broadened via Accounts perms in multiple places:
  - `OPPORTUNITY_VIEW_ANY_PERMISSIONS` includes `accounts.read` and `accounts.manage` (`app/api/opportunities/route.ts` and `app/api/opportunities/[opportunityId]/route.ts`), which effectively grants "view any opportunity" to users who can read accounts.
  - Similar patterns exist for edits and line-item mutations (`accounts.update`, `accounts.manage`), which can undermine "assigned-only" models.
  - Opportunity create permissions include `contacts.manage` (`app/api/opportunities/route.ts`); because `withPermissions()` is ANY-of, a contacts manager can create opportunities unless additional checks exist elsewhere.
- Opportunity is hard-delete only (no `deletedAt`). If you need auditability/restore, consider adding a soft-delete mechanism aligned with other modules.
- Address handling is inconsistent with Accounts:
  - Accounts use normalized `Address` records (`Account.shippingAddressId`, `Account.billingAddressId`).
  - Opportunities store `shippingAddress` / `billingAddress` as freeform strings, and copy them from Account if missing (`app/api/opportunities/route.ts`).
  - This creates duplication and makes downstream normalization (mapping, reporting, validation) harder.
- Prisma/client drift is being handled at runtime:
  - `app/api/opportunities/[opportunityId]/route.ts` uses `$queryRawUnsafe()` to select/update fields that "may not exist in an outdated Prisma client" (and catches errors). This is an operational smell: schema/client mismatch should be fixed in build/CI, not handled via raw SQL fallbacks.
- "Subagent" is split across `referredBy` and description prefix parsing:
  - Detail route extracts `Subagent:` from `description`, but schema also has dedicated fields (`referredBy`, `subagentPercent`, etc.). This can lead to duplicate/conflicting sources of truth.
- Opportunity role lifecycle is inconsistent:
  - `app/api/opportunities/[opportunityId]/roles/route.ts` allows assigned editors to create roles, but `app/api/opportunities/roles/[roleId]/route.ts` deletes roles with only `opportunities.edit.all/manage` (assigned-only users cannot delete roles).

**Recommendations**
- Revisit the permission model and remove implicit coupling where Accounts permissions grant Opportunity read/write; enforce "assigned vs all" consistently.
- Eliminate runtime raw SQL fallbacks by making Prisma client generation deterministic in CI/build and failing fast when drift exists.
- Choose a single source of truth for subagent metadata (prefer dedicated fields over parsing strings).
- Align role create/delete permissions, or document the intended asymmetry.

---

### Revenue Schedules

**Entry points**
- UI: `app/(dashboard)/revenue-schedules/page.tsx`, `app/(dashboard)/revenue-schedules/[revenueScheduleId]/page.tsx`, archive views under `app/(dashboard)/admin/archive/revenue-schedules/*`
- API:
  - List: `app/api/revenue-schedules/route.ts`
  - Detail: `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
  - Restore/clone/matches: `app/api/revenue-schedules/[revenueScheduleId]/*`
  - Bulk operations: `app/api/revenue-schedules/bulk*` and `app/api/revenue-schedules/bulk/*`

**Data model / lifecycle**
- Soft delete uses `RevenueSchedule.deletedAt`.
- Status also encodes financial workflow states (e.g., Reconciled, Underpaid, Overpaid, Unreconciled).
- Revenue schedules are central to reconciliation: linked to deposits via `DepositLineMatch`, to reconciliations via `ReconciliationItem`, and to payouts via `CommissionPayout`.

**Authorization snapshot (as implemented)**
- `app/api/revenue-schedules/route.ts` (list): `withAuth()` only (no permissions)
- `app/api/revenue-schedules/[revenueScheduleId]/route.ts`:
  - GET: `withAuth()` only (non-admin hides deleted schedules)
  - PATCH: `withPermissions(["revenue-schedules.manage"])`
  - DELETE: `withAuth()` + role check (Admin/Accounting; permanent requires Admin)
- `app/api/revenue-schedules/[revenueScheduleId]/matches/route.ts`: `withAuth()` only (no permissions)
- Bulk ops: generally `withPermissions(["revenue-schedules.manage", "opportunities.manage"])` (ANY-of)

**Key issues / gaps**
- List route is auth-only, not permissioned:
  - `app/api/revenue-schedules/route.ts` uses `withAuth()` only (no `withPermissions()`), so any authenticated user can access schedules and amounts unless UI blocks them.
- Deleted visibility inconsistency:
  - List route supports `includeDeleted` / `deletedOnly` params without role gating.
  - Detail route hides deleted schedules for non-admin (`app/api/revenue-schedules/[revenueScheduleId]/route.ts` GET).
- Matches endpoint is auth-only:
  - `app/api/revenue-schedules/[revenueScheduleId]/matches/route.ts` uses `withAuth()` only and returns deposit metadata (including payment type/date), which is usually reconciliation/accounting sensitive.
- Potential performance risk in list payload:
  - Default page size is 100 and max is 500 (`app/api/revenue-schedules/route.ts`).
  - Each row includes nested account address selects and opportunity details; large tenants can produce heavy responses and slow queries.
- Bulk update "effective date" semantics can be surprising:
  - `app/api/revenue-schedules/bulk/update-rate/route.ts` updates `Product.commissionPercent` based on schedules on/after an effective date. That changes the product globally, not just the selected schedule set, which can affect unrelated schedules and historical reporting.
- Bulk deactivate conflates "Reconciled" with "inactive":
  - `app/api/revenue-schedules/bulk/deactivate/route.ts` sets `status = Reconciled` as a deactivation mechanism; reconciliation status is usually not interchangeable with "archived".
- RBAC consistency issue: DELETE is role-based (Admin/Accounting) while PATCH is permission-based (`revenue-schedules.manage`). Pick one approach (roles or permissions) to avoid drift.

**Recommendations**
- Add an explicit read permission for revenue schedules (or reuse an existing one) and enforce it on list/detail/matches endpoints.
- Gate `includeDeleted` / `deletedOnly` behind Admin/Accounting (or a dedicated permission).
- Separate "archived/deactivated" from "reconciled" in status semantics (prefer `deletedAt` or a dedicated archive flag).
- For effective-date commission changes, consider schedule-level overrides rather than mutating product-level commission percent.

---

### Catalog / Products

**Entry points**
- UI: `app/(dashboard)/products/page.tsx`, `app/(dashboard)/products/[productId]/page.tsx`, archive views under `app/(dashboard)/admin/archive/products/*`
- API: `app/api/products/route.ts`, `app/api/products/[productId]/route.ts`, `app/api/products/bulk-update/route.ts`, `app/api/products/options/route.ts`, `app/api/products/master-data/route.ts`

**Data model / lifecycle**
- `Product.isActive` controls active/inactive, and hard delete is supported in `app/api/products/[productId]/route.ts` when inactive and no active dependencies.
- `Product.productCode` is treated as "Vendor part number" in the API, while the schema also includes `partNumberVendor` (naming drift to resolve).
- Unique constraint: `@@unique([tenantId, productCode])`.

**Authorization snapshot (as implemented)**
- `app/api/products/route.ts`:
  - GET: `withAuth()` only (no permissions)
  - POST: `withAuth()` + `hasAnyPermission(PRODUCT_MUTATION_PERMISSIONS)` (includes `"products.read"`; see High Priority #6)
- `app/api/products/[productId]/route.ts`:
  - GET: `withAuth()` only
  - PATCH: Admin role only (role-code check)
  - DELETE: Admin OR `hasAnyPermission(PRODUCT_MUTATION_PERMISSIONS)` (includes `"products.read"`; see High Priority #6)
- `app/api/products/bulk-update/route.ts`: `withPermissions(["products.update","products.manage","products.admin"])` (ANY-of)
- `app/api/products/options/route.ts`: no auth wrapper (Critical #3)
- `app/api/products/master-data/route.ts`: no auth wrapper (Critical #3)

**Key issues / gaps**
- Auth gaps on reference endpoints:
  - `app/api/products/options/route.ts` and `app/api/products/master-data/route.ts` are unauthenticated and use `resolveTenantId()` fallbacks.
- Privilege escalation via mutation permission lists (see High Priority #6).
- Commission percent unit drift (see High Priority #6):
  - Create expects `0..100` but updates validate `0..1`.
  - Some downstream logic attempts to "fix" this by treating values `> 1` as percent and dividing by 100 (e.g., Opportunity line-item schedule generation), which can mask inconsistent stored values.
- Hard deletes can remove historically valuable relationships:
  - Product deletion removes `OpportunityProduct` rows for the product and detaches certain revenue schedules before deleting the product (`app/api/products/[productId]/route.ts`).
  - If you need historical reporting/audit, consider soft-delete (`isActive=false` + optional `deletedAt`) over hard delete.
- Field naming drift and stale TODOs:
  - `app/api/products/helpers.ts` has TODO notes implying vendor product family/subtype/description are "not yet stored", but schema includes those fields. This is likely outdated and can mislead future work.

**Recommendations**
- Secure options/master-data routes and remove tenant fallback behavior in production.
- Remove `products.read` from mutation permission sets and enforce clear create/update/delete permissions.
- Align commission percent units across create/update/bulk-update and add migration/test coverage.
- Clarify productCode vs partNumberVendor semantics and update mapping/labels accordingly.

---

### Reconciliation

**Entry points**
- UI: `app/(dashboard)/reconciliation/page.tsx`, `app/(dashboard)/reconciliation/[depositId]/*`
- API:
  - Deposits: `app/api/reconciliation/deposits/*`
  - Matching: candidates/apply-match/unmatch/auto-match/finalize/unfinalize routes under `app/api/reconciliation/deposits/[depositId]/*`
  - Settings: `app/api/reconciliation/settings/route.ts`
  - Templates: `app/api/reconciliation/templates/*`

**Data model / lifecycle**
- Deposits and line items represent the imported remittance; revenue schedules represent expected amounts; matching links them via `DepositLineMatch`.
- Matching preferences are stored in `SystemSetting` under keys like `reconciliation.varianceTolerance` (`lib/matching/settings.ts`).

**Authorization snapshot (as implemented)**
- Deposits:
  - List: `app/api/reconciliation/deposits/route.ts` GET uses `withPermissions(['reconciliation.view'])`
  - Detail: `app/api/reconciliation/deposits/[depositId]/detail/route.ts` GET uses `withPermissions(['reconciliation.view'])`
  - Delete: `app/api/reconciliation/deposits/[depositId]/route.ts` DELETE uses `withPermissions(['reconciliation.manage'])`
- Import/matching (all mutate state):
  - Import: `app/api/reconciliation/deposits/import/route.ts` POST uses `withPermissions(['reconciliation.manage','reconciliation.view'])` (ANY-of; Critical #2)
  - Candidates: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts` GET uses `withPermissions(['reconciliation.view'])` but also writes flags when candidates exist (see below)
  - Apply match: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts` POST uses `withPermissions(['reconciliation.view'])` (should be manage-only)
  - Unmatch: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts` POST uses `withPermissions(['reconciliation.view'])` (should be manage-only)
  - Auto-match: `app/api/reconciliation/deposits/[depositId]/auto-match/route.ts` POST uses `withPermissions(['reconciliation.manage','reconciliation.view'])` (ANY-of; Critical #2)
  - Finalize: `app/api/reconciliation/deposits/[depositId]/finalize/route.ts` POST uses `withPermissions(['reconciliation.manage','reconciliation.view'])` (ANY-of; Critical #2)
  - Unfinalize: `app/api/reconciliation/deposits/[depositId]/unfinalize/route.ts` POST uses `withPermissions(['reconciliation.manage','reconciliation.view'])` (ANY-of; Critical #2)
- Settings: `app/api/reconciliation/settings/route.ts` (GET = view, POST = manage)
- Templates: `app/api/reconciliation/templates/route.ts` (GET = view, POST = view; likely should be manage)

**Key issues / gaps**
- Multiple write endpoints can be executed by view-only users due to `withPermissions()` ANY-of behavior (see Critical #2):
  - Import: `app/api/reconciliation/deposits/import/route.ts` (write)
  - Apply match: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts` (write; currently only `reconciliation.view`)
  - Unmatch: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts` (write; currently only `reconciliation.view`)
  - Finalize/unfinalize/auto-match: `app/api/reconciliation/deposits/[depositId]/*` (write; many guarded by `["reconciliation.manage", "reconciliation.view"]`)
- Reconciliation templates can be created by view-only users:
  - `app/api/reconciliation/templates/route.ts` POST uses `withPermissions(['reconciliation.view'])`.
- GET with side effects:
  - `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts` updates `DepositLineItem.hasSuggestedMatches`/`lastMatchCheckAt` on GET when suggestions exist.
- Import risks:
  - `lib/deposit-import/parse-file.ts` loads whole files in memory and uses `xlsx` (known high severity issues; no fix available).
  - No explicit max file size / max row count enforcement in `app/api/reconciliation/deposits/import/route.ts`.
- Long-running operations:
  - Auto-match endpoints iterate line items sequentially; large deposits may produce slow requests and timeouts.

**Recommendations**
- Require `reconciliation.manage` for any state-changing reconciliation endpoint; do not include `reconciliation.view` in write guards.
- Add upload constraints (max bytes, max rows) and consider background job processing for imports and auto-match.
- Tighten who can manage templates (likely `reconciliation.manage`) and who can change settings (`reconciliation.manage` already).
- Add observability around matching: runtime metrics are present (`lib/matching/metrics`); ensure they are reviewed/monitored.

---

## Module Action Items (Prioritized)

- Accounts (P0): secure `app/api/accounts/options/route.ts` + remove tenant fallbacks; fix special owner IDs (`house`/`unassigned`) so they cannot hit UUID columns.
- Accounts (P1): restrict `bypassConstraints` to admins; add tenantId filters consistently in reassignment flows.
- Contacts (P0): fix "active" semantics (primary vs deleted) and correct deletion constraints/cascades (tickets/opportunity roles).
- Contacts (P1): enforce primary contact uniqueness if required; reduce drift between `accountTypeId` and `contactType` string.
- Opportunities (P0): tighten permission sets so Accounts perms do not grant "view/edit all opportunities" unintentionally; remove runtime `$queryRawUnsafe` fallback by fixing Prisma generation consistency.
- Opportunities (P1): unify address representation (string vs Address) and pick a single source of truth for subagent metadata.
- Revenue schedules (P0): add read permissions to list/matches endpoints and gate deleted visibility (`includeDeleted` / `deletedOnly`) behind admin/accounting.
- Revenue schedules (P1): separate "archived/deactivated" from "reconciled" semantics; avoid product-wide commission mutations for schedule-only edits.
- Products (P0): remove `products.read` from mutation permission checks and secure unauthenticated options/master-data endpoints.
- Products (P1): standardize commission percent units and clarify `productCode` vs part number fields; prefer soft delete over hard delete where historical reporting matters.
- Reconciliation (P0): require `reconciliation.manage` for all mutations; fix manage+view guards (ANY-of); remove GET side effects where possible.
- Reconciliation (P1): add file size/row limits; move imports/auto-match to background processing for large deposits.

---

## Cross-Cutting Consistency Notes

### Lifecycle semantics ("Active", "Inactive", "Deleted")

The project currently uses multiple, inconsistent lifecycle representations:

- Accounts: `Account.status` (`Active`/`Inactive`/`Archived`) as soft-delete mechanism; no `deletedAt`.
- Contacts: `Contact.deletedAt` as soft-delete mechanism; no status enum.
- Opportunities: `Opportunity.status` + `Opportunity.active` boolean; no `deletedAt` (hard-delete only).
- Revenue schedules: `RevenueSchedule.deletedAt` + `RevenueSchedule.status` (workflow status).
- Products: `Product.isActive` (inactive required before hard delete); no `deletedAt`.
- Deposits: `Deposit.status` + `Deposit.reconciled`/`reconciledAt` booleans (workflow state).
- Tickets: `Ticket.status` (workflow state) with no explicit archive/delete mechanism shown in reviewed routes.

**Why it matters:** UI conventions like a generic `active` boolean (used by tables and delete controls) become misleading when different modules encode lifecycle differently (and sometimes overload workflow status like "Reconciled" to mean "inactive").

**Recommendation:** Define a standard lifecycle contract for all major entities (e.g., `deletedAt` + `deletedById` + optional `archivedAt`) and avoid overloading workflow states as lifecycle states.

### Documentation drift

- There are multiple older review/status docs under `docs/notes/`. If they are intended to be current, add a "last verified against commit" marker and keep them updated, or move them to an "archive" area to reduce confusion.

---

## Secondary Modules (Not Exhaustive, Not Deep-Dived)

### Activities

- Global listing endpoint uses a broad permission list: `app/api/activities/route.ts` is guarded by `['activities.manage','activities.read','accounts.manage','contacts.manage']` and is ANY-of by default. If Accounts/Contacts managers should not automatically see all activities, tighten this.
- Attachment upload buffers files into memory (`app/api/activities/[activityId]/attachments/route.ts`); add file size limits and mime-type checks.

### Tickets

- `app/api/tickets/route.ts` uses `withAuth()` only (no permission checks), which may be too open for a dispute/support workflow with financial context.
- Tickets reference Accounts/Opportunities/RevenueSchedules/Contacts; deletion/archival semantics are not covered in the reviewed endpoints and should be designed intentionally.

### Reports

- `app/api/reports/route.ts` is backed by in-memory mock data (`lib/mock-data`) rather than persisted definitions; this will reset on deploy and does not enforce per-report access.

### Global Search

- `app/api/search/route.ts` returns both account and contact suggestions under a single ANY-of guard. If you want entity-level separation (accounts vs contacts), filter results by the caller's permissions.

### Users

- `app/api/users/route.ts` is unauthenticated and uses tenant fallbacks; this should be locked down (see Critical #3).

### Audit Logs

- `app/api/audit-logs/route.ts` uses `withPermissions()` with a broad ANY-of list including `accounts.manage` and `opportunities.manage`. If audit logs are sensitive (they often are), consider requiring a dedicated `auditLogs.read` permission and ensure it is seeded and used consistently.

### Table Preferences / UI State

- `app/api/table-preferences/[pageKey]/route.ts` uses `withAuth()` only and stores preferences by `userId + pageKey` (unique constraint does not include tenant). If users are tenant-scoped this may be fine; if users can exist in multiple tenants, preferences can bleed across tenants.
- Consider an allowlist for `pageKey` (or a cleanup policy) to prevent unbounded table preference growth.

### System Settings

- `app/api/system-settings/route.ts` is permissioned (`system.settings.read` / `system.settings.write`) and is a good pattern to copy to other "settings/master data" endpoints that are currently unauthenticated.
