# Deposit Upload, Field Mapping, and Templates – Technical Overview

This document explains how the Deposit Upload wizard, field‑mapping model, and reconciliation templates work together in the Commissable CRM codebase.

It is intended for engineers and power users who need to understand how deposit files are parsed, how columns are mapped to canonical fields, and how Distributor/Vendor‑specific templates are seeded and evolve over time.

---

## Core Concepts and Types

### Canonical Deposit Fields

File: `lib/deposit-import/fields.ts`

We define canonical line‑level fields for deposit line items via `DepositFieldDefinition`:

- `id: string` – internal identifier (`usage`, `commission`, `commissionRate`, `accountNameRaw`, `accountIdVendor`, etc.)
- `label: string` – UI label.
- `type: "string" | "number" | "date"`.
- `scope: "header" | "line"` – all current fields are line‑level.
- `required?: boolean` – required for a valid import.

`requiredDepositFieldIds` is derived from these definitions and contains the field IDs that must be mapped before importing (currently `usage` and `commission`).

These canonical fields drive:

- UI labels in the mapping and review steps.
- Validation on the client and server.
- The shape of data stored in `DepositLineItem` records.

### Deposit Mapping Config

File: `lib/deposit-import/template-mapping.ts`

The shared mapping model is `DepositMappingConfigV1`:

```ts
export interface DepositMappingConfigV1 {
  version: 1
  line: Partial<Record<DepositFieldId, string>>
  columns: Record<string, DepositMappingColumnConfig>
  customFields: Record<string, DepositCustomFieldDefinition>
  header?: {
    depositName?: string | null
    paymentDateColumn?: string | null
    customerAccountColumn?: string | null
  }
  options?: {
    hasHeaderRow?: boolean
    dateFormatHint?: string
    numberFormatHint?: string
  }
}
```

- `line` maps each canonical field ID to a *column header* from the uploaded file.
- `columns[columnName]` stores how non‑canonical columns should be treated:
  - `mode: "custom" | "additional" | "product" | "ignore"`.
  - `customKey?: string` when `mode === "custom"`.
- `customFields[customKey]` stores label and section (`"additional"` or `"product"`) for user‑defined custom fields.

This config is used:

- In the Map Fields UI to render current selections and update them.
- By the import route to enforce required mappings and build column indices.
- As the template payload persisted in `ReconciliationTemplate.config`.

### Helper Functions

Key helpers in `template-mapping.ts`:

- `createEmptyDepositMapping()` – returns a blank `DepositMappingConfigV1`.
- `applyAutoMapping(headers, mapping)` – fills in `line` mappings using a heuristic synonym table:
  - `AUTO_FIELD_SYNONYMS: Partial<Record<DepositFieldId, string[]>>`.
  - Identifies headers such as "usage", "total commission", "customer name", "nav id", etc.
- `seedDepositMapping({ headers, templateMapping })`:
  - Starts from an empty mapping.
  - If `templateMapping` is provided:
    - Clones it, prunes references to headers that no longer exist in the current file.
    - Runs `applyAutoMapping` on top to fill in gaps.
  - If no template is provided:
    - Runs `applyAutoMapping` starting from a blank mapping.
- `getColumnSelection(mapping, columnName)`:
  - Returns a discriminated union describing how the column is interpreted:
    - `{ type: "canonical"; fieldId }`
    - `{ type: "custom"; customKey }`
    - `{ type: "additional" | "product" | "ignore" }`
- `setColumnSelection(mapping, columnName, selection)`:
  - Updates the mapping to reflect the user’s choice, ensuring 1:1 relationships between columns and fields for canonical selections.
- `createCustomFieldForColumn(mapping, columnName, { label, section })`:
  - Adds a new `customFields[customKey]`.
  - Sets `columns[columnName] = { mode: "custom", customKey }`.
  - Removes any canonical mapping that previously targeted this column.
- `extractDepositMappingFromTemplateConfig(config)` / `serializeDepositMappingForTemplate(mapping)`:
  - Normalizes untrusted `config` JSON into a `DepositMappingConfigV1`.
  - Ensures we always work with a known shape when reading/writing templates.

