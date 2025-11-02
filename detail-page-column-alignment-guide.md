# Detail Page Column Alignment Guide

## Overview
This guide ensures consistent horizontal row alignment between left and right columns in two-column detail page layouts. When both columns use the same spacing system, rows should align perfectly across the page.

## For AI Coding Agents:
Use this prompt template:
Reference the alignment guide at detail-page-column-alignment-guide.md
Create a detail page with [describe your fields]
Ensure rows align according to the guide's principles 

## Key Principles

### 1. Use Consistent Row Components
Both columns must use the same `FieldRow` component with identical spacing:
```tsx
<div className="space-y-1.5">  // Same spacing for both columns
  <FieldRow label="..." value={...} />
  <FieldRow label="..." value={...} />
</div>
```

### 2. One Row Per FieldRow Component
Each `FieldRow` should represent a single horizontal row, even if the field has no label:
```tsx
// ✅ CORRECT: Separate rows
<FieldRow label="Address" value={street1Field} />
<FieldRow label="" value={street2Field} />
<FieldRow label="" value={cityStateZipFields} />

// ❌ WRONG: Nested rows in value
<FieldRow
  label="Address"
  value={
    <div className="space-y-1">
      {street1Field}
      {street2Field}
      {cityStateZipFields}
    </div>
  }
/>
```

### 3. Match Row Counts
Both columns must have the same number of `FieldRow` components. Use empty spacer rows when needed:
```tsx
// Left column has 7 rows, right column must also have 7 rows
<FieldRow label="" value={<div className="min-h-[28px]"></div>} />
```

### 4. Avoid Extra Height in Label Column
When using `labelExtra`, ensure it doesn't add vertical height that breaks alignment:
```tsx
// ❌ WRONG: labelExtra stacks vertically, breaking alignment
<FieldRow
  label="Bill To Address"
  labelExtra={<div className="flex flex-col gap-1">...</div>}
  value={street1Field}
/>

// ✅ CORRECT: Put labelExtra on the next row or inline
<FieldRow label="Bill To Address" value={street1Field} />
<FieldRow
  label=""
  labelExtra={<Checkbox />}  // Appears below label on next row
  value={street2Field}
/>
```

## Implementation Pattern

### Account Details Page Example

**Target Alignment:**
```
Left Column          →  Right Column
─────────────────────────────────────────────────
Account Name         →  Ship To Street 1
Account Legal Name   →  Ship To Street 2
Parent Account       →  Ship To City/State/Zip
Account Type         →  (Spacer)
Account Owner        →  Bill To Street 1
Website URL          →  Bill To Street 2 + Checkbox
Description          →  Bill To City/State/Zip
```

### Code Structure

```tsx
<div className="grid gap-6 lg:grid-cols-2">
  {/* LEFT COLUMN */}
  <div className="space-y-1.5">
    <FieldRow label="Account Name" value={...} />           {/* Row 1 */}
    <FieldRow label="Account Legal Name" value={...} />     {/* Row 2 */}
    <FieldRow label="Parent Account" value={...} />         {/* Row 3 */}
    <FieldRow label="Account Type" value={...} />           {/* Row 4 */}
    <FieldRow label="Account Owner" value={...} />          {/* Row 5 */}
    <FieldRow label="Website URL" value={...} />            {/* Row 6 */}
    <FieldRow label="Description" value={...} />            {/* Row 7 */}
  </div>

  {/* RIGHT COLUMN */}
  <div className="space-y-1.5">
    <FieldRow label="Ship To Address" value={street1} />    {/* Row 1 */}
    <FieldRow label="" value={street2} />                   {/* Row 2 */}
    <FieldRow label="" value={cityStateZip} />              {/* Row 3 */}
    <FieldRow label="" value={<div className="min-h-[28px]"></div>} />  {/* Row 4 - Spacer */}
    <FieldRow label="Bill To Address" value={billingStreet1} />  {/* Row 5 */}
    <FieldRow
      label=""
      labelExtra={<Checkbox />}                              {/* Row 6 */}
      value={billingStreet2}
    />
    <FieldRow label="" value={billingCityStateZip} />       {/* Row 7 */}
  </div>
</div>
```

## Common Patterns

### Multi-Line Fields (Addresses)

When a logical field spans multiple rows (like an address), break it into individual `FieldRow` components:

```tsx
// Ship To Address (3 rows)
<FieldRow label="Ship To Address" value={line1Field} />
<FieldRow label="" value={line2Field} />
<FieldRow label="" value={<div className="grid grid-cols-[2fr,1fr,1fr] gap-1">
  {cityField}
  {stateField}
  {zipField}
</div>} />
```

### Conditional Fields

When fields may or may not exist, always render the row with a placeholder:

