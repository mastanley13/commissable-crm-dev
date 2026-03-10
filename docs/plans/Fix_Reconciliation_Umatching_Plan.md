Task: Harden reconciliation unmatch into a full reversal engine.

Context:
In Commissable CRM reconciliation, unmatching currently clears some visible matched values but leaves behind related usage/commission adjustments. This corrupts later testing and rematching. March 5 specifically requires unmatch to reset all adjustment fields. March 3 also requires Flex schedules created from overages to be auto-deleted if the related match is unmatched.

Product requirement:
- Manager-level undo must restore full pre-match state, not just visible matched values.
- Unmatch is the core data-integrity safeguard for reconciliation and must reverse all match-created downstream effects while preserving auditability.

Implement:
1. Trace the full side effects of a successful match:
   - deposit line state
   - actual usage
   - actual commission
   - actual commission rate (if derived/persisted)
   - expected usage adjustment
   - expected commission adjustment / commission adjustment fields
   - usage/commission allocated/unallocated totals if persisted
   - any future-schedule mutations caused by apply-to-future
   - any created Flex schedule / overage schedule records
   - any match-linked metadata or appended IDs introduced during matching/flex resolution
2. Build a single reversal service used by:
   - line-level unmatch
   - bulk unmatch
3. The reversal service must reverse all downstream effects atomically so rematch after unmatch behaves as if the original match never happened.
4. Add durable provenance for apply-to-future mutations so they can be reversed safely:
   - either reversal journal rows
   - or explicit source references on each affected future schedule change
5. Define and implement reconciled/finalized behavior:
   - block unmatch on reconciled/finalized deposits unless the user/admin unfinalizes first
6. If the original match created a Flex schedule, remove or retire that Flex schedule on unmatch.
7. Preserve audit history for all reversals.
8. Add regression coverage for:
   - simple 1:1 match/unmatch
   - within-tolerance adjustment match/unmatch
   - apply-to-future match/unmatch
   - Flex-created overage match/unmatch
   - rematch after unmatch
   - reconciled/finalized record behavior

Deliverables:
- code changes
- brief note describing which fields were being left dirty before
- test results / regression summary

Important:
Do not patch this only in the UI. Fix the underlying state transition so the database/source of truth is clean after unmatch.
