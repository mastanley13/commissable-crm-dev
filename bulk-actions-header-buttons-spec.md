# Bulk-Action Header Buttons: Implementation Spec (v1.0)

This document describes the new bulk‑action pattern used on:

- **Accounts list** (`app/(dashboard)/accounts/page.tsx`)
- **Account Details → Contacts tab** (`components/account-details-view.tsx`)

Use this as the reference when migrating other tables away from the old bottom “bulk‑action bar” overlay to the new header icon buttons.

---

## 1. Visual & Layout Spec

### 1.1 Placement

- Bulk‑action buttons live in the **list header**, on the same row as:
  - Search
  - Status filter pills (Active / Show Inactive)
  - `Create New` button
  - Column settings (gear)
  - Filter‑by‑column controls
- The buttons are **icon‑only**, arranged in a **single row (1×4)**.
- On wide viewports they appear **right after `Create New`** and before column settings; on smaller screens they wrap naturally with the rest of the header content.

### 1.2 Size & Shape

- The bulk‑action buttons must match the height of the `Create New` button as rendered by `ListHeader`:
  - `Create New` padding (via `btnPad` in `components/list-header.tsx`):
    - Default: `px-3 py-1.5 text-sm`
    - Compact: `px-2.5 py-1 text-sm`
- Bulk‑action header buttons use:
  - Default (non‑compact header):
    - `px-2 py-1.5 text-sm` (slightly narrower than `Create New`, same height)
    - Icon size: `h-4 w-4`
  - Compact density:
    - `px-1.5 py-1 text-xs`
    - Icon size: `h-3 w-3`
- Shape/styling:
  - Container: `inline-flex overflow-hidden border border-gray-300 bg-white divide-x divide-gray-200`
    - **No rounded corners** (straight edges).
  - Button base classes (see `components/bulk-actions-grid.tsx`):
    - `inline-flex items-center justify-center bg-transparent transition-colors`
    - Focus ring: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500`

### 1.3 Color & Tone

Bulk actions use tone‑aware classes defined in `toneClasses` inside `components/bulk-actions-grid.tsx`:

- `danger`: `text-red-600 hover:bg-red-50 hover:text-red-700`
- `primary`: `text-primary-700 hover:bg-primary-50 hover:text-primary-900`
- `info`: `text-blue-700 hover:bg-blue-50 hover:text-blue-900`
- `neutral`: `text-slate-600 hover:bg-slate-50 hover:text-slate-900`

When **disabled** (no items selected, or busy), all buttons use:

- `cursor-not-allowed text-gray-300`

---

## 2. Behavior & Workflow

### 2.1 Selection Rules

- Bulk‑action buttons are **always rendered** when configured, but **disabled** when:
  - `selectedCount === 0`, or
  - `isBusy === true`, or
  - the individual action is explicitly disabled.
- The table component (`DynamicTable`) must provide:
  - `selectedItems: string[]`
  - `onItemSelect(id: string, selected: boolean, row?: RowType)`
  - `onSelectAll(selected: boolean)`

The page is responsible for maintaining `selectedIds`/`selectedContacts`/`selectedOpportunities`, etc., and passing `selectedCount` into the bulk‑action config.

### 2.2 Standard Actions

The standard header pattern expects **four** actions (in order):

1. **Soft Delete** (trash icon, danger tone)
2. **Change Owner** (user/gear icon, primary tone)
3. **Update Status** (toggle icon, neutral tone)
4. **Export CSV** (download icon, info tone)

Each action is defined via `BulkActionButtonConfig` (see `components/bulk-actions-grid.tsx`):

- `key: string` – unique id (`"delete"`, `"reassign"`, `"status"`, `"export"`)
-,label: string` – full label used in tooltips and a11y
-,icon: LucideIcon` – icon component from `lucide-react`
- `tone?: "danger" | "primary" | "info" | "neutral"`
- `onClick?: () => void`
- `tooltip?: string | ((count: number) => string)`
- `disabled?: boolean`
- `hidden?: boolean`
- `wrapper?: (button: ReactNode) => ReactNode` – e.g. RBAC wrappers (`RoleGate`, `PermissionGate`)

---

## 3. Implementation Pattern

### 3.1 Core Components

- **Bulk action grid**: `components/bulk-actions-grid.tsx`
  - Accepts `BulkActionsGridProps`:
    - `selectedCount: number`
    - `actions: BulkActionButtonConfig[]`
    - `entityName?: string` (plural label used in default tooltips)
    - `isBusy?: boolean`
    - `density?: "default" | "compact"`
    - `className?: string`
  - Renders a single inline row of icon buttons.

- **Standardized builder**: `components/standard-bulk-actions.ts`
  - `buildStandardBulkActions(options: StandardBulkActionOptions): BulkActionsGridProps`
  - Inputs:
    - `selectedCount: number`
    - `isBusy?: boolean`
    - `entityLabelPlural: string` (e.g., `"accounts"`, `"contacts"`)
    - `entityLabelSingular?: string` (optional; derived from plural by default)
    - `onDelete`, `onReassign`, `onStatus`, `onExport`
    - Optional `labels`, `tooltips`, `wrappers`
  - This is the **recommended way** to define bulk actions for list/table pages.

### 3.2 Wiring into `ListHeader`

`ListHeader` lives in `components/list-header.tsx` and accepts an optional `bulkActions` prop:

```tsx
interface ListHeaderProps {
  // ...
  bulkActions?: BulkActionsGridProps;
}
```

Inside `ListHeader`, the provided config is normalized:

```ts
const mergedBulkActions =
  bulkActions && bulkActions.actions.length > 0
    ? {
        ...bulkActions,
        density: bulkActions.density ?? (compact ? "compact" : "default"),
      }
    : null;
