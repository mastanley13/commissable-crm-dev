# Opportunity Detail Tabs – Restore Plan (Roles) and Fresh Start (Activities)

## Objectives
- Restore a working Roles table in `components/opportunity-details-view.tsx` that matches our shared table standards and persists user preferences.
- Remove the broken Activities & Notes implementation and rebuild it cleanly based on the Detail View Tables Reference Guide and field IDs 03.10.100–03.10.103.
- Keep the tabs cohesive with the existing design system, performance patterns, and accessibility conventions.

## Scope
- Files: `components/opportunity-details-view.tsx` (UI), `app/api/activities` (read), `app/api/opportunities` (no change to roles in API for MVP), and relevant types in `components/opportunity-types.ts` if needed.
- Table preferences: re‑use `useTablePreferences` with new, explicit keys to avoid collisions with legacy keys.
- No CRUD for Activities in Phase 1. CSV export is optional but planned.

## Current State (after cleanup)
- Activities tab UI has been reduced to a placeholder card; all broken state/logic removed.
- Roles table scaffolding was lost during cleanup and needs to be reintroduced.

## References
- Detail View Tables Reference Guide: `Markdown-Notes/Detail_View_Tables_Reference_Guide.md`
- Activities field IDs (03.10.x): `Commissable - Global - Fields by Page.xlsx - Fields by Page.csv`
  - 03.10.100 Activity Date
  - 03.10.101 Activity Type
  - 03.10.102 Activity Description
  - 03.10.103 Created By
- Existing table implementations for standards: Products, History, Account/Contact tables.

---

## Part A — Restore Roles Tab

### Target UX
- Tab label: `Roles`
- Table with persistent preferences and standard controls (search, column filters, column chooser, pagination, selection).
- Read‑only MVP (no activation/edit/delete actions yet).

### Columns (Base)
- multi-action (200/160/240; no render logic beyond checkbox)
- `role` – Role (180/150; sortable)
- `fullName` – Full Name (220/160; sortable)
- `jobTitle` – Job Title (180/140; sortable)
- `email` – Email Address (220/180; render as `mailto:` link)
- `workPhone` – Work Phone (160/140)
- `phoneExtension` – Phone Extension (150/120)
- `mobile` – Mobile (160/140)

### Filters & Search
- Filter columns: `role`, `fullName`, `email`, `workPhone`, `mobile`
- Search across name, role, and phone/email fields.

### Preferences
- Key: `opportunities:detail:roles`
- Use `useTablePreferences` with the base columns.

### Data Model
- Use existing `OpportunityRoleRecord` from `components/opportunity-types.ts`.
- Fallback to Owner row when `opportunity.roles` is empty (as in the original implementation):
  ```ts
  [{ id: ownerId ?? 'owner', role: 'Opportunity Owner', fullName: ownerName ?? 'Unassigned', ... }]
  ```

### Implementation Steps
1. Re‑add constants
   - `ROLE_FILTER_COLUMNS`, `ROLE_TABLE_BASE_COLUMNS`
2. State & hooks
   - `rolesSearchQuery`, `roleColumnFilters`, `roleStatusFilter` (Active/Inactive placeholder)
   - `selectedRoles`, `roleCurrentPage`, `rolePageSize`, show column settings, `useTablePreferences`
3. Data shaping
   - Derive `defaultRoles` from `opportunity.roles` with Owner fallback
   - Filter, paginate, and memoize values using `applySimpleFilters`
4. Rendering
   - `ListHeader` with search/filter/settings and save controls
   - `DynamicTable` wired to columns, data, selection, pagination
   - `ColumnChooserModal` for roles
5. Accessibility & Perf
   - Keep keyboard/focus and height measurement consistent with other tabs

---

## Part B — Fresh Start for Activities & Notes

### Target UX (Phase 1 MVP)
- Tab label: `Activities & Notes`
- Read‑only table with preferences, search, filters, pagination, selection, optional CSV export.
- Row click → `/activities/:id` (existing pattern).
- No bulk operations or CRUD in Phase 1.

