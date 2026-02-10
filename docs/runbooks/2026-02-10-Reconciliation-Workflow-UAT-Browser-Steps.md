# Reconciliation Workflow UAT Browser Steps (TC-01 to TC-17)

**Date:** 2026-02-10  
**Use with:**  
- `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Guide.md`  
- `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Script.csv`  

---

## 1. How To Use This Script

1. Open `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Script.csv`.
2. Execute each test case below in order (`TC-01` to `TC-17`).
3. For each test:
   - set `Status_(Pass/Fail)`,
   - add `Actual_Result`,
   - add `Defect_ID` if fail,
   - attach screenshots/URLs in `Evidence_Links`.
4. If a button/feature is missing, mark **Fail** and log as a gap with screenshot.

---

## 2. UAT Preconditions (Do Once)

1. Log in as a user with reconciliation permissions.
2. Confirm these users are available:
   - Reconciler user (`reconciliation.manage`)
   - Manager/Admin user for approvals/undo role tests
3. Confirm test data exists:
   - one clean 1:1 match line
   - one partial-data line (missing address)
   - 1:M and M:1 scenarios
   - bundle scenario
   - negative chargeback line
   - upload files with totals/subtotals
4. Open browser devtools Network tab for evidence capture.

---

## TC-01 - 1:1 Success (Waiting vs Not Waiting)

**Browser path:** `/reconciliation` -> open deposit detail  

1. Go to **Reconciliation** list page.
2. Click a deposit row to open deposit detail.
3. In top grid (Deposit Line Items), select one `Unmatched` line.
4. In bottom grid (Suggested Schedules), select one schedule.
5. Click **Match**.
6. Confirm success toast and updated allocations/status.
7. Try same action on a line that is already reconciled or ignored.

**Pass if:**
- Unmatched line matches successfully.
- Reconciled/ignored line is blocked with clear error.

**Fail if:**
- Match does not apply on valid 1:1.
- Locked lines can still be changed.

---

## TC-02 - 1:1 with Partial Data (Missing Address)

**Browser path:** `/reconciliation` -> deposit detail  

1. Open deposit containing a line with missing address fields.
2. Select that line in top grid.
3. Verify at least one candidate schedule appears in bottom grid.
4. Select best candidate and click **Match**.

**Pass if:**
- Candidate appears despite missing address.
- Match applies successfully.

**Fail if:**
- Candidate list is empty solely because address is missing.
- Match fails with non-actionable error.

---

## TC-03 - 1:M Split Allocation

**Browser path:** `/reconciliation` -> deposit detail -> Match Wizard  

1. Select exactly one deposit line in top grid.
2. Select two or more schedules in bottom grid.
3. Click **Match**.
4. In wizard Step 1, confirm detected type shows `1:M`.
5. Click **Next** to allocations.
6. Enter usage/commission splits across schedules.
7. Click **Next**, then **Run Preview**.
8. Confirm no blocking validation errors.
9. Click **Next**, then **Confirm Apply**.

**Pass if:**
- Wizard detects `1:M`.
- Over-allocation is blocked.
- Apply succeeds and updates line/schedule totals.

**Fail if:**
- Wrong match type detected.
- Invalid allocations are accepted.
- Apply fails for valid allocations.

---

## TC-04 - M:1 Partial Payment

**Browser path:** `/reconciliation` -> deposit detail -> Match Wizard  

1. Select two or more deposit lines in top grid.
2. Select one schedule in bottom grid.
3. Click **Match**.
4. Confirm detected type `M:1`.
5. Keep mode as **Allocate**.
6. Click **Next**, review allocations, then **Run Preview**.
7. Apply match group.
8. Verify schedule shows updated underpaid/overpaid/reconciled state as expected.

**Pass if:**
- Wizard detects `M:1`.
- Multi-line allocations apply and recompute correctly.

**Fail if:**
- Wizard does not open.
- Allocations do not update schedule balances.

---

## TC-05 - Bundle (Rip & Replace)

**Browser path:** `/reconciliation` -> deposit detail -> Match Wizard  

1. Create/select an `M:1` candidate scenario.
2. Click **Match** to open wizard.
3. In `M:1 Mode`, select **Bundle (Rip & Replace)**.
4. Set **Replace mode**:
   - `Keep old schedules` or
   - `Soft-delete unreconciled old schedules`
5. Optionally fill reason.
6. Click **Create bundle schedules**.
7. Confirm wizard transitions into allocation flow for created schedules.
8. Complete preview + apply.

