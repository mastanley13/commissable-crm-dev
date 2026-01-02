# Delete Workflows (Current Implementation Review)

Generated: 2026-01-02  
Repository: `commissable-crm-dev`

## Scope

This document inventories and analyzes how “delete” (and closely related “archive”, “inactive”, “restore”, “void”) workflows currently work across the application:

- UI entry points (list/detail/archive screens) and the shared delete modal patterns.
- API routes (`app/api/**/route.ts`) that implement soft delete, deactivation, restore, and hard delete.
- Prisma/data-model implications (fields used to represent deletion state; FK/onDelete behavior).
- Audit logging coverage and consistency.
- Notable issues, mismatches, and risks.

This is a code-level review of the current structure; it does not prescribe a final policy, but it highlights where policy appears inconsistent or where implementation likely does not match intent.

## Terminology / Taxonomy (How “Delete” is represented)

Across the codebase, “delete” is implemented via several different mechanisms:

- **Soft delete (archive marker)**: record remains, but is hidden by default.
  - `Account.status = Archived` (accounts)
  - `Contact.deletedAt != null` (contacts)
  - `RevenueSchedule.deletedAt != null` (revenue schedules)
- **Deactivation / inactivation**: record remains and is filtered into an “inactive/archive” view, but is not “deleted”.
  - `Opportunity.active = false` (opportunities)
  - `Product.isActive = false` (products)
  - `Group.isActive = false` (groups)
  - `Ticket.status in {Closed, Resolved}` (tickets)
  - `Activity.status = Completed` (activities)
  - `RevenueSchedule.status = Reconciled` is also used as a “deactivate” action (separate from deletedAt).
- **Hard delete (permanent deletion)**: record is removed from the database (sometimes with manual cascades).
  - Many endpoints physically delete rows via `prisma.*.delete(...)` / `deleteMany(...)`.
- **“Delete” as status update (voiding)**:
  - `CommissionPayout` uses `DELETE` to set `status = Voided` rather than removing the row.

Throughout this doc, “archive” means “moved into the Admin → Archive views”, but note that those views include a mix of true soft-deleted entities *and* merely inactive/closed entities.

## Cross-cutting Architecture

### UI: Shared delete modal

The primary reusable UI for delete/restore is `components/two-stage-delete-dialog.tsx`.

Key behaviors:

- Supports “soft delete” vs “permanent delete” vs “restore” flows in one component.
- Supports a **constraints** stage: if the API returns a `409` with `constraints`, the dialog renders those constraints and can optionally let the user re-submit with **bypassConstraints**.
- Supports:
  - Bulk selection (multi-entity delete/restore)
  - “Disallow delete when active” (`disallowActiveDelete`)
  - “Require reason” (`requireReason`)

This dialog is used widely, including:

- List pages: accounts, contacts, opportunities, products
- Detail views: account-details, contact-details, opportunity-details
- Admin Archive pages: accounts, contacts, opportunities, products, revenue schedules, groups, tickets, activities

Note: In several Archive pages, `TwoStageDeleteDialog` is used only for **restore/permanent delete** (soft delete is disabled), because those rows are already considered “archived” by some local rule (inactive/closed/etc).

### API: Auth wrappers

The API layer uses `lib/api-auth.ts`:

- `withAuth(request, handler)` → ensures authentication.
- `withPermissions(request, permissions, handler, { requireAll? })` → checks for ANY permission by default (unless `requireAll: true` is passed).

The default ANY-of semantics is important: many endpoints pass broad sets including `*.manage`, `*.edit.*`, and sometimes even `*.read`. That can unintentionally grant mutation/delete access if permission sets aren’t tightly curated.

### Audit logging

Audit helpers live in `lib/audit.ts`:

- `logAudit(...)` + entity-specific helpers like `logAccountAudit`, `logContactAudit`, `logOpportunityAudit`, `logProductAudit`, `logRevenueScheduleAudit`, `logActivityAudit`, `logUserAudit`.

Not all delete flows log audits; some routes write directly to `prisma.auditLog.create(...)` (sometimes with data shapes that differ from the helper expectations).

