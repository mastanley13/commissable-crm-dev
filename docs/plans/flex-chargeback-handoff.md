According to documents from **January 21–22, 2026** (meeting summary + transcript) and the **Milestone 3 Reconciliation Specifications / Reconciliation SOW**, below is a coding-agent handoff that outlines the **Flex** and **Chargeback** workflows end-to-end, using only what’s in the provided knowledge base. 

---

# Handoff: Flex & Chargeback Workflows (Reconciliation Module)

## 0) Glossary and terms used in the docs

### Revenue Schedule (RS)

Expected usage/commission event with a unique schedule ID. After reconciliation, a schedule “closes” and is typically not reconciled again unless reopened by admin/manager. 

### Flex Schedule / Flex Product

A special schedule created to capture exceptions (especially **overages** / **unmatched**). Tagged in UI/reports with “**-F**”. 

> Important naming ambiguity in transcripts: **“Flex schedule”** is also used (Jan 21) to describe a **month-to-month continuation feature**. The reconciliation exception object is also called flex. Treat these as separate concepts unless/until unified. 
>
> Decision (Milestone 0): treat **month-to-month continuation** as the **schedule extension** workflow, and treat **Flex** as a **reconciliation-time variance/exception** workflow (see `Reconciliation System.docx.md`). 

### Chargeback Schedule

Special schedule for **negative deposits**. Tagged “**-CB**”. 

### Chargeback Reversal Schedule

Schedule created when a chargeback is reversed. Tagged “**-CB-REV**”. 

---

## 1) Workflow entry points (where Flex/CB is created)

### 1.1 Core reconciliation flow context (where exceptions happen)

* Import creates **Deposit** + **Deposit Line Items**.
* Matching engine suggests RS candidates; on approval, system writes Actual Usage/Commission, computes variance, marks line settled, and logs audit. 
* Batch finalization: when all lines are allocated/flagged, submit batch; **Deposit → Reconciled** and show summary/exceptions. 

### 1.2 Flex creation triggers (exception handling)

The knowledge base indicates Flex schedules are created for:

1. **Overage**: deposit exceeds expected; system auto-creates Flex RS tagged “-F”; default schedule date is the **Deposit month period** (`Deposit.month`, i.e., first of the report month); admin notified; appears in Flex tracker. 

2. **All unmatched / no match**: Milestone 3 explicitly states “FLEX schedules for all unmatched”. Also: “Below 70% match = no match, create flex schedule.” 

   * Implementation note (Milestone 0): “70% match” refers to the **confidence thresholds** in Reconciliation Settings:
     * **Suggested Matches Display Confidence** (what to show as suggestions to the user),
     * **AI auto match confidence** (what’s required for automation to propose/apply matches). 

3. **Commission-only deposits (no RS found)**: create Flex with Usage = Commission and Rate = 100%. 

4. **Underpayment** is referenced as an exception category; Milestone 3 lists a “FLEX-U underpayment” type, and the SOW says underpayment marks RS partially paid/underpaid and keeps balance/aging. (This is adjacent to Flex but may be implemented as a status rather than a “-F” schedule, depending on how you interpret both docs.) 

### 1.3 Chargeback creation triggers

* **Negative amounts = chargebacks** (Milestone 3). 
* SOW edge case: “Negative deposit: Create Chargeback RS (-CB); reversal creates CB-REV; show both in reports.” 

---

## 2) Required naming conventions & tagging

From the Jan 22 “FLEX Discussions” section:

* Flex: `RS-XXXXXXX-F`
* Chargeback: `RS-XXXXXXX-CB`
* Chargeback reversal: `RS-XXXXXXX-CB-REV`

From the SOW:

* Flex tagged “-F” in UI/reports.
* Chargeback tagged “-CB”; reversals tagged “-CB-REV”. 

UI indicators:

* Visual indicators for Flex, CB, and CB-REV are explicitly called out (Flex highlight; CB negative badge; CB-REV paired badge). 

---

## 3) Flex workflow (creation → queue → resolution)

### 3.1 Flex creation (system behavior)

Minimum behaviors specified:

