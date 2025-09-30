# ACC‑07 — New Opportunity Form

**Phased Implementation Plan (engineering‑ready)**

> This plan translates the ACC‑07 requirements into sequenced, bite‑sized work packages with checklists, acceptance criteria, and test cases. It aligns to the v2.0 specs for Accounts/Opportunities and Global UI.

---

## Phase 0 — Sprint Setup & Scope Lock

**Goal:** Establish guardrails so the team can implement ACC‑07 without churn.

**Tasks**

* [ ] Confirm we are implementing **the v2.0 behavior** for Create New Opportunity (ACC‑07) including two‑column layout, required fields, and commission rules. 
* [ ] Create a **feature flag** `opportunity.acc07.new_form` to gate UI changes.
* [ ] Add **linters & form validation utilities** aligned to Global UI **field formats** (Dates `YYYY‑MM‑DD`, Percent `XX.XX%`). 
* [ ] Align UX patterns to **Global Form Standards** (modal, Save / Save & New / Cancel; inline errors; required asterisks). 

**Acceptance criteria**

* A dev build can toggle the new ACC‑07 form on/off via feature flag.
* Shared validators for date & percent are available and unit‑tested. 

---

## Phase 1 — Data Model & Migrations

**Goal:** Add the fields ACC‑07 needs, with a safe generator for Order ID – House.

**Schema changes (Opportunity)**

* [ ] `orderIdHouse` **(auto‑generated, unique, read‑only after create)**. Format: `H` + sequential number generated on insert. 
* [ ] `houseRepPercent` **decimal(5,2)** (required). 
* [ ] `subagentPercent` **decimal(5,2)** (required; default `0.00`). 
* [ ] `houseSplitPercent` **computed** (not user‑editable): `100.00 − (houseRepPercent + subagentPercent)`. Persist if needed for reporting; otherwise compute at read time. 
* [ ] `referredById` **FK → Contact** (required at create). 

**Server logic**

* [ ] **Transactional** Order ID generator to avoid duplicates under concurrency. Enforce DB **unique index** on `orderIdHouse`. 
* [ ] Input validation: no negatives; each ≤ 100; **(rep + subagent + houseSplit) must equal 100** after calculation. 

**Acceptance criteria**

* Creating an opportunity yields a unique **Order ID – House** (`H####...`) and stored/derived commission fields matching rules. 

**Test cases**

* Concurrent creates → no duplicate `orderIdHouse`.
* Percent math rounds to **2 decimals** and totals 100.00. 

---

## Phase 2 — ACC‑07 Modal (UI)

**Goal:** Implement the **two‑column** “Create New Opportunity Form” exactly as spec’d.

**Layout & fields**

* **Left column (in order):**

  1. **Account Legal Name** (read‑only, pre‑populated)
  2. **Estimated Close Date*** (required, `YYYY‑MM‑DD`)
  3. **Opportunity Stage*** (dropdown, user must select; 1..9 labeled stages)
  4. **Opportunity Name***
  5. **Owner*** (lookup to **House** contacts; **default to Account Owner**, editable)
  6. **Subagent** (optional lookup to **Subagent** contacts)
  7. **Referred By*** (required lookup to **all Contacts**)
     *All left‑column field sources & ordering per spec.* 

* **Right column:**

  1. **Subagent %** (editable, default `0.00%`)
  2. **House Split %** (**read‑only**, auto = `100 − (Rep + Subagent)`)
  3. **House Rep %** (editable)
  4. **Opportunity Description*** (required, multi‑line)
     *Commission math and read‑only behavior per spec.* 

**Form mechanics**

* [ ] Modal with **Save**, **Save & New**, **Cancel**; **inline validation**; required asterisks; follow **Global Form Standards**. 
* [ ] **Real‑time** commission validation & **auto‑recalc** of House Split. Blocks submit until totals = 100 and values valid. 
* [ ] **Lookup sources**:

  * Owner: Contacts where **Account Type = House** (pre‑select Account Owner). 
  * Subagent: Contacts where **Contact Type = Subagent** (optional). 
  * Referred By: **All Contacts** (required). 
* [ ] **Formatting**: Dates `YYYY‑MM‑DD`; Percent `XX.XX%`; link styling follows global rules. 

**Acceptance criteria**

* The visible fields and their order match the spec screenshots/text.
* Commission section behaves exactly as described; **House Split** is not directly editable. 

**Test cases**

* **Owner** defaults to Account Owner but can be changed; **Subagent** optional; **Referred By** cannot be left blank. 
* Enter **Rep 55%** and **Subagent 0%** → House Split auto = **45%**. Save succeeds. 
* Enter values summing **≠ 100** or any negative → inline errors; **Save disabled**. 

---

## Phase 3 — Post‑Create Rules, Lists & Navigation

**Goal:** After creation, the field protections and list displays match the system rules.

**Record protections & flows**

* [ ] **Lock commission fields** after initial save; further changes occur via **Manage Commissions** on Opportunity Detail (not through edit form).
* [ ] Ensure detail view exposes the **Manage Commissions** entry point for managers (future phases) and audit trail alignment.

**Account > Opportunities tab (list UI)**

* [ ] Add/confirm default columns: **Estimated Close Date**, **Order ID – House**, **Opportunity Name (link)**, **Opportunity Stage**, **Referred By (link)**, **Owner (link)**; honor **Dynamic Columns**. 
* [ ] All name fields follow **hyperlinking rules** (blue text, underline on hover; open in‑app). 

**Acceptance criteria**

* Editing an existing opportunity **does not** allow changing the three commission % fields; Manage Commissions is the only path.
* Opportunities list shows the required default columns and supports the **gear** (dynamic columns).

