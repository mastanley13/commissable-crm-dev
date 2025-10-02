# Commission Reassignment & Termination — **Implementation Plan (v1)**

*Modules: Accounts • Opportunities • Contacts • Activities/Notes • Commissions*
**Goal:** Deliver end‑to‑end, manager‑driven flows to terminate or reassign commissions at the **Opportunity (L1)**, **Account (L2)**, and **Global Rep (L3)** levels with previews, auditability, and financial reconciliation. 

---

## 1) Scope & Outcomes

* Support three **reassignment levels**:
  **L1 Opportunity**, **L2 Account**, **L3 Global Rep**, each with the same strategy choices (Type A/B/C), date semantics, preview, and audit.
* Provide **manager-only** bulk actions, scope selectors (**Accounts only**, **Accounts + Active/Future opps**, **Complete**), and a multi‑step wizard ending in a background job with progress and error handling.
* Ensure totals remain **exactly 100%**, apply **effective dates**, and **pro‑rate revenue schedules** across the termination boundary.

---

## 2) Roles & Permissions

* **Manager**: Can run L1/L2/L3 reassignments, view and execute queue items, roll back within allowed window. 
* **Finance**: Receives impact notifications, approves reconciliation steps, and monitors liability changes. 
* **All users**: Can view history/audit; cannot edit original commission structure. 

---

## 3) Access Points (Where flows start)

**L1 — Individual Opportunity**

* Opportunity Detail → **Manage Commissions**. For surgical changes to a single deal. 

**L2 — Account Level**

* Account Detail → **Reassign All Opportunities**; or Accounts List → select account(s) → **Reassign**. 

**L3 — Global Rep Level (termination/leave/promotion)**

* **Method 1:** Accounts List → Filter **Account Owner = [Rep]** → Select All → **Global Reassignment**.
* **Method 2:** Rep’s Contact record → **Terminate All Commissions** (pre-filters scope and opens global wizard).

UI affordances (filters, bulk select, dynamic columns) use the **Global UI** standards for lists, selection, and persistence. 

---

## 4) Strategy Types (How splits change)

* **Type A — House Absorption:** Old rep’s % goes to House; no new rep assigned.
* **Type B — Direct Transfer:** New rep inherits **exact** % from old rep.
* **Type C — Custom Redistribution:** Set a new % for the incoming rep; **House adjusts** to maintain 100%.
  Use cases and guardrails are common across L1/L2/L3.

---

## 5) Scope Options (What is affected)

* **Accounts only:** Change **Account Owner**; leave opportunity commissions unchanged.
* **Accounts + Active/Future opportunities:** Change owner and reassign **pre‑billing** stages; historical stays intact.
* **Complete reassignment:** Owner + **all** opportunities (including historical) get updated structure. 

**Protected records:** Closed/Won, Billing stage, reconciled periods, or manually locked items are excluded unless the chosen scope expressly includes them. 

---

## 6) Dates & Payment Semantics

* **Commission End Date (old rep):** last day old rep earns.
* **Reassignment Date (new structure):** first day new structure applies (≥ End Date).
* **Revenue schedules** split at the boundary; **pre‑end** paid to original, **post‑start** to new structure; split months **pro‑rated**.

**Compliance:** No backdating without override; manager approval required; finance notified on large impacts. 

---

## 7) Data Model (Core fields & history)

**On Opportunity (“commission envelopes”)**

* **Original Structure** (immutable): Original House %, Rep %, Subagent %, identities, creation metadata.
* **Current Structure** (mutable via reassignment): Current House %, Rep %, Subagent %, identities, effective date.
* **Audit fields:** `Reassignment_Type (A/B/C)`, `Reassignment_Level (L1/L2/L3)`, `Commission_End_Date`, `Reassignment_Date`, `New_House_Rep`, `New_Split (JSON)`, `Reason`, `Approver`.

**On Contact (Rep)**

* `Commission_Eligible`, `Commission_End_Date`, `Reassignment_Status`, `Active_Opportunity_Count` to support **rep termination** entry. 

**Stable foreign keys:** **Order ID – House** on opportunities used as the audit anchor in reassignment snapshots. 

---

## 8) Wizard UX (shared patterns)

**Step 1 — Scope**

* Counts by role (House Rep/Subagent), opp totals, revenue at risk; choose **Accounts only** vs **Accounts + Active** vs **Complete**. 

**Step 2 — Global Parameters**

* Set **Termination Date**, **Reason**; allow global date or per‑item overrides. 

**Step 3 — Strategy**

* **Uniform** (one rule for all) or **Segmented** by account type, stage, deal size, territory; or **Review Queue** (defer).

**Step 4 — Preview**

* Show Accounts/Opportunities affected, by Type (A/B/C), **Monthly/Annual** deltas, **Revenue Schedules** needing updates, **Exceptions**. Export preview. 

**Step 5 — Execute**

* Final confirmation, optional notifications; create background **bulk job**; email on completion. 

UI behaviors (filtering, bulk select, dynamic columns, sticky headers) follow **Global UI** specs; Account Reassignment modal provides clear split displays and transfer options (to House vs to Rep).

---

## 9) Level‑Specific Flows

### L1 — Individual Opportunity (from Opportunity Detail)

1. Click **Manage Commissions** → set **Commission End Date** (this opp only).
2. Pick **Type A/B/C**; specify new rep and % if needed; ensure totals = **100%**.
3. **Preview** impact (this opp), save; create audit entry and trigger reconciliation pipeline for this record. 

### L2 — Account (from Account Detail or Accounts List)

1. Open **Reassign All Opportunities** (or Bulk Reassign after selecting accounts).
2. Choose **Uniform** or **Segmented** rules (e.g., keep Billing/Closed with original rep; move pre‑billing to new rep).
3. **Preview** and **Execute**; update all account opportunities respecting protected records. 

