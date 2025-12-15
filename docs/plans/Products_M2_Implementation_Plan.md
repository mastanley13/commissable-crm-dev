Below is a production‑ready Markdown spec—same style as your Opportunities doc—focused on **Milestone 2 Product implementation**. It is designed for hand‑off to your coding agent and anchors every requirement to your governing documents/MSAP.

> **Traceability Note** — The **Milestone 2 – Opportunities & Products Specifications** define the authoritative scope and field list; the **Contract & Addendum** set acceptance, performance, security, and RBAC baselines; and the **Executive Summary** clarifies program goals. Inline citations point to those sources.

---

# Commissable CRM — Milestone 2: **Products** Implementation Plan

## ✅ Recent Progress Update — October 14, 2025

**Product Detail View Completed:**
- ✅ Full product detail page with 3-tab navigation (Details, Usage, History)
- ✅ GET `/api/products/{id}` endpoint with complete data loading
- ✅ Navigation from list view (clickable Product Name - Vendor/House columns)
- ✅ Usage tracking: Opportunities and Revenue Schedules tables with preferences
- ✅ History tab infrastructure ready for audit log integration
- ✅ All formatting utilities (currency, percent, date, revenue type humanization)
- ✅ Responsive design matching Account/Contact/Opportunity detail views
- 📁 Files: `components/product-details-view.tsx`, `app/(dashboard)/products/[productId]/page.tsx`, `app/api/products/[productId]/route.ts`

**Still Pending:**
- Create/Edit forms with validation
- Audit logging implementation
- Product lookup/picker for Opportunities
- Performance optimization (caching, instrumentation)

---

**Executive Summary**
Build a robust **Product Catalog** (list, detail, create/edit, pricing attributes, tax/discount handling, and lookups) that integrates with **Opportunities** line items and conforms to MSAP acceptance tests, security/performance budgets, and RBAC. All feature behavior and field definitions are governed by the Milestone‑2 spec/MSAP; this plan calls out the expected UX, API, data model, and UAT so the team can deliver to contract.  

---

## 1) Scope & Non‑Scope

### In Scope

* **Product Catalog module**: List, Detail, Create/Edit with all **MSAP‑specified fields** (e.g., Name, SKU, Status, Category, Unit, Price/Cost, Tax Class, Description, Active flag). Field names/types/validations are controlled by MSAP. 
* **Search & Filters**: name/SKU keyword, category, status/active, price range; server‑side pagination (≤100 rows per page). 
* **Pricing/Tax/Discount attributes** required for Opportunity line‑items math; canonical price is sourced from Products per MSAP rules. 
* **RBAC** for product management (4‑role system) and **audit logging** for product CRUD. 
* **Performance/Security budgets** per contract; browser support = latest two major versions. 

### Explicitly Out of Scope (for M2 unless MSAP states otherwise)

* Mobile/native app deliverables (excluded by Addendum). 
* Inventory/stock management, multi‑warehouse, PIM syndication, or advanced price lists **unless** explicitly listed in MSAP for M2. 

---

## 2) Dependencies & Cross‑Module Links

* **Opportunities (M2)**: Opportunity line items must lookup Products; unit price/attributes flow from Product to calculate line totals per MSAP. 
* **Accounts/Contacts (M1)**: No direct entity dependency, but Product usage appears in sales workflows built on top of Accounts/Contacts. 
* **Revenue & Reconciliation (M3)**: Product pricing/tax data influences downstream totals, imports, and reconciliation math; migration order places **Products before Opportunities**.  
* **Supporting Modules & Launch (M4)**: Admin/Settings UX and training collateral referenced at launch; Products must obey global admin controls defined for go‑live. 

---

## 3) Data Model (Authoritative list comes from MSAP)

> Replace placeholders below with the exact **field matrix** from the Milestone‑2 spec/MSAP (name, type, required, default, picklist, validation). 

### Entities

* `product` (primary)

### Core Fields (baseline frame — confirm with MSAP)

* Identification: `id (uuid)`, `sku (unique)`, `name`, `active`
* Classification: `category`, `subcategory`, `tags`
* Pricing: `unit_price`, `currency`, `discount_policy`, `tax_class`, `cost`
* Presentation: `short_description`, `long_description`
* Ops: `unit_of_measure`, `created_at`, `updated_at`, `created_by`, `updated_by`
  **→ Replace with MSAP’s exact field names/types/constraints.** 

### Constraints & Indexes

* **Uniqueness**: `sku` unique (enforced DB + API).
* **Indexes**: `(sku)`, `(lower(name))`, `(category, active)`, `(unit_price)` to meet **search p95 ≤ 500ms**. 

---

## 4) Business Rules (MSAP‑controlled)

