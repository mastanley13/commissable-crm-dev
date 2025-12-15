# Revenue Schedules Bulk Edit – Ticket Implementation Plan

_Goal:_ Deliver bulk commission rate + schedule field editing, wired to audit/history, in small vertical slices.

Priority order follows the earlier recommendation.

---

## Ticket 1 – Add `logRevenueScheduleAudit` Helper!

**Goal:** Centralize audit logging for Revenue Schedule changes.

**Files to touch**
- `lib/audit.ts`

**Implementation steps**
- [ ] Add a new exported function:
  - `logRevenueScheduleAudit(action: AuditAction, scheduleId: string, userId: string, tenantId: string, request: Request, previousValues?: Record<string, any>, newValues?: Record<string, any>)`.
- [ ] Inside the helper:
  - [ ] Compute `changedFields` via existing `getChangedFields(previousValues, newValues)` (when both provided).
  - [ ] Call `logAudit` with:
    - `entityName: 'RevenueSchedule'`
    - `entityId: scheduleId`
    - `userId`, `tenantId`, `action`
    - `changedFields`, `previousValues`, `newValues`
    - `ipAddress`, `userAgent` from `getClientIP(request)`, `getUserAgent(request)`.

**Validation**
- [ ] Manually call helper from a small temporary script or console log and verify:
  - [ ] A row appears in `AuditLog` with `entityName = 'RevenueSchedule'` and expected `changedFields`.

---

## Ticket 2 – Implement `POST /api/revenue-schedules/bulk/update-rate`

**Goal:** Make the “Change Commission Rate” tab functional (backend).

**Files to touch**
- `app/api/revenue-schedules/bulk/update-rate/route.ts` (new)
- Optionally shared utilities in `app/api/revenue-schedules/helpers.ts`

**Implementation steps**
- [ ] Create route scaffold:
  - [ ] Export `runtime = "nodejs"` and `dynamic = "force-dynamic"`.
  - [ ] Export `POST` handler wrapped in `withPermissions`:
    - Required permissions: `["revenue-schedules.manage", "opportunities.manage"]` (or final agreed set).
- [ ] Parse and validate body:
  - [ ] Ensure `scheduleIds` is a non-empty string array.
  - [ ] Validate `effectiveDate` as a parseable date.
  - [ ] Validate `ratePercent` as a finite number.
  - [ ] Validate `scope` ∈ `["selection","series"]` (default to `"selection"` if omitted).
- [ ] Load all referenced schedules for tenant:
  - [ ] Use Prisma `revenueSchedule.findMany({ where: { id: { in: scheduleIds }, tenantId: req.user.tenantId } })`.
- [ ] Implement update logic for v1:
  - [ ] For `"selection"` scope (MVP):
    - [ ] Filter schedules where `scheduleDate >= effectiveDate`.
    - [ ] Update each schedule’s rate:
      - Either:
        - [ ] Write to a schedule-level numeric field (e.g., `rateOverridePercent` or `expectedCommissionRatePercent`) if it exists, or
        - [ ] Decide and add such a field as a separate schema change task.
  - [ ] For `"series"` scope (optional if time):
    - [ ] Group schedules by series key (e.g., `opportunityProductId` + `scheduleNumber` prefix).
    - [ ] Within each series, update all schedules with `scheduleDate >= effectiveDate`.
- [ ] Apply updates:
  - [ ] Use a Prisma transaction:
    - [ ] Collect per-schedule `previousValues` / `newValues` snapshots for the rate-related field.
    - [ ] Persist changes.
- [ ] Audit:
  - [ ] For each updated schedule, call `logRevenueScheduleAudit` with before/after values.
- [ ] Return summary:
  - [ ] `{ updated: N, failed: string[], errors: Record<string,string> }`.

**Validation**
- [ ] Use `curl` or Postman to POST to `/api/revenue-schedules/bulk/update-rate` with:
  - [ ] Valid payload; confirm `200 OK` and that schedules’ rate field changes as expected.
  - [ ] Invalid payloads (missing IDs, bad date, bad percent); confirm `4xx` with helpful error messages.
