# Development Task Summaries

This file is now a cumulative running log. New agent updates should be appended as new sections instead of replacing prior content.

## Master Item List

Use this section as the quick-glance index across agent updates. Full details remain in the original task sections below and should not be deleted when new items are added.

| Task | Source | Area | Summary | Status |
| --- | --- | --- | --- | --- |
| Task 1 | Prior agent entry | Reconciliation / Match Wizard | Validation-first UX update for the Match Wizard, including automatic validation and clearer status states | Completed |
| Task 2 | Prior agent entry | Reconciliation / Modal Layout | Standardized reconciliation modal sizing and scrolling behavior | Completed |
| Task 3 | Prior agent entry | Reconciliation / Unmatch | Added full rollback behavior and archived-schedule cleanup for unmatch flows | Completed |
| Entry 3 | Prior agent entry | Reconciliation / Table UX | Added frozen columns and synchronized horizontal scroll controls to reconciliation tables | Completed |
| Task 4 | Prior agent entry | Flex / Naming | Standardized canonical Flex child schedule naming to `FLEX-<parentScheduleNumber>` | Completed |
| Task 5 | Prior agent entry | Reconciliation / Table UX | Added frozen columns and persisted scroll sync in the live reconciliation screen | Completed |
| Task 6 | Current agent entry | Reconciliation / Rate Discrepancy | Added 3-action rate discrepancy flow, server-side atomic apply-to-future, ticket access adjustment, and browser test data | Completed |
| Task 7 | Current agent entry | Reconciliation / Match Workflow Assessment | Assessed current `1:1`, `1:M`, `M:1`, and `M:M` workflow implementation, status, risks, and verification coverage | Completed |

### Add-New-Entry Rule

- Append new work as a new task section below instead of replacing older sections.
- Add one matching row to the `Master Item List` above for each new task section.
- If an older item changes status, add a new row or a new note in a later section instead of deleting the earlier entry.

---

## Task 1: Match Wizard Validation UX

### 1. Issues Identified
- The Match Wizard still framed the workflow as `Preview` even though the result was being used as validation before apply.
- The modal used mixed labels such as `Preview`, `Run Preview`, and `Run Validation Again`, which made the flow harder to understand.
- The UI did not emphasize the positive state where validation completed with no issues.
- Validation messaging was spread across several places instead of presenting one clear current status.
- The many-to-one replacement path still needed to remain visible and functional while the modal UX changed.

### 2. Changes Implemented
- Updated `components/reconciliation-match-wizard-modal.tsx` so the user-facing step is now `Validation` instead of `Preview`.
- Added debounced automatic validation for validatable match flows so validation re-runs when allocations or compatible selections change.
- Added `lib/matching/match-wizard-validation.ts` to centralize derivation of `idle`, `running`, `stale`, `valid`, `warning`, `error`, and `system_error` states.
- Reworked the Validation section to show:
  - one primary status card
  - a single issues list when warnings or blocking errors exist
  - a collapsed `Impact details` section for the after-apply summaries
- Updated Apply gating and helper copy so it references validation instead of preview.
- Auto-expanded the Allocation section when bundle replacement is required so the corrective path is immediately visible.
- Removed the inline `Run validation again` button so the Validation section behaves as an automatic status panel.
- Added focused unit coverage in `tests/match-wizard-validation-state.test.ts`.

### 3. Reasoning Behind Changes
- Validation is the actual decision gate for this modal, so the UI should describe it directly instead of calling it a preview.
- Automatic validation reduces unnecessary clicks and matches the intended one-screen workflow.
- Centralizing validation-state derivation makes the component easier to reason about and gives the task a small testable unit.
- Keeping the existing preview API route avoided unnecessary backend churn while still delivering the requested UX improvement.
- The work was intentionally scoped to the Match Wizard modal and its immediate validation behavior.

### 4. Expected Behavior
- The Match Wizard presents `Validation` instead of `Preview`.
- Validation runs automatically when compatible selections or allocations change.
- Users see one clear validation state:
  - waiting
  - running
  - no issues found
  - warnings found
  - blocking issues found
  - system error
- Apply is enabled only when the latest validation result is current and has no blocking issues.
- When many-to-one replacement is required, the Allocation section expands automatically so the user can take the replacement action.
- The Validation section no longer shows a manual `Run validation again` button.

### 5. Client Summary
- The Match Wizard now uses a Validation-first flow instead of a Preview-first flow.
- Validation runs automatically and tells the user whether there are issues or no issues.
- Apply is clearly tied to the latest validation result.
- The existing many-to-one replacement path remains intact and is more visible when required.
- The extra validation action button was removed so the modal reads like an automatic workflow instead of a manual one.

### 6. Testing Performed
- Ran focused unit coverage:
  - `node --import tsx --test tests/match-wizard-validation-state.test.ts`
