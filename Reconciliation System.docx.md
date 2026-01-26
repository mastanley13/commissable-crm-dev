This is excellent clarification\! Let me update the document with these important details:

---

**Revenue Schedule Matching & Reconciliation System**

**Overview**

**Purpose**

The Revenue Schedule Matching & Reconciliation System automates the complex process of aligning **actual revenue received** (from distributor/vendor deposit files) with **expected revenue forecasts** (from Opportunity Product schedules). This reconciliation is essential for commission tracking, financial reporting, and revenue assurance.

**The Core Problem**

Organizations that sell through channel partners (distributors and vendors) face a fundamental challenge: **the revenue they expect to receive rarely matches exactly what arrives in their bank accounts.**

This mismatch occurs for several reasons:

| Challenge | Description |
| :---- | :---- |
| **Data Fragmentation** | Deposit files from distributors contain their own product names, part numbers, and identifiers—which often differ from internal "House" naming conventions |
| **Timing Discrepancies** | Expected schedules are created at the time of sale; actual deposits arrive weeks or months later with potentially updated information |
| **Product Granularity Differences** | A single "bundled" product sold internally may be billed as multiple line items by the distributor |
| **Pricing & Commission Variability** | Actual billed amounts and commission rates may differ from original quotes due to promotions, adjustments, or contract changes |
| **Volume & Scale** | Organizations may process hundreds or thousands of deposit line items monthly, making manual matching impractical |
| **Chargebacks & Adjustments** | Distributors may withhold amounts with little or no detail, requiring placeholder allocation |

**What the System Does**

The system bridges the gap between **what was sold** and **what was paid** by:

1. **Ingesting deposit files** containing actual usage (billed amounts) and commission data from distributors/vendors

2. **Suggesting matches** between deposit line items and expected revenue schedules based on shared key fields (Order ID, Customer ID, Account ID, etc.)

3. **Allocating actuals** to the appropriate schedule fields once a match is confirmed

4. **Calculating variances** between expected and actual amounts

5. **Handling exceptions** when variances exceed tolerance or when data structures don't align (e.g., multiple deposit items → single schedule, or single deposit → multiple schedules)

6. **Managing chargebacks** via Flex Chargeback products when deductions arrive without detail

7. **Flagging disputes** automatically when amounts are out of tolerance, and flagging underpayments for collections

8. **Propagating metadata** from deposit line items to enrich Opportunity Products and the Product Catalog for improved future matching

9. **Learning over time** as enriched metadata improves matching accuracy with each reconciliation cycle

---

**The Matching Problem in Detail**

**Data Flow Overview**

┌─────────────────────┐         ┌─────────────────────┐

│   DEPOSIT FILE      │         │   OPPORTUNITY       │

│   (Actual Data)     │         │   (Expected Data)   │

├─────────────────────┤         ├─────────────────────┤

│ • Billed Amount     │         │ • Expected Usage    │

│ • Commission Amount │   ───►  │ • Expected Commission│

│ • Product Name      │ MATCH   │ • House Product Name │

│ • Part Number/SKU   │         │ • Revenue Schedules │

│ • Customer ID       │         │ • Customer ID       │

│ • Order ID          │         │ • Order ID          │

│ • Chargebacks       │         │                     │

└─────────────────────┘         └─────────────────────┘

**Key Matching Challenges**

**1\. Identity Resolution**

The same product may be identified differently across systems:

| Source | Example Product Identifier |
| :---- | :---- |
| House System | "Fiber 100M Business" |
| Distributor A | "BUS-FIBER-100-MBPS" |
| Distributor B | "100MBPS\_FIBER\_BUSINESS" |
| Vendor | "SKU-78432-FB100" |

The system must recognize these as the same product and map them correctly. **As matches are confirmed and metadata propagates, the system builds a richer cross-reference of identifiers, improving future match accuracy.**

**2\. Structural Misalignment (Both Directions)**

**Many-to-One Scenario:** A sales rep sells a "Business Communications Bundle" as a single Opportunity Product, but the distributor bills it as three separate line items:

* Voice Service: $150/month

* Data Service: $200/month

* Equipment Lease: $50/month

**One-to-Many Scenario:** The Opportunity has three separate products with individual schedules, but the distributor sends a single combined line item for $400/month.

The system must detect both scenarios and help the user restructure data to align deposit format with schedule format.

**3\. Variance Management**

Even when products match correctly, amounts often differ:

| Variance Type | Example | Cause | System Response |
| :---- | :---- | :---- | :---- |
| **Minor overage** | Expected $100, Actual $102 | Rounding, taxes | Auto-adjust if within threshold |
| **Significant overage** | Expected $100, Actual $175 | New add-on, pricing change | Create Flex Product, flag In Dispute |
| **Minor underpayment** | Expected $100, Actual $98 | Small adjustment | Auto-adjust if within threshold |
| **Significant underpayment** | Expected $100, Actual $60 | Billing error, partial service | Flag for Collections |
| **Chargeback** | No usage, negative commission | Clawback, penalty | Create Flex Chargeback, flag In Dispute |

**4\. Temporal Complexity**

Revenue schedules span multiple periods, and each period must be reconciled independently:

