# Matching Confidence Scoring Update (2026-03-03)

## Context
- Revenue schedules were hidden from suggested candidates unless users lowered `suggestedMatchesMinConfidence` below the normal default (`0.70`).
- Date filtering was already corrected separately.
- This change addresses the remaining low-confidence scoring issue without changing FIFO ordering behavior.

## Root Cause
- Hierarchical Pass B (`scoreCandidatePassB`) previously scored only:
  - account name similarity (`0.40`)
  - product identity similarity (`0.30`)
  - amount proximity (`0.20`)
  - date proximity (`0.10`)
- Strong exact identifiers (account/customer/order/location/PO/external schedule ID) were used for:
  - Pass A exact gating, and
  - conflict exclusion,
  but not as a positive Pass B score contribution.
- Result: valid fuzzy candidates with strong IDs but imperfect amount/date/product similarity often landed below `0.70` and were filtered out by normal suggested-match settings.

## What Changed
- File updated: `lib/matching/deposit-matcher.ts`
- Added Pass B strong-ID evidence boost:
  - New helper: `computePassBStrongIdEvidence(...)`
  - New signal id: `strong_id_evidence`
  - New weight cap constant: `PASS_B_STRONG_ID_BOOST_CAP = 0.22`
- Strong-ID evidence now contributes positively when present:
  - `accountId` exact
  - `customerIdVendor` exact
  - `orderIdVendor` exact (against schedule/opportunity order ids)
  - `locationId` or `customerPurchaseOrder` exact
  - `metadata.matching.externalScheduleId` exact (high-confidence evidence)
- Existing Pass B signals remain in place (name/product/amount/date). The new strong-ID signal is additive, then confidence is still capped to `1.0`.

## What Did Not Change
- Candidate filters:
  - tenant/vendor/distributor/account scoping
  - eligible schedule statuses
  - positive commission-difference filter
  - Pass B minimum confidence floor (`0.50`)
- FIFO ordering logic:
  - unchanged sort in `sortCandidatesWithFIFO(...)`
  - still `matchConfidence desc`, then `scheduleDate asc`, then `createdAt asc`

## Test Coverage Added
- File updated: `tests/integration-reconciliation-candidates.test.ts`
- Added:
  - `REC-AUTO-16`: validates strong-ID fuzzy candidates clear default suggested threshold (`>= 0.70`) without lowering user settings.
  - `REC-AUTO-17`: validates FIFO tie-break order remains oldest-first when confidence ties.
