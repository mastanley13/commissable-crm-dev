# SEC-02: Security & Permissions - RBAC / Audit Trail Coverage Implementation Plan

## Acceptance Criteria
- **SEC-02**: Security & Permissions - RBAC / Audit trail coverage
- All reassignments & deletions logged with timestamp, actor, before/after states, reason
- Audit entries immutable and never deleted
- **Current Status**: Audit logging covers accounts/contacts only; full trail coverage and UI are missing
- **Priority**: Security & Compliance Critical

## Current State Analysis

### ✅ **Robust Infrastructure Already Built**

#### 1. **Comprehensive RBAC System** (`docs/RBAC_ADMIN_GUIDE.md`)
- **4-Tier Role Structure**: Admin, Sales Management, Salesperson, Accounting
- **Granular Permissions**: 25+ permissions across 5 categories
- **Permission Gates**: Frontend (`permission-gate.tsx`) and API protection
- **Advanced Features**: Role-based UI rendering, hierarchical permissions

#### 2. **Advanced Audit Logging Infrastructure** (`lib/audit.ts`)
- **Centralized Logging**: `logAudit()` function with comprehensive metadata
- **Detailed Change Tracking**: Before/after values with `getChangedFields()` helper
- **Immutable Design**: Audit entries are append-only, never deleted
- **Rich Context**: IP address, user agent, request ID, tenant isolation
- **Specialized Loggers**: Account, Contact, Activity, User audit functions

#### 3. **Current Audit Coverage Analysis**
**✅ Accounts** (`api/accounts/[accountId]/route.ts:384-397`):
- CREATE, UPDATE, DELETE operations logged
- Soft/hard deletion with constraint bypass tracking
- Restoration operations logged
- Owner reassignment tracking

**✅ Contacts** (`api/contacts/[id]/route.ts:489-508`):
- CREATE, UPDATE, DELETE operations logged
- Two-stage deletion with constraint handling
- Restoration operations logged
- Full contact lifecycle tracking

**✅ User Management**:
- User creation, updates, role assignments
- Permission changes tracked
- Administrative actions logged

### ⚠️ **Current Gaps for SEC-02 Compliance**

#### 1. **Missing Entity Coverage**
- **Activities**: Limited audit coverage
- **Opportunities**: No audit logging
- **Groups**: No audit logging
- **Revenue Schedules**: No audit logging
- **System Settings**: No audit logging

#### 2. **Reassignment Tracking Gaps**
- **Account Reassignments**: No specialized logging (GUI-10 plan exists but not implemented)
- **Bulk Operations**: No batch audit logging
- **Ownership Transfers**: Limited metadata

#### 3. **Missing UI/Reporting**
- **Audit Trail Viewer**: No UI to view audit history
- **Search/Filter**: No audit log search capabilities
- **Compliance Reports**: No audit reporting interface
- **Export Features**: No audit data export functionality

## Implementation Plan

### Phase 1: Complete Entity Audit Coverage

#### **Task 1.1: Activities Audit Enhancement**
**Target File**: `app/api/activities/[activityId]/route.ts`

```typescript
// Enhance existing activity operations
export async function PATCH(request: NextRequest, { params }: { params: { activityId: string } }) {
  return withPermissions(request, ['activities.manage'], async (req) => {
    const existingActivity = await prisma.activity.findFirst({
      where: { id: params.activityId, tenantId: req.user.tenantId }
    })
    
    const updatedActivity = await prisma.activity.update({
      where: { id: params.activityId },
      data: updateData
    })
    
    // Enhanced audit logging
    await logActivityAudit(
      AuditAction.Update,
      params.activityId,
      req.user.id,
      req.user.tenantId,
      request,
      {
        subject: existingActivity.subject,
        status: existingActivity.status,
        activityType: existingActivity.activityType,
        contactId: existingActivity.contactId,
        accountId: existingActivity.accountId
      },
      {
        subject: updatedActivity.subject,
        status: updatedActivity.status,
        activityType: updatedActivity.activityType,
        contactId: updatedActivity.contactId,
        accountId: updatedActivity.accountId
      }
    )
  })
}

export async function DELETE(request: NextRequest, { params }: { params: { activityId: string } }) {
  return withPermissions(request, ['activities.delete'], async (req) => {
    // Implement soft/hard deletion with audit logging
    const result = await softDeleteEntity('Activity', params.activityId, req.user.tenantId, req.user.id)
    
    await logActivityAudit(
      AuditAction.Delete,
      params.activityId,
      req.user.id,
      req.user.tenantId,
      request,
      existingActivity,
      { deletedAt: new Date() }
    )
  })
}
```