| Month | Expected | Actual | Status |
| :---- | :---- | :---- | :---- |
| Jan 2026 | $100 | $100 | ✅ Reconciled |
| Feb 2026 | $100 | $115 | ⚠️ In Dispute (overage) |
| Mar 2026 | $100 | $60 | 🔴 Collections (underpayment) |
| Apr 2026 | $100 | — | 🔓 Open |

When a variance is detected, the system must determine whether to adjust only that month or propagate changes to future open schedules.

---

**Processing Timeline**

**Batch Processing Workflow**

Deposit files are received and processed in batches over several days around the end of each month:

| Phase | Timing | Activities |
| :---- | :---- | :---- |
| **File Receipt** | Last 3-5 days of month | Distributor+Vendor deposit files arrive (PDF/CSV) |
| **Upload & Parsing** | As received | Files uploaded, fields mapped via templates, transactions extracted |
| **Matching & Reconciliation** | User-paced | Users work through suggested matches, confirm or adjust |
| **Exception Handling** | As needed | Flex Products/Chargebacks created for variances; structural resolutions |
| **Dispute & Collections Review** | Ongoing | Admin settles disputes; collections items tracked |
| **Close Period** | Before next cycle | All possible matches completed, exceptions flagged for follow-up |

---

**Matching Workflow Summary**

**Stage 1: Deposit Upload & Parsing**

* User uploads deposit file (PDF/CSV)

* System parses line items and extracts key fields based on Distributor+Vendor template

* Template updates saved for future use

**Stage 2: Match Suggestion**

* System sweeps deposit line items against open/unreconciled revenue schedules

* Matches suggested based on key field alignment (Order ID, Customer ID, Account ID, etc.)

* System detects many-to-one and one-to-many scenarios

**Stage 3: User Review & Confirmation**

* User reviews suggested matches at their own pace

* User can accept, reject, or manually override suggestions

* System presents structural mismatch options when detected

**Stage 4: Allocation & Calculation**

* Upon confirmation, actuals are allocated to schedule fields: 

  * Billed Amount → Actual Usage

  * Commission Amount → Actual Commission

* System calculates variance: (Actual \- Expected) / Expected

**Stage 5: Variance Handling**

* **Within threshold:** Auto-adjust schedule; prompt for future schedule updates

* **Overage outside threshold:** Create Flex Product; auto-set In Dispute

* **Underpayment outside threshold:** Flag for Collections

* **Chargeback (no usage, negative commission):** Create Flex Chargeback; auto-set In Dispute

**Stage 6: Metadata Propagation & Learning**

* Non-null deposit fields update "Other" fields on Opportunity Product

* Catalog instance updated with enriched metadata

* New identifier fields created and indexed for future sweeps

* **Each successful match improves future matching accuracy**

---

**Detection Logic: Many-to-One and One-to-Many**

**Many-to-One Detection**

**Scenario:** Multiple deposit line items should map to a single revenue schedule.

**Detection Method**

**Step 1: Group Deposit Line Items by Shared Keys**

Group by: Order ID \+ Customer ID \+ Account ID

IF multiple line items share the same group key:

    → Flag as potential bundle

**Step 2: Compare Group Total to Open Schedules**

FOR each group with 2+ items:

    Calculate: SUM(billed\_amounts), SUM(commission\_amounts)

    

    SEARCH for single open schedule WHERE:

        \- Same Order ID / Customer ID / Account ID

        \- Expected Usage ≈ Group Total (within variance threshold)

    

    IF match found:

        → FLAG as MANY-TO-ONE

        → Present expansion option to user

**Step 3: User Decision**

| Option | Result |
| :---- | :---- |
| **Expand to separate products** | Launch Product Creation Popup for each deposit item; original schedule(s) removed; new schedules created to match deposit structure |

---

**One-to-Many Detection**

**Scenario:** A single deposit line item should map to multiple revenue schedules.

This works as the **mirror image** of Many-to-One: when the system has multiple expected schedules but receives a single combined deposit line item.

**Detection Method**

**Step 1: Identify Single Deposit Matching Multiple Schedules**

FOR each deposit line item:

    SEARCH for matching open schedules by Order ID / Customer ID / Account ID

    

    IF multiple open schedules found for same keys:

        Calculate: SUM(schedules.expected\_usage)

        

        IF deposit.billed\_amount ≈ SUM(expected\_usage):

            → FLAG as ONE-TO-MANY

**Step 2: Present Consolidation Option**

IF ONE-TO-MANY detected:

    → Present user with option to consolidate schedules

    → Or restructure to match deposit format

**Step 3: User Decision**

| Option | Result |
| :---- | :---- |
| **Consolidate to single product** | Remove individual schedules; create single product/schedule matching deposit structure; original products set to "Closed Won \- Billing Ended" |
| **Allocate across existing schedules** | Split deposit amount proportionally across matching open schedules |

**Consolidation Workflow (One-to-Many Resolution)**

When user chooses to consolidate:

1. System removes open/unreconciled schedules from the original individual products

2. Original products set to "Closed Won \- Billing Ended"

3. System creates a new consolidated Opportunity Product matching the deposit structure

4. New product receives schedules matching the count of removed schedules

5. Current deposit allocates to first new schedule

6. Future deposits auto-match to consolidated product

---

**Detection Workflow Diagram**

┌─────────────────────────────────────────────────────────────────┐

│                   DEPOSIT FILE UPLOADED                          │

└─────────────────────────────────────────────────────────────────┘

                                │

                                ▼

