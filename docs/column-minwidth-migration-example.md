# Practical Example: Applying Systematic minWidth to Contacts Page

This example shows how to migrate the contacts page to use the systematic minWidth logic.

## Before (Current State)

```typescript
const contactColumns: Column[] = [
  {
    id: "suffix",
    label: "Suffix",
    width: 100,
    minWidth: 80,  // ❌ Arbitrary value
    maxWidth: 120,
    sortable: true,
    type: "text",
  },
  {
    id: "fullName",
    label: "Full Name",
    width: 180,
    minWidth: 140,  // ❌ Arbitrary value
    maxWidth: 300,
    sortable: true,
    type: "text",
  },
  // ... more columns with inconsistent minWidths
]
```

## After (Using Systematic Logic)

### Option 1: Individual Column Updates (Recommended for Migration)

```typescript
import { calculateMinWidth } from "@/lib/column-width-utils"

const contactColumns: Column[] = [
  {
    id: "suffix",
    label: "Suffix",
    width: 100,
    minWidth: calculateMinWidth({ 
      label: "Suffix", 
      type: "text", 
      sortable: true 
    }), // ✅ Calculates: max(100px base, ~72px header) = 100px
    maxWidth: 120,
    sortable: true,
    type: "text",
    accessor: "suffix"
  },
  {
    id: "fullName",
    label: "Full Name",
    width: 180,
    minWidth: calculateMinWidth({ 
      label: "Full Name", 
      type: "text", 
      sortable: true 
    }, { 
      contentBuffer: 20  // ✅ Extra space for longer names
    }), // ✅ Calculates: max(100px base, ~83px header) + 20px = 120px
    maxWidth: 300,
    sortable: true,
    type: "text",
    hideable: false,
    render: value => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
        {value}
      </span>
    )
  },
  {
    id: "emailAddress",
    label: "Email Address",
    width: 200,
    minWidth: calculateMinWidth({ 
      label: "Email Address", 
      type: "email", 
      sortable: true 
    }), // ✅ Calculates: max(160px base, ~118px header) = 160px
    maxWidth: 300,
    sortable: true,
    type: "email",
    render: value => value ? (
      <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800 transition-colors truncate">
        {value}
      </a>
    ) : <span className="text-gray-400">-</span>
  },
  // ... rest of columns
]
```

### Option 2: Bulk Apply (For New Tables or Complete Refactor)

```typescript
import { applyConsistentMinWidths, validateColumnHeaders } from "@/lib/column-width-utils"

// Define columns WITHOUT minWidth
const contactColumnsBase: Column[] = [
  {
    id: "suffix",
    label: "Suffix",
    width: 100,
    maxWidth: 120,
    sortable: true,
    type: "text",
    accessor: "suffix"
  },
  {
    id: "fullName",
    label: "Full Name",
    width: 180,
    maxWidth: 300,
    sortable: true,
    type: "text",
    hideable: false,
    render: value => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
        {value}
      </span>
    )
  },
  // ... rest of columns
]

// Apply consistent minWidths with overrides
const contactColumns = applyConsistentMinWidths(contactColumnsBase, {
  overrides: {
    fullName: { contentBuffer: 20 },  // Extra space for long names
    emailAddress: { contentBuffer: 0 }, // Already has 160px base, sufficient
  }
})

// Validate headers fit (for development/testing)
if (process.env.NODE_ENV === 'development') {
  const validation = validateColumnHeaders(contactColumns)
  if (!validation.valid) {
    console.warn('Column header validation issues:', validation.issues)
    // Example output:
    // [
    //   {
    //     columnId: "someColumn",
    //     label: "Very Long Column Name",
    //     minWidth: 100,
    //     requiredWidth: 180,
    //     difference: 80
    //   }
    // ]
  }
}
```

## Results Comparison

| Column | Old minWidth | New minWidth | Reason |
|--------|--------------|--------------|--------|
| Suffix | 80px | 100px | Header fits: "Suffix" (6 chars) = 72px, base is 100px ✅ |
| Extension | 80px | 100px | Header fits: "Extension" (9 chars) = 83px, base is 100px ✅ |
| Contact Type | 100px | 100px | Header fits: "Contact Type" (12 chars) = 94px, base is 100px ✅ |
| Full Name | 140px | 120px | Header fits: "Full Name" (9 chars) = 83px + 20px buffer = 120px ✅ |
| Email Address | 160px | 160px | Header fits: "Email Address" (14 chars) = 118px, base is 160px ✅ |
| Work Phone | 120px | 120px | Header fits: "Work Phone" (10 chars) = 90px, base is 120px ✅ |

## Benefits

1. ✅ **Headers Never Clip**: All headers calculated to fit with 10px safety margin
2. ✅ **Consistent Logic**: Same column type → same base minWidth
3. ✅ **Flexible Overrides**: Can add contentBuffer for columns with long content
4. ✅ **Validation Available**: Can check for header clipping issues
5. ✅ **Truncation Preserved**: CSS truncation still works (minWidth only sets floor)

## Migration Steps

1. Import utility functions
2. Replace hardcoded minWidth values with `calculateMinWidth()` calls
3. Add contentBuffer where needed (e.g., name fields, descriptions)
4. Run validation check (development only)
5. Test visually: verify headers don't clip, content truncates properly
6. Test functionality: verify column resizing still works

## Testing Checklist

- [ ] Headers display fully at minimum width
- [ ] Long content truncates with ellipsis
- [ ] Columns can be resized within min/max constraints
- [ ] Saved column preferences still work
- [ ] No visual regressions

