# CRM System - Comprehensive Functional Specification

## Part I: Global UI Specifications

### 1. Navigation & Layout

#### 1.1 Breadcrumb Navigation
- **Location**: Top of every page below main header
- **Format**: Home > Module Name > Current Page
- **Behavior**: 
  - Each segment is clickable to navigate back
  - Current page segment is not hyperlinked
  - Menu highlighting persists on selected module until user clicks another
  - Drilling into related objects maintains parent module highlighting

#### 1.2 Page Structure
- **Horizontal Scrolling**: Available when columns exceed viewport width
- **Vertical Scrolling**: Available when rows exceed viewport height
- **Sticky Headers**: Column headers remain visible during vertical scroll
- **Responsive Design**: Minimum viewport width of 1024px

### 2. Dynamic Column System

#### 2.1 Dynamic Column Selector
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

#### 2.2 Column Management Features
- **Width Adjustment**: 
  - Drag column borders to resize
  - Double-click border for auto-fit
  - Text wraps within cells
  - Headers expand vertically for wrapped text
  
- **Direct Reordering**: 
  - Drag column headers left/right on main page
  - Visual indicator shows drop position
  - Changes persist to user profile

- **Sorting**:
  - Click header to sort ascending (A-Z, 0-9)
  - Click again for descending (Z-A, 9-0)
  - Third click removes sort
  - Sort indicator arrow shows current state

### 3. Filtering & Search System

#### 3.1 Filter Controls
- **Filter By Column**: Dropdown listing all visible columns
- **Filter Value**: Input field for filter criteria
- **Apply Filter**: Blue button to execute filter
- **Filter Tags**: Applied filters display as removable tags
  - Format: "FieldName: Value" 
  - Click X to remove individual filter
  - Multiple filters create AND conditions

#### 3.2 Search Functionality
- **Global Search Bar**: Free text search across all visible columns
- **Type-ahead**: Auto-suggest after 3 characters
- **Clear Search**: X button to reset

#### 3.3 View Toggles
- **Show Inactive Records**: Checkbox to include inactive items
  - Default: Unchecked (show active only)
  - Label: "Show inactive [object type]"
  - Position: Above data table, right-aligned

### 4. Record Management

#### 4.1 Record Selection
- **Individual**: Click checkbox in row
- **Select All**: Header checkbox selects visible page
- **Multi-select**: Shift+Click for range, Ctrl/Cmd+Click for individual
- **Visual Feedback**: Selected rows highlighted with light blue background

#### 4.2 Cloning/Duplication
- **Access**: "Duplicate" button appears when single record selected
- **Behavior**:
  - Creates exact copy with new unique ID
  - Appends " (Copy)" to name field
  - Opens in edit mode for modifications
  - Useful for creating similar records (e.g., multiple locations)

#### 4.3 Bulk Actions
Available when multiple records selected:
- Delete (with confirmation)
- Export to CSV
- Change Owner (Manager only - see Section 4.4)
- Update Status

#### 4.4 Account Reassignment (Manager Only)

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

**UI Components**:

**Reassignment Modal Layout**:
```
+------------------------------------------+
|        Account Reassignment              |
|                                          |
| Selected Accounts: 3                     |
| Current Owner: John Smith                |
|                                          |
| Assign to: [Dropdown - House Reps]      |
| □ Assign to House Agency                 |
|   House Contact: [Dropdown]             |
|                                          |
| Commission Adjustments:                  |
| Current:  House: 34% | Rep: 55% | SA: 11%|
| New:      House: 89% | Rep: 0%  | SA: 11%|
|                                          |
| Effective Date: [Date Picker]           |
|                                          |
| Items to Transfer:                      |
| • 15 Active Contacts                    |
| • 8 Open Tasks                         |
| • 3 Active Groups                      |
|                                          |
| [Cancel]           [Confirm Transfer]   |
+------------------------------------------+
```

**Audit Trail Format**:
- Date/Time: YYYY-MM-DD HH:MM:SS
- Action: "Account Reassignment"
- Performed By: [Manager Name]
- Accounts: [List of Account Names]
- From: [Original Owner]
- To: [New Owner]
- Commission Change: [Details]
- Items Transferred: [Summary counts]

