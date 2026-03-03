# Commission Role - Subject Matter Expert (SME) Quick Update Plan

Date: 2026-03-03

## Summary (what we agreed)
We will support the **Commission Role: Subject Matter Expert** by adding a *simple override aid* at the UI/data-entry level instead of modifying complex commission calculations.

Key decisions:
- Add a checkbox on the **Opportunity** to flag an Opportunity as a **Subject Matter Expert (SME) deal**.
- If SME is enabled on the Opportunity, show a **percentage field per Opportunity Product** (line item) next to **Expected Commission Rate %** on the Opportunity Product Details / Add Product flow.
- The SME percentage is a *multiplier reference* (e.g., **50%** vs normal **100%**) that **reminds** the user how to adjust the Expected Commission Rate %.
- This change **does not** automatically modify commission calculations; users will **manually** update Expected Commission Rate %.
- The SME adjustment impacts only the **specific product/line item** where it is entered; it does not alter overall commission structure.

Note: this is a deal/line-item flag and helper field; it is not intended to replace or modify any existing contact-based `OpportunityRole` records.

## Goals
- Provide a clear, lightweight mechanism for users to record and apply an SME commission adjustment **per product**.
- Avoid adding SME-specific branches to existing commission formulas and downstream calculations.
- Reduce user error by prompting them at the exact point they edit **Expected Commission Rate %**.

## Non-goals
- No automatic recalculation of Expected Commission Rate %.
- No changes to revenue schedule / commission calculation formulas.
- No retroactive updates to existing line items when toggling SME on/off (unless explicitly added later).

## UX / UI changes

### 1) Opportunity-level checkbox
Add: `Subject Matter Expert Deal` (boolean)

Placement (implementation choice):
- Opportunity **edit modal** (source of truth for updating the Opportunity)

Behavior:
- Default: unchecked.
- If checked, enables SME-specific UI on Opportunity Products (see below).

### 2) Opportunity Product "SME %" field (conditional)
Add a percent input displayed **only when** the parent Opportunity has `Subject Matter Expert Deal = true`.

UI location:
- Next to **Expected Commission Rate %** on the Opportunity Product Details / Add Product experience (line item create/edit).

Field label suggestions:
- `SME %` (short)
- `SME Commission %` (clearer)

Field semantics:
- Percent points (e.g., `50.00` means 50%).
- Default for new line items: `100.00` (or blank with placeholder `100.00`).
- Validation: `0.00` to `100.00` (2 decimals).

### 3) Reminder text / tooltip
When SME is enabled on the Opportunity, show contextual helper text near Expected Commission Rate %:

Example copy:
- "SME deal: update Expected Commission Rate % to reflect SME % (e.g., 50% of the standard rate)."
- If SME % is present: "SME deal: set Expected Commission Rate % to reflect SME % (**{SME %}**)."

Notes:
- This should be shown when the user is adding or editing the product (line item), not buried elsewhere.
- Keep it informational; do not block save.

## Data model (proposed)

### Opportunity
Add:
- `isSubjectMatterExpertDeal: Boolean` (default `false`)

### OpportunityProduct (line item)
Add:
- `subjectMatterExpertPercent: Decimal?` (percent points, 2 decimals)

Rationale:
- Storing SME % per line item keeps the adjustment product-scoped and reportable.
- Even though it does not drive calculations, it documents the intended adjustment and supports QA/reporting.

## API/contract updates (proposed)

### Opportunity read/update
- Extend Opportunity DTOs to include `isSubjectMatterExpertDeal`.
- Extend Opportunity PATCH payloads to accept `isSubjectMatterExpertDeal`.

### OpportunityProduct (line item) create/update
- Extend line item create payload to include `subjectMatterExpertPercent` (only when SME deal; still safe to accept always).
- Extend line item update payload similarly.

Important: this field must remain *non-functional* with respect to commission computations (i.e., no changes to how `Expected Commission Rate %` is stored/used).

## Frontend implementation notes (likely touch points)
(File paths are suggestions based on current codebase naming; confirm exact UX entry points during implementation.)

- Opportunity edit surface: `components/opportunity-edit-modal.tsx`
- Opportunity products add/edit flow:
  - `components/opportunity-line-item-create-modal.tsx`
  - `components/product-create-modal.tsx` (if it also supports add-to-opportunity flows)

## Acceptance criteria
1) Users can mark an Opportunity as an SME deal via a checkbox.
2) When an Opportunity is marked SME:
   - The Opportunity Product UI shows an `SME %` field next to `Expected Commission Rate %`.
   - A reminder tooltip/text appears near `Expected Commission Rate %` prompting the user to adjust it.
3) When an Opportunity is not marked SME:
   - No SME % field is shown.
   - No SME reminder text is shown.
4) Saving a line item with SME % set does **not** automatically change Expected Commission Rate %.
5) Existing commission calculations and downstream revenue schedule math remain unchanged.

Implementation note: the SME checkbox is added to the Opportunity edit modal.

## Rollout / migration
- Backfill: default `isSubjectMatterExpertDeal = false` for all existing Opportunities.
- Backfill: leave `subjectMatterExpertPercent = null` for existing OpportunityProducts.
- No data migration required beyond schema changes.

## Testing checklist
- Unit/UI: SME checkbox toggles conditional rendering correctly.
- Create flow: SME enabled → SME % field visible, accepts valid inputs, persists on save.
- Edit flow: existing line item shows stored SME % when Opportunity is SME.
- Regression: commission values and existing calculations are unchanged when SME % is present.

## Open questions (to resolve before building)
1) Should `SME %` default to `100.00` or be blank with a placeholder?
2) Should `SME %` be editable per line item even if Opportunity is SME (recommended: yes), or should it be a single Opportunity-level default applied everywhere?
3) When SME is toggled **off** after line items exist, do we hide the SME % field but keep the stored value, or clear it?
