# GUI-10: Account Reassignment Workflow Implementation Plan

## Project Requirement
**GUI-10 Global UI Platform Account Reassignment (Manager/Admin role)**: Managers see 'Reassign Accounts' when accounts are selected; modal shows current owner, items to transfer; supports House/Dummy rep options; effective date; commission adjustments preview/confirm.

**Priority**: P0 - Launch Blocker  
**Current Status**: Not Completed - Account reassignment workflow for managers is not built.

## Architecture Analysis

### ✅ **Existing Infrastructure Available**

1. **Account Ownership System** (`schema.prisma:233-294`)
   - **Primary Ownership**: `Account.ownerId` → `User.id` 
   - **Advanced Assignments**: `AccountAssignment` table with roles:
     - `AssignmentRole`: `PrimaryOwner`, `SalesSupport`, `Finance`, `ReadOnly`
     - `isPrimary` boolean for primary assignment tracking
     - `assignedById` and `assignedAt` for audit trail

2. **Permission System** (`role-edit-modal.tsx:177-178`)
   - ✅ **`accounts.reassign`** permission already exists in Sales Management role
   - ✅ **`accounts.bulk`** permission already exists in Sales Management role
   - ✅ **Manager role hierarchy** through permission-based access control

3. **Table Selection System** (`dynamic-table.tsx`)
   - ✅ Multi-select functionality with `selectedItems: string[]`
   - ✅ Checkbox column implementation
   - ✅ Bulk operation UI patterns

4. **Revenue/Commission Tracking** (`schema.prisma`)
   - ✅ **RevenueSchedule** model with account relationships
   - ✅ **RevenueType**: `NRC_PerItem`, `NRC_FlatFee`, `MRC_PerItem`, `MRC_FlatFee`
   - ✅ **Account relationships**: Direct, distributor, and vendor connections
   - ✅ **Revenue tracking**: Projected, Invoiced, Paid, Cancelled statuses

5. **Audit System** 
   - ✅ Comprehensive audit logging infrastructure
   - ✅ Change tracking with previous/new values
   - ✅ User and timestamp tracking

### ❌ **Missing Components**

1. **Bulk Reassignment API Endpoints**
2. **Account Reassignment Modal UI**
3. **Commission Impact Calculator**
4. **"House/Dummy" Rep System** 
5. **Effective Date Processing**
6. **Manager Validation Logic**

## Frontend Implementation Plan

### **Phase 1: UI Components**

#### **Task 1.1: Bulk Action Bar Enhancement**
**Target File**: `app/(dashboard)/accounts/page.tsx`

**Implementation**:
```typescript
// Add to accounts page state
const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
const [showReassignModal, setShowReassignModal] = useState(false);

// Add bulk action bar (appears when accounts selected)
const BulkActionBar = () => (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg border p-4 z-50">
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-600">
        {selectedAccounts.length} accounts selected
      </span>
      <button
        onClick={() => setShowReassignModal(true)}
        disabled={!hasPermission('accounts.reassign')}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        Reassign Accounts
      </button>
      <button
        onClick={() => setSelectedAccounts([])}
        className="text-gray-500 hover:text-gray-700"
      >
        Clear Selection
      </button>
    </div>
  </div>
);
```

#### **Task 1.2: Account Reassignment Modal Component**
**New File**: `components/account-reassignment-modal.tsx`

```typescript
interface AccountReassignmentModalProps {
  isOpen: boolean;
  selectedAccountIds: string[];
  onClose: () => void;
  onConfirm: (reassignmentData: ReassignmentData) => Promise<void>;
}

interface ReassignmentData {
  newOwnerId: string;
  assignmentRole: AssignmentRole;
  effectiveDate: Date;
  transferCommissions: boolean;
  notifyUsers: boolean;
  reason?: string;
}

export function AccountReassignmentModal({
  isOpen,
  selectedAccountIds,
  onClose,
  onConfirm
}: AccountReassignmentModalProps) {
  const [step, setStep] = useState<'selection' | 'preview' | 'confirm'>('selection');
  const [reassignmentData, setReassignmentData] = useState<ReassignmentData>();
  const [impactPreview, setImpactPreview] = useState<CommissionImpact>();
  
  // Modal content with 3-step workflow:
  // 1. Selection: Choose new owner, role, effective date
  // 2. Preview: Show impact analysis and commission changes  
  // 3. Confirm: Final confirmation with summary
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal content based on current step */}
      </div>
    </div>
  );
}
```

#### **Task 1.3: Enhanced User Selector Component**
**New File**: `components/user-selector-with-categories.tsx`

