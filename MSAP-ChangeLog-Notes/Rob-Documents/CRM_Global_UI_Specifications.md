# CRM System - Global UI Specifications
## Version 2.0 - Desktop Web Application

---

## 1. Navigation & Layout

### 1.1 Breadcrumb Navigation
- **Location**: Top of every page below main header
- **Format**: Home > Module Name > Current Page
- **Behavior**: 
  - Each segment is clickable to navigate back
  - Current page segment is not hyperlinked
  - Menu highlighting persists on selected module until user clicks another
  - Drilling into related objects maintains parent module highlighting

### 1.2 Page Structure
- **Horizontal Scrolling**: Available when columns exceed viewport width
- **Vertical Scrolling**: Available when rows exceed viewport height
- **Sticky Headers**: Column headers remain visible during vertical scroll
- **Desktop Requirements**: Minimum 1920x1080 resolution

---

## 2. Dynamic Column System

### 2.1 Universal Application
**The Dynamic Column System is available on ALL data tables throughout the application**, including:
- All main module list pages (Accounts, Contacts, Opportunities, etc.)
- All tabs within detail pages that display columnar data
- Any view where the gear icon (⚙️) is present
- All sub-tabs and nested views with table displays

**Standard Implementation**: Every tab containing a list view or data table includes:
- Gear icon (⚙️) in the top control bar
- Access to the full Dynamic Column Selector
- Persistent column preferences per view
- Independent column configurations for each tab

### 2.2 Dynamic Column Selector
Access via gear icon on any data table. Opens modal with three sections:

**Left Panel - Available Fields**
- Lists all unselected fields for current object
- Sorted alphabetically (A-Z)
- Search box at top for field name filtering
- Includes related object fields (expandable sections)
- Multi-select capability with Ctrl/Cmd+Click

**Center Controls**
- Single arrow right (>) - Move selected to display
- Single arrow left (<) - Remove from display
- Double arrow up (↑↑) - Move to first position
- Single arrow up (↑) - Move up one position
- Single arrow down (↓) - Move down one position
- Double arrow down (↓↓) - Move to last position

**Right Panel - Selected Fields**
- Shows currently displayed columns in order
- Drag-and-drop reordering within panel
- Field order represents left-to-right column display
- Remove fields by selecting and using left arrow

**Persistence**: Column selections and order saved to user profile

### 2.3 Column Management Features

**Universal Availability**: The gear icon (⚙️) and full Dynamic Column functionality are present on:
- Every main module list page
- Every tab within detail pages that displays columnar data  
- Every sub-view or nested table throughout the application
- Any location where data is presented in rows and columns

**Width Adjustment**: 
  - Drag column borders to resize
  - Double-click border for auto-fit
  - Text wraps within cells
  - Headers expand vertically for wrapped text
  
**Direct Reordering**: 
  - Drag column headers left/right on main page
  - Visual indicator shows drop position
  - Changes persist to user profile

**Sorting**:
  - Click header to sort ascending (A-Z, 0-9)
  - Click again for descending (Z-A, 9-0)
  - Third click removes sort
  - Sort indicator arrow shows current state

**Important**: Users can customize the column display for EVERY list view in the system, with preferences saved independently for each view.

---

## 3. Filtering & Search System

### 3.1 Filter Controls
- **Filter By Column**: Dropdown listing all visible columns
- **Filter Value**: Input field for filter criteria
- **Apply Filter**: Blue button to execute filter
- **Filter Tags**: Applied filters display as removable tags
  - Format: "FieldName: Value" 
  - Click X to remove individual filter
  - Multiple filters create AND conditions

### 3.2 Search Functionality
- **Global Search Bar**: Free text search across all visible columns
- **Type-ahead**: Auto-suggest after 3 characters
- **Clear Search**: X button to reset

### 3.3 View Toggles
- **Show Inactive Records**: Control to include/exclude inactive items
  - **Implementation Options**:
    - **Checkbox**: "Show Inactive" (unchecked by default)
    - **Button Toggle**: "Active" | "Show All" buttons
  - Default: Shows active records only
  - Position: Above data table, typically near other filter controls
  - When "Show All" selected or checkbox checked: Displays both active and inactive records
  - When "Active" selected or checkbox unchecked: Displays only active records
  
**Note**: Implementation may vary by module. Some use checkbox approach, others use button toggles. Functionality remains consistent.

---

## 4. Record Management

### 4.1 Record Selection
- **Individual**: Click checkbox in row
- **Select All**: Header checkbox selects visible page
- **Multi-select**: Shift+Click for range, Ctrl/Cmd+Click for individual
- **Visual Feedback**: Selected rows highlighted with light blue background

