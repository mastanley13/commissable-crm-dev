Task: Harden reconciliation unmatch into a full reversal engine.

Context:
Current unmatch behavior is incomplete. Product requirements now require:
1) unmatch must restore full pre-match state,
2) all adjustment fields must be reset,
3) any Flex schedule created by that match must be removed on unmatch,
4) manager-level undo must preserve auditability.

Implement:
1. Inventory every side effect a successful match can create:
   - deposit line state
   - revenue schedule actuals
   - expected usage adjustment
   - expected commission adjustment
   - actual commission rate if persisted
   - future-schedule updates from apply-to-future
   - Flex schedule creation
   - any match-linked metadata/appended IDs
2. Build a single reversal service used by:
   - line-level unmatch
   - bulk unmatch
3. Add durable provenance for apply-to-future mutations:
   - either reversal journal rows
   - or explicit source references on every affected future schedule field change
4. Define and implement reconciled/finalized behavior:
   - either block unmatch until explicit unfinalize
   - or safely perform coordinated unfinalize+reverse in one controlled flow
5. If the original match created a Flex schedule, remove or retire it on unmatch.
6. Preserve audit history for all reversals.

Tests required:
- 1:1 match/unmatch
- within-tolerance adjustment match/unmatch
- apply-to-future match/unmatch
- Flex-created overage match/unmatch
- rematch after unmatch
- reconciled/finalized record behavior