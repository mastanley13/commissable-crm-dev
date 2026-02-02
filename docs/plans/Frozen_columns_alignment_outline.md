**Priority Alignment Architecture \- Schedule-Driven Column Order**  
You're right to prioritize the Revenue Schedule flow. Here's the recommended column reordering that **locks the key alignment points** while moving deposit columns to match that natural flow:  
---

**ALIGNMENT PAIRS (These MUST be side-by-side vertically)**  
Line Item          	←→  Line Item  
Other \- Product Name   ←→  Other \- Product Name   
Account Name       	←→  Legal Name  
\[Quantity\]         	←→  Quantity  
\[Price Each\]       	←→  Price Each  
Actual Usage       	←→  Actual Usage  
Actual Commission  	←→  Actual Commission  
---

**RECOMMENDED COLUMN ORDER**  
**DEPOSIT LINE ITEMS TABLE \- Reordered**  
**FROZEN ZONE (Left):**

1. Select  
2. **Line Item** ✓ ALIGNMENT POINT  
3. **Other \- Product Name** ✓ ALIGNMENT POINT  
4. **Account Name** ✓ ALIGNMENT POINT  
5. Payment Date (supporting context, keep here)

**SYNCHRONIZED SCROLLABLE ZONE (Right \- with Revenue Schedule below):** 6\. **Quantity** ✓ ALIGNMENT POINT (move from right, if in deposit file) 7\. **Price Each** ✓ ALIGNMENT POINT (move from right, if in deposit file) 8\. Deposit Status 9\. **Actual Usage** ✓ ALIGNMENT POINT 10\. Usage Allocated 11\. Usage Unallocated 12\. Actual Commission Rate % 13\. **Actual Commission** ✓ ALIGNMENT POINT 14\. Commission Allocated 15\. Commission Unallocated  
**FILE COLUMNS ZONE (Pushed right):** 16\. Other \- Account ID 17\. Other \- Source 18\. Other \- Part Number 19\. Other \- Customer ID 20\. Other \- Order ID 21\. Vendor Name (not critical for alignment, push right) 22\. Distributor Name (not critical for alignment, push right) 23\. **\[Any additional file columns \- up to 40+\]**  
---

**REVENUE SCHEDULES TABLE \- Optimized Order**  
This is the "master flow" \- minimize changes here, deposit table adapts to it.  
**FROZEN ZONE (Left):**

1. Select  
2. AI Confidence (keep \- shows match quality)  
3. Status (keep \- shows match status)  
4. **Line Item** ✓ ALIGNMENT POINT  
5. Revenue Schedule Date  
6. **Legal Name** ✓ ALIGNMENT POINT

**SYNCHRONIZED SCROLLABLE ZONE (Right \- matches deposit above):** 7\. **Other \- Product Name** ✓ ALIGNMENT POINT 8\. **Quantity** ✓ ALIGNMENT POINT 9\. **Price Each** ✓ ALIGNMENT POINT 10\. Revenue Schedule Name (context for the schedule) 11\. Payment Date (supporting context) 12\. Expected Usage Gross (provides context) 13\. Expected Usage Adjustment 14\. Expected Usage Net 15\. **Actual Usage** ✓ ALIGNMENT POINT 16\. Usage Balance 17\. Expected Commission Gross (provides context) 18\. **Actual Commission** ✓ ALIGNMENT POINT 19\. Expected Commission Adjustment 20\. Expected Commission Net 21\. Commission Difference 22\. Expected Commission Rate % 23\. Actual Commission Rate % 24\. Commission Rate Difference 25\. Why suggested (match confidence explanation)  
**FILE COLUMNS ZONE (Pushed right):** 26\. Vendor Name (not in alignment pairs, push right)  
---

