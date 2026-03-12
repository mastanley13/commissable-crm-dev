Absolutely. Below is a **copy/paste-ready handoff markdown** for your coding agent, followed by a **copy/paste-ready prompt**.

---

# Handoff Markdown — Live Preview Highlighting in Reconciliation UI

## Feature Name

**Live Preview Highlighting in Reconciliation Table + Modals**

## Objective

Implement a **temporary live preview state** during reconciliation so the user can see what values will be applied **before** clicking **Match** or **Submit**.

This feature is intended to improve confidence during testing and reconciliation by making pending changes visually obvious and easy to compare.

## Why This Feature Exists

Rob explicitly asked for the system to show users what will happen **before commit**, especially when reconciling line items, handling usage overages, or applying commission/rate changes. He wants changed values to be visually obvious and easy to scan, with a **highlighted background**, not just text color, because he called out colorblindness concerns.  

## Source of Truth

This handoff is based on:

* **March 5, 2026** meeting: live matching preview in the bottom revenue schedule table 
* **March 11, 2026** meeting: yellow background highlight in both modals, preview before submit, consistent modal behavior, aligned comparison columns 
* **February 17, 2026** meeting: temporary highlight of Actual Usage / Actual Commission / Actual Commission Rate during match flow 

---

## Required Behavior

### 1) Bottom Reconciliation Table Preview

When a user selects a candidate revenue schedule match in the reconciliation screen, the system should temporarily display the values that would be applied to the selected revenue schedule row.

### Preview fields to show in the bottom table

At minimum, preview these fields:

* **Actual Usage**
* **Actual Commission**
* **Actual Commission Rate %**

This was specifically called out as the desired behavior in February and March.  

### Bottom-table preview rules

* Preview appears **immediately when a row is selected**
* Preview is **temporary only**
* Preview **does not save** until the user clicks **Match**
* If the user unselects the row, the preview disappears and values return to their prior display state
* If the selection changes, the preview recalculates immediately
* If multiple selected rows affect the preview, the display should update based on the current active selection state

### Visual treatment in the bottom table

Rob said he prefers the changed cells to use a **background highlight**, specifically like the yellow background already used elsewhere in the UI, so the user’s eye is drawn to the change. He explicitly said background highlighting is better than relying only on green text. 

Use this as the visual intent:

* changed preview cells get a **yellow background highlight**
* keep text readable
* do not rely only on bold/green text
* changed values should be easy to spot at a glance

### Display style preference

Rob said he would prefer the actual value in the existing cell to temporarily change to the previewed amount, rather than adding a second number beside it. On March 5, he said he would rather replace the zero/current display with the preview amount and highlight the cell. 

---

## 2) Modal Preview Behavior

This same preview concept must also exist inside the reconciliation-related modals.

March 11 explicitly added this as an action item:
**“Implement yellow highlight previews for usage/commission changes in both modals.”** 

### Modal scenarios this applies to

At minimum, implement in:

* the **variance-handling modal**
* the **many-to-one matching modal**

March 11 tied this preview behavior to both modals. 

### Modal preview rules

When a user clicks an option such as:

* one-time adjustment
* apply to all future schedules
* create flex schedule
* edit allocation
* other previewable actions in the modal

…the UI should show what the selected action would do **before submit**.

### Important modal interaction rule

Rob explicitly said:

* clicking an option should **not auto-apply**
* the user should be able to click/select an option
* the UI should preview the result
* the user must then click **Submit** to confirm

This was a direct March 11 requirement. 

### Values to preview in modals

Depending on modal type, preview the values that would change. These include:

* **Price Each**
* **Expected Usage**
* **Actual Usage**
* **Expected Commission**
* **Actual Commission**
* **Expected Commission Rate**
* **Actual Commission Rate**

Rob specifically used the example of previewing the **Price Each** change from 155 to 165 and also previewing the resulting commission impact. 

### Modal visual treatment

* changed preview values should use the same **yellow background highlight**
* preview should be visible **before submit**
* preview should update immediately when the user changes selected option
* preview should clear if the user cancels or closes the modal

---

## 3) Alignment / Layout Requirements

Rob asked for expected vs actual fields to be aligned **vertically straight across** so users can compare values top-to-bottom without hunting visually. He also said the modal can be widened if necessary because this screen is “the meat and potatoes of the application.” 

### Alignment requirement

Where preview values are shown, align:

* expected commission rate vs actual commission rate
* expected usage vs actual usage
* expected commission vs actual commission

### Layout requirement

* widen modal if necessary
* prioritize readability over keeping the modal narrow
* keep previewed comparison data easy to scan

---

## 4) UX Standard to Follow

March 11 established a new modal standard:

* consistent gradient header
* smaller option buttons
* “or” text between options
* explicit submit behavior
* real-time preview of changes inside the modal 

This preview feature should fit that standard and not introduce a different UI pattern.

---

## 5) Plain-Language Desired User Experience

### In the bottom reconciliation table

