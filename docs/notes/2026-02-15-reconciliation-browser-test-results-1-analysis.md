# 2026-02-15 Reconciliation UAT Browser Test Results (Run 1) - Analysis + Next Steps

## Source Artifacts Reviewed

- Test results: `docs/notes/Reconciliation_Browser_Test_Results_1.md`
- Runbook steps: `docs/runbooks/2026-02-10-Reconciliation-Workflow-UAT-Browser-Steps.md`
- Test guide: `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Guide.md`
- Test script CSV: `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Script.csv`
- Related plan (TC-05 hardening): `docs/plans/2026-02-12-tc-05-bundle-rip-and-replace-gap-resolution-plan.md`

## Executive Synopsis (Where We Are Right Now)

1. **We have validated the basic 1:1 match apply path works** in the UI (allocations and status updates change as expected).
2. **We have validated matching still works with partial data (missing address)** when other identifiers/signals exist.
3. **Most of the reconciliation sprint test plan is not yet executable**, because the environment is missing prerequisite test data (revenue schedules and/or the specific scenarios and upload files required by the runbook).
4. **The primary “real” defects found so far are UX feedback gaps** (missing success toast on match, missing error message when an action is blocked) and possibly missing “Ignored”/“Reconciled” paths in the UI (not present in this run).

Bottom line: **Core 1:1 matching is functionally alive, but the sprint is currently blocked on test-data provisioning and a couple of UI feedback gaps.**

## Current Test Status Summary (From Run 1)

### Completed

- **TC-01 (1:1 Success + locked behavior): PARTIAL PASS**
  - Pass: selecting 1 unmatched deposit line + 1 suggested schedule and clicking Match updated totals and moved the line to Matched.
  - Fail/gap: no success toast after a successful match.
  - Fail/gap: attempting to match an already-matched line was blocked (good), but **no clear error/toast** explained why (bad).
  - Additional note: test expected to validate “reconciled/ignored locked lines”; no “Ignored” filter was visible and no “Reconciled” lines were available, so “Matched” was used as a proxy.

- **TC-02 (1:1 with partial data, missing address): PASS**
  - Candidates still appeared and the match applied successfully despite missing address fields.

### Blocked

- **TC-03 through TC-15: BLOCKED** in this run due to **missing test data** (results note “0 revenue schedules” / unable to select schedules for non-1:1 wizard flows).
- **TC-16 and TC-17: BLOCKED** due to **missing test upload files** (and TC-17 also depends on matching/flex flows, which depend on schedules/scenarios existing).

### Must-Pass Impact

The Test Guide lists these as must-pass for the cycle:
- `TC-01`, `TC-03`, `TC-04`, `TC-05`, `TC-06`, `TC-14`, `TC-15`, `TC-16`

In Run 1:
- `TC-01` is **not fully passing** (UX feedback missing).
- `TC-03/04/05/06/14/15/16` are **not executable** yet.

## Key Blockers (What’s Preventing Progress)

### Blocker A: Environment/Test Data is Not Provisioned for Non-1:1 Scenarios

The runbook preconditions explicitly require:
- a clean 1:1 line
- a partial-data line (missing address)
- **1:M and M:1 scenarios**
- **bundle scenario**
- **negative chargeback line**
- plus specific upload files for totals/subtotals and missing-data onboarding tests

Run 1 only had data sufficient for `TC-01` and `TC-02`. Everything else depends on:
- a meaningful set of **revenue schedules** (and/or candidate schedules) to select in the bottom grid
- opportunities/products configured so that “12 schedules” and “ActiveBilling month-to-month” tests are possible
- negative-line and special-file fixtures

### Blocker B: Missing Test Files for Upload Scenarios

`TC-16` and `TC-17` are explicitly blocked because the environment lacks the required deposit-upload fixture files:
- “totals/subtotals rows” file(s)
- “missing opportunity / mapping / key identifiers / mixed quality rows” file(s)

### Blocker C: Missing User Feedback (Toasts/Errors) Causes TC-01 to Remain Partial

Even though the underlying business action appears to be working, the runbook expects:
- success confirmation after Match
- clear error messaging when action is blocked (locked line)

Without those, users cannot confidently operate the workflow and the test case cannot be marked fully passing.

## Important Inconsistency to Resolve (Before Engineering Starts Chasing Ghosts)

Run 1 contains an apparent contradiction:
- TC-01/TC-02 successfully match to a specific schedule (example: RS-125165), which implies schedules exist.
- TC-03+ notes “0 revenue schedules” / no schedules available for the remaining unmatched lines.

This can happen for non-bug reasons (filters/permissions/tenant mismatch), but we should confirm it explicitly.

**Minimum clarification steps (recommended before changing code):**
1. Confirm you are in the same tenant/environment across all TCs (capture base URL + tenant/account context).
2. On **Revenue Schedules** page, clear filters and confirm whether it truly returns 0 rows (capture screenshot + Network response).
3. On the deposit detail page for TC-01/02, capture the Network response when the “Suggested Schedules” grid loads (does it return schedule entities, or something else?).
4. Record stable IDs for the executed test (depositId, lineId, scheduleId) per the runbook evidence checklist.

