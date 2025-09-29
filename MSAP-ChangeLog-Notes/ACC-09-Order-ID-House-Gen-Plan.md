# ACC‑09 — **Order ID – House Generation**

*Accounts → List / Detail / Opportunities*
**Priority:** P1 (Must‑have) • **Status:** Not Completed • **Owner:** Engineering (Backend + UI) • **Dependency:** ACC‑08 (Opportunity create + commission validation)

---

## 0) Outcome & Scope

**Goal:** When a new Opportunity is saved from an Account’s **Opportunities** tab, assign a **unique, immutable “Order ID – House”** automatically in the format **`H` + [sequential number]**. The field is **read‑only after save** and must appear in the Opportunities lists and related views.

**Why this matters:** The Order ID is the canonical anchor used across commission management and audit/history (e.g., reassignment history, revenue schedules). Keeping it immutable ensures reliable joins for downstream finance and audit trails. 

---

## 1) Functional Requirements (from specs)

1. **Auto‑generate on save:** Assign **Order ID – House** only after server‑side validation succeeds for a new Opportunity. Format: **`H` + sequential number** (e.g., H100245). 
2. **Uniqueness:** Each Order ID is **globally unique** across Opportunities. (System constraint to avoid collisions in cross‑module reporting.) 
3. **Immutability:** The field is **read‑only after creation** in all UIs; editing is blocked at both UI and DB layers.
4. **Surface the field in UI:**

   * **Account → Opportunities** table (default/available columns). 
   * **Contact → Opportunities** tab shows **Order ID – House** (field 02.06.003) where the contact has a role. 
   * Respect Dynamic Columns conventions and field formatting. 

---

## 2) UX & Display Plan

* **Create New Opportunity Form (modal)**: No manual input for Order ID; the value appears **after save** in the table and on the Opportunity Detail readout. Enforce standard form behavior (required indicators, inline validation), consistent with Global UI standards. 
* **List Views:**

  * Add **Order ID – House** to the **Accounts → Opportunities** default/available columns (maintain user‑configurable visibility through Dynamic Columns). 
  * Ensure **Contact → Opportunities** tab includes **Order ID – House** per contact‑context spec. 
* **Read‑only presentation:** In all views (list/detail), the field is non‑editable and formatted as plain text (not a link). Follow percentage/date/ID display rules from Global UI Field Format reference. 

---

## 3) Data Model & Constraints

**Object:** Opportunity
**Field:** `Order_ID_House`
**Type:** String (up to 20 chars), **pattern `^H[0-9]+$`**, **NOT NULL** after create.
**Indexes/Constraints:**

* **Unique index** on `Order_ID_House`.
* **Update protection:** DB constraint or trigger rule to block updates after initial insert (immutability).

> Note: Field is referenced in list schemas for Accounts and Contacts module views—keep internal field key stable to avoid selector regressions.

---

## 4) ID Generation Strategy

* **Authoritative generator:** Use a **database sequence** (or equivalent atomic counter) named `seq_order_id_house` to guarantee **gap‑tolerant, strictly increasing** numbers under concurrency. Compose at write time: `H${nextval(seq_order_id_house)}`. 
* **Transaction boundary:** Generate **inside** the Opportunity create transaction **after** server‑side validation passes (incl. ACC‑08 commission checks), so failed inserts do not consume an ID in the same transaction scope. (Gaps are acceptable; uniqueness is the requirement.) 
* **Immutability enforcement:**

  * App layer: field excluded from update DTOs; server rejects any non‑null update.
  * DB layer: generated column or BEFORE UPDATE trigger raises an error if value changes. 

---

## 5) Create Flow (Backend)

1. **Validate** request payload (required fields, commission rules from ACC‑08). If invalid → 422 with field errors. 
2. **Begin TX**.
3. **Insert** Opportunity core fields (excluding `Order_ID_House`) to get a provisional row ID.
4. **Fetch next sequence** value → `n`.
5. **Update same row** setting `Order_ID_House = 'H' + n`.
6. **Commit TX**.
7. **Return** created record (including Order ID) to client for UI refresh.

> This two‑step (insert→update) pattern avoids serialization hotspots when business logic and ID issuance share transactional state. 

---

## 6) Frontend Integration

* **Create Modal:** No Order ID field; on success, the grid reload shows the new **Order ID – House**. Form/UI follows Global UI create/update conventions (two‑column modal, inline errors, Save & New, etc.). 
* **Tables:** Register **Order ID – House** in the Dynamic Columns metadata for:

  * `AccountDetail.Opportunities`
  * `ContactDetail.Opportunities`
    Persist column visibility/order per user. 