### Field Mapping (03.10.100–03.10.103)
- 03.10.100 Activity Date → `activityDate` (rendered `YYYY-MM-DD`)
- 03.10.101 Activity Type → `activityType` (Call, Meeting, ToDo, Note, Other)
- 03.10.102 Activity Description → `description` (long text with two-line clamp + tooltip)
- 03.10.103 Created By → `createdByName` (string)

### Columns (Base)
- multi-action (200/160/240)
- `activityDate` – Activity Date (160/130; sortable)
- `activityType` – Activity Type (160/130; sortable)
- `description` – Description (300/220; line‑clamp‑2)
- `createdByName` – Created By (200/160)

### Optional/Hidden Columns (later)
- `status` – Status (Open/Completed)
- `updatedAt` – Updated (160/130)
- `attachments` – Attachments chip list

### Filters & Search
- Filter columns: `activityType`, `createdByName`
- Search across type, description, and created by.
- Status filter (Active vs Completed) can be added later.

### Preferences
- Key: `opportunities:detail:activities-v2`
- Use `useTablePreferences` with new base columns.

### Data Model (Front-end)
```ts
interface OpportunityActivityRow {
  id: string
  activityDate: string | null
  activityType: string | null
  description: string | null
  createdByName: string | null
}
```

### API Integration (MVP)
- Fetch: `GET /api/activities?contextType=Opportunity&contextId=:id&sortBy=activityDate&sortDirection=desc&pageSize=100`
- Adapter: Map server payload → `OpportunityActivityRow`, formatting dates to ISO strings and defaulting nulls → `--` in renderers.

### MVP Implementation Steps
1. Constants
   - `ACTIVITY_FILTER_COLUMNS`, `ACTIVITY_TABLE_BASE_COLUMNS`
2. State
   - `activities`, `activitiesLoading`, `activitiesError`
   - `activitiesSearchQuery`, `activitiesColumnFilters`
   - `activitiesCurrentPage`, `activitiesPageSize`
   - `selectedActivities`, `showActivityColumnSettings`, and preferences
3. Fetch & Map
   - Implement `fetchActivities()` with error handling and memoized mappings
4. UI
   - `ListHeader` + `DynamicTable` + `ColumnChooserModal`
   - Empty state message: “No activities logged for this opportunity.”
5. Optional CSV Export (selected rows)
   - Headers: Activity ID, Date, Type, Description, Created By
   - Safe CSV escaping

### Phase 2 (Post‑MVP)
- Quick Add Activity modal (03.10 fields), soft delete, owner change, status update, attachments chip.

---

## File Touch Points (when implementing)
- `components/opportunity-details-view.tsx`
  - Add back Roles tab constants/state/render
  - Insert fresh Activities constants/state/render
  - Add corresponding ColumnChooserModal blocks
  - Ensure `useLayoutEffect` height calculations include new preference loadings
- `components/opportunity-types.ts`
  - No change for Roles (uses `OpportunityRoleRecord`)
  - Add a local row interface (in file) or inline type for Activities
- `app/api/activities` (read)
  - Confirm query params and payload shape returned for opportunity context

## Testing & Verification
- Compile and run: no TypeScript or JSX parse errors
- Roles: search/filter/pagination/selection operate; column preferences persist
- Activities: renders with mocked or real data; search/filter/pagination/selection operate; link opens detail page
- CSV export (if enabled) produces readable data

## Risks & Mitigations
- Legacy references causing circular imports or unresolved symbols → gate changes behind clearly named keys and isolated state blocks.
- Data shape mismatch from API → add adapter with defensive parsing and fallbacks.
- Layout height regressions → include the new `...PreferencesLoading` flags in the `useLayoutEffect` deps used for measuring.

## Out of Scope
- Full CRUD for Activities (Phase 2)
- Advanced filters beyond the reference guide in MVP

## Timeline (Suggested)
- Day 1: Restore Roles tab (constants/state/UI wiring); smoke test; persist prefs
- Day 2: Activities MVP (constants/state/fetch/UI); smoke test with real data
- Day 3: QA polish, CSV export, and documentation
