## Product Revenue Types

The **Revenue Type** field is a required, enum-backed field used on Products, Opportunity Line Items, and Revenue Schedules.
It controls how revenue is recognized and reported.

---

### Canonical enum codes

In the database and Prisma schema the enum is `RevenueType` with these six values:

- `NRC_PerItem` – Non‑recurring per item (Quantity)
- `NRC_Percent` – Non‑recurring percentage (%)
- `NRC_FlatFee` – Non‑recurring flat fee
- `NRC_Resale` – Non‑recurring resale / one‑time profit
- `MRC_ThirdParty` – Monthly recurring, billed by 3rd party
- `MRC_House` – Monthly recurring, billed by house (in‑house)

These codes are surfaced to the frontend via `/api/products/options` and the shared helper in `lib/revenue-types.ts`.
All dropdowns use the same option list (`REVENUE_TYPE_OPTIONS`) so frontend and backend stay in sync.

---

### User‑facing options and behavior

For end users the options are displayed with friendly labels, matching the business definitions below.

1. **NRC - Quantity** (`NRC_PerItem`)

   Example: we receive a $50 one‑time bonus for every phone we sign up for service.  
   - 5 phones × $50 = **$250** non‑recurring bonus.  
   - Recognized on a single‑month schedule.  
   - Reporting uses this type so NRC revenue is not mixed with MRC (recurring) revenue.

2. **NRC - %** (`NRC_Percent`)

   Example: we receive 200% of the monthly billing amount up front as a non‑recurring bonus.  
   - Monthly billing $200 × 200% = **$400** one‑time bonus.  
   - Recognized on a single‑month schedule.  
   - Reporting keeps this NRC bonus separate from recurring MRC revenue.

3. **NRC - Flat Fee** (`NRC_FlatFee`)

   Example: we receive a flat $100 gift card.  
   - Any fixed, non‑recurring amount.  
   - Recognized on a single‑month schedule, reported as NRC.

4. **NRC - Resale** (`NRC_Resale`)

   Example: we sell a PC for $200 and pay $100 cost of goods sold.  
   - Non‑recurring profit = **$100**.  
   - Used for buying/selling products & services where we track margin with a distinct formula.

5. **MRC - 3rd Party** (`MRC_ThirdParty`)

   Example: we help the client contract with AT&T for fiber for 60 months.  
   - AT&T bills the customer; we track it under 3rd‑party MRC and receive the commission only.  
   - Uses the standard MRC formulas and reporting, but flagged as 3rd‑party revenue.

6. **MRC - House** (`MRC_House`)

   Example: our in‑house reps bill a 12‑month consulting engagement for $100/month.  
   - We bill and collect the $100 × 12; we also calculate commissions as **Actual Gross Usage** less any payments
     to Subagent, House Rep, or incidental costs.  
   - Uses the same MRC formula, but reporting is specifically on “MRC - House” revenue.

---

### Implementation notes

- **Backend**
  - Enum defined in `prisma/schema.prisma` as `RevenueType` with the six codes above.
  - Postgres enum `public."RevenueType"` is kept in sync via `20251117130000_update_revenue_types` and applied migrations.
  - APIs (`/api/products`, `/api/revenue-schedules`, `/api/opportunities/*`) validate and store only these codes.

- **Frontend**
  - Shared definitions live in `lib/revenue-types.ts` (`REVENUE_TYPE_DEFINITIONS`, `REVENUE_TYPE_OPTIONS`).
  - Product Create / Edit, Opportunity Line Item Create / Edit, and Revenue Schedule Detail all use the same dropdown
    options and submit the enum **code** to the API while displaying the friendly label.

This document is the functional source of truth for the Revenue Type field. Any future changes to revenue types
should update **both** this file and the `RevenueType` enum + `lib/revenue-types.ts` so that database, APIs,
and UI remain aligned.

