# Opportunity Revenue Schedules — Current State & Production Plan

_Last updated: 2025-12-02_

This doc captures where the core Revenue Schedule management requirements stand today in the codebase, and a concrete plan to graduate the existing prototypes (Manage Schedules modal + fill‑down test) into production behavior on the **Opportunity → Revenue Schedules** tab.

---

## 1. Current State vs. Requirements

### 1.1 Revenue Schedule Management within an Opportunity

**Requirement:** Users can manage revenue schedules from within a single Opportunity, including multi‑select actions and rate changes.

**Implementation today**

- The Opportunity detail view (`components/opportunity-details-view.tsx`) exposes a **“Revenue Schedules”** tab (`TabKey = "revenue-schedules"`).
- That tab renders a DynamicTable backed by `OpportunityRevenueScheduleRecord` (`components/opportunity-types.ts`) with:
  - Multi‑select via a `multi-action` column.
  - Columns for:
    - Quantity
    - Price Each (`unitPrice`)
    - Expected Usage Gross / Adjustment / Net
    - Actual Usage / Usage Balance
    - Expected / Actual Commission Gross / Net / Difference
    - Expected / Actual Commission Rate % and Rate Difference (`expectedCommissionRatePercent`, etc.).
- Table features:
  - Search, column filters, pagination, table preferences (through `useTablePreferences`).
  - Status filtering through a local `revenueStatusFilter` plus `StatusFilterDropdown`.
  - Bulk actions limited to:
    - **Clone**: opens `RevenueScheduleCloneModal` and calls `/api/revenue-schedules/{id}/clone`.
    - **Export CSV**: client‑side CSV export of selected rows.

**Gap vs. requirement**

- Per‑Opportunity list is implemented with rich read‑only metrics, clone, and CSV export.
- No production support yet for **bulk editing** of schedule fields or **rate changes from this tab**; those are still isolated to the Manage Schedules modal and prototype pages (see below).

---

### 1.2 Bulk Schedule Editing (Admin) — Commission Rate %

**Requirement:**  
From within an Opportunity, allow an admin to:

- Select an existing product’s revenue schedules (via checkboxes).
- Enter a **new effective date** and **new commission rate %**.
- On save, have the system update the **expected commission rate %** for all selected schedules **from the effective date forward**.

**Implementation today**

- `RevenueScheduleCreateModal` (`components/revenue-schedule-create-modal.tsx`) serves as a “Manage Revenue Schedules” modal for an Opportunity, with multiple tabs:
  - `create` — create a schedule series.
  - `rates` — **Change Commission Rate** (relevant to this requirement).
  - `split` — **Change Commission Split**.
  - `status` — deactivate/delete.
  - `undo` — undo deposit matches.
- In the **“Change Commission Rate”** tab:
  - `scheduleOptions` is derived from `schedules` (the Opportunity’s revenueSchedules) to present a checklist of schedules.
  - `rateForm` tracks:
    - `selectedIds: string[]` — schedule IDs.
    - `effectiveDate: string` — required date.
    - `ratePercent: string` — required percent.
    - `scope: "selection" | "series"` — whether to apply to only checked schedules or the entire series from the effective date forward.
  - Validation (`canSubmitRates`) requires selected IDs, effective date, and a numeric `ratePercent`.
  - `handleRateSubmit` assembles:
    - `payload = { scheduleIds, effectiveDate, ratePercent, scope }`
    - Issues `POST /api/revenue-schedules/bulk/update-rate`.
    - On success, shows “Commission rates updated” and calls `onSuccess`/`onClose`.

**Backend wiring today**

- **No `app/api/revenue-schedules/bulk/update-rate` route exists.**
- No shared helper exists yet for “apply forward from effective date” semantics.
- As a result, the modal’s commission‑rate bulk update workflow is **UI‑complete but non‑functional** (the network call will 404).

**Status**

- **UI/prototype:** implemented (modal, forms, UX, validation).
- **Backend:** not implemented; “effective date forward” semantics are missing.
- **Net:** **Not fully achieved — implementation is in progress/prototype‑only.**

