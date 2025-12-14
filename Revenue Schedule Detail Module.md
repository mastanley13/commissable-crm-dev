**Revenue Schedule Detail Module** 

Technical Documentation & Systems Analysis 

**Commissable CRM Platform** 

Version 1.0 | December 2025 

**1\. Module Overview** 

**1.1 Purpose** 

The Revenue Schedule Detail module is the central hub for viewing, managing, and reconciling individual commission revenue records within the Commissable CRM platform. It provides a comprehensive, real-time view of the complete commission lifecycle—from expected revenue amounts through vendor deposits to partner payouts. 

**1.2 Business Problem Solved** 

Organizations that manage commission-based revenue face several critical challenges: 

* Tracking expected versus actual revenue amounts across multiple billing periods   
* Reconciling vendor deposits against expected commission payments   
* Managing complex commission split structures across multiple partners (House, House Reps, Subagents)   
* Maintaining audit trails for financial compliance   
* Identifying and resolving variances between expected and received amounts 

 

The Revenue Schedule Detail module addresses these challenges by consolidating all relevant financial data, calculations, and transaction history into a single, interactive interface. 

**1.3 System Context** 

The module operates within the broader Revenue Schedule and Deposit Matching ecosystem: 

 

| System Component  | Relationship to Revenue Schedule Detail  |
| :---- | :---- |
| Revenue Schedule List  | Parent view; clicking a schedule navigates to this detail page  |
| Deposit Import Engine  | Imports vendor commission deposits that are matched to schedules  |
| AI Reconciliation Component  | AI-powered engine that maps fields and matches deposits to revenue schedules  |
| Deposit Matching Engine  | Works with AI to match imported deposit line items to revenue schedules  |
| Opportunity Records  | Source opportunity data linked to each revenue schedule  |
| Account Records  | Customer account information displayed in header  |
| Commission Payout System  | Receives split calculations for partner payments  |

**1.4 Key User Roles** 

 

| Role  | Primary Use Cases  |
| :---- | :---- |
| Sales Operations  | Monitor commission splits, verify partner assignments, track reconciliation status  |
| Finance/Accounting  | Reconcile deposits, audit transactions, verify variance calculations  |
| Account Managers  | View client billing details, track revenue by account  |
| Partner Managers  | Verify subagent and house rep commission allocations  |
| Executive Leadership  | Review financial summary metrics and overall reconciliation health  |

**1.5 Key System Objects** 

* Revenue Schedule: The primary record containing expected amounts, dates, and metadata   
* Deposit Line Item: Individual line from vendor commission deposits   
* Transaction: Financial event (billing, deposit, payment) recorded in the ledger   
* Split: Commission allocation record for House, House Rep, or Subagent   
* Opportunity: Sales opportunity linked to the revenue schedule   
* Account: Customer account associated with the revenue 

 

**2\. Core Functions** 

**2.1 Display and Management of Expected Revenue Amounts** 

The module displays and manages several categories of expected amounts: 

 

**Usage Amounts** 

* Expected Usage Gross: Calculated from Quantity × Price Per   
* Expected Usage Adjustment: Manual or system adjustment to reconcile variances   
* Expected Usage Net: Gross \+ Adjustment (final expected usage)   
* Actual Usage: Amount actually billed/received from vendor   
* Usage Difference: Variance between Actual Usage and Expected Usage Net 

**Commission Amounts** 

* Expected Commission: Expected Usage Gross × Commission Rate %   
* Expected Commission Adjustment: Adjustment to reconcile commission variances   
* Expected Commission Net: Expected Commission \+ Adjustment   
* Actual Commission Net: Actual deposited commission amount   
* Commission Difference: Variance between Expected and Actual Commission Net 

**2.2 Bill Month vs Payment Month Logic** 

The system distinguishes between two critical date concepts: 

 

| Date Type  | Description  | Example  |
| :---- | :---- | :---- |
| Revenue Month  | The month the service was provided/usage occurred  | 2025-11  |
| Billing Month  | The month the vendor billed for the commission  | 2025-07-01  |
| Payment Date  | The date the commission deposit was received  | 2025-12-01  |

 

