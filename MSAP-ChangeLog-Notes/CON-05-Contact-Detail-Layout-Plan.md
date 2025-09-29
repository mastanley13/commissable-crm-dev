# CON-05: Contact Detail Layout & Tabs Implementation Plan

## Acceptance Criteria
- **CON-05**: Contacts > List / Create / Detail > Detail layout & tabs
- Detail shows: Name, Contact Type (read-only), Active toggle, Account, Email, Job Title, Contact ID, phones, Description
- Tabs: Activities & Notes (default), Opportunities, Groups
- **Priority**: P1 - Must have
- **Status**: Not Completed

## Current State Analysis

### Existing Infrastructure ✅ (Mostly Complete)
1. **Contact Detail Layout** (`components/contact-details-view.tsx:330-480`)
   - **Name**: ✅ Fully implemented with Prefix, First, Middle, Last, Suffix (lines 335-361)
   - **Contact Type**: ✅ Read-only field implemented (lines 402-405)
   - **Active toggle**: ✅ Read-only switch implemented (lines 374-382)
   - **Account**: ✅ Account Name displayed (lines 362-365)
   - **Email**: ✅ Email Address field implemented (lines 406-409)
   - **Job Title**: ✅ Job Title field implemented (lines 366-369)
   - **Phones**: ✅ Work Phone, Mobile, Other Phone, Fax implemented (lines 414-434)
   - **Description**: ✅ Description field implemented (lines 437-442)

2. **Tab Structure** (`components/contact-details-view.tsx:88-92, 481-497`)
   - **Activities & Notes**: ✅ Implemented and set as default (line 168)
   - **Opportunities**: ✅ Implemented 
   - **Groups**: ✅ Implemented
   - **Tab Navigation**: ✅ Working tab switching functionality

3. **Tab Content Implementation**
   - **Activities Tab**: ✅ Fully functional with proper table (lines 499-583)
   - **Opportunities Tab**: ✅ Fully functional with proper table (lines 585-660)  
   - **Groups Tab**: ✅ Fully functional with proper table (lines 662-718)

## Gap Analysis

### Missing Components for CON-05
1. **Contact ID Field**: ❌ Not displayed in the detail layout
2. **Active Toggle Functionality**: ⚠️ Currently read-only, may need to be editable based on "toggle" description
3. **Notes Section**: ⚠️ Notes field exists (lines 443-448) but may need enhancement for "Activities & Notes" tab integration

### Minor Enhancement Opportunities
1. **Field Organization**: Current layout may not match exact spec order
2. **Contact ID Display**: Need to add Contact ID to the detail view
3. **Toggle Functionality**: Clarify if Active should be editable or read-only

## Implementation Plan

### Phase 1: Contact ID Integration
1. **Add Contact ID Field**
   - Insert Contact ID field in appropriate position within detail layout
   - Use existing `contact.id` from ContactDetail interface
   - Style consistently with other read-only fields
   - Position according to spec requirements

### Phase 2: Active Toggle Enhancement (If Required)
1. **Assess Toggle Requirements**
   - Determine if "Active toggle" means editable or read-only
   - If editable, implement toggle functionality with API integration
   - Add proper state management and optimistic updates
   - Include error handling for toggle failures

### Phase 3: Layout Optimization
1. **Field Reordering** (If needed)
   - Ensure field order matches CON-05 specification exactly
   - Verify: Name, Contact Type, Active toggle, Account, Email, Job Title, Contact ID, phones, Description
   - Maintain responsive design and visual consistency

### Phase 4: Notes Integration Enhancement
1. **Activities & Notes Tab Polish**
   - Ensure Notes field integration with Activities tab is optimal
   - Consider if separate notes functionality is needed beyond current description/notes fields
   - Verify tab content meets specification requirements

## Technical Implementation Details

### Contact ID Addition
```typescript
// Add to contact detail layout around line 370-380
<FieldRow
  label="Contact ID"
  value={<div className={fieldBoxClass}>{contact.id}</div>}
/>
```

### Active Toggle Enhancement (If Editable)
```typescript
// Replace ReadOnlySwitch with interactive toggle if needed
const handleActiveToggle = async (newActive: boolean) => {
  // API call to update contact active status
  // Optimistic update with rollback on error
}
```

## Current Status Assessment

### ✅ Fully Implemented
- Name display (all components)
- Contact Type (read-only)
- Account display
- Email display
- Job Title display
- Phone fields (multiple types)
- Description field
- Tab structure and navigation
- All three tabs with functional tables

### ⚠️ Needs Minor Enhancement
- Contact ID display (missing)
- Active toggle functionality (clarification needed)

### ❌ Implementation Required
- Contact ID field addition

## Success Metrics
1. ✅ All required fields visible in detail layout
2. ⚠️ Contact ID field displayed
3. ✅ Three tabs functional: Activities & Notes (default), Opportunities, Groups
4. ⚠️ Active toggle functionality working as specified
5. ✅ Responsive layout maintained
6. ✅ Consistent styling with existing design system

## Risk Assessment: **LOW** 

### Why Low Risk:
- 95% of functionality already implemented
- Only minor additions required
- No major architectural changes needed
- Existing tab system is fully functional

### Potential Risks:
- **Active Toggle Interpretation**: Need to clarify if toggle should be editable
- **Field Positioning**: May need minor layout adjustments for Contact ID placement

## Dependencies
- Clarification on Active toggle functionality requirements
- Confirmation of exact field ordering requirements
- No external API changes required (Contact ID already available)

## Estimated Timeline
- **Phase 1**: 0.5 days (Contact ID addition)
- **Phase 2**: 0.5-1 day (Active toggle enhancement, if needed)
- **Phase 3**: 0.5 days (Layout optimization)
- **Phase 4**: 0.25 days (Notes integration review)

**Total Estimate**: 1.75-2.25 days

## Priority Assessment
This is essentially a **completion task** rather than new development. The contact detail system is already 95% complete and fully functional. Only minor enhancements are needed to meet the exact CON-05 specification requirements.