---

### 1.3 Bulk Editable Fields on Opportunity Revenue Schedules

**Requirement:**  
From a given date forward, allow bulk editing (single or multiple schedules) of:

- Quantity
- Price Per
- Expected Usage Adjustment
- Expected Commission Rate %
- Expected Commission Adjustment

**Implementation today**

1. **Opportunity → Revenue Schedules tab**
   - Displays all of these fields (either as currency, percent, or numeric columns) but **all cells are read‑only**.
   - Bulk actions from that tab:
     - Clone.
     - Export CSV.
   - No inline cell editor, no “fill‑down / apply to selected” behavior, and no call to any schedule bulk‑update API.

2. **Fill‑down prototype page**
   - `app/(dashboard)/revenue-schedules/fill-down-test/page.tsx` implements an **in‑cell fill‑down** prototype:
     - Editable columns (by design): `quantity`, `priceEach`, `expectedCommissionRatePercent`.
     - Users select multiple rows, edit a value in one row, and a floating pill appears:
       - “Apply to N selected”.
     - On confirmation, the component:
       - Updates the local rows.
       - Logs a simulated payload:
         - `{ ids: string[], patch: { quantity?: number, priceEach?: number, expectedCommissionRatePercent?: number } }`
       - Shows instructions referencing the planned endpoint:
         - `/api/revenue-schedules/bulk-update`.

3. **Backend planning (docs)**
   - `docs/Change-Order-Plans/bulk-actions-overhaul-plan.md` defines:
     - `POST /api/revenue-schedules/bulk-update` with a patch model for:
       - `quantity`, `unitPrice`/`priceEach`, `expectedCommissionPercent` (i.e., expected rate %).
     - Audit logging expectations and RBAC.

4. **Backend reality**

   - No `app/api/revenue-schedules/bulk-update/route.ts`.
   - No bulk endpoint exists to:
     - Update `quantity` or `unitPrice` on the linked `OpportunityProduct`.
     - Update any schedule‑level override for `expectedCommissionRatePercent` or `expectedCommissionAdjustment`.
   - No code yet to interpret “from date forward” when updating schedules in a series.

**Status**

- **Prototype:** good UI proof‑of‑concept for fill‑down semantics.
- **Production wiring:** absent (no bulk API, no reuse inside the Opportunity Revenue Schedules tab).
- **Net:** **Not achieved — current implementation is experimental only.**

---

### 1.4 Commission Split Visibility & History

**Requirement:**

- Commission split percentages are visible on Opportunity detail.
- Splits can change over time.
- Need:
  - Compact percentage display (e.g., `XX.XX%`).
  - “Last Edit Date/By” label (user + timestamp).
  - Change logged in a History tab.

**Implementation today**

1. **Display in Opportunity header**
   - `OpportunityHeader` (`components/opportunity-details-view.tsx`) shows:
     - Subagent % (`opportunity.subagentPercent`).
     - House Rep % (`opportunity.houseRepPercent`).
     - House Split % (computed from rep/subagent/fallback, via `calculateHouseSplitPercent`).
   - Percent display uses `formatPercent`:
     - Renders fraction values as `XX.XX%`, matching the “shrinked display” requirement.

2. **Inline editing with Last Edit label**
   - `EditableOpportunityHeader` is the inline‑edit variant (rendered when the user has edit permissions).
   - It calls `useFieldHistory('Opportunity', opportunity.id, ['subagentPercent','houseRepPercent','houseSplitPercent'])` to retrieve audit data for those fields.
   - Each of the three split fields is rendered via a custom `FieldRow` that:
     - Shows the current value (editable using `EditableField.Input`).
     - Shows `Last edited {date} by {user}` from `fieldHistory`.
   - House Split % is auto‑computed and rendered read‑only with a tooltip clarifying that it’s derived.

