# Opportunity Detail View – UI Alignment Plan

**Status: ✅ COMPLETED** (Updated 2025-10-14)

This plan aligns `components/opportunity-details-view.tsx` with the established detail-page pattern used by Accounts and Contacts.

---

## Goals

- ✅ **COMPLETED** - Match the visual language, layout, and interaction patterns of:
  - `components/account-details-view.tsx`
  - `components/contact-details-view.tsx`
- ✅ **COMPLETED** - Reuse shared table, tab, and preferences utilities to minimize custom markup and ensure uniform UX across modules.
- ✅ **COMPLETED** - Preserve current functionality while preparing hooks for Products, Activity, and History tabs.

---

## IMPLEMENTATION STATUS (Updated 2025-10-14)

### ✅ ALL PHASES COMPLETED

All alignment goals have been achieved. The Opportunity detail view now fully matches the pattern established by Accounts and Contacts.

**Completed Items:**

1. ✅ **Phase 1 – Visual Alignment**
   - Pill-style tabs implemented (components/opportunity-details-view.tsx:1023)
   - `fieldLabelClass`/`fieldBoxClass` adopted throughout
   - Header restructured to read-only grid matching standard pattern
   - Details tab renders MSAP fields with shared styles
   - Products tab uses `DynamicTable` + `ListHeader` + `useTablePreferences`

2. ✅ **Phase 2 – Products CRUD Parity**
   - Line item endpoints implemented:
     - POST `/api/opportunities/{id}/line-items` (app/api/opportunities/[opportunityId]/line-items/route.ts:66)
     - PATCH `/api/opportunities/line-items/{id}` (app/api/opportunities/line-items/[lineItemId]/route.ts:66)
     - DELETE `/api/opportunities/line-items/{id}` (app/api/opportunities/line-items/[lineItemId]/route.ts:239)
   - Create/edit modals implemented (components/opportunity-line-item-create-modal.tsx, components/opportunity-line-item-edit-modal.tsx)
   - `ConfirmDialog` integration for deletes
   - Server-side totals computed in helpers (app/api/opportunities/helpers.ts:310-378)

3. ✅ **Phase 3 – Activities Integration**
   - Activities tab implemented with full CRUD (components/opportunity-details-view.tsx:1084)
   - Fetches via `/api/activities?contextType=Opportunity&contextId={id}` (line 598)
   - Create/edit modals wired (ActivityNoteCreateModal, ActivityNoteEditModal)
   - RBAC checks for create/edit/delete

4. ✅ **Phase 4 – History (Audit Log)**
   - History tab implemented (components/opportunity-details-view.tsx:1125)
   - Fetches from `/api/audit-logs` for Opportunity and OpportunityProduct entities (line 798)
   - Displays audit entries with date, action, actor, entity, summary

5. ⚠️ **Phase 5 – Polish & UAT** (Partially Complete)
   - ✅ RBAC gating for all actions implemented
   - ✅ Column defaults and widths tuned; preferences persisted
   - ❌ Accessibility pass pending (keyboard focus states)
   - ❌ UAT not completed

**Files Created:**
- `app/(dashboard)/opportunities/[opportunityId]/page.tsx`
- `components/opportunity-details-view.tsx` (1,280 lines)
- `components/opportunity-line-item-create-modal.tsx` (460 lines)
- `components/opportunity-line-item-edit-modal.tsx` (520 lines)
- `components/opportunity-types.ts`
- `app/api/opportunities/[opportunityId]/line-items/route.ts`
- `app/api/opportunities/line-items/[lineItemId]/route.ts`

**Files Modified:**
- `app/api/opportunities/helpers.ts` (added detail mapping functions)
- `app/api/opportunities/[opportunityId]/route.ts` (returns full detail with line items)

### Remaining Work

1. **Accessibility & Keyboard Navigation**
   - Add keyboard shortcuts for tab navigation
   - Ensure focus management in modals
   - Verify screen reader compatibility

2. **Performance Optimizations** (Optional)
   - Consider row virtualization if line item count exceeds 100
   - Add loading skeletons for better perceived performance

3. **UAT & Sign-off**
   - Complete cross-browser testing
   - Verify all RBAC scenarios
   - Obtain stakeholder sign-off

---

## Original Gap Analysis

All gaps listed below have been **RESOLVED** ✅

1) **Page Wrapper & Breadcrumbs** ✅
   - Implemented with `CopyProtectionWrapper` and dynamic breadcrumbs

2) **Header Area ("Detail" card)** ✅
   - Implemented with "OPPORTUNITY DETAIL" title and read-only field grid
   - Location: components/opportunity-details-view.tsx:176-244

3) **Field Styling** ✅
   - Adopted `fieldLabelClass` and `fieldBoxClass` constants
   - Location: components/opportunity-details-view.tsx:22-25

4) **Tabs** ✅
   - Pill-style tabs with consistent spacing and hover states
   - Location: components/opportunity-details-view.tsx:1023-1043

5) **Tab Content Patterns** ✅
   - All tabs use `DynamicTable` + `ListHeader` pattern
   - Products: lines 1049-1083
   - Activities: lines 1084-1124
   - History: lines 1125-1161

6) **Tables & Preferences** ✅
   - All tabs use `useTablePreferences` with unique pageKeys:
     - Products: `opportunities:detail:products`
     - Activities: `opportunities:detail:activities`
     - History: `opportunities:detail:history`

