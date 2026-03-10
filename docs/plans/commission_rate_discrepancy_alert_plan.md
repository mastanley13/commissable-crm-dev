Task: Add commission-rate discrepancy detection and prompt the user to update future schedules.

Context:
When a matched deposit implies a commission rate different from the schedule’s expected rate, the system currently auto-adjusts silently. Rob wants a prompt because silent adjustment can hide a real rate change or bad expected data. The new workflow should let the user update future schedules for that product in one action.

Implement:
1. During match calculation, compare:
   - expected commission rate on the selected schedule/product
   - implied/received commission rate from deposit usage + commission
2. If rates differ beyond rounding tolerance:
   - show a clear prompt before finalizing
   - display expected rate vs received rate
   - explain that silent adjustment may hide a real rate change
3. Provide user choices:
   - continue without updating future schedules
   - update future schedules for this product to the received rate
4. If user chooses update-future:
   - update only future unreconciled schedules for that same product/series
   - do not alter already reconciled schedules
   - log change in history/audit
5. Add tests for:
   - no discrepancy
   - small discrepancy due to rounding
   - material discrepancy with update-future selected
   - material discrepancy with keep-current selected

Deliverables:
- implementation
- modal copy
- tests
- note showing how future schedules are identified safely

Important:
Do not bury this in a vague pop-up. It should explicitly say the received rate differs from expected and offer the future-update option.