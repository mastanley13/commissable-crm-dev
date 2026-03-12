# March 2026 Client Specs vs Current Application

Date: 2026-03-12

## Purpose

This document compares the client-provided March 2026 specification set against the application's current implemented workflow and internal documentation. The intent is to identify:

- where the platform already meets or substantially meets the requested behavior
- where the current workflow is only partially aligned
- where there are clear gaps, inconsistencies, or documentation drift

## Scope Reviewed

### Client-provided March 2026 specs

- `docs/specs/March_2026_Specs/2026-03-03 - Commissable - 1 to Many Reconciliation Logic.docx.md`
- `docs/specs/March_2026_Specs/2026-03-03 - Commissable - 2-1 Matching Logic.docx.md`
- `docs/specs/March_2026_Specs/2026-03-03 - Commissable - Handling Flex issues.docx.md`
- `docs/specs/March_2026_Specs/2026-03-03 - Commissable - Opp Product Manage Schedules Popup.docx.md`
- `docs/specs/March_2026_Specs/2026-03-03 - Commissable - Product Bible Overview.docx.md`
- `docs/specs/March_2026_Specs/2026-03-03 - Commissable - Unmatching Rev Schedules.docx.md`

### Current-state application sources reviewed

- Internal workflow and guide docs
- Reconciliation UI components
- Revenue schedule management UI
- Reconciliation, flex, unmatch, and bulk-edit API routes
- Supporting reconciliation/flex libraries
- Prisma schema for current data model
- Integration tests covering reconciliation, bundle replacement, unmatch, AI adjustment, flex, and revenue-schedule bulk actions

## Executive Summary

The current application is materially more capable than a basic reconciliation tool and already covers a large portion of the client's requested March 2026 direction. The strongest alignment is in bundle and multi-line reconciliation, flex/dispute handling, rollback/unmatch controls, and overall module coverage described in the Product Bible. The weakest alignment is in the client's proposed 1-to-many intelligence model, where the platform currently solves allocation and matching but does not yet implement the deeper "learn the split / restructure future schedules / propagate metadata everywhere" workflow requested in the spec.

From a project management perspective, the platform is not missing the reconciliation foundation. The main issue is not absence of capability; it is inconsistency between:

- client-requested workflow design vs current user experience
- current code behavior vs older internal docs
- reconciliation data governance requested by the client vs the narrower fields the app updates today

## Overall Assessment Matrix

| Client Spec | Current Alignment | PM Assessment | Summary |
| --- | --- | --- | --- |
| 2-1 Matching Logic | High | Mostly aligned | Strong current implementation with bundle replacement and undo; a few workflow and rate-normalization differences remain. |
| Handling Flex issues | Medium-High | Partially aligned | Core overage/rate discrepancy flow exists and is robust, but some requested options and data-write rules do not match exactly. |
| Unmatching Rev Schedules | Medium-High | Partially aligned | Rollback engine is strong, but not as universal or workflow-identical as the client spec describes. |
| Product Bible Overview | Medium | Broadly aligned | Major modules and reconciliation lifecycle exist, but terminology/state model differs from the spec. |
| Opp Product Manage Schedules Popup | Medium-Low | Partially aligned | Functional coverage exists, but the modal structure and operator workflow differ materially from the client design. |
| 1 to Many Reconciliation Logic | Low | Major gap | Matching/allocation exists, but the requested intelligent breakdown, future learning, and product consolidation logic is not implemented. |

## Detailed Comparison

## 1) 2-1 Matching Logic

### Client expectation

The client spec describes a workflow where multiple upload lines can map into a single product/schedule construct, including support for:

- same-rate combinations
- mixed-rate combinations
- replacement of legacy schedules/products when rate structures differ
- safe approval and rollback behavior

### Current application behavior

Current implementation is strong in this area.

- The reconciliation match wizard supports non-1:1 matching, including many-to-one scenarios.
- Bundle rip-and-replace logic exists for mixed-rate conditions.
- Current APIs support apply and undo flows for grouped matches and bundle replacement.
- Integration coverage exists for same-path safety, mixed-rate replacement, and undo behavior.

### Where the app meets expectations