3. **Audit Logging**
   - `app/api/opportunities/[opportunityId]/route.ts`’s `PATCH` handler:
     - Accepts updates for `subagentPercent`, `houseRepPercent`, and `houseSplitPercent` (with validation).
     - Persists the changes via Prisma / raw SQL.
     - Calls `logOpportunityAudit` (`lib/audit.ts`) with:
       - `previousValues` + `newValues` including the split fields.
     - `logOpportunityAudit`:
       - Computes `changedFields` via `getChangedFields`, and writes a row to `AuditLog` with `entityName = 'Opportunity'`.

4. **History Tab**
   - The `AuditHistoryTab` component (`components/audit-history-tab.tsx`) is wired on the Opportunity detail:
     - It fetches `/api/audit-logs?entityName=Opportunity&entityId={id}`.
     - Converts `changedFields` into `HistoryRow`s and displays them in a table.
   - The `History` tab is present in `DETAIL_TABS`, and for Opportunities uses this component.

5. **Gaps**
   - Revenue schedule detail (`RevenueScheduleDetailsView`) can inline‑edit split‑related fields on the schedule and upstream:
     - `expectedCommissionRatePercent`, `houseSplitPercent`, `houseRepSplitPercent`, `subagentSplitPercent`, etc. (via PATCH to `/api/revenue-schedules/{id}`).
   - But `app/api/revenue-schedules/[revenueScheduleId]/route.ts`:
     - Does not yet log audit entries (neither for `RevenueSchedule` nor for `Opportunity` when it updates split fractions).
   - For users in read‑only Opportunity header mode, the `OpportunityHeader` still uses static `MOCK_HISTORY_ROWS` for some history display; the live Last‑Edit labels currently exist only in the editable header via `useFieldHistory`.

**Status**

- **Percentage visibility:** Achieved (compact percent display on Opportunity header).
- **Last Edit Date/By for splits:** Achieved for inline‑editable header, driven by `useFieldHistory` + audit logs.
- **History tab logging:** Achieved for changes that go through the Opportunity PATCH endpoint; missing for split changes initiated via the Revenue Schedule PATCH route.
- **Net:** **Substantially achieved with small gaps in how schedule‑driven split edits are audited and surfaced.**

---

## 2. Plan to Take Prototypes to Production

This section outlines concrete steps to:

1. Ship bulk commission‑rate updates (effective‑date‑forward) for selected schedules from the Opportunity Manage Schedules modal.
2. Provide bulk editing (Quantity, Price, Usage Adjustment, Expected Rate %, Expected Commission Adjustment) via a safe UI pattern and a reusable bulk API.
3. Ensure all commission split changes and rate changes are audited and reflected in History.

### 2.1 Backend APIs and Data Semantics

#### 2.1.1 Implement `POST /api/revenue-schedules/bulk/update-rate`

**Goal:** Make the “Change Commission Rate” tab in `RevenueScheduleCreateModal` functional with correct “from effective date forward” semantics.

**Design:**

- **Route:** `app/api/revenue-schedules/bulk/update-rate/route.ts`
- **Method:** `POST`
- **Payload:**
  ```json
  {
    "scheduleIds": ["rs-id-1", "rs-id-2"],
    "effectiveDate": "2025-01-01",
    "ratePercent": 12.5,
    "scope": "selection" | "series"
  }
  ```
- **Behavior:**
  - Validate permissions: require `revenue-schedules.manage` (and/or `opportunities.manage`).
  - Normalize `ratePercent` to a fraction or to a canonical “percent” representation consistent with current `commissionPercent` conventions.
  - If `scope === "selection"`:
    - Apply new rate to only the specified `scheduleIds`, as of `effectiveDate`.
      - For “from effective date forward”:
        - If schedules are independent rows, treat it as “for each selected schedule, if scheduleDate >= effectiveDate, update its rate”.
        - If schedules are linked by series name or line item, see “series” below.
  - If `scope === "series"`:
    - For each selected schedule:
      - Identify its “series” (e.g., via scheduleNumber prefix, group key from `opportunityProductId`, or explicit series identifier if present).
      - Apply rate to all schedules in that series where `scheduleDate >= effectiveDate`.
  - Persist the override:
    - **Schedule‑level override (preferred):**
      - Add a `commissionPercentOverride` (or similar) column on `RevenueSchedule` if not yet present, and write the override there.
    - Alternatively, update product‑level `commissionPercent` only if we explicitly intend to change the catalog (not recommended for this feature).

