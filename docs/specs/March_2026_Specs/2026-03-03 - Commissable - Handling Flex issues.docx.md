**COMMISSABLE — Reconciliation Variance System**

Overview & Logic Specification  |  v5  |  March 2026

# **1\. System Overview**

During deposit reconciliation, the system detects two variance types and prompts the user via a popup:

* **Usage Overage:** Actual usage exceeds expected usage beyond tolerance.

* **Commission Rate Variance:** Usage matches, but actual commission rate % exceeds expected rate.

Both are tabs in a single popup. If both detected, popup opens to Overage tab with Commission tab flagged.

### **Popup Layout (Top → Bottom)**

* Selected Deposit Line Item — single row being matched

* Matched Revenue Schedule — live-updating table; bold green cells \= fields changing based on selection

* Deposit Summary Bar — totals, tolerance, commission rates

* Tab Bar — Usage Overage | Commission Rate

* Option Cards — labeled Option 1, Option 2, etc.

* **Checkbox (Option 1 only):** “Apply to all future schedules” — appears below the option cards when Option 1 is selected. When checked, the Matched Revenue Schedule table above expands to show all future-dated schedules for the opportunity product with their projected changes in bold green.

* Footer — Cancel | Submit

# **2\. Known Bugs**

**⚠ B-05 is a BLOCKER — cannot unmatch, blocks all testing.**

| \# | Issue | Expected | Actual | Sev |
| :---- | :---- | :---- | :---- | :---- |
| **B-01** | Flex schedule naming | "12698.1" | "12709" | **Critical** |
| **B-02** | Flex Price Each | $550.00 (overage) | $50.00 | **Critical** |
| **B-03** | Unmatch cascade-delete | Delete flex \+ all refs | Orphaned | **Critical** |
| **B-04** | Popup auto-executes on click | Preview → Confirm | Immediate | **Critical** |
| **B-05** | "Unknown revenue schedule id" on unmatch | Clean unmatch | UUID error | **BLOCKER** |

# **3\. Usage Overage Resolution (Tab 1\)**

**Trigger:** Actual Usage \> Expected Usage Gross beyond tolerance.

## **3.1 Option 1 — Absorb into Price Each**

Increases Expected Usage Gross and recalculates Price Each on the matched schedule.

**Formula (Qty=1):** New Price Each \= Old \+ Overage

**Formula (Qty\>1):** New Price Each \= Old \+ (Overage ÷ Quantity)

*Example:* $50 \+ $550 \= $600. Qty 5: $50 \+ $110 \= $160/unit.

### **Future Schedule Propagation (Checkbox)**

**NEW:** When Option 1 is selected, a prominent checkbox appears below the option cards:

***☐ Apply this adjustment to all future schedules for this opportunity product***

The checkbox is unchecked by default. Behavior when checked:

* **The Matched Revenue Schedule table at the top of the popup expands** to include all future-dated schedules for the same product on the same opportunity, listed after the matched schedule.

* **Each future schedule row shows the projected changes in bold green:** updated Price Each, Expected Usage Gross, Expected Usage Net, and Expected Commission.

* The user can visually confirm the cascade effect before clicking Submit.

* Unchecking the box collapses the table back to just the matched schedule.

| Checkbox State | Table Shows | Schedules Affected on Submit |
| :---- | :---- | :---- |
| **Unchecked (default)** | Matched schedule only (e.g., 12698\) with bold green changes | 1 schedule |
| **Checked** | **Matched schedule \+ all future schedules** (e.g., 12699, 12700, 12701\) each showing updated Price Each, Exp Gross, Exp Net, Exp Commission in bold green | **1 \+ N future schedules** |

**Use case:** Vendor permanently increased MRC from $50 to $600. User checks the box to propagate the new rate to all future billing periods in one action rather than adjusting each schedule individually.

### **Fields Updated (Option 1\)**