- Multi-line to single-target reconciliation is already supported.
- Mixed-rate scenarios are not ignored; they are explicitly handled through replacement logic.
- Undo/rollback is implemented and tested.
- The workflow includes validation to prevent unsafe duplicate application or reuse of already matched lines.

### Gaps / inconsistencies

- The current flow is wizard-based rather than matching the exact approval modal described by the client.
- Authorization is implemented as reconciliation-management access rather than a clearly distinct manager-only undo pattern.
- The current rate comparison appears stricter than the spec intent. Nearly identical normalized rates can still be treated as mixed-rate, which can trigger unnecessary replacement handling.

### PM assessment

This is one of the best-aligned March specs. The platform already solves the operational problem. Remaining work is refinement work:

- reduce false mixed-rate positives
- align approval UX to the client's preferred presentation
- confirm intended role permissions for apply vs undo

## 2) 1 to Many Reconciliation Logic

### Client expectation

The client spec is more ambitious than a normal 1:M match. It describes a workflow that should:

- detect when one payment line actually contains multiple product components
- infer or preserve the per-product split
- update related revenue schedules accordingly
- learn the ratio for future use
- potentially consolidate or restructure products/schedules to make future reconciliation cleaner
- push metadata across linked schedules and related records

### Current application behavior

The application does support one-to-many reconciliation as an allocation exercise, but not at the deeper operational intelligence level the client requests.

- The match wizard can apply non-1:1 grouped matching.
- Grouped apply/undo behavior exists.
- Some autofill of missing identifiers and product fields occurs.

### Where the app meets expectations

- The platform can reconcile one line against multiple targets.
- Match grouping and rollback are already in place.
- The platform can backfill certain missing identifiers when data is blank.

### Gaps / inconsistencies

- No evidence that the app automatically inspects a lump-sum line and derives a product-by-product breakdown.
- No implemented "learned ratio" or reusable future split logic was found.
- No implemented "Case 3" style consolidation/restructure flow was found for turning multiple products into a cleaner future-state shape.
- Metadata propagation is narrow. Current autofill updates selected vendor/opportunity/product fields when blank, but does not match the broad writeback requested in the client spec.
- No clear evidence was found of account-level MRC/ARR persistence updates or opportunity-product actual-billed writeback in the way the spec describes.

### PM assessment

This is the largest gap in the March spec set. The current platform handles the accounting outcome, but not the client's proposed operating model for future-proofing that outcome. If this spec is a priority, it should be treated as a net-new enhancement stream rather than a minor extension of the existing wizard.

## 3) Handling Flex issues

### Client expectation

The client spec expects a guided workflow for handling:

- usage overages
- commission-rate discrepancies
- current-period only vs broader update choices
- future-impact visibility
- controlled approval and dispute handling

The spec also places constraints on how values should be written back, including a clear preference not to use certain adjustment fields.

### Current application behavior

Current implementation is substantial and already more mature than a placeholder design.

- A unified alert modal exists with separate issue treatment paths.
- The user can inspect selected deposit lines, matched schedules, and summaries before acting.
- For rate discrepancies, the app supports current-only and current-plus-future actions.
- For overage, the app supports an "absorb into price" workflow.
- Flex lifecycle support exists beyond the March spec, including apply-to-existing, convert-to-regular, and bonus-commission style handling.
- Billing status governance exists in the data model and application logic.

### Where the app meets expectations

- Overage and commission-rate issues are surfaced in a guided modal.
- Operator choice is explicit; options do not auto-fire on selection.
- Future schedule impact can be incorporated into rate-discrepancy resolution.
- Billing/dispute state is represented in the current application.
- Flex-specific lifecycle handling is already implemented in the platform.

### Gaps / inconsistencies

- The spec requests an "all for product" style rate update option across a broader set of records than the current UI/action pair exposes.
- The future-impacted data presentation does not exactly match the client's requested expanded-table UX.
- The client spec says certain adjustment fields should never be written. Current implementation still uses adjustment-oriented fields in some reconciliation flows, even though the overage path also updates price/expected values directly.
- Flex naming conventions do not match the client naming format.
- Chargeback/flex approval is currently tied to an admin-only route rather than a generic manager-level approval model.

### PM assessment

This area is functionally strong. The gap is mainly one of policy alignment and data-governance detail, not absence of workflow. The application can support the business process today, but it does not yet conform tightly enough to the client's requested rules for writeback scope, naming, and option coverage.