### “Deletion constraints” helper module

`lib/deletion.ts` provides:

- `checkDeletionConstraints(entity, entityId, tenantId)`
- `softDeleteEntity(...)`
- `permanentDeleteEntity(...)`
- `restoreEntity(...)`

In practice, it is used primarily by **Account** deletion (`app/api/accounts/[accountId]/route.ts`).

Important: `lib/deletion.ts` includes mappings/checks for entity types that do **not** match the current Prisma schema (details in the Issues section).

## Inventory: Deletion/Archive Behaviors by Entity

This table describes what “archive/deleted” means per entity *today* (both server-side fields and how the UI tends to treat the state).

| Entity | “Archived” indicator (data) | Primary UI meaning | Restore supported? | Permanent delete supported? | Key API routes |
|---|---|---|---|---|---|
| Account | `status = Archived` | Soft-deleted account (hidden by default) | Yes (restore → Active) | Yes (hard delete after archived) | `app/api/accounts/[accountId]/route.ts`, `lib/deletion.ts` |
| Contact | `deletedAt != null` | Soft-deleted contact | Yes | Yes (hard delete after soft delete) | `app/api/contacts/[id]/route.ts` |
| Opportunity | `active = false` (plus closed stages treated as inactive) | “Inactive” opportunity (often labeled “deleted”) | Yes (active=true) | Yes (hard delete) | `app/api/opportunities/[opportunityId]/route.ts` |
| Product | `isActive = false` | “Inactive” product (treated as archived) | Yes (active=true) | Yes (hard delete) | `app/api/products/[productId]/route.ts` |
| RevenueSchedule | `deletedAt != null` | Deleted/archived schedule | Yes (`/restore`) | Yes (admin-only stage=permanent) | `app/api/revenue-schedules/[revenueScheduleId]/route.ts`, `app/api/revenue-schedules/[revenueScheduleId]/restore/route.ts` |
| Activity | `status = Completed` (archive view), otherwise no soft delete field | Completed activities shown in “Archive” | “Restore” = reopen (status=Open) | Yes (hard delete) | `app/api/activities/[activityId]/route.ts`, `lib/activity-service.ts` |
| Ticket | Inactive derived from `TicketStatus` | Closed/resolved tickets shown in “Archive” | “Restore” = reopen | Yes (hard delete) | `app/api/tickets/[ticketId]/route.ts` |
| Group | `isActive = false` | Inactive group shown in “Archive” | Yes (isActive=true) | Yes (hard delete; optionally forced) | `app/api/groups/[id]/route.ts` |
| Deposit (reconciliation) | None | Direct deletion of a deposit + recalculation | N/A | Yes (hard delete) | `app/api/reconciliation/deposits/[depositId]/route.ts` |
| CommissionPayout | `status = Voided` (via DELETE) | “Void payment” (not a real delete) | N/A | No (by design) | `app/api/revenue-schedules/[revenueScheduleId]/payouts/[payoutId]/route.ts` |
| Opportunity line item (`OpportunityProduct`) | None (but has `active` flag for non-delete) | Hard delete a line item + potentially delete linked schedules | N/A | Yes | `app/api/opportunities/line-items/[lineItemId]/route.ts` |
| OpportunityRole | None | Hard delete role record | N/A | Yes | `app/api/opportunities/roles/[roleId]/route.ts` |

### Appendix: API routes that implement `DELETE`

These are the current App Router handlers that export `export async function DELETE(...)` (user-facing and admin):

