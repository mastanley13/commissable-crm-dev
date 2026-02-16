# Plan: Resolve TC-03 (1:M Split Allocation) to Passing

## Goal (Definition of Done)

`TC-03` in `docs/runbooks/2026-02-10-Reconciliation-Workflow-UAT-Browser-Steps.md` is **Pass**:

- User can select **exactly 1** deposit line + **2+** schedules on the deposit detail page.
- Clicking **Match** opens the Match Wizard with detected type **`1:M`**.
- Allocations can be entered/adjusted across schedules.
- **Run Preview** returns **no blocking errors**.
- **Confirm Apply** succeeds and updates deposit line + schedule aggregates/statuses.
- Over-allocation is **blocked** with a clear preview error (usage and/or commission).

## Current State (What We Know From Run 1)

From `docs/notes/Reconciliation_Browser_Test_Results_1.md`, `TC-03` is **BLOCKED** because the tester could not select 2+ schedules (environment reports “no revenue schedules exist” for the remaining unmatched lines).

Important: the codebase already has a working multi-match wizard flow for `OneToMany`:

- Selection classification: `lib/matching/match-selection.ts`
- Wizard UI: `components/reconciliation-match-wizard-modal.tsx`
- Preview API: `app/api/reconciliation/deposits/[depositId]/matches/preview/route.ts`
- Apply API: `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts`
- Validation (includes over-allocation blocking): `lib/matching/match-group-preview.ts`

So the most likely root blocker for TC-03 is **test data availability/visibility**, not missing endpoints.

## Likely Blockers / Gaps (Ordered)

1. **No suitable revenue schedule test data** exists for the tenant/environment being tested (or it exists but is filtered/hidden).
2. **Candidate retrieval filters** prevent >1 schedule from appearing in the bottom grid for the selected line.
   - Vendor/distributor/account hard filters, date window, status filters, “deletedAt is null”, etc.
3. **Future schedules are excluded** during matching (if the intended 1:M scenario is a prepay across future months).
   - Deposit detail page has an “Include Future-Dated Schedules” toggle (see `components/deposit-reconciliation-detail-view.tsx`).
4. **Schedule “expected vs actual” fields are not populated**, so schedules do not qualify as allocatable candidates (often filtered by “open difference” logic).
5. **Permissions/tenant mismatch** causing the Revenue Schedules list view to show 0 while the reconciliation view shows some schedules (must be reconciled before assuming a product bug).

## Plan of Attack

### Step 1: Verify the Block is Truly “No Schedules” (15-30 min)

Objective: distinguish “no data” vs “data exists but filtered”.

- On the deposit detail page used for TC-03:
  - Select one target deposit line and confirm the bottom grid loads schedules at all.
  - Switch schedule filter dropdown to `all` (if available) and verify row count.
  - Toggle “Include Future-Dated Schedules” ON and re-check.
- Capture evidence:
  - Screenshot of bottom grid empty state and any applied filters/toggles.
  - Network response for the schedules/candidates request (status code + payload size is enough).

Exit criteria:
- We can confidently say whether there are **0 candidate schedules** due to missing data or due to retrieval rules.

### Step 2: Provision a Minimal “TC-03 Fixture” Dataset (1-2 hrs, depends on tooling)

Objective: guarantee a line that can match to **2+ schedules**.

Minimum recommended fixture (single customer/account, single vendor/distributor pairing):

- Create one **Opportunity Product** with **at least 3 schedules** (more is fine):
  - `deletedAt = null`
  - status in an “open” state (`Unreconciled` / `Underpaid` / `Overpaid`)
  - expected fields populated so each schedule has a meaningful open balance:
    - `expectedUsage` and `expectedCommission` > 0
    - `actualUsage`/`actualCommission` initially 0 (or less than expected)
  - schedule dates that fall within the candidate date window, or ensure future schedules are allowed.

- Create one deposit with one **unmatched** line item:
  - positive `usage` and `commission`
  - `reconciled = false`, `status != Ignored`
  - vendor/distributor/account identifiers aligned to the schedules so candidate retrieval can “see” them
  - amount large enough to split (ex: line usage = sum of 2-3 schedule expected usage, or at least large enough to allocate across two schedules)

Implementation approach options (pick one and standardize):
- DB seed script (preferred for repeatability in UAT resets).
- Admin UI creation (acceptable if UAT is stable and this is a one-off).
- Prisma Studio/manual inserts (fast but easy to drift; only do if you capture exact steps and IDs).

Exit criteria:
- Selecting the fixture deposit line shows **at least 2 schedules** in the bottom grid.

### Step 3: Execute TC-03 Exactly as Written (30-45 min)

Runbook: `docs/runbooks/2026-02-10-Reconciliation-Workflow-UAT-Browser-Steps.md` section “TC-03”.

Execution checklist:
- Select **exactly 1** line in top grid.
- Select **2+** schedules in bottom grid.
- Click **Match**.
- Confirm wizard detected type shows `1:M`.
- On Allocation step, enter splits (start with auto-default allocations, then tweak).
- Run Preview.
- Apply.

Evidence to capture (per runbook checklist):
- Before/after totals in the top summary (allocated/unallocated).
- Wizard preview result (ok + issues, if any).
- IDs: `depositId`, `lineId`, `scheduleId[]`, and resulting `matchGroupId`.

Exit criteria:
- `TC-03` is **Pass**, or we have a concrete, reproducible failure with IDs + error payload.

### Step 4: If TC-03 Still Fails, Triage by Failure Mode (1-3 hrs)

Use the preview errors as the decision point. Common buckets based on `lib/matching/match-group-preview.ts`:

- **Selection mismatch** (`selection_mismatch`):
  - Usually a UI selection bug (line or schedule selection state not passed correctly).
  - Validate the selected IDs used to open the wizard match what the user clicked.

- **Line locked/ignored** (`line_locked`, `line_ignored`):
  - Test data issue: line must be not reconciled and not ignored.

- **Over-allocation blocked** (`line_over_allocated_usage`, `line_over_allocated_commission`):
  - Expected behavior. Ensure the test asserts this when deliberately over-allocating, and that the UI makes the error visible enough.

- **Missing schedules/lines** (`missing_line_items`, `missing_schedules`):
  - Tenant mismatch, soft-deleted schedules, or ID staleness between grids and wizard.

- **Match group conflicts** (`match_group_conflict`, `allocation_remove_not_supported`):
  - Test data issue: ensure the line/schedule pairs have no prior Applied group allocations.

Exit criteria:
- Each failure is mapped to either:
  - test data correction needed, or
  - candidate retrieval visibility issue, or
  - product/code defect with a minimal reproduction.

### Step 5: Hardening (Optional but Recommended Once Passing)

Once TC-03 passes once, lock it in:

- Create a “TC-03 fixture checklist” (IDs, how to reset, how to re-run) to prevent re-blocking on the next UAT refresh.
- Add a lightweight regression note to the test script CSV row for TC-03 (what dataset to use).

## Owner Checklist (Who Does What)

- QA/Ops:
  - Step 1 verification + evidence
  - Step 3 execution + evidence capture
- Engineering (if data seeding is not self-serve):
  - Step 2 fixture provisioning (prefer scripted)
  - Step 4 defect triage and fixes if preview/apply fails with the fixture

## Notes / Risks

- If the bottom grid is truly “suggested-only” and never shows enough candidates even with fixture data, TC-03 may require a product decision:
  - either broaden candidate retrieval for split allocation scenarios, or
  - provide a “search/add schedules” affordance in the wizard for advanced flows.