#### **Task 1.2: Opportunities Audit Implementation**
**New Enhancement**: `app/api/opportunities/route.ts` & `app/api/opportunities/[id]/route.ts`

```typescript
// lib/audit.ts - Add opportunity audit function
export async function logOpportunityAudit(
  action: AuditAction,
  opportunityId: string,
  userId: string,
  tenantId: string,
  request: Request,
  previousValues?: Record<string, any>,
  newValues?: Record<string, any>
): Promise<void> {
  const changedFields = previousValues && newValues 
    ? getChangedFields(previousValues, newValues)
    : undefined

  await logAudit({
    userId,
    tenantId,
    action,
    entityName: 'Opportunity',
    entityId: opportunityId,
    changedFields,
    previousValues,
    newValues,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request)
  })
}

// Add to all opportunity CRUD operations
await logOpportunityAudit(
  AuditAction.Update,
  opportunityId,
  userId,
  tenantId,
  request,
  previousOpportunity,
  updatedOpportunity
)
```

#### **Task 1.3: System Settings Audit**
**Target File**: `app/api/system-settings/route.ts`

```typescript
export async function POST(request: NextRequest) {
  return withPermissions(request, ['system.settings.write'], async (req) => {
    const existingSettings = await getSystemSettings(req.user.tenantId)
    
    // Update settings
    const updatedSettings = await updateSystemSettings(req.user.tenantId, updates)
    
    // Audit system settings changes
    await logAudit({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      action: AuditAction.Update,
      entityName: 'SystemSettings',
      entityId: req.user.tenantId, // Use tenant ID as entity ID
      changedFields: getChangedFields(existingSettings, updatedSettings),
      previousValues: existingSettings,
      newValues: updatedSettings,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: { settingsCategory: 'system_preferences' }
    })
  })
}
```

### Phase 2: Enhanced Reassignment Audit Logging

#### **Task 2.1: Bulk Reassignment Audit**
**New File**: `lib/bulk-audit.ts`

```typescript
export interface BulkOperationAudit {
  operationType: 'BULK_REASSIGNMENT' | 'BULK_DELETE' | 'BULK_UPDATE'
  entityType: string
  entityIds: string[]
  totalCount: number
  successCount: number
  failureCount: number
  batchId: string
  reason?: string
  effectiveDate?: string
}

export async function logBulkOperation(
  operation: BulkOperationAudit,
  userId: string,
  tenantId: string,
  request: Request
): Promise<void> {
  const batchId = operation.batchId || generateBatchId()
  
  // Log master batch operation
  await logAudit({
    userId,
    tenantId,
    action: AuditAction.BulkOperation,
    entityName: operation.entityType,
    entityId: batchId,
    metadata: {
      operationType: operation.operationType,
      totalCount: operation.totalCount,
      successCount: operation.successCount,
      failureCount: operation.failureCount,
      entityIds: operation.entityIds,
      reason: operation.reason,
      effectiveDate: operation.effectiveDate,
      batchSize: operation.entityIds.length
    },
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request)
  })
  
  // Log individual entity changes
  for (const entityId of operation.entityIds) {
    await logAudit({
      userId,
      tenantId,
      action: AuditAction.Update,
      entityName: operation.entityType,
      entityId,
      metadata: {
        bulkOperation: true,
        batchId,
        operationType: operation.operationType
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request)
    })
  }
}

// Enhanced account reassignment audit
export async function logAccountReassignment(
  accountId: string,
  fromOwnerId: string | null,
  toOwnerId: string,
  assignmentRole: string,
  effectiveDate: string,
  reason: string | undefined,
  userId: string,
  tenantId: string,
  request: Request,
  isBulkOperation: boolean = false,
  batchId?: string
): Promise<void> {
  await logAudit({
    userId,
    tenantId,
    action: AuditAction.Reassign,
    entityName: 'Account',
    entityId: accountId,
    changedFields: {
      ownerId: { from: fromOwnerId, to: toOwnerId },
      assignmentRole: { to: assignmentRole }
    },
    previousValues: { ownerId: fromOwnerId },
    newValues: { ownerId: toOwnerId, assignmentRole },
    metadata: {
      reassignmentType: 'ownership_transfer',
      effectiveDate,
      reason,
      isBulkOperation,
      batchId
    },
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request)
  })
}
```

