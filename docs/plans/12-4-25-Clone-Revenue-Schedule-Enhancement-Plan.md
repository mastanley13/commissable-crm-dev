# Clone Revenue Schedule Enhancement Plan

## Current State Analysis

### Current Implementation

**Modal Component** ([revenue-schedule-clone-modal.tsx](components/revenue-schedule-clone-modal.tsx))
- Simple modal with only 2 fields:
  - Effective Date (date input)
  - Number of Months (number input, 1-60 range)
- No prepopulation of source schedule data
- No ability to edit quantity, price, or schedule name

**API Endpoint** ([route.ts:106-236](app/api/revenue-schedules/[revenueScheduleId]/clone/route.ts#L106-L236))
- Accepts: `effectiveDate` and `months`
- Creates clones by copying all fields from source schedule
- Schedule number gets "(Copy)" suffix via `buildCloneScheduleNumber()`
- Clones are created with status: `Unreconciled`
- Creates multiple schedules if months > 1 (incrementing dates)

**Usage Context** ([opportunity-details-view.tsx](components/opportunity-details-view.tsx))
- Triggered from Revenue Schedules tab bulk actions
- User selects single schedule and clicks clone
- Only passes effectiveDate and months to API
- No opportunity to edit details before cloning

### Database Schema

**RevenueSchedule Model** ([schema.prisma:589-634](prisma/schema.prisma#L589-L634))

Key fields that could be prepopulated/edited:
- `scheduleNumber` - Currently auto-generated with "(Copy)" suffix
- `scheduleDate` - Currently set from effectiveDate parameter
- `expectedUsage` - Copied from source, NOT editable currently
- `usageAdjustment` - Copied from source (0 or existing value)
- `expectedCommission` - Copied from source, NOT editable currently
- Relations provide quantity/price from `opportunityProduct`:
  - `quantity` (from opportunityProduct)
  - `unitPrice` (from opportunityProduct)

---

## Requirements Specification

### Modal Enhancements

The Clone Revenue Schedule modal should be updated to:

1. **Prepopulate Editable Fields** with source schedule data:
   - **Quantity** - From `opportunityProduct.quantity`
   - **Price Per** (Unit Price) - From `opportunityProduct.unitPrice` or `product.priceEach`
   - **Start Date** - From source `scheduleDate`
   - **Number of Months** - Default to 1 (current behavior)
   - **Revenue Schedule Name** - From source `scheduleNumber` with "(Copy)" suffix, editable
   - **Expected Usage Adjustment** (optional) - From source `usageAdjustment`, default to 0

2. **Field Behavior**:
   - All prepopulated fields should be **editable**
   - User can modify any value before confirming clone
   - Validation should ensure required fields are filled
   - Number of Months remains 1-60 range

3. **UI/UX Consistency**:
   - Follow existing modal patterns in the application
   - Match styling of [RevenueScheduleCreateModal](components/revenue-schedule-create-modal.tsx)
   - Use same input components and validation patterns
   - Maintain responsive design for all screen sizes

---

## Implementation Plan

### Phase 1: Backend API Enhancement

**File**: [app/api/revenue-schedules/[revenueScheduleId]/clone/route.ts](app/api/revenue-schedules/[revenueScheduleId]/clone/route.ts)

**Changes**:
1. Extend request body type to accept:
   ```typescript
   {
     effectiveDate: string
     months: number
     scheduleNumber?: string      // NEW: custom schedule name
     quantity?: number            // NEW: override quantity
     unitPrice?: number           // NEW: override unit price
     usageAdjustment?: number     // NEW: override adjustment
   }
   ```

2. Update clone logic to:
   - Use provided `scheduleNumber` if present, otherwise fall back to `buildCloneScheduleNumber()`
   - Use provided `quantity` to override opportunityProduct quantity (requires special handling)
   - Use provided `unitPrice` to override price
   - Use provided `usageAdjustment` to override adjustment
   - Recalculate `expectedUsage` and `expectedCommission` based on new quantity/price/adjustment

3. Add validation:
   - Validate quantity > 0 if provided
   - Validate unitPrice >= 0 if provided
   - Validate scheduleNumber not empty if provided

**Complexity**: Medium
**Risk**: Low - additive changes only, backward compatible

---

### Phase 2: Modal Component Enhancement

**File**: [components/revenue-schedule-clone-modal.tsx](components/revenue-schedule-clone-modal.tsx)

**Changes**:
1. Extend component props:
   ```typescript
   interface RevenueScheduleCloneModalProps {
     isOpen: boolean
     defaultDate?: string
     submitting?: boolean
     sourceSchedule?: {              // NEW
       scheduleNumber: string | null
       scheduleDate: string | null
       quantity: number | null
       unitPrice: number | null
       usageAdjustment: number | null
     }
     onConfirm: (params: {          // UPDATED signature
       effectiveDate: string
       months: number
       scheduleNumber?: string
       quantity?: number
       unitPrice?: number
       usageAdjustment?: number
     }) => void
     onCancel: () => void
   }
   ```

2. Add new form fields with state management:
   ```typescript
   const [scheduleNumber, setScheduleNumber] = useState("")
   const [quantity, setQuantity] = useState("")
   const [unitPrice, setUnitPrice] = useState("")
   const [usageAdjustment, setUsageAdjustment] = useState("")
   ```

3. Implement prepopulation in `useEffect`:
   - When `isOpen` becomes true, populate fields from `sourceSchedule`
   - Apply "(Copy)" suffix to schedule number
   - Format numbers appropriately

4. Add input fields to modal UI:
   - Revenue Schedule Name (text input)
   - Quantity (number input)
   - Price Per (currency input with $ formatting)
   - Usage Adjustment (currency input with $ formatting)
   - Keep existing: Start Date, Number of Months

5. Update form layout:
   - Group related fields logically
   - Consider 2-column layout for better space usage
   - Add labels with consistent styling
   - Show currency symbols for monetary fields

6. Add validation:
   - Schedule name: not empty
   - Quantity: positive number
   - Unit Price: non-negative number
   - Usage Adjustment: any number (can be negative)
   - Start Date: valid date
   - Months: 1-60 range

7. Update `onConfirm` handler:
   - Parse all field values
   - Pass full parameter object to parent

**Complexity**: High
**Risk**: Medium - changes user-facing behavior

---

### Phase 3: Parent Component Integration

**File**: [components/opportunity-details-view.tsx](components/opportunity-details-view.tsx)

**Changes**:
1. Update `handleRevenueCloneStart` (around line 2877):
   - Fetch full schedule details including quantity/price
   - Extract `opportunityProduct.quantity` and `opportunityProduct.unitPrice`
   - Extract `usageAdjustment` from schedule
   - Pass `sourceSchedule` object to modal

2. Update `handleRevenueConfirmClone` (around line 2897):
   - Accept new parameter structure
   - Include all new fields in API request body
   - Handle errors appropriately

3. Consider data fetching:
   - May need to fetch full schedule details if not already available
   - Or pass complete schedule data through existing state

**Complexity**: Medium
**Risk**: Low - mostly data plumbing

---

### Phase 4: Testing & Validation

**Test Cases**:
1. **Prepopulation**:
   - Verify all fields populate correctly from source schedule
   - Verify "(Copy)" suffix applied to schedule name
   - Verify defaults when source values are null

2. **Field Editing**:
   - Test editing each field independently
   - Test editing multiple fields together
   - Test clearing/resetting values

3. **Validation**:
   - Test empty schedule name (should block)
   - Test negative quantity (should block)
   - Test negative price (should block)
   - Test valid values (should allow)
   - Test boundary values (0, very large numbers)

4. **API Integration**:
   - Verify correct payload sent to API
   - Verify cloned schedules created with correct values
   - Verify calculations (expectedUsage, expectedCommission) correct
   - Test with multiple months (ensure all clones use same overrides)

5. **Edge Cases**:
   - Source schedule with null quantity/price
   - Source schedule already has "(Copy)" in name
   - User doesn't modify prepopulated values
   - User modifies only some fields

6. **UI/UX**:
   - Test on different screen sizes
   - Test keyboard navigation
   - Test screen reader accessibility
   - Verify consistent styling with other modals

**Complexity**: High
**Risk**: Low - comprehensive testing reduces production issues

---

## Implementation Notes

### Field Calculation Logic

When user changes quantity or unit price, we should consider:
- **Expected Usage** = Quantity × Unit Price + Usage Adjustment
- **Expected Commission** = Expected Usage × Commission Rate

However, the API currently copies `expectedCommission` directly. We may need to:
1. Recalculate in the API based on new quantity/price, OR
2. Just store the overridden quantity/price and let existing calculation logic work

**Recommendation**: Option 2 - Let API recalculate based on relationships.

### Schedule Number Uniqueness

Current implementation doesn't enforce unique schedule numbers. Adding "(Copy)" suffix might not be sufficient if cloning multiple times. Consider:
- Adding timestamp or counter: "RS-12222 (Copy 1)", "RS-12222 (Copy 2)"
- OR allow duplicate schedule numbers (current behavior)

**Recommendation**: Keep current behavior (allow duplicates), but make field editable so user can customize.

### Multiple Months Behavior

When creating multiple months (months > 1):
- All clones should use same quantity/price/adjustment overrides
- Only schedule dates should increment
- Schedule number should be same for all (or append month number?)

**Recommendation**: Keep same overrides for all months, user can edit individually after creation if needed.

### Adjustment Field Placement

"Usage Adjustment" is an advanced field. Consider:
- Making it optional/collapsible
- Adding tooltip/help text explaining purpose
- OR omitting from initial implementation

**Recommendation**: Include in Phase 2, add help text explaining it adjusts expected usage.

---

## Migration & Rollout

### Backward Compatibility
- API changes are backward compatible (new fields optional)
- Old frontend code will continue working with new API
- No database migrations required

### Feature Flag (Optional)
- Consider feature flag for gradual rollout
- Allow reverting to old modal if issues found

### User Communication
- Update help documentation
- Consider in-app tooltip or announcement
- Communicate benefits of new workflow

---

## Success Criteria

1. ✅ Modal displays all prepopulated fields correctly
2. ✅ All prepopulated fields are editable
3. ✅ Validation prevents invalid clones
4. ✅ API correctly creates clones with overridden values
5. ✅ Calculations (usage, commission) are correct
6. ✅ UI is consistent with rest of application
7. ✅ No regression in existing clone functionality
8. ✅ Performance is acceptable (no noticeable delay)

---

## Timeline Estimate

- **Phase 1** (Backend API): 2-3 hours
- **Phase 2** (Modal Component): 4-6 hours
- **Phase 3** (Integration): 2-3 hours
- **Phase 4** (Testing): 3-4 hours

**Total**: 11-16 hours (approximately 2 working days)

---

## Open Questions

1. Should we show commission rate in the modal?
   - Pro: Transparency in calculations
   - Con: Adds complexity, not directly editable

2. Should we allow editing commission directly?
   - Pro: More flexibility
   - Con: Might conflict with product commission rate

3. Should we validate against opportunity product constraints?
   - Example: Don't allow quantity > remaining quantity on opportunity
   - Requires additional context/validation

4. Should multi-month clones have unique schedule numbers?
   - Current: All get same number
   - Alternative: Append suffix like "RS-12222 (Copy) - Month 1"

**Recommendation**: Start with simplest approach, gather user feedback, iterate.

---

## Related Issues

From the selected text, we noted:
> "Incomplete Finalization: The finalize endpoint doesn't update Revenue Schedule statuses or close reconciled schedules"

This is a **separate issue** that should be addressed independently. However, ensure cloned schedules:
- Are created with `status: Unreconciled` (current behavior)
- Are eligible for future finalization
- Don't interfere with reconciliation workflows

---

## References

- [Current Clone API Route](app/api/revenue-schedules/[revenueScheduleId]/clone/route.ts)
- [Current Clone Modal](components/revenue-schedule-clone-modal.tsx)
- [Revenue Schedule Schema](prisma/schema.prisma#L589)
- [Opportunity Details View](components/opportunity-details-view.tsx)
- [API Helpers](app/api/revenue-schedules/helpers.ts)