- Verified the helper covers idle, running, stale, valid, warning, error, and system-error states.
- Attempted full TypeScript validation:
  - `npx tsc --noEmit`
- Full TypeScript validation is currently blocked by unrelated existing errors in `app/api/table-preferences/[pageKey]/route.ts` referencing `lockedColumns`.
- Did not run the full application test suite or a live browser session in this task.

---

## Task 2: Reconciliation Modal Standardization

### 1. Issues Identified
- The `Rate Discrepancy` modal in the deposit reconciliation detail view was still using a smaller `max-w-xl` shell instead of the standard large modal size used elsewhere in the app.
- The `Flex Resolution` modal had the same mismatch and did not align visually with established modal sizing such as create account and create contact.
- With a fixed-height modal shell, the content area also needed to scroll cleanly and keep the action row anchored near the bottom.

### 2. Changes Implemented
- Updated `components/deposit-reconciliation-detail-view.tsx` for the `Rate Discrepancy` modal:
  - changed the modal shell to `flex h-[900px] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl`
  - changed the body to `flex-1` with `overflow-y-auto`
  - added `mt-auto` to the action row so actions sit at the bottom of the modal when content is short
- Updated `components/deposit-reconciliation-detail-view.tsx` for the `Flex Resolution` modal:
  - changed the modal shell to `flex h-[900px] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl`
  - changed the body to `flex-1` with `overflow-y-auto`
  - added `mt-auto` to the action row so the footer behavior matches the standard modal layout

### 3. Reasoning Behind Changes
- The request was specifically to align these reconciliation modals with the existing large-modal standard already used in the application.
- Applying the same shell classes keeps modal sizing consistent across workflows and reduces UI drift.
- Adding a scrollable body avoids clipping or overflow problems once the modal height is fixed at `900px`.
- Pushing the actions to the bottom prevents the larger fixed-height shell from leaving the controls awkwardly grouped near the top.

### 4. Expected Behavior
- The `Rate Discrepancy` modal now opens at the same large size standard as other primary modals in the app.
- The `Flex Resolution` modal now opens at the same large size standard as other primary modals in the app.
- If either modal content grows, the body scrolls inside the fixed-height shell instead of overflowing the viewport.
- When content is shorter than the available height, the action buttons stay aligned toward the bottom of the modal.

### 5. Client Summary
- Standardized the two reconciliation warning/resolution modals to the same large modal size used elsewhere in the CRM.
- Improved layout behavior so the body scrolls properly inside the fixed-height shell.
- Kept the change scoped to the existing deposit reconciliation detail component.

### 6. Testing Performed
- Reviewed the scoped diff in `components/deposit-reconciliation-detail-view.tsx` to confirm only the requested modal layout changes were applied.
- No automated tests were run for this UI-only update.
- No live browser QA was executed in this task environment.

---

## Task 3: Reconciliation Unmatch Rollback And Archived-Schedule Cleanup

### 1. Issues Identified
- Reconciliation unmatch was not a full rollback. It could remove visible allocations while leaving behind schedule adjustments, `apply-to-future` mutations, and Flex-created side effects.
- Line-level and bulk unmatch behavior were drifting because they were implemented through different paths with different assumptions.
- Unmatch behavior on finalized/reconciled deposits was underspecified and not consistently guarded.
- During live validation, we found a second data-integrity defect: a deposit line could remain `Partially Matched` against a revenue schedule that had already been soft-deleted, leaving the line allocated while the lower schedule grid showed nothing usable.
- The live bad row confirmed a deeper root cause: at least one match path allowed `DepositLineMatch` rows to exist against archived schedules, and allocation recompute still counted those deleted-schedule matches.

### 2. Changes Implemented
- Added a dedicated reconciliation undo-log model and migration so match-created non-derivable mutations can be reversed deterministically.
- Added shared rollback helpers in `lib/reconciliation/undo-log.ts`.
- Added a shared unmatch reversal service in `lib/reconciliation/unmatch-reversal.ts`.
- Refactored both unmatch entry points to use the same reversal engine:
  - `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts`
  - `app/api/reconciliation/deposits/[depositId]/bulk/unmatch-allocations/route.ts`
- Wired mutation logging into the match/adjustment flows that create reversible side effects:
  - direct adjustment writes in `apply-match`
  - future-schedule mutations in `lib/reconciliation/future-schedules.ts`
  - auto-fill/match metadata writes in `lib/matching/auto-fill.ts`
  - Flex-created schedule flows in `lib/flex/revenue-schedule-flex-actions.ts`