* When triggered, system creates a **Flex schedule** tagged “-F”. 
* Default schedule date = the **Deposit month period** (`Deposit.month`, i.e., first of the report month) and user can edit pre-reconciliation. 
* Admin notified; Flex appears in Flex tracker. 
* Dedicated tracking/reports and “review tasks” / aging exist for Flex. 

**Flex types (Milestone 3 “Handle Exceptions”):**

* `FLEX-O` (overage)
* `FLEX-U` (underpayment)
* `FLEX-B` (bonus)
* `FLEX-CB` (chargeback) 

> Note: This “FLEX-CB” classification conflicts a bit with the separate “-CB” / “-CB-REV” tagging approach described elsewhere. Keep both requirements visible to avoid implementing only one interpretation. 

### 3.2 Flex queue / operational routine

Daily workflow explicitly includes:

* “Check FLEX Queue: Review overnight FLEX products”
* “Clear Exception Queue: Red alerts requiring action” 

### 3.3 Flex product management / resolution options (Jan 22 “FLEX Discussions”)

All Flex products require management review and are visible in reporting/dashboard widgets.

The document specifies three resolution paths:

#### Option A — Apply to Existing Schedule

* Add overage amount to original schedule
* Delete Flex product after updating original schedule
* Requires approval

#### Option B — Convert to Regular Schedule

* Find correct product and rename Flex product
* Update revenue schedule details
* Convert to normal recurring product

Additional requirements from the same Jan 22 meeting doc:

* **When converting**, system should prompt whether the flex should be treated as **one-time or recurring**.
* If it’s a recurring product, the system must **create additional schedules** (beyond the initial flex instance).

Also: when converting/renaming, require user to specify **product family and subtype** to filter the product catalog and improve search.

#### Option C — Bonus Commission Scenario

* For one-time commissions, apply **100% commission rate** to match the deposit amount

### 3.4 “Flex product workflow” requirements (Jan 22 meeting summary)

The Jan 22 meeting summary adds an implementation-specific expectation:

* Flex products are created as an **opportunity product tied to the opportunity’s vendor/distributor**.

> This is important because the SOW defines “Flex Schedule” as a special RS record; Jan 22 describes creating an “opportunity product” as part of the flow. Make sure the code agent doesn’t implement only one layer. 

---

## 4) Chargeback workflow (creation → dispute/approval → reversal)

### 4.1 Chargeback creation behavior

Baseline from SOW:

* Negative deposits create **Chargeback schedules** tagged “-CB” with **negative expected usage/commission**. 
* Reversals generate **CB-REV schedules**; both are shown for audit/reporting. 

### 4.2 Chargeback status + “In Dispute” requirement (Jan 22)

The Jan 22 meeting summary indicates a current mismatch between expected vs current labeling:

* Chargebacks are currently being labeled **“pending”**, but they **should be “in dispute”**. 

### 4.3 Admin approval workflow for chargebacks (Decision locked)

* Decision (Milestone 0): **Admin approves chargebacks**.
* The meeting notes mention a “manager approval” requirement; implement this as **Admin-only** approval via RBAC/permission matrix unless/until the role mapping is changed.
* There is currently **no UI** for chargeback approvals; this is a gap to implement. 
* The SOW also calls out that the permission matrix must cover “approve chargebacks.” 

### 4.4 Chargeback scenario flow (Workflow Overview “Scenario E”)

A concrete scenario is documented:

* Deposit line item = **-$1,000** associated with a previously reconciled schedule.
* System creates a **Chargeback schedule** tagged `-CB`, and the original schedule is **not modified**.
* Chargeback schedule is marked as **Disputed** and requires **admin approval**.
* Later, if a reversal occurs, system creates a separate schedule tagged `-CB-REV` (positive amount).

> This is the clearest end-to-end narrative for CB/CB-REV creation + “don’t modify the original schedule” + approval gating. It should be treated as the canonical chargeback flow unless superseded.

---

## 5) Roles & permissions (who can do what for Flex/CB)

Milestone 3 RBAC explicitly states:

* **Salesperson**: no access to reconciliation module. 
* **Sales Manager**: can approve disputed items and do manual match override. 
* **Accounting**: full reconciliation module; can upload deposits, match/unmatch, **create FLEX schedules**, and **process chargebacks**. 

Milestone 0 decision clarification:

* **Chargeback approvals are Admin-only** (even if Sales Manager can approve other dispute items).

