# Activities & Notes Module Specification

## Module Overview

The Activities & Notes functionality provides consistent activity tracking and note-taking capabilities across all CRM modules. This feature appears as a tab within Account Detail, Contact Detail, Opportunity Detail, Revenue Schedule Detail, and other entity pages, maintaining the same layout and functionality throughout the application.

---

## 1. Universal Implementation

### 1.1 Availability
The Activities & Notes tab appears in:
- Account Detail pages
- Contact Detail pages  
- Opportunity Detail pages
- Revenue Schedule Detail pages
- Any other entity requiring activity tracking

### 1.2 Consistent Behavior
- Same column layout across all implementations
- Identical controls and filters
- Shared activity types and statuses
- Universal file attachment support
- Dynamic columns available everywhere

---

## 2. Activities & Notes Tab Interface

### 2.1 Tab Controls
**Top Control Bar** (Standard across all modules):
- **Create New** button - Opens Create New Activity modal
- **Search** bar - "Search Here" placeholder
- **Filter By Column** dropdown
- **Apply Filter** button (blue)
- **Dynamic Columns** (gear icon)
- **Active** button - Show active activities only
- **Show All** button - Include completed activities

### 2.2 Activity Type Filters
Additional filter buttons for quick filtering:
- **All** (default) - Shows all activity types
- **Call** - Phone call activities
- **Meeting** - Meeting activities
- **ToDo** - Task items
- **Note** - General notes
- **Other** - Miscellaneous activities

### 2.3 Default Columns (Left to Right)

1. **Actions** - Delete/Edit icons
2. **Active** - Toggle switch (blue=active)
3. **Activity Date** (Field 02.04.001)
   - Format: YYYY-MM-DD
   - Sortable column
4. **Activity Type** (Field 02.04.002)
   - Values: Call, Meeting, ToDo, Note, Other
5. **Activity Description** (Field 02.04.004)
   - Text display, truncated if long
6. **Account Name** 
   - Hyperlink to Account Detail
   - Shows related account
7. **Attachment** (Field 02.04.006)
   - Indicator if files attached
8. **File Name** (Field 02.04.007)
   - Hyperlink to download file
   - Shows attachment filename

**Hidden/Available Columns** (via Dynamic Columns):
- **Activity ID** (Field 02.04.000) - Auto-generated, hidden by default
- **Activity Owner** (Field 02.04.003) - House contact who created
- **Activity Status** (Field 02.04.005) - Open/Completed
- **Created By** - User who created
- **Created Date** - Timestamp of creation
- **Modified By** - Last editor
- **Modified Date** - Last edit timestamp

### 2.4 List Behavior
- **Default Sort**: Activity Date (most recent first)
- **Pagination**: "Showing X to Y of Z entries"
- **Per Page Options**: 10/25/50/100 records
- **Multi-select**: Checkboxes for bulk operations

---

## 3. Create New Activity Form

### 3.1 Modal Configuration
**Title**: "Create New Activity"
**Layout**: Two-column form
**Context**: Inherits parent record context

### 3.2 Form Fields (Fields 02.05.xxx)

**Left Column**:

1. **Activity Date*** (Field 02.05.001)
   - Date picker
   - Default: Today's date
   - Format: YYYY-MM-DD
   - Required field

2. **Activity Type*** (Field 02.05.002)
   - Dropdown selection
   - Options: Call, Meeting, ToDo, Note, Other
   - Required field
   - Sorted A-Z

3. **Activity Owner*** (Field 02.05.003)
   - Dropdown selection
   - Default: Current user
   - Source: All Contacts where Account Type = "House"
   - Sorted A-Z
   - Required field

**Right Column**:

4. **Activity Description*** (Field 02.05.004)
   - Multi-line text area
   - Required field
   - No character limit
   - Placeholder: "Enter activity details..."

5. **Attachments**
   - File upload area
   - Drag-and-drop or browse
   - Multiple files supported
   - All file types accepted

**Hidden Fields** (Auto-populated):
- **Activity ID** (Field 02.05.000) - System-generated upon save
- **Related Entity** - Parent record (Account/Contact/etc.)
- **Created By** - Current user
- **Created Date** - Current timestamp

### 3.3 Form Actions
- **Save and New** - Creates activity, reopens form
- **Save** - Creates activity, closes modal
- **Cancel** - Discards changes, closes modal

### 3.4 Post-Creation
- Activity appears in tab immediately
- Notifications sent if configured
- Available in reporting
- Audit trail created

---

## 4. Activity Detail Page

### 4.1 Page Layout
**Standard two-column layout** matching other detail pages

**Navigation**:
- Breadcrumb: Home > [Parent Module] > [Parent Record] > Activity Detail

### 4.2 Activity Information Section

**Left Column**:
- **Activity Date** - Date picker (editable)
- **Activity Type** - Dropdown (editable)
- **Activity Type** - Display of parent context
- **Activity Owner** - Lookup to House contacts
- **Created Date** - Read-only
- **Created By** - Read-only

**Right Column**:
- **Activity Description** - Multi-line text (editable)
- **Activity Status** - Open/Completed toggle
- **Modified Date** - Read-only
- **Modified By** - Read-only

### 4.3 Attachments Section
- List of attached files
- Upload new attachments button
- Delete attachment capability
- Download links for each file

### 4.4 Page Actions (Top Right)
- **Update** - Save changes
- **Delete** - Remove activity
- **Back** - Return to parent record

---

## 5. Activity Types & Status

### 5.1 Activity Types