**Audit:**

- Audit at the **RevenueSchedule** level:
  - For each updated schedule, log an `AuditLog` entry with:
    - `entityName = 'RevenueSchedule'`.
    - `changedFields` containing `expectedCommissionRatePercent` / `commissionPercentOverride`.
- Optionally, add an aggregate “Bulk Update” metadata entry with the full patch set.

**Response:**

- Return summary:
  ```json
  {
    "updated": 10,
    "failed": ["rs-id-bad-1"],
    "errors": { "rs-id-bad-1": "Not found" }
  }
  ```

#### 2.1.2 Implement `POST /api/revenue-schedules/bulk-update`

**Goal:** Provide a generic bulk update endpoint for schedule fields (Quantity, Price, Usage Adjustment, Expected Rate %, Expected Commission Adjustment) used by:

- The Revenue Schedule list page.
- The Opportunity → Revenue Schedules tab.
- The fill‑down/“Apply to selected” UX.

**Design:**

- **Route:** `app/api/revenue-schedules/bulk-update/route.ts`
- **Method:** `POST`
- **Payload:**
  ```json
  {
    "ids": ["rs-id-1", "rs-id-2"],
    "patch": {
      "quantity": 100,
      "priceEach": 12.5,
      "expectedUsageAdjustment": -50,
      "expectedCommissionRatePercent": 10.0,
      "expectedCommissionAdjustment": 25.0
    }
  }
  ```
- **Behavior:**
  - Validate permissions similar to the rate endpoint.
  - For each schedule ID:
    - Load the schedule + its `opportunityProduct` + any schedule‑level override fields.
    - Apply field mappings:
      - `quantity` / `priceEach`:
        - Update `RevenueSchedule.opportunityProduct.quantity` and `unitPrice` where appropriate.
        - Optionally recompute derived `expectedUsageGross`/`expectedCommissionGross` if stored denormalized.
      - `expectedUsageAdjustment`:
        - Map to schedule‑level adjustment field (e.g., `usageAdjustment` or similar).
      - `expectedCommissionRatePercent`:
        - Map to schedule‑level override (not global product).
      - `expectedCommissionAdjustment`:
        - Map to `expectedCommissionAdjustment` on the schedule.
    - Recalculate `expectedUsageNet`, `expectedCommissionNet`, and rate differences if those are persisted.
  - Persist via a single transaction per batch or per schedule (trade‑off vs. complexity).

**Audit:**

- For each schedule, use a helper like `logRevenueScheduleAudit` (to be added in `lib/audit.ts`) that records:
  - `entityName = 'RevenueSchedule'`.
  - `changedFields` per field updated.

**Response:**

- Same shape as the rate endpoint: `updated`, `failed`, per‑id errors.

---

### 2.2 UI Wiring — Opportunity Revenue Schedules Tab

#### 2.2.1 Hook bulk APIs into the Manage Schedules modal

**Change Commission Rate (existing UI)**

- Keep `RevenueScheduleCreateModal`’s “Change Commission Rate” tab as the primary UX for rate changes.
- Once `/api/revenue-schedules/bulk/update-rate` is implemented:
  - Confirm payload shape matches the modal’s `handleRateSubmit` expectations:
    - `scheduleIds`, `effectiveDate`, `ratePercent`, `scope`.
  - On success, update rate fields in the Opportunity view:
    - Rely on the existing `onSuccess` callback to trigger `onRefresh` on the parent `OpportunityDetailsView`, which refetches the Opportunity (and its revenue schedules) through `/api/opportunities/{id}`.