- Added finalized-state protection so unmatch is blocked until the deposit is unfinalized.
- Added regression coverage for:
  - within-tolerance rollback
  - `apply-to-future` rollback
  - finalized-state blocking
  - Flex-created schedule cleanup
  - deleted-schedule candidate hiding
  - bulk unmatch cleanup of soft-deleted matched schedules
- Patched the candidate/grid and bulk-unmatch behavior for soft-deleted schedules:
  - hidden archived schedules from the reconciliation candidates grid
  - allowed bulk unmatch to clean up orphaned matches even if the selected revenue schedule had already been archived

### 3. Reasoning Behind Changes
- Unmatch is the system's reconciliation integrity safeguard, so it must reverse persisted side effects, not just update the UI.
- `apply-to-future` and Flex-creation flows mutate future schedules and create new records, so they need durable provenance and a single transaction-safe rollback path.
- One shared reversal service prevents bulk and line-level unmatch from drifting over time.
- Archived schedules should not appear as valid match targets, but the system still needs to be able to clean up historical bad rows that already reference them.
- Live validation showed that bad historical data can exist independently of the new rollback flow, so the task also required targeted repair and defect isolation, not only code changes.

### 4. Expected Behavior
- Unmatch removes the selected match rows and restores the affected deposit line, revenue schedules, and deposit aggregates to their pre-match state.
- Any adjustment fields written because of the match are reset.
- Any future-schedule deltas written through `apply-to-future` are reversed.
- Flex schedules created by the matched flow are retired when that match is undone.
- Reconciled/finalized deposits cannot be unmatched until explicitly unfinalized first.
- Soft-deleted revenue schedules do not appear in the bottom reconciliation grid as active matched/suggested schedules.
- If historical bad data still exists, bulk unmatch can clean up the orphaned match rows instead of failing with `Unknown revenue schedule id(s)`.

### 5. Client Summary
- The reconciliation unmatch flow was upgraded from a partial cleanup into a shared rollback engine with provenance for reversible mutations.
- The immediate browser error around archived schedules blocking unmatch was fixed.
- During validation we found and repaired one live bad partial-match row where a deposit line was still allocated to archived revenue schedule `12709`.
- That repair removed the orphaned `DepositLineMatch`, reset the line's allocations, and brought the live deposit back into a clean state for that line.
- Two residual code defects were also identified for follow-up:
  - match paths still need a hard `deletedAt: null` guard at initial schedule lookup
  - line allocation recompute should ignore matches tied to deleted schedules

### 6. Testing Performed
- Ran static verification:
  - `npx tsc --noEmit --pretty false`
- Added and registered targeted regression coverage in:
  - `tests/integration-reconciliation-unmatch-regression.test.ts`
  - `tests/integration-reconciliation-candidates.test.ts`
- Test files were discovered successfully, but full integration execution was not run against a disposable database in this task because the local integration harness requires `TEST_DATABASE_URL` and truncates the target database.
- Performed live/browser validation against reconciliation flows and investigated multiple production-like failure states.
- Queried the database directly to identify the orphaned partial match:
  - deposit line item `ea51b9e3-7354-4bad-a2f2-9d376173c165`
  - revenue schedule `12709`
  - revenue schedule id `9cca61e0-d963-45a8-8932-d7f687e35b30`
  - orphaned match id `645b609f-f655-4e9a-9d03-ac27245ed7f6`
- Performed a one-time live data repair by force-unmatching that archived-schedule match and recomputing:
  - line allocations/status
  - archived schedule actuals/status
  - deposit aggregates
- Verified after repair:
  - the line had no remaining `DepositLineMatch` rows
  - the line returned to `Unmatched`
  - allocated usage/commission reset to `0`
  - primary schedule linkage was cleared

---

## Entry 3: Reconciliation Frozen Columns + Modal Scroll Sync Controls

## 1. Issues Identified
- Frozen-column behavior existed only in an admin prototype and was not available in the production reconciliation detail view.
- The production `Column Settings` modal allowed show/hide and reorder, but did not allow users to lock columns so they remained visible during horizontal scroll.
- Table preferences persisted order, width, hidden state, and page size, but did not persist frozen-column state.
- Horizontal scroll synchronization between `Deposit Line Items` and `Suggested Matches - Revenue Schedules` was implemented in the live page behavior, but the user could not manage that behavior from the modal.
- After the first implementation pass, preference persistence for locked columns and sync-scroll settings could be lost on refresh because the modal confirm flow did not wait for persistence to finish before closing.

## 2. Changes Implemented
- Extended `TablePreference` persistence for reconciliation table settings:
  - added `lockedColumns`
  - added `syncHorizontalScroll`
- Added database migrations:
  - `prisma/migrations/20260310130000_add_locked_columns_to_table_preferences/migration.sql`
  - `prisma/migrations/20260310143000_add_sync_horizontal_scroll_to_table_preferences/migration.sql`
