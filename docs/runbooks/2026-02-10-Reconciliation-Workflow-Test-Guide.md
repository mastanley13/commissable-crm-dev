# Reconciliation Workflow Test Guide (Core Scenarios)

**Date:** 2026-02-10  
**Audience:** QA, Ops, Product, Engineering  
**Purpose:** Validate core matching, bundle, manage-schedules, flex, chargeback, undo, and onboarding edge-case behavior.

---

## 1. Scope

This runbook covers:

- `1:1` matching (including "waiting for match" vs "not waiting")
- `1:M`, `M:1`, and bundle (rip-and-replace) workflows
- Commission-rate edge cases in bundle/matching
- Recalculation behavior after schedule updates
- Manage Revenue Schedules behavior (bulk updates, selection carry-over, undo)
- Flex, month-to-month, and chargeback workflows
- Deposit upload "ignore total rows" behavior
- Future onboarding testing for missing data levels

---

## 2. Required Roles and Access

- Reconciler user with `reconciliation.manage`
- Revenue schedule manager with `revenue-schedules.manage` or `opportunities.manage`
- Manager user for chargeback approval / elevated undo checks

---

## 3. Test Data Setup

Use one test opportunity with one product and 12 monthly schedules.

- Product A: 12 schedules, monthly, Jan 1 through Dec 1, expected usage/commission populated
- Product B: same customer, different commission rate from Product A
- Deposit test lines:
1. Exact 1:1 line (Order ID match)
2. 1:1 line missing address data but with Order ID or Customer ID
3. One large prepay line to split across multiple schedules (`1:M`)
4. Multiple partial lines for one schedule (`M:1`)
5. Multi-line bundle candidate (many lines to one schedule)
6. Negative line (chargeback path)
7. File rows containing `Total`, `Totals`, `SubTotal`, `Grand Total`

Use obvious identifiers so validation is easy:

- Order IDs like `ORD-UAT-001`, `ORD-UAT-002`
- Customer IDs like `CID-UAT-001`
- Bundle test lines like `BUNDLE-L1`, `BUNDLE-L2`, `BUNDLE-L3`

---

## 4. Test Cases

## TC-01 - 1:1 Success (Waiting vs Not Waiting)

**Objective:** Confirm simple match works and locked lines cannot be rematched.

**Steps:**
1. Open a deposit with one `Unmatched` line and one matching schedule.
2. Select 1 line + 1 schedule and click `Match`.
3. Verify success and updated allocation totals.
4. Try again on a line that is already reconciled or ignored.

**Expected:**
- Unmatched line can be matched successfully.
- Reconciled/ignored lines are blocked with clear errors (line locked/ignored behavior).

---

## TC-02 - 1:1 with Partial Data (Order ID Present, Address Missing)

**Objective:** Confirm matching still works when address fields are blank.

**Steps:**
1. Use a line with missing address but valid Order ID/Customer ID.
2. Open suggested schedules.
3. Match the best schedule.

**Expected:**
- Candidate still appears based on IDs/name/amount/date signals.
- Match can be applied without requiring address fields.

---

## TC-03 - 1:M Split Allocation

**Objective:** Validate one deposit line can allocate across many schedules.

**Steps:**
1. Select 1 deposit line and 2+ schedules.
2. Click `Match`.
3. Confirm wizard detects `1:M`.
4. Allocate usage/commission across schedules.
5. Run preview and apply.

**Expected:**
- Wizard opens with detected type `1:M`.
- Over-allocation is blocked.
- Apply succeeds as one match group.

---

## TC-04 - M:1 Partial Payment

**Objective:** Validate many deposit lines can allocate to one schedule.

**Steps:**
1. Select multiple lines and one schedule.
2. Click `Match`.
3. Confirm wizard detects `M:1` and choose `Allocate`.
4. Preview and apply.

**Expected:**
- Wizard opens with detected type `M:1`.
- Running totals on schedule reflect multiple contributing lines.
- Underpaid/overpaid indicators update correctly.

---

## TC-05 - Bundle (Rip and Replace) + Replace Existing

**Objective:** Validate bundle creation and optional replacement of old schedules.

**Steps:**
1. In an `M:1` scenario, open match wizard.
2. Choose `Bundle (Rip & Replace)`.
3. Set replace mode to `Soft-delete unreconciled old schedules`.
4. Click `Create bundle schedules`.
5. Continue into allocation preview/apply.

**Expected:**
- New products/schedules are created from selected lines.
- Wizard transitions into allocation flow for created schedules.
- Old schedules are soft-deleted only when eligible (unreconciled and unmatched).

---

## TC-06 - Commission Rate Difference Handling (No Blending)

**Objective:** Ensure different commission rates are not blended incorrectly in bundle/matching.

**Steps:**
1. Use lines/schedules that imply different effective commission rates.
2. Run bundle create and apply match.
3. Validate each created schedule's expected usage/commission and effective rate.
4. Repeat with a rate-mismatch candidate and check whether candidate still appears.

**Expected:**
- Each created/updated schedule keeps correct expected commission math.
- No silent blending into one incorrect rate.
- If mismatch suppresses visibility, capture as defect with screenshots and IDs.

---

## TC-07 - "Checkdown" / Underpaid to Collections

**Objective:** Validate underpaid workflow can be tracked into collections/checkdown.

**Steps:**
1. Create an underpaid schedule by partial allocation.
2. Confirm status moves to `Underpaid`.
3. Attempt to launch collections/checkdown action from that state.

**Expected:**
- Underpaid status exists and is visible.
- Collections/checkdown action is available, or gap is explicitly documented.

---

## TC-08 - Recalculation After Downstream Data Updates

**Objective:** Verify dependent values recalculate after updates.