**Pass if:**
- Bundle schedules are created.
- Flow transitions and allocations can be applied.

**Fail if:**
- Bundle action errors for valid inputs.
- No created schedules appear for allocation.

---

## TC-06 - Commission Rate Difference Handling

**Browser path:** `/reconciliation` -> bundle/match flow + schedule detail view  

1. Use test data where lines/schedules imply differing commission rates.
2. Run bundle and/or non-1:1 allocation.
3. After apply, open affected schedules (from schedule link/detail page).
4. Compare:
   - Expected usage
   - Expected commission
   - Effective commission rate %
5. Repeat with mismatch candidate scenario and check visibility/behavior.

**Pass if:**
- Rates and expected commission math are correct per schedule.
- No unintended blending into a single wrong rate.

**Fail if:**
- Commission math appears blended/incorrect.
- Candidate visibility behaves unexpectedly without clear rule.

---

## TC-07 - Underpaid to Collections / Checkdown

**Browser path:** `/reconciliation` and/or schedule detail page  

1. Create an underpaid schedule by applying partial payment only.
2. Confirm schedule status displays `Underpaid`.
3. Look for collections/checkdown action from:
   - schedule actions,
   - reconciliation actions,
   - related workflow buttons.

**Pass if:**
- Underpaid status appears.
- Collections/checkdown action exists and can be initiated.

**Fail if:**
- Underpaid status missing or wrong.
- No collections/checkdown path exists (log as feature gap).

---

## TC-08 - Recalculation After Data Updates

**Browser path:** Revenue schedules UI (list/detail/manage)  

1. Open a schedule that can be edited.
2. Update `Quantity` and save.
3. Update `Price Each` and save.
4. Update expected commission rate and save.
5. Update adjustments and save.
6. Refresh page and re-open record.
7. Verify expected usage and expected commission values.

**Pass if:**
- Derived values recalculate correctly and persist after refresh.

**Fail if:**
- Derived fields remain stale or inconsistent after save.

---

## TC-09 - Mass Change Start Date (12 Schedules)

**Browser path:** Opportunity detail -> Revenue Schedules -> Manage  

1. Open opportunity with 12 schedules selected.
2. Click **Manage Revenue Schedules**.
3. Check tab list for **Change Start Date**.
4. If present:
   - set new start date (example Feb 1),
   - provide reason,
   - apply,
   - verify month shift sequence.
5. If tab is not present, capture screenshot and mark fail/gap.

**Pass if:**
- Change Start Date tab exists and updates dates correctly with required reason.

**Fail if:**
- Tab/action missing.
- Dates update incorrectly or without reason requirement.

---

## TC-10 - Manage Revenue Schedules Updates (Amounts/Rate/QTY/Price/Dates)

**Browser path:** Opportunity detail -> Revenue Schedules -> Manage  

1. Select multiple schedules.
2. Open **Manage Revenue Schedules**.
3. Go to **Change Commission Rate** tab:
   - select schedules,
   - enter effective date + rate,
   - click apply/update.
4. Go to **Change Commission Split** tab:
   - select schedules,
   - enter effective date + splits totaling 100,
   - apply.
5. If date update action exists, execute it.
6. Refresh and verify updates persisted.

**Pass if:**
- Selected schedules update correctly and audit history exists.

**Fail if:**
- Updates fail silently.
- Wrong schedules update.
- Derived fields become inconsistent.

---

## TC-11 - Manage Popup Selection Carry-Over

**Browser path:** Opportunity detail -> Revenue Schedules -> Manage  

1. On opportunity revenue schedules grid, select several rows.
2. Click **Manage Revenue Schedules**.
3. Inspect selected state in each relevant tab:
   - Rate tab
   - Split tab
   - Deactivate/Delete tab
   - Remove Allocation tab

**Pass if:**
- Previously selected rows are preselected where expected.

**Fail if:**
- Selection is lost and user must reselect all rows.

---

## TC-12 - Flex Product Workflow

**Browser path:** `/reconciliation` -> deposit detail -> Flex Review Queue  

1. Select a line with no valid match.
2. Click **Create Flex Product**.
3. Confirm success message and item creation.
4. Navigate to **Flex Review Queue** (`/reconciliation/flex-review`).
5. Open created flex item.
6. Test resolution actions:
   - Apply to existing schedule
   - Convert to regular schedule
   - Bonus commission
7. For convert-to-regular recurring flow:
   - set recurring,
   - additional schedule count,
   - additional start date,
   - resolve.