- [ ] Check `AuditLog` to ensure a row exists per updated schedule.

---

## Ticket 3 – Wire `RevenueScheduleCreateModal` Rate Tab to New Endpoint

**Goal:** Connect the existing UI modal to `/bulk/update-rate`.

**Files to touch**
- `components/revenue-schedule-create-modal.tsx`

**Implementation steps**
- [ ] Ensure the payload built in `handleRateSubmit` matches the API contract:
  - [ ] `{ scheduleIds, effectiveDate, ratePercent, scope }`.
- [ ] Adapt error handling:
  - [ ] If response is non-OK:
    - [ ] Parse `body.error` and show via `showError("Rate update failed", message)`.
    - [ ] Set `error` state so the form surface shows context.
- [ ] On success:
  - [ ] Show success toast “Commission rates updated”.
  - [ ] Await `onSuccess?.()` (to allow parent to refresh Opportunity).
  - [ ] Close modal.

**Validation**
- [ ] Manually:
  - [ ] Open Manage Schedules → Change Commission Rate.
  - [ ] Select several schedules, set date + rate, submit.
  - [ ] Confirm:
    - [ ] No console errors.
    - [ ] Rates update on Opportunity Revenue Schedules tab after refresh.
    - [ ] Endpoint receives expected payload (inspect network tab / logs).

---

## Ticket 4 – Implement `POST /api/revenue-schedules/bulk-update`

**Goal:** Provide shared bulk update for schedule fields (qty/price/usage adj/rate/commission adj).

**Files to touch**
- `app/api/revenue-schedules/bulk-update/route.ts` (new)
- Possibly helper(s) in `app/api/revenue-schedules/helpers.ts`

**Implementation steps**
- [ ] Create route with `withPermissions` (same permission set as Ticket 2).
- [ ] Parse body:
  - [ ] `ids: string[]` (non-empty).
  - [ ] `patch: object` containing any of:
    - `quantity`, `priceEach`, `expectedUsageAdjustment`, `expectedCommissionRatePercent`, `expectedCommissionAdjustment`.
  - [ ] If `patch` is empty, return `400`.
- [ ] Load schedules (and necessary relations) for tenant:
  - [ ] `revenueSchedule.findMany({ where: { id: { in: ids }, tenantId }, include: { opportunityProduct: true } })`.
- [ ] For each schedule:
  - [ ] Compute `previousValues` snapshot for fields being changed.
  - [ ] Build updates:
    - [ ] If `quantity` or `priceEach` present:
      - [ ] Update `OpportunityProduct` (`quantity`, `unitPrice`) if the relation exists.
    - [ ] If `expectedUsageAdjustment` present:
      - [ ] Update schedule’s adjustment field (per schema).
    - [ ] If `expectedCommissionRatePercent` present:
      - [ ] Update schedule-level rate override (not product catalog).
    - [ ] If `expectedCommissionAdjustment` present:
      - [ ] Update schedule’s commission adjustment field.
  - [ ] Recompute derived values if they are stored (usage net, commission net, differences).
- [ ] Persist changes in a transaction:
  - [ ] For each schedule, track if update succeeded or failed.
- [ ] Audit:
  - [ ] For each successful schedule, call `logRevenueScheduleAudit(previousValues, newValues)`.
- [ ] Return summary payload.

**Validation**
- [ ] `curl` test against `/bulk-update` with small `ids` set:
  - [ ] Verify DB reflects new quantities/prices/adjustments.
  - [ ] Confirm audit rows are present.
- [ ] Check failure scenarios:
  - [ ] Non-existent IDs should appear in `failed` list but not break others.

---

## Ticket 5 – Extract Reusable Editable / Fill-Down Column Pattern

**Goal:** Reuse fill-down behavior in production tables to bulk edit **commission rate percentages** (and optionally other numeric fields).