* **SKU Uniqueness**: Prevent duplicates on create/edit; surface actionable error message. 
* **Pricing Source of Truth**: Opportunity line item pulls default `unit_price` from Product unless MSAP allows override/discount; rounding/tax rules per MSAP. 
* **Active/Inactive**: Inactive products hidden from pickers but remain reportable. 
* **Tax/Discount**: Apply MSAP bounds and validation (e.g., discount range, tax class compatibility). 

---

## 5) UI/UX Specification

### Product List

* Columns (swap for MSAP exact set): `SKU`, `Name`, `Category`, `Unit Price`, `Status (Active)`, `Updated`.
* Controls: search (name/SKU), filters (category, status, price range), sort, saved views.
* Pagination: **server‑side ≤100 rows/page**, virtualized table, empty‑state guidance. 

### Product Detail

* **Header**: Name, SKU, Active pill, Category, Unit Price/Currency.
* **Tabs**

  * **Details** (all fields; inline edit if role allows)
  * **Usage** (read‑only references to Opportunities that include this Product, if supplied by MSAP)
  * **History** (audit changes) 

### Create/Edit Form

* Real‑time field validation per MSAP (required, pattern, ranges).
* Currency/price inputs with locale formatting; tax/discount pickers constrained by MSAP rules. 

---

## 6) Permissions (RBAC)

* **Roles**: 4‑tier system required by success metrics (Admin, Manager, Sales, Viewer—exact names may differ). 
* **Baseline Matrix (confirm in MSAP)**

  * Admin: full CRUD + configuration
  * Manager: CRUD within scope (team/BU if defined)
  * Sales: Read; create/edit **only if** MSAP permits
  * Viewer: Read‑only
* **Field‑level**: If MSAP marks sensitive fields (e.g., `cost`), restrict visibility to Admin/Manager. 

---

## 7) APIs & Services

> Stack follows the contract suggestions: **Node.js 20 + TypeScript, Next.js 14 (App Router/Route Handlers), Postgres 15, Redis**, GCP managed services. 

### REST Endpoints (prefix `/api/products`)

* ✅ `GET /` — list with filters (`q`, `category[]`, `active`, `min_price`, `max_price`, `page`, `size≤100`); return paged results **≤500ms p95** (indexes + Redis caching). **IMPLEMENTED**
* `POST /` — create (validate SKU unique; enforce MSAP rules).
* ✅ `GET /{id}` — detail. **IMPLEMENTED Oct 14, 2025** — Full product data with usage tracking (opportunities, revenue schedules), distributor/vendor joins, audit log support
* ✅ `PATCH /{id}` — partial update; guard field‑level permissions (e.g., `cost`). **IMPLEMENTED** (currently active toggle; needs expansion for all fields)
* ✅ `DELETE /{id}` — soft delete or status flip per MSAP (recommended: keep history). **IMPLEMENTED**
* `GET /lookup` — lightweight picker (name/SKU prefix search; **<1s p95**). 

### Security

* OAuth2/OIDC; signed JWT; HttpOnly/SameSite cookies; TLS 1.3; AES‑256 at rest; **scope‑based RBAC** on every route. 

### Auditability

* Log all product CRUD (old→new values for priced fields) to centralized logging (e.g., Cloud Logging/BigQuery). 

---

## 8) Performance, Reliability & Observability

* Budgets: **Page load <2s p95**, **Form save <5s p95**, **Search <500ms p95**, **Dropdown/lookup <1s**, **Uptime 99.5%**; server‑side pagination ≤100. 
* Metrics & Tracing: request latency, error rate, slow queries, cache hit ratio dashboards. 
* Browser support: latest 2 versions Chrome/Firefox/Safari/Edge. 

---

## 9) Validation Rules (fill from MSAP)

* **Field‑level**: required fields (e.g., SKU, Name, Unit Price); patterns (SKU); ranges (price ≥ 0, discount bounds). 
* **Cross‑field**: `active=false` blocks selection in Opportunity pickers. 
* **Currency**: adhere to MSAP currency list/rounding rules. 

---

## 10) Migration & Test Data

* **Import sequence** for dry‑runs and go‑live: **Accounts → Contacts → Products → Opportunities → Transactions/Invoices**; stage tables + row‑level error logs; exception reporting. 
* **Test data**: provide ≥100 sample Product records with edge cases (special characters in SKU, long names, inactive items, high‑precision prices). 

---

## 11) Testing & UAT

### Automated

* **Unit**: SKU uniqueness, price/tax validations, active/inactive logic.
* **Integration**: API create/edit/list; lookup latency; RBAC enforcement; audit log writes.
* **Load**: list & search at target QPS to ensure **p95** budgets. 

### UAT Acceptance (per Agreement & Addendum)

* Acceptance follows MSAP criteria; **Addendum/MSAP has precedence** on conflicts. Acceptance window **7 business days** per Addendum; base Agreement lists **15 business days** (Addendum controls). 
* Payment trigger requires: **100% of specified fields working**, features functional, performance/security verified, UAT passed, written sign‑off. 

