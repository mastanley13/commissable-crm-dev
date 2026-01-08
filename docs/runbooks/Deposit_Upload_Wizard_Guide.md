# Deposit Upload Wizard (Reconciliation) — How It Works

**Audience:** Ops / Finance / QA / Dev  
**Routes:** `/reconciliation` → `/reconciliation/deposit-upload-list`  

## What Deposit Upload does

The Deposit Upload wizard takes a distributor/vendor “deposit report” file (CSV/XLS/XLSX), lets you map file columns to Commissable’s canonical deposit fields, and then imports it into:

- `Deposit` (one per upload)
- `DepositLineItem` (one per usable row)

After import, the deposit can be reviewed and matched in the Reconciliation detail experience at `/reconciliation/[depositId]`.

## Where to find it

1. Go to **Reconciliation** (`/reconciliation`).
2. Click **Deposit Upload** (header button).
3. You land on **Deposit Reconciliation** (`/reconciliation/deposit-upload-list`).

## Wizard steps (UI behavior)

### 1) Create Deposit

Required inputs:
- **Distributor** (Account of type `Distributor`)
- **Vendor** (Account of type `Vendor`)
- **Commission Period** (`YYYY-MM`)
- **Deposit Received Date** (`YYYY-MM-DD`)
- **File upload** (`.csv`, `.xlsx`, `.xls`)

Auto-filled:
- **Deposit Name** is auto-generated from `Vendor + Distributor + Deposit Received Date` and is currently read-only in the UI.
- **Created By** is derived from the logged-in user (display only).

### 2) Map Fields

This step maps *uploaded column headers* to Commissable fields.

Required mappings (the import cannot run without these):
- `Usage Amount` (`usage`)
- `Commission Amount` (`commission`)

Common optional mappings:
- `Payment Date` (`paymentDate`) — line-level date; falls back to the deposit date if omitted
- `Account / Customer Name` (`accountNameRaw`)
- `Account ID (Vendor)` (`accountIdVendor`)
- `Customer ID (Vendor)` (`customerIdVendor`)
- `Order ID (Vendor)` (`orderIdVendor`)
- `Product Name / SKU` (`productNameRaw`)
- `Commission Rate (%)` (`commissionRate`)
- `Location ID` (`locationId`)
- `Customer PO #` (`customerPurchaseOrder`)

Auto-seeding:
- When a file is selected, the wizard parses it client-side and attempts to seed mapping from an existing `ReconciliationTemplate` for the selected Distributor+Vendor.
- If no template mapping exists (or it doesn’t match the current headers), the UI uses heuristic auto-mapping based on common header synonyms.

Non-canonical columns:
- Columns can also be tagged as **Ignored**, **Additional info**, **Product info**, or **Custom fields**.
- Current import behavior only persists the canonical field mappings into `DepositLineItem` columns; custom/additional/product tagging is stored in template config for future seeding but is not imported into structured DB columns.

### 3) Review

Shows:
- A “mapping summary” (field → column header)
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
   - `month`: `commissionPeriod` (start-of-month UTC) if valid, otherwise derived from the deposit date
   - `paymentDate`: deposit received date
   - `distributorAccountId`, `vendorAccountId`, `createdByUserId`, optional `createdByContactId`
4. Creates `DepositLineItem` records from rows:
   - Rows are skipped if both `usage` and `commission` cannot be parsed.
   - Numeric parsing removes non-numeric characters (e.g., `$` and commas). If your vendor encodes negatives as `(123.45)`, those parentheses are stripped and the value will be treated as positive.
   - Line-level `paymentDate` supports ISO strings and Excel serial dates; otherwise it falls back to the deposit date.
5. Updates deposit totals (`totalItems`, `totalUsage`, `totalCommissions`, allocated/unallocated counts).
6. Writes an `ImportJob` record (entity: `Reconciliations`) for traceability (import runs synchronously today).
7. Persists the mapping back to `ReconciliationTemplate.config.depositMapping` for the Distributor+Vendor pair:
   - Updates the existing template if present, otherwise creates a default template.

## After import: where the data shows up

- Deposits list: `/reconciliation`
- Deposit detail: `/reconciliation/[depositId]`
  - Review line items and suggested matches
  - Apply/unapply matches
  - Run AI matching (`/reconciliation/[depositId]/ai-matching`)
  - Finalize the deposit when no unreconciled lines remain

## Common errors and fixes

- **“Unsupported file type”**: Upload `.csv`, `.xlsx`, or `.xls`.
- **“CSV file is missing a header row” / “Spreadsheet is missing a header row”**: Add a header row and re-upload.
- **“Missing mapping for required fields…”**: Map both `Usage Amount` and `Commission Amount`.
- **“Column \"X\" not found in uploaded file”**: The mapping references a header that isn’t present (header changed or typo).
- **“Uploaded file did not contain any data rows”**: Ensure there are rows beneath the header.
- **“No usable rows were found”**: The mapped Usage/Commission columns are empty or not parseable as numbers.
- **403/401 errors**: Ensure your role includes `reconciliation.manage` to import.

## Code pointers (for developers)

- Wizard page: `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
- Step components: `components/deposit-upload/*`
- Parsing: `lib/deposit-import/parse-file.ts`
- Field definitions: `lib/deposit-import/fields.ts`
- Mapping model + auto-mapping: `lib/deposit-import/template-mapping.ts`
- Import API: `app/api/reconciliation/deposits/import/route.ts`

## Related docs

- Technical deep-dive: `docs/deposit-upload-mapping.md`
- QA test checklist: `docs/runbooks/12-4-25-Deposit-Upload-Testing-Guide.md`
- Implementation summary: `docs/notes/12-4-25-Deposit-Upload-Implementation-Summary.md`

## Telarus templates (seeding)

The wizard only uses templates that exist in the database (`ReconciliationTemplate.config.depositMapping`). The Telarus reference spreadsheet (`docs/reference-data/telarus-vendor-map-fields-master.csv`) is not read at runtime unless you seed templates from it.

To seed/update Telarus templates:

- `npm run seed:telarus-templates`
  - Optional: set `TENANT_ID` or `TENANT_SLUG` to target a specific tenant.
