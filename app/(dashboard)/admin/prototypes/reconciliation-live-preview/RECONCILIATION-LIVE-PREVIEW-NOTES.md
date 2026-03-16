# Reconciliation Live Preview — Development Notes

**Date:** 2026-03-12

---

## Overview

We built a prototype playground for testing different UI/UX approaches to previewing cell changes in a reconciliation matching workflow. The goal: when a user selects a deposit line item and a suggested revenue schedule match, the cells that *would* be updated should visually indicate the change before it's committed.

The prototype lives at:
`app/(dashboard)/admin/prototypes/reconciliation-live-preview/page.tsx`

---

## How It Works

### Architecture

The entire preview system flows through a single render function — `renderPreviewValue` — inside the `scheduleColumns` useMemo. This is the chokepoint where every preview cell gets rendered. Each variant just returns different JSX from that function.

**Key variables available inside `renderPreviewValue`:**

| Variable | Description |
|---|---|
| `oldValue` | The current value before matching |
| `newValue` | What the value would become after matching |
| `changed` | Boolean — whether the value actually differs |
| `formatter` | Either `formatCurrency` or `formatPercent` depending on the column |
| `selectedRow` | Whether this row is checkbox-selected |

**Data flow:**
1. User selects a deposit line item → stored in `selectedLineIds`
2. User selects a revenue schedule match → stored in `selectedScheduleIds`
3. `previewByScheduleId` (useMemo) computes what each cell *would* become if the match were applied
4. `renderPreviewValue` reads the preview state and renders the appropriate variant

### The 6 Variants

#### Original 3 (same rendering approach — single `<span>` with different CSS)

These all use the `previewCellClassName()` helper to apply different background/border styles. The cell content is always just the new value as plain text.

1. **Minimal Enterprise** (`minimal`) — Soft yellow background (`#fff3bf`) with bold green text (`#166534`). Least disruptive. No borders, no animations.

2. **AG Grid-Inspired Flash** (`ag-flash`) — Warm gradient background (`linear-gradient`) with an inset box-shadow border. Mimics AG Grid's native `enableCellChangeFlash` but persists instead of fading.

3. **Row Band + Changed Cells** (`row-band`) — Row-level amber wash via CSS on `[data-row-selected="true"]` rows, plus a left amber accent bar (`box-shadow: inset 4px 0 0 #d97706` on first cell). Changed cells still get individual highlights.

#### New 3 (richer JSX structures — broke out of the single-span pattern)

4. **Strikethrough Before/After** (`strikethrough`) — Returns a **two-line flex column** (`flex-col`) inside the cell. Old value on top (small 10px, muted slate-400, `line-through`), new value below (bold 13px emerald-700). Cell is taller (`min-h-[40px]`) to fit both lines. Light emerald-50 background. *Classic accounting ledger pattern.*

5. **Delta Badge** (`delta-badge`) — Returns a **horizontal flex row** with two elements: the new value (bold slate-900) + an inline pill showing the computed delta (`newValue - oldValue`). The pill uses conditional coloring — `bg-emerald-50` with green ring for positive, `bg-red-50` with red ring for negative — with triangle arrow characters (▲/▼). *Bloomberg/trading terminal pattern.*

6. **Ghost Previous** (`ghost-prev`) — Returns a **relatively positioned** container. New value sits in normal flow (bold emerald-700). Old value is `absolute`-positioned in the top-right corner at 9px font with "was $X.XX" label (muted slate-400). Left emerald accent border (`border-l-2 border-emerald-400`) marks the cell. Light slate-50 background. *Google Sheets revision history pattern.*

---

## How to Add a New Variant

4 touch points, all in the same file:

### Step 1 — Add the variant key to the type union (line 8)
```ts
type PreviewVariant = 'minimal' | ... | 'your-new-variant'
```

### Step 2 — Add copy in `previewVariantCopy` (~line 73)
```ts
'your-new-variant': {
  title: 'Your Variant Name',
  description: 'One-line description for the button tooltip.'
}
```

### Step 3 — Add rendering logic in `renderPreviewValue` (~line 360-435)
```ts
if (previewVariant === 'your-new-variant') {
  if (!changed) {
    // Return the plain unchanged cell
    return (
      <span className="inline-flex min-h-[26px] w-full items-center justify-end px-2 py-1 text-slate-900">
        {formatter(oldValue)}
      </span>
    )
  }
  // Return your custom changed-cell JSX here
  return (
    <span className="...">
      {/* Use oldValue, newValue, formatter, etc. */}
    </span>
  )
}
```

### Step 4 — Add the key to the button array (~line 482)
```ts
{(['minimal', 'ag-flash', 'row-band', 'strikethrough', 'delta-badge', 'ghost-prev', 'your-new-variant'] as PreviewVariant[]).map(variant => (
```

That's it. The variant buttons, data computation (`previewByScheduleId`), column definitions, and table rendering are all untouched.

---

## Ideas for Future Variants

- **Tooltip on hover** — Render a subtle corner dot indicator, show full before/after diff in a popover on mouse enter
- **Inline sparkline** — Tiny bar showing old vs new as proportional segments
- **Color-coded magnitude** — Background intensity scales with how large the delta is (small change = barely visible, large change = strong highlight)
- **Animated transition** — CSS `@keyframes` that fades from old value to new when variant is activated
- **Combined approach** — Mix strikethrough + delta badge for maximum information density

---

## Reference

- AG Grid Change Cell Renderers: https://www.ag-grid.com/javascript-data-grid/change-cell-renderers/
- AG Grid Cell Styles: https://www.ag-grid.com/javascript-data-grid/cell-styles/
- The `DynamicTable` component used here is a custom table component at `components/dynamic-table.tsx`
- Styling uses Tailwind CSS utility classes with inline `<style>` tags for table-specific CSS overrides
