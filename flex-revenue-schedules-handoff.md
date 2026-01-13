# FLEX Schedules for Revenue Schedules — Implementation Handoff Checklist

## Progress Snapshot (repo review: 2026-01-13)

**Implemented (in code/UI)**
- Deposit reconciliation matching updates revenue schedule `actualUsage` / `actualCommission` and recomputes schedule status using a tenant-configurable variance tolerance.
- Reconciliation UI already displays Expected vs Actual and balances/differences (usage + commission).
- Revenue Schedule audit history tab exists, and reconciliation actions write audit logs.
- Revenue Schedule clone, delete/archive, and bulk edit tools exist (useful building blocks for manual “flex-style” housekeeping).
- Revenue Schedule supports FLEX metadata (`flexClassification`, `flexReasonCode`, and source deposit IDs).
- Matching returns `flexDecision` and executes Phase 0 policy on Match:
  - within tolerance: auto-create + allocate an Adjustment entry (no modal),
  - above tolerance: prompt (Adjust / Manual / Flex Product),
  - negative line: auto-create + allocate a Flex Chargeback entry (reversible before finalize).
- Reconciliation UI supports resolving above-tolerance overages via modal and supports creating Flex Product / Chargeback entries from the allocation screen.
- Month-to-month schedule extension job exists and is callable via a secured job endpoint.

**Remaining (FLEX-specific)**
- Expand bonus/SPF classification rules (beyond the current “bonus-like” heuristic) and confirm if/where bonus should auto-classify in reconciliation UX.
- Decide whether to auto-create Flex Products during batch Auto-Match when overage is above tolerance (currently prompts only during interactive matching).
- Optional cleanup: decide whether auto-created Flex Products should be retired automatically when their source line is unallocated (schedules are soft-deleted; products are retained).

**Source of truth used to compile this handoff:**
- *Commissable_Transcript_MeetingSummary_Jan-06-26.pdf* (meeting summary + transcript excerpts)【107:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L44-L65】【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L31】
- *working notes 11.11.25.docx* (change-order style checklist items for Revenue Schedules)【107:7†working notes 11.11.25.docx†L41-L46】【107:6†working notes 11.11.25.docx†L1-L21】

---

## 1) What “FLEX schedules” means in this CRM context

### 1.1 Flex Product (reconciliation-time flex)
When matched amounts differ, the system should support multiple actions:
1) **Adjust** (create a one-time adjustment),
2) **Flex Product** (create a temporary product for the difference),
3) **Manual** (user enters the adjustment)【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】.

Flex products are specifically discussed as a way to:
- record deposit line items for **unknown products** (no mapping / “we have no idea what it is”), by **creating a flex product to mimic the deposit line item**【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L25】, and/or
- handle **out-of-variance differences** (“outside of a known product”) by creating a flex product for the difference【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L25-L27】.

### 1.2 Flex Overage vs Underpayment
- **Flex overage**: only applies when the overage is **above the threshold**; otherwise, the system should just “make an adjustment and match it”【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L44-L47】.
- **No flex underpayment**: if underpaid, the remainder stays open and rolls forward (“there’ll be a balance left… next time we get paid”)【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L47-L51】.

### 1.3 Flex Chargeback
Chargebacks were discussed as typically *not attributable to a specific product*. When the system sees a **negative number**, it should be able to create a “flex product / chargeback product” with the negative usage/commission to record it and apply the deposit to it【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L32-L42】.
There’s also a reporting motivation: “Flex chargeback… as a group or a family… easy to report on”【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L50-L53】.

### 1.4 Bonus / SPF
Bonus is “usually like a SPF” and is often known ahead of time【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L53-L53】.
The workflow discussed:
- Build out an SPF product on the deal, often by estimating (e.g., estimate $1,000, actual $900),
- Then apply the same “rules” (auto-adjust) when the actual differs【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L34-L43】.

### 1.5 Flex Auto-Config (revenue schedule extension)
A separate “flex” concept discussed is **auto-creating revenue schedules** when billing continues:
- “when it runs out of schedules and it clicks over to the first of the month”【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L54-L55】.
This also appears as an explicit requested feature:
- “Add functionality to auto-create a new revenue schedule when the product billing status is still ‘Billing’ but the available schedules have been exhausted.”【107:7†working notes 11.11.25.docx†L45-L46】

---

## 2) Core acceptance criteria checklist (implementation-ready)

> **Goal:** ensure “V1 AI reconciliation workflow (matching, adjustments, flex products)” is implementable and testable【111:7†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L24-L32】.

### 2.1 Matching updates Actuals (prerequisite for FLEX)
- [x] **When user matches deposit line(s) to revenue schedule(s)**, the revenue schedule row(s) must populate:
  - actual usage, and
  - actual commission (derived from deposit line amounts / allocations).

  Context: an action item calls for “Add Actual Usage + Actual Commission to bottom grid; update on Match”【111:15†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L36-L37】, and discussion describes actual usage/commission filling in when Match is clicked【111:6†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L16-L21】.

