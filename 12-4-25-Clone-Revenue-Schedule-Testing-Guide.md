# Clone Revenue Schedule - User Testing Guide

**Date:** December 4, 2025
**Feature:** Enhanced Clone Revenue Schedule with Editable Fields
**Tester Instructions:** Follow each test case step-by-step and verify expected results

---

## Pre-Testing Setup

### Prerequisites
- ✅ Application is running locally or on test environment
- ✅ You have a user account with `revenue-schedules.manage` permission
- ✅ Test data exists: At least one Opportunity with Revenue Schedules

### Test Data Preparation
1. Navigate to an Opportunity that has at least one Revenue Schedule
2. Note the details of a schedule you'll clone:
   - Schedule Number
   - Quantity
   - Unit Price
   - Usage Adjustment
   - Expected Usage
   - Expected Commission

---

## Test Case 1: Basic Clone with Prepopulated Fields ✅

**Objective:** Verify that all fields prepopulate correctly from source schedule

### Steps:
1. Navigate to **Opportunities** page
2. Click on any opportunity with revenue schedules
3. Go to the **Revenue Schedules** tab
4. Select **one** revenue schedule (checkbox on left)
5. Click the **Clone** button in the bulk actions toolbar

### Expected Results:
✅ **Modal Opens:** "Clone Revenue Schedule" modal appears
✅ **Modal Title:** Shows "Clone Revenue Schedule"
✅ **Description:** Shows "Confirm the clone action and edit schedule details before creating."
✅ **Revenue Schedule Name:** Shows original name with " (Copy)" appended
   - Example: "RS-12345" becomes "RS-12345 (Copy)"
✅ **Quantity:** Prepopulated with source schedule's quantity
✅ **Price Per Unit:** Prepopulated with source schedule's unit price (shows $ symbol)
✅ **Usage Adjustment:** Prepopulated with source schedule's adjustment (or 0)
✅ **Start Date:** Prepopulated with next month's date
✅ **Number of Months:** Shows "1"

### Screenshot Points:
- [x] Modal shows all 6 fields prepopulated
- [x] Currency fields show $ symbol
- [x] "(Copy)" suffix added to schedule name

---

## Test Case 2: Field Editing ✅

**Objective:** Verify that all fields can be edited before cloning

### Steps:
1. With the clone modal open (from Test Case 1)
2. Edit **Revenue Schedule Name**: Change to "Custom Clone Name"
3. Edit **Quantity**: Change to a different number (e.g., 100)
4. Edit **Price Per Unit**: Change to a different amount (e.g., 999.99)
5. Edit **Usage Adjustment**: Change to a different value (e.g., -50.00)
6. Edit **Start Date**: Pick a different date
7. Edit **Number of Months**: Change to 3

### Expected Results:
✅ **All fields are editable** - No fields are read-only
✅ **Changes are saved** - Values update as you type
✅ **No validation errors** - All valid values accepted
✅ **Dollar signs stay in place** - Currency fields keep $ prefix
✅ **Modal remains open** - Doesn't close when editing

### Verification:
- [X] Schedule name changed successfully
- [X] Quantity changed successfully
- [X] Price changed successfully
- [X] Adjustment changed successfully (including negative values)
- [X] Date changed successfully
- [X] Months changed successfully

---

## Test Case 3: Validation - Required Fields ✅

**Objective:** Verify validation prevents invalid submissions

### Test 3A: Empty Schedule Name
1. Open clone modal
2. **Clear** the Revenue Schedule Name field (delete all text)
3. Try to click **Clone Schedule** button

**Expected Results:**
✅ **Button is disabled** - Cannot click
✅ **Error message appears** - "Schedule name is required" in red text
✅ **Field has red border** - Visual indicator of error
✅ **Modal stays open** - Doesn't submit

### Test 3B: Invalid Quantity
1. Open clone modal
2. Change **Quantity** to `0`
3. Try to click **Clone Schedule** button

**Expected Results:**
✅ **Button is disabled**
✅ **Error message appears** - "Quantity must be greater than 0" in red text
✅ **Field has red border**

### Test 3C: Negative Price
1. Open clone modal
2. Change **Price Per Unit** to `-100`
3. Try to click **Clone Schedule** button

**Expected Results:**
✅ **Button is disabled**
✅ **Error message appears** - "Price cannot be negative" in red text
✅ **Field has red border**

### Test 3D: Negative Adjustment (Should Work!)
1. Open clone modal
2. Change **Usage Adjustment** to `-50.00`
3. Click **Clone Schedule** button

**Expected Results:**
✅ **Button is enabled** - Negative adjustments are ALLOWED
✅ **No error message**
✅ **Clone proceeds successfully**

### Test 3E: Invalid Months
1. Open clone modal
2. Change **Number of Months** to `100` (exceeds max of 60)
3. Try to click **Clone Schedule** button

