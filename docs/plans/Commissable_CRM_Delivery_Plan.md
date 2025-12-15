# Commissable CRM — Sequenced Delivery Plan (WSJF + RICE)

Below is a *sequenced* delivery plan that converts the meeting decisions into a de‑duplicated, implementation‑ready roadmap, ordered with WSJF and using a RICE‑style (Confidence×Reach) tie‑breaker. I’ve grouped items by feature area and annotated dependencies and assumptions so we minimize rework.

---

## Assumptions (explicit)

- **Team capacity:** **ASSUMED** 10 dev‑days/week total (2 devs × 5 days), **parallelization allowed**.  
  Rationale: not specified in notes; sized to fit an incremental 1–2 sprint cadence.
- **Hard dates:** **ASSUMED** weekly demo cadence with one client‑visible milestone per week, no fixed hard deadline beyond the current change order scope. The change order is set at **~$2,400** after removing the “Revenue Schedule Redesign (C4)” and reducing hourly rate by $20 — we keep scope within this guardrail and avoid any wholesale redesign of Revenue Schedules. fileciteturn0file1
- **Naming of the Opportunity>Products action button:** **ASSUMED** **“Manage Products”** opens two tabs: **Add from Catalog** and **Create New**, aligning the Nov 10 decision (“Create/Add Product”) with the Nov 14 global pattern to rename **Create New → Manage**. Flagged below as a decision gate. fileciteturn0file3turn0file1

---

## What we’re delivering (source of truth)

- **Product flow & UI:** two‑column “Add from Catalog” guided selector (Distributor → Vendor → Product Family/Subtype → Product) with right‑side details; also a **Create New Product** form that adds to both the opportunity and master catalog. Hide Opportunity ID; fix date picker alignment; standardize modal sizes; reorder Product Detail fields to mirror the selection flow. fileciteturn0file0turn0file3
- **Bulk actions:** compact **2×2 icon grid** (Delete, Reassign, Active/Inactive, Export) + **in‑table editing** for selected rows (e.g., Quantity, Price, Rate) with an **Apply to Selected** action. Global “Create New” buttons become **Manage** where applicable. fileciteturn0file1
- **Revenue schedules management:** split global vs. opportunity‑specific management; inline editing for **Quantity, Price Each, Expected Usage Adjustment, Expected Commission Rate**; **multi‑select delete/inactive**; filters don’t wrap; remove “In Dispute Only”. fileciteturn0file0turn0file3
- **Status and automation:** formalize schedule statuses tied to Opportunity Stage (**Pipeline**, **Pending**, **Reconciled**, **Unreconciled**), add **In Dispute** flag, and **auto‑create next month’s schedule** on the 1st when **Product Billing Status = Still Billing**. Add **Product Billing Status** to the Opportunity>Products tab. fileciteturn0file3
- **History:** **read‑only History tab** on Opportunities, Products, and Revenue Schedules (table + filters only; no delete/active). fileciteturn0file1
- **Deposit Reconciliation workspace:** remove graphs; focused view with **period selector** (month/year); header metrics: **Total Usage, Total Commissions, Total Past‑Due Schedules, Total Past‑Due Amount**; **Admins/Accountants only**. fileciteturn0file1
- **Opportunity split context:** show **“Last Edit By/On”** near the commission split to surface historical context without clutter. fileciteturn0file3
- **UI polish & autosave:** label alignment, spacing, tab underlines, separators; **autosave on page exit** to avoid chatty DB writes. fileciteturn0file0turn0file2

---

## Priority ladder — WSJF with RICE tie‑breaker

> WSJF = (Business Value + Time‑Criticality + Risk Reduction) / Effort (dev‑days).  
> Tie‑breaker = Confidence(%) × Reach(1–5).  
> **ASSUMED** numeric inputs where not specified in notes; we bias toward items that unblock reconciliation and schedule management to minimize rework.

