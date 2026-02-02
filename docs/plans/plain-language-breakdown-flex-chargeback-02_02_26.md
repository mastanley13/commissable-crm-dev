According to a document from **January 22, 2026**, the main gaps to “finalize Chargebacks \+ FLEX behaviors in-product” are: **(1)** implement Flex chargeback handling, **(2)** add a missing **Manager Approval** workflow for chargebacks, and **(3)** change chargeback status labeling from **“Pending” → “In Dispute.”**

Below is a plan-language breakdown you can turn directly into implementation tickets.

---

## **Scope anchor (what “done” means)**

### **What the specs say chargebacks are**

* **Negative deposit lines** must create a **Chargeback Revenue Schedule** tagged **“-CB”**; reversals create **“-CB-REV”**, and both must be visible in reporting.  
* Chargeback handling is explicitly called out as part of Milestone 3 exception handling: **“Negative amounts \= chargebacks.”**

### **What the product must show**

* The reconciliation workbench should visually distinguish **CB** and **CB‑REV** with badges/indicators, and support a permissioned approval path for chargebacks.

### **What the meetings add (the “gap fix”)**

* **Implement Flex chargeback handling** (explicit action item).  
* **Manager approval workflow is missing** and must be implemented; chargebacks should show as **“In Dispute”** instead of “Pending.”

This work is already normalized as ticket **CRM‑FLEX‑001** (P0) in the meeting-derived tracker: manager approve/reject \+ “In Dispute” label.

---

## **Workstream A — Implement Flex chargeback handling (end-to-end behavior)**

### **A1) Detection \+ creation rules (backend)**

**Requirement**

* When a **deposit line item amount is negative**, the system must treat it as a chargeback and create a dedicated **Chargeback Schedule** (tag **\-CB**).  
* If a reversal comes in, create a paired **\-CB-REV** schedule and ensure both appear in reporting.

**Implementation-ready tasks**

* Add/confirm a chargeback “type” on created exception schedules:  
  * `CB` vs `CB-REV` (or equivalent enum / suffix tagging).  
* Persist the linkage:  
  * `source_deposit_line_id` on the created schedule (so audit and traceability are preserved).  
  * **ASSUMED:** `related_schedule_id` (link the CB to the original “normal” schedule if it was matched/identified) and `related_chargeback_id` (link reversal back to CB).  
    *Why assumed:* the spec requires paired badges (CB‑REV “paired”) and reporting clarity, which is easiest if schedules can reference each other.

**Acceptance criteria**

* Upload a deposit file containing a negative line:  
  * System creates a schedule whose identifier/tag indicates **\-CB**.  
  * The deposit line can be allocated/handled without corrupting other matches.  
* Upload a reversal:  
  * System creates **\-CB-REV** and links/pairs it to the CB.

---

### **A2) UI surfacing in the reconciliation workbench \+ schedule views (frontend)**

**Requirement**

* Reconciliation workbench should show visual indicators for **CB** and **CB-REV** and display statuses appropriately.

**Implementation-ready tasks**

* Add CB/CB‑REV badges/icons in:  
  * Reconciliation top grid (deposit lines)  
  * Bottom grid (candidate schedules) and any “confirmed allocations” section (if present)  
* Schedule detail view: show CB/CB‑REV in the schedule timeline / related items list.

**Acceptance criteria**

* A chargeback schedule is clearly distinguishable from normal and FLEX schedules (badge \+ label).  
* A reversal is clearly distinguishable and “paired” (CB‑REV badge \+ link).

---

### **A3) FLEX tracker / management queue integration**

**Requirement**

* The workflow spec expects exception items (including chargebacks) to be trackable and queued for review (management review queue, filters/aging/assignment).

**Implementation-ready tasks**

* Ensure CB/CB‑REV show up in the same operational queue as other exceptions (Flex tracker / review queue) with filterable type.

**Acceptance criteria**

* Finance/ops can filter queue to “Chargebacks” and see all pending review items.

---

## **Workstream B — Manager approval workflow for chargebacks**

### **B1) Define who can approve (RBAC)**

**Requirement**

* Sales Manager role includes **“Approve disputed items.”**  
* Accounting has full reconciliation control and can **“Process chargebacks.”**  
* System configuration explicitly calls out a role matrix for who can **approve chargebacks**.

**ASSUMED (needs explicit confirmation later, but implementable now)**