### 2.2 Variance/tolerance detection (overage)

> **PHASE 0 DECISION (confirmed):** only prompt when the **overage exceeds tolerance**.
> - Within tolerance → auto-create a one-time adjustment and continue (no modal; toast/banner).
> - Above tolerance → show modal (Adjust / Manual / Flex Product).
> - Underpayment → no prompt; carry remaining balance forward.
- [x] The system must compute **variance** between *Expected Usage Net* (schedule) and *Actual Usage* (from deposit allocations) after matching.
- [x] The system must support a configurable **tolerance/variance threshold** (example discussed: “tolerance to 10%”)【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L23】.
- [x] **Only overage matters**; underage “doesn’t matter” in this flow【111:3†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L49-L50】.

**Decision rule discussed:**
- [x] If overage is **within tolerance** → create an **Adjustment** (one-time) and match/reconcile. (See “otherwise, it’s just going to make an adjustment and match it.”)【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L44-L47】
- [x] If overage is **above tolerance** → offer/create **Flex Product** path (see below).【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L44-L47】

> **IMPLEMENTED:** prompt only when the overage exceeds tolerance; within tolerance auto-adjust with toast/banner (no modal).

### 2.3 Adjustment vs Flex Product vs Manual (prompt + action)
- [x] When an overage above tolerance is detected, the system supports these options:
  - [x] **Adjust**: create a one-time adjustment,
  - [x] **Flex Product**: create a temporary product for the difference,
  - [x] **Manual**: user manually enters the adjustment amount【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】. (Implemented: user can enter a partial adjustment amount.)
- [x] The UI flow should align with the “decision tree” discussed (adjust / manual / flex product)【111:3†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L38-L41】.

**Trigger timing**

> **PHASE 0 DECISION (confirmed):** resolve variances on **Match (allocation)**, not on Finalize/Reconcile.
- [x] Mismatch prompt occurs immediately after matching (before reconcile).

  Context: the team debated whether the prompt should happen “when the user clicked reconcile” vs “before it reconciled as you’re in the screen”【111:3†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L42-L44】.

> **ASSUMED implementation suggestion:** evaluate mismatch right after Match, and block Reconcile until resolved (or auto-resolve within tolerance), to reduce confusion.

### 2.4 Unknown product → create Flex Product to mimic deposit line item
- [x] If a deposit line item refers to an **unknown product** (no mapping / cannot be confidently matched), the system must be able to create a **Flex Product** to record that line item anyway【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L25】.
- [x] The resulting flex product must be attachable to the correct deal / revenue schedule(s) for allocation. (Implemented: selecting a schedule when creating a Flex Product will attach it to that deal context.)

> **ASSUMED:** rules for “unknown product detection” (e.g., AI confidence cutoff, “unmapped fields” from vendor template) are outside the explicit FLEX excerpts; treat this as a dependency on the deposit mapping + matching system.

### 2.5 Chargeback (negative deposit line)

> **PHASE 0 DECISION (confirmed):** auto-create a Flex Chargeback entry when a negative line is detected and auto-apply it, but keep it reversible prior to final reconcile.
- [x] If a deposit line item amount (usage and/or commission) is negative:
  - [x] system should **suggest or automatically create** a Flex Chargeback product entry and apply the deposit allocation to it【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L32-L42】.
- [x] Flex chargebacks should be categorized (group/family) for reporting【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L50-L53】.

> **IMPLEMENTED:** negative lines auto-create and auto-apply a Flex Chargeback entry (reversible prior to reconcile via unmatch).

### 2.6 Underpayment behavior
- [x] If a schedule is underpaid:
  - [x] do **not** create a flex product,
  - [x] apply what was paid,
  - [x] leave a remaining balance that shows next time payment comes in【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L47-L51】.

### 2.7 Bonus/SPF behavior
- [x] Support modeling “bonus” as an SPF product that is part of the deal, often known at time of sale【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L53-L53】. (Implemented via product heuristics: revenue type / product family/name containing bonus/spiff/spf.)
- [x] If bonus is estimated but actual differs, apply the “same rules” (auto-adjust) rather than creating a new recurring change【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L34-L43】.

> **NOTE:** Another excerpt highlights that the two areas to worry about are (1) overage outside variance and (2) bonus automation【111:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L9-L14】.

### 2.8 Flex Auto-Config (schedule extension)

