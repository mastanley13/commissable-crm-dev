Once a Deposit Line Item and a Revenue Schedule are matched, the specs say **“you’re not done yet”** – there are two distinct layers:

1. **Line‑level settlement (Matched/Settled state)**
2. **Deposit‑level reconciliation (final Reconciled state)**

Here’s the described workflow end‑to‑end.

---

## 1. Line‑level: what happens when you Apply a match

When you approve a suggested match (or manually match) a Deposit Line Item to a Revenue Schedule:

1. **System writes actuals to the Revenue Schedule**

   On approval, the engine:

   * Writes **Actual Usage** and **Actual Commission** from the deposit line into the Revenue Schedule.
   * Computes the **variance** between expected and actual.

2. **Status on the Deposit Line & RS moves into a “settled/matched” state**

   Specs use two slightly different words for the same concept:

   * In the workflow docs:

     > “On approval, write Actual Usage and Actual Commission; compute variance; **mark line Settled**.”
   * In the latest meeting summary:

     > A new **“Matched” status** will hold progress on deposit line items and revenue schedules before the final “Reconciled” approval.

   **ASSUMED:** “Settled” (older terminology) and “Matched” (current terminology) are the same *pre‑final* state for both the Deposit Line Item and the Revenue Schedule.

3. **How the Revenue Schedule status is updated**

   The Status Engine evaluates the differences and moves the RS through a limited set of states:

   * “Unreconciled”: newly created, awaiting payment.
   * “Underpaid”: partial payment received, balance still outstanding.
   * “Overpaid”: payment exceeds expected, triggers FLEX creation.
   * “Reconciled”: fully paid and matched to deposits.

   The POC StatusManager shows the same pattern with intermediate **SETTLED → RECONCILED** transitions and validates that only valid state jumps occur.

   **Practically:**

   * If the applied usage/commission clears the difference, the RS becomes **Matched/Settled** and is *eligible* to be flipped to **Reconciled** when the deposit is finalized.
   * If there is still a positive balance, the RS remains **Underpaid** (or Partially Paid) with updated actuals; it still participates in future deposits.

4. **Overages and FLEX schedules**

   If the deposit’s actuals exceed the RS expectations beyond the configured variance threshold:

   * For small variances within threshold, the original RS is automatically adjusted.
   * For material overages, the system creates a **FLEX Revenue Schedule** (e.g. RS‑1004321‑F) for the overage while marking both the original and FLEX schedules as **Settled/Matched** at the line level.

   All FLEX schedules then flow into a **FLEX Management Queue** for review / conversion / reclassification.

5. **UI feedback on the match**

   On the reconciliation workbench:

   * The top (Deposit Line Items) and bottom (Revenue Schedules) tables show which records are **Matched**.
   * Matching fields are visually highlighted (e.g., gray/blue) so the user can see *why* they matched.
   * Users have explicit **Match / Unmatch** actions and can also invoke AI to auto‑match within a variance threshold.

---

## 2. Deposit‑level: Finalize / Reconcile the deposit

Only after all the line‑level work is done do we “lock in” the deposit.

### 2.1 Preconditions

The Settlement & Reconciliation workflow is explicit:

> “Once all deposit line items are **settled** (matched, FLEX’d, or manually handled), system prompts user:
> ‘Accept all matches and reconcile deposit?’”

So:

* Every Deposit Line Item must be in a **resolved** state:

  * Matched/Settled to one or more RS, **or**
  * Turned into FLEX / Chargeback / other exception RS, **or**
  * Handled with a documented manual decision.
* Only then does the **Reconcile** action become appropriate for that deposit.

### 2.2 User action: “Reconcile Deposit”

From the docs and meetings:

* There is an explicit **Reconcile** control on the reconciliation UI (“Match/Unmatch, Reconcile, delete deposit, filters…”).
* When invoked, the system presents a confirmation dialog along the lines of:

  > “Accept all matches and reconcile deposit?”

Once the user confirms, the system runs a **transactional status update** across Deposit, Deposit Line Items, and Revenue Schedules.

### 2.3 Final status updates on Reconcile

The spec is very explicit about what happens:

1. **Deposit header**

   * Deposit status → **“Reconciled”**.

