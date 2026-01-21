# Deposit Upload - DB Field Mapping Plan (DepositLineItem persisted fields)

## Background (current limitation)

Per `docs/guides/deposit-upload.md`, the current Deposit Upload import path only ingests the **canonical fields** defined in `lib/deposit-import/fields.ts`. Extra/custom columns can be selected in the mapping UI and saved to template config, but they are not persisted into dedicated `DepositLineItem` columns unless they map to a canonical field.

## Goal

1. Transition the Deposit Upload mapping system from a hardcoded canonical field list (`lib/deposit-import/fields.ts`) to a **DB-backed set of allowed destination fields**, primarily persisted `DepositLineItem` columns.
2. Expand the mapping dropdown so users can map file columns to **Deposit**, **DepositLineItem**, **Opportunity**, and **Product** fields/columns (with clear behavior for how those targets persist and/or contribute to reconciliation matching).
3. Preserve backward compatibility with existing templates and imports.

## Non-goals (to confirm)

- Automatically creating/updating Opportunities and Products from deposit uploads (unless explicitly desired).
- Making every DB column mappable (we need a safe allowlist; many columns are internal or computed).

## Key product decisions (answer these first)

1. When a user maps to an **Opportunity** field:
   - **Option A (recommended initially):** persist the raw value onto the created `DepositLineItem` (if the column exists) or into `DepositLineItem.metadata` under an `opportunity` namespace.
   - **Option B:** use it as a lookup key to find an Opportunity / RevenueSchedule and set `DepositLineItem.primaryRevenueScheduleId`.
   - **Option C:** upsert an Opportunity record (highest risk).
2. When a user maps to a **Product** field:
   - **Option A (recommended initially):** persist raw value into `DepositLineItem` (when available) or `DepositLineItem.metadata.product`.
   - **Option B:** use it as a lookup to set `DepositLineItem.productId`.
   - **Option C:** upsert a Product record (highest risk).
3. Which fields are required for a valid import?
   - Today: `usage` and `commission`. Confirm whether that remains the minimum.

## Proposed technical approach (phased)

### Phase 1 — Inventory + field catalog (server-authoritative)

1. **Inventory current persisted targets**
   - Enumerate which `DepositLineItem` columns are safe to set during import (scalar fields only; exclude IDs, tenantId, foreign keys unless explicitly supported, computed/allocation fields, status/reconciled fields).
   - Enumerate which `Deposit` columns are safe to set from the file (likely none or a small subset like `depositName` if you want it file-driven).
2. **Define a “Deposit Upload Field Catalog”**
   - A structured allowlist of mapping targets grouped by entity:
     - `DepositLineItem.<column>`
     - `Deposit.<column>`
     - `Opportunity.<column>` (either “stored for matching” or “lookup only”, depending on decision)
     - `Product.<column>` (same)
   - Each target needs:
     - `id` (stable identifier stored in templates)
     - `entity` + `columnName`
     - `label` (UI)
     - `dataType` (string/number/date/boolean)
     - `persistence` behavior: `depositLineItemColumn | depositColumn | metadata | lookup`
     - `required?` (business requirement)
3. **Expose the catalog to the UI**
   - Add an API endpoint (e.g. `GET /api/reconciliation/deposits/import-field-catalog`) that returns the catalog so the UI dropdown is always in sync with server allowlist.

Deliverable: a single authoritative list of mapping targets, typed and grouped, that the client consumes.

### Phase 2 — Mapping model v2 (template + import payload)

1. **Introduce `DepositMappingConfigV2`**
   - Replace “canonical field id” destinations with explicit DB-target identifiers from the catalog.
   - Keep V1 parsing for backwards compatibility; implement an in-memory translation from V1 -> V2.
2. **Template migration strategy**
   - When reading an existing template, accept:
     - V1 (`line` + `columns` + `customFields`)
     - V2 (`targets`-style mapping)
   - When saving from the new UI, persist V2.
   - Optionally: opportunistically backfill V2 into templates on save (no mass migration required).

Deliverable: new mapping payload that can round-trip (UI -> API -> template config) without losing “extra” columns.

### Phase 3 — UI updates (dropdown + review)

1. **Dropdown grouping**
   - Replace “Map to Commissable field” with grouped options:
     - DepositLineItem fields
     - Deposit fields
     - Opportunity fields
     - Product fields
     - Ignore
   - Add search/filter in the dropdown once the catalog grows.
2. **Required field indicators**
   - Required targets should be visually marked and validated in the map step and review step.
3. **Custom field UX (if still needed)**
   - Decide whether user-defined “custom fields” should:
     - map into `DepositLineItem.metadata.custom`, or
     - be removed in favor of selecting only from the catalog.

Deliverable: users can select from DB-backed targets in a single mapping UI.

### Phase 4 — Import route persistence (remove the limitation)

1. **Validate mapping targets against the server catalog**
   - Reject unknown targets and type-incompatible mappings.
2. **Write mapped values**
   - `DepositLineItem` targets: set the appropriate columns at `createMany` time.
   - `Deposit` targets (if supported): set at `deposit.create` time or via `deposit.update` before line items.
   - `Opportunity/Product` targets:
     - If “metadata” persistence: write into `DepositLineItem.metadata` under a stable namespace.
     - If “lookup” persistence: resolve IDs and set `productId`, `accountId`, `primaryRevenueScheduleId`, etc (with clear failure behavior).
3. **Confirm template-saving behavior**
   - Persist the v2 mapping config into `ReconciliationTemplate.config` when `saveTemplateMapping` is enabled.

Deliverable: mapped non-canonical fields no longer disappear after import.

### Phase 5 — Matching integration (optional but usually the point)

1. If Opportunity/Product mappings are stored into `DepositLineItem.metadata`, update reconciliation matching logic to consider these values.
2. If lookups are enabled, ensure deterministic linking and clear auditability (explain how a deposit line was linked).

Deliverable: mapped fields materially improve reconciliation success rate.

### Phase 6 — Backward compatibility + deprecation of `fields.ts`

1. Keep `lib/deposit-import/fields.ts` temporarily as:
   - V1 migration/translation support
   - synonym matching seeds (auto-mapping), if still valuable
2. Once templates and UI are fully v2, stop using `depositFieldDefinitions` as the primary catalog:
   - Replace UI labels, review step labels, and server validation with the field catalog.
   - Update Telarus template seeding/mapping to emit v2 targets.
3. Update docs:
   - Remove or rewrite the “Important current limitation” note in `docs/guides/deposit-upload.md`.
   - Update `docs/deposit-upload-mapping.md` to describe v2.

Deliverable: `fields.ts` becomes legacy-only and can be removed later without breaking templates.

## Testing / QA checklist

- Import succeeds with v1 templates (no UI changes required to re-import).
- Import succeeds with v2 mapping payloads and persists mapped columns.
- “Extra/custom” columns persist (either as `DepositLineItem` columns or `metadata`), and are visible in deposit line detail views if applicable.
- Required field validation works both client-side and server-side.
- Template save/load round-trips without dropping any mappings.

## Suggested rollout strategy

- Feature flag the v2 dropdown + payload behind a tenant setting.
- Enable for internal tenants first; keep v1 as fallback.
- After adoption, migrate Telarus seeding to v2 and deprecate v1 usage.