┌─────────────────────────────────────────────────────────────────┐

│  Parse & Map Fields via Distributor+Vendor Template              │

└─────────────────────────────────────────────────────────────────┘

                                │

                                ▼

┌─────────────────────────────────────────────────────────────────┐

│  Group Line Items by Shared Keys (Order ID, Customer ID, etc.)  │

└─────────────────────────────────────────────────────────────────┘

                                │

                    ┌───────────┴───────────┐

                    ▼                       ▼

        ┌───────────────────┐   ┌───────────────────┐

        │  Single Item      │   │  Multiple Items   │

        │  in Group         │   │  in Group         │

        └───────────────────┘   └───────────────────┘

                    │                       │

                    ▼                       ▼

        ┌───────────────────┐   ┌───────────────────┐

        │  Check for        │   │  MANY-TO-ONE      │

        │  ONE-TO-MANY      │   │  Detection        │

        │  (single deposit  │   │  Compare group    │

        │  vs. multiple     │   │  total to single  │

        │  schedules)       │   │  schedule         │

        └───────────────────┘   └───────────────────┘

                    │                       │

                    └───────────┬───────────┘

                                ▼

┌─────────────────────────────────────────────────────────────────┐

│  Present Matches to User with Detection Flags                    │

│  • Standard 1:1 matches                                         │

│  • Many-to-One candidates (offer expand option)                 │

│  • One-to-Many candidates (offer consolidate option)            │

│  • Chargebacks (auto-create Flex Chargeback)                    │

└─────────────────────────────────────────────────────────────────┘

                                │

                                ▼

┌─────────────────────────────────────────────────────────────────┐

│  User Confirms / Adjusts / Resolves                              │

└─────────────────────────────────────────────────────────────────┘

                                │

                                ▼

┌─────────────────────────────────────────────────────────────────┐

│  Execute: Allocate Actuals, Create Flex/Chargeback if Needed,   │

│           Set Dispute/Collections Flags, Propagate Metadata      │

└─────────────────────────────────────────────────────────────────┘

---

**Learning & Continuous Improvement**

**How the System Gets Smarter Over Time**

Each successful match enriches the data, making future matches faster and more accurate:

| Match Event | Data Enrichment | Future Benefit |
| :---- | :---- | :---- |
| **First match for a product** | "Other" fields populated with Distributor's naming | Next deposit with same naming auto-suggests correctly |
| **New identifier discovered** | Field created (e.g., "Service ID") and indexed | Future deposits with this ID match instantly |
| **Catalog updated** | Master product gains cross-reference data | All future Opportunities inherit enriched data |
| **Many-to-One expanded** | New products created with deposit metadata | Future deposits match to individual products directly |
| **One-to-Many consolidated** | Consolidated product created with deposit metadata | Future deposits match to consolidated product directly |
| **Flex Product resolved** | Product properly identified and cataloged | Similar overages auto-match in future |

**Matching Accuracy Over Time**

Month 1:  \[█████░░░░░░░░░░░░░░░\] 25% Auto-Match

Month 3:  \[██████████░░░░░░░░░░\] 50% Auto-Match

Month 6:  \[███████████████░░░░░\] 75% Auto-Match

Month 12: \[████████████████████\] 90%+ Auto-Match

**Key drivers of improvement:**

* "Other" field enrichment from deposits

* New identifier field creation

* Catalog cross-reference building

* Historical match patterns

* Structural alignment (expansions and consolidations)

---

**Core Matching Behavior: What Happens When a Match Occurs**

When a deposit line item is matched to a revenue schedule, the system executes the following:

**Step 1: Financial Allocation**

| Deposit Line Item Field | Maps To Schedule Field |
| :---- | :---- |
| Billed Amount (Usage) | Actual Usage |
| Commission Amount | Actual Commission |

**Step 2: Variance Calculation**

* System compares actuals vs. expected amounts

* Determines if variance is within or outside the preset tolerance threshold

* Triggers appropriate scenario based on variance type and direction

**Step 3: Field Mapping & Data Propagation**

Non-null fields from the deposit line item update corresponding fields throughout the application, following these rules:

| Field Type | Behavior |
| :---- | :---- |
| **Product metadata** (e.g., Product Name, Description) | Maps to "Other" section fields on Opportunity Product Detail page (e.g., deposit "Product Name" → "Other \- Product Name") |
| **Catalog instance** | Appends "Other" fields to the matching product's catalog entry (mirrors Opportunity mapping); future Opportunities inherit this data |
| **Pricing & Commission rates** | **Never overwritten** — default values and house-specific rates are protected |
| **Proprietary/house-labeled fields** | **Never overwritten** — even if deposit contains data for the same underlying attribute |
| **Existing key identifiers** (Customer ID, Account ID) | **Matched but never overwritten** — these remain constant |
| **New identifier fields** (unmapped fields that serve as identifiers) | System creates the new field and copies the value; this additional identifier data is used when sweeping for suggested matches in future instances |
| **Unrecognized non-identifier fields** (e.g., "Service ID", "SKU") | System prompts user to: (a) map to a new custom field with that name, or (b) ignore (not mapped) |

---

**Multiple Deposit Items → Single Revenue Schedule**

**Problem**

