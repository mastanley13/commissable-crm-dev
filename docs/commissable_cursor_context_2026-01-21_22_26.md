# Commissable CRM — Cursor Context Pack (for coding agent)
Meetings covered: **2026-01-21**, **2026-01-22**, **2026-01-26**
Generated: **2026-02-02**

## What this is
A compact, implementation-ready pack you can keep open in Cursor alongside a coding agent.

## Ground rules (source-of-truth)
- Only requirements explicitly stated in the 3 meeting transcripts/summaries are considered “locked.”
- Anything tagged **ASSUMED** is a best-effort interpretation and should be confirmed.

---

## 1) High-level deliverables the code should support (from these meetings)
### Deposit Upload & Mapping
- Mapping UI upgrades: Suggested Match column, prevent duplicate maps, taller table.
- Mapping review UI: Mapped/Unmapped tabs, 3-col layout, row counts, remove sample rows.
- Remove separate “Review” step; merge into the mapping page.
- Disable auto-select of the first deposit line item in detail/reconciliation views.
- **Multi-vendor** upload option: single report containing multiple vendors; use per-row vendor name to pick template; ignore “Total” rows.
- Deposit verification workflow: store actual bank received values (date/amount/received-by) alongside vendor report info.
- Deposit detail vendor summary widget (progress by vendor).
- **PDF handling** in deposit workflow (**ASSUMED** whether this means upload support, export, or both).

### Reconciliation UI / Workbench
- Multi-select on reconciliation page.
- Default reconciliation view = Unmatched; remove Suggested tab.
- Fix reconciliation summary scrollbar.
- Frozen/locked compare columns so key columns stay visible; provide a lock/toggle; sync horizontal scroll between top/bottom grids.
- Fix column wrapping/currency formatting.
- Bottom grid must respond to top filters dynamically (no stale results).
- Fix commission rate display/calculation in reconciliation.
- Add Account Legal Name to mapping options and surface Account Name in the bottom grid.

### Matching Logic & Workflows
- Fix matching logic failures and ensure Account Legal Name + Order/Customer/House IDs are used.
- Create/agree on bundle/split rules for 1:M, M:1, M:M.
- Add match-type detection + wizard for non-1:1 matches (with progress indicator).
- Support comma-separated IDs parsing (no-space), allow admin edits, and ensure undo/unmatch reverses any metadata updates.
- Build test schedules (e.g., VoIP) + test scripts to validate matching; diagnose “Unmatched schedules” not showing.

### Flex / Chargebacks / Collections / Status model
- Chargebacks: manager approval workflow; status label should be “In Dispute.”
- Collections workflow triggered from Underpaid status.
- Billing Status field: consistent values across product, schedule, deposit line, deposit, and reconciliation screens.
- Flex resolution workflow: one-time vs recurring; if recurring, create additional schedules; require family/subtype prompt when renaming.

### Revenue schedules / Opportunities
- Fix “Go to revenue schedule” link.
- Add “Extend Contract” action on Opportunity → Revenue Schedules.
- Add “Change Start Date” tab (single-product); require reason.
- Add “Number of Periods” column to Opportunity Products tab.

### Tickets module
- Add ticket fields: Vendor Ticket ID, Vendor Contact (lookup).
- Relabel: Ticket ID → House Ticket Number; Owner → Created By.

### QA/UAT and migration
- Share manual + automated UAT checklists.
- Run end-to-end reconciliation test with Debra using real files and log defects.
- Data migration strategy idea: create a placeholder “Historical Transaction” product per account to avoid recreating historical product-level details.

---

## 2) Entity model (minimal mental model)
Keep these names aligned with the existing codebase:

- **Deposit**: header record for a vendor/distributor payment batch.
  - Key fields mentioned here: Report Date (vendor report date), Payment Received Date, Actual Confirmed Deposit Amount, Received By.
  - Multi-vendor deposits: vendor field at the deposit header may be “Multi-Vendor” while each line has a vendor.

- **DepositLineItem**: rows from the uploaded vendor report.
  - Needs multi-select and matching to revenue schedules.
  - Mapping options include Account Legal Name.

