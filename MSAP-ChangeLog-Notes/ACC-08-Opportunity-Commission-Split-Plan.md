# ACC‑08 — **Opportunity Commission Split Validation & Auto‑Calc**

*Accounts → List / Detail / Opportunities*
**Status:** P0 (Launch blocker) • **Owner:** Engineering + Product • **Goal:** Implement creation + validation + order‑ID generation for Opportunities per module specs.

---

## 0) What “Done” Looks Like

* **Create New Opportunity** form exists in *Account Detail → Opportunities tab* and saves successfully. Required fields validated; **Order ID – House** assigned automatically on save. 
* **Commission inputs** behave exactly as specified:

  * **House Split %** is **read‑only** and **auto‑calculates** as `100.00 − (House Rep % + Subagent %)`. Defaults on open to **100/0/0**. Totals must equal **100.00%**, negatives blocked, and any single field cannot exceed **100%**. 
  * **Commission structure locks** after initial save; subsequent changes go through the **Manage Commissions** flow (manager only). 
* **List/Detail views** reflect the new Opportunity records; commission fields are available via the Dynamic Column system. 

---

## 1) Scope & Requirements (from specs)

### Functional

1. **Create New Opportunity** (modal) with fields and layout as defined, including Owner/Subagent/Referred By, Stage, Close Date, and **Right‑column Commission Splits**. 
2. **Commission Split Validation**:

   * Default state when the form opens: **House Split 100.00%, House Rep 0.00%, Subagent 0.00%**.
   * Live calc: House Split auto-updates as Rep/Subagent change; user cannot type into House Split.
   * **Total must equal 100.00%**, **no negative values**, **no single field > 100%**; show inline error if violated and block save. 
3. **Order ID – House** generation: assign an immutable ID on save in the format **`H` + sequential number**. 
4. **Post‑save rules**:

   * **Commission structure locked**; later edits require **Manage Commissions** (manager‑only) to create a tracked change with effective dates. 
   * Opportunity appears in Account’s Opportunities tab and relevant lists. 

### Non‑Functional / UX

* Follow **Global UI** form standards (two‑column modal; required fields; inline validation; persistent table columns; % format **XX.XX%**). 
* Dynamic Columns available on the Opportunities table; include **House Rep %**, **Subagent %**, **House Split %** as selectable fields. 

---

## 2) Data Model & Field Mapping

**Object: Opportunity (within Accounts module)**

* **Order_ID_House** (auto‑number, immutable). 
* **Opportunity_Name**, **Opportunity_Stage**, **Close_Date**, **Owner** (House rep), **Subagent** (optional), **Referred_By**, **Description**. 
* **Commission fields**:

  * **House_Rep_%** (editable %), **Subagent_%** (editable %, default 0.00), **House_Split_%** (calculated, read‑only = `100 − (Rep + Subagent)`). 
* **Behavioral rule**: **Commission structure locks** after save; changes later create “Original vs Current” records per reassignment architecture (immutable “Original” + mutable “Current” with audit trail). 

---

## 3) UI/UX Implementation Plan

### 3.1 Entry point & modal

* **Entry**: *Account Detail → Opportunities tab → Create New*. Modal title: **“Create New Opportunity Form”** with left/right column layout per spec. 
* **Left column**: Account Legal Name (read‑only), Close Date (required), Stage (required), Opportunity Name (required), Owner (House contacts), Subagent (optional), Referred By (required). 
* **Right column (Commission)**:

  * Inputs: **House Rep %**, **Subagent %**; defaults **0.00**.
  * Display/Read‑only: **House Split %**, default **100.00**.
  * Inline helper text: “House Split auto‑calculates to 100 − (Rep + Subagent).”
  * **Live validation** with red inline messages and disabled **Save** until valid. 

### 3.2 Formatting & controls

* **Percent inputs** enforce **XX.XX%** formatting and range **0.00–100.00**; strip non‑numeric on blur; show % suffix; align right; keyboard step 0.01. 
* **Buttons**: **Save & New**, **Save**, **Cancel** per standards. 

### 3.3 Lists & detail

* **Opportunities table** (in Account Detail): expose **House Rep %**, **Subagent %**, **House Split %** as **Dynamic Columns** options. Defaults may omit; users can add via ⚙️. 

---

## 4) Validation & Business Logic

### 4.1 Client‑side (reactive form)

* On change of Rep/Subagent:

  1. Compute **HouseSplit = max(0, 100.00 − (Rep + Subagent))**; set with 2‑decimal precision.
  2. **Block**: if Rep < 0, Subagent < 0, Rep > 100, Subagent > 100, or (Rep + Subagent) > 100 → show error “Totals must equal 100%; values cannot be negative or exceed 100%.” Disable **Save**.
  3. **Pass**: if (Rep + Subagent + HouseSplit) == 100.00 exactly (after rounding), enable **Save**. 

