# Deposit Upload (CSV/Excel) — Workflow & Feature Guide

## Executive summary

The **Deposit Upload** flow ingests a carrier/distributor commission report (CSV/XLS/XLSX), guides the user through **mapping file columns to Commissable’s canonical deposit fields**, and then imports the file into the database as a **Deposit** plus **Deposit Line Items**. The output of this flow is the starting point for the **Reconciliation** workflow, where each deposit line is matched/allocated to **Revenue Schedules**.

**Primary value:**
- Standardizes many vendor file formats into one normalized schema (`Deposit`, `DepositLineItem`).
- Reduces repetitive column mapping via **templates** (per Distributor + Vendor + Template Name).
- Prevents duplicate imports via an **idempotency key**.

---

## Where it lives (routes + implementation)

- UI: `/reconciliation/deposit-upload-list` (`app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`)
- API (import): `POST /api/reconciliation/deposits/import` (`app/api/reconciliation/deposits/import/route.ts`)
- API (templates): `GET|POST /api/reconciliation/templates` (`app/api/reconciliation/templates/route.ts`)
- API (template detail/edit): `GET|PATCH /api/reconciliation/templates/[templateId]` (`app/api/reconciliation/templates/[templateId]/route.ts`)
- Canonical field definitions: `lib/deposit-import/fields.ts`
- File parsing: `lib/deposit-import/parse-file.ts`

---

## Permissions and roles

- **View templates**: `reconciliation.view`
- **Create/edit templates and import deposits**: `reconciliation.manage`

---

## Workflow (what the user does)

### 1) Start a new upload

Common entry point: from the **Reconciliation → Deposits List** page (`/reconciliation`), click **Deposit Upload**.

### 2) Create deposit context (who/when/what)

In the “Create Deposit” step, the user provides:

- **Distributor** (required): the distributor account the deposit is associated with.
- **Vendor** (required): the vendor/carrier account the deposit is associated with.
- **Deposit Received Date** (required, `YYYY-MM-DD`): becomes `Deposit.paymentDate`.
- **Commission Period** (required, `YYYY-MM`): becomes `Deposit.month` (stored as the first day of the month, UTC).
  - The UI defaults this from the deposit received month if left blank.
- **Deposit Name** (optional): auto-generated as `Vendor - Distributor - DepositDate` but editable.
- **Created By** (optional): a contact ID captured as `Deposit.createdByContactId` (the importing user is always stored as `Deposit.createdByUserId`).
- **File upload** (required): `.csv`, `.xls`, or `.xlsx`.

Template selection is available but **not required**:
- If selected, the template can pre-fill mapping in the next step.
- If no template is selected, mapping starts from auto-mapping heuristics only.

### 3) Map fields (column-to-field mapping)

After a file is selected, the system parses it and displays:
- Detected **headers** and a window of **sample rows**
- A mapping UI that lets the user decide how each source column should be treated

Key mapping behaviors:
- **Required mappings**: at minimum, the user must map:
  - `Usage Amount` (`usage`)
  - `Commission Amount` (`commission`)
- **Auto-mapping**: the UI attempts to auto-map columns using header-name heuristics and synonym matching.
- **Template pre-fill**: if a template is selected and has a saved config, it is used as a starting point, then auto-mapping fills gaps.
- **Undo**: mapping changes are tracked; the user can undo recent edits.
- **Save mapping updates** (toggle): if enabled, the chosen mapping is persisted back to a template for future uploads:
  - If a template was selected, the mapping is saved to that template.
  - If no template was selected, the server can create/update a default template named **“Default deposit mapping”** for the Distributor+Vendor pair.

Important current limitation:
- The import API ingests **only the canonical fields** defined in `lib/deposit-import/fields.ts`. “Extra/custom” columns may be represented in the mapping UI and saved to the template config, but they are not persisted into dedicated `DepositLineItem` columns unless they map to a canonical field.

### 4) Review

The review step is a guardrail:
- Confirms required fields are mapped.
- Allows the user to spot-check sample rows.

### 5) Confirm import

On confirm, the UI submits the file + metadata + mapping to the server:
- The server creates:
  - `Deposit`
  - `DepositLineItem` records
  - an `ImportJob` record (for auditing/idempotency/history)
- The UI returns a `depositId` and links the user to the **Deposit Detail** reconciliation page (`/reconciliation/{depositId}`).

---

## What gets created (server behavior)

### Deposit row creation

The import route creates a `Deposit` with:
- `paymentDate` from the “Deposit Received Date”
- `month` from “Commission Period” (or defaults to the deposit month)
- Distributor/Vendor IDs and the optional selected template ID
- `createdByUserId` (current user) and optional `createdByContactId`

### Deposit line ingestion rules

For each data row in the spreadsheet:
- If **both** `usage` and `commission` are empty, the row is skipped.
- Per-line `paymentDate`:
  - Uses the mapped `Payment Date` column if present; otherwise falls back to the deposit date.
  - Excel date serial numbers are supported.
- **Commission-only rows**:
  - If a row has commission but no usage, the importer treats it as “commission-only”:
    - `usage = commission`
    - `commissionRate = 1` (100%)

### Validation and failure modes

Imports fail with a user-facing error when:
- Required mappings are missing (`usage`, `commission`).
- A mapped column header is not found or is ambiguous (duplicate headers can cause ambiguity).
- The uploaded file has no header row or no data rows.
- File type is not CSV/Excel.

### Idempotency (duplicate import prevention)

Each file selection generates an `idempotencyKey` that is sent with the import:
- If the same idempotency key already completed, the server returns the existing `depositId`.
- If an import with the same key exists but is not “Completed”, the server returns a conflict.

---

## Templates (how they work at a high level)

Templates (`ReconciliationTemplate`) are scoped to:
- Tenant
- Distributor account
- Vendor account
- Template **name** (multiple templates per Distributor/Vendor are supported)

Templates can be:
- **Selected** during upload to pre-fill mapping.
- **Created** during upload (name + optional description).
- **Auto-seeded** when listing templates for a Distributor/Vendor with none configured:
  - The backend can seed a template from a Telarus “vendor map fields” master, when a match exists for the Distributor/Vendor names.

---

## Practical tips

- Keep your source file headers stable; mapping works best when header names don’t change month-to-month.
- Always map `Payment Date` if the file contains it; otherwise all lines inherit the deposit received date.
- If your file changes format, enable “Save mapping updates” so the template stays current (and avoid having to remap next time).

---

## Related guides

- Reconciliation workflow: `docs/guides/reconciliation.md`
