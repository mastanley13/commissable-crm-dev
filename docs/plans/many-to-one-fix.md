Task: Implement the finalized many-to-one replacement workflow for mixed commission-rate scenarios.

Context:
If one deposit line is being matched against multiple schedules that have different commission rates, that is treated as a legacy/bundled setup and must NOT be matched directly. The approved workflow is to block the match and offer to replace the old bundled setup with new individual products and revenue schedule series that reflect the deposit data.

Implement:
1. On Match action, detect match type and identify many-to-one attempts.
2. If selected schedules have different expected commission rates:
   - block direct match
   - auto-run validation (user should not need to click "run preview")
   - show plain-language explanation of why direct match is invalid
3. Prompt user with replacement workflow:
   - create new opportunity products based on each deposit line item
   - copy name, pricing, commission rate, and relevant IDs/metadata from deposit data
   - create schedule series for each new product using the old bundled timeline
   - remove/deactivate original bundled opportunity product and its related schedules
4. Preserve auditability:
   - link new products/schedules back to the original replaced bundle
   - store who triggered replacement and when
5. Add tests for:
   - same-rate many-to-one (allowed or existing path)
   - different-rate many-to-one (blocked + replacement prompt)
   - successful replacement creating correct future schedule counts/dates
   - failure rollback if any child create step errors

Deliverables:
- implementation
- modal/prompt copy
- migration/transition notes if needed
- test proof for at least one two-line and one five-line replacement scenario

Important:
Use plain-language user messaging. The user should understand:
"You can’t match this directly because the selected schedules have different commission rates. Replace the bundle with individual schedules?"