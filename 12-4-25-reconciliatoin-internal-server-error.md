Investigation: Internal Server Error on Deposit Reconciliation Matching Page
Executive Summary
The 500 Internal Server Error is caused by schema mismatches in the API routes where the code attempts to query fields that don't exist in the database schema. There are multiple issues that need to be fixed.
Root Causes Identified
Issue 1: Account.locationId Does Not Exist ⚠️ CRITICAL
Location: app/api/reconciliation/deposits/[depositId]/detail/route.ts:85 Problem: The code attempts to select locationId from the Account model:
account: { select: { accountName: true, accountLegalName: true, locationId: true } },
However, the Account model in prisma/schema.prisma:240-290 does NOT have a locationId field. Why This Causes 500 Error: When Prisma tries to execute this query, it fails validation because locationId is not a valid field on the Account model, causing the entire API request to fail with a 500 error. Evidence:
The Account model (lines 240-290 in schema.prisma) has fields like accountNumber, accountName, accountLegalName, but no locationId
The locationId field exists on DepositLineItem (added in migration 20251204091722_add_location_po_to_deposit_line_items)
Line 59 of detail/route.ts correctly uses line.locationId as the primary source
Fix: Remove locationId: true from the Account select statement at line 85, since the field doesn't exist there.
Issue 2: Missing RevenueSchedule Fields in Candidate Queries ⚠️ HIGH
Location: lib/matching/deposit-matcher.ts:6-35 Problem: The candidateScheduleInclude Prisma query object is missing critical fields that are accessed later in the matching logic:
const candidateScheduleInclude = {
  account: { select: { accountName: true, accountLegalName: true } },
  vendor: { select: { accountName: true } },
  product: { ... },
  opportunity: {
    select: {
      // ... various fields ...
      // MISSING: orderIdDistributor is NOT included
    },
  },
}
Fields Missing from Root Level:
orderIdHouse - accessed at deposit-matcher.ts:812
distributorOrderId - accessed at deposit-matcher.ts:271-273, 813
Why This Causes Logic Errors: When hasOrderIdMatch() or hasStrongIdConflict() tries to access schedule.orderIdHouse or schedule.distributorOrderId, they will always be undefined, causing:
Order ID matching to fail even when matches exist
False negatives in the matching algorithm
Incorrect confidence scores
Potentially null pointer exceptions
Fix: Add the missing fields to the root level of the candidateScheduleInclude object. Since RevenueSchedule has these fields directly (not through relations), they need to be selected explicitly at the top level.
Issue 3: Missing tenantId in fetchDepositLine Query ⚠️ MEDIUM
Location: lib/matching/deposit-matcher.ts:512-543 Problem: The fetchDepositLine() function doesn't select tenantId at the DepositLineItem root level:
async function fetchDepositLine(depositLineItemId: string) {
  return prisma.depositLineItem.findUnique({
    where: { id: depositLineItemId },
    include: {
      deposit: {
        select: {
          id: true,
          tenantId: true,  // <-- This is deposit.tenantId, not lineItem.tenantId
          // ...
        },
      },
      // ... other includes ...
    },
  })
}
However, the code at deposit-matcher.ts:556, 587 tries to use lineItem.tenantId:
const strictWhere: Prisma.RevenueScheduleWhereInput = {
  tenantId: lineItem.tenantId,  // lineItem.tenantId is undefined!
  // ...
}
Current Workaround: The code currently works because it accesses lineItem.deposit.tenantId through the relation, but the explicit reference to lineItem.tenantId will fail. Fix Option 1: Change all references from lineItem.tenantId to lineItem.deposit.tenantId Fix Option 2: Add tenantId: true to the root level of the DepositLineItem query (since DepositLineItem has its own tenantId field)
Recent Changes That Exposed These Issues
Migration: 20251204091722_add_location_po_to_deposit_line_items
Added to DepositLineItem:
locationId TEXT - New field for tracking line item location
customerPurchaseOrder TEXT - For tracking customer PO numbers
Migration: 20251204100313_add_reconciliation_tracking
Added to DepositLineItem:
reconciled BOOLEAN - Marks line item as reconciled
reconciledAt TIMESTAMP - When it was reconciled
hasSuggestedMatches BOOLEAN - Caches whether matches exist
lastMatchCheckAt TIMESTAMP - Last time matching was run
Recent Commit: 0ed6efa Matching Logic Checkpoint
Modified the candidates route handler to use tenant matching preferences, which exposed the existing schema mismatch bugs during more frequent matching operations.
Implementation Plan
Phase 1: Fix Critical Schema Mismatch (Issue 1)
Priority: IMMEDIATE - This is causing the 500 error
File: app/api/reconciliation/deposits/[depositId]/detail/route.ts
Line 85: Remove locationId: true from the Account select
Keep line 59 as-is (already correctly uses line.locationId)
Phase 2: Fix Missing RevenueSchedule Fields (Issue 2)
Priority: HIGH - This is causing incorrect matching behavior
File: lib/matching/deposit-matcher.ts
Update candidateScheduleInclude (lines 6-35) to include root-level fields:
Add orderIdHouse: true to the select
Add distributorOrderId: true to the select
Verify these fields exist in the RevenueSchedule model schema
Phase 3: Fix tenantId Access Pattern (Issue 3)
Priority: MEDIUM - Currently works via relation, but inconsistent
File: lib/matching/deposit-matcher.ts
Option A: Change all lineItem.tenantId references to lineItem.deposit.tenantId
Option B: Add tenantId to the root level select in fetchDepositLine()
Recommended: Option B for consistency and clarity
Phase 4: Add Error Logging and Monitoring
Priority: LOW - For future debugging
File: app/api/reconciliation/deposits/[depositId]/auto-match/route.ts
Add proper error logging in the try-catch blocks (lines 93-96, 103-106)
Log the actual error details instead of just incrementing error counters
Testing Strategy
Test 1: Verify Detail Route Returns Successfully
Navigate to deposit reconciliation page
Select a deposit with line items
Verify the detail view loads without 500 errors
Check that locationId displays correctly from DepositLineItem
Test 2: Verify Candidate Matching Works
Select a deposit line item
Click "Match" to load suggested candidates
Verify candidates appear correctly
Check that order ID matching works when IDs are present
Test 3: Verify Auto-Match Functions
Run auto-match on a deposit with multiple line items
Verify matches are found when they should be
Check that confidence scores are accurate
Test 4: Check Reconciliation Tracking
Finalize a matched line item
Verify reconciled flag is set correctly
Verify reconciledAt timestamp is populated
Unfinalize and verify flags are reset
Files to Modify
app/api/reconciliation/deposits/[depositId]/detail/route.ts
Remove invalid locationId from Account select (line 85)
lib/matching/deposit-matcher.ts
Add missing fields to candidateScheduleInclude (lines 6-35)
Fix tenantId access pattern in fetchDepositLine() (lines 512-543)
app/api/reconciliation/deposits/[depositId]/auto-match/route.ts (optional)
Add error logging for debugging
Risk Assessment
Low Risk: These are straightforward schema fixes with no business logic changes
High Impact: Will immediately resolve the 500 errors blocking reconciliation
No Data Loss: No database migrations required; only query corrections
Backwards Compatible: Fixes don't affect existing data or other functionality
Success Criteria
✅ Deposit detail page loads without 500 errors ✅ Candidate matching returns results correctly ✅ Order ID matching works when IDs are present ✅ Auto-match completes successfully on test deposits ✅ Reconciliation tracking fields update correctly ✅ No Prisma validation errors in logs
User approved the plan
Perfect! I've completed my investigation of the Internal Server Error on the Deposit Reconciliation Matching Page. Here's what I found:
Summary
I've identified three schema mismatch issues causing the 500 Internal Server Error:
Critical Issue (Causing the 500 Error):
The API is trying to query locationId from the Account model at app/api/reconciliation/deposits/[depositId]/detail/route.ts:85, but this field doesn't exist in the Account schema. The locationId field exists on DepositLineItem, not Account.
High Priority Issue:
The matching algorithm in lib/matching/deposit-matcher.ts:6-35 is missing critical fields (orderIdHouse and distributorOrderId) in the Prisma query, causing order ID matching to fail even when matches exist.
Medium Priority Issue:
The fetchDepositLine() function tries to use lineItem.tenantId but doesn't select it at the root level, relying on the deposit relation instead. The plan file includes:
Detailed analysis of each issue
Why they cause errors
Step-by-step implementation plan
Testing strategy
Risk assessment