- Accounts (soft/permanent/check): `app/api/accounts/[accountId]/route.ts`
- Contacts (soft/permanent): `app/api/contacts/[id]/route.ts`
- Opportunities (permanent): `app/api/opportunities/[opportunityId]/route.ts`
- Products (permanent): `app/api/products/[productId]/route.ts`
- Revenue schedules (soft/permanent): `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
- Revenue schedule payouts (“delete” = void): `app/api/revenue-schedules/[revenueScheduleId]/payouts/[payoutId]/route.ts`
- Activities (permanent): `app/api/activities/[activityId]/route.ts`
- Activity attachments: `app/api/activities/[activityId]/attachments/[attachmentId]/route.ts`
- Tickets (permanent): `app/api/tickets/[ticketId]/route.ts`
- Groups (permanent; optional forced): `app/api/groups/[id]/route.ts`
- Reconciliation deposits (permanent): `app/api/reconciliation/deposits/[depositId]/route.ts`
- Opportunity line items (permanent): `app/api/opportunities/line-items/[lineItemId]/route.ts`
- Opportunity roles (permanent): `app/api/opportunities/roles/[roleId]/route.ts`
- Admin users (“delete” = disable user): `app/api/admin/users/[userId]/route.ts`
- Admin roles (permanent): `app/api/admin/roles/[id]/route.ts`
- Admin data settings (permanent): `app/api/admin/data-settings/account-types/route.ts`
- Admin data settings (permanent): `app/api/admin/data-settings/product-families/route.ts`
- Admin data settings (permanent): `app/api/admin/data-settings/product-subtypes/route.ts`
- Admin data settings (delete = remove custom definition): `app/api/admin/data-settings/revenue-types/route.ts`

## Workflows by Module (End-to-end)

### Accounts

Key files:

- API list/create: `app/api/accounts/route.ts`
- API detail/update/delete: `app/api/accounts/[accountId]/route.ts`
- Deletion helper: `lib/deletion.ts`
- UI list + bulk: `app/(dashboard)/accounts/page.tsx`
- UI archive: `app/(dashboard)/admin/archive/accounts/page.tsx`

#### State model

- Active vs inactive is represented by `Account.status`:
  - `Active`
  - `Inactive`
  - `Archived` (soft-deleted)

Accounts are hidden from the main list by default unless `includeArchived=true` or an explicit archived status filter is used (`app/api/accounts/route.ts`).

#### Deactivate (not delete)

- UI toggles `active` and the API maps that to `AccountStatus.Active`/`AccountStatus.Inactive`.
  - API: `PATCH /api/accounts/:accountId` with `{ active: boolean }` (`app/api/accounts/[accountId]/route.ts`)

#### Soft delete (archive)

- UI (Accounts list) calls:
  - `DELETE /api/accounts/:accountId?stage=soft[&bypassConstraints=true]` (optional JSON body `{ reason }`) (`app/(dashboard)/accounts/page.tsx`)
- API behavior:
  - Blocks if the account is still `Active` (“Deactivate the account before deleting.”)
  - Runs `checkDeletionConstraints('Account', ...)` (unless bypassed)
  - Calls `softDeleteEntity('Account', ...)` which sets `status = Archived` (`lib/deletion.ts`)
  - Logs `AuditAction.Delete` via `logAccountAudit(...)`

#### Restore

- `PATCH /api/accounts/:accountId` with `{ action: "restore" }`
  - Implemented by `restoreEntity('Account', ...)` which sets `status = Active`
  - Logs `AuditAction.Update` with `{ action: 'restore' }`

#### Permanent delete

- UI (Admin archive) calls:
  - `DELETE /api/accounts/:accountId?stage=permanent` (optional `{ reason }`)
- API behavior:
  - Requires `accounts.manage` (route wrapper) and then additionally checks `accounts.delete` before allowing permanent delete.
  - Requires the account already be in Archived state.
  - `permanentDeleteEntity('Account', ...)` blocks permanent deletion if **any related records exist** (many dependencies are counted in `getAccountPermanentDeleteDependencies`), then performs `prisma.account.delete(...)`.

### Contacts

Key files:

- API list/create: `app/api/contacts/route.ts`
- API detail/update/delete/restore: `app/api/contacts/[id]/route.ts`
- UI list: `app/(dashboard)/contacts/page.tsx`
- UI archive: `app/(dashboard)/admin/archive/contacts/page.tsx`

#### State model

- “Deleted” is represented by `Contact.deletedAt` (soft delete).
- Restore clears `deletedAt` (and `deletedById`).

#### Soft delete

- UI calls:
  - `DELETE /api/contacts/:id?stage=soft[&bypassConstraints=true]` with optional `{ reason }`
- API behavior (`app/api/contacts/[id]/route.ts`):
  - If not bypassed, runs *custom* dependency checks:
    - Existing `activities` (any activities, not only open)
    - Existing `groupMembers`
    - **Also checks the contact’s account for opportunities (see Issues)**
  - Sets `deletedAt = now`, `deletedById = userId`, `updatedById = userId`
  - Logs `AuditAction.Delete` via `logContactAudit(...)`

#### Restore

- `PATCH /api/contacts/:id` with `{ action: "restore" }`
  - Clears `deletedAt` and `deletedById`
  - Logs `AuditAction.Update` via `logContactAudit(...)`

#### Permanent delete

- `DELETE /api/contacts/:id?stage=permanent` (optional `{ reason }`)
  - Requires the contact already have `deletedAt` set (soft-deleted first).
  - Deletes:
    - All activities with `contactId`
    - All group membership rows with `contactId`
    - The contact row
  - Logs `AuditAction.Delete` via `logContactAudit(...)`

Important: There are additional foreign-key dependencies on `Contact` (e.g., `ContactPreference`, `OpportunityRole.contactId`) that are *not* addressed by the permanent delete transaction (see Issues).

### Opportunities

Key files:

- API list/create: `app/api/opportunities/route.ts`
- API detail/update/delete: `app/api/opportunities/[opportunityId]/route.ts`
- UI list: `app/(dashboard)/opportunities/page.tsx`
- UI archive: `app/(dashboard)/admin/archive/opportunities/page.tsx`

#### State model

- “Inactive” is represented primarily by `Opportunity.active = false`.
- The list API also treats certain terminal stages as “inactive” regardless of `active`:
  - `ClosedLost`
  - `ClosedWon_BillingEnded`
  (`app/api/opportunities/route.ts`)

#### Soft delete (deactivate)

- UI calls:
  - `PATCH /api/opportunities/:id[?bypassConstraints=true]` with `{ active: false, lossReason?: string }`
- API behavior:
  - If `active=false` and not bypassing constraints:
    - Blocks if there are active (non-deleted, non-reconciled) revenue schedules for this opportunity.
    - Returns `409` with a `constraints` array compatible with the delete dialog.
  - Sets `active=false` (but does not automatically force stage/status to “lost”).

#### Restore

- UI calls:
  - `PATCH /api/opportunities/:id` with `{ active: true }`
- API behavior:
  - Guards against reactivating terminal-stage opportunities.
  - Sets `active=true`.

#### Permanent delete

- UI calls:
  - `DELETE /api/opportunities/:id` with optional `{ reason }`
- API behavior:
  - Deletes opportunity roles automatically.
  - Refuses deletion if there are any `OpportunityProduct` rows (line items) remaining.
  - Attempts to `prisma.opportunity.delete(...)` and returns `409` for FK constraint failures.

### Products

Key files:

- API list/create: `app/api/products/route.ts`
- API detail/update/delete: `app/api/products/[productId]/route.ts`
- UI list: `app/(dashboard)/products/page.tsx`
- UI archive: `app/(dashboard)/admin/archive/products/page.tsx`

#### State model

- “Inactive” is represented by `Product.isActive = false`.
- The list API filters on `isActive` (`app/api/products/route.ts`).

#### Inactivate / restore

- `PATCH /api/products/:id` with `{ active: boolean }` sets `isActive` accordingly.

#### Permanent delete

- `DELETE /api/products/:id` with optional `{ reason }`
  - Blocks deletion if `isActive=true` (“Inactivate the product instead.”).
  - Blocks deletion if product is referenced by **active** revenue schedules (non-deleted, non-reconciled).
  - Blocks deletion if product is used on active opportunities (open/on-hold) via active line items.
  - Proceeds by:
    - Detaching the product from archived/reconciled schedules by setting `productId = null` and `opportunityProductId = null`
    - Deleting all `OpportunityProduct` rows for this product
    - Deleting the product row
  - Logs `AuditAction.Delete` via `logProductAudit(...)`

Note: there are additional references to `Product` (e.g., `DepositLineItem.productId`) that are not checked/handled here (see Issues).

### Revenue Schedules

Key files:

- API list: `app/api/revenue-schedules/route.ts`
- API detail/update/delete: `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
- API restore: `app/api/revenue-schedules/[revenueScheduleId]/restore/route.ts`
- Bulk “deactivate”: `app/api/revenue-schedules/bulk/deactivate/route.ts`
- UI delete/deactivate modal(s): `components/revenue-schedule-status-modal.tsx`, `components/revenue-schedule-create-modal.tsx`
- UI archive: `app/(dashboard)/admin/archive/revenue-schedules/page.tsx`

