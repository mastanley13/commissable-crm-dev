# CRM-DOC-PROPAGATION-UNDO - Deposit -> Opportunity -> Product Catalog + Undo Contract

Last updated: 2026-02-09
Status: Draft implementation write-up

## Purpose

Define exactly how deposit matching writes data across entities, and define what Undo must revert so data integrity holds end-to-end (including product catalog updates).

## Scope

In scope:

- Manual match apply (single-line and match-group apply)
- Auto-match apply
- Auto-fill side effects from matching
- Undo paths for matched allocations and auto-filled fields

Out of scope:

- Flex bundle rip/replace deep behavior
- Deposit finalize/reopen semantics

## Matching Write Path (What gets updated)

### 1) Allocation records

On match apply, system creates or updates `DepositLineMatch` rows (`Applied`, source `Manual` or `Auto`).

- Group flow: `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts`
- Single-line flow: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts`
- Auto-match flow: `app/api/reconciliation/deposits/[depositId]/auto-match/route.ts`

### 2) Deposit line recompute

After allocation write, `recomputeDepositLineItemAllocations(...)` recalculates:

- `status` (`Unmatched` / `PartiallyMatched` / `Matched`)
- `primaryRevenueScheduleId`
- `usageAllocated`, `usageUnallocated`
- `commissionAllocated`, `commissionUnallocated`

File: `lib/matching/deposit-line-allocations.ts`

### 3) Revenue schedule recompute

`recomputeRevenueScheduleFromMatches(...)` / `recomputeRevenueSchedules(...)` recalculates:

- `actualUsage`, `actualCommission`
- `status` (`Unreconciled` / `Reconciled` / `Underpaid` / `Overpaid`)
- auto billing status updates (when enabled and source is `Auto`)

File: `lib/matching/revenue-schedule-status.ts`

### 4) Deposit aggregate recompute

`recomputeDepositAggregates(...)` recalculates:

- item counts and reconciliation readiness fields
- usage/commission totals + allocated/unallocated totals
- deposit `status` (`Pending`/`InReview`; no auto-complete)

File: `lib/matching/deposit-aggregates.ts`

### 5) Auto-fill propagation from deposit line -> opportunity + product catalog

When a match is applied, `autoFillFromDepositMatch(...)` attempts to fill empty fields on linked records:

Target record lookup path:

- Opportunity target: `RevenueSchedule.opportunityId`
- Product catalog target: `RevenueSchedule.productId`

Field mapping:

- `DepositLineItem.accountIdVendor` -> `Opportunity.accountIdVendor`
- `DepositLineItem.customerIdVendor` -> `Opportunity.customerIdVendor`
- `DepositLineItem.orderIdVendor` -> `Opportunity.orderIdVendor`
- `DepositLineItem.productNameRaw` -> `Product.productNameVendor`
- `DepositLineItem.partNumberRaw` -> `Product.partNumberVendor`

Rules:

- Canonicalize multi-values before write (IDs/text normalization)
- Fill only when target field is currently empty
- Never overwrite non-empty target fields
- Write audit log entry with `metadata.action = "AutoFillFromDepositMatch"`

File: `lib/matching/auto-fill.ts`

## Undo Contract (What Undo must revert)

Undo must revert all effects of match apply in this order:

1. Reverse auto-fill side effects on Opportunity and Product (catalog) fields that were created by the matched allocation action.
2. Restore previous allocation state for any pre-existing pair touched by apply.
3. Remove allocations that belong to the undone apply.
4. Recompute deposit lines, schedules, and deposit aggregates.
5. Persist full audit trail of the undo operation and any skipped/conflicted field undo.

### Auto-fill undo safety rules

Undo of auto-fill is allowed only for audit rows with:

- `metadata.action = "AutoFillFromDepositMatch"`
- entity type in `{ Opportunity, Product }`
- allowed fields only:
  - Opportunity: `accountIdVendor`, `customerIdVendor`, `orderIdVendor`
  - Product: `productNameVendor`, `partNumberVendor`

Undo must be conflict-safe:

- If current entity value no longer equals the audit entry `newValues`, do not revert that field (`UNDO_CONFLICT`).
- If entity is missing, report (`ENTITY_NOT_FOUND`).
- On success, write a new audit entry with `metadata.action = "UndoAutoFillFromDepositMatch"`.

File: `lib/audit/undo-auto-fill.ts`

## Current Undo Implementations vs Required Behavior

### A) Match-group Undo (closest to required behavior)

Endpoint: `app/api/reconciliation/deposits/[depositId]/matches/[matchGroupId]/undo/route.ts`

Current behavior:

- Finds auto-fill audit logs tied to the match group apply
- Calls `undoAutoFillAuditLog(...)` for each log (with conflict handling)
- Restores pre-existing pair snapshots (`existingMatchesBefore`) when present
- Deletes group-owned matches
- Marks group `Undone` with reason/user/timestamp
- Recomputes line/schedule/deposit aggregates
- Audits `UndoMatchGroup`

This path already includes catalog-field revert attempts.

### B) Single-line Unmatch (gap)

Endpoint: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts`

Current behavior:

- Deletes all line matches
- Resets line allocation/status fields
- Recomputes schedules/deposit
- Does not undo prior `AutoFillFromDepositMatch` writes to Opportunity/Product

Gap:

- Violates "Undo reverts all side effects" if auto-fill occurred.

### C) Bulk Undo Deposit Match (gap)

Endpoint: `app/api/revenue-schedules/bulk/undo-deposit-match/route.ts`

Current behavior:

- Deletes line matches and recomputes totals/status
- Does not undo prior `AutoFillFromDepositMatch` writes to Opportunity/Product

Gap:

- Same data-integrity hole as single-line unmatch for catalog/opportunity auto-fill.

## Required Alignment to Meet Rob's Requirement

To satisfy "Undo must revert all changes (including catalog updates)":

1. Route all undo flows through the same auto-fill undo contract used by match-group undo, or
2. Extend line/bulk undo endpoints to explicitly discover and undo `AutoFillFromDepositMatch` audit rows scoped to removed `DepositLineMatch` ids.

Non-negotiable safeguards:

- Revert only fields written by that match action (no broad rollback).
- Keep conflict-safe behavior (never clobber newer user edits).
- Always emit explicit audit events for undo attempts and outcomes.

## Acceptance Checklist

- Undoing a match that auto-filled Opportunity IDs reverts those IDs if unchanged.
- Undoing a match that auto-filled Product alias/part fields reverts catalog fields if unchanged.
- If user edited a field after auto-fill, undo reports conflict and leaves user edit intact.
- Allocation, line status, schedule actuals/status, and deposit aggregates all recompute correctly after undo.
- Audit logs clearly link apply and undo actions with per-field outcomes.