## 4) Opp Product Manage Schedules Popup

### Client expectation

The client spec proposes a more guided popup for schedule management with a specific interaction model:

- clear action grouping
- single source schedule selection context
- preview-first changes
- row-level control inside preview tables
- a smaller, curated action set

### Current application behavior

The current modal already supports a broad set of revenue schedule maintenance actions:

- create schedules
- change commission rate
- change commission split
- change start date
- deactivate/delete
- remove allocation

Selection can carry into the modal from the opportunity details view, and the bulk-edit routes are implemented.

### Where the app meets expectations

- The platform already includes the core maintenance actions requested by the client, plus additional capabilities.
- Change Start Date is implemented in code and covered by tests.
- Multi-schedule selection and bulk action handling are present.

### Gaps / inconsistencies

- The current UI structure does not match the client's proposed left-panel, workflow-driven popup design.
- The modal is tab-centric and broader than the streamlined four-action concept in the spec.
- The current experience is not consistently preview-first.
- The workflow is not clearly anchored to a single selected source schedule the way the spec describes.
- No clear Select All support was found in the current selection table.
- Row-level include/exclude control exists through selection tables, but not in the exact embedded preview-table pattern requested by the client.
- UI copy appears inconsistent with backend behavior in the rate-change flow. The interface suggests an underlying product rate update, while the route updates selected schedules.

### PM assessment

This is a partial fit. Functionally, the platform is ahead of the spec in breadth. From a UX and operator-guidance standpoint, it is behind the client's requested design. This should be treated as a workflow redesign and copy/governance cleanup rather than a pure feature build.

## 5) Unmatching Rev Schedules

### Client expectation

The client spec expects unmatching to function as a broad and dependable rollback capability, including reversal of prior updates made during reconciliation and restoration of affected records to their prior state.

### Current application behavior

Current implementation is strong and test-backed.

- A shared unmatch reversal engine exists.
- Undo logs record field changes and created entities for reversal.
- Match-group undo and line-level unmatch are both implemented.
- Tests cover regression-sensitive scenarios including adjustments, future propagation, flex cleanup, and finalized-deposit blocking.

### Where the app meets expectations

- Rollback is not manual; it is systematized.
- Reconciliation-created artifacts can be cleaned up.
- Related schedule and match state is recomputed after unmatch.
- The platform protects finalized deposits from casual unmatch operations.

### Gaps / inconsistencies

- The undo model is robust but not universal. It depends on mutation paths that explicitly record undo information, rather than a universal field-level snapshot of every touched entity.
- Product rollback appears limited to the fields the current autofill process updates.
- No evidence was found of the full account-level metric rollback envisioned by the client spec.
- The client spec implies unmatch may itself drive a finalized upload back to unreconciled. Current workflow instead blocks unmatch until the deposit is explicitly unfinalized.

### PM assessment

The current platform already provides a credible rollback framework. The gap is scope and workflow semantics, not reliability. If the client expects "unmatch reverses everything everywhere automatically," the current implementation will need a broader rollback contract and clearer operator rules.

## 6) Product Bible Overview

### Client expectation

The Product Bible is a broad platform overview covering modules, entities, reconciliation state, and operational behavior across the CRM/reconciliation product.

### Current application behavior

The application broadly aligns at the module level.

- The major dashboard/application areas described by the Product Bible exist.
- Reconciliation list/detail/finalize/flex-review flows exist.
- Opportunity, product, account, reporting, and revenue schedule areas exist.
- Billing status and reconciliation status constructs exist in the current data model and workflows.

### Where the app meets expectations

- The application covers the broad product surface the client describes.
- Reconciliation is a first-class workflow, not a side feature.
- Current implementation supports a real operational lifecycle with matching, exception handling, finalize/unfinalize controls, and auditability.

### Gaps / inconsistencies

- The Product Bible uses a simpler terminology/state model than the current application actually uses.
- The current platform spreads state across multiple status concepts, including billing status, revenue schedule status, deposit line status, and finalization state.
- Internal descriptions of "AI matching" can be misleading. Current matching is deterministic and rules-based rather than autonomous machine learning.
- Finalization behavior is more nuanced than a simple "all reconciled" model. The application blocks on certain unresolved conditions but uses its own line-status logic.