```typescript
interface UserSelectorProps {
  value: string;
  onChange: (userId: string) => void;
  showSpecialOptions?: boolean; // House/Dummy reps
  filterByPermission?: string; // Filter users with specific permissions
}

export function UserSelectorWithCategories({
  value,
  onChange,
  showSpecialOptions = false,
  filterByPermission
}: UserSelectorProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [specialUsers, setSpecialUsers] = useState<SpecialUser[]>([]);
  
  // Categories:
  // - Active Sales Reps
  // - Managers/Admins  
  // - Support Staff
  // - House/Dummy Accounts (if enabled)
  
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select New Owner</option>
      
      <optgroup label="Sales Representatives">
        {salesReps.map(user => (
          <option key={user.id} value={user.id}>
            {user.fullName} ({user.activeAccountsCount} accounts)
          </option>
        ))}
      </optgroup>
      
      <optgroup label="Managers">
        {managers.map(user => (
          <option key={user.id} value={user.id}>
            {user.fullName} - {user.role.name}
          </option>
        ))}
      </optgroup>
      
      {showSpecialOptions && (
        <optgroup label="Special Assignments">
          <option value="house">House Account</option>
          <option value="unassigned">Unassigned</option>
        </optgroup>
      )}
    </select>
  );
}
```

### **Phase 2: Backend API Implementation**

#### **Task 2.1: Bulk Reassignment API Endpoint**
**New File**: `app/api/accounts/bulk-reassign/route.ts`

```typescript
interface BulkReassignmentRequest {
  accountIds: string[];
  newOwnerId: string;
  assignmentRole: AssignmentRole;
  effectiveDate: string; // ISO date string
  transferCommissions: boolean;
  notifyUsers: boolean;
  reason?: string;
}

export async function POST(request: Request) {
  try {
    const { user, tenantId } = await getCurrentUser();
    
    // Validate manager permissions
    await validateManagerReassignmentPermission(user, tenantId);
    
    const body: BulkReassignmentRequest = await request.json();
    
    // Validate accounts and permissions
    const accounts = await validateAccountReassignment(
      body.accountIds, 
      body.newOwnerId, 
      user, 
      tenantId
    );
    
    // Calculate commission impact
    const commissionImpact = await calculateCommissionImpact(
      body.accountIds,
      body.newOwnerId,
      body.effectiveDate,
      body.transferCommissions
    );
    
    // Execute reassignment in transaction
    const result = await prisma.$transaction(async (tx) => {
      const reassignments = [];
      
      for (const accountId of body.accountIds) {
        // Update primary ownership
        await tx.account.update({
          where: { id: accountId },
          data: { 
            ownerId: body.newOwnerId,
            updatedById: user.id,
            updatedAt: new Date()
          }
        });
        
        // Update/create assignment records
        await tx.accountAssignment.upsert({
          where: { 
            accountId_userId: { 
              accountId, 
              userId: body.newOwnerId 
            } 
          },
          create: {
            accountId,
            userId: body.newOwnerId,
            tenantId,
            assignmentRole: body.assignmentRole,
            isPrimary: body.assignmentRole === 'PrimaryOwner',
            assignedById: user.id,
            assignedAt: new Date(body.effectiveDate)
          },
          update: {
            assignmentRole: body.assignmentRole,
            isPrimary: body.assignmentRole === 'PrimaryOwner',
            assignedById: user.id,
            assignedAt: new Date(body.effectiveDate)
          }
        });
        
        // Handle commission transfers if requested
        if (body.transferCommissions) {
          await transferAccountCommissions(
            tx, 
            accountId, 
            body.newOwnerId, 
            body.effectiveDate
          );
        }
        
        // Create audit log
        await logAccountReassignment(tx, {
          accountId,
          previousOwnerId: accounts.find(a => a.id === accountId)?.ownerId,
          newOwnerId: body.newOwnerId,
          assignmentRole: body.assignmentRole,
          effectiveDate: body.effectiveDate,
          reassignedById: user.id,
          reason: body.reason,
          commissionTransfer: body.transferCommissions
        });
        
        reassignments.push({ accountId, status: 'success' });
      }
      
      return { 
        reassignments, 
        commissionImpact,
        totalAccounts: body.accountIds.length 
      };
    });
    
    // Send notifications if requested
    if (body.notifyUsers) {
      await sendReassignmentNotifications({
        accountIds: body.accountIds,
        newOwnerId: body.newOwnerId,
        previousOwners: accounts.map(a => a.ownerId).filter(Boolean),
        reassignedBy: user,
        effectiveDate: body.effectiveDate
      });
    }
    
    return Response.json(result);
    
  } catch (error) {
    if (error.code === 'INSUFFICIENT_PERMISSIONS') {
      return Response.json({ error: 'Insufficient permissions for account reassignment' }, { status: 403 });
    }
    if (error.code === 'INVALID_ASSIGNMENT') {
      return Response.json({ error: error.message }, { status: 400 });
    }
    
    console.error('Account reassignment failed:', error);
    return Response.json({ error: 'Failed to reassign accounts' }, { status: 500 });
  }
}
```

