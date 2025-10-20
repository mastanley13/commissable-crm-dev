# Opportunity Stages — Update Plan

This plan updates Opportunity stages to match the requested set and adds automation rules driven by Opportunity Product statuses.

## Target Stages (codes → labels)

- `Qualification` → Qualification
- `Discovery` → Discovery
- `Proposal` → Proposal
- `Negotiation` → Negotiation
- `OnHold` → On Hold
- `ClosedLost` → Closed Lost
- `ClosedWon_Provisioning` → Closed Won – Provisioning
- `ClosedWon_Billing` → Closed Won – Billing
- `ClosedWon_BillingEnded` → Closed Won – Billing Ended

Notes
- Replace the prior label “Closed Won” with “Closed Won – Provisioning”.
- Display labels use spaces and an en dash; internal codes use `PascalCase` with underscores where needed.

## Business Rules

- Stage ↔ Status consistency
  - Stages Qualification/Discovery/Proposal/Negotiation → Status `Open`.
  - Stage On Hold → Status `OnHold`.
  - Any `ClosedWon_*` stage → Status `Won`.
  - Stage Closed Lost → Status `Lost`.

- Product-driven automation
  - If any Opportunity Product has status `ActiveBilling`, set Opportunity stage to `ClosedWon_Billing`.
  - If all existing Opportunity Products are `BillingEnded` (ignoring Cancelled/Inactive), set stage to `ClosedWon_BillingEnded`.
  - Otherwise, if Opportunity is Won and no product is `ActiveBilling`, keep stage `ClosedWon_Provisioning`.

- Guardrails
  - While any product is `ActiveBilling`, do not allow manual change away from `ClosedWon_Billing`.
  - Do not allow manual set to `ClosedWon_BillingEnded` unless all products are `BillingEnded`.
  - Recalculate stage after any product create/update/delete affecting product status.

Edge cases
- No products + closed won: keep `ClosedWon_Provisioning` until a product enters billing or all products (if later added) end billing.
- Mixed statuses: `ActiveBilling` takes precedence over `BillingEnded` until all products are ended.
- Reopening: if a new product returns to `ActiveBilling` after Billing Ended, stage returns to `ClosedWon_Billing`.

## Data Model Changes (Prisma + DB)

1) Expand `OpportunityStage` enum
- File: `prisma/schema.prisma:941`
- Add values: `OnHold`, `ClosedWon_Provisioning`, `ClosedWon_Billing`, `ClosedWon_BillingEnded`.
- Keep existing values; deprecate UI use of `ClosedWon` by migrating data to `ClosedWon_Provisioning`.

2) Add `OpportunityProductStatus` enum and field
- New enum: `enum OpportunityProductStatus { Provisioning ActiveBilling BillingEnded Cancelled }`.
- Model: add `status OpportunityProductStatus @default(Provisioning)` to `model OpportunityProduct` (see `prisma/schema.prisma:455`).
- Transitional mapping: set `status = ActiveBilling` where current `opportunityProduct.active = true`; set `status = BillingEnded` where `active = false` and (optionally) `revenueEndDate IS NOT NULL`.

3) Migration plan (Postgres)
- Create Prisma migration adding the new enum values to `OpportunityStage` and adding the new `OpportunityProductStatus` + column to `OpportunityProduct`.
- Data backfill steps (SQL):
  - Update opportunities currently at `ClosedWon` → `ClosedWon_Provisioning`.
  - Derive `OpportunityStatus` from stage per rules above to normalize records.
  - Backfill product statuses from the existing `active` boolean.

4) Ordering for UI
- Do not rely on Postgres enum order; expose explicit display order in UI.

## Backend Changes (API + Services)

- Central stage calculator
  - Add `lib/opportunities/stage.ts` with:
    - `deriveStatusFromStage(stage): OpportunityStatus`
    - `deriveStageFromProducts(opportunityId): Promise<OpportunityStage>`
    - `recalculateOpportunityStage(opportunityId): Promise<void>`

- Invoke recalculation
  - After product create: `app/api/opportunities/[opportunityId]/line-items/route.ts:66`.
  - After product update/delete: `app/api/opportunities/line-items/[lineItemId]/route.ts:66`, `app/api/opportunities/line-items/[lineItemId]/route.ts:252`.
  - After opportunity PATCH when stage/status is changed manually: `app/api/opportunities/[opportunityId]/route.ts:1` (apply guardrails + normalization).

- Validation updates
  - `app/api/opportunities/route.ts:73` and `app/api/opportunities/[opportunityId]/route.ts:1`: allow new stage values and enforce guardrails.

- Mapping helpers
  - `app/api/opportunities/helpers.ts:261` keep `normalizeStatus` but ensure status gets set from stage on read/write paths.

## Frontend Changes (UI)

- Centralize stage options and labels
  - Create `lib/opportunity-stage.ts` with:
    - `OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string>` mapping codes to display labels (use en dash for Closed Won variants).
    - `OPPORTUNITY_STAGE_ORDER: OpportunityStage[]` for display order.