A user selects **multiple deposit line items** to match against a **single expected revenue schedule**. Each deposit item has distinct metadata (part numbers, product names, pricing, commission rates), but they share key fields suggesting they belong to the same Opportunity.

The current workflow tries to merge all deposit data into one schedule, creating data conflicts.

**Walkthrough Example**

**Situation:** User uploads a deposit file containing 3 line items for Customer ABC, Order \#5001:

* Line Item 1: "Cloud Storage Basic" \- $50/month, 8% commission

* Line Item 2: "Cloud Storage Premium" \- $150/month, 10% commission

* Line Item 3: "Cloud Backup Add-on" \- $25/month, 8% commission

The Opportunity for Customer ABC, Order \#5001 has only **one** product: "Cloud Bundle" with a single expected revenue schedule of $225/month.

**Problem:** User selects all 3 deposit line items and attempts to match them to the single "Cloud Bundle" schedule. The system cannot merge three distinct products (each with different pricing and commission rates) into one schedule without data loss.

**Solution:** System detects the multiple-to-one mismatch and prompts the user to expand the single product into three separate Opportunity Products, each with its own revenue schedule series.

---

**Solution: Replace & Expand**

1. System detects multiple-to-one matching attempt

2. Prompt user: "Create separate Opportunity Products and Revenue Schedules for each deposit item and remove the original revenue schedule and future schedules for that product in this Opportunity?"

3. If confirmed, **for each deposit line item**, system launches a **Product Creation Popup**:

**Product Creation Popup Workflow**

**Step 3a: Catalog Lookup**

* System searches product catalog for a match based on deposit line item data

* If match found → suggest existing product; user can select and proceed to next item

* If no match → proceed to manual entry (Step 3b)

**Step 3b: New Product Entry (No Catalog Match)**

| Field | Behavior | Editable? |
| :---- | :---- | :---- |
| House \- Product Name | Auto-populated from deposit Product Name | ✅ Yes |
| House \- Part Number | Auto-populated from deposit Part Number | ✅ Yes |
| House \- Description | Auto-populated from deposit Product Description | ✅ Yes |
| Other \- Product Name | Auto-populated from deposit Product Name | 🚫 No |
| Other \- Part Number | Auto-populated from deposit Part Number | 🚫 No |
| Other \- Product Description | Auto-populated from deposit Product Description | 🚫 No |
| Distributor Name | Auto-populated from deposit data | ✅ Yes |
| Vendor Name | Auto-populated from deposit data | ✅ Yes |
| House \- Product Family | **User prompted to enter** | ✅ Yes |
| House \- Product Subtype | **User prompted to enter** | ✅ Yes |
| Payment Type | Defaults to "MRC \- 3rd Party"; dropdown available | ✅ Yes |

**Step 3c: Financial Defaults**

| Field | Default Behavior | Editable? |
| :---- | :---- | :---- |
| Quantity | From deposit line item if provided; otherwise defaults to "1" | ✅ Yes |
| Price Each | From deposit line item if provided; if only total usage provided, defaults to total usage amount | ✅ Yes |
| Expected Commission Rate % | From deposit line item commission rate | ✅ Yes |

**Fallback Logic (Price/Quantity):**

* If deposit provides Quantity and Price Each → use both values

* If deposit provides only total usage (no Price Each) → Quantity \= "1", Price Each \= total usage amount

**Step 3d: Calculated Display**

The popup displays the following calculated values (updates dynamically as user edits inputs):

| Field | Calculation |
| :---- | :---- |
| Expected Usage \- Gross | Quantity × Price Each |
| Expected Commission Amount | Expected Usage \- Gross × Expected Commission Rate % |

**Step 3e: "Other" Field Mapping (Template-Driven)**

Based on the Distributor/Vendor template configuration:

| Deposit Field | Maps To |
| :---- | :---- |
| Product Name | Other \- Product Name |
| SKU *or* Part Number (per template) | Other \- Part Number |
| Product Description | Other \- Product Description |

**Step 3f: Schedule Confirmation**

Before finalizing, user must confirm:

* The **number of open/unreconciled revenue schedules being removed** from the original Opportunity Product

* Equals the **number of new schedules to be created** for each new product

* The **start date** for each new product's schedule series is correct

4. Upon confirmation: 

   * Remove original unreconciled revenue schedules (current and future periods)

   * Create new Opportunity Products with entered/mapped data

   * Generate corresponding revenue schedules using confirmed pricing and commission rates

   * Map immediately for current deposit; future deposits auto-match to new schedules

**Handling Legacy Data (Prior Multi-Item Mappings)**

If previous reconciliations mapped more than one deposit line item to a single expected revenue schedule before this feature existed, the following occurs upon confirmation:

| Entity | Action |
| :---- | :---- |
| **Original Opportunity Product** | Status changed to "Closed Won \- Billing Ended" |
| **Original Open Schedules** | Removed starting from the current date forward |
| **New Opportunity Products** | Created for each deposit line item; status defaults to "Closed Won \- Billing" |
| **New Revenue Schedules** | Created for each new product per confirmed parameters |

---

**Single Deposit Item → Multiple Revenue Schedules**

**Problem**

A single deposit line item matches multiple expected revenue schedules. The schedules exist as separate products, but the distributor bills them as a single combined line item.

**Walkthrough Example**

**Situation:** The Opportunity for Customer XYZ, Order \#7002 has three separate products:

* Product 1: "Voice Service" \- $150/month expected

* Product 2: "Data Service" \- $200/month expected

* Product 3: "Equipment Lease" \- $50/month expected

The deposit file contains only **one** line item for $400/month labeled "Communications Bundle."

**Problem:** Three schedules await reconciliation, but only one deposit line item exists to match them.

**Solution:** System detects the one-to-many scenario and offers to consolidate the separate products into a single product matching the deposit format.

---

**Solution: Consolidate**

1. System detects one-to-many matching attempt

2. Prompt user: "Consolidate these 3 products into a single product matching the deposit format and remove the original schedules?"

3. If confirmed, system:

**Consolidation Workflow**

**Step 1: Display Affected Schedules**

Show user all open schedules that will be consolidated:

| Product | Expected Usage | Schedules Affected |
| :---- | :---- | :---- |
| Voice Service | $150 | 10 remaining |
| Data Service | $200 | 10 remaining |
| Equipment Lease | $50 | 10 remaining |
| **Total** | **$400** | **30 schedules → 10 consolidated** |

**Step 2: Create Consolidated Product**

| Field | Behavior | Editable? |
| :---- | :---- | :---- |
| House \- Product Name | User enters (e.g., "Communications Bundle") | ✅ Yes |
| House \- Part Number | From deposit if available | ✅ Yes |
| House \- Description | From deposit if available | ✅ Yes |
| Other \- Product Name | Auto-populated from deposit | 🚫 No |
| Other \- Part Number | Auto-populated from deposit | 🚫 No |
| Other \- Product Description | Auto-populated from deposit | 🚫 No |
| Distributor Name | From deposit data | ✅ Yes |
| Vendor Name | From deposit data | ✅ Yes |
| House \- Product Family | **User prompted to enter** | ✅ Yes |
| House \- Product Subtype | **User prompted to enter** | ✅ Yes |
| Payment Type | Defaults to "MRC \- 3rd Party" | ✅ Yes |
| Quantity | Defaults to "1" | ✅ Yes |
| Price Each | Sum of original expected amounts ($400) | ✅ Yes |
| Expected Commission Rate % | Calculated weighted average or user-entered | ✅ Yes |

**Step 3: Schedule Confirmation**

User must confirm:

* Number of consolidated schedules to create (matches the original schedule count)

* Start date for consolidated schedule series

**Step 4: Upon Confirmation**

| Entity | Action |
| :---- | :---- |
| **Original Opportunity Products** | Status changed to "Closed Won \- Billing Ended" |
| **Original Open Schedules** | Removed from current date forward |
| **New Consolidated Product** | Created with status "Closed Won \- Billing" |
| **New Revenue Schedules** | Created to match count of removed schedules |
| **Current Deposit** | Allocated to first new schedule |

---

**Flex Product Creation (Overages)**

**Problem**

Actual usage or commission amounts significantly exceed expected amounts, falling outside the admin-configured variance threshold (e.g., ±20%). The system cannot auto-reconcile, but funds need temporary allocation while investigation continues.

**Walkthrough Example**

**Situation:** User matches a deposit line item to an expected revenue schedule:

* **Expected Usage:** $100/month

* **Expected Commission:** $10/month (10% rate)

* **Actual Usage (from deposit):** $175/month

* **Actual Commission (from deposit):** $17.50/month

* **Admin Variance Threshold:** ±20%

**Calculation:**

* Variance \= ($175 \- $100) / $100 \= **75% overage**

* 75% exceeds the ±20% threshold

**Problem:** The $75 overage cannot be absorbed into the existing schedule without investigation. The system needs a temporary holding place for the excess funds.

**Solution:** System creates a "Flex Product" for this Opportunity with a child schedule (e.g., "1234.1") to hold the $75 excess usage and corresponding commission overage. The original schedule absorbs $100 (within expected range), and the Flex Schedule holds the $75 difference until the user investigates and identifies the correct product allocation.

---

**Current Workflow**

1. User matches deposit line item to expected revenue schedule

2. System calculates: Actual Usage vs. Expected Usage, Actual Commission vs. Expected Commission

**If within variance threshold:**

* Auto-adjust the existing schedule

* Prompt user to apply same adjustment to all open/unreconciled revenue schedules going forward for that product (previously reconciled schedules are not affected)

**If overage outside variance threshold:**

* Create a **Flex Product** for that Opportunity

* Generate a single **Flex Schedule** as a child of the parent schedule 

  * Naming convention: Parent \= "1234" → Child \= "1234.1"

* Flex Schedule inherits Opportunity and Deposit attributes

* Allocate excess amounts to Flex Schedule for reconciliation

* **Automatically set both the Flex Schedule and the parent schedule to "In Dispute" status**

**If underpayment outside variance threshold:**

* Auto-adjust the existing schedule with actual amounts received

* **Flag the schedule for Collections**

* Schedule appears on Collections report for follow-up

---

**Flex Chargeback Creation**

**Problem**

Distributor withholds amounts (chargebacks) with little or no detail—sometimes just a flat negative commission amount with only account information.

**Chargeback Handling Rules**

| Deposit Data Received | System Behavior |
| :---- | :---- |
| Negative commission, no usage amount | Create Flex Chargeback with Usage \= Commission Amount, Commission Rate \= 100.00% |
| Negative commission with usage amount | Create Flex Chargeback with provided values |
| Account info only, no product detail | Match to Account, create Flex Chargeback |