**Visual Layout with Single Scroll Bar**  
═══════════════════════════════════════════════════════════════════════════════  
DEPOSIT LINE ITEMS TABLE  
═══════════════════════════════════════════════════════════════════════════════  
┌─────────────┬──────────────────────────────────────────┬──────────────────────────────────────┐  
│   FROZEN	│    	KEY ALIGNMENT ZONE            	│  	RECONCILIATION \+ FILE COLS  	│  
│         	│	(Primary Matching Fields)         	│                                  	│  
├─────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤  
│ Select  	│ Line Item │ Product │ Account │ Payment  │ Qty │ Price │ Status │ Actual │ Actual  │ \[Other\]  
│         	│       	│ Name	│ Name	│ Date 	│ 	│ Each  │    	│ Usage  │ Commission │  
├─────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤  
│  ![☑][image1]      	│ 	1 	│  ADI	│ DW Realty│ 2025-09 │ 	│   	│Unmatch │  591   │  94.56  │ \[Acct ID...\]  
│  ![☑][image2]      	│ 	2 	│  ADI	│ Edge Bus │ 2025-09 │ 	│   	│Unmatch │  2.4   │  0.38   │ \[Acct ID...\]  
└─────────────┴──────────────────────────────────────────┴──────────────────────────────────────┘  
                                ▼ SCROLL HERE ▼ (Single scroll bar controls next section)  
   
═══════════════════════════════════════════════════════════════════════════════  
REVENUE SCHEDULES TABLE (Suggested Matches)  
═══════════════════════════════════════════════════════════════════════════════  
┌──────────────────────┬──────────────────────────────────────────┬──────────────────────────────────────┐  
│	FROZEN        	│  	KEY ALIGNMENT ZONE              	│	RECONCILIATION \+ FILE COLS   	│  
│ (Match Quality Info) │   (Same Matching Fields as Deposit)  	│                      	            │  
├──────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤  
│ AI % │ Status │ Date │ Line Item │ Product │ Legal Name │ Payment│ Qty │ Price │ Revenue │ Actual │ Actual   │ \[Other\]  
│  	│    	│  	│       	│ Name	│        	│ Date   │ 	│ Each  │ Sched   │ Usage  │ Commission │  
├──────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤  
│ 85%  │ ✓ Match│ 2025 │ 	1 	│  ADI	│ DW Realty  │ 2025-09│ 	│   	│ Sched-1 │  591   │  94.56   │ \[Vendor...\]  
│ 92%  │ ✓ Match│ 2025 │ 	2 	│  ADI	│ Edge Bus   │ 2025-09│ 	│   	│ Sched-2 │  2.4   │  0.38	│ \[Vendor...\]  
└──────────────────────┴──────────────────────────────────────────┴──────────────────────────────────────┘  
                                ▲ SYNCED SCROLL ▲ (Same scroll bar as deposit table above)  
---

**Implementation Notes for Designer**  
**What Stays Frozen (Left Side):**

* **Deposit Table**: Select, Line Item, Product Name, Account Name, Payment Date  
* **Revenue Table**: Select, AI Confidence, Status, Line Item, Revenue Schedule Date, Legal Name

**What Scrolls Together (Right Side):**  
All these columns must use the **same single scroll bar** between both tables:

* Quantity, Price Each, Actual Usage, Actual Commission, and all supporting/reconciliation columns  
* This keeps the alignment pairs locked vertically

**What Gets Pushed to Far Right (File Columns Zone):**

* Other \- Account ID  
* Other \- Source  
* Other \- Part Number  
* Other \- Customer ID  
* Other \- Order ID  
* Vendor Name (not in alignment pairs)  
* Distributor Name (not in alignment pairs)  
* Any dynamic file columns (10-40)

**Why This Works:**

1. **Deposit table columns are reordered** to match the natural flow of Revenue Schedule table  
2. **All 7 alignment pairs** (Line Item, Product Name, Account Name/Legal Name, Quantity, Price Each, Actual Usage, Actual Commission) are perfectly vertical  
3. **Single scroll bar** controls the right section of both tables simultaneously  
4. **Supporting/reconciliation data** stays close enough for context but doesn't interfere with alignment  
5. **Dynamic file columns** (the unknown 10-40) go to the far right where they don't matter