#### **Task 2.2: Commission Impact Preview API**
**New File**: `app/api/accounts/reassignment-preview/route.ts`

```typescript
export async function POST(request: Request) {
  try {
    const { user, tenantId } = await getCurrentUser();
    await validatePermission('accounts.reassign', user, tenantId);
    
    const { accountIds, newOwnerId, effectiveDate } = await request.json();
    
    // Calculate financial impact of reassignment
    const impactAnalysis = await calculateReassignmentImpact(
      accountIds,
      newOwnerId,
      effectiveDate,
      tenantId
    );
    
    return Response.json(impactAnalysis);
    
  } catch (error) {
    return Response.json({ error: 'Failed to calculate impact' }, { status: 500 });
  }
}

interface ReassignmentImpact {
  totalAccounts: number;
  accountsByOwner: { [ownerId: string]: AccountSummary[] };
  
  // Financial Impact
  revenueImpact: {
    totalAnnualRevenue: number;
    monthlyRecurring: number;
    projectedCommissions: number;
    affectedOpportunities: number;
  };
  
  // Commission Changes
  commissionTransfers: {
    fromOwner: string;
    toOwner: string;
    amount: number;
    effectiveDate: string;
  }[];
  
  // Warnings/Validation
  warnings: string[];
  conflicts: string[];
}
```

### **Phase 3: Business Logic & Validation**

#### **Task 3.1: Manager Permission Validation**
**New File**: `lib/reassignment-validation.ts`

```typescript
export async function validateManagerReassignmentPermission(
  user: User,
  tenantId: string
): Promise<void> {
  // Check if user has reassignment permission
  const hasReassignPermission = await hasPermission(user, 'accounts.reassign');
  const hasBulkPermission = await hasPermission(user, 'accounts.bulk');
  
  if (!hasReassignPermission || !hasBulkPermission) {
    throw new Error('INSUFFICIENT_PERMISSIONS');
  }
  
  // Additional manager-level validation
  const userRole = await getUserRole(user.id, tenantId);
  const managerRoles = ['Sales Management', 'Admin', 'System Admin'];
  
  if (!managerRoles.includes(userRole.name)) {
    throw new Error('MANAGER_ROLE_REQUIRED');
  }
}

export async function validateAccountReassignment(
  accountIds: string[],
  newOwnerId: string,
  requestingUser: User,
  tenantId: string
): Promise<Account[]> {
  // Validate accounts exist and user has access
  const accounts = await prisma.account.findMany({
    where: {
      id: { in: accountIds },
      tenantId
    },
    include: {
      owner: true,
      assignments: true
    }
  });
  
  if (accounts.length !== accountIds.length) {
    throw new Error('ACCOUNTS_NOT_FOUND');
  }
  
  // Check if requesting user can reassign these accounts
  for (const account of accounts) {
    const canReassign = await canUserReassignAccount(requestingUser, account);
    if (!canReassign) {
      throw new Error(`CANNOT_REASSIGN_ACCOUNT: ${account.accountName}`);
    }
  }
  
  // Validate new owner exists and can receive assignments
  const newOwner = await validateNewOwner(newOwnerId, tenantId);
  
  return accounts;
}
```

#### **Task 3.2: Commission Impact Calculator**
**New File**: `lib/commission-calculator.ts`

