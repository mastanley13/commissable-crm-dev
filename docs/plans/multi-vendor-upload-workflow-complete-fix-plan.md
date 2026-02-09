# Multi-Vendor Deposit Upload Workflow - Complete Fix Plan

Last updated: 2026-02-09

## Goal

When **Multi-Vendor Upload** is enabled, the system must:

1. Read vendor names from the uploaded file.
2. Resolve each row vendor to a CRM Vendor account.
3. Resolve and apply the correct reconciliation template for each **Distributor + Vendor** pair.
4. Show users exactly which templates will be used before import.
5. Ensure preview behavior and import behavior are identical.

## Current Gaps (Confirmed)

1. Multi-vendor mode clears template state and disables template selection in Step 1.
2. Step 2 only loads template config when `multiVendor === false`.
3. Step 2 falls back to core template fields when no template mapping is loaded.
4. No API currently previews multi-vendor vendor/template resolution.
5. Multi-vendor import template pick is non-deterministic when multiple templates exist per vendor (no `orderBy`).

## End-State Behavior

1. User uploads a file, enables multi-vendor, maps `Vendor Name`.
2. UI extracts distinct vendor names from parsed rows (excluding total/subtotal rows).
3. UI calls a preview endpoint that returns:
   - vendor resolution results,
   - template selected per vendor,
   - merged template mapping/fields for Step 2.
4. Step 2 shows:
   - **Templates Used** panel,
   - merged **Template Fields** count and hints.
5. Import uses the same shared resolution and selection logic as preview.
6. If any vendor/template cannot be resolved, user sees actionable errors before import.

## Deterministic Template Selection Rule

Use: **Most recently updated template wins** per `tenantId + distributorAccountId + vendorAccountId`.

Tie-break: `updatedAt DESC`, then `createdAt DESC`, then `name ASC`.

This rule must be used in both preview and import via shared helper(s).

## Implementation Streams

### Stream A: Shared Multi-Vendor Resolver Library

Create shared helpers under `lib/deposit-import/` (or `lib/reconciliation/`) to avoid divergence:

1. `extractDistinctVendorsFromRows(...)`
2. `resolveVendorAccounts(...)`
3. `resolveTemplatesForVendorAccounts(...)`
4. `mergeTemplateConfigs(...)`

These helpers must be used by:

1. `POST /api/reconciliation/templates/multi-vendor-preview`
2. `POST /api/reconciliation/deposits/import` (multi-vendor path)

### Stream B: New Multi-Vendor Preview API

Add route:

`app/api/reconciliation/templates/multi-vendor-preview/route.ts`

Request:

```json
{
  "distributorAccountId": "uuid",
  "vendorNames": ["Vendor A", "Vendor B"],
  "options": {
    "maxVendors": 100
  }
}
```

Response:

```json
{
  "data": {
    "templatesUsed": [
      {
        "vendorNameInFile": "Vendor A",
        "vendorAccountId": "uuid",
        "vendorAccountName": "Vendor A LLC",
        "templateId": "uuid",
        "templateName": "Vendor A Default",
        "templateUpdatedAt": "2026-02-08T12:00:00.000Z"
      }
    ],
    "missingVendors": ["Unknown Vendor"],
    "vendorsMissingTemplates": ["Vendor B"],
    "mergedTemplateConfig": {
      "depositMappingV2": {},
      "telarusTemplateFields": {}
    },
    "warnings": []
  }
}
```

Behavior:

1. Validate distributor + permissions.
2. Normalize vendor names (`trim`, case-insensitive key).
3. Resolve account matches exactly as import does.
4. Resolve template per vendor using deterministic rule.
5. Return merged config for Step 2 rendering.
6. Do not mutate DB in preview.

### Stream C: Frontend Multi-Vendor Preview Integration

Primary file:

`app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`

Add state:

1. `multiVendorTemplatePreview`
2. `multiVendorPreviewLoading`
3. `multiVendorPreviewError`

Flow:

1. After file parse + vendor-name target mapping exists, compute distinct vendors from parsed rows.
2. Debounce preview call (250-400ms) and cancel in-flight requests on dependency changes.
3. On success:
   - set `templateMapping` + `templateFields` from merged preview config,
   - store `templatesUsed` for display.
4. On missing vendors/templates:
   - show explicit warnings and block continue/import.

### Stream D: Map Step UI for Multi-Vendor Template Visibility

Primary file:

`components/deposit-upload/map-fields-step.tsx`

Add props:

1. `multiVendor?: boolean`
2. `templatesUsed?: Array<...>`
3. `vendorsMissingTemplates?: string[]`
4. `missingVendors?: string[]`

UI updates:

1. Replace single-template card text with multi-vendor summary:
   - `Templates Used (N vendors)`.
2. Render vendor -> template list/table.
3. Keep existing compact top bar styling.
4. Hide or disable “Save mapping updates to template” in multi-vendor mode.

### Stream E: Align Import Route to Shared Logic

Primary file:

`app/api/reconciliation/deposits/import/route.ts`

Changes:

1. Replace inline vendor/template resolution with shared resolver.
2. Apply deterministic template rule.
3. Persist import metadata mapping:
   - `vendorAccountId -> templateId`.
4. Ensure error messages mirror preview endpoint wording.

### Stream F: Validation + Blocking Rules

Continue button and import should be blocked when:

1. `multiVendor === true` and `Vendor Name` mapping is missing.
2. Any parsed vendor row resolves to unknown vendor account.
3. Any resolved vendor lacks a template.

## Merging Template Configs Strategy

For `mergedTemplateConfig` in preview:

1. Merge `depositMappingV2.targets` by first-wins precedence based on deterministic template ordering.
2. Merge `depositMappingV2.columns` by column key (first-wins).
3. Merge `customFields` by key; if collision with different labels/sections, record warning.
4. Merge `telarusTemplateFields.fields` by normalized `telarusFieldName`.

Goal: stable merged output, deterministic across runs.

## Tests

### Unit Tests

1. Vendor extraction excludes totals/subtotals and blanks.
2. Vendor/account matching normalization.
3. Deterministic template selection under multiple templates.
4. Merge conflict behavior and warnings.

### Integration Tests

1. New preview route success path.
2. Preview route with missing vendors.
3. Preview route with vendors missing templates.
4. Import route uses same selected templates as preview for same payload.

### UI/Flow Tests

1. Multi-vendor Step 2 shows templates-used panel.
2. Template Fields tab count reflects merged templates, not core fallback.
3. Continue/import blocked with clear errors when unresolved vendors/templates exist.

## Rollout Plan

1. Implement shared resolver + preview API.
2. Wire frontend preview and UI panel behind feature flag:
   - `RECON_MULTI_VENDOR_TEMPLATE_PREVIEW_V1`.
3. Align import route to shared resolver.
4. Add tests and run deposit-upload regression suite.
5. Enable flag in staging, validate with real files.
6. Enable in production after sign-off.

## Risks and Mitigations

1. Large files with many vendors:
   - cap preview vendor list and return warning when capped.
2. Ambiguous account matching:
   - keep strict exact name/legal-name matching first; surface unresolved vendors clearly.
3. Multiple templates per vendor:
   - deterministic rule + display selected template in UI.

## File-Level Execution Checklist

1. `lib/deposit-import/multi-vendor-template-resolver.ts` (new)
2. `app/api/reconciliation/templates/multi-vendor-preview/route.ts` (new)
3. `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
4. `components/deposit-upload/map-fields-step.tsx`
5. `app/api/reconciliation/deposits/import/route.ts`
6. `tests/*` (new unit/integration coverage)

## Definition of Done

1. Multi-vendor Step 2 shows resolved templates used per vendor.
2. Template Fields in multi-vendor reflect merged template configs.
3. Preview and import select identical templates for same input.
4. Errors for unresolved vendors/templates appear before import and block progression.
5. Automated tests cover resolver, preview API, and import alignment.