**Expected Results:**
✅ **Button is disabled**
✅ **Error message appears** - "Must be between 1 and 60" in red text
✅ **Field has red border**

---

## Test Case 4: Successful Single Clone ✅

**Objective:** Verify successful clone creation with custom values

### Steps:
1. Open clone modal
2. Set the following values:
   - **Revenue Schedule Name:** "Test Clone Single"
   - **Quantity:** 50
   - **Price Per Unit:** 100.00
   - **Usage Adjustment:** 0
   - **Start Date:** Next month (accept default)
   - **Number of Months:** 1
3. Click **Clone Schedule** button

### Expected Results:
✅ **Button shows "Cloning…"** - Loading state appears
✅ **Modal closes** - After successful creation
✅ **Success toast appears** - "Schedule cloned - Opening the cloned schedule so you can review it."
✅ **Navigation occurs** - Redirected to the cloned schedule detail page
✅ **New schedule visible** - Shows in the revenue schedules list

### Verification - Check the Cloned Schedule:
Navigate to the newly created schedule and verify:
- [ ] **Schedule Number:** "Test Clone Single"
- [ ] **Quantity:** 50
- [ ] **Unit Price:** $100.00
- [ ] **Expected Usage:** $5,000.00 (50 × 100)
- [ ] **Usage Adjustment:** $0.00
- [ ] **Expected Commission:** Calculated correctly (usage × commission rate)
- [ ] **Schedule Date:** Matches the start date you selected
- [ ] **Status:** "Unreconciled"

---

## Test Case 5: Multi-Month Clone ✅

**Objective:** Verify multi-month clones create multiple schedules with correct dates

### Steps:
1. Select a revenue schedule to clone
2. Open clone modal
3. Set the following values:
   - **Revenue Schedule Name:** "Multi-Month Test"
   - **Quantity:** 25
   - **Price Per Unit:** 200.00
   - **Usage Adjustment:** 100.00
   - **Start Date:** January 1, 2025
   - **Number of Months:** 3
4. Click **Clone Schedule** button

### Expected Results:
✅ **Modal closes after success**
✅ **Success toast appears**
✅ **3 schedules created** - Navigate back to opportunity's revenue schedules tab

### Verification - Check All 3 Schedules:

**Schedule 1:**
- [ ] **Schedule Number:** "Multi-Month Test"
- [ ] **Schedule Date:** January 1, 2025
- [ ] **Quantity:** 25
- [ ] **Unit Price:** $200.00
- [ ] **Usage Adjustment:** $100.00
- [ ] **Expected Usage:** $5,100.00 (25 × 200 + 100)

**Schedule 2:**
- [ ] **Schedule Number:** "Multi-Month Test" (same as Schedule 1)
- [ ] **Schedule Date:** February 1, 2025 (1 month later)
- [ ] **Quantity:** 25 (same as Schedule 1)
- [ ] **Unit Price:** $200.00 (same as Schedule 1)
- [ ] **Usage Adjustment:** $100.00 (same as Schedule 1)
- [ ] **Expected Usage:** $5,100.00 (same as Schedule 1)

**Schedule 3:**
- [ ] **Schedule Number:** "Multi-Month Test" (same as Schedule 1)
- [ ] **Schedule Date:** March 1, 2025 (2 months later)
- [ ] **Quantity:** 25 (same as Schedule 1)
- [ ] **Unit Price:** $200.00 (same as Schedule 1)
- [ ] **Usage Adjustment:** $100.00 (same as Schedule 1)
- [ ] **Expected Usage:** $5,100.00 (same as Schedule 1)

**KEY VERIFICATION:** All 3 schedules have:
- Same schedule number
- Same quantity, price, adjustment
- Dates increment by 1 month each

---

## Test Case 6: Calculation Verification ✅

**Objective:** Verify that expectedUsage and expectedCommission are calculated correctly

### Test Setup:
Find a product with a known commission rate (e.g., 10%)

### Steps:
1. Clone a schedule for this product
2. Set the following values:
   - **Quantity:** 10
   - **Price Per Unit:** 100.00
   - **Usage Adjustment:** 50.00
3. Click **Clone Schedule**
4. View the cloned schedule details

### Expected Calculations:
- **Base Usage:** 10 × $100.00 = $1,000.00
- **Expected Usage:** $1,000.00 + $50.00 = $1,050.00
- **Expected Commission:** $1,050.00 × 10% = $105.00

### Verification:
- [ ] **Expected Usage:** $1,050.00
- [ ] **Expected Commission:** $105.00
- [ ] **Usage Adjustment:** $50.00 shown separately

### Test with Negative Adjustment:
1. Clone another schedule
2. Set:
   - **Quantity:** 10
   - **Price Per Unit:** 100.00
   - **Usage Adjustment:** -50.00
