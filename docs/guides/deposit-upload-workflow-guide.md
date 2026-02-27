# Deposit Upload — Workflow Guide (Single Vendor + Multi‑Vendor)

Last updated: 2026-02-27

This guide explains the **end‑to‑end Deposit Upload workflow**, including how **Multi‑Vendor** uploads work and how the **Field Mapping** UI organizes columns into **Template Fields**, **New Fields**, and **Exclude**.

If you want the implementation-level details (payload shapes, resolver logic, etc.), see `docs/guides/deposit-upload-template-mapping-deep-dive.md`.

---

## Client‑facing summary (start to finish)

1) Start a new upload from **Reconciliation → Deposit Upload**.
2) Choose your **Distributor**, set the **Deposit Received Date** and **Commission Period**, and upload your commission report file (CSV/Excel/PDF).
3) In **Field Mapping**, map the required fields:
   - Single Vendor: map **Actual Usage** *or* **Actual Commission**
   - Multi‑Vendor: map **Vendor Name**, then complete required mapping for **each template** using the **Active Template** dropdown
4) Review your mappings and sample rows, then **Import**.
5) Result:
   - Single Vendor upload creates **one** deposit.
   - Multi‑Vendor upload creates **one deposit per vendor** found in the file.

---

## Concepts (plain language)

- **Distributor**: The master account that owns the deposit (selected in Step 1).
- **Vendor**: The carrier/vendor account for the deposit.
  - Single Vendor: selected in Step 1.
  - Multi‑Vendor: resolved from the uploaded file’s **Vendor Name** column.
- **Template**: A saved “mapping preset” for a specific **Distributor + Vendor** pair. Templates can also include vendor‑specific Telarus “template fields” hints.
- **Mapping**: Your rules that say “this file column maps to this Commissable field” (or should be ignored).

---

## Workflow walkthrough (UI)

### Step 1 — Create Deposit

You provide:

- **Distributor** (required)
- **Vendor** (required for Single Vendor; not used for Multi‑Vendor)
- **Deposit Received Date** (required)
- **Commission Period** (required)
- **Deposit Name** (optional; can be edited)
- **Created By** (optional)
- **Upload file** (required)

**Multi‑Vendor toggle**

- When **Multi‑Vendor** is enabled, Vendor/Template selection is cleared because templates will be resolved from the uploaded file in Step 2.

### Step 2 — Field Mapping

This is where you map columns from the uploaded file to Commissable import fields.

#### Required mappings

- **Single Vendor**: you must map at least one of:
  - **Actual Usage**
  - **Actual Commission**
- **Multi‑Vendor**:
  - You must map **Vendor Name** (to resolve vendors/templates from your file), and
  - For **each resolved template**, you must map at least one of:
    - **Actual Usage**
    - **Actual Commission**

If required mappings are missing, the UI will show warnings. In Multi‑Vendor mode, clicking **Continue** will show a blocking modal listing the **template(s)** and **required field(s)** that still need mapping.

#### How Multi‑Vendor template resolution works

Once you map the **Vendor Name** column:

1) The system scans the uploaded rows and collects unique vendor names (skipping blank rows and “Totals/Grand Total/Sub‑total” style summary rows).
2) It calls a preview endpoint to resolve each vendor name to a CRM Vendor account.
3) For each resolved vendor, the system selects a reconciliation template for the chosen Distributor + that Vendor.

You’ll see:

- A **Templates Used** list (vendor name in file → template selected)
- Errors if a vendor name can’t be resolved to an account
- Errors if a vendor has no template for that Distributor

#### Active Template dropdown (Multi‑Vendor only)

When multiple templates are in use, the mapping UI shows an **Active Template** dropdown.

- Selecting a template updates the mapping table to show that template’s **Template Fields** and template hints.
- Mapping changes are **isolated per template** (Template A edits do not overwrite Template B).
- Undo history is tracked **per template**.
- “Save mapping updates” applies **only to the selected template**.

### Step 3 — Review

The review step helps you spot‑check:

- Mapped vs unmapped columns
- Sample row previews
- Validation issues that would block import

In Multi‑Vendor uploads, ensure you used Step 2’s **Active Template** dropdown to complete mapping for every template before continuing (the UI enforces this on Continue).

### Step 4 — Import

On import, the server:

- Validates the mapping and headers
- Creates deposit records
  - Single Vendor: one deposit
  - Multi‑Vendor: one deposit per resolved vendor/template group