This prioritizes the Revenue Schedule flow while giving the Deposit table enough flexibility to align with those key fields.  
please prepare everything we'll need to give to the developer, summary, any code or layout data into a word doc  
18 steps  
I've prepared a comprehensive developer specification document below. You can copy this entire text and paste it directly into a Word document. Here's everything you need to give to your developer:  
---

**DEPOSIT RECONCILIATION TABLE ALIGNMENT SPECIFICATION**  
**Developer Implementation Guide**  
---

**EXECUTIVE SUMMARY**  
The Deposit Reconciliation module requires synchronized column alignment between two horizontally-scrollable data tables:

* **Deposit Line Items Table** (top)  
* **Suggested Matches \- Revenue Schedules Table** (bottom)

**Primary Objective:** Enable users to visually compare matching deposit data with revenue schedule data using a single synchronized scroll bar.  
**Critical Principle:** Prioritize the Revenue Schedule table's natural column flow. The Deposit Line Items table columns must be reordered to align with the Revenue Schedule structure, not the other way around.  
---

**ALIGNMENT PAIRS (CRITICAL \- MUST ALIGN VERTICALLY)**  
These seven field pairs **MUST** be positioned directly above/below each other when both tables are at the same scroll position:

1. **Line Item** ←→ **Line Item**  
2. **Other \- Product Name** ←→ **Other \- Product Name**  
3. **Account Name** ←→ **Legal Name**  
4. **Quantity** ←→ **Quantity**  
5. **Price Each** ←→ **Price Each**  
6. **Actual Usage** ←→ **Actual Usage**  
7. **Actual Commission** ←→ **Actual Commission**

---

**COLUMN ORDERING SPECIFICATIONS**  
**TABLE 1: DEPOSIT LINE ITEMS TABLE**

| Pos | Column Name | Zone | Frozen? | Notes |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Select | Identity | YES | Checkbox for row selection |
| 2 | Line Item | Identity | YES | Line item number (1, 2, 3...) |
| 3 | Other \- Product Name | Identity | YES | Product type (ADI, VoIP, HSIA) |
| 4 | Account Name | Identity | YES | Customer/Account name |
| 5 | Payment Date | Identity | YES | Date of payment record |
| 6 | Quantity | Alignment | NO | From deposit file (if available) |
| 7 | Price Each | Alignment | NO | From deposit file (if available) |
| 8 | Deposit Status | Reconciliation | NO | Unmatched, Matched, etc. |
| 9 | Actual Usage | Alignment | NO | **KEY METRIC \#1** |
| 10 | Usage Allocated | Reconciliation | NO | Amount allocated to schedules |
| 11 | Usage Unallocated | Reconciliation | NO | Remaining unallocated usage |
| 12 | Actual Commission Rate % | Reconciliation | NO | Commission rate percentage |
| 13 | Actual Commission | Alignment | NO | **KEY METRIC \#2** |
| 14 | Commission Allocated | Reconciliation | NO | Commission allocation status |
| 15 | Commission Unallocated | Reconciliation | NO | Remaining unallocated commission |
| 16+ | **FILE COLUMNS ZONE** | File Data | NO | Push all "Other" fields here:• Other \- Account ID• Other \- Source• Other \- Part Number• Other \- Customer ID• Other \- Order ID• Vendor Name• Distributor Name• \[Any additional dynamic columns from deposit file\] |

**TABLE 2: SUGGESTED MATCHES \- REVENUE SCHEDULES TABLE**