- **RevenueSchedule**: expected monthly (or one-time) commission events.
  - Must be filterable in the bottom grid in response to top filters.

- **Opportunity / Product**: used to generate schedules; needs “Number of Periods” visible and extension actions.

- **Ticket**: internal ticket tracking; now needs vendor ticket metadata.

---

## 3) Critical UI behaviors (spell them out for the agent)
### 3.1 Deposit mapping screen
- Show row-level Suggested Match.
- Prevent mapping duplicate system fields.
- No separate “Review” step.

### 3.2 Deposit detail screen
- DO NOT auto-select a line item.
- Add deposit verification fields.
- Add vendor summary widget for vendor-by-vendor reconciliation.

### 3.3 Reconciliation workbench
- Default tab/view = Unmatched (and Suggested tab removed).
- Multi-select enabled.
- When top filters change, bottom grid updates immediately.
- Provide a “lock comparison view” toggle:
  - Locks a small set of key columns.
  - Top/bottom grid columns align and share a horizontal scrollbar.

---

## 4) Matching + wizard triggers (implementation notes)
### Match-type detection
Compute match type from selected sets:
- 1:1 => 1 deposit line + 1 schedule
- 1:M => 1 deposit line + N schedules
- M:1 => N deposit lines + 1 schedule
- M:M => N deposit lines + N schedules

When user clicks **Match**:
- If 1:1, proceed as today.
- Else: open wizard with appropriate steps and validations.

### Comma-separated ID handling
- Parse `A,B,C` (trim spaces defensively).
- Store canonical form (**ASSUMED**): array-of-strings in DB; render as chips or comma-separated.
- On match/unmatch, any appended metadata must be reversible.

---

## 5) Status model work you’ll likely need
### Billing Status
A dedicated “Billing Status” field was requested; exact enum values are NOT specified in the meetings.
- **ASSUMED**: create a small enum now (e.g., Billing, Not Billing, Pending, Unknown) and confirm.

### Chargebacks
- Chargebacks should be treated as “In Dispute” and require manager approval.

### Underpaid / Collections
- When an item becomes Underpaid, the app should offer/trigger a collections workflow.
- **ASSUMED**: this could be implemented as a Ticket creation + status progression.

---

## 6) Data migration note
Proposed strategy for customers who only have account-level historical tracking:
- Create a placeholder product per account (e.g., “Historical Transaction”).
- Each month of historical payment becomes a schedule/payment row under that product.
- Users can later refine and reclassify.

---

## 7) Suggested acceptance tests (copy/paste for QA tickets)
### A) Single-vendor deposit upload
1) Upload CSV/XLSX.
2) Map fields (confirm Suggested Match appears; ensure duplicate mapping prevented).
3) Complete mapping on one page (no separate Review step).
4) Confirm deposit + line items created.

### B) Multi-vendor deposit upload
1) Upload a multi-vendor report.
2) Toggle Multi-vendor.
3) Confirm “Total” rows skipped.
4) Confirm each line item gets the correct vendor template.

### C) Reconciliation multi-select + match wizard
1) Select multiple deposit lines.
2) Click Match; confirm wizard launches and match-type is correct.
3) Complete wizard and confirm allocations.

### D) Chargeback manager approval
1) Create a negative/chargeback scenario.
2) Confirm status “In Dispute.”
3) Confirm manager approval UI blocks completion until approved.

### E) Flex resolution
1) Trigger a Flex.
2) Resolve as one-time: no additional schedules created.
3) Resolve as recurring: schedules created.
4) Rename path requires family/subtype.

---

## 8) Open questions to confirm (don’t let agent guess)
1) “PDF handling” in deposit workflow: upload support, export, or both?
2) Billing Status: required enum values and what drives them.
3) Collections workflow: what artifacts are created (Ticket? Task? Status-only?)
4) Bundle/split rules: concrete examples to encode (especially many-to-many).
5) Frozen columns: exact set of “key columns” to lock (Rob to provide screenshot).
