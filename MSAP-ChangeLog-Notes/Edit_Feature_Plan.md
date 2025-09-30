# Edit Feature Implementation Plan

## Current Implementation Status

### ✅ Fully Implemented Edit Features

**Accounts:**
- ✅ Detail page navigation via account name links
- ✅ Update button on Account Detail page (`account-details-view.tsx:1113-1118`)
- ✅ API endpoint for updates (`/api/accounts/[accountId]/route.ts` - PATCH functionality lines 249-350)
- ✅ Active status toggle functionality in tables (`accounts/page.tsx:418-458`)
- ✅ Two-stage deletion system (soft/hard delete)
- ⚠️ **Missing**: Inline edit modal from table action buttons

**Contacts:**
- ✅ Detail page navigation via contact name links  
- ✅ Update button on Contact Detail page (`contact-details-view.tsx:985-990`)
- ✅ Comprehensive API endpoint (`/api/contacts/[id]/route.ts` - PATCH lines 243-455)
- ✅ Field-by-field updates, account association changes, address updates
- ✅ Two-stage deletion system with bulk operations
- ⚠️ **Missing**: Inline edit modal from table action buttons

### ❌ Missing Edit Features

**Activities & Notes:**
- ❌ No edit functionality in `activity-detail-view.tsx` (read-only only)
- ❌ No API PATCH endpoint for activities
- ❌ No inline edit from table action buttons
- ❌ Attachment management not implemented

**Opportunities:**
- ❌ No comprehensive edit UI or API implementation
- ❌ No inline edit from table action buttons  
- ❌ Commission management workflows not implemented

**Groups:**
- ❌ No edit UI or API implementation visible
- ❌ No member management functionality

## Implementation Plan

### Phase 1: Main Table Edit Modals (COMPLETED)

**✅ Accounts Table:** 
- ✅ Account edit modal implemented (`components/account-edit-modal.tsx`)
- ✅ API integration with full address handling
- ✅ Table integration in `app/(dashboard)/accounts/page.tsx`

**✅ Contacts Table:**
- ✅ Contact edit modal implemented (`components/contact-edit-modal.tsx`)
- ✅ API integration with proper field mapping and address support
- ✅ Table integration in `app/(dashboard)/contacts/page.tsx`

### Phase 2: Account Details View Tables (HIGH PRIORITY - NEW REQUIREMENT)

The Account Details page (`components/account-details-view.tsx`) has 4 tabs with tables that need edit/delete action columns added:

#### 2.1 Contacts Tab (Account Details)
**Current State:** Only has basic delete button in actions column (lines 730-742)
**Required Changes:**
- Add edit button to actions column render 
- Create state management for contact edit modal
- Import and integrate existing `ContactEditModal` component
- Add delete confirmation with two-stage delete system
- Handle contact-to-account context passing

#### 2.2 Opportunities Tab (Account Details)  
**Current State:** No action column currently exists
**Required Changes:**
- Add actions column to `OPPORTUNITY_TABLE_BASE_COLUMNS` (lines 224-289)
- Implement edit/delete action button renders
- Create opportunity edit modal component (`components/opportunity-edit-modal.tsx`)
- Integrate opportunity PATCH API (needs implementation)
- Add opportunity delete functionality

#### 2.3 Groups Tab (Account Details)
**Current State:** No action column currently exists  
**Required Changes:**
- Add actions column to `GROUP_TABLE_BASE_COLUMNS` (lines 291-338)
- Implement edit/delete action button renders
- Create group edit modal component (`components/group-edit-modal.tsx`) 
- Integrate group PATCH API (needs implementation)
- Add group delete functionality

#### 2.4 Activities Tab (Account Details)
**Current State:** No action column currently exists
**Required Changes:**
- Add actions column to `ACTIVITY_TABLE_BASE_COLUMNS` (lines 340-414)
- Implement edit/delete action button renders  
- Create activity edit modal component (`components/activity-edit-modal.tsx`)
- Integrate activity PATCH API (needs implementation)
- Add activity delete functionality

#### 2.5 Implementation Pattern for Account Details Tables

**Common Integration Steps:**
1. Add actions column to table base columns definition
2. Import necessary edit modal components  
3. Add state management for modal visibility and selected item
4. Implement action button renders with edit/delete functions
5. Integrate two-stage delete confirmation system
6. Add success/error notification handling

### Phase 3: Missing Edit Modal Components (MEDIUM PRIORITY)

Need to create edit modals for entities that don't have them yet:

#### 3.1 Opportunity Edit Modal (`components/opportunity-edit-modal.tsx`)
- Based on existing opportunity create modal structure
- Support opportunity name, stage, owner, close date editing
- Handle commission data restrictions if applicable
- Integrate with opportunity PATCH API

#### 3.2 Group Edit Modal (`components/group-edit-modal.tsx`)  
- Support group name, description, visibility editing
- Handle member management if required
- Integrate with group PATCH API

