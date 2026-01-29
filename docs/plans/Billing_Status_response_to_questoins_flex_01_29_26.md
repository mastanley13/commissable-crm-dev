According to documents from **January 21–26, 2026** (plus the Milestone 3 reconciliation specs), your Billing Status notes are **directionally aligned** with what we discussed—but your instinct that it’s **not “100% complete” until the remaining checklist items land** is also consistent with how we’ve been treating reconciliation-grade features (auditability + workflow closure + rollout validation).

Below is a review of your plan + **answers to the Questions / Potential Discrepancies** section, grounded in the knowledge base.

---

## 1) Quick verification: does your shipped behavior match the Jan 21/22/26 meetings?

### ✅ Billing Status exists to fix “status confusion” + improve reporting/filtering

In the **Jan 22** meeting we explicitly called out the need for a billing-status-like field and noted we currently have multiple “status” layers (product, schedule, deposit line item, deposit). We also created an action item to **fix billing status logic across product/revenue/deposit** to support reporting and clarity.

### ✅ Chargebacks should read “In Dispute” (not “Pending”)

Jan 22 discussion: chargebacks should be labeled **“in dispute”** rather than “pending.” Your rule “chargebacks In Dispute immediately on creation; approval doesn’t auto-clear” aligns with that direction (approval is a separate gate; it shouldn’t silently remove the item from the work queue).

### ✅ “Open vs settled vs reconciled” matches the broader reconciliation workflow

Our workflow docs distinguish a mid-stream state (“settled”/allocated) from final “reconciled” after batch/deposit reconciliation. Your “Open includes the period between applying matches and finalizing the deposit” and “Reconciled only after finalize” matches the overall intent that **finalization is the point of truth for reconciliation completion**.

### ℹ️ Jan 26 meeting doesn’t introduce new Billing Status requirements

The Jan 26 transcript chunk in the knowledge base is focused on reconciliation UI layout/column alignment and a commission rate calculation fix—not billing status semantics.

---

## 2) Review of your plan for the remaining unchecked items

### A) Automated Billing Status auditing — **Strongly aligned**

Multiple specs emphasize **audit trail for every change**, including reconciliation actions, propagation, and FLEX workflows. Centralizing audit payload shape + ensuring each billingStatus-changing codepath writes an audit entry is consistent with that requirement theme.

**One potential discrepancy to watch:**
You listed “chargeback approval transition” as an example audit assertion. But your shipped semantics say **approval doesn’t clear disputes automatically**, meaning billingStatus may **not** transition on approval. In that case, the test should assert either:

* “approval logs an approval audit event” (separate from billing status), or
* “billing status remains In Dispute on approval” (and therefore no billingStatus transition audit row should exist for approval).
  (That’s not contradicted by docs—just making sure your tests match your own rules.)

### B) “Flex resolved” UX + API — **Aligned, but make sure ‘resolve’ maps to the spec’s management intent**

Our workflow docs describe FLEX items as requiring management review, being tracked in a queue/tracker, and maintaining audit trails for **creation + resolution**.

They also describe resolution as something like: **convert to permanent schedule** or **apply to existing schedule** (i.e., a management decision).

So your MVP “Resolve Flex = clear dispute without changing allocations” can fit, but only if we treat it as a legitimate resolution outcome (e.g., “accepted as one-time / no further classification required”). If later UX requires mapping FLEX into catalog/product structure, you’ll want the endpoint to evolve from a single “resolve” into “resolve with resolutionType”.

### C) applyToFuture scope guard — **Definitely aligned / required**

Multiple places describe forward propagation as an explicit concept and also emphasize history preservation:

* There is an explicit **Propagation Toggle**: “This only” vs “this + future.”
* Flex product and schedule changes include the idea that edits/changes can apply forward, but should not rewrite history (“history preserved”).
* Quick reference guidance: “changes only affect future schedules; historical schedules remain unchanged.”

So your guardrail tests and “do not flip unrelated schedules outside scope” plan is exactly the right kind of protection.

### D) Side-by-side validation (old vs new) — **Good rollout hygiene**

Not explicitly demanded in specs, but it’s a smart safety step given we have legacy dispute concepts (status/flags) and now a first-class billingStatus.

---

## 3) Answers: Questions / Potential Discrepancies

### Q1) Where should “Flex resolved” live UX-wise: Flex Review queue or Revenue Schedule detail (or both)?