### PM assessment

At a product-portfolio level, the app is aligned. At an operating-definition level, the current platform has evolved into a more nuanced state machine than the Product Bible suggests. The platform should not be measured against this spec purely by terminology; however, the terminology mismatch will create confusion unless documentation is normalized.

## Cross-Cutting Findings

## 1) The application is stronger than some internal docs suggest

Notable examples:

- The current codebase supports Change Start Date in the revenue schedule management modal, but at least one internal runbook still states it is not implemented.
- Current overage handling uses a direct absorb-overage action path, while older internal reconciliation documentation still references different adjustment-oriented flows.

Project implication: documentation lag is now a delivery risk. Stakeholders could conclude the product is missing capabilities that already exist.

## 2) The biggest gaps are workflow semantics, not basic reconciliation capability

The platform already has:

- grouped matching
- undo logic
- mixed-rate handling
- flex/dispute workflows
- bulk schedule actions

The largest remaining gaps are:

- learned future behavior for 1:M scenarios
- exact operator experience requested by the client
- consistent writeback rules and nomenclature

## 3) Current terminology needs normalization

Several concepts are close in intent but inconsistent in name or state expression:

- flex vs dispute vs billing status
- AI adjustment vs absorb-overage
- product-level rate change vs selected-schedule rate change
- finalized deposit behavior vs reversible unmatch expectations

Project implication: even where functionality exists, inconsistent language increases training cost and makes acceptance review harder.

## Internal Documentation Drift

The review found meaningful drift between current implementation and parts of the written internal workflow.

### Confirmed drift points

- `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Script.csv` says Change Start Date is not implemented, but the feature exists in the current modal and has integration coverage.
- `docs/guides/reconciliation.md` still reflects older overage/adjustment framing that does not fully match the current detail-view workflow.

### PM assessment

This is important. Some apparent "gaps" are actually documentation lag rather than product deficiency. Before using the current internal docs as the system-of-record for client acceptance, they should be refreshed against live code behavior.

## Priority Recommendations

## Priority 1: Clarify the target operating model for 1:M reconciliation

Decision needed:

- Is 1:M meant to remain a guided allocation tool?
- Or does the client expect the system to learn and normalize future schedule structure automatically?

If the second answer is yes, this should become a dedicated product initiative with explicit data-model, matching-rule, and UX scope.

## Priority 2: Normalize the current revenue-schedule management workflow

Recommended actions:

- align UI copy with actual backend behavior
- decide whether the client's popup design should replace the current modal structure
- make preview/selection behavior more consistent across tabs

## Priority 3: Tighten flex and discrepancy governance

Recommended actions:

- confirm the intended writeback policy for adjustments vs direct expected values
- confirm whether product-wide historical updates are required for rate discrepancies
- confirm final naming and approval-role policy for flex/chargeback records

## Priority 4: Refresh internal documentation before formal gap sign-off

Recommended actions:

- update internal guides to reflect current implementation
- distinguish implemented behavior from proposed future behavior
- use the refreshed docs as the baseline for client acceptance conversations

## Recommended Delivery Framing

If this comparison is used for stakeholder review, the cleanest framing is:

- "Implemented and largely aligned": 2-1 Matching Logic, core flex handling, unmatch rollback, broad Product Bible coverage
- "Implemented but workflow-divergent": Manage Schedules Popup, parts of Product Bible terminology
- "Partially implemented with material functional gaps": 1 to Many Reconciliation Logic
- "Documentation needs refresh": current internal workflow guides and test scripts

## Bottom Line

The current application already satisfies much of the client's March 2026 direction at the reconciliation engine level. The largest shortfall is not general reconciliation capability; it is the absence of the client's more advanced 1:M automation model and several UX/governance mismatches around schedule management and flex handling. A second major issue is documentation drift: parts of the internal written workflow understate or misdescribe what the application currently does.

From a senior project management standpoint, the product is closer to compliance than the March spec set might initially suggest, but it is not yet cleanly aligned enough to claim full conformance without:

- a defined 1:M roadmap decision
- UX and terminology cleanup
- targeted policy decisions on writeback and approval governance
- documentation refresh against live behavior