| Pos | Column Name | Zone | Frozen? | Notes |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Select | Identity | YES | Checkbox for row selection |
| 2 | AI Confidence | Identity | YES | Match confidence percentage |
| 3 | Status | Identity | YES | Match status indicator |
| 4 | Line Item | Identity | YES | Line item number |
| 5 | Revenue Schedule Date | Identity | YES | Date of schedule |
| 6 | Legal Name | Identity | YES | Company legal name |
| 7 | Other \- Product Name | Alignment | NO | Product type |
| 8 | Quantity | Alignment | NO | Quantity on schedule |
| 9 | Price Each | Alignment | NO | Unit price |
| 10 | Revenue Schedule Name | Reconciliation | NO | Name of the schedule |
| 11 | Payment Date | Reconciliation | NO | Payment date |
| 12 | Expected Usage Gross | Reconciliation | NO | Expected usage before adjustments |
| 13 | Expected Usage Adjustment | Reconciliation | NO | Usage adjustment amount |
| 14 | Expected Usage Net | Reconciliation | NO | Expected usage after adjustments |
| 15 | Actual Usage | Alignment | NO | **KEY METRIC \#1** (syncs with deposit) |
| 16 | Usage Balance | Reconciliation | NO | Remaining balance |
| 17 | Expected Commission Gross | Reconciliation | NO | Expected commission before adjustments |
| 18 | Actual Commission | Alignment | NO | **KEY METRIC \#2** (syncs with deposit) |
| 19 | Expected Commission Adjustment | Reconciliation | NO | Commission adjustment |
| 20 | Expected Commission Net | Reconciliation | NO | Expected commission after adjustments |
| 21 | Commission Difference | Reconciliation | NO | Difference between actual and expected |
| 22 | Expected Commission Rate % | Reconciliation | NO | Expected commission rate |
| 23 | Actual Commission Rate % | Reconciliation | NO | Actual commission rate |
| 24 | Commission Rate Difference | Reconciliation | NO | Rate difference |
| 25 | Why Suggested | Reconciliation | NO | Explanation of match confidence |
| 26+ | **FILE COLUMNS ZONE** | File Data | NO | Non-essential fields:• Vendor Name (not in alignment pairs) |

---

**FROZEN COLUMNS SPECIFICATION**  
**Deposit Line Items Table \- Freeze After Column 5 (Payment Date)**

* Columns 1-5 remain visible when scrolling right  
* Freeze line appears after "Payment Date" column  
* Frozen width: approximately 500px

**Revenue Schedules Table \- Freeze After Column 6 (Legal Name)**

* Columns 1-6 remain visible when scrolling right  
* Freeze line appears after "Legal Name" column  
* Frozen width: approximately 550px

---

**SYNCHRONIZED SCROLL BAR BEHAVIOR**  
**Implementation Requirements:**

1. **Single Scroll Bar Control:**  
   * ONE horizontal scroll bar controls BOTH tables  
   * Located below the Deposit Line Items table  
   * Also controls scroll position of Revenue Schedules table below  
   * When user scrolls the deposit table right, revenue schedule table scrolls right simultaneously  
2. **Scroll Sync Architecture:**  
   * Deposit Line Items table scrolls columns 6 onwards  
   * Revenue Schedules table scrolls columns 7 onwards  
   * Both tables must maintain identical scroll position  
   * Frozen columns in each table stay fixed while scrollable zones move together  
3. **Scroll Handler Logic:**

   When depositTable.horizontalScroll \= X pixels:  
 	→ revenueScheduleTable.horizontalScroll \= X pixels  
    
   When revenueScheduleTable.horizontalScroll \= Y pixels:  
 	→ depositTable.horizontalScroll \= Y pixels

4. **Offset Consideration:**  
   * Deposit frozen zone: \~500px (columns 1-5)  
   * Revenue frozen zone: \~550px (columns 1-6)  
   * Offset difference: \~50px  
   * Scrollable zone starts at these offsets for each table  
   * Sync applies to the scrollable areas only

---

**LAYOUT VISUALIZATION**  
DEPOSIT LINE ITEMS TABLE (Top Section)  
════════════════════════════════════════════════════════════════════════════════  
   