#### **Task 2.2: Deletion Constraint Audit**
**Enhancement**: `lib/deletion.ts`

```typescript
export async function logDeletionAttempt(
  entityType: string,
  entityId: string,
  stage: 'soft' | 'permanent' | 'check',
  constraints: DeletionConstraint[],
  bypassConstraints: boolean,
  userId: string,
  tenantId: string,
  request: Request
): Promise<void> {
  await logAudit({
    userId,
    tenantId,
    action: AuditAction.Delete,
    entityName: entityType,
    entityId,
    metadata: {
      deletionStage: stage,
      constraintsFound: constraints.length,
      constraintTypes: constraints.map(c => c.type),
      bypassConstraints,
      constraints: constraints.map(c => ({
        entity: c.entity,
        count: c.count,
        message: c.message
      }))
    },
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request)
  })
}
```

### Phase 3: Audit Trail UI & Reporting

#### **Task 3.1: Audit Log Viewer Component**
**New File**: `components/audit-log-viewer.tsx`

```typescript
interface AuditLogEntry {
  id: string
  timestamp: Date
  userId: string
  userName: string
  action: string
  entityType: string
  entityId: string
  entityName?: string
  changedFields?: Record<string, any>
  previousValues?: Record<string, any>
  newValues?: Record<string, any>
  ipAddress?: string
  metadata?: Record<string, any>
}

export function AuditLogViewer({ 
  entityType, 
  entityId, 
  dateRange 
}: AuditLogViewerProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [filters, setFilters] = useState<AuditFilters>({})
  
  return (
    <div className="audit-log-viewer">
      <div className="audit-filters">
        <AuditLogFilters 
          onFiltersChange={setFilters}
          entityTypes={['Account', 'Contact', 'Activity', 'Opportunity']}
          actions={['Create', 'Update', 'Delete', 'Reassign']}
          dateRange={dateRange}
        />
      </div>
      
      <div className="audit-timeline">
        {auditLogs.map(entry => (
          <AuditLogEntry 
            key={entry.id}
            entry={entry}
            showDetails={expandedEntries.includes(entry.id)}
            onToggleDetails={toggleDetails}
          />
        ))}
      </div>
      
      <AuditLogPagination 
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  )
}

function AuditLogEntry({ entry, showDetails, onToggleDetails }: AuditLogEntryProps) {
  return (
    <div className="audit-entry">
      <div className="audit-summary">
        <div className="audit-action">
          <AuditActionIcon action={entry.action} />
          <span className="action-text">{entry.action}</span>
        </div>
        <div className="audit-details">
          <span className="entity-info">
            {entry.entityType} - {entry.entityName || entry.entityId.slice(0, 8)}
          </span>
          <span className="timestamp">
            {formatDateTime(entry.timestamp)}
          </span>
          <span className="user-info">
            by {entry.userName}
          </span>
        </div>
        <button 
          onClick={() => onToggleDetails(entry.id)}
          className="details-toggle"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>
      
      {showDetails && (
        <div className="audit-details-expanded">
          <AuditFieldChanges 
            changedFields={entry.changedFields}
            previousValues={entry.previousValues}
            newValues={entry.newValues}
          />
          <AuditMetadata 
            metadata={entry.metadata}
            ipAddress={entry.ipAddress}
            timestamp={entry.timestamp}
          />
        </div>
      )}
    </div>
  )
}
```

#### **Task 3.2: Audit API Endpoints**
**New File**: `app/api/audit/route.ts`

