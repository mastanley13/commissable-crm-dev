# Account Detail Page Layout Guide

This guide documents the structure and styling patterns used in the Account Detail page header section, which can be applied to other detail pages for consistency.

## Overview

The Account Detail page uses a two-column grid layout within a fixed-height scrollable container. Each field is rendered using the shared `FieldRow` component with consistent styling classes.

## File Structure

### Main Component
- **File:** `components/account-details-view.tsx`
- **Function:** `AccountHeader` (lines 890-1090+)

### Shared Components
- **FieldRow:** `components/detail/FieldRow.tsx`
- **Shared Classes:** `components/detail/shared.ts`

## Key Styling Classes

### fieldLabelClass
```typescript
"text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap"
```

**Purpose:** Styles all field labels consistently
- 11px font size
- Bold and uppercase for emphasis
- Wide letter spacing for readability
- Gray color (#6B7280)
- Prevents label text wrapping

### fieldBoxClass
```typescript
"flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent pl-[3px] pr-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis tabular-nums"
```

**Purpose:** Styles all field value containers consistently
- **Key alignment fix:** `pl-[3px] pr-0` aligns text inputs with browser select elements
- 28px minimum height ensures vertical alignment with labels
- Bottom border (2px, gray-300) creates underline effect
- Centered items vertically (`items-center`)
- Text truncation with ellipsis for overflow
- Tabular numbers for consistent digit alignment

## FieldRow Component

**Location:** `components/detail/FieldRow.tsx`

### Structure
```typescript
export function FieldRow({ label, value, labelExtra }: FieldRowProps) {
  return (
    <div className="grid items-start gap-2 sm:grid-cols-[140px,minmax(0,1fr)]">
      {labelExtra ? (
        <div className="flex flex-col gap-1">
          <span className={`${fieldLabelClass} flex items-center min-h-[28px]`}>{label}</span>
          {labelExtra}
        </div>
      ) : (
        <span className={`${fieldLabelClass} flex items-center min-h-[28px]`}>{label}</span>
      )}
      <div className="min-w-0">{value}</div>
    </div>
  )
}
```

### Key Features

1. **Grid Layout:** `grid items-start gap-2 sm:grid-cols-[140px,minmax(0,1fr)]`
   - 140px fixed width for label column
   - Remaining space for value column (`minmax(0,1fr)`)
   - 8px gap between columns (`gap-2`)
   - Items aligned to top (`items-start`)

2. **Vertical Alignment:** `flex items-center min-h-[28px]`
   - **CRITICAL:** Labels have `min-h-[28px]` to match field value container height
   - `items-center` vertically centers label text within the 28px container
   - This ensures labels align horizontally with field values

3. **Label Flexibility:**
   - Supports optional `labelExtra` for additional content below label
   - Uses `flex flex-col gap-1` when `labelExtra` is present

4. **Value Container:** `min-w-0`
   - Prevents value column from overflowing grid
   - Allows text truncation to work properly

## Container Structure

### Outer Container
```typescript
<div className="rounded-2xl bg-gray-100 p-3 shadow-sm h-[300px] overflow-y-auto">
```

**Features:**
- Fixed height of 300px
- Vertical scrolling when content overflows
- Rounded corners (2xl = 16px)
- Light gray background
- Small shadow for depth
- 12px padding

### Header Section
```typescript
<div className="mb-2 flex items-center justify-between">
  <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">
    Account Detail
  </p>
  <div className="flex items-center gap-2">
    <button>Update</button>
  </div>
</div>
```

**Features:**
- Flexbox layout with space between title and actions
- Primary color for section title
- 8px gap between action buttons

### Two-Column Grid
```typescript
<div className="grid gap-6 lg:grid-cols-2">
  <div className="space-y-1.5">
    {/* Left column fields */}
  </div>
  <div className="space-y-1.5">
    {/* Right column fields */}
  </div>
</div>
```

**Features:**
- 24px gap between columns (`gap-6`)
- Two columns on large screens (`lg:grid-cols-2`)
- Single column on smaller screens (stacks vertically)
- 6px spacing between fields (`space-y-1.5`)

## Field Value Patterns

### 1. Simple Text Field
```typescript
<FieldRow
  label="Account Name"
  value={<div className={fieldBoxClass}>{account.accountName}</div>}
/>
```

### 2. Select Field (with chevron icon)
```typescript
<FieldRow
  label="Account Type"
  value={
    <div className={cn(fieldBoxClass, "justify-between")}>
      <span>{account.accountType || "-"}</span>
      <ChevronDown className="h-4 w-4 text-gray-400" />
    </div>
  }
/>
```

**Note:** Adds `justify-between` to push chevron to the right

### 3. Field with Switch Control
```typescript
<FieldRow
  label="Account Name"
  value={
    <div className="flex items-end gap-2 max-w-md">
      <div className={cn(fieldBoxClass, "flex-1 max-w-none")}>{account.accountName}</div>
      <div className="flex items-center gap-2 shrink-0 bg-transparent px-0 py-1 text-[11px] font-medium text-gray-600">
        <span>Active (Y/N)</span>
        <ReadOnlySwitch value={account.active} />
      </div>
    </div>
  }
/>
```

**Features:**
- `flex-1` allows text field to grow
- `shrink-0` prevents switch from shrinking
- `items-end` aligns switch with bottom of field

### 4. Multi-line Text Field
```typescript
<FieldRow
  label="Description"
  value={
    <div className={cn(fieldBoxClass, "whitespace-normal")}>
      {account.description || "No description provided."}
    </div>
  }
/>
```

**Note:** Overrides `whitespace-nowrap` with `whitespace-normal` to allow wrapping

### 5. Placeholder Text
```typescript
value={
  <div className={fieldBoxClass}>
    {trimmed.length > 0 ? trimmed : <span className="text-gray-400">{placeholder}</span>}
  </div>
}
```

**Features:**
- Uses `text-gray-400` for placeholder styling
- Inline span for placeholder to maintain layout

### 6. Address Grid (City, State, Zip)
```typescript
<FieldRow
  label=""
  value={
    <div className="grid max-w-md grid-cols-[2fr,1fr,1fr] gap-1">
      {renderAddressValue(account.shippingAddress.city, "City", "max-w-none")}
      {renderAddressSelectValue(account.shippingAddress.state, "State")}
      {renderAddressValue(account.shippingAddress.postalCode, "Zip", "max-w-none")}
    </div>
  }
/>
```

**Features:**
- Nested grid: `grid-cols-[2fr,1fr,1fr]`
- City gets 2 parts, State and Zip get 1 part each
- Small gap between fields (`gap-1` = 4px)
- Empty label (`label=""`) for continuation rows

### 7. Empty Spacing Row
```typescript
<FieldRow
  label=""
  value={<div className="min-h-[28px]"></div>}
/>
```

**Purpose:** Maintains vertical alignment between columns when one side has fewer fields

## Alignment Technical Details

### Why `pl-[3px] pr-0`?

Browser `<select>` elements have built-in internal padding (~2-3px) that cannot be removed with CSS. To align text inputs and textareas with selects:

1. **DO NOT** use `px-0` on text inputs - they will start at pixel 0
2. **DO USE** `pl-[3px] pr-0` - matches the internal padding of select elements
3. This ensures all field types start text at the same horizontal position

### Why `min-h-[28px]` on Labels?

Field value containers have `min-h-[28px]` from `fieldBoxClass`. Without matching height on labels:

- Labels sit at their natural text baseline (higher position)
- Values are vertically centered in 28px container (lower position)
- Result: vertical misalignment

By adding `flex items-center min-h-[28px]` to labels:
- Labels get same 28px container as values
- Both are vertically centered at same position
- Result: perfect horizontal alignment

## Importing Components

### Required Imports
```typescript
import { FieldRow } from "./detail/FieldRow"
import { fieldBoxClass, fieldLabelClass } from "./detail/shared"
import { cn } from "@/lib/utils"
```

### Optional Icons
```typescript
import { ChevronDown } from "lucide-react"
```

## Best Practices

1. **Always use FieldRow component** for consistency
2. **Always use fieldBoxClass** for field values
3. **Use `cn()` utility** when adding custom classes to fieldBoxClass
4. **Empty labels** for continuation rows (e.g., address line 2)
5. **Placeholder text** should use `text-gray-400`
6. **Select fields** should include ChevronDown icon with `justify-between`
7. **Multi-line content** should override `whitespace-nowrap` with `whitespace-normal`
8. **Spacing rows** maintain alignment between uneven columns

## Common Modifications

### Remove max-width constraint
```typescript
<div className={cn(fieldBoxClass, "max-w-none")}>
```

### Allow text wrapping
```typescript
<div className={cn(fieldBoxClass, "whitespace-normal")}>
```

### Change justify behavior
```typescript
<div className={cn(fieldBoxClass, "justify-start")}>  // Left align
<div className={cn(fieldBoxClass, "justify-between")}> // Space between (for icons)
<div className={cn(fieldBoxClass, "justify-end")}>     // Right align
```

### Nested layouts
```typescript
<FieldRow
  label="Complex Field"
  value={
    <div className="flex items-end gap-2 max-w-md">
      <div className={cn(fieldBoxClass, "flex-1 max-w-none")}>Main content</div>
      <div className="shrink-0">Side content</div>
    </div>
  }
/>
```

## Responsive Behavior

The layout automatically adapts:
- **Large screens (lg+):** Two-column grid
- **Medium/Small screens:** Single column (stacks vertically)
- **Label width:** Fixed at 140px on small+ screens
- **Field width:** Flexible, uses remaining space

## Example: Creating a New Detail Page

```typescript
import { FieldRow } from "./detail/FieldRow"
import { fieldBoxClass, fieldLabelClass } from "./detail/shared"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

function ProductHeader({ product }: { product: ProductDetail }) {
  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm h-[300px] overflow-y-auto">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">
          Product Detail
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-1.5">
          <FieldRow
            label="Product Name"
            value={<div className={fieldBoxClass}>{product.name}</div>}
          />

          <FieldRow
            label="Category"
            value={
              <div className={cn(fieldBoxClass, "justify-between")}>
                <span>{product.category}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            }
          />
        </div>

        <div className="space-y-1.5">
          <FieldRow
            label="Description"
            value={
              <div className={cn(fieldBoxClass, "whitespace-normal")}>
                {product.description || "No description"}
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}
```

## Summary

The Account Detail layout provides:
- ✅ Consistent horizontal alignment between all field types
- ✅ Consistent vertical alignment between labels and values
- ✅ Reusable components (FieldRow, shared classes)
- ✅ Responsive two-column grid
- ✅ Flexible field value rendering
- ✅ Clean, maintainable code

Apply these same patterns to any new detail page for visual consistency across the application.