- Updated `app/api/table-preferences/[pageKey]/route.ts` to read/write frozen-column state and sync-scroll state.
- Updated `hooks/useTablePreferences.ts` to:
  - apply/persist `lockedColumns`
  - apply/persist `syncHorizontalScroll`
  - expose `handleSyncHorizontalScrollChange`
  - keep compatibility for existing preference rows with no new fields
- Added `lib/table-column-locking.ts` to centralize locked-column ordering and sticky offset calculation.
- Updated `components/dynamic-table.tsx` to:
  - support `locked?: boolean` on shared columns
  - render locked visible columns before unlocked columns
  - pin locked columns to the left using sticky positioning
  - expose the real horizontal scroll container so the reconciliation page can synchronize scrolling safely
- Updated `components/column-chooser-modal.tsx` to:
  - add lock/unlock controls in `Selected Columns`
  - add a modal checkbox for `Sync horizontal scroll with the linked reconciliation table`
  - return both column selections and sync-scroll choice on confirm
  - show a `Saving...` state and await persistence on confirm
- Updated `components/deposit-reconciliation-detail-view.tsx` to:
  - use locked-column-aware table preferences for both reconciliation tables
  - keep separate frozen-column choices for the top and bottom tables
  - share one sync-scroll preference across the linked reconciliation tables
  - persist settings immediately on modal confirm instead of relying on delayed save behavior
- Added focused tests:
  - `tests/table-column-locking.test.ts`
  - `tests/table-preferences-alias.test.ts`

## 3. Reasoning Behind Changes
- Frozen columns belong in the real reconciliation workflow, so the implementation needed to move from the prototype into the shared production table stack.
- The existing `Column Settings` modal is already the user’s control surface for organizing columns, so frozen-column controls and scroll-sync management needed to live there rather than in a separate page-level toggle.
- Persisting the settings in `TablePreference` keeps the feature aligned with the existing per-user preference model.
- Sticky-left rendering in `DynamicTable` ensures the behavior is driven by saved column state instead of special-case reconciliation-only markup.
- The persistence bug was caused by a race between user refresh/navigation and asynchronous preference saving, so the correct fix was to await persistence on confirm rather than relying on debounce timing.

## 4. Expected Behavior
- In the production reconciliation detail page, users can open `Column Settings` for either reconciliation table and lock selected columns.
- Locked columns render on the far left and remain visible during horizontal scrolling.
- The `Deposit Line Items` table and the `Suggested Matches - Revenue Schedules` table can use different frozen columns.
- The modal includes a checkbox allowing the user to enable or disable synchronized horizontal scrolling between the two linked reconciliation tables.
- When sync is enabled, horizontal scroll movement in one table mirrors to the other table.
- When sync is disabled, the two tables scroll independently.
- Locked-column choices and sync-scroll preference persist after confirm and remain saved after page refresh until the user changes them.

## 5. Client Summary
- Frozen columns are now available in the live reconciliation screen, not just in the prototype.
- Users can manage those frozen columns directly in the existing `Column Settings` modal.
- A new checkbox in the modal lets users choose whether the two reconciliation tables scroll together horizontally.
- Preferences now save reliably and remain in place after refresh.

## 6. Testing Performed
- Ran Prisma client generation after schema changes:
  - `npm run db:generate` using `PRISMA_GENERATE_NO_ENGINE=1`
- Ran TypeScript validation:
  - `npx tsc --noEmit`
- Ran focused automated tests:
  - `node --import tsx --test tests/table-column-locking.test.ts tests/table-preferences-alias.test.ts`
- Verified coverage for:
  - locked columns rendering before unlocked columns
  - sticky offset calculation
  - hidden locked columns not rendering
  - locked-column preference aliasing/normalization
- Did not run a live browser session from this task environment, but browser QA steps were documented for manual validation.

---

## Task 4: Canonical Flex Child Schedule Naming

### 1. Issues Identified
- Flex child schedule naming was inconsistent with the confirmed canonical naming rule for this task.
- The `FlexProduct` creation path stored child schedule numbers in the legacy `-flex` format instead of `FLEX-<parentScheduleNumber>`.
- Display and test expectations still reflected older naming conventions, which made it easy for the UI and regression coverage to drift from the intended rule.
- The change needed to be verified without touching unrelated variance-resolution paths that remain out of scope for this task.

### 2. Changes Implemented
- Updated `lib/flex/revenue-schedule-flex-actions.ts` so the `FlexProduct` child schedule creation path stores schedule numbers as `FLEX-<parentScheduleNumber>`.
- Added a dedicated helper to build the canonical Flex child schedule number from the parent schedule number with a safe fallback.
- Updated `lib/flex/revenue-schedule-display.ts` so stored `FLEX-...` values are preserved and displayed as-is instead of being transformed into older suffix-based formats.
- Updated `tests/revenue-schedule-display.test.ts` to assert the new canonical naming behavior.
- Updated `tests/integration-billing-status-lifecycle.test.ts` to assert that the created Flex child schedule is stored with the canonical `FLEX-<parentScheduleNumber>` value.