| Field | Unchecked | Checked |
| :---- | :---- | :---- |
| **Price Each** | **UPDATED** | **UPDATED (matched \+ future)** |
| **Expected Usage Gross** | **UPDATED** | **UPDATED (matched \+ future)** |
| **Expected Usage Adj.** | **DO NOT USE** | **DO NOT USE** |
| **Expected Commission** | **RECALCULATED** | **RECALCULATED (matched \+ future)** |

**⚠ Expected Usage Adjustment field is NEVER written to. Reserved for future legitimate adjustments.**

## **3.2 Option 2 — Create Flex Product**

Creates a new flex schedule to capture the overage separately. Original schedule matches at its expected amount.

### **Flex Schedule Values**

| Field | Value |
| :---- | :---- |
| **Schedule Name** | **\[ParentID\].N** — e.g., 12698.1 |
| **Price Each** | **\= Overage ($550.00)** |
| **Quantity** | 1 |
| **Exp. Usage Gross / Actual Usage** | \= Overage |
| **Commission Rate / Exp. Commission** | Inherited from parent; Exp Comm \= Overage × Rate |
| **All other fields** | Inherited from parent |

**Original schedule:** Actual Usage \= Price Each ($50), Usage Balance \= $0. All other fields unchanged.

# **4\. Commission Rate Variance (Tab 2\)**

**Trigger:** Usage matches expected, BUT actual commission rate % \> expected rate %.

## **4.1 Detection & Backward Scan**

* At match time, compare deposit line’s actual commission rate to schedule’s stored rate

* If actual \> expected, flag and open Commission Rate tab

* **Backward scan:** query prior matched schedules for same product. Flag any with actual comm \> expected comm at old rate.

## **4.2 Resolution Scopes**

| Scope | Count | Behavior |
| :---- | :---- | :---- |
| **Option 1: This Only** | 1 | Updates rate on current schedule. Recalculates Exp Comm and Comm Balance. |
| **Option 2: This \+ Future** | 1+N | Updates current \+ all future schedules for same opportunity product. |
| **Option 3: All for Product** | All | Updates every schedule (past \+ current \+ future). **Prior correction:** recalculates expected commission on past schedules, correcting balance discrepancies. |

### **Fields Updated**

* **Commission Rate %:** UPDATED to actual rate

* **Expected Commission:** RECALCULATED \= Exp Usage Gross × New Rate

* **Commission Balance:** RECALCULATED \= Exp Commission – Actual Commission

* **Price Each / Usage fields:** No change

# **5\. Decision Tree**

| \# | Condition | Tab | Action |
| :---- | :---- | :---- | :---- |
| **1** | Overage ≤ tolerance | None | Auto-allocate silently |
| **2** | Overage \> tolerance | **Tab 1** | Popup: 2 options \+ future checkbox |
| **3** | Usage matches, comm rate higher | **Tab 2** | Popup: 3 scope options |
| **4** | Both overage \+ comm rate | **Both** | Opens Overage tab. Comm tab flagged. |

# **6\. Unmatch & Cleanup**

### **Standard Unmatch**

* Revert Actual Usage, Usage Balance, Allocated/Unallocated on deposit line, Items Matched count

### **Flex Product Unmatch (Cascade Delete)**

1. Flex Revenue Schedule record

2. RevenueScheduleDetail rows

3. Opportunity Product record (if only schedule)

4. Catalog Master Product updates — revert

5. Account-level linkage — remove

# **7\. UI Behavior Rules**

* **No auto-execution:** Selecting options updates preview only. No writes until Submit.

* **Live preview:** Matched Schedule table updates in real-time. Bold green \= changed fields.

* **Flex row:** Option 2 appends new flex row directly below original in same table.

* **Future checkbox (Option 1):** Standalone checkbox below option cards. When checked, future schedule rows appear in the Matched Schedule table above with bold green projected changes. Unchecking collapses back to matched schedule only.

* **Commission tab flag:** Pulsing amber indicator when comm rate variance detected.

* **Submit:** Processes resolution, returns to reconciliation page.

* **Cancel:** Returns with no changes.

**⚠ Expected Usage Adjustment field is NEVER written to during any resolution.**