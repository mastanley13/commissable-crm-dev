# GUI-07: Clone/Duplicate Record Implementation Plan

## Project Requirement
**GUI-07 Global UI Platform Clone/Duplicate**: When exactly one record selected, 'Duplicate' action creates a copy with new ID and appends '(Copy)'; opens in edit mode.

**Current Status**: Not Completed - Duplicate/clone actions are not implemented anywhere.

## Architecture Analysis

### ✅ **Existing Infrastructure to Leverage**

1. **Table Selection System** (`components/dynamic-table.tsx:43-44,61-63`)
   - Row selection with `selectedItems: string[]`
   - Single/multi-select with keyboard modifiers
   - Selection callbacks: `onItemSelect`, `onSelectAll`

2. **Modal Architecture** (AccountCreateModal, ContactCreateModal, RoleEditModal)
   - Consistent form validation patterns
   - Option loading from API endpoints
   - Complex nested form handling (addresses)
   - Proper loading states and error handling

3. **CRUD API Patterns**
   - Standard endpoint structure: `POST /api/{entity}`
   - UUID primary key generation
   - Audit logging and multi-tenant support
   - Validation and constraint handling

4. **Permission System** (`components/role-edit-modal.tsx:38-50`)
   - Permission categories: `accounts.create`, `accounts.edit`, etc.
   - Can easily extend with `{entity}.clone` permissions

### ❌ **Missing Components**

1. **Clone API Endpoints**: No `POST /api/{entity}/{id}/clone` endpoints
2. **Duplicate Action UI**: No clone buttons or context menu actions
3. **Name Conflict Resolution**: No automatic "(Copy)" suffix handling
4. **Permission Codes**: Missing `{entity}.clone` permission definitions

## Frontend Implementation Plan

### **Phase 1: UI Components & Integration**

#### **Task 1.1: Add Clone Action to Table Rows**
**Target Files**:
- `components/dynamic-table.tsx` - Add clone action column
- Page components: `app/(dashboard)/accounts/page.tsx`, etc.

**Implementation**:
```typescript
// Add to Column interface
interface Column {
  // ... existing properties
  actions?: Array<{
    type: 'clone' | 'edit' | 'delete';
    label: string;
    icon: ReactNode;
    condition?: (row: any) => boolean;
    onClick: (row: any) => void;
  }>;
}

// Clone action button
{
  type: 'clone',
  label: 'Duplicate',
  icon: <Copy className="h-4 w-4" />,
  condition: (row) => hasPermission(`${entityType}.clone`),
  onClick: (row) => handleClone(row.id)
}
```

#### **Task 1.2: Clone Context Menu Integration**
**Target Files**: 
- `components/dynamic-table.tsx` - Right-click context menu
- `components/list-header.tsx` - Bulk actions toolbar

**Implementation**:
```typescript
// Context menu items
const contextMenuItems = [
  // ... existing items
  {
    label: 'Duplicate',
    icon: Copy,
    onClick: handleClone,
    disabled: selectedItems.length !== 1 || !hasClonePermission,
    shortcut: 'Ctrl+D'
  }
];
```

#### **Task 1.3: Clone Modal Component**
**New File**: `components/clone-confirm-modal.tsx`

**Features**:
- Preview clone operation details
- Name conflict resolution (show suggested "(Copy)" suffix)
- Option to customize cloned record name
- Related entity selection (clone contacts with account, etc.)
- Permission validation display

```typescript
interface CloneConfirmModalProps {
  isOpen: boolean;
  entityType: string;
  sourceRecord: any;
  onConfirm: (options: CloneOptions) => void;
  onCancel: () => void;
}

interface CloneOptions {
  newName: string;
  includeRelated: {
    contacts?: boolean;
    opportunities?: boolean;
    activities?: boolean;
  };
}
```

### **Phase 2: Clone Logic & State Management**

#### **Task 2.1: Client-Side Clone Handler**
**Target Files**: All dashboard page components

