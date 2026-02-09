# Strategix Hunter Program Plan v2

Date: 2026-02-09
Owner: Hunter (engineering lead) with cross-functional inputs from Rob and Mykel
Primary source artifacts:
- `docs/plans/strategix_hunter_plan_of_attack.md`
- `docs/plans/strategix_hunter_ticket_checklist.csv`

## Purpose of this document

This document is the execution-grade version of the Strategix Hunter plan. It is intentionally longer and more operational than the original notes.

It answers:
1. Where we are now (implemented, partial, open, blocked).
2. What is inconsistent between stated objectives and current implementation.
3. What must ship first to reduce business risk.
4. Exactly how we will execute, validate, and close each ticket.

## Program objective

Primary objective:
- Unblock end-to-end reconciliation validation (1:1, 1:M, M:1, flex, chargeback) without introducing data integrity regressions.

Program-level success criteria:
1. P0 correctness tickets are either complete or explicitly deferred with written decision and owner.
2. Test environment is resettable and repeatable for UAT cycles.
3. Reconciliation and schedule workflows behave deterministically across timezone and bulk-edit scenarios.
4. Stakeholder deliverables (Propagation/Undo writeup, CloudBot one-pager, migration pre-work) are produced and approved.

## Current state snapshot (as of 2026-02-09)

## What is moving

1. Multi-vendor template resolution has active implementation momentum.
2. Floating vendor summary widget has active implementation momentum.
3. Flex Review Queue entry point exists on the reconciliation list page.
4. Opportunity view already reuses inline bulk apply panel behavior.

## What is not moving enough

1. P0 data integrity tickets are still open (bulk recalculation, date normalization full coverage, product schedule date backfill).
2. Strategix-required documentation deliverables are not complete.
3. Some accepted wording in tickets does not match current implementation direction (notably multi-vendor vendor filter vs merged-template preview model).

## Program health assessment

Program health: Yellow

Why Yellow:
- Good progress on UX-heavy P1 workstreams.
- Insufficient closure on P0 correctness and governance deliverables.
- External dependency queue (Rob assets) is unresolved and blocks final validation.

## Ticket status baseline

Status legend:
- Done: implemented and reviewed.
- In Progress: active implementation exists, not fully accepted.
- Partial: some implementation exists, acceptance still incomplete.
- Open: not materially implemented yet.
- Blocked: cannot complete without external dependency.

