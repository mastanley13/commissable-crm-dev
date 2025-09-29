# CON-06: Contact Activities & Notes Tab

## Acceptance Criteria
- Contacts > Detail > Activities & Notes tab must match the universal Activities specification (Create / Search / Filter / Active vs Show All / Type filters, default columns, attachments).
- **Priority**: P1 – Must have.
- **Status**: **In Progress** – Create/attachment workflows delivered; search and column filtering still pending.

---

## Current Implementation Snapshot
| Feature | Status | Evidence |
| --- | --- | --- |
| Tab surface available on contact detail | ? | `components/contact-details-view.tsx` – Activities tab enabled by default. |
| Create New modal launches & saves | ? | `ActivityNoteCreateModal` invoked from toolbar; records refresh via `onRefresh`. |
| Attachments upload & download | ? | `/api/activities/[activityId]/attachments` endpoints wired; chips render with download links. |
| Activity type quick filters | ? | Button group mirrors universal spec and filters table rows. |
| Status (Active / Show All) toggle | ? | Toggles rely on existing state filter. |
| Search box & "Filter by Column" | ?? Visual only | Input remains read-only, filter button placeholder. |
| Column chooser / table preferences | ?? Visual only | Gear icon present but modal not hooked into preferences for this tab. |
| Default columns | ? | Active, Activity Date, Type, Description, Account Name, Attachment, File Name, Created By. |
| Context inheritance | ? | New activity inherits contact/account IDs and refreshes tab. |

---

## Gaps to Close for Acceptance
1. **Search / Filter wiring** – Connect the toolbar search input and "Filter by Column" / "Apply Filter" actions to the underlying data set so users can filter activities within the tab.
2. **Column preferences** – Integrate the column chooser with `useTablePreferences` (as on the global Activities page) to allow hide/show and order persistence.
3. **Parity validation** – After wiring search/filter functionality, retest to ensure behaviour matches the universal Activities spec (including keyboard focus states and empty-state messaging).

---

## Next Steps
1. Implement client-side filtering for tab data or request scoped searches from `/api/activities` with contact context.  
2. Reuse the existing table preferences modal (`components/dynamic-table.tsx`) so column configuration persists per user.  
3. Update automated/regression test plan once interactive controls are fully wired.

---

## Completion Definition
The CON-06 workstream can be marked **Done** when:
- [ ] Create New + attachment workflows remain functional (already verified).  
- [ ] Search input filters the contact activity list.  
- [ ] "Filter by Column" / "Apply Filter" allow column/value filtering.  
- [ ] Column chooser opens and saves user preferences for the contact activity table.  
- [ ] Acceptance criteria from the global Activities spec are satisfied for the contact detail tab.