**Implementation**:
```typescript
const handleClone = async (recordId: string) => {
  try {
    // 1. Validate single selection
    if (selectedItems.length !== 1) {
      showToast('Please select exactly one record to duplicate', 'error');
      return;
    }

    // 2. Show clone confirmation modal
    setCloneModal({
      isOpen: true,
      sourceRecord: data.find(item => item.id === recordId)
    });

  } catch (error) {
    showToast('Failed to duplicate record', 'error');
  }
};

const handleCloneConfirm = async (options: CloneOptions) => {
  try {
    setCloneLoading(true);
    
    // 3. Call clone API
    const response = await fetch(`/api/${entityType}/${recordId}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    
    if (!response.ok) throw new Error('Clone failed');
    
    const clonedRecord = await response.json();
    
    // 4. Open cloned record in edit mode
    if (clonedRecord.id) {
      router.push(`/${entityType}/${clonedRecord.id}?mode=edit`);
    }
    
    showToast('Record duplicated successfully', 'success');
    
  } catch (error) {
    showToast('Failed to duplicate record', 'error');
  } finally {
    setCloneLoading(false);
    setCloneModal({ isOpen: false, sourceRecord: null });
  }
};
```

## Backend Implementation Plan

### **Phase 3: API Endpoints**

#### **Task 3.1: Generic Clone Service**
**New File**: `lib/clone-service.ts`

```typescript
export interface CloneOptions {
  newName?: string;
  nameSuffix?: string;
  includeRelated?: Record<string, boolean>;
  excludeFields?: string[];
  updateFields?: Record<string, any>;
}

export class CloneService {
  async cloneRecord<T>(
    entityType: string,
    sourceId: string, 
    options: CloneOptions,
    tenantId: string,
    userId: string
  ): Promise<T> {
    // 1. Fetch source record with relationships
    const sourceRecord = await this.getRecordWithRelations(entityType, sourceId);
    
    // 2. Transform record for cloning
    const cloneData = this.transformForClone(sourceRecord, options);
    
    // 3. Handle name conflicts
    const finalName = await this.resolveNameConflict(
      entityType, 
      cloneData, 
      options.nameSuffix || '(Copy)'
    );
    
    // 4. Create cloned record
    return await this.createClonedRecord(entityType, {
      ...cloneData,
      name: finalName,
      tenantId,
      createdById: userId
    });
  }

  private transformForClone(record: any, options: CloneOptions): any {
    const cloneData = { ...record };
    
    // Remove auto-generated fields
    delete cloneData.id;
    delete cloneData.createdAt;
    delete cloneData.updatedAt;
    delete cloneData.createdById;
    delete cloneData.updatedById;
    
    // Exclude specified fields
    options.excludeFields?.forEach(field => {
      delete cloneData[field];
    });
    
    // Apply field updates
    Object.assign(cloneData, options.updateFields);
    
    return cloneData;
  }

