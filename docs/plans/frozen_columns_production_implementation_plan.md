# Frozen Columns Production Implementation Plan

## Objective

Move frozen-column behavior from the admin prototype into the production reconciliation detail view.

This plan is intentionally scoped to frozen columns only.
It does **not** include Match/Unmatch action-state cleanup.

## Product Requirements

1. Frozen columns must work in the real reconciliation detail UI.
2. Locked columns pin to the **left** side of the table.
3. Locked columns render before all unlocked columns, regardless of normal order.
4. Deposit line items and revenue schedules must support separate locked-column preferences.
5. The top and bottom table regions must stay horizontally synchronized.
6. Lock state must persist per user.
7. The lock control must live in the existing column chooser modal.
8. Existing column width, hide/show, and reorder behavior must continue to work.

## Current State

### Production

- The reconciliation detail view uses:
  - `components/deposit-reconciliation-detail-view.tsx`
  - `components/dynamic-table.tsx`
  - `components/column-chooser-modal.tsx`
  - `hooks/useTablePreferences.ts`
  - `app/api/table-preferences/[pageKey]/route.ts`
- Current table preferences persist:
  - `columnOrder`
  - `columnWidths`
  - `hiddenColumns`
  - `pageSize`
- Production does not currently support:
  - lock state in preferences
  - lock controls in the modal
  - left-pinned rendering in `DynamicTable`
  - synchronized horizontal scrolling across the two reconciliation tables

### Prototype

- `app/(dashboard)/admin/prototypes/reconciliation-frozen-columns/page.tsx` already proves:
  - sticky pinned columns
  - synchronized horizontal scroll
- The prototype is not production-ready because it:
  - pins to the right
  - uses isolated logic instead of shared production components
  - does not persist lock state through the real table preference flow

## Implementation Strategy

Implement frozen columns as a production capability in the shared table stack, then enable it in the reconciliation detail page.

## Phase 1: Preference Model and API

### Goal

Persist locked-column state per table.

### Changes

1. Extend the `TablePreference` model to store locked columns.
2. Update the table-preferences API to read/write locked-column state.
3. Update `useTablePreferences` to load, apply, and persist locked columns together with existing table settings.

### Proposed Shape

Add a new preference field:

- `lockedColumns: string[]`

This should be stored separately for each existing reconciliation table page key:

- `reconciliation:deposit-line-items`
- `reconciliation:revenue-schedules`

That preserves separate top/bottom lock configuration without requiring a new preference table.

### Files

- `prisma/schema.prisma`
- `app/api/table-preferences/[pageKey]/route.ts`
- `hooks/useTablePreferences.ts`
- any required Prisma migration files

### Notes

- Hidden columns should not render even if their id also appears in `lockedColumns`.
- Unknown or removed column ids should be dropped during preference normalization.
- Existing user preferences must continue to load cleanly when `lockedColumns` is absent.

## Phase 2: Shared Table Model Updates

### Goal

Teach the shared table system how to represent and order locked columns.

### Changes

1. Extend the shared `Column` type with lock metadata.
2. Add helper logic to split visible columns into:
   - locked visible columns
   - unlocked visible columns
3. Ensure locked columns render first in live order.
4. Preserve normal reorder behavior for unlocked columns.
5. Preserve widths, resize behavior, sorting, selection, and hidden columns.

### Proposed `Column` Shape

Add:

- `locked?: boolean`

This flag should be treated as presentation state, similar to `hidden`.

### Files

- `components/dynamic-table.tsx`
- any extracted helper file if table-order logic becomes too large

### Notes

- The final render order should be:
  - visible locked columns in saved order
  - visible unlocked columns in saved order
- Hidden columns should stay excluded from both groups.
- Lock state should not break drag reorder or width persistence.

## Phase 3: DynamicTable Rendering for Left-Pinned Columns

### Goal

Render locked columns as sticky left columns in the shared table component.

### Changes

1. Update `DynamicTable` so locked visible columns render with sticky left positioning.
2. Compute cumulative left offsets from locked column widths.
3. Apply sticky styling to both header and body cells.
4. Add visual separation between the locked zone and scrollable zone.
5. Keep horizontal scrolling active for the unlocked region.

### Rendering Approach

Use the existing single-table render and add sticky-left behavior rather than creating two separate table DOM trees.

For each visible locked column:

- calculate its left offset from all prior locked columns
- apply `position: sticky`
- apply `left: <offset>`
- raise z-index for headers above body cells

### Files

- `components/dynamic-table.tsx`
- optional shared CSS in `app/globals.css` if reusable table utility classes help

### Notes

