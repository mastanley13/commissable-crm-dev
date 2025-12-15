# Commissable Reconciliation & Matching – Dev Context

This document is meant to be dropped straight into your coding agent as context for how reconciliation and matching are supposed to work in Commissable.

It combines:

- A **plain‑language overview** of the matching process  
- A **more detailed technical model** of entities, workflow, and rules  
- A **checklist of acceptance criteria** for implementation & QA

Sources: Revenue & Reconciliation specifications, AI matching engine POC, and the exhaustive SOW for the reconciliation system.   

---

## 1. Quick Glossary (Non‑technical)

- **Revenue Schedule (RS)**  
  A single expected “bucket” of revenue/commission for a specific month and product (e.g. “Acme / AT&T Fiber / Jan 1 2025 / $120 commission expected”). These are generated when an Opportunity is Closed‑Won. :contentReference[oaicite:1]{index=1}  

- **Deposit**  
  A batch payment from a Distributor/Vendor (e.g. Telarus / AT&T file), usually a CSV/XLSX/PDF from the vendor, containing many line items for many customers.   

- **Deposit Line Item**  
  One row in the file: “Customer X, Product Y, $Usage, $Commission, Date, IDs…”.

- **Matching**  
  Linking each deposit line item to the correct Revenue Schedule(s).

- **Reconciliation**  
  Applying the actual usage/commission from the deposit to the RS, updating balances, status, and variances.

- **FLEX Schedule**  
  A special RS created automatically when a deposit is “too big” (overage) or when no RS exists but we still want to capture the money (e.g., unknown product). Uses suffix like `-F`.   

- **Chargeback / CB‑REV**  
  Special RS records for negative payments (chargebacks `-CB`) and their reversals (`-CB-REV`).   

---

## 2. Plain‑Language Overview of the Matching Process

Think of the system as two phases: **planning** and **reacting**. :contentReference[oaicite:5]{index=5}  

1. **When a deal closes, we plan the money:**
   - A sales rep closes an Opportunity.
   - The system creates a series of **Revenue Schedules** – one per billing period (usually monthly) for the length of the contract (e.g. 12 months).  
   - Each RS stores what we **expect**:
     - Expected usage (revenue base)
     - Expected commission
     - Who gets paid (House / Rep / Subagent splits)

   You can picture this as **12 empty buckets waiting to be filled** with vendor payments.

2. **Vendors send us what actually got paid:**
   - Every month (or similar cadence), distributors/vendors send deposit files.
   - Each file has many **line items** with:
     - Customer/account info
     - Product/service info
     - Actual usage/billing
     - Actual commission paid

3. **The matching engine tries to connect each payment to the right bucket(s):**
   - For each deposit line, the system:
     - Filters by Distributor + Vendor first (must match).  
     - Searches for candidate Revenue Schedules using IDs, account names, product/SKU, and dates.
     - Calculates a **confidence score** for each possible match based on how well things line up (IDs, names, amounts, dates).   

4. **Confidence scores drive how “hands‑off” things can be:**
   - **High confidence (≥ 0.95)**:  
     The system auto‑matches the line to a schedule and marks it with a **green checkmark**. User can still review later.   
   - **Medium confidence (~0.90–0.94)**:  
     The system proposes a suggested match with a **yellow flag**. User must approve or change it.
   - **Low confidence (< 0.90)**:  
     The system does **not** auto‑attach. It shows a **red alert** and waits for a human to:
       - Manually match
       - Split across multiple schedules
       - Or create a FLEX schedule

5. **Handling imperfect situations:**
   - **Perfect match (1:1)** – one line exactly matches one RS:
     - We fill that RS’s bucket with the actual amounts and mark it **Reconciled** when fully paid. :contentReference[oaicite:8]{index=8}  
   - **Prepayments (1:Many)** – one line covers many months:
     - The line amount is split across multiple RSs in order (FIFO) until the money is exhausted.
   - **Partial payments (Many:1)** – multiple lines slowly pay off one RS:
     - Each payment reduces the RS’s remaining balance until it’s fully reconciled.
   - **Overpayments (too much money)**:
     - We pay off the expected RS amount.
     - Any extra is captured in a **FLEX schedule** instead of corrupting the original.  
   - **Chargebacks (negative amounts)**:
     - We never change the original reconciled RS.
     - A new negative **Chargeback RS** (and possibly a reversal RS) is created for full auditability.   
   - **Totally unknown item**:
     - If no Schedule can be found, we create a FLEX schedule so **no money is lost** while humans figure out what it is.