### 4.2 Cloning/Duplication
- **Access**: "Duplicate" button appears when single record selected
- **Behavior**:
  - Creates exact copy with new unique ID
  - Appends " (Copy)" to name field
  - Opens in edit mode for modifications
  - Useful for creating similar records (e.g., multiple locations)

### 4.3 Bulk Actions
Available when multiple records selected:
- Delete (soft delete - see Deletion Behavior)
- Export to CSV
- Change Owner (Manager only - see Section 4.4)
- Update Status

### 4.4 Deletion Behavior
**Two-Stage Deletion Process**:

**Stage 1 - Soft Delete (Inactivate)**:
- Clicking delete on an active record sets it to inactive
- Record is hidden from default views (requires "Show Inactive" to see)
- Record can be recovered by:
  1. Checking "Show Inactive" checkbox
  2. Finding the inactive record
  3. Toggling Active status back to active
- All historical data and relationships preserved
- Record excluded from reports unless specifically included

**Stage 2 - Permanent Delete**:
- Clicking delete on an already inactive record triggers confirmation:
  - "This record is already inactive. Permanently delete? This cannot be undone."
  - Options: "Permanently Delete" (red button) / "Cancel" (gray button)
- Permanent deletion:
  - Removes record from database entirely
  - Cannot be recovered
  - Historical references may show as "[Deleted Record]"
  - Audit trail maintains deletion history

**Deletion Rules by Module**:
- **Accounts**: Cannot delete if active contacts exist
- **Contacts**: Soft delete maintains account association
- **Opportunities**: Cannot delete if in Billing stage
- **Activities**: Can be deleted at any time

### 4.5 Account Reassignment (Manager Only)

**Purpose**: Allows managers to transfer account ownership from one representative to another, including all active relationships and adjusting commission structures.

**Access Control**:
- **Permission Level**: Manager role required
- **Access Point**: "Reassign Accounts" button appears when one or more accounts are selected
- **Validation**: System verifies manager permissions before displaying option

**Reassignment Workflow**:

1. **Selection Phase**:
   - Manager selects one or more accounts from Account List
   - Clicks "Reassign Accounts" button
   - System validates manager permissions

2. **Reassignment Modal**:
   
   **Current Assignment Display**:
   - Shows selected accounts with current owner names
   - Displays count of active items to be transferred:
     - Active Contacts
     - Open Activities
     - Active Groups
     - Open Tasks

   **New Representative Selection**:
   - **Dropdown**: "Assign to House Representative"
     - Source: All contacts where Account Type = "House"
     - Includes special option: "House (Agency Account)"
   - **House Option**: When selected, displays secondary dropdown:
     - "Select House Dummy Representative"
     - Lists designated dummy contacts from house agency account
     - Used for pooling commissions to house share

3. **Commission Split Adjustment**:
   
   **Commission Reallocation Panel**:
   - **Current Splits Display**:
     - House Split: XX%
     - House Rep: XX%  
     - Subagent: XX%
   
   **Reallocation Options**:
   - **Option 1**: Transfer to New Representative
     - New House Rep inherits departing rep's percentage
     - Historical splits remain unchanged
   
   - **Option 2**: Transfer to House
     - House Rep % added to House Split %
     - New total House Split = Original House + Original Rep
     - Subagent % remains unchanged
   
   **Effective Date**: Date picker for when new splits take effect
   - Default: Today's date
   - Applied to all future/open opportunities
   - Historical records maintain original splits

4. **Transfer Rules**:

   **Items Transferred to New Owner**:
   - Account ownership
   - All active Contacts
   - Open Activities and Tasks
   - Active Group memberships
   - Future commission schedules
   - Open Opportunities (ownership only)

   **Items Remaining with Original Owner**:
   - Closed Opportunities
   - Historical commission records
   - Completed Activities
   - Historical reporting data
   - Audit trail entries

5. **Confirmation & Execution**:
   
   **Pre-Transfer Summary**:
   - List of accounts being reassigned
   - New owner name
   - Commission split changes
   - Effective date
   - Count of items being transferred
   
   **Warning Messages**:
   - "This action will transfer X active items to [New Rep Name]"
   - "Historical data will remain with [Original Rep Name]"
   - "Commission splits will be adjusted effective [Date]"
   
   **Actions**:
   - **Confirm Transfer** - Execute reassignment
   - **Cancel** - Close without changes

6. **Post-Transfer Actions**:
   - Email notifications sent to:
     - Original representative
     - New representative
     - Manager performing reassignment
   - Audit log entry created with:
     - Timestamp
     - Manager name
     - Accounts affected
     - Transfer details
   - Account List refreshes showing new ownership