#### State model

Revenue schedules effectively have two different “inactive” concepts:

- **Soft delete**: `deletedAt != null` (archive/delete)
- **Deactivation**: `status = Reconciled` is used by bulk-deactivate workflows (not a delete, but treated as inactive).

#### Soft delete (archive)

- `DELETE /api/revenue-schedules/:id` (optionally `?reason=...`, and/or body `{ reason }`)
- API constraints:
  - Only `Admin` or `Accounting` roles (by role code) can delete revenue schedules.
  - Blocks deletion if any money has been applied, or if there are matches/reconciliation/deposit links.
  - Sets `deletedAt = now`
  - Logs `AuditAction.Delete` via `logRevenueScheduleAudit(...)` (with `deleteReason` in the audit values, not persisted on the schedule)

#### Restore

- `POST /api/revenue-schedules/:id/restore`
  - Requires admin/accounting or `revenue-schedules.manage`
  - Sets `deletedAt = null`
  - Logs `AuditAction.Update` via `logRevenueScheduleAudit(...)`

#### Permanent delete

- `DELETE /api/revenue-schedules/:id?stage=permanent`
  - Admin-only
  - Requires `deletedAt` already set (must be archived first).
  - Blocks deletion if:
    - Applied monies exist
    - Deposit matches exist
    - Reconciliation links exist
    - Deposit line links exist
    - Activities, tickets, or commission payouts exist
  - Deletes the revenue schedule row
  - Logs `AuditAction.Delete` via `logRevenueScheduleAudit(...)`

