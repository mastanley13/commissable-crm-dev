Field Label Update Plan
Overview
Update 70 field labels across the CRM application from the pattern "[Field] - [Entity]" to "[Entity] - [Field]" format for consistency.
Scope Summary
Entities Affected
House: 6 field types (Account ID, Customer ID, Order ID, Product Name, Part Number, Product Description)
Vendor: 8 field types (Account ID, Customer ID, Order ID, Product Name, Product Family, Product Subtype, Part Number, Product Description)
Distributor: 2 field types (Customer ID, Order ID)
Total Changes Required
70 field labels across UI components, pages, and API routes
Database schema comments in Prisma schema and migrations
Documentation files (CSV references)
Field Labels to Update
House Fields
Account ID - House → House - Account ID
Customer ID - House → House - Customer ID
Order ID - House → House - Order ID
Product Name - House → House - Product Name
Part Number - House → House - Part Number
Product Description - House → House - Product Description
Vendor Fields
Account ID - Vendor → Vendor - Account ID
Customer ID - Vendor → Vendor - Customer ID
Order ID - Vendor → Vendor - Order ID
Product Name - Vendor → Vendor - Product Name
Product Family - Vendor → Vendor - Product Family
Product Subtype - Vendor → Vendor - Product Subtype
Part Number - Vendor → Vendor - Part Number
Product Description - Vendor → Vendor - Product Description
Distributor Fields
Customer ID - Distributor → Distributor - Customer ID
Order ID - Distributor → Distributor - Order ID
Files Requiring Updates
Component Files
components/account-details-view.tsx
components/contact-details-view.tsx
components/opportunity-details-view.tsx
components/opportunity-create-modal.tsx
components/product-details-view.tsx
components/product-create-modal.tsx
components/revenue-schedule-details-view.tsx
components/revenue-schedule-supporting-details.tsx
components/deposit-reconciliation-detail-view.tsx
components/ticket-create-modal.tsx
Page Files
app/(dashboard)/accounts/page.tsx
app/(dashboard)/opportunities/page.tsx
app/(dashboard)/opportunities/[opportunityId]/page.tsx
app/(dashboard)/products/page.tsx
app/(dashboard)/revenue-schedules/page.tsx
app/(dashboard)/reconciliation/page.tsx
app/(dashboard)/tickets/page.tsx
API Route Files
app/api/accounts/[accountId]/route.ts
app/api/accounts/reassignment-preview/route.ts
app/api/contacts/[id]/route.ts
app/api/opportunities/route.ts
app/api/opportunities/helpers.ts
app/api/opportunities/[opportunityId]/route.ts
app/api/opportunities/[opportunityId]/line-items/route.ts
app/api/products/route.ts
app/api/products/[productId]/route.ts
app/api/revenue-schedules/helpers.ts
app/api/revenue-schedules/route.ts
app/api/revenue-schedules/[revenueScheduleId]/route.ts
app/api/revenue-schedules/[revenueScheduleId]/clone/route.ts
app/api/tickets/route.ts
Database Files
prisma/schema.prisma - Add comments to field definitions
prisma/migrations/add_opportunity_contact_fields.sql - Update existing comments
Supporting Files
tmp_view.tsx
lib/matching/deposit-matcher.ts
Key Findings
User Table Preferences - NO MIGRATION REQUIRED ✓
After reviewing hooks/useTablePreferences.ts, confirmed that table preferences store column IDs (e.g., "orderIdHouse"), NOT labels. This means:
User preferences will continue to work after label changes
No database migration needed for TablePreference records
Risk level: LOW for user-facing disruption
Database Field Names - UNCHANGED
Database field names (camelCase) remain unchanged. Only display labels are being updated:
orderIdHouse, orderIdVendor, orderIdDistributor
accountIdHouse, accountIdVendor
customerIdHouse, customerIdVendor, customerIdDistributor
productNameHouse, productNameVendor
partNumberHouse, partNumberVendor
productDescriptionHouse, productDescriptionVendor
productFamilyVendor, productSubtypeVendor
Implementation Strategy
Phase 1: Database Documentation Updates
Priority: Start here to establish the source of truth Estimated Time: 30 minutes Update database schema comments in:
prisma/schema.prisma - Add /// comments above field definitions
prisma/migrations/add_opportunity_contact_fields.sql - Update COMMENT statements
prisma/migrations/add_opportunity_identifiers.sql - Update COMMENT statements
Pattern:
-- Before
COMMENT ON COLUMN "Opportunity"."orderIdHouse" IS 'Order ID - House (Field 01.07.001)';