| ID | Title | Area | Phase | Effort (days) | BV | TC | RR | **WSJF** | Confidence | Reach | **RICE tie** | Dependencies | Client‑Visible | Kano |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| **EXT1** | Provide connected **test data** (accounts/contacts/opps/products + deposit file) | Reconciliation | **Now** | 0.5 | 9 | 9 | 8 | **52.0** | 80 | 4 | 320 | — (Rob deliverable) | N | Must‑have fileciteturn0file1 |
| **SEC1** | Restrict **Deposits** workspace to **Admins/Accountants** | Reconciliation | Now | 0.5 | 6 | 6 | 6 | **36.0** | 90 | 4 | 360 | — | Y | Must‑have fileciteturn0file1 |
| **RS2** | Fix filters (no wrap), remove “In Dispute Only”, add multi‑select **Delete/Inactive** | Rev Schedules | Now | 1 | 5 | 4 | 4 | **13.0** | 95 | 4 | 380 | Table infra | Y | Must‑have fileciteturn0file3 |
| **A2** | **Reorder Product Detail** fields to match selection flow | Products | Now | 1.5 | 6 | 5 | 4 | **10.0** | 90 | 3 | 270 | — | Y | Must‑have fileciteturn0file3 |
| **RS4** | **Status logic** (Pipeline/Pending/Reconciled/Unreconciled) + **In Dispute** flag | Rev Schedules | Now | 2.5 | 8 | 7 | 8 | **9.2** | 70 | 5 | 350 | A1,A2 | Y | Must‑have fileciteturn0file3 |
| **A1** | **Manage Products**: two‑column **Add from Catalog** + **Create New**; hide Opp ID; fix date picker | Products | Now | 3 | 9 | 8 | 7 | **8.0** | 80 | 4 | 320 | A2 | Y | Must‑have fileciteturn0file0turn0file3 |
| **RS6** | Rev Schedule **Detail** tweaks (dividers, hyperlinks, remove redundant labels) | Rev Schedules | Now | 1.5 | 5 | 4 | 3 | **8.0** | 90 | 3 | 270 | RS4 | Y | Performance/Usability fileciteturn0file3 |
| **RS3** | **Auto‑create next schedule** monthly when Product Billing Status = Billing | Rev Schedules | Next | 3 | 8 | 6 | 9 | **7.7** | 60 | 4 | 240 | RS4, A5 | N | Must‑have fileciteturn0file3 |
| **SYS1** | **Autosave on page exit** (non‑chatty) | Platform | Next | 2 | 5 | 4 | 6 | **7.5** | 65 | 3 | 195 | — | N | Must‑have fileciteturn0file2 |
| **A3** | Products **bulk actions** (2×2 icons) + inline **Price/Rate** for selected | Products | Next | 3 | 7 | 7 | 6 | **6.7** | 75 | 4 | 300 | A1 | Y | Must‑have fileciteturn0file1 |
| **UI1** | Minor **UI fixes** (labels, spacing, separators, tab underline, date picker) | UI | Next | 2 | 4 | 5 | 4 | **6.5** | 90 | 5 | **450** | — | Y | Hygiene fileciteturn0file0 |
| **DEP1** | **Deposit Reconciliation** workspace (period selector, header totals, no charts) | Reconciliation | Next | 4 | 10 | 9 | 7 | **6.5** | 75 | 5 | 375 | EXT1, SEC1 | Y | Must‑have fileciteturn0file1 |
| **HIS1** | **History tab** (RO) on Opps, Products, Rev Schedules | Audit | Later | 3 | 7 | 6 | 5 | **6.0** | 70 | 4 | 280 | Audit data | Y | Performance/Trust fileciteturn0file1 |
| **RS1** | **Inline bulk edit** (Qty, Price, Usage Adj, Rate) + **Apply to Selected** (global + opp) | Rev Schedules | Later | 5 | 9 | 8 | 8 | **5.0** | 70 | 5 | 350 | RS2, RS4 | Y | Must‑have fileciteturn0file3 |

> Notes  
> • **A5 (implicit)** = Add **Product Billing Status** column on Opportunity>Products tab (tiny item that unlocks RS3). Scored as part of RS4 work. fileciteturn0file3  
> • Pass‑through rate feature is **Later / out‑of‑scope** this change order; keep on the idea list to avoid rework. fileciteturn0file0

---

## Two‑sprint plan (with weekly client‑visible milestones)

> Capacity **ASSUMED** 10 dev‑days/sprint. Parallelization allowed. We keep all work within Nov 14 change‑order intent (no C4 “revenue schedule redesign”). fileciteturn0file1

### **Sprint 1 — “Add & Manage Products; Status foundation” (Week 1)**
**Goal/Milestone demo:** From a real opportunity, **Add from Catalog** or **Create New** product in the new two‑column modal; see statuses and “Last Edit” on splits; inline revenue schedule list is cleaner and consistent.