### 5. Form Standards

#### 5.1 Create New Forms
- **Consistency**: All "Create New" actions use modal popups
- **Layout**: Two-column design for optimal space usage
- **Validation**: 
  - Real-time field validation
  - Duplicate name checking with suggestions
  - Required field indicators (red asterisk)
  - Error messages appear below fields

#### 5.2 Form Controls
- **Primary Actions**: 
  - "Add" or "Save" (blue button, bottom right)
  - "Cancel" (gray button, bottom right)
- **Field Behavior**:
  - Tab order follows visual layout
  - Enter key moves to next field
  - Auto-format on blur (phone, zip, etc.)

### 6. Data Display Standards

#### 6.1 Field Formatting
- **Names**: Proper case (First Letter Capitalized)
- **States**: 2-letter uppercase abbreviations
- **Phones**: (XXX) XXX-XXXX format
- **Dates**: YYYY-MM-DD
- **Currency**: $X,XXX.XX
- **Percentages**: XX.XX%

#### 6.2 Hyperlinks
- **Internal Links**: Same tab navigation
- **External URLs**: Open in new browser tab
- **Visual Style**: Blue text, underline on hover
- **Link Icons**: External link indicator for URLs

### 7. UI Persistence

All user interface customizations persist across sessions:
- Column selections and order
- Column widths
- Sort preferences
- Filter selections
- View toggle states
- Records per page setting

### 8. Tabbed Navigation System

#### 8.1 Tab Structure
- **Position**: Below main detail content area
- **Style**: Horizontal tabs with underline indicator for active tab
- **Behavior**:
  - Click to switch between tabs
  - Content loads dynamically without page refresh
  - Active tab persists during session
  - Each tab maintains its own state (filters, sort, pagination)

#### 8.2 Tab Content Areas
- **Full Width**: Tab content spans entire page width
- **Independent Controls**: Each tab has its own:
  - Create New button
  - Search bar
  - Filter controls
  - Active/Show All toggle
  - Dynamic column selector (gear icon)
  - Pagination controls

#### 8.3 Related Records Context
- Parent record ID maintained across all tabs
- New records created from tabs automatically link to parent
- Breadcrumb shows: Module > Parent Record > Tab Name
- Actions performed in tabs reflect immediately in parent record

---

## Part II: Accounts Module Specification

### 1. Account List Page

#### 1.1 Page Purpose
Primary interface for viewing and managing all customer accounts with full CRUD operations and customizable display options.

#### 1.2 Default Configuration
- **Initial Sort**: Account Name (A-Z)
- **Default View**: Active accounts only
- **Records Per Page**: 200 (configurable: 200/500/1000)
- **Pagination**: "Showing X to Y of Z entries" with Previous/Next

#### 1.3 Standard Columns (Default Order)
1. **Active** - Toggle switch (blue=active, gray=inactive)
2. **Action** - Delete icon (trash can)
3. **Account Name** - Hyperlink to detail page
4. **Account Legal Name** - Text display
5. **Account Type** - Dropdown value
6. **Account Owner** - Full name of house representative
7. **Shipping State** - 2-letter code
8. **Shipping City** - Text
9. **Shipping Zip** - Numeric
10. **Shipping Street** - Address line 1
11. **Shipping Street 2** - Address line 2

#### 1.4 Available Actions
- **Create New**: Opens account creation modal
- **Edit**: Click account name to access detail page
- **Delete**: Trash icon with confirmation dialog
- **Clone**: Duplicate button when single record selected
- **Toggle Active**: Switch in Active column
- **Bulk Operations**: Available with multi-select

### 2. Create New Account Form

#### 2.1 Form Layout (Two-Column Modal)

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

#### 2.2 Validation Rules
- Account Name must be unique
- Similar name detection with warning
- Valid URL format for website
- Complete address requirements
- Required field enforcement

### 3. Account Detail Page

#### 3.1 Page Structure
**Navigation Path**: Home > Accounts > [Account Name]

**Page Actions** (Top Right):
- **Update** - Edit account information
- **Back** - Return to Account List