6. **Status updates tell the story:**
   - Each deposit line and each RS gets a status: Unmatched, Suggested, Partially Paid, Underpaid, Reconciled, Overpaid, etc.
   - A deposit batch is marked **Reconciled** when **all** of its lines have been allocated, FLEXed, or chargebacked appropriately.   

7. **The system learns from user behavior:**
   - When a user corrects a suggested match (e.g., picks a different RS), that pattern is stored.
   - Over time, the engine gets better at fuzzy name matching and SKU mapping, pushing more items into the “high confidence, auto‑match” bucket.   

---

## 3. Detailed Technical Overview

This section is structured to be friendly for a coding agent / developer.

### 3.1 Core Data Model

**Revenue Schedule (RS)**   

- Generated from Opportunities + Products when an Opportunity reaches `Closed Won – Provisioning` / `Closed Won – Billing and Commissioning`.
- Key fields (simplified):
  - `id` (e.g., `RS-1004321`, 6‑digit sequence)
  - `opportunity_id`, `product_id`
  - `schedule_date` (typically 1st of month)
  - `expected_usage_gross`, `expected_usage_net`
  - `expected_commission`
  - `actual_usage`, `actual_commission`
  - `status` (`Unreconciled`, `Partially Paid`, `Underpaid`, `Reconciled`, `Overpaid`, `Disputed`)
  - `flags` (FLEX / CB / CB-REV / M2M etc.)
- One‑time match policy:
  - A schedule may be funded by multiple deposits (FIFO) until fully reconciled, then closed.
  - Only admins can reopen.   

**Deposit**   

- Header for a batch of payments.
- Key fields: `id`, `distributor`, `vendor`, `deposit_date`, `amount`, `status`, `line_count`.

**Deposit Line Item**

- One row from the file or manual entry: `account_name`, IDs, `product`, `sku`, `usage_amount`, `commission_amount`, `payment_date`, `status`, `confidence_score`, `matched_schedule_id`, `suggestions[]`.   

**FLEX / Chargeback Schedules**

- FLEX: RS created when deposit > expected or no RS exists. Suffix `-F`.  
- Chargeback: RS for negative amounts. Suffix `-CB`.  
- Chargeback reversal: Suffix `-CB-REV`.   

---

### 3.2 File Intake & Deposit Creation

1. **User creates an Import Session** (via UI or API).
2. User uploads CSV/XLSX/PDF and specifies Distributor+Vendor.
3. System:
   - Detects template (if known) and proposes field mappings.
   - Validates types, required columns, date formats, numeric ranges.
   - Detects duplicates and structural errors.   
4. On success, the system:
   - Creates a **Deposit** header.
   - Creates **Deposit Line Items** for each row.
   - Ensures `sum(line_items.amount) == deposit.amount`.

Manual deposit entry uses the same model (header + line items), just without file upload. :contentReference[oaicite:18]{index=18}  

---

### 3.3 Matching Engine & Confidence Scoring

**High‑level algorithm (per Deposit or per Line):**   

1. **Candidate retrieval (filtering):**
   - Filter RS candidates by:
     - `distributor`
     - `vendor`
     - `account legal name` / `account_id` / `customer_id`
     - `product` / `sku`
     - `schedule_date` range (usually around the line’s billing date)

2. **Pass A – Exact match on strong identifiers:**
   - Priority/weights (may vary slightly per doc but same idea):
     - Distributor + Vendor (required gate)
     - Account/Customer/Order IDs
     - SKU & schedule date
   - If an RS matches all required keys and the amount is within the variance threshold (often 0% for strict pass A), this candidate gets a very high base score.   