This separation allows tracking of timing differences between service delivery, vendor billing cycles, and actual commission receipt. 

**2.3 Matched Deposit Line-Item Data Placement** 

When deposit line items are matched to a revenue schedule, the system processes metadata as follows: 

 

1. The Deposit Matching Engine identifies a deposit line item for this revenue schedule   
2. System extracts metadata fields from the deposit line item (Services, Product Code, Sales ID, etc.)   
3. For each metadata field:   
* If the field label already exists on the schedule: The value is amended/updated   
* If the field label is new: A new field with that label is added to the metadata section   
4. Fields populate within each card column from top to bottom   
5. When a column reaches the bottom margin, new fields flow to the next column (2nd, 3rd, 4th)   
6. Each reconciled deposit gets its own metadata card in the Additional Information tab 

**2.4 Reconciliation Workflows** 

The module supports the following reconciliation workflows: 

 

**Usage Reconciliation** 

1. System receives actual usage amount from billing import   
2. Compares Actual Usage to Expected Usage Net   
3. Calculates Usage Difference   
4. If variance exists, user can apply Expected Usage Adjustment to reconcile   
5. Status updated to 'Reconciled' when difference \= $0.00 

**Commission Reconciliation** 

1. Deposit line item matched to revenue schedule   
2. Actual Commission Net populated from deposit amount   
3. Compares to Expected Commission Net   
4. Calculates Commission Difference   
5. If variance exists, user reviews and applies adjustment if needed   
6. Status updated to 'Reconciled' when difference \= $0.00 

**Payout Reconciliation** 

1. System calculates split amounts for each partner   
2. Payment transactions recorded when payouts are made   
3. Receivables balance updated (Commissions Receivables \- Paid \= Total)   
4. Status updated to 'Paid in Full' when balance \= $0.00 

**2.5 Triggered Formula Recalculations** 

The following events trigger automatic recalculation: 

 

| Trigger Event  | Recalculated Fields  |
| :---- | :---- |
| Quantity or Price Per change  | Expected Usage Gross, Expected Commission, all downstream amounts  |
| Commission Rate change  | Expected Commission, Commission Net amounts, Split amounts  |
| Adjustment value change  | Net amounts, Differences, Balances  |
| Deposit match/unmatch  | Actual amounts, Differences, Reconciliation status  |
| Payment recorded  | Paid amounts, Receivables balances, Payout status  |
| Split percentage change  | All split amounts and receivables  |

**2.6 Validation Checks** 

* Split percentages must total 100%   
* Commission rate must be between 0% and 100%   
* Quantity must be a positive number   
* Price Per must be a positive currency value   
* Dates must be valid and in logical sequence (Revenue Month ≤ Billing Month ≤ Payment Date) 

 

**3\. Subtabs and Sections** 

**3.1 Header Section** 

**Purpose** 

Displays key identifying information and context for the revenue schedule at a glance. 

**Data Displayed** 

The header contains three columns: 

 

**Column 1: Opportunity Overview** 

* Revenue Schedule Name (e.g., 'RS-12222')   
* Revenue Schedule Date   
* Opportunity (linked)   
* Revenue Month   
* Product Name \- House   
* Opportunity Owner 

**Column 2: Partner Information** 

* Subagent name   
* House Rep name   
* Distributor   
* Vendor   
* Payment Type   
* Comments (editable text input) 

**Column 3: Additional Details** 

* Account Name   
* Account Legal Name   
* Shipping Address   
* Billing Address 

**User Actions** 

* Click linked fields (Opportunity, Account) to navigate to related records   
* Enter/edit Comments   
* Click Print or Update buttons 

**Contribution to Reconciliation** 

Provides context for all reconciliation activities by identifying the opportunity, account, and partner assignments. 

**3.2 Financial Summary Section (Collapsible)** 

**Purpose** 

Provides a consolidated view of usage, commission, and split calculations with real-time variance analysis. 

**Toggle Behavior** 

* Click the ▼/▶ arrow to expand/collapse the entire section   
* Default state: Expanded   
* Collapsed state hides all three summary cards 