---

## Template Storage and APIs

### Prisma Model

File: `prisma/schema.prisma`

```prisma
model ReconciliationTemplate {
  id                   String   @id @default(uuid()) @db.Uuid
  tenantId             String   @db.Uuid
  name                 String
  description          String?
  distributorAccountId String   @db.Uuid
  vendorAccountId      String   @db.Uuid
  createdByUserId      String   @db.Uuid
  createdByContactId   String?  @db.Uuid
  config               Json?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  tenant               Tenant   @relation(fields: [tenantId], references: [id])
  distributor          Account  @relation("ReconciliationTemplateDistributor", fields: [distributorAccountId], references: [id])
  vendor               Account  @relation("ReconciliationTemplateVendor", fields: [vendorAccountId], references: [id])
  createdByUser        User     @relation(fields: [createdByUserId], references: [id])
  createdByContact     Contact? @relation(fields: [createdByContactId], references: [id])

  @@unique([tenantId, distributorAccountId, vendorAccountId])
  @@index([tenantId, distributorAccountId, vendorAccountId])
}
```

- Templates are uniquely keyed by `(tenantId, distributorAccountId, vendorAccountId)`.
- `config` typically contains:
  - `{ depositMapping: DepositMappingConfigV1, telarusTemplateId?: string | null, telarusOrigin?: string }`.

### Template API

File: `app/api/reconciliation/templates/route.ts`

- `GET /api/reconciliation/templates`
  - Query params:
    - `distributorAccountId` (required)
    - `vendorAccountId` (required)
    - `q` (optional name search)
    - `pageSize` (default 25)
  - Returns:
    - `data`: array of templates with `id`, `name`, distributor/vendor names, and `config`.
    - `pagination`: `{ total, pageSize }`.
- `POST /api/reconciliation/templates`
  - Body:
    - `name`, `description`, `distributorAccountId`, `vendorAccountId`, `createdByContactId?`, `config?`.
  - Validates account and contact IDs, then creates a new `ReconciliationTemplate`.

The Deposit Upload flow uses `GET` to hydrate templates; the import route uses the Prisma model directly to persist updated mappings.

---

## Wizard Flow and Runtime Behavior

### Step 1 – Create Deposit

File: `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`  
Component: `CreateTemplateStep`

- Captures:
  - Distributor account (lookup).
  - Vendor account (lookup).
  - Deposit received date and commission period.
  - Auto‑generated deposit name (vendor + distributor + date).
  - Created‑by contact (defaulting to the current user).
  - Uploaded CSV/XLS file.
- Once required values are present, the user can proceed to **Map Fields**.
- No mapping logic is executed yet; the file is stored in state (`selectedFile`) and context (distributor/vendor IDs) is prepared for later use.

### Step 2 – Map Fields

Files:

- `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
- `components/deposit-upload/map-fields-step.tsx`

#### Parsing and Template Lookup

When `selectedFile` changes, a `useEffect` in `DepositUploadListPage`:

1. Parses the uploaded file using `parseSpreadsheetFile`:
   - Returns `headers: string[]` and `rows: string[][]`.
2. Sets:
   - `csvHeaders = headers`.
   - `sampleRows = rows.slice(0, 5)`.
   - `parsedRowCount = rows.length`.
3. Attempts to load a `ReconciliationTemplate`:
   - Reads `formState.distributorAccountId` and `formState.vendorAccountId`.
   - If both are present, calls:
     - `GET /api/reconciliation/templates?distributorAccountId=...&vendorAccountId=...&pageSize=1`.
   - If a template is returned and has a `config`:
     - Uses `extractDepositMappingFromTemplateConfig(config)` to obtain `templateMapping: DepositMappingConfigV1`.
4. Seeds the working mapping:
   - Calls `seedDepositMapping({ headers, templateMapping })`.
   - If no template was found, `templateMapping` is `null`, so auto‑mapping uses only `AUTO_FIELD_SYNONYMS`.
5. Stores the result in component state:
   - `mapping: DepositMappingConfigV1`.

On parse failure:

- Clears headers and sample rows.
- Resets `mapping` via `createEmptyDepositMapping()`.
- Sets a user‑visible parsing error message.

#### Map Fields UI – Column Layout

`MapFieldsStep` renders a 4‑column grid, conceptually similar to GHL’s import wizard:

1. **Field Label in File**
   - The CSV header (`header`) or `(unnamed column)`.
   - Displayed in bold text, with mobile‑friendly labels.
2. **Preview Information**
   - A single sample value per column from the currently selected sample row.
   - Sampling window:
     - Maintained as `previewRowIndex` in local state.
     - Window size is 1 (`PREVIEW_PAGE_SIZE`).
     - `previewWindow = sampleRows.slice(windowStart, windowEndExclusive)`.
   - For each column:
     - `previewValues = previewWindow.map(row => row[index] ?? "").filter(non‑empty)`.
     - Renders each value on its own line (first line in normal tone, additional lines slightly muted).
   - If there are no values in the window, shows `No sample values in these rows.`.
3. **Status**
   - Derived from `getColumnSelection(mapping, header)`:
     - `Mapped` / `Required mapped` (green) when `type === "canonical"`.
     - `Custom field` (blue) when `type === "custom"`.
     - `Product info` (indigo) when `type === "product"`.
     - `Additional info` or `Ignored` (gray) for those modes.
4. **Map to Commissable Field**
   - `<select>` control with:
     - `Additional info (no specific field)`.
     - `Product info column`.
     - `Ignore this column`.
     - Optgroup: `Map to Commissable field` containing all `depositFieldDefinitions` with required fields annotated.
     - If a custom field is present, optgroup: `Custom field` with the custom label.
   - Under the select:
     - `Create custom field (Additional)` and `Create custom field (Product)` buttons, which prompt for a label and call `onCreateCustomField(header, { label, section })`.

#### Row Pager (Preview Window Navigation)

- A compact pager at the top‑right of the “Uploaded columns” card shows:
  - `Row {windowStart + 1} of {totalPreviewRows}`.
- Navigation:
  - Left arrow moves backward by 1 row:
    - `previewRowIndex = max(0, previewRowIndex - PREVIEW_PAGE_SIZE)`.
  - Right arrow moves forward by 1 row, stopping before exceeding the row count.
  - Buttons are disabled on the first/last window based on computed flags.

#### Validation in Map Fields

`DepositUploadListPage` computes `canonicalFieldMapping` from `mapping.line` and populates `validationIssues`:

- For each `requiredDepositFieldId`, if no column is mapped, adds an instruction such as `Map the "Usage Amount" field`.
- Adds issues for:
  - Missing file.
  - Parsing error present.
  - No data rows detected.

The “Continue to Review” button is disabled if:

- Any required field is unmapped.
- `csvHeaders` is empty.
- `parsingError` is non‑null.

### Step 3 – Review

File: `components/deposit-upload/review-step.tsx`

- Props:
  - `csvHeaders`, `sampleRows`.
  - `fieldMapping` – the canonical subset of `mapping.line` (`Record<string,string>`).
  - `validationIssues`.
- Displays three sections:
  1. **Mapping summary**
     - For each mapped canonical field:
       - Looks up the label from `depositFieldDefinitions`.
       - Shows `Field Label → Column Header`.
  2. **Sample rows**
     - A simple table that renders up to five full rows for visual verification.
  3. **Validation**
     - If `validationIssues.length === 0`, shows “No blocking issues detected.”
     - Otherwise, lists issues in red.

Users can go back to Map Fields or proceed to Confirm.

### Step 4 – Confirm & Import

Files:

- `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
- `app/api/reconciliation/deposits/import/route.ts`

#### Client‑Side Submit

On “Confirm”:

