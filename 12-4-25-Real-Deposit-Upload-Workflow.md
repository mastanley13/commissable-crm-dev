## Real Deposit Upload Workflow – Implementation Plan

Goal: complete a real, end‑to‑end import + mapping pipeline for deposits (including Location ID / Customer PO) starting from `/reconciliation/deposit-upload-list`, and ensure schedules are ready for matching when those deposits land in the Reconciliation Detail view.

---

## 1. Current Build Snapshot (Deposit Upload List)

**UI / client:**

- Route: `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`.
- Stepper with 4 steps: **Create Template → Map Fields → Review → Confirm**.
- Step 1 (Create Template) is implemented:
  - Collects **Created By**, **Deposit Name**, **Customer**, **Date**.
  - Upload control for a CSV/XLS/XLSX file (stored in component state only).
  - **Template Selection** block: Distributor, Vendor, Template, **+ Create New Template** modal.
- Step 2 currently uses `MapFieldsPlaceholder`:
  - Shows placeholder cards for “CSV / Excel columns preview” and “Commissable fields and mapping controls”.
  - “Continue to Review” button is disabled; there is no real mapping UX yet.

**APIs / backend already in place:**

- Reconciliation templates:
  - `GET /api/reconciliation/templates` – list templates per distributor/vendor.
  - `GET /api/reconciliation/templates/[templateId]` – load template + `config` JSON.
  - `POST /api/reconciliation/templates` – create template with optional `config` (currently used mainly for metadata).
- Import infrastructure:
  - `ImportJob` / `ImportError` models exist in Prisma and are used for other imports.
- Reconciliation + matching:
  - Deposit + `DepositLineItem` schema exist; Reconciliation Detail page and matching engine (`lib/matching/deposit-matcher.ts`) already use `DepositLineItem.locationId` and `customerPurchaseOrder` when populated.

**Missing pieces specifically for deposits:**

- No persisted **deposit import job** or storage of the uploaded file from this page.
- No real **Map Fields** UI for deposits (all fields, including Location ID / Customer PO).
- No **Review** or **Confirm** step that actually creates `Deposit` / `DepositLineItem` records.
- No standard shape for **template‑level mapping config** that the ETL can consume.

---

## 2. Target End‑to‑End User Flow

1. **Create Template**
   - User chooses Created By, Deposit Name, Customer, Date, Distributor, Vendor.
   - User uploads a deposit file (CSV/XLS/XLSX).
   - User selects or creates a template; the file + basic metadata are held in memory for the session.
2. **Map Fields**
   - Page shows sample columns from the uploaded file (header + N rows).
   - Right‑hand side lists deposit fields to map to, including:
     - Core header fields: `paymentDate`, `depositName` (optional override), maybe file‑level metadata.
     - Line‑level fields: `usage`, `commission`, product identifiers, account identifiers, **`locationId`**, **`customerPurchaseOrder`**, etc.
   - User assigns each required Commissable field to a column; optional fields can be left unmapped.
   - User can save mapping back into the selected template so future uploads skip this step (or only require tweaks).
3. **Review**
   - Page shows:
     - Summary of mapping: which columns → which fields (including Location / PO).
     - A preview table of parsed rows after mapping + basic normalization (e.g., trimmed strings, parsed dates/amounts).
     - Any validation warnings (missing required fields, bad date/number formats, rows that would be skipped).
   - User confirms and advances to Confirm.
4. **Confirm**
   - User sees a final summary: total rows, rows with errors, mapped Distributor/Vendor/Customer, and confirmation text (“Start Import”).
   - On confirm, backend:
     - Creates an `ImportJob` for **Deposits**.
     - Stores the uploaded file and mapping config used for this run.
     - Parses the file and creates:
       - A `Deposit` record (or multiple, if we support multi‑deposit files later).
       - `DepositLineItem` rows, including `locationId` and `customerPurchaseOrder` when mapped.
     - Computes deposit aggregates and makes the deposit appear in `/reconciliation` and the Reconciliation Detail view.
   - User is redirected either:
     - Back to `/reconciliation` with a success toast, or
     - Directly to `/reconciliation/[depositId]` for the new deposit.

