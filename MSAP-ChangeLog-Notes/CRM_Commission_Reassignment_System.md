# Commission Reassignment and Termination System

## Executive Summary

The Commission Reassignment and Termination System provides flexible, multi-level management of commission transitions - from individual opportunity adjustments to enterprise-wide rep terminations. The system handles three distinct levels of reassignment: individual opportunities, account-level changes, and global rep terminations, ensuring accurate payment attribution while maintaining complete audit trails.

---

## 1. System Overview

### 1.1 Purpose
Provide a comprehensive, multi-level solution for managing commission transitions that:
- Handles individual opportunity changes
- Manages account-level reassignments
- Processes global rep terminations efficiently
- Ensures accurate payment of earned commissions
- Maintains complete audit trails at all levels
- Integrates seamlessly with revenue schedules
- Provides flexible reassignment strategies

### 1.2 Reassignment Levels

**Level 1 - Individual Opportunity**:
- Single opportunity commission change
- Surgical precision for special cases
- Accessed from Opportunity Detail

**Level 2 - Account Level**:
- All opportunities under one account
- Territory or relationship changes
- Accessed from Account Detail

**Level 3 - Global Rep Level**:
- All accounts and opportunities for a rep
- Rep termination or departure
- Accessed from multiple entry points

### 1.3 Key Stakeholders
- **Sales Representatives**: Earn commissions on opportunities
- **Managers**: Approve and process reassignments at all levels
- **Finance Team**: Reconcile commission payments
- **System Administrators**: Configure and maintain the system
- **HR Department**: Coordinate terminations with commission changes

---

## 2. Core Components

### 2.1 Commission Structure
Every opportunity maintains two commission structures:

**Original Structure** (Immutable):
- Original House Split %
- Original House Rep % and identity
- Original Subagent % and identity
- Creation date and approver

**Current Structure** (Mutable via reassignment):
- Current House Split %
- Current House Rep % and identity
- Current Subagent % and identity
- Effective date of current structure

### 2.2 Key Dates

**Commission End Date**:
- Date when original rep stops earning commissions
- Set at individual opportunity or contact level
- Triggers reassignment workflow
- Affects revenue schedule calculations

**Reassignment Date**:
- Date when new commission structure takes effect
- Usually same as or after Commission End Date
- Determines payment calculations going forward

---

## 3. Reassignment Types

### 3.1 Type A - House Absorption

**Use Case**: Territory dissolution, temporary coverage, or rep termination without replacement

**Process**:
1. Terminated rep's percentage transfers to House
2. No new representative assigned
3. House Split = Original House % + Terminated Rep %

**Example**:
- Before: House 45%, Rep 55%, Subagent 0%
- After: House 100%, Rep 0%, Subagent 0%

### 3.2 Type B - Direct Transfer

**Use Case**: Standard territory reassignment or rep replacement

**Process**:
1. New rep inherits exact percentage of terminated rep
2. House and Subagent percentages unchanged
3. Simple one-for-one replacement

**Example**:
- Before: House 45%, Rep1 55%, Subagent 0%
- After: House 45%, Rep2 55%, Subagent 0%

### 3.3 Type C - Custom Redistribution

**Use Case**: Promotion scenarios, split territories, or performance-based adjustments

**Process**:
1. New rep receives custom percentage
2. House percentage adjusts to maintain 100% total
3. Requires manual entry and validation

**Example**:
- Before: House 45%, Rep1 55%, Subagent 0%
- After: House 65%, Rep2 35%, Subagent 0%

---

## 4. Workflow Processes

### 4.1 Level 1 - Individual Opportunity Reassignment

**Use Cases**:
- Relationship conflict with specific client
- Special handling requirements
- Performance-based redistribution
- Error corrections

**Access**: Opportunity Detail > Manage Commissions (Manager Only)

**Steps**:
1. Navigate to specific opportunity
2. Click "Manage Commissions"
3. Set termination date for this opportunity only
4. Choose reassignment type (A, B, or C)
5. If Type B or C, select new representative
6. If Type C, enter new commission percentages
7. Review impact on revenue schedules
8. Confirm and apply changes
9. Single opportunity updated

