**Manage Revenue Schedules**

Functional Specification & GUI Design Document

Commissable, Inc.  |  Version 1.0  |  March 2026 

**See UI – [LINK HERE](https://claude.ai/public/artifacts/be25d533-0470-49c0-9dd5-3a961e9ec111)**

# **1\. Executive Summary**

The Manage Revenue Schedules popup is a consolidated batch-editing interface within Commissable CRM that replaces a legacy 6-tab design with a single, streamlined popup. It allows users to create, modify, and manage revenue schedules tied to Opportunity Products without navigating multiple screens or tabs.

This document defines the four core functions, the specifications for each workflow, the user interface structure, and the intended business goals of the new design.

# **2\. Goals**

## **2.1 Business Goals**

* Reduce the time required to create and manage revenue schedules by consolidating all actions into a single popup interface.

* Eliminate user confusion caused by navigating across 6 separate tabs in the legacy design.

* Provide real-time impact previews so users can verify changes before committing, reducing errors in commission calculations.

* Support batch operations across multiple schedules, enabling efficient management of recurring commission structures.

## **2.2 UX Goals**

* Clean, modern, minimal SaaS design consistent with the Commissable brand palette (navy header, indigo accents, alternating row shading).

* Preview-first layout: the impact preview table appears at the top of every tab so users always see the result of their changes before interacting with form fields.

* No unnecessary scrolling for standard workflows (3 schedule rows). Additional rows trigger a scrollable preview table with a sticky header.

* Consistent formatting across all tabs: currency as $xxx.xx, percentages as xxx.xx%, and all table values center-aligned.

* Row-level checkboxes with select-all functionality on every preview table, allowing users to include or exclude specific schedules from the batch operation.

* 

# **3\. Popup Structure**

The popup is approximately 1060px wide and contains three main zones:

| Zone | Description |
| :---- | :---- |
| **Header (Top)** | Title, subtitle, and contextual summary chips (schedule count, product name, date range). Schedule count chip is dynamic: shows "1 schedule selected" on the Create tab, "3 schedules selected" on all others. |
| **Action Panel (Left)** | Vertical card list with 4 selectable actions. Selected action is highlighted in the primary indigo color. Each card includes an icon, label, and short description. |
| **Form \+ Preview (Right)** | The main content area changes based on the selected action. Every tab leads with the Impact Preview table, followed by the relevant input fields. Footer contains Cancel and Apply Changes buttons. |

## **3.1 Action Panel**

The left sidebar presents four actions as clickable cards:

1. Create Schedules — Generate new monthly revenue schedules from a selected source schedule.

2. Change Commission Rate — Update the commission rate across selected schedules.

3. Change Commission Split — Reassign house, house rep, and subagent percentage splits.

4. Change Start Date — Shift all schedule dates forward or backward by whole months.

# **4\. Functional Specifications**

## **4.1 Create Schedules**

**Purpose:** Generate a set of new monthly revenue schedules based on the defaults of a single selected Opportunity Product Revenue Schedule.

**Constraint:** Only one source schedule may be selected. The header chip reads "1 schedule selected" on this tab.

### **4.1.1 Preview Table (Top)**

Labeled "New Schedules Preview" (distinct from "Impact Preview" on other tabs). Displays a live-updating table with the following columns:

| ☐ | \# | Schedule ID | Date | Qty | Price | Usage | Rate / Comm. |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| *Checkbox per row (checked by default, deselectable)* | *Sequential row number* | *Auto-generated sequential ID (e.g. 12589, 12590…)* | *1st of month* | *From form* | *$xxx.xx* | *Qty × Price* | *xxx.xx% / $xxx.xx* |

The table supports a scrollable body (max \~160px) with a sticky header for cases exceeding 3 rows. A select-all checkbox appears in the header.

### **4.1.2 Form Fields**

All fields (except the Product Schedule dropdown) are editable and pre-populated with defaults from the selected source schedule. Changing the dropdown resets all fields to that schedule’s values.

**Row 1:** Product Schedule (dropdown, required) — full-width, limited to the single selected schedule.

**Row 2:** Start Date (required), \# Periods (required), Comm. Rate %

**Row 3:** Quantity × Price Each ($xxx.xx input) \= Expected Usage – Gross (read-only, auto-calculated as Qty × Price, formatted $xxx.xx)

**Row 4:** House % (xxx.xx% input), House Rep % (xxx.xx% input), Subagent % (xxx.xx% input)

**Row 5:** Notes (required, full-width textarea)

**Row 6:** Chargeback checkbox (generates negative schedule values)

## **4.2 Change Commission Rate**

**Purpose:** Batch-update the commission rate for all selected revenue schedules effective from a given date.

### **4.2.1 Preview Table (Top)**

Labeled "Impact Preview." Columns: Checkbox, Schedule ID, Date, Current Rate (xxx.xx%), New Rate (xxx.xx%), Affected (● Yes or —). Rows where the new rate differs from the current rate are highlighted in green. Unchecked rows dim to 45% opacity.

### **4.2.2 Form Fields**

* Effective Date (required) — own row.

* Current Rate (read-only, displays "16.00% (uniform)" or "Mixed" if rates differ across selection).

* New Commission Rate (required) — numeric input with % suffix, step 0.01.

## **4.3 Change Commission Split**

**Purpose:** Reassign the commission split percentages for House, House Rep, and Subagent across selected schedules.

### **4.3.1 Preview Table (Top)**

Labeled "Impact Preview." Columns: Checkbox, Schedule ID, Date, Old Split (formatted as xxx.xx% / xxx.xx% / xxx.xx%), New Split (same format, green text), Affected.

### **4.3.2 Form Fields**

* Effective Date (required).

* Current Split: Three read-only fields showing House, House Rep, and Subagent as xxx.xx%.

* New Split: Three editable fields with % suffix inputs (step 0.01).

* Validation bar: Displays "Split totals must equal 100%" in red when total ≠ 100, or "✓ Split totals equal 100%" in green when valid. Right side shows "Total: xxx.xx%".

## **4.4 Change Start Date**

**Purpose:** Shift all selected schedule dates forward or backward by whole months.

### **4.4.1 Preview Table (Top)**

Labeled "Impact Preview." Columns: Checkbox, Schedule ID, Old Date, New Date (green), Shift (e.g. "-1 month", "+2 months").

### **4.4.2 Form Fields**

* Baseline Start Date (read-only) — the earliest date among selected schedules.

* New Start Date (required) — date picker.

* Shift indicator: Blue info banner showing the calculated month offset and a reminder that all dates land on the 1st of the month.

# **5\. Business Rules & Constraints**

| Rule | Detail |
| :---- | :---- |
| **First-of-month dates** | All schedule dates must fall on the 1st of the month. Date shifting uses whole-month increments, never 30-day arithmetic. |
| **Split total \= 100%** | Commission splits (House \+ House Rep \+ Subagent) must always total exactly 100.00%. The Apply Changes button should be disabled when the split is invalid. |
| **Currency format** | All currency values displayed as $xxx.xx (two decimal places). Price Each input shows a $ prefix. |
| **Percentage format** | All percentage values displayed as xxx.xx% (two decimal places). Split and rate inputs show a % suffix. |
| **Single-schedule create** | The Create Schedules action operates on exactly one source schedule. The Product Schedule dropdown is restricted to only the selected schedule. |
| **Sequential Schedule IDs** | New schedules are assigned the next available sequential ID starting after the highest existing ID in the system. |
| **Row-level opt-out** | Users can deselect individual rows via checkboxes on every preview table. Deselected rows are visually dimmed (45% opacity) and excluded from the batch operation. |
| **Required fields** | Marked with a red asterisk (\*). On Create: Product Schedule, Start Date, \# Periods, and Notes. On Rate: Effective Date, New Rate. On Split: Effective Date, all three new split fields. On Date: New Start Date. |

# **6\. Design System**

The popup adheres to the Commissable CRM brand palette as observed in the production application:

| Element | Value | Usage |
| :---- | :---- | :---- |
| **Navy** | \#1A237E | Popup header background, section titles |
| **Primary Indigo** | \#3F51B5 | Selected action card, Apply button, active states |
| **Table Header** | \#3949AB | Preview table header row background |
| **Success Green** | \#2E7D32 | Changed values in preview, validation success |
| **Error Red** | \#C62828 | Required field asterisks, validation errors |
| **Font Family** | Segoe UI | Primary UI font throughout the popup |
| **Mono Font** | SF Mono | Table cell values (dates, IDs, currency, percentages) |

# **7\. Workflow Summary**

The end-to-end workflow for any action follows a consistent pattern across all four tabs:

5. User selects one or more revenue schedules from the Opportunity detail grid and clicks the Manage button.

6. The popup opens with the Create Schedules tab active by default. The header chips reflect the selection context.

7. User selects an action from the left panel. The right panel updates immediately.

8. The Impact Preview (or New Schedules Preview) table is the first thing visible, showing the projected result of the action with current form values.

9. User modifies form fields below the preview. The preview table updates in real time as values change.

10. User optionally deselects rows via checkboxes to exclude specific schedules from the operation.

11. User clicks Apply Changes. The system processes only the checked rows.

12. If validation fails (e.g. split ≠ 100%), the Apply button is disabled or an inline error is shown. The user corrects the values and resubmits.

# **8\. Expected End Result**

Upon completion of this feature, Commissable CRM users will have a single, unified popup for all revenue schedule management operations. The key outcomes are:

* A 6-tab legacy interface replaced by a clean, 4-action single-popup design that reduces clicks and context-switching.

* Real-time preview-first design that prevents commission errors by showing the exact impact before any data is committed.

* Granular row-level control through checkboxes, giving users flexibility to include or exclude individual schedules.

* Consistent, professional formatting ($xxx.xx for currency, xxx.xx% for percentages) that matches industry standards for financial data.

* A responsive, scrollable preview table that handles both small (3-row) and large (36-row) schedule sets without degrading the form experience.

* A design that aligns with Commissable’s existing brand and visual language, requiring no re-training for existing users.