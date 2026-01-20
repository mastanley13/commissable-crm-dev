# Deposit Upload Wizard (Reconciliation) — How It Works

**Audience:** Ops / Finance / QA / Dev  
**Routes:** `/reconciliation` → `/reconciliation/deposit-upload-list`

## What Deposit Upload does

The Deposit Upload wizard takes a distributor/vendor deposit report file (CSV/XLS/XLSX), lets you map file columns to Commissable’s canonical deposit fields, and imports it into:

- `Deposit` (one per upload)
- `DepositLineItem` (one per usable row)

After import, the deposit can be reviewed and matched in the Reconciliation experience at `/reconciliation/[depositId]`.

## Where to find it

1. Go to **Reconciliation** (`/reconciliation`).
2. Click **Deposit Upload**.
3. You land on **Deposit Reconciliation** (`/reconciliation/deposit-upload-list`).

## Wizard steps

### 1) Create Deposit

Required inputs:
- **Distributor** (Account of type `Distributor`)
- **Vendor** (Account of type `Vendor`)
- **Commission Period** (`YYYY-MM`)
- **Deposit Received Date** (`YYYY-MM-DD`)
- **File upload** (`.csv`, `.xlsx`, `.xls`)

Auto-filled:
- **Deposit Name** is generated from `Vendor + Distributor + Deposit Received Date`.
- **Created By** is derived from the logged-in user (display only).

### 2) Map Fields

This step maps *uploaded column headers* to Commissable’s canonical deposit fields.

Required mappings (the import cannot run without these):
- `Usage Amount` (`usage`)
- `Commission Amount` (`commission`)

Common optional mappings:
- `Payment Date` (`paymentDate`)
- `Account / Customer Name` (`accountNameRaw`)
- `Account ID (Vendor)` (`accountIdVendor`)
- `Customer ID (Vendor)` (`customerIdVendor`)
- `Order ID (Vendor)` (`orderIdVendor`)
- `Product Name / SKU` (`productNameRaw`)
- `Commission Rate (%)` (`commissionRate`)
- `Location ID` (`locationId`)
- `Customer PO #` (`customerPurchaseOrder`)
- `Line Number` (`lineNumber`)

Template behavior:
- When a file is selected, the wizard fetches the saved `ReconciliationTemplate` for the selected **Distributor + Vendor**.
- If a template exists, the wizard seeds the mapping UI from `ReconciliationTemplate.config.depositMapping` (v1), then applies heuristic “auto-mapping” to fill obvious gaps.
- The Map Fields table is split into 3 tabs:
  - **Template Fields**: columns that appear in the saved template mapping (shown even if they have no values, so missing data is visible)
  - **New Fields**: columns not in the template that have values and a suggested canonical field match (or are already mapped)
  - **Exclude**: columns with no values, columns set to **Do Not Map**, and columns without suggested matches that remain unmapped

Notes:
- Template-mapped columns may include “template-only” fields that are not currently imported into structured DB columns (for example: Billing Month, Comments, Commission Type). These are shown for visibility but are not persisted into `DepositLineItem` today.

### 3) Review

Shows:
- A mapping summary (field → column header)
- A small preview of parsed rows
- Blocking validation issues (e.g., missing required mappings)

### 4) Confirm

Clicking **Start Import** uploads the file + mapping to the backend import endpoint. On success, the UI shows a link to the new deposit detail page.

## File requirements and parsing rules

Supported formats:
- CSV (`.csv`)
- Excel (`.xls`, `.xlsx`) — only the first worksheet is imported

Hard requirements:
- The file must have a header row.
- There must be at least one data row.
- You must map `Usage Amount` and `Commission Amount`.

## Backend import behavior (what happens on “Start Import”)

Endpoint:
- `POST /api/reconciliation/deposits/import` (multipart `FormData`)

Authorization:
- Requires `reconciliation.manage` and `reconciliation.view`.

Processing summary:
1. Re-parses the uploaded file server-side (CSV via `papaparse`, Excel via `xlsx`).
2. Validates required mappings and ensures mapped columns exist in the uploaded headers.
3. Creates a `Deposit` record using:
   - `month`: `commissionPeriod` (start-of-month UTC) if valid; otherwise derived from the deposit date
   - `paymentDate`: deposit received date
   - `distributorAccountId`, `vendorAccountId`, `createdByUserId`, optional `createdByContactId`
4. Creates `DepositLineItem` records from rows:
   - Rows are skipped if both `usage` and `commission` cannot be parsed
   - Numeric parsing removes non-numeric characters (e.g., `$` and commas)
   - Line-level `paymentDate` supports ISO strings and Excel serial dates; otherwise it falls back to the deposit date
5. Updates deposit totals (`totalItems`, `totalUsage`, `totalCommissions`, allocated/unallocated counts).
6. Writes an `ImportJob` record for traceability.
7. Persists the mapping back to `ReconciliationTemplate.config.depositMapping` for the Distributor+Vendor pair (update if present; create if missing).

## Telarus templates (runtime seeding)

For Telarus distributor uploads, the templates endpoint can auto-seed template metadata at runtime from:

- `docs/reference-data/telarus-vendor-map-fields-master.csv`

Specifically, `GET /api/reconciliation/templates?distributorAccountId=...&vendorAccountId=...` may populate:
- `config.depositMapping` (canonical import mappings)
- `config.telarusTemplateFields` (the full Telarus template field list used to power the “Template-mapped columns” table)

You can also seed templates manually:
- `npm run seed:telarus-templates`
  - Optional: set `TENANT_ID` or `TENANT_SLUG` to target a specific tenant.

## Common errors and fixes

- **Unsupported file type**: Upload `.csv`, `.xlsx`, or `.xls`.
- **Missing mapping for required fields**: Map both `Usage Amount` and `Commission Amount`.
- **Column "X" not found in uploaded file**: The mapping references a header that isn’t present (header changed or typo).
- **Uploaded file did not contain any data rows**: Ensure there are rows beneath the header.
- **No usable rows were found**: The mapped Usage/Commission columns are empty or not parseable as numbers.
- **403/401 errors**: Ensure your role includes `reconciliation.manage` to import.

## Code pointers (for developers)

- Wizard page: `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
- Step components: `components/deposit-upload/*`
- Parsing: `lib/deposit-import/parse-file.ts`
- Field definitions: `lib/deposit-import/fields.ts`
- Mapping model + auto-mapping: `lib/deposit-import/template-mapping.ts`
- Telarus template parsing: `lib/deposit-import/telarus-template-master.ts`
- Templates API: `app/api/reconciliation/templates/route.ts`
- Import API: `app/api/reconciliation/deposits/import/route.ts`
