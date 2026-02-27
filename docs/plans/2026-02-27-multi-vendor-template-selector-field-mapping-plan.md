# Plan: Multi-vendor Deposit Upload — Template Selector + Per-Template Mapping

Last updated: 2026-02-27

## Problem statement

In the Deposit Upload wizard (Step 2: Field Mapping), when **Multi-vendor** mode is enabled:

- The UI currently builds **one combined “Template Fields” view** using a merged/union set of fields across all resolved templates.
- The user cannot tell which template a field “belongs to”, causing ambiguity (duplicate-looking rows, unclear completion, unclear what matters per vendor/template).
- The workflow does not provide a clear way to **review/edit/save mapping per template** in a multi-template upload.

Users need to be able to:

1. Select a specific template in-use (Distributor + Vendor pairing) from a dropdown.
2. See only the fields/mappings for that template.
3. Know which templates are complete/incomplete.
4. Be blocked on **Continue** until all templates’ required mappings are complete, with a warning that clearly lists:
   - which template(s) are incomplete, and
   - which required field(s) are missing for each.

## Goals (definition of success)

### UX goals

- A **Template selector dropdown** is available in multi-vendor mapping.
- Selecting a template filters the mapping table to that template’s “Template Fields”.
- Switching templates changes the displayed template-driven fields and template hints, without ambiguity.
- Users can clearly see **completion status per template** (complete vs missing required).
- Clicking **Continue** blocks with a detailed warning if any templates are incomplete and provides a one-click path to fix.

### Data / behavior goals

- Mapping changes are **isolated per template** (editing Template A does not overwrite Template B).
- “Save mapping updates” persists **per template** (Template A saves only to A, Template B saves only to B).
- Multi-vendor import applies the **correct mapping per vendor/template** (no accidental “one mapping overwrote all templates” behavior).

## Non-goals (initial iteration)

- “All templates” combined editing view (optional future enhancement).
- Full “choose a different template per vendor” UI (template selection is still deterministic based on current rules).
- Introducing a new “required fields designer” UI for templates (we’ll infer requiredness from existing config first).

## Current implementation (relevant code)

### UI (Step 2)

- Mapping step UI: `components/deposit-upload/map-fields-step.tsx`
  - `templateMapping` + `templateFields` drive the “Template Fields” bucket and “Template suggested” hints.
  - In multi-vendor mode it displays a “Templates Used” list, but **no selector**.
  - “Save mapping updates to template” checkbox is currently **hidden when `multiVendor` is true**.