---

## 5. Form Standards

### 5.1 Create New Forms
- **Consistency**: All "Create New" actions use modal popups
- **Layout**: Two-column design for optimal space usage
- **Validation**: 
  - Real-time field validation
  - Duplicate name checking with suggestions
  - Required field indicators (red asterisk)
  - Error messages appear below fields

### 5.2 Form Controls
- **Primary Actions**: 
  - "Add" or "Save" (blue button, bottom right)
  - "Cancel" (gray button, bottom right)
- **Field Behavior**:
  - Tab order follows visual layout
  - Enter key moves to next field
  - Auto-format on blur (phone, zip, etc.)

---

## 6. Data Display Standards

### 6.1 Field Formatting
- **Names**: Proper case (First Letter Capitalized)
- **States**: 2-letter uppercase abbreviations
- **Phones**: (XXX) XXX-XXXX format
- **Dates**: YYYY-MM-DD
- **Currency**: $X,XXX.XX
- **Percentages**: XX.XX%

### 6.2 Hyperlinks
- **Internal Links**: Same tab navigation
- **External URLs**: Open in new browser tab
- **Visual Style**: Blue text, underline on hover
- **Link Icons**: External link indicator for URLs

### 6.3 Record Name Hyperlinking
**Standard Hyperlinking Rules**:
- **Account Names**: Always hyperlink to Account Detail page
- **Contact Full Names**: Always hyperlink to Contact Detail page  
- **Opportunity Names**: Always hyperlink to Opportunity Detail page
- **Group Names**: Always hyperlink to Group Detail page

**Hyperlink Behavior**:
- Applies to all list views and reference fields
- Maintains module navigation context (breadcrumb preservation)
- Names in read-only display fields are clickable
- Names in dropdown selections are not hyperlinked
- Hyperlinks appear in standard blue with underline on hover

**Examples**:
- In Opportunities tab: "TestTicket" → links to Opportunity Detail
- In Contacts tab: "John Smith" → links to Contact Detail  
- In Owner field: "Rob Hosef" → links to Contact Detail
- In Referred By field: Contact name → links to Contact Detail

---

## 7. UI Persistence

All user interface customizations persist across sessions:
- Column selections and order
- Column widths
- Sort preferences
- Filter selections
- View toggle states
- Records per page setting

---

## 8. Tabbed Navigation System

### 8.1 Tab Structure
- **Position**: Below main detail content area
- **Style**: Horizontal tabs with underline indicator for active tab
- **Behavior**:
  - Click to switch between tabs
  - Content loads dynamically without page refresh
  - Active tab persists during session
  - Each tab maintains its own state (filters, sort, pagination)

### 8.2 Tab Content Areas
- **Full Width**: Tab content spans entire page width
- **Independent Controls**: Each tab has its own:
  - Create New button
  - Search bar
  - Filter controls
  - **Show Inactive** checkbox (unchecked by default, shows only active records)
  - **Dynamic column selector (gear icon)** - Available on EVERY tab with columnar data
  - Pagination controls

### 8.3 Dynamic Columns in Tabs
**Every tab displaying columnar data includes**:
- Full access to Dynamic Column System via gear icon (⚙️)
- Independent column configuration per tab
- Saved preferences specific to each tab view
- Ability to add/remove/reorder columns
- Access to related object fields where applicable

**Examples of Dynamic Column usage**:
- Account Detail > Contacts tab: Choose which contact fields to display
- Account Detail > Opportunities tab: Select opportunity columns
- Account Detail > Groups tab: Configure group display fields
- Account Detail > Activities tab: Customize activity columns
- Contact Detail > Opportunities tab: Set opportunity view preferences
- Contact Detail > Activities tab: Choose activity display fields

### 8.4 Related Records Context
- Parent record ID maintained across all tabs
- New records created from tabs automatically link to parent
- Breadcrumb shows: Module > Parent Record > Tab Name
- Actions performed in tabs reflect immediately in parent record
- Column preferences saved per user, per tab, per module

---

## Technical Implementation Notes

### Performance Optimization
- Lazy loading for large datasets
- Virtual scrolling for lists >1000 records
- Server-side sorting and filtering
- Cached user preferences
- Debounced search inputs

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Desktop Requirements
- **Minimum Screen Resolution**: 1920x1080 (Full HD)
- **Recommended Resolution**: 1920x1080 or higher
- **Application Type**: Desktop-only web application
- **User Environment**: Stationary desk workstation
- **Mobile/Tablet Support**: Not supported

