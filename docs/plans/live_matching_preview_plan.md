Task: Add live pre-match preview to the revenue schedule grid.

Context:
Rob wants to see what will be applied before clicking Match. As the user selects deposit rows and target schedules, the bottom grid should temporarily show the resulting Actual Usage and Actual Commission values, with visual highlighting, but nothing should be persisted until Match is clicked.

Implement:
1. Add ephemeral preview state for selected deposit rows + selected candidate schedules.
2. In the bottom revenue schedule grid, temporarily display:
   - actual usage preview
   - actual commission preview
   - actual commission rate preview if relevant/derived
3. Highlight previewed cells clearly (background color preferred).
4. Revert preview when:
   - selection changes
   - user cancels
   - modal closes
   - unselect occurs
5. Ensure preview state is separate from saved state.
6. Add tests for:
   - preview appears on selection
   - preview clears on deselection/cancel
   - preview does not persist to DB until Match
   - preview remains performant with multiple selected rows

Deliverables:
- UI implementation
- any selector/state-management updates
- quick screen recording or screenshots if possible

Important:
This is a preview only. No hidden save. No accidental persistence.