| Ticket | Priority | Status | Evidence summary | Primary gap |
|---|---|---|---|---|
| CRM-DATA-RESET | P0 | Open | No dedicated reset script/runbook found for deposit-domain data reset. | Build deterministic reset procedure with safety guards. |
| CRM-RS-BULK-RECALC | P0 | Open | `app/api/revenue-schedules/bulk-update/route.ts` updates source fields but does not apply full dependency recalculation contract. | Add server-side recalculation coverage for dependent fields. |
| CRM-RS-DATE-TZ | P0 | Partial | Month-start normalization exists in some schedule APIs. | Full create/clone/edit parity and explicit timezone contract not complete. |
| CRM-PROD-DATES-BACKFILL | P0 | Open | Product helper still has TODO-style derived schedule-date fields (`null`). | Implement first/last schedule derivation or migration strategy. |
| CRM-RS-DETAIL-FIELDS | P0 | Partial | Revenue Type display is present from product context. | House Rep required rule, Subagent default, exact field ordering still need confirmation/implementation. |
| CRM-RS-INLINE-EDIT-POPUP | P0 | Partial | Bulk apply panel exists in revenue and opportunity views. | Effective date default behavior and old/new comparison UX are incomplete. |
| CRM-OPP-INLINE-EDIT-MACRO | P1 | Done | Opportunity view uses the shared `RevenueBulkApplyPanel` pattern. | Validate parity details and message copy. |
| CRM-MV-VENDOR-FILTER | P1 | Open (scope drift) | Multi-vendor preview is merged-template oriented; no explicit per-vendor filter in mapping step. | Confirm intent replacement or implement per-vendor filter. |
| CRM-MV-SAVE-TEMPLATE-PROMPT | P1 | Open | No beforeunload or route transition unsaved-mapping prompt found. | Add navigation guard and save reminder flow. |
| CRM-MV-NEW-FIELDS-LAYOUT | P1 | Partial | Mapping step UI now includes stronger template summary context. | Vendor filter + save prompt portions still missing. |
| CRM-REC-VENDOR-SUMMARY-WIDGET | P1 | In Progress | Floating widget + enhanced summary metrics are actively implemented. | Cross-device UX validation and mock alignment still pending. |
| CRM-REC-FLEX-CHARGEBACKS-BUTTON | P1 | Done | Reconciliation list includes `Flex Review Queue` button. | Confirm naming and user expectation alignment. |
| CRM-REC-FLEX-UI-REFINE | P1 | Open | Flex review page exists but lacks requested expected/actual/delta + related schedule presentation model. | Implement table refinement and visual state cues. |
| CRM-REC-BACK-BUTTON-FIX | P2 | Partial | Multiple back actions exist in reconciliation/deposit flows. | Confirm all previously broken pathways now resolve correctly. |
| CRM-REC-MATCH-SEEDS-DETAIL | P2 | Open | No clear criteria-hit detail presentation found for Match Seeds indicator. | Add explainable criteria signal UX. |
| CRM-REC-APPLY-PREVIEW-HIGHLIGHT | P2 | Open | No clear pre-apply highlight preview model found in current reconciliation view. | Add populate-before-apply and visual highlight behavior. |
| CRM-DOC-PROPAGATION-UNDO | P0 | Open | No Strategix-specific propagation/undo writeup available. | Draft full mutation and rollback matrix. |
| CRM-PDF-VALIDATION | P1 | Partial/Blocked | PDF parser is implemented and tested. | Real sample PDF + matching opportunity validation still pending. |
| CLOUDBOT-ONEPAGER | P0 | Open | No one-page CloudBot scope/security/deployment artifact yet. | Produce and review one-page briefing. |
| MIGRATION-PREWORK | P1 | Open | No dedicated migration pre-work packet found. | Create cold start vs full vs hybrid decision packet. |
| ROB-TEST-DATA | P0 | Blocked | Client-owned deliverable. | Obtain targeted datasets for UAT matrix. |
| ROB-PDF-SAMPLE | P1 | Blocked | Client-owned deliverable. | Obtain PDF sample plus matching opportunity setup. |
| ROB-MULTIVENDOR-SAMPLE | P1 | Blocked | Client-owned deliverable. | Obtain realistic multi-vendor sample for scale behavior validation. |
| ROB-WIDGET-MOCKUP | P1 | Blocked | Client-owned deliverable. | Obtain final widget layout preference to prevent rework. |

## Core inconsistencies and why they matter

## Inconsistency 1: Priority drift (P1 execution vs P0 risk)

Observation:
- Most active changes are P1 workflow/UX while highest-risk P0 correctness issues are still unresolved.

Risk:
- UAT may pass in happy-path UI but fail in accounting-grade data consistency checks.

Control:
- Re-sequence work so P0 integrity items are on critical path before additional UX polish.

## Inconsistency 2: Requirement drift in multi-vendor mapping

Observation:
- Ticket language asks for per-vendor filter in mapping.
- Current implementation trend is merged-template preview without explicit per-vendor mapping filter.

Risk:
- Functional mismatch at signoff even if engineering implementation is technically strong.

Control:
- Decision gate with Rob: replacement accepted vs filter still required.
- Record decision in writing before final implementation.

## Inconsistency 3: Implementation complete vs acceptance complete

Observation:
- PDF parser and tests exist, but ticket requires real-file business validation.

Risk:
- "done in code" but "not done operationally".

Control:
- Treat sample-file UAT evidence as mandatory closure artifact.

## Inconsistency 4: Documentation lag

Observation:
- P0 strategic docs expected by stakeholders are not delivered.

Risk:
- Loss of decision velocity and lower trust during migration/security discussions.

Control:
- Timebox and deliver docs in parallel with P0 engineering work.

## Critical path and sequence

Critical path items (cannot slip without downstream impact):
1. CRM-RS-BULK-RECALC
2. CRM-RS-DATE-TZ
3. CRM-PROD-DATES-BACKFILL
4. CRM-DATA-RESET
5. CRM-DOC-PROPAGATION-UNDO

Secondary path (important but not first blockers):
1. CRM-MV-VENDOR-FILTER / SAVE-TEMPLATE-PROMPT / NEW-FIELDS-LAYOUT
2. CRM-REC-VENDOR-SUMMARY-WIDGET
3. CRM-REC-FLEX-UI-REFINE
4. CRM-PDF-VALIDATION (blocked by assets)
5. MIGRATION-PREWORK