**Subsection: Usage Summary** 

**Data Displayed** 

| Field  | Formula/Source  | Example  |
| :---- | :---- | :---- |
| Quantity  | Input value  | 1  |
| Price Per  | Input value  | $500.00  |
| Expected Usage Gross  | Quantity × Price Per  | $500.00  |
| Expected Usage Adjustment  | Manual/calculated adjustment  | \+$25.00  |
| Expected Usage Net  | Gross \+ Adjustment  | $525.00  |
| Actual Usage  | From billing import (clickable)  | $525.00  |
| Usage Difference  | Actual \- Expected Net  | $0.00  |

**User Actions** 

* Click Actual Usage value to view source billing record 

**Visual Indicators** 

* Usage Difference: Green if positive, Red if negative, Gray if zero   
* Bold labels for net and difference rows   
* Gray highlighted background for summary rows 

**Subsection: Commission Summary** 

**Data Displayed** 

| Field  | Formula/Source  | Example  |
| :---- | :---- | :---- |
| Billing Month  | Date value  | 2025-07-01  |
| Expected Commission  | Expected Usage Gross × Rate %  | $40.00  |
| Expected Commission Adjustment  | Reconciliation adjustment  | \+$2.00  |
| Expected Commission Net  | Commission \+ Adjustment  | $42.00  |
| Actual Commission Net  | From matched deposit (underlined)  | $42.00  |
| Commission Difference  | Expected Net \- Actual Net  | $0.00  |

**User Actions** 

* Click Actual Commission Net to view matched deposit 

**Visual Indicators** 

* Commission Difference: Green if positive, Red if negative, Gray if zero 

**Subsection: Splits** 

**Data Displayed** 

| Field  | % View  | $ View  |
| :---- | :---- | :---- |
| House Split  | 20.00%  | $8.40  |
| House Rep Split  | 30.00%  | $12.60  |
| Subagent Split  | 50.00%  | $21.00  |
| Total Split  | 100.00%  | $42.00  |
| Expected Rate %  | 8.00%  | 8.00%  |
| Actual Rate %  | 8.00%  | 8.00%  |
| Commission Rate Difference  | 0.00%  | 0.00%  |

**User Actions** 

* Toggle between % and $ display modes   
* Click Actual Rate % to view source 

**Contribution to Reconciliation** 

Validates that commission rates match expectations and split allocations total correctly. 

 

**3.3 Commission Splits Tab** 

**Purpose** 

Displays detailed commission split calculations for each partner with reconciled and receivables balances. 

**Data Displayed** 

Three cards displayed side-by-side: 

 

**Card Structure (repeated for House, House Rep, Subagent)** 

**Header:** Partner name and split percentage (e.g., 'Algave LLC \- 20.00%') 

 

**Reconciled Section:** 

* Actual Commission Net × Split % \= Net amount   
* Example: $42.00 × 20% \= $8.40 

 

**Receivables Section:** 

* Commissions Receivables (amount owed based on split)   
* Paid (amount already paid out)   
* Total (remaining balance) 

**Formulas** 

| Calculation  | Formula  |
| :---- | :---- |
| Net (Reconciled)  | Actual Commission Net × Split %  |
| Commissions Receivables  | Expected Commission Net × Split %  |
| Total (Balance)  | Commissions Receivables \- Paid  |

**User Actions** 

* View split details for each partner   
* Identify outstanding receivables 

**Contribution to Reconciliation** 

Confirms commission distributions and tracks payout status for each partner. 

**3.4 Opportunity Details Tab** 

**Purpose** 

Displays consolidated ID mappings across House, Vendor, Distributor, and Customer systems. 

**Data Displayed** 

| Source  | Account ID  | Order ID  | Customer ID  | Location ID  | Service ID  |
| :---- | :---- | :---- | :---- | :---- | :---- |
| HOUSE  | 233  | 001231  | 0012  | 0015  | 132433  |
| VENDOR  | 0008  | 0016  | 0013  | —  | —  |
| DISTRIBUTOR  | 0002  | 0017  | 0014  | —  | —  |
| CUSTOMER  | 0101  | —  | —  | —  | —  |