**Steps:**
1. Edit schedule `Quantity` and `Price Each`.
2. Edit expected commission rate.
3. Edit usage/commission adjustments.
4. Save and refresh.

**Expected:**
- Derived amounts recalculate consistently:
  - `Expected Usage = Quantity x Price Each (+/- adjustments as applicable)`
  - `Expected Commission` reflects current rate/logic
- No stale values after refresh.

---

## TC-09 - Mass Change Start Date (12 schedules)

**Objective:** Validate month-shift behavior (example: Jan 1 -> Feb 1).

**Steps:**
1. Select 12 schedules for one product.
2. Open `Manage Revenue Schedules`.
3. Use `Change Start Date` (if available).
4. Set new start date to Feb 1 and provide reason.
5. Apply and verify resulting sequence.

**Expected:**
- Dates shift by one month while preserving cadence.
- For Jan-Apr example, shifted sequence becomes Feb-May.
- Reason is required.
- If tab is missing, log as gap/blocker.

---

## TC-10 - Manage Revenue Schedules Updates (Amounts, Rate, Qty, Price, Dates)

**Objective:** Validate update paths in Manage/bulk edit flows.

**Steps:**
1. From opportunity revenue schedules, open `Manage Revenue Schedules`.
2. Test `Change Commission Rate`.
3. Test `Change Commission Split`.
4. Test date-related action if available (`Change Start Date`).
5. Where quantity/price are editable in bulk, update and apply.

**Expected:**
- Updates save for selected schedules only.
- Audit/history entries are created.
- Derived calculations stay consistent after apply.

---

## TC-11 - Manage Popup Consolidation + Selected Row Carry-Over

**Objective:** Validate one popup flow and selection persistence.

**Steps:**
1. Select several schedules on Opportunity -> Revenue Schedules.
2. Click `Manage Revenue Schedules`.
3. Check each tab for preselected rows.

**Expected:**
- Manage actions are in one popup workflow.
- Previously selected rows are carried into relevant tabs.
- Any tab missing carry-over should be logged as UX defect.

---

## TC-12 - Flex Product Workflow

**Objective:** Validate no-match/overage handling with Flex.

**Steps:**
1. Use a line with no valid match.
2. Trigger `Create Flex Product`.
3. Open Flex resolution path.
4. Test one-time and recurring resolution choices.

**Expected:**
- Flex item/schedule is created.
- Resolution path supports required choices and downstream schedule creation behavior.

---

## TC-13 - Month-to-Month Workflow

**Objective:** Validate automated month-to-month schedule creation.

**Steps:**
1. Use an active-billing product with no schedule in the target month.
2. Trigger month-to-month job process in test environment.
3. Check new schedule creation for target month.

**Expected:**
- Exactly one new month schedule is created when criteria are met.
- No duplicate schedule created if target month already exists.

---

## TC-14 - Chargebacks and Reversals

**Objective:** Validate negative-line handling and manager flow.

**Steps:**
1. Upload or create a negative deposit line.
2. Reconcile and confirm chargeback creation.
3. Verify status label is `In Dispute`.
4. Log in as Manager and approve/reject.
5. Add reversal line and reconcile.

**Expected:**
- Chargeback schedule (`-CB`) is created.
- Manager action path is available.
- Reversal (`-CB-REV`) is created and auditable.

---

## TC-15 - Undo Workflows

**Objective:** Validate safe rollback for matching and bundle actions.

**Steps:**
1. Apply a non-1:1 match group.
2. Use `Undo Match Group`.
3. In bundle test, use `Undo bundle`.
4. In Manage popup, use `Remove Allocation` tab.

**Expected:**
- Allocation rollback restores line/schedule aggregates correctly.
- Undo actions are auditable (who/when/what/reason).
- Bundle undo should be blocked when dependent matches still exist.

---

## TC-16 - Deposit Upload Ignore Total Rows

**Objective:** Validate totals/subtotals are not imported as line items.

**Steps:**
1. Upload a file containing data rows plus `Total`/`SubTotal`/`Grand Total` rows.
2. Test multi-vendor upload path.
3. Test single-vendor upload path.
4. Compare imported line count vs expected non-total data rows.

**Expected:**
- Total/subtotal rows are ignored and not imported as deposit lines.
- If totals import in single-vendor path, log defect with file and row number evidence.

---

## TC-17 - Future Onboarding: Missing Data Levels

**Objective:** Validate behavior when onboarding data is incomplete.

**Levels to test:**
1. Missing opportunity only
2. Missing opportunity + missing product mapping
3. Missing key identifiers (Order ID / Customer ID / Location)
4. Mixed quality rows in same file

**Steps:**
1. Import each level as separate test deposit.
2. Attempt matching and flex handling.
3. Track whether system blocks, warns, or routes to exception workflows.

**Expected:**
- No hard crash.
- Clear, actionable behavior:
  - match when possible
  - unmatched/flex/chargeback path when not possible
- Errors/warnings are explicit enough for onboarding ops to act.

---

## 5. Evidence Checklist (for every test)

- Screenshot of selection state before action
- Screenshot of result state after action
- IDs captured: `depositId`, `lineId`, `scheduleId`, `matchGroupId` (if any)
- Error text copied exactly for failed validations
- Before/after values for amount/rate/date changes

---

## 6. Defect Template

Use this for each failure:

- Test Case ID:
- Scenario:
- Environment:
- User role:
- Preconditions:
- Steps to reproduce:
- Expected result:
- Actual result:
- IDs (deposit/line/schedule/matchGroup):
- Screenshot links:
- Severity: P0 / P1 / P2

---

## 7. Must-Pass for This Cycle

- `TC-01`, `TC-03`, `TC-04`, `TC-05`, `TC-06`, `TC-14`, `TC-15`, `TC-16`

If any must-pass case fails, hold release for reconciliation workflows until triaged.