  private async resolveNameConflict(
    entityType: string, 
    data: any, 
    suffix: string
  ): Promise<string> {
    const baseName = data.accountName || data.contactName || data.name || 'Unnamed';
    let proposedName = `${baseName} ${suffix}`;
    let counter = 1;
    
    while (await this.nameExists(entityType, proposedName)) {
      proposedName = `${baseName} ${suffix} (${counter})`;
      counter++;
    }
    
    return proposedName;
  }
}
```

#### **Task 3.2: Entity-Specific Clone Endpoints**

**New Files**:
- `app/api/accounts/[id]/clone/route.ts`
- `app/api/contacts/[id]/clone/route.ts`
- `app/api/opportunities/[id]/clone/route.ts`
- `app/api/products/[id]/clone/route.ts`

**Account Clone Example**:
```typescript
// app/api/accounts/[id]/clone/route.ts
import { CloneService } from '@/lib/clone-service';
import { validateClonePermission } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, tenantId } = await getCurrentUser();
    
    // Validate permissions
    await validateClonePermission('accounts', user, tenantId);
    
    const options = await request.json();
    const cloneService = new CloneService();
    
    const clonedAccount = await cloneService.cloneRecord(
      'account',
      params.id,
      {
        ...options,
        excludeFields: ['accountNumber'], // Auto-generated
        updateFields: {
          active: true, // Reset status
          ownerId: options.assignToMe ? user.id : undefined
        }
      },
      tenantId,
      user.id
    );
    
    // Log audit trail
    await logAuditEvent({
      action: 'CLONE',
      entityType: 'ACCOUNT',
      entityId: clonedAccount.id,
      sourceEntityId: params.id,
      userId: user.id,
      tenantId
    });
    
    return Response.json(clonedAccount);
    
  } catch (error) {
    if (error.code === 'PERMISSION_DENIED') {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    if (error.code === 'UNIQUE_CONSTRAINT') {
      return Response.json({ error: 'Name already exists' }, { status: 409 });
    }
    return Response.json({ error: 'Clone failed' }, { status: 500 });
  }
}
```

### **Phase 4: Entity-Specific Handling**

#### **Task 4.1: Account Cloning**
**Special Considerations**:
- Clone addresses (shipping/billing)
- Handle account number conflicts (auto-generate new)
- Option to clone related contacts
- Preserve account type and ownership

#### **Task 4.2: Contact Cloning**
**Special Considerations**:
- Maintain account relationship
- Handle email uniqueness (append suffix)
- Clone contact-specific fields (title, department)
- Reset contact type based on account

#### **Task 4.3: Opportunity Cloning**
**Special Considerations**:
- Clone opportunity products
- Reset stage to initial
- Update expected close date
- Clone revenue schedules (optional)

#### **Task 4.4: Complex Relationship Handling**
```typescript
const cloneAccountWithRelated = async (accountId: string, options: CloneOptions) => {
  return await prisma.$transaction(async (tx) => {
    // Clone account
    const clonedAccount = await cloneService.cloneRecord('account', accountId, options);
    
    // Clone related contacts if requested
    if (options.includeRelated?.contacts) {
      const contacts = await tx.contact.findMany({
        where: { accountId, active: true }
      });
      
      for (const contact of contacts) {
        await cloneService.cloneRecord('contact', contact.id, {
          updateFields: { accountId: clonedAccount.id }
        });
      }
    }
    
    return clonedAccount;
  });
};
```

## Permission System Integration

### **Task 5.1: New Permission Codes**
**File**: `components/role-edit-modal.tsx`

```typescript
// Add to PERMISSION_CATEGORIES
Accounts: {
  // ... existing permissions
  permissions: [
    // ... existing permissions
    { 
      code: 'accounts.clone', 
      name: 'Clone/duplicate accounts', 
      description: 'Can create copies of account records' 
    },
  ]
},
Contacts: {
  permissions: [
    // ... existing permissions
    { 
      code: 'contacts.clone', 
      name: 'Clone/duplicate contacts', 
      description: 'Can create copies of contact records' 
    },
  ]
}
```

### **Task 5.2: Permission Validation**
```typescript
// lib/auth.ts
export async function validateClonePermission(
  entityType: string, 
  user: User, 
  tenantId: string
): Promise<void> {
  const hasPermission = await checkUserPermission(
    user.id, 
    `${entityType}.clone`, 
    tenantId
  );
  
  if (!hasPermission) {
    throw new Error('PERMISSION_DENIED');
  }
}
```

## User Experience Flow

### **Clone Action Workflow**
1. **Selection**: User selects exactly one record in table
2. **Action Trigger**: User clicks "Duplicate" button or uses Ctrl+D
3. **Confirmation Modal**: Shows preview with name conflict resolution
4. **Clone Execution**: API call creates cloned record
5. **Navigation**: Automatically opens cloned record in edit mode
6. **Feedback**: Success toast notification

### **Error Handling**
- **Multiple Selection**: "Please select exactly one record"
- **Permission Error**: "You don't have permission to duplicate records"
- **Name Conflict**: Auto-resolve with "(Copy)" suffix
- **API Failure**: "Failed to duplicate record. Please try again."

## Testing Strategy

### **Unit Tests**
- Clone service logic
- Name conflict resolution
- Permission validation
- Data transformation

### **Integration Tests**
- API endpoint functionality
- Database transaction integrity
- Audit logging

### **E2E Tests**
- Complete clone workflow
- Modal interactions
- Edit mode navigation
- Error scenarios

## Implementation Timeline

- **Phase 1** (UI Components): 1-2 weeks
- **Phase 2** (Frontend Logic): 1 week  
- **Phase 3** (Backend APIs): 2-3 weeks
- **Phase 4** (Entity-Specific): 2-3 weeks
- **Phase 5** (Permissions): 1 week

**Total Estimate**: 7-10 weeks

## Key Technical Decisions

### **Data Integrity**
- Use Prisma transactions for multi-record cloning
- Implement proper constraint handling
- Maintain audit trail for all clone operations

### **Performance**
- Lazy load relationships only when needed
- Implement clone operation timeouts
- Consider background processing for complex clones

### **Security**
- Validate permissions before clone operations
- Sanitize cloned data to prevent injection
- Log all clone activities for audit

## Success Criteria

- [ ] Single record selection enables clone action
- [ ] Clone creates new record with unique ID
- [ ] Names automatically get "(Copy)" suffix
- [ ] Cloned records open directly in edit mode
- [ ] All entity types support cloning
- [ ] Related records can be optionally cloned
- [ ] Permission system properly restricts access
- [ ] Audit trail captures all clone operations

This implementation leverages the existing strong architecture in Commissable CRM while adding the missing clone/duplicate functionality across all entity types.