- Update stage dropdowns
  - `components/account-opportunity-create-modal.tsx:30` (Object.values) → use centralized options + labels; include `Discovery` and `OnHold`.
  - `components/contact-opportunity-create-modal.tsx:43` (hardcoded list) → replace with centralized options. Remove legacy `ClosedWon` label.
  - `components/opportunity-details-view.tsx:41` (Object.values) → use centralized options + labels.

- Disable/annotate auto-managed stages
  - In edit/create UIs, display all stages but disable `ClosedWon_Billing` and `ClosedWon_BillingEnded` with tooltip: “Set automatically by product billing status.”

- List and filters
  - `app/(dashboard)/opportunities/page.tsx:1`: ensure filters show friendly labels for new stages. No API change needed since filtering uses enum strings.

## Data Migration & Backfill

Sequence
1) Deploy migration adding enum values and product status column.
2) Backfill stages
   - `ClosedWon` → `ClosedWon_Provisioning`.
3) Backfill product statuses from `active` boolean (temporary heuristic).
4) Recalculate opportunity stage for all records where status is `Won` or stage is a `ClosedWon_*` value:
   - If any line item `ActiveBilling` → `ClosedWon_Billing`.
   - Else if all line items `BillingEnded` (ignoring Cancelled) → `ClosedWon_BillingEnded`.
   - Else → `ClosedWon_Provisioning`.
5) Normalize `OpportunityStatus` from stage across all records.

Artifacts
- Migration SQL in `prisma/migrations/**`.
- Optional script `scripts/backfill-opportunity-stages.ts` to run recalculation idempotently.

## Safeguards & Policies

- Deletion protection
  - If stage is `ClosedWon_Billing`, disallow deletion (“Billing stage protected”).
  - If stage is `ClosedWon_BillingEnded`, require elevated permission or explicit confirmation.

- Close dates
  - When moving into any `ClosedWon_*` for the first time, set `actualCloseDate` if not set.

- Audit trail
  - Log actor, from→to stage, and reason (“product status change”) when auto-updating stages.

## Acceptance Criteria

- New stages are selectable/visible per spec and ordered logically.
- Stage labels in UI match exactly (including en dash) with internal codes mapped correctly.
- If any product is Active – Billing, the Opportunity shows `Closed Won – Billing` and cannot be set to Provisioning.
- If all products are Billing Ended, the Opportunity shows `Closed Won – Billing Ended`.
- Closing an Opportunity sets `Closed Won – Provisioning` when there is no active billing.
- Status mirrors stage consistently (Open/On Hold/Won/Lost) across list, detail, and API.

## Open Questions

1) No products scenario: When there are no products yet, should we ever mark `Closed Won – Billing Ended`, or always keep `Closed Won – Provisioning` until at least one product existed and ended?
2) Cancelled products: Should a cancelled product count toward the “all Billing Ended” condition, or be ignored like inactive?
3) Manual overrides: Do you want `Closed Won – Billing` and `Closed Won – Billing Ended` to be fully auto-managed (non-selectable), or selectable with a confirmation that they may be auto-overridden?
4) `OpportunityStatus.OnHold`: Keep as-is for reporting compatibility, or simplify `OpportunityStatus` to only `Open/Won/Lost` and derive On Hold exclusively from stage?
5) Migration heuristic: Is mapping `active=true` → `ActiveBilling` an acceptable temporary approximation for backfill?

## Rollout Plan

- Feature flag: gate auto-calculation behind a flag for a short bake-in period.
- Migrate + backfill in off-hours; snapshot DB beforehand.
- Release UI toggled to new labels first; enable automation after validation.
- Rollback: revert to prior labels and disable automation; data is preserved since we only add enum values.

## Impacted Files (start lines)

- `prisma/schema.prisma:941` — add stage enum values
- `prisma/schema.prisma:455` — add `OpportunityProduct.status` + new enum
- `app/api/opportunities/route.ts:73` — stage validation supports new values
- `app/api/opportunities/[opportunityId]/route.ts:1` — enforce guardrails and normalize status from stage
- `app/api/opportunities/[opportunityId]/line-items/route.ts:66` — recalc stage after product create
- `app/api/opportunities/line-items/[lineItemId]/route.ts:66` — recalc after product update
- `app/api/opportunities/line-items/[lineItemId]/route.ts:252` — recalc after product delete
- `app/api/opportunities/helpers.ts:261` — status normalization remains compatible
- `components/account-opportunity-create-modal.tsx:30` — use centralized stage options/labels
- `components/contact-opportunity-create-modal.tsx:43` — replace hardcoded stage list
- `components/opportunity-details-view.tsx:41` — use centralized stage options/labels
- `app/(dashboard)/opportunities/page.tsx:1` — friendly labels in filters and table
- `scripts/add-contact-test-data.ts:69` — no change required beyond new enum availability

## Implementation Notes

- Prisma + Postgres enum alterations: adding enum values is straightforward; if enum order is important, use UI-controlled order instead of relying on DB enum order.
- Keep changes backward-compatible: existing API consumers using `ClosedWon` should be migrated to `ClosedWon_Provisioning` label in UI.
- Centralize label mapping to avoid multiple hardcoded lists.