**User Actions** 

* Reference IDs for cross-system lookups   
* Verify ID mappings are correct 

**Contribution to Reconciliation** 

Enables tracing of records across multiple systems for audit and troubleshooting. 

**3.5 Additional Information Tab** 

**Purpose** 

Displays vendor/distributor product metadata from matched deposit line items. 

**Data Displayed** 

Cards displaying metadata for each matched deposit: 

* Deposit ID and reconciliation date   
* Services (e.g., 'Ethernet Fiber')   
* Product Name \- Vendor (e.g., 'ADI')   
* Sales ID (e.g., 'EL004348')   
* Product Code (e.g., 'IN')   
* Additional dynamic fields from deposit metadata 

**Dynamic Field Behavior** 

1. When a deposit is matched, metadata fields are extracted   
2. Existing fields are updated with new values   
3. New field labels create new rows in the card   
4. Fields fill top-to-bottom within columns   
5. Overflow continues to next column (up to 4 columns) 

**User Actions** 

* View deposit metadata (read-only)   
* Identify which deposits have been matched 

**Contribution to Reconciliation** 

Provides audit trail of matched deposit data and validates that correct line items were matched. 

 

**3.6 Transactions Tab** 

**Purpose** 

Provides a complete financial audit trail of all transactions affecting this revenue schedule. 

**Data Displayed** 

| Column  | Description  |
| :---- | :---- |
| Date  | Transaction date  |
| Type  | Billing, Commission Deposit, Subagent Payment, House Rep Payment  |
| Account  | Related account or partner name  |
| Split  | Split type and percentage (for payments)  |
| ID  | Transaction ID  |
| Amount  | Usage/billing amount  |
| Commission  | Commission amount  |
| Paid  | Payment amount (negative for outflows)  |
| Total  | Profit calculation (Commission \- Paid)  |

**Filter Options** 

* All: Show all transaction types   
* Billings: Show only billing/usage transactions   
* Commission Deposits: Show only deposit transactions   
* Payments: Show only payout transactions   
* Payment Sub-filters: All Splits, Subagent only, House Rep only 

**Totals Row** 

| Column  | Aggregation  | Example  |
| :---- | :---- | :---- |
| Amount  | Sum of all billing amounts  | $525.00  |
| Commission  | Sum of all commission deposits  | $42.00  |
| Paid  | Sum of all payments (negative)  | \-$33.60  |
| Total  | Commission \- Paid (profit)  | $8.40  |

**User Actions** 

* Filter transactions by type   
* View transaction details   
* Verify audit trail completeness 

**Contribution to Reconciliation** 

Provides complete transaction history for audit, verification, and troubleshooting. 

**3.7 Activities Tab** 

**Purpose** 

Displays activity timeline and history for the revenue schedule. 

**Data Displayed** 

* Activity type (Call, Email, Task, Event)   
* Activity date and time   
* Subject and description   
* Assigned user   
* Status (Open, Completed) 

**User Actions** 

* Log new activities   
* Update activity status   
* View activity history 

**3.8 Tickets Tab** 

**Purpose** 

Displays support tickets and issues related to the revenue schedule. 

**Data Displayed** 

* Ticket number and subject   
* Status (Open, In Progress, Resolved, Closed)   
* Priority (Low, Medium, High, Critical)   
* Assigned agent   
* Created and updated dates 

**User Actions** 

* Create new support ticket   
* View ticket details   
* Update ticket status 

 

**4\. Formula Behaviors and Field Interactions** 

**4.1 Usage Calculations** 

 

| Formula  | Calculation  | Dependencies  |
| :---- | :---- | :---- |
| Expected Usage Gross  | Quantity × Price Per  | Quantity, Price Per  |
| Expected Usage Net  | Expected Usage Gross \+ Expected Usage Adjustment  | Expected Usage Gross, Adjustment  |
| Usage Difference  | Actual Usage \- Expected Usage Net  | Actual Usage, Expected Usage Net  |

**4.2 Commission Calculations** 

 

