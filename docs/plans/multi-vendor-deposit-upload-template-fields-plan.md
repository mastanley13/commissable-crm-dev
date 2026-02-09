# Plan: Multi-vendor Deposit Upload - Show Template Fields + Templates Used

## Problem statement

In the Deposit Upload wizard, when **Multi-vendor** mode is enabled:

- Step 2 (Field Mapping) does **not** show the full set of template-driven fields.
- Step 2 does **not** show which reconciliation templates will be used per vendor.

This creates confusion vs. the single-vendor path, where a selected template pre-fills mapping and drives the "Template Fields" list and "Template suggests ..." hints.

## Current behavior (why this happens)

### UI

- Enabling multi-vendor clears template state and disables vendor/template selection:
  - `components/deposit-upload/create-template-step.tsx` (`handleMultiVendorChange`)
- The wizard only fetches the selected template config when `multiVendor === false`:
  - `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx` (template fetch guarded by `!formState.multiVendor`)
- With no `templateMapping/templateFields`, the mapping table falls back to a small "core" set of template candidates:
  - `components/deposit-upload/map-fields-step.tsx` (`CORE_TEMPLATE_TARGETS`)
- The "Template" card is only rendered when `templateLabel` is present, so multi-vendor shows an empty placeholder:
  - `components/deposit-upload/map-fields-step.tsx` (conditional rendering on `templateLabel`)

### Backend

- Multi-vendor import resolves vendors from the mapped `depositLineItem.vendorNameRaw` column, then requires templates for all vendors:
  - `app/api/reconciliation/deposits/import/route.ts` (multi-vendor transaction path)
- Import chooses a template **per vendorAccountId** but does not currently provide any of that detail back to Step 2 UI.
- If there are multiple templates per vendor/distributor, the selection behavior should be made deterministic (see "Open questions").

## Goals

1. In multi-vendor mode, Step 2 shows a **Templates Used** panel that lists:
   - each detected vendor
   - the resolved vendor account
   - the reconciliation template that will be used (name + id)
2. In multi-vendor mode, Step 2 "Template Fields" tab includes the **union** of fields/columns from the templates used (so it matches the richness of single-vendor).
3. The preview behavior matches the import behavior (same template selection rules).

## Non-goals (for first iteration)