## Delivery phases with date anchors

Important fixed date in source material:
- Migration planning session: Thursday, February 19, 2026 at 12:00 PM.

Phase layout:

### Phase 0 (2026-02-09 to 2026-02-10): Program control setup

Goals:
- Freeze scope interpretation.
- Lock sequencing and owners.

Deliverables:
1. Decision log for multi-vendor filter interpretation.
2. Ticket board updated with statuses from this document.
3. External dependency request package sent to Rob (datasets, PDF, widget mock).

### Phase 1 (2026-02-10 to 2026-02-13): P0 data integrity sprint

Goals:
- Eliminate highest correctness risk.

Deliverables:
1. CRM-DATA-RESET implementation + runbook.
2. CRM-RS-BULK-RECALC implementation + tests.
3. CRM-RS-DATE-TZ normalization completion across create/clone/edit.
4. CRM-PROD-DATES-BACKFILL strategy implemented.

### Phase 2 (2026-02-13 to 2026-02-16): P1 in-progress stabilization

Goals:
- Convert current in-progress UX work into accepted work.

Deliverables:
1. Multi-vendor mapping acceptance closure (filter decision implemented).
2. Save-template prompt added if still required.
3. Vendor summary widget behavior validated and finalized.

### Phase 3 (2026-02-16 to 2026-02-18): Docs and migration readiness

Goals:
- Complete stakeholder artifacts before migration meeting.

Deliverables:
1. CRM-DOC-PROPAGATION-UNDO document.
2. CLOUDBOT-ONEPAGER.
3. MIGRATION-PREWORK packet for cold start/full/hybrid scenarios.

### Phase 4 (post-Feb-19, unless dependencies arrive earlier): Validation closure and P2 polish

Goals:
- Execute real sample validations and close remaining UX polish tickets.

Deliverables:
1. CRM-PDF-VALIDATION closure evidence.
2. Match seeds and apply preview highlight refinement.
3. Back-button full route matrix verification.

## Workstream execution details

## Workstream A: Data reset and test hygiene (P0)

Ticket: CRM-DATA-RESET

Scope:
- Reset only deposit-domain entities required for reconciliation testing.

Implementation checklist:
1. Define entity list and deletion order (matches, line items, deposits, dependent summaries).
2. Add tenant-scoped, environment-guarded reset script with dry-run flag.
3. Add optional report output: rows deleted by table.
4. Add runbook: when to run, who can run, post-run validation steps.

Acceptance criteria:
1. Reset can be executed repeatedly without orphan records.
2. Reset does not touch non-target domain data.
3. Reset operation logs are auditable.

Validation:
- Run reset twice in a row and verify second run is no-op equivalent.

## Workstream B: Revenue schedule correctness (P0)

### Ticket: CRM-RS-BULK-RECALC

Problem:
- Bulk edits mutate source fields without guaranteed recalculation of all dependent financial fields.

Implementation approach:
1. Define canonical recalculation service contract:
   - Inputs: quantity, priceEach, usageAdjustment, commissionRatePercent, expectedCommissionAdjustment.
   - Outputs: expectedUsageGross/Net, expectedCommissionGross/Net, and any persisted dependent fields.
2. Invoke the same recalculation path from:
   - Single schedule PATCH route.
   - Bulk update route.
   - Any rate/split bulk endpoints where dependency applies.
3. Add audit payload expansion:
   - Previous values and new values for computed fields when changed.

Acceptance criteria:
1. Price Each bulk update updates all affected computed fields for all selected schedules.
2. Results match single-record edit calculations.
3. Audit records include changed computed values.

Tests required:
1. Unit tests for recalculation service with edge values.
2. API integration tests for `/api/revenue-schedules/bulk-update`.
3. Regression test proving no stale computed fields after bulk edit.

### Ticket: CRM-RS-DATE-TZ

Problem:
- Date handling is partially normalized; schedule creation still has potential timezone drift.

Implementation approach:
1. Centralize schedule-date normalization utility for all schedule create/clone/edit write paths.
2. Normalize to month-start contract consistently.
3. Confirm whether "8am ET" is storage-level requirement or presentation-level requirement; document chosen contract.
4. Ensure API response serialization for date-only fields does not reintroduce local-time drift.