- The product requirement is left pinning only.
- Do not port the prototype’s right-pin behavior.
- Width changes must immediately affect sticky offsets.
- Column resize and locked-column order must remain stable during rerender.

## Phase 4: Column Chooser Modal Lock Controls

### Goal

Allow users to lock/unlock columns from the real column chooser modal.

### Changes

1. Add a lock control to items in the modal’s selected-columns list.
2. Allow locked columns to remain reorderable inside the selected list.
3. Reflect lock state clearly in the modal UI.
4. Return the updated `locked` state through `onApply`.

### UX Rules

- Only selected/visible columns can be locked.
- Moving a column to available/unhidden false should also clear its effective rendered lock state.
- Locked columns can still be reordered relative to each other and relative to unlocked columns in the modal.
- Live table rendering will still force locked columns to the far left.

### Files

- `components/column-chooser-modal.tsx`

### Notes

- A lock icon or checkbox is acceptable.
- The modal should remain understandable without introducing a second complex drag system.
- The modal should explain that locked columns stay visible on horizontal scroll.

## Phase 5: Reconciliation Detail Integration

### Goal

Enable frozen columns in the real reconciliation detail page and synchronize horizontal scrolling between the two tables.

### Changes

1. Keep separate preference instances for:
   - deposit line items table
   - revenue schedules table
2. Pass locked-column-aware column arrays into both `DynamicTable` instances.
3. Add horizontal scroll synchronization between the two live table scroll containers.
4. Keep existing table-height measurement logic intact.

### Scroll Sync Design

Add shared scroll-sync logic in `components/deposit-reconciliation-detail-view.tsx`:

1. capture the horizontal scroll container for each table
2. listen for `scrollLeft` changes
3. mirror scroll position to the sibling table
4. guard against infinite loop feedback while syncing

### Files

- `components/deposit-reconciliation-detail-view.tsx`

### Notes

- Sync should only affect horizontal scroll.
- Vertical scrolling should remain independent.
- The synchronization target should be the real scrollable table container, not the outer section wrapper.

## Phase 6: Preference Normalization and Backward Compatibility

### Goal

Make the new preference shape safe for existing users and evolving column definitions.

### Changes

1. Normalize `lockedColumns` against current column ids.
2. Drop ids for hidden or removed columns during preference application.
3. Default to an empty locked list for existing preference rows.
4. Ensure old preference rows remain valid without manual cleanup.

### Files

- `hooks/useTablePreferences.ts`
- `app/api/table-preferences/[pageKey]/route.ts`
- any alias/migration helpers if needed

## Testing Plan

## Unit / Component Coverage

1. `useTablePreferences`
   - applies `lockedColumns` from stored preferences
   - ignores unknown locked ids
   - persists lock state with existing settings
2. `DynamicTable`
   - locked visible columns render before unlocked columns
   - locked columns receive sticky-left styling
   - hidden locked columns do not render
   - unlocked columns remain reorderable
3. `ColumnChooserModal`
   - user can toggle lock state for selected columns
   - applied payload preserves `locked`

## Integration / UI Coverage

1. user can lock a column and it renders on the far left
2. top and bottom tables can use different locked columns
3. lock state persists after save/reload
4. horizontal scroll stays aligned between the two reconciliation tables
5. no regression to hide/show/width/order preferences

## Manual QA Checklist

1. Lock one column in the top table and a different column in the bottom table.
2. Confirm both remain visible while horizontally scrolling wide datasets.
3. Resize a locked column and confirm sticky offsets still align.
4. Hide a locked column and confirm it no longer renders pinned.
5. Reopen the modal and confirm lock state is preserved.
6. Reload the page and confirm both tables restore their own lock choices.
7. Confirm sort, selection, and pagination behavior still work.

## Risks

1. Sticky positioning can break if cell width calculations drift from rendered width.
2. Scroll synchronization can create feedback loops if not guarded.
3. Adding lock state to shared table components could affect non-reconciliation screens if defaults are not passive.
4. Reordering plus lock state can become confusing if modal behavior and live render order are not clearly documented.

## Mitigations

1. Keep `locked` optional and default-off everywhere.
2. Contain first-use rollout to reconciliation page keys only.
3. Reuse prototype concepts selectively, but rebuild the behavior in shared production components.
4. Add focused tests around order + sticky offset + scroll sync.

## Deliverables

1. Production frozen-columns implementation in reconciliation detail view.
2. Table preference schema/API support for locked columns.
3. Column chooser modal lock controls.
4. Test coverage for persistence, rendering order, and synchronized scroll.
5. Short implementation note documenting how top vs bottom table lock preferences are stored.