- Wizard page: `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
  - Calls `POST /api/reconciliation/templates/multi-vendor-preview`
  - Stores `templatesUsed` + missing vendor/template warnings
  - Sets `templateMapping`/`templateFields` from `mergedTemplateConfig` (union view)

### Backend

- Multi-vendor preview helper logic: `lib/deposit-import/multi-vendor-template-resolver.ts`
  - `resolveMultiVendorTemplates(...)` resolves templates per vendor (deterministic selection is “latest updated wins”).
  - `mergeMultiVendorTemplateConfigs(...)` produces a single merged mapping/fields payload.
- Import route: `app/api/reconciliation/deposits/import/route.ts`
  - Multi-vendor import:
    - resolves vendor → template for deposit creation,
    - but uses a **single mapping config** to import all vendors’ rows.
  - Template saving (`saveTemplateMapping`) currently uses **one mapping config** and may update templates in a loop.

## Proposed solution (high level)

### 1) Introduce a template selector for multi-vendor mapping

- Add a dropdown to choose which resolved template is “active” in Step 2.
- The mapping table/hints show only the fields related to the selected template.

### 2) Maintain mapping state per template (not one shared mapping)

Instead of one global mapping object for the entire multi-vendor upload, maintain:

- `mappingByTemplateId[templateId] = DepositMappingConfigV2`
- Optional: `saveUpdatesByTemplateId[templateId] = boolean`

Switching templates changes which mapping config is edited and displayed.

### 3) Add per-template completion indicators + blocking Continue validation

- Compute missing required fields per template.
- Render status badges in the dropdown and/or “Templates Used” panel.
- On **Continue**:
  - validate all templates,
  - if any missing required mappings, block and show a modal/panel listing missing fields grouped by template,
  - provide “Go to template” actions that switch the dropdown and focus the first missing item.

### 4) Update import to accept and apply per-template mappings

When `multiVendor=true`, the server should accept a mapping payload that includes mappings per template and apply the correct one for each vendor group.

## UX / UI design details

### Template selector

Location: Step 2 header card, replacing/augmenting the current “Templates Used” title area.

Dropdown options (recommended label format):

- `{vendorAccountName} — {templateName}` (plus status badge)

If multiple vendors resolve to the same `templateId`, show:

- `{templateName} (used by {N} vendors)` and list vendors in a tooltip / secondary text.

Default selection:

- First template with missing required mappings; otherwise the first template in list order.

### Completion indicators

In dropdown and/or Templates Used list:

- `Complete` (green) when missing required = 0
- `Missing X required` (amber/red) when incomplete

### Continue blocking warning (modal/panel)

On Continue click (when basic prerequisites are met):

- If any templates are incomplete, show a modal like:
  - `Telarus — ACC Business: Missing required fields: Commission Type, Service Month`
  - `Telarus — Advantix: Missing required fields: Vendor Name`
- Each template block includes a **“Go to template”** action that:
  - switches the dropdown,
  - scrolls/focuses the first missing field.

## “Required fields” definition (recommended v1)

We need a deterministic, implementable definition for “required per template” without building new schema/UI.

### Base required (already enforced today)

- At least one of:
  - `depositLineItem.usage` OR `depositLineItem.commission`
- In multi-vendor mode:
  - `depositLineItem.vendorNameRaw`

### Template-required (recommended)

For each resolved template, infer a required set from its saved mapping config:

- `requiredTargetIdsForTemplate = keys(templateDepositMappingV2.targets)`
  - Exclude targets that are explicitly considered optional (if needed via a small allow/deny list).
  - Always include the base required targets above.

Validation rule:

- A template is “complete” when the current mapping for that template includes mappings for all `requiredTargetIdsForTemplate`.

Why this approach:

- It uses existing data (template mapping config) and matches real user intent: “fields we mapped in the template are the ones we care about.”

### Optional (future) improvements

- Support “required custom fields” (e.g., Service Month) by allowing templates to declare required custom labels/keys.
- Add an explicit `requiredTargetIds` list in template config for stronger control.

## Backend changes

### A) Update multi-vendor preview endpoint to return per-template configs

Endpoint today:

- `POST /api/reconciliation/templates/multi-vendor-preview`

Current output includes:

- `templatesUsed`, `missingVendors`, `vendorsMissingTemplates`, `warnings`
- `mergedTemplateConfig`

Proposed additions:

- Return a **distinct template list** (unique by `templateId`) with extracted configs:

```ts
type MultiVendorTemplateOption = {
  templateId: string
  templateName: string
  templateUpdatedAt: string
  vendorAccountIds: string[]
  vendorAccountNames: string[]
  depositMappingV2: DepositMappingConfigV2 | null
  telarusTemplateFields: TelarusTemplateFieldsV1 | null
}
```

Notes:

- Use `resolveMultiVendorTemplates(...)` to get each vendor’s template.
- Deduplicate by `templateId` to build `templateOptions[]`.
- Extract config using existing helpers:
  - `extractDepositMappingV2FromTemplateConfig(...)`
  - `extractTelarusTemplateFieldsFromTemplateConfig(...)`
- Keep `mergedTemplateConfig` temporarily for backwards compatibility during rollout.

Implementation helpers:

- Add a new function in `lib/deposit-import/multi-vendor-template-resolver.ts`:
  - `buildMultiVendorTemplateOptions(resolvedTemplates: MultiVendorResolvedTemplate[]): MultiVendorTemplateOption[]`

### B) Add/extend types shared with frontend

- Define a stable response shape for preview so the UI can:
  - render dropdown options,
  - set default selected template,
  - seed `mappingByTemplateId` from each template’s `depositMappingV2`.

## Frontend changes

### A) Wizard state updates (multi-vendor only)

In `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`:

- Replace single `mapping` state with:
  - `mappingByTemplateId` (multi-vendor)
  - (keep single mapping for single-vendor path unchanged)
- Store:
  - `selectedTemplateId`
  - `multiVendorTemplateOptions[]` returned from preview
- When preview returns:
  - seed `mappingByTemplateId[templateId] = seedDepositMappingV2({ headers, templateMapping: option.depositMappingV2 })`
  - if a mapping already exists for that template in state, do not overwrite it.

### B) Map fields step: dropdown + per-template mapping

In `components/deposit-upload/map-fields-step.tsx`:

- Add props:
  - `selectedTemplateId`
  - `templateOptions`
  - `onSelectedTemplateIdChange`
  - `mappingForSelectedTemplate`
  - `templateMappingForSelectedTemplate` / `templateFieldsForSelectedTemplate`
  - `completionByTemplateId` (missing required labels/counts)
- Render dropdown (Radix `Select` or existing dropdown components).
- Ensure table reads/writes selection using `mappingForSelectedTemplate` only.

### C) Undo handling

Recommended:

- Maintain undo history per template:
  - `mappingHistoryByTemplateId[templateId] = DepositMappingConfigV2[]`
  - `canUndo` becomes template-scoped.

### D) Continue behavior

Current: Continue is disabled until validation passes.

Required behavior:

- Allow Continue click when “basic” prerequisites are met (file parsed, multi-vendor preview resolved).
- On click:
  - compute missing required across all templates,
  - if missing exists, show modal and do not proceed.

Alternative (if keeping disabled button is preferred):

- Always render a visible “Missing required mappings” panel in Step 2 with the same per-template list.

## Import route changes (multi-vendor)

### New mapping payload (backward compatible)

Continue supporting the existing single mapping payload, but add a multi-vendor shape:

```ts
type MultiVendorMappingPayloadV1 = {
  version: "multiVendorV1"
  mappingsByTemplateId: Record<string, DepositMappingConfigV2>
  saveUpdatesByTemplateId?: Record<string, boolean>
}
```

Server behavior when `multiVendor=true`:

1. Resolve vendor groups + template per vendor (existing behavior).
2. For each vendor group:
   - `templateId = resolvedVendor.templateId`
   - `mappingConfig = mappingsByTemplateId[templateId]`
   - validate mappingConfig exists and has required targets for that template
   - build `columnIndex` and `customColumnIndex` from that mappingConfig (cache per templateId)
   - parse/import rows using that mappingConfig (not a global mapping)
3. Template persistence:
   - if `saveUpdatesByTemplateId[templateId]` is true, update only that template’s config using that template’s mappingConfig.

### Validation in the import route

Add a server-side guard mirroring the UI:

- For each template used in the import:
  - compute required target ids (same rules as UI)
  - return a 400 with a structured message if any are missing

This prevents “UI bypass” and ensures correctness for API consumers.

## Testing plan

### Backend tests

- Multi-vendor preview returns:
  - deterministic template selection
  - `templateOptions[]` with extracted mapping + telarus fields
  - correct deduping when multiple vendors share a template
- Import route:
  - applies correct mapping per vendor/template (multiVendorV1 payload)
  - persists template updates per template only
  - returns clear errors listing missing required fields by template

### Frontend tests (or verification checklist if no harness exists)

- Dropdown renders correct template options and statuses.
- Switching templates:
  - changes Template Fields count and rows
  - preserves edits per template
- Continue:
  - blocks with modal listing missing required fields grouped by template
  - “Go to template” switches selector and navigates user to fix.

## Rollout plan (safe, incremental)

1. Add preview API response additions (`templateOptions[]`) while keeping existing `mergedTemplateConfig`.
2. Ship UI dropdown + filtering using per-template templateMapping/templateFields, but **keep current single mapping** (view-only improvement).
3. Introduce per-template mapping state + per-template save toggles behind a feature flag.
4. Update import route to accept/apply `multiVendorV1` payload behind the same flag.
5. Remove the old merged-only UI path once stable.

## Acceptance criteria

- In multi-vendor mode, Step 2 shows a template dropdown with all resolved templates.
- Selecting a template shows only fields/hints for that template (no merged ambiguity).
- Mapping edits are isolated per template.
- Continue blocks when any template is missing required mappings and shows template + field details.
- Import uses per-template mapping and updates templates independently when saving is enabled.

## Open questions / decisions to finalize during implementation

1. **Required fields inference**
   - Is “required per template” = template mapping targets, or do we need an explicit template-required list?
2. **Templates shared across multiple vendors**
   - Dropdown label and completion rules should reflect multi-vendor usage of a single templateId.
3. **Performance**
   - Maximum templates/vendors to preview and render; confirm caps (`options.maxVendors`) and UI behavior.
4. **Continue button behavior**
   - Keep disabled vs allow click + modal. (This plan recommends allow click once basic prerequisites are met.)