3. **Pass B – Fuzzy match on soft identifiers:**
   - When pass A fails or is ambiguous:
     - Fuzzy string similarity for Account Name (`"Acme Corp"` vs `"Acme Corporation"`)
     - Fuzzy product name / description matching
     - Amount variance checks (e.g. within ±10% is good, >50% is suspicious)   

4. **Confidence score calculation (0.0–1.0):**
   - Weighted sum of:
     - Distributor/Vendor exact match
     - ID/SKU matches
     - Fuzzy name similarity
     - Amount variance penalty/bonus
   - Result caps at 1.0. Example:
     - 0.98 = strong match across IDs + exact amount
     - 0.92 = slightly imperfect but likely correct
     - 0.70 = weak; should not be auto‑applied

5. **Decision thresholds:**
   - `confidence ≥ 0.95` → Auto‑match (green checkmark)  
   - `0.90 ≤ confidence < 0.95` → Suggested match (yellow flag)  
   - `confidence < 0.90` → No automatic link; requires manual action (red alert).   

6. **Ambiguity handling:**
   - If multiple RS candidates meet threshold:
     - Show ranked list for the user.
     - If they’re all the **same product across different months**, use FIFO:
       - Earliest open RS gets funded first.
   - User can:
     - Accept the top suggestion
     - Choose a different RS
     - Split the line across multiple RSs
     - Reject and create FLEX instead.   

---

### 3.4 Applying a Match (Reconciliation Logic)

When a match is approved (auto or manual):   

1. **Write actuals to RS:**
   - Update `actual_usage` and `actual_commission` on the RS.
   - Recalculate:
     - `usage_difference = expected_usage_net – actual_usage`
     - `commission_difference = expected_commission – actual_commission`

2. **Determine RS status:**
   - If both differences are ~0 → `Settled` / eligible for final `Reconciled`.
   - If differences > 0 (still owed) → `Partially Paid` / `Underpaid`.
   - If differences < 0 (overpaid) → `Overpaid` (will trigger FLEX).   

3. **Update Deposit Line status:**
   - `Unmatched` → `Suggested` → `Settled` / `Partially Paid` / `Underpaid` → `Reconciled` (after final batch reconciliation).   

4. **Partial and multi‑line cases:**
   - **Many→1**: multiple deposit lines can fund the same RS until `commission_difference` hits 0.  
   - **1→Many**: a large deposit line can be split into multiple RSs, each reducing the remaining available amount on the line.

5. **Deposit batch finalization:**
   - Once every line in the deposit is:
     - Matched, OR
     - Converted to FLEX, OR
     - Chargebacked,
   - The deposit header status flips to **Reconciled**.   

---

### 3.5 FLEX, Chargebacks, and Edge Cases

**Overpayments / Overage:**   

- If `actual > expected` by more than configurable variance threshold:
  - Apply up to `expected` to the original RS.
  - Create FLEX RS for the remainder:
    - `id` uses `-F` suffix (e.g., `RS-1004321-F`).
    - Status typically starts as `Reconciled` but flagged for review.
  - Notify admins and push FLEX into a review queue.

**Unknown product / no matching RS:**

- If no RS passes even low thresholds:
  - Create FLEX schedule using data from the deposit line.
  - Mark deposit line as `FLEX`.
  - Later, admin can:
    - Map FLEX to a new product & RS.
    - Or adjust it once the vendor clarifies.

**Chargebacks (negative amounts):**   

- Never modify the original reconciled RS.
- Instead:
  - Create a `-CB` RS with negative amounts.
  - If reversed later, create a `-CB-REV` RS.
  - Reports always show original + CB + CB‑REV for full history.

---

### 3.6 Learning & Feedback Loop

- Each **user correction** (changing suggested match, manual match, corrected SKU) is recorded.   
- System builds:
  - Customer name variation table (`"Acme Corp"` ↔ `"Acme Corporation Inc"`)
  - SKU mapping patterns (vendor SKU → internal product)
  - Field importance weights (which signals are most predictive)
- Future confidence scoring uses these learned patterns to:
  - Boost confidence for known good patterns.
  - Reduce noise from misleading fields.
- Goal: push auto‑match success to **≥ 90%** of validation set lines.   