* *Approver role:* Sales Manager (and/or Admin).  
* *Processor role:* Accounting can create/submit chargeback items into the approval queue, but cannot “final approve” unless also Manager/Admin.  
  *Why assumed:* the spec separates “approve disputed items” (manager) from “process chargebacks” (accounting).

### **B2) Approval states \+ transitions**

**Requirement**

* “Manager Approval workflow is missing” and must exist for chargebacks.  
* Ticket-level acceptance (already written): chargeback items flagged for review; manager can approve/reject.

**Implementation-ready tasks**

* Add an approval state machine on chargeback items (schedule or deposit-line-level, depending on your data model):  
  * `Awaiting Approval` → `Approved` or `Rejected`  
  * Record approver \+ timestamp \+ mandatory reason/comment (auditability aligns with “audit trail for every change”).  
* Add UI actions:  
  * “Approve Chargeback”  
  * “Reject Chargeback”  
  * Both require a comment/reason (ASSUMED, but strongly aligned with audit requirements and other “must provide reason” patterns in the product).

**Acceptance criteria**

* Chargeback item appears in a review queue as **Awaiting Approval**.  
* Manager can approve/reject.  
* Approval decision is captured in audit history (who/when/what).

---

## **Workstream C — Update chargeback status to “In Dispute” (and keep status model consistent)**

### **C1) What’s in the specs**

* Revenue Schedule list includes **Schedule Status** and an **“In Dispute”** indicator/field.  
* Schedule status logic includes **“Disputed \= Problem needs resolution.”**

### **C2) What the meeting requires**

* Change chargeback status from **“Pending” → “In Dispute.”**

### **C3) Plan to implement without breaking the spec (recommended mapping)**

**ASSUMED (because “Pending” isn’t defined in the Milestone 3 spec, but is referenced as current behavior)**

* Treat **“In Dispute” as the UI label** shown when:  
  * `schedule_status = Disputed` **and/or** dispute flag is set (since the spec has both a Schedule Status and an “In Dispute” field).

**Implementation-ready tasks**

* Update any existing enum/label currently rendering **“Pending”** for chargebacks to render **“In Dispute.”**  
* Ensure “In Dispute” is filterable wherever schedule status/dispute is filterable (Revenue Schedule list \+ reconciliation views).

**Acceptance criteria**

* Any chargeback awaiting approval displays **Status: In Dispute** (not Pending).  
* Managers can filter to disputed/in-dispute items and act on them.

---

## **Dependencies & sequencing (so engineering can implement cleanly)**

### **Hard dependencies (do these first)**

1. **Status model alignment across entities**  
   Chargebacks touch schedule status, deposit line status, reconciliation views. Jan 22 also calls out a broader “consistent statuses across entities” effort (Billing Status \+ alignment). If these are mid-change, implement chargebacks against the “target” status model to avoid rework.  
2. **RBAC/permissions**  
   Approval workflow requires the role matrix to be wired correctly (manager vs accounting vs admin).

### **Recommended build order**

**NOW (blocking “finalized in-product”)**

* A1 Detection \+ \-CB/-CB-REV creation  
* C1/C2 Status labeling: “Pending” → “In Dispute”  
* B1/B2 Manager approval minimal path (queue \+ approve/reject \+ audit)

**NEXT (makes it operationally complete)**

* A2 Full UI badges \+ schedule timeline pairing  
* A3 Queue filters \+ aging/assignment for chargebacks in tracker

**LATER (polish \+ scale)**

* SLA timers/escalations/notifications for chargebacks (mentioned as a general capability for exception workflows).

---

## **Open items to explicitly flag (so we don’t accidentally build the wrong thing)**

1. **Where does “approval” gate the workflow?**  
   ASSUMED options:  
* (A) Deposit can be reconciled, but chargeback schedule stays “In Dispute” until approved; or  
* (B) Deposit finalization is blocked until manager approves chargeback line(s).  
  *Not explicitly stated in the snippets; needs a decision.*  
2. **Is “In Dispute” a separate boolean/flag or the actual status enum?**  
   Specs show both **Schedule Status** and an **In Dispute** field/flag, while the meeting references replacing “Pending” with “In Dispute.”  
3. **Does CB‑REV also require manager approval?**  
   ASSUMED: yes, if it impacts financial reporting similarly; but the explicit requirement is “approval workflow for chargebacks” generally, not distinguishing reversals.

---

If you want, I can also rewrite the above as **exact ticket text** (titles \+ descriptions \+ acceptance criteria \+ edge cases) aligned to **CRM‑FLEX‑001** and any sub-tickets you want to break it into.