### 3. Reasoning Behind Changes
- The naming rule was clarified during this task, so the schedule number should be correct at creation time rather than being inferred only in display logic.
- Using one canonical stored value reduces ambiguity across reconciliation, Flex review, billing lifecycle flows, and reporting.
- Preserving explicit `FLEX-...` values in the display helper avoids accidental reformatting while maintaining compatibility with legacy data patterns that may still exist elsewhere.
- The work was intentionally limited to the `FlexProduct` child-schedule path so the naming fix could be completed and verified without changing broader outside-tolerance resolution behavior.

### 4. Expected Behavior
- When a user resolves an outside-tolerance overage by choosing `Flex Product`, the created child schedule is stored as `FLEX-<parentScheduleNumber>`.
- Example: if the parent revenue schedule number is `12582`, the child schedule number is `FLEX-12582`.
- Browser and application surfaces that display that schedule should show `FLEX-12582`, not `12582-flex`, `12582-F`, or `12582.1`.
- Parent/child linkage, amount logic, and billing lifecycle behavior remain unchanged by this task; only the canonical naming output was updated.

### 5. Client Summary
- Canonical Flex child naming now follows `FLEX-<parent schedule number>`.
- The implementation is in place for the `FlexProduct` schedule creation path and the related display logic.
- Focused automated tests were updated to lock the naming behavior in place.
- Other outside-tolerance options such as `Adjust Full Overage`, `Manual Amount`, and `AI Adjustment` were not changed as part of this task.

### 6. Testing Performed
- Ran focused unit coverage:
  - `node --import tsx --test tests/revenue-schedule-display.test.ts`
- Ran focused integration coverage against a disposable Postgres test database:
  - `RUN_INTEGRATION_TESTS=1`
  - `TEST_DATABASE_URL=postgresql://app:commissable%402025@127.0.0.1:5432/commissable_crm_codex_flex_naming_test`
  - `node --import tsx --test tests/integration-billing-status-lifecycle.test.ts`
- Verified the billing lifecycle integration flow asserts the Flex child schedule number as `FLEX-RS-BS-2`.
- Created and dropped the disposable integration database as part of the test run.
- Did not run the full application test suite or a live browser session in this task.

---

## Task 5: Frozen Columns And Scroll Sync In Reconciliation

### 1. Issues Identified
- Frozen-column behavior existed only in an admin prototype and was not available in the production reconciliation detail view.
- The production `Column Settings` modal allowed show/hide and reorder, but did not let users lock columns for persistent left-side visibility.
- Table preferences persisted order, width, and hidden state, but did not persist frozen-column state.
- Horizontal scroll synchronization between `Deposit Line Items` and `Suggested Matches - Revenue Schedules` was not user-configurable from the production UI.
- The requested UX required the user to manage both frozen columns and scroll-sync behavior directly from the existing column settings modal.

### 2. Changes Implemented
- Updated `prisma/schema.prisma` to add `lockedColumns` and `syncHorizontalScroll` to `TablePreference`.
- Added migrations:
  - `prisma/migrations/20260310130000_add_locked_columns_to_table_preferences/migration.sql`
  - `prisma/migrations/20260310143000_add_sync_horizontal_scroll_to_table_preferences/migration.sql`
- Updated `app/api/table-preferences/[pageKey]/route.ts` to load and persist both frozen-column state and sync-scroll preference.
- Updated `hooks/useTablePreferences.ts` to:
  - apply/persist `lockedColumns`
  - apply/persist `syncHorizontalScroll`
  - keep backward compatibility for older preference rows
- Updated `lib/table-preferences-alias.ts` to normalize locked-column ids the same way existing column ids are normalized.
- Added `lib/table-column-locking.ts` to centralize locked-column ordering and sticky offset logic.
- Updated `components/dynamic-table.tsx` to:
  - support `locked?: boolean` on columns
  - render locked visible columns first
  - pin locked columns to the left with sticky positioning
  - expose the real horizontal scroll container to parent views
- Updated `components/column-chooser-modal.tsx` to:
  - add lock/unlock controls for selected columns
  - add a checkbox for syncing horizontal scroll with the linked reconciliation table
  - return both column changes and sync-scroll setting on apply
- Updated `components/deposit-reconciliation-detail-view.tsx` to:
  - enable left-pinned frozen columns in both reconciliation tables
  - keep separate frozen-column preferences for top vs bottom tables
  - share a persisted sync-horizontal-scroll setting between the two linked tables
  - turn horizontal scroll syncing on/off based on the modal checkbox