* **Detail View:** Display Order ID in the header or primary info block as **read‑only**. 

---

## 7) Activities & Audit Hooks (nice‑to‑have)

* **Auto‑log Activity:** On successful creation, add an entry “Opportunity created — Order ID H#### assigned” in the Opportunity’s Activities & Notes to improve traceability (respects universal Activities spec). 
* **Audit alignment:** Order ID should be included in all commission reassignment audit records as the stable reference key for the opportunity’s commission history. 

---

## 8) Error Handling & Messaging

* **Duplicate collision (extremely rare):** If the unique constraint ever fails (e.g., after restore), retry sequence fetch once and re‑apply within the same request; otherwise respond with a generic create error and log.
* **Immutable field tampering:** If client sends `Order_ID_House` on update, server returns 400 “Field is read‑only.” 

---

## 9) Migration & Backfill Plan

1. **Inventory:** Identify existing Opportunities lacking `Order_ID_House`.
2. **Seed sequence:** `seq_order_id_house` should **start at (max(existing numeric) + 1)** if any historical IDs exist.
3. **Backfill job:** In batches, assign `H${nextval}` for null IDs, committing per batch to reduce lock contention.
4. **Hardening:** Add **NOT NULL** + **UNIQUE** constraints only **after** backfill completes.
5. **Smoke tests:** Verify UI lists render Order IDs; verify Contact→Opportunities tab displays the column correctly.

---

## 10) Testing Strategy

### Unit

* **Format:** Verify `H` prefix and numeric suffix; reject any other pattern.
* **Sequence:** Simulate concurrent creates (N=100) to assert uniqueness.
* **Immutability:** Attempt to update the field post‑create → expect failure at API and DB.

### Integration

* **Create E2E:** From Account Detail → Opportunities → Create New → ensure an Order ID is returned and visible in grid row. 
* **Contact context:** Associate a Contact with the Opportunity; verify **Contact → Opportunities** tab shows the Order ID column. 

### UI/UX

* **Dynamic Columns:** Ensure the field is selectable, reorderable, and persists per user, per view. 

---

## 11) Security & Permissions

* No special permissions to **view** Order ID.
* **Edit protection:** Disallow editing for all roles, including Admin (DB‑level guard).
* Commission management and global reassignment continue to use Order ID as the consistent reference. 

---

## 12) Monitoring & Ops

* **Metrics:** Count of opportunities created per day (by module path), sequence high‑water mark, and create error rate.
* **Alerts:** Anomaly detection for sudden spikes or persistent create failures.
* **Observability:** Include `Order_ID_House` in create logs upon success (PII‑free).

---

## 13) Deliverables

1. **Backend:**

   * DB sequence + migration (unique index; immutability guard)
   * Create endpoint integration to assign ID post‑validation
2. **Frontend:**

   * Dynamic Columns registration and labels on both Account and Contact opportunity tables
   * Opportunity Detail read‑only display of Order ID
3. **QA:** Automated tests (unit/integration/E2E) per §10
4. **Docs:** Admin/Support playbook (backfill steps; troubleshooting)

---

## 14) Dependencies & References

* **Accounts Module v1.0** — Opportunity list columns & read‑only behavior. 
* **Accounts Module v2.0** — Order ID generation spec (`H` + sequential; on save; immutable). 
* **Contacts Module v2.0** — Contact→Opportunities tab includes **Order ID – House** field. 
* **Global UI Specs** — Dynamic Columns; form/field display/format standards. 
* **Commission Reassignment System** — Audit history & immutable identifiers (Order ID as anchor). 
* **Activities & Notes Spec** — Optional auto‑log of creation event. 

---

### Acceptance Criteria (checklist)

* [ ] New Opportunity save assigns **unique Order ID** in format **H[number]**. 
* [ ] Field is **read‑only** in all UIs and at DB level. 
* [ ] **Accounts → Opportunities** and **Contact → Opportunities** show Order ID (Dynamic Columns supported).
* [ ] Backfill completed (if needed); **NOT NULL** + **UNIQUE** constraints enforced.
* [ ] Tests pass (concurrency, immutability, UI visibility).

> This plan implements ACC‑09 cleanly and aligns with Opportunity creation flows, Dynamic Columns, and downstream commission/audit requirements.