```typescript
export async function calculateCommissionImpact(
  accountIds: string[],
  newOwnerId: string,
  effectiveDate: string,
  transferCommissions: boolean
): Promise<CommissionImpact> {
  const effectiveDateObj = new Date(effectiveDate);
  
  // Get revenue schedules for affected accounts
  const revenueSchedules = await prisma.revenueSchedule.findMany({
    where: {
      accountId: { in: accountIds },
      scheduledDate: { gte: effectiveDateObj } // Future revenue only
    },
    include: {
      account: true,
      opportunity: true
    }
  });
  
  // Get opportunities for affected accounts
  const opportunities = await prisma.opportunity.findMany({
    where: {
      accountId: { in: accountIds },
      status: { in: ['Open', 'Won'] },
      expectedCloseDate: { gte: effectiveDateObj }
    }
  });
  
  // Calculate impact
  const totalRevenueImpact = revenueSchedules.reduce((sum, rs) => {
    return sum + (rs.projectedAmount || 0);
  }, 0);
  
  const totalCommissionImpact = opportunities.reduce((sum, opp) => {
    return sum + (opp.expectedCommission || 0);
  }, 0);
  
  // Group by current owners to show transfer details
  const currentOwnerImpact = await groupImpactByOwner(revenueSchedules, opportunities);
  
  return {
    totalAccounts: accountIds.length,
    totalRevenueImpact,
    totalCommissionImpact,
    affectedRevenueSchedules: revenueSchedules.length,
    affectedOpportunities: opportunities.length,
    transferDetails: currentOwnerImpact,
    effectiveDate: effectiveDateObj.toISOString(),
    newOwnerId
  };
}
```

#### **Task 3.3: House/Dummy Rep System**
**New File**: `lib/special-users.ts`

```typescript
// Handle special user types for reassignment
export interface SpecialUser {
  id: string;
  type: 'house' | 'unassigned' | 'dummy';
  name: string;
  description: string;
}

export async function getSpecialUsers(tenantId: string): Promise<SpecialUser[]> {
  // Check if tenant has configured special users
  const settings = await getSystemSettings(tenantId, 'reassignment.*');
  
  const specialUsers: SpecialUser[] = [];
  
  if (settings.allowHouseAccounts) {
    specialUsers.push({
      id: 'house',
      type: 'house',
      name: 'House Account',
      description: 'Assign to house for company-managed accounts'
    });
  }
  
  if (settings.allowUnassigned) {
    specialUsers.push({
      id: 'unassigned', 
      type: 'unassigned',
      name: 'Unassigned',
      description: 'Remove owner assignment'
    });
  }
  
  // Get configured dummy reps
  const dummyReps = await prisma.user.findMany({
    where: {
      tenantId,
      userType: 'DummyRep', // New enum value
      status: 'Active'
    }
  });
  
  specialUsers.push(...dummyReps.map(user => ({
    id: user.id,
    type: 'dummy' as const,
    name: user.fullName,
    description: `Dummy rep: ${user.description || 'System placeholder'}`
  })));
  
  return specialUsers;
}

export async function handleSpecialUserAssignment(
  accountId: string,
  specialUserId: string,
  assignmentRole: AssignmentRole,
  tenantId: string
): Promise<void> {
  if (specialUserId === 'house') {
    // Create house assignment record
    await createHouseAccountAssignment(accountId, assignmentRole, tenantId);
  } else if (specialUserId === 'unassigned') {
    // Remove owner assignment
    await removeAccountOwnership(accountId, tenantId);
  } else {
    // Handle dummy rep assignment normally
    await assignAccountToUser(accountId, specialUserId, assignmentRole, tenantId);
  }
}
```

### **Phase 4: Notifications & Audit Trail**

#### **Task 4.1: Notification System**
**New File**: `lib/reassignment-notifications.ts`

```typescript
export async function sendReassignmentNotifications({
  accountIds,
  newOwnerId,
  previousOwners,
  reassignedBy,
  effectiveDate
}: NotificationData): Promise<void> {
  
  // Notify new owner
  await sendNotification({
    recipientId: newOwnerId,
    type: 'ACCOUNT_ASSIGNMENT',
    title: 'New Account Assignment',
    message: `You have been assigned ${accountIds.length} new accounts effective ${formatDate(effectiveDate)}`,
    actionUrl: '/accounts?filter=assigned-to-me',
    priority: 'high'
  });
  
  // Notify previous owners
  for (const previousOwnerId of previousOwners) {
    if (previousOwnerId) {
      await sendNotification({
        recipientId: previousOwnerId,
        type: 'ACCOUNT_REASSIGNMENT',
        title: 'Account Reassignment',
        message: `Some of your accounts have been reassigned by ${reassignedBy.fullName}`,
        actionUrl: '/accounts?filter=recently-changed',
        priority: 'medium'
      });
    }
  }
  
  // Email notifications
  await sendEmailNotifications({
    accountIds,
    newOwnerId,
    previousOwners,
    reassignedBy,
    effectiveDate
  });
}
```

#### **Task 4.2: Enhanced Audit Logging**
**New File**: `lib/reassignment-audit.ts`