This aligns with the broader SOW note that permissions include who can approve chargebacks and who can undo. 

---

## 6) UI/workbench actions relevant to Flex & Chargebacks

Workbench actions explicitly include:

* Approve, Split, FIFO apply
* **Create Flex**
* **Mark Underpaid**
* Undo (manager)
* Propagate changes 

And visual indicators:

* Flex highlighted
* CB negative badge
* CB-REV paired badge 

Tracking:

* Flex Tracker log with aging + assignment and filters. 

---

## 7) API surface (illustrative endpoints called out in SOW)

The SOW includes example endpoints that the coding agent can map to the implementation:

* `POST /schedules/flex` (create Flex RS)
* `POST /schedules/chargebacks`
* `POST /chargebacks/reverse` 

It also proposes a data shape where RevenueSchedule has flags `[FLEX|CB|CB_REV]`. 

---

# Implementation checklist (what your coding agent should build)

## A) Flex

1. **Flex creation** when:

   * overage exists (deposit exceeds expectation) → create “-F” schedule and notify/admin task. 
   * no match / unmatched lines (including “<70% match” rule) → create “-F” schedule. 
   * commission-only deposit with no RS found → create “-F” schedule with Usage=Commission, Rate=100%. 

2. **Naming / tagging**: `RS-XXXXXXX-F` and visible in UI/reports.

3. **Default dating** (Decision locked — not tenant-configurable):

   * Default Flex schedule date to the **Deposit month period** (`Deposit.month`, i.e., first of the report month). 

4. **Flex queue/tracker**:

   * Create admin notification + tracking entry; appears in Flex tracker with aging/assignment. 
   * Daily routine includes “Check FLEX Queue”. 

5. **Resolution UI/actions** (must exist):

   * Apply to existing schedule (approval required; delete flex after).
   * Convert to regular schedule (rename/find correct product; update schedule details; treat as normal product).
   * Bonus commission path (100% commission rate).
   * Conversion flow prompts: one-time vs recurring; if recurring create additional schedules.
   * Conversion flow prompts: require family + subtype.

6. **Data model alignment**:

   * Jan 22: create flex as an *opportunity product* tied to vendor/distributor.
   * SOW: flex is a special RS record (tag “-F”). 

## B) Chargebacks

1. **Chargeback creation**:

   * Negative deposit → create “-CB” schedule with negative expected usage/commission. 

2. **Chargeback reversal**:

   * Reversal creates “-CB-REV” schedule; show both in reports/audit. 

3. **Naming convention** (per Jan 22):

   * `RS-XXXXXXX-CB`
   * `RS-XXXXXXX-CB-REV`

4. **Status / dispute labeling**

   * Change “pending” labeling to “in dispute” for chargebacks. 

5. **Approval workflow**

   * Implement **admin** approval UI (confirmed missing) and enforce it via RBAC/permission matrix. 
   * Scenario E: chargeback schedule marked Disputed; requires admin approval; original schedule not modified; reversal produces separate CB-REV schedule.

---

# Known ambiguities / do-not-assume items (flag for product decision)

1. **Flex schedule date rule conflicts**
   Decision (Milestone 0): do **not** make this tenant-configurable. Default Flex schedule date to the **Deposit month period** (i.e., `Deposit.month`, which should represent the first of the report month).

2. **Flex vs month-to-month continuation terminology conflict**
   Decision (Milestone 0): use **Schedule Extension** terminology for M2M continuation, and use **Flex** only for reconciliation-time exceptions/variance management.

3. **Chargebacks as FLEX-CB vs dedicated -CB/-CB-REV**
   Decision (Milestone 0): keep chargebacks aligned with the **variance management model** (internal classification/reason codes), and display/tag schedules as `-CB` / `-CB-REV` in UI/reports.

4. **Who approves chargebacks (manager vs admin)**

* Decision (Milestone 0): **Admin approves chargebacks**.

# Comprehensive implementation plan (from repo findings)

> Scope: reconciliation-time **Flex** (overage/unmatched/unknown product) and **Chargeback** (negative line + reversal) workflows, including queues, approvals, resolution actions, auditability, and reporting.

## 8) Definition of done

**Flex is “done” when:**