- The page first calls `handleProceedFromReview` to set `importSummary` (total rows + count of mapped canonical fields).
- Then `handleConfirmSubmit`:
  - Validates:
    - `selectedFile` present.
    - `importSummary` present (user must visit Review before importing).
  - Constructs `FormData`:
    - `file` – original file.
    - `depositName`, `paymentDate`, `commissionPeriod`.
    - `distributorAccountId`, `vendorAccountId`, `createdByContactId`.
    - `mapping` – JSON.stringify of the full `DepositMappingConfigV1` state.
  - POSTs to `/api/reconciliation/deposits/import`.

#### Server‑Side Import and Template Persistence

`POST /api/reconciliation/deposits/import`:

1. **Request validation**
   - Ensures:
     - File present and of supported type.
     - `distributorAccountId` and `vendorAccountId` present.
     - `paymentDate` parsable as a date.
   - Parses `commissionPeriod` into a month‑level `Date` (start of month).
2. **Mapping normalization**
   - Parses the `mapping` JSON as `mappingPayload: unknown`.
   - Distinguishes:
     - New shape: `DepositMappingConfigV1` (`version === 1` and `line` object present).
     - Legacy shape: flat `{ fieldId: columnName }`.
   - Builds:
     - `canonicalMapping: Record<string,string>` – always `fieldId → columnName`.
     - `mappingConfigForTemplate: DepositMappingConfigV1`:
       - For v1 payloads: `extractDepositMappingFromTemplateConfig({ depositMapping: mappingPayload })`.
       - For legacy payloads:
         - Calls `createEmptyDepositMapping()`.
         - Copies any key that matches a canonical `DepositFieldId` into `line`.
3. **Required‑field validation**
   - Ensures each `requiredDepositFieldId` exists in `canonicalMapping`.
   - If any missing, returns a 400 error listing the missing field labels.
4. **File parsing and column index building**
   - Calls `parseSpreadsheetFile(file, file.name, file.type)` to get `headers` and `rows`.
   - Uses `buildColumnIndex(headers, canonicalMapping)` to create `fieldId → headerIndex`.
   - If any referenced column is not found, returns an error.
5. **Transaction: create deposit and line items**
   - Creates a `Deposit` with:
     - `tenantId`, `accountId` (distributor), `depositName`, `paymentDate`, `month` (commission period).
     - Distributor/vendor IDs, created‑by user/contact.
   - Iterates over `parsedFile.rows`:
     - Pulls numeric values for `usage` and `commission` via `normalizeNumber`.
     - Skips rows where both are null.
     - Builds line‑item attributes using `columnIndex` for:
       - `paymentDate`, `commissionRate`, account/customer/vendor IDs, product name, location, PO, etc.
   - Inserts `DepositLineItem` rows via `createMany`.
   - Aggregates totals and updates the `Deposit` with usage and commission aggregates.
   - Creates an `ImportJob` record capturing:
     - File name, row counts, success/error counts.
     - Filters: distributor/vendor IDs, raw `mappingPayload`, commission period.
6. **Template update**
   - If `mappingConfigForTemplate` exists:
     - Serializes it via `serializeDepositMappingForTemplate(mappingConfigForTemplate)` to a stable JSON envelope.
     - In the same transaction:
       - Tries to find an existing `ReconciliationTemplate` for `(tenantId, distributorAccountId, vendorAccountId)`.
       - If found:
         - `update`s its `config` with the latest mapping envelope.
       - If not found:
         - `create`s a new template:
           - `name`: `"Default deposit mapping"`.
           - `description`: `"Auto-created from deposit upload mapping."`
           - `config`: serialized mapping envelope.
           - `createdByUserId`: current user.
           - `createdByContactId`: same as deposit, if provided.

Result: every successful import persists the user‑corrected mapping as the current template for that Distributor/Vendor pair.

---

## Telarus CSV Seeding

File: `docs/reference-data/telarus-vendor-map-fields-master.csv`  
Script: `scripts/seed-telarus-reconciliation-templates.ts`

The Telarus CSV is a reference file that enumerates:

- Template map names.
- Distributor (`Origin`) and vendor (`CompanyName`).
- Telarus template IDs and commission types.
- Field IDs, Telarus field names, and desired Commissable field labels.

