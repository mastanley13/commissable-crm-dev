# Reconciliation Workflow Master Execution Plan

**Date:** 2026-02-10  
**Primary Inputs:**  
- `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Guide.md`  
- `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Script.csv`  

---

## 1. Goal

Deliver a complete, testable reconciliation workflow by closing gaps and executing all test cases (`TC-01` through `TC-17`) with clear pass/fail evidence and a production-readiness recommendation.

---

## 2. Outcomes

1. All test cases are executed with evidence and defect logs.
2. P0 blockers are either fixed or explicitly accepted with owner sign-off.
3. Known feature gaps have implementation tickets and delivery dates.
4. Final go/no-go decision is based on must-pass criteria and residual risk.

---

## 3. Scope Matrix (TC Coverage)

**P0 must-pass set**
- `TC-01`, `TC-03`, `TC-04`, `TC-05`, `TC-06`, `TC-14`, `TC-15`, `TC-16`

**P1/P2 stabilization set**
- `TC-02`, `TC-07`, `TC-08`, `TC-09`, `TC-10`, `TC-11`, `TC-12`, `TC-13`, `TC-17`

---

## 4. Execution Model

Run in 5 phases:

1. Phase 0: Preparation and baseline
2. Phase 1: Quick wins and high-probability fixes
3. Phase 2: Core workflow hardening (P0 closure)
4. Phase 3: Extended workflows and onboarding resilience
5. Phase 4: Final regression, sign-off, and rollout

---

## 5. Phase 0 - Preparation and Baseline

## 5.1 Create execution artifacts

1. Freeze current script baseline:
   - Use `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Script.csv` as source of truth.
2. Add sprint tracking fields in your ticket board:
   - `Owner`, `Target Date`, `Fix PR`, `Re-test Result`, `Sign-off`.
3. Create defect log template from section 6 of the test guide.

## 5.2 Prepare test environments

1. Confirm lower environment has:
   - seeded opportunities/products/schedules,
   - deposit upload templates,
   - users for reconciler, manager, admin.
2. Confirm feature access:
   - `reconciliation.manage`,
   - `revenue-schedules.manage` and/or `opportunities.manage`.
3. Confirm job credentials for month-to-month testing:
   - `JOB_SECRET` and `x-job-secret`.

## 5.3 Build repeatable data packs

1. Pack A: Clean happy-path matching data (`TC-01`, `TC-02`, `TC-03`, `TC-04`).
2. Pack B: Bundle and mixed commission-rate scenarios (`TC-05`, `TC-06`).
3. Pack C: Flex/chargeback/undo scenarios (`TC-12`, `TC-14`, `TC-15`).
4. Pack D: Upload edge rows and onboarding sparse data (`TC-16`, `TC-17`).

Deliverable:
- A test-data index sheet with file names and expected outcomes.

---

## 6. Phase 1 - Quick Wins (Fastest Risk Reduction)

Focus on short fixes that increase likely-pass count quickly.

## 6.1 Quick win A - Ignore totals in single-vendor upload (`TC-16`)

Implementation steps:
1. Reuse totals-row helper logic currently used for multi-vendor parsing in single-vendor import path.
2. Add tests for rows containing `Total`, `Totals`, `SubTotal`, `Grand Total`.
3. Re-run `TC-16` multi-vendor and single-vendor.

Acceptance:
- Totals/subtotals are skipped consistently in both paths.

## 6.2 Quick win B - Selection carry-over across Manage tabs (`TC-11`, `TC-10`)

Implementation steps:
1. Extend preselected IDs propagation beyond status tab into rate/split (and undo where relevant).
2. Keep existing `initialStatusSelection` compatibility.
3. Validate from Opportunity -> Revenue Schedules -> Manage flow.

Acceptance:
- Selected schedules stay selected across all relevant manage actions.

## 6.3 Quick win C - Chargeback approval role alignment (`TC-14`)

Implementation steps:
1. Align approval endpoint role/permission model with business expectation for managers.
2. Confirm UI and API both allow intended approver roles.
3. Re-run manager approval and rejection paths.

Acceptance:
- Intended approver role can approve/reject without admin-only workaround.

## 6.4 Quick win D - QA script and runbook status refresh

Steps:
1. Update `Readiness`, `Risk_Reason`, `Agent Assesment` after quick wins.
2. Mark retested TCs with evidence links.

Acceptance:
- Current status is visible without manual reconciliation of notes.

---

## 7. Phase 2 - Core Workflow Hardening (P0 Closure)

## 7.1 Matching path validation (`TC-01`, `TC-03`, `TC-04`, `TC-05`)

Steps:
1. Execute full 1:1, 1:M, M:1, bundle flows from clean data.
2. Validate preview validation errors are actionable.
3. Validate grouped apply and undo consistency.

Acceptance:
- No data integrity regressions.
- Undo restores pre-apply state reliably.

## 7.2 Commission handling robustness (`TC-06`)

Steps:
1. Build scenarios with differing commission rates across schedules/products.
2. Confirm no unintended blending.
3. Confirm candidate visibility behavior and define expected rule.

