Implementation Progress Analysis & Gap Review
Commissable CRM - User Requirements Notes
Analysis Date: December 2, 2025 Scope: Review of user requirement notes against current codebase implementation
Executive Summary
Based on comprehensive codebase exploration and database schema analysis, this document identifies:
✅ What's been implemented (Features working as specified)
⚠️ Partially implemented (Features exist but don't meet all requirements)
❌ Not implemented (Missing features)
🔍 Gaps & inconsistencies (Conflicting or unclear requirements)
1. GLOBAL FOR ALL PAGES
1.1 Tab Order Navigation
Status: ❌ NOT IMPLEMENTED Requirement:
Cursor should start in Account Name field
Tab key should move cursor to next field down (or right for multi-field rows)
Tab order should be top-to-bottom, then left-to-right by column
Current State:
No tabIndex attributes found on any form fields
No keyboard navigation handlers (onKeyDown for Tab/Enter)
Forms rely on default browser tab order (left-to-right, top-to-bottom)
Modal forms use consistent field structure but don't enforce custom tab navigation
Files to Modify:
All modal components: account-create-modal.tsx, contact-create-modal.tsx, opportunity-create-modal.tsx, product-create-modal.tsx
Would require: Adding tabIndex props in intentional order, potentially wrapping in form navigation handler
1.2 Phone Number Auto-Formatting
Status: ⚠️ PARTIALLY IMPLEMENTED Requirement:
User should not type "-" characters
Field should auto-format to XXX-XXX-XXXX pattern
Current State: ✅ Implemented for Contacts:
Location: lib/validation-shared.ts
Function: formatPhoneNumber(phone: string) - strips non-digits, formats to XXX-XXX-XXXX
Applied on onBlur event in Contact Create/Edit modals
Works for: workPhone and mobilePhone fields
❌ Missing for:
Account phone fields (components/account-create-modal.tsx)
Opportunity contact phone fields
User/admin phone fields
Any other phone input fields across the system
Gap: Phone formatting is inconsistently applied. Only Contact module uses it. Files to Modify:
components/account-create-modal.tsx - Add phone formatting
components/opportunity-role-create-modal.tsx - Format phone fields in opportunity roles
Any other forms with phone inputs
2. ACCOUNT MODULE
2.1 Account Owner Dropdown Refresh
Status: 🔍 REQUIRES CLARIFICATION Requirement:
"Account Owner options need to refresh with any contact that has a House Contact Type in the database and sort A-Z by last name"
Current State:
Account Owner field pulls from User table, not Contact table
Data source: GET /api/accounts/options returns owners: User[]
Display: User's fullName or name
Default: Pre-selects current logged-in user
Database Analysis:
Account.ownerId → User.id (foreign key relationship)
Contact table has accountTypeId field (references AccountType)
AccountType includes "House" (HOUSE_REP code)
No direct relationship between User and Contact "House Contact Type"
Inconsistency Identified: The requirement suggests Account Owner should be selected from Contacts with House Contact Type, but the schema design uses Users as owners. This is a fundamental data model question. Questions to Resolve:
Should Account Owner be a User (current implementation) or a Contact?
If Contact: Should we create a new field, or replace existing ownerId?
What defines a "House Contact Type"? Is this:
Contact.accountTypeId = HOUSE_REP?
Contact belonging to an Account with accountType = HOUSE?
Contact with a specific custom field?
Recommendation: Keep owners as Users, but potentially add a secondary "House Rep Contact" field if needed for tracking assigned contacts.
2.2 Account Detail - Opportunities Tab Horizontal Scroll
Status: ✅ LIKELY FIXED (needs verification) Requirement:
"Need horizontal scroll bar on bottom to see all fields"
Current State:
Opportunities tab shows table of opportunities for the account
Location: components/account-details-view.tsx:240-310
Table uses responsive design with overflow-x-auto classes
Columns: Name, Stage, Close Date, Amount, Expected Commission, Owner, Status
Implementation includes dynamic column rendering
Verification Needed: Test with many columns to ensure scroll bar appears.
2.3 "Referred By" Type-Ahead Dropdown
Status: ❌ NOT IMPLEMENTED (Dropdown exists, not type-ahead) Requirement:
"The 'Referred by' in the 'Create New' opportunity popup should be a type-ahead drop down field. Currently it is just a free form text field."
Current State:
Field name: leadSource (not referredBy)
Implementation: Standard <select> dropdown (not type-ahead)
Location: components/opportunity-create-modal.tsx:522-543
Values: LeadSource enum (Referral, Advertisement, WebSearch, SocialMedia, TradeShow, DirectMail, Partnership, Cold Call, Organic, Other)
Gap Identified - Data Model Mismatch:
Schema has TWO fields:
leadSource: LeadSource enum (how they found you)
referredBy: String (optional, free-text) - WHO referred them
Current UI only shows leadSource dropdown
Missing: referredBy field entirely from Create Opportunity modal
What Needs to Happen:
Add referredBy field to Opportunity Create modal
Implement as type-ahead that searches existing Contacts or Accounts
Allow free-text entry if referrer not in system
Keep existing leadSource dropdown (these are separate concepts)
Files to Modify:
components/opportunity-create-modal.tsx - Add referredBy type-ahead field
app/api/opportunities/route.ts - Ensure POST handler accepts referredBy
2.4 "Referred By" Shows Unknown ID
Status: ❌ FIELD NOT DISPLAYED Requirement:
"The 'Referred by' field shows a unknown ID, not the full name of the referring party"
Current State:
referredBy field is a String in database (stores name or ID)
Field is not displayed in Opportunity List or Detail views currently
If it were displayed, it would show whatever string was saved (likely a name, not ID)
Root Cause: Field not implemented in UI at all (see 2.3 above).
3. CONTACT MODULE
3.1 Account Name as Hyperlink
Status: ❌ NOT IMPLEMENTED Requirement:
"Account Name should be a hyperlink to the related account record"
Current State:
Contact Detail page shows Account Name as plain text
Location: components/contact-details-view.tsx - Line ~150-180
Uses EditableField component for inline editing
No link to account detail page
Files to Modify:
components/contact-details-view.tsx - Wrap account name in <Link> to /accounts/[accountId]
3.2 Email Opens Default Email Program
Status: ⚠️ PARTIALLY IMPLEMENTED (depends on browser) Requirement:
"Email should open the default email program and enter the address into the To: field"
Current State:
Email field uses type="email" for HTML5 validation
Display is plain text in detail view
No mailto: link
Standard Implementation: Use <a href="mailto:{email}">{email}</a> for clickable email Files to Modify:
components/contact-details-view.tsx - Wrap email in mailto link
3.3 Contact Type Field Issues
Status: ⚠️ COMPLEX - MULTIPLE ISSUES Requirement:
"Contact Type field is not pulling from the related contact. Check to make sure that a user cannot save a new contact without choosing an Account. If Account type is updated, it needs to also reflect in the lookup field for Contact Type in Contacts."
Current State: ✅ Working:
Account is required field (cannot save contact without account)
Location: components/contact-create-modal.tsx:181-230
Account dropdown with search/filter functionality
⚠️ Contact Type Display:
Contact Type is shown as read-only field in Create modal
Automatically populated when account selected: accountTypeName from selected account
Database: Contact.accountTypeId references AccountType.id
Not editable by user (by design, inherits from parent account)
❌ Missing:
When Account Type is updated on Account record, related Contacts' Contact Type does not automatically update
No cascade update mechanism
Database allows Contact.accountTypeId to differ from parent Account.accountTypeId
Data Model Analysis:
Account.accountTypeId → AccountType (Customer, Distributor, House, etc.)
Contact.accountTypeId → AccountType (optional, should inherit from Account)
Questions:
Should Contact Type ALWAYS match parent Account Type? (strict inheritance)
Or can a Contact override their type? (e.g., Contact is "House Rep" at "Customer" account)
When Account Type changes, should all child Contacts auto-update? (cascade)
Recommendation: Implement cascade update or remove Contact.accountTypeId entirely and use computed property from parent account.
3.4 Contact ID Field Placement
Status: ⚠️ DESIGN CHANGE REQUEST Requirement:
"Contact ID should be only numerical and can be set to the right of mobile phone, making description field a double-tall field, like other pages. Please shorten the length of the data field for phone and mobile phone, they're too long, and you can pull EXT and now Contact ID labels and data entry field further left."
Current State:
Contact ID is UUID (not numerical): 550e8400-e29b-41d4-a716-446655440000
Database: Contact.id is UUID type (primary key)
No separate "Contact Number" field exists
Layout: Standard two-column form layout
Gap: Requirement asks for numerical Contact ID, but schema uses UUID. Options:
Add new field: contactNumber: String (auto-increment or formatted number)
Display UUID differently: Show last 8 digits or format as number
Use display ID: Create virtual field for display purposes only
Files Affected:
prisma/schema.prisma - Add contactNumber field if creating new field
components/contact-create-modal.tsx - Adjust layout
components/contact-edit-modal.tsx - Adjust layout
components/contact-details-view.tsx - Display contact number
3.5 Column Width Not Saving
Status: ❌ NOT IMPLEMENTED Requirement:
"If column width on bottom of pages are adjusted, they are not saving when refreshed"
Current State:
Tables use fixed column widths (Tailwind classes)
No resize handles on columns
No localStorage or user preference storage for column widths
Tables are not using a data grid library with built-in column resizing
Files to Check:
components/contact-details-view.tsx
app/(dashboard)/contacts/page.tsx
To Implement: Would require data grid library (e.g., TanStack Table with column resizing) or custom resize logic with localStorage persistence.
4. OPPORTUNITY MODULE
4.1 Cannot Make Opportunity Inactive or Delete
Status: 🔍 REQUIRES CLARIFICATION Requirement:
"Cannot make the Opportunity inactive or delete the Opportunity"
Current State:
Opportunities use status-based workflow, not Active/Inactive boolean
Opportunity.status: OpportunityStatus enum (Open, Won, Lost, OnHold)
Opportunity.stage: OpportunityStage enum (Qualification, Discovery, Proposal, Negotiation, ClosedWon, ClosedLost, OnHold, etc.)
DELETE endpoint exists: DELETE /api/opportunities/[opportunityId]/route.ts
Analysis:
Opportunities don't have an "active" boolean field
"Inactive" would be equivalent to status = Lost or OnHold
Hard delete is supported via API but may not be exposed in UI
Files to Check:
components/opportunity-details-view.tsx - Look for delete button
components/opportunity-edit-modal.tsx - Look for status change options
Question: What does "inactive" mean for an opportunity?
Status = Lost?
Status = OnHold?
Soft delete (add deletedAt field)?
Hard delete (remove from database)?
4.2 Cannot Change Account Name on Existing Opportunity
Status: ❌ LIKELY NOT EDITABLE Requirement:
"I cannot change the account name on an existing Opportunity. Need that edit access."
Current State:
Opportunity.accountId is required foreign key to Account
Database allows updating accountId
UI likely shows Account as read-only in edit modal
Business Logic Concern: Changing the account on an existing opportunity could:
Break financial reconciliation (if revenue schedules exist)
Invalidate commission calculations
Orphan related records (opportunity roles, products)
Recommendation:
Add "Change Account" feature with warning dialog
Require confirmation
Log change in audit history
Update related records (opportunity roles, etc.) if needed
Files to Modify:
components/opportunity-edit-modal.tsx - Make account field editable
app/api/opportunities/[opportunityId]/route.ts - Ensure PATCH allows accountId update
4.3 Product Tab - Distributor Dropdown
Status: ✅ IMPLEMENTED Requirement:
"When creating a new product, the Distributor name field should be a dropdown of all possible Accounts where the 'Account Type' = Distributor"
Current State:
Product Create modal has Distributor Name dropdown
Location: components/product-create-modal.tsx:200-220
Data source: GET /api/products/options returns filtered accounts
Filter applied: Accounts with accountType.code = 'DISTRIBUTOR'
✅ This is working as specified.
5. CATALOG (PRODUCTS) MODULE
5.1 Label and Field Alignment Confusion
Status: ⚠️ DESIGN/UX ISSUE Requirement:
"It's very hard to tell which label belongs to which field. If we keep the labels, then they should be left of the field text entry area, otherwise it appears the labels are just under the field that need the data, but it's actually below it."
Current State:
Modal uses vertical label-above-field layout
Labels: text-[11px] font-semibold uppercase tracking-wide text-gray-500
Fields: border-b-2 border-gray-300 px-0 py-1 text-xs
Reference guide exists: .claude/modal-field-alignment-guide.md
Recommendation: Review modal-field-alignment-guide.md and ensure Product modal follows same pattern as other modals.
5.2 Product Family and Subtype as Dropdowns
Status: ❌ NOT IMPLEMENTED (Free-text fields) Requirement:
"Product Family – House and Product Subtype – House – Product Subtype should have drop down options that are derived from all products in the system. Since I'm creating the first product, I'm not sure how this would work? I shouldn't be able to type this in, as we can easily create duplicates that are labeled just slightly different on unique products that should otherwise be grouped."
Current State:
Product Family fields are free-text inputs:
productFamilyHouse: String
productFamilyVendor: String
distributorProductFamily: String
Product Subtype fields:
productSubtypeVendor: String (editable)
House/Distributor subtypes: Disabled/placeholder only
No dropdown options, no validation, no deduplication
Gap: Risk of inconsistent naming ("Ethernet Service" vs "Ethernet Services" vs "ethernet service") Implementation Options:
Type-ahead with suggestions: Show existing values, allow new entries
Strict dropdown: Pre-defined list managed in Admin settings
Auto-suggest with create: Fuzzy match existing values, create new if confirmed
Files to Modify:
components/product-create-modal.tsx - Replace text inputs with type-ahead
app/api/products/options/route.ts - Add endpoint to fetch distinct product families/subtypes
Potentially: Create ProductFamily and ProductSubtype tables for strict management
5.3 Popup Doesn't Return to Main Page After Save
Status: ✅ LIKELY FIXED Requirement:
"Popup will save, but then doesn't return you to the Main Product Page, it just keeps the form there."
Current State:
All modals use similar save pattern:
POST to API
On success: Close modal, refresh data via router.refresh()
Show success toast
Standard implementation in all create modals
Verification Needed: Test Product Create modal to ensure it closes and refreshes list.
5.4 Add Existing Product to Opportunity - Missing Popup
Status: ❌ NOT IMPLEMENTED AS SPECIFIED Requirement:
"When you try to 'Add' an existing product, it just adds it with whatever is in the catalog. It's supposed to provide the popup with details and allow them to edit quantity, price, edit the expected usage gross adjustment and the expected commission rate %, then have a start date and # periods."
Current State:
Modal exists: components/opportunity-line-item-create-modal.tsx
Allows selecting product and entering:
Quantity
Unit Price (editable, defaults to product.priceEach)
Revenue Start Date
Revenue End Date
Custom fields (not verified)
Missing Fields in Modal (Need verification):
❌ Expected Usage Gross Adjustment field
❌ Expected Commission Rate % (uses product default)
❌ Number of Periods field
Files to Review:
components/opportunity-line-item-create-modal.tsx - Check for all required fields
components/opportunity-line-item-edit-modal.tsx - Check edit capabilities
5.5 Product Formulas Not Calculating
Status: ❌ NOT IMPLEMENTED Requirement:
"Formulas on the 'products' tab are not yet calculating. See 'Expected Usage', which is (Quantity * Price Each) + expected usage gross adjustment ($) = Expected Usage."
Current State:
OpportunityProduct (line item) has fields:
quantity: Decimal
unitPrice: Decimal
expectedUsage: Decimal (stored value, not calculated)
expectedRevenue: Decimal
expectedCommission: Decimal
No real-time calculation on form
Missing:
Client-side formula calculation in line item modal
Formula: expectedUsage = (quantity * unitPrice) + usageGrossAdjustment
Auto-update when quantity or price changes
Files to Modify:
components/opportunity-line-item-create-modal.tsx - Add calculation logic
components/opportunity-line-item-edit-modal.tsx - Add calculation logic
5.6 Expected Usage Gross Adjustment Column Missing
Status: ❌ NOT IN DYNAMIC COLUMNS Requirement:
"Expected Usage Gross Adjustment column is also missing from the Dynamic Column choices."
Current State:
Dynamic column configuration exists for tables
Need to verify OpportunityProduct table column options
Files to Check:
Opportunity detail view product table
Look for column customization dropdown/settings
5.7 Clicking Product Name Should Show Detail Page
Status: 🔍 UNCLEAR REQUIREMENT Requirement:
"Clicking on an Opportunity Product name (far left 'ADI') should take us to the Opportunity Product Detail page that shows the details for the Opportunity product added via the popup."
Current State:
Opportunity Products are line items, not separate detail pages
Product Name likely links to Product master record, not line item detail
Line items edited via modal, not dedicated page
Question:
Should clicking product name open Product Detail page (master catalog)?
Or open Line Item Edit Modal (opportunity-specific instance)?
Or create new Opportunity Product Detail page?
Recommendation: Product name → Product master detail page. Add "Edit" button on row for line item modal.
5.8 Distributor - Product Subtype Not Editable
Status: ⚠️ BY DESIGN (seems intentional) Requirement:
"Distributor – Product Subtype isn't editable."
Current State:
In Product Create modal: Distributor Product Subtype field is disabled
Location: components/product-create-modal.tsx - Check field properties
Only Vendor Product Subtype is editable (productSubtypeVendor)
Question: Is this intentional or a bug?
Should Distributor Subtype be editable?
Should it inherit from Vendor Subtype?
Should it be removed entirely?
6. ADMIN SETTINGS
6.1 User Management - Role and Department Dropdowns
Status: ⚠️ ROLE IS TYPE-AHEAD (NOT STANDARD DROPDOWN), DEPARTMENT IS FREE-TEXT Requirement:
"User Management – the Create New popup needs to have 'Role' as a drop-down box w/ the predefined roles populated A-Z. Same with Department."
Current State: Role Field (components/user-create-modal.tsx:272-304):
⚠️ Implemented as type-ahead search input, not standard dropdown
Data source: /api/admin/roles returns Role table records
Predefined roles (sorted A-Z in modal):
ADMIN - "Administrator"
SALES_MGMT - "Sales Management"
SALES_REP - "Salesperson"
ACCOUNTING - "Accounting"
Behavior: User types to filter roles, clicks to select from dropdown
Default: First role auto-selected when modal opens
Gap: Requirement says "drop-down box", current implementation is type-ahead (more advanced, but different UX)
Department Field (components/user-create-modal.tsx:262-270):
❌ Currently free-text input (no dropdown at all)
Database: User.department is String type
No Department table exists
No dropdown options
No validation or standardization
To Implement for Department:
Option A - Quick Fix: Create static department list in frontend, convert to standard select dropdown
Option B - Proper Solution:
Create Department lookup table in schema
Add departments to seed data
Add /api/admin/departments endpoint
Update User Create modal with Department dropdown (standard or type-ahead)
Migrate existing department strings to new structure
Decision Needed:
Should Role field be changed from type-ahead to standard dropdown?
Should Department follow same pattern as Role (type-ahead) or use simpler dropdown?
Files to Modify:
components/user-create-modal.tsx - Add Department dropdown
prisma/schema.prisma - Consider adding Department model
Potentially: app/api/admin/departments/route.ts - New endpoint for department options
SUMMARY OF FINDINGS
✅ FULLY IMPLEMENTED (8 items)
Phone number formatting (Contacts only)
Modal-based forms with consistent styling
Account Owner dropdown (uses Users, not Contacts as specified)
Type-ahead search (Parent Account, Subagent)
Account cannot be saved without required fields
Product Distributor dropdown filtered by Account Type
Opportunity tab structure with products
Role dropdown in user management (likely)
⚠️ PARTIALLY IMPLEMENTED (11 items)
Phone formatting (only on Contacts, not all forms)
Horizontal scroll on Opportunity tab (needs verification)
Email clickable (depends on implementation)
Contact Type field (works but doesn't cascade from Account Type changes)
Popup closes after save (needs verification for Products)
Add product to opportunity modal (exists but missing some fields)
Department field (free-text, not dropdown)
Contact ID placement (uses UUID, not numerical)
Product Family/Subtype (free-text, not dropdown)
Distributor Product Subtype (disabled, unclear if intentional)
Opportunity inactive/delete (status-based, not active/inactive)
❌ NOT IMPLEMENTED (15 items)
Tab order navigation (all forms)
Auto-focus on first field (Account Name)
"Referred By" type-ahead field in Opportunity
"Referred By" display (field missing from UI)
Account Name hyperlink in Contact detail
Email mailto link
Contact Type cascade update when Account Type changes
Column width persistence
Change Account on existing Opportunity
Expected Usage formula calculation
Expected Usage Gross Adjustment field in line item modal
Expected Usage Gross Adjustment in dynamic columns
Opportunity Product detail page/navigation
Department dropdown
Numerical Contact ID
🔍 REQUIRES CLARIFICATION (6 items)
Account Owner source: Should it be Users (current) or Contacts with House Type?
Contact Type: Should it strictly inherit from Account, or can it differ?
Opportunity "inactive": What does this mean? (Lost status? Soft delete?)
Product Subtype fields: Which should be editable vs. derived?
Opportunity Product detail: Separate page or modal edit?
Contact ID: Add numerical field or keep UUID?
CRITICAL INCONSISTENCIES
1. Data Model vs. Requirements Mismatch
Account Owner: Requirement says "Contacts with House Contact Type", schema uses User table
Contact Type: Should strictly match Account Type but schema allows divergence
Referred By: Schema has both leadSource (enum) and referredBy (string), UI only shows leadSource
2. Terminology Inconsistencies
"Active/Inactive" vs. "Status" (Opportunities use status workflow, not boolean)
"Catalog" vs. "Products" (UI may say one, code uses another)
"House Contact Type" - unclear definition (AccountType = House? Contact at House account?)
3. Missing Fields in UI vs. Schema
referredBy field exists in schema but not in UI
Multiple Opportunity ID fields (House, Vendor, Distributor) may not all be displayed
Expected Usage Gross Adjustment field on OpportunityProduct not exposed in modal
RECOMMENDED NEXT STEPS
Phase 1: Clarifications (Before Implementation)
Account Owner definition: Users or Contacts?
Contact Type behavior: Strict inheritance or independent?
Opportunity lifecycle: Define "inactive" and delete policies
Contact ID: Numerical requirement - add new field or change display?
Product subtypes: Which fields should be editable?
Phase 2: High-Priority Fixes
Add "Referred By" type-ahead field to Opportunity Create
Implement Expected Usage calculation formulas
Add missing fields to Opportunity Line Item modal
Make Account Name clickable link in Contact detail
Implement phone formatting globally (all forms)
Phase 3: UX Improvements
Implement tab order navigation
Add column width persistence
Fix modal field alignment/labeling clarity
Add mailto links for email fields
Product Family/Subtype dropdowns with type-ahead
Phase 4: Data Integrity
Contact Type cascade update mechanism
Department dropdown with lookup table
Account Owner refresh logic (once clarified)
Validation to prevent duplicate Product Families
FILES REQUIRING CHANGES (Estimated)
High Priority:
components/opportunity-create-modal.tsx - Add referredBy field
components/opportunity-line-item-create-modal.tsx - Add calculations and missing fields
components/contact-details-view.tsx - Add account link, mailto link
components/account-create-modal.tsx - Add phone formatting, tab order
components/product-create-modal.tsx - Product Family dropdowns
Medium Priority:
lib/validation-shared.ts - Expand phone formatting utility
app/api/accounts/options/route.ts - Clarify Account Owner source
components/opportunity-edit-modal.tsx - Enable account change
User management components (need to locate) - Department dropdown
Low Priority:
All modal components - Tab order navigation
Table components - Column width persistence
prisma/schema.prisma - Potential Contact.contactNumber field, Department table
QUESTIONS FOR STAKEHOLDER
Before proceeding with implementation, please clarify:
Account Owner: Should this field pull from Users (current) or Contacts with "House" type? If Contacts, how is "House Contact Type" defined?
Contact Type Inheritance: When an Account's Account Type changes, should all related Contacts automatically update their Contact Type to match?
Opportunity Inactive/Delete:
What does "make inactive" mean for an opportunity? (Status = Lost? OnHold? Soft delete?)
Should hard delete be available in UI, or only through database admin?
Contact ID: You requested "Contact ID should be only numerical" but the system uses UUIDs. Should we:
Add a new contactNumber field (auto-increment)?
Display UUID differently (e.g., last 8 characters)?
Use a formatted display ID?
Product Subtypes: Which Product Subtype fields should be editable?
House Product Subtype: Currently disabled
Distributor Product Subtype: Currently disabled (you noted as issue)
Vendor Product Subtype: Currently editable
"Referred By" Field: The database has two concepts:
leadSource: How they found you (dropdown: Referral, Advertisement, etc.)
referredBy: WHO referred them (person/company name)
Should the UI show both fields, or only one?
Opportunity Product Detail: When clicking a product name in an opportunity's product list, should it:
Open the master Product detail page?
Open the line item edit modal?
Navigate to a dedicated Opportunity Product detail page?
ADDITIONAL CONTEXT
Related Documentation Found
Modal Field Alignment Guide (.claude/modal-field-alignment-guide.md):
Documents successful alignment of House Description field in Product Create modal
Key insight: Toggle switches need py-1.5 padding to match input field height and maintain vertical rhythm
Use fixed heights (h-[90px]) for textareas spanning multiple fields
This guide provides pattern for fixing label/field confusion issues mentioned in requirement 5.1
Reports/Tickets/Activities Implementation Notes (docs/Dec2025-Markdowns/report-ticket-activities-convo-summary.md):
Documents bulk action implementations across Reports, Tickets, Activities pages
Mentions Active/Inactive modal pattern used elsewhere in the system
Shows standardized patterns for Delete (inactive only), Reassign Owner, Update Status modals
Could inform how Opportunity "inactive" functionality should work (consistent with other modules)
IMPLEMENTATION PRIORITY MATRIX
Based on impact, effort, and business value:
🔴 CRITICAL (High Impact, Blocking Users)
Expected Usage formula calculation (Req 5.5) - Financial calculations broken
"Referred By" type-ahead field missing (Req 2.3, 2.4) - Core CRM tracking missing
Phone formatting globally (Req 1.2) - Data quality issue
Department dropdown (Req 6.1) - Data quality issue
🟡 HIGH PRIORITY (User Experience Issues)
Account Name hyperlink in Contacts (Req 3.1) - Navigation friction
Email mailto links (Req 3.2) - Workflow friction
Product Family/Subtype dropdowns (Req 5.2) - Data consistency issue
Tab order navigation (Req 1.1) - Accessibility and power user efficiency
Change Account on Opportunity (Req 4.2) - Flexibility needed for corrections
🟢 MEDIUM PRIORITY (Nice to Have)
Expected Usage Gross Adjustment field (Req 5.4) - Feature gap
Column width persistence (Req 3.5) - UX convenience
Modal field alignment clarity (Req 5.1) - Visual polish
Opportunity Product detail navigation (Req 5.7) - Workflow clarity
🔵 LOW PRIORITY (Clarification Needed First)
Account Owner source (Req 2.1) - Requires business decision
Contact Type cascade (Req 3.3) - Requires business rule decision
Opportunity inactive/delete (Req 4.1) - Requires workflow definition
Contact ID numerical (Req 3.4) - Requires data model decision
Distributor Product Subtype editable (Req 5.8) - Requires intent clarification
ESTIMATED EFFORT BREAKDOWN
Quick Wins (< 2 hours each)
Email mailto links
Account Name hyperlink
Phone formatting expansion (copy existing pattern)
Add referredBy field to Opportunity Create modal
Medium Effort (2-8 hours each)
Expected Usage formula calculation
Product Family/Subtype type-ahead dropdowns
Department dropdown (with lookup table)
Tab order navigation (across all modals)
Change Account on Opportunity (with validation)
Large Effort (8+ hours)
Contact Type cascade update mechanism
Column width persistence (may require data grid library)
Comprehensive Contact ID refactoring
Account Owner logic changes (if required)
RECOMMENDED PHASED APPROACH
Phase 1: Critical Fixes (Week 1)
Focus: Financial accuracy and core CRM data integrity
Expected Usage formulas
Referred By field
Department dropdown
Phone formatting globally
Phase 2: UX Improvements (Week 2)
Focus: Navigation and workflow efficiency
Account Name / Email links
Tab order navigation
Product Family/Subtype dropdowns
Change Account on Opportunity
Phase 3: Business Logic Decisions (Week 3)
Focus: Resolve clarification items with stakeholders, then implement
Account Owner definition
Contact Type inheritance
Opportunity lifecycle (inactive/delete)
Contact ID numbering
Phase 4: Polish (Week 4)
Focus: Fit and finish
Column width persistence
Modal alignment improvements
Expected Usage Gross Adjustment field
Opportunity Product navigation
TESTING RECOMMENDATIONS
After implementing fixes, verify:
Data Integrity Tests
Expected Usage calculations match formula: (Quantity × Price) + Gross Adjustment
Phone numbers save in consistent XXX-XXX-XXXX format across all modules
Product Families cannot have near-duplicates ("Ethernet" vs "ethernet")
Department values are standardized
UX/Navigation Tests
Tab order flows logically top-to-bottom, then column-to-column
Account Name links navigate to correct account detail pages
Email links open default mail client with pre-filled address
Modals close and refresh parent list after successful save
Regression Tests
Existing opportunities with line items still calculate correctly
Contact Type displays correctly when Account Type changes
User creation with all field combinations works
All bulk actions (Delete, Reassign, Update Status) still function