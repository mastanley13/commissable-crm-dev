# Deposit Upload + Template Mapping (Deep Dive)

Last updated: 2026-02-19

This document explains, at an implementation level, how Commissable:

- Parses an uploaded commission report (CSV/XLS/XLSX/PDF)
- Lets a user map file columns to internal "targets"
- Persists that mapping as a reusable template
- Imports the file into `Deposit` + `DepositLineItem` rows

If you want the user-facing workflow guide, see `docs/guides/deposit-upload.md`.

---

## Happy path (end-to-end sequence)

At a high level:

1) UI parses the uploaded file to get `{ headers, rows }`
2) UI optionally fetches the selected template config and uses it to pre-fill mapping
3) User edits mapping in the UI (mapping config v2)
4) UI submits `file + mapping + context` to the import API
5) Server validates mapping + headers, imports `Deposit` + `DepositLineItem`s, writes an `ImportJob`
6) If enabled, server persists the mapping back to a template for next time

Important nuance: **the server does not "apply the selected template" on its own**. The template is used on the client to pre-fill the mapping UI, but the server imports using the `mapping` payload sent by the UI.

---

## Key files (source of truth)

**UI**

- Upload flow (stepper + orchestration): `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
- Mapping UI: `components/deposit-upload/map-fields-step.tsx`
- Review UI: `components/deposit-upload/review-step.tsx`

**API**

- Import: `app/api/reconciliation/deposits/import/route.ts`
- Templates list/create (and Telarus auto-seed): `app/api/reconciliation/templates/route.ts`
- Template detail/edit: `app/api/reconciliation/templates/[templateId]/route.ts`
- Multi-vendor template preview merge: `app/api/reconciliation/templates/multi-vendor-preview/route.ts`

**Deposit import domain logic**

- Parse CSV/Excel/PDF: `lib/deposit-import/parse-file.ts`
- Mapping config v2 (and conversion from v1): `lib/deposit-import/template-mapping-v2.ts`
- Legacy mapping v1 + synonyms: `lib/deposit-import/template-mapping.ts`
- Field catalog ("what you can map to"): `lib/deposit-import/field-catalog.ts`
- Header resolution (exact/trim/case/normalized + ambiguity detection): `lib/deposit-import/resolve-header.ts`
- Suggestions scoring (UI helper): `lib/deposit-import/field-suggestions.ts`
- Multi-vendor grouping and template resolution: `lib/deposit-import/multi-vendor-template-resolver.ts`
- Multi-vendor "summary/totals rows" skipping: `lib/deposit-import/multi-vendor.ts`

**Telarus seed data**

- Master CSV: `docs/reference-data/telarus-vendor-map-fields-master.csv`
- Matching + mapping derivation: `lib/deposit-import/telarus-template-master.ts`
- Telarus fields stored on templates: `lib/deposit-import/telarus-template-fields.ts`

---

## Data model (what gets stored)

### `ReconciliationTemplate` (template + mapping storage)

Prisma model: `prisma/schema.prisma` (`model ReconciliationTemplate`)

- Unique per: `(tenantId, distributorAccountId, vendorAccountId, name)`
- `config` is JSON and stores (at minimum) `depositMapping`
- Some templates may also store Telarus metadata in `config` (details below)

### `Deposit` (one import result per vendor)

- `Deposit` has one `distributorAccountId` and one `vendorAccountId`
- Multi-vendor imports create **one Deposit per vendor group**
- `reconciliationTemplateId` points at the template used for that deposit (if any)

### `DepositLineItem` (rows in the uploaded file)

The importer writes:

- Core numeric fields (usage/commission/rate) to dedicated columns
- Other mapped fields either:
  - into dedicated `DepositLineItem` columns (persistence = `depositLineItemColumn`), or
  - into `DepositLineItem.metadata` (persistence = `metadata`)

### `ImportJob` (history + idempotency)

The import route writes an `ImportJob` row with:

- `idempotencyKey` to prevent duplicate imports
- `filters` JSON containing the mapping payload, template IDs used, and other import context

---

## Concepts and terminology

### "Targets" (what we map *to*)

Deposit upload uses a field catalog of "targets" from `lib/deposit-import/field-catalog.ts`.

Each target has:

- `id`: stable identifier (examples: `depositLineItem.usage`, `deposit.paymentDate`, `opportunity.amount`)
- `label`: display name in the UI
- `entity`: which bucket it belongs to (`depositLineItem`, `deposit`, `opportunity`, `product`, `matching`)
- `dataType`: `string | number | date | boolean`
- `persistence`: where it is stored
  - `depositLineItemColumn`: written into a `DepositLineItem` DB column
  - `depositColumn`: written into a `Deposit` DB column (currently supports deposit name/payment date)
  - `metadata`: written into `DepositLineItem.metadata` at a path like `["opportunity", "amount"]`

Important: Opportunity targets here do **not** create/update real Opportunity rows; they are stored as metadata on deposit line items.

### "Mapping config" (what we map *from*)

The current mapping config format is `depositMapping.version = 2`, defined in `lib/deposit-import/template-mapping-v2.ts`.

At a high level:

- `mapping.targets` = the authoritative mapping the importer uses (targetId -> column header name)
- `mapping.columns` + `mapping.customFields` = UI state for how each source column should be treated
  - custom fields are persisted into `DepositLineItem.metadata.custom`

Example shape (simplified):

```json
{
  "depositMapping": {
    "version": 2,
    "targets": {
      "depositLineItem.usage": "MRC",
      "depositLineItem.commission": "Commission",
      "depositLineItem.vendorNameRaw": "Vendor"
    },
    "columns": {
      "MRC": { "mode": "target", "targetId": "depositLineItem.usage" },
      "Commission": { "mode": "target", "targetId": "depositLineItem.commission" },
      "Notes": { "mode": "custom", "customKey": "cf_notes" }
    },
    "customFields": {
      "cf_notes": { "label": "Notes", "section": "additional" }
    }
  }
}
```

#### Column modes (`mapping.columns[columnName].mode`)

The v2 mapping config tracks how each source column should be treated:

- `target`: mapped to a specific `targetId` (and included in `mapping.targets`)
- `custom`: stored into `DepositLineItem.metadata.custom` under a `customKey`
- `additional`: shown in the UI as an extra/unmapped column (ignored by the importer)
- `ignore`: explicitly "Do not map" (ignored by the importer)

On the server, `mapping.columns` is only used to locate `custom` columns; import behavior is driven by `mapping.targets` plus the custom column index.

### Legacy formats (still accepted by the import API)

The import API also accepts:

- `depositMapping.version = 1` (see `lib/deposit-import/template-mapping.ts`)
- a legacy "flat map" payload like `{ usage: "MRC", commission: "Commission" }`

All of these are normalized into v2 before import in `app/api/reconciliation/deposits/import/route.ts`.

---

## Field catalog: where the mapping choices come from

The mapping dropdowns are built from `buildDepositImportFieldCatalog(...)` in `lib/deposit-import/field-catalog.ts`.

It includes:

- Static deposit line item targets (usage, commission, account name, etc.)
- Deposit-level targets (`deposit.depositName`, `deposit.paymentDate`)
- Matching metadata targets (example: `matching.externalScheduleId`)
- Static opportunity metadata targets (example: `opportunity.amount`)
- Dynamic opportunity targets loaded from `FieldDefinition` rows (module = `Opportunities`)
- Product metadata targets (example: `product.productFamilyVendor`)

The server uses the same catalog to validate incoming mappings:

- Every `mapping.targets[targetId]` must exist in the catalog
- If a target is unknown, the import fails

---

## File parsing (CSV/Excel/PDF)

The UI and server both parse files with:

- `parseSpreadsheetFile(file, file.name, file.type)` in `lib/deposit-import/parse-file.ts`

Supported inputs:

- `.csv` (via `papaparse`)
- `.xls/.xlsx` (via `xlsx`, first worksheet only)
- `.pdf` (text-based PDFs only, via `pdfjs-dist`)

Parsing output:

- `headers: string[]` (first non-empty row)
- `rows: string[][]` (remaining rows, normalized to strings)

If there are no headers or no data rows, the import fails.

---

## How mapping is created in the UI

### 1) Start with a template mapping (optional)

In single-vendor mode, if the user selected a template, the UI fetches:

- `GET /api/reconciliation/templates/[templateId]`

Then extracts:

- `templateMapping`: `extractDepositMappingV2FromTemplateConfig(template.config)`
- `templateFields` (Telarus display-only list): `extractTelarusTemplateFieldsFromTemplateConfig(template.config)`

Code: `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`

### 2) Seed mapping against the current file's headers

Whether or not a template exists, the UI seeds the "working mapping" with:

- `seedDepositMappingV2({ headers, templateMapping })` from `lib/deposit-import/template-mapping-v2.ts`

This does two important things:

1) If a template mapping exists, it tries to reconcile the template's stored header strings with the *current* file:
   - exact match
   - case-insensitive match
   - normalized match (via `normalizeKey`)
   - if multiple headers normalize to the same key, it treats that normalized key as ambiguous and will not auto-resolve

2) It then fills any gaps using `applyAutoMappingV2(headers, mapping)`:
   - Uses `AUTO_FIELD_SYNONYMS` from `lib/deposit-import/template-mapping.ts`
   - Applies mappings in a priority order (usage/commission/account/vendor/etc.)
   - Avoids mapping `commission` to a rate/percent column and avoids mapping `usage` to a "rate" column
   - Matching is "exact on normalized strings" (not fuzzy)

### 3) Suggested matches for unmapped columns (UI helper)

The mapping UI shows "best suggestions" for many columns using:

- `suggestDepositFieldMatches(header)` from `lib/deposit-import/field-suggestions.ts`

Important nuance:

- This suggestion engine is for the *canonical deposit field IDs* (from `lib/deposit-import/fields.ts`)
- The UI then converts a suggested `fieldId` into a v2 `targetId` via `LEGACY_FIELD_ID_TO_TARGET_ID`
- It does not attempt to suggest matches for every possible dynamic opportunity/product target

### 4) Mapping edits update `mapping.targets` (authoritative)

When the user maps a column to a target, the UI updates the v2 mapping config via:

- `setColumnSelectionV2(mapping, columnName, { type: "target", targetId })`

Key behavior:

- A `targetId` can map to at most one column (the setter deletes any previous mapping for that target)
- If a column was previously mapped to a different target, the old mapping is removed
- `mapping.columns[columnName]` is also updated so the UI can render mode/state consistently

---

## Import submission payload (what the UI sends)

The import is a multipart upload to:

- `POST /api/reconciliation/deposits/import` (`app/api/reconciliation/deposits/import/route.ts`)

The request includes (high level):

- The file
- Distributor + vendor context (or multi-vendor mode)
- Deposit date + commission period + optional deposit name
- Optional `reconciliationTemplateId`
- `saveTemplateMapping` toggle
- `mapping` JSON string (usually a v2 mapping config)
- `idempotencyKey`

---

## How mapping is validated + applied on the server

### 1) Normalize mapping payload to v2

The server parses the `mapping` JSON and produces a v2 config:

- If payload has `version: 1|2`, it runs through `extractDepositMappingV2FromTemplateConfig({ depositMapping: payload })`
- Otherwise it treats it like the legacy flat `{ fieldId: columnName }` mapping and converts to v2 targets using `LEGACY_FIELD_ID_TO_TARGET_ID`

### 2) Required mapping check (current behavior)

The import requires **at least one** of:

- `depositLineItem.usage` (`DEPOSIT_IMPORT_TARGET_IDS.usage`)
- `depositLineItem.commission` (`DEPOSIT_IMPORT_TARGET_IDS.commission`)

If both are missing, the import fails.

### 3) Build a column index (and fail on ambiguity)

The server resolves header names using:

- `resolveSpreadsheetHeader(headers, requestedHeader)` in `lib/deposit-import/resolve-header.ts`

Resolution strategy:

1) Exact match
2) Trimmed match
3) Case-insensitive trimmed match
4) Normalized match (`normalizeKey`)

If multiple headers match a request (for example, duplicate headers), it returns `ambiguous` and the import fails with a message that includes the colliding headers.

### 4) Custom columns index (for "custom fields")

If `mapping.columns[columnName].mode === "custom"`, the server builds an index of:

- `customKey -> columnIndex`

Those values are not written to first-class DB columns. They are written into per-line metadata (see below).

### 5) Deposit-level overrides (optional)

If the user mapped `deposit.depositName` or `deposit.paymentDate` in `mapping.targets`, the server:

- Scans that column to find the **first non-empty value** in the file
- Parses it by type
- Uses it to override the deposit name or payment date

This is why those are modeled as deposit-level targets (persistence = `depositColumn`).

### 6) Create Deposit + DepositLineItem rows

For each data row, the importer:

- Skips rows where both usage and commission are empty/null
- Parses types with:
  - `normalizeNumber` (strips non-numeric characters)
  - `parseDateValue` (supports Excel serial numbers and `new Date(...)` parsing)
  - `parseBoolean` (`true/false/yes/no/1/0/y/n`)
  - `normalizeString` (trim)

Then it writes values to:

**a) Dedicated `DepositLineItem` columns**

For each mapped target where:

- `target.persistence === "depositLineItemColumn"`
- `target.columnName` exists

the server reads the mapped column and assigns the parsed value onto the line item record.

The core fields below are handled specially and are *not* set through the generic loop:

- `usage`, `commission`, `commissionRate`, `lineNumber`, `paymentDate`

**b) `DepositLineItem.metadata`**

For each mapped target where:

- `target.persistence === "metadata"`
- `target.metadataPath` exists

the server assigns the parsed value into a nested object at that path.

Example:

- Mapping `opportunity.amount` writes to `metadata.opportunity.amount`

**c) `DepositLineItem.metadata.custom`**

For each column mapped as `mode: "custom"`, the server stores:

```json
{
  "custom": {
    "cf_notes": {
      "label": "Notes",
      "section": "additional",
      "value": "some string"
    }
  }
}
```

### 7) Totals + import job

After inserting line items, the importer updates `Deposit` totals (usage/commission counts and allocated/unallocated fields) and writes an `ImportJob` with the mapping and context in `filters`.

---

## Template persistence ("Save mapping updates")

### What triggers persistence

Template persistence only happens when the UI sends `saveTemplateMapping = true`.

If false, the import still succeeds but the template is not modified.

### What gets written back

The server persists:

- `serializeDepositMappingForTemplateV2(mappingConfigForTemplate)`

This serializes **only** the `depositMapping` object.

Current behavior to be aware of:

- The import route sets `ReconciliationTemplate.config = { depositMapping: ... }` (no merge).
- That means any other keys previously stored in `template.config` (for example `telarusTemplateFields` and other Telarus metadata) are overwritten and lost when a mapping is saved.

### Which template is updated

If a template was selected (`reconciliationTemplateId`):

- the server updates that template

If no template was selected:

- the server updates the most recent template for the distributor+vendor (if one exists), otherwise it creates a new template named `"Default deposit mapping"`

Multi-vendor imports update the resolved per-vendor template IDs (one per created deposit).

---

## Multi-vendor mode (single file with multiple vendors)

Multi-vendor mode is enabled when the UI sets `multiVendor = true`.

### Hard requirement: "Vendor Name" must be mapped

The importer requires:

- `mapping.targets["depositLineItem.vendorNameRaw"]` is mapped and resolvable

If not, the import fails before writing anything.

### Grouping rows by vendor

Grouping is done by:

- `groupRowsByVendor(...)` in `lib/deposit-import/multi-vendor-template-resolver.ts`

Key rules:

- Rows with both usage and commission empty are ignored (same as single-vendor)
- Rows that look like totals/summary rows can be skipped
  - controlled by env var `DEPOSIT_IMPORT_SKIP_SUMMARY_ROWS`
  - logic in `lib/deposit-import/multi-vendor.ts`
- Vendor grouping is by a normalized vendor key (lowercased trimmed vendor name)
- If vendor is missing on a usable row, the import fails with sample row numbers

### Resolving vendor accounts + templates

Before importing, the server resolves:

- Vendor accounts by matching file vendor names to Account `accountName` or `accountLegalName` (case-insensitive)
- A template per vendor account (most recently updated template for that distributor+vendor)

If any vendor account cannot be resolved or has no template, the multi-vendor import fails.

### Output

Multi-vendor import produces:

- `depositIds: string[]` (one per vendor)
- Each deposit points at the vendor's resolved template ID

---

## Telarus-seeded templates (how they work)

When listing templates for a distributor/vendor pair, if **no templates exist**, the backend may auto-seed a template using Telarus reference data:

- `GET /api/reconciliation/templates` (`app/api/reconciliation/templates/route.ts`)
- Uses `findTelarusTemplateMatch(...)` from `lib/deposit-import/telarus-template-master.ts`
- Reads `docs/reference-data/telarus-vendor-map-fields-master.csv`

The Telarus seed stores two things in `ReconciliationTemplate.config`:

1) A derived deposit mapping (legacy v1 mapping converted to v2 at runtime)
2) A `telarusTemplateFields` object containing the Telarus field list (used as UI hints / visibility)

Important: if you later import with "Save mapping updates" enabled, the template config is overwritten with only `depositMapping` (see Template persistence section).

---

## Debugging + verification tips

- If an import fails with "ambiguous", check for duplicate headers in the uploaded file (including headers that normalize the same).
- If templates "drift" over time, verify whether the template config still contains Telarus metadata; saving mapping updates overwrites config today.
- To inspect what mapping was used for a past import, check the `ImportJob.filters.mapping` JSON for that import.

Optional tooling:

- CSV export of current template mappings: `GET /api/reconciliation/templates/mapping-export` (`app/api/reconciliation/templates/mapping-export/route.ts`)