Acceptance criteria:
1. All newly created/edited schedules resolve to first-of-month consistently.
2. No DST-related day-shift in US timezones.
3. Clone and create behavior match.

Tests required:
1. Unit tests around month boundaries and DST periods.
2. API tests for create, clone, and patch scheduleDate behavior.

### Ticket: CRM-PROD-DATES-BACKFILL

Problem:
- First/last schedule date for products is not reliably exposed for existing records.

Decision needed:
- Query-time derivation vs persisted columns with migration backfill.

Recommended approach:
1. Implement query-time derivation immediately (fast correctness).
2. Optional follow-up persisted optimization only if performance requires it.

Acceptance criteria:
1. Product lists/details show first and last schedule dates correctly for legacy and new data.
2. No null-only behavior where schedules exist.

Tests required:
1. API tests for product list/detail with seeded historical schedules.
2. Performance sanity check on representative product volume.

## Workstream C: Revenue schedule detail and inline UX (P0/P1)

### Ticket: CRM-RS-DETAIL-FIELDS

Remaining closure checklist:
1. Confirm and enforce House Rep required behavior on relevant create/edit forms.
2. Ensure Subagent default display/value contract is explicit (None or N/A).
3. Verify field ordering aligns to Rob's requested sequence.

Acceptance criteria:
1. Revenue Type always comes from allowed product context.
2. House Rep is required where requested.
3. Subagent default is deterministic.

### Ticket: CRM-RS-INLINE-EDIT-POPUP

Remaining closure checklist:
1. Effective date default should follow "oldest selected schedule" rule (if confirmed).
2. Add old/new value compare text in bulk apply confirmation surface.
3. Update success/error copy to explicit action context.

Acceptance criteria:
1. Default effective date is correct by business rule.
2. User sees old and new values before commit.
3. Notifications clearly state what changed and where.

### Ticket: CRM-OPP-INLINE-EDIT-MACRO

Status: done in implementation pattern.

Closure tasks:
1. Verify field parity between revenue schedules and opportunity view.
2. Verify formatting parity (currency and percent display).

## Workstream D: Multi-vendor mapping and deposit upload UX (P1)

### Ticket cluster
- CRM-MV-VENDOR-FILTER
- CRM-MV-SAVE-TEMPLATE-PROMPT
- CRM-MV-NEW-FIELDS-LAYOUT

Current implementation trend:
- Shared resolver + preview endpoint + merged template config model.

Decision gate:
1. If Rob accepts merged-template summary as replacement:
   - update ticket interpretation and close vendor-filter requirement by signed decision.
2. If Rob still requires per-vendor filter mapping:
   - add explicit UI filter and vendor-scoped mapping context in step 2.

Execution checklist:
1. Keep preview/import resolver logic shared and deterministic.
2. Add unsaved mapping navigation guard.
3. Ensure layout sequence matches requested tab and section ordering.
4. Extend tests for missing vendors/missing templates/guard behavior.

Acceptance criteria:
1. User can complete multi-vendor mapping at scale without losing changes.
2. Template selection behavior is deterministic and visible before import.
3. Continue/import is blocked when unresolved vendors/templates exist.

## Workstream E: Reconciliation UI improvements (P1/P2)

### Ticket: CRM-REC-VENDOR-SUMMARY-WIDGET

Current state:
- Floating widget with drag/resize implemented and integrated.

Closure checklist:
1. Confirm widget behavior at small and large viewport sizes.
2. Verify keyboard escape, focus flow, and persist-reset behavior.
3. Align final layout with Rob mock once received.

Acceptance criteria:
1. Non-blocking summary interaction.
2. Reliable vendor filter interaction from widget to table.
3. No performance degradation on larger deposits.

### Ticket: CRM-REC-FLEX-CHARGEBACKS-BUTTON

Current state:
- Entry point exists.

Closure checklist:
1. Confirm label and placement with users.
2. Verify role-based visibility if required.

### Ticket: CRM-REC-FLEX-UI-REFINE

Execution checklist:
1. Add explicit expected/actual/delta presentation.
2. Add related schedule reference column.
3. Add highlight styling rules for changed and resolved states.
4. Ensure stale queue rows clear correctly after actions.

Acceptance criteria:
1. Flex reviewers can identify variance and target schedule quickly.
2. Apply and resolve actions update UI state immediately and correctly.

### Ticket: CRM-REC-MATCH-SEEDS-DETAIL

