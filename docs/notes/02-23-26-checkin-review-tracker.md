# 02-23-26 Check-in — Implementation Tracker

Source: `docs/notes/02-23-26-checkin-review.md`  
Created: 2026-02-23  
Last updated: 2026-02-23

## How to use this tracker

- Update **Status** and **Next action** as work progresses.
- When moving an item to **Done**, add at least 1 concrete proof point in **Evidence** (file, endpoint, runbook/test case, or screenshot link).
- If an item is waiting on Rob/Mykel/etc, mark it **Blocked** and capture exactly what decision/input is needed.

## Status legend

- **Done**: implemented + verified (evidence linked)
- **Partial**: implementation exists but gaps remain (or implementation differs from requested UX/spec)
- **Open**: not implemented / not found
- **Blocked**: cannot proceed without external input (definition, assets, permissions, sample data)

---

## Now (ASAP)

| ID | Item | Owner | Related ticket | Status | Evidence | Next action | Blockers / Notes |
|---|---|---|---|---|---|---|---|
| NOW-REC-01 | “Deposit Summary” floating bar on reconciliation/deposit pages | Hunter | `CRM-REC-VENDOR-SUMMARY-WIDGET` | Partial | `components/deposit-vendor-summary-floating-widget.tsx`<br>`components/deposit-reconciliation-detail-view.tsx` | Confirm with Rob whether the draggable floating widget satisfies “floating bar”; validate narrow viewport behavior. | Waiting on Rob UX decision (bar vs widget; hide/unhide expectations). |
| NOW-REC-02 | Fix Back button behavior on reconciliation/deposit pages | Hunter | `CRM-REC-BACK-BUTTON-FIX` | Partial | `components/deposit-reconciliation-detail-view.tsx`<br>`app/(dashboard)/reconciliation/[depositId]/finalize/page.tsx` | Run a quick navigation test pass across deposit detail, finalize, AI-matching, and upload flows; document any remaining broken paths. | Gap plans disagree on “Done vs Partial” → treat as **needs verification**. |
| NOW-REC-03 | Transactions tab labeling cleanup (“Type” should be “Usage”, not “Billing”) | Hunter | — | Open | `components/revenue-schedule-supporting-details.tsx` | Decide desired taxonomy (“Billing” vs “Usage”) and update label + filters consistently. | Needs terminology confirmation (what should “Type” mean here?). |
| NOW-RS-01 | Fix revenue schedule date generation (1st of month @ ~8am ET; DST safe) | Hunter | `CRM-RS-DATE-TZ` | Partial | `lib/revenue-schedule-date-shift.ts`<br>`app/api/revenue-schedules/bulk/change-start-date/route.ts` | Define an explicit timezone/date contract (date-only vs time-anchored) and ensure create/clone/edit paths follow it; add DST-edge test coverage. | Requires written “8am ET” contract decision (and whether it is storage vs display vs job timing). |
| NOW-DATA-01 | Clear deposits + deposit line items in test environment (restart UAT cleanly) | Hunter | `CRM-DATA-RESET` | Partial | `prisma/seed.ts`<br>`app/api/reconciliation/deposits/[depositId]/route.ts` | Decide reset scope (deposit-domain-only vs full wipe); create a short runbook so Rob can request/rerun reliably. | Needs test DB access + agreement on how destructive the reset may be. |
| NOW-DATA-02 | Clean up test data (Edge/Sean duplicates, Edge address, DWReality overage values) | Hunter | — | Blocked | — | Identify exact duplicate records + desired final state; execute cleanup (admin UI or DB); document steps. | Environment-specific; needs concrete IDs/examples from Rob/test env. |
| NOW-RS-02 | Revenue Schedule UI corrections (Revenue Type rename, House Rep required, Sub-agent default, layout) | Hunter | `CRM-RS-DETAIL-FIELDS` | Partial | `docs/plans/strategix_hunter_current_state_gap_plan.md`<br>`docs/plans/gap_analysis_and_action_plan.md` | Implement “House Rep required” + Sub-agent default to “None/NA”; confirm final field ordering/layout with Rob. | Requires Rob confirmation on exact UX (required surfaces + defaults). |
| NOW-RS-03 | Bulk inline update sidebar: remove “Effective from” (always applies to selected) | Hunter | `CRM-RS-INLINE-EDIT-POPUP` | Done | `components/revenue-bulk-apply-panel.tsx`<br>`app/(dashboard)/revenue-schedules/page.tsx`<br>`components/opportunity-details-view.tsx`<br>`app/(dashboard)/products/page.tsx` | None. | “Effective from” removed by design; “Old vs new” remains. |
| NOW-FLEX-01 | Flex/Chargebacks UI tightening (expected/actual/delta labels; related schedule; highlights; clear old data) | Hunter | `CRM-REC-FLEX-UI-REFINE` | Partial | `docs/plans/strategix_hunter_current_state_gap_plan.md`<br>`app/(dashboard)/reconciliation/flex-review/page.tsx` | Add explicit Expected/Actual/Delta presentation + related-schedule prominence; add consistent highlight rules; remove stale/confusing UI elements. | None. |
| NOW-BLOCK-01 | Fix “Mass Change Start Date” bug (Feb 1 becomes June 1) | Hunter | — | Partial | `app/api/revenue-schedules/bulk/change-start-date/route.ts`<br>`components/revenue-schedule-create-modal.tsx` | Reproduce with seeded data; capture baseline/new date + delta; fix + add a regression test. | Current runbooks note TC-09 is often blocked by missing schedules/data. |
| NOW-BLOCK-02 | Fix Flex product workflow being inaccessible (likely date filter excludes past-start schedules) | Hunter | — | Open | `docs/runbooks/Flex_Product_Guide.md`<br>`app/(dashboard)/reconciliation/flex-review/page.tsx` | Reproduce and identify the specific filter/endpoint; adjust filtering so valid flex items/schedules remain accessible. | Needs a reproducible example (account, deposit, schedule IDs). |

