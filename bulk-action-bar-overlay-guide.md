# Bulk Action Bar Overlay: Implementation Guide

This guide documents the floating bulk action bar pattern used across list/table views. The bar appears as a fixed overlay near the bottom of the viewport (centered), does not push the table down, and hides automatically when nothing is selected.

## Overview

- Purpose: provide bulk actions without shifting layout when rows are selected.
- Placement: fixed overlay near the bottom of the viewport, centered.
- Auto‑hide: renders only when `count > 0`.
- Accessibility: `role="region"` with descriptive `aria-label` on the container.
- Interaction: outer wrapper uses `pointer-events-none` and inner bar uses `pointer-events-auto` so only the bar captures clicks.

## Components

- Accounts: `components/account-bulk-action-bar.tsx`
- Contacts: `components/contact-bulk-action-bar.tsx`
- Opportunities: `components/opportunity-bulk-action-bar.tsx`
- Activities: `components/activity-bulk-action-bar.tsx`
- Groups: `components/group-bulk-action-bar.tsx`
- Products: `components/product-bulk-action-bar.tsx`
- Revenue Schedules: `components/revenue-schedules-bulk-action-bar.tsx`

All bars share the same structure and classes and accept a consistent set of props (see Props section).

## Visual Pattern

- Wrapper (positioning): `fixed inset-x-0 bottom-6 z-50 pointer-events-none px-4`
- Bar (card): `pointer-events-auto mx-auto max-w-5xl p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-xl flex flex-col gap-3 md:flex-row md:items-center md:justify-between`
- Spacing from bottom: adjust `bottom-6` as needed.
- Width: adjust `max-w-5xl`; wrapper padding `px-4` keeps side gutters on small screens.

## Add To A New Table

1) Track selected IDs

```tsx
const [selectedIds, setSelectedIds] = useState<string[]>([])

const handleItemSelect = (id: string, selected: boolean) => {
  setSelectedIds(prev => selected ? [...new Set([...prev, id])] : prev.filter(x => x !== id))
}

const handleSelectAll = (selected: boolean, rows: any[]) => {
  setSelectedIds(selected ? rows.map(r => String(r.id ?? r.uuid ?? r.key)) : [])
}
```

2) Wire selection into `DynamicTable`

```tsx
<DynamicTable
  columns={columns}
  data={rows}
  selectedItems={selectedIds}
  onItemSelect={(id, selected, row) => handleItemSelect(String(id), selected)}
  onSelectAll={(selected) => handleSelectAll(selected, rows)}
  // optional niceties
  autoSizeColumns
  fillContainerWidth
/>
```

3) Render the correct BulkActionBar

```tsx
import { ContactBulkActionBar } from "@/components/contact-bulk-action-bar"

<ContactBulkActionBar
  count={selectedIds.length}
  onSoftDelete={() => {/* open modal or perform action */}}
  onExportCsv={() => {/* build and download CSV */}}
  onChangeOwner={() => setShowOwnerModal(true)}
  onUpdateStatus={() => setShowStatusModal(true)}
/>
```

Tip: To avoid the bar covering pagination or bottom content, add conditional padding to the list area when the bar is visible:

```tsx
<div className={selectedIds.length > 0 ? "pb-24" : undefined}>
  {/* header + table */}
</div>
```

## Props (common)

- `count: number` — number of selected rows; the bar is hidden when `count <= 0`.
- `disabled?: boolean` — disables buttons during async work.
- `onSoftDelete?: () => void` — open delete flow (soft or staged delete).
- `onExportCsv?: () => void` — export currently selected rows.
- `onChangeOwner?: () => void` — open owner reassignment modal.
- `onUpdateStatus?: () => void` — open bulk status modal.
- `className?: string` — optional additional classes for outer wrapper.

Variant notes:
- `AccountBulkActionBar` includes `RoleGate`/`PermissionGate` wrapped around the owner action; reuse that pattern where RBAC applies.
- `ProductBulkActionBar` exposes `onActivate/onDeactivate` instead of owner/status.

## Accessibility

- The container has `role="region"` and a clear `aria-label` (e.g., "Contact bulk actions").
- Buttons include icons with text labels; icons are `aria-hidden`.
- Optional: add a keyboard shortcut (e.g., Escape) to clear selection at the page layer if desired.

## CSV Export Example

```ts
const exportCsv = (rows: any[], headers: string[], map: (r: any) => (string | number | boolean | null | undefined)[]) => {
  const escapeCsv = (v: unknown) => {
    if (v === null || v === undefined) return ""
    const s = String(v)
    return (s.includes('"') || s.includes(',') || s.includes('\n')) ? `"${s.replace(/\"/g,'""')}"` : s
  }
  const lines = [headers.join(","), ...rows.map(r => map(r).map(escapeCsv).join(","))]
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const ts = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
  a.href = url
  a.download = `export-${ts}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

## Layout Tips

- Overlay height: keep to a single line on large screens; allow wrapping on small screens (`flex-wrap`).
- Stacking: default `z-50` should sit above table headers/footers; raise if you introduce higher z-index elements.
- Scroll containers: if a page uses its own scrolling container (not `window`), consider switching to `sticky bottom-0` inside that container instead of `fixed`.

## QA Checklist

- Selecting rows shows the bar and does not change layout.
- Bar stays visible while scrolling and does not overlap modals.
- Buttons are clickable on mobile and desktop (pointer‑events layering works).
- Keyboard focus order is sensible when the bar appears.
- Export and other actions operate only on selected rows.

---

If you need a new variant, copy one of the existing bulk action bars listed above and swap the button set, keeping the wrapper and a11y pattern unchanged.