```typescript
export async function logAccountReassignment(
  tx: PrismaTransaction,
  data: ReassignmentAuditData
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: data.tenantId,
      userId: data.reassignedById,
      action: 'ACCOUNT_REASSIGNMENT',
      entityType: 'ACCOUNT',
      entityId: data.accountId,
      
      // Detailed change information
      changedFields: ['ownerId', 'assignmentRole'],
      previousValues: {
        ownerId: data.previousOwnerId,
        assignmentRole: data.previousRole
      },
      newValues: {
        ownerId: data.newOwnerId,
        assignmentRole: data.assignmentRole
      },
      
      // Additional metadata
      metadata: {
        effectiveDate: data.effectiveDate,
        reason: data.reason,
        commissionTransfer: data.commissionTransfer,
        bulkOperation: data.isBulkOperation,
        accountCount: data.accountCount
      },
      
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      createdAt: new Date()
    }
  });
}
```

## User Experience Flow

### **Manager Workflow**
1. **Account Selection**: Manager selects multiple accounts in accounts list
2. **Action Trigger**: "Reassign Accounts" button appears in bulk action bar
3. **Owner Selection**: Modal opens with current owner summary and new owner selector
4. **Configuration**: Set assignment role, effective date, commission transfer options
5. **Impact Preview**: Show commission/revenue impact with detailed breakdown
6. **Final Confirmation**: Review all changes before execution
7. **Execution & Feedback**: Process reassignment with progress indicator and success confirmation

### **Multi-Step Modal Flow**
```
Step 1: Selection & Configuration
├── Current Owner Summary (grouped accounts)
├── New Owner Selector (with House/Dummy options)
├── Assignment Role Selection
├── Effective Date Picker
└── Commission Transfer Toggle

Step 2: Impact Preview  
├── Revenue Impact Summary
├── Commission Transfer Details
├── Affected Opportunities List
├── Validation Warnings
└── Continue/Back buttons

Step 3: Final Confirmation
├── Complete Change Summary
├── Notification Options
├── Reason/Comments Field
└── Confirm/Cancel buttons
```

## Data Structure Extensions

### **Database Schema Changes**
```sql
-- Add user type enum for House/Dummy reps
ALTER TYPE "UserType" ADD VALUE 'DummyRep';
ALTER TYPE "UserType" ADD VALUE 'HouseAccount';

-- Add reassignment tracking
CREATE TABLE "AccountReassignmentHistory" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenantId UUID NOT NULL REFERENCES "Tenant"(id),
  accountId UUID NOT NULL REFERENCES "Account"(id),
  fromUserId UUID REFERENCES "User"(id),
  toUserId UUID REFERENCES "User"(id),
  assignmentRole "AssignmentRole" NOT NULL,
  effectiveDate TIMESTAMP NOT NULL,
  reassignedById UUID NOT NULL REFERENCES "User"(id),
  reason TEXT,
  commissionTransferred BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT now()
);
```

## Testing Strategy

### **Unit Tests**
- Permission validation logic
- Commission impact calculations
- Special user handling
- Bulk operation processing

### **Integration Tests**
- Complete reassignment workflow
- Database transaction integrity
- Notification system
- Audit logging

### **E2E Tests**
- Manager selects accounts → reassignment modal → completion
- Commission impact preview accuracy
- Permission-based access control
- Error handling and validation

## Implementation Timeline

- **Phase 1** (UI Components): 2-3 weeks
- **Phase 2** (Backend APIs): 3-4 weeks
- **Phase 3** (Business Logic): 2-3 weeks  
- **Phase 4** (Notifications & Audit): 1-2 weeks

**Total Estimate**: 8-12 weeks

## Success Criteria

- [ ] Managers with proper permissions can reassign multiple accounts
- [ ] "Reassign Accounts" action appears when accounts are selected
- [ ] Modal shows current owner summary and new owner selection
- [ ] House/Dummy rep options are available and functional
- [ ] Effective date processing works correctly
- [ ] Commission impact preview is accurate
- [ ] Final confirmation workflow is intuitive
- [ ] Audit trail captures all reassignment details
- [ ] Notifications are sent to relevant parties
- [ ] System maintains data integrity during bulk operations

## Key Technical Decisions

### **Performance**
- Use database transactions for atomic bulk operations
- Implement async notification processing
- Consider batching for very large account reassignments

### **Security**  
- Strict permission validation at multiple levels
- Audit logging for all reassignment activities
- Prevent unauthorized account access changes

### **Data Integrity**
- Maintain commission/revenue relationship consistency
- Preserve historical assignment data
- Handle edge cases (deleted users, inactive accounts)

This comprehensive plan leverages Commissable CRM's existing robust account ownership and permission infrastructure while building the missing bulk reassignment workflow specifically designed for managers and administrators.