**UAT Checklist (Products)**

* [ ] Create/Edit Product with **all MSAP fields** and validations. 
* [ ] List filters & sort; server‑side pagination (≤100); search p95 ≤ 500ms (test with 10k+ rows). 
* [ ] Lookup API returns results <1s p95 and respects `active` filter. 
* [ ] RBAC: only permitted roles can create/edit/delete; sensitive fields (e.g., cost) restricted. 
* [ ] Audit trail captured for all CRUD and priced‑field changes. 
* [ ] Opportunity line item pulls Product price per MSAP and totals correctly (integration test). 

---

## 12) Accessibility & UX Quality Bar

* Keyboard support for grids/forms; visible focus; proper labels/aria; color contrast AA; inline validation and save‑guard on unsaved edits. (General UX standard aligned with launch expectations.) 

---

## 13) Delivery Workflow (Milestone cadence)

* **Days 1–3**: Requirements lock + MSAP signoff (field matrix finalized). 
* **Day 4–10**: Build & staging deployment; midpoint demo on Day 7. 
* **Days 11–13**: UAT + two correction cycles for Critical/High defects.
* **Day 14**: Final walkthrough, acceptance, payment release. 

---

## 14) Dev Tasks (granular checklist)

**Back end**

* [ ] DB migration for `product` per MSAP schema; add unique index on `sku`. 
* [ ] REST endpoints; Zod/JSON schema validation per MSAP; error taxonomy. 
* [ ] RBAC guards; field‑level protection for sensitive attributes. 
* [ ] Caching (Redis) for list/search; cache bust on writes. 
* [ ] Audit logging for create/update/delete with field diff (esp. price/cost). 

**Front end**

* [x] Product List with search/filters/sort; pagination ≤100; empty states.
* [x] Product Detail + tabs (Details, Usage, History). ✅ **COMPLETED Oct 14, 2025**
* [x] Navigation from list to detail (clickable product names). ✅ **COMPLETED Oct 14, 2025**
* [ ] Create/Edit form with real‑time validation and currency formatting.
* [ ] Lightweight lookup component for Opportunities (typeahead by name/SKU). 

**Testing & Ops**

* [ ] Unit/integration/load tests mapped to performance budgets. 
* [ ] Seed ≥100 products (edge cases included). 
* [ ] CI: build/test/lint/SAST; dependency & container scans; SBOM. 

---

## 15) Acceptance Criteria (Definition of Done)

* **Functional**: All **MSAP‑specified fields** and behaviors implemented; Opportunity picker and line‑item integration work end‑to‑end. 
* **Performance/Security**: All budgets and security controls satisfied (TLS 1.3, AES‑256 at rest, OAuth2/OIDC, RBAC, audit). 
* **UAT & Sign‑off**: Meets MSAP acceptance; sign‑off recorded; milestone payment triggers per Agreement. 

---

## 16) Open Questions / MSAP TODOs (provide these from the M2 package)

1. **Product Field Matrix** — paste the authoritative list (name, type, req’d, default, picklist, help text). 
2. **Pricing & Currency Rules** — confirm default price source, allowed overrides/discount caps, rounding, tax class mapping. 
3. **Classification** — confirm category tree/tags and whether it’s admin‑editable in M2 or M4.  
4. **Deactivation Behavior** — define how inactive products appear in historical Opportunities and reports. 
5. **Imports/Exports** — confirm CSV template and whether product import is included in M2 or deferred. 

---

### Appendix — References

* **Document 3: Milestone 2 – Opportunities & Products Specifications** (scope, fields, validations). 
* **Document 6: Revised CRM Development Contract (incl. Addendum)** (acceptance, RBAC, performance, security, pagination, audit, migration/testing, browser matrix). 
* **Document 2: Milestone 1 – Core Foundation** (context/deps with Accounts/Contacts). 
* **Document 4: Milestone 3 – Revenue & Reconciliation** (downstream math & reporting considerations). 
* **Document 5: Milestone 4 – Supporting Modules & Launch** (admin, training, launch norms). 
* **Executive Summary – Commissable & Strategix AI Overview** (program goals, value). 

---

## Gaps & Assumptions

* **Field details** (names/types/picklists/validations) and any advanced **pricing/tax** behaviors are governed by the Milestone‑2 MSAP; placeholders above intentionally defer to that artifact to keep acceptance tight. If you share the field matrix excerpt, I’ll insert it into §3 and propagate validations into §4/§9 and UAT test cases. 

---

> **Deliverable**: Save as `products-implementation-spec.md` in your repo/docs.
> **Why this works**: It keeps developers locked to MSAP scope, enforces contract budgets/security, and provides a crisp UAT checklist for sign‑off. 