- Added focused tests:
  - `tests/table-column-locking.test.ts`
  - `tests/table-preferences-alias.test.ts`

### 3. Reasoning Behind Changes
- The shared table stack was the correct place to implement frozen columns because the production reconciliation screen already depends on shared table, modal, and preference components.
- Storing frozen-column state in `TablePreference` preserves the existing per-user preference model and avoids introducing a second persistence mechanism.
- The lock control was added to the existing `Column Settings` modal because that is the established user workflow for organizing table columns.
- Sticky-left rendering was implemented in `DynamicTable` so the behavior is driven by actual saved column state rather than a prototype-only layout hack.
- The horizontal scroll sync option was added to the same modal so users can manage all table-view behavior in one place, and because the requirement explicitly linked the deposit line items table and suggested matches table.
- The sync setting is persisted for both reconciliation page keys so the linked tables stay consistent after reload.

### 4. Expected Behavior
- In the reconciliation detail view, users can open `Column Settings` for either table and lock selected columns.
- Locked columns render on the far left and remain visible during horizontal scrolling.
- The `Deposit Line Items` table and the `Suggested Matches - Revenue Schedules` table can use different locked columns.
- Lock state persists per user after confirm/reload.
- The modal now includes a checkbox to enable or disable synchronized horizontal scrolling between the two linked reconciliation tables.
- When sync is enabled, scrolling either table horizontally moves the other table to the same horizontal position.
- When sync is disabled, each table scrolls independently.
- Existing column behaviors remain intact:
  - show/hide columns
  - reorder selected columns
  - resize columns
  - sort columns

### 5. Client Summary
- Added frozen columns to the live reconciliation screen, not just the prototype.
- Users can now organize columns in the same `Column Settings` modal they already use.
- Locked columns stay pinned on the left while reviewing wide reconciliation tables.
- Added a simple checkbox so users can choose whether the top and bottom reconciliation tables scroll together horizontally.
- Preferences are saved per user and restored automatically.

### 6. Testing Performed
- Ran Prisma client generation after schema changes:
  - `npm run db:generate` using `PRISMA_GENERATE_NO_ENGINE=1`
- Ran TypeScript validation:
  - `npx tsc --noEmit`
- Ran focused automated tests:
  - `node --import tsx --test tests/table-column-locking.test.ts tests/table-preferences-alias.test.ts`
- Verified test coverage for:
  - locked columns rendering before unlocked columns
  - locked-column offset calculation
  - hidden locked columns not rendering
  - locked-column preference aliasing/normalization
- Browser QA steps were documented, but no live browser session was executed in this task environment.

---

## Task 6: Rate Discrepancy Modal Actions, Atomic Apply-To-Future, And Test Data

### 1. Issues Identified
- The `Rate Discrepancy` modal did not match the requested three-action workflow.
- The prior `apply to all future schedules` behavior depended on multiple client-side calls, which meant the current-schedule update and future-schedule updates were not atomic.
- The modal exposed `Create Ticket`, but browser testing showed some reconciliation users could not use that action because permission gating was too narrow for this workflow.
- The banner displayed `Rounding tolerance`, which was not desired in the current modal presentation.
- Browser QA needed reusable fake deposit data aligned to known accounts for reconciliation testing.

### 2. Changes Implemented
- Updated `components/deposit-reconciliation-detail-view.tsx` so the modal now offers:
  - `Create Ticket`
  - `Accept New Rate %`
  - `Apply New Rate % to All Future Schedules`
- Updated the modal flow so `Accept New Rate %` applies the received rate to the current schedule.
- Updated `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/rate-discrepancy/apply-to-future/route.ts` so the current schedule update and future-schedule updates run in the same server-side transaction.
- Refactored shared update logic in `lib/reconciliation/future-schedules.ts` so the current-schedule update and future propagation use the same rate-application path.
- Updated `tests/integration-reconciliation-rate-discrepancy.test.ts` to cover:
  - current schedule update during apply-to-future
  - rollback behavior when a future update fails
- Updated `components/deposit-reconciliation-detail-view.tsx` permission handling so the `Create Ticket` action can be used by reconciliation users with `reconciliation.manage` in addition to explicit ticket-create permission.
- Removed the displayed `Rounding tolerance` text from the discrepancy banner while keeping the backend tolerance logic intact.
- Added upload-ready fake deposit data in `docs/reference-data/fake_deposit_edge_dw_realty_uat.csv` for `Edge Business` and `DW Realty GA, LLC` browser testing.

