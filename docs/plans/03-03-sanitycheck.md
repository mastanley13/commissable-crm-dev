According to a document from **March 2, 2026** (“03-02-26 Commissable-CRM Summary and Transcript”), here’s an execution plan to complete the **changes, edits, and tasks** you discussed—organized into a clean roadmap with owners, dependencies, and implementation-ready “ticket” language.

---

## **1\) Lock the process first: One shared backlog \+ intake lane**

### **Goal**

Use the shared Google Sheet as the **single source of truth**, with a dedicated “intake” sheet for new items and a main backlog that gets prioritized and worked.

### **Concrete setup**

**Backlog structure (recommended):**

* Tabs:  
  * **Intake (Rob adds items)**  
  * **Backlog (StrategixAI prioritizes \+ moves items)**  
* Columns (recommended for dev-ready clarity):  
  * Area (Reconciliation / Templates / Opportunities / UI / Admin)  
  * Title  
  * Full description  
  * Acceptance criteria  
  * Priority (P0 blocker / P1 / P2)  
  * Owner (Rob / StrategixAI / Both)  
  * Status (Ready / In Dev / Ready for UAT / Done)  
  * Dependencies  
  * Source (03-02 meeting timestamp or “email / PDF”)

**Immediate backlog hygiene tasks**

* ✅ StrategixAI: “Update the shared Google Sheet with all items from the Fathom notes.”  
* ✅ Add the “Friday PDF \+ 2nd email” items into the backlog (even if not yet implemented).

---

## **2\) Phase Now: Unblock reconciliation testing (highest leverage)**

This phase is about making the matching experience testable and reducing “tripping up,” which you explicitly called out as the main goal.

### **A. Matching UI: make it easier to see \+ act**

**Ticket: Adjust deposit-matching layout (P0)**

* **Owner:** StrategixAI  
* **Requirement:** Show **7–8 deposit lines**, move the **horizontal scrollbar up**, and increase the visible **suggested matches** so you can see more revenue schedules at once.  
* **Acceptance criteria:**  
  * Deposit-line list shows \~7–8 rows before scroll  
  * Suggested matches area visibly larger (less whitespace)  
  * Revenue schedule list shows \~10–11 rows (or as close as the layout allows), matching the intent from the discussion

**Ticket: Adjust matching UI to show more revenue schedules (P0/P1)**

* **Owner:** StrategixAI  
* **Requirement:** “Show more revenue schedules (target: 7–8 rows).”

### **B. Fix confusing / risky UI behaviors during matching**

**Ticket: Update deposit matching labels \+ remove hyperlink (P0)**

* **Owner:** StrategixAI  
* **Requirement:** Rename “Account Name” label to **Vendor/Deposit Account** and remove hyperlinking from **Other Product Name** (and avoid hyperlinking unknown/unmapped entities).

### **C. Data correctness: mapping bug fix**

**Ticket: Fix “Other Account ID” mapping (P0)**

* **Owner:** StrategixAI  
* **Requirement:** “Fix Other Account ID mapping to use correct internal account ID” (current behavior appears to be pulling the wrong identifier).  
* **Acceptance criteria:**  
  * “Other Account ID” consistently stores the intended account identifier (not the unintended internal unique ID)  
  * Verified by matching a deposit line and confirming the propagated IDs look correct downstream (per your “we need to see what’s actually passing through” comment)

### **D. Templates management (needed for scaled testing)**

**Ticket: Create Templates page in Admin; list templates A–Z by vendor (P0/P1)**

* **Owner:** StrategixAI  
* **Requirement:** Add a Templates management page under Admin; list templates **A–Z** and support vendor selection/filtering.

### **E. Rob’s test execution loop (critical path)**

**Ticket: Rob UAT – matching interface (P0)**

* **Owner:** Rob  
* **Plan:** Test “easiest to hardest,” then broaden scenarios once you can “see it and feel it.”  
* **Action:** Create a few test instances, run another deposit, and report where you “trip up.”  
* **Deliverable to StrategixAI:** a short list of:  
  * Steps to reproduce  
  * What you expected vs what happened  
  * Screenshot/video if possible

**Input dependency: updated deposit files**

* **Owner:** Rob  
* **Requirement:** Provide updated **Tolaris** deposit files to test template variations.

---

## **3\) Phase Next: Implement the agreed workflows \+ remove friction in data entry**

### **A. SME Commission workflow (manual, low-risk approach)**

You explicitly chose a **manual workflow** to avoid complex formula changes and reduce risk.

**Ticket: SME Commission workflow (P1)**

* **Owner:** StrategixAI  
* **Requirements:**  
  * Add **SME checkbox \+ percentage field** at the Opportunity level  
  * When adding a product to an SME opportunity, show tooltip like “adjust rate by 50%”  
  * User manually enters adjusted commission rate (example: 16% → 8%)  