**Flex Chargeback Product**

* **"Flex Chargeback"** exists as a standard product in the Catalog under **each** Distributor+Vendor combination

* When a chargeback is detected, system auto-creates an Opportunity Product instance of "Flex Chargeback"

* A single Flex Chargeback schedule is created for that period

**Chargeback Workflow**

1. System detects chargeback (negative commission, minimal detail)

2. System creates Flex Chargeback Opportunity Product

3. System creates single Flex Chargeback schedule: 

   * If no usage provided: **Actual Usage \= Commission Amount, Commission Rate \= 100.00%**

   * If usage provided: Use provided values

4. **Automatically set Flex Chargeback schedule to "In Dispute" status**

5. Schedule appears on Flex/Dispute filtered report

**Walkthrough Example: Chargeback**

**Situation:** Deposit file contains:

* Customer ID: ABC123

* Commission: \-$50.00

* Usage: (blank)

* Product: (blank)

**System Response:**

1. Creates "Flex Chargeback" product for this Opportunity

2. Creates single schedule: 

   * Actual Usage: $50.00 (derived from commission amount)

   * Actual Commission: \-$50.00

   * Commission Rate: 100.00%

3. Sets schedule status to "In Dispute"

4. Schedule appears on Dispute report

**Note:** Chargebacks typically have no visibility into root cause and remain as-is. The Flex Chargeback serves as a reconciliation placeholder.

---

**Dispute & Collections Workflow**

**Automatic Status Assignment**

| Condition | Status | Report |
| :---- | :---- | :---- |
| Overage exceeds variance threshold | **In Dispute** | Dispute Report |
| Flex Product created | **In Dispute** (Flex \+ Parent) | Dispute Report |
| Flex Chargeback created | **In Dispute** | Dispute Report |
| Underpayment exceeds variance threshold | **Collections** | Collections Report |

**Dispute Resolution**

| Actor | Condition | Resolution |
| :---- | :---- | :---- |
| **System (Auto)** | Variance within threshold | Auto-adjust schedule, clear dispute |
| **Admin (Manual)** | Variance outside threshold | Admin reviews and settles dispute |

**Admin Dispute Settlement Options**

1. **Accept Actual Amount** \- Adjust expected to match actual; apply to future schedules

2. **Write Off Variance** \- Close dispute, leave expected unchanged, note variance as accepted loss

3. **Escalate** \- Flag for further investigation, remains In Dispute

**Collections Workflow**

Underpayments flagged for Collections appear on the Collections Report for follow-up actions:

* Contact Distributor/Vendor

* Request adjustment or explanation

* Escalate if unresolved

* Write off if uncollectible

---

**Post-Investigation Resolution: Flex Product Rename Popup**

When the correct product is identified after investigation, the user can rename the Flex Product to the actual product. This is done via a **Flex Product Rename Popup** to guide the user through the catalog filtering process.

**Triggering the Popup**

* User clicks to edit/rename a Flex Product (e.g., clicks on "1234.1" or an "Assign Product" button)

* System launches the Flex Product Rename Popup

**Flex Product Rename Popup Workflow**

**Step 1: Pre-Populated Filters (Read-Only)**

The following fields are pre-populated from the existing Opportunity and Deposit data and cannot be edited:

| Field | Source | Editable? |
| :---- | :---- | :---- |
| Distributor Name | From Opportunity/Deposit | 🚫 No |
| Vendor Name | From Opportunity/Deposit | 🚫 No |

**Step 2: User-Selected Filters**

User must select the following to narrow down the product list:

| Field | Behavior | Required? |
| :---- | :---- | :---- |
| House \- Product Family | Dropdown of available families for this Distributor/Vendor | ✅ Yes |
| House \- Product Subtype | Dropdown filtered by selected Product Family | ✅ Yes |

**Step 3: Product Selection**

Once Family and Subtype are selected:

| Field | Behavior |
| :---- | :---- |
| House \- Product Name | Dropdown populated with catalog products matching all filters (Distributor \+ Vendor \+ Family \+ Subtype) |

**Step 4: Confirmation & Schedule Generation (Optional)**

After user selects the product:

* System displays the selected product details for confirmation

* System prompts: "Create additional schedules for '\[Selected Product Name\]'?"

* User can choose one of the following options:

| Option | Use Case | Behavior |
| :---- | :---- | :---- |
| **Yes, create additional schedules** | Recurring products (monthly services, subscriptions) | User specifies number of schedules and start date |
| **No, this is a one-time item** | One-time services, bonuses, SPIFs, credits, adjustments | No additional schedules created; only the existing Flex Schedule is renamed |

**Step 5: Upon Confirmation**

| Action | Description |
| :---- | :---- |
| Rename Flex Product | Flex Product label updated to selected House \- Product Name |
| Preserve Financial Data | All Actual Usage, Actual Commission, and other financial data on the Flex Schedule is retained |
| Generate Future Schedules (if selected) | System creates the specified number of new revenue schedules for this product starting on the confirmed date |
| Clear Dispute Status | If resolved, clear "In Dispute" from both Flex and parent schedules |
| Update Catalog (if needed) | If this product instance doesn't exist in the catalog for this Distributor/Vendor combo, prompt user to add it |

