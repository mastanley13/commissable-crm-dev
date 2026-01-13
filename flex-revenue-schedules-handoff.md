# FLEX Schedules for Revenue Schedules — Implementation Handoff Checklist

## Progress Snapshot (repo review: 2026-01-13)

**Implemented (in code/UI)**
- Deposit reconciliation matching updates revenue schedule `actualUsage` / `actualCommission` and recomputes schedule status using a tenant-configurable variance tolerance.
- Reconciliation UI already displays Expected vs Actual and balances/differences (usage + commission).
- Revenue Schedule audit history tab exists, and reconciliation actions write audit logs.
- Revenue Schedule clone, delete/archive, and bulk edit tools exist (useful building blocks for manual “flex-style” housekeeping).

**Not yet implemented (FLEX-specific)**
- “Adjustment vs Flex Product vs Manual” mismatch prompt/decision tree and the downstream record creation.
- Flex Product creation for unknown product, overage outside tolerance, and negative “flex chargeback” automation.
- Auto-create new future Revenue Schedules when Billing + schedules exhausted.
- Bonus/SPF classification + “apply same rules” automation and reporting categorizations for flex chargebacks.

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
- [x] The system must compute **variance** between *Expected Usage Net* (schedule) and *Actual Usage* (from deposit allocations) after matching.
- [ ] The system must support a configurable **tolerance/variance threshold** (example discussed: “tolerance to 10%”)【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L23】.
- [ ] **Only overage matters**; underage “doesn’t matter” in this flow【111:3†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L49-L50】.

**Decision rule discussed:**
- [ ] If overage is **within tolerance** → create an **Adjustment** (one-time) and match/reconcile. (See “otherwise, it’s just going to make an adjustment and match it.”)【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L44-L47】
- [ ] If overage is **above tolerance** → offer/create **Flex Product** path (see below).【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L44-L47】

> **ASSUMED:** whether the UI always prompts vs only prompts when above tolerance is not perfectly explicit. The docs say “system prompts for action” when matched amounts differ【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】, *and* also say flex-overage is only above threshold【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L44-L47】.  
> Implement recommendation: prompt only when above tolerance (or provide “recommended” default), but flag this for product confirmation.

### 2.3 Adjustment vs Flex Product vs Manual (prompt + action)
- [ ] When a mismatch is detected, the system must support these options:
  - **Adjust**: create a one-time adjustment,
  - **Flex Product**: create a temporary product for the difference,
  - **Manual**: user manually enters the adjustment amount【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】.
- [ ] The UI flow should align with the “decision tree” discussed (adjust / manual / flex product)【111:3†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L38-L41】.

**Trigger timing**
- [ ] Confirm whether the mismatch prompt occurs:
  - immediately after matching (before reconcile), or
  - on “Reconcile” click.

  Context: the team debated whether the prompt should happen “when the user clicked reconcile” vs “before it reconciled as you’re in the screen”【111:3†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L42-L44】.

> **ASSUMED implementation suggestion:** evaluate mismatch right after Match, and block Reconcile until resolved (or auto-resolve within tolerance), to reduce confusion.

### 2.4 Unknown product → create Flex Product to mimic deposit line item
- [ ] If a deposit line item refers to an **unknown product** (no mapping / cannot be confidently matched), the system must be able to create a **Flex Product** to record that line item anyway【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L25】.
- [ ] The resulting flex product must be attachable to the correct deal / revenue schedule(s) for allocation.

> **ASSUMED:** rules for “unknown product detection” (e.g., AI confidence cutoff, “unmapped fields” from vendor template) are outside the explicit FLEX excerpts; treat this as a dependency on the deposit mapping + matching system.

### 2.5 Chargeback (negative deposit line)
- [ ] If a deposit line item amount (usage and/or commission) is negative:
  - [ ] system should **suggest or automatically create** a Flex Chargeback product entry and apply the deposit allocation to it【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L32-L42】.
- [ ] Flex chargebacks should be categorized (group/family) for reporting【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L50-L53】.

> **ASSUMED:** whether chargeback flex is fully automatic vs user-confirmed is not decided; the transcript notes “The system itself could easily do that… suggest that that money gets applied…”【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L39-L42】.

### 2.6 Underpayment behavior
- [x] If a schedule is underpaid:
  - [x] do **not** create a flex product,
  - [x] apply what was paid,
  - [ ] leave a remaining balance that shows next time payment comes in【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L47-L51】.

### 2.7 Bonus/SPF behavior
- [ ] Support modeling “bonus” as an SPF product that is part of the deal, often known at time of sale【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L53-L53】.
- [ ] If bonus is estimated but actual differs, apply the “same rules” (auto-adjust) rather than creating a new recurring change【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L34-L43】.

> **NOTE:** Another excerpt highlights that the two areas to worry about are (1) overage outside variance and (2) bonus automation【111:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L9-L14】.

### 2.8 Flex Auto-Config (schedule extension)
- [ ] If an Opportunity Product is still in **Billing** status and future schedules are exhausted:
  - [ ] auto-create the next Revenue Schedule(s),
  - [ ] starting on the **first of the next month** (as discussed)【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L54-L55】,
  - [ ] without requiring the user to manually generate schedules【107:7†working notes 11.11.25.docx†L45-L46】.

> **ASSUMED:** how many schedules to create (one at a time vs N months) is not specified in the FLEX excerpts. A safe default is “create one next schedule when needed,” repeating each cycle while Billing remains true.

---

## 3) Engineering implementation checklist (what to build)

### 3.1 Data model additions/flags (recommended)
> **ASSUMED:** actual schema requirements are not explicitly specified in the excerpts; below are recommended fields to make FLEX auditable and reportable.