2. **Deposit Line Items**

   * All Deposit Line Items on that deposit move from **Matched/Settled** into **“Reconciled”**.

   In the earlier POC, this was modeled as `UNMATCHED → MATCHED → APPLIED`, with the batch update turning everything into the final applied state at deposit reconcile time.

   **ASSUMED:** In the current CRM, the final line‑level state is labeled **Reconciled** in the UI, replacing the older “APPLIED” naming.

3. **Revenue Schedules**

   After deposit reconciliation:

   * Any RS whose variance/differences are now **zero** is flipped to **Reconciled**.
   * RS with remaining positive balances stay **Underpaid** (or Partially Paid) and stay open for future deposits.
   * Overpaid cases are handled via FLEX/CB RS, but once those FLEX/CB schedules themselves are fully funded, they also pass through the same Reconciled logic.

   Critically, design docs also state:

   > Each Revenue Schedule reconciles once; multiple deposits can apply FIFO until it is fully reconciled and *closed* (admin can reopen).

   So once a RS hits **Reconciled**, it’s excluded from future candidate lists unless an admin explicitly reopens it.

4. **Audit, learning, and queues**

   * An audit log entry is written recording who reconciled the deposit, when, and the before/after states.
   * FLEX, Chargeback, and CB‑REV schedules created as part of this deposit appear in their respective queues for management review and reporting.

---

## 3. Undo / Unmatch / Unreconcile behavior

The specs *require* that reconciliation be reversible (with appropriate controls):

* **Unmatch**: Users must be able to unmatch a Deposit Line Item ↔ Revenue Schedule pair, re‑opening both the line and the RS (subject to status rules and any admin policies).
* **Unreconcile deposit**: Users must be able to **Unreconcile an entire deposit**, which conceptually rolls the Deposit status back from “Reconciled” and restores involved line and schedule states, while keeping a full audit trail.
* **Manager‑only Undo**: The Exhaustive Workflow defines `/reconciliation/undo` as a **manager‑only** endpoint that reverts matches and restores prior states.

**ASSUMED:**

* After a deposit is reconciled, **Unmatch** at the individual line level is gated by permissions and/or an Undo window, and standard users are expected to use **Unreconcile Deposit** for major corrections.

---

## 4. Reconciling the terminology

There are three slightly different naming sets across the documents:

* Early POC:

  * Deposit Line Item status: `UNMATCHED` → `MATCHED` → `APPLIED`.
  * Revenue Schedule status: `OPEN` → `PARTIALLY_PAID`/`SETTLED`/`UNDERPAID` → `RECONCILED`.

* Implementation Guide / Exhaustive Workflow:

  * Line/Schedule/Deposit status engine with **Settled vs Reconciled**, Underpaid/Overpaid flags.

* Latest meeting (Dec 02):

  * User‑facing states: **Matched** → **Reconciled**; “Matched” holds progress on both deposit lines and revenue schedules until the entire deposit is approved.

**ASSUMED (current design):**

* **Matched** = previously called **Settled/APPLIED** – line‑level resolution but deposit not yet finalized.
* **Reconciled** = final, deposit‑level approval that locks in:

  * Deposit status,
  * Deposit Line Item statuses,
  * Revenue Schedules that are fully funded.

---

### TL;DR for dev tickets

**When a Deposit Line Item & Revenue Schedule are matched:**

1. **On Match / Apply**

   * Write actuals to RS; compute variance.
   * Mark Deposit Line Item and affected RS as **Matched** (a.k.a. Settled).
   * Handle overages via FLEX; underpayments via Underpaid status; log audit.

2. **When all lines on a deposit are resolved**

   * Enable “Reconcile Deposit” action.
   * On confirm:

     * Deposit.status → **Reconciled**.
     * All Deposit Line Items on that deposit → **Reconciled**.
     * Each RS touched:

       * If fully funded → **Reconciled** (and closed to new deposits).
       * If still short → remains **Underpaid** (kept open).

3. **Allow corrections**

   * Per‑line **Unmatch**.
   * Deposit‑level **Unreconcile** (manager/permission‑controlled).
   * All of this must be audited and must respect the one‑time‑reconcile policy for RS unless explicitly reopened.
