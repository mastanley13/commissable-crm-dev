# TC-12 + TC-13 UAT One-Page Checklist (Flex Product / Flex Schedule Exception / M2M)

Date: 2026-02-24  
Scope: Browser UAT only  
Related guides:  
- `docs/runbooks/Flex_Product_Guide.md`  
- `docs/runbooks/M2M_Schedule_Extension_Guide.md`  
- `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Guide.md` (TC-12, TC-13)

## Pre-Flight (must complete before testing)

- [ ] PASS  [ ] FAIL  User has required permissions (`reconciliation.manage`; admin where needed).
- [ ] PASS  [ ] FAIL  Test data exists: deposit with line items, revenue schedules, and at least one `ActiveBilling` opportunity product.
- [ ] PASS  [ ] FAIL  Job endpoint can be called with `x-job-secret`.
- [ ] PASS  [ ] FAIL  Variance tolerance configured low enough to trigger overage prompt for TC-12 split path.

Required screenshot:
- Settings page showing variance tolerance and user context.

---

## TC-12A: Flex Product (Unknown / No-Match line)

Goal: create exception schedule from unmatched line.

- [ ] PASS  [ ] FAIL  Select positive unmatched line and run **Create Flex Product**.
- [ ] PASS  [ ] FAIL  Line becomes allocated/matched (or unallocated amounts reduce as expected).
- [ ] PASS  [ ] FAIL  New schedule created with `flexClassification = FlexProduct`.
- [ ] PASS  [ ] FAIL  Schedule date equals first day of deposit reporting month (`YYYY-MM-01`).
- [ ] PASS  [ ] FAIL  Flex Review Queue shows new item in `Open` status.

Required screenshots:
1. Before action: selected deposit line and schedule panel context.  
2. After action: deposit line status/amount changes.  
3. Flex Review Queue row for created item (`Open`).  
4. Revenue Schedule detail showing classification/date.

Record IDs:
- `depositId: ________`
- `lineId: ________`
- `flexScheduleId: ________`
- `flexReviewItemId: ________`

---

## TC-12B: Flex Schedule Exception from Overage (Prompt -> Flex Product)

Goal: force overage prompt and resolve by creating flex exception schedule.

- [ ] PASS  [ ] FAIL  Create overage scenario (e.g., expected 100, allocate 130) and click Match.
- [ ] PASS  [ ] FAIL  Overage prompt appears.
- [ ] PASS  [ ] FAIL  Choose **Flex Product** in prompt; child flex schedule is created.
- [ ] PASS  [ ] FAIL  Split is correct: base schedule reduced, flex schedule holds overage amount.
- [ ] PASS  [ ] FAIL  Flex Review item is created for this schedule.
- [ ] PASS  [ ] FAIL  Base/flex billing status behavior matches expected rules in your environment.

Required screenshots:
1. Overage prompt visible before resolution.  
2. After resolution: base + flex amounts in schedule/line detail.  
3. Flex Review Queue row for overage-created item.  
4. Revenue Schedule detail showing parent linkage (if applicable).

Record IDs:
- `baseScheduleId: ________`
- `childFlexScheduleId: ________`
- `depositId: ________`
- `lineId: ________`

---

## TC-13: M2M Schedule Extension

Goal: validate month-to-month schedule creation, idempotency, and lifecycle transition.

- [ ] PASS  [ ] FAIL  Start with product in `ActiveBilling` and no schedule in target month.
- [ ] PASS  [ ] FAIL  Run job in dry-run mode; response contains telemetry fields.
- [ ] PASS  [ ] FAIL  Run real job; exactly one target-month schedule is created.
- [ ] PASS  [ ] FAIL  Product transitions to `BillingM2M` after first extension run.
- [ ] PASS  [ ] FAIL  Re-run same month; no duplicate schedule is created.
- [ ] PASS  [ ] FAIL  (If tested) no-deposit threshold path transitions product to `BillingEnded`.

Required screenshots:
1. Product + latest schedule before job run.  
2. Dry-run API response payload (telemetry).  
3. Real-run API response payload.  
4. Schedule list after run (new month schedule visible).  
5. Re-run payload showing `createdCount = 0` and skip count increase.  
6. (Optional) Status evidence for `BillingEnded` transition path.

Record IDs:
- `opportunityProductId: ________`
- `targetMonth: ________`
- `createdScheduleId: ________`

---

## Final Sign-Off

- [ ] PASS  [ ] FAIL  All required screenshots captured and attached.
- [ ] PASS  [ ] FAIL  All IDs recorded and traceable.
- [ ] PASS  [ ] FAIL  Any failures logged with exact step, error text, and screenshot reference.

Tester: `____________`  
Environment: `____________`  
Run date/time: `____________`