| Formula  | Calculation  | Dependencies  |
| :---- | :---- | :---- |
| Expected Commission  | Expected Usage Gross × (Expected Rate % / 100\)  | Expected Usage Gross, Rate  |
| Expected Commission Net  | Expected Commission \+ Expected Commission Adjustment  | Expected Commission, Adjustment  |
| Actual Commission Net  | Expected Commission \+ Adjustment (or from deposit)  | Expected Commission, Adjustment  |
| Commission Difference  | Expected Commission Net \- Actual Commission Net  | Both Commission Net values  |

**4.3 Split Calculations** 

 

| Formula  | Calculation  | Dependencies  |
| :---- | :---- | :---- |
| Commission Net (per split)  | Actual Commission Net × (Split % / 100\)  | Actual Commission Net, Split %  |
| Commissions Receivables  | Expected Commission Net × (Split % / 100\)  | Expected Commission Net, Split %  |
| Total (Balance)  | Commissions Receivables \- Paid  | Receivables, Paid amount  |

**4.4 Rate Calculations** 

 

| Formula  | Calculation  | Dependencies  |
| :---- | :---- | :---- |
| Commission Rate Difference  | Actual Rate % \- Expected Rate %  | Both rate values  |
| Total Split %  | House % \+ House Rep % \+ Subagent %  | All split percentages  |

**4.5 Cross-Tab Field Interactions** 

Changes in one section can affect data in other sections: 

 

| Source Change  | Affected Areas  |
| :---- | :---- |
| Actual Commission Net updated  | Commission Summary (Difference), Commission Splits (all cards), Transactions (Totals)  |
| Split % changed  | Splits section (all amounts), Commission Splits tab (all cards), Transaction filtering  |
| Payment recorded  | Commission Splits (Receivables), Transactions (new row, updated totals)  |
| Deposit matched  | Commission Summary (Actual), Additional Information (new card), Transactions (new row)  |

**4.6 Recalculation Sequence (Deposit Match)** 

When a deposit line item is matched to a revenue schedule: 

 

1. Deposit Matching Engine identifies match and triggers update   
2. Actual Commission Net field updated with deposit amount   
3. Commission Difference recalculated: Expected Commission Net \- Actual Commission Net   
4. Each split's Commission Net recalculated: Actual Commission Net × Split %   
5. Receivables balances updated based on new amounts   
6. Transaction Ledger creates new Commission Deposit row   
7. Transaction Totals row recalculated   
8. Additional Information tab receives deposit metadata   
9. Metadata fields populated (amended or added) in card   
10. Reconciliation status evaluated (Reconciled if difference \= $0) 

 

**5\. Distributor Field Mapping** 

**5.1 Overview** 

Distributors (such as Telarus) carry multiple vendors and report commission and usage data using vendor-specific templates. Each template maps the distributor's field names to Commissable CRM's standardized field names. This mapping enables automated data import and reconciliation. 

 

**IMPORTANT: Field mapping is performed by the AI component in the Reconciliation area of the Commissable SaaS application. The AI analyzes incoming deposit data, intelligently identifies field mappings based on vendor templates, and matches deposit line items to the appropriate Revenue Schedules.** 

**5.2 Universal/Common Fields** 

All vendor templates share four common fields that map to core Revenue Schedule fields. These mappings apply regardless of which vendor the deposit originates from: 

 

| Distributor Field Name  | Commissable Field Name  | Description  |
| :---- | :---- | :---- |
| Customer Name  | Account Legal Name  | The legal name of the customer account  |
| Usage  | Actual Usage \- Gross  | The gross usage/billing amount from the vendor  |
| Total Commission  | Actual Commission  | The total commission amount paid by the vendor  |
| Vendor Account  | Vendor Name  | The name of the vendor (carried by the distributor)  |

 

These four fields are critical for matching deposit line items to revenue schedules and populating the Financial Summary section with actual values. 

**5.3 Template Structure** 

Each Distributor-Vendor combination has a unique template map that defines: 

 

| Template Component  | Description  | Example  |
| :---- | :---- | :---- |
| Template Map Name  | Unique identifier for the mapping template  | Telarus-ACC Business  |
| Origin  | The distributor providing the deposit data  | Telarus  |
| CompanyName  | The vendor name as it appears in deposit files  | ACC Business  |