- Per-row/per-vendor dynamic suggestions inside the mapping table (e.g., different hints depending on the row's vendor).
  - We can start with an aggregated/union view, then iterate if needed.
- A full "choose template per vendor" UI (only needed if multiple templates per vendor/distributor is a supported workflow).

## Proposed approach

Add a lightweight "multi-vendor template preview" step that runs in Step 2 (after the user maps Vendor Name):

1. Identify vendor names present in the file (ideally from all rows; fallback to first N rows if we need a performance guardrail).
2. Resolve vendor accounts + template to use for each vendor (matching import rules).
3. Build an **aggregated** template mapping/fields payload:
   - `mergedTemplateMapping`: union of all template mapping configs
   - `mergedTemplateFields`: union of Telarus template fields (if present in template configs)
4. Feed the aggregated mapping/fields into the existing Step 2 UI so:
   - "Template Fields (X)" reflects the union
   - template-driven hints can appear where unambiguous
5. Display a new "Templates Used" panel (instead of the single template card) listing vendor -> template.

## Implementation plan

### 1) Decide deterministic template selection rules (required)

Multi-vendor needs a deterministic way to choose "the template to use" for each vendor.

Options (pick one and apply it both in import and preview):

1. **Single template per distributor/vendor (enforced)**
   - Treat multiple templates per pair as unsupported and block until user resolves.
   - Pros: simplest mental model.
   - Cons: conflicts with existing ability to create multiple templates per pair (unique key includes template name).

2. **Most recently updated wins** (recommended if multiple templates are allowed)
   - `orderBy: { updatedAt: 'desc' }`, pick first per vendor.
   - Pros: deterministic, aligns with "latest mapping fixes".
   - Cons: still implicit; users might not realize which one is used.

3. **Explicit default flag**
   - Add `isDefault` (or `sortOrder`) to `ReconciliationTemplate`.
   - Pros: best UX for multi-template setups.
   - Cons: schema + UI work.

For the first iteration, implement (2) unless product explicitly wants (1) or (3).

### 2) Backend: add a multi-vendor template preview endpoint

Add a new endpoint that mirrors the import route's vendor + template resolution, but without creating deposits:

- `POST /api/reconciliation/templates/multi-vendor-preview`

Input (minimal viable):

- `distributorAccountId: string`
- `vendorNames: string[]` (distinct, trimmed; client-derived from the mapped Vendor Name column)

Output:

- `templatesUsed: Array<{ vendorNameInFile: string; vendorAccountId: string; vendorAccountName: string; templateId: string; templateName: string; templateUpdatedAt: string }>`
- `mergedTemplateConfig: { templateMappingV2: DepositMappingConfigV2 | null; telarusTemplateFields: TelarusTemplateFieldsV1 | null }`
- `warnings: string[]` (optional; e.g., "preview limited to first N vendors")

Notes:

- Reuse the same vendor account resolution logic as `app/api/reconciliation/deposits/import/route.ts` (factor into a shared helper in `lib/` if possible).
- Apply the deterministic template selection rule chosen in step (1).
- Consider Telarus auto-seeding for missing templates:
  - Single-vendor template list (`GET /api/reconciliation/templates`) can seed a Telarus-derived template when none exist.
  - Multi-vendor preview can either:
    - (A) only report missing templates (safe, no mutation), or
    - (B) attempt to seed missing templates for the detected vendor/distributor pairs (matches single-vendor convenience).
  - Pick (A) for first iteration unless auto-seed is a must-have for multi-vendor usability.

### 3) Frontend: detect vendors + call preview endpoint

In `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`:

- When `formState.multiVendor === true` and `mapping.targets['depositLineItem.vendorNameRaw']` is set:
  1. Compute distinct vendor names from the parsed file rows for that column.
     - Ideal: scan all parsed rows (already available during file parse), store just the distinct set (not full rows).
     - Guardrails:
       - cap to N vendors (e.g., 50) for preview display; still allow import to validate full file.
       - ignore blank names and "Totals/Subtotals" rows (match `shouldSkipMultiVendorRow` behavior).
  2. Call `POST /api/reconciliation/templates/multi-vendor-preview` with those vendor names.
  3. Store the returned:
     - `templatesUsed` for UI rendering
     - `mergedTemplateMapping/mergedTemplateFields` into the existing `templateMapping/templateFields` state so Step 2 can render "Template Fields" properly.

Debounce + cancellation:

- Debounce requests while the user is changing mappings (e.g., 250-500ms).
- Abort in-flight requests when:
  - file changes
  - mapping changes
  - distributor changes

### 4) Frontend: update Step 2 UI to render multi-vendor template usage

In `components/deposit-upload/map-fields-step.tsx`:

- Add props for multi-vendor template usage:
  - `multiVendorTemplatesUsed?: Array<...>`
  - `templateLabel` can become:
    - `Template` (single vendor) OR
    - `Templates Used (multi-vendor)` (multi-vendor)
- Render:
  - A list/table of vendor -> template (with counts and a "missing templates" warning if returned).
  - Keep the existing "Save mapping updates ..." checkbox hidden in multi-vendor mode (or disabled), unless/until we support saving per vendor.

### 5) Ensure import uses the same template-selection rules

Update `app/api/reconciliation/deposits/import/route.ts` multi-vendor path to use the same deterministic rule as preview:

- If selecting "most recently updated wins":
  - query templates including `updatedAt`, and choose per vendor deterministically.
- Consider logging `vendorAccountId -> templateId` mapping in the import job metadata for later debugging.

### 6) Add tests + verification checklist

Backend tests:

- Vendor resolution:
  - unknown vendor names -> clear error
  - case/whitespace normalization matches import behavior
- Template selection determinism (multiple templates per vendor)
- Merge behavior for `mergedTemplateMapping` + `mergedTemplateFields`

Frontend verification checklist:

- Multi-vendor Step 2 shows "Templates Used" and lists expected templates.
- "Template Fields (X)" increases vs. current core-only behavior.
- Import succeeds and results match the preview mapping of vendors -> templates.
- Large files do not stall the UI (verify guardrails).

## Acceptance criteria (definition of done)

1. With multi-vendor enabled and Vendor Name mapped, Step 2 displays a **Templates Used** list.
2. Step 2 "Template Fields" tab count reflects template-driven columns from the templates used (not just the 4 core fields).
3. If a vendor in the file has no matching account or no template, the UI shows a clear, actionable message before import.
4. Template selection is deterministic and preview == import for the same input.

## Open questions

1. Do we need to support multiple templates per distributor/vendor by design?
   - If yes, do we need an explicit per-vendor template picker for multi-vendor uploads?
2. Should multi-vendor preview scan:
   - the full file (best accuracy), or
   - only the first N rows/vendors (best performance), with messaging?
3. Should multi-vendor preview attempt Telarus auto-seed for missing templates, or only report missing templates?