- [ ] Add a way to mark revenue schedules (or schedule line items) as:
  - [ ] Normal (contracted schedule)
  - [ ] Adjustment (one-time)
  - [ ] Flex Product (temporary product)
  - [ ] Flex Chargeback
  - [ ] Bonus/SPF
- [ ] Add fields for auditability:
  - [ ] `created_by`, `created_at`
  - [ ] `reason_code` (e.g., OVERAGE_OUTSIDE_TOLERANCE, UNKNOWN_PRODUCT, CHARGEBACK_NEGATIVE, BONUS)
  - [ ] link to source deposit line(s) / allocation(s)

### 3.2 Matching pipeline enhancements (prereq)
- [ ] Ensure bottom grid can display expected vs actual (usage/commission) and that actuals update on Match【111:15†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L36-L37】.
- [ ] Implement variance calculation after Match, before Reconcile (if that’s the chosen trigger)【111:3†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L42-L44】.
- [ ] Expose/define a variance limit setting (“tolerance”) (example: 10%)【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L23】.

### 3.3 FLEX decisioning + actions
- [ ] If mismatch detected, present/execute:
  - [ ] Adjust (one-time adjustment record)【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】
  - [ ] Flex Product (temporary product record)【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】
  - [ ] Manual (user-entered adjustment)【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】
- [ ] Implement special cases:
  - [ ] Negative amount → Flex Chargeback product suggestion/creation【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L32-L42】
  - [ ] Underpayment → carry balance forward (no flex)【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L47-L51】

### 3.4 UX placement (needs a decision)
There is an explicit question in the meeting about what flex “is going to look like for the user”:
- Is it **its own section** someone can trigger (similar to commission splits),
- Or something that happens in the background on system triggers?【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L35-L64】

- [ ] Decide UX approach and document it.
- [ ] If a dedicated UI section is chosen:
  - [ ] Add “Flex schedules” section on the Revenue Schedule screen
  - [ ] Provide “Create Flex Product” / “Create Adjustment” CTA for a selected schedule/deposit pair
- [ ] If background automation is chosen:
  - [ ] Ensure there is still transparency (e.g., created records labeled clearly, with audit trail)

### 3.5 Reporting requirements
- [ ] Ensure Flex Chargebacks are grouped in a way that can be filtered/reported (“group or a family”)【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L50-L53】.
- [ ] Ensure Flex Products vs Adjustments can be distinguished in reporting (ASSUMED but implied by workflow).

---

## 4) Revenue Schedule “edit/update” capabilities supporting FLEX (from change-order notes)

These items were explicitly listed as changes to implement around revenue schedules【107:6†working notes 11.11.25.docx†L1-L21】【107:7†working notes 11.11.25.docx†L41-L46】:

- [ ] Implement ability to **clone/replicate** an existing revenue schedule【107:7†working notes 11.11.25.docx†L41-L42】.
- [ ] Implement ability to **make revenue schedules inactive or delete them**【107:6†working notes 11.11.25.docx†L1-L1】.
- [ ] Add a **History tab / audit log** for revenue schedule changes (who + when)【107:6†working notes 11.11.25.docx†L5-L6】.
- [ ] Implement ability to **edit fields** for single or multiple selected revenue schedules:
  - [ ] Quantity
  - [ ] Price each
  - [ ] Expected usage adjustment
  - [ ] Expected commission rate【107:6†working notes 11.11.25.docx†L9-L20】
- [ ] Display the current commission split percentage with last edited date + user【107:6†working notes 11.11.25.docx†L21-L21】.
- [ ] Ensure revenue schedule status options align with opportunity stage/status (Pipeline, Pending, Reconciled, Unreconciled)【107:6†working notes 11.11.25.docx†L25-L25】.
- [ ] Auto-create new revenue schedules when Billing and schedules are exhausted【107:7†working notes 11.11.25.docx†L45-L46】.

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

- [ ] **Prompt behavior**: always prompt on mismatch vs only above tolerance? (See note in §2.2)
- [ ] **Chargeback automation**: auto-create vs user-confirmed?【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L39-L42】
- [ ] **UI approach**: flex schedules as a user-triggered section vs background automation?【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L35-L64】
- [ ] **Auto-config quantity**: create 1 next schedule vs generate N future schedules when exhausted? (ASSUMED)
- [ ] **Classification rules**:
  - how to detect “unknown product”
  - how to detect “bonus/SPF”
  - how to compute variance on commission vs usage (ASSUMED; meeting references usage primarily)

---

## 8) Implementation sequencing (recommended)

### Now (to satisfy V1 acceptance criteria)
- [ ] Ensure actual usage/commission update on Match【111:15†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L36-L37】
- [ ] Add variance/tolerance calculation + threshold config【111:0†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L22-L23】
- [ ] Implement Adjust / Flex Product / Manual paths【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L20-L23】
- [ ] Implement chargeback (negative) flex product handling【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L32-L42】
- [ ] Implement underpayment carry-forward behavior【111:14†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L47-L51】
- [ ] Implement auto-config schedule extension when Billing + schedules exhausted【107:7†working notes 11.11.25.docx†L45-L46】

### Next (hardening + transparency)
- [ ] Add schedule history/audit tab for edits【107:6†working notes 11.11.25.docx†L5-L6】
- [ ] Add cloning/editing tools for schedules【107:7†working notes 11.11.25.docx†L41-L42】【107:6†working notes 11.11.25.docx†L9-L20】
- [ ] Add reporting categorizations (flex chargeback family/group)【103:1†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L50-L53】

### Later
- [ ] V2 “Intelligent Housekeeping” AI suggestions for updating future schedules【107:10†Commissable_Transcript_MeetingSummary_Jan-06-26.pdf†L25-L31】