The seeding script imports this information and turns it into initial templates:

1. **CSV parsing**
   - Uses `Papa.parse` to read the CSV as `string[][]`.
   - Identifies two blocks:
     - Common fields block (using `Telarus CommonFields` / `New Commissable Field Label` headings).
     - Per‑template block (`Telarus fieldName` / `Commissable Field Label` headings).
   - Produces a flat array of `TelarusRow` objects, each with:
     - `templateMapName`, `origin`, `companyName`, `templateId`, `commissionType`, `fieldId`, `telarusFieldName`, `commissableFieldLabel`.
2. **Grouping by Distributor/Vendor**
   - Groups rows by key: `${origin}|${companyName}`.
   - Each group represents a candidate template for a `(Distributer, Vendor)` pair.
3. **Mapping Telarus labels to `DepositFieldId`s**
   - Uses the `COMMISSABLE_LABEL_TO_DEPOSIT_FIELD_ID` constant:
     - Example mappings:
       - `"Actual Usage - Gross"` / `"Actual Usage"` → `"usage"`.
       - `"Actual Commission"` → `"commission"`.
       - `"Actual Commission Rate %"` → `"commissionRate"`.
       - `"Account Legal Name"` / `"Company Name"` → `"accountNameRaw"`.
       - `"Customer Account"`, `"Vendor - Account ID"` → `"accountIdVendor"`.
       - `"Vendor Name"` → `"vendorNameRaw"`.
       - `"Vendor - Customer ID"` → `"customerIdVendor"`.
       - `"Vendor - Order ID"` → `"orderIdVendor"`.
       - `"Vendor - Product Name"` → `"productNameRaw"`.
       - `"Vendor - Location  ID"` → `"locationId"`.
       - `"Payment Date"` → `"paymentDate"`.
   - For each `TelarusRow` in a group:
     - If `commissableFieldLabel` is recognized:
       - Adds `line[fieldId] = telarusFieldName`.
4. **Building and serializing the mapping**
   - For each group with at least one recognized mapping:
     - Constructs a `DepositMappingConfigV1` via `createEmptyDepositMapping()` and the populated `line`.
     - Serializes it via `serializeDepositMappingForTemplate(mapping)` to a JSON structure.
5. **Persisting as `ReconciliationTemplate` rows**
   - Resolves Distributor and Vendor `Account` records for the tenant using `accountName` matches.
   - For each group:
     - If no matching accounts are found, logs a warning and skips the template.
     - Checks for an existing template for `(tenantId, distributorAccountId, vendorAccountId)`:
       - If it exists: `update`s its `config`.
       - If not: `create`s a new template with:
         - `name`: `Template Map Name` or a fallback name.
         - `description`: “Seeded from Telarus vendor map fields master CSV.”
         - `config`: serialized mapping plus `telarusTemplateId` and `telarusOrigin`.

Running this script gives you a library of templates that the Deposit Upload flow can use immediately when users select Telarus Distributor/Vendor combinations.

---

## Summary

- **Mapping model**: `DepositMappingConfigV1` provides a unified way to represent mapping from vendor columns to canonical deposit fields, including additional/product/custom/ignore semantics.
- **Templates**: `ReconciliationTemplate` records store these mappings per `(Distributor, Vendor)` and can be seeded from Telarus data or learned over time.
- **Wizard flow**:
  - Step 1 captures context and file metadata.
  - Step 2 applies templates + heuristic auto‑mapping and lets the user refine mappings via a rich 4‑column UI with multi‑row previews.
  - Step 3 surfaces a mapping summary, sample rows, and validation issues.
  - Step 4 imports rows into `Deposit` / `DepositLineItem` while persisting the final mapping back into templates.
- **Learning behavior**:
  - Every successful import updates or creates a template for that Distributor/Vendor pair, ensuring future uploads start from a better default mapping.

This architecture keeps the mapping logic centralized, enables vendor‑specific templates, and allows the system to improve mappings over time based on real user behavior and Telarus reference data.