```typescript
export async function GET(request: NextRequest) {
  return withPermissions(request, ['audit.read', 'admin.audit.read'], async (req) => {
    const { searchParams } = new URL(request.url)
    
    const filters = {
      entityType: searchParams.get('entityType'),
      entityId: searchParams.get('entityId'),
      action: searchParams.get('action'),
      userId: searchParams.get('userId'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '50')
    }
    
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: req.user.tenantId,
        ...(filters.entityType && { entityName: filters.entityType }),
        ...(filters.entityId && { entityId: filters.entityId }),
        ...(filters.action && { action: filters.action }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.dateFrom && { 
          createdAt: { gte: new Date(filters.dateFrom) } 
        }),
        ...(filters.dateTo && { 
          createdAt: { lte: new Date(filters.dateTo) } 
        })
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, emailAddress: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize
    })
    
    const total = await prisma.auditLog.count({
      where: {
        tenantId: req.user.tenantId,
        // ... same filters
      }
    })
    
    const formattedLogs = auditLogs.map(log => ({
      id: log.id,
      timestamp: log.createdAt,
      userId: log.userId,
      userName: `${log.user.firstName} ${log.user.lastName}`.trim(),
      action: log.action,
      entityType: log.entityName,
      entityId: log.entityId,
      changedFields: log.changedFields ? JSON.parse(log.changedFields) : null,
      previousValues: log.previousValues ? JSON.parse(log.previousValues) : null,
      newValues: log.newValues ? JSON.parse(log.newValues) : null,
      ipAddress: log.ipAddress,
      metadata: log.metadata ? JSON.parse(log.metadata) : null
    }))
    
    return NextResponse.json({
      data: formattedLogs,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize)
      }
    })
  })
}
```

#### **Task 3.3: Audit Dashboard Page**
**New File**: `app/(dashboard)/admin/audit/page.tsx`

```typescript
export default function AuditLogPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date()
  })
  const [selectedEntity, setSelectedEntity] = useState<string>('')
  const [selectedAction, setSelectedAction] = useState<string>('')
  
  return (
    <div className="audit-dashboard">
      <div className="page-header">
        <h1 className="page-title">Audit Trail</h1>
        <div className="page-actions">
          <AuditExportButton 
            dateRange={dateRange}
            entityType={selectedEntity}
            action={selectedAction}
          />
        </div>
      </div>
      
      <div className="audit-controls">
        <AuditSummaryCards dateRange={dateRange} />
        <AuditQuickFilters 
          onEntityChange={setSelectedEntity}
          onActionChange={setSelectedAction}
          onDateRangeChange={setDateRange}
        />
      </div>
      
      <div className="audit-content">
        <AuditLogViewer 
          dateRange={dateRange}
          entityType={selectedEntity}
          action={selectedAction}
        />
      </div>
    </div>
  )
}

function AuditSummaryCards({ dateRange }: { dateRange: DateRange }) {
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  
  return (
    <div className="audit-summary-grid">
      <div className="summary-card">
        <h3>Total Activities</h3>
        <div className="metric-value">{summary?.totalActivities || 0}</div>
      </div>
      <div className="summary-card">
        <h3>Account Changes</h3>
        <div className="metric-value">{summary?.accountChanges || 0}</div>
      </div>
      <div className="summary-card">
        <h3>Reassignments</h3>
        <div className="metric-value">{summary?.reassignments || 0}</div>
      </div>
      <div className="summary-card">
        <h3>Deletions</h3>
        <div className="metric-value">{summary?.deletions || 0}</div>
      </div>
    </div>
  )
}
```

### Phase 4: Compliance & Security Enhancements

#### **Task 4.1: Audit Log Retention & Archival**
**New File**: `lib/audit-retention.ts`

```typescript
export interface RetentionPolicy {
  retentionPeriodDays: number
  archiveAfterDays: number
  compressionEnabled: boolean
  encryptionEnabled: boolean
}

export async function applyRetentionPolicy(
  tenantId: string,
  policy: RetentionPolicy
): Promise<void> {
  const cutoffDate = subDays(new Date(), policy.retentionPeriodDays)
  const archiveDate = subDays(new Date(), policy.archiveAfterDays)
  
  // Archive old logs
  if (policy.archiveAfterDays > 0) {
    await archiveAuditLogs(tenantId, archiveDate, policy)
  }
  
  // Never actually delete audit logs - mark as archived instead
  await prisma.auditLog.updateMany({
    where: {
      tenantId,
      createdAt: { lt: cutoffDate },
      archived: false
    },
    data: {
      archived: true,
      archivedAt: new Date()
    }
  })
}

async function archiveAuditLogs(
  tenantId: string,
  archiveDate: Date,
  policy: RetentionPolicy
): Promise<void> {
  // Archive to cloud storage or separate database
  // Maintain immutability - logs are never deleted, only archived
  const logsToArchive = await prisma.auditLog.findMany({
    where: {
      tenantId,
      createdAt: { lt: archiveDate },
      archived: false
    }
  })
  
  for (const log of logsToArchive) {
    await storeArchivedLog(log, policy)
  }
}
```