┌──────────────────────────────┬────────────────────────────────┬─────────────────────────┐  
│   FROZEN ZONE            	│   ALIGNMENT ZONE           	│  RECONCILIATION ZONE	│  
│ (Always Visible)         	│ (Key Matching Fields)      	│ (Supporting Data)   	│  
│                          	│                                │                     	│  
│ ┌─┬─────┬──────┬────┬─────┐ │ ┌───┬─────┬────┬──────┬────┐ │ ┌───┬────┬───────┐    │  
│ │S│Line │Prod  │Acct│Pay  │ │ │Qty│Price│Stat│Usage │Rate│ │ │All│Unal│Actual │	│  
│ │e│Item │Name  │Name│Date │ │ │   │Each │us  │  	│%   │ │ │oc │loc │Comm   │	│  
│ ├─┼─────┼──────┼────┼─────┤ │ ├───┼─────┼────┼──────┼────┤ │ ├───┼────┼───────┤    │  
│ │![☑][image3]│ 1   │ ADI  │DW  │2025 │ │ │   │ 	│Unmtd│591   │16% │ │ │$0  │$591│$94.56│	│  
│ │![☑][image4]│ 2   │ ADI  │Edge│2025 │ │ │   │ 	│Unmtd│2.4   │15% │ │ │$0  │$2.4│$0.38 │	│  
│ └─┴─────┴──────┴────┴─────┘ │ └───┴─────┴────┴──────┴────┘ │ └───┴────┴───────┘    │  
└──────────────────────────────┴────────────────────────────────┴─────────────────────────┘  
     ◄──── FROZEN ────►  ◄─────────────── SCROLLS WITH SINGLE SCROLL BAR ──────────────►  
   
   
REVENUE SCHEDULES TABLE (Bottom Section)  
════════════════════════════════════════════════════════════════════════════════  
   
┌───────────────────────────────┬─────────────────────────────────┬────────────────────────┐  
│   FROZEN ZONE             	│   ALIGNMENT ZONE            	│ RECONCILIATION ZONE	│  
│ (Always Visible)          	│ (Same Fields as Deposit Above)  │                    	│  
│                               │                             	│                    	│  
│ ┌─┬──┬───┬───┬──┬────┐       │ ┌─────┬───┬─────┬──────┬────┐  │ ┌────┬────┬─────────┐ │  
│ │S│AI│Sts│LI │RD│Legal│  	│ │Prod │Qty│Price│Sched │Date│  │ Rev│Bal │Actual   │ │  
│ │e│% │   │   │  │Name │  	│ │Name │   │Each │Name  │   │  │ Sch│anc │Comm 	│ │  
│ ├─┼──┼───┼───┼──┼────┤       │ ├─────┼───┼─────┼──────┼────┤  │ ├────┼────┼─────────┤ │  
│ │![☑][image5]│85│✓ │ 1 │2025│DW  │  	│ │ADI  │   │ 	│Sch-1 │2025│  │ 591 │ 591│ $94.56  │ │  
│ │![☑][image6]│92│✓ │ 2 │2025│Edge│  	│ │ADI  │   │ 	│Sch-2 │2025│  │ 2.4 │2.4 │ $0.38   │ │  
│ └─┴──┴───┴───┴──┴────┘       │ └─────┴───┴─────┴──────┴────┘  │ └────┴────┴─────────┘ │  
└───────────────────────────────┴─────────────────────────────────┴────────────────────────┘  
     ◄────── FROZEN ────────►  ◄─────────── SYNCED WITH SCROLL BAR ABOVE ────────────►  
---

**DEVELOPER IMPLEMENTATION CHECKLIST**  
**Column Reordering:**

* Update Deposit Line Items column order to match specification (Table 1\)  
* Update Revenue Schedules column order to match specification (Table 2\)  
* Verify alignment pairs are positioned in corresponding positions  
* Set column widths to maintain visual alignment

**Frozen Columns:**