### 3. Reasoning Behind Changes
- The modal actions needed to match the documented workflow so users can resolve the discrepancy from one place without translating older button labels.
- `Apply New Rate % to All Future Schedules` is a data-integrity operation and should succeed or fail as one unit, not as two loosely coupled client operations.
- Ticket creation from this reconciliation workflow should be available to the users who manage reconciliation, even if their role model does not separately expose a dedicated ticket-create capability.
- Removing the visible tolerance copy simplifies the modal while preserving the existing backend rule that decides whether the modal should appear.
- Stable fake deposit data reduces friction for browser validation and helps the team reuse the same scenarios across UAT.

### 4. Expected Behavior
- When a matched line has a material rate discrepancy, the modal shows the three expected actions.
- `Create Ticket` opens the ticket flow for eligible reconciliation users.
- `Accept New Rate %` updates the current schedule to the received rate without changing future schedules.
- `Apply New Rate % to All Future Schedules` updates the current schedule and eligible future schedules in one atomic backend transaction.
- If the apply-to-future transaction fails, none of the related schedule updates persist.
- The discrepancy banner shows the rate difference without displaying `Rounding tolerance`.
- QA can upload the provided CSV and test against `Edge Business` and `DW Realty GA, LLC` scenarios in the browser.

### 5. Client Summary
- The rate discrepancy modal now follows the requested three-action workflow.
- The future-apply action is now transaction-safe on the server.
- Reconciliation users can create tickets from the modal without hitting the prior permission block, assuming they already have reconciliation management access.
- The modal copy is cleaner and the reusable deposit CSV is available for browser testing.

### 6. Testing Performed
- Ran ESLint on the scoped files:
  - `npx eslint components/deposit-reconciliation-detail-view.tsx lib/reconciliation/future-schedules.ts tests/integration-reconciliation-rate-discrepancy.test.ts "app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/rate-discrepancy/apply-to-future/route.ts"`
- Ran the application test suite:
  - `npm test`
- Confirmed the rate discrepancy integration tests compile with the new assertions.
- Integration tests that require `RUN_INTEGRATION_TESTS=1` were still skipped in this environment.

---

## Task 7: Reconciliation Match Workflow Status Report (`1:1`, `1:M`, `M:1`, `M:M`)

### 1. Issues Identified
- The current state of reconciliation matching workflows was not documented in one formal status report covering `1:1`, `1:M`, `M:1`, and `M:M`.
- The codebase contains both older direct line-match flows and newer grouped match-wizard flows, which makes it easy to overstate what is fully unified versus what is only partially aligned.
- Existing docs in the repo are not fully current. In particular, one older status note still marks full `many:1` behavior as `Next`, while newer grouped matching code and grouped schedule recomputation are already present.
- Verification coverage is uneven: the core logic is implemented, but most DB-backed integration tests are gated behind environment flags and are skipped by default.
- There is a concrete UI gap in the grouped Match Wizard for `1:1`: the wizard does not build allocation rows for that type even though `1:1` matching still works via the direct line-level route.

### 2. Findings Documented
- Confirmed explicit workflow classification support in `lib/matching/match-selection.ts` for:
  - `OneToOne`
  - `OneToMany`
  - `ManyToOne`
  - `ManyToMany`
- Confirmed grouped allocation persistence model in `prisma/schema.prisma`:
  - `DepositLineMatch` stores per-pair allocated usage/commission
  - `DepositMatchGroup` groups grouped-apply operations for audit and undo
- Confirmed grouped workflow server routes exist and are wired:
  - preview: `app/api/reconciliation/deposits/[depositId]/matches/preview/route.ts`
  - apply: `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts`
  - undo: `app/api/reconciliation/deposits/[depositId]/matches/[matchGroupId]/undo/route.ts`
- Confirmed grouped preview/apply logic validates:
  - selection/type compatibility
  - locked or ignored lines
  - negative-line exclusion from this wizard
  - missing or zero allocations
  - over-allocation
  - existing grouped-match conflicts
  - mixed-rate `M:1` requiring bundle replacement
- Confirmed `DepositLineItem` allocation recompute and `RevenueSchedule` actual/status recompute are implemented from cumulative applied match rows.
- Confirmed the live reconciliation detail view still routes `1:1` selections through the direct line-level apply-match API, while multi-selection flows open the Match Wizard.
- Confirmed the Match Wizard auto-expands the allocation section when mixed-rate `M:1` replacement is required.
- Confirmed the Match Wizard still lacks a `OneToOne` allocation-row branch, which means the grouped wizard itself is incomplete for pure `1:1` editing.

### 3. Workflow Status Assessment
- `1:1`:
  - **Status:** Partial in the wizard, functional in the live UI overall
  - **Current behavior:** The reconciliation detail page routes `1:1` matches through the direct per-line apply-match endpoint instead of the grouped wizard path.
  - **Assessment:** Users can perform `1:1` matches, but the new grouped modal is not complete for that shape.