```tsx
// ✅ CORRECT: Always renders a row
<FieldRow
  label="Ship To Address"
  value={
    shippingAddress ? (
      renderAddressValue(shippingAddress.line1, "Street")
    ) : (
      <div className="min-h-[28px]"></div>
    )
  }
/>

// ❌ WRONG: Conditionally renders row, breaking alignment
{shippingAddress && (
  <FieldRow label="Ship To Address" value={...} />
)}
```

### Spacer Rows

Use spacer rows when one column has fewer logical fields:

```tsx
// Left column has a field, right column needs empty space
// Left
<FieldRow label="Account Type" value={...} />

// Right - matches row count with empty content
<FieldRow label="" value={<div className="min-h-[28px]"></div>} />
```

### Labels with Extra Content

Use `labelExtra` for checkboxes or small elements that appear below the label:

```tsx
<FieldRow
  label="Bill To Address"
  labelExtra={
    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      <input type="checkbox" />
      <span>Same as Ship To</span>
    </label>
  }
  value={billingStreetField}
/>
```

## FieldRow Component Structure

```tsx
function FieldRow({ label, value, labelExtra }: {
  label: string;
  value: ReactNode;
  labelExtra?: ReactNode
}) {
  return (
    <div className="grid items-start gap-4 sm:grid-cols-[140px,1fr]">
      <div className="flex flex-col gap-1">
        <span className={fieldLabelClass}>{label}</span>
        {labelExtra}
      </div>
      <div>{value}</div>
    </div>
  )
}
```

### Key CSS Classes
- **Container**: `grid items-start gap-4 sm:grid-cols-[140px,1fr]`
  - `items-start` ensures rows don't stretch vertically
  - `140px` label column width
  - `1fr` flexible value column
- **Spacing**: `space-y-1.5` between rows
- **Min Height**: `min-h-[28px]` for empty fields to maintain row height

## Debugging Alignment Issues

### Issue: Right column rows are lower than left column

**Cause**: The right column has fewer rows, or extra vertical space is being added.

**Solution**:
1. Count `FieldRow` components in each column - they must match
2. Check for nested `space-y` or `gap` classes in value content
3. Ensure `labelExtra` content isn't adding vertical height

### Issue: One row is taller than its counterpart

**Cause**: Content within a row is wrapping or has different height.

**Solution**:
1. Use `items-start` instead of `items-center` in grid
2. Apply `whitespace-nowrap` to prevent text wrapping
3. Use consistent `min-h-[28px]` for fields

### Issue: Labels and values don't align after a certain row

**Cause**: A row earlier in the column is missing or has extra height.

**Solution**:
1. Count rows from the top - identify which row breaks alignment
2. Check if that row uses `flex-col` with `gap` in `labelExtra`
3. Verify no conditional rendering is hiding rows

## Checklist for New Detail Pages

- [ ] Both columns use `space-y-1.5` spacing
- [ ] All fields use `FieldRow` component
- [ ] Row counts match between columns
- [ ] Multi-line fields (addresses) split into separate rows
- [ ] Empty spacer rows added where needed
- [ ] Conditional fields render placeholder instead of hiding
- [ ] `labelExtra` content doesn't add vertical height
- [ ] Grid uses `items-start` for alignment
- [ ] Test with different data scenarios (missing fields, long text)

## Prompting Pattern for AI Coding Agents

When asking an AI agent to create or modify detail pages:

```
Create a two-column detail page layout with perfect horizontal row alignment.

Requirements:
1. Use FieldRow component for every row in both columns
2. Both columns must have exactly [N] rows with space-y-1.5 spacing
3. Multi-line fields (like addresses) should be split into separate FieldRow components
4. Use empty spacer rows where one column has no content
5. Ensure labelExtra doesn't add vertical height - put extra content on the next row if needed

Alignment map:
Left Column Row 1 → Right Column Row 1
Left Column Row 2 → Right Column Row 2
[continue for all rows...]
```

## Example Files

- **Reference Implementation**: `components/account-details-view.tsx`
  - See lines 850-994 for read-only version
  - See lines 1107-1416 for editable version
- **FieldRow Component**: `components/account-details-view.tsx` lines 787-797

## Quick Reference

```tsx
// Perfect alignment structure
<div className="grid gap-6 lg:grid-cols-2">
  <div className="space-y-1.5">
    {/* Exactly N rows */}
    <FieldRow ... />
    <FieldRow ... />
    // ... N rows total
  </div>
  <div className="space-y-1.5">
    {/* Exactly N rows - must match left column */}
    <FieldRow ... />
    <FieldRow ... />
    // ... N rows total
  </div>
</div>
```

---

**Last Updated**: 2025-01-30
**Related Components**: `FieldRow`, `EditableField`, detail view components
**Related Patterns**: Form layouts, read-only displays, two-column layouts