- Creates deposit line items from usable rows (skipping summary “Totals” rows)
- Optionally persists mapping changes back to template(s) depending on your “Save mapping updates” selections

---

## Field Mapping tabs (Template Fields vs New Fields vs Exclude)

The mapping table is organized into three tabs to help you focus on what matters.

### 1) Template Fields

Shows columns that are considered part of the **active template**.

In practice, this includes file columns that match:

- Column names referenced by the template’s saved mapping (targets/columns)
- Telarus “template fields” names (when available) using case/normalization matching
- Core fields that commonly matter in templates (including Vendor Name, Usage, Commission when mapped)

Use this tab to quickly map the columns the template expects.

### 2) New Fields

Shows columns **not in the template** that are still likely important because they:

- Have values in the file, and
- Either have a suggested match, or you’ve explicitly mapped them (to an import field or a custom field)

Use this tab to map additional columns you want imported beyond the template’s baseline.

### 3) Exclude

Shows columns that are unlikely to be useful to map right now:

- Columns set to **Do Not Map**
- Columns with **no values**
- Columns left as **Additional info (no specific field)** *without* any suggested match

Exclude is not an error state; it’s a triage view so you can ignore low‑value columns.

---

## Mapping options (what “Map to import field” means)

For each file column, you can choose one of:

- **Map to an import field**: imports that column into Commissable using a canonical target field.
  - Some targets persist to `DepositLineItem` columns, some to `Deposit` columns, and some to line‑item metadata.
- **Create a custom field**: stores the value in line item metadata (not a dedicated DB column).
- **Additional info (no specific field)**: leaves the column unmapped (useful for later reference), but it will not be imported as a field value.
- **Do Not Map**: explicitly ignores the column.

---

## Multi‑Vendor behavior details (what gets created)

### Row grouping

Multi‑Vendor imports:

- Group rows by the mapped **Vendor Name** value
- Skip blank/summary rows (e.g., Totals / Grand Total / “Vendor X Total”)
- Apply the correct **per‑template mapping** when importing each vendor’s rows

### Save mapping updates

In Multi‑Vendor mode:

- The “Save mapping updates” toggle is **per template**.
- Only templates you’ve enabled will be updated after import; other templates remain unchanged.

---

## Common issues and troubleshooting

- **“Map Vendor Name to resolve templates” (Multi‑Vendor)**  
  Map the file column that contains vendor names to **Vendor Name**.

- **Vendor account not resolved**  
  The vendor name in the file must match a CRM Vendor account name (or legal name), case-insensitively.

- **Vendor has no template for this Distributor**  
  Create a reconciliation template for that Distributor + Vendor, then retry the upload.

- **Missing required mappings**  
  Single Vendor: map **Actual Usage** or **Actual Commission**.  
  Multi‑Vendor: map Vendor Name + complete required mapping for each template (the Continue modal will tell you which).

- **Ambiguous/missing header errors**  
  If the file contains duplicate headers (e.g., “Usage” repeated) or you map to a column name that doesn’t exist, the import will fail with a clear error. Rename headers in the source file if needed.

---

## Related docs

- Implementation deep dive: `docs/guides/deposit-upload-template-mapping-deep-dive.md`
- Reconciliation workflow: `docs/guides/reconciliation.md`

---

## Engineering reference (internal)

### Key routes

- UI wizard: `/reconciliation/deposit-upload-list` (`app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`)
- Import API: `POST /api/reconciliation/deposits/import` (`app/api/reconciliation/deposits/import/route.ts`)
- Multi‑Vendor template preview: `POST /api/reconciliation/templates/multi-vendor-preview` (`app/api/reconciliation/templates/multi-vendor-preview/route.ts`)

### Mapping payloads (high level)

- Single Vendor: `DepositMappingConfigV2` (mapping config v2)
- Multi‑Vendor: `version: "multiVendorV1"` with `mappingsByTemplateId` + `saveUpdatesByTemplateId`

### How templates are selected in Multi‑Vendor

- Vendor accounts are matched from the file’s Vendor Name values using case‑insensitive comparison against Vendor `accountName` and `accountLegalName`.
- For each Vendor + Distributor, if multiple templates exist, the **most recently updated** template is selected deterministically.
- If a vendor cannot be resolved or has no template for the distributor, the mapping step blocks with a clear error until corrected.

