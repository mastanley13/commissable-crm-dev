# Other Field Schema Unification Plan (Vendor/Distributor -> Other)

## Executive summary

We will move from vendor/distributor-specific columns to unified "Other" columns in the database, while keeping a UI patch that continues to show the normalized "Other - ..." labels. This is an additive-first migration: add new "Other" columns, backfill vendor-first values, update APIs and UI to read/write the new columns, and only later deprecate legacy vendor/distributor columns.

## Goals

- Store unified "Other" values in the database (not just UI-level fallbacks).
- Keep vendor-first precedence when both vendor and distributor values exist.
- Preserve backwards compatibility during the transition.
- Update UI to read from "Other" columns without changing user-facing labels.

## Non-goals (for the first release)

- Immediate removal of legacy vendor/distributor columns.
- Destructive migrations without a rollback window.

## Proposed phases

### Phase 0 - Scope and field list

- Confirm canonical "Other" fields and the tables they apply to (Product, Opportunity, RevenueSchedule, DepositLineItem, etc.).
- Confirm precedence rule: Other = Vendor-first, then Distributor.
- Decide whether to include "Other - Source" and where it should live (DB column vs computed).

### Phase 1 - Schema changes (additive)

- Add new columns for unified fields, for example:
  - accountIdOther, customerIdOther, orderIdOther
  - productNameOther, partNumberOther, productDescriptionOther
  - optional otherSource
- Keep legacy vendor/distributor columns intact.
- Add indexes if "Other" fields are used in filters or matching.

### Phase 2 - Data backfill

- Backfill Other values using vendor-first precedence:
  - other = vendor if present, else distributor
- Populate otherSource to indicate where the value came from (Vendor or Distributor).
- Add an idempotent backfill job so it can be rerun safely.

### Phase 3 - API and import updates

- Update API responses to include the new "Other" fields as primary values.
- Update API writes to set both:
  - Other columns (primary)
  - legacy vendor/distributor columns (compatibility, optional)
- Update import/mapping logic to write to Other columns first.

### Phase 4 - UI patch

- Update dynamic tables, column chooser, and detail views to bind to "Other" columns (not vendor/distributor).
- Keep labels consistent with the normalized "Other - ..." naming.
- Keep vendor/distributor columns hidden or removed from UI, but retain legacy IDs for preferences where needed.

### Phase 5 - Deprecation and cleanup

- Monitor usage and confirm no dependencies on legacy columns.
- Remove or archive vendor/distributor columns in a later migration.
- Remove compatibility write paths once safe.

## Rollout and rollback

- Roll out as additive changes (no destructive drops).
- If needed, rollback by restoring UI to read legacy columns and disabling writes to Other.
- Keep backfill job available for re-run during rollout.

## QA checklist (high level)

- UI labels match column chooser and detail views.
- Filters/search work using the new "Other" columns.
- Import and reconciliation mapping still behave as expected.
- Legacy templates and saved column preferences still load correctly.