**Future enhancement (optional): “Change Rates” entry in bulk actions**

- Add an action to `revenueBulkActions` on the Opportunity Revenue Schedules tab:
  - When selected IDs > 0, clicking “Change Rate”:
    - Opens `RevenueScheduleCreateModal` on the `"rates"` tab.
    - Pre‑populates `rateForm.selectedIds` with the currently selected schedules.

#### 2.2.2 Integrate fill‑down behavior into production tables

**Step 1 — Extract reusable editable column pattern**

- From `app/(dashboard)/revenue-schedules/fill-down-test/page.tsx`:
  - Lift `EditableInput` and the generic `editableColumn` pattern into:
    - Either a shared helper in `components/dynamic-table` (e.g., `editableColumns` prop) or a small, local helper for Revenue Schedules tables.

**Step 2 — Apply to Opportunity Revenue Schedules tab**

- Extend `OpportunityDetailsView`’s `revenueTableColumns` mapping to:
  - For editable columns (initially `quantity`, `unitPrice`, `expectedUsageAdjustment`, `expectedCommissionRatePercent`, `expectedCommissionAdjustment`):
    - Render an `EditableInput` that:
      - Captures the committed value.
      - When multiple rows are selected and the edited row is in the selection, surfaces a floating “Apply to N selected” pill with:
        - Column label.
        - New value.
        - Count of selected rows.
      - On confirm:
        - Calls the new `POST /api/revenue-schedules/bulk-update` endpoint with:
          - `ids = selectedRevenueSchedules`.
          - `patch` keyed by the edited column.
        - On success, refreshes the Opportunity detail via `onRefresh`.

**Step 3 — Align with global bulk actions pattern**

- Extend `revenueBulkActions` (currently Clone + Export) to optionally include:
  - A “Bulk Edit” action that:
    - Opens a side panel or modal listing the five bulk‑editable fields.
    - Reuses the same endpoint (`bulk-update`) for apply.
  - This aligns with the `bulk-actions-overhaul-plan.md` Idea 2A (Bulk Edit Panel) if we choose to implement it now; otherwise, the in‑cell “Apply to selected” variant (Idea 2B) suffices for MVP.

---

### 2.3 Audit & History Integration

To fully meet the split/commission history requirements:

1. **Add Revenue Schedule audit helpers**
   - In `lib/audit.ts`, add a `logRevenueScheduleAudit` similar to `logOpportunityAudit`:
     - Takes `action: AuditAction`, `scheduleId`, `userId`, `tenantId`, `request`, `previousValues`, `newValues`.
     - Uses `entityName = 'RevenueSchedule'`.
   - Use it in:
     - The new `bulk/update-rate` endpoint.
     - The new `bulk-update` endpoint.
     - The existing `PATCH /api/revenue-schedules/{id}` endpoint.

2. **Surface Revenue Schedule history**
   - On Revenue Schedule detail (`app/(dashboard)/revenue-schedules/[revenueScheduleId]/page.tsx`), ensure there is a `History` tab that uses `AuditHistoryTab` with:
     - `entityName="RevenueSchedule"`.
     - `entityId=schedule.id`.

3. **Tie schedule‑initiated split changes back to Opportunity history**
   - When `/api/revenue-schedules/{id}` updates `opportunity.houseSplitPercent`, `houseRepPercent`, or `subagentPercent`:
     - In addition to schedule audit, also call `logOpportunityAudit` if the Opportunity is known.
   - This ensures:
     - The Opportunity’s History tab includes all split changes regardless of whether they originated from the Opportunity inline edit or from the schedule screen.

4. **Replace MOCK history rows on read‑only header**
   - Update `OpportunityDetailsView` so the non‑editable `OpportunityHeader` also pulls Last Edit data from `useFieldHistory`, not `MOCK_HISTORY_ROWS`, for:
     - Subagent %.
     - House Rep %.
     - House Split %.

---

## 3. Concrete Checklist (Implementation‑Ready)