### 4.2 Level 2 - Account-Level Reassignment

**Use Cases**:
- Account relationship changes
- Territory realignment
- Client request for new rep
- Strategic account management

**Access**: Account Detail > Reassign All Opportunities (Manager Only)

**Steps**:
1. Open Account Detail page
2. Click "Reassign All Opportunities"
3. View all opportunities for account:
   ```
   Opportunities for Account: [Account Name]
   ┌────────────────────────────────────┐
   │ Total Opportunities: 12             │
   │ Active: 8                          │
   │ In Billing: 3                      │
   │ Closed: 1                          │
   │ Total Monthly Commission: $4,500    │
   └────────────────────────────────────┘
   ```
4. Choose reassignment strategy:
   - Uniform: Apply same type to all
   - Individual: Review each opportunity
5. Set termination date (can vary by opportunity)
6. Execute reassignment
7. All account opportunities updated

### 4.3 Level 3 - Global Rep Reassignment

**Use Cases**:
- Rep termination (voluntary or involuntary)
- Rep promotion to management
- Territory elimination
- Company restructuring

**PRIMARY METHOD - Account List Bulk Operations**:

**Why This Is The Preferred Method**:
- Most efficient for bulk changes
- Visual selection of affected accounts
- Granular control over cascade options
- Batch processing capability
- Clear preview of changes

**Detailed Process**:

**Step 1: Filter Accounts**
```
Navigation: Accounts Module
Filter: "Account Owner = [Terminated Rep Name]"
Result: Complete list of rep's accounts
Display: "[X] accounts owned by [Rep Name]"
```

**Step 2: Select Accounts for Reassignment**
- Header checkbox: Select all accounts
- Individual checkboxes: Select specific accounts
- Visual feedback: "[X] of [Y] accounts selected"

**Step 3: Click "Reassign Accounts"**
- Button appears only with selections
- Opens Global Reassignment Modal
- Shows impact summary immediately

**Step 4: Configure Global Settings**
```
┌─────────────────────────────────────────┐
│ Global Reassignment Configuration        │
├─────────────────────────────────────────┤
│ Selected Accounts: [X]                   │
│ Affected Opportunities: [Y]              │
│ Commission Value at Risk: $[Amount]      │
│                                          │
│ Account Settings:                        │
│ ☑ Change Owner to: [Select Rep ▼]       │
│                                          │
│ Opportunity Settings:                    │
│ ○ Reassign ALL Opportunities            │
│ ● Reassign FUTURE Only (recommended)    │
│ ○ Do Not Change Opportunities           │
│                                          │
│ Reassignment Type:                       │
│ ○ Type A - House Absorption             │
│ ● Type B - Direct Transfer              │
│ ○ Type C - Custom Split                 │
│ ○ Segmented Rules (Advanced)            │
│                                          │
│ [Preview Changes] [Cancel] [Execute]     │
└─────────────────────────────────────────┘
```

**Alternative Access Methods**:

**From Contact Detail** (Links to Account List):
1. Navigate to rep's Contact record
2. Click "Terminate All Commissions"
3. System redirects to filtered Account List
4. Continue with primary method above

**From Manager Dashboard** (Quick Access):
1. Commission Management widget
2. "Global Rep Changes" section
3. Select rep from dropdown
4. Redirects to filtered Account List
5. Continue with bulk selection
4. Opens Global Reassignment Wizard

### 4.4 Global Reassignment Wizard Detail

**Step 1 - Scope Analysis**:
```
Reassignment Scope for: [Rep Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Primary Metrics:
• Accounts Owned: 23
• Total Opportunities: 47
• Active Opportunities: 38
• Commission Value: $12,500/mo

Breakdown by Role:
• As House Rep: 38 opportunities
• As Subagent: 9 opportunities
• As Referrer: 2 opportunities

Geographic Distribution:
• Northeast: 12 accounts
• Southeast: 8 accounts  
• Central: 3 accounts

[Continue] [Export Details] [Cancel]
```

