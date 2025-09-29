# CRM System - Accounts Module Specification
## Version 2.0 - Desktop Web Application

---

## 1. Account List Page

### 1.1 Page Purpose
Primary interface for viewing and managing all customer accounts with full CRUD operations and customizable display options.

### 1.2 Default Configuration
- **Initial Sort**: Account Name (A-Z)
- **Default View**: Active accounts only ("Show Inactive" checkbox unchecked)
- **Records Per Page**: 200 (configurable: 200/500/1000)
- **Pagination**: "Showing X to Y of Z entries" with Previous/Next

### 1.3 Standard Columns (Default Order)
1. **Active** - Toggle switch (blue=active, gray=inactive)
2. **Action** - Delete icon (trash can)
3. **Account Name** - Hyperlink to detail page
4. **Account Legal Name** - Text display
5. **Account Type** - Dropdown value
6. **Account Owner** - Full name of house representative
7. **Shipping Street** - Address line 1
8. **Shipping Street 2** - Address line 2
9. **Shipping City** - Text
10. **Shipping State** - 2-letter code
11. **Shipping Zip** - Numeric

### 1.4 Available Actions
- **Create New**: Opens account creation modal
- **Edit**: Click account name to access detail page
- **Delete**: Trash icon with confirmation dialog
- **Clone**: Duplicate button when single record selected
- **Toggle Active**: Switch in Active column
- **Bulk Operations**: Available with multi-select
- **Reassign House Rep** (Manager Only):
  - Available when multiple accounts selected
  - Opens bulk reassignment modal
  - Options:
    - Change House Rep only
    - Cascade to all opportunities
    - Apply reassignment type (A, B, or C)
- **Global Rep Termination** (Manager Only):
  - Use when terminating a rep entirely
  - Filter by Account Owner to find all affected accounts
  - Select all and choose "Terminate Rep Globally"
  - System identifies ALL accounts and opportunities
  - Options:
    - Reassign accounts only
    - Reassign accounts + future opportunities
    - Complete reassignment (all opportunities)
- **Reassign Accounts**: Manager-only action for ownership transfer

### 1.5 Global Rep Termination Workflow

**Entry Points**:
1. **Account List View** (for account-based termination)
2. **Contact Detail** (for rep-based termination)
3. **Opportunity List** (for opportunity-specific changes)

**Filtering for Global Reassignment**:
- Filter by "Account Owner" = [Terminating Rep]
- System shows: "X accounts found for [Rep Name]"
- "Select All" checkbox in header
- Action menu shows "Global Rep Termination"

**Reassignment Scope Selector**:
```
Choose Reassignment Scope:
○ Account Ownership Only
   - Changes account owner
   - Opportunities unchanged
   
○ Accounts + Future Commissions
   - Changes account owner
   - Reassigns opportunities in stages 1-5
   - Historical opportunities unchanged
   
○ Complete Reassignment
   - Changes account owner
   - Reassigns ALL opportunities
   - Updates all commission structures
```

**Batch Processing Options**:
- **Uniform Assignment**: Apply same settings to all
- **Review & Customize**: Preview each account/opportunity
- **Exclude List**: Uncheck specific items to skip
- **Effective Date**: Set global termination date
- Combine with other filters (type, status, etc.)

**Global Rep Termination View**:
- Quick filter: "Accounts by Terminated Rep"
- Pre-filtered view for reassignment workflow
- Shows count of affected opportunities per account
- Bulk select all for mass reassignment

**Smart Filters for Reassignment**:
- "Accounts with Active Opportunities"
- "High-Value Accounts" (by opportunity value)
- "Accounts by Stage" (group by opportunity stages)
- "Accounts Needing Reassignment" (flagged accounts)

### 1.5 Global Commission Reassignment (Manager Only)

**Access Points**:
1. **Account List**: Filter by House Rep → Bulk Reassign
2. **Contact Detail**: Terminate Rep → Affects all accounts
3. **Commission Dashboard**: Global reassignment tool

**Reassignment Levels**:

**Level 1 - Individual Opportunity**:
- Single opportunity commission change
- Accessed from Opportunity Detail
- Affects one commission stream only

**Level 2 - Account Level**:
- All opportunities under one account
- Accessed from Account Detail
- Batch processes account's opportunities

**Level 3 - Global Rep Level**:
- All accounts and opportunities for a rep
- Accessed from Account List or Contact Detail
- Enterprise-wide commission changes

**Global Reassignment Workflow**:
1. **Filter Accounts**: 
   - Filter by "Account Owner = [Terminated Rep]"
   - System shows: "X accounts, Y opportunities affected"
2. **Select Reassignment Scope**:
   - All filtered accounts
   - Selected accounts only
   - Include inactive accounts (checkbox)
3. **Choose Reassignment Strategy**:
   - Uniform: Apply same type to all
   - By Account Type: Different rules per type
   - Manual Review: Queue for individual processing

---

## 2. Create New Account Form

### 2.1 Form Layout (Two-Column Modal)

**Left Column - Account Information**
- Account Name* (Text, unique validation)
- Account Legal Name* (Text)
- Parent Account (Lookup dropdown)
- Account Type* (Dropdown: Customer/Distributor/House Rep/Other/Prospect/Subagent/Vendor)
- Active Status (Toggle, default: Yes)
- Account Owner* (Lookup: House contacts, default: current user)
- Industry* (Dropdown, A-Z sorted)
- Website URL* (URL validation)
- Description* (Multi-line text)

**Right Column - Addresses**

*Ship To Address:*
- Shipping Street* (Text)
- Shipping Street 2 (Text)
- Shipping City* (Text)
- Shipping State* (Dropdown, 2-letter codes)
- Shipping Zip* (Numeric, max 12 digits)
- Shipping Country* (Dropdown, default: United States)

*Bill To Address:*
- [ ] Same as Ship (Checkbox to copy)
- Billing Street* (Text)
- Billing Street 2 (Text)
- Billing City* (Text)
- Billing State* (Dropdown)
- Billing Zip* (Numeric)
- Billing Country* (Dropdown)

