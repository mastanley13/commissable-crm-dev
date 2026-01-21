# Finalize Deposit Review Matches - Sort Dropdown Update

## Summary
Updated the sort dropdown on the Finalize Deposit Review Matches page to match the dropdown style used in the Accounts List page.

## Changes Made

### File: `app/(dashboard)/reconciliation/[depositId]/finalize/page.tsx`

#### 1. Added Imports
- Added `@radix-ui/react-dropdown-menu` components
- Added `Check` and `ChevronDown` icons from `lucide-react`

```typescript
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown } from "lucide-react"
```

#### 2. Removed "Sort:" Prefix
- Previously: Option labels displayed as "Sort: None", "Sort: Payment Date (Newest)", etc.
- Now: Option labels display cleanly without prefix: "None", "Payment Date (Newest)", etc.

#### 3. Replaced Native Select with Radix UI Dropdown
- Replaced the native `<select>` element with a styled Radix UI dropdown menu
- New dropdown matches the styling of `AccountStatusFilterDropdown` component used in Accounts List
- Features:
  - Rounded button with shadow and hover effects
  - Chevron down icon for visual indicator
  - Portal-based dropdown menu with animations
  - Check icon next to selected option
  - Clean, modern appearance consistent with the rest of the app

#### 4. Styling Details - Compact Mode
- Button: 
  - Width: `w-52` (matches other controls)
  - Padding: `px-3 py-0.5` (compact mode sizing)
  - Border: `rounded` (not rounded-lg for consistency)
  - Icon: `h-3 w-3` chevron (smaller to match compact controls)
  - No shadow-sm (matches other input controls)
- Dropdown content: 
  - Border: `rounded` (consistent with button)
  - Shadow: `shadow-lg` for emphasis
  - Animation: Fade-in effect
- Menu items: 
  - Padding: `px-2 py-1.5` (more compact)
  - Hover and focus states with background transitions
- Selected item: 
  - Check mark icon: `h-3.5 w-3.5` (slightly smaller for compact display)

## Testing Recommendations
1. Navigate to a deposit and click "Finalize Deposit"
2. On the Review Matches page, verify the sort dropdown:
   - Should appear without "Sort:" prefix
   - Should match the style of the Active/Show Inactive dropdown in Accounts List
   - Should show a check mark next to the currently selected option
   - Should have smooth animations when opening/closing
   - Should properly sort the matches table when selecting different options

## Dependencies
- No new dependencies required
- Uses existing `@radix-ui/react-dropdown-menu` package (already in package.json)
