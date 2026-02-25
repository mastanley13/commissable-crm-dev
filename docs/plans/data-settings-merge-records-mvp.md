# MVP Plan: Admin -> Data Settings -> Merge Records (Accounts + Contacts)

## Summary

Add an **Admin-only** "Merges" page under **Admin -> Data Settings** that lets authorized users merge duplicate:

- **Accounts** (and re-parent all related objects to the surviving account)
- **Contacts** (and re-parent all related objects to the surviving contact)

The merge is **transactional**, **audited**, and uses **soft-merge** semantics (the source record is retained but marked as merged into the target).

## Goals (V1 / MVP)

- Provide a safe UI to select a **Target (survivor)** and **Source (to merge)**.
- Provide a **preview** of:
  - Field-level conflicts (target value vs source value)
  - Related-record counts that will be re-parented
  - Potential collisions (e.g., ContactPreference unique rows)
- Execute merge as a **single database transaction**.
- Enforce permissions (new permission) and write an **AuditLog** entry.
- Default behavior:
  - **Target wins** for conflicting fields
  - **Fill blanks**: if target field is empty and source has a value, copy source
  - User can override per-field in the UI for a defined set of fields

## Non-goals (explicitly out of scope for MVP)

- Automated duplicate detection / suggested merges
- "Undo merge" (we'll design to be recoverable, but no one-click undo in V1)
- Bulk merges (CSV-based or multi-select)
- Cross-tenant merges
- Cross-object merges (e.g., Account -> Contact)
- Perfect dedupe of child records (V1 focuses on re-parenting and clear collision handling)

## Definitions

- **Target**: the record that remains the canonical entity after merge.
- **Source**: the record being merged into the target.
- **Soft-merge**: keep the source row, but mark it as merged (and hide it from normal UX).

## Why soft-merge (recommended)

Soft-merge is safer in CRMs because:

- it preserves an audit trail and historical references
- external integrations/bookmarks can still resolve the old ID (we can redirect to the survivor)
- it reduces the blast radius compared to hard deletes

## Data model changes (Prisma)

### 1) Account: add merge metadata

Add to `model Account`:

- `mergedIntoAccountId String? @db.Uuid`
- `mergedAt DateTime?`
- `mergedById String? @db.Uuid`

Relations:

- `mergedIntoAccount Account? @relation("AccountMergedInto", fields: [mergedIntoAccountId], references: [id])`
- `mergedAccounts Account[] @relation("AccountMergedInto")`

Indexes:

- `@@index([tenantId, mergedIntoAccountId])`
- Consider `@@index([tenantId, mergedAt])`

### 2) Contact: add merge metadata

Add to `model Contact`:

- `mergedIntoContactId String? @db.Uuid`
- `mergedAt DateTime?`
- `mergedById String? @db.Uuid`

Relations:

- `mergedIntoContact Contact? @relation("ContactMergedInto", fields: [mergedIntoContactId], references: [id])`
- `mergedContacts Contact[] @relation("ContactMergedInto")`

Indexes:

- `@@index([tenantId, mergedIntoContactId])`
- Consider `@@index([tenantId, mergedAt])`

### 3) Audit log: add a merge action (optional but recommended)

Current `enum AuditAction` includes: `Create | Update | Delete | Import | Export | Login`.

Option A (recommended): add `Merge` to `AuditAction`.

Option B (no schema change): write an `Update` entry with `metadata.action="merge"` and rich metadata.

## Permissions / RBAC

Add a permission code:

- `admin.data_settings.merge`

Enforce it on both preview and execute endpoints (same pattern as `withPermissions()` used in other Data Settings admin routes).

## UX / UI design (Admin -> Data Settings)

### Entry point

Add a third left-nav item under Data Settings:

- **Merges** (icon suggestion: `GitMerge` from lucide-react)

Implementation approach (recommended for MVP):

- Keep the `/admin/data-settings` route and add a new in-page section (consistent with existing Data Settings layout).
- Create a new component `components/data-settings-merges-section.tsx` to avoid further growing `app/(dashboard)/admin/data-settings/page.tsx`.

### Merge flow (Accounts + Contacts)

1. **Select object type**: `Accounts` or `Contacts`
2. **Pick Target**: searchable typeahead (exclude already-merged records)
3. **Pick Source**: searchable typeahead (exclude already-merged records)
4. **Preview**
   - Side-by-side "Target vs Source" key fields
   - Related-record counts that will move
   - Collision warnings (see "Collision handling")
5. **Resolve field conflicts**
   - Default to `target` (with "fill blanks")
   - Allow per-field override for a curated set of fields
6. **Confirm**
   - Two-step confirmation (modal + type-to-confirm, e.g. `MERGE`)
7. **Result**
   - Success summary: moved counts + audit log reference
   - Link to survivor record

### UI safety requirements

- Hard-disable merge when:
  - `targetId === sourceId`
  - records are in different tenants
  - either record has `mergedInto*Id != null`
- Always show a final "irreversible" warning (even if we later implement "undo").

## API design (Next.js Route Handlers)

Create routes under `app/api/admin/data-settings/merges/`:

### 1) Preview endpoint

`POST /api/admin/data-settings/merges/preview`

Body:

```json
{
  "entity": "Account" | "Contact",
  "targetId": "uuid",
  "sourceId": "uuid"
}
```

Returns (example shape):

```json
{
  "entity": "Account",
  "target": { "id": "...", "displayLabel": "...", "fields": { "accountName": "..." } },
  "source": { "id": "...", "displayLabel": "...", "fields": { "accountName": "..." } },
  "fieldConflicts": [{ "field": "supportEmail", "target": "a@x.com", "source": "b@y.com" }],
  "relatedCounts": [{ "label": "Contacts", "count": 12 }],
  "collisions": [{ "type": "contactPreference", "message": "Both contacts have Email preference rows" }]
}
```

Notes:

- Preview should use the same "business rules" as execute (so the UI preview can be trusted).
- Preview should be fast; it should mostly be `count()` queries + small field selections.

### 2) Execute endpoint

`POST /api/admin/data-settings/merges/execute`

Body:

```json
{
  "entity": "Account" | "Contact",
  "targetId": "uuid",
  "sourceId": "uuid",
  "fieldWinners": {
    "accountName": "target",
    "supportEmail": "source"
  },
  "dryRun": false
}
```

Returns:

```json
{
  "ok": true,
  "entity": "Account",
  "targetId": "uuid",
  "sourceId": "uuid",
  "moved": [{ "label": "Contacts", "count": 12 }],
  "auditLogId": "uuid"
}
```

Execution should support:

- `dryRun=true`: run validations and compute counts/collisions, but do not modify data.
- Idempotency: if the source is already merged into the target, return success (or a dedicated "already merged" response).

## Backend implementation details (Prisma)

### Transaction + locking

Execute merges in a single transaction:

- `await prisma.$transaction(async (tx) => { ... })`
- Use row-level locks to prevent concurrent merges of the same records:
  - `SELECT ... FOR UPDATE` via `tx.$queryRaw` on the target + source rows

### Canonical "merge metadata" behavior

On success:

- Source: set `mergedInto*Id`, `mergedAt`, `mergedById`
- Target: update any chosen fields (winners + fill blanks)

Also recommended:

- Update `updatedAt` / `updatedById` fields where present

### Field merging rules (default)

1. If user chose a winner for a field, use it.
2. Else if target is empty and source is not empty, copy source (fill blanks).
3. Else keep target.

Define "empty" per type:

- strings: `null | ""`
- numbers: `null` only (do not treat `0` as empty)
- booleans: `null` only (if nullable)
- dates: `null` only

### Relationship re-parenting (what moves)

#### Account merge: update all references from `sourceAccountId -> targetAccountId`

At minimum (recommended for MVP, based on current schema):

- `Contact.accountId`
- `Activity.accountId`
- `Opportunity.accountId`
- `RevenueSchedule.accountId` (and related distributor/vendor account fields if used)
- `Ticket.accountId` (and distributor/vendor account fields if used)
- `AccountAssignment.accountId`
- `AccountNote.accountId`
- `GroupMember.accountId` (if used)
- `Product.distributorAccountId` / `vendorAccountId` (if these represent account ownership)
- `Reconciliation.accountId` (if present)
- `Deposit.accountId` and distributor/vendor variants (if used)
- `DepositLineItem.accountId` and vendor variant (if used)
- `ReconciliationTemplate` distributor/vendor variants (if used)

Also handle Account self-relations:

- If `source.parentAccountId` is set and `target.parentAccountId` is not, consider copying (fill blanks rule).
- Reassign children: if any accounts have `parentAccountId = source`, move them to `target` (or leave them—pick one rule and be consistent).

#### Contact merge: update all references from `sourceContactId -> targetContactId`

Based on current schema:

- `Activity.contactId`
- `Ticket.contactId`
- `OpportunityRole.contactId` (if present)
- `ContactPreference.contactId`
- `GroupMember.contactId` (if used)
- `Deposit.createdByContactId` (if used)
- Contact self-relations:
  - `Contact.reportsToContactId`: move direct reports from source to target, and decide what to do if that creates a cycle

### Collision handling (MVP policy)

Collisions are cases where re-parenting would violate a unique constraint or creates ambiguous duplicates.

MVP recommended policy:

- **Detect collisions in preview** and show them clearly.
- **Block execution** when a collision would violate DB constraints.
- For a small number of known collision types, implement deterministic resolution:

Examples:

- `ContactPreference @@unique([contactId, channel])`
  - If both source and target have a preference for the same channel:
    - Keep target row
    - Optionally copy any "notes/consent" fields if target is blank
    - Delete source row (safe because it's subordinate data), and record what happened in audit metadata

If the team prefers "no deletes at all in MVP", then block and require manual cleanup instead.

## Data access / "hide merged records"

Once soft-merge fields exist, update list/search queries so merged records are excluded by default:

- Accounts queries: `where: { mergedIntoAccountId: null }`
- Contacts queries: `where: { mergedIntoContactId: null, deletedAt: null }`

Also consider adding UI behavior:

- If a user navigates to a merged record detail page, show a banner and link to the survivor.

## Testing plan

### Backend tests (integration)

Add integration tests that:

- merge two accounts:
  - moves contacts + other re-parented relations
  - applies field merge rules
  - sets source merge metadata
  - writes audit log
- merge two contacts:
  - moves activities/tickets/preferences/etc
  - resolves/blocks collisions as defined
- enforces permission `admin.data_settings.merge`
- prevents cross-tenant merges
- idempotency: merging again returns success/"already merged"

### Frontend tests (optional for MVP)

- smoke test for rendering the Merges section and happy-path flow (if there's an existing UI test setup)

## Rollout plan (safe launch)

- Add behind a feature flag (tenant setting) if desired.
- Restrict permission to a small admin group initially.
- Log all merges with enough metadata to diagnose issues quickly.
- Add a short runbook for admins: how to choose survivor, how to verify results, and what to do on a blocked merge.

## Implementation checklist (file-level)

### Database

- Update `prisma/schema.prisma` (add merge fields + optional `AuditAction.Merge`)
- Run migration and regenerate client

### Backend (API)

- Add:
  - `app/api/admin/data-settings/merges/preview/route.ts`
  - `app/api/admin/data-settings/merges/execute/route.ts`
- Reuse `withPermissions()` and tenant resolution patterns from existing admin routes.
- Implement merge services in `lib/` (recommended):
  - `lib/merge/account-merge.ts`
  - `lib/merge/contact-merge.ts`

### Frontend (Admin UI)

- Update `app/(dashboard)/admin/data-settings/page.tsx` to include a `merges` section
- Add new component:
  - `components/data-settings-merges-section.tsx`
- Add reusable UI pieces:
  - record picker (typeahead)
  - conflict table
  - confirm dialog

### Docs

- Add a short runbook under `docs/runbooks/` once the feature is live.

## Open questions (decide before implementation)

1. Should the merge re-parent **all** Account relationships in the schema in V1, or only Contacts + core CRM objects (Opportunities/Activities/Tickets)?
2. For Account merge: what is the expected behavior for **parent/child accounts**?
3. For Contact merge: what is the expected behavior for **reports-to** relationships (avoid cycles)?
4. Collision policy preference:
   - "Block on any collision" (simplest + safest)
   - "Auto-resolve known collisions" (better UX, slightly more risk)