### 3.1 Bulk Rate Update (Manage Schedules Modal)

- [ ] Create `app/api/revenue-schedules/bulk/update-rate/route.ts` with:
  - [ ] Permission checks for `revenue-schedules.manage`.
  - [ ] Payload validation for `scheduleIds`, `effectiveDate`, `ratePercent`, `scope`.
  - [ ] “Selection” vs. “series” semantics (including `scheduleDate >= effectiveDate`).
  - [ ] Schedule‑level rate override storage (e.g., `commissionPercentOverride`).
  - [ ] Per‑schedule audit logging via `logRevenueScheduleAudit`.
  - [ ] Summary response with `updated`, `failed`, `errors`.
- [ ] Wire error handling messages in `RevenueScheduleCreateModal` to reflect API error payloads.
- [ ] Verify `onSuccess` refreshes the Opportunity and updates the Revenue Schedules tab.

### 3.2 Generic Bulk Update for Schedules

- [ ] Implement `app/api/revenue-schedules/bulk-update/route.ts`:
  - [ ] Accept `ids` and `patch` fields as per the design.
  - [ ] For each schedule:
    - [ ] Update linked `OpportunityProduct` for `quantity` and `priceEach`.
    - [ ] Update schedule fields for `expectedUsageAdjustment`, `expectedCommissionRatePercent`, `expectedCommissionAdjustment`.
    - [ ] Recompute and persist derived values (net, differences) if denormalized.
  - [ ] Wrap in safe transactions with partial‑failure handling.
  - [ ] Log audit entries for each schedule.
- [ ] Extend `lib/audit.ts` with `logRevenueScheduleAudit`.

### 3.3 UI — Fill‑Down / Apply to Selected on Opportunity Tab

- [ ] Extract the `EditableInput`/fill‑down pattern into a reusable helper (component or DynamicTable extension).
- [ ] In `OpportunityDetailsView`:
  - [ ] Mark `quantity`, `unitPrice`, `expectedUsageAdjustment`, `expectedCommissionRatePercent`, `expectedCommissionAdjustment` as editable columns.
  - [ ] Render `EditableInput` for those columns.
  - [ ] When multiple rows selected and a value changes:
    - [ ] Show “Apply to N selected” pill anchored near the edited cell.
    - [ ] On confirm, call `POST /api/revenue-schedules/bulk-update` with appropriate `patch`.
    - [ ] Show success/error toasts and refresh the Opportunity on success.

### 3.4 UI — Optional Bulk Edit Panel

- [ ] (Optional) Add a “Bulk Edit” action to `revenueBulkActions` on the Opportunity Revenue Schedules tab.
- [ ] Implement a compact panel or modal listing the five allowed fields with inputs.
- [ ] On Apply, call the same `bulk-update` endpoint and refresh.

### 3.5 History and Split Consistency

- [ ] Add `logRevenueScheduleAudit` and use it in:
  - [ ] `bulk/update-rate` endpoint.
  - [ ] `bulk-update` endpoint.
  - [ ] `PATCH /api/revenue-schedules/[revenueScheduleId]`.
- [ ] Ensure a History tab exists and uses `AuditHistoryTab` for Revenue Schedules detail (`entityName="RevenueSchedule"`).
- [ ] In `PATCH /api/revenue-schedules/[revenueScheduleId]`, when updating Opportunity split fields:
  - [ ] Call `logOpportunityAudit` with before/after values.
- [ ] Update `OpportunityHeader` (read‑only variant) to use `useFieldHistory` for Subagent %, House Rep %, and House Split %, so Last‑Edit labels are consistent between read‑only and editable headers.

---

This plan moves the feature set from “UI/prototype only” to a production‑ready flow where:

- Bulk rate changes and schedule adjustments work end‑to‑end.
- The Opportunity Revenue Schedules tab lets users safely apply edits across multiple schedules.
- Commission splits and rates are fully auditable and visible in both Opportunity and Revenue Schedule history views.