---

## 3. Data & Config Design (Deposits + Schedules)

### 3.1 Template config shape for deposits

Extend `ReconciliationTemplate.config` to capture deposit‑specific mapping in a structured way, for example:

- `config.depositMapping.header` – fields that are constant per file/run:
  - `depositName` (optional override if column‑driven).
  - `paymentDateColumn` (if date is per‑row instead of header).
  - `customerAccountColumn` (if customer is per‑row).
- `config.depositMapping.line` – per‑row mappings:
  - `usageAmountColumn`
  - `commissionAmountColumn`
  - `productNameColumn` / `productCodeColumn`
  - `accountNumberColumn` or other account identifier columns.
  - `locationIdColumn`
  - `customerPurchaseOrderColumn`
  - Any extra vendor‑specific identifiers we care about.
- `config.depositMapping.options` – flags:
  - Column contains header row yes/no (for odd files).
  - Date/number formats if they deviate from defaults.

This config should be saved on the template when the user completes the Map Fields step, so re‑uploads for the same distributor/vendor can reuse it.

### 3.2 Deposit ETL responsibilities

When running a deposit import using this config, the ETL must:

- Normalize strings (trim, upper‑case for identifiers, treat `"null"` / `"N/A"` as empty).
- Parse dates and numbers according to template configuration.
- **Set `DepositLineItem.locationId` and `customerPurchaseOrder` directly from mapped columns** when present.
- Fill other key identifiers used by the matcher (customer IDs, order IDs, product names/codes) as defined in the matching plan.
- Attach each `DepositLineItem` to the correct `Deposit`, and populate deposit header fields used in the Reconciliation list and detail APIs.

### 3.3 Schedule‑side readiness (outside this page)

Schedules are not uploaded from this page, but they must be ready for matching when new deposits arrive:

- `RevenueSchedule` already includes `opportunityId`, and `Opportunity` carries `locationId` and `customerPurchaseOrder`.
- Existing ETL / creation logic for schedules must ensure those fields are populated and not overwritten.
- The coverage/backfill script (`scripts/reconciliation-location-po-coverage.ts`) will be used to:
  - Measure current coverage of `DepositLineItem.locationId` / `customerPurchaseOrder`.
  - Backfill missing line‑level fields from `primaryRevenueSchedule.opportunity` where safe.

---

## 4. Implementation Phases on `/reconciliation/deposit-upload-list`

### Phase A – Finish the Wizard UX

1. **Refactor step components**
   - Extract `CreateTemplateStep` into `components/deposit-upload/create-template-step.tsx` for reuse and cleanliness.
   - Replace `MapFieldsPlaceholder` with a real `MapFieldsStep` component.
   - Add `ReviewStep` and `ConfirmStep` components, consistent with `docs/reconciliation-deposit-upload-plan.md`.
2. **State management in the page**
   - Store `activeStep`, uploaded `file`, parsed `csvHeaders` + sample rows, and `fieldMapping` in the page component.
   - Pass this state into each step component and move transitions (`onProceed`, `onBack`) into a simple step controller.
3. **Validation gating**
   - Disable “Proceed” until:
     - Step 1: required metadata + file + template are selected.
     - Step 2: required deposit fields are mapped.
     - Step 3: there are no blocking validation errors on the sample rows.

### Phase B – Build Map Fields UX for Deposits

1. **CSV/XLS parsing**
   - Reuse the parsing approach from `components/import-modal.tsx` for CSV.
   - For XLS/XLSX, either:
     - Start with filename‑only support and restrict to CSV for pilot, or
     - Add a small, vetted parser library and limit file size as in `ImportModal`.
2. **Field palette for deposit mapping**
   - Define a list of logical deposit fields to map (header + line‑level) with metadata:
     - `id`, `label`, `required`, `scope` (`header` vs `line`), and help text.
     - Include `locationId` and `customerPurchaseOrder` as optional but recommended fields.
   - Render a two‑column mapping UI:
     - Left: uploaded columns; each row has a select to choose a target field.
     - Right: list of required/unmapped fields with badge counts.