*Required fields marked with asterisk

### 2.2 Validation Rules
- Account Name must be unique
- Similar name detection with warning
- Valid URL format for website
- Complete address requirements
- Required field enforcement

---

## 3. Account Detail Page

### 3.1 Page Structure
**Navigation Path**: Home > Accounts > [Account Name]

**Page Actions** (Top Right):
- **Update** - Edit account information
- **Back** - Return to Account List

**Layout Sections**:
1. Account Information (Top Left/Right columns)
2. Tabbed Related Records (Bottom section)

### 3.2 Account Information Display

**Left Column - Account Details** (Read-only in view mode):
- **Account Name** - Primary identifier (Field 01.03.000)
- **Account Legal Name** - Official business name (Field 01.03.001)
- **Parent Account** - Hierarchical relationship (Field 01.03.002)
- **Account Type** - Customer/Distributor/House/etc. (Field 01.03.003)
- **Active (Y/N)** - Toggle status indicator (Field 01.03.004)
- **Account Owner** - Assigned house representative (Field 01.03.005)
- **Industry** - Dropdown selection (Field 01.03.006)
- **Website URL** - Clickable link, opens new tab (Field 01.03.007)
- **Description** - Multi-line text display (Field 01.03.008)
- **Employee Count** - Auto-calculated count of active contacts
- **Order ID - House** - Auto-generated identifier

**Right Column - Address Information** (Read-only in view mode):

*Ship To Address Section:*
- **Shipping Street** (Field 01.04.006)
- **Shipping Street 2** (Field 01.04.007)
- **Shipping City** (Field 01.04.008)
- **Shipping State** - 2-letter code (Field 01.04.009)
- **Shipping Zip** (Field 01.04.010)
- **Shipping Country** (Field 01.04.011)

*Bill To Address Section:*
- **[ ] Same as Ship** checkbox (in edit mode)
- **Billing Street** (Field 01.04.000)
- **Billing Street 2** (Field 01.04.001)
- **Billing City** (Field 01.04.002)
- **Billing State** - 2-letter code (Field 01.04.003)
- **Billing Zip** (Field 01.04.004)
- **Billing Country** (Field 01.04.005)

### 3.3 Tabbed Navigation Bar
Four tabs displayed horizontally:
1. **Contacts** (default active)
2. **Opportunities**
3. **Groups**
4. **Activities & Notes**

---

## 4. Contacts Tab (Within Account Detail)

### 4.1 Tab Purpose
Displays all contacts associated with the current account, allowing direct management of contact relationships without leaving the account context.

### 4.2 Tab Controls
**Top Control Bar**:
- **Create New** button - Opens new contact modal
- **Search bar** - "Search Here" placeholder
- **Filter By Column** dropdown
- **Apply Filter** button (blue)
- **Dynamic Columns** (gear icon)
- **Active** button - Show active contacts only
- **Show All** button - Show all contacts including inactive

### 4.3 Default Contact Columns
Dynamic columns with default display, listed left to right:

1. **Actions** - Delete icon (trash can)
2. **Active** - Toggle switch (blue=active)
3. **Suffix** - Dropdown (Dr./Mr./Ms./Mrs.) (Field 01.05.000)
4. **Full Name** - Hyperlinked to Contact Detail (Field 01.05.001)
   - Concatenated from First + Last Name
   - Blue text indicating clickable link
5. **Job Title** - Text display (Field 01.05.006)
   - Examples: "CEO", "New Contact"
6. **Contact Type** - Inherited from Account (Field 01.05.007)
   - Automatically matches parent account type
   - Read-only in list view
7. **Email Address** - Clickable mailto link (Field 01.05.009)
   - Format: standard email format
   - Opens default email client on click
8. **Work Phone** - Formatted phone (Field 01.05.004)
   - Format: +1-XXX-XXX-XXXX
9. **Extension** - Numeric field (Field 01.05.005)
   - Phone extension if applicable
10. **Mobile** - Formatted phone (Field 01.05.008)
    - Format: +1-XXX-XXX-XXXX
    - May be hidden by default

**Additional Available Columns** (via Dynamic Columns):
- First Name (Hidden - used in Full Name) (Field 01.05.002)
- Last Name (Hidden - used in Full Name) (Field 01.05.003)
- Ship To Address (Formula from Account)
- Bill To Address (Formula from Account)
- Additional custom fields as configured

### 4.4 Contact-Account Relationship
- **Contact Type** automatically inherits from parent Account Type
- New contacts created from this tab auto-associate with current account
- **Deletion Behavior**:
  - First delete: Sets contact to inactive (soft delete)
  - Contact becomes hidden from default views
  - Can be recovered by checking "Show Inactive" and reactivating
  - Second delete (while inactive): Prompts for permanent deletion
  - Permanent deletion removes contact from database entirely
- Full Name field is hyperlink to Contact Detail page
- **Employee Count**: Account tracks total active contacts associated

### 4.5 Create New Contact Form

**Form Access Points**:
1. **From Account Context**: Click "Create New" button in Contacts tab of Account Detail page
2. **From Contacts Module**: Click "Create New" button on main Contacts list page

**Important**: The form is identical regardless of access point. The only difference is field pre-population when created from an Account context.

**Modal Title**: 
- From Account: "Account - New Contact Form"
- From Contacts Module: "Create New Contact"

**Form Layout** (Two-Column):

**Left Column**:
- **Suffix** - Dropdown (Field 01.06.001)
  - Options: -Select-, Mr., Ms., Mrs., Dr.
  - Default: -Select- (blank)
  - Required: Yes
  
- **First Name*** - Text input (Field 01.06.002)
  - Required: Yes
  - Format: Proper case
  - Example: Jimmy
  
- **Last Name*** - Text input (Field 01.06.003)
  - Required: Yes  
  - Format: Proper case
  - Example: Johnson
  