> **PHASE 0 DECISION (confirmed):** create **exactly 1** next schedule at a time, starting on the **first of next month**, when Billing remains active and schedules are exhausted.
- [x] If an Opportunity Product is still in **Billing** status and future schedules are exhausted:
  - [x] auto-create the next Revenue Schedule(s),
  - [x] starting on the **first of the next month** (as discussed)【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L54-L55】,
  - [x] without requiring the user to manually generate schedules【107:7†working notes 11.11.25.docx†L45-L46】.

> **ASSUMED:** how many schedules to create (one at a time vs N months) is not specified in the FLEX excerpts. A safe default is “create one next schedule when needed,” repeating each cycle while Billing remains true.

---

## 3) Engineering implementation checklist (what to build)

### 3.1 Data model additions/flags (recommended)
> **ASSUMED:** actual schema requirements are not explicitly specified in the excerpts; below are recommended fields to make FLEX auditable and reportable.

- [x] Add a way to mark revenue schedules (or schedule line items) as:
  - [x] Normal (contracted schedule)
  - [x] Adjustment (one-time)
  - [x] Flex Product (temporary product)
  - [x] Flex Chargeback
  - [x] Bonus/SPF
- [x] Add fields for auditability:
  - [x] `created_by`, `created_at`
  - [x] `reason_code` (e.g., OVERAGE_OUTSIDE_TOLERANCE, UNKNOWN_PRODUCT, CHARGEBACK_NEGATIVE, BONUS)
  - [x] link to source deposit line(s) / allocation(s)

### 3.2 Matching pipeline enhancements (prereq)
- [x] Ensure bottom grid can display expected vs actual (usage/commission) and that actuals update on Match【111:15†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L36-L37】.
- [x] Implement variance calculation after Match, before Reconcile (if that’s the chosen trigger)【111:3†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L42-L44】.
- [x] Expose/define a variance limit setting (“tolerance”) (example: 10%)【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L23】.

### 3.3 FLEX decisioning + actions
- [x] If mismatch detected, present/execute:
  - [x] Adjust (one-time adjustment record)【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】
  - [x] Flex Product (temporary product record)【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】
  - [x] Manual (user-entered adjustment)【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】
- [x] Implement special cases:
  - [x] Negative amount → Flex Chargeback product suggestion/creation【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L32-L42】
  - [x] Underpayment → carry balance forward (no flex)【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L47-L51】

### 3.4 UX placement (needs a decision)
There is an explicit question in the meeting about what flex “is going to look like for the user”:
- Is it **its own section** someone can trigger (similar to commission splits),
- Or something that happens in the background on system triggers?【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L35-L64】

- [x] Decide UX approach and document it (implemented in deposit allocation/matching flow; flex entries are labeled + audited).
- [ ] If a dedicated UI section is chosen:
  - [ ] Add “Flex schedules” section on the Revenue Schedule screen
  - [ ] Provide “Create Flex Product” / “Create Adjustment” CTA for a selected schedule/deposit pair
- [ ] If background automation is chosen:
  - [ ] Ensure there is still transparency (e.g., created records labeled clearly, with audit trail)

### 3.5 Reporting requirements
- [x] Ensure Flex Chargebacks are grouped in a way that can be filtered/reported (“group or a family”)【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L50-L53】.
- [x] Ensure Flex Products vs Adjustments can be distinguished in reporting (ASSUMED but implied by workflow).

---

## 4) Revenue Schedule “edit/update” capabilities supporting FLEX (from change-order notes)

These items were explicitly listed as changes to implement around revenue schedules【107:6†working notes 11.11.25.docx†L1-L21】【107:7†working notes 11.11.25.docx†L41-L46】:

- [x] Implement ability to **clone/replicate** an existing revenue schedule【107:7†working notes 11.11.25.docx†L41-L42】.
- [x] Implement ability to **make revenue schedules inactive or delete them**【107:6†working notes 11.11.25.docx†L1-L1】.
- [x] Add a **History tab / audit log** for revenue schedule changes (who + when)【107:6†working notes 11.11.25.docx†L5-L6】.
- [x] Implement ability to **edit fields** for single or multiple selected revenue schedules:
  - [x] Quantity
  - [x] Price each
  - [x] Expected usage adjustment
  - [x] Expected commission rate【107:6†working notes 11.11.25.docx†L9-L20】
- [ ] Display the current commission split percentage with last edited date + user【107:6†working notes 11.11.25.docx†L21-L21】.
- [ ] Ensure revenue schedule status options align with opportunity stage/status (Pipeline, Pending, Reconciled, Unreconciled)【107:6†working notes 11.11.25.docx†L25-L25】.
- [x] Auto-create new revenue schedules when Billing and schedules are exhausted【107:7†working notes 11.11.25.docx†L45-L46】.

> **Why this matters to FLEX:** these capabilities enable (a) extending schedules when billing continues, and (b) correcting schedules going forward when patterns stabilize (see V2 “Intelligent Housekeeping” below).

---