-- After
COMMENT ON COLUMN "Opportunity"."orderIdHouse" IS 'House - Order ID (Field 01.07.001)';
Phase 2: Component Files (High Impact)
Priority: Most visible to users Estimated Time: 2.5-3 hours Update in order of complexity:
Group A: Detail View Components
components/opportunity-details-view.tsx - 12+ occurrences
Product table columns (line ~227)
Identifier display arrays (lines ~654-663)
Revenue schedule columns
components/account-details-view.tsx - 9 occurrences
Opportunities tab columns (line ~556)
Filter configs (line ~2025)
Excel export headers (line ~3355)
components/contact-details-view.tsx - 12 occurrences
Similar structure to account-details-view
Opportunities tab columns (line ~483)
Filter configs (line ~2425)
components/revenue-schedule-supporting-details.tsx - 9 occurrences
Identifier display arrays (lines ~713-727)
components/revenue-schedule-details-view.tsx - 4 occurrences
Product information display
components/product-details-view.tsx - 3+ occurrences
Product field labels (lines ~414, 419, 700, 711)
Group B: Modal Components
components/opportunity-create-modal.tsx - 12 occurrences
Form labels for all ID fields (starting around line 781)
Pattern: <label>Order ID - House</label> → <label>House - Order ID</label>
components/ticket-create-modal.tsx - 1+ occurrence
Product/Account/Customer fields
components/product-create-modal.tsx - Part Number - House
Form fields (lines ~57, 81, 476, 833)
components/deposit-reconciliation-detail-view.tsx
Phase 3: Page Files (Main Tables)
Priority: High visibility Estimated Time: 2 hours
app/(dashboard)/opportunities/page.tsx - 9+ occurrences
Filter options (line ~85)
Column definitions (line ~240)
MinWidth calculations
Excel export (line ~744)
app/(dashboard)/products/page.tsx - 15+ occurrences
Highest density of product-related labels
Filter options and column definitions
app/(dashboard)/revenue-schedules/page.tsx - 3-4 occurrences
Product Name, Customer/Order IDs
app/(dashboard)/tickets/page.tsx - 4 occurrences
Product Name, Account/Customer/Order IDs - Vendor
app/(dashboard)/reconciliation/page.tsx - 6-9 occurrences
Product Name, Customer/Order IDs
Phase 4: API Routes & Supporting Files
Priority: Medium (mostly no changes, but verify) Estimated Time: 30 minutes Files to check (labels in comments or type definitions):
app/api/tickets/route.ts
tmp_view.tsx
lib/matching/deposit-matcher.ts
Phase 5: Validation & Testing
Priority: Critical for completion Estimated Time: 1 hour
Automated String Search:
# Verify all old patterns removed
grep -r "Order ID - House" --include="*.tsx" --include="*.ts" --include="*.sql"
grep -r "Account ID - Vendor" --include="*.tsx" --include="*.ts"
# ... repeat for all 17 patterns
Build Test:
npm run build
Manual UI Testing:
Test each affected page (Opportunities, Products, Revenue Schedules, Tickets, Reconciliation)
Verify column headers display new labels
Test column chooser, filters, sorting
Verify user preferences still work
Label Update Patterns
Pattern 1: Column Definitions
// Before
{ id: 'orderIdHouse', label: 'Order ID - House', ... }

// After
{ id: 'orderIdHouse', label: 'House - Order ID', ... }
Pattern 2: MinWidth Calculations
// Before
minWidth: calculateMinWidth({ label: 'Order ID - House', type: 'text', sortable: true })

// After
minWidth: calculateMinWidth({ label: 'House - Order ID', type: 'text', sortable: true })
Pattern 3: Form Labels (JSX)
// Before
<label>Order ID - House</label>

// After
<label>House - Order ID</label>
Pattern 4: Detail View Display Arrays
// Before
{ label: "Account ID - House", value: identifiers.accountIdHouse }

// After
{ label: "House - Account ID", value: identifiers.accountIdHouse }
Complete Search & Replace List
Execute these replacements across the codebase:
Order ID Fields
"Order ID - House" → "House - Order ID"
'Order ID - House' → 'House - Order ID'
>Order ID - House< → >House - Order ID<
Same pattern for Vendor and Distributor
Account ID Fields
"Account ID - House" → "House - Account ID"
"Account ID - Vendor" → "Vendor - Account ID"
Same for JSX tags and single quotes
Customer ID Fields
"Customer ID - House" → "House - Customer ID"
"Customer ID - Vendor" → "Vendor - Customer ID"
"Customer ID - Distributor" → "Distributor - Customer ID"
Product Fields
"Product Name - House" → "House - Product Name"
"Product Name - Vendor" → "Vendor - Product Name"
"Product Family - Vendor" → "Vendor - Product Family"
"Product Subtype - Vendor" → "Vendor - Product Subtype"
"Part Number - House" → "House - Part Number"
"Part Number - Vendor" → "Vendor - Part Number"
"Product Description - House" → "House - Product Description"
"Product Description - Vendor" → "Vendor - Product Description"
Risk Assessment
Risk	Impact	Mitigation
User preferences break	HIGH	✓ VERIFIED: Preferences use column IDs, not labels - NO IMPACT
Missing occurrences	MEDIUM	Use comprehensive grep validation after each phase
Column width issues	LOW	Labels are similar length; minWidth will auto-adjust
API response issues	LOW	Verify API routes don't return labels in responses
Recommended Execution Timeline
Total Estimated Time: 6-7 hours spread over 2 days Day 1: Database & Components (4 hours)
Phase 1: Database documentation (30 min)
Phase 2: Components - Groups A & B (3.5 hours)
Commit after each file
Test in browser between files
Day 2: Pages & Validation (2.5 hours) 3. Phase 3: Page files (2 hours) 4. Phase 4: API routes check (30 min) 5. Phase 5: Validation & testing (1 hour)
Git Strategy
Create feature branch:
git checkout -b feature/field-label-refactor
Commit incrementally:
After each component file: "Update [component] field labels"
After each page file: "Update [page] field labels"
After database files: "Update database field label documentation"
Final commit: "Complete field label refactor - [Entity] - [Field] pattern"
Success Criteria
 All 70 label occurrences updated
 No old patterns found in grep search
 TypeScript compilation succeeds
 All pages render without errors
 User table preferences continue to work
 Column sorting/filtering functional
 Excel exports show new labels