**Scope (9.5 dev‑days):**
- **A1** Manage Products modal (Add/ Create flows, hide Opp ID, date alignment) — 3d. fileciteturn0file0turn0file3
- **A2** Reorder Product Detail fields — 1.5d. fileciteturn0file3
- **RS4** Status logic + In Dispute flag; add **Product Billing Status** on Opportunity>Products — 2.5d. fileciteturn0file3
- **RS2** Filter header cleanup; remove “In Dispute Only”; add multi‑select delete/inactive — 1d. fileciteturn0file3
- **RS5** “Last Edit By/On” near commission split — 1d. fileciteturn0file3
- **SEC1** Deposit page role gating (Admins/Accountants) — 0.5d. fileciteturn0file1
- **EXT1 (Rob)** Connected test data handed off this week (external). fileciteturn0file1

**Definition of Done (DoD):**
- Product modal supports both **Add from Catalog** and **Create New** with guided Distributor→Vendor→Family→Subtype drilldown; **Opp ID hidden**; date picker aligned. fileciteturn0file0  
- Opportunity shows **Product Billing Status**; schedules reflect **Pipeline/Pending/Recon/Unrecon**; per‑schedule **In Dispute** available. fileciteturn0file3  
- Revenue Schedules list header does not wrap; **In Dispute Only** removed; supports **multi‑select delete/inactive**. fileciteturn0file3  
- Opportunity split shows **Last Edit By/On**. fileciteturn0file3  
- Deposits route is **hidden for non Admin/Accountant** users. fileciteturn0file1

**Demo script bullets:**
1) From Opportunity>Products click **Manage Products** → **Add from Catalog**; select Distributor → Vendor → Product (right side: Quantity, Price, Rate, Start/Periods) → **Save**. fileciteturn0file0  
2) Repeat with **Create New**; show it appears in catalog and on the Opportunity. fileciteturn0file3  
3) Show Product Billing Status and how **Pending/Reconciled** states appear on schedules; toggle **In Dispute**. fileciteturn0file3  
4) In the schedules list, demonstrate **multi‑select → Inactivate**; header remains on one row. fileciteturn0file3  
5) On Opportunity header, point to **Last Edit By/On** next to the commission split. fileciteturn0file3

---

### **Sprint 2 — “Focused Reconciliation view & inline editing v1” (Week 2)**
**Goal/Milestone demo:** Admins work in a **clean Deposits workspace** with a **period selector** and **header totals**; in‑table editing of schedules at the **opportunity level** (Apply to Selected).

**Scope (≈9 dev‑days):**
- **DEP1** Deposit Reconciliation workspace (no charts; month/year selector; header totals) — 4d. fileciteturn0file1  
- **RS1 (phase 1)** Inline edit on **Opportunity’s** schedule table (Qty, Price, Usage Adj, Rate) with **Apply to Selected** — 3d. fileciteturn0file3  
- **UI1** Minor UI fixes carried over — 2d. fileciteturn0file0

**Definition of Done (DoD):**
- Deposits page shows **period controls** and **header metrics** (Total Usage/Commissions/Past‑Due Schedules/Past‑Due Amount); no charts; page hidden for non‑Admin/Accountant. fileciteturn0file1  
- On Opportunity, **edit one selected row**, click **Apply to Selected**, and only the selected rows update; audit entries are persisted for History (RO UI may land in Next sprint). fileciteturn0file3  
- Visual polish tasks complete (labels, spacing, underline, separators/date fixes). fileciteturn0file0

**Demo script bullets:**
1) Navigate to **Deposits** → select **Oct/Nov** via period control → see header totals update; confirm page is **Admin‑only**. fileciteturn0file1  
2) From Opportunity>Revenue Schedules: select 3 rows → change **Rate** on one → **Apply to Selected** → verify applied, numbers recompute. fileciteturn0file3

> **Next (candidate Sprint 3)**: Global inline editing (**RS1 phase 2**), **Autosave on page exit** (**SYS1**), Products bulk 2×2 icons (**A3**), **Auto‑create next schedule** (**RS3**), **History tab (RO)** (**HIS1**). fileciteturn0file1turn0file2turn0file3

---

## Dependency map & critical path

**Key dependencies**
- **Rob’s connected test data → Deposit Reconciliation workspace** (DEP1) end‑to‑end calculations. **Critical path.** fileciteturn0file1  
- **Status logic (RS4) → Auto‑create (RS3)** (needs clear Product Billing Status & stage‑driven statuses). fileciteturn0file3  
- **Table selection & header cleanup (RS2) → Inline editing (RS1)** (stable table infra avoids rework). fileciteturn0file3  
- **Manage Products (A1) + Product Detail order (A2) → smoother schedule creation & testing**. fileciteturn0file0turn0file3