## 5) Testing plan (scenarios the coding agent should script)

### 5.1 Overage within tolerance
- [ ] Create a revenue schedule with Expected Usage Net = X.
- [ ] Match a deposit allocation with Actual Usage = X + small delta (<= tolerance).
- [ ] Verify adjustment is created and reconciliation can complete (no flex product).

### 5.2 Overage above tolerance
- [ ] Match Actual Usage = X + large delta (> tolerance).
- [ ] Verify prompt appears and supports Adjust vs Flex Product vs Manual【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】.
- [ ] Choose Flex Product → verify flex product created and linked correctly【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L27】.

### 5.3 Underpayment
- [ ] Match Actual Usage < Expected.
- [ ] Verify no flex product, remaining balance persists for next payment【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L47-L51】.

### 5.4 Chargeback / negative line
- [ ] Upload a deposit line with negative usage/commission.
- [ ] Verify system suggests/creates “flex chargeback” entry and applies it【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L32-L42】.
- [ ] Verify chargeback can be reported as its own group/family【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L50-L53】.

### 5.5 Unknown product
- [ ] Upload a deposit line whose product cannot be mapped.
- [ ] Verify ability to create a flex product that mimics the line item to record it【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L25】.

### 5.6 Bonus/SPF variance
- [ ] Add SPF product to opportunity with estimated amount.
- [ ] Upload deposit with slightly different bonus amount.
- [ ] Verify system identifies/handles via adjustment rules (no recurring schedule rewrite)【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L34-L43】.

### 5.7 Flex auto-config schedule extension
- [ ] Create opportunity product in Billing status with schedules ending in month N.
- [ ] Move system time / simulate running into month N+1.
- [ ] Verify new revenue schedule auto-created starting first of month【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L54-L55】 and consistent with the “Billing + exhausted schedules” requirement【107:7†working notes 11.11.25.docx†L45-L46】.

---

## 6) Future scope (V2) — Intelligent Housekeeping AI

**Not required for V1 FLEX acceptance, but explicitly captured as future scope:**
- AI analyzes historical data (e.g., 2+ months of consistent quantity changes) and suggests updating future revenue schedules【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L25-L31】.
- This may be separate from reconciliation (“separate widget or page… generates a report every week or per deposit upload”)【99:12†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L34-L47】.

- [ ] Park as “Later” unless explicitly pulled into scope.

---

## 7) Open questions / decisions to log (do not block coding agent prep)

### Phase 0 decisions (confirmed)
- Trigger timing: resolve on **Match (allocation)**, not on Finalize/Reconcile.
- Prompt policy: only prompt when the **overage exceeds tolerance**; within tolerance → auto-adjust with toast/banner.
- Chargebacks: negative lines **auto-create and auto-apply** a Flex Chargeback entry (reversible prior to final reconcile).
- Auto-config: create **1** next schedule at a time, starting **first of next month**, while Billing remains active.

- [x] **Prompt behavior**: only prompt when the overage exceeds tolerance; within tolerance auto-adjust with toast/banner (no modal). (See note in §2.2)
- [x] **Chargeback automation**: auto-create and auto-apply (reversible via unmatch)【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L39-L42】
- [x] **UI approach**: resolve in the deposit matching flow (modal only when overage exceeds tolerance)【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L35-L64】
- [x] **Auto-config quantity**: create 1 next schedule at a time when exhausted (no N-month batch generation).
- [ ] **Classification rules**:
  - how to detect “unknown product”
  - how to detect “bonus/SPF”
  - whether FLEX decisioning should use commission variance in addition to usage variance (schedule status computes both; meeting references usage primarily)

---

## 8) Implementation sequencing (recommended)

### Now (to satisfy V1 acceptance criteria)
- [x] Ensure actual usage/commission update on Match【111:15†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L36-L37】
- [x] Add variance/tolerance calculation + threshold config【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L23】
- [x] Implement Adjust / Flex Product paths (and a "Manual" defer option)【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】
- [x] Implement Manual amount-entry resolution (user-entered adjustment amount)
- [x] Implement chargeback (negative) flex product handling【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L32-L42】
- [x] Implement underpayment carry-forward behavior【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L47-L51】
- [x] Implement auto-config schedule extension when Billing + schedules exhausted【107:7†working notes 11.11.25.docx†L45-L46】

### Next (hardening + transparency)
- [x] Add schedule history/audit tab for edits【107:6†working notes 11.11.25.docx†L5-L6】
- [x] Add cloning/editing tools for schedules【107:7†working notes 11.11.25.docx†L41-L42】【107:6†working notes 11.11.25.docx†L9-L20】
- [x] Add reporting categorizations (flex chargeback family/group)【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L50-L53】

### Later
- [ ] V2 “Intelligent Housekeeping” AI suggestions for updating future schedules【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L25-L31】