#### Bulk deactivate (status change, not delete)

- `POST /api/revenue-schedules/bulk/deactivate`
  - Sets `status = Reconciled` after guardrails similar to delete.
  - Logs `AuditAction.Update` via `logRevenueScheduleAudit(...)`

### Activities

Key files:

- API detail/update/delete: `app/api/activities/[activityId]/route.ts`
- Attachment delete/download: `app/api/activities/[activityId]/attachments/[attachmentId]/route.ts`
- Service layer: `lib/activity-service.ts`
- UI archive: `app/(dashboard)/admin/archive/activities/page.tsx`

#### State model

- Activities are “archived” in the UI based on `Activity.status = Completed`, not by a deletedAt marker.
- “Restore” means “reopen” (set status back to Open).

#### Permanent delete

- `DELETE /api/activities/:id`
  - Deletes links + attachments + activity row in a transaction (`lib/activity-service.ts`)
  - Deletes stored files from backing storage
  - Logs `AuditAction.Delete` via `logActivityAudit(...)`

### Tickets

Key files:

- API list: `app/api/tickets/route.ts`
- API detail/update/delete: `app/api/tickets/[ticketId]/route.ts`
- UI archive: `app/(dashboard)/admin/archive/tickets/page.tsx`

#### State model

- A ticket is “active” when `status ∈ {Open, InProgress, Waiting}`.
- “Archive” views are derived from status (closed/resolved tickets).

#### Restore (reopen)

- `PATCH /api/tickets/:id` with `{ active: true }` sets `status = Open` and clears/adjusts `closedAt`.

#### Permanent delete

- `DELETE /api/tickets/:id`
  - Hard-deletes ticket row.
  - No audit logging is performed for ticket deletion (see Issues).

### Groups

Key files:

- API list/create: `app/api/groups/route.ts`
- API detail/update/delete: `app/api/groups/[id]/route.ts`
- UI archive: `app/(dashboard)/admin/archive/groups/page.tsx`

#### State model

- “Archived” group views are based on `Group.isActive = false`.

#### Restore

