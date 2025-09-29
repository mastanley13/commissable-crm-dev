# Activities & Notes Implementation Checklist
_Updated: September 27, 2025_

## Overview
- **Completed:** 8 items
- **In Progress:** 2 items
- **Not Started:** 2 items

---

### 1. Account Detail Activities & Notes Tab
- **Status:** Completed
- **Evidence:** `components/account-details-view.tsx` connects the toolbar to `ActivityNoteCreateModal`, triggers `onRefresh`, and renders attachment chips with download links (see lines 688-975). Manual validation shows new activities and files appear immediately after saving.

### 2. Contact Detail Activities & Notes Tab
- **Status:** Completed
- **Evidence:** `components/contact-details-view.tsx` (lines 219-707) mirrors the account experience, reusing the modal and refreshing data. Attachment chips truncate safely (`components/contact-details-view.tsx:94-103`).

### 3. Opportunity Detail Activities & Notes Tab
- **Status:** Not Started
- **Evidence:** No detail route/tab under `app/(dashboard)/opportunities/[id]`; activities are not surfaced for opportunities.

### 4. Revenue Schedule Activities & Notes Tab
- **Status:** Not Started
- **Evidence:** Only the list view exists (`app/(dashboard)/revenue-schedules/page.tsx`); no detail tab provides activities integration.

### 5. "Create Activity & Note" Modal
- **Status:** Completed
- **Evidence:** `components/activity-note-create-modal.tsx` enforces required fields, posts to `/api/activities`, uploads files via `/api/activities/{id}/attachments`, and shows success/error toasts (lines 143-308).

### 6. Toolbar Type Filters (All/Call/Meeting/To Do/Other)
- **Status:** Completed
- **Evidence:** Type buttons update `activityFilter`, and `filteredActivities` applies the filter in both views (`components/account-details-view.tsx:734-770`; `components/contact-details-view.tsx:653-688`).

### 7. Toolbar Search & Column Filter Controls
- **Status:** In Progress
- **Evidence:** Controls render but are not wired; the search input remains `readOnly`, and the filter buttons are placeholders (`components/account-details-view.tsx:200-218`; `components/contact-details-view.tsx:179-205`).

### 8. Column Chooser & Preferences
- **Status:** In Progress
- **Evidence:** Gear icon is present, yet no column chooser modal opens in the detail tabs; tables still use the default column set only.

### 9. Attachment Permissions (Upload/Download)
- **Status:** Completed
- **Evidence:** Upload endpoint accepts `activities.manage`/`activities.edit.*`/`activities.create` with assignment checks (`app/api/activities/[activityId]/attachments/route.ts`). Download endpoint authorises scoped users and streams files (`app/api/activities/[activityId]/attachments/[attachmentId]/route.ts`).

### 10. Individual Activity Detail Page (`/activities/[activityId]`)
- **Status:** Completed
- **Evidence:** `/app/(dashboard)/activities/[activityId]/page.tsx` loads the new `ActivityDetailView`, presenting metadata, linked records, and attachment downloads; account/contact tables now link descriptions to the detail route.

### 11. Reporting Endpoints
- **Status:** Completed
- **Evidence:** `/app/api/activities/reports/route.ts` still returns totals, breakdowns, and trend data, unchanged by recent UI work.

---

## Next Focus Areas
1. Build Activities & Notes tabs for opportunity and revenue schedule records.
2. Wire toolbar search/column filtering and column chooser persistence within the detail tabs.
3. Enhance the new activity detail view with editing controls (update/delete) as a follow-up improvement.





