When **Quantity**, **Price (per unit)**, or **Commission Rate (%)** changes and those updates are applied to the selected schedules, several dependent fields should be recalculated. In practice, most of them should update automatically.  
Specifically:

* **Expected Usage (Gross)** \= Quantity × Price  
* **Expected Usage (Net)** should recalculate based on the updated Expected Usage (Gross), adjusted by any additions or deductions.  
* **Expected Commission (Gross)** should follow the same recalculation logic as Expected Usage.  
* **Expected Commission (Net)** should also update accordingly.

Any change to the **Expected Rate (%)** should cascade through and recalculate *all* Expected Commission Gross and Net values tied to the affected schedules.  
Right now, those recalculations don’t appear to be triggering when pricing or rates are modified during schedule management. Can you take a look and see what’s preventing the updates from firing?  
---

here’s a **dev-ready package** with **acceptance criteria \+ a concrete example \+ dependency map \+ test spec**.  
---

**Acceptance Criteria**  
**A) Single-schedule recalculation (immediate \+ persisted)**

1. Given a Revenue Schedule with existing values, when the user edits **Qty** and saves/applies,  
   * Then **Expected Usage Gross** must equal Qty × Price.  
   * And **Expected Usage Net** must equal Expected Usage Gross \+ Adjustment.  
   * And **Expected Commission Gross/Net** must recalc using the updated usage and rate.  
   * And the updated calculated values must be persisted (refresh page shows same results).  
2. When the user edits **Price (per unit)** and saves/applies,  
   * Same cascade behavior as above.  
3. When the user edits **Expected Rate (%)** and saves/applies,  
   * Then **all commission calculated fields** (gross \+ net) must update to match the new rate.  
   * Usage gross/net should only change if they depend on rate (they shouldn’t, unless there’s a special rule).

**B) Multi-schedule “Apply to selected” recalculation**

4. When the user selects **N schedules** and applies a change to Qty/Price/Rate,  
   * Then **every selected schedule** must recalc consistently.  
   * And **no unselected schedule** may change.  
5. When the user applies changes via bulk UI,  
   * Then the UI must display the recalculated fields **without requiring page refresh**.  
   * And a manual refresh must confirm values persisted.

**C) Data integrity / rounding**

6. Rounding rules must be consistent:  
   * Currency fields rounded to 2 decimals.  
   * Rates stored as decimal or percent consistently (e.g., 0.12 vs 12). No mixed interpretation.  
7. No stale computed values:  
   * After any edit, the recalculated fields must match the formula outputs from the current inputs.

**D) Regression / safety**

8. Editing a non-dependent field (e.g., notes) must not alter computed totals.  
9. If an update fails server-side, UI must not show computed values that weren’t persisted.

---

**Worked Example (Numbers)**  
Assume schedule fields:

* Qty \= **100**  
* Price \= **$200.00**  
* Adjustment (Usage) \= **\-$500.00**  
* Expected Rate % \= **10%**  
* Commission Adjustment \= **\+$100.00** (if applicable)

**Before change:**

* Expected Usage Gross \= 100 × 200 \= **$20,000.00**  
* Expected Usage Net \= 20,000.00 \+ (-500.00) \= **$19,500.00**  
* Expected Commission Gross \= 20,000.00 × 10% \= **$2,000.00**  
* Expected Commission Net \= 2,000.00 \+ 100.00 \= **$2,100.00**

**Change Price from $200.00 → $250.00 (Apply):**

* Expected Usage Gross \= 100 × 250 \= **$25,000.00**  
* Expected Usage Net \= 25,000.00 \- 500.00 \= **$24,500.00**  
* Expected Commission Gross \= 25,000.00 × 10% \= **$2,500.00**  
* Expected Commission Net \= 2,500.00 \+ 100.00 \= **$2,600.00**

**Change Expected Rate from 10% → 12% (Apply):**

* Expected Commission Gross \= 25,000.00 × 12% \= **$3,000.00**  
* Expected Commission Net \= 3,000.00 \+ 100.00 \= **$3,100.00**  
* Usage gross/net unchanged by rate change.

---

