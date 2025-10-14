Below is a production‑ready Markdown spec you can hand to your coding agent. It’s structured to keep work tight around Milestone 2’s **Opportunities** implementation, with explicit scope, technical criteria, UAT checks, and “TODO” placeholders where your Milestone‑2 PDF/MSAP holds the authoritative field/stage lists.

> **Citations note** — This plan aligns to your binding specs and contract: Milestone 2 (“Opportunities & Products”) is the accepted scope artifact; MSAP governs acceptance; performance/security budgets are mandatory; four‑role permissions are in scope; mobile support is out of scope. I’ve cited those requirements inline so the agent can trace back to your source of truth. [Sources: Milestone 2 Specs (Document 3); Contract & Addendum (Document 6).]     

---

# Commissable CRM — Milestone 2: **Opportunities** Implementation Plan

**Goal**
Deliver the Opportunities module (list + details + create/edit + product line items + stage/probability/amount logic) with role‑based access, performance/security budgets, audit logging, and UAT acceptance aligned to the MSAP for Milestone 2. 

**What “done” means**

* All Opportunity features in the Milestone‑2 spec/MSAP work and pass UAT; security + performance budgets met; sign‑off captured per the Agreement/Addendum.   

---

## 1) Scope & Non‑Scope

### In Scope

* Opportunities page: **List**, **Detail**, **Create/Edit** forms, inline actions, stage transitions, probability, expected close date; linkage to **Accounts/Contacts** (from M1) and **Products** (this milestone).  
* **Product Line Items** sub‑grid on Opportunity (add/select product, qty, price, discounts, taxes per MSAP rules). 
* **RBAC (4 roles)** with scope restrictions per Success Metrics. 
* **Audit logging** for CRUD on Opportunities/line items. 
* **Server‑side pagination** (≤100 rows/page), **search < 500ms p95**, **page load < 2s p95**, **form save < 5s p95**. 

### Explicitly Out of Scope (Milestone 2)

* Mobile/native app work; mobile‑specific UX. (Excluded by Addendum.) 

---

## 2) Dependencies & Cross‑Module Links

* **Accounts/Contacts (M1)**: Opportunity must reference an Account; optional primary Contact. Ensure lookup/autocomplete to M1 data models. 
* **Products (M2)**: Selectable catalog; line items priced and totaled on Opportunity per MSAP. 
* **Revenue (M3)**: Data handoff expectations — import sequence **Accounts → Contacts → Products → Opportunities → Transactions/Invoices**; totals used later for reconciliation. 

---

## 3) Data Model (Proposed scaffolding — confirm with MSAP)

> **Authoritative field list lives in the Milestone‑2 spec/MSAP**. Insert exact names, types, picklists, and validation rules below. 

### Entities

* `opportunity` (primary)
* `opportunity_line_item` (child)
* References: `account`, `contact`, `product`, `user`

### Core Fields (baseline proposal; replace with canonical MSAP matrix)

* `opportunity`: `id (uuid)`, `name`, `account_id`, `primary_contact_id`, `stage`, `probability`, `amount`, `currency`, `expected_close_date`, `owner_user_id`, `source`, `lost_reason`, `created_at`, `updated_at` **→ Replace with MSAP field IDs/types/constraints.** 
* `opportunity_line_item`: `id`, `opportunity_id`, `product_id`, `sku`, `description`, `qty`, `unit_price`, `discount`, `tax_rate`, `line_total` **→ Replace per MSAP.** 

### Enumerations / Picklists (placeholders — supply from MSAP)

* **Stages**: `{{STAGE_LIST_FROM_DOC3}}` with allowed transitions and required fields by stage. 
* **Sources**: `{{SOURCE_LIST_FROM_DOC3}}`. 
* **Currencies**: `{{CURRENCY_RULES_FROM_DOC3}}`. 

### Derived Fields (calculate server‑side)

* `weighted_amount = amount * probability` (if specified in MSAP; else remove). 

### Indexing (performance)

* Index on `(account_id, stage, expected_close_date)`, `(owner_user_id, stage)`, and text index on `name`. Tune to meet **sub‑500ms searches p95**. 

---

## 4) UI/UX Specification

### List View

* Columns: `Name`, `Account`, `Amount`, `Probability`, `Stage`, `Expected Close`, `Owner`, `Last Updated` (swap to MSAP exact set).
* Controls: filter by stage/owner/date, keyword search, column sort, saved views.
* Pagination: **server‑side ≤100 rows/page**; virtualized rows. 
* Bulk actions: stage change (if allowed), ownership reassignment (if role permits).

### Kanban (if in MSAP)

* Pipelines as columns by `stage` with drag‑and‑drop; guard transitions via rules. 

### Detail View

