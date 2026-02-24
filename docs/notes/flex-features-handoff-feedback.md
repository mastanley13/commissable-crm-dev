According to a document from **2026-02-19**, the **Flex Product Guide matches the “Flex Product” (reconciliation exception) behavior in our knowledge base**, but it **does not fully cover (and slightly conflicts in terminology with) the separate “Flex Schedule” month‑to‑month (M2M) feature** described elsewhere.

## **Where it matches the knowledge base**

### **1\) Flex Product definition \+ when it’s created**

The guide defines a **Flex Product** as a placeholder **Product \+ Revenue Schedule** created during reconciliation for:

* **Unknown / unmappable deposit lines**, or  
* **Overage outside tolerance** where you split the overage into a Flex Product schedule

That aligns with our broader reconciliation docs describing FLEX as the mechanism to preserve revenue when we can’t confidently classify/match yet, and to route items for management review.

### **2\) Guardrails: don’t use Flex Product for within-tolerance or negative lines**

The guide’s “Do NOT use Flex Product when…” rules match the intended separation:

* **Within tolerance** → create an **Adjustment** (“auto\_adjust”) rather than Flex Product  
* **Negative line** → handled via **Chargeback / CB‑REV** workflows, not Flex Product

### **3\) Flex Review Queue \+ resolution outcomes**

The guide’s “Flex Review Queue” \+ resolution options map cleanly to the operational intent in the KB:

* Queue item is created and remains **Open** until resolved  
* Resolution outcomes include:  
  * **Apply to existing schedule** (absorb flex amount; retire flex schedule)  
  * **Convert to regular schedule** (choose product family/subtype/product; optional recurring \+ create more schedules)  
  * **Bonus commission (100% rate)** option

This aligns with the 1/21 conversation where the desired end-states were: rename/convert the Flex placeholder into a real product/schedule OR apply the amount back into the parent schedule once researched.

## **Where it does NOT match / is incomplete**

### **A) The guide does not cover the “Flex Schedule” \= Month-to-Month (M2M) feature**

In our KB (notably the 2026-01-21 meeting), **“Flex schedule” is explicitly defined as the month‑to‑month automation feature**:

* If a product is still billing and schedules are exhausted, on the first of the month the system creates a new month schedule as a copy of the prior month (empty version).

Separate docs expand that M2M behavior:

* Copy most recent schedule, create current month schedule, set product status to **Billing – M2M**, lifecycle management, and cleanup after 3 months without deposits.  
* Quick reference also states: if schedules are exhausted and product is still billing, system creates a single month’s schedule on the first of the subsequent month, continuing until **Billing Ended**.

The Flex Product Guide’s stated scope is **only** reconciliation-created Flex Products (unknown/unmappable \+ out-of-tolerance overages)—so it’s not “wrong,” but it **doesn’t match the full KB expectation if we intended it to document both Flex Products and Flex Schedules (M2M).**

### **B) Terminology collision: “Flex schedule” means different things in different docs**

* The meeting transcript uses **Flex schedule \= M2M** and **Flex product \= reconciliation exception**.  
* Other specs use “Flex schedule” to mean the **overage exception schedule** tagged “-F.”

The guide calls the exception record “a Flex Product schedule” and uses `flexClassification = FlexProduct` etc.  
So: the guide is internally consistent, but **our knowledge base as a whole is not**—and the guide currently doesn’t explicitly clarify the two concepts.

### **C) Schedule date rule may be ambiguous vs “always 1st of month”**

The guide says the Flex Product schedule uses:

* `scheduleDate = Deposit.month`

But our Milestone 3 spec says **Revenue Schedule Date is always 1st of month**.

**ASSUMED:** `Deposit.month` is already normalized to the first day of the month (e.g., `2026-02-01`). If it isn’t, then the guide wording conflicts with the “always 1st of month” rule and should be updated for clarity.

### **D) Naming / tagging expectations aren’t documented in the guide**

Older operational docs describe a naming/tagging convention:

* FLEX: `RS-...-F`  
* Chargeback: `RS-...-CB`  
* Chargeback reversal: `RS-...-CB-REV`  
* And specs mention overage creates Flex RS tagged “-F.”

The guide doesn’t mention these conventions at all (it focuses on fields like `flexClassification`, `flexReasonCode`, etc.).

This may be fine if naming is truly deprecated in favor of classification fields—but if UI/reporting still relies on “-F / \-CB / \-CB-REV”, the guide is missing an important expectation.

### **E) Commission-only deposit edge case isn’t covered**

The exhaustive workflow doc includes:  
“If no RS found, create Flex with Usage \= Commission, Rate \= 100%.”

The Flex Product Guide doesn’t mention this scenario (it says expected usage/commission match deposit line amounts).

## **Recommended updates to make the guide fully match the knowledge base**

If the goal is “this doc should reflect *both* Flex Products and Flex Schedules (M2M) as defined in our KB,” here are the concrete doc changes:

1. **Add a definitions section that explicitly distinguishes:**  
   * **Flex Product (Exception Schedule)** \= unknown/unmappable \+ out-of-tolerance overage placeholder (this doc’s current topic)  
   * **Flex Schedule (M2M Auto-Continuation)** \= month-to-month schedule creation after schedules are exhausted while product remains billing  
2. **Add (or link to) an M2M section** summarizing:  
   * Trigger condition (schedules exhausted \+ product still billing)  
   * Creation timing (first of subsequent month)  
   * Status progression Billing → Billing‑M2M → Billing Ended  
   * Cleanup after 3 months no deposits  
3. **Clarify scheduleDate wording** to align with “always 1st of month”:  
   * Replace `scheduleDate = Deposit.month` with “**first day of the deposit reporting month** (YYYY‑MM‑01)” unless Deposit.month is already that.  
4. **Document naming/tagging conventions if still active** (or explicitly deprecate them):  
   * `-F`, `-CB`, `-CB-REV` expectations in UI/reports.  
5. **Add the commission-only edge case** section if it’s still required behavior.

---

**Flex Product portion \= yes, match; Flex Schedule/M2M portion \= not covered, so overall \= partial match.**