Acceptance:
- Commission math is deterministic and documented.
- Any mismatch behavior is intentional and tested.

## 7.3 Undo and rollback integrity (`TC-15`)

Steps:
1. Run match-group undo and bundle undo with and without dependencies.
2. Confirm blocked conditions are correct.
3. Verify audit logs and recomputed aggregates.

Acceptance:
- Undo is safe, complete, and auditable.

## 7.4 P0 upload guardrails (`TC-16`)

Steps:
1. Validate totals row handling with real customer-like files.
2. Validate import counts and line-level data integrity.

Acceptance:
- Imported row counts match expected non-total data rows.

---

## 8. Phase 3 - Extended Workflows and Gap Closure

## 8.1 Recalculation and bulk update consistency (`TC-08`, `TC-10`)

Steps:
1. Standardize recalculation behavior for single and bulk update paths.
2. Ensure derived fields stay in sync after quantity/price/rate edits.
3. Validate audit values before/after update.

Acceptance:
- No stale expected/derived values after refresh.

## 8.2 Change Start Date feature delivery (`TC-09`)

Steps:
1. Implement Change Start Date tab in Manage modal.
2. Require reason and audit entry.
3. Support preview of shifted schedule sequence.
4. Validate single-product constraint and batch size scenarios (example 12 schedules).

Acceptance:
- Date-shift tool works and is auditable.

## 8.3 Collections/checkdown enablement (`TC-07`)

Steps:
1. Define minimum viable underpaid-to-collections action.
2. Implement route and UI action from underpaid state.
3. Add audit and status transition checks.

Acceptance:
- Underpaid schedules can enter a collections/checkdown workflow.

## 8.4 Flex lifecycle completion (`TC-12`)

Steps:
1. Validate no-match -> flex creation.
2. Validate convert/apply/bonus resolution actions.
3. Validate recurring creation path and parent-child relationships.

Acceptance:
- Flex lifecycle is consistent and supportable by ops.

## 8.5 Month-to-month reliability (`TC-13`)

Steps:
1. Validate job auth behavior and operational runbook.
2. Validate no-duplicate behavior across repeated runs.
3. Capture manual fallback process if job misses a run.

Acceptance:
- Predictable monthly schedule generation.

## 8.6 Sparse-data onboarding robustness (`TC-17`)

Steps:
1. Execute missing-opportunity, missing-product, missing-ID, mixed-quality imports.
2. Capture error clarity and routing to match/flex/manual triage.
3. Add onboarding decision tree for ops.

Acceptance:
- Sparse-data cases do not crash and produce actionable outcomes.

---

## 9. Phase 4 - Final Regression and Sign-off

## 9.1 Full regression run

1. Re-run all `TC-01` to `TC-17` in order.
2. Ensure every executed row in CSV has:
   - Pass/Fail,
   - evidence,
   - defect link (if fail).

## 9.2 Release gate criteria

Must meet:
1. No open P0 defects.
2. All must-pass TCs are Pass.
3. All known gaps have approved risk acceptance or committed fix date.

## 9.3 Sign-off checklist

1. QA sign-off.
2. Product sign-off.
3. Engineering sign-off.
4. Ops runbook sign-off.

---

## 10. Ownership Model

Recommended ownership split:

1. Engineering:
   - quick wins, feature fixes, regression bug fixes.
2. QA:
   - test execution, defect reproduction, evidence capture.
3. Product:
   - expected behavior decisions (especially commission mismatch and collections flow).
4. Ops:
   - onboarding sparse-data handling and process readiness.

---

## 11. Suggested Sequence and Timeline

## Week 1

1. Phase 0 complete.
2. Phase 1 quick wins A/B/C implemented and retested.
3. Start Phase 2 matching + undo hardening.

## Week 2

1. Complete Phase 2 P0 closure.
2. Execute high-priority Phase 3 items (`TC-08`, `TC-09`, `TC-10`, `TC-07`).
3. Run first full regression.

## Week 3 (if needed)

1. Remaining Phase 3 items (`TC-12`, `TC-13`, `TC-17`) polish.
2. Final regression + sign-off.

---

## 12. Risk Register and Mitigation

1. Permission mismatch on approvals:
   - Mitigation: lock role matrix early and test with real role assignments.
2. Hidden data integrity drift in recalculation:
   - Mitigation: add before/after financial assertions in tests.
3. Upload parsing edge-case regressions:
   - Mitigation: maintain a fixed file corpus with expected row counts.
4. Ambiguous product/rate behavior in bundle:
   - Mitigation: define explicit business rules and encode in acceptance tests.

---

## 13. Deliverables

1. Updated CSV script with final results:
   - `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Script.csv`
2. Defect log with severity and owner.
3. Updated runbook notes for operational workflows.
4. Release recommendation memo (go/no-go).

---

## 14. Immediate Next Actions (Start Here)

1. Assign owners to `TC-01` through `TC-17`.
2. Execute quick wins A/B/C.
3. Re-run `TC-14`, `TC-16`, `TC-11`, `TC-10`.
4. Update CSV evidence and readiness fields.
5. Start P0 hardening execution in Phase 2.