**Test cases**

* Create → reopen record in edit mode → commission inputs are read‑only. 
* List shows **Order ID – House** populated in `H####` format; **Referred By** and **Owner** are hyperlinks to Contact Detail.

---

## Phase 4 — API & Validation Hardening

**Goal:** Server‑side enforcement of every business rule (no trust in client).

**Rules to enforce**

* [ ] Required fields at create: **Estimated Close Date**, **Opportunity Stage**, **Opportunity Name**, **Owner**, **Referred By**, **Opportunity Description**. 
* [ ] **Lookup constraints**: Owner ∈ House contacts; Subagent (if provided) ∈ Subagent contacts; Referred By ∈ Contacts. 
* [ ] **Commission math**: sanitize inputs, round to 2 decimals, recalc House Split, assert total = 100.00. 
* [ ] After create, **block updates** to `orderIdHouse` and commission fields via API. 

**Acceptance criteria**

* Failing any server rule returns structured errors mapped 1:1 to UI fields per Global Form Standards. 

**Test cases**

* Attempt to POST with Owner who is not House → 422 error on `ownerId`. 
* Attempt to PATCH `orderIdHouse` → 403/422 (blocked). 

---

## Phase 5 — QA: Unit, Integration, E2E

**Goal:** Prove compliance with ACC‑07, Global UI, and commission governance.

**Unit tests**

* [ ] Commission utility: inputs → rounded outputs; invariants hold (sum = 100). 
* [ ] Order ID generator: **monotonic & unique** in concurrency tests. 

**Integration/E2E**

* [ ] Create via **Account > Opportunities > Create New**: verify pre‑populated **Account Legal Name**, required fields, and saved **Order ID – House**. 
* [ ] Post‑save edit: commission fields read‑only; **Manage Commissions** available on detail (Manager only).
* [ ] List defaults and **Dynamic Columns** gear present; hyperlinks behave per Global UI. 

**Non‑functional**

* [ ] Accessibility checks (labels, focus order, error messages). 

---

## Phase 6 — Documentation, Handoff & Launch

**Goal:** Close the loop with Product, QA, and downstream commission tooling.

**Artifacts**

* [ ] README section for ACC‑07: fields, validation, Order ID generator, and **post‑save commission lock** with pointer to **Manage Commissions**.
* [ ] Admin runbook for troubleshooting invalid splits and generator failures.
* [ ] Release notes calling out **UI field changes**, **required Referred By**, and **locking behavior**.

**Launch checklist**

* [ ] Remove feature flag (or leave as kill‑switch).
* [ ] Backfill strategy decided (new opps only vs legacy backfill of `orderIdHouse`/percents). 

---

## Field Reference (for developers)

* **Create New Opportunity — required inputs**:
  `estimatedCloseDate`, `stageId` (1..9), `opportunityName`, `ownerId` (House), `referredById` (Contact), `houseRepPercent`, `subagentPercent`, `description`. **Derived**: `houseSplitPercent = 100 − (rep + subagent)`. **Generated**: `orderIdHouse = "H" + seq`. 

* **Stage values (ordered)**: 1 Needs Analysis, 2 Qualification, 3 Proposal, 4 Awaiting Approval, 5 On Hold, 6 Approved, 7 Billing, 8 Closed Billing Ended, 9 Lost. 

* **Global UI formats**: Dates `YYYY‑MM‑DD`; Percent `XX.XX%`; hyperlink styling; Dynamic Columns on all tables. 

---

## Risks & Mitigations

* **Race conditions on Order ID** → Use DB sequence or transactional counter with unique index. 
* **Commission edits post‑save** → Must be blocked in both UI & API; route changes through **Manage Commissions** to keep audit trail and alignment with reassignment workflows.
* **Lookup performance** (large Contacts) → Server‑side type‑ahead with throttling & pagination; cache House/Subagent lists. 

---

## Out‑of‑Scope (deferred to separate tickets)

* Manage Commissions UI & Global Reassignment wizards (covered by Commission Reassignment specs; implement later as ACC‑XX).
* Activities & Notes tab work (already standardized across modules). 

---

## “Definition of Done” — One‑glance checklist

* [ ] ACC‑07 modal matches **two‑column layout** and **field order** per v2.0 spec. 
* [ ] **Owner** defaults to Account Owner; **Subagent** is optional lookup; **Referred By** is a **required** contact lookup. 
* [ ] **Commission section** present; **House Split** auto‑calculates; totals = **100%**; no negatives; 0–100 bounds. 
* [ ] **Order ID – House** autogenerates `H####` on create, unique, read‑only thereafter. 
* [ ] **Account Legal Name** pre‑populated (read‑only). 
* [ ] **Opportunity Description** required. 
* [ ] **Commission fields locked after save**; further changes via **Manage Commissions** only.
* [ ] Account > Opportunities list shows correct default columns & hyperlinks; **Dynamic Columns** gear works.
* [ ] All formatting and form behaviors match **Global UI Standards**. 

---

### Source specs referenced

* **Accounts Module Specification v2.0 (ACC‑07 form, lists, stages, commission rules).** 
* **Global UI Specifications v2.0 (forms, hyperlinks, dynamic columns, formats).** 
* **Multi‑Level Commission Reassignment Guide (Manage Commissions patterns).** 
* **Commission Reassignment & Termination System (governance & audit context).** 
* **Activities & Notes Module Specification (out‑of‑scope in this ticket).** 

---

> **Hand to your coding agent as is.** The phases can be executed sequentially (0 → 6) or in parallel by sub‑team (1&4 back‑end, 2&3 front‑end, 5 QA), then converge for launch.
