# Recent Project Updates (last ~2–7 days)

Date window covered (per Git on `main`): **2026-01-02 → 2026-01-05**  
Commits included: `63dd005`, `9477951`, `b9d12e1`, `697bf76`, `df747b1`, `c302e44`, `a40fbda`, `050279d`, `f697e06`, `08afad3`, `d9880b6`, `73184d9`, `2caa0c3`, `cb72ad6`, `46ac604`, `6176c14`, `7c8e6fb`

## Accounts

### Account Details → Opportunities tab

- **Close Date formatting:** renders as `YYYY-MM-DD` (ISO date-only) for consistent display/export.
- **Referred By now shows names (not UUIDs):** when `Opportunity.referredBy` contains a Contact UUID, the Account Details payload resolves it to the Contact `fullName` so the table displays a human name.
- **Table UX + bulk:** selection, bulk actions, CSV export, and consistent column rendering (incl. date + percent fields).

### Archived Accounts (Admin → Archive)

Updated `Archived Accounts` table to match the “standard table” UX pattern:

- **Working sort** (client-side state + server fetch).
- **Column filters UI** (simple per-column filters).
- **Status / quick filter** (`active` / `inactive` / `all`).
- **Column settings + persisted preferences** (via `useTablePreferences`).
- **Drag reorder + resize** columns (via `DynamicTable`).
- **Bulk actions:** Restore, Export CSV, Permanent Delete (permission-gated).
- **Row navigation:** account name links to the detail page.
- **Row-level actions:** Restore + Delete are icon buttons inside the selection column.

## Contacts

### Archived Contacts (Admin → Archive)

Same table feature set as Archived Accounts, adapted for Contact fields:

- Sort, search, column filters, quick filter
- Column settings + persisted preferences
- Drag reorder + resize
- Bulk actions (restore/export/delete) + row-level actions in the selection column

## Opportunities

### Opportunity Details page

- **Date input normalized:** estimated close date uses an ISO-friendly `YYYY-MM-DD` input bridge (validation + parsing), reducing locale ambiguity.
- **Referred By editing:** “Referred By” supports searching/selecting contacts (sets the field to the selected contact label for display).
- **Revenue schedules tab:** aligned to the deterministic default sort order (Distributor → Vendor → Opportunity → Product → Schedule Date, then schedule # / ID tie-breakers).

### Opportunity → Products → “Create New Product” / Add Line Item

- **Vendor/Distributor preflight:** before creating a product, validates the distributor/vendor pair against the Opportunity’s “single pair” rule to avoid creating a product that can’t be attached.
- **Improved defaults + fewer “can’t submit” states:** percent fields in the Account-scoped “New Opportunity” modal default to `"0.00"` so House Split displays as expected without forcing user edits.
- **Default Owner behavior:** the Account-scoped “New Opportunity” modal prefers the related Account’s `ownerId` when setting the default owner.
- **Subagent selection fix:** selecting a subagent sets `subagentContactId` to the selected option id (instead of losing the id).

### Canonical Vendor/Distributor context endpoint

- Added `GET /api/opportunities/[opportunityId]/vendor-distributor` to derive a “locked” vendor/distributor context from existing line items (and fall back to “None Direct Distributor” when only vendor exists).

## Products & Picklists

### Product A–Z sorting (case-insensitive, numeric aware)

- **Picklist sorting is now consistent:** added `lib/picklist-sort.ts` (Intl.Collator-based) plus tests.
- **Admin Data Settings:** keeps Product Families/Subtypes sorted immediately after create/update/toggle so new options insert into the correct alphabetical position.
- **Product dropdown consumers:** explicitly sort received master data for safety/consistency.

### “New Product popup without Vendor/Distributor” note

- Added a design note exploring whether vendor/distributor fields can be removed from the New Product flow and outlining a recommended long-term model split (canonical product vs channel mappings).

## Revenue Schedules

### Deterministic default sorting

- **Revenue Schedules main list:** default sort is deterministic and stable:
  - Distributor → Vendor → Opportunity → Product → Schedule Date → Revenue Schedule/Name → ID
- **Opportunity Details → Revenue Schedules tab:** applies the same sort with schedule # / ID tie-breakers.
- **Default column order** (for users without saved preferences): Select All → Status → Distributor → Vendor → Opportunity → Product → Schedule Date.

### Math + formulas

- Extracted and centralized revenue-schedule math helpers into `lib/revenue-schedule-math.ts` with unit tests (`tests/revenue-schedule-math.test.ts`).

## Reports

- Added a **Report Detail** page (`/reports/[reportId]`) with breadcrumbs and an API route (`/api/reports/[reportId]`) backed by a lightweight in-memory store (`lib/reports-store.ts`).
- Updated the Reports list page + API route wiring to support the new detail view.

## Admin / Archive expansion

Added or expanded archive pages under `app/(dashboard)/admin/archive/*`:

- Accounts, Contacts, Activities, Groups, Opportunities, Products, Revenue Schedules, Tickets, Reports
- Each page follows the “standard table” pattern: filters, persisted column prefs, bulk actions, and restore/permanent-delete flows.

## UI / Modal standardization + QOL

- **Modal headers standardized:** introduced `components/ui/modal-header.tsx` and updated many modals to use a consistent “kicker + title” header structure.
- **Toast flicker QOL:** updated toast rendering to reduce re-render/flicker behavior (stable container refs + consistent viewport rendering).
- **Two-stage delete dialogs:** expanded usage of `TwoStageDeleteDialog` and related deletion workflows across entities.

## Dev tooling / docs

- Added/updated internal notes: application review, delete workflow review, archive table notes, and stage rules.
- Added scripts supporting admin/deletion workflows (e.g., reconciliation permission utility, deletion blocker reporting).

