# Plan: Enforce “Roles tab” requirement on Opportunity Imports (RB-OPP-001)

## Context
Ticket **RB-OPP-001** requires that an Opportunity cannot be saved/updated unless it has at least one **active Role** (the rows shown in the **Opportunity Detail → Roles** tab).

The interactive UI + public Opportunity APIs already enforce this constraint, but the **Admin Data Settings Import** path can currently create/update Opportunities without creating any `OpportunityRole` rows.

This plan updates the import pipeline so that **any import row that creates or updates an Opportunity must also supply at least one Role**, and the import will create (or ensure) an active `OpportunityRole` row accordingly.

## Goal
- Prevent imports from creating/updating Opportunities unless a Role is provided.
- Ensure the import results in at least one active `OpportunityRole` for the Opportunity.
- Keep imports reasonably idempotent (re-importing the same file does not create duplicate roles).

## Non-goals (v1)
- Importing multiple roles per Opportunity in a single row (can be added later).
- Auto-creating Contacts during Opportunity import (Contacts should be imported/created first).

## Current behavior (baseline)
- `POST /api/opportunities` requires `roles` and creates `OpportunityRole` rows.
- `PATCH /api/opportunities/:id` rejects updates when there are zero active roles (except the “deactivate” payload).
- **Admin imports** (`app/api/admin/data-settings/imports/route.ts`) create/update Opportunities directly via Prisma and do not create roles.

## Proposed behavior (v1)
For the **Opportunities** import entity:
- If the row will be **skipped** (existing record and `upsertExisting=false`): no change.
- If the row will **create or update** an Opportunity:
  - Import must include a valid Role selection (see **Required import fields**).
  - Import will ensure at least one active `OpportunityRole` exists after the operation:
    - If a matching role already exists (same `contactId` + `role`, active), do nothing.
    - Otherwise, create a new `OpportunityRole` row using the Contact snapshot.

## Required import fields
Add these fields to the **Opportunities** import entity definition:
- `roleName` (required): the “Role” column value (e.g., “Decision Maker”, “Buyer”).
- `roleContactEmail` (conditionally required): used to find the Contact to attach.
  - v1 recommendation: make it **required** for simplicity and data integrity.

Optional (if we decide to support non-email matching in v1):
- `roleContactFirstName`
- `roleContactLastName`

### Contact matching rule
Preferred v1 rule:
- Match Contact by `accountName` + `roleContactEmail` (case-insensitive), `deletedAt=null`.

Optional extension:
- If email is blank, match by `accountName` + `roleContactFirstName` + `roleContactLastName` (case-insensitive), mirroring existing contact-import logic.

If no Contact match is found, the row fails with a business-rule error (importer should create/import the Contact first).

## Implementation steps

### 1) Update import catalog (field definitions)
Files:
- `lib/data-import/catalog.ts`

Changes:
- In the `opportunities` entity definition, add:
  - `roleName`
  - `roleContactEmail`
  - (optional) `roleContactFirstName`, `roleContactLastName`
- Mark `roleName` required.
- Decide whether `roleContactEmail` is required in the catalog (recommended: yes for v1).

Acceptance:
- Admin import UI shows the new fields for mapping.
- “Required field” validation reflects the updated requirements.

### 2) Enforce roles inside the Opportunity import handler
Files:
- `app/api/admin/data-settings/imports/route.ts`

Add parsing/validation to `importOpportunityRow(...)`:
- Determine whether the row would be skipped (existingId && !options.upsertExisting). If skipped, return `{status:"skipped"}` before role validation.
- Validate:
  - `roleName` is non-empty.
  - `roleContactEmail` is non-empty (if required) and normalizes to a valid email format (reuse `normalizeEmail` helper).
- Lookup the Contact ID:
  - Reuse the existing `getContactIdByMatchKey(...)` helper pattern, or add a dedicated `getContactIdByEmailForAccount(...)`.
  - Ensure `deletedAt=null`.
- If Contact not found: return row failure with `field="roleContactEmail"` and `errorType="business_rule"`.

Create/update Opportunity + ensure Role in a single transaction:
- Use `prisma.$transaction(async tx => { ... })`:
  - Create or update the Opportunity (existing code).
  - Ensure at least one active role exists:
    - Check for an existing active role matching `(tenantId, opportunityId, contactId, roleName)`.
    - If missing:
      - Load the Contact snapshot fields needed for `OpportunityRole` (`fullName`, `jobTitle`, `emailAddress`, `workPhone`, `workPhoneExt`, `mobilePhone`).
      - Create `OpportunityRole` with `active=true`, `createdById=context.userId`.

Idempotency rule:
- Re-running the same import should not create duplicates for the same `(opportunityId, contactId, roleName)` when an active row already exists.

Acceptance:
- Import row that creates/updates an Opportunity without role fields fails with a clear error.
- Import row with valid role fields creates/updates Opportunity and produces at least one active role.
- Re-importing the same file does not create duplicate active role rows.

### 3) Optional: protect against legacy “role-less” updates
Decision:
- If we set `roleContactEmail` required in the catalog, every update row must map a role/contact, which enforces the requirement uniformly.
- If we allow role fields to be optional for updates, then:
  - Updates are allowed only if the target Opportunity already has at least one active role.
  - Otherwise the row fails and instructs user to provide role fields.

Recommendation for the ticket wording (“imports can only create/update … with a Role selected”):
- Make role fields required for any non-skipped row (create/update).

### 4) Tests
Add tests (recommended) to prevent regressions.

Targets:
- Import route behavior for `entityType="opportunities"`.

Cases:
- Create opportunity row without `roleName`/`roleContactEmail` ⇒ error.
- Create opportunity row with role fields but missing Contact ⇒ error.
- Create opportunity row with role fields + existing Contact ⇒ success; role row exists.
- Update existing opportunity with role fields ⇒ success; role ensured.
- Idempotency: import same row twice ⇒ only one active role for that tuple.

### 5) Documentation / templates
Update any import templates/help text so users know:
- Opportunities import requires a Role and a Contact (by email) to be provided.
- Contacts should be imported first if needed.

## Rollout checklist
- Update Admin import UI field list (catalog).
- Deploy backend enforcement.
- Communicate breaking change to any teams using legacy opportunity import files.
- (Optional) Run a one-time report to find Opportunities with zero active roles and remediate (manual add role, or scripted backfill if approved).

## Open decisions
- Should we require `roleContactEmail` (simplest) or support name-based matching as fallback?
- Should updates require role fields even if the Opportunity already has roles?
- Do we need to support multiple roles per Opportunity row (e.g., delimited list or `role2*` columns) in v1, or defer?