**Critical path notes**
1) **EXT1 → DEP1**: without connected sample data, DEP1 ships as UI + stub logic; wiring to real totals waits on data. (We’ll still demo the workspace.) fileciteturn0file1  
2) **RS4 before RS3** prevents double‑creation and status drift (month‑to‑month logic relies on status truth). fileciteturn0file3  
3) **RS2 before RS1** avoids rewriting selection/edit handlers later. fileciteturn0file3

---

## Decision gates (to avoid rework)

1) **Button label on Opportunity>Products:** **“Manage Products”** with two tabs (**Add from Catalog / Create New**) — resolves Nov 10 vs. Nov 14 wording. **ASSUMED**, please confirm. fileciteturn0file3turn0file1  
2) **Exact status labels:** Confirm **Pipeline** (Stage < Closed Won), **Pending** (Closed Won), **Reconciled/Unreconciled**, **Billing Ended** (product inactive). **ASSUMED** per 11/10 notes. fileciteturn0file3  
3) **Inline edit semantics:** Edit on a single row + **Apply to Selected**; require confirmation? **ASSUMED** one‑click apply with undo via reconciliation workflows. fileciteturn0file3  
4) **Deposit header metrics definitions:** “Usage”, “Commissions”, “Past‑Due Schedules/Amount” computed for the selected period. **ASSUMED** as defined in 11/14 redesign. fileciteturn0file1  
5) **History tab scope:** RO only; no delete/undo; which fields to display first? **ASSUMED** standard audit events. fileciteturn0file1

---

## Definition of Done by milestone (condensed)

- **Milestone Week 1 (Sprint 1):** Products can be added/created via the new modal; schedules use the new status model; split shows Last Edit; schedules list header is tidy; deposit area gated by role.  
- **Milestone Week 2 (Sprint 2):** Deposits workspace (period selector + header totals, no charts) and **Apply to Selected** in Opportunity schedule table (Qty/Price/Usage Adj/Rate) with reliable table infra.

---

## Risk register (top 5)

| Risk | Impact | Likelihood | Mitigation |
|---|---|---:|---|
| **Test data delay** blocks end‑to‑end demo of Deposits workspace | High | Med | Demo UI with stubbed dataset; maintain a **data contract** (fields/types) so wiring is quick once Rob’s file lands. fileciteturn0file1 |
| **Bulk inline editing** causes unintended mass changes | High | Med | Require **Apply to Selected** confirmation, show **selected‑count**, log to **History (RO)** for traceability. fileciteturn0file3turn0file1 |
| **Auto‑create schedules** duplicates or creates drift | High | Med | Gate on **Product Billing Status**, idempotent check (create exactly one on the 1st), unit tests. fileciteturn0file3 |
| **UI inconsistency** increases training/support cost | Med | Med | Enforce **modal sizes**, label caps, spacing, and tab underline in **UI1** before broad rollout. fileciteturn0file0 |
| **Scope creep** (e.g., Pass‑Through Rates) | Med | Med | Keep as **Later**; if prioritized, track under a **separate change order**; avoid touching revenue schedule data model now. fileciteturn0file0 |

---

## Client‑facing summary (one paragraph)

Over the next two weeks we’ll ship two clear wins: **Week 1**, you’ll be able to **add or create products in one guided pop‑up** and see cleaner, status‑aware revenue schedules with clear **Last Edit** context. **Week 2**, your team will work in a **focused Deposits workspace** (no charts), with a **period selector** and totals that surface what matters, while accountants can **bulk‑adjust schedules in‑table** using a safe **Apply to Selected** workflow. We’ve sequenced work to minimize rework (statuses before automation; table infra before inline edits) and to stay inside the current change order scope (no ‘revenue schedule redesign’). fileciteturn0file0turn0file1turn0file3

---

### Appendix — feature/area grouping (for tickets)

- **Products:** A1, A2, A3 (Now/Next). fileciteturn0file0turn0file3turn0file1  
- **Revenue Schedules:** RS2, RS4, RS6 (Now); RS1, RS3 (Next/Later). fileciteturn0file3  
- **Reconciliation:** SEC1, DEP1 (Next) + EXT1 dependency. fileciteturn0file1  
- **Audit/History:** HIS1 (Later). fileciteturn0file1  
- **Platform/UI:** SYS1, UI1. fileciteturn0file2turn0file0

---

#### Open items flagged as **ASSUMED** (please confirm)
- Team capacity 10 dev‑days/week; 2 devs; parallel allowed.  
- Button label and structure on Opportunity>Products (**Manage Products** with **Add from Catalog/Create New**). fileciteturn0file3turn0file1  
- Status label set and exact field names for deposit header totals. fileciteturn0file3turn0file1

If you’d like, I’ll turn the “Now” items into individual, implementation‑ready tickets next.
