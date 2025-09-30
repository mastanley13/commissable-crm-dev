# Reassignment Workflows & Criteria — One-Pager (Markdown)

* **Reassignment levels (what can be changed)**

  * **Level 1 — Individual Opportunity:** change the commission structure for a single opportunity only; used for exceptions/special handling. Access from Opportunity Detail → “Manage Commissions.”  
  * **Level 2 — Account Level:** reassign all opportunities under one account; used for territory or relationship changes. Access from Account Detail → “Reassign All Opportunities.”  
  * **Level 3 — Global Rep Level:** bulk changes across all accounts/opportunities for a representative (termination, promotion, leave). Primary entry via Accounts list filtered by owner; alternative via the rep’s Contact record → “Terminate All Commissions.”  

* **Reassignment types (how the split changes)**

  * **Type A — House Absorption:** terminated/removed rep’s % is added to House; no replacement rep. 
  * **Type B — Direct Transfer:** new rep inherits the exact % of the departing rep; House/Subagent unchanged. 
  * **Type C — Custom Redistribution:** assign a custom % to a new rep; House adjusts to keep total = 100%. 

* **Key dates & triggers**

  * **Commission_End_Date:** when the original rep stops earning; setting it (at opportunity or contact level) triggers reassignment logic and revenue schedule recalculation. 
  * **Reassignment_Date:** effective date for the new commission structure; must be on/after the end date. 
  * **Contact-level trigger:** setting Commission_End_Date on a rep’s Contact (House Rep/Subagent) initiates an impact analysis and then redirects to the bulk reassignment flow.  

* **Scope options (what gets touched during global/account changes)**

  * **Account ownership only** (no commission changes). 
  * **Accounts + active/future opportunities** (stages before billing only). 
  * **Complete reassignment** (all opportunities, including historical where permitted). 

* **Approval, roles, and permissions**

  * **Manager only** may initiate any reassignment; rep users can view but not modify commissions. Reassign tools appear when selection/permissions validate.  
  * All reassignments require **reason + audit entries** (before/after structures, user, timestamp). 

* **Business & validation rules**

  * Splits must total **exactly 100%**; historical/original structure is immutable; cannot reassign closed opportunities; termination date cannot precede creation; reassignment date ≥ termination date. 
  * “Protected” records (e.g., Billing/Closed/Won, reconciled periods) may be excluded from auto-cascade. 

* **Level-by-level workflow (checklist)**

  * **Level 1 — Individual Opportunity**

    * Open Opportunity → **Manage Commissions** → set **Commission_End_Date** (this opp only) → choose **Type A/B/C** → if B/C select new rep, enter new % (C) → preview revenue impact → **Apply**. 
  * **Level 2 — Account Level**

    * Account Detail → **Reassign All Opportunities** → view all opps for the account → choose **Uniform** (same rule for all) or **Individual** per opp → set termination/effective dates → **Execute**. 
  * **Level 3 — Global Rep Level (preferred via Accounts List)**

    * Accounts → filter **Account Owner = [Rep]** → select accounts → **Reassign/Global Reassign** → set scope (accounts only / future / complete) → choose **Type A/B/C** (Uniform, Segmented, or Manual Queue) → set dates → **Preview Impact** → **Execute**. Alternative: from rep’s Contact → **Terminate All Commissions** → wizard → proceeds to same bulk flow.  

* **Segmented strategies (when “one size” doesn’t fit)**

  * Segment by **Account Type, Stage, Deal Size, Geography** with different Type A/B/C and target reps per segment; validate then preview totals. 

* **UI components you must support**

  * **Global Reassignment Wizard** with steps for Scope → Strategy → Assignment → Review → Execute, including **Impact Preview** (accounts/opportunities counts, monthly/annual impact, affected schedules). 
  * **Reassignment Modal (Accounts)**: pick new owner (House reps, incl. House agency/dummy contact option), set effective date, toggle cascade options, and display current vs new splits. 
  * **Commission Dashboard & Queue**: Pending Reassignments, Status (Pending/Processing/Complete/Error), bulk queue actions, and history timeline. 

* **Revenue schedule & calculation impact**

  * **Before** termination date: pay per original structure; **after**: per new structure; schedules spanning the date are **pro-rated** by days. Reconciliation receives adjustments and manages final payments/liabilities. 

* **Data fields (minimum set)**

  * Opportunity: **Commission_End_Date**, **Reassignment_Type (A/B/C)**, **Reassignment_Date**, **New_House_Rep**, **New_Commission_Split (JSON)**, **Reassignment_Reason**, **Commission_Status**. 
  * Contact (rep): **Commission_Eligible**, **Commission_End_Date**, **Reassignment_Status**, **Active_Opportunity_Count** for analysis and termination triggers. 

* **Notifications & audit**

  * Notify original/new reps, finance, and managers; create immutable audit trail with reason, effective dates, and structural deltas. 

* **Automation & rules (admin)**

  * Optional **auto-assignment** rules (round-robin, territory, performance, workload, seniority) triggered by events such as setting a rep’s Commission_End_Date or owner change; manual overrides have highest priority. 

* **Error handling, rollback, and controls**

  * Validate 100% totals; log failures with retry; queue exceptions for manual review. Optional **rollback** window (e.g., 48 hours) and cancellation of in-progress batches. 

* **Where this appears in the app (access points recap)**

  * **Opportunity Detail** → Manage Commissions (Level 1) • **Account Detail** → Reassign All Opportunities (Level 2) • **Accounts List** filtered by owner → Global/Terminate (Level 3) • **Contact (Rep) Detail** → Terminate All Commissions (redirects to bulk). 

* **Related global UI behaviors that affect reassignment**

  * Dynamic Columns, filtering/search, multi-select, and two-stage deletion are consistent across list and tab views (so users can filter/select the correct scope before launching reassignment).  

---

### Notes & Cross-References (source coverage)

* Core **system overview, levels, types, dates, rules, revenue handling, audit & roles**: Commission Reassignment & Termination System. 
* **Global wizard, dashboards, queue, preview UI** and manager tools: Global UI Specs (v2.0). 
* **Account/Contact module entry points** and account-list bulk flows: Accounts v1.0 & v2.0.  
* **Contact-level termination trigger & fields** (Commission_End_Date on rep, impact analysis): Contacts module (v2.0 + v1.0).  
* **How-to guide & segmentation playbook** (scenarios, strategies, rollback): Multi-Level Commission Reassignment Guide. 
* **Global functional spec** also documents reassignment modal contents and steps. 
* (Activities & Notes is unrelated to commissions but referenced for universal tab behavior elsewhere.) 

---

If you want, I can drop this into a project “SPEC.md” with checkboxes per step (execution-ready for the coding agent).
