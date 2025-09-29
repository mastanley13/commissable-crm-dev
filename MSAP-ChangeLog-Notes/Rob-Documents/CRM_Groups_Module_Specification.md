# Groups Module Specification

## Module Overview

The Groups module enables users to organize accounts and contacts into logical collections for segmentation, reporting, and campaign management. Groups support both public (visible to all) and private (owner-only) configurations.

---

## 1. Groups List Page

### 1.1 Navigation
**Primary Path**: Main Menu > Groups
**Breadcrumb**: Home > Groups

### 1.2 Page Controls
**Top Bar**:
- **Create New** button - Opens Create New Group modal
- **Search** bar - Global search across all group fields
- **Filter By Column** dropdown - Column-specific filtering
- **Apply Filter** button (blue)
- **Active** button - Show active groups only
- **Show All** button - Include inactive groups
- **Dynamic Columns** (gear icon)

### 1.3 Default Columns (Left to Right)
1. **Actions** - Delete icon (trash can)
2. **Active** - Toggle switch (blue=active)
3. **Group Name** - Hyperlink to Group Detail page
4. **Type** - Group category/type
5. **Public/Private** - Access level indicator
6. **Group Description** - Text summary
7. **Group Owner** - House contact, hyperlink to Contact Detail
8. **Member Count** - Number of members (calculated)
9. **Created Date** - Date group was created
10. **Modified Date** - Last update date

### 1.4 List Features
- **Sorting**: Click column headers for ascending/descending
- **Pagination**: "Showing X to Y of Z entries"
- **Per Page**: 10/25/50/100 records dropdown
- **Multi-select**: Checkboxes for bulk operations

### 1.5 Bulk Actions
- Delete selected groups
- Change owner
- Toggle active status
- Export to CSV

---

## 2. Create New Group Form

### 2.1 Modal Configuration
**Title**: "New Account Group Form"
**Layout**: Single column
**Validation**: Real-time field validation

### 2.2 Form Fields

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| Group Name | Text | Yes | - | Unique |
| Group Type | Dropdown | No | -Select- | Predefined list |
| Public/Private | Dropdown | Yes | Private | Public/Private only |
| Group Owner | Lookup | Yes | Current user | House contacts only |
| Group Description | Text area | No | - | Max 500 chars |
| Active (Y/N) | Toggle | Yes | Yes | - |

### 2.3 Business Rules
- Group names must be unique
- Private groups visible only to owner and admins
- Public groups visible to all users
- Owner must be House contact type
- Groups created from Account/Contact context auto-add that record

### 2.4 Form Actions
- **Save and New** - Creates group, keeps modal open
- **Save** - Creates group, closes modal
- **Cancel** - Discards changes, closes modal

---

## 3. Group Detail Page

### 3.1 Page Layout
**Current Issue**: Layout shows 3 columns (inconsistent)
**Required**: Standard 2-column layout matching other detail pages

### 3.2 Group Information Section (Top)

**Left Column**:
- **Group Name** - Editable text field (Field 02.09.001)
- **Group Type** - Dropdown selection
- **Group Owner** - Lookup to House contacts (Field 02.09.003)
- **Created Date** - Read-only
- **Created By** - Read-only

**Right Column**:
- **Group Description** - Multi-line text (Field 02.09.002)
- **Public/Private** - Dropdown (Field 02.09.004)
- **Active (Y/N)** - Toggle switch (Field 02.09.000)
- **Modified Date** - Read-only
- **Modified By** - Read-only

### 3.3 Page Actions (Top Right)
- **Update** - Save changes to group
- **Delete** - Remove group (with confirmation)
- **Clone** - Duplicate group settings
- **Back** - Return to Groups list

### 3.4 Members List Section (Bottom)

**Missing Component**: Member list should display below group information

**Expected Layout**:
- Tabbed interface or single list
- Dynamic columns capability
- Search and filter controls
- Add/Remove member buttons

**Member Columns**:
1. **Actions** - Remove member icon
2. **Member Type** - Account/Contact indicator
3. **Name** - Hyperlink to member detail
4. **Type** - Account/Contact type
5. **Owner** - Member's owner
6. **Date Added** - When added to group
7. **Added By** - User who added member

**Member Management**:
- **Add Members** button - Opens member selection modal
- **Remove Selected** - Bulk remove members
- **Export Members** - Download member list

---

## 4. Groups Tab (Within Contact Detail)

### 4.1 Location
Contact Detail Page > Groups Tab

### 4.2 Tab Controls
Same as Account Groups tab:
- Create New button
- Search bar
- Filter controls
- Active/Show All toggle
- Dynamic Columns

### 4.3 Display Columns (Fields 02.07.xxx)
1. **Active (Y/N)** - Toggle (Field 02.07.000)
2. **Group Name** - Hyperlink (Field 02.07.001)
3. **Group Description** - Text (Field 02.07.002)
4. **Group Owner** - Hyperlink (Field 02.07.003)
5. **Public/Private** - Indicator (Field 02.07.004)