* Creating a Flex schedule is deterministic and traceable (source deposit/line, reason code, linked parent schedule if applicable).
* Flex schedules reliably appear in an operational queue with assignment + aging.
* Flex items can be resolved via:
  * Apply to existing schedule, or
  * Convert to regular schedule (with one-time vs recurring + additional schedules), or
  * Bonus commission (100% rate) path when applicable.
* Billing Status semantics are correct and do not auto-clear disputes without explicit settlement/resolution.

**Chargebacks are “done” when:**

* Negative lines create a `-CB` schedule and enter a pending approval state (match is not applied until approved).
* CB reversal lines create a linked `-CB-REV` schedule and also require approval.
* The “negative commission, no usage” normalization rule is enforced consistently.
* Approvals are gated by the correct role/permission and are fully audited (who/when/decision/notes).

**Operationally “done” when:**

* Reporting can isolate Flex/CB/CB‑REV and show parent/child linkage.
* A repeatable smoke dataset + automated tests exist for all core scenarios.

## 9) Repo findings snapshot (what already exists)

These are **implementation signals found in the codebase** (validate via a smoke dataset):

* Naming/tagging helpers exist: `-F`, `-CB`, `-CB-REV` display suffixes (`lib/flex/revenue-schedule-display.ts`).
* Flex Product split creation exists and enqueues a review item (`lib/flex/revenue-schedule-flex-actions.ts`).
* Chargeback + chargeback reversal creation exists and enqueues review items; both are created as `billingStatus=InDispute` when billing-status automation is enabled (`lib/flex/revenue-schedule-flex-actions.ts`).
* A “Flex Review Queue” UI exists with assignment + aging filters and actions to **approve & apply** and **resolve** items (`app/(dashboard)/reconciliation/flex-review/page.tsx`).
* Approval endpoints exist for chargeback/CB‑REV pending matches and are permission-gated by `reconciliation.manage` (`app/api/flex-review/[itemId]/approve-and-apply/route.ts`, `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/approve-flex/route.ts`).

**Known gaps vs the Jan 21–22 workflow docs (based on repo scan):**

* “Flex resolution” actions are not implemented end-to-end yet (Apply to existing / Convert to regular / One-time vs recurring + create additional schedules). Current “resolve” appears to only mark the queue item resolved/rejected (no schedule/product mutation).
* Chargeback normalization rule (negative commission with no usage → set usage to abs(commission) and rate 100%) is specified in the reconciliation spec but not clearly implemented in chargeback creation.
* Approval is currently gated by `reconciliation.manage` (broad); Milestone 0 decision requires **Admin-only** chargeback approvals, so RBAC/permissions must be tightened.

---

## 10) Decisions locked (Milestone 0)

These are locked in based on stakeholder direction:

1. **Who can approve chargebacks?**
   * **Admin** approves chargebacks.
   * Implementation: enforce Admin-only approval (recommended: a dedicated permission assigned to Admin, rather than relying on broad `reconciliation.manage`).
2. **Chargeback modeling: FLEX-CB vs `-CB`/`-CB-REV`**
   * Keep chargebacks aligned with the **variance management** model (per `Reconciliation System.docx.md`) while UI/reporting uses `-CB` / `-CB-REV` tagging.
3. **Flex schedule dating rule**
   * Do **not** make this tenant-configurable.
   * Default Flex schedule date to **`Deposit.month` (report month period)**.
4. **Flex vs “month-to-month continuation” terminology**
   * Month-to-month continuation = **Schedule Extension**.
   * Flex = **variance/exception workflows**.
5. **Unmatched creation triggers**
   * “70%” is the confidence threshold controlled in Reconciliation Settings:
     * **Suggested Matches Display Confidence** (UI suggestions),
     * **AI auto match confidence** (automation).

---

## 11) Workstreams (what to implement)

### 11.1 Data model + settings (foundation)

* [ ] Confirm Reconciliation Settings fields used for match confidence thresholds:
  * **Suggested Matches Display Confidence**
  * **AI auto match confidence**
* [ ] (Optional safety) a feature flag/kill-switch for auto-creating Flex for unmatched lines.
* [ ] Ensure Chargeback approval state is modeled separately from Billing Status:
  * Billing Status = operational lifecycle (`Open/Reconciled/InDispute/...`)
  * Approval = governance gate (`PendingApproval/Approved/Rejected`) (can live on the queue item, the match, or a dedicated table).
