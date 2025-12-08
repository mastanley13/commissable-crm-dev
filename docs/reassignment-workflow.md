## Account Reassignment Workflow

### Overview
- Purpose: bulk-move accounts (and future-dated related items) to a new owner, House, or Unassigned with optional commission handling.
- Entry point: `Accounts` list → `Reassign Accounts` bulk action → `AccountReassignmentModal`.
- Key APIs: `/api/accounts/reassignment-preview` (impact only), `/api/accounts/bulk-reassign` (executes).

### Roles & Permissions
- Requires both `accounts.reassign` and `accounts.bulk`.
- Only manager-level roles pass the server-side `validateManagerReassignmentPermission`.

### UI Flow (AccountReassignmentModal)
1) **Selection step**
   - Inputs: `newOwnerId`, `assignmentRole`, `effectiveDate` (defaults to 1st of next month), `transferCommissions`, `notifyUsers`, `commissionOption` (`transferToNewRep` | `transferToHouse`), `houseDummyRepId` (only when assigning to House and a dummy rep is needed), optional reason.
2) **Preview step**
   - Calls `/api/accounts/reassignment-preview` with `accountIds`, `newOwnerId`, `effectiveDate`.
   - Shows counts, associated items, commission transfers, warnings/conflicts.
3) **Confirm step**
   - Sends payload to `/api/accounts/bulk-reassign` and shows summary.

### API Contracts
**POST** `/api/accounts/reassignment-preview`
- Request: `{ accountIds: string[]; newOwnerId: string; effectiveDate: string }`
- Response highlights: `accountsByOwner`, `revenueImpact`, `commissionTransfers`, `warnings`, `conflicts`, `itemCounts`, `portfolioSummary`, `transferAssociations`.

**POST** `/api/accounts/bulk-reassign`
- Request: `{ accountIds, newOwnerId, assignmentRole, effectiveDate, transferCommissions, notifyUsers, reason?, commissionOption?, houseDummyRepId? }`
- Server steps:
  - Validations: permissions, accounts exist, new owner allowed/active (unless House/Unassigned), effective date valid.
  - Calculates commission impact (for summary) via `calculateCommissionImpact`.
  - Transaction per account:
    - Update `account.ownerId`.
    - Special user handling (`house`/`unassigned`) via `handleSpecialUserAssignment`; otherwise upsert `AccountAssignment`.
    - Commission transfer logic (if `transferCommissions`):
      - Always updates future-dated revenue schedules (metadata).
      - Future opportunities:
        - If `newOwnerId !== 'house'`: set `ownerId` to new owner (or `null` when house path not used).
        - If `newOwnerId === 'house'`: zero out `houseRepPercent`, add that percent into `houseSplitPercent` (clamped 0–1), set `ownerId` to `null`. This satisfies “set previous House Rep % to 0 and give House the transferred share.”
    - Audit log via `logAccountReassignment`.
  - Notifications sent after commit when `notifyUsers` is true.

### Commission Handling Notes
- `commissionOption` UI toggle exists; server currently applies the House transfer behavior when `newOwnerId === 'house'` and `transferCommissions` is true.
- Percent math helpers clamp to 0–1 to avoid over/underflow.
- Existing `houseSplitPercent` respected when present; otherwise computed as `1 - (subagent + houseRep)`.

### Data Touched
- `Account.ownerId`
- `AccountAssignment` (upsert or cleared for special users)
- `Opportunity.ownerId` (future-dated opportunities)
- `Opportunity.houseRepPercent`, `Opportunity.houseSplitPercent` (House transfers)
- `RevenueSchedule` future rows (metadata timestamps)
- Audit log rows; optional notifications

### Edge Cases / Warnings
- `newOwnerId = house` → warning about commission impacts.
- `newOwnerId = unassigned` → warning about reporting impacts.
- Accounts already owned by target owner → warning.
- High-value accounts → warning.
- Effective date must be valid ISO date; future-dated logic relies on it.

### How to Validate Quickly (manual)
- Assign to House with a future opportunity having `houseRepPercent > 0`; after call, confirm that opportunity shows `houseRepPercent = 0`, `houseSplitPercent` increased by the same amount, and `ownerId = null`.
- Assign to a regular rep; ensure opportunity `ownerId` updates and commission percents remain unchanged.
- Toggle `transferCommissions` off to ensure no commission-field updates occur.

### References
- UI: `components/account-reassignment-modal.tsx`
- Page integration: `app/(dashboard)/accounts/page.tsx`
- Preview API: `app/api/accounts/reassignment-preview/route.ts`
- Bulk API: `app/api/accounts/bulk-reassign/route.ts`
- Special users: `lib/special-users.ts`
- Commission math helpers added in bulk route for House transfers.