```

And rendered in the main header row:

```tsx
{mergedBulkActions && (
  <BulkActionsGrid {...mergedBulkActions} />
)}
```

**Key rule:** on detail tabs that pass `inTab`, we do **not** force compact density; the default `density="default"` keeps height aligned with `Create New`.

### 3.3 Page-Level Pattern (Lists)

Example: **Accounts list** (`app/(dashboard)/accounts/page.tsx`)

1. Track selection:

   ```tsx
   const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
   ```

2. Build bulk actions:

   ```tsx
   const accountBulkActions = buildStandardBulkActions({
     selectedCount: selectedAccounts.length,
     isBusy: bulkActionLoading,
     entityLabelPlural: "accounts",
     labels: {
       delete: "Delete",
       reassign: "Reassign",
       status: "Status",
       export: "Export",
     },
     tooltips: {
       delete: (count) => `Soft delete ${count} account${count === 1 ? "" : "s"}`,
       status: (count) => `Update status for ${count} account${count === 1 ? "" : "s"}`,
       export: (count) => `Export ${count} account${count === 1 ? "" : "s"} to CSV`,
     },
     wrappers: {
       reassign: (button) => (
         <RoleGate
           roles={["ADMIN", "SALES_MGMT"]}
           fallback={
             <PermissionGate permissions={["accounts.reassign", "accounts.bulk"]}>
               {button}
             </PermissionGate>
           }
         >
           {button}
         </RoleGate>
       ),
     },
     onDelete: openBulkDeleteDialog,
     onReassign: () => setShowReassignModal(true),
     onStatus: () => setShowBulkStatusModal(true),
     onExport: handleBulkExportCsv,
   });
   ```

3. Pass into `ListHeader`:

   ```tsx
   <ListHeader
     pageTitle="ACCOUNTS LIST"
     // …other props…
     bulkActions={accountBulkActions}
   />
   ```

### 3.4 Page-Level Pattern (Detail Tabs)

Example: **Account Details → Contacts tab** (`components/account-details-view.tsx`)

1. Track selected IDs (`selectedContacts`) and maintain `paginatedContacts` as you already do.
2. Implement a tab‑specific export helper (reusing existing CSV logic):

   ```tsx
   const handleContactBulkExportCsv = useCallback(() => {
     if (selectedContacts.length === 0) {
       showError("No contacts selected", "Select at least one contact to export.");
       return;
     }

     const rows = paginatedContacts.filter(row => selectedContacts.includes(row.id));
     if (rows.length === 0) {
       showError(
         "Contacts unavailable",
         "Unable to locate the selected contacts. Refresh the page and try again."
       );
       return;
     }

     // build + download CSV (same pattern as list pages)
   }, [paginatedContacts, selectedContacts, showError, showSuccess]);
   ```

3. Build bulk actions using `buildStandardBulkActions`:

   ```tsx
   const contactBulkActions = buildStandardBulkActions({
     selectedCount: selectedContacts.length,
     isBusy: contactBulkActionLoading,
     entityLabelPlural: "contacts",
     labels: {
       delete: "Delete",
       reassign: "Reassign",
       status: "Status",
       export: "Export",
     },
     tooltips: {
       delete: (count) => `Soft delete ${count} contact${count === 1 ? "" : "s"}`,
       reassign: (count) => `Change owner for ${count} contact${count === 1 ? "" : "s"}`,
       status: (count) => `Update status for ${count} contact${count === 1 ? "" : "s"}`,
       export: (count) => `Export ${count} contact${count === 1 ? "" : "s"} to CSV`,
     },
     onDelete: openContactBulkDeleteDialog,
     onReassign: () => setShowContactBulkOwnerModal(true),
     onStatus: () => setShowContactBulkStatusModal(true),
     onExport: handleContactBulkExportCsv,
   });
   ```

4. Pass into the tab’s `ListHeader`:

   ```tsx
   {activeTab === "contacts" && (
     <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-1 border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0 px-3 pb-0">
       <div className="border-t-2 border-t-primary-600 -mr-3">
         <ListHeader
           inTab
           onCreateClick={handleCreateContact}
           // …other props…
           searchPlaceholder="Search contacts"
           bulkActions={contactBulkActions}
         />
       </div>
       {/* DynamicTable for contacts */}
     </div>
   )}
   ```

5. **Remove old overlay bars** when migrating:

   - Delete the corresponding `<ContactBulkActionBar />`, `<OpportunityBulkActionBar />`, etc., from the tab layout.
   - Keep the modal components (owner/status/delete dialogs), as they’re still triggered by header actions.

---

## 4. Migration Checklist

When updating another page/tab to the new header bulk‑action buttons:

1. **Identify selection state**
   - Ensure the table exposes `selectedItems`, `onItemSelect`, `onSelectAll`.
   - Confirm you have a `selectedIds` array (or create one).

2. **Copy or adapt bulk handlers**
   - Map the existing overlay actions:
     - Soft delete / bulk delete dialog
     - Bulk owner modal
     - Bulk status modal
     - CSV export
   - Wrap them in `buildStandardBulkActions` as shown above.

3. **Wire into `ListHeader`**
   - Pass `bulkActions={...}` into the relevant `ListHeader` instance.
   - Ensure `compact` is only used where you explicitly want smaller controls; tabs normally use default density.

4. **Remove old overlay bar**
   - Remove `<*BulkActionBar />` from the JSX for that page/tab.
   - Verify that no logic is only reachable from the old component.

5. **QA**
   - 0 selected: all icons disabled, tooltips still present.
   - 1+ selected: icons enabled; each action triggers the correct flow.
   - Export CSV: validates selection, includes only selected rows, downloads with a timestamped filename.
   - Visual: header layout matches Accounts list / Account Details → Contacts (height, spacing, borders).

---

Use this spec as the single source of truth when applying the new bulk‑action header buttons to additional list and detail views. If you introduce new bulk actions (e.g., “Activate/Deactivate” for Products), prefer extending `buildStandardBulkActions` or creating a small variant that still feeds into `BulkActionsGrid` so the layout and behavior stay consistent.*** End Patch``` ***!