#### **Task 4.2: Audit Integrity Validation**
**New File**: `lib/audit-integrity.ts`

```typescript
export async function validateAuditIntegrity(
  tenantId: string,
  dateRange?: DateRange
): Promise<AuditIntegrityReport> {
  const issues: IntegrityIssue[] = []
  
  // Check for missing audit entries
  const criticalActions = await findCriticalActionsWithoutAudit(tenantId, dateRange)
  if (criticalActions.length > 0) {
    issues.push({
      type: 'MISSING_AUDIT',
      severity: 'HIGH',
      count: criticalActions.length,
      description: 'Critical actions found without corresponding audit entries'
    })
  }
  
  // Check for audit entry tampering
  const tamperedEntries = await detectTamperedAuditEntries(tenantId, dateRange)
  if (tamperedEntries.length > 0) {
    issues.push({
      type: 'POTENTIAL_TAMPERING',
      severity: 'CRITICAL',
      count: tamperedEntries.length,
      description: 'Audit entries with potential integrity issues'
    })
  }
  
  // Validate audit chain consistency
  const chainIssues = await validateAuditChain(tenantId, dateRange)
  issues.push(...chainIssues)
  
  return {
    tenantId,
    validationDate: new Date(),
    dateRange,
    totalAuditEntries: await countAuditEntries(tenantId, dateRange),
    issues,
    overallStatus: issues.some(i => i.severity === 'CRITICAL') ? 'CRITICAL' :
                   issues.some(i => i.severity === 'HIGH') ? 'WARNING' : 'HEALTHY'
  }
}
```

## Security & Compliance Considerations

### **Immutability Enforcement**
- Database constraints prevent audit log modifications
- Append-only audit log design
- Soft archival instead of deletion
- Cryptographic checksums for integrity validation

### **Access Controls**
- Audit viewing requires specific permissions
- Tenant isolation enforced at database level
- Role-based audit access (Admin/Manager only)
- API rate limiting on audit endpoints

### **Data Privacy**
- PII masking in audit logs where required
- Configurable field inclusion/exclusion
- GDPR compliance considerations
- Audit log encryption at rest

## Success Metrics

### **Coverage Metrics**
- [x] Account operations: 100% covered
- [x] Contact operations: 100% covered  
- [ ] Activity operations: 60% covered → Target: 100%
- [ ] Opportunity operations: 0% covered → Target: 100%
- [ ] System settings: 0% covered → Target: 100%
- [ ] Bulk operations: 0% covered → Target: 100%

### **Compliance Metrics**
- [ ] All reassignments logged with reason
- [ ] All deletions logged with constraints
- [ ] Audit UI accessible to authorized users
- [ ] Audit logs exportable for compliance
- [ ] Retention policies configurable and enforced

## Implementation Timeline

- **Phase 1** (Entity Coverage): 3-4 weeks
- **Phase 2** (Reassignment Audit): 2-3 weeks  
- **Phase 3** (UI & Reporting): 4-5 weeks
- **Phase 4** (Compliance): 2-3 weeks

**Total Estimate**: 11-15 weeks

## Risk Assessment: **LOW-MEDIUM**

### **Low Risk Factors**:
- Robust audit infrastructure already exists
- Existing patterns can be extended
- Database schema supports comprehensive logging
- Permission system is mature

### **Medium Risk Areas**:
- UI development complexity for audit viewer
- Performance impact of comprehensive logging
- Storage growth from increased audit volume
- Compliance requirement interpretation

This plan builds upon Commissable CRM's already excellent audit foundation to achieve complete SEC-02 compliance while maintaining system performance and security.