3. **Persist mapping to template config**
   - On leaving Map Fields for the first time, persist the mapping into `ReconciliationTemplate.config` via a new endpoint (e.g. `PATCH /api/reconciliation/templates/[templateId]`) or extend `POST` to support “upsert config” semantics.
   - When the page loads and a template is selected, pre‑populate mapping from `config.depositMapping` if present.

### Phase C – Wire Confirm Step to a Real Import Job

1. **Design a Deposit Import API**
   - Endpoint: `POST /api/reconciliation/deposits/import`.
   - Payload:
     - `templateId`
     - `distributorAccountId`, `vendorAccountId`
     - Deposit header overrides (name, customer, date).
     - Serialized mapping used for this run.
     - Uploaded file (or a previously staged storage URL).
2. **Leverage `ImportJob`**
   - On Confirm, create an `ImportJob` with:
     - `entity = 'Deposit'` (or equivalent enum entry).
     - `status = Pending`, `fileName`, `filters` including template + account IDs.
   - Store the raw file in the existing `storage` location and reference it from the job.
3. **Processing logic**
   - Implement a synchronous handler first (job completes in‑request for small files), then move to a background job if needed.
   - For each parsed row:
     - Derive or reuse a `Deposit` header (single‑deposit per file for MVP).
     - Create `DepositLineItem` populated from mapping, including `locationId` and `customerPurchaseOrder`.
   - Compute deposit totals and reconcile any inconsistencies before marking the job `Completed` or `Failed` with `ImportError` records.
4. **UX feedback**
   - After a successful import:
     - Show a success message in Confirm step with link to the new deposit in `/reconciliation` or `/reconciliation/[depositId]`.
   - On failure:
     - Surface error summary from `ImportJob` / `ImportError` in the UI.

### Phase D – Schedule Readiness & Matching Validation

1. **Schedule‑side verification**
   - Confirm schedule creation/ETL paths populate `Opportunity.locationId` and `customerPurchaseOrder` for pilot distributors/vendors.
   - Use `reconciliation-location-po-coverage.ts` to check coverage before and after backfill.
2. **End‑to‑end matching tests**
   - Upload a real (or realistic) deposit file via the new wizard.
   - Navigate to the resulting deposit’s Reconciliation Detail page:
     - Confirm `DepositLineItem.locationId` / `customerPurchaseOrder` appear in the UI and API.
     - Confirm `lib/matching/deposit-matcher.ts` uses these fields in Pass A and conflict detection as expected.
   - Validate a few hand‑picked rows end‑to‑end:
     - Exact matches on Location/PO.
     - Mismatches correctly excluded from candidates.

### Phase E – Diagnostics, Monitoring, and Rollout

1. **Diagnostics**
   - Extend the coverage script or add a small report to show:
     - Percentage of deposit lines with non‑blank Location/PO per tenant and per distributor/vendor combo.
     - Percentage of matched lines that relied on Location/PO as a strong ID.
2. **Rollout strategy**
   - Start with 1–2 pilot templates (e.g., single distributor/vendor) and CSV‑only uploads.
   - Monitor coverage, import errors, and reconciliation outcomes; tune mapping defaults and normalization.
   - Once stable:
     - Broaden to more templates/vendors.
     - Update `reconciliation_matching_status_summary.md` to mark “Location ID / Customer PO on ETL” as **Done** and note that deposit imports via `/reconciliation/deposit-upload-list` are the primary path for real data.

---

## 5. Acceptance Criteria (for “Deposit Upload List is wired”)

- A user can:
  - Upload a real deposit file via `/reconciliation/deposit-upload-list`.
  - Map its columns to deposit fields (including Location ID / Customer PO) and save mappings per template.
  - Review a parsed preview with validation messages.
  - Confirm the import and see a new deposit appear in the Reconciliation list.
- For that deposit:
  - `DepositLineItem` rows contain correctly normalized `locationId` and `customerPurchaseOrder` where the file provides them.
  - The Reconciliation Detail page shows those fields and the matching engine uses them as strong IDs / conflict checks.
- Diagnostics confirm acceptable coverage of Location/PO for new imports and no regression in matching behavior.