### 4.4 Functionality
- Shows all groups contact belongs to
- Create New adds contact as member automatically
- Remove from group doesn't delete group
- Dynamic columns for all group fields

---

## 5. Group Membership Rules

### 5.1 Adding Members
**From Group Detail**:
1. Click "Add Members"
2. Modal shows available Accounts/Contacts
3. Multi-select records
4. Click "Add Selected"

**From Account/Contact**:
1. Navigate to Groups tab
2. Click "Add to Existing Group"
3. Select group from dropdown
4. Confirm addition

### 5.2 Removing Members
- Individual: Click remove icon in member row
- Bulk: Select multiple, click "Remove Selected"
- Confirmation required for all removals

### 5.3 Permissions
**Private Groups**:
- Only owner can view/edit
- Admins have override access
- Members can't see other members

**Public Groups**:
- All users can view
- Only owner can edit
- Members visible to all

### 5.4 Cascade Rules
- Deleting group removes all memberships
- Deactivating group maintains memberships
- Deleting member (Account/Contact) removes from all groups
- Changing owner transfers all permissions

---

## 6. Reporting Integration

### 6.1 Group Filters
- Reports can filter by group membership
- Include/Exclude group members
- Compare metrics across groups

### 6.2 Group Reports
- Member list export
- Group activity summary
- Membership overlap analysis
- Group performance metrics

---

## 7. Field Reference

### 7.1 Groups Tab Fields (02.07.xxx)

| Field ID | Field Name | Type | Required | Default |
|----------|------------|------|----------|---------|
| 02.07.000 | Active_(Y/N) | Toggle | Yes | Yes |
| 02.07.001 | Group_Name | Text | Yes | - |
| 02.07.002 | Group_Description | Text Long | No | - |
| 02.07.003 | Group_Owner | Lookup | Yes | Current User |
| 02.07.004 | Public_Private | Dropdown | Yes | Private |

### 7.2 Create Group Fields (02.08.xxx)

| Field ID | Field Name | Type | Required | Default |
|----------|------------|------|----------|---------|
| 02.08.000 | Group_Name | Text | Yes | - |
| 02.08.001 | Group_Type | Text Long | No | - |
| 02.08.002 | Group_Owner | Lookup | Yes | Current User |
| 02.08.003 | Group_Description | Text Long | No | - |
| 02.08.004 | Public_Private | Dropdown | Yes | Private |
| 02.08.005 | Active_(Y/N) | Dropdown | Yes | Yes |

### 7.3 Group Detail Fields (02.09.xxx)

| Field ID | Field Name | Type | Required | Default |
|----------|------------|------|----------|---------|
| 02.09.000 | Active_(Y/N) | Toggle | Yes | Yes |
| 02.09.001 | Group_Name | Text | Yes | - |
| 02.09.002 | Group_Description | Text Long | No | - |
| 02.09.003 | Group_Owner | Lookup | Yes | Current User |
| 02.09.004 | Public_Private | Dropdown | Yes | Private |

---

## 8. Known Issues & Requirements

### 8.1 Current Issues
1. **Group Detail Layout**: Currently 3 columns, should be 2
2. **Missing Member List**: Group Detail page lacks member display
3. **Field Consistency**: Public/Private field missing in some views

### 8.2 Required Fixes
1. Restructure Group Detail to 2-column layout
2. Add Members section to Group Detail page
3. Ensure Public/Private field appears consistently
4. Add member count calculation to list views
5. Implement proper cascade delete rules

---

## 9. User Workflows

### 9.1 Creating a Marketing Segment
1. Navigate to Groups module
2. Click "Create New"
3. Name: "Q1 2024 Campaign Targets"
4. Type: "Marketing"
5. Private: Yes (only marketing team sees)
6. Add description of criteria
7. Save group
8. Add members via bulk selection

### 9.2 Managing Territory Groups
1. Create group per territory
2. Set as Public for visibility
3. Assign territory manager as owner
4. Auto-add accounts based on location
5. Use for territory reporting

### 9.3 Account Categorization
1. From Account Detail
2. Groups tab > Add to Group
3. Select multiple categories
4. Account now segmented
5. Available for filtered reports

---

## 10. System Integration

### 10.1 Related Modules
- **Accounts**: Can be group members
- **Contacts**: Can be group members
- **Reports**: Filter by group membership
- **Campaigns**: Target groups for outreach
- **Workflows**: Trigger based on group membership

### 10.2 Permissions
- View Groups: All users
- Create Groups: Configurable by role
- Edit Own Groups: Group owners
- Edit All Groups: Admins only
- Delete Groups: Owner + Admin

### 10.3 Audit Trail
- Group creation logged
- Membership changes tracked
- Owner changes recorded
- Deletion audit maintained