### L3 — Global Rep (termination/promotion/leave)

1. **Accounts List** → Filter **Account Owner = [Rep]** → **Global Reassignment** (or from **Contact** → **Terminate All Commissions**).
2. Scope (**Accounts only / Accounts + Active / Complete**), set dates/reason.
3. Choose strategy (Uniform/Segmented/Queue), **Preview**, **Execute**; background job with progress, retries, and email summary.

---

## 10) Validation & Business Rules

* **100% total** at all times; **no negatives**; **≤100% per field**; block save/execute until valid. 
* **Protected records** (Closed, Billing, reconciled, locked) require explicit inclusion or remain unchanged. 
* **No backdated** edits without override; approvals captured on audit. 

---

## 11) Processing Engine (server‑side)

**Pre‑flight**

* Expand scope; compute counts/metrics; detect protected records; build **proposed new structures** per rules. 

**Execution**

* Batch per account/opportunity with **row‑level locking**; update **Current Structure**, write **audit snapshots**, and queue **revenue schedule** recalcs; job status tracked. 

**Error Handling**

* Failures go to **exceptions queue**; retry mechanism; manual review list. Email completion summary. 

---

## 12) Audit, Activities & Notifications

**Audit trail** (immutable): before/after structures, user, timestamp, IP, approvals, level, reason. **Rollback** option available within the policy window. 
**Activities & Notes:** auto‑log “Reassignment executed” on Account and affected Opportunities; attachments allowed; inherits parent context; full history kept. 
**Notifications:** Outgoing rep (final statement), incoming reps (assignments), finance (liability changes), management (completion). 

---

## 13) Reconciliation & Finance

* **Validation → Calculation → Approval → Execution → Notification** flow to reconcile statements, update liabilities, and generate final payments for the terminated rep. 
* Integration points documented in Contacts/Accounts reports (commission liability management, payment processing). 

---

## 14) Automation, Scheduling & Templates

* **Automation rules** (admin): round‑robin, territory, performance, workload, seniority; triggers: contact Commission_End_Date set, contact inactivated, account owner changed, manual manager trigger; **priority**: manual > opp > account > global > default. 
* **Scheduled reassignments** for planned departures; **reassignment templates** (e.g., “Termination by Territory”). 

---

## 15) Reassignment Queue & Monitoring

* **Queue dashboard** with views (Pending, In Progress, Completed, Failed), **hold/prioritize**, **export**, **rollback** (within window). Status panel shows counts and throughput. 

---

## 16) Reporting & Dashboards

* **Reassignment Summary**, **Rep Transition**, **Audit Report**, plus Manager/Rep dashboards showing activity, impacts, and pending approvals. 

---

## 17) Technical Deliverables

**Backend**

* Scope expander & validator; segmented rules engine; batch executor; revenue schedule updater; audit & activities writers; reconciliation hooks; notification senders; queue & retry. 

**Frontend**

* Entry actions on Accounts/Account Detail/Contact; 5‑step wizard; **Preview** (counts, Type A/B/C breakdown, $ deltas, revenue schedule impacts, exceptions); progress modal; results + error queue views (Global UI standards).

**Data**

* Opportunity commission envelopes (Original vs Current) + audit; Contact rep termination fields; indexes for job tables; immutable order IDs used as anchors.

---

## 18) Testing Strategy

**Unit**

* Split math (A/B/C), totals=100%, negative/overflow blocked; date semantics (End ≤ Reassign); protected record bypass. 

**Integration**

* L1/L2/L3 flows; **Accounts only / Active / Complete** scopes; segmented rules by account type/stage/value/geo; preview ↔ execution parity. 

**E2E**

* **Contact → Terminate All Commissions → Accounts prefilter → Global wizard**; revenue schedule **pro‑ration**; audit created; notifications dispatched. 

**Scale/Perf**

* 1k+ opps across 100+ accounts; batch restart/rollback; exception queue accuracy; month‑end lock respected. 

---

## 19) Acceptance Criteria (Go/No‑Go)

* [ ] Manager can initiate L1/L2/L3 from documented entry points; only managers see bulk actions.
* [ ] Scope selector offers **Accounts only / Accounts + Active / Complete**; protected records handled per rules. 
* [ ] Strategies support **Type A/B/C** with **Uniform / Segmented / Queue** options; totals always **100%**.
* [ ] **Preview** shows counts, Type breakdown, **$ impact**, **revenue schedules** to update, and **exceptions**; export available. 
* [ ] Execution runs as background job with progress, retries, **rollback window**, completion email. 
* [ ] **Audit trail** + **Activities** created; finance reconciliation pipeline triggered and approved.

---

## 20) Rollout & Change Management

* **Feature flags** per level (e.g., `reassign.L1`, `reassign.L2`, `reassign.L3`).
* **Read‑only preview** first to validate math with Finance; enable execution after sign‑off.
* **Playbooks**: Manager quick‑start, Finance reconciliation SOP, emergency **rollback** steps. 

---

## 21) Notes & Best Practices

* Use **preview/simulation** before executing large runs; communicate changes early; avoid month‑end processing; document reasons in the wizard. 
* Keep **templates** for repeated scenarios and schedule reassignments for known departures. 

---

### Appendix — Quick Decision Guide

* **One deal only?** Use **L1** from Opportunity Detail.
* **One account’s portfolio?** Use **L2** from Account Detail or Accounts List.
* **Rep leaving / broad shift?** Use **L3** via Accounts List or **Terminate All** on the rep’s Contact. 

> This plan consolidates the specs and guides into a single, executable roadmap for building commission reassignment and termination flows—covering UX, data, processing, compliance, audit, and finance integration. 