**Pass if:**
- Flex item is created and resolution actions work.

**Fail if:**
- Item not created.
- Resolve actions fail for valid input.

---

## TC-13 - Month-to-Month Workflow

**Browser path:** Revenue schedules pages + browser devtools console  

1. Identify an ActiveBilling opportunity product lacking a schedule in target month.
2. Open related revenue schedules and record latest schedule date.
3. Trigger month-to-month job (if permitted) from browser devtools:
4. Run:
```js
fetch('/api/jobs/month-to-month-schedules?date=2026-03-01', {
  method: 'POST',
  headers: { 'x-job-secret': 'YOUR_JOB_SECRET' }
}).then(r => r.json()).then(console.log)
```
5. Refresh revenue schedules view.
6. Verify one new schedule exists for target month.
7. Re-run once and confirm no duplicate for same month.

**Pass if:**
- Exactly one new month schedule is created when due.
- No duplicate on rerun.

**Fail if:**
- Unauthorized job call despite correct secret.
- No schedule created when criteria are met.
- Duplicate created.

---

## TC-14 - Chargeback and Reversal

**Browser path:** `/reconciliation` + `/reconciliation/flex-review`  

1. Upload/create a negative deposit line.
2. Open deposit detail and process matching.
3. Confirm chargeback entry is created (pending approval).
4. Confirm status label is `In Dispute`.
5. Sign in as manager/admin approver.
6. Open **Flex Review Queue**.
7. Approve/reject chargeback item.
8. Create reversal scenario and run **Create CB-REV** flow.
9. Verify reversal item and audit trail.

**Pass if:**
- Chargeback and CB-REV flows execute with approval workflow.

**Fail if:**
- Approval path unavailable for intended approver role.
- Status labels incorrect.

---

## TC-15 - Undo Workflows

**Browser path:** Match Wizard + Manage Revenue Schedules  

1. Apply a non-1:1 match group.
2. In wizard Apply step, click **Undo Match Group**.
3. Verify allocations and statuses revert.
4. In bundle scenario, click **Undo bundle**.
5. Verify bundle undo behavior:
   - succeeds when safe,
   - blocks when created schedules still have applied allocations.
6. In **Manage Revenue Schedules** -> **Remove Allocation** tab:
   - select deposit matches,
   - remove allocation,
   - verify reset.

**Pass if:**
- Undo actions correctly revert data and preserve audit trail.

**Fail if:**
- Partial rollback, broken totals, or missing audit entries.

---

## TC-16 - Deposit Upload Ignore Total Rows

**Browser path:** `/reconciliation` -> **Deposit Upload**  

1. Click **Deposit Upload**.
2. Fill required context fields.
3. Upload file containing normal rows plus totals/subtotals.
4. Complete mapping.
5. Complete review and import.
6. Open created deposit detail.
7. Compare imported line count vs expected data rows (excluding total rows).
8. Repeat for both:
   - single-vendor mode
   - multi-vendor mode

**Pass if:**
- Totals/subtotals are not imported as line items.

**Fail if:**
- Any total/subtotal row is imported as a normal line.

---

## TC-17 - Onboarding Missing Data Levels

**Browser path:** `/reconciliation` -> Deposit Upload -> Reconciliation/Flex  

Run four files/scenarios:

1. Missing opportunity only
2. Missing opportunity + missing product mapping
3. Missing key identifiers (Order ID / Customer ID / Location)
4. Mixed quality rows in one file

For each scenario:
1. Upload file and complete mapping/import.
2. Open deposit detail.
3. Attempt normal matching.
4. Use flex/exception paths where matching fails.
5. Capture error/warning messages and operational next step clarity.

**Pass if:**
- No crashes.
- Behavior is actionable (match where possible, route to exception workflows where needed).

**Fail if:**
- Hard failures without actionable guidance.
- Inconsistent handling across similar sparse-data cases.

---

## 3. Evidence Checklist (Apply To Every TC)

1. Screenshot before action.
2. Screenshot after action.
3. Any error toast/modal text captured exactly.
4. Record IDs:
   - `depositId`
   - `lineId`
   - `scheduleId`
   - `matchGroupId` (if applicable)
5. Add links/notes in CSV.

---

## 4. Defect Logging Rules

If a test fails:

1. Create defect immediately.
2. Include:
   - TC ID,
   - exact reproduction steps,
   - expected vs actual,
   - evidence links,
   - severity (P0/P1/P2).
3. Update CSV row with `Defect_ID` and `Severity_if_Fail`.