**Recommendation (aligned with docs): put it in BOTH, with the queue as primary.**

Why:

* Specs describe a **Flex Tracker / management review queue** as the operational place FLEX items are managed (“appears in Flex tracker”, “FLEX Management Queue… require management review”).
* Specs also describe **Schedule Detail** having an audit trail tab and propagation controls, which makes it a reasonable secondary place for the same action.

**Implementation-ready guidance:**

* Primary: “Resolve” (or “Mark Reviewed / Resolved”) action in Flex Review queue/tracker for throughput.
* Secondary: same action available from the revenue schedule detail page for deep investigation / edge cases.
* Both should write the same audit entry structure.

---

### Q2) Should resolving a Flex Product clear dispute on both the flex schedule and its parent/base schedule, or only one (and which one)?

**What the documents say:**

* The workflow docs say FLEX is created and put into a management review queue, and admins can **convert to permanent schedule or apply to existing schedule**.
* The documents do **not** explicitly define “parent/base schedule billing status should flip when a FLEX is created/resolved.”

So this one is not fully specified; your current “parent/base also set to In Dispute on flex overage” is a **design choice** (not directly confirmed or denied by the specs).

**Recommended rule (ASSUMED, but consistent with the “apply to existing vs convert to permanent” model):**

* Always clear the **FLEX schedule** from In Dispute when it is resolved (because the queue item is resolved).
* Clear the **parent/base schedule** *only when* the resolution action actually applies/rolls the flex into the parent/base schedule (“apply to existing schedule”).

If the resolution is “convert to permanent schedule” (or “accepted as one-time flex”), the parent/base schedule may not need to change.

**Why this is safer:**

* It prevents “accidentally clearing” a parent schedule that may be in dispute for other reasons.
* It aligns with the idea that resolution action type matters (apply vs convert).

**If you keep the current “parent gets In Dispute when flex overage exists” behavior:**
Make sure the resolution endpoint supports clearing both in one transaction and writes audit entries for both entities.

---

### Q3) For applyToFuture: do you want billingStatus automation enabled for those future schedules by default, or only when explicitly requested (feature flag / checkbox)?

**Answer: explicitly requested (not default).**

Grounding:

* The workflow explicitly calls out a **Propagation Toggle: “This only” vs “this + future.”**
* We repeatedly emphasize that forward changes should preserve history / not rewrite past schedules.

**Implementation-ready interpretation:**

* BillingStatus recompute/automation should run for the schedules in scope of the applyToFuture operation **only when the user selects apply-to-future**.
* No global “default apply-to-future” for billingStatus changes.
* The scope guard test you described is exactly the enforcement mechanism.

---

### Q4) For side-by-side validation: what is the authoritative “old dispute” definition we should compare against?

**Best “authoritative old definition” from the specs is the explicit dispute constructs—not variance heuristics.**

Grounding:

* Milestone 3 defines **Schedule Status Logic** including “Disputed = problem exists; user must approve disputed items to process” and also mentions an **In Dispute flag** in the schedules module. That’s the spec-level definition of “dispute,” not “overpaid.”
* Over/under payments are treated as variance/exception flows (FLEX creation, underpaid aging), which are not necessarily the same thing as “in dispute.”

**Therefore, for side-by-side:**

1. Compare **legacy inDispute flag / Disputed status** (whatever is currently stored/served by the system) against `billingStatus = InDispute`.
2. Separately report “variance exceptions” (Overpaid/Underpaid/FLEX/CB) if you want operational insight—but don’t treat them as the canonical “old dispute” definition unless legacy code did so.

**One nuance to include (based on Jan 22):**

* If chargebacks were previously treated as “pending” but are intended to be “in dispute,” include them in your mismatch review so the report highlights those conversions clearly.

---

## 4) So… is Billing Status “completed”?

Using your own checklist framing (and consistent with our general spec posture that auditability + workflow closure matters), I’d characterize it as:

* **P0 complete / usable**: the core lifecycle and filtering semantics are in place.
* **Not “done-done”** until:

  * automated auditing is complete (audit trail is a first-class requirement theme),
  * flex “resolved” closure exists in the queue/tracker workflow,
  * applyToFuture scope is locked down (history preserved),
  * side-by-side validation confirms no regressions.

---

If you want, I can also turn your remaining-items plan into **implementation-ready tickets** (API/UI/audit/tests), but the answers above should unblock the decisions you flagged.