**5.4 Telarus Vendor Examples** 

Telarus carries numerous vendors, each with their own template. Examples include: 

* Telarus-8x8: Maps 8x8 UCaaS commission data   
* Telarus-ACC Business: Maps ACC Business connectivity data   
* Telarus-AireSpring: Maps AireSpring services data   
* Telarus-11:11 (with regional variants ANZ, CAD, UK): Maps 11:11 Systems data   
* Telarus-365 Data Centers: Maps colocation and data center data 

 

Each template may include additional vendor-specific fields beyond the four universal fields. These vendor-specific fields flow to the Additional Information tab as described in Section 2.3. 

**5.5 AI-Powered Field Mapping Data Flow** 

When a deposit file is imported, the AI component in the Reconciliation area processes the data: 

 

7. Deposit file uploaded to Reconciliation area   
8. AI component analyzes deposit line items and identifies the vendor   
9. AI looks up the appropriate template (e.g., 'Telarus-ACC Business')   
10. AI intelligently maps fields and matches to Revenue Schedules   
11. Universal fields are mapped:   
* Customer Name → Account Legal Name (used for matching)   
* Usage → Actual Usage \- Gross (populates Usage Summary)   
* Total Commission → Actual Commission (populates Commission Summary)   
* Vendor Account → Vendor Name (confirms vendor identity)   
12. Vendor-specific fields (Services, Product Code, Sales ID, etc.) flow to Additional Information   
13. Known ID fields (Account ID, Order ID, etc.) update Opportunity Details   
14. Revenue Schedule is matched and reconciled automatically 

**5.6 Manual User Adjustments** 

Users can manually adjust the following fields on a Revenue Schedule before or after reconciliation: 

 

| Field  | Location  | Description  |
| :---- | :---- | :---- |
| Usage (Bill Amount)  | Financial Summary → Usage Summary  | The actual billed amount received  |
| Expected Usage \- Adjustment  | Financial Summary → Usage Summary  | Manual adjustment to reconcile expected to actual  |
| Quantity  | Financial Summary → Usage Summary  | Number of units for the billing period  |
| Price Per (ea)  | Financial Summary → Usage Summary  | Unit price for the product/service  |
| Expected Commission Rate %  | Financial Summary → Splits  | Expected commission percentage from vendor  |

 

These manual adjustments allow users to correct data entry errors, apply negotiated rate changes, or reconcile variances that the AI cannot automatically resolve. 

**5.7 AI Reconciliation Wizard \- Automatic Matching** 

The AI Reconciliation Wizard automatically processes deposit line items and determines match status: 

 

**Threshold-Based Matching** 

* Admin settings define the allowable variance threshold (typically \+/- a percentage of expected)   
* If actual values fall within the threshold, the AI automatically sets status to 'Matched'   
* Both the deposit line item AND the expected Revenue Schedule are marked as 'Matched'   
* No user intervention required for matches within threshold 

 

**Admin Settings Configuration** 

| Setting  | Description  | Example  |
| :---- | :---- | :---- |
| Usage Variance Threshold  | Allowable % difference between expected and actual usage  | \+/- 5%  |
| Commission Variance Threshold  | Allowable % difference between expected and actual commission  | \+/- 3%  |
| Rate Variance Threshold  | Allowable % difference between expected and actual rate  | \+/- 1%  |

**5.8 Rate Discrepancy Handling** 

When the Expected Rate % and Actual Rate % differ, but usage amounts are aligned (actual vs expected), the system flags the record for user direction: 

 

**Flagged Condition** 

* Expected Rate % ≠ Actual Rate %   
* Actual Usage aligns with Expected Usage (within threshold)   
* Commission amount differs due to rate variance, not usage variance 

 

**User Action Options** 

The system presents the user with action buttons to resolve the rate discrepancy: 

 