**Step 2 - Strategy Selection**:
```
Choose Reassignment Strategy:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
○ Uniform Assignment
  Apply same rule to all records
  
● Segmented Assignment
  Different rules by criteria:
  ☑ By Account Type
  ☑ By Territory
  ☐ By Opportunity Stage
  ☐ By Commission Value
  
○ Manual Queue
  Review each individually
  
[Configure Rules] [Back] [Next]
```

**Step 3 - Rule Configuration** (for Segmented):
```
Configure Segmented Rules:
━━━━━━━━━━━━━━━━━━━━━━━━
Customer Accounts (15):
• Type: B - Direct Transfer
• New Rep: [Susan Johnson ▼]

Distributor Accounts (6):
• Type: C - Custom Split
• New Rep: [Mike Williams ▼]
• New Split: 40%

Vendor Accounts (2):
• Type: A - House Absorption
• New Rep: N/A

[Validate] [Back] [Next]
```

**Step 4 - Impact Preview**:
```
Reassignment Impact Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Financial Impact:
• Current Monthly: $12,500
• Post-Reassignment: $12,500
• House Increase: $2,100
• Rep Decreases: $2,100

By Recipient:
• Susan Johnson: +$7,500/mo (30 opps)
• Mike Williams: +$3,200/mo (15 opps)  
• House: +$1,800/mo (2 opps)

Timeline:
• Termination Date: 09/30/2025
• Affected Schedules: 147
• Next Payment Date: 10/01/2025

[Show Details] [Adjust] [Execute]
```

**Step 5 - Execution**:
```
Ready to Execute:
━━━━━━━━━━━━━━━━━━━━━━━━
☑ Create audit trail
☑ Notify affected parties
☑ Update revenue schedules
☑ Queue for reconciliation

Final Confirmation:
This will reassign 47 opportunities
across 23 accounts. This action
cannot be automatically reversed.

[EXECUTE REASSIGNMENT] [Save Draft] [Cancel]
```

---

## 5. Revenue Schedule Impact

### 5.1 Payment Calculation Rules

**Before Termination Date**:
- Payments calculate using original commission structure
- Original rep receives full commission percentage
- No impact from reassignment

**After Termination Date**:
- Payments calculate using new commission structure
- New rep (or House) receives commission per reassignment type
- Original rep receives nothing

**Split Period Handling**:
- Revenue schedules spanning termination date are pro-rated
- Days before termination: Original structure
- Days after termination: New structure

### 5.2 Examples

**Monthly Recurring Revenue**:
- MRR of $1,000/month
- Termination Date: 15th of month
- Original Rep: 50% of month's commission
- New Structure: 50% of month's commission

**Annual Prepayment**:
- Annual payment of $12,000
- Termination Date: 6 months into term
- Original Rep: 50% of total commission
- New Structure: 50% of total commission

---

## 6. System Integration

### 6.1 Reconciliation Module

**Data Exchanged**:
- Commission reassignment records
- Payment adjustment requirements
- Final payment calculations
- Approval workflows
- Audit trail entries

**Reconciliation Actions**:
- Calculate final payments to terminated reps
- Generate commission statements
- Process adjustments and corrections
- Track commission liability changes

### 6.2 Reporting Module

**Standard Reports**:
- Commission History by Representative
- Reassignment Audit Trail
- Pending Reassignments Dashboard
- Revenue Impact Analysis
- Commission Liability Report

### 6.3 Accounting Integration

**Automated Updates**:
- Commission accrual adjustments
- GL entry modifications
- Payment schedule changes
- Liability reallocation

---

## 7. Data Fields Reference

### 7.1 Opportunity-Level Fields

| Field Name | Type | Purpose |
|------------|------|---------|
| Commission_End_Date | Date | When original rep stops earning |
| Reassignment_Type | Enum | A, B, or C |
| Reassignment_Date | Date | When new structure takes effect |
| New_House_Rep | Reference | Replacement representative |
| New_Commission_Split | JSON | New percentage breakdown |
| Reassignment_Reason | Dropdown | Termination/Transfer/Promotion |
| Commission_Status | Status | Active/Reassigned/Terminated |

### 7.2 Contact-Level Fields