- **Work Phone** - Phone input (Field 01.06.004)
  - Format: +1-XXX-XXX-XXXX
  - Example: +1-555-123-4567
  - Required: Yes
  
- **Extension** - Numeric input (Field 01.06.005)
  - Type: Numbers only
  - Example: 123456
  - Required: Yes

**Right Column**:
- **Job Title** - Text input (Field 01.06.006)
  - Example: Enter Job Title
  - Required: Yes
  
- **Contact Type** - Field behavior varies by entry point (Field 01.06.007)
  - **From Account Context**:
    - Pre-populated from parent Account Type
    - Read-only (grayed out, non-editable)
    - Example: "Customer" (inherited)
  - **From Contacts Module**:
    - Dropdown selection required
    - User must select Account first, then inherits type
  
- **Mobile** - Phone input (Field 01.06.008)
  - Format: +1-XXX-XXX-XXXX
  - Example: +1-555-887-6543
  - Required: Yes
  
- **Email Address** - Email input (Field 01.06.009)
  - Validation: Valid email format
  - Example: jimmy@managencyltg.com
  - Required: Yes

**Additional Fields (When from Account Context)**:
- **Account Name** - Display field
  - Shows parent account name
  - Read-only (non-editable)
  - Establishes permanent association

**Form Actions** (Bottom right):
- **Save and New** - Blue button, saves contact and opens fresh form
- **Save** - Blue button, saves contact and closes modal
- **Cancel** - Gray button, closes without saving

**Form Behavior & Validation**:
- Red asterisks (*) indicate required fields
- When created from Account context:
  - Contact Type automatically inherits from parent Account Type (non-editable)
  - Account Name displayed and locked
  - Account association is automatic and permanent
- When created from Contacts module:
  - User must select an Account
  - Contact Type inherits from selected Account
- Phone fields auto-format with country code (+1 for US)
- Email validation checks for proper format
- Duplicate contact checking based on email address
- Success notification appears after save

**Post-Save Navigation**:
- **From Account Context**: Returns to Contacts tab with new record visible
- **From Contacts Module**: Returns to Contacts list or opens Contact Detail page

**Data Relationships**:
- Contact becomes permanently linked to selected/parent account
- Contact Type field always matches associated account's type
- Contact appears immediately in associated account's contact list
- Contact record accessible from both Account's Contacts tab and main Contacts module

### 4.6 Pagination & Display
- **Records shown**: "Showing 1 to 2 of 2 entries"
- **Navigation**: Previous | [1] | Next
- **Per page selector**: Dropdown (10/25/50/100 entries)

---

## 5. Opportunities Tab (Within Account Detail)

### 5.1 Tab Purpose
Displays all sales opportunities associated with the current account, tracking deal stages, commission splits, and vendor relationships.

### 5.2 Tab Controls
**Top Control Bar**:
- **Create New** button - Opens new opportunity modal
- **Search bar** - "Search Here..." placeholder
- **Filter By Column** dropdown
- **Apply Filter** button (blue)
- **Show Inactive** checkbox (unchecked by default)
- **Dynamic Columns** (gear icon)

**Additional Filters**:
- **Estimated Close Date** - Date range selector

### 5.3 Default Opportunity Columns
Dynamic columns with default display (Fields 01.07.xxx):
1. **Actions** - Delete/Edit icons
2. **Active** - Toggle switch (blue=active)
3. **Estimated Close Date** - YYYY-MM-DD format (Field 01.07.000)
4. **Order ID - House** - Auto-generated ID (Field 01.07.001)
5. **Opportunity Name** - Hyperlink to opportunity detail page (Field 01.07.002)
6. **Opportunity Stage** - Numbered stages 1-9 (Field 01.07.003)
7. **Referred By** - Contact name from Contacts module, hyperlink to contact detail (Field 01.07.006)
8. **Owner** - Full name from Contacts module (House type), hyperlink to contact detail (Field 01.07.007)

**Note**: Distributor and Vendor information is not displayed at the opportunity level. These relationships are established through individual products added to the opportunity and will be visible in the Opportunity Detail page's Products section.

### 5.4 Opportunity Stages
Opportunities progress through numbered stages (sorted in ascending order):
1. **Needs Analysis** - Initial discovery phase
2. **Qualification** - Qualifying the opportunity
3. **Proposal** - Proposal submitted
4. **Awaiting Approval** - Pending customer decision
5. **On Hold** - Temporarily paused
6. **Approved** - Deal won
7. **Billing** - Active billing
8. **Closed Billing Ended** - Completed
9. **Lost** - Deal lost

### 5.5 Create New Opportunity Form

**Modal Title**: "Create New Opportunity Form"

**Form Layout** (Two-Column):

**Left Column**:
- **Account Legal Name** - Display field (Field 01.08.000)
  - Pre-populated from parent account's legal name
  - Read-only (non-editable)
  - Gray background indicating locked field
  
- **Estimated Close Date*** - Date picker (Field 01.08.001)
  - Required: Yes
  - Format: YYYY-DD-MM input
  - Calendar icon for date selection
  
- **Opportunity Stage*** - Dropdown (Field 01.08.003)
  - Default: "-Select-"
  - Required: Yes
  - Options: 
    1. Needs Analysis
    2. Qualification
    3. Proposal
    4. Awaiting Approval
    5. On Hold
    6. Approved
    7. Billing
    8. Closed Billing Ended
    9. Lost
  
- **Opportunity Name*** - Text input (Field 01.08.002)
  - Required: Yes
  - Placeholder: "Enter Opportunity Name"
  - Suggested format: [Account]-[Distributor]-[Vendor]-[Product]-[Terms]
  
- **Owner*** - Dropdown (Field 01.08.005)
  - Default: "-Select-"
  - Pre-populated from Account Owner but editable
  - Source: All Contacts where Account Type = "House"
  - Required: Yes
  