**Files to touch**
- `app/(dashboard)/revenue-schedules/fill-down-test/page.tsx`
- New shared helper, e.g.:
  - `components/editable-bulk-cell.tsx` or
  - Extension in `components/dynamic-table.tsx`

**Implementation steps**
- [ ] Identify the core pieces in the prototype:
  - [ ] `EditableInput` (contentEditable span).
  - [ ] Bulk prompt state (`bulkPrompt`) and “Apply to N selected” floating button.
  - [ ] Callback that yields `{ columnId, value, selectedIds }` for bulk application.
  - [ ] Confirm `expectedCommissionRatePercent` is treated as a first-class editable column (quantity/price remain supported but are secondary).
- [ ] Extract into a reusable component/hook:
  - [ ] API example:
    - `useFillDownBulkEdit({ selectedIds, onApplyBulk })` returning:
      - An `EditableCell` renderer.
      - Bulk prompt state and a `BulkApplyButton`.
- [ ] Refactor prototype page to consume this abstraction:
  - [ ] Ensure behavior remains identical.
  - [ ] Avoid coupling to any specific API endpoint in the shared helper.

**Validation**
- [ ] Confirm prototype still works:
  - [ ] Edit values, see “Apply to N selected”, confirm state and simulated payload.
- [ ] Check that exported API is simple enough to adopt in `OpportunityDetailsView` and other tables that show commission rate percentages (e.g., Revenue Schedules list, Deposit Reconciliation detail).

---

## Ticket 6 – Make Key Columns Editable on Opportunity Revenue Schedules Tab

**Goal:** Enable in-cell editing + fill-down on the Opportunity’s Revenue Schedules tab, starting with **Expected Commission Rate %**.

**Files to touch**
- `components/opportunity-details-view.tsx`

**Implementation steps**
- [ ] Import the shared fill-down helper from Ticket 5.
- [ ] Decide initial fill-down-enabled columns (MVP):
  - [ ] **Required:** `expectedCommissionRatePercent` (Expected Commission Rate %).
  - [ ] **Optional (if time):** `quantity`, `unitPrice`, `expectedUsageAdjustment`, `expectedCommissionAdjustment`.
- [ ] Extend `revenueTableColumns` mapping:
  - [ ] For each editable column ID, use the helper’s `EditableCell` renderer instead of the default formatter.
  - [ ] Ensure that editing one selected row triggers the helper’s bulk prompt logic.
- [ ] Implement `onApplyBulk` callback using `/api/revenue-schedules/bulk-update`:
  - [ ] Build `patch` with one field based on `columnId` and the new numeric `value` (for MVP, focus on `expectedCommissionRatePercent`).
  - [ ] Call the endpoint, show toasts on success/failure.
  - [ ] On success, call `onRefresh?.()` so the Opportunity and its revenue schedules re-load from the API.

**Validation**
- [ ] Manually:
  - [ ] Select multiple schedules on the Opportunity’s Revenue Schedules tab.
  - [ ] Edit an editable cell in one selected row.
  - [ ] Click “Apply to N selected”.
  - [ ] Confirm:
    - [ ] Values update in the table after refresh.
    - [ ] DB reflects the changes.
    - [ ] `/bulk-update` receives correct payload.

---

## Ticket 8 – Revenue Schedule History Tab Using `AuditHistoryTab`

**Goal:** Surface per-schedule change history.

**Files to touch**
- `app/(dashboard)/revenue-schedules/[revenueScheduleId]/page.tsx`

**Implementation steps**
- [ ] Import `AuditHistoryTab` from `components/audit-history-tab`.
- [ ] Add a “History” tab to the schedule detail page tab set:
  - [ ] Use `entityName="RevenueSchedule"`.
  - [ ] Use `entityId = revenueSchedule.id`.
- [ ] Ensure appropriate layout so History table reuses existing styles.

**Validation**
- [ ] After Tickets 1,2,4,9:
  - [ ] Navigate to a schedule detail.
  - [ ] Confirm History tab lists audit events from:
    - Single PATCH.
    - Bulk update endpoints.

