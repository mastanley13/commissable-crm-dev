<!-- ba6ef84d-79de-4fe4-a496-021fd7bcb79c cecb0a77-9e41-4714-9bd1-bf782b3eab6b -->
# Plan: Show "Last Edited" for Opportunity Commission Splits

I will implement the "Last Edited (date/by)" display for the opportunity-level commission split fields (`Subagent %`, `House Rep %`, `House Split %`). This involves "lifting" the history data to be accessible by the details view, computing the last edit for each field, and updating the UI to display it alongside the field value.

## 1. Centralize History Types and Data

- Move `HistoryRow` interface and `MOCK_HISTORY_ROWS` from `components/audit-history-tab.tsx` to `components/opportunity-types.ts`.
- Add mock history entries for "Subagent %", "House Rep %", and "House Split %" to `MOCK_HISTORY_ROWS` to demonstrate the feature.

## 2. Lift History State

- In `components/opportunity-details-view.tsx`:
    - Initialize the history state (using the mock data) in the `OpportunityDetailsView` component.
    - Pass this `history` data down to the `AuditHistoryTab` component (update its props to accept it).

## 3. Implement "Last Edited" Logic

- Create a helper function `getLastEdit(history: HistoryRow[], fieldLabel: string)` in `OpportunityDetailsView` (or utils) that returns the most recent `{ date, user }` for a given field.

## 4. Update UI Components

- **Modify `FieldRow` Component** (`components/opportunity-details-view.tsx`):
    - Add an optional `lastEdited` prop: `{ date: string; user: string }`.
    - Update the layout to a flex row for the content area.
    - If `lastEdited` is present:
        - Constrain the width of the field value container (e.g., `max-w-[120px]` or similar) to "reduce the underline length".
        - Render the "Last Edited" text to the right in a muted style.
- **Update `OpportunityHeader` and `EditableOpportunityHeader`**:
    - Call `getLastEdit` for the commission split fields.
    - Pass the result to the corresponding `FieldRow`s.

## 5. Verification

- Verify that the commission split fields show the "Last Edited" info.
- Verify that the "History" tab still works correctly with the passed-down data.

### To-dos

- [ ] Move HistoryRow and MOCK_HISTORY_ROWS to opportunity-types.ts and add mock entries
- [ ] Lift history state in OpportunityDetailsView and update AuditHistoryTab props
- [ ] Implement getLastEdit helper and modify FieldRow component
- [ ] Update OpportunityHeader and EditableOpportunityHeader to pass lastEdited data