* **ASSUMED (because the notes imply it but don’t fully specify defaults):**  
  * Default SME % \= **50%** unless overridden on the Opportunity, since “split 50-50” is the common case described.  
  * The tooltip uses the Opportunity SME % value to compute the recommended adjustment.

### **B. Product Creation form cleanup (reduce mistakes)**

**Ticket: Product creation form redesign (P1)**

* **Owner:** StrategixAI  
* **Requirements:**  
  * Two-column layout  
  * Remove Status field (defaults “Active”)  
  * Move **House Part Number** above divider  
  * Make **Part Number \+ Description required**  
* **Related ticket: Make auto-expanding textarea global (P2 but quick win)**  
  * **Owner:** StrategixAI

### **C. Parent account creation workflow (modal \+ auto-populate)**

**Ticket: Parent Account modal workflow (P1)**

* **Owner:** StrategixAI  
* **Requirements:**  
  * In the parent account typeahead, clicking “Create new one” opens **Add Parent Account** modal  
  * On save, auto-populate parent account field in original form  
  * Include: default None; header; refresh list; auto-select; tooltip (per action item list)

### **D. Typeahead standardization**

**Ticket: Standardize typeaheads; fix underline width (P2)**

* **Owner:** StrategixAI

---

## **4\) Phase Later: House-account governance, sub-agent guardrails, and invitations**

### **A. House-account rules (admin-only \+ hide from normal flows)**

**Ticket: Implement house-account rules (P2)**

* **Owner:** StrategixAI  
* **Requirements (from action item list):**  
  * House-account rules: “no opps; house-rep dropdown; admin-only owner; hide from reports/prospects.”  
* **Supporting detail from transcript:** house rep should be **assigned in settings** and not editable from the account page (or hide/lock field when account type \= house).  
* **ASSUMED (because “no opps” is ambiguous):**  
  * “No opps” means house accounts cannot be selected as standard customer accounts on Opportunities (or Opportunities tied to house accounts should be excluded from pipeline/prospect/report views).

### **B. Sub-agent % guardrail**

**Ticket: Disable sub-agent % unless sub-agent selected (P2)**

* **Owner:** StrategixAI

### **C. Email invites**

**Ticket: Research email providers for user invites; propose to Rob (P2)**

* **Owner:** StrategixAI  
* **Recommended output (so you can decide quickly):**  
  * 2–3 options  
  * Pricing model  
  * Ease of setup  
  * Deliverability \+ logging  
  * How it plugs into the app’s invite flow

---

## **5\) Two “open items” to handle carefully**

### **A. “Option A proceed workflow” is still underspecified**

It’s referenced as an action item and called out as something you “called earlier” about, but the transcript excerpt doesn’t define what Option A is.

**Plan to complete it without stalling:**

1. Create a backlog item titled **“Define Option A proceed workflow”**  
2. Paste the email/notes that describe Option A  
3. Convert into:  
   * Trigger (where “Proceed” appears)  
   * Options A/B/etc  
   * Expected system changes per option  
   * Success criteria  
     Then implement.

### **B. Deposit template “New Fields / Exclude / Template Fields” behavior must be validated**

This is key for scale (and for comparing you vs your brother’s file).

**Agreed behavior (as described in the transcript):**

* After mapping \+ saving, mapped fields move into **Template Fields**  
* Only unmapped fields with new values go into **New Fields**  
* **Exclude** catches everything else  
* Over time, Exclude \+ New Fields should shrink (new fields ideally to \~0)

**Rob dependency:** compare deposit files and see which columns differ / are “new.”

---

## **6\) Quick owner-split checklist (so nothing falls through cracks)**

### **Rob (your checklist)**

* Run matching tests (easiest → hardest), create test instances \+ deposits, and report issues.  
* Provide updated Tolaris deposit files for template variation testing.  
* Compare your deposit file vs your brother’s; identify new columns; support “New Fields” validation; create Colt Tower template.

### **StrategixAI (dev checklist)**

* Deposit matching layout improvements.  
* Fix Other Account ID mapping.  
* Deposit matching label/hyperlink fixes.  
* Templates Admin page.  
* Parent account modal workflow.  
* Product form redesign \+ textarea global.  
* Consolidate Revenue Schedule IDs into “Other IDs.”  
* SME workflow (checkbox \+ % \+ tooltip \+ manual override).  
* House-account rules \+ sub-agent % gating.

---

## **7\) Built-in checkpoint**

The notes indicate you planned to **meet the next afternoon** to review progress. Since the meeting was March 2, that implies **March 3 (today)** as the intended checkpoint.

---

If you want, I can also transform the above into **a clean, de-duplicated ticket list** you can paste directly into your backlog (one “ticket block” per item with Acceptance Criteria \+ Test Steps), but the roadmap above is already ordered to match the dependencies from the March 2 discussion.