- `1:M`:
  - **Status:** Implemented
  - **Current behavior:** The Match Wizard builds allocations for one line against multiple schedules, and the grouped preview/apply APIs support this flow.
  - **Assessment:** Implementation appears complete at the logic level, but end-to-end integration coverage is limited in the default test run.
- `M:1`:
  - **Status:** Implemented with guarded mixed-rate handling
  - **Current behavior:** Same-rate `M:1` allocation is supported. Mixed-rate `M:1` is intentionally blocked and redirected to bundle rip/replace.
  - **Assessment:** This is a controlled workflow rather than a missing workflow. The main open issue is that rate comparison is strict enough to flag near-rounding differences.
- `M:M`:
  - **Status:** Implemented
  - **Current behavior:** The Match Wizard supports many-to-many allocations, the backend persists them through grouped match rows, and default FIFO-style allocation behavior exists.
  - **Assessment:** This is the strongest of the grouped workflow implementations, with matching data model support and direct unit coverage for default allocation behavior.

### 4. Reasoning Behind Assessment
- The implementation is not just a plan or schema stub. The grouped workflow has real preview, apply, undo, allocation recompute, and schedule recompute code paths.
- At the same time, “implemented” does not mean “fully proven in this environment.” The default test run does not execute the integration cases because they require:
  - `RUN_INTEGRATION_TESTS=1`
  - `TEST_DATABASE_URL`
- The repo currently shows a hybrid model:
  - legacy/direct route for common `1:1`
  - grouped wizard for multi-selection workflows
- That hybrid model is acceptable operationally, but it means the workflows are not yet fully unified into one path.
- The report therefore distinguishes:
  - what is coded
  - what is actively used in the UI
  - what is verified automatically

### 5. Expected Behavior / Current System Behavior
- Users selecting one line and one schedule should still be able to match successfully through the direct apply-match route.
- Users selecting one line and multiple schedules should enter the grouped Match Wizard and allocate across schedules.
- Users selecting multiple lines and one schedule should enter the grouped Match Wizard:
  - same-rate selections can be allocated
  - mixed-rate selections are blocked and redirected to bundle replacement
- Users selecting multiple lines and multiple schedules should enter the grouped Match Wizard and allocate across pairings.
- After grouped apply or grouped undo:
  - deposit line allocations should be recomputed
  - revenue schedule actuals and statuses should be recomputed
  - deposit aggregates should be recomputed
- Current known limitation:
  - the grouped Match Wizard does not render allocation rows for `1:1`, so it is not a complete editor for that case even though the overall `1:1` workflow still functions in the page.

### 6. Risks, Gaps, And Follow-Up Items
- `1:1` grouped wizard gap:
  - `components/reconciliation-match-wizard-modal.tsx` has no `OneToOne` allocation-row branch.
- Mixed-rate false-positive risk:
  - `lib/matching/bundle-replacement.ts` currently treats multiple distinct normalized rates as mixed with no higher-level tolerance for near-rounding cases.
- Verification gap:
  - grouped preview/apply/undo paths are present, but broad integration verification is not executed in the default environment because integration tests are skipped without explicit env setup.
- Documentation drift:
  - older notes in `docs/notes/reconciliation_matching_status_summary.md` understate the current implementation level for grouped matching and `many:1`.

### 7. Client Summary
- The reconciliation matching workflows are largely implemented today.
- `1:1` works in the live product through the direct match path.
- `1:M`, `M:1`, and `M:M` are implemented through the grouped Match Wizard plus grouped preview/apply/undo APIs.
- The biggest current implementation gap is not that these workflows are missing, but that:
  - `1:1` is not fully represented inside the grouped wizard
  - mixed-rate `M:1` is intentionally blocked and redirected
  - integration verification is not enabled by default
- Overall assessment: the workflows are present and functioning at the code level, but they are not equally hardened or equally verified.

### 8. Testing Performed
- Reviewed current schema, UI flow, grouped preview/apply/undo routes, allocation recompute, and schedule recompute implementation.
- Ran the default application test suite:
  - `npm test`
- Observed result:
  - `102` passing tests
  - `0` failing tests
  - `65` skipped tests
- Ran focused checks against the current match-classification and wizard logic via the default suite contents, including:
  - `tests/match-selection.test.ts`
  - `tests/match-group-defaults.test.ts`
  - `tests/match-wizard-validation-state.test.ts`
  - `tests/integration-bundle-rip-replace.test.ts`
- Important verification note:
  - integration tests are currently skipped unless `RUN_INTEGRATION_TESTS=1` is set and a disposable `TEST_DATABASE_URL` is provided
  - because of that, this report confirms implementation status and default-test health, but does not claim full end-to-end runtime certification for every grouped workflow path in this environment