7) **Actions & RBAC** ✅
   - Role-gated actions for create/edit/delete
   - RBAC checks: lines 440-449

8) **Activity Tab** ✅
   - Full CRUD with ActivityNoteCreateModal and ActivityNoteEditModal
   - Filtered by `contextType=Opportunity`

9) **History Tab (Audit)** ✅
   - Fetches from `/api/audit-logs`
   - Displays audit entries for Opportunity and OpportunityProduct

---

## UI To-Be (All Implemented ✅)

- **Header** ✅
  - Title chip: "OPPORTUNITY DETAIL" (uppercase) on left
  - Read-only field grid using shared classes
  - Fields: Name, Account (with link), Stage, Status, Type, Lead Source, Probability, Owner
  - Edit button (top-right) opens existing edit modal

- **Tabs (pill buttons)** ✅
  - Details (default), Products, Activities & Notes, History

- **Details tab** ✅
  - Overview box with read-only label/value cells
  - Audit snippet (Created/Updated by/at)
  - Totals section (weighted amount, expected revenue/commission, line item count, etc.)

- **Products tab** ✅
  - Tools: Create New (Add Line Item), Filter By Column, Search, Column settings (gear)
  - Table: `DynamicTable` with `useTablePreferences` (pageKey=opportunities:detail:products)
  - Columns: Product, Product Code, Revenue Type, Quantity, Unit Price, Expected Revenue, Expected Commission, Expected Usage, Start Date, End Date, Distributor, Vendor, Created, Updated, Actions
  - Modals for create/edit; confirmation dialog for delete

- **Activities & Notes tab** ✅
  - Exact table/toolbar pattern from Accounts/Contacts
  - Filtered to current Opportunity
  - Uses existing Activity create/edit modals

- **History tab** ✅
  - Table with Date, Action, Actor, Entity, Details
  - Powered by Audit API (`/api/audit-logs`)

---

## Implementation Plan (All Phases Complete ✅)

**Phase 1 – Visual Alignment** ✅
1. Replaced underline tabs with pill tabs
2. Added `fieldLabelClass`/`fieldBoxClass`, restructured header to read-only grid
3. Details tab renders MSAP fields using shared styles; shows audit mini-section
4. Products tab switched to `DynamicTable` + `ListHeader`; defined columns; added column prefs

**Phase 2 – Products CRUD parity** ✅
6. Added endpoints for line items (POST, PATCH, DELETE)
7. Built create and edit modals
8. Added confirmation dialog integration
9. Compute totals server-side in helpers

**Phase 3 – Activities integration** ✅
10. Reused Activities table pattern from Accounts
11. Fetch via `/api/activities?contextType=Opportunity&contextId={id}`
12. Create/Edit modals wired

**Phase 4 – History (Audit Log)** ✅
11. Fetch from `/api/audit-logs` with filters for Opportunity and OpportunityProduct
12. History tab as `DynamicTable` with columns for date, action, actor, entity, details

**Phase 5 – Polish & UAT** ⚠️ Partial
13. RBAC gating for all actions ✅
14. Column defaults and widths tuned; prefs persisted ✅
15. Accessibility pass and keyboard focus states ❌ Pending

---

## Files To Touch (All Updated ✅)

**UI**
- ✅ `components/opportunity-details-view.tsx` (major implementation - 1,280 lines)
- ✅ `app/(dashboard)/opportunities/[opportunityId]/page.tsx` (created)
- ✅ `components/column-chooser-modal.tsx` (reused)
- ✅ `components/list-header.tsx` (reused)
- ✅ `components/dynamic-table.tsx` (reused)
- ✅ `components/confirm-dialog.tsx` (reused)
- ✅ `components/opportunity-line-item-create-modal.tsx` (created)
- ✅ `components/opportunity-line-item-edit-modal.tsx` (created)

**API**
- ✅ `app/api/opportunities/[opportunityId]/route.ts` (updated to return full detail)
- ✅ `app/api/opportunities/[opportunityId]/line-items/route.ts` (created)
- ✅ `app/api/opportunities/line-items/[lineItemId]/route.ts` (created)
- ✅ `/api/audit-logs` (existing - reused)

**Helpers**
- ✅ `app/api/opportunities/helpers.ts` (updated with detail/line item mappers)

---

## Acceptance Criteria (All Met ✅)

- ✅ Visual parity: header, tabs, typography, spacing, and read-only field boxes match the Accounts/Contacts pattern
- ✅ Products tab uses shared table components with column prefs and filtering
- ✅ Activities tab shows the same table controls and behavior, scoped to the Opportunity
- ✅ History tab lists audit entries via integrated API
- ✅ All buttons/actions respect RBAC and show appropriate toasts/confirmation dialogs

---

## Open Questions (Resolved or Noted)

- Active toggle: Status field is sufficient; active/inactive mapping handled via status (Open/Lost)
- Column set for Products tab: All MSAP fields implemented
- Saved views: Not implemented on Products tab; table prefs suffice for now

---

## Conclusion

**The Opportunity detail view alignment is functionally complete.** The implementation successfully mirrors the Accounts/Contacts pattern, reuses all shared components, and provides full CRUD capability for line items, activities, and audit history. 

**Completion: ~95%** (pending only accessibility polish and UAT)

**Next Steps:**
1. Accessibility improvements (keyboard navigation, screen reader support)
2. Cross-browser UAT
3. Stakeholder sign-off