* **Header**: Opportunity name, Account pill, `amount` (formatted), `weighted_amount` (if used), `stage` badge, `probability%`, `expected_close_date`.
* **Tabs**

  * **Details**: all fields (read‑only labels + edit button).
  * **Products**: line items grid (add/search product, qty/price/discount/tax, totals). 
  * **Activity**: notes, tasks (if included in M4 then simple log for now). 
  * **History**: audit log of field changes. 

### Create/Edit Form

* Progressive disclosure by stage; **required fields** per stage enforced; date and numeric validation per MSAP. 
* **Products picker**: type‑ahead by name/SKU; auto‑fills price, allows discount/tax inputs per rules. 

### Actions

* `Edit`, `Duplicate`, `Close Won`, `Close Lost` (+ lost reason), `Change Owner` (RBAC), `Add Product`, `Remove Product`.

---

## 5) Business Rules

> Replace placeholders with MSAP rules; these bullets tell the agent exactly where to wire logic.

* **Stage Transitions**: allowed moves `{{TRANSITIONS_FROM_DOC3}}` with validation gates (e.g., amount/close date required past `{{STAGE_X}}`). 
* **Probability Handling**: derive from stage or manual entry? `{{MSAP_SETTING}}`. 
* **Amount & Currency**: currency rules, rounding, multi‑currency support `{{IF APPLICABLE}}`. 
* **Line Item Totals**: `line_total = qty * unit_price - discount + tax`; **opportunity amount** = sum of line totals (or manual; choose per MSAP). 
* **Ownership**: only admins/managers can reassign; individual contributors only when owner = self (4‑role RBAC baseline). 
* **Duplicate Detection**: optional — `{{MSAP_DUPLICATE_RULES}}`. 

---

## 6) Permissions (RBAC)

* **Roles**: `Admin`, `Manager`, `Sales`, `Viewer` (names per MSAP/Success Metrics; 4‑role system must be functional at launch). 
* **Matrix (baseline; confirm against MSAP)**

  * Admin: full CRUD + config.
  * Manager: CRUD within team; bulk actions; reassign owner.
  * Sales: CRUD owned records; read team; cannot reassign owner.
  * Viewer: read‑only.
* **Field‑level**: mark any sensitive fields in MSAP as read‑only/hidden by role. 

---

## 7) APIs & Services

> Stack per contract suggestions (React 18 + Next.js 14 + Postgres 15 + Redis). Use Next.js App Router + Route Handlers for REST. 

### Endpoints (prefix `/api/opportunities`)

* `GET /` — list with filters (`q`, `stage[]`, `owner`, `date_from`, `date_to`, `page`, `size≤100`), returns paged results in ≤500ms p95 via indexed queries + Redis caching. 
* `POST /` — create (body = MSAP field schema).
* `GET /{id}` — details + line items.
* `PATCH /{id}` — partial update; enforce stage transition rules.
* `DELETE /{id}` — soft delete (if enabled).
* `POST /{id}/close` — won/lost with validation.
* `POST /{id}/line-items` / `PATCH /line-items/{id}` / `DELETE /line-items/{id}`.

### AuthN/AuthZ & Security

* OAuth2/OIDC, signed JWTs; scope‑based RBAC; HttpOnly/SameSite cookies; short‑lived access + rotating refresh tokens. TLS 1.3; AES‑256 at rest. 
* **Audit logging**: log all auth events + CRUD on Opportunities/line items to Cloud Logging/BigQuery. 

---

## 8) Performance, Reliability & Observability

* Budgets: **Load < 2s p95**, **Save < 5s p95**, **Search < 500ms p95**, **Dropdown < 1s**, **Uptime 99.5%**. 
* Pagination ≤100 rows; virtualized list. 
* Indexes per §3; query plans verified; caching of common filters.
* Tracing/metrics dashboards for request latency, error rate, slow queries.
* Browser support: latest 2 versions of Chrome/Firefox/Safari/Edge. 

---

## 9) Validation Rules (fill from MSAP)

* **Field‑level**: required/format/range per MSAP matrix (e.g., amount > 0 when stage ≥ `{{STAGE}}`; expected_close ≥ today). 
* **Line items**: qty ≥ 1; discount/tax bounds; product must exist in catalog. 
* **Cross‑field**: if `Close Lost`, require `lost_reason`. 

---

## 10) Migration & Test Data

* Import order for dry‑runs and go‑live: **Accounts → Contacts → Products → Opportunities → Transactions/Invoices**; use staging tables + row‑level error logs and exception reports. 
* Provide ≥100 sample Opportunity records for testing with edge cases (per contract). 

---

## 11) Testing & UAT

### Automated

* **Unit tests** for all business rules (stages, totals, validations).
* **Integration tests** for API endpoints and DB constraints.
* **Load tests** for list/search to verify p95 budgets. (CI to publish latency histograms.) 

