# Deposit Upload + Field Mapping + Templates — Deep Dive (Current Workflow)

Last reviewed: 2026-02-05  
Scope: Current behavior in this repo (UI + API) for **Deposit Upload**, **Field Mapping**, and **Reconciliation Templates**.

---

## Why this exists

Clients and implementers often need to understand:

- What happens when a deposit file is uploaded
- How columns in the file get mapped to Commissable fields
- How templates are created, selected, and updated over time

This document describes the workflow *as implemented today*, including some important edge-cases and “behind the scenes” rules that affect outcomes.

---

## Glossary (plain-English)

- **Deposit**: A single uploaded deposit “batch” for a specific **Distributor** and **Vendor** (or one per vendor in multi-vendor mode). It contains many **Deposit Line Items**.
- **Deposit Line Item**: One imported row from the uploaded file that contains at least one usable numeric value for **Actual Usage** or **Actual Commission**.
- **Field Mapping**: The rules that say “column X in the uploaded file becomes field Y in Commissable”.
- **Template (Reconciliation Template)**: A saved mapping configuration tied to *(Distributor, Vendor, Template Name)* that can pre-fill mapping for future uploads.
- **Custom Field (during mapping)**: A user-defined label for a source column that isn’t mapped into a standard Commissable field. It’s stored as metadata on each imported line item.
- **Multi‑Vendor Upload**: A special mode where a single file contains multiple vendors; the system splits that one upload into multiple Deposits (one per vendor).

---

## The user workflow (what someone does in the UI)

### 1) Start Deposit Upload

From the main **Reconciliation / Deposits List** page, click **Deposit Upload**.  
This routes to: `/reconciliation/deposit-upload-list`.

The upload flow is a 3-step wizard:

1. **Create Deposit** (choose context + attach the file)
2. **Field Mapping** (map columns to import targets)
3. **Review** (confirm + import)

---

## Step 1 — Create Deposit (choose context + attach file)

In the Create step, you provide the “header” information that tells Commissable how to interpret the file:

- **Distributor** (required)
- **Vendor** (required, unless Multi‑Vendor Upload is enabled)
- **Multi‑Vendor Upload toggle**
- **Commission Period** (required, `YYYY-MM`)
- **Deposit Received Date** (required, `YYYY-MM-DD`)
- **Deposit Name** (auto-generated; read-only)
- **Created By** (auto-filled from the logged-in user)
- **Upload file** (required)

### File types supported

The uploader accepts:

- `.csv`
- `.xlsx` / `.xls`
- `.pdf` (must be text-based; scanned/image PDFs generally won’t work)

### Multi‑Vendor Upload toggle (important)

When **Multi‑Vendor Upload** is turned on:

- The **Vendor picker** is disabled (because vendor will be determined per row from a mapped “Vendor Name” column).
- Template selection is cleared (templates are resolved per vendor on the backend during import).
- Non-transaction rows (Totals/Subtotals/etc.) are automatically skipped during import.

---

## Step 2 — Field Mapping (map file columns to Commissable fields)

Once a file is selected, the UI immediately:

1. **Parses the file** to detect `headers[]` and `rows[]`
2. Loads the **Field Catalog** from the server (the list of valid “targets” you can map to)
3. If a template is selected/available, loads that template’s saved mapping and uses it to **seed** the current mapping
4. Runs **auto-mapping** to fill obvious matches (based on header synonyms / normalization)

### What “Field Catalog” means

The mapping dropdowns are driven by a server-provided catalog of targets grouped by entity, including:

- Deposit Line Item fields (Usage, Commission, Account Legal Name, Vendor Name, etc.)
- Deposit-level fields (Deposit Name, Payment Date)
- Matching-related fields (e.g., External Schedule ID)
- Opportunity and Product metadata fields

This catalog is tenant-aware (it can include tenant-defined Opportunity fields).

### Required mapping rules (blocking rules)

You cannot continue / import unless:

- You map **at least one** of:
  - **Actual Usage**, or
  - **Actual Commission**
- If **Multi‑Vendor Upload** is enabled, you must also map:
  - **Vendor Name**

### Mapping UI layout (how columns are presented)

Columns are presented in a table-like view with a sample-row preview and three column “buckets”:

1. **Template Fields**
   - Columns that appear to be part of a template-driven mapping (or core “important” fields).
2. **New Fields**
   - Columns not in the template, that have values, and that have a reasonable suggestion.
3. **Exclude**
   - Columns that are:
     - explicitly set to “Do Not Map”, or
     - have no values, or
     - don’t have a good suggestion and are currently treated as “additional”

Each column can be set to one of these behaviors:

- **Map to a target field** (e.g., map `Total Bill` → `Actual Usage`)
- **Create a Custom Field** (store the column into metadata with a label)
- **Additional** (keep as “unmapped / informational”; does not go into a standard target)
- **Ignore / Do Not Map** (explicitly exclude)

### Suggestions and hints (how the UI helps)

The UI uses header normalization + a synonyms table to suggest likely matches.

- Example: A header like `Total Commission` will strongly suggest mapping to **Actual Commission**
- Headers that look like `%` / `rate` are de-prioritized for **Usage** and **Commission** to avoid accidentally mapping rates as amounts

If the selected template includes “Telarus template field hints”, the UI can also highlight columns that are known to be meaningful even if they aren’t mapped yet.

### Undo

The mapping step supports **Undo** (a short history of previous mapping states) to recover from accidental changes.

### “Save mapping updates” (template persistence)

When a template is selected, the mapping page may show:

- A checkbox: **Save mapping updates to this template for future uploads**

If enabled, the server will update the selected template’s stored config after import.

Important guarantees:

- Saving updates affects **future uploads** using that template.
- It does **not** change existing previously-imported deposits.

---

## Step 3 — Review (confirm the mapping and import)

The Review step summarizes:

- Count of detected columns
- Count of mapped fields
- A list of mapped vs unmapped/excluded columns
- Any validation issues (blocking)

When you click **Import**, the UI posts:

- The raw file
- Deposit metadata (dates, distributor/vendor)
- The final mapping JSON
- Flags like multi-vendor and save-template-mapping

to: `POST /api/reconciliation/deposits/import`

On success, the UI receives either:

- `depositId` (single-vendor upload), or
- `depositIds[]` (multi-vendor upload; one deposit per vendor)

---

## What happens on the backend (after you click Import)

This section explains the rules that matter for outcomes and troubleshooting.

### Security / permissions

The import route requires that the user has reconciliation access (view/manage permissions).

### File parsing and header resolution

Parsing:

- CSV: parsed via CSV parser with “header row required”
- Excel: first sheet is used, with “header row required”
- PDF: parsed as a table from text items; password-protected or scanned PDFs will fail

Column resolution:

When a mapping says “use column X”, the server finds that header by trying, in order:

1. Exact header match
2. Trimmed header match
3. Case-insensitive trimmed match
4. Normalized-key match

If there are **two columns that normalize to the same key**, the server returns an **ambiguous column** error (you must fix headers or choose a unique header name).

### Row inclusion rules (which rows become line items)

Only rows that have at least one usable numeric value in:

- **Actual Usage**, or
- **Actual Commission**

will be imported as line items.

If both are empty/unparseable, the row is skipped.

### Commission-only rows

If a row has **Commission** but no **Usage**:

- The system treats it as “commission-only”
- It sets `usage = commission`
- It sets `commissionRate = 1`

This is intended to allow imports where the file provides only commission values.

### Data normalization rules

- **Numbers**: currency symbols and non-numeric characters are stripped (e.g., `$1,234.56` → `1234.56`)
- **Dates**:
  - normal date strings parse normally, and
  - Excel serial date numbers are supported (common in CSV exports from spreadsheets)
- **Booleans**: common strings like `yes/no`, `true/false`, `1/0`
- **Strings**: trimmed; empty strings become null

### Where mapped fields are stored

Mapped targets land in one of three places:

1. **Deposit columns** (deposit-level fields, e.g., Deposit Name / Payment Date)
2. **Deposit Line Item columns** (line-level structured fields like accountNameRaw, vendorNameRaw, productNameRaw, etc.)
3. **Deposit Line Item metadata** (nested JSON for matching/opportunity/product metadata)

Custom fields created in the UI are stored under:

- `depositLineItem.metadata.custom[customKey] = { label, section, value }`

### Deposit Name and Payment Date overrides

If you map a column to a deposit-level target (like Deposit Name or Payment Date), the import logic can **override** the deposit’s “header” values using the first non-empty value found in that mapped column.

This is useful when the file itself contains the authoritative deposit name/date, but it can be surprising if mapped unintentionally.

### Totals computed on import

After line items are created, the deposit record is updated with:

- Total items, unreconciled count
- Total usage and total commissions
- Allocated/unallocated usage and commission (initialized based on imported totals)

### Idempotency (duplicate prevention)

The UI generates an **idempotency key** per file selection.

If the same import request is accidentally submitted twice (refresh/double-click), the server:

- detects an existing completed import job with that idempotency key
- returns the same `depositId` / `depositIds[]` instead of creating duplicates

---

## Template workflow (how templates are created, selected, and evolve)

### What a Template stores

Templates are stored as `ReconciliationTemplate` records keyed by:

- Tenant
- Distributor
- Vendor
- Template Name

