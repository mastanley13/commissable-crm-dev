Task: Implement frozen columns and clean Match/Unmatch action behavior in reconciliation UI.

Context:
Operators need easier visual comparison across wide tables. Also, the current Unmatch action is hidden/confusing. The approved direction is:
- lock/pin columns on the left via column modal
- top and bottom tables sync horizontally
- in matched context, Match changes to Unmatch

Implement:
1. Add column-lock control in the column selection modal.
2. Locked columns move to the far left and stay visible during horizontal scroll.
3. Top and bottom tables maintain synchronized horizontal scroll behavior.
4. Preserve user-specific lock preferences.
5. In matched context, replace Match CTA with Unmatch CTA.
6. Make sure already-matched selections do not show ambiguous action states.
7. Add tests for:
   - locked columns persist
   - top/bottom scroll stays aligned
   - matched selection shows Unmatch
   - unmatched selection shows Match

Deliverables:
- implementation
- any persistence model for column prefs
- test notes