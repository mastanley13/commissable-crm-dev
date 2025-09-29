# CON-07: Contacts > Opportunities Tab Implementation Plan

## Acceptance Criteria
- **CON-07**: Contacts > List / Create / Detail > Opportunities tab
- Read-only table of opportunities where contact has a role
- Default columns: Close Date, Opportunity Name, Stage, Order ID - House, Owner, Subagent, Vendor/Customer IDs, Location/Order IDs
- **Priority**: P1 - Must have
- **Status**: In Progress

## Current State Analysis

### Existing Infrastructure
1. **Contact Details View** (`components/contact-details-view.tsx:585-660`)
   - Already has opportunities tab implemented with basic structure
   - Currently shows: Active, Order ID - House, Opportunity Name, Stage, Owner, Estimated Close Date, Referred By
   - Uses `ContactOpportunityRow` interface (lines 23-32)

2. **Contact Detail Interface** (`components/contact-details-view.tsx:43-76`)
   - Already includes `opportunities: ContactOpportunityRow[]` field
   - Data structure supports the tab functionality

3. **Opportunities Page** (`app/(dashboard)/opportunities/page.tsx`)
   - Exists but uses mock data from `@/lib/mock-data`
   - Has comprehensive column structure that could inform contact opportunities display

## Gap Analysis

### Missing Components for CON-07
1. **Missing Columns**: Subagent, Vendor/Customer IDs, Location/Order IDs are not in current opportunities table
2. **Data Integration**: Contact opportunities tab needs real data integration (currently empty array)
3. **API Endpoint**: Need `/api/contacts/[id]/opportunities` or similar endpoint
4. **Enhanced Interface**: Need to extend `ContactOpportunityRow` to match spec requirements

## Implementation Plan

### Phase 1: Data Model Enhancement
1. **Update ContactOpportunityRow Interface**
   - Add missing fields: `subagent`, `vendorCustomerIds`, `locationOrderIds`
   - Ensure `estimatedCloseDate` maps to spec's "Close Date"
   - Review field types and nullability

2. **Database Schema Review**
   - Verify opportunity-contact relationship tables exist
   - Confirm all required fields are available in database
   - Check for contact role definitions in opportunities

### Phase 2: API Development
1. **Create Contact Opportunities Endpoint**
   - Implement `/api/contacts/[id]/opportunities` route
   - Filter opportunities where contact has a defined role
   - Return data matching updated `ContactOpportunityRow` interface
   - Include proper pagination and sorting support

2. **Update Contact Detail API**
   - Modify `/api/contacts/[id]` to populate opportunities array
   - Ensure proper relationship loading from database

### Phase 3: UI Enhancement
1. **Update Opportunities Table Columns**
   - Modify columns in `contact-details-view.tsx:589-655`
   - Add missing columns per spec: Subagent, Vendor/Customer IDs, Location/Order IDs
   - Ensure "Close Date" column uses `estimatedCloseDate` field
   - Maintain read-only nature as specified

2. **Column Configuration**
   - Set appropriate widths and sorting capabilities
   - Ensure proper data rendering for new fields
   - Handle null/empty values gracefully

### Phase 4: Data Integration
1. **Remove Mock Data Dependencies**
   - Update contact detail loading to fetch real opportunity relationships
   - Replace empty opportunities array with actual API data
   - Ensure proper error handling and loading states

2. **Performance Optimization**
   - Implement efficient querying for contact-opportunity relationships
   - Consider pagination for contacts with many opportunities
   - Add caching where appropriate

## Technical Considerations

### Database Relationships
- Need to verify `ContactOpportunity` junction table or similar
- Confirm contact role definitions (owner, subagent, etc.)
- Ensure proper foreign key relationships exist

### UI/UX Consistency
- Maintain consistency with main opportunities page styling
- Follow existing table interaction patterns
- Preserve read-only nature as specified in requirements

### Error Handling
- Handle cases where contact has no opportunities
- Proper loading states during data fetch
- Graceful degradation for missing relationship data

## Success Metrics
1. Contact opportunities tab displays real data
2. All required columns are visible and properly formatted
3. Table is read-only as specified
4. Performance meets existing page standards
5. Data accuracy matches opportunity records

## Risk Mitigation
- **Data Availability**: Verify all required fields exist in current database schema
- **Performance**: Monitor query performance for contacts with many opportunities
- **Backwards Compatibility**: Ensure changes don't break existing contact functionality

## Dependencies
- Database schema verification
- Opportunity relationship data availability
- API endpoint development
- Frontend component updates

## Estimated Timeline
- **Phase 1-2**: 2-3 days (Data model & API)
- **Phase 3-4**: 1-2 days (UI & Integration)
- **Testing & Polish**: 1 day

**Total Estimate**: 4-6 days