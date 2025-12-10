# Field Label Refactoring Implementation Plan

**Project:** Commissable CRM
**Date Created:** December 9, 2025
**Objective:** Update 70 field labels from "[Field] - [Entity]" to "[Entity] - [Field]" pattern

---

## Executive Summary

This document outlines the complete implementation plan for refactoring 70 field labels across the Commissable CRM application. The changes affect 30+ files including components, pages, API routes, and database documentation.

**Key Finding:** ✅ User table preferences store column IDs (not labels), so NO database migration is required. Risk level: **LOW**.

**Estimated Timeline:** 6-7 hours over 2 days

---

## Table of Contents

1. [Scope Overview](#scope-overview)
2. [Field Labels to Update](#field-labels-to-update)
3. [Files Requiring Updates](#files-requiring-updates)
4. [Implementation Strategy](#implementation-strategy)
5. [Label Update Patterns](#label-update-patterns)
6. [Complete Search & Replace List](#complete-search--replace-list)
7. [Risk Assessment](#risk-assessment)
8. [Execution Timeline](#execution-timeline)
9. [Git Strategy](#git-strategy)
10. [Success Criteria](#success-criteria)

---

## Scope Overview

### Entities Affected
- **House**: 6 field types (Account ID, Customer ID, Order ID, Product Name, Part Number, Product Description)
- **Vendor**: 8 field types (Account ID, Customer ID, Order ID, Product Name, Product Family, Product Subtype, Part Number, Product Description)
- **Distributor**: 2 field types (Customer ID, Order ID)

### Total Changes Required
- **70 field labels** across UI components, pages, and API routes
- **Database schema comments** in Prisma schema and migrations
- **18 unique field patterns** to update

### Database Field Names - UNCHANGED ✓
Database field names (camelCase) remain unchanged. Only display labels are being updated:
- `orderIdHouse`, `orderIdVendor`, `orderIdDistributor`
- `accountIdHouse`, `accountIdVendor`
- `customerIdHouse`, `customerIdVendor`, `customerIdDistributor`
- `productNameHouse`, `productNameVendor`
- `partNumberHouse`, `partNumberVendor`
- `productDescriptionHouse`, `productDescriptionVendor`
- `productFamilyVendor`, `productSubtypeVendor`

---

## Field Labels to Update

### House Fields (6 patterns)
| Current Label | New Label |
|---------------|-----------|
| Account ID - House | House - Account ID |
| Customer ID - House | House - Customer ID |
| Order ID - House | House - Order ID |
| Product Name - House | House - Product Name |
| Part Number - House | House - Part Number |
| Product Description - House | House - Product Description |

### Vendor Fields (8 patterns)
| Current Label | New Label |
|---------------|-----------|
| Account ID - Vendor | Vendor - Account ID |
| Customer ID - Vendor | Vendor - Customer ID |
| Order ID - Vendor | Vendor - Order ID |
| Product Name - Vendor | Vendor - Product Name |
| Product Family - Vendor | Vendor - Product Family |
| Product Subtype - Vendor | Vendor - Product Subtype |
| Part Number - Vendor | Vendor - Part Number |
| Product Description - Vendor | Vendor - Product Description |

### Distributor Fields (2 patterns)
| Current Label | New Label |
|---------------|-----------|
| Customer ID - Distributor | Distributor - Customer ID |
| Order ID - Distributor | Distributor - Order ID |

---

## Files Requiring Updates

### Component Files (10 files)
| File | Occurrences | Key Changes |
|------|-------------|-------------|
| `components/opportunity-details-view.tsx` | 12+ | Product columns, identifier arrays, revenue schedule columns |
| `components/account-details-view.tsx` | 9 | Opportunities tab columns, filters, Excel exports |
| `components/contact-details-view.tsx` | 12 | Similar to account-details-view |
| `components/revenue-schedule-supporting-details.tsx` | 9 | Identifier display arrays |
| `components/revenue-schedule-details-view.tsx` | 4 | Product information display |
| `components/product-details-view.tsx` | 3+ | Product field labels |
| `components/opportunity-create-modal.tsx` | 12 | Form labels for all ID fields |
| `components/ticket-create-modal.tsx` | 1+ | Product/Account/Customer fields |
| `components/product-create-modal.tsx` | 4 | Part Number - House form fields |
| `components/deposit-reconciliation-detail-view.tsx` | TBD | Reconciliation fields |

### Page Files (7 files)
| File | Occurrences | Key Changes |
|------|-------------|-------------|
| `app/(dashboard)/opportunities/page.tsx` | 9+ | Filter options, columns, exports |
| `app/(dashboard)/products/page.tsx` | 15+ | Highest density - filters and columns |
| `app/(dashboard)/revenue-schedules/page.tsx` | 3-4 | Product Name, Customer/Order IDs |
| `app/(dashboard)/tickets/page.tsx` | 4 | Vendor-related fields |
| `app/(dashboard)/reconciliation/page.tsx` | 6-9 | Product Name, Customer/Order IDs |
| `app/(dashboard)/accounts/page.tsx` | TBD | Account-related fields |
| `app/(dashboard)/opportunities/[opportunityId]/page.tsx` | TBD | Opportunity detail fields |

### Database Files (3 files)
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add /// comments above 41 field definitions |
| `prisma/migrations/add_opportunity_contact_fields.sql` | Update COMMENT statements |
| `prisma/migrations/add_opportunity_identifiers.sql` | Update COMMENT statements |

### API Routes & Supporting Files (15+ files)
Files to verify (labels may appear in comments or type definitions):
- `app/api/accounts/[accountId]/route.ts`
- `app/api/accounts/reassignment-preview/route.ts`
- `app/api/contacts/[id]/route.ts`
- `app/api/opportunities/route.ts`
- `app/api/opportunities/helpers.ts`
- `app/api/opportunities/[opportunityId]/route.ts`
- `app/api/opportunities/[opportunityId]/line-items/route.ts`
- `app/api/products/route.ts`
- `app/api/products/[productId]/route.ts`
- `app/api/revenue-schedules/helpers.ts`
- `app/api/revenue-schedules/route.ts`
- `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
- `app/api/revenue-schedules/[revenueScheduleId]/clone/route.ts`
- `app/api/tickets/route.ts`
- `tmp_view.tsx`
- `lib/matching/deposit-matcher.ts`

---

## Implementation Strategy

### Phase 1: Database Documentation Updates
**Priority:** HIGH - Establish source of truth
**Estimated Time:** 30 minutes

**Files to Update:**
1. `prisma/schema.prisma` - Add /// comments above field definitions
2. `prisma/migrations/add_opportunity_contact_fields.sql` - Update COMMENT statements
3. `prisma/migrations/add_opportunity_identifiers.sql` - Update COMMENT statements

**Pattern:**
```sql
-- Before
COMMENT ON COLUMN "Opportunity"."orderIdHouse" IS 'Order ID - House (Field 01.07.001)';

-- After
COMMENT ON COLUMN "Opportunity"."orderIdHouse" IS 'House - Order ID (Field 01.07.001)';
```

**Verification:**
```bash
grep -r "- House\|- Vendor\|- Distributor" prisma/migrations/*.sql
```

---

### Phase 2: Component Files (High Impact)
**Priority:** HIGH - Most visible to users
**Estimated Time:** 2.5-3 hours

#### Group A: Detail View Components (6 files)

**1. `components/opportunity-details-view.tsx` (12+ occurrences)**
- **Line ~227:** Product table column definitions
- **Lines ~654-663:** Identifier display arrays (all 9 ID fields)
- Revenue schedule column definitions

**2. `components/account-details-view.tsx` (9 occurrences)**
- **Line ~556:** Opportunities tab column definition
- **Line ~2025:** Filter configuration
- **Line ~3355:** Excel export headers

**3. `components/contact-details-view.tsx` (12 occurrences)**
- Similar structure to account-details-view
- **Line ~483:** Opportunities tab columns
- **Line ~2425:** Filter configs

**4. `components/revenue-schedule-supporting-details.tsx` (9 occurrences)**
- **Lines ~713-727:** Identifier display arrays
- All ID fields for House/Vendor/Distributor

**5. `components/revenue-schedule-details-view.tsx` (4 occurrences)**
- Product information display fields
- Product Name - Vendor occurrences

**6. `components/product-details-view.tsx` (3+ occurrences)**
- **Lines ~414, 419:** Product Name and Part Number - House
- **Lines ~700, 711:** Filter configurations

#### Group B: Modal Components (4 files)

**7. `components/opportunity-create-modal.tsx` (12 occurrences)**
- **Starting line ~781:** Form labels for all ID fields
- Pattern: `<label>Order ID - House</label>` → `<label>House - Order ID</label>`

**8. `components/ticket-create-modal.tsx` (1+ occurrence)**
- Product/Account/Customer field labels

**9. `components/product-create-modal.tsx` (4 occurrences)**
- **Lines ~57, 81, 476, 833:** Part Number - House form fields

**10. `components/deposit-reconciliation-detail-view.tsx`**
- Reconciliation field mappings

**Commit Strategy:**
- Commit after each file: `"Update [component-name] field labels"`
- Test in browser between files

---

### Phase 3: Page Files (Main Tables)
**Priority:** HIGH - High visibility
**Estimated Time:** 2 hours

**1. `app/(dashboard)/opportunities/page.tsx` (9+ occurrences)**
- **Line ~85:** Filter options array
- **Line ~240:** Column definitions
- **Line ~744:** Excel export headers
- Update both `label:` and `calculateMinWidth({ label: ... })`

**2. `app/(dashboard)/products/page.tsx` (15+ occurrences)**
- Highest density of product-related labels
- Filter options and column definitions
- All product fields: Name, Family, Subtype, Part Number, Description

**3. `app/(dashboard)/revenue-schedules/page.tsx` (3-4 occurrences)**
- Product Name - Vendor
- Customer/Order IDs

**4. `app/(dashboard)/tickets/page.tsx` (4 occurrences)**
- Product Name - Vendor
- Account/Customer/Order IDs - Vendor

**5. `app/(dashboard)/reconciliation/page.tsx` (6-9 occurrences)**
- Product Name - Vendor
- Customer/Order IDs for Vendor/Distributor

**Commit Strategy:**
- Commit after each page: `"Update [page-name] field labels"`

---

### Phase 4: API Routes & Supporting Files
**Priority:** MEDIUM - Verify only
**Estimated Time:** 30 minutes

**Action:** Search for labels in comments or type definitions

**Files to check:**
- `app/api/tickets/route.ts`
- `tmp_view.tsx`
- `lib/matching/deposit-matcher.ts`
- All API helper files

**Verification:**
```bash
grep -r "Order ID - \|Account ID - \|Customer ID - \|Product" app/api/ --include="*.ts"
```

---

### Phase 5: Validation & Testing
**Priority:** CRITICAL
**Estimated Time:** 1 hour

#### Step 1: Automated String Search
```bash
# Verify all old patterns removed (run for each pattern)
grep -r "Order ID - House" --include="*.tsx" --include="*.ts" --include="*.sql"
grep -r "Order ID - Vendor" --include="*.tsx" --include="*.ts" --include="*.sql"
grep -r "Order ID - Distributor" --include="*.tsx" --include="*.ts" --include="*.sql"
grep -r "Account ID - House" --include="*.tsx" --include="*.ts"
grep -r "Account ID - Vendor" --include="*.tsx" --include="*.ts"
grep -r "Customer ID - House" --include="*.tsx" --include="*.ts"
grep -r "Customer ID - Vendor" --include="*.tsx" --include="*.ts"
grep -r "Customer ID - Distributor" --include="*.tsx" --include="*.ts"
grep -r "Product Name - House" --include="*.tsx" --include="*.ts"
grep -r "Product Name - Vendor" --include="*.tsx" --include="*.ts"
grep -r "Product Family - Vendor" --include="*.tsx" --include="*.ts"
grep -r "Product Subtype - Vendor" --include="*.tsx" --include="*.ts"
grep -r "Part Number - House" --include="*.tsx" --include="*.ts"
grep -r "Part Number - Vendor" --include="*.tsx" --include="*.ts"
grep -r "Product Description - House" --include="*.tsx" --include="*.ts"
grep -r "Product Description - Vendor" --include="*.tsx" --include="*.ts"
```

**Expected Result:** Zero occurrences found

#### Step 2: Build Test
```bash
npm run build
# or
npx tsc --noEmit
```

**Expected Result:** No TypeScript errors

#### Step 3: Manual UI Testing Checklist

**Opportunities List Page:**
- [ ] Column headers display new labels
- [ ] Filter dropdown shows new labels
- [ ] Column sorting still works
- [ ] Column chooser shows new labels
- [ ] Excel export headers correct

**Products List Page:**
- [ ] All product field columns updated
- [ ] Filter options functional
- [ ] Create/Edit modal labels correct

**Revenue Schedules:**
- [ ] List view columns updated
- [ ] Detail view identifier sections show new labels
- [ ] Supporting details display correct

**Account/Contact Detail Pages:**
- [ ] Opportunities tab columns updated
- [ ] Detail identifier sections correct

**Tickets Page:**
- [ ] Column headers correct
- [ ] Create modal labels updated

**Reconciliation Page:**
- [ ] Deposit line item columns updated

**User Preferences:**
- [ ] Load page with existing saved preferences
- [ ] Verify columns display correctly
- [ ] Verify hidden columns still hidden
- [ ] Verify column order preserved
- [ ] Create new preferences (reorder, hide/show columns)
- [ ] Save and reload - verify persistence

---

## Label Update Patterns

### Pattern 1: Column Definitions
```typescript
// Before
{
  id: 'orderIdHouse',
  label: 'Order ID - House',
  width: 150,
  minWidth: calculateMinWidth({ label: 'Order ID - House', type: 'text', sortable: true }),
  accessor: 'orderIdHouse',
  sortable: true
}

// After
{
  id: 'orderIdHouse',
  label: 'House - Order ID',
  width: 150,
  minWidth: calculateMinWidth({ label: 'House - Order ID', type: 'text', sortable: true }),
  accessor: 'orderIdHouse',
  sortable: true
}
```

### Pattern 2: Filter Configurations
```typescript
// Before
const FILTER_OPTIONS = [
  { id: 'orderIdHouse', label: 'Order ID - House' },
  { id: 'accountIdVendor', label: 'Account ID - Vendor' }
]

// After
const FILTER_OPTIONS = [
  { id: 'orderIdHouse', label: 'House - Order ID' },
  { id: 'accountIdVendor', label: 'Vendor - Account ID' }
]
```

### Pattern 3: Form Labels (JSX)
```typescript
// Before
<label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
  Order ID - House
</label>
<input
  type="text"
  value={form.orderIdHouse}
  onChange={e => setForm(prev => ({ ...prev, orderIdHouse: e.target.value }))}
  className={inputClass}
  placeholder="Enter Order ID (House)"
/>

// After
<label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
  House - Order ID
</label>
<input
  type="text"
  value={form.orderIdHouse}
  onChange={e => setForm(prev => ({ ...prev, orderIdHouse: e.target.value }))}
  className={inputClass}
  placeholder="Enter Order ID (House)"
/>
```

### Pattern 4: Detail View Display Arrays
```typescript
// Before
const identifierFields = [
  { label: "Account ID - House", value: identifiers.accountIdHouse },
  { label: "Account ID - Vendor", value: identifiers.accountIdVendor },
  { label: "Customer ID - House", value: identifiers.customerIdHouse },
  { label: "Order ID - House", value: identifiers.orderIdHouse }
]

// After
const identifierFields = [
  { label: "House - Account ID", value: identifiers.accountIdHouse },
  { label: "Vendor - Account ID", value: identifiers.accountIdVendor },
  { label: "House - Customer ID", value: identifiers.customerIdHouse },
  { label: "House - Order ID", value: identifiers.orderIdHouse }
]
```

---

## Complete Search & Replace List

Execute these exact string replacements across the codebase:

### Order ID Fields (3 patterns × 3 quote styles = 9 replacements)
1. `"Order ID - House"` → `"House - Order ID"`
2. `'Order ID - House'` → `'House - Order ID'`
3. `>Order ID - House<` → `>House - Order ID<` (JSX tags)
4. `"Order ID - Vendor"` → `"Vendor - Order ID"`
5. `'Order ID - Vendor'` → `'Vendor - Order ID'`
6. `>Order ID - Vendor<` → `>Vendor - Order ID<`
7. `"Order ID - Distributor"` → `"Distributor - Order ID"`
8. `'Order ID - Distributor'` → `'Distributor - Order ID'`
9. `>Order ID - Distributor<` → `>Distributor - Order ID<`

### Account ID Fields (3 patterns × 3 quote styles = 9 replacements)
10. `"Account ID - House"` → `"House - Account ID"`
11. `'Account ID - House'` → `'House - Account ID'`
12. `>Account ID - House<` → `>House - Account ID<`
13. `"Account ID - Vendor"` → `"Vendor - Account ID"`
14. `'Account ID - Vendor'` → `'Vendor - Account ID'`
15. `>Account ID - Vendor<` → `>Vendor - Account ID<`
16. `"Account ID - Distributor"` → `"Distributor - Account ID"`
17. `'Account ID - Distributor'` → `'Distributor - Account ID'`
18. `>Account ID - Distributor<` → `>Distributor - Account ID<`

### Customer ID Fields (3 patterns × 3 quote styles = 9 replacements)
19. `"Customer ID - House"` → `"House - Customer ID"`
20. `'Customer ID - House'` → `'House - Customer ID'`
21. `>Customer ID - House<` → `>House - Customer ID<`
22. `"Customer ID - Vendor"` → `"Vendor - Customer ID"`
23. `'Customer ID - Vendor'` → `'Vendor - Customer ID'`
24. `>Customer ID - Vendor<` → `>Vendor - Customer ID<`
25. `"Customer ID - Distributor"` → `"Distributor - Customer ID"`
26. `'Customer ID - Distributor'` → `'Distributor - Customer ID'`
27. `>Customer ID - Distributor<` → `>Distributor - Customer ID<`

### Product Name Fields (2 patterns × 3 quote styles = 6 replacements)
28. `"Product Name - House"` → `"House - Product Name"`
29. `'Product Name - House'` → `'House - Product Name'`
30. `>Product Name - House<` → `>House - Product Name<`
31. `"Product Name - Vendor"` → `"Vendor - Product Name"`
32. `'Product Name - Vendor'` → `'Vendor - Product Name'`
33. `>Product Name - Vendor<` → `>Vendor - Product Name<`

### Product Family & Subtype (2 patterns × 3 quote styles = 6 replacements)
34. `"Product Family - Vendor"` → `"Vendor - Product Family"`
35. `'Product Family - Vendor'` → `'Vendor - Product Family'`
36. `>Product Family - Vendor<` → `>Vendor - Product Family<`
37. `"Product Subtype - Vendor"` → `"Vendor - Product Subtype"`
38. `'Product Subtype - Vendor'` → `'Vendor - Product Subtype'`
39. `>Product Subtype - Vendor<` → `>Vendor - Product Subtype<`

### Part Number Fields (2 patterns × 3 quote styles = 6 replacements)
40. `"Part Number - House"` → `"House - Part Number"`
41. `'Part Number - House'` → `'House - Part Number'`
42. `>Part Number - House<` → `>House - Part Number<`
43. `"Part Number - Vendor"` → `"Vendor - Part Number"`
44. `'Part Number - Vendor'` → `'Vendor - Part Number'`
45. `>Part Number - Vendor<` → `>Vendor - Part Number<`

### Product Description Fields (2 patterns × 3 quote styles = 6 replacements)
46. `"Product Description - House"` → `"House - Product Description"`
47. `'Product Description - House'` → `'House - Product Description'`
48. `>Product Description - House<` → `>House - Product Description<`
49. `"Product Description - Vendor"` → `"Vendor - Product Description"`
50. `'Product Description - Vendor'` → `'Vendor - Product Description'`
51. `>Product Description - Vendor<` → `>Vendor - Product Description<`

**Total:** 51 distinct string replacements across all quote styles

---

## Risk Assessment

| Risk | Impact Level | Probability | Mitigation | Status |
|------|--------------|-------------|------------|--------|
| User table preferences break | HIGH | LOW | ✅ VERIFIED: Preferences use column IDs (not labels) | NO IMPACT |
| Missing label occurrences | MEDIUM | MEDIUM | Comprehensive grep validation after each phase | MONITOR |
| Column width layout issues | LOW | LOW | Labels are similar length; minWidth will auto-adjust | LOW RISK |
| API response label issues | LOW | LOW | Verify API routes don't return labels in responses | LOW RISK |
| Excel export header issues | MEDIUM | LOW | Test actual export after updates | TEST REQUIRED |
| Cached data in browser | LOW | MEDIUM | Hard refresh after deployment | COMMUNICATE |

### Critical Finding: User Preferences ✅

**Investigation completed:** After reviewing `hooks/useTablePreferences.ts`, confirmed that:

```typescript
// Preferences store column IDs, NOT labels
columnOrder: updatedColumns.map(column => column.id),  // ["orderIdHouse", ...]
columnWidths: { [column.id]: width },  // { "orderIdHouse": 150, ... }
hiddenColumns: updatedColumns.filter(c => c.hidden).map(c => c.id)  // ["orderIdHouse"]
```

**Conclusion:** NO database migration required for TablePreference records. User preferences will continue working without any changes.

---

## Execution Timeline

**Total Estimated Time:** 6-7 hours spread over 2 days

### Day 1: Database & Components (4 hours)

**Morning Session (1.5 hours)**
- ☕ 9:00 AM - 9:30 AM: Review plan, set up branch
- 📊 9:30 AM - 10:00 AM: **Phase 1** - Database documentation
- 🧪 10:00 AM - 10:30 AM: Test and commit Phase 1

**Late Morning Session (2.5 hours)**
- 🔧 10:30 AM - 11:30 AM: **Phase 2 Group A** - Detail view components (files 1-3)
- 🧪 11:30 AM - 12:00 PM: Test files 1-3 in browser
- 🍕 12:00 PM - 1:00 PM: Lunch break
- 🔧 1:00 PM - 2:00 PM: **Phase 2 Group A** - Detail view components (files 4-6)
- 🧪 2:00 PM - 2:30 PM: Test files 4-6 in browser

**Afternoon Session (1.5 hours)**
- 🔧 2:30 PM - 3:30 PM: **Phase 2 Group B** - Modal components (files 7-10)
- 🧪 3:30 PM - 4:00 PM: Test modals, commit Group B

### Day 2: Pages & Validation (3 hours)

**Morning Session (2 hours)**
- 📄 9:00 AM - 10:00 AM: **Phase 3** - Page files (files 1-3)
- 🧪 10:00 AM - 10:30 AM: Test pages 1-3
- 📄 10:30 AM - 11:00 AM: **Phase 3** - Page files (files 4-5)
- 🧪 11:00 AM - 11:30 AM: Test pages 4-5

**Late Morning Session (1.5 hours)**
- 🔍 11:30 AM - 12:00 PM: **Phase 4** - API routes check
- ✅ 12:00 PM - 1:00 PM: **Phase 5** - Validation & testing
- 🎉 1:00 PM: Complete and merge!


---

## Success Criteria

### Functional Requirements
- [ ] All 70 label occurrences updated to new pattern
- [ ] All pages render without errors
- [ ] All forms submit successfully
- [ ] Column sorting/filtering works correctly
- [ ] User preferences persist and apply correctly
- [ ] Excel exports show new labels

### Quality Requirements
- [ ] Zero old pattern strings remain in codebase (excluding documentation)
- [ ] TypeScript compilation succeeds with no errors
- [ ] No console errors in browser
- [ ] All automated tests pass (if applicable)
- [ ] No ESLint/Prettier errors

### User Experience Requirements
- [ ] Labels are consistent across all pages
- [ ] No visual layout issues from label length changes
- [ ] Column widths auto-adjust appropriately
- [ ] Help text/tooltips updated if applicable

### Documentation Requirements
- [ ] Database schema comments updated
- [ ] Migration comments updated
- [ ] This plan document marked complete
- [ ] Release notes prepared for stakeholders

---

## Appendix A: Verification Scripts

### Complete Validation Script
```bash
#!/bin/bash
# validate-field-labels.sh

echo "=== Field Label Refactor Validation ==="
echo ""

# Array of old patterns to search for
# NOTE: This list is derived directly from
# "Commissable - Global - Fields by Page(Field Label to Adjust).csv"
# and intentionally excludes any patterns not present there
# (for example, "Account ID - Distributor").
OLD_PATTERNS=(
  "Account ID - House"
  "Account ID - Vendor"
  "Customer ID - Distributor"
  "Customer ID - House"
  "Customer ID - Vendor"
  "Order ID - Distributor"
  "Order ID - House"
  "Order ID - Vendor"
  "Part Number - House"
  "Part Number - Vendor"
  "Product Description - House"
  "Product Description - Vendor"
  "Product Family - Vendor"
  "Product Name - House"
  "Product Name - Vendor"
  "Product Subtype - Vendor"
)

found=0
echo "Searching for old label patterns..."
echo ""

for pattern in "${OLD_PATTERNS[@]}"; do
  results=$(grep -r "$pattern" --include="*.tsx" --include="*.ts" --include="*.sql" 2>/dev/null | wc -l)
  if [ $results -gt 0 ]; then
    echo "⚠️  Found $results occurrences of: $pattern"
    grep -rn "$pattern" --include="*.tsx" --include="*.ts" --include="*.sql" 2>/dev/null
    found=$((found + results))
    echo ""
  fi
done

if [ $found -eq 0 ]; then
  echo "✅ All old patterns removed!"
  echo ""

  # Verify new patterns exist
  echo "Verifying new label patterns..."
  NEW_COUNT=$(grep -r "House - \|Vendor - \|Distributor - " --include="*.tsx" --include="*.ts" | wc -l)
  echo "Found $NEW_COUNT new label patterns"

  if [ $NEW_COUNT -ge 70 ]; then
    echo "✅ New labels implemented successfully!"
    exit 0
  else
    echo "⚠️  Expected at least 70 new labels, found $NEW_COUNT"
    exit 1
  fi
else
  echo "❌ Found $found remaining old patterns"
  exit 1
fi
```

### TypeScript Build Check
```bash
#!/bin/bash
# build-check.sh

echo "=== TypeScript Build Check ==="
echo ""

npx tsc --noEmit

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ TypeScript compilation successful!"
  exit 0
else
  echo ""
  echo "❌ TypeScript compilation failed"
  exit 1
fi
```

---

## Appendix B: Rollback Plan

### If Issues Arise During Implementation

**1. Rollback Single File:**
```bash
# Undo changes to specific file
git checkout HEAD -- components/opportunity-details-view.tsx

# Or revert specific commit
git revert <commit-hash>
```

**2. Rollback Entire Branch:**
```bash
# Discard all changes and restart
git checkout main
git branch -D feature/field-label-refactor
git checkout -b feature/field-label-refactor
```

**3. Rollback After Merge (Production):**
```bash
# Create revert commit
git revert -m 1 <merge-commit-hash>
git push origin main

# Or create hotfix branch with old labels
git checkout -b hotfix/revert-field-labels <commit-before-merge>
git push origin hotfix/revert-field-labels
# Deploy hotfix
```

---

## Appendix C: Post-Deployment Monitoring

### Immediate (First 24 hours)
- [ ] Monitor error logs for label-related errors
- [ ] Check user feedback channels for confusion
- [ ] Verify table preferences working across all pages
- [ ] Test Excel exports from production
- [ ] Verify search/filter functionality

### Week 1
- [ ] Collect user feedback on new label format
- [ ] Monitor for any edge cases not caught in testing
- [ ] Document any issues and resolutions
- [ ] Update training materials if needed

### Week 2
- [ ] Review analytics for any usage pattern changes
- [ ] Confirm no performance degradation
- [ ] Mark project as complete

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-09 | Claude Code | Initial comprehensive plan created |

---

**End of Implementation Plan**