| Type | Purpose | Common Use Cases |
|------|---------|-----------------|
| Call | Phone conversations | Sales calls, support calls, follow-ups |
| Meeting | In-person or virtual meetings | Client meetings, demos, reviews |
| ToDo | Task items | Action items, reminders, deadlines |
| Note | General information | Comments, observations, updates |
| Other | Miscellaneous | Any activity not fitting above |

### 5.2 Activity Status

| Status | Description | Behavior |
|--------|-------------|----------|
| Open | Active/pending activity | Default for new activities |
| Completed | Finished activity | Can be filtered out |

### 5.3 Status Transitions
- New activities default to "Open"
- Manual toggle to "Completed"
- Completed activities remain in history
- Can reopen completed activities

---

## 6. File Attachments

### 6.1 Supported Features
- Multiple files per activity
- Any file type accepted
- Drag-and-drop upload
- Browse to upload
- Direct download links

### 6.2 Storage & Display
- Files stored centrally
- Linked to activity record
- Filename displayed as hyperlink
- File size shown (if applicable)
- Upload date tracked

### 6.3 Security
- Inherits parent record permissions
- Only authorized users can download
- Audit trail for uploads/downloads

---

## 7. Context Inheritance

### 7.1 Parent Record Association
When created from a specific context (Account, Contact, etc.):
- Activity automatically linked to parent
- Parent name shown in activity list
- Activity appears in parent's Activities tab
- Cannot change parent association after creation

### 7.2 Cross-Module Visibility
- Activities visible from all related records
- Example: Activity on Opportunity also shows on related Account
- Maintains referential integrity
- Cascading delete rules apply

---

## 8. Field Reference

### 8.1 List View Fields (02.04.xxx)

| Field ID | Field Name | Type | Required | Default |
|----------|------------|------|----------|---------|
| 02.04.000 | Activity_ID | Auto-number | Yes | Generated |
| 02.04.001 | Activity_Date | Date | Yes | Today |
| 02.04.002 | Activity_Type | Dropdown | Yes | - |
| 02.04.003 | Activity_Owner | Lookup | Yes | Current User |
| 02.04.004 | Activity_Description | Text Long | Yes | - |
| 02.04.005 | Activity_Status | Dropdown | Yes | Open |
| 02.04.006 | Attachment | Indicator | No | - |
| 02.04.007 | File_Name | Hyperlink | No | - |

### 8.2 Create Form Fields (02.05.xxx)

| Field ID | Field Name | Type | Required | Default |
|----------|------------|------|----------|---------|
| 02.05.000 | Activity_ID | Auto-number | Yes | Generated |
| 02.05.001 | Activity_Date | Date | Yes | Today |
| 02.05.002 | Activity_Type | Dropdown | Yes | - |
| 02.05.003 | Activity_Owner | Lookup | Yes | Current User |
| 02.05.004 | Activity_Description | Text Long | Yes | - |

---

## 9. Reporting & Analytics

### 9.1 Activity Metrics
- Activity count by type
- Activities by owner
- Open vs Completed ratio
- Average activities per record
- Activity timeline analysis

### 9.2 Available Reports
- Activity Summary Report
- User Activity Report
- Overdue ToDo Report
- Communication History
- Activity Audit Trail

### 9.3 Dashboard Widgets
- Recent Activities
- My Open ToDos
- Team Activity Stats
- Upcoming Meetings

---

## 10. User Workflows

### 10.1 Logging a Sales Call
1. Navigate to Account/Contact
2. Click Activities & Notes tab
3. Create New > Select "Call"
4. Enter call summary
5. Attach any relevant documents
6. Save activity

### 10.2 Creating a ToDo
1. From any entity page
2. Activities & Notes > Create New
3. Type: "ToDo"
4. Set future date
5. Enter task description
6. Assign to team member
7. Save as "Open"

### 10.3 Meeting Documentation
1. Before meeting: Create as "Meeting" type
2. Status: "Open"
3. After meeting: Edit activity
4. Add meeting notes
5. Attach presentations/documents
6. Mark as "Completed"

### 10.4 General Note Taking
1. Quick notes: Type "Note"
2. No specific date required
3. Capture observations
4. Link to relevant records
5. Available for future reference

---

## 11. Best Practices

### 11.1 Activity Management
- Log activities immediately after occurrence
- Use appropriate activity types consistently
- Complete ToDos promptly
- Attach relevant documents
- Keep descriptions concise but complete

### 11.2 Data Quality
- Accurate dates essential for reporting
- Consistent type selection
- Clear, searchable descriptions
- Regular status updates
- Proper file naming conventions

### 11.3 Team Collaboration
- Visible activities improve coordination
- Shared notes prevent duplication
- ToDo assignments clear ownership
- Meeting notes inform absent members

---

## 12. System Integration

### 12.1 Email Integration
- Future: Auto-create from emails
- Attach email threads
- Link to email campaigns

### 12.2 Calendar Sync
- Future: Sync meetings with calendar
- Create calendar events from activities
- Reminder notifications

### 12.3 Workflow Automation
- Trigger workflows from activity creation
- Auto-create follow-up activities
- Status-based automation

---

## 13. Permissions

### 13.1 View Permissions
- Inherit from parent record
- See own activities always
- Team visibility configurable

### 13.2 Edit Permissions
- Edit own activities
- Managers edit team activities
- Admin full access

### 13.3 Delete Permissions
- Soft delete (inactive)
- Hard delete (admin only)
- Audit trail maintained