| Action Button  | Behavior  | Scope  |
| :---- | :---- | :---- |
| Create Ticket  | Opens a support ticket for investigation of low payment share  | Current schedule only  |
| Accept New Rate %  | Accepts the actual rate and updates the current Revenue Schedule to 'Matched'  | Current schedule only  |
| Apply New Rate % to All Future Schedules  | Accepts actual rate for current AND updates Expected Rate % on all future Revenue Schedules for this Opportunity's product  | Current \+ all future schedules in Opportunity  |

 

**Rate Change Cascade Logic** 

When 'Apply New Rate % to All Future Schedules' is selected: 

6. Current Revenue Schedule updated with new rate and marked 'Matched'   
7. System identifies all future Revenue Schedules for the same product within the Opportunity   
8. Expected Commission Rate % updated on all identified future schedules   
9. Expected Commission amounts recalculated on affected schedules   
10. Audit log entry created documenting the rate change cascade 

**5.9 Impact on Revenue Schedule Detail** 

The mapped fields populate the following areas of the Revenue Schedule Detail page: 

 

| Mapped Field  | Destination Section  | Specific Field  |
| :---- | :---- | :---- |
| Customer Name  | Header → Additional Details  | Account Legal Name  |
| Usage  | Financial Summary → Usage Summary  | Actual Usage  |
| Total Commission  | Financial Summary → Commission Summary  | Actual Commission Net  |
| Vendor Account  | Header → Partner Information  | Vendor  |
| Vendor-specific metadata  | Additional Information Tab  | Dynamic fields in cards  |
| ID fields (Account, Order, etc.)  | Opportunity Details Tab  | Consolidated IDs table  |

 

**6\. End-to-End Data Flow** 

**6.1 Data Flow Diagram** 

The following describes the complete data flow through the Revenue Schedule Detail module: 

 

**Stage 1: Expected Amounts Creation** 

* Opportunity created with estimated revenue   
* Revenue Schedule created from Opportunity   
* Expected amounts calculated (Usage Gross, Commission)   
* Split percentages assigned (House, House Rep, Subagent) 

**Stage 2: Billing Period Processing** 

* Revenue Month assigned (service delivery period)   
* Billing Month assigned (vendor billing cycle)   
* Expected Usage populated based on product/pricing 

**Stage 3: Actual Usage Import** 

* Vendor billing data imported   
* Actual Usage amount populated   
* Usage Difference calculated   
* Usage Adjustment applied if needed 

**Stage 4: Deposit Import** 

* Vendor commission deposit file uploaded to Reconciliation area   
* Deposit line items created in system   
* Metadata extracted from deposit file 

**Stage 5: AI-Powered Deposit Matching** 

* AI component in Reconciliation area analyzes deposit line items   
* AI identifies vendor and applies appropriate field mapping template   
* AI intelligently matches line items to revenue schedules   
* Universal fields mapped (Customer Name, Usage, Total Commission, Vendor Account)   
* Actual Commission Net and Actual Usage populated from matched deposit 

**Stage 6: Variance Calculation** 

* Commission Difference calculated   
* Rate Difference calculated   
* Split amounts recalculated   
* Reconciliation status determined 

**Stage 7: Payout Processing** 

* Split amounts drive payout calculations   
* Payment transactions recorded   
* Receivables balances updated   
* Payout status updated (Paid in Full when balance \= $0) 

**Stage 8: Final Reconciled State** 

* All differences \= $0.00   
* All receivables paid   
* Status: Fully Reconciled   
* Audit trail complete in Transaction Ledger 

 

**7\. Sample Section Summaries** 

The following summaries are written as they would appear in final user documentation. 

**7.1 Usage Summary** 

*The Usage Summary displays the expected and actual usage amounts for this revenue schedule. The Expected Usage Gross is calculated by multiplying Quantity by Price Per. Any adjustments are added to arrive at Expected Usage Net. When actual usage is received from vendor billing, the system calculates the Usage Difference. A difference of $0.00 indicates the usage is fully reconciled. Click the Actual Usage value to view the source billing record.* 

**7.2 Commission Summary** 

*The Commission Summary tracks expected and actual commission amounts. Expected Commission is calculated from Expected Usage Gross multiplied by the commission rate. When vendor deposits are matched, Actual Commission Net is populated. The Commission Difference shows any variance between expected and actual amounts. A difference of $0.00 indicates the commission is fully reconciled.* 