**Recalc Dependency Map (Field → Depends On → Trigger)**  
**Inputs (user-editable)**

* qty  
* price  
* usageAdjustment (if editable)  
* expectedRatePct  
* commissionAdjustment (if editable)

**Derived fields (computed)**

1. expectedUsageGross  
   * Depends on: qty, price  
   * Recalc trigger: change to qty OR price (single or bulk apply)  
2. expectedUsageNet  
   * Depends on: expectedUsageGross, usageAdjustment  
   * Recalc trigger: change to qty/price (via gross) OR usageAdjustment  
3. expectedCommissionGross  
   * Depends on: expectedUsageGross *(or expectedUsageNet if that’s the intended base — pick one and enforce)*, expectedRatePct  
   * Recalc trigger: change to qty/price OR expectedRatePct  
4. expectedCommissionNet  
   * Depends on: expectedCommissionGross, commissionAdjustment  
   * Recalc trigger: change to qty/price OR expectedRatePct OR commissionAdjustment

**Recommended dependency ordering (topo order)**  
qty/price → expectedUsageGross → expectedUsageNet → expectedCommissionGross → expectedCommissionNet  
---

**Test Spec (Dev \+ QA)**  
**1\) Unit Tests (pure calculation)**  
Create a deterministic calculation function (or service) and unit test it.  
**Tests**

* expectedUsageGross \= qty × price  
  * qty=0, price\>0 \=\> 0  
  * qty\>0, price=0 \=\> 0  
  * qty=100, price=250 \=\> 25,000  
* expectedUsageNet \= expectedUsageGross \+ usageAdjustment  
  * adjustment negative and positive  
* expectedCommissionGross \= base × rate  
  * rate as 10% vs 0.10: ensure consistent representation  
* expectedCommissionNet \= expectedCommissionGross \+ commissionAdjustment

**Rounding**

* verify currency rounding to 2 decimals (especially rate multiplications like 0.1234)

**2\) Integration Tests (API / persistence)**  
Assuming an endpoint like PATCH /schedules/:id and bulk apply like POST /schedules/bulkUpdate.  
**Single schedule:**

* Create schedule with known inputs  
* PATCH qty  
* Assert response includes updated derived fields  
* GET schedule again  
* Assert derived fields persisted \+ correct

**Bulk update:**

* Create 3 schedules  
* Bulk update price for 2 selected  
* Assert:  
  * selected schedules derived fields updated correctly  
  * unselected schedule unchanged  
* GET all schedules, re-assert

**Concurrency / race safety**

* Fire two rapid PATCH calls (price then rate)  
* Assert final state reflects latest inputs and all derived fields consistent

**3\) UI / E2E Tests (Cypress/Playwright)**  
**Scenario: bulk apply**

1. Open Opportunity → Revenue Schedules  
2. Select schedules A \+ B (leave C unselected)  
3. Change Price to 250 and apply  
4. Assert in UI:  
   * A/B expectedUsageGross updates immediately  
   * A/B expectedCommissionGross updates immediately  
   * C unchanged  
5. Refresh page  
6. Assert values remain (persisted)

**Scenario: rate change**

1. Select A \+ B  
2. Change expected rate 10% → 12% apply  
3. Assert commission gross/net change; usage gross/net unchanged  
4. Refresh page; confirm persisted

**4\) Negative / Guard Tests**

* Apply with empty selection should not modify anything (and should warn user)  
* Invalid inputs (negative qty? non-numeric price?) should block apply with validation message  
* If backend returns error, UI must rollback/retain previous computed display state

---

**Dev Notes (Implementation Hint)**  
If this is currently “stale UI”, the fix usually falls into one of these buckets:

* Derived fields are being computed client-side but not recomputed after bulk update state mutation  
* Derived fields computed server-side but API response doesn’t return recomputed values (or UI ignores them)  
* Bulk update writes only raw inputs and skips recompute hook (e.g., missing recalculate() call on bulk path)

If you tell me whether calculations are **server-derived** or **client-derived** today, I can tailor the “where to put the recompute” guidance into an exact approach (service layer / DB computed columns / trigger / domain model hook).  
   