* [ ] Confirm required metadata exists on schedules for traceability:
  * source deposit id, source deposit line id, parent schedule id (for split + CB-REV linkage), reason codes.

### 11.2 Reconciliation pipeline behavior (create/queue correctly)

**Flex (overage/unmatched/unknown)**

* [ ] Overage outside tolerance:
  * create Flex Product + child schedule,
  * set Billing Status rules (Flex + base schedule to `InDispute`),
  * enqueue a Flex review/tracker item for management action.
* [ ] Unmatched/no match:
  * use the confidence thresholds in Reconciliation Settings:
    * if no candidate meets **Suggested Matches Display Confidence**, treat as “no match” and create Flex per spec.
    * AI auto-match should only act when candidates meet **AI auto match confidence**.
  * enqueue for review and ensure idempotency (no duplicates on retries).
* [ ] Commission-only lines (no RS found):
  * create a Flex schedule that captures commission-only deposits using the documented rule (Usage=Commission, Rate=100%) and enqueue for review.
* [ ] Ensure idempotency:
  * repeated AI matching / retries should not create duplicate flex schedules for the same deposit line.

**Chargebacks**

* [ ] Negative deposit line detection:
  * create `-CB` schedule and queue item,
  * create a **pending/suggested** match (not applied) until approval,
  * preserve “original schedule not modified” (Scenario E).
* [ ] **Normalization rule (spec):** if commission is negative and usage is missing/zero, set:
  * Actual Usage = abs(commission),
  * Commission Rate = 100%,
  * Commission remains negative.
* [ ] Chargeback reversal:
  * require selecting/linking the parent chargeback schedule,
  * create `-CB-REV` schedule and pending match, queue for approval.

### 11.3 Queue / tracker UX (operational workbench)

* [ ] Ensure the queue shows, at minimum:
  * classification badge (F / CB / CB‑REV),
  * reason code,
  * age/aging,
  * assignment + “assign to me/unassign”,
  * links to deposit, deposit line, and schedule.
* [ ] Add queue filters needed for real ops:
  * vendor/distributor, customer account, amount thresholds, reason code, classification, age, status, assignee.
* [ ] Add bulk actions (optional but high leverage):
  * bulk assign, bulk approve, bulk resolve/reject.
* [ ] Notification strategy:
  * decide and implement “admin notified” requirement (in‑app notification, email, or task list).

### 11.4 Flex resolution workflows (the big missing piece)

Implement these as **actual mutations** (not just marking the queue item resolved) with audits and recompute:

**Option A — Apply to existing schedule**

* [ ] UI action: select target schedule(s) to absorb the flex amount.
* [ ] Backend: move allocation/expected adjustments per the chosen model, recompute status, then delete/retire the flex schedule.
* [ ] Audit: record who approved, what moved, and why.

**Option B — Convert to regular schedule**

* [ ] UI modal: require Family + Subtype → filter catalog → choose product.
* [ ] Prompt: one-time vs recurring.
* [ ] If recurring: create N additional schedules (rules to define: cadence, end date, collisions).
* [ ] Convert flex schedule(s) into a “normal” schedule/product association.
* [ ] Audit: record old/new product, recurrence choice, schedules created, and reason.

**Option C — Bonus commission scenario**

* [ ] UI + backend path to treat as one-time commission with 100% rate where required by the spec.

**Billing Status clearing rules**

* [ ] Only clear `InDispute` on explicit settlement/resolution outcomes (align with the Billing Status lifecycle spec); do not auto-clear on approval alone.

### 11.5 Chargeback admin approval workflow (UI + RBAC)

* [ ] Implement an approval UI surfaced where chargebacks are reviewed (queue page or reconciliation page).
* [ ] Enforce RBAC:
  * enforce **Admin-only** approval in the approval endpoint(s) (recommended: dedicated permission assigned to Admin).
* [ ] Approval audit trail:
  * approver id, timestamp, decision (approve/reject), notes, and affected match ids.

### 11.6 Reporting + audit completeness

* [ ] Reporting views/exports:
  * filter/group by flex classification and reason code,
  * show CB + CB‑REV pairs and linkage (parent/child).