**7.3 Splits Summary** 

*The Splits section shows how commissions are distributed among partners. Toggle between percentage (%) and dollar ($) views using the buttons. House, House Rep, and Subagent splits must total 100%. The Commission Rate Difference compares expected versus actual commission rates. Each partner's share is calculated by multiplying Actual Commission Net by their split percentage.* 

**7.4 Commission Splits Tab Summary** 

*The Commission Splits tab displays detailed cards for each partner (House, House Rep, Subagent). Each card shows two sections: Reconciled (actual amounts received and distributed) and Receivables (amounts owed versus paid). The Total in Receivables shows the remaining balance. When Total equals $0.00 for all partners, all commissions have been fully paid out.* 

**7.5 Transaction Ledger Summary** 

*The Transaction Ledger provides a complete audit trail of all financial activity for this revenue schedule. Use the filter buttons to view specific transaction types: Billings (usage received), Commission Deposits (vendor payments), or Payments (partner payouts). The Totals row shows aggregate amounts and calculates profit (Commission minus Paid). Each transaction includes date, type, account, and relevant amounts.* 

**7.6 Additional Information Summary** 

*The Additional Information tab displays metadata from matched vendor/distributor deposit line items. When deposits are matched, the system extracts product metadata (Services, Product Name, Sales ID, Product Code) and displays it in cards. Each matched deposit creates a new card. Fields are dynamically added as new metadata is received. This information is read-only and provides traceability to the source deposit data.* 

**7.7 Variance Analysis Summary** 

*Variance analysis is performed automatically throughout the module. Three key variances are tracked: Usage Difference (actual vs expected usage), Commission Difference (actual vs expected commission), and Commission Rate Difference (actual vs expected rate). Color coding indicates variance status: Green for positive variances, Red for negative variances, and Gray/Black for zero (reconciled). When all three variances equal zero, the revenue schedule is considered fully reconciled.* 

 

**8\. Appendix** 

**8.1 Field Reference** 

| Field Name  | Data Type  | Editable  | Source  |
| :---- | :---- | :---- | :---- |
| Revenue Schedule Name  | Text  | No  | System Generated  |
| Revenue Month  | Date (YYYY-MM)  | Yes  | User Input  |
| Billing Month  | Date  | Yes  | User Input  |
| Quantity  | Number  | Yes  | User Input  |
| Price Per  | Currency  | Yes  | User Input  |
| Expected Commission Rate  | Percent  | Yes  | Product/User  |
| Actual Commission Rate  | Percent  | No  | Calculated  |
| House Split %  | Percent  | Yes  | User Input  |
| House Rep Split %  | Percent  | Yes  | User Input  |
| Subagent Split %  | Percent  | Yes  | User Input  |
| Comments  | Text  | Yes  | User Input  |
| Actual Usage  | Currency  | No  | Billing Import  |
| Actual Commission Net  | Currency  | No  | Deposit Match  |

**8.2 Status Values** 

| Status  | Condition  | Applies To  |
| :---- | :---- | :---- |
| Pending  | Awaiting data/match  | Usage, Commission  |
| Reconciled  | Difference \= $0.00  | Usage, Commission  |
| Variance  | Difference ≠ $0.00  | Usage, Commission  |
| Paid in Full  | Balance \= $0.00  | Partner Payouts  |
| Partial  | Balance \> $0.00, Paid \> $0.00  | Partner Payouts  |

**8.3 Color Coding Reference** 

| Color  | Tailwind Class  | Meaning  |
| :---- | :---- | :---- |
| Blue  | text-blue-600, bg-blue-900  | Links, headers, primary actions  |
| Green  | text-green-600  | Positive amounts, deposits received  |
| Red  | text-red-600  | Negative amounts, payments made  |
| Gray  | text-gray-600/900  | Neutral values, labels  |
| Orange  | bg-orange-100  | Subagent-related items  |
| Purple  | bg-purple-100  | House Rep-related items  |

 

*— End of Technical Documentation —*   