**Layout Sections**:
1. Account Information (Top Left/Right columns)
2. Tabbed Related Records (Bottom section)

#### 3.2 Account Information Display

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
- **Order ID - House** - Auto-generated identifier (visible but not shown in image)

**Right Column - Address Information** (Read-only in view mode):

*Bill To Address Section:*
- **Billing Street** (Field 01.04.000)
- **Billing Street 2** (Field 01.04.001)
- **Billing City** (Field 01.04.002)
- **Billing State** - 2-letter code (Field 01.04.003)
- **Billing Zip** (Field 01.04.004)
- **Billing Country** (Field 01.04.005)

*Ship To Address Section:*
- **[ ] Same as Ship** checkbox (in edit mode)
- **Shipping Street** (Field 01.04.006)
- **Shipping Street 2** (Field 01.04.007)
- **Shipping City** (Field 01.04.008)
- **Shipping State** - 2-letter code (Field 01.04.009)
- **Shipping Zip** (Field 01.04.010)
- **Shipping Country** (Field 01.04.011)

#### 3.3 Tabbed Navigation Bar
Four tabs displayed horizontally:
1. **Contacts** (default active)
2. **Opportunities**
3. **Groups**
4. **Activities & Notes**

### 4. Contacts Tab (Within Account Detail)

#### 4.1 Tab Purpose
Displays all contacts associated with the current account, allowing direct management of contact relationships without leaving the account context.

#### 4.2 Tab Controls
**Top Control Bar**:
- **Create New** button - Opens new contact modal
- **Search bar** - "Search here" placeholder
- **Filter By Column** dropdown
- **Apply Filter** button (blue)
- **Dynamic Columns** (gear icon)
- **Active/Show All** toggle buttons

#### 4.3 Default Contact Columns
Dynamic columns with default display (Fields 01.05.xxx):
1. **Actions** - Delete icon (trash)
2. **Active** - Toggle switch (blue=active)
3. **Suffix** - Mr./Ms./Mrs./Dr. (Field 01.05.000)
4. **Full Name** - Concatenated, hyperlinked to contact detail (Field 01.05.001)
5. **Job Title** - Text display (Field 01.05.006)
6. **Contact Type** - Inherited from account (Field 01.05.007)
7. **Email Address** - Clickable mailto link (Field 01.05.009)

**Additional Available Columns** (via Dynamic Columns):
- First Name (Hidden by default) (Field 01.05.002)
- Last Name (Hidden by default) (Field 01.05.003)
- Work Phone (Field 01.05.004)
- Extension (Field 01.05.005)
- Mobile (Field 01.05.008)

#### 4.4 Contact-Account Relationship
- **Contact Type** automatically inherits from parent Account Type
- New contacts created from this tab auto-associate with current account
- Deleting contact removes association, not the contact record
- Full Name field is hyperlink to Contact Detail page

#### 4.5 Create New Contact Form

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

#### 4.6 Pagination & Display
- **Records shown**: "Showing 1 to 2 of 2 entries"
- **Navigation**: Previous | [1] | Next
- **Per page selector**: Dropdown (10/25/50/100 entries)

### 5. Opportunities Tab (Within Account Detail) - *To be documented*

### 6. Groups Tab (Within Account Detail) - *To be documented*

### 7. Activities & Notes Tab (Within Account Detail) - *To be documented*

### 4. Data Relationships

#### 4.1 Field Sources
- Account Owner: Contacts where Account Type = "House"
- Parent Account: All existing accounts
- Industry: Predefined list from configuration
- States: Standard US state abbreviations
- Countries: ISO country list

#### 4.2 Related Objects
- Contacts: Many-to-one relationship
- Opportunities: One-to-many relationship
- Groups: Many-to-many relationship
- Activities: One-to-many relationship

---

## Part III: Additional Module Specifications

### Contacts Module 

#### Contact List Page (Main Contacts View)
**Navigation Path**: Home > Contacts

**Page Purpose**: Primary interface for viewing and managing all contacts across all accounts in the system.

**Default Configuration**:
- **Default Sort**: Full Name (A-Z)
- **Default View**: Active contacts only
- **Records Per Page**: 200 (configurable: 200/500/1000)
- **Dynamic Columns**: Available via gear icon