### 4.2 Server‑side (authoritative)

* Recompute the same rules server‑side on submit; **reject** request with field‑level errors if invalid.
* **Lock commission** on persisted record to prevent post‑save edits outside **Manage Commissions**. 

### 4.3 Order ID Generation

* On successful create, assign **Order_ID_House = "H" + nextSequence()**; ensure atomicity/uniqueness (DB sequence or transactional counter). Expose read‑only in tables/detail. 

---

## 5) Security & Permissions

* Any allowed user can **create** an Opportunity per Accounts module permissions; **commission values after save are immutable** to non‑managers.
* **Manage Commissions** (individual opportunity) requires **Manager** role and writes to “Current structure,” preserving “Original structure” with audit trail. 

---

## 6) Auditability & Future Reassignment Readiness

* Persist **Original** vs **Current** commission structures as per Commission Reassignment design (immutable original, mutable current with effective dates, reason, approver). This unblocks later use of **Type A/B/C** reassignment and revenue impacts. 

---

## 7) Testing Strategy

### 7.1 Unit Tests

* **Calc**:

  * `Rep=0, Sub=0 → House=100`
  * `Rep=55, Sub=0 → House=45`
  * `Rep=30.25, Sub=10.75 → House=59.00`
  * **Reject**: negatives; `Rep=100.01`; `Rep+Sub > 100`; rounding edge where `Rep+Sub=99.995` should normalize to **100.00** total. 
* **Order ID**: sequence uniqueness; immutability post‑save. 

### 7.2 Integration Tests

* Create via **Account Detail → Opportunities → Create New**; verify record appears with correct columns and **Order ID**. 
* Post‑save: attempt to edit commission fields → blocked; **Manage Commissions** visible only to managers. 

### 7.3 E2E (happy paths)

* **Standard rep‑only split**: enter Rep %, leave Subagent 0 → save succeeds; totals 100.
* **Three‑way split**: enter Rep % and Subagent % → House auto‑fills; save succeeds at exactly 100.

---

## 8) Error Messages (copy)

* **Totals exceed 100%** — “Commission total cannot exceed 100%.”
* **Negative value** — “Percentages cannot be negative.”
* **Total not 100%** — “House Split auto‑calculates. Adjust Rep or Subagent so the total equals exactly 100%.”
  (Shown inline under offending field; Save disabled until pass.) 

---

## 9) Rollout & Migration

* **Feature flag** `opportunity.create.v1` to guard new modal + server endpoint.
* **Backfill**: none required for existing data to enable the form; ensure commission fields exist and are typed as percentages with 2‑decimal precision per Field Format Reference. 
* **Training blurb** for Sales: “Enter Rep/Subagent only; House updates automatically. After save, use **Manage Commissions** for any change (manager only).” 

---

## 10) Deliverables

1. **Frontend**: Opportunity create modal & validation; Dynamic Column registrations for % fields. 
2. **Backend**: Create endpoint; server‑side validation; Order ID generator; commission lock enforcement. 
3. **Data**: Opportunity schema updates (if needed) for `%` fields and ID; Original/Current structure scaffolding aligned with reassignment system. 
4. **QA test suite**: Unit + integration + E2E per §7.
5. **Docs**: One‑pager for CS/Sales; admin note on Manager permissions for **Manage Commissions**. 

---

## 11) Dependencies / References

* **Accounts Module v2.0** — Opportunity form, validation defaults, order ID format, % rules. 
* **Accounts Module v1.0** — Commission fields, lock after save, reassignment entry points. 
* **Global UI Specs** — Modal form standards, Dynamic Columns, percent formatting, list behavior. 
* **Commission Reassignment & Termination System** — Original vs Current structures, audit trail, manager‑only changes. 

---

### Acceptance Criteria (quick checklist)

* [ ] Form opens with **House=100.00, Rep=0.00, Sub=0.00**. 
* [ ] House Split is read‑only and auto‑updates as other fields change. 
* [ ] Save blocked unless **Rep + Sub + House = 100.00** and all inputs in **0–100** range (no negatives). 
* [ ] Order ID generated as **H####…**, immutable after save. 
* [ ] Commission fields are **not editable** after save (non‑managers); **Manage Commissions** path exists for managers. 

> This plan translates the module specifications into a concrete, testable implementation for ACC‑08 while keeping space for later integration with the multi‑level commission reassignment workflows. 