---

## Next (sequencing + correctness)

| ID | Item | Owner | Related ticket | Status | Evidence | Next action | Blockers / Notes |
|---|---|---|---|---|---|---|---|
| NEXT-MATCH-01 | Update 1-to-many matching + schedule generation rules (remove “keep old”, replace from date, rate-mismatch blocking, create new schedules per line) | Hunter | — | Partial | `app/api/reconciliation/deposits/[depositId]/bundle-rip-replace/apply/route.ts` | Decide final rule set; remove/replace `keep_old` mode if required; add commission-rate mismatch guard; ensure bundles generate “future 1:1” schedules as specified. | Spec needs to be pinned down (replacement date semantics + allowed modes). |
| NEXT-AUDIT-01 | Add “Deactivated” + “Deleted” statuses to Revenue Schedules | Hunter | — | Open | `prisma/schema.prisma` | Decide whether this is a true status-enum change vs using `deletedAt` + existing status/billingStatus; implement with migration + UI filtering. | Requires data model decision (and backfill strategy). |
| NEXT-AUDIT-02 | Fix history logs not appearing on parent Opportunity when RS changes | Hunter | — | Open | `app/api/opportunities/[opportunityId]/revenue-schedules/create/route.ts` | Define expected behavior (“which RS actions should appear on Opportunity history”) and implement propagation/logging; add a simple acceptance check. | Needs agreement on what constitutes “history” for the Opportunity view. |
| NEXT-COLL-01 | Replace “Collections Check Down” with Collections report/list (past due balance > $0) | Hunter | — | Blocked | — | Confirm “past due” definition; implement report/list + linking into detail view. | Blocked on Rob “past due” definition (date basis + which balance field). |
| NEXT-UI-01 | Rename terminology: Usage Difference → Usage Balance Due; Commission Difference → Commission Balance Due | Hunter | — | Open | — | Update UI labels (ensure the underlying computed fields are unchanged); confirm this doesn’t break table preferences. | None. |
| NEXT-UI-02 | Matching UX polish: highlight key target fields on RS detail during matching | Hunter | — | Open | — | Identify the exact highlight states + when they apply; implement in RS detail and/or matching UI. | Needs agreed highlight rules. |
| NEXT-UI-03 | Schedule table UX polish: freeze left-hand columns for comparisons | Hunter | — | Open | — | Confirm which grid(s) need frozen columns; implement in the shared table component(s). | None. |
| NEXT-UNDO-01 | Admin-only “Delete Deposit” macro that unmatches all lines before delete | Hunter | — | Partial | `app/api/reconciliation/deposits/[depositId]/route.ts` | Confirm desired permission model (“admin-only” vs `reconciliation.manage`); ensure UI uses the safe delete endpoint everywhere. | Clarify permission requirement. |
| NEXT-UNDO-02 | Map downstream effects of key actions (delete account/opportunity/etc.) for undo consistency | Hunter | — | Done | `docs/guides/entity-lifecycle-deletion-deactivation.md`<br>`lib/deletion.ts` | Keep the doc current as new delete/undo behaviors ship; link to it from runbooks where relevant. | Doc file currently exists in the workspace; ensure it remains the source of truth. |