**Standard Columns (Default Order)**:
1. **Active** - Toggle switch
2. **Action** - Delete icon
3. **Suffix** - Mr./Ms./Mrs./Dr.
4. **Full Name** - Hyperlink to Contact Detail page
5. **Extension** - Numeric extension
6. **Work Phone** - Formatted phone
7. **Contact Type** - Inherited from Account
8. **Email Address** - Clickable mailto
9. **Job Title** - Text display
10. **Mobile** - Formatted phone

#### Create New Contact Form (From Contacts Module)
**Access**: Click "Create New" button on Contact List page

When creating a contact from the main Contacts module (not from an Account), the form requires Account selection first, which then determines the Contact Type.

**Key Differences from Account Context**:
- User must first select an Account from dropdown
- Contact Type automatically populates based on selected Account Type
- Account association happens through selection rather than context

**Form Fields**: Same as documented in Section 4.5 of Accounts Module, with the addition of:
- **Account Name*** - Required dropdown selection (must select first)
  - Lists all active accounts
  - Once selected, Contact Type auto-populates
  - Selection is permanent once saved

**Workflow**:
1. User clicks "Create New" from Contacts list
2. Form opens with Account Name field required
3. User selects Account from dropdown
4. Contact Type automatically inherits from selected Account
5. User completes remaining fields
6. Save returns to Contact List or opens Contact Detail

### Contact Detail Page

#### Page Structure
**Navigation Path**: 
- Via Account: Home > Accounts > [Account Name] > Contact Detail > [Contact Name]
- Via Contacts: Home > Contacts > Contact Detail > [Contact Name]

**Page Actions** (Top Right):
- **Update** - Edit contact information
- **Back** - Return to previous page

#### Contact Information Display (Top Section)

**Layout** (Multi-field row format):

**Row 1**:
- **Name** - Prefix (Dr./Mr./Ms./Mrs.) + First Name + Last Name
  - Displayed with red highlight on active field
  - Format: "Dr. testfirstname testlastname"
- **Contact Type** - Inherited from Account (dropdown, read-only in view)
  - Example: "Customer"
- **Active(Y/N)** - Toggle switch (blue = active)

**Row 2**:
- **Account Name** - Dropdown showing associated account
  - Example: "pradtestaccount"
- **Email Address** - Clickable mailto link
  - Example: "testcontact@gmail.com"

**Row 3**:
- **Job Title** - Text display
  - Example: "testjobtitle"
- **ID** - System-generated contact ID
  - Example: "5312627F1"

**Row 4**:
- **Work Phone** - Formatted phone number
  - Format: +1-234-234-2342
- **Extension** - Numeric extension
  - Example: "234234"
- **Description** - Multi-line text box
  - Example: "testdescription"

**Row 5**:
- **Mobile** - Formatted phone number
  - Format: +1-234-234-2342

#### Contact Tabs
Three tabs displayed below contact information:
1. **Activities & Notes** (default active)
2. **Opportunities**
3. **Groups**

##### Activities & Notes Tab (Within Contact Detail)
**Controls**:
- **Create New** button
- **Search** bar
- **Filter By Column** dropdown
- **Apply Filter** button
- **Active/Show All** toggle
- **Activity Type Filters**: All, Call, Notes, Meeting, To Do, Other

**Default Columns**:
- Actions
- Active
- Activity Date
- Activity Type
- Activity Status
- Description

**Display**: "Showing 0 to 0 of 0 entries" when empty

### Opportunities Module (Placeholder)
*To be detailed following Accounts module pattern*
- Opportunity List Page
- Create New Opportunity Form
- Opportunity Detail Page
- Stage Management
- Revenue Tracking

### Revenue Schedules Module (Placeholder)
*To be detailed based on requirements*

### Products Module (Placeholder)
*To be detailed based on requirements*

### Groups Module (Placeholder)
*To be detailed based on requirements*

### Reports Module (Placeholder)
*To be detailed based on requirements*

---

## Appendix A: Technical Implementation Notes

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

## Appendix B: Field Format Reference

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
