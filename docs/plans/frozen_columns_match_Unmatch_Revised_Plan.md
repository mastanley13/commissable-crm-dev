Task: Move frozen columns from prototype behavior into the production reconciliation UI.

Context:
This is not complete in production. The approved behavior from the March 3 and March 5 meetings is:

1. Frozen/locked columns belong in the real reconciliation detail view.
2. Locking a column pins it to the LEFT side of the table.
3. Locked columns override normal display order in the live table.
4. Top and bottom tables must support separate locked-column choices.
5. Top and bottom scrollable sections must stay horizontally synchronized.
6. Column choices must persist per user.
7. This must work through the real column modal, not a prototype-only page.

Required product behavior:
- Add lock UI in the column chooser modal.
- User can reorder columns and also mark specific columns as locked.
- In the rendered table, locked columns appear at the far left.
- Non-locked columns remain scrollable to the right.
- Top table and bottom table have separate lock configurations.
- Horizontal scrolling of the scrollable area stays synchronized between top and bottom tables.
- Lock state persists in table preferences.

Implementation guidance:
1. Extend table preference model to persist:
   - locked/pinned state
   - separate config for top reconciliation table vs bottom reconciliation table
2. Update the production reconciliation detail view to render:
   - left pinned zone
   - right scrollable zone
   - synchronized horizontal scroll between the two live tables
3. Update the column chooser modal to support lock selection:
   - checkbox or lock icon is acceptable
   - locked columns can still be reordered in the modal
   - locked status affects live rendering order
4. Do not pin to the right. Product decision is pin LEFT.
5. Keep existing column width/hide/order behavior intact.

Tests required:
- user can lock a column and it renders on the far left
- top and bottom tables can have different locked columns
- lock state persists per user after save/reload
- horizontal scroll stays aligned between the two tables
- unlocked columns remain reorderable
- no regression to hide/show/width preferences

Deliverables:
- production implementation
- preference schema/API updates if needed
- UI test coverage for lock persistence + sync behavior
- short note describing how top vs bottom config is stored