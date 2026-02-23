# Entity Lifecycle (Deactivation, Archival/Soft Delete, Permanent Delete)

Last updated: 2026-02-19

This document explains how “deactivate”, “delete/archive (soft delete)”, and “permanent delete” work in Commissable CRM, and what downstream effects to expect (DB constraints, what gets blocked, what gets orphaned, and what background automation still runs).

It is written from the perspective of **what the code currently does**, with pointers to the **source-of-truth files**.

---

## Table of contents

- [Glossary](#glossary)
- [Source of truth](#source-of-truth)
- [Mental model](#mental-model)
- [Data model + referential actions](#data-model--referential-actions)
- [Lifecycle behavior by entity](#lifecycle-behavior-by-entity)
  - [Accounts](#accounts)
  - [Contacts](#contacts)
  - [Opportunities](#opportunities)
  - [Opportunity Products (line items)](#opportunity-products-line-items)
  - [Revenue Schedules](#revenue-schedules)
  - [Deposits + matching + reconciliation](#deposits--matching--reconciliation)
  - [Groups](#groups)
  - [Activities](#activities)
  - [Tickets](#tickets)
- [Visibility rules (what shows up where)](#visibility-rules-what-shows-up-where)
- [Automation / background jobs](#automation--background-jobs)
  - [Month-to-month schedule runner](#month-to-month-schedule-runner)
  - [Flex review digest runner](#flex-review-digest-runner)
  - [Reassignment runner + commission engine](#reassignment-runner--commission-engine)
- [Caching + audit logging](#caching--audit-logging)
- [Common failure modes](#common-failure-modes)
- [Practical “how do I delete X” checklists](#practical-how-do-i-delete-x-checklists)

---

## Glossary

**Deactivate**
- “Make it inactive” but keep the row and its relationships.
- Typically flips a boolean (`active`, `isActive`) or a status enum (`Account.status`).

**Soft delete / archive**
- Hide from normal lists and treat as deleted, but keep the row in the database.
- Implemented either as `deletedAt` timestamps (e.g., `Contact.deletedAt`) or as a terminal status (e.g., `Account.status = Archived`).

**Permanent delete**
- Physically remove the row from the database.
- Only possible when referential constraints are satisfied (or when code proactively deletes dependent rows).

**Blocking constraint**
- A business rule or a database FK rule that prevents an operation from completing. In API responses this is commonly surfaced as an HTTP `409` with a human-readable message.

**Orphan**
- A record that remains after a related entity was deleted, with its foreign key set to `NULL` (possible when the FK is optional/nullable).

---

## Source of truth

When in doubt, start here:

- Database schema (relationships + nullability): `prisma/schema.prisma`
- Account deletion system (constraints + delete/restore helpers): `lib/deletion.ts`
- Account API (deactivate, archive, permanent delete): `app/api/accounts/[accountId]/route.ts`
- Contact API (soft + permanent delete, restore): `app/api/contacts/[id]/route.ts`
- Opportunity API (deactivate + permanent delete): `app/api/opportunities/[opportunityId]/route.ts`
- Opportunity line item API (deactivate + delete + schedule cleanup): `app/api/opportunities/line-items/[lineItemId]/route.ts`
- Revenue schedule API (soft + permanent delete): `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
- Ticket API (close/reopen + delete): `app/api/tickets/[ticketId]/route.ts`
- Group API (toggle isActive + delete): `app/api/groups/[id]/route.ts`
- Month-to-month automation: `jobs/month-to-month-schedule-runner.ts`

Operational helpers:
- Report account delete blockers: `scripts/report-account-deletion-blockers.ts`
- UI “row inactive?” helper (affects delete controls): `lib/row-state.ts`

---

## Mental model

There are three overlapping layers to understand:

1) **Business rules (application-level)**
   - “You must deactivate the account before you can archive it”
   - “You cannot delete a revenue schedule if it has applied monies”
   - Implemented in API routes and helper libraries.

2) **Database referential integrity (FK constraints)**
   - Required/nonnull foreign keys will block deletes unless dependents are deleted first.
   - Optional/nullable foreign keys usually allow deletes by setting the FK to `NULL` (or by cascading), depending on migration referential actions.

3) **List filtering + UX**
   - Entities that are archived/soft-deleted are often hidden by default from lists and pickers.
   - Some endpoints do *not* filter out deleted records (ex: global search), which can create “it still shows up” surprises.

Practical implication:
- “Deactivate” mostly changes **visibility and eligibility**.
- “Archive/soft delete” often unlocks **cleanup paths** and UI delete controls.
- “Permanent delete” is an **administrative, constraint-heavy, multi-step process**.

---

## Lifecycle matrix (quick reference)

This table answers: “What is the state field?”, “How do we deactivate?”, “Is there soft delete?”, “How do we permanently delete?”, and “What usually blocks it?”

| Entity | “Active” state | Deactivate action | Soft delete / archive | Permanent delete | Common blockers / gotchas |
|---|---|---|---|---|---|
| Account | `status === Active` | `PATCH` → `status = Inactive` | `DELETE (stage=soft)` → `status = Archived` | `DELETE?stage=permanent` | Contacts + Opportunities + RevenueSchedules + Deposits + Reconciliations are required dependents |
| Contact | `deletedAt == null` | N/A (no `active` flag) | `DELETE?stage=soft` → set `deletedAt` | `DELETE?stage=permanent` | Soft delete blocked by Activities/Groups and (currently) *any* Opportunities on the account |
| Opportunity | `active === true` (plus stage/status) | `PATCH { active:false }` | N/A (no opportunity soft delete) | `DELETE` | Active line items block; delete can orphan schedules/tickets/activities via nullable FKs |
| OpportunityProduct | `active === true` | `PATCH { active:false }` | N/A | `DELETE` | Delete blocked if related schedules have monies/matches/recon/deposit links; delete can remove schedules |
| RevenueSchedule | `deletedAt == null` | N/A | `DELETE` → set `deletedAt` | `DELETE?stage=permanent` | Any monies/matches/recon/deposit links block even soft delete; payouts/tickets/activities also block permanent |
| Ticket | `status != Closed` (or `active=true`) | `PATCH { active:false }` → `status=Closed` | N/A | `DELETE` | Can block revenue schedule permanent delete if it references the schedule |
| Group | `isActive === true` | `PATCH { isActive:false }` | N/A | `DELETE` | Delete blocked by members unless `force=true` |

Notes:
- “Soft delete” is implemented inconsistently across entities (status enums vs `deletedAt` vs no soft delete at all).
- Some “delete” endpoints are permanent-only (Opportunities, Tickets, Groups).

---

## Data model + referential actions

The schema is Prisma (Postgres). In `prisma/schema.prisma`, relationships are expressed via required vs optional FK fields:

- Required FK (e.g., `Contact.accountId String @db.Uuid`)
  - Deleting the parent usually **fails** unless the dependent row is deleted first.
  - Example: Accounts cannot be deleted while Contacts exist because `Contact.accountId` is required.

- Optional FK (e.g., `Activity.accountId String? @db.Uuid`)
  - Deleting the parent often **succeeds** and the dependent FK is set to `NULL` (depending on the migration’s referential action).
  - Example: Activities can remain after an Opportunity is deleted, but become detached.

There are a few explicit `onDelete` actions in the schema:
- `ActivityLink.activity` and `ActivityAttachment.activity` are `onDelete: Cascade` (deleting an Activity deletes its links/attachments).
- `CommissionPayout.revenueSchedule` is `onDelete: Cascade` (deleting a RevenueSchedule deletes its payouts).
- `DepositLineMatch.matchGroup` is `onDelete: SetNull` (deleting a match group preserves matches).

Even when the DB would allow a delete via `SET NULL` or `CASCADE`, the API may still block it for business reasons.

---

## Deletion helpers caveat (`lib/deletion.ts`)

`lib/deletion.ts` defines generic helpers and mappings for multiple entity types (Account, Contact, Opportunity, Ticket, Group, User), but **only Accounts currently use these helpers in the API** (`app/api/accounts/[accountId]/route.ts`).

Important: some mappings in `lib/deletion.ts` refer to `deletedAt` on entities that **do not have a `deletedAt` column in the current Prisma schema** (for example `Opportunity`, `Ticket`, and `Group`).

Treat `lib/deletion.ts` as:
- authoritative for **Account** archive/permanent delete behavior, because it is actively used
- informational (and potentially stale) for other entities unless/until those helpers are wired into their API routes

---

## Lifecycle behavior by entity

### Accounts

**State field**
- `Account.status: AccountStatus` (`Active`, `Inactive`, `Prospect`, `Archived`) in `prisma/schema.prisma`.

**Key relationships (why accounts are hard to delete)**
- Required dependents (must be removed first):
  - `Contact.accountId` (required)
  - `Opportunity.accountId` (required)
  - `RevenueSchedule.accountId` (required)
  - `Deposit.accountId` (required)
  - `Reconciliation.accountId` (required)
  - `ReconciliationTemplate.distributorAccountId/vendorAccountId` (required)
- Optional dependents (often become `NULL`/orphaned):
  - `Activity.accountId`
  - `Ticket.accountId`, `Ticket.vendorAccountId`, `Ticket.distributorAccountId`
  - `GroupMember.accountId`
  - `Product.vendorAccountId/distributorAccountId`
  - `DepositLineItem.accountId/vendorAccountId`

**Deactivate**
- API: `PATCH /api/accounts/:accountId` with `{ active: false }`
- Effect: sets `Account.status = Inactive`.
- Downstream effects:
  - Many pickers/selectors only include active accounts (ex: vendor/distributor options for products in `app/api/products/options/route.ts`).
  - No child data is modified.

**Soft delete / archive**
- API: `DELETE /api/accounts/:accountId` (default `stage=soft`)
- Business rules:
  - If `status === Active`, the API refuses (you must deactivate first).
  - It checks deletion constraints unless `bypassConstraints=true`.
  - Constraints are implemented in `lib/deletion.ts` under `RelationshipChecks.Account` and include:
    - active contacts (`Contact.deletedAt = null`)
    - open/on-hold opportunities (by `Opportunity.status`)
    - “billing” opportunities (by `Opportunity.status = Won`)
    - child accounts
    - active/unreconciled revenue schedules (`RevenueSchedule.deletedAt = null` and status in `Unreconciled|Underpaid|Overpaid`)
- Effect: sets `Account.status = Archived`.
- Downstream effects:
  - Archived accounts are hidden by default from the Accounts list API unless explicitly included (`app/api/accounts/route.ts`).
  - Account detail intentionally allows showing archived contacts if the account is archived, to support cleanup (`app/api/accounts/[accountId]/route.ts`).

**Restore**
- API: `PATCH /api/accounts/:accountId` with `{ action: "restore" }`
- Effect: sets `Account.status = Active` via `restoreEntity('Account', ...)` (`lib/deletion.ts`).

**Permanent delete**
- API: `DELETE /api/accounts/:accountId?stage=permanent`
- Preconditions:
  - Requires `accounts.delete` permission.
  - The account must already be archived.
  - `lib/deletion.ts` blocks if the account still has:
    - active contacts
    - active opportunities (`Opportunity.active = true`)
    - any reconciliations
    - active revenue schedules (`deletedAt = null`)
    - any deposits
- Cleanup that is automatically performed during permanent delete (transaction in `lib/deletion.ts`):
  - Deletes `ReconciliationTemplate` rows where this account is distributor/vendor (these are FK required and would block delete).
  - Deletes account assignments + account notes.
  - Deletes archived revenue schedules for this account.
  - Deletes archived contacts for this account, including their `ContactPreference` rows (preferences are FK RESTRICT).
  - Deletes inactive opportunities (`Opportunity.active = false`) for this account, including their dependent roles + products.
  - Finally deletes the Account row.
- Downstream effects you should still expect:
  - Many optional references across the system may be set to `NULL` (activities, tickets, group members, products, deposit line items, etc.).
  - This can leave “dangling” rows whose `memberType` or other metadata still claims a relationship but the FK is null.

**Operational tip**
- If you want to understand why an account cannot be archived, use:
  - `DELETE /api/accounts/:accountId?stage=check` (returns constraints)
  - or `scripts/report-account-deletion-blockers.ts` for batch reporting.

**What gets orphaned when an Account is permanently deleted (expected)**

Because many other tables reference accounts via *nullable* FKs, the account delete can succeed while leaving behind rows that are now detached from an account:

- Activities: `Activity.accountId` is nullable
- Tickets: `Ticket.accountId`, `Ticket.vendorAccountId`, `Ticket.distributorAccountId` are nullable
- Group memberships: `GroupMember.accountId` is nullable
- Products: `Product.vendorAccountId/distributorAccountId` are nullable
- Deposit line items: `DepositLineItem.accountId/vendorAccountId` are nullable

Whether these become `NULL` automatically is controlled by the DB’s referential action (commonly `ON DELETE SET NULL` for nullable FKs). The code does not currently clean these up as part of account permanent deletion.

---

### Contacts

**State field**
- `Contact.deletedAt: DateTime?` in `prisma/schema.prisma`.
  - Active contact: `deletedAt = null`
  - Soft deleted contact: `deletedAt != null`

**Deactivate**
- Contacts don’t have an `active` flag; they are “active” as long as `deletedAt` is `null`.

**Soft delete**
- API: `DELETE /api/contacts/:id?stage=soft[&bypassConstraints=true]`
- Default blockers (unless `bypassConstraints=true` in the query string):
  - Contact has Activities
  - Contact is in Groups
  - The *account* has Opportunities (note: this is account-wide, not contact-specific)
  - Implemented in `app/api/contacts/[id]/route.ts`
- Effect: sets:
  - `deletedAt = now()`
  - `deletedById = currentUserId`
- Downstream effects:
  - Contacts list excludes soft-deleted contacts by default (`app/api/contacts/route.ts`).
  - Some endpoints do not filter out deleted contacts (example: global search suggestions in `app/api/search/route.ts`), so “deleted” contacts may still appear.
  - Contact is “inactive” for UI purposes and will stop appearing in many contact pickers, depending on each endpoint’s filter rules.

**Restore**
- API: `PATCH /api/contacts/:id` with `{ action: "restore" }`
- Effect: sets `deletedAt = null`.

**Permanent delete**
- API: `DELETE /api/contacts/:id?stage=permanent`
- Preconditions:
  - Contact must already be soft deleted (`deletedAt` must be set).
- Cleanup performed during permanent delete:
  - Deletes Activities for the contact (and Activity’s links/attachments cascade at the DB level).
  - Removes Group memberships (`GroupMember` rows with this `contactId`).
  - Deletes `ContactPreference` rows (FK restrict).
  - Deletes the Contact.
- Downstream effects:
  - Optional references from other models (e.g., `Ticket.contactId`, `OpportunityRole.contactId`, `Deposit.createdByContactId`) will remain and often become `NULL` if constrained with `SET NULL`.

**Visibility gotcha: “primary contact” and delete controls**
- The UI uses a shared helper that treats `isPrimary=true` as “active-like” when deciding whether to show certain delete controls (`lib/row-state.ts`).
  - This does not change server-side enforcement, but it changes what actions users can easily discover.

---

### Opportunities

**State fields**
- `Opportunity.stage` (`OpportunityStage`) and `Opportunity.status` (`OpportunityStatus`) exist in schema.
  - Status is largely treated as *derived from stage* in the API.
- `Opportunity.active: boolean` is used for list filtering and for “deactivation”.

**Deactivate / reactivate**
- API: `PATCH /api/opportunities/:opportunityId` with `{ active: false|true }`
- Deactivation blockers (unless `bypassConstraints=true` on the URL):
  - If the opportunity has active/unreconciled revenue schedules, deactivation is refused (`app/api/opportunities/[opportunityId]/route.ts`).
- Reactivation blockers:
  - Terminal stages (`ClosedLost`, `ClosedWon_BillingEnded`) cannot be reactivated.
- Downstream effects:
  - Opportunity lists primarily filter by `active` (with stage-based safety net) in `app/api/opportunities/route.ts`.
  - Deactivating an opportunity does not delete its line items or schedules; it only marks the opportunity as inactive.

**Delete (permanent)**
- API: `DELETE /api/opportunities/:opportunityId`
- Important: there is no “soft delete opportunity” stage in the API. The delete is permanent.
- Guardrails performed before delete:
  - Deletes all `OpportunityRole` rows (they can block deletion).
  - Deletes *inactive* line items (`OpportunityProduct.active = false`).
  - If any *active* line items remain, the delete is blocked with a `409`.
  - Implemented in `app/api/opportunities/[opportunityId]/route.ts`
- Downstream effects / orphans:
  - `RevenueSchedule.opportunityId` is nullable in the schema, so revenue schedules can remain but become detached from the opportunity.
  - `Activity.opportunityId` and `Ticket.opportunityId` are also nullable, so they can remain but become detached.
  - This can make the UI look like “schedules disappeared” even though the schedule still exists (it just no longer points at the opportunity).

**If you need “soft delete opportunity” semantics**
- The current API does not support soft deletion for opportunities.
- The closest equivalent is usually:
  - move the stage to a terminal stage (so it is not “active” by list filters), and/or
  - set `active=false` (subject to revenue-schedule constraints)

---

### Opportunity Products (line items)

**State fields**
- `OpportunityProduct.active: boolean`
- `OpportunityProduct.status: OpportunityProductStatus` (e.g., `Provisioning`, `ActiveBilling`, `BillingEnded`, `Cancelled`)

**Deactivate**
- API: `PATCH /api/opportunities/line-items/:lineItemId` with `{ active: false }`
- Effect: flips the boolean and leaves all related revenue schedules intact.
- Downstream effects:
  - Opportunity deletion only auto-removes *inactive* line items; active ones block.

**Delete (permanent)**
- API: `DELETE /api/opportunities/line-items/:lineItemId`
- Business rules:
  - The server checks related revenue schedules and blocks deletion if any of these are true:
    - schedule has applied monies (actual usage/commission fields non-zero)
    - schedule is referenced by deposit matches
    - schedule is referenced by reconciliation items
    - schedule is referenced as a `primaryRevenueScheduleId` for deposit line items
  - Implemented in `app/api/opportunities/line-items/[lineItemId]/route.ts`
- Cleanup performed during delete (transaction):
  - Deletes related Activities and Tickets for those schedules.
  - Deletes DepositLineMatch + ReconciliationItem rows for those schedules.
  - Unlinks deposit lines by setting `DepositLineItem.primaryRevenueScheduleId = null`.
  - Deletes the RevenueSchedule rows.
  - Deletes the OpportunityProduct itself.

This is one of the few places where deleting a “child” (line item) also deletes a large set of “grandchildren” (schedules, matches, etc.).

---

### Revenue Schedules

Revenue schedules sit at the center of the reconciliation/matching systems, and they also block many delete/deactivate flows.

**State field**
- `RevenueSchedule.deletedAt: DateTime?`

**Soft delete (archive)**
- API: `DELETE /api/revenue-schedules/:revenueScheduleId` (default stage is soft)
- Permissions:
  - Only Admin or Accounting roles can delete schedules (even soft delete).
- Soft-delete blockers:
  - any applied monies (actual usage/commission non-zero)
  - any deposit matches
  - any reconciliation items
  - any linked deposit lines (primary schedule)
- Effect: sets `deletedAt = now()`
- Downstream effects:
  - Many opportunity/account views filter schedules by `deletedAt = null`.

**Permanent delete**
- API: `DELETE /api/revenue-schedules/:revenueScheduleId?stage=permanent`
- Permissions:
  - Admin only.
- Preconditions:
  - The schedule must already be soft deleted (archived).
- Permanent-delete blockers (strict superset of soft blockers):
  - all soft-delete blockers, plus:
  - any Activities linked to the schedule
  - any Tickets linked to the schedule
  - any CommissionPayout rows linked to the schedule (even though the DB relation is `onDelete: Cascade`)
- Effect:
  - The API deletes the schedule row, and the DB cascades to payouts.

---

### Deposits + matching + reconciliation

These entities often don’t have explicit “delete” flows, but they are central in *blocking* deletion of schedules and permanent deletion of accounts.

Key relationships in `prisma/schema.prisma`:
- `Deposit` (required `accountId`) contains:
  - `DepositLineItem[]`
  - `DepositMatchGroup[]`
- `DepositLineItem` may reference:
  - `Deposit` (required)
  - `Account?` and `vendorAccount?` (optional)
  - `primaryRevenueScheduleId?` (optional)
  - `Product?` (optional)
- `DepositLineMatch` links:
  - `DepositLineItem` (required)
  - `RevenueSchedule` (required)
  - `DepositMatchGroup?` (optional, `onDelete: SetNull`)
- `ReconciliationItem` links:
  - `Reconciliation` (required)
  - `RevenueSchedule` (required)

Downstream implications:
- If a revenue schedule is referenced by **any** match or reconciliation item, it cannot be deleted (even soft) via the API.
- If an account has **any** deposits or reconciliations, it cannot be permanently deleted (accounts permanent-delete dependency check).

---

### Groups

**State field**
- `Group.isActive: boolean`

**Deactivate**
- API: `PATCH /api/groups/:id` with `{ isActive: false }`
- Effect: hides the group from “active” contexts, but does not remove memberships.

**Delete (permanent)**
- API: `DELETE /api/groups/:id`
- Default blocker:
  - Group has members (unless `force=true` in the query string).
- Cleanup:
  - Deletes all `GroupMember` rows for the group, then deletes the group in a transaction.

Downstream effects:
- If an Account or Contact is deleted at the DB level and group members are `SET NULL`, you can end up with group member rows that have `memberType` set but `accountId/contactId` missing.

---

### Activities

Activities are not soft-deleted; they are created/updated/deleted as normal rows.

Key notes:
- Activities can be linked to account/contact/opportunity/revenueSchedule (all optional FKs).
- Deleting an Activity cascades to:
  - `ActivityAttachment`
  - `ActivityLink`
  - because both use `onDelete: Cascade` in schema.

Downstream effects:
- Contact soft delete is blocked by Activities unless `bypassConstraints=true`.
- OpportunityProduct deletion may delete Activities that reference revenue schedules being removed.

Workflows:
- Activity create/status-change has in-process “workflow hooks” in `lib/workflows.ts` (currently mostly debug logging).

---

### Tickets

Tickets do not have `deletedAt`; they are closed or deleted.

**Deactivate (close)**
- API: `PATCH /api/tickets/:ticketId` with `{ active: false }`
- Effect: sets `status = Closed` (and sets `closedAt`).

**Delete (permanent)**
- API: `DELETE /api/tickets/:ticketId`
- Effect: deletes the ticket row.

Downstream effects:
- Tickets can reference Account/Contact/Opportunity/RevenueSchedule (all nullable in schema). If those parents are deleted, tickets will generally remain but be detached.
- RevenueSchedule permanent delete is blocked if tickets reference the schedule.

---

## Visibility rules (what shows up where)

Many “downstream effects” are really “this record is still in the DB but it disappeared (or still appears) in some UI surface.” This section summarizes the biggest list/picker/search behaviors.

### Accounts

- Accounts list API: `app/api/accounts/route.ts`
  - Default: excludes `status = Archived`
  - `status=active|inactive|archived` can narrow the list
  - `includeArchived=true` disables the default “hide Archived” behavior
- Account detail API: `app/api/accounts/[accountId]/route.ts`
  - Contacts: filters `deletedAt = null` unless the account itself is archived
  - Opportunities: currently loads *all* opportunities for the account (no `active`/stage filter)
  - Group members + Activities: loads by `accountId` with no “active” filter

### Contacts

- Contacts list API: `app/api/contacts/route.ts`
  - Default: `deletedAt = null`
  - `includeDeleted=true`: show both active + deleted
  - `deletedOnly=true`: show only deleted
- Global search suggestions: `app/api/search/route.ts`
  - Currently does **not** filter contacts by `deletedAt`, so deleted contacts can still appear in suggestions.

### Opportunities

- Opportunities list API: `app/api/opportunities/route.ts`
  - Default: `active=true` and stage not in terminal set (Closed Lost / Billing Ended)
  - `status=inactive`: `active=false` OR stage in terminal set
  - `status=all`: no status filter

### Revenue schedules

- Revenue schedule detail API: `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
  - Non-admin callers typically only see `deletedAt = null` schedules.
  - Admin callers can access deleted schedules (depending on endpoint behavior in the same route file).

### General UI delete controls

- Dynamic tables use `lib/row-state.ts` to decide “inactive enough to allow delete”, including an important Contacts rule:
  - if `isPrimary=true`, the row is treated as “active-like” by default when deciding whether to show delete controls.

---

## Automation / background jobs

### Month-to-month schedule runner

Source: `jobs/month-to-month-schedule-runner.ts`

What it does:
- For each `OpportunityProduct` with:
  - `status = ActiveBilling`
  - and at least one existing revenue schedule with a `scheduleDate`
- It finds the latest schedule and uses it as a template to create a new schedule for the next month (UTC month boundaries).

More detailed behavior (important edge cases):
- The job chooses a single “template schedule” per product:
  - `revenueSchedules.where(scheduleDate != null).orderBy(scheduleDate desc).take(1)`
- It computes the **target month** as the start of the UTC month of the job’s `referenceDate`.
- It compares only the template schedule’s month to the target month:
  - if templateMonth >= targetMonth → skip
  - else → create exactly one new schedule for `targetMonthStart`
- If the system missed running this job for multiple months, it does **not** backfill all missing months; it creates one schedule for the current target month.

Important downstream behaviors:
- The query is keyed on **`OpportunityProduct.status`**, not `OpportunityProduct.active`.
  - If you “deactivate” a line item (`active=false`) but leave `status=ActiveBilling`, this job can still generate new schedules.
- The job does not explicitly filter out:
  - inactive opportunities (`Opportunity.active=false`)
  - archived/inactive accounts (`Account.status != Active`)
- The schedule is created with:
  - `accountId` taken from `Opportunity.accountId`
  - `opportunityId` and `opportunityProductId` pointing at the product/opportunity

Practical guidance:
- If the intent is “stop new schedules”, ensure the product’s **status** is moved out of `ActiveBilling` (or the product is deleted), not just `active=false`.

### Flex review digest runner

Source: `jobs/flex-review-digest-runner.ts`

This job:
- Aggregates open flex review items by tenant/user
- Creates per-manager `Notification` rows (idempotent per day + title)

Deletion relevance:
- Mainly a consumer of data; it does not delete entities.
- If users are deactivated/deleted, notifications still persist.

### Reassignment runner + commission engine

Sources:
- `jobs/reassignment-runner.ts`
- `lib/commission-engine.ts`

Key points:
- Reassignment batch processing reads Opportunities and writes commission change/audit records.
- Deleting an opportunity that is part of a running batch can cause failures (“Opportunity not found”).
- Deactivating an opportunity does not prevent reassignment logic from targeting it unless the scope query filters it out.

---

## Caching + audit logging

**Audit logging**
- Many lifecycle actions write to `AuditLog` via helpers in `lib/audit.ts`.
- Audit logs generally persist even after a record is permanently deleted (because they store `entityId` as an opaque id string).

**Cache invalidation**
- Many API routes call `revalidatePath()` after mutations to avoid stale UI.
- This is especially common on:
  - accounts, contacts, opportunities, groups

---

## Common failure modes

**409 Conflict: “has dependencies”**
- This is usually the API’s business-rule guardrail telling you “resolve these first”.
- Example: revenue schedule delete blocked by deposit matches or reconciliation items.

**Prisma error codes**
- `P2003` / `P2014` generally indicate FK constraint failures (DB-level).
- Some endpoints catch these and convert them to `409` with a guided message; others return `400/500`.

**Surprising “it’s gone from the UI” after deleting a parent**
- Often caused by optional FK detachment (`…Id` becoming `NULL`), not by actual deletion.
  - Example: deleting an Opportunity can detach RevenueSchedules that previously showed under that opportunity.

**Surprising “it still shows up” after deleting**
- Often caused by endpoints that do not filter out archived/soft-deleted records.
  - Example: global search suggestions do not filter Contacts by `deletedAt`.

---

## Practical “how do I delete X” checklists

### Delete an Account (typical safe path)

1) Deactivate the account (`status = Inactive`)
2) Resolve blockers for archiving (soft delete)
   - active contacts (soft delete or reassign)
   - open/on-hold opportunities (close/reassign)
   - won/billing opportunities (complete billing process)
   - child accounts
   - active revenue schedules (reconcile/cancel/archive where allowed)
3) Archive the account (`status = Archived`)
4) If permanent delete is required, resolve permanent-delete dependencies:
   - no deposits
   - no reconciliations
   - no active opportunities (`active=true`)
   - no active contacts (`deletedAt=null`)
   - no active revenue schedules (`deletedAt=null`)
5) Perform permanent delete

### Delete a Contact

1) Soft delete it (`deletedAt = now()`), resolving:
   - activities
   - group memberships
   - (currently) any opportunities on the associated account
2) Permanently delete it (only allowed after soft delete)

### Delete an Opportunity

1) Ensure all active line items are removed or deactivated
2) Delete the opportunity (permanent)
3) If revenue schedules existed, confirm you didn’t unintentionally orphan schedules that you still need linked

### Delete a Revenue Schedule

1) Ensure there are no:
   - applied monies
   - deposit matches
   - reconciliation items
   - linked deposit lines
2) Soft delete (archive) it
3) For permanent delete (admin only), additionally ensure:
   - no activities
   - no tickets
   - no commission payouts