---

## 4. Acceptance Criteria Checklist (Matching & Reconciliation)

Use this as a dev/QA checklist.

### 4.1 Core Matching & Reconciliation Behavior

- [ ] **Revenue Schedules exist before reconciliation**  
      RSs are auto‑generated from Closed‑Won Opportunities & Products with correct dates, amounts, and IDs.   

- [ ] **File intake supports CSV/XLSX/PDF + manual entry**  
      Mapping, validation, and duplicate checks work; deposits and line items are created with correct totals.   

- [ ] **Candidate retrieval filters correctly**  
      RS candidates are filtered by Distributor, Vendor, account identity, product/SKU, and schedule date range.   

- [ ] **Hierarchical matching runs in two passes (exact then fuzzy)**  
      Strong IDs are tried first; fuzzy name/description/amount matching is only used when necessary.   

- [ ] **Confidence scores are calculated and stored per candidate**  
      The system can show why a match scored as it did (e.g., IDs matched, name similarity %, amount variance).   

- [ ] **Auto‑match, suggestion, and manual review thresholds implemented**  
      ≥0.95 auto‑applies; 0.90–0.94 shown as suggestions; <0.90 requires manual action. (Exact thresholds can be config but behavior must exist.)   

- [ ] **One‑to‑one, one‑to‑many, and many‑to‑one scenarios supported**  
      Prepayments, partial payments, and multi‑line funding all work using FIFO rules where applicable.   

- [ ] **Status model applied correctly at all three levels**  
      - Line: `Unmatched → Suggested → Settled/Partially Paid/Underpaid → Reconciled`  
      - RS: `Awaiting Payment/Unreconciled → Partially Paid/Underpaid/Overpaid → Reconciled (Closed)`  
      - Deposit: `In Progress → Exceptions Pending → Reconciled`.   

- [ ] **Deposit marked Reconciled only when all lines are handled**  
      Includes matched lines, FLEX, chargebacks, and any explicitly deferred exceptions.   

---

### 4.2 FLEX & Chargeback Handling

- [ ] **Overage > variance threshold creates FLEX schedule**  
      Extra amount is not forced into the original RS; FLEX RS created with `-F` suffix and linked back to the source line.   

- [ ] **Unknown product / no candidate RS triggers FLEX**  
      System can create FLEX from a deposit line with no RS matches.  

- [ ] **Chargeback logic implemented**  
      Negative deposits generate `-CB` RS; reversals create `-CB-REV`; original RS stays unchanged.   

- [ ] **FLEX & CB tracked in dedicated queues/reports**  
      Admins can see all FLEX/CB items, their age, and resolve them.   

---

### 4.3 Undo, Audit, and Learning

- [ ] **Manager‑level Undo for matches**  
      Undo restores both Deposit Line and RS state, logs who/when/why, and is constrained by permissions/time limits.   

- [ ] **Audit trail for all reconciliation actions**  
      Every match, split, FLEX, CB, and undo records before/after values, actor, timestamp, and reason.   

- [ ] **User corrections are stored as training data**  
      Name variations, SKU mappings, and corrected matches are persisted.  

- [ ] **Engine uses historical patterns to improve confidence**  
      After enough corrections, previously ambiguous cases score higher and move into auto‑match/suggested territory.   

---

### 4.4 Performance & Quality Targets (from SOW/POC)

- [ ] **Auto‑match accuracy ≥ 90% on validation set**  
      On the provided test corpus, at least 90% of lines are correctly auto‑matched (not just “matched”).   

- [ ] **Significant speed improvement vs. manual process**  
      Reconciliation time per deposit is reduced from ~5–6 hours to ~1 hour or less, under expected volume.   

- [ ] **Error rate (incorrect matches) reduced by ~80%**  
      Compared to the legacy/manual baseline.  

- [ ] **System can handle expected volume + growth**  
      Matching/deposit operations meet performance targets at scale (e.g., 10,000+ line items, future 10× growth).   

---

You can save this as `reconciliation-matching-overview.md` and feed it directly to your coding agent as architectural context for the matching and reconciliation features.