---

## Ticket 9 – Audit Changes in `PATCH /api/revenue-schedules/[id]`

**Goal:** Ensure direct schedule edits are audited.

**Files to touch**
- `app/api/revenue-schedules/[revenueScheduleId]/route.ts`

**Implementation steps**
- [ ] In PATCH handler:
  - [ ] Before applying changes, load full record (or at least fields to be updated) into `previousValues`.
  - [ ] After applying updates, re-fetch updated record into `newValues`.
  - [ ] Call `logRevenueScheduleAudit` with these snapshots.
- [ ] Limit the snapshot to relevant fields to keep audit logs compact if needed (e.g., schedule name, date, rate, splits, usage/commission metrics).

**Validation**
- [ ] Manually:
  - [ ] Update fields through Revenue Schedule detail UI.
  - [ ] Confirm:
    - [ ] AuditLog rows appear with `entityName = 'RevenueSchedule'`.
    - [ ] History tab shows those changes.

---

## Ticket 10 – Audit Opportunity Split Changes Initiated from Schedule PATCH

**Goal:** Keep Opportunity split history complete when splits are changed via schedule PATCH.

**Files to touch**
- `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
- `lib/audit.ts` (if any small helpers needed)

**Implementation steps**
- [ ] When PATCH handler updates split-related fields on the linked Opportunity (`houseSplitPercent`, `houseRepPercent`, `subagentPercent`):
  - [ ] Load prior values for those fields from Opportunity before update.
  - [ ] After update, load new values.
  - [ ] Call `logOpportunityAudit` with `previousValues`/`newValues` limited to the split-related fields.
- [ ] Ensure the Opportunity ID is available from the loaded `existing` schedule (via relation).

**Validation**
- [ ] Manually:
  - [ ] From the schedule detail, change splits (if allowed by UI).
  - [ ] Confirm:
    - [ ] RevenueSchedule History tab reflects the change.
    - [ ] Opportunity History tab also shows split changes as separate audit rows.

---

## Ticket 11 – Replace MOCK History Rows in Read-Only Opportunity Header

**Goal:** Use real audit data for Last Edit labels in read-only header.

**Files to touch**
- `components/opportunity-details-view.tsx`

**Implementation steps**
- [ ] In `OpportunityHeader`, remove dependency on `MOCK_HISTORY_ROWS`.
- [ ] Use `useFieldHistory('Opportunity', opportunity.id, ['subagentPercent','houseRepPercent','houseSplitPercent'])`:
  - [ ] Inject `fieldHistory` into `FieldRow` calls for the three split rows, similar to `EditableOpportunityHeader`.
- [ ] Ensure the hook is only called when `opportunity` is present and `id` is defined.

**Validation**
- [ ] For a user without inline-edit permission (or by forcing read-only mode):
  - [ ] Confirm the header shows `Last edited <date> by <user>` for split fields.
  - [ ] Confirm that values match those in the Opportunity History tab.

---

## Ticket 7 & 12 – Optional UX Enhancements (Bulk Edit Panel + “Change Rate” Action)

These are **optional polish** once core flows work.

**Ticket 7 – Bulk Edit Panel**
- [ ] Add a “Bulk Edit” action to `revenueBulkActions` on the Opportunity Revenue Schedules tab.
- [ ] Implement a panel/modal to edit the allowed fields and call `/bulk-update`.

**Ticket 12 – “Change Rate” action from Opportunity tab**
- [ ] Add a “Change Rate” action that:
  - [ ] Opens `RevenueScheduleCreateModal` directly on the `"rates"` tab with selected IDs pre-populated.

**Validation**
- [ ] Same as Tickets 4 & 6 reuse, but started from explicit actions instead of in-cell edits.

---

This plan should allow implementing tickets in small, testable slices while maintaining a clear vertical path:  
**(Audit helper) + (bulk APIs) + (Opportunity tab + modal) + (history wiring).**