- **Subagent** - Dropdown (Field 01.08.006)
  - Default: "-Select-"
  - Optional field
  - Source: Any contact with type "Subagent"
  - Can remain as "-Select-" if no subagent
  
- **Referred By*** - Dropdown (Field 01.08.007)
  - Default: "-Select-"
  - Required: Yes
  - Source: All Contacts, sorted A-Z

**Right Column - Commission Splits**:

- **Subagent %** - Display/Input field (Field 01.08.010)
  - Default: 0.00%
  - Editable percentage input
  - Format: XX.XX%
  - Updates House Split calculation
  
- **House Split %** - Calculated field (Field 01.08.008)
  - **Formula**: 100.00% - (House Rep % + Subagent %)
  - Default: 100.00% (when no splits entered)
  - Read-only (auto-calculated)
  - Updates automatically as other percentages change
  - Format: XXX.XX%
  
- **House Rep %** - Input field (Field 01.08.009)
  - Default: 0.00%
  - Editable percentage input
  - Format: XX.XX%
  - Updates House Split calculation

- **Opportunity Description*** - Multi-line text area (Field 01.08.011)
  - Required: Yes
  - Placeholder: "Enter Description"
  - Large text box for detailed information

**Hidden/Background Fields**:
- **Account Name** (Field 01.08.004) - Inherited from parent account, not displayed but stored

### 5.6 Form Actions
- **Save and New** - Blue button, saves opportunity and opens fresh form
- **Save** - Blue button, saves opportunity and closes modal  
- **Cancel** - Gray button, closes without saving

### 5.7 Commission Split Validation

**Real-time Calculation**:
- House Split % automatically recalculates as user enters House Rep % and Subagent %
- Formula always ensures: House Split + House Rep + Subagent = 100%
- No manual entry allowed for House Split % field

**Default State**:
- When form opens: House Split = 100%, House Rep = 0%, Subagent = 0%
- User enters desired House Rep % and Subagent %
- House Split adjusts automatically

**Common Split Scenarios**:

1. **No Commission Split**:
   - House Split: 100%
   - House Rep: 0%
   - Subagent: 0%

2. **Standard House Rep Only**:
   - House Split: [Calculated remainder]%
   - House Rep: [User-defined percentage]%
   - Subagent: 0%

3. **Three-Way Split**:
   - House Split: [Auto-calculated based on other two]%
   - House Rep: [User-defined percentage]%
   - Subagent: [User-defined percentage]%

**Validation Rules**:
- Total must always equal 100%
- Negative percentages not allowed
- Maximum 100% for any single field
- Warning if user attempts to enter values totaling over 100%

### 5.8 Data Relationships

**Inherited from Account**:
- Account Name
- Account Legal Name
- Account Owner (default for Opportunity Owner)
- Account Type (determines available representatives)

**Related Entities**:
- **Products**: Added after opportunity creation, each product specifies its Distributor and Vendor
- **Subagent**: External sales representative (optional)
- **House Rep**: Internal sales representative
- **Referred By**: Contact who referred the opportunity

**Order ID Generation**:
- **Order ID - House**: Auto-generated unique identifier
- Format: H + sequential number
- Created upon opportunity save
- Cannot be edited
- Example format: H[number] where number increments automatically

**Distributor/Vendor Relationships**:
- Not set at opportunity level
- Established through individual products added to opportunity
- Each product can have different distributor/vendor
- Visible in Opportunity Detail page's Products section

### 5.9 Commission Reassignment & Termination

**Two Operational Levels**:

#### Level 1: Individual Opportunity Reassignment
**Purpose**: Change commission for a single opportunity while rep continues with others

**Access**: Opportunity Detail > Manage Commissions (Manager only)

**Use Cases**:
- Single deal transfer to specialist
- Account-specific rep change request
- Exception handling
- Performance-based adjustment

**Process**:
1. Open specific Opportunity Detail
2. Click "Manage Commissions"
3. Set termination date for this opportunity only
4. Choose reassignment type (A, B, or C)
5. Changes apply to this opportunity only
6. Other opportunities remain unchanged

#### Level 2: Global Rep Termination (Bulk Reassignment)

**Purpose**: Handle all commission changes when rep leaves/terminated

**Primary Access Method - Account List View**:

**Step 1: Filter and Select**
- Navigate to Accounts module
- Apply filter: "Account Owner = [Terminated Rep]"
- System shows: "[X] accounts owned by [Rep]"
- Select accounts using checkboxes (select all or subset)

**Step 2: Initiate Bulk Reassignment**
- Click "Reassign Accounts" button (appears with multi-select)
- Opens Global Reassignment Modal

**Step 3: Configure Reassignment Scope**
```
Reassignment Options:
□ Change Account Owner (Required)
□ Reassign ALL Opportunities 
□ Reassign FUTURE Opportunities Only
□ Include Subagent Relationships
□ Update Revenue Schedules
```

**Step 4: Set Global Parameters**
- **Termination Date**: When rep stops earning
- **New Owner**: Select from House reps
- **Reassignment Strategy**:
  - Uniform (same type for all)
  - Segmented (different by criteria)
  - Queue for Review (manual processing)

**Alternative Access Methods**:

**From Contact Detail (Rep's Record)**:
1. Navigate to terminated rep's Contact
2. Click "Terminate All Commissions"
3. System analyzes:
   - Accounts owned: [X]
   - Opportunities affected: [Y]
   - Commission value at risk: $[Z]
4. Proceed to reassignment wizard

**From Manager Dashboard**:
1. Commission Management widget
2. "Global Rep Changes" section
3. Search and select rep
4. Execute bulk reassignment

**Reassignment Types**:

**Type A - House Absorption**:
- Rep's % transfers to House
- No replacement rep
- House % = Original House % + Rep %
- Use: Territory dissolution, position elimination

**Type B - Direct Transfer**:
- New rep inherits exact %
- Simple replacement
- Splits unchanged
- Use: Standard territory handoff

**Type C - Custom Redistribution**:
- New rep gets different %
- House % adjusts for balance
- Manual configuration required
- Use: Performance adjustments, split territories

**Segmented Reassignment Rules**:

Configure different rules based on:
- **Account Type**: Customer vs Vendor vs Distributor
- **Opportunity Stage**: Pre-Billing vs Post-Billing
- **Deal Size**: Above/below threshold
- **Geography**: By territory or region
- **Date Range**: Close date criteria

Example Configuration:
```
Rule 1: IF Account Type = "Customer" AND Stage < "Billing"
        THEN Type B → New Rep 1

Rule 2: IF Opportunity Value > $50,000
        THEN Type C → New Rep 2 @ 40%, House @ 60%

Rule 3: ELSE Type A → House Absorption
```

**Cascade Logic**:

**Account Owner Change Cascades To**:
- Default owner for new opportunities (always)
- Existing opportunities (optional)
- Contact relationships (optional)
- Report ownership (automatic)

**Protected Records** (No Auto-Cascade):
- Closed/Won opportunities
- Opportunities in Billing stage
- Reconciled periods
- Manually locked records

**Global Reassignment Preview**:
```
Impact Summary:
├── Accounts to Reassign: [X]
├── Opportunities Affected: [Y]
├── Commission Impact:
│   ├── Monthly: $[current] → $[new]
│   └── Annual: $[current] → $[new]
├── Revenue Schedules: [Z] require update
└── Exceptions: [E] need manual review
```

**Post-Execution**:

**System Actions**:
1. Update account ownership
2. Modify opportunity commissions
3. Recalculate revenue schedules
4. Create audit trails
5. Queue reconciliation items

**Notifications Sent**:
- New owners: Inherited accounts list
- Finance: Commission changes
- Terminated rep: Final statement
- Management: Completion report

**Commission History Tracking**:
- Original_House_Rep: Initial assignment
- Original_Split: Original percentages
- Reassignment_Date: When changed
- Reassignment_Type: A, B, or C
- Reassignment_Level: Individual or Global
- New_House_Rep: Replacement
- New_Split: Updated percentages
- Audit_Trail: Complete change log

**Revenue Schedule Impact**:
- Before termination date: Pay original rep
- After termination date: Pay per reassignment
- Split periods: Pro-rated by days
- Clawback provisions: Via Reconciliation module

### 5.10 Pagination & Display
- **Records shown**: "Showing 1 to 1 of 1 entries"
- **Navigation**: Previous | Next
- **Per page selector**: Dropdown (10/25/50/100 entries)
- Default sort: Close Date (most recent first)

---

## 6. Groups Tab (Within Account Detail)

### 6.1 Tab Purpose
Displays and manages group memberships for the account, allowing organization of accounts into logical groupings for reporting, campaigns, and segmentation.

### 6.2 Tab Controls
**Top Control Bar**:
- **Create New** button - Opens Create New Group modal
- **Search** bar - "Search Here" placeholder
- **Filter By Column** dropdown
- **Apply Filter** button (blue)
- **Active** button - Show active groups only
- **Show All** button - Show all groups including inactive
- **Dynamic Columns** (gear icon)

### 6.3 Default Group Columns (Left to Right)
1. **Actions** - Delete icon (trash can)
2. **Active** - Toggle switch (blue=active)
3. **Group Name** - Hyperlink to Group Detail page
4. **Public/Private** - Dropdown (Private is default)
5. **Group Description** - Text display
6. **Group Owner** - House contact name, hyperlink to Contact Detail

**Note**: All columns available via Dynamic Columns selector

### 6.4 Group-Account Relationship
- Accounts can belong to multiple groups
- Groups can contain multiple accounts (many-to-many)
- Groups created from account context auto-add current account
- Removing account from group doesn't delete the group
- Group membership affects reporting and segmentation

---

## 7. Activities & Notes Tab (Within Account Detail)

### 7.1 Tab Purpose
Track all activities, calls, meetings, todos, and notes related to the account. Maintains complete communication history and task management.

### 7.2 Implementation
The Activities & Notes tab follows the universal specification documented in the Activities & Notes Module Specification. This includes:

- Standard tab controls (Create New, Search, Filter, Active/Show All)
- Activity type filters (All, Call, Meeting, ToDo, Note, Other)
- Dynamic columns with standard defaults
- File attachment support
- Activity status tracking (Open/Completed)

### 7.3 Default Columns (Left to Right)
1. Actions (Delete/Edit)
2. Active (Toggle)
3. Activity Date
4. Activity Type
5. Activity Description
6. Account Name (current account)
7. Attachment indicator
8. File Name (downloadable link)

### 7.4 Account Context
- Activities created from Account Detail automatically associate with the account
- All related activities from child records (Contacts, Opportunities) also visible
- Cannot change account association after creation
- Deleting account archives all associated activities

**For complete specifications, see Activities & Notes Module Specification**

---

## 8. Create New Group Form

### 8.1 Form Access Points
- From Account Detail > Groups Tab > Create New
- From Contact Detail > Groups Tab > Create New  
- From Groups Module > Create New
- Modal Title: "New Account Group Form"

### 8.2 Form Fields

**Field Layout** (Single Column):

1. **Group Name*** (Field 02.08.000)
   - Text input
   - Required field
   - Example: "Customers North Amer"

2. **Group Type** (Field 02.08.001)
   - Dropdown selection
   - Default: "-Select-"
   - Options configured by admin

3. **Public/Private** (Field 02.08.002)
   - Dropdown selection
   - Default: "Private"
   - Options: Public, Private
   - Note: Field missing from some views, needs consistency

4. **Group Owner*** (Field 02.08.003)
   - Dropdown selection
   - Default: Current user
   - Source: All Contacts where Account Type = "House"
   - Sorted A-Z

5. **Group Description** (Field 02.08.004)
   - Multi-line text area
   - Placeholder: "Enter Group Description"
   - Example: "clients who work in Georgia"

6. **Group Active (Y/N)** (Field 02.08.005)
   - Toggle switch
   - Default: Active (Yes)
   - Blue = Active

### 8.3 Form Actions
- **Save and New** - Creates group and opens fresh form
- **Save** - Creates group and closes modal
- **Cancel** - Closes without saving

### 8.4 Post-Creation Behavior
- If created from Account/Contact context: Current record auto-added as member
- Group appears in relevant Groups tabs
- Owner receives notification (if configured)
- Group available for reporting immediately

---

## 8. Data Relationships

### 8.1 Field Sources
- Account Owner: Contacts where Account Type = "House"
- Parent Account: All existing accounts
- Industry: Predefined list from configuration
- States: Standard US state abbreviations
- Countries: ISO country list

### 8.2 Related Objects
- Contacts: Many-to-one relationship
- Opportunities: One-to-many relationship  
- Groups: Many-to-many relationship
- Activities: One-to-many relationship

### 8.3 Calculated Fields
- **Employee Count**: Real-time count of active contacts associated with account
  - Updates automatically when contacts are added/removed
  - Only counts active contacts (inactive excluded)
  - Displayed on Account Detail page and available in list views
  - Cannot be manually edited

### 8.4 Inheritance Rules
- Contact Type inherits from Account Type
- New contacts from Account context auto-associate
- Commission splits cascade to opportunities
- Active status affects visibility across system

---

## 9. User Workflows

### 9.1 Creating a New Account
1. **Initiate**: Click "Create New" button from Account List page
2. **Complete Form**: 
   - Fill required account information fields
   - Select account type and owner
   - Enter shipping address
   - Optionally copy to billing address
   - Add description
3. **Submit**: Click "Add" to create account
4. **Confirm**: System validates and saves
5. **Result**: Return to list view with new account visible

### 9.2 Finding and Filtering Accounts
1. **Quick Search**: Type in search bar for instant filtering
2. **Column Filter**: 
   - Select column from "Filter By Column" dropdown
   - Enter filter criteria
   - Click "Apply Filter"
3. **Toggle View**: Check "Show Inactive" checkbox to include inactive accounts (unchecked by default shows active only)
4. **Sort**: Click any column header to sort ascending/descending

### 9.3 Customizing the View
1. **Access Columns**: Click gear icon in table header
2. **Select Fields**: 
   - Check/uncheck available fields
   - Access related object fields
   - Arrange column order
3. **Apply Changes**: Columns update immediately
4. **Save View**: Optionally save configuration for future use

### 9.4 Managing Account Status
1. **Make Inactive**: Toggle blue switch to gray on account row
2. **Soft Delete Account** (Stage 1): 
   - Click trash icon in Action column on active record
   - Confirm soft deletion in popup dialog
   - Account set to inactive and hidden from default views
   - Can be recovered by checking "Show Inactive" and reactivating
3. **Permanent Delete** (Stage 2):
   - Check "Show Inactive" to see inactive records
   - Click trash icon on inactive account
   - Warning: "This record is already inactive. Permanently delete? This cannot be undone."
   - Confirm permanent deletion
   - Account removed from database entirely
4. **Bulk Actions**:
   - Select multiple checkboxes
   - Choose bulk action from dropdown
   - Soft delete applies to active records
   - Permanent delete confirmation for inactive records
5. **Recovery Process**:
   - Check "Show Inactive" checkbox
   - Find inactive account in list
   - Toggle Active switch back to blue
   - Account restored to active status

### 9.5 Reassigning Accounts (Manager Only)
1. **Select Accounts**: Check one or more account checkboxes
2. **Click Reassign**: "Reassign Accounts" button (manager only)
3. **Choose New Owner**: Select from House representatives
4. **Adjust Commissions**: Reallocate split percentages
5. **Confirm Transfer**: Review summary and confirm
6. **Notification**: All parties receive email confirmation

### 9.6 Creating an Opportunity
1. **Navigate to Account**: Open Account Detail page
2. **Click Opportunities Tab**: View existing opportunities  
3. **Click Create New**: Opens "Create New Opportunity Form" modal
4. **Review Pre-populated Fields**:
   - Account Legal Name (locked, gray background)
   - Account Name (stored but not displayed)
5. **Complete Required Fields**:
   - **Estimated Close Date**: Select from date picker
   - **Opportunity Stage**: Select from dropdown (starts as "-Select-")
   - **Opportunity Name**: Enter descriptive name
   - **Owner**: Select from dropdown (defaults to "-Select-", typically set to Account Owner from Contacts module)
   - **Referred By**: Select contact who referred opportunity from Contacts module
6. **Optional Fields**:
   - **Subagent**: Leave as "-Select-" if no subagent involved
7. **Set Commission Splits** (Right column):
   - System starts with House Split at 100%
   - Enter **House Rep %** (user-defined percentage)
   - Enter **Subagent %** (0% if no subagent, otherwise user-defined)
   - **House Split %** auto-calculates to ensure total equals 100%
   - Verify total equals 100%
8. **Add Description**: Enter opportunity details in text area
9. **Save Options**:
   - **Save and New**: Creates opportunity and opens fresh form
   - **Save**: Creates opportunity and closes modal
   - **Cancel**: Discards changes
10. **Result**: 
    - Opportunity appears in Account's Opportunities tab
    - Order ID - House auto-generated in H[number] format
    - Opportunity Name becomes hyperlink to detail page
    - Commission structure locked in

### 9.7 Managing Opportunity Stages
1. **View Current Stage**: Check Opportunities tab
2. **Update Stage**: Click opportunity name to edit
3. **Progress Through Stages**:
   - 1→2: Move from Needs Analysis to Qualification
   - 2→3: Qualification to Proposal
   - 3→4: Proposal to Awaiting Approval
   - 4→6: Approval leads to Approved status
   - 6→7: Approved moves to Billing
   - 7→8: Billing to Closed Billing Ended
4. **Handle Exceptions**:
   - Stage 5: Place On Hold at any point
   - Stage 9: Mark as Lost if deal fails
5. **Stage Rules**:
   - Cannot skip stages (except to On Hold or Lost)
   - Historical progression tracked
   - Commission calculations locked at creation

### 9.9 Multi-Level Commission Reassignment (Manager Only)

**Three Reassignment Levels Available**:

#### Level 1: Individual Opportunity Reassignment

**Use Case**: Single opportunity needs new rep (e.g., relationship conflict, special handling)

**Access**: Opportunity Detail > Manage Commissions

**Process**:
1. Navigate to specific Opportunity
2. Click "Manage Commissions"
3. Set termination date for this opportunity only
4. Choose reassignment type (A, B, or C)
5. Apply to single opportunity

#### Level 2: Account-Level Reassignment

**Use Case**: Entire account changing reps (e.g., territory realignment)

**Access**: Account Detail > Reassign All Opportunities

**Process**:
1. Open Account Detail page
2. Click "Reassign All Opportunities"
3. System shows all opportunities for account
4. Choose uniform or individual reassignment
5. Apply to all account opportunities

#### Level 3: Global Rep Reassignment

**Use Case**: Rep termination/departure affecting all accounts

**Access Method 1 - From Account List**:
1. Navigate to Accounts module
2. Filter: "Account Owner = [Rep Name]"
3. View shows: "Showing X accounts owned by [Rep]"
4. Click "Global Reassign" button (appears when filtered by owner)
5. Opens Global Reassignment Wizard

**Access Method 2 - From Contact Detail**:
1. Navigate to terminated rep's Contact record
2. Click "Terminate All Commissions"
3. System identifies all affected records:
   - Primary accounts owned
   - Opportunities with commission splits
   - Subagent relationships
4. Opens Global Reassignment Wizard

**Global Reassignment Wizard Steps**:

**Step 1 - Scope Definition**:
```
Affected Records Summary:
- Accounts: [X] accounts owned by [Rep]
- Opportunities: [Y] total opportunities
  - As House Rep: [Y1] opportunities
  - As Subagent: [Y2] opportunities
- Revenue Impact: $[Amount] in future commissions
```

**Step 2 - Set Global Parameters**:
- **Termination Date**: [Date picker]
  - Apply same date to all
  - Or set individually later
- **Reason**: [Dropdown]
  - Termination
  - Resignation
  - Territory Realignment
  - Performance
  - Other

**Step 3 - Choose Reassignment Strategy**:

**Option A: Uniform Reassignment**
- Apply same reassignment type to all
- Select Type A, B, or C
- If Type B/C: Choose new rep
- Quick and consistent

**Option B: Segmented Reassignment**
- Different rules by criteria:
  - By Account Type (Customer/Distributor/Vendor)
  - By Opportunity Stage
  - By Commission Amount (>$X)
  - By Geography/Territory
- Configure rules for each segment

**Option C: Review Queue**
- Add all to manual review queue
- Process individually later
- Maximum control

**Step 4 - Preview Changes**:
```
Reassignment Preview:
┌─────────────────────────────────────┐
│ Accounts to Reassign: X             │
│ Opportunities Affected: Y            │
│                                      │
│ By Type:                             │
│ - Type A (House): Z1 opportunities   │
│ - Type B (Direct): Z2 opportunities  │
│ - Type C (Custom): Z3 opportunities  │
│                                      │
│ Commission Impact:                   │
│ - Monthly: $X → $Y                   │
│ - Annual: $X → $Y                    │
│                                      │
│ [Show Detailed List] [Export Preview]│
└─────────────────────────────────────┘
```

**Step 5 - Execute Reassignment**:
- Final confirmation required
- Option to notify affected parties
- Creates bulk reassignment job
- Runs in background for large datasets
- Email notification when complete

### 9.10 Global Reassignment Management

**Reassignment Queue Dashboard**:

**Access**: Main Menu > Commissions > Reassignment Queue

**Queue Views**:
1. **Pending Review**: Items awaiting reassignment
2. **In Progress**: Currently processing
3. **Completed Today**: Finished in last 24 hours
4. **Failed/Errors**: Require manual intervention

**Queue Actions**:
- **Bulk Apply**: Select multiple, apply same action
- **Export**: Download queue to CSV
- **Prioritize**: Reorder processing sequence
- **Hold**: Pause specific reassignments
- **Rollback**: Undo reassignment (within 48 hours)

**Monitoring Tools**:
```
Reassignment Status Panel:
┌──────────────────────────────────┐
│ Active Reassignments             │
│                                  │
│ Total Pending: 47                │
│ Processing: 3                    │
│ Completed Today: 124             │
│ Failed: 2                        │
│                                  │
│ [View Details] [Export Report]   │
└──────────────────────────────────┘
```

### 9.11 Reassignment Automation Rules

**Configurable Rules** (Admin Only):

**Auto-Assignment Rules**:
1. **Round-Robin**: Distribute equally among team
2. **Territory-Based**: Assign by geography
3. **Performance-Based**: Assign to top performers
4. **Workload-Based**: Balance by current opportunities
5. **Seniority-Based**: Assign by rep experience

**Trigger Conditions**:
- Contact Commission_End_Date is set
- Contact marked inactive
- Account Owner changed
- Manual trigger by manager

**Rule Priority**:
1. Manual overrides (highest)
2. Specific opportunity rules
3. Account-level rules
4. Global rules
5. Default rules (lowest)

### 9.12 Commission Reconciliation Workflow

**Post-Reassignment Process**:

1. **Validation Phase**:
   - Verify all splits total 100%
   - Check for orphaned opportunities
   - Identify conflicts or errors

2. **Calculation Phase**:
   - Recalculate all affected revenue schedules
   - Determine final payments to terminated rep
   - Calculate new commission liabilities

3. **Approval Phase**:
   - Manager reviews high-value changes
   - Finance approves liability changes
   - Legal reviews termination-related changes

4. **Execution Phase**:
   - Update all opportunity records
   - Modify revenue schedules
   - Generate commission statements
   - Create audit entries

5. **Notification Phase**:
   - Email terminated rep (final commission notice)
   - Email new reps (new opportunities assigned)
   - Notify finance (payment changes)
   - Update reports and dashboards

---

## Field Reference Guide

### Account Fields

| Field ID | Field Name | Type | Required | Default | Validation |
|----------|------------|------|----------|---------|------------|
| 01.01.000 | Account_Name | Text | Yes | - | Unique |
| 01.01.001 | Account_Legal_Name | Text | Yes | - | - |
| 01.01.002 | Account_Type | Dropdown | Yes | - | Predefined list |
| 01.01.003 | Account_Owner | Lookup | Yes | Current User | House contacts only |
| 01.01.004 | Shipping_Street | Text | Yes | - | - |
| 01.01.005 | Shipping_Street_2 | Text | No | - | - |
| 01.01.006 | Shipping_City | Text | Yes | - | Proper case |
| 01.01.007 | Shipping_State | Dropdown | Yes | - | 2-letter code |
| 01.01.008 | Shipping_Zip | Numeric | Yes | - | Max 12 digits |
| 01.01.009 | Employee_Count | Calculated | Yes | 0 | Count of active contacts |

### Contact Fields (Within Account)

| Field ID | Field Name | Type | Required | Default | Validation |
|----------|------------|------|----------|---------|------------|
| 01.05.000 | Suffix | Dropdown | Yes | - | Mr/Ms/Mrs/Dr |
| 01.05.001 | Full_Name | Formula | Yes | - | First + Last |
| 01.05.002 | First_Name | Text | Yes | - | Hidden field |
| 01.05.003 | Last_Name | Text | Yes | - | Hidden field |
| 01.05.004 | Work_Phone | Phone | Yes | - | XXX-XXX-XXXX |
| 01.05.005 | Extension | Numeric | No | - | Numbers only |
| 01.05.006 | Job_Title | Text | Yes | - | - |
| 01.05.007 | Contact_Type | Inherited | Yes | Account Type | Read-only |
| 01.05.008 | Mobile | Phone | Yes | - | XXX-XXX-XXXX |
| 01.05.009 | Email_Address | Email | Yes | - | Valid email |

### Opportunity Fields (Within Account)

| Field ID | Field Name | Type | Required | Default | Validation |
|----------|------------|------|----------|---------|------------|
| 01.07.000 | Close_Date | Date | Yes | - | YYYY-MM-DD |
| 01.07.001 | Order_ID_House | Auto-generated | Yes | Generated | H + number |
| 01.07.002 | Opportunity_Name | Text/Hyperlink | Yes | - | Hyperlink to detail |
| 01.07.003 | Opportunity_Stage | Dropdown | Yes | 1. Needs Analysis | 9 stage options |
| 01.07.006 | Referred_By | Display/Hyperlink | Yes | - | Links to Contact |
| 01.07.007 | Owner | Type-ahead/Hyperlink | Yes | Account Owner | Links to Contact |

### Commission Management Fields

| Field ID | Field Name | Type | Required | Default | Validation |
|----------|------------|------|----------|---------|------------|
| 01.09.000 | Commission_End_Date | Date | No | - | YYYY-MM-DD |
| 01.09.001 | Original_House_Rep | Reference | Yes | From creation | Read-only |
| 01.09.002 | Original_House_Split | Percentage | Yes | From creation | Read-only |
| 01.09.003 | Original_Rep_Split | Percentage | Yes | From creation | Read-only |
| 01.09.004 | Original_Subagent_Split | Percentage | Yes | From creation | Read-only |
| 01.09.005 | Reassignment_Type | Dropdown | No | - | A/B/C |
| 01.09.006 | Reassignment_Date | Date | No | - | YYYY-MM-DD |
| 01.09.007 | New_House_Rep | Reference | No | - | House contacts |
| 01.09.008 | New_House_Split | Percentage | No | - | Calculated |
| 01.09.009 | New_Rep_Split | Percentage | No | - | User-defined or inherited |
| 01.09.010 | New_Subagent_Split | Percentage | No | - | User-defined |
| 01.09.011 | Reassignment_Reason | Dropdown | No | - | Predefined list |
| 01.09.012 | Commission_Status | Status | Yes | Active | Active/Reassigned/Terminated |

### Create New Opportunity Form Fields

| Field ID | Field Name | Type | Required | Default | Validation |
|----------|------------|------|----------|---------|------------|
| 01.08.000 | Account_Legal_Name | Display | Yes | From Account | Read-only |
| 01.08.001 | Close_Date | Date | Yes | - | YYYY-MM-DD |
| 01.08.002 | Opportunity_Name | Text | Yes | - | - |
| 01.08.003 | Opportunity_Stage | Dropdown | Yes | 1. Needs Analysis | 9 stages |
| 01.08.004 | Account_Name | Display | Yes | From Account | Read-only |
| 01.08.005 | Owner | Type-ahead Lookup | Yes | Account Owner | House contacts |
| 01.08.006 | Subagent | Type-ahead Lookup | No | None | Subagent contacts |
| 01.08.007 | Referred_By | Type-ahead Lookup | Yes | - | All Contacts |
| 01.08.008 | House_Split_Percent | Formula | Yes | Calculated | 100% - others |
| 01.08.009 | House_Rep_% | Percentage | Yes | - | X.XX% |
| 01.08.010 | Subagent_% | Percentage | Yes | 0.00% | XX.XX% |
| 01.08.011 | Opportunity_Description | Text Long | Yes | - | Multi-line |

**Note**: Distributor_Name (01.07.004) and Vendor_Name (01.07.005) are stored at the product level, not the opportunity level, and will be displayed in the Opportunity Detail page when products are added.