**Walkthrough Example: Flex Resolution (Recurring Product)**

**Situation:** After investigation, user determines the $75 overage was due to a new "Premium Support" add-on that wasn't in the original Opportunity.

**Resolution Steps:**

1. User clicks on Flex Product "1234.1" to rename it

2. **Flex Product Rename Popup** appears: 

   * **Pre-populated (read-only):** Distributor \= "Telarus", Vendor \= "ACC Business"

   * **User selects:** House \- Product Family \= "Support Services"

   * **User selects:** House \- Product Subtype \= "Premium Add-ons"

   * **User selects:** House \- Product Name \= "Premium Support" (from filtered dropdown)

3. System prompts: "Create additional schedules for 'Premium Support'?"

4. User selects: "Yes, create additional schedules" 

   * User enters: 11 schedules starting 2026-02-01

5. User confirms

6. System: 

   * Renames Flex Product "1234.1" to "Premium Support"

   * Preserves the $75 usage and $7.50 commission data

   * Creates 11 new revenue schedules for "Premium Support" (Feb 2026 \- Dec 2026\)

   * Clears "In Dispute" status from both schedules

7. Future deposits with this add-on will auto-match to the new product schedules

**Walkthrough Example: Flex Resolution (One-Time Item)**

**Situation:** After investigation, user determines the $200 overage was a one-time installation bonus from the vendor.

**Resolution Steps:**

1. User clicks on Flex Product "5678.1" to rename it

2. **Flex Product Rename Popup** appears: 

   * **Pre-populated (read-only):** Distributor \= "Telarus", Vendor \= "ACC Business"

   * **User selects:** House \- Product Family \= "Bonuses & SPIFs"

   * **User selects:** House \- Product Subtype \= "Installation Bonuses"

   * **User selects:** House \- Product Name \= "Installation Bonus \- Fiber" (from filtered dropdown)

3. System prompts: "Create additional schedules for 'Installation Bonus \- Fiber'?"

4. User selects: "No, this is a one-time item"

5. User confirms

6. System: 

   * Renames Flex Product "5678.1" to "Installation Bonus \- Fiber"

   * Preserves the $200 usage and commission data

   * Clears "In Dispute" status

   * No additional schedules are created

---

**Summary of Required AI/Automation Behaviors**

| Trigger | Action |
| :---- | :---- |
| Deposit file uploaded | Parse via Distributor+Vendor template; group line items by shared keys |
| Group contains 2+ items with matching single schedule | Flag as MANY-TO-ONE; present expansion option |
| Single item matches multiple open schedules | Flag as ONE-TO-MANY; present consolidation option |
| Match confirmed | Allocate Billed Amount → Actual Usage, Commission Amount → Actual Commission; propagate metadata per field rules |
| New identifier field in deposit | Create field, copy value, use for future match suggestions |
| Unrecognized non-identifier field in deposit | Prompt user to map to new field or ignore (not mapped) |
| Multiple deposits → single schedule (confirmed) | Remove original schedules, create new products/schedules per deposit items, set original product to "Closed Won \- Billing Ended" |
| Single deposit → multiple schedules (confirmed) | Remove original schedules, create consolidated product/schedules, set original products to "Closed Won \- Billing Ended" |
| Product Creation: catalog match found | Suggest existing product for selection |
| Product Creation: no catalog match | Auto-fill House & Other fields from deposit; prompt for Family/Subtype; apply Quantity/Price fallback logic; display Expected Usage \- Gross and Expected Commission Amount calculations |
| Product Creation: finalize | Require user confirmation of schedule count and start dates |
| Variance within threshold | Auto-adjust schedule, prompt to apply adjustment to all open/unreconciled schedules going forward (previously reconciled schedules unchanged) |
| Overage exceeds threshold | Auto-create Flex Product \+ child schedule; set both to "In Dispute" |
| Underpayment exceeds threshold | Flag schedule for Collections |
| Chargeback detected (negative commission, no/minimal detail) | Auto-create Flex Chargeback product/schedule; if no usage, set Usage \= Commission Amount at 100% rate; set to "In Dispute" |
| Flex Product rename initiated | Launch Flex Product Rename Popup with pre-populated Distributor/Vendor; require user to select Family, Subtype, then Product Name from filtered dropdown |
| Flex Product rename confirmed | Rename product, preserve financial data, optionally generate specified future schedules (or none for one-time items), clear Dispute status if resolved |
| Dispute within threshold | Admin or system auto-settles by adjusting schedule |
| Dispute outside threshold | Admin manually reviews and settles |
| Match completed successfully | Update Catalog with enriched metadata; improve future matching accuracy |

---

**Field Protection & Default Summary**

**During Normal Matching:**

* ✅ **Updates:** Actual Usage, Actual Commission, product metadata to "Other" fields

* ✅ **Appends:** "Other" fields to catalog instance (mirrors Opportunity mapping)

* ✅ **Creates:** New identifier fields from unmapped deposit data (used for future match sweeps)

* 🚫 **Protected:** Pricing, commission rates, house fields, existing key identifiers (Customer ID, Account ID)

* ❓ **Prompts user:** Unrecognized non-identifier fields → map or ignore (not mapped)

**During New Product Creation (Replace & Expand / Consolidate):**