- `PATCH /api/groups/:id` with `{ isActive: true }`

#### Permanent delete

- `DELETE /api/groups/:id[?force=true]`
  - Without `force=true`, blocks deletion if the group has members and returns a `409`.
  - With `force=true`, it deletes group memberships and the group.
  - No audit logging is performed for group deletion (see Issues).

### Reconciliation Deposits

Key files:

- API delete: `app/api/reconciliation/deposits/[depositId]/route.ts`

#### Permanent delete

- `DELETE /api/reconciliation/deposits/:depositId`
  - Blocks deletion if deposit is reconciled/completed.
  - Deletes:
    - Deposit line matches
    - Deposit line items
    - Deposit row
  - Recomputes impacted revenue schedules and logs per-schedule audit entries (update) and a matching metric event.
  - No dedicated “Deposit audit” exists (see Issues).

### Sub-entities / Related Deletes

#### Opportunity line items (`OpportunityProduct`)

- `DELETE /api/opportunities/line-items/:lineItemId` (`app/api/opportunities/line-items/[lineItemId]/route.ts`)
  - Finds revenue schedules linked to the line item.
  - Blocks deletion if applied monies or deposit/reconciliation links exist for those schedules.
  - Deletes a set of related rows (activities, tickets, etc) and then deletes the revenue schedules and the line item.
  - No audit logging appears to exist for line item deletion.

#### Opportunity roles (`OpportunityRole`)

- `DELETE /api/opportunities/roles/:roleId`
  - Deletes the role row and logs an audit entry via `logAudit(...)`.

#### Revenue schedule payouts (`CommissionPayout`)

- `DELETE /api/revenue-schedules/:scheduleId/payouts/:payoutId`
  - Does **not** delete the payout row; it sets `status = Voided`.
  - Logs `AuditAction.Update` via `logRevenueScheduleAudit(...)`.

#### Admin data settings

Data settings delete endpoints are hard deletes (except revenue type “delete”, which removes a custom definition from tenant settings):

- `DELETE /api/admin/data-settings/account-types`
- `DELETE /api/admin/data-settings/product-families`
- `DELETE /api/admin/data-settings/product-subtypes`
- `DELETE /api/admin/data-settings/revenue-types`

These flows currently do not emit audit log entries (see Issues).

#### Admin users

- `DELETE /api/admin/users/:userId`
  - “Soft deletes” by setting `User.status = Disabled`
  - Terminates sessions
  - Logs an audit row via direct `prisma.auditLog.create(...)`

## Notable Issues / Risks

This section highlights issues that are likely to cause bugs, data inconsistencies, permission escalation, or user confusion.

### 1) `lib/deletion.ts` does not match the Prisma schema (code drift / dead mappings)

`lib/deletion.ts` defines `EntityStatusMappings` for `Opportunity`, `Ticket`, and `Group` using `statusField: 'deletedAt'`, but:

- `Opportunity` has no `deletedAt` field (it uses `active: boolean`).
- `Ticket` has no `deletedAt` field (it uses `status: TicketStatus`).
- `Group` has no `deletedAt` field (it uses `isActive: boolean`).

If `softDeleteEntity('Opportunity' | 'Ticket' | 'Group', ...)` were ever invoked, it would attempt to update a non-existent Prisma field and fail at runtime.

### 2) Permission checks for destructive operations are inconsistent (and sometimes too broad)

Examples:

- **Product deletion allows `products.read`**: `app/api/products/[productId]/route.ts` defines `PRODUCT_MUTATION_PERMISSIONS` including `products.read`, and uses `hasAnyPermission(...)` to grant mutation/delete access. This likely allows users with read-only access to delete products.
- **Group deletion can be authorized by accounts permissions**: `app/api/groups/[id]/route.ts` uses `withPermissions(..., ['groups.manage','groups.delete','accounts.manage','accounts.delete'])` with ANY-of semantics, so `accounts.manage` alone can satisfy the permission gate.
- **Revenue schedule delete is role-code based**, not permission-based: `app/api/revenue-schedules/[revenueScheduleId]/route.ts` requires role codes `admin` or `accounting`, ignoring explicit permission grants.
- **`bypassConstraints` is not permission-gated**: Accounts, Contacts, and Opportunities accept `bypassConstraints=true` in the query string. This can let users override guardrails that are intended to prevent inconsistent states.