---

## Next (data migration enablement)

| ID | Item | Owner | Related ticket | Status | Evidence | Next action | Blockers / Notes |
|---|---|---|---|---|---|---|---|
| MIG-01 | Self-uploaders in Settings for Accounts / Contacts / Opportunities | Hunter | — | Open | — | Define accepted CSV formats + validation rules; implement import UI + backend; add duplicate-prevention + dry-run preview. | Needs agreed import templates + required fields. |
| MIG-02 | Migration order + handling plan (Accounts, Contacts, Opportunities, Products, Schedules) | Hunter | `MIGRATION-PREWORK` | Open | `docs/plans/strategix_hunter_current_state_gap_plan.md` | Draft a single “load order + partial data rules” doc and review with Rob. | Depends on duplicate detection keys + missing-field derivation rules. |
| MIG-03 | Duplicate checks before creating new Opps/Products/Revenue Schedules | Hunter | — | Blocked | — | Define match keys (external IDs vs composite keys); implement create-time guards + clear UX errors. | Blocked on Rob’s duplicate detection rules (“what counts as duplicate”). |
| MIG-04 | Data-derivation guidance for missing fields | Hunter | — | Open | — | Draft guidance (what can be inferred vs must be provided); align with importer validations. | None (but should be aligned with MIG-01/MIG-03). |

---

## Next (CloudBot / AI deliverables)

| ID | Item | Owner | Related ticket | Status | Evidence | Next action | Blockers / Notes |
|---|---|---|---|---|---|---|---|
| AI-01 | CloudBot scoping document (security, deployment, capabilities) | Mykel | `CLOUDBOT-ONEPAGER` | Open | `docs/plans/strategix_hunter_current_state_gap_plan.md` | Produce the doc; circulate for Rob signoff. | Owned by Mykel per checklist; blocks Rob proceeding. |
| AI-02 | Email Rob a CloudBot one-pager (scope/security/deployment, DR/failover, access controls, updates, reuse, retainer framing) | Mykel | `CLOUDBOT-ONEPAGER` | Open | — | Send the briefing once AI-01 exists (or make AI-01 itself the one-pager). | Requires Mykel completion. |
| AI-03 | Deeper security audit after reconciliation checkpoint (agents + review) | Hunter/Mykel | — | Open | — | Define audit scope + timeline; schedule after reconciliation checkpoint is accepted. | Depends on reaching reconciliation checkpoint acceptance. |

---

## Dependencies / decisions needed from Rob (blocking items above)

| ID | Decision / input needed | Blocks |
|---|---|---|
| DEP-01 | Final UX behavior for deposit summary widget (bar vs draggable widget, hide/unhide expectations) | `NOW-REC-01` |
| DEP-02 | “Past due” definition for collections report/list (date basis + which balance field) | `NEXT-COLL-01` |
| DEP-03 | Duplicate detection rules for migration (opp/product/schedule match keys) | `MIG-03` (+ informs `MIG-01`, `MIG-02`) |