* ✅ **Pre-populated & Editable:** House \- Product Name, House \- Part Number, House \- Description, Distributor Name, Vendor Name, Quantity, Price Each, Expected Commission Rate %

* ✅ **Pre-populated & Locked:** Other \- Product Name, Other \- Part Number, Other \- Product Description

* ✅ **Calculated Display:** Expected Usage \- Gross (Quantity × Price Each), Expected Commission Amount (Expected Usage \- Gross × Expected Commission Rate %)

* ❓ **User must enter:** House \- Product Family, House \- Product Subtype

**During Flex Product Rename:**

* 🚫 **Pre-populated & Locked:** Distributor Name, Vendor Name

* ❓ **User must select:** House \- Product Family, House \- Product Subtype, House \- Product Name (filtered dropdown)

* ✅ **Preserved:** All financial data from Flex Schedule

* ❓ **User chooses:** Whether to create additional schedules (optional for one-time items)

* ✅ **User confirms (if creating schedules):** Number of future schedules, start date

**During Flex Chargeback Creation:**

* ✅ **Auto-created:** Flex Chargeback product from Catalog

* ✅ **Auto-calculated (if no usage provided):** Actual Usage \= Commission Amount, Commission Rate \= 100.00%

* ✅ **Auto-set:** Billing Status \= "In Dispute"

**Status Defaults:**

* 🔒 **Original Product (after expansion/consolidation):** "Closed Won \- Billing Ended"

* ✅ **New Products:** "Closed Won \- Billing"

* ⚠️ **Flex Product \+ Parent (overage):** "In Dispute"

* ⚠️ **Flex Chargeback:** "In Dispute"

* 🔴 **Underpayment:** Flagged for "Collections"

---

**Additional Notes**

**1\. Opportunity Detail \- Products Tab: New Columns Required**

Add the following columns to the Products Tab on the Opportunity Detail page, positioned to the right of "End Date":

| Column | Description |
| :---- | :---- |
| **\# of Periods** | Total count of revenue schedules for that product |
| **\# Remaining** | Count of schedules that are "Open" or "Unreconciled" |

**Date Field Definitions:**

* **Start Date** \= Date of the product's first revenue schedule

* **End Date** \= Date of the product's last revenue schedule

---

**2\. Revenue Schedule Detail: Missing Field**

**Issue:** "Billing Status" field is missing from the Revenue Schedule Detail page layout.

**Field Specification:**

| Field | Location | Values |
| :---- | :---- | :---- |
| **Billing Status** | 2nd column, bottom of top section | Open, Reconciled, In Dispute |

---

**3\. Key Concepts Clarification**

**Catalog Product vs. Opportunity Product**

| Concept | Description |
| :---- | :---- |
| **Catalog Product** | The "master copy" or template of a product supplied by a specific Distributor+Vendor combination. Think of it as the manufacturing mold—it remains unchanged unless specific metadata (Other \- Product Name, Description, etc.) is matched from a deposit and updates the master. |
| **Opportunity Product** | An instance created from the Catalog Product for a specific Opportunity. Can have customized pricing, rates, and terms unique to that deal. The "item created by the mold." |

**Distributor+Vendor Relationships**

* The same product can be sold through different Distributor+Vendor combinations

* For direct vendor contracts (no distributor), use **"None-Direct"** as the Distributor name

* Each Distributor+Vendor combination may have its own template for mapping deposit fields

* **"Flex Chargeback"** exists in the Catalog under each Distributor+Vendor combination

**Revenue Schedule Creation**

* When a product is added to an Opportunity, the user specifies: 

  * Number of schedules to create (one per month)

  * Start date

* All schedules are dated the **1st of the month**

**Flex Product**

* A distinct Opportunity Product (not just a flag)

* Created with a **single revenue schedule** for the current pay period

* Purpose: Temporary placeholder to capture overages and allow reconciliation to proceed while investigation continues

* Named as a child of the parent schedule (e.g., "1234.1")

* **Automatically sets both Flex Schedule and parent schedule to "In Dispute"**

**Flex Chargeback**

* A distinct Opportunity Product for handling chargebacks with minimal detail

* **"Flex Chargeback"** exists as a Catalog product under each Distributor+Vendor

* Created with a **single revenue schedule** for the chargeback period

* If no usage amount provided: Usage \= Commission Amount, Commission Rate \= 100.00%

* **Automatically set to "In Dispute"**

* Chargebacks typically have no visibility into root cause and remain as placeholders

**Deposit File Processing**

* Source: PDF/CSV files provided monthly by Distributor+Vendors

* Upload process: Files uploaded → fields mapped via template → template updates saved for future use

* User workflow: After upload, users work at their own pace to match deposit line items to awaiting revenue schedules

---

**4\. Required Reports**

| Report | Purpose | Key Filters |
| :---- | :---- | :---- |
| **Dispute Report** | All schedules with "In Dispute" status | Distributor, Vendor, Date Range, Age |
| **Collections Report** | All schedules flagged for Collections (underpayment) | Distributor, Vendor, Date Range, Amount |
| **Flex Product Aging** | All unresolved Flex Products | Distributor, Vendor, Age, Amount |
| **Reconciliation Summary** | Period status overview | Period, Distributor, Vendor |
| **Unmatched Deposits** | Deposit line items without matches | Distributor, Vendor, Date Range |

---

Is there anything else you'd like me to clarify or expand upon?

