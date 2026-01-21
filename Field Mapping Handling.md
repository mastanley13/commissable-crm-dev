## **1\) When a user maps to an Opportunity field — A vs B vs C**

### **Decision: Option A (persist raw value)**

**Persist the raw value onto the created DepositLineItem (if there’s a column) or store it in a JSON metadata structure (e.g., `DepositLineItem.metadata.opportunity.*`).**

### **Exact reasons grounded in the docs**

1. **Deposit imports are designed as “reactive reconciliation,” not CRM object creation.**  
   The workflow explicitly separates:  
* **Proactive system:** “Opportunity setup → Product selection → Schedule generation”  
* **Reactive system:** “Vendor sends deposit file → Smart matching → Exceptions via FLEX”  
  This strongly implies the deposit file ingestion should *not* be creating/updating Opportunities as a default behavior.  
2. **Deposit Line Items are defined as rows from the vendor/distributor file, used for matching \+ amounts, and the system expects to append metadata from deposits.**  
   The exhaustive reconciliation workflow says the system creates Deposit \+ Deposit Line Items, validates required fields, and on approval it will **“append any new metadata from the deposit”** and propagate as needed. That’s explicitly aligned with “store what came in” rather than “use it to upsert core CRM records.”  
3. **The line-item-to-schedule linkage is a matching outcome (`matched_schedule_id`), not an import-time Opportunity action.**  
   The deposit line item schema example includes **`matched_schedule_id`** (and matching fields like customer/order/product identifiers), but there is **no Opportunity foreign key on deposit\_line\_items** in that schema. That’s another signal that the system expects reconciliation/matching to establish the linkage later, rather than mapping directly to Opportunity on import.  
4. **Your most recent meeting guidance explicitly endorses “store extra incoming fields in metadata,” not updating internal categorization/canonical records.**  
   Rob’s guidance: vendor/distributor-provided descriptors are “only going to \[be used\] for matching,” and vendor-provided fields like “services” can “just sit in metadata” and do not need to change how you catalog/group products. While he’s discussing product-family/subtype, the broader rule is clear: **incoming deposit fields should be stored as metadata for matching rather than updating canonical system records.**  
   **Why not Option B as the default?**

Option B (“use it as a lookup key and set `primaryRevenueScheduleId`”) is **not described as the default import behavior** in the specs. The specs position matching as an algorithmic \+ manual reconciliation step.

**Suggested refinement (ASSUMED, because not explicitly specified as “mapping behavior”):**

* Add a **separate mapping target** like `externalScheduleId` (or `revenueScheduleExternalId`) that the matching engine treats as a **Level 1 exact match** input.

* Keep “Opportunity field mapping” as **Option A metadata storage** unless/until you have a guaranteed stable identifier scheme coming back in vendor files.  
   This aligns to the spec’s “External Schedule ID matches exactly” rule without conflating it with “Opportunity fields.”

### **Why not Option C (upsert Opportunity)?**

Nothing in the reconciliation specs suggests vendor deposit uploads should create/update Opportunities. The architecture framing makes Opportunities part of the proactive system, and reconciliation handles exceptions via FLEX and management review flows—not Opportunity upserts. 

## **2\) When a user maps to a Product field — A vs B vs C**

### **Decision: Option A (persist raw value)**

**Persist raw value into DepositLineItem columns when available (e.g., SKU/description) or into `DepositLineItem.metadata.product.*`.**

### **Exact reasons grounded in the docs**

1. **Most recent guidance explicitly says vendor-provided product descriptors should sit in metadata and not update your canonical catalog structure.**  
   Rob’s reasoning is unambiguous: vendor/distributor product family/subtype “don’t mean \[anything\] other than just for matching,” and incoming values (like “services field”) “can just sit in metadata… \[it\] doesn’t have to \[mess\] up our cataloging.”

2. **Unknown products are handled via FLEX \+ management review, not automatic product creation.**  
   The workflow guide’s “Unknown Product Handling” says: if a deposit line has a new product and no schedule matches, the system **creates a FLEX product**, flags it for management queue, and **management later** researches and “create\[s\] new product in catalog” and converts FLEX.  
   That is directly incompatible with “upsert product records during import.”

3. **Product inputs on deposit line items are represented as raw identifiers (SKU/description) used for matching.**  
   The deposit line item schema includes `product_sku` and `product_description` as fields, and the matching logic uses `product_sku` as a weighted exact match input. That strongly implies “store raw product descriptors → match later,” not “resolve to a productId at import time” as the primary design.

### **Why not Option B as the default?**

Option B (“lookup to set `DepositLineItem.productId`”) could be a later optimization, but the documented approach emphasizes:

* fuzzy/exact matching using vendor-provided strings/SKUs, plus  
* learning/patterns, and  
* FLEX when unknown, with management resolution.

So **defaulting** to lookup-to-productId risks false positives and undermines the intended FLEX/management workflow.

✅ **Suggested “Later” enhancement (ASSUMED):**

* Add/maintain a vendor-SKU → internal-product mapping table (the workflow guide even sketches a `product_sku_patterns` concept), and use that to optionally populate `productId` as a convenience—*but keep the raw value too for auditability.*

### **Why not Option C (upsert Product)?**

The docs explicitly route new/unknown products through FLEX and then management-driven catalog updates, not automatic creation from deposit files.

## **3\) Which fields are required for a valid import? (Confirm “usage” \+ “commission” minimum)**

### **What the knowledge base explicitly says**

There is **no single authoritative, final list** of required fields for deposit import in the specs I found.

What *is* explicitly stated:

- The reconciliation workflow explicitly supports **commission-only deposits**, including a rule:  
  - “If no RS found, create Flex with **Usage \= Commission, Rate \= 100%**.”  
  - That implies the system must tolerate situations where usage isn’t meaningfully present (or can be derived).

### **Suggested decision (ASSUMED) to unblock implementation**

If you want a rule that aligns with the “commission-only deposits” requirement and avoids blocking real-world uploads:

**Recommended minimum for a valid deposit line import:**

* Required identifiers: `distributor` \+ `vendor` (or template selection that implies them)  
* Required customer reference: `account_name` **or** `customer_id` (at least one)  
* Required amounts: **at least one of** `actual_commission` or `actual_usage`  
  * If commission-only: set `actual_usage = actual_commission` and treat implied rate as 100% for FLEX handling (matches the documented fallback behavior).  
* Strongly recommended matching keys (not required, but boosts match rates): `order_id`, `product_sku`, and/or external schedule id where available.