#### 3.3 Activity Edit Modal (`components/activity-edit-modal.tsx`)
- Support activity type, date, description, status editing
- Handle attachment management
- Integrate with activity PATCH API

### Phase 4: API Development (MEDIUM PRIORITY)

Some entities need PATCH API endpoints:

#### 4.1 Activities API (`/api/activities/[id]/route.ts`)
- PATCH endpoint for activity updates
- Support field updates with validation
- Attachment management functionality
- Audit logging integration

#### 4.2 Groups API (`/api/groups/[id]/route.ts`)
- PATCH endpoint for group updates  
- Member management operations
- Visibility and permission handling

#### 4.3 Opportunities API Enhancement
- Extend existing opportunity API for comprehensive editing
- Commission management restrictions
- Stage progression validation

### Phase 5: Legacy Integration Pattern

```typescript
// Standard pattern for edit modals
const [editingItem, setEditingItem] = useState<ItemType | null>(null)
const [showEditModal, setShowEditModal] = useState(false)

const handleEditClick = (item: ItemType) => {
  setEditingItem(item)
  setShowEditModal(true)
}

const handleEditSuccess = () => {
  loadItems() // Refresh table data
  setShowEditModal(false)
  setEditingItem(null)
  showSuccess("Item updated successfully")
}
```

### Phase 2: Activity Edit Implementation (MEDIUM PRIORITY)

#### 2.1 API Development
- Implement PATCH endpoint in `/api/activities/[activityId]/route.ts`
- Support field updates: date, type, owner, description, status
- Add attachment management (upload, delete)
- Include audit logging

#### 2.2 UI Development
- Add edit functionality to `activity-detail-view.tsx`
- Create `activity-edit-modal.tsx` component
- Update table action buttons in activities tables
- Implement attachment management UI

### Phase 3: Opportunity Edit Implementation (MEDIUM PRIORITY)

#### 3.1 API Development
- Create comprehensive PATCH endpoint for opportunities
- Handle close date, stage, owner, subagent updates
- Implement commission split management restrictions
- Add validation rules for locked commission data

#### 3.2 UI Development
- Create `opportunity-edit-modal.tsx` component
- Update opportunity tables with edit action buttons
- Implement commission management workflows
- Add stage progression logic

### Phase 4: Advanced Edit Features (LOW PRIORITY)

#### 4.1 Groups Edit Implementation
- Develop group edit API and UI
- Implement member management functionality
- Add public/private toggle capabilities

#### 4.2 Bulk Edit Operations
- Extend existing bulk operations to include editing
- Add bulk field update modals
- Implement batch validation and error handling

## Technical Implementation Details

### Modal Component Architecture

**Base Modal Structure:**
```typescript
interface EditModalProps<T> {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  item: T | null
  options?: OptionsType
}
```

**Form Validation Pattern:**
- Reuse existing validation logic from create modals
- Add field-specific validation for edit operations
- Handle required field changes and inheritance rules

**State Management:**
- Local component state for form data
- Optimistic updates with error rollback
- Loading states for all async operations

### API Integration Standards

**PATCH Endpoint Pattern:**
- Field-by-field validation
- Audit logging for all changes
- Cache revalidation using `revalidatePath`
- Permission-based access control
- Comprehensive error handling

**Response Format:**
```typescript
{
  success: boolean
  data?: UpdatedItem
  error?: string
  constraints?: DeletionConstraint[]
}
```

### Table Integration

**Action Column Updates:**
```typescript
render: (_value: unknown, row: ItemType) => (
  <div className="flex gap-1">
    <button
      type="button"
      className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors"
      onClick={(event) => {
        event.stopPropagation();
        handleEditClick(row);
      }}
      aria-label="Edit item"
    >
      <Edit className="h-4 w-4" />
    </button>
    {/* Existing delete button */}
  </div>
)
```

## Implementation Priority

### COMPLETED ✅
1. **Accounts & Contacts main table edit functionality** - Fully implemented with modals and API integration

### CURRENT FOCUS 🎯  
2. **Account Details View Tables** - Add edit/delete actions to all 4 tab tables:
   - Contacts tab: Add edit button alongside existing delete
   - Opportunities tab: Add full actions column with edit/delete
   - Groups tab: Add full actions column with edit/delete  
   - Activities tab: Add full actions column with edit/delete

### UPCOMING
3. **Missing Edit Modals**: Create opportunity, group, and activity edit components
4. **API Development**: Implement missing PATCH endpoints for activities and groups
5. **Advanced Features**: Bulk operations, enhanced validations, member management

## Success Criteria

- ✅ All table edit buttons functional and integrated
- ✅ Modal edit forms match existing create modal patterns
- ✅ Full API integration with proper validation
- ✅ Consistent user experience across all entity types
- ✅ Proper error handling and user feedback
- ✅ Audit logging for all edit operations