3. Click **Clone Schedule**

### Expected Calculations:
- **Base Usage:** $1,000.00
- **Expected Usage:** $1,000.00 + (-$50.00) = $950.00
- **Expected Commission:** $950.00 × 10% = $95.00

### Verification:
- [ ] **Expected Usage:** $950.00
- [ ] **Expected Commission:** $95.00
- [ ] **Usage Adjustment:** -$50.00 shown

---

## Test Case 7: "(Copy)" Suffix Logic ✅

**Objective:** Verify that "(Copy)" suffix is added intelligently

### Test 7A: Normal Schedule Name
1. Clone a schedule named "RS-12345"
2. Modal opens with name: "RS-12345 (Copy)"
3. Click **Clone Schedule**
4. Verify cloned schedule has name: "RS-12345 (Copy)"

### Test 7B: Already Has "(Copy)"
1. Clone the schedule you just created: "RS-12345 (Copy)"
2. Modal opens with name: "RS-12345 (Copy)" (doesn't add another)
3. Click **Clone Schedule**
4. Verify cloned schedule has name: "RS-12345 (Copy)" (not "RS-12345 (Copy) (Copy)")

### Test 7C: Custom Name
1. Clone any schedule
2. Change name to: "My Custom Name"
3. Click **Clone Schedule**
4. Verify cloned schedule has name: "My Custom Name" (no auto-suffix added)

---

## Test Case 8: Error Handling ✅

**Objective:** Verify error messages display properly

### Test 8A: Network Error Simulation
1. Open browser DevTools
2. Go to Network tab
3. Enable "Offline" mode
4. Try to clone a schedule
5. Click **Clone Schedule** button

**Expected Results:**
✅ **Error toast appears** - Shows error message
✅ **Modal stays open** - Doesn't close
✅ **Can retry** - Button becomes enabled again

### Test 8B: Invalid Selection
1. Select **multiple** revenue schedules (2 or more)
2. Click **Clone** button

**Expected Results:**
✅ **Error toast appears** - "Select a single schedule - Choose exactly one revenue schedule to clone."
✅ **Modal doesn't open**

### Test 8C: No Selection
1. **Deselect all** revenue schedules
2. Click **Clone** button

**Expected Results:**
✅ **Clone button is disabled** - Cannot click when no selection
   OR
✅ **Error toast appears** - If button is clickable

---

## Test Case 9: UI/UX Verification ✅

**Objective:** Verify visual design and user experience

### Modal Appearance:
- [ ] Modal is **centered** on screen
- [ ] Modal has **dark overlay** behind it
- [ ] Modal is **responsive** (try resizing browser)
- [ ] On mobile/narrow screens: fields stack vertically
- [ ] On desktop: Quantity & Price are side-by-side
- [ ] On desktop: Date & Months are side-by-side

### Field Styling:
- [ ] All labels are **uppercase and gray**
- [ ] All input fields have **border**
- [ ] Focus state shows **blue border** (primary color)
- [ ] Error state shows **red border**
- [ ] Currency fields have **$ symbol** on left
- [ ] Help text for Usage Adjustment is visible

### Button Styling:
- [ ] Cancel button is **gray with border**
- [ ] Clone button is **blue (primary color)**
- [ ] Disabled button has **reduced opacity**
- [ ] Loading state shows **"Cloning…"** text
- [ ] Close X button in top-right corner

### Accessibility:
- [ ] Can **Tab** through all fields
- [ ] Can **Shift+Tab** backwards
- [ ] Can press **Enter** to submit form
- [ ] Can press **Escape** to close modal
- [ ] Error messages are **readable** (good contrast)
- [ ] All inputs have **visible labels**

---

## Test Case 10: Backward Compatibility ✅

**Objective:** Verify feature doesn't break existing functionality

### Clone from Revenue Schedules List Page:
1. Navigate to **Revenue Schedules** page (not from opportunity)
2. Select a schedule
3. Click **Clone** button
4. Modal opens (may not have all fields prepopulated)
5. Fill in any required fields
6. Click **Clone Schedule**

**Expected Results:**
✅ **Clone works** - New schedule created
✅ **No errors** - Process completes successfully

---

## Test Case 11: Edge Cases ✅

### Test 11A: Very Large Numbers
1. Open clone modal
2. Set **Quantity:** 999999
3. Set **Price Per Unit:** 999999.99
4. Click **Clone Schedule**

**Expected Results:**
✅ **Accepts large numbers**
✅ **Calculates correctly**
✅ **No overflow errors**

### Test 11B: Decimal Quantities
1. Open clone modal
2. Set **Quantity:** 2.5
3. Set **Price Per Unit:** 100.00
4. Click **Clone Schedule**

**Expected Results:**
✅ **Accepts decimals**
✅ **Expected Usage:** $250.00 (2.5 × 100)

### Test 11C: Zero Adjustment
1. Open clone modal
2. Set **Usage Adjustment:** 0
3. Click **Clone Schedule**

**Expected Results:**
✅ **Accepts zero**
✅ **No adjustment applied** to expected usage

### Test 11D: Empty Optional Fields
1. Open clone modal
2. **Clear** Quantity field (leave empty)
3. **Clear** Unit Price field (leave empty)
4. **Clear** Usage Adjustment field (leave empty)
5. Click **Clone Schedule**

**Expected Results:**
✅ **Clone succeeds** - These fields are optional
✅ **Uses original values** from source schedule

### Test 11E: Rapid Button Clicks
1. Open clone modal
2. Fill in valid values
3. **Double-click** Clone Schedule button rapidly

**Expected Results:**
✅ **Only one clone created** - Button disables after first click
✅ **No duplicate clones**

---

## Test Case 12: Different User Roles ✅

**Objective:** Verify permissions work correctly

### Test 12A: User WITH Permission
1. Login as user with `revenue-schedules.manage` permission
2. Navigate to opportunity with schedules
3. Select a schedule
4. Click **Clone** button

**Expected Results:**
✅ **Clone button visible**
✅ **Modal opens**
✅ **Can create clone**

### Test 12B: User WITHOUT Permission
1. Login as user without `revenue-schedules.manage` permission
2. Navigate to opportunity with schedules

**Expected Results:**
✅ **Clone button NOT visible** or disabled
✅ **Cannot access clone functionality**

---

## Test Results Summary Template

Use this template to record your test results:

```
## Test Execution Summary
Date: _____________
Tester: _____________
Environment: _____________

### Test Case Results:
- [ ] Test Case 1: Basic Clone with Prepopulated Fields
- [ ] Test Case 2: Field Editing
- [ ] Test Case 3: Validation - Required Fields
- [ ] Test Case 4: Successful Single Clone
- [ ] Test Case 5: Multi-Month Clone
- [ ] Test Case 6: Calculation Verification
- [ ] Test Case 7: "(Copy)" Suffix Logic
- [ ] Test Case 8: Error Handling
- [ ] Test Case 9: UI/UX Verification
- [ ] Test Case 10: Backward Compatibility
- [ ] Test Case 11: Edge Cases
- [ ] Test Case 12: Different User Roles

### Issues Found:
1. [Issue description]
   - Severity: Critical / High / Medium / Low
   - Steps to reproduce:
   - Expected vs Actual:

### Overall Assessment:
- [ ] All tests passed
- [ ] Minor issues found (non-blocking)
- [ ] Major issues found (blocking)
- [ ] Feature approved for production
```

---

## Quick Smoke Test (5 Minutes)

If you only have time for a quick test, do this:

1. **Select a revenue schedule** → Click Clone
2. **Verify fields are prepopulated** with source data
3. **Change quantity to 100** and **price to 50.00**
4. **Click Clone Schedule**
5. **Verify new schedule created** with quantity=100, price=$50, expectedUsage=$5,000

If this works, the core feature is functional! ✅

---

## Troubleshooting

### Modal Doesn't Open
- Check browser console for errors
- Verify you selected exactly one schedule
- Verify user has correct permissions

### Fields Are Empty
- Check that source schedule has data
- Check browser console for data fetching errors
- Verify API endpoint is returning source data

### Calculations Are Wrong
- Note down: quantity, price, adjustment, expected result
- Calculate manually: (quantity × price) + adjustment
- Check commission rate for the product
- Report if calculation doesn't match formula

### Clone Button Disabled
- Check for validation errors (red borders/text)
- Verify all required fields filled (schedule name, date)
- Check browser console for JavaScript errors

---

## Reporting Issues

When reporting an issue, please include:

1. **Test Case Number** (e.g., "Test Case 4")
2. **Steps to Reproduce** (detailed)
3. **Expected Result** (what should happen)
4. **Actual Result** (what actually happened)
5. **Screenshots** (if applicable)
6. **Browser Console Errors** (if any)
7. **User Role** (which permissions)
8. **Environment** (local, staging, production)

---

## Success Criteria

Feature is approved if:
✅ All validation rules work correctly
✅ Calculations are accurate
✅ Multi-month clones work properly
✅ No critical bugs found
✅ UI is responsive and accessible
✅ Error handling is graceful
✅ No data corruption

---

**Happy Testing! 🧪**

If you encounter any issues or have questions, refer to:
- [Implementation Summary](12-4-25-Clone-Revenue-Schedule-Implementation-Summary.md)
- [Review Report](12-4-25-Clone-Revenue-Schedule-Review-Report.md)