### Accessibility Requirements
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support

---

## Field Format Reference

| Data Type | Format | Example | Validation |
|-----------|--------|---------|------------|
| Text | Proper Case | John Smith | Alpha + spaces |
| Email | lowercase | john@example.com | RFC 5322 |
| Phone | (XXX) XXX-XXXX | (555) 123-4567 | 10 digits |
| URL | Full URL | https://example.com | Valid domain |
| Date | YYYY-MM-DD | 2025-04-15 | Valid date |
| Currency | $X,XXX.XX | $1,234.56 | Numeric |
| Percentage | XX.XX% | 12.50% | 0-100 |
| State | XX | CA | Valid abbreviation |
| Zip | XXXXX or XXXXX-XXXX | 12345 or 12345-6789 | 5 or 9 digits |

---

## 9. Commission Management Interface

### 9.1 Commission Management Access Points

**Primary Access**:
- Main Menu > Commissions (dedicated section)
- Account List > Filter by Owner > Global Reassign
- Contact Detail > Terminate All Commissions
- Opportunity Detail > Manage Commissions

### 9.2 Commission Dashboard

**Location**: Main Menu > Commissions > Dashboard

**Dashboard Widgets**:

**Active Commissions Summary**:
```
┌─────────────────────────────────────┐
│ Active Commission Streams           │
│                                     │
│ Total Reps: 42                     │
│ Active Opportunities: 1,247         │
│ Monthly Commission: $485,000        │
│ Quarterly Forecast: $1,455,000      │
│                                     │
│ [View Details]                      │
└─────────────────────────────────────┘
```

**Pending Reassignments**:
```
┌─────────────────────────────────────┐
│ Requires Attention                  │
│                                     │
│ Pending Reassignments: 23           │
│ Awaiting Approval: 5                │
│ Failed Processing: 2                │
│ Review Queue: 18                    │
│                                     │
│ [Manage Queue]                      │
└─────────────────────────────────────┘
```

**Recent Terminations**:
```
┌─────────────────────────────────────┐
│ Recent Rep Changes (Last 30 Days)   │
│                                     │
│ • John Smith - Terminated 9/15      │
│   47 opportunities reassigned       │
│ • Jane Doe - Transferred 9/10       │
│   23 opportunities reassigned       │
│                                     │
│ [View All]                          │
└─────────────────────────────────────┘
```

### 9.3 Global Reassignment Wizard

**Multi-Step Modal Interface**:

**Step Indicator**:
```
[1. Scope] → [2. Strategy] → [3. Assignment] → [4. Review] → [5. Execute]
```

**Progressive Disclosure**:
- Each step validates before proceeding
- Back navigation allowed
- Save draft functionality
- Resume incomplete reassignments

### 9.4 Commission Queue Management

**Queue Table Columns**:
1. **Priority** - Drag to reorder
2. **Status** - Pending/Processing/Complete/Error
3. **Account** - Hyperlink to account
4. **Opportunity** - Hyperlink to opportunity
5. **Current Rep** - Name with commission %
6. **New Rep** - Assigned or "Pending"
7. **Type** - A/B/C indicator
8. **Term Date** - Commission end date
9. **Value** - Monthly commission amount
10. **Actions** - Edit/Approve/Reject/Hold

**Queue Filters**:
- Status (multi-select)
- Reassignment Type
- Date Range
- Commission Value Range
- Rep Name
- Account Type

**Bulk Queue Actions**:
- Select All/None
- Bulk Approve
- Bulk Assign Rep
- Bulk Change Type
- Export Selection
- Add to Hold

### 9.5 Commission History View

**Timeline Display**:
```
Commission History for Opportunity #H456
────────────────────────────────────────
Sep 30, 2025 - Pending Reassignment
  Current: John Smith (55%)
  Planned: Susan Johnson (55%)
  Type: B - Direct Transfer
  
Jun 15, 2025 - Commission Adjusted
  Old: John Smith (45%)
  New: John Smith (55%)
  Reason: Performance Bonus
  
Jan 1, 2025 - Initial Assignment
  House: 45%
  Rep: John Smith (55%)
  Subagent: None (0%)
────────────────────────────────────────
```

### 9.6 Reassignment Preview Modal

**Layout**: Split screen comparison

**Left Side - Current State**:
- Current commission structure
- Active revenue schedules
- Monthly/Annual values
- Rep performance metrics

**Right Side - Proposed State**:
- New commission structure  
- Affected revenue schedules
- Projected values
- Impact analysis

**Bottom Actions**:
- [Apply Changes] [Save as Draft] [Cancel]
- [Export Preview] [Request Approval]