A user selects a bottom-row candidate match. Immediately:

* Actual Usage fills temporarily
* Actual Commission fills temporarily
* Actual Commission Rate fills temporarily
* those changed cells are highlighted
* nothing is saved yet

If the user changes the selected row:

* the preview updates

If the user unchecks the row:

* the preview clears

If the user clicks **Match**:

* the previewed values become committed values

### In the modal

A user selects an option such as “Apply to all future schedules.” Immediately:

* the modal shows what values would change
* changed values are highlighted with a yellow background
* the user can review the impact before committing

If the user clicks **Cancel**:

* nothing persists

If the user clicks **Submit**:

* the selected action is committed

---

## Non-Goals / What Not to Do

* Do **not** auto-save previewed values on selection
* Do **not** require the user to infer changes from plain text only
* Do **not** show preview in a separate disconnected place if the changed cell itself can show the pending value
* Do **not** implement a brand-new UX pattern that conflicts with the March 11 modal standard

---

## Visual Inspiration Guidance

Use **AG Grid-style changed-cell background highlighting** as visual inspiration only.

Do **not** treat AG Grid’s exact implementation as the requirement.
The requirement is the Commissable meeting direction:

* temporary preview
* changed value visible in-place
* yellow background highlight
* no persistence until Match/Submit
* same behavior in bottom grid and modals

---

## Acceptance Criteria

### Bottom table

* Selecting a candidate revenue schedule temporarily shows previewed values for:

  * Actual Usage
  * Actual Commission
  * Actual Commission Rate
* Preview appears in the existing row/cells
* Changed preview cells are visually highlighted with background color
* Preview clears when selection is removed
* Preview updates when selection changes
* No data is persisted until **Match**

### Modals

* Selecting a variance/allocation option previews downstream value changes before commit
* Changed preview values use background highlight
* Clicking an option does not auto-apply the change
* User must click **Submit**
* Cancel/close clears preview state
* Comparison values are aligned clearly for expected vs actual review

### General

* Preview behavior is consistent across the reconciliation table and related modals
* Highlight treatment is readable and accessible
* UI follows the newer modal standard from March 11

---

## Notes / Assumptions

* **ASSUMED:** preview state should be implemented as a temporary UI state and not mixed with committed persisted values until final confirm
* **ASSUMED:** the same preview rendering approach should be reusable across both table and modal flows for consistency
* **ASSUMED:** the highlight color should match or closely mirror the existing yellow variance notice style Rob referenced on March 11

---

# Copy/Paste Prompt for Your Coding Agent

Use this exactly or very close to it:

> Review the attached handoff and implement the **Live Preview Highlighting in Reconciliation Table + Modals** feature for Commissable CRM.
>
> You are implementing **desired behavior**, not inventing new product behavior.
>
> ## Core requirement
>
> Add a temporary preview state so users can see what values will be applied **before** clicking **Match** or **Submit**.
>
> ## Required bottom-table behavior
>
> When a user selects a candidate revenue schedule match in reconciliation:
>
> * temporarily populate preview values in the row for:
>
>   * Actual Usage
>   * Actual Commission
>   * Actual Commission Rate
> * display the preview in-place in the row/cells
> * apply a **yellow background highlight** to changed preview cells
> * do not persist any values until the user clicks **Match**
> * if selection changes, recalculate preview
> * if selection is removed, clear preview
>
> ## Required modal behavior
>
> In the variance-handling modal and many-to-one modal:
>
> * when the user selects an option, show the downstream effect before submit
> * highlight changed values with a **yellow background**
> * do not auto-apply on option click
> * require the user to click **Submit**
> * clear preview on cancel/close
>
> ## Values that may need preview in modals
>
> Depending on the flow, preview changes to:
>
> * Price Each
> * Expected Usage
> * Actual Usage
> * Expected Commission
> * Actual Commission
> * Expected Commission Rate
> * Actual Commission Rate
>
> ## UX requirements from client
>
> * changed values should use a highlighted background, not just text color
> * keep expected vs actual values aligned vertically for easy comparison
> * modal can be widened if needed
> * stay consistent with the newer modal standard:
>
>   * gradient header
>   * smaller buttons
>   * “or” text between options
>   * submit-based confirmation
>
> ## Important
>
> * Do not invent a new UX
> * Implement the March 5 + March 11 + Feb 17 meeting behavior exactly
> * AG Grid-style changed-cell highlighting can be used as visual inspiration only
>
> ## Deliverable expectation
>
> Implement the feature so it is testable in:
>
> 1. the bottom reconciliation revenue schedule table
> 2. the variance modal
> 3. the many-to-one modal
>
> ## Acceptance criteria
>
> * preview is visible before commit
> * preview uses highlighted background
> * preview clears/reset correctly
> * nothing persists until Match/Submit
> * behavior is consistent across table and modals

If you want, I can turn this next into a **ticket-ready version with Title, Description, Acceptance Criteria, and Dev Notes** for your backlog.