If the schedule list is actually non-zero but not visible in a list view, that becomes its own P0 bug: “Schedules exist but listing UI shows none.”

## What Needs To Be Completed (Concrete Work Items)

### 1) Provision Minimal UAT Test Data Set (Unblocks Most Must-Pass TCs)

Target: one dataset that enables `TC-03`, `TC-04`, `TC-05`, `TC-06`, `TC-14`, `TC-15`, plus later `TC-09/10/11/13`.

Recommended minimum data (aligned to the Test Guide “Test Data Setup”):
- **Opportunity + Product A**: 12 monthly schedules (Jan 1 through Dec 1), with expected usage/commission populated.
- **Product B**: same customer, different commission rate than Product A (to test `TC-06` “rate differences”).
- Deposit lines:
  - 1:1 exact match line (Order ID like `ORD-UAT-001`)
  - 1:1 partial-data line (missing address but has Order ID / Customer ID)
  - **1:M** prepay line large enough to allocate across 2+ schedules
  - **M:1** multiple partial lines that together pay one schedule
  - **Bundle candidate**: multiple lines intended to rip/replace against one base schedule (dates >= base schedule date)
  - **Negative line** for chargeback path
- Roles: reconciler + manager/admin approver role available and confirmed.

Notes:
- If it’s hard to hand-create, create a repeatable “seed” approach (script/SQL/prisma seed) so the team can re-run it after resets.
- If this is a shared UAT, use highly unique identifiers to avoid collisions (prefix everything with `UAT-RCN-2026-02`).

### 2) Create/Check-in Test Upload Fixtures (Unblocks TC-16 and TC-17)

The runbook expects specific file patterns. Even a small set is enough to start.

For `TC-16`:
- A file with normal rows plus “Total/SubTotal/Grand Total” rows (multiple variations: `Total`, `Totals`, `SubTotal`, `Grand Total`).

For `TC-17`:
- Four files (or one file per scenario) that isolate the missing-data levels:
  - missing opportunity only
  - missing opportunity + missing product mapping
  - missing key identifiers (Order ID / Customer ID / Location)
  - mixed quality rows

If the team prefers not to commit files, at least store them in a shared location and link them in the runbook, but committing to `docs/runbooks/` or a `docs/test-data/` folder usually reduces friction.

### 3) Fix TC-01 UX Feedback (Quick, High Confidence Win)

What the runbook expects:
- On successful Match: success toast
- On blocked Match (already matched / ignored / reconciled): error toast with actionable text (“This line is locked because it is already matched/reconciled/ignored”).

Even if the backend already prevents the action, **the UX must communicate** what happened; otherwise QA will continue marking partial/fail and Ops will struggle.

Also decide/clarify:
- Is “Ignored” a planned status/filter in this UI? If yes, implement it or adjust test expectations. If not, update the test script so TC-01 validates “Matched/Reconciled locked states” instead of “Ignored.”

## Recommended “Unblock and Proceed” Sequence (Pragmatic Order)

1. **Confirm environment consistency + permissions** (eliminate the “0 schedules but matched to RS-xxxxx” inconsistency).
2. **Provision/seed revenue schedules + scenarios** needed for non-1:1 matching.
3. **Re-run TC-03 and TC-04 first** (they unlock TC-05/06/07/15; they are the backbone flows).
4. **Fix TC-01 toast/error UX** in parallel (low effort, removes noise from every test run).
5. Execute `TC-05` (bundle) guided by the existing TC-05 gap plan; validate idempotency and replace semantics early.
6. Execute `TC-06` (rate differences) immediately after TC-05 because it shares the same critical paths.
7. Execute `TC-14` and `TC-15` once you have negative lines + applied groups to undo.
8. Add and run fixtures for `TC-16`, then `TC-17`.

## How to Prove Progress (Evidence + Tracking)

To prevent “we think it works” loops, each test run should capture:
- Screenshot before action + after action
- Network evidence for the apply call (status code + payload or error)
- IDs: `depositId`, `lineId`, `scheduleId`, `matchGroupId` where relevant
- Update `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Script.csv` with:
  - `Status_(Pass/Fail)`
  - `Actual_Result`
  - `Defect_ID`
  - `Evidence_Links`

This makes it easy to map a code change to a specific TC improvement and prevents regressions.

## Open Questions (Worth Answering Before Next Engineering Slice)

1. What is the intended source of truth for “revenue schedules exist” in UAT: the schedules listing page, the reconciliation suggested-schedules grid, or DB records? (They should all agree.)
2. Is “Ignored” a required workflow in this sprint or only future scope? If required, it needs UI + API + filter + locking rules.
3. Who owns seeding UAT test data (engineering vs QA vs Ops)? If engineering owns it, we should build repeatable scripts to avoid manual setup.