| Field Name | Type | Purpose |
|------------|------|---------|
| Commission_Eligible | Boolean | Can earn commissions |
| Commission_End_Date | Date | Global termination date |
| Reassignment_Status | Status | Pending/Complete/N/A |
| Active_Opportunity_Count | Integer | Count of commissioned opps |

---

## 8. Validation Rules

### 8.1 Business Rules
- Commission splits must always total 100%
- Termination date cannot be before opportunity creation
- Reassignment date must be on or after termination date
- Cannot reassign closed opportunities
- Manager approval required for all reassignments

### 8.2 System Constraints
- Original commission structure is immutable
- Audit trail entries cannot be deleted
- Reassignments create permanent history records
- Payment calculations lock after processing

---

## 9. Security and Permissions

### 9.1 Role-Based Access

**Sales Representatives**:
- View own commission structures
- Cannot modify commission splits
- See reassignment notifications

**Managers**:
- Initiate reassignments
- Approve commission changes
- Access reassignment tools
- View all commission data

**Administrators**:
- Configure reassignment types
- Manage approval workflows
- Access system settings
- Perform bulk operations

### 9.2 Audit Requirements
- All reassignments logged with timestamp
- User performing action recorded
- Before/after states preserved
- Reason for change required
- Cannot delete audit records

---

## 10. User Interface Components

### 10.1 Manager Dashboard Widget
- **Pending Reassignments**: Count and list
- **Terminated Reps**: Recent terminations
- **Revenue Impact**: Financial summary
- **Quick Actions**: Bulk reassignment tools

### 10.2 Commission Management Modal
- **Current Structure**: Display with percentages
- **Reassignment Options**: Radio buttons for types
- **Impact Preview**: Revenue schedule changes
- **Validation Messages**: Real-time feedback
- **Action Buttons**: Apply/Cancel with confirmation

### 10.3 Commission History Tab
- **Timeline View**: Chronological changes
- **Structure Comparison**: Side-by-side view
- **Documents**: Related approvals and notes
- **Export Options**: PDF/CSV reports

---

## 11. Implementation Considerations

### 11.1 Performance
- Index Commission_End_Date for queries
- Cache commission calculations
- Batch process bulk reassignments
- Archive historical data after X years

### 11.2 Data Migration
- Preserve existing commission structures
- Set original fields from current data
- Initialize reassignment fields as null
- Maintain backwards compatibility

### 11.3 Testing Requirements
- Test all three reassignment types
- Verify revenue schedule calculations
- Confirm audit trail completeness
- Validate permission enforcement
- Test bulk operations at scale

---

## 12. Future Enhancements

### 12.1 Planned Features
- Automated reassignment rules
- Commission clawback handling
- Multi-level approval workflows
- Advanced forecasting tools
- Mobile app support

### 12.2 Integration Opportunities
- Payroll system integration
- Advanced analytics platform
- Machine learning for optimization
- Automated compliance checking

---

## Appendix A: Commission Reassignment Decision Tree

```
Start: Rep Leaving/Changing
    ├── Is there a replacement?
    │   ├── No → Type A (House Absorption)
    │   └── Yes → Will they get same %?
    │       ├── Yes → Type B (Direct Transfer)
    │       └── No → Type C (Custom Redistribution)
    └── Apply to:
        ├── Single Opportunity → Individual Reassignment
        ├── All Rep's Opportunities → Bulk via Contact
        └── Entire Account → Account Reassignment
```

---

## Appendix B: Example Scenarios

### Scenario 1: Rep Termination
- Rep terminated for cause
- No replacement hired
- Use Type A to absorb 55% to House
- Effective immediately
- No future payments to terminated rep

### Scenario 2: Territory Split
- Senior rep promoted
- Territory split between two new reps
- Use Type C with custom percentages
- Original: 55% to Rep1
- New: 30% to Rep2, 25% to Rep3
- House absorbs difference

### Scenario 3: Maternity Leave
- Rep on extended leave
- Temporary coverage needed
- Use Type B for direct transfer
- Transfer back when rep returns
- Maintains same commission structure
