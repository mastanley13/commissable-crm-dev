According to a document from **February 2, 2026**, the **Frozen\_columns\_alignment\_outline.md** is trying to turn **CRM-REC-004 (frozen columns \+ single synced horizontal scroll)** into a *very specific* “comparison mode” spec: a locked two-zone layout (frozen left \+ scrollable right) and **a defined set of “alignment pairs” that must visually line up between the top Deposit grid and bottom Revenue Schedule grid**.

Below is a review of your write-up, plus answers to the “Decision checklist” questions using the outline \+ the meeting/ticket sources.

---

## **1\) What the outline is asking for (in plain English)**

### **A. A “schedule-driven” column layout \+ required alignment pairs**

The outline explicitly defines **7 alignment pairs** and says they “MUST be side-by-side vertically”:

* Line Item ↔ Line Item  
* Other – Product Name ↔ Other – Product Name  
* Account Name ↔ Legal Name  
* Quantity ↔ Quantity  
* Price Each ↔ Price Each  
* Actual Usage ↔ Actual Usage  
* Actual Commission ↔ Actual Commission

### **B. A strict 2-zone layout per grid**

For each grid it defines:

* **Frozen Zone (left)**: key identity columns that never move.  
* **Synchronized Scrollable Zone (right)**: columns that move together between the two grids.  
* **File Columns Zone**: pushed far right (dynamic columns, “Other – …” fields, etc.).

### **C. A single horizontal scrollbar controlling both grids**

It calls for **one scrollbar** (below the top table) that scrolls the **scrollable zones** of both grids together.

### **D. Design constraints: fixed widths \+ column settings restrictions**

It provides fixed width guidance for key columns (e.g., line item, quantity, price each, etc.) and says **alignment columns should not be hideable** via column settings.

### **E. Implementation pattern it expects**

The outline’s “HTML Structure Pattern” suggests **splitting each grid into two DOM regions**: frozen container \+ scrollable container, plus a dedicated scrollbar container.

---

## **2\) Where this maps in the code today**

Your mapping to:

* deposit columns in `deposit-reconciliation-detail-view.tsx` (baseLineColumns)  
* schedule columns in `deposit-reconciliation-detail-view.tsx` (baseScheduleColumns)  
* shared `DynamicTable` scroll container  
* prefs via `useTablePreferences`

…is **reasonable**, but I can’t independently verify line numbers or current column IDs because the actual TSX source isn’t part of the uploaded knowledgebase.

So: **ASSUMED** (based on your notes) that DynamicTable owns the horizontal scroll container and both tables share the same table component \+ preference mechanism.

What *is* grounded in the meeting/ticket docs is that the intended feature is a **toggle/lock** that:

* freezes key columns,  
* keeps them lined up top-to-bottom,  
* and uses **one scrollbar** to move both grids.

---

## **3\) Spec conflicts / blockers (yes—your two are real, and there are more)**

### **Blocker \#1 — “Other – Product Name” can’t align as written**

The outline makes **Other – Product Name** an alignment pair, but places it:

* **Frozen** in Deposit (pos 3\)  
* **Scrollable** in Schedules (pos 7\)

Those cannot be vertically aligned “at the same scroll position” because they live in different zones.

### **Blocker \#2 — Actual Usage / Actual Commission offsets won’t match**

Schedules insert multiple columns before Actual Usage (Revenue Schedule Name \+ expected usage columns), while the Deposit grid doesn’t mirror those columns. The outline still demands the pair aligns.

### **Blocker \#3 — Quantity / Price Each likely don’t exist on Deposit lines (per current data model docs)**

In the reconciliation workflow guide’s SQL schema, `deposit_line_items` includes:

* `product_sku`, `product_description`  
* `actual_usage`, `actual_commission`  
* `payment_date`  
  …but **no `quantity` or `price_each` fields**.

Meanwhile, revenue schedules explicitly compute expected usage using **Quantity × PriceEach**.

So if the product decision is “Quantity/Price Each must align across both grids,” that implies a **data model \+ ingestion change** (not just UI).

### **Blocker \#4 — Frozen-zone width mismatch is acknowledged, but not actually resolved**

The outline explicitly mentions an offset:

* Deposit frozen \~500px  
* Schedule frozen \~550px  
  and says to “account for 50px offset.”

But if the frozen widths differ, **scrollable columns won’t line up in the viewport** unless you:

* force both frozen zones to the same width, *or*  
* apply a compensating scrollLeft offset, *and*  
* guarantee identical scrollable column ordering \+ widths.

### **Blocker \#5 — Meeting intent acknowledges the grids don’t have identical fields**

In the Jan 26 meeting, Rob Hootselle explicitly says the **top deposit grid won’t have all the fields the bottom grid has** (because many are calculated fields), even though he wants key columns frozen/lined up and a single scrollbar.

That statement conflicts with the outline’s “everything in these 7 pairs MUST align” framing.

---

## **4\) Recommended clarification to unblock implementation**

### **What the most “source-of-truth” ticket actually requires**

CRM-REC-004 says:

* freeze key columns  
* single horizontal scrollbar for both grids  
* **alignment when lock/toggle enabled**  
* users can reorder **non-frozen** columns without breaking the frozen set

It does **not** mandate the 7 specific alignment pairs.

### **My recommendation: choose a tighter “MVP alignment contract” (closest to the meeting \+ data model)**

Given:

* the meeting acknowledges different columns top vs bottom,  
* deposit line schema doesn’t include quantity/price each,

…**Option A (MVP)** is the most implementable *without* forcing upstream data model changes:

**Option A (recommended):**

1. **Pixel-perfect alignment only for a small “comparison spine”** (identity \+ money-in/money-out):  
   * Line Item  
   * Account Name / Legal Name (and/or show both if available)  
   * Product (decide whether it’s vendor product description vs internal product name—see checklist below)  
   * Actual Usage  
   * Actual Commission  
2. **Single scrollbar \+ synced scroll** for the rest.  
3. Treat Quantity/Price Each and Schedule-only expected columns as **schedule-only context** (not alignment-critical).

This matches the ticket \+ meeting goal (“make matching easier without scanning left/right”), while respecting that the two grids have different fields.

**Option B (strict alignment as written in the outline)** is doable only if you accept **spec and/or data changes**, like:

* making “Other – Product Name” live in the same zone in both tables,  
* rearranging the schedule columns (move schedule-only context columns after aligned columns),  
* and deciding what to do about Quantity/Price Each on Deposit (new fields? blank placeholders?).

---

## **5\) Implementation approach that fits the intent (and respects CRM-REC-004)**

You proposed “sticky left columns in DynamicTable \+ scroll sync \+ hide one scrollbar.” That can satisfy **CRM-REC-004** as long as the lock/toggle enforces:

* fixed frozen set,  
* stable column widths for aligned columns,  
* and consistent ordering in both grids while locked.

However, note the outline’s suggested implementation expects **split DOM containers (frozen \+ scrollable)**.  
You *can* still reach the UX goal with sticky columns, but you must handle:

* frozen width equality (or explicit offset compensation),  
* fixed column widths in lock mode,  
* and “don’t overwrite user preferences” behavior (the meeting implies a toggle that temporarily reorders/locks).

**Implementation detail that matters:**  
In lock mode, enforce **identical column widths** (px) for whichever columns you claim are “aligned.” The outline even provides suggested widths.

---

## **6\) Decision checklist answers (grounded as much as possible)**

### **Q1) Which column ID is “Other – Product Name” for Deposit: `productName` vs adding `productNameVendor`?**

**Most consistent with the docs:** “Other – Product Name” is the **vendor-provided product identifier**, not the internal product catalog name.

Why:

* In the Jan 26 meeting, “Other product name” is explicitly referenced as something visible/wrapping in the UI, implying it’s a raw/vendor-ish value used during reconciliation.  
* The deposit line item schema contains `product_description` (and `product_sku`)—these are vendor-facing descriptors and are good candidates for “Other – Product Name.”

**Recommendation:** Treat Deposit “Other – Product Name” as **deposit\_line\_items.product\_description** (or equivalent “vendor product name/description” field), not the internal `productName`.

**ASSUMED (needs confirmation in your code):** if the UI currently shows a column labeled “Other – Product Name,” it’s probably coming from a dynamic file column or `product_description` mapping, not the internal product entity.

---

### **Q2) Are Quantity and Price Each truly present/required on Deposit lines, or schedule-only?**

**Based on the reconciliation workflow guide schema:** Deposit line items do **not** have quantity/price each fields.

**Based on Milestone 3 schedule specs:** Revenue schedules *do* explicitly use Quantity and Price (Price Each) and compute expected usage from them.

**Answer:** treat **Quantity \+ Price Each as schedule-side fields** unless you decide to extend deposit ingestion/storage.

If you want them in the Deposit grid purely for alignment, that’s a **product decision \+ data decision**, not just UI.

---

### **Q3) Do you really need Actual Usage / Actual Commission pixel-aligned, or is synced scrolling \+ frozen identity columns enough?**

**Meeting intent:** the point of freezing/locking is to prevent the user from scanning left/right “over four columns” while matching, and to “line those up perfectly.”  
**Ticket intent:** alignment matters when lock/toggle enabled, but it doesn’t specify which columns.

**Answer (recommended):**

* Yes, you probably want **pixel-alignment for the “comparison spine” columns** (including Actual Usage \+ Actual Commission), because that’s the core usability win.  
* But you **should not require** pixel-perfect alignment for columns that exist only on the schedule side (expected usage/commission context), because the meeting explicitly notes the top grid won’t contain all the bottom grid’s fields.

So: **synced scrolling \+ frozen identity columns \+ aligned Actual Usage/Commission** is the best “day-to-day matching” outcome *and* consistent with current docs.

---

## **What I’d send to Rob as the “make it implementable” decision summary**

1. Confirm the **exact list of columns that must align in lock mode** (recommend: Line Item, Account/Legal, Vendor Product Description, Actual Usage, Actual Commission).  
2. Confirm “Other – Product Name” \= **vendor product description** (deposit\_line\_items.product\_description) and whether schedules also have an equivalent vendor description field (or if schedule will show internal product name instead).  
3. Confirm Quantity/Price Each are **schedule-only** (unless you want to extend deposit ingestion/storage).  
4. Confirm lock mode should be **temporary** and **must not overwrite saved column prefs** (consistent with the “toggle” discussion).

If you want, I can also rewrite CRM-REC-004 into an updated “lock comparison view” ticket spec that explicitly defines the MVP-aligned columns (and flags which parts of Frozen\_columns\_alignment\_outline.md are inconsistent and should be treated as non-binding).