Each template has a JSON `config` which may include:

- `depositMapping` (the saved mapping configuration; supports versions)
- optional “Telarus template field” hints
- Telarus metadata (template IDs / origin / map name) when seeded from Telarus

### Where templates come from

Templates can exist through multiple paths:

1. **Created explicitly** via `POST /api/reconciliation/templates`
2. **Saved implicitly** when importing with “Save mapping updates”
3. **Seeded automatically** (Telarus only) when listing templates:
   - If a Distributor/Vendor has *no* templates yet, the server may attempt to match against
     `docs/reference-data/telarus-vendor-map-fields-master.csv`.
   - If it finds a unique match, it creates a seeded template with a pre-built mapping.

### Template selection (current state)

At the code level, templates support multiple names per distributor/vendor, but the current deposit upload UI behavior is:

- When exactly **one** template exists for the chosen distributor/vendor, it can be auto-selected.
- If **multiple** templates exist, the UI does not currently surface a full “choose a template” selector in the Create step.

Practical implication:

- Most deployments should keep **one effective template** per distributor/vendor until a dedicated UI selector/manager is added.

### Updating a template (persisting mapping changes)

If “Save mapping updates” is enabled during import:

- The server writes the mapping config back into the template’s `config`.
- Existing deposits are unchanged (templates affect only future uploads).

There is also an API for template edits:

- `PATCH /api/reconciliation/templates/:templateId`

---

## Multi‑Vendor Upload (detailed behavior)

When Multi‑Vendor Upload is enabled:

1. The mapping must include **Vendor Name** (`depositLineItem.vendorNameRaw`).
2. Each row’s vendor name is read from that column.
3. Rows are skipped if:
   - the entire row is blank, or
   - the vendor name looks like `Totals`, `Subtotal`, `Grand Total`, etc., or
   - any cell contains a Totals/Subtotals style label
4. Remaining rows are grouped by vendor name (case-insensitive).
5. For each vendor group:
   - The system resolves a CRM vendor account by matching vendor name to
     account `accountName` or `accountLegalName` (case-insensitive exact match).
   - A reconciliation template must exist for *(Distributor, that Vendor)*.
   - A new Deposit is created for that vendor and populated with line items.

Result:

- One upload → many deposits → returns `depositIds[]`

Common failure modes:

- Vendor names in the file don’t match CRM vendor account names (exactly)
- One of the vendors doesn’t have a reconciliation template configured

---

## Troubleshooting (common errors and what they usually mean)

- **“Missing mapping for required fields: Actual Usage or Actual Commission”**
  - You must map at least one of Usage or Commission.

- **“Column … is ambiguous”**
  - The file has two headers that normalize to the same value (e.g., `Usage` and `Usage `).
  - Rename one header or remove duplicates.

- **“Column … not found in uploaded file”**
  - The mapping references a header name that doesn’t exist in this specific file.
  - Re-map that field to the correct header.

- **PDF errors (password / no readable text / no header detected)**
  - The PDF is locked, scanned, or not table-like.
  - Export to CSV/Excel where possible.

- **Multi‑vendor: “Unable to resolve vendor account(s)…”**
  - Vendor names in the file don’t exactly match CRM vendor accounts.
  - Align file vendor labels with CRM account names/legal names.

- **Multi‑vendor: “Missing reconciliation template(s) for vendor(s)…”**
  - Templates exist for some vendors but not all.
  - Create templates for the missing vendors, then retry.

---

## Appendix (for engineering / deeper technical review)

### Key pages/components

- Deposit upload wizard: `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
- Create step UI: `components/deposit-upload/create-template-step.tsx`
- Map fields UI: `components/deposit-upload/map-fields-step.tsx`
- Review UI: `components/deposit-upload/review-step.tsx`

### Key API routes

- Field catalog: `GET /api/reconciliation/deposits/import-field-catalog`
- Templates:
  - `GET /api/reconciliation/templates?distributorAccountId=...&vendorAccountId=...`
  - `POST /api/reconciliation/templates`
  - `GET /api/reconciliation/templates/:templateId`
  - `PATCH /api/reconciliation/templates/:templateId`
- Import: `POST /api/reconciliation/deposits/import`

### Data model highlights

- `ReconciliationTemplate` stores template config JSON
- `Deposit` stores the imported batch header and totals
- `DepositLineItem` stores mapped structured fields + `metadata` JSON

### Mapping format (current)

The current UI and import route use a versioned mapping config (v2) that includes:

- `targets`: map of `targetId -> columnName`
- `columns`: per-column mode (`target`, `custom`, `additional`, `ignore`)
- `customFields`: definitions referenced by `columns[*].customKey`

This is what ultimately drives server-side import behavior.

