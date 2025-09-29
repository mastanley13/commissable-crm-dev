# Accounts Module Specification
**Version 1.0 | CRM System Documentation**

---

## Executive Summary

The Accounts Module serves as the foundation of the CRM system, managing all business entity relationships including customers, vendors, distributors, and internal representatives. This module provides comprehensive account management capabilities with integrated contact, opportunity, group, and activity tracking functionality.

---

## Table of Contents

1. [Account List Page](#1-account-list-page)
2. [Create New Account](#2-create-new-account)
3. [Account Detail Page](#3-account-detail-page)
4. [Contacts Tab](#4-contacts-tab)
5. [Opportunities Tab](#5-opportunities-tab)
6. [Groups Tab](#6-groups-tab)
7. [Activities & Notes Tab](#7-activities-notes-tab)
8. [Data Relationships](#8-data-relationships)
9. [User Workflows](#9-user-workflows)
10. [Field Reference Guide](#10-field-reference-guide)
11. [Business Rules](#11-business-rules)

---

## 1. Account List Page

### 1.1 Navigation and Access
- **Primary Navigation**: Main Menu > Accounts
- **Breadcrumb Trail**: Home > Accounts
- **Page Title**: "Accounts"

### 1.2 Page Configuration
- **Initial Sort Order**: Account Name (alphabetical A-Z)
- **Default View**: Active accounts only
- **Records Per Page**: 200 (configurable: 200/500/1000)
- **Pagination Display**: "Showing X to Y of Z entries" with Previous/Next navigation

### 1.3 Standard List Columns

The following columns display by default from left to right:

1. **Active** - Toggle switch indicator (blue when active, gray when inactive)
2. **Action** - Delete icon (trash can) for record removal
3. **Account Name** - Hyperlinked text to Account Detail page
4. **Account Legal Name** - Plain text display
5. **Account Type** - Dropdown value display
6. **Account Owner** - Full name of assigned house representative
7. **Shipping Street** - Primary address line
8. **Shipping Street 2** - Secondary address line
9. **Shipping City** - City name
10. **Shipping State** - Two-letter state code
11. **Shipping Zip** - Postal code

### 1.4 List Controls and Features

**Top Control Bar**:
- **Create New** button - Opens account creation modal
- **Search** field - Global text search across all visible columns
- **Filter By Column** dropdown - Column-specific filtering
- **Apply Filter** button - Executes selected filter
- **Dynamic Columns** selector (gear icon) - Customize visible columns
- **Show Inactive** checkbox - Toggle inclusion of inactive records

**Bulk Operations**:
- Multi-select via checkboxes
- Delete selected records
- Export to CSV
- Reassign accounts (manager role required)
- Update status in bulk

---

## 2. Create New Account

### 2.1 Form Access and Configuration
- **Primary Access**: Account List Page > Create New button
- **Modal Title**: "Create New Account"
- **Form Layout**: Two-column responsive design
- **Validation**: Real-time field validation with inline error messages

### 2.2 Account Information Fields (Left Column)

| Field Name | Type | Required | Default | Validation Rules |
|------------|------|----------|---------|------------------|
| Account Name | Text | Yes | - | Must be unique across system |
| Account Legal Name | Text | Yes | - | Official registered business name |
| Parent Account | Lookup | No | - | Dropdown of existing accounts |
| Account Type | Dropdown | Yes | - | Customer/Distributor/House Rep/Other/Prospect/Subagent/Vendor |
| Active Status | Toggle | Yes | Active | Yes/No toggle |
| Account Owner | Lookup | Yes | Current User | House contacts only |
| Industry | Dropdown | Yes | - | Alphabetically sorted predefined list |
| Website URL | URL | Yes | - | Valid URL format with protocol |
| Description | Multi-line text | Yes | - | Maximum 1000 characters |

### 2.3 Address Information Fields (Right Column)

**Ship To Address Section**:
- Shipping Street* (Required)
- Shipping Street 2 (Optional)
- Shipping City* (Required)
- Shipping State* (Two-letter code dropdown, Required)
- Shipping Zip* (Numeric, maximum 12 digits, Required)
- Shipping Country* (Dropdown, default: United States, Required)

**Bill To Address Section**:
- [ ] Same as Ship checkbox - Automatically copies shipping address when checked
- Billing Street* (Required)
- Billing Street 2 (Optional)
- Billing City* (Required)
- Billing State* (Two-letter code dropdown, Required)
- Billing Zip* (Numeric, maximum 12 digits, Required)
- Billing Country* (Dropdown, Required)

### 2.4 Form Actions
- **Save and New** - Creates account and reopens blank form for additional entries
- **Save** - Creates account and returns to Account List page
- **Cancel** - Discards all changes and closes modal

---

## 3. Account Detail Page

### 3.1 Page Structure
- **Navigation Path**: Home > Accounts > Account Detail > [Account Name]
- **Layout**: Two-column information display with tabbed interface below
- **Page Actions** (top right corner): 
  - Update - Save changes to account
  - Back - Return to Account List

### 3.2 Account Information Display

**Left Column - Core Business Details**:
- **Account Name** - Primary identifier (editable in update mode)
- **Account Legal Name** - Official registered business name
- **Parent Account** - Hierarchical relationship display
- **Account Type** - Category classification
- **Active (Y/N)** - Toggle status indicator
- **Account Owner** - Assigned house representative (hyperlinked)
- **Industry** - Business sector classification
- **Website URL** - Clickable external link (opens new tab)
- **Description** - Multi-line text display
- **Employee Count** - Auto-calculated count of active associated contacts
- **Order ID - House** - System-generated unique identifier

**Right Column - Address Information**:

*Ship To Address Section*:
- Complete shipping address display
- Format: Street, Street 2, City, State ZIP, Country

*Bill To Address Section*:
- Complete billing address display
- [ ] Same as Ship indicator (when applicable)
- Format: Street, Street 2, City, State ZIP, Country

### 3.3 Tabbed Navigation Interface

Four primary tabs displayed horizontally below account information:

1. **Contacts** (Default active) - Manage associated contacts
2. **Opportunities** - Track sales opportunities and commissions
3. **Groups** - Manage group memberships
4. **Activities & Notes** - Comprehensive activity tracking

---

## 4. Contacts Tab

### 4.1 Purpose and Functionality
The Contacts tab displays all contacts associated with the current account, enabling direct contact management within the account context. Contacts inherit their type from the parent account and cannot be reassigned to accounts of different types.

### 4.2 Tab Interface Controls

**Top Control Bar Elements**:
- **Create New** button - Opens new contact creation modal
- **Search** field - Real-time search with "Search Here" placeholder
- **Filter By Column** dropdown - Column-specific filtering options
- **Apply Filter** button - Execute selected filter (blue button)
- **Dynamic Columns** selector (gear icon) - Customize visible columns
- **Active** button - Display active contacts only
- **Show All** button - Include inactive contacts in display

### 4.3 Standard Contact Columns

Default columns displayed from left to right:

1. **Actions** - Delete icon (trash can) for record removal
2. **Active** - Toggle switch (blue when active, gray when inactive)
3. **Suffix** - Title dropdown (Dr./Mr./Ms./Mrs.)
4. **Full Name** - Concatenated first and last name, hyperlinked to Contact Detail
5. **Job Title** - Position within organization
6. **Contact Type** - Automatically inherited from parent Account Type
7. **Email Address** - Clickable mailto link
8. **Work Phone** - Formatted as +1-XXX-XXX-XXXX
9. **Extension** - Numeric phone extension
10. **Mobile** - Cell phone formatted as +1-XXX-XXX-XXXX

### 4.4 Contact Management Features

**Relationship Rules**:
- Contact Type automatically inherits from parent Account Type
- Contacts cannot be moved between accounts of different types
- New contacts created from this tab automatically associate with current account
- Employee Count field on account automatically updates with active contact changes

**Deletion Behavior** (Two-stage process):
- **Stage 1 - Soft Delete**: First deletion sets contact to inactive
  - Contact hidden from default views
  - Recoverable via "Show All" and reactivation
- **Stage 2 - Permanent Delete**: Second deletion while inactive
  - Confirmation prompt: "Permanently delete? This cannot be undone."
  - Complete removal from database

---

## 5. Opportunities Tab

### 5.1 Purpose and Functionality
The Opportunities tab manages all sales opportunities associated with the account, tracking deal progression through stages, commission split structures, and revenue potential. Each opportunity maintains detailed commission allocation between House, House Rep, and Subagent.

### 5.2 Tab Interface Controls

**Top Control Bar Elements**:
- **Create New** button - Opens opportunity creation modal
- **Search** field - "Search Here..." placeholder
- **Filter By Column** dropdown - Column-specific filtering
- **Apply Filter** button (blue) - Execute filter
- **Dynamic Columns** selector (gear icon) - Customize columns
- **Active** button - Show active opportunities only
- **Show All** button - Include all opportunities

**Additional Filter Options**:
- **Estimated Close Date** - Date range selector for filtering

### 5.3 Standard Opportunity Columns

Default columns displayed from left to right:

1. **Actions** - Delete and Edit icons
2. **Active** - Toggle switch status indicator
3. **Estimated Close Date** - Format: YYYY-MM-DD
4. **Order ID - House** - Auto-generated identifier (H[number])
5. **Opportunity Name** - Descriptive name, hyperlinked to detail page
6. **Opportunity Stage** - Current stage (1-9)
7. **Referred By** - Contact who referred, hyperlinked
8. **Owner** - House representative, hyperlinked

### 5.4 Opportunity Stages

Nine-stage progression system (ordered):

1. **Needs Analysis** - Initial discovery and requirements gathering
2. **Qualification** - Opportunity assessment and validation
3. **Proposal** - Solution presentation and pricing
4. **Awaiting Approval** - Customer decision pending
5. **On Hold** - Temporarily paused (can be set at any stage)
6. **Approved** - Deal won, moving to implementation
7. **Billing** - Active billing phase
8. **Closed Billing Ended** - Completed and closed
9. **Lost** - Opportunity not won (can be set at any stage)

**Stage Rules**:
- Stages must progress sequentially (except Hold and Lost)
- Cannot skip stages in normal progression
- Historical progression tracked for reporting

### 5.5 Create New Opportunity Form

**Modal Configuration**:
- **Title**: "Create New Opportunity Form"
- **Layout**: Two-column design

**Left Column Fields**:
- **Account Legal Name** - Read-only, inherited from account
- **Estimated Close Date*** - Date picker (Required)
- **Opportunity Stage*** - Dropdown, defaults to "1. Needs Analysis"
- **Opportunity Name*** - Text field (Required)
- **Owner*** - Dropdown of House contacts
- **Subagent** - Dropdown of Subagent contacts (Optional)
- **Referred By*** - Dropdown of all contacts (Required)

**Right Column - Commission Structure**:
- **Subagent %** - Input field, default 0.00%
- **House Split %** - Auto-calculated: 100% - (House Rep % + Subagent %)
- **House Rep %** - Input field (Required)
- **Opportunity Description*** - Multi-line text (Required)

**Commission Validation Rules**:
- Total of all percentages must equal exactly 100%
- House Split percentage automatically recalculates
- Negative percentages not permitted
- Commission structure locked after initial save

### 5.6 Commission Reassignment System

The system supports two levels of commission reassignment:

**Level 1: Individual Opportunity Reassignment**
- Modifies commission for single opportunity
- Accessed from Opportunity Detail page
- Representative continues with other opportunities unchanged
- Used for deal-specific adjustments or exceptions

**Level 2: Global Representative Termination**
- Bulk reassignment across all accounts and opportunities
- **Primary Method**: Filter Account List by owner, select all, reassign
- **Alternative Access**: Contact Detail > Terminate All Commissions
- Cascades changes to all related opportunities

**Three Reassignment Types**:

**Type A - House Absorption**
- Terminated representative's percentage transfers to House
- No replacement representative assigned
- Formula: New House % = Original House % + Terminated Rep %

**Type B - Direct Transfer**
- New representative inherits exact percentage
- Commission structure remains unchanged
- Simple one-for-one replacement

**Type C - Custom Redistribution**
- New representative receives different percentage
- House percentage adjusts to maintain 100% total
- Requires manual percentage configuration

---

## 6. Groups Tab

### 6.1 Purpose and Functionality
The Groups tab manages group memberships for the account, enabling segmentation for reporting, campaigns, and organizational purposes. Groups support many-to-many relationships, allowing accounts to belong to multiple groups simultaneously.

### 6.2 Tab Interface Controls

Standard control bar configuration:
- **Create New** button - Opens group creation modal
- **Search** field - Global text search
- **Filter By Column** dropdown
- **Apply Filter** button
- **Active/Show All** toggle buttons
- **Dynamic Columns** selector

### 6.3 Standard Group Columns

1. **Actions** - Delete icon for removal
2. **Active** - Toggle switch indicator
3. **Group Name** - Hyperlinked to Group Detail page
4. **Public/Private** - Access level (Default: Private)
5. **Group Description** - Text summary
6. **Group Owner** - House contact, hyperlinked

### 6.4 Group Management Rules

**Membership Rules**:
- Accounts can belong to unlimited groups
- Groups can contain unlimited accounts
- Creating group from account context automatically adds account as member
- Removing account from group maintains group integrity

**Access Control**:
- **Private Groups**: Visible only to owner and administrators
- **Public Groups**: Visible to all system users
- Owner has full management rights
- Members have read-only access

---

## 7. Activities & Notes Tab

### 7.1 Purpose and Functionality
The Activities & Notes tab provides comprehensive activity tracking and note management, maintaining a complete history of all interactions, tasks, and communications related to the account.

### 7.2 Implementation Standards
The tab follows the universal Activities & Notes specification:
- Consistent interface across all modules
- Standard activity types: Call, Meeting, ToDo, Note, Other
- File attachment support for all activities
- Status tracking: Open/Completed
- Full audit trail maintenance

### 7.3 Standard Activity Columns

1. **Actions** - Delete/Edit icons
2. **Active** - Toggle switch
3. **Activity Date** - YYYY-MM-DD format
4. **Activity Type** - Category classification
5. **Activity Description** - Summary text
6. **Account Name** - Current account context
7. **Attachment** - File indicator icon
8. **File Name** - Downloadable link

### 7.4 Activity Management

**Creation Rules**:
- Activities created from account context automatically associate
- Cannot change account association after creation
- File attachments of any type supported
- Activities cascade to related records for visibility

---

## 8. Data Relationships

### 8.1 Account Hierarchy
- Parent-child account relationships fully supported
- Unlimited hierarchy depth permitted
- Circular references prevented
- Inheritance of specific properties configurable

### 8.2 Related Object Relationships
- **Contacts**: Many-to-one (multiple contacts per account)
- **Opportunities**: One-to-many (multiple opportunities per account)
- **Groups**: Many-to-many (accounts in multiple groups)
- **Activities**: One-to-many (multiple activities per account)

### 8.3 Calculated Fields
- **Employee Count**: Real-time calculation of active associated contacts
- **Commission Splits**: Automatic calculation ensuring 100% total
- **Revenue Metrics**: Aggregation of opportunity values

### 8.4 Inheritance Rules
- Contact Type inherits from parent Account Type
- Opportunities inherit account ownership by default
- Activities cascade visibility to related records
- Group memberships independent of hierarchy

---

## 9. User Workflows

### 9.1 Creating a New Account
1. Navigate to Accounts module via main menu
2. Click Create New button
3. Complete all required fields (marked with asterisk)
4. Select appropriate Account Type for business relationship
5. Enter complete shipping and billing addresses
6. Save account to create record

### 9.2 Managing Account Status
1. **Activate/Deactivate**: Toggle Active switch on account row
2. **Soft Delete**: Click delete icon for inactive status
3. **Hard Delete**: Delete inactive record for permanent removal
4. **Bulk Status Update**: Select multiple accounts and apply action

### 9.3 Commission Reassignment Process

**For Individual Opportunities**:
1. Navigate to specific Opportunity Detail
2. Click "Manage Commissions" (manager only)
3. Set termination date
4. Choose reassignment type (A, B, or C)
5. Apply changes to single opportunity

**For Global Representative Changes**:
1. Filter Account List by Account Owner
2. Select all affected accounts
3. Click "Reassign Accounts"
4. Configure cascade options
5. Set global termination date
6. Choose reassignment strategy
7. Preview impact and execute

### 9.4 Creating and Managing Opportunities
1. Open Account Detail page
2. Navigate to Opportunities tab
3. Click Create New
4. Enter opportunity details
5. Configure commission splits (must total 100%)
6. Save opportunity
7. Track through stage progression

---

## 10. Field Reference Guide

### 10.1 Account Core Fields

| Field ID | Field Name | Type | Required | Default | Validation |
|----------|------------|------|----------|---------|------------|
| 01.01.000 | Account_Name | Text | Yes | - | Unique system-wide |
| 01.01.001 | Account_Legal_Name | Text | Yes | - | - |
| 01.01.002 | Account_Type | Dropdown | Yes | - | Predefined values |
| 01.01.003 | Account_Owner | Lookup | Yes | Current User | House contacts only |
| 01.01.009 | Employee_Count | Calculated | Auto | 0 | Count of active contacts |

### 10.2 Address Fields

| Field ID | Field Name | Type | Required | Validation |
|----------|------------|------|----------|------------|
| 01.01.004 | Shipping_Street | Text | Yes | - |
| 01.01.005 | Shipping_Street_2 | Text | No | - |
| 01.01.006 | Shipping_City | Text | Yes | Proper case |
| 01.01.007 | Shipping_State | Dropdown | Yes | 2-letter code |
| 01.01.008 | Shipping_Zip | Numeric | Yes | Max 12 digits |

### 10.3 Opportunity Fields

| Field ID | Field Name | Type | Required | Default |
|----------|------------|------|----------|---------|
| 01.07.000 | Close_Date | Date | Yes | - |
| 01.07.001 | Order_ID_House | Auto-generated | Yes | System generated |
| 01.07.002 | Opportunity_Name | Text | Yes | - |
| 01.07.003 | Opportunity_Stage | Dropdown | Yes | 1. Needs Analysis |
| 01.08.008 | House_Split_Percent | Formula | Yes | Calculated |
| 01.08.009 | House_Rep_% | Percentage | Yes | - |
| 01.08.010 | Subagent_% | Percentage | Yes | 0.00% |

---

## 11. Business Rules

### 11.1 Account Management Rules
- Account names must be unique across the entire system
- Account Type cannot be changed after contact associations exist
- Parent account cannot reference itself or create circular hierarchies
- Inactive accounts hidden from default views but maintain data integrity

### 11.2 Commission Rules
- Commission splits must always total exactly 100%
- Commission structure locked after initial opportunity save
- Reassignment requires manager-level permissions
- Historical commission data preserved for reporting

### 11.3 Deletion Rules
- Two-stage deletion process (soft delete then hard delete)
- Cascading rules apply to child records
- Audit trail maintained for all deletions
- Recovery possible for soft-deleted records

### 11.4 Data Integrity Rules
- Contact Type must match parent Account Type
- Opportunities cannot exist without parent account
- Activities maintain association even if account inactive
- Group memberships persist through status changes

---

## Appendix A: Account Types

| Type | Description | Typical Use Case |
|------|-------------|------------------|
| Customer | Active client account | Revenue-generating relationships |
| Prospect | Potential customer | Sales pipeline development |
| Vendor | Supplier/vendor | Procurement relationships |
| Distributor | Channel partner | Distribution network |
| House Rep | Internal sales | Employee accounts |
| Subagent | External sales | Partner representatives |
| Other | Miscellaneous | Special classifications |

---

## Appendix B: System Integrations

- **Email Integration**: Automatic activity creation from email
- **Calendar Synchronization**: Meeting and task synchronization
- **Reporting Module**: All fields available for custom reports
- **Workflow Engine**: Trigger points for automation
- **API Access**: RESTful API for external integrations
- **Commission Reconciliation**: Integration with financial systems

---

## Document Control

- **Version**: 1.0
- **Last Updated**: Current
- **Document Status**: Final
- **Classification**: Internal Use Only
- **Review Cycle**: Quarterly
- **Document Owner**: CRM Development Team
- **Approval**: System Architecture Board

---

*End of Accounts Module Specification*