### 3) “Archive” is overloaded and inconsistent across modules

Admin → Archive pages are not consistently “deleted records”:

- Accounts/Contacts/RevenueSchedules: true soft delete markers (`Archived` / `deletedAt`)
- Opportunities/Products/Groups: “inactive” records
- Tickets/Activities: “closed/completed” records

This makes “Restore” mean different things (clear deletedAt vs set active=true vs reopen status).

### 4) Contacts: “active” semantics appear incorrect in the Contacts list API

`app/api/contacts/route.ts` sets:

- `active: contact.isPrimary` with a comment “Use isPrimary as the ‘active’ indicator”.

This does not align with the actual soft-delete mechanism for contacts (`deletedAt`). It also appears to drive UI behavior that “deactivates” contacts by setting `isPrimary=false` rather than using `deletedAt`.

This is likely to produce confusing UI (a non-primary contact looks “inactive”, even if it is not deleted).

### 5) Contacts delete constraints appear incorrect / overly restrictive

`app/api/contacts/[id]/route.ts` blocks contact soft deletion if the *contact’s account* has opportunities:

- It counts opportunities by `accountId = existingContact.accountId` and uses that to block deleting the contact.

This ties contact deletion to unrelated account-level opportunities and likely blocks legitimate deletes.

### 6) Constraints payload shape is not consistent across endpoints

The shared delete dialog expects constraints shaped like `DeletionConstraint` (`{ entity, field, count, message }`).

- Opportunity and account delete flows use this shape.
- Group deletion returns `constraints: [{ type, count, message }]` instead, which is incompatible with the shared constraint UI and can lead to generic failures if a caller tries to display them.

### 7) Permanent delete paths may violate data-retention expectations and/or still fail FK constraints

Examples:

- Contact permanent delete deletes all activities for the contact and group memberships, but does not address other relations like:
  - `ContactPreference`
  - `OpportunityRole.contactId`
  This can still cause FK constraint failures (500s) or requires manual cleanup elsewhere.

- Opportunity line item delete deletes revenue schedules and also deletes related activities/tickets rather than detaching references. This can remove significant history in a way users may not expect.

### 8) Audit logging coverage is incomplete and inconsistent

Some deletions are audited (accounts, contacts, opportunities, products, revenue schedules, activities, opportunity roles), while others are not (tickets, groups, data settings deletes, opportunity line item deletes, deposit deletes as a deposit event).

Additionally, some routes write `AuditLog` entries directly with shapes different from `lib/audit.ts` helpers, which can complicate the History tab and reporting.

### 9) Opportunity “soft delete” (deactivation) does not normalize stage/status

Opportunities are deactivated via `active=false`, but the API does not force stage/status to a “lost” terminal value. Some UI code locally sets `status = Lost` when toggling active, which can lead to UI/backend divergence.

## Recommendations (Practical Next Steps)

If you want to reduce risk and make deletes predictable, the highest-leverage improvements would be:

1. **Define a single deletion policy per entity** (soft delete marker vs inactivation vs hard delete) and align UI labels (“Archive”, “Inactive”, “Deleted”) to the actual data model.
2. **Harden permissions for destructive operations**:
   - Require explicit `*.delete` for hard delete and for bypassing constraints.
   - Avoid broad ANY-of permission checks that include read permissions.
3. **Standardize API contracts** for deletion:
   - Consistent patterns for soft delete, permanent delete, and restore across entities (including consistent error shapes for constraints).
4. **Make audit logging consistent**:
   - Ensure all delete/permanent delete/restore/void operations create audit entries with consistent JSON shape.
5. **Fix contact “active” semantics**:
   - Stop using `isPrimary` as an “active” indicator; treat `deletedAt` as the source of truth for deletion state.
6. **Review permanent delete cascades**:
   - Either add explicit FK-aware cleanup (or `onDelete` strategies) or block deletes with clear 409 responses listing dependencies to resolve.