* [ ] Audit coverage for every action:
  * create flex/chargeback/reversal, approve, resolve/reject, apply-to-existing, convert-to-regular, schedule deletes, and any billing status transitions.

### 11.7 Testing + validation

* [ ] Create a repeatable smoke dataset and script these scenarios end-to-end:
  * overage within tolerance → adjustment,
  * overage above tolerance → flex product created → resolve via Option A and Option B,
  * unknown product → flex product created → convert,
  * negative line → chargeback pending approval → approve → verify status,
  * reversal line → CB‑REV pending approval → approve → verify linkage.
* [ ] Add automated tests for:
  * billing status transitions (flex/CB/CB‑REV),
  * chargeback normalization rule,
  * approval RBAC gates,
  * idempotency (no duplicate schedules created on retries).

---

## 12) Milestone status (as of Feb 2, 2026)

### Milestone 1 — Chargebacks complete (3–7 days)

**Implemented (code):**

* Chargeback normalization: negative commission with zero usage now sets usage = abs(commission) and commissionRate = 100%.
* Admin-only approval gate enforced at API level (approve & apply endpoints) and UI disabled for non-admins.

**Still needs verification (smoke + data):**

* Confirm CB‑REV creation + approval flow in the Flex Review Queue.
* Confirm audit trail for approvals (approver + timestamp) is visible in the audit view you rely on.

**Milestone 1 status:** **Mostly complete** (pending verification checks above).

### Milestone 2 — Flex resolution complete (4–10 days)

**Go/No‑Go:** OK to start once the two verification items above are validated in the UI.

---

**Progress update (Feb 2, 2026):** Milestone 2 implementation is now in place in the Flex Review Queue and API.

**Implemented (code):**

* Flex Review Queue resolves FLEX items with explicit outcomes (not just marking the queue item resolved):
  * **Option A â€” Apply to existing schedule**: adds the flex scheduleâ€™s expected usage/commission into a target schedule (defaults to parent when present), moves deposit matches, then **soft-deletes** the flex schedule.
  * **Option B â€” Convert to regular schedule**: requires **Family + Subtype** selection, filters Product catalog by vendor/distributor + family/subtype, then converts the flex schedule to a normal schedule/product. Supports **one-time vs recurring**; recurring can create additional monthly schedules.
  * **Option C â€” Bonus commission**: converts the flex schedule to a one-time bonus schedule (100% rate semantics) and clears dispute status for that schedule via an explicit resolution outcome.
* Billing Status semantics align with the reconciliation spec:
  * FLEX schedules are only cleared from **In Dispute** via an explicit resolution outcome (these actions set billing status source to Manual for the resolved schedule).
  * Parent schedule dispute is cleared **conditionally** (only when no remaining disputed flex children exist).
* Audit coverage exists for the key schedule mutations (updates, soft-delete, recurring creates) and the FlexReviewItem resolve action.

**Still needs verification (smoke + data):**

* Run end-to-end UI smoke for Option A/B/C and confirm the resulting expected amounts, matches, and billing statuses look correct in:
  * Flex Review Queue,
  * Revenue Schedule detail view(s),
  * Any Dispute/Filters views you rely on.
* Validate product catalog filtering matches the intended constraints (vendor/distributor + family + subtype).
* Confirm parent schedule dispute-clearing behavior matches the Milestone 0 clarification (only clears when appropriate; no auto-clear outside explicit actions).

**Milestone 2 status:** **Implemented** (pending verification checks above).

---

## 13) Recommended sequencing (milestones)

1. **Milestone 0 — Validate what exists (1–2 days):** run smoke dataset through queue + approval paths; document gaps.
2. **Milestone 1 — Chargebacks complete (3–7 days):** normalization + approval UI/RBAC + audit + CB‑REV linking.
3. **Milestone 2 — Flex resolution complete (4–10 days):** implement Option A/B/C end-to-end with audits + billing-status semantics.
4. **Milestone 3 — Ops polish (2–5 days):** queue filters/bulk actions, notifications, reporting hardening.

---

If you want, I can convert this into a clean `.docx` “handoff packet” formatted for engineering tickets (same content, just structured for copy/paste into your tracker).
