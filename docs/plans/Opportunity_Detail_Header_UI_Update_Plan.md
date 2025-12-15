# Opportunity Detail Header UI Update Plan

## Executive Summary
This document outlines the plan to update the Opportunity Details page top section to mirror the design, layout, and structure of the Contact and Account Details pages while preserving all existing Opportunity fields.

## Current State Analysis

### Contact Details Header Structure (Reference Design)
**Location**: [contact-details-view.tsx:2398-2511](components/contact-details-view.tsx#L2398-L2511)

#### Key Features:
1. **Collapsible Header** with chevron toggle button
2. **Minimized State** - Shows compact one-line summary when collapsed
3. **Expanded State** - Shows full two-column grid layout
4. **Container Structure**:
   - Outer: `rounded-2xl bg-gray-100 p-3 shadow-sm`
   - Header row with title and controls
   - Minimized view OR full expanded view

#### Layout Details:
```tsx
<div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
  {/* Header with title and controls */}
  <div className="flex items-center justify-between mb-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
      Contact Detail
    </p>
    <div className="flex items-center gap-2">
      {/* Update button */}
      <button className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white...">
        Update
      </button>
      {/* Collapse/Expand toggle */}
      <button onClick={toggleDetails} className="flex items-center gap-1 rounded-md bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600...">
        {detailsExpanded ? <ChevronUp /> : <ChevronDown />}
      </button>
    </div>
  </div>

  {/* Minimized state */}
  {!detailsExpanded ? (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
        <span className="font-semibold text-gray-900">{contact.firstName} {contact.lastName}</span>
        {contact.jobTitle && <span className="text-sm text-gray-600">- {contact.jobTitle}</span>}
        <span className="text-sm text-gray-600">- {contact.accountName}</span>
      </div>
    </div>
  ) : (
    /* Expanded state - two column grid */
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-1.5">
        {/* Left column fields */}
      </div>
      <div className="space-y-1.5 lg:pt-1">
        {/* Right column fields */}
      </div>
    </div>
  )}
</div>
```

### Current Opportunity Details Header Structure
**Location**: [opportunity-details-view.tsx:849-939](components/opportunity-details-view.tsx#L849-L939)

#### Current Features:
1. **NO collapse/expand functionality**
2. **Always expanded** - Shows all fields at all times
3. **Similar two-column grid layout**
4. **Container Structure**:
   - Same outer container: `rounded-2xl bg-gray-100 p-3 shadow-sm`
   - Header row with title and Update button
   - Always visible two-column grid

#### Current Layout:
```tsx
function OpportunityHeader({ opportunity, onEdit }) {
  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
          Opportunity Detail
        </p>
        {onEdit ? (
          <button onClick={onEdit} className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white...">
            <Edit className="h-4 w-4" />
            <span>Update</span>
          </button>
        ) : null}
      </div>

      {/* Always expanded - two column grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-1.5">
          {/* Left column - 7 fields */}
        </div>
        <div className="space-y-1.5">
          {/* Right column - 7 fields */}
        </div>
      </div>
    </div>
  )
}
```

---

## Identified Inconsistencies

### 1. **Missing Collapse/Expand Functionality** ⭐ PRIMARY ISSUE
- **Contact/Account**: Have collapse/expand toggle with ChevronUp/ChevronDown icons
- **Opportunity**: No collapse functionality - always shows all fields

### 2. **Missing Minimized State View**
- **Contact/Account**: Show compact one-line summary when collapsed
- **Opportunity**: No minimized view exists

### 3. **Update Button Styling Inconsistency**
- **Contact**: Simple text button without icon
  ```tsx
  <button className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white">
    Update
  </button>
  ```
- **Opportunity**: Button with Edit icon
  ```tsx
  <button className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white">
    <Edit className="h-4 w-4" />
    <span>Update</span>
  </button>
  ```

### 4. **Active/Inactive Toggle Missing**
- **Contact**: Has inline Active (Y/N) toggle switch next to Account Name field
  ```tsx
  <div className="flex items-center gap-2 max-w-md">
    <div className={cn(fieldBoxClass, "flex-1 max-w-none")}>{contact.accountName || "--"}</div>
    <div className="flex items-center gap-2 rounded-lg border-2 border-gray-400 bg-white px-2 py-0.5 text-xs font-medium text-gray-600 shadow-sm shrink-0">
      <span>Active (Y/N)</span>
      <ReadOnlySwitch value={contact.active} />
    </div>
  </div>
  ```
- **Opportunity**: No active/inactive toggle present

### 5. **Field Row Component Implementation**
- **Contact**: Uses FieldRow wrapper with label and value structure
- **Opportunity**: Uses FieldRow but slightly different implementation

### 6. **Missing State Management**
- **Contact**: Has `detailsExpanded` state and `toggleDetails` handler
- **Opportunity**: No state management for collapse/expand

---

## Field Mapping Analysis

### Current Opportunity Fields (14 total fields)

#### Left Column (7 fields):
1. Opportunity Name
2. Account Name (with link)
3. Account Legal Name
4. Subagent
5. Owner
6. Opportunity Stage
7. Estimated Close Date

#### Right Column (7 fields):
1. Referred By
2. Shipping Address
3. Billing Address
4. Subagent %
5. House Rep %
6. House Split %
7. Opportunity Description

### Proposed Minimized View Summary
When collapsed, show:
```
[Opportunity Name] - [Opportunity Stage] - [Account Name]
```

Example:
```
Algave Cloud Migration - Proposal - Algave LLC
```

---

## Implementation Plan

### Phase 1: Add State Management
**File**: [opportunity-details-view.tsx:966-972](components/opportunity-details-view.tsx#L966-L972)

Add state for collapse/expand functionality:
```tsx
export function OpportunityDetailsView({
  opportunity,
  loading,
  error,
  onEdit,
  onRefresh
}: OpportunityDetailsViewProps) {
  const { user: authUser, hasPermission, hasAnyPermission } = useAuth()
  const { showError, showSuccess } = useToasts()

  const [activeTab, setActiveTab] = useState<TabKey>("summary")

  // NEW: Add collapse/expand state
  const [detailsExpanded, setDetailsExpanded] = useState(true)

  // NEW: Add toggle handler
  const toggleDetails = useCallback(() => {
    setDetailsExpanded(prev => !prev)
  }, [])

  // ... rest of component
}
```

### Phase 2: Update OpportunityHeader Component
**File**: [opportunity-details-view.tsx:849-939](components/opportunity-details-view.tsx#L849-L939)

#### 2.1: Update Function Signature
```tsx
function OpportunityHeader({
  opportunity,
  onEdit,
  isExpanded,
  onToggleExpand
}: {
  opportunity: OpportunityDetailRecord
  onEdit?: () => void
  isExpanded: boolean
  onToggleExpand: () => void
}) {
```

#### 2.2: Update Header Controls Section
Replace lines 852-864 with:
```tsx
<div className="mb-2 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
      Opportunity Detail
    </p>
  </div>
  <div className="flex items-center gap-2">
    {onEdit && (
      <button
        onClick={onEdit}
        className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
      >
        Update
      </button>
    )}
    <button
      onClick={onToggleExpand}
      className="flex items-center gap-1 rounded-md bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-300 hover:text-gray-800 transition-colors"
      title={isExpanded ? "Minimize details" : "Expand details"}
    >
      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
    </button>
  </div>
</div>
```

#### 2.3: Add Minimized View Section
After the header controls, add conditional rendering:
```tsx
{!isExpanded ? (
  <div className="space-y-1.5">
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <span className="font-semibold text-gray-900">
        {opportunity.name || "Untitled Opportunity"}
      </span>
      {opportunity.stage && (
        <span className="text-sm text-gray-600">
          - {humanizeLabel(opportunity.stage)}
        </span>
      )}
      {opportunity.account?.accountName && (
        <span className="text-sm text-gray-600">
          - {opportunity.account.accountName}
        </span>
      )}
    </div>
  </div>
) : (
  // Existing expanded grid layout
  <div className="grid gap-6 lg:grid-cols-2">
    {/* Keep existing fields */}
  </div>
)}
```

### Phase 3: Add Active/Inactive Toggle (Optional Enhancement)
**Location**: After Account Legal Name field in left column

Add active status field:
```tsx
<FieldRow label="Active Status">
  <div className="flex items-center gap-2 max-w-md">
    <div className={cn(fieldBoxClass, "flex-1 max-w-none")}>
      {opportunity.active ? "Active" : "Inactive"}
    </div>
    <div className="flex items-center gap-2 rounded-lg border-2 border-gray-400 bg-white px-2 py-0.5 text-xs font-medium text-gray-600 shadow-sm shrink-0">
      <span>Active (Y/N)</span>
      <ReadOnlySwitch value={opportunity.active} />
    </div>
  </div>
</FieldRow>
```

**Note**: Need to add `ReadOnlySwitch` component if not already present:
```tsx
function ReadOnlySwitch({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        value ? "bg-primary-600" : "bg-gray-300"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          value ? "translate-x-5" : "translate-x-1"
        )}
      />
    </span>
  )
}
```

### Phase 4: Update Parent Component Call
**File**: Find where `OpportunityHeader` is called and update

Change from:
```tsx
<OpportunityHeader opportunity={opportunity} onEdit={onEdit} />
```

To:
```tsx
<OpportunityHeader
  opportunity={opportunity}
  onEdit={onEdit}
  isExpanded={detailsExpanded}
  onToggleExpand={toggleDetails}
/>
```

---

## Field Preservation Checklist

All 14 existing fields will be preserved in the expanded view:

### Left Column ✓
- [x] Opportunity Name
- [x] Account Name (with link)
- [x] Account Legal Name
- [x] Subagent
- [x] Owner
- [x] Opportunity Stage
- [x] Estimated Close Date
- [ ] **NEW**: Active Status (optional)

### Right Column ✓
- [x] Referred By
- [x] Shipping Address
- [x] Billing Address
- [x] Subagent %
- [x] House Rep %
- [x] House Split %
- [x] Opportunity Description

---

## Testing Plan

### Test Cases

1. **Collapse Functionality**
   - [ ] Click collapse button - header should minimize
   - [ ] Minimized view shows: Opportunity Name - Stage - Account Name
   - [ ] Chevron changes from Up to Down

2. **Expand Functionality**
   - [ ] Click expand button - header should show full details
   - [ ] All 14 fields visible in two columns
   - [ ] Chevron changes from Down to Up

3. **Update Button**
   - [ ] Update button styling matches Contact/Account pages
   - [ ] No Edit icon (matches reference design)
   - [ ] Button functionality unchanged

4. **Field Preservation**
   - [ ] All original fields present in expanded view
   - [ ] Field values display correctly
   - [ ] Links (Account Name) still functional
   - [ ] Formatting (currency, percentages, dates) unchanged

5. **Responsive Design**
   - [ ] Two-column grid on large screens
   - [ ] Single column on small screens
   - [ ] Minimized view wraps properly on mobile

6. **State Persistence**
   - [ ] Collapse state maintained during tab switches
   - [ ] State resets on page refresh (expected behavior)

---

## Risk Assessment

### Low Risk ✅
- Adding collapse/expand state management
- Adding minimized view (new code, doesn't affect existing)
- Update button styling change (cosmetic only)

### Medium Risk ⚠️
- Modifying OpportunityHeader component structure
- **Mitigation**: Thorough testing of all field displays

### High Risk ❌
- None identified - all changes are additive or cosmetic

---

## Rollback Plan

If issues arise:
1. Revert OpportunityHeader component changes
2. Remove state management additions
3. Keep existing always-expanded behavior

All changes are isolated to the header component and don't affect:
- Tab functionality
- Data loading
- API calls
- Child components (Summary, Roles, Details, Products, Activities, History)

---

## Implementation Checklist

### Pre-Implementation
- [ ] Review Contact and Account detail views
- [ ] Confirm all Opportunity fields to preserve
- [ ] Create backup branch

### Implementation
- [ ] Phase 1: Add state management
- [ ] Phase 2.1: Update OpportunityHeader signature
- [ ] Phase 2.2: Update header controls section
- [ ] Phase 2.3: Add minimized view
- [ ] Phase 3: Add active toggle (optional)
- [ ] Phase 4: Update parent component call

### Testing
- [ ] Test collapse functionality
- [ ] Test expand functionality
- [ ] Test all field displays
- [ ] Test responsive behavior
- [ ] Test with different opportunity states (active/inactive)

### Deployment
- [ ] Code review
- [ ] Integration testing
- [ ] UAT approval
- [ ] Deploy to production

---

## Notes

1. The `ReadOnlySwitch` component is already present in contact-details-view.tsx and may need to be extracted to a shared component file if not already done.

2. The `humanizeLabel` utility function is already used in the Opportunity header for formatting the stage field.

3. Consider adding a user preference to remember the collapsed/expanded state (future enhancement).

4. The minimized view format matches the pattern used in Contact and Account details pages for consistency.

---

## Questions for Clarification

1. Should the active/inactive toggle be read-only or interactive?
2. Should the collapsed/expanded state persist across page refreshes?
3. Are there any additional fields that should be shown in the minimized view?
4. Should we add animations for the collapse/expand transition?

---

## Estimated Implementation Time

- Phase 1: 15 minutes
- Phase 2: 30 minutes
- Phase 3: 20 minutes (optional)
- Phase 4: 5 minutes
- Testing: 30 minutes
- **Total: ~2 hours** (including optional enhancements and testing)

---

## References

- Contact Details View: [components/contact-details-view.tsx](components/contact-details-view.tsx)
- Account Details View: [components/account-details-view.tsx](components/account-details-view.tsx)
- Opportunity Details View: [components/opportunity-details-view.tsx](components/opportunity-details-view.tsx)