Execution checklist:
1. Add indicator detail popover/tooltip that explains which criteria were hit.
2. Ensure explanation is deterministic and sourced from match data.

Acceptance criteria:
1. User can inspect exact criteria for "Y" indicator without guessing.

### Ticket: CRM-REC-APPLY-PREVIEW-HIGHLIGHT

Execution checklist:
1. Introduce pre-apply preview state when selecting target schedule.
2. Populate expected resulting actual usage/commission before commit.
3. Highlight previewed rows with clear visual state and revert on cancel.

Acceptance criteria:
1. Preview appears before final apply.
2. User can distinguish previewed vs committed state.

### Ticket: CRM-REC-BACK-BUTTON-FIX

Execution checklist:
1. Build route matrix for all reconciliation/deposit back paths.
2. Verify route and state restoration behavior for each path.

Acceptance criteria:
1. No broken or circular navigation paths.
2. Back action always returns user to expected context.

## Workstream F: Documentation and stakeholder deliverables (P0/P1)

### Ticket: CRM-DOC-PROPAGATION-UNDO

Document must include:
1. Data propagation scope by action:
   - deposit line match
   - schedule update
   - opportunity product changes
   - product catalog mutations
2. Undo model and boundary:
   - what is reversible automatically
   - what requires manager role
   - what is intentionally not reversed
3. Audit model:
   - required fields in audit trail
   - correlation id or match group model
4. Failure scenarios and conflict handling.

Acceptance criteria:
1. Engineering and stakeholder audience can trace mutation and rollback paths clearly.

### Ticket: CLOUDBOT-ONEPAGER

One-page structure:
1. Scope and boundaries.
2. Data classification and access model.
3. Guardrails and abuse prevention.
4. Deployment architecture and failover/DR posture.
5. Update process and ownership.
6. Retainer/support model.

Acceptance criteria:
1. Rob can evaluate privacy and resilience posture from one page.

### Ticket: MIGRATION-PREWORK

Pre-work packet sections:
1. Scenario A: cold start.
2. Scenario B: full migration.
3. Scenario C: hybrid migration.
4. Risks, cutover complexity, rollback options.
5. Recommended scenario by business constraints.

Acceptance criteria:
1. Packet is ready ahead of February 19, 2026 meeting.

## External dependency management plan

Blocked items:
- ROB-TEST-DATA
- ROB-PDF-SAMPLE
- ROB-MULTIVENDOR-SAMPLE
- ROB-WIDGET-MOCKUP

Dependency request template (send as checklist):
1. Asset requested.
2. Needed by date.
3. Why needed (ticket linkage).
4. Fallback if not provided.

Escalation rule:
- If no response in 2 business days, move blocked ticket to explicit risk register and re-sequence engineering work.

## Risk register

| Risk | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|
| P0 backlog remains open while P1 work expands | High | High | Freeze sequence to P0-first until closure | Hunter |
| Multi-vendor requirement interpretation conflict | Medium | High | Decision gate with Rob and written signoff | Hunter + Rob |
| Real-file UAT blocked by missing client assets | High | Medium | Early dependency requests + fallback synthetic validation | Hunter |
| Date normalization changes cause regressions | Medium | High | Central utility + end-to-end tests for create/clone/edit | Engineering |
| Bulk recalculation touches multiple endpoints and introduces drift | Medium | High | Shared recalculation service and cross-endpoint tests | Engineering |
| Stakeholder docs delayed and reduce decision throughput | Medium | Medium | Timebox docs in Phase 3 with explicit owners | Hunter + Mykel |

## Decision log (to maintain during execution)

Populate and update this table as decisions are made.

| Decision ID | Date | Decision | Rationale | Impacted tickets |
|---|---|---|---|---|
| D-001 | TBD | Vendor filter required vs merged-template replacement | Pending Rob alignment | CRM-MV-VENDOR-FILTER, CRM-MV-NEW-FIELDS-LAYOUT |
| D-002 | TBD | Exact schedule date storage/display contract | Needed for full timezone consistency | CRM-RS-DATE-TZ |
| D-003 | TBD | Product first/last date strategy (derived vs persisted) | Needed for implementation scope and performance | CRM-PROD-DATES-BACKFILL |
| D-004 | TBD | House Rep required surfaces and validation boundaries | Needed for RS detail closure | CRM-RS-DETAIL-FIELDS |

## Detailed acceptance test matrix

## P0 matrix

### CRM-RS-BULK-RECALC
1. Bulk update priceEach for N schedules.
2. Verify all dependent values updated for all N.
3. Compare against single-record edit results.
4. Verify audit entries include computed-field deltas.

### CRM-RS-DATE-TZ
1. Create schedules around DST transitions.
2. Clone schedules from varied source dates.
3. Patch scheduleDate directly.
4. Validate all outputs remain first-of-month per contract.

### CRM-PROD-DATES-BACKFILL
1. Seed product with old schedules.
2. Verify first and last dates shown correctly in list and detail.
3. Verify products with no schedules remain null-safe.

### CRM-DATA-RESET
1. Run dry-run and inspect report.
2. Run real reset and verify target entities removed.
3. Run again and verify idempotent behavior.

## P1 matrix

### Multi-vendor tickets
1. Upload multi-vendor file with valid vendors/templates.
2. Verify template resolution panel and block behavior for errors.
3. Verify unsaved mapping prompt behavior on navigation.
4. Verify deterministic preview/import parity.

### Vendor summary widget
1. Toggle open/close.
2. Drag and resize in desktop and narrow viewport.
3. Apply vendor filter from widget and clear filter.

### Flex UI refine
1. Validate expected/actual/delta columns.
2. Validate related schedule linking.
3. Validate highlight transitions after actions.

## Operating cadence

Daily standup focus fields:
1. P0 burn-down count.
2. Blocked dependency count.
3. Decision gates unresolved count.

Twice-weekly review artifacts:
1. Updated ticket status table.
2. Risk register changes.
3. Test pass/fail summary.
4. New/closed blocked items.

## Definition of done per ticket

A ticket is only closed when all are true:
1. Code implemented.
2. Automated or manual acceptance test evidence captured.
3. Documentation updated if ticket changes behavior or contract.
4. Stakeholder signoff completed for UX/requirement-sensitive items.

## Suggested next 10 actions (ordered)

1. Finalize decision D-001 on multi-vendor filter requirement.
2. Implement CRM-DATA-RESET script and runbook.
3. Build shared recalculation service and wire CRM-RS-BULK-RECALC.
4. Complete schedule-date normalization in create path and finalize date contract.
5. Implement CRM-PROD-DATES-BACKFILL chosen strategy.
6. Complete RS detail field validation requirements and defaults.
7. Add unsaved mapping prompt and finish multi-vendor acceptance gaps.
8. Finalize vendor summary widget after mock review.
9. Produce CRM-DOC-PROPAGATION-UNDO and CLOUDBOT-ONEPAGER.
10. Prepare and send migration pre-work packet before February 19, 2026.

## Exit criteria for this program increment

Exit criteria for this Strategix increment:
1. All P0 tickets closed or deferred with explicit signed decision.
2. All blocked dependencies either received and validated or formally escalated.
3. Test evidence repository includes P0 and high-risk P1 scenarios.
4. Stakeholder documents delivered and acknowledged.

## Appendix A: Evidence map

Code areas repeatedly referenced during analysis:
- Multi-vendor upload flow: `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
- Mapping UI: `components/deposit-upload/map-fields-step.tsx`
- Multi-vendor preview route: `app/api/reconciliation/templates/multi-vendor-preview/route.ts`
- Multi-vendor shared resolver: `lib/deposit-import/multi-vendor-template-resolver.ts`
- Import route: `app/api/reconciliation/deposits/import/route.ts`
- Vendor summary widget: `components/deposit-vendor-summary-floating-widget.tsx`
- Vendor summary table logic: `components/deposit-vendor-summary-widget.tsx`
- Vendor summary aggregation: `lib/reconciliation/vendor-summary.ts`
- Revenue schedule bulk update: `app/api/revenue-schedules/bulk-update/route.ts`
- Revenue schedule create path: `app/api/opportunities/[opportunityId]/revenue-schedules/create/route.ts`
- Revenue schedule update path: `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
- Product helper gap signal: `app/api/products/helpers.ts`
- Flex review UI: `app/(dashboard)/reconciliation/flex-review/page.tsx`
- Reconciliation list flex entry: `app/(dashboard)/reconciliation/page.tsx`

## Appendix B: Test command reference

Focused command used previously for relevant active workstreams:
- `node --import tsx --test tests/vendor-summary.test.ts tests/multi-vendor-template-resolver.test.ts tests/deposit-import-parse-pdf.test.ts`