### UAT Acceptance (per Agreement/Addendum)

* Acceptance follows MSAP criteria; **MSAP controls on conflicts**. Addendum states MSAP‑anchored acceptance with **7 business days**; the Agreement mentions **15 business days** — the **Addendum has precedence**.  
* Required for Milestone payment: **all specified fields working; features functional; performance met; security verified; UAT passed; written sign‑off**. 

**UAT Checklist (Opportunities)**

* [ ] Create, view, edit, delete Opportunity with all MSAP fields. 
* [ ] Stage transitions enforce required fields; probability rules applied. 
* [ ] Products: add/edit/remove line items; totals correct; tax/discount per MSAP. 
* [ ] List view: filter/sort/search; **p95 < 500ms**; pagination ≤100 rows.  
* [ ] RBAC: role behavior matches 4‑role system. 
* [ ] Audit log entries for all CRUD and stage changes. 
* [ ] Browser matrix passes (latest 2 versions). 

---

## 12) Accessibility & UX Quality Bar

* Keyboard navigability, visible focus, labels/aria for all inputs, color‑contrast compliant.
* Inline validation messages; prevent data loss on navigation with unsaved changes banner.

---

## 13) Delivery Workflow (Milestone cadence)

* **Day 1–3**: requirements lock + MSAP signoff. 
* **Day 4**: technical approach doc; **Day 7**: mid‑point demo; **Day 10**: staging ready.
* **Days 11–13**: UAT + two correction cycles for Critical/High. **Day 14**: sign‑off/payment. 

---

## 14) Dev Tasks (granular checklist)

**Back end**

* [ ] DB migrations for `opportunity` + `opportunity_line_item` (per MSAP schema). 
* [ ] Indexes per §3; verify query plans.
* [ ] REST route handlers; input validation; error taxonomy.
* [ ] Stage transition service; probability logic; totals calculator.
* [ ] RBAC guards; ownership checks. 
* [ ] Audit event publisher to Cloud Logging/BigQuery. 
* [ ] Caching (Redis) for list/filter endpoints; cache bust on writes. 

**Front end**

* [ ] List view with filters, sorting, saved views, pagination (≤100). 
* [ ] Kanban (if in MSAP). 
* [ ] Detail view + tabs (Details, Products, Activity, History).
* [ ] Create/Edit forms with per‑stage required fields and inline validation.
* [ ] Products sub‑grid + picker with price/discount/tax. 
* [ ] Global loading states; optimistic UI for line‑items (if safe).

**Testing & Ops**

* [ ] Unit + integration + load tests tied to performance budgets. 
* [ ] Seed scripts for ≥100 test records. 
* [ ] CI: build/test/lint/SAST; dependency scanning; SBOM. 
* [ ] Release to staging; smoke tests; UAT support.

---

## 15) Acceptance Criteria (Definition of Done)

* **Functional**: All MSAP features pass test cases; Opportunity lifecycle complete (create→progress→close); products flow. 
* **Performance/Security**: Budgets met; TLS 1.3; AES‑256 at rest; OAuth2/OIDC; RBAC; audit logging on. 
* **UAT & Sign‑off**: Meets MSAP acceptance; sign‑off recorded; milestone payment trigger conditions satisfied. 

---

## 16) Open Questions / MSAP TODOs

1. **Field Matrix** — paste the authoritative Opportunity + Line Item fields (name, type, required, default, help text). 
2. **Stage & Probability** — supply the exact stage list, transition rules, and whether probability is stage‑derived or editable. 
3. **Pricing Rules** — confirm source of unit price (product catalog vs. manual), discount/tax rules, rounding, and total formula. 
4. **RBAC Nuances** — any field‑level visibility restrictions beyond the 4‑role baseline. 
5. **UAT Cases** — attach the Opportunity UAT case list from the MSAP (expected inputs/outputs). 

---

### Appendix A — References

* **Document 3: Milestone 2 – Opportunities & Products Specifications** (controls fields & rules for this module). 
* **Document 6: CRM Development Contract & Addendum** — acceptance gates, performance/security budgets, RBAC requirement, browser matrix, pagination, audit logging, migration sequencing, and MSAP precedence.     

---

## Gaps & Assumptions

* I could not extract the **field/stage** tables directly from the Milestone‑2 PDF; the plan above intentionally marks those as **MSAP‑controlled TODOs** so your agent stays within scope and you retain acceptance control. If you drop in the field & stage matrices (or a text‑friendly PDF), I’ll slot them into the spec immediately. 

---

> **Deliverable Format**: Save this as `opportunities-implementation-spec.md` in your repo/docs.
> **Traceability**: This spec cites your governing documents so reviewers can validate alignment during UAT and sign‑off.  