* Implement frozen columns for Deposit table after column 5  
* Implement frozen columns for Revenue Schedules table after column 6  
* Test that frozen columns remain visible during horizontal scroll  
* Verify no visual overlap between frozen and scrollable zones

**Synchronized Scroll:**

* Create scroll event listener for Deposit table  
* Create scroll event listener for Revenue Schedules table  
* Implement bidirectional sync (either table scroll triggers the other)  
* Account for 50px offset between frozen zone sizes  
* Test scroll synchronization at various scroll positions  
* Ensure smooth scroll without lag or jank  
* Test on touch devices for swipe/drag scrolling

**Dynamic File Columns:**

* Configure system to accept 10-40 variable columns from deposit files  
* All variable columns placed in File Columns Zone (position 16+ in deposit table)  
* Verify file columns don't break frozen zone or alignment  
* Test with sample deposit files of varying column counts

**Column Settings Button:**

* Verify "Column Settings" button can hide/show columns from File Columns Zone  
* Alignment columns should NOT be hideable (they're required)  
* File columns should be optional/hideable  
* Maintain state when toggling column visibility

**Testing Scenarios:**

1. **Alignment Verification:**  
   * Load sample deposit data  
   * Open Revenue Schedule suggestions  
   * Verify all 7 alignment pairs are vertically aligned  
   * Scroll right and verify alignment pairs remain aligned at all positions  
2. **Scroll Bar Behavior:**  
   * Drag deposit table scroll bar to various positions  
   * Verify revenue table scrolls to same position  
   * Drag revenue table scroll bar  
   * Verify deposit table follows in real-time  
3. **Frozen Column Behavior:**  
   * Scroll deposit table to rightmost column  
   * Verify columns 1-5 remain visible  
   * Scroll revenue table to rightmost column  
   * Verify columns 1-6 remain visible  
   * Verify frozen columns have distinct visual separation  
4. **Dynamic Columns:**  
   * Test with 10-column deposit file  
   * Test with 40-column deposit file  
   * Test with 25-column deposit file  
   * Verify no layout breaking in any scenario  
5. **Edge Cases:**  
   * Very long text in Account Name or Legal Name (frozen columns)  
   * Numeric values exceeding expected width  
   * Zero or null values in amount fields  
   * Missing Quantity or Price Each data  
   * Deposit file with exactly minimum columns  
   * Deposit file with maximum columns

---

**TECHNICAL NOTES FOR DEVELOPER**  
**CSS/Styling Considerations:**

* Use CSS Grid or Flexbox for responsive alignment  
* Implement sticky positioning for frozen columns  
* Consider using data-scroll-sync attribute for linked scroll containers  
* Ensure scroll bar styling is consistent across both tables  
* Use overflow-x: hidden on frozen column containers  
* Use overflow-x: scroll on scrollable column containers

**HTML Structure Pattern:**  
html  
\<div class="reconciliation-container"\>  
  \<div class="table-wrapper deposit-table-wrapper"\>  
	\<div class="frozen-columns-deposit"\>  
      *\<\!-- Columns 1-5: Select, Line Item, Product Name, Account Name, Payment Date \--\>*  
	\</div\>  
	\<div class="scrollable-columns-deposit" data-scroll-sync="deposit-revenue"\>  
      *\<\!-- Columns 6-15+: All scrollable columns \--\>*  
	\</div\>  
  \</div\>  
   
  \<div class="table-wrapper revenue-table-wrapper"\>  
	\<div class="frozen-columns-revenue"\>  
      *\<\!-- Columns 1-6: Select, AI%, Status, Line Item, Rev Date, Legal Name \--\>*  
	\</div\>  
	\<div class="scrollable-columns-revenue" data-scroll-sync="deposit-revenue"\>  
      *\<\!-- Columns 7-25+: All scrollable columns \--\>*  
	\</div\>  
  \</div\>  
   
  \<div class="scroll-bar-container"\>  
    *\<\!-- Single scroll bar controlling both tables \--\>*  
  \</div\>  
\</div\>  
**JavaScript Scroll Sync Pattern:**  
javascript  
const depositScroll \= document.querySelector('.scrollable-columns-deposit');  
const revenueScroll \= document.querySelector('.scrollable-columns-revenue');  
   
depositScroll.addEventListener('scroll', () \=\> {  
  revenueScroll.scrollLeft \= depositScroll.scrollLeft;  
});  
   
revenueScroll.addEventListener('scroll', () \=\> {  
  depositScroll.scrollLeft \= revenueScroll.scrollLeft;  
});  
**Performance Considerations:**

* Debounce scroll events to prevent excessive updates  
* Consider using IntersectionObserver for virtual scrolling if table has 100+ rows  
* Test with large deposit files (100+ line items)  
* Monitor memory usage with large column counts (40+ columns)

**Browser Compatibility:**

* Test frozen columns in latest Chrome, Firefox, Safari, Edge  
* Verify scroll synchronization works on touch devices  
* Test on Windows/Mac/Linux  
* Verify horizontal scroll works with trackpad on Mac

**Accessibility:**

* Ensure keyboard navigation works across both tables  
* Add ARIA labels for synchronized scroll regions  
* Maintain screen reader compatibility  
* Use aria-live regions for dynamic content  
* Ensure frozen columns don't break tab order

**Future Enhancement Opportunities:**

* Consider "pin column" feature for File Columns Zone  
* Could add column drag/reorder capability  
* Consider saving user's column preferences  
* Could add column width adjustment persistence  
* Consider export functionality that respects alignment  
* 

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAARCAMAAAAMs7fIAAADAFBMVEUAAACMr79CdodCdodCdoeMr79+pLVHeouQtMOVusmWvMtei5xCdoeSt8agyNaexdOTtMO9z9jE1NyauMZnk6Ocw9KUuMjm6+77+fn09PXY4uefxtWvxtHt8PKawM+hvcqRtcW2y9XR3eOows5ij6CHq7xLfY5VhJUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoF/n2AAAABXRSTlMAn4AQQPpjvwIAAACbSURBVHheXY7dCsIwDIVP01Ln/GHoLtUL3/+tRPHCeddOkVGTpqtgoCXnS04S4D+MJUv4VO0DTfBurWq177GE42wclTRI/BPQFUMPLJSYTQbHhPam5O0PnJwizEUqJB/P2QXgkXupQAO0GcDCGgfaMruLbiI3BNk7e9QiL70KyBdGbnnOINfZNlSgi4Yf6Nh1rkriKnfIqBpp+gLEzx1Y11gvLgAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAARCAMAAAAMs7fIAAADAFBMVEUAAACMr79CdodCdodCdoeMr79+pLVHeouQtMOVusmWvMtei5xCdoeSt8agyNaexdOTtMO9z9jE1NyauMZnk6Ocw9KUuMjm6+77+fn09PXY4uefxtWvxtHt8PKawM+hvcqRtcW2y9XR3eOows5ij6CHq7xLfY5VhJUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoF/n2AAAABXRSTlMAn4AQQPpjvwIAAACbSURBVHheXY7dCsIwDIVP01Ln/GHoLtUL3/+tRPHCeddOkVGTpqtgoCXnS04S4D+MJUv4VO0DTfBurWq177GE42wclTRI/BPQFUMPLJSYTQbHhPam5O0PnJwizEUqJB/P2QXgkXupQAO0GcDCGgfaMruLbiI3BNk7e9QiL70KyBdGbnnOINfZNlSgi4Yf6Nh1rkriKnfIqBpp+gLEzx1Y11gvLgAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAARCAMAAAAMs7fIAAADAFBMVEUAAACMr79CdodCdodCdoeMr79+pLVHeouQtMOVusmWvMtei5xCdoeSt8agyNaexdOTtMO9z9jE1NyauMZnk6Ocw9KUuMjm6+77+fn09PXY4uefxtWvxtHt8PKawM+hvcqRtcW2y9XR3eOows5ij6CHq7xLfY5VhJUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoF/n2AAAABXRSTlMAn4AQQPpjvwIAAACbSURBVHheXY7dCsIwDIVP01Ln/GHoLtUL3/+tRPHCeddOkVGTpqtgoCXnS04S4D+MJUv4VO0DTfBurWq177GE42wclTRI/BPQFUMPLJSYTQbHhPam5O0PnJwizEUqJB/P2QXgkXupQAO0GcDCGgfaMruLbiI3BNk7e9QiL70KyBdGbnnOINfZNlSgi4Yf6Nh1rkriKnfIqBpp+gLEzx1Y11gvLgAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAARCAMAAAAMs7fIAAADAFBMVEUAAACMr79CdodCdodCdoeMr79+pLVHeouQtMOVusmWvMtei5xCdoeSt8agyNaexdOTtMO9z9jE1NyauMZnk6Ocw9KUuMjm6+77+fn09PXY4uefxtWvxtHt8PKawM+hvcqRtcW2y9XR3eOows5ij6CHq7xLfY5VhJUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoF/n2AAAABXRSTlMAn4AQQPpjvwIAAACbSURBVHheXY7dCsIwDIVP01Ln/GHoLtUL3/+tRPHCeddOkVGTpqtgoCXnS04S4D+MJUv4VO0DTfBurWq177GE42wclTRI/BPQFUMPLJSYTQbHhPam5O0PnJwizEUqJB/P2QXgkXupQAO0GcDCGgfaMruLbiI3BNk7e9QiL70KyBdGbnnOINfZNlSgi4Yf6Nh1rkriKnfIqBpp+gLEzx1Y11gvLgAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAARCAMAAAAMs7fIAAADAFBMVEUAAACMr79CdodCdodCdoeMr79+pLVHeouQtMOVusmWvMtei5xCdoeSt8agyNaexdOTtMO9z9jE1NyauMZnk6Ocw9KUuMjm6+77+fn09PXY4uefxtWvxtHt8PKawM+hvcqRtcW2y9XR3eOows5ij6CHq7xLfY5VhJUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoF/n2AAAABXRSTlMAn4AQQPpjvwIAAACbSURBVHheXY7dCsIwDIVP01Ln/GHoLtUL3/+tRPHCeddOkVGTpqtgoCXnS04S4D+MJUv4VO0DTfBurWq177GE42wclTRI/BPQFUMPLJSYTQbHhPam5O0PnJwizEUqJB/P2QXgkXupQAO0GcDCGgfaMruLbiI3BNk7e9QiL70KyBdGbnnOINfZNlSgi4Yf6Nh1rkriKnfIqBpp+gLEzx1Y11gvLgAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAARCAMAAAAMs7fIAAADAFBMVEUAAACMr79CdodCdodCdoeMr79+pLVHeouQtMOVusmWvMtei5xCdoeSt8agyNaexdOTtMO9z9jE1NyauMZnk6Ocw9KUuMjm6+77+fn09PXY4uefxtWvxtHt8PKawM+hvcqRtcW2y9XR3eOows5ij6CHq7xLfY5VhJUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoF/n2AAAABXRSTlMAn4AQQPpjvwIAAACbSURBVHheXY7dCsIwDIVP01Ln/GHoLtUL3/+tRPHCeddOkVGTpqtgoCXnS04S4D+MJUv4VO0DTfBurWq177GE42wclTRI/BPQFUMPLJSYTQbHhPam5O0PnJwizEUqJB/P2QXgkXupQAO0GcDCGgfaMruLbiI3BNk7e9QiL70KyBdGbnnOINfZNlSgi4Yf6Nh1rkriKnfIqBpp+gLEzx1Y11gvLgAAAABJRU5ErkJggg==>