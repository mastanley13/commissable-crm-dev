

# COMMISSABLE CRM — PRODUCT BIBLE (Dev-Grade)

Version 1.0 | Generated Fri Mar 06 2026 | commissable-crm-dev.vercel.app

# SECTION 1: MASTER INDEX

All left-navigation modules in Commissable CRM with sub-pages, tabs, and one-sentence purpose statements.

## 1.1 Dashboard

Purpose: At-a-glance KPI summary and reconciliation health for the authenticated user. Pages: Main dashboard (KPI tiles, reconciliation summary, recent activity).

## 1.2 Accounts

Purpose: Manage all company/organization records (customers, distributors, vendors, prospects, subagents, house accounts). Pages: List | Detail (tabs: Contacts, Opportunities, Groups, Activities & Notes, History).

## 1.3 Contacts

Purpose: Manage individual people associated with accounts. Pages: List | Detail (tabs: Opportunities, Groups, Activities & Notes, History).

## 1.4 Opportunities

Purpose: Track sales deals from qualification through billing lifecycle. Pages: List | Detail (tabs: Summary, Products, Revenue Schedules, Roles, Details, Activities & Notes, History).

## 1.5 Revenue Schedules

Purpose: Track expected vs actual commission for each recurring service line item per billing period. Pages: List | Detail (tabs: Financial Summary, Transactions \[All/Billings/Commission Deposits/Payments\], Opportunity Details).

## 1.6 Catalog

Purpose: Manage product/service catalog with pricing, commission rates, and distributor/vendor mapping. Pages: List | Detail (tabs: Details, Other).

## 1.7 Reconciliation

Purpose: Upload distributor commission deposits, map columns, match deposit lines to revenue schedules, and finalize. Pages: List (by period) | Deposit Upload Form | Deposit Detail (line items \+ AI suggested matches).

## 1.8 Groups

Purpose: Organize accounts and contacts into logical groupings. Types observed: SalesTeam, AccountGroup. Pages: List | Detail.

## 1.9 Reports

Purpose: Generate commission and revenue analysis reports. Pages: List | Detail. Reports observed: Monthly Commission Report, Revenue Analysis Q3.

## 1.10 Tickets

Purpose: Track support/escalation tickets (empty in dev). Pages: List.

## 1.11 Activities

Purpose: Log calls, emails, tasks, notes across accounts and opportunities. Pages: List | Detail.

## 1.12 Admin

Purpose: System administration \- users, roles/permissions, data settings, imports, merges, templates. Pages: Panel | Users | Roles (Edit Permissions Modal) | Data Settings.

## 1.13 Settings

Purpose: User/system configuration. Sections: Profile, Notifications, Security & Privacy, Email Configuration, General, Reconciliation, Localization, Integrations, Appearance.

| \# | Module | Primary Purpose | Key Sub-Pages/Tabs |
| :---- | :---- | :---- | :---- |
| 1 | Dashboard | KPI overview \+ recon health | Main view |
| 2 | Accounts | Company/org records | List, Detail (5 tabs) |
| 3 | Contacts | Individual person records | List, Detail (4 tabs) |
| 4 | Opportunities | Sales deal tracking | List, Detail (7 tabs) |
| 5 | Revenue Schedules | Commission expected vs actual | List, Detail (3 tabs) |
| 6 | Catalog | Products & services | List, Detail (2 tabs) |
| 7 | Reconciliation | Deposit upload & matching | List, Upload Form, Deposit Detail |
| 8 | Groups | Account/contact groupings | List, Detail |
| 9 | Reports | Commission & revenue reports | List, Detail |
| 10 | Tickets | Support tickets | List (empty in dev) |
| 11 | Activities | Calls, emails, tasks, notes | List, Detail |
| 12 | Admin | User & role management | Users, Roles, Data Settings |
| 13 | Settings | System configuration | 9 sub-sections |

# SECTION 2: PER-SCREEN SPECIFICATIONS

Documented with: Location Path, Purpose, Personas, Inputs, Actions, Outputs, State Changes, Data Flow, Edge Cases, Test Cases.

## 2.1 Dashboard

Location: /dashboard | Purpose: Real-time snapshot of pipeline activity, reconciliation health, revenue performance. | Personas: All roles.

### KPI Tiles (Observed)

| KPI | Value Observed | Description |
| :---- | :---- | :---- |
| Accounts | 11 | Total active accounts |
| Contacts | 17 | Total contacts across all accounts |
| Opportunities | 23 | Total opportunity records |
| Catalog Items | 45 | Active products in catalog |
| Usage YTD | $2,500,000 | Gross usage year-to-date |
| Commission YTD | $25,000 | Net commission year-to-date |
| Past Due | 731 | Revenue schedule items past expected billing date |

RBAC: Salesperson sees only owned records (Assumption flagged). Admin/Accounting see all. Sales Management sees team scope.

### Test Cases

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-D-01 | Admin logs in | All 7 KPI tiles render with correct aggregated values |
| TC-D-02 | Salesperson logs in | KPIs reflect only assigned records (Assumption flagged) |
| TC-D-03 | Past Due tile clicked | Navigates to Revenue Schedules filtered to past-due items |
| TC-D-04 | New deposit finalized | Commission YTD updates to reflect new actual amounts |
| TC-D-05 | No deposits for current period | Reconciliation panel shows zero open deposits with instructional message |

## 2.2 Accounts List

Location: /accounts | Purpose: View, filter, sort, navigate all account records. | Personas: All roles.

| Column | Description | API/DB Reference |
| :---- | :---- | :---- |
| Account Name | Display name | account.name |
| Type | Enum: Customer/Distributor/House/Other/Prospect/Subagent/Vendor | account.type |
| Owner | Assigned user | account.owner\_id |
| Phone | Primary phone | account.phone |
| Website | Company URL | account.website |
| Created | Record creation date | account.created\_at |

### Actions

| Action | Preconditions | Result | API Call |
| :---- | :---- | :---- | :---- |
| Create Account | Role has Create permission | Opens create form | POST /api/accounts |
| Search/Filter | None | Filters list real-time | GET /api/accounts?q=\&type= |
| Click row | None | Navigates to Account Detail | GET /api/accounts/:id |
| Export | Role has Export permission | Downloads CSV | GET /api/accounts/export |
| Bulk operations | Role has Bulk Operations permission | Reassign/delete/tag multiple | PATCH /api/accounts/bulk |

RBAC: Salesperson: assigned only. Sales Management: team accounts. Admin/Accounting: all. Create/Delete/Bulk/Export buttons hidden if role lacks permission.

### Test Cases

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-AL-01 | Filter by Type \= Distributor | Only distributor accounts shown |
| TC-AL-02 | Salesperson views list | Only their assigned accounts visible |
| TC-AL-03 | Admin creates new account | Form opens; account saved; appears in list |
| TC-AL-04 | Export with Accounting role | CSV downloads with all account fields |
| TC-AL-05 | Salesperson attempts bulk delete | Action blocked; button hidden or permission error |

## 2.3 Account Detail

Location: /accounts/:id | Purpose: View/edit single account record and access related sub-objects via tabs.

| UI Label | Field Name | Type | Required | Validation | API/DB Ref |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Account Name | name | Text | Yes | Max 255 chars | account.name |
| Legal Name | legal\_name | Text | No | Max 255 chars | account.legal\_name |
| Parent Account | parent\_id | Lookup | No | Must be existing account | account.parent\_id |
| Type | type | Enum | Yes | One of 7 types | account.type |
| Owner | owner\_id | User lookup | Yes | Must be active user | account.owner\_id |
| Website | website | URL | No | Valid URL format | account.website |
| Description | description | Textarea | No | Max 2000 chars | account.description |
| Shipping Address | shipping\_\* | Address block | No | — | account.shipping\_\* |
| Billing Address | billing\_\* | Address block | No | — | account.billing\_\* |

Tabs: Contacts | Opportunities | Groups | Activities & Notes | History (audit log with user \+ timestamp).

### Test Cases

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-AD-01 | Edit Account Name and save | Name updates in list and detail views |
| TC-AD-02 | Change Type from Customer to Distributor | Type updates; any distributor-specific fields appear |
| TC-AD-03 | View Opportunities tab | Shows all linked opportunities with stage and close date |
| TC-AD-04 | Add shipping address | Address saved; visible on record |
| TC-AD-05 | View History tab after edit | Audit entry shows field, old value, new value, user, timestamp |

## 2.4 Opportunities List

Location: /opportunities | Purpose: View all deal records with pipeline stage, close date, commission split visibility.

| Column | Description |
| :---- | :---- |
| Opportunity Name | Deal identifier (format: Customer-Location-Distributor-Vendor-ProductFamily) |
| Account Legal Name | Primary account |
| Owner | Assigned salesperson |
| Stage | Current pipeline stage (9 possible values) |
| Close Date | Expected or actual close date |
| Subagent % | Commission split % for subagent |
| House Rep % | Commission split % for house rep |

### Opportunity Stages

| Stage | Type | Notes |
| :---- | :---- | :---- |
| Qualification | Active | Early discovery |
| Discovery | Active | Requirements gathering |
| Proposal | Active | Quote sent |
| Negotiation | Active | Contract discussion |
| On Hold | Active | Paused deal |
| Closed Lost | Terminal | Deal not won |
| ClosedWon\_Provisioning | Won | Won; service being provisioned |
| ClosedWon\_Billing | Won — Auto | Billing started; auto-advanced |
| ClosedWon\_BillingEnded | Won — Auto | Service billing ended; auto-advanced |

### Test Cases

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-OL-01 | Filter by Stage \= Proposal | Only Proposal-stage opportunities shown |
| TC-OL-02 | Stage auto-advances to ClosedWon\_Billing | Advances without manual action when billing detected |
| TC-OL-03 | Sort by Close Date ascending | List re-orders correctly |
| TC-OL-04 | Salesperson views list | Only owned opportunities visible |
| TC-OL-05 | Splits sum to \>100% | Validation error prevents save |

## 2.5 Opportunity Detail

### Summary Tab

| Field | Type | Description |
| :---- | :---- | :---- |
| Expected Commission | Currency (computed) | Sum of (Price x Commission%) across all products |
| Actual Commission | Currency (computed) | Sum of matched/finalized commission deposits |
| Account | Lookup link | Primary account |
| Owner | User link | Assigned salesperson |
| Stage | Enum | Current pipeline stage |
| Close Date | Date | Expected or actual close date |

### Products Tab

| UI Label | Field | Type | Description |
| :---- | :---- | :---- | :---- |
| House Product Name | house\_product\_name | Text | Internal product name |
| Part Number | part\_number | Text | Internal SKU |
| Distributor | distributor\_id | Lookup | Which distributor this routes through |
| Vendor | vendor\_id | Lookup | Underlying vendor/carrier |
| Product Family | product\_family | Enum | e.g., Internet & Voice Connectivity |
| Product Subtype | product\_subtype | Enum | e.g., UCaaS, Ethernet-Fiber |
| Price | price | Currency | MRC or NRC |
| Commission % | commission\_pct | Percent | Rate from distributor agreement (e.g., 16%) |
| Revenue Type | revenue\_type | Enum | MRC-3rd Party, MRC-Direct, NRC |
| Status | status | Enum | Active, Inactive, Cancelled |

### Revenue Schedules Tab

| Column | Description |
| :---- | :---- |
| Period | Billing month (YYYY-MM) |
| Status | Unreconciled / Matched / Finalized / Disputed |
| Distributor | Source distributor |
| Expected Commission | Computed: Price x Commission% |
| Actual Commission | Amount from matched deposit |
| Difference | Actual minus Expected (negative \= underpaid) |

### Details Tab

| UI Label | Field | Description |
| :---- | :---- | :---- |
| House Order ID | house\_order\_id | Internal Commissable order ID (e.g., 4E9161DA) |
| Other Account ID | other\_account\_id | Distributor-assigned account ID (e.g., 8310015263737\) |
| Other Order ID | other\_order\_id | Distributor order/circuit ID (e.g., 356953\) |

Roles Tab: Assign house rep, subagent with commission split %. Was empty in dev environment.

### Test Cases

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-OD-01 | Add product: Commission 16%, Price $599 | Expected Commission on Summary \= $95.84/mo |
| TC-OD-02 | Revenue Schedules tab shows 12 Unreconciled rows | Each row links to individual revenue schedule detail |
| TC-OD-03 | Details tab Other Order ID matches deposit line | Matching engine uses this for reconciliation linking |
| TC-OD-04 | Roles split percentages do not sum to 100% | Validation warning or error shown |
| TC-OD-05 | View Activities & Notes tab | Chronological log of all logged activities |
| TC-OD-06 | Stage changed to ClosedWon\_Provisioning | Revenue schedule generation triggered automatically |
| TC-OD-07 | Cancel product on Products tab | Status \= Cancelled; revenue schedules stop generating |

## 2.6 Revenue Schedule Detail

Location: /revenue-schedules/:id | Purpose: View and manage one monthly billing/commission line item.

### Financial Summary Panel

| Field | Type | Description |
| :---- | :---- | :---- |
| Qty | Integer | Units billed (typically 1\) |
| Price | Currency | MRC price from catalog product ($599 observed) |
| Commission % | Percent | Rate from product (16% observed) |
| Expected Commission | Currency (computed) | Price x Commission% \= $95.84 |
| Actual Commission | Currency | From matched/finalized deposit ($0 if unreconciled) |
| Commission Difference | Currency (computed) | Actual \- Expected |
| House Split % | Percent | 20% observed |
| House Rep Split % | Percent | 30% observed |
| Subagent Split % | Percent | 50% observed |
| Status | Enum | Unreconciled / Matched / Finalized / Disputed |

Transactions Tab (sub-tabs: All | Billings | Commission Deposits | Payments): All financial events for this schedule.

### Opportunity Details Tab

| Field | Description |
| :---- | :---- |
| HOUSE Account ID | Internal account GUID for house account |
| Service ID | Internal service/schedule ID (12582 observed) — PRIMARY MATCHING KEY |
| Other Account ID | External distributor account ID |
| Order ID | External distributor order/circuit ID (356953 observed) |

### Test Cases

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-RS-01 | Expected Commission \= Price x Commission% | $599 x 16% \= $95.84 — computed correctly |
| TC-RS-02 | Status \= Unreconciled before deposit matching | Status \= Unreconciled; Actual \= $0 |
| TC-RS-03 | Deposit line matched to this schedule | Status changes to Matched; Actual updates |
| TC-RS-04 | Deposit finalized | Status \= Finalized; record becomes read-only |
| TC-RS-05 | Commission Difference is negative | Highlighted as underpayment; surfaced in dispute workflow |
| TC-RS-06 | House% \+ House Rep% \+ Subagent% \!= 100% | Validation error on save |
| TC-RS-07 | All Transactions sub-tab | Both billing and deposit events visible |
| TC-RS-08 | Service ID matches deposit line Service ID | Primary key for auto-match used by matching engine |

## 2.7 Reconciliation List

Location: /reconciliation | Purpose: View all deposit records by period; navigate to individual deposit detail or start new upload.

| Column | Description |
| :---- | :---- |
| Distributor | Distributor account name |
| Period | Commission period (YYYY-MM-DD format observed as last day of month) |
| Deposit Name | Optional friendly name |
| Total Revenue | Sum of usage amounts on all deposit lines |
| Total Commission | Sum of commission amounts on all deposit lines |
| Status | Open/Finalized/Disputed |
| Actions | View detail, re-upload, dispute |

Observed data: ACC Business \- Telarus \- 2026-02-02 | Period: 2026-01-31 | Total Revenue: $0 | Total Commission: $127.56

### Test Cases

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-RL-01 | View list for month with finalized deposits | Finalized deposits show status \= Finalized with locked icon |
| TC-RL-02 | Click Upload button | Navigates to deposit upload form |
| TC-RL-03 | Filter by Distributor \= Telarus | Only Telarus deposits shown |
| TC-RL-04 | Accounting role views list | Full detail including commission totals visible |
| TC-RL-05 | Salesperson views list | Finance data hidden or module not accessible (RBAC) |

## 2.8 Catalog / Products List

Location: /products | Purpose: View and manage product/service catalog entries.

| Column | Description |
| :---- | :---- |
| Distributor | Distributor this product routes through |
| Vendor | Underlying carrier/vendor |
| Other Product Name | External/distributor product name |
| House Product Name | Internal Commissable product name |
| Price Each | List price (MRC or NRC) |
| Commission % | Commission rate |
| Revenue Type | MRC-3rd Party, MRC-Direct, NRC, etc. |

Product Detail fields: House Product Name, Part Number, Distributor, Vendor, Product Family, Product Subtype, Price, Commission%, Revenue Type, Status, Description. Other tab: Other Product Name (external name), Other Part Number (e.g., IN).

### Test Cases

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-PL-01 | Update Commission % on existing product | New value applies to future revenue schedules only (existing not retroactively changed \- Assumption flagged) |
| TC-PL-02 | Add new product with all required fields | Product saved; available for selection on Opportunity Products |
| TC-PL-03 | Filter by Distributor \= Telarus | Only Telarus products shown |
| TC-PL-04 | Deactivate product | Status \= Inactive; not selectable on new opportunities |
| TC-PL-05 | View product Other tab | External product name and part number visible for cross-reference |

## 2.9 Admin Panel

Location: /admin | Access: Administrator role only. Purpose: System-wide management of users, roles, data fields, imports, merges, templates.

### System Overview Metrics (Observed)

| Metric | Value Observed |
| :---- | :---- |
| Users | 4 (5 total including Invited) |
| Roles | 4 |
| Accounts | 12 |
| Contacts | 8 |
| Open Opportunities | 0 |
| Active Products | 8 |
| Revenue Schedules | 86 |
| Unreconciled Schedules | 86 |
| Deposits | 2 |
| Unmatched Lines | 4 |

### Roles and Permissions

| Role | Permission Count | Key Permissions |
| :---- | :---- | :---- |
| Accounting | 7 | View all financial, Modify financial, Export financial, Access reconciliation, Copy protection |
| Administrator | 37 | Full system access including Admin panel, user management, all CRUD |
| Sales Management | 22 | View all accounts/contacts/opps, limited finance access |
| Salesperson | 13 | View/edit assigned accounts, create opportunities, log activities |

Permission categories observed in Edit Permissions modal: Basic Information, Role Templates, Accounts, Contacts, Opportunities, Finance, Activities, Tickets, Admin, System.

### Test Cases

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-ADM-01 | Non-admin accesses /admin | Redirected or 403 error |
| TC-ADM-02 | Admin adds new permission to Salesperson role | Permission takes effect on next login for salesperson |
| TC-ADM-03 | Admin invites new user | Invite email sent; user appears in list with Invited status |
| TC-ADM-04 | Admin views Data Settings \> Manage Fields | Account types, revenue types, product families/subtypes editable |
| TC-ADM-05 | Admin deactivates user | User cannot log in; their owned records remain assigned |

# SECTION 3: RECONCILIATION WORKFLOW (TOP PRIORITY — MONEY WORKFLOW)

Complete end-to-end flow: Deposit Upload → Column Mapping → Normalization → AI/Manual Matching → Finalization. This is the core revenue-assurance workflow of Commissable.

## 3.1 Reconciliation States

| State | Description | Next Action |
| :---- | :---- | :---- |
| No Deposit | No file uploaded for this period/distributor | Upload deposit file |
| Uploaded — Unmapped | File uploaded; columns not yet mapped | Map columns |
| Mapped — Unmatched | Columns mapped; lines not yet matched to schedules | Run AI match or manual match |
| Partially Matched | Some lines matched; others open | Review unmatched; manual match or mark unrecognized |
| Fully Matched | All lines matched | Review and finalize |
| Finalized | Admin confirmed all matches; Actual Commission recorded | None — period closed |
| Disputed | Lines flagged as wrong amount or unrecognized | Resolve dispute before finalizing |

## 3.2 Step 1: Deposit Upload Form

Location: /reconciliation/deposit-upload-list

| UI Label | Field | Type | Required | Notes |
| :---- | :---- | :---- | :---- | :---- |
| Distributor | distributor\_id | Lookup/Dropdown | Yes | Must be account of type Distributor |
| Vendor | vendor\_id | Lookup/Dropdown | Yes | Vendor associated with this deposit |
| Multi-Vendor Upload | multi\_vendor | Toggle | No | When ON: deposit may contain lines from multiple vendors |
| Commission Period | commission\_period | Text YYYY-MM | Yes | Billing month this deposit covers |
| Deposit Received Date | received\_date | Date picker | Yes | Date EFT/check was received |
| Deposit Name | deposit\_name | Text | No | Optional friendly label |
| Created By | created\_by | Auto (current user) | Auto | Read-only; set from session |
| File | file | File upload (.csv/.xlsx/.xls/.pdf) | Yes | Commission statement from distributor |

### Test Cases — Deposit Upload

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-DU-01 | Upload valid CSV for Telarus/ACC Business 2026-01 | Deposit created; navigate to column mapping |
| TC-DU-02 | Upload without Distributor selected | Validation error: Distributor required |
| TC-DU-03 | Upload .docx file type | Error: unsupported file type |
| TC-DU-04 | Upload with Multi-Vendor toggle ON | All vendor columns available in mapping step |
| TC-DU-05 | Duplicate deposit same Distributor \+ Period | Warning: period already exists; confirm or cancel |
| TC-DU-06 | Role without Finance access attempts upload | Upload button hidden or 403 response |
| TC-DU-07 | PDF upload (scanned statement) | OCR parsing attempted; if fails, manual entry mode offered |

## 3.3 Step 2: Column Mapping

System displays column headers from uploaded file. User maps each column to a standard Commissable field.

| Standard Target Field | Description | Used For |
| :---- | :---- | :---- |
| Account ID / Customer ID | Distributor account ID for end customer | Match to Opportunity.other\_account\_id |
| Order ID / Circuit ID | Distributor order reference | Match to Opportunity.other\_order\_id |
| Service ID | Distributor service line ID | PRIMARY: Match to RevenueSchedule.service\_id |
| Product Name | Vendor/distributor product description | Secondary matching / display |
| Usage Gross | Raw billed usage before adjustments | P\&L calculation |
| Usage Adjustment | Credits, corrections to usage | P\&L calculation |
| Usage Net | Usage Gross \+ Usage Adjustment | P\&L final usage |
| Commission Gross | Raw commission before adjustments | Commission calculation |
| Commission Adjustment | Credits, clawbacks to commission | Commission calculation |
| Commission Net | Commission Gross \+ Commission Adjustment | Matches to RS Actual |
| Actual Commission | Final commission amount paid | Written to RS.actual\_commission |
| Commission Difference | Deposit Actual minus Expected | Underpayment/overpayment flag |
| Period / Billing Month | Month this line covers | Validated vs deposit Commission Period |
| Vendor | Vendor name (multi-vendor deposits) | Vendor disambiguation |

## 3.4 Step 3: Normalization

Each deposit line is normalized into a standard DepositLineItem record — the atomic unit of reconciliation and the single source of truth for what the distributor claims was paid.

| Field | Source | Description |
| :---- | :---- | :---- |
| deposit\_id | Parent record | FK to DepositRecord |
| line\_number | Auto | Sequential line number |
| account\_id\_raw | Mapped column | Raw distributor account ID as-received |
| order\_id\_raw | Mapped column | Raw order/circuit ID as-received |
| service\_id\_raw | Mapped column | Raw service ID as-received |
| product\_name\_raw | Mapped column | Raw product description |
| usage\_gross | Mapped column | Numeric |
| usage\_adjustment | Mapped column | Numeric (can be negative) |
| usage\_net | Computed or mapped | usage\_gross \+ usage\_adjustment |
| commission\_gross | Mapped column | Numeric |
| commission\_adjustment | Mapped column | Numeric (can be negative) |
| commission\_net | Computed or mapped | commission\_gross \+ commission\_adjustment |
| actual\_commission | Mapped column | Final commission amount |
| match\_status | System | Unmatched / Matched / Disputed / Ignored |
| matched\_revenue\_schedule\_id | Matching engine | FK to RevenueSchedule if matched |
| ai\_confidence\_score | AI engine | 0-100 confidence of suggested match |
| period | Mapped or inferred | YYYY-MM billing period |

## 3.5 Step 4: Matching (AI \+ Manual)

Location: /reconciliation/:id | Observed deposit: ACC Business \- Telarus \- 2026-02-02 | $797.30 deposit total | $127.56 commission | 4 line items | 0 matched

### Deposit Detail Header (Observed)

| Metric | Value (Observed) | Description |
| :---- | :---- | :---- |
| Deposit Status | Open \- Unmatched (0%) | No lines matched yet |
| Deposit Total | $797.30 | Sum of usage on all deposit lines |
| Commission Total | $127.56 | Sum of commission on all deposit lines |
| Line Items | 4 | Count of deposit lines |
| Matched | 0 | Lines matched to revenue schedules |

### AI Matching Engine

Right-side panel shows AI-suggested matches with confidence score filter slider. Match keys by priority:

| Match Key | Priority | Description |
| :---- | :---- | :---- |
| Service ID exact match | Primary | Deposit service\_id\_raw \= RevenueSchedule.service\_id |
| Order ID exact match | Secondary | Deposit order\_id\_raw \= Opportunity.other\_order\_id |
| Account ID exact match | Secondary | Deposit account\_id\_raw \= Opportunity.other\_account\_id |
| Amount proximity | Tertiary | Deposit commission\_net within tolerance of Expected Commission |
| Product name fuzzy match | Tertiary | NLP similarity between deposit product\_name\_raw and catalog product name |

### Test Cases — Matching (15 required for recon screens)

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-MT-01 | Service ID exact match exists | AI confidence 95%+; match auto-suggested |
| TC-MT-02 | No Service ID match; Order ID matches | AI confidence 60-80%; suggested with lower confidence |
| TC-MT-03 | Multiple RS with same Order ID | AI lists all candidates; user must select |
| TC-MT-04 | Deposit line for unknown account | Line stays Unmatched; flagged for manual review |
| TC-MT-05 | Actual Commission differs from Expected by \>10% | Match highlighted as Disputed with difference amount |
| TC-MT-06 | User manually overrides AI match | Override saved; audit log records user \+ timestamp |
| TC-MT-07 | AI confidence filter set to 90%+ | Only high-confidence suggestions shown |
| TC-MT-08 | Line matched to already-finalized schedule | Error: cannot match to finalized period |
| TC-MT-09 | Multi-vendor deposit; vendor column mapped | Lines correctly attributed to respective vendor RS |
| TC-MT-10 | Two deposit lines map to same RS | Conflict detected; user prompted to split or choose one |
| TC-MT-11 | Commission net is negative (clawback) | Line flagged as clawback; negative actual applied to RS |
| TC-MT-12 | Agent has direct vendor pay (not distributor) | P\&L ledger line created separately from commission ledger |
| TC-MT-13 | Period already finalized by another user | Error: period locked; no further matches allowed |
| TC-MT-14 | Filter by Unmatched only | Only unmatched lines shown |
| TC-MT-15 | Salesperson role views deposit detail | Finance data hidden or read-only per RBAC |

## 3.6 Step 5: Finalization

Authorized user (Accounting or Admin) finalizes deposit. Locks all matched lines and writes Actual Commission to linked Revenue Schedules.

### Finalization Effects

| Effect | Target Object | Field Updated |
| :---- | :---- | :---- |
| RS Actual Commission set | RevenueSchedule | actual\_commission \= deposit line actual\_commission |
| RS Status set | RevenueSchedule | status \= Finalized |
| Commission Difference computed | RevenueSchedule | commission\_difference \= actual \- expected |
| Deposit Status set | DepositRecord | status \= Finalized |
| Dashboard Commission YTD updated | Dashboard aggregate | commission\_ytd \+= new actual amounts |
| Splits calculated | CommissionSplit | house\_amount, house\_rep\_amount, subagent\_amount from split % |

### Test Cases — Finalization

| TC\# | Scenario | Expected Result |
| :---- | :---- | :---- |
| TC-FN-01 | Finalize deposit with all lines matched | All RS updated; deposit locked |
| TC-FN-02 | Finalize with some Unmatched lines | Warning shown; user confirms; unmatched lines stay open |
| TC-FN-03 | Non-Accounting role attempts finalization | Finalize button hidden or 403 error |
| TC-FN-04 | Finalized deposit: attempt to re-open | Re-open requires Admin role; audit log entry created |
| TC-FN-05 | Split calc: $127.56 x House 20% | House=$25.51; HouseRep=$38.27 (30%); Subagent=$63.78 (50%) |

# SECTION 4: DATA MODEL

Plain-English object definitions, cardinality, and field inventory for all primary entities.

## 4.1 Account

Represents any organization. Types: Customer, Distributor, House, Other, Prospect, Subagent, Vendor. Can have parent account (hierarchical). All opportunities, contacts, and revenue must be linked to an account.

| Field | Type | Notes |
| :---- | :---- | :---- |
| id | UUID | Primary key |
| name | String | Display name |
| legal\_name | String | Legal entity name |
| type | Enum | Customer/Distributor/House/Other/Prospect/Subagent/Vendor |
| parent\_id | UUID FK | Self-referential parent |
| owner\_id | UUID FK | Assigned user |
| website | String | URL |
| phone | String |  |
| description | Text |  |
| shipping\_\* / billing\_\* | Address fields | Street, City, State, Zip, Country |
| created\_at / updated\_at | Timestamp |  |

## 4.2 Contact

An individual person associated with an account. Can be linked to multiple opportunities and groups.

| Field | Type | Notes |
| :---- | :---- | :---- |
| id | UUID | Primary key |
| account\_id | UUID FK | Primary account |
| first\_name / last\_name / suffix | String |  |
| contact\_type | Enum | Decision Maker, Influencer, Technical, etc. |
| work\_phone / mobile / extension | String |  |
| email | String |  |
| job\_title | String |  |
| active | Boolean |  |
| description | Text |  |
| contact\_id | String | External/display ID |

## 4.3 Opportunity

A sales deal linking a customer account, distributor, vendor, and products. The central CRM object from which revenue schedules are generated.

| Field | Type | Notes |
| :---- | :---- | :---- |
| id | UUID | Primary key |
| name | String | Deal name |
| account\_id | UUID FK | Primary customer account |
| owner\_id | UUID FK | Assigned salesperson |
| stage | Enum | 9 stages as documented in Section 2.4 |
| close\_date | Date |  |
| house\_order\_id | String | Internal order reference |
| other\_account\_id | String | Distributor account reference |
| other\_order\_id | String | Distributor order/circuit reference |
| subagent\_pct / house\_rep\_pct | Decimal | Commission split percentages |
| created\_at / updated\_at | Timestamp |  |

## 4.4 OpportunityProduct

A product/service line item on an opportunity. Triggers revenue schedule generation when opportunity reaches ClosedWon\_Provisioning.

| Field | Type | Notes |
| :---- | :---- | :---- |
| id | UUID | Primary key |
| opportunity\_id | UUID FK |  |
| catalog\_product\_id | UUID FK | Links to Catalog |
| house\_product\_name / part\_number | String | Internal name/SKU |
| distributor\_id / vendor\_id | UUID FK | Account of type Distributor/Vendor |
| product\_family / product\_subtype | Enum |  |
| price | Currency | MRC or NRC |
| commission\_pct | Decimal | e.g., 16.0 |
| revenue\_type | Enum | MRC-3rd Party, MRC-Direct, NRC |
| status | Enum | Active/Inactive/Cancelled |
| other\_product\_name / other\_part\_number | String | External distributor references |

## 4.5 RevenueSchedule

One billing period of one product line on one opportunity. PRIMARY RECONCILIATION OBJECT. One record per active OpportunityProduct per month.

| Field | Type | Notes |
| :---- | :---- | :---- |
| id | UUID | Primary key |
| opportunity\_id / opportunity\_product\_id | UUID FK |  |
| period | String YYYY-MM | Billing month |
| service\_id | String | Commissable internal service ID (e.g., 12582\) — PRIMARY MATCH KEY |
| qty | Integer | Units billed |
| price / commission\_pct | Currency/Decimal | Inherited from OpportunityProduct |
| expected\_commission | Currency (computed) | price x commission\_pct / 100 |
| actual\_commission | Currency | Written by finalization |
| commission\_difference | Currency (computed) | actual \- expected |
| usage\_gross / usage\_adjustment / usage\_net | Currency | From deposit line; P\&L ledger |
| commission\_gross / commission\_adjustment / commission\_net | Currency | From deposit line; Commission ledger |
| house\_pct / house\_rep\_pct / subagent\_pct | Decimal | Split percentages |
| status | Enum | Unreconciled/Matched/Finalized/Disputed |
| flex\_type | Enum | Normal (observed) |
| distributor\_id / vendor\_id | UUID FK |  |

## 4.6 DepositRecord

A single commission statement from a distributor. Parent object for all deposit line items.

| Field | Type | Notes |
| :---- | :---- | :---- |
| id | UUID | Primary key |
| distributor\_id / vendor\_id | UUID FK | Distributor and vendor accounts |
| commission\_period | String YYYY-MM | Billing period covered |
| received\_date | Date | Date EFT/check received |
| deposit\_name | String | Optional friendly name |
| total\_revenue / total\_commission | Currency | Aggregates across line items |
| line\_item\_count / matched\_count | Integer | Line counts |
| status | Enum | Open/Finalized/Disputed |
| created\_by | UUID FK | User who uploaded |
| file\_path | String | Storage path of original file |

## 4.7 DepositLineItem

ATOMIC NORMALIZED TRANSACTION LINE from a distributor deposit. Single source of truth for what the distributor claims was paid per service. See Section 3.4 for full field list.

## 4.8 Entity Cardinality

| Relationship | Cardinality | Notes |
| :---- | :---- | :---- |
| Account → Contacts | 1:Many | One account; many contacts |
| Account → Opportunities | 1:Many | Customer account on opportunity |
| Opportunity → OpportunityProducts | 1:Many | One deal; many product lines |
| OpportunityProduct → RevenueSchedules | 1:Many | One product line generates many monthly schedules |
| DepositRecord → DepositLineItems | 1:Many | One deposit; many line items |
| DepositLineItem → RevenueSchedule | M:1 | Many lines attempt to match; one line matches to one schedule |
| RevenueSchedule → Transactions | 1:Many | Billings \+ deposits \+ payments |
| Account (Distributor) → DepositRecords | 1:Many | One distributor; many deposits |
| Opportunity → CommissionSplits | 1:Many | One opportunity; multiple role assignments |

## 4.9 Ledger Separation (CRITICAL)

| Ledger | Objects | Purpose |
| :---- | :---- | :---- |
| Commission/Residual Ledger | RevenueSchedule, DepositLineItem, CommissionSplit | Tracks what distributor owes agent per service per month. Source of truth for agent commission income. |
| P\&L Ledger | usage\_gross, usage\_net on RevenueSchedule | Tracks gross revenue billed to end customer. Used for profitability analysis, not commission calculation. |
| Direct Vendor Pay | Separate deposit/transaction type | For services where vendor pays agent directly (not via distributor). Assumption flagged: separate workflow not fully documented in UI. |

# SECTION 5: FORMULA LIBRARY AND RECALCULATION DEPENDENCY MAP

## 5.1 Expected Commission

| Attribute | Value |
| :---- | :---- |
| Formula | Expected Commission \= Price × (Commission% ÷ 100\) |
| Purpose | Commission Ledger: what agent expects to receive from distributor per service per billing period |
| Variables | Price \= revenue\_schedule.price (from catalog, MRC). Commission% \= revenue\_schedule.commission\_pct |
| Rounding | 2 decimal places, standard (0.005 rounds up) |
| Units | USD |
| Trigger | Recalculates when: Price or Commission% changes on OpportunityProduct; new RS generated |
| Worked Example | Price=$599.00, Commission%=16 → $599.00 × 0.16 \= $95.84 |

## 5.2 Commission Difference

| Attribute | Value |
| :---- | :---- |
| Formula | Commission Difference \= Actual Commission \- Expected Commission |
| Purpose | Identify underpayment (negative) or overpayment (positive) for a billing period |
| Trigger | Computed at finalization; recomputed if Actual Commission is adjusted post-finalization |
| Worked Example | Expected=$95.84, Actual=$85.00 → Difference=$85.00-$95.84=-$10.84 (UNDERPAID) |

## 5.3 Usage Net

| Attribute | Value |
| :---- | :---- |
| Formula | Usage Net \= Usage Gross \+ Usage Adjustment |
| Purpose | P\&L Ledger: net billable revenue to end customer after credits/adjustments |
| Notes | Usage Adjustment is typically negative for credits |

## 5.4 Commission Net

| Attribute | Value |
| :---- | :---- |
| Formula | Commission Net \= Commission Gross \+ Commission Adjustment |
| Purpose | Net commission from distributor after clawbacks and adjustments |
| Notes | Commission Adjustment typically negative (clawback, credit, correction) |

## 5.5 Commission Split Calculations

| Split | Formula | Example (Actual=$127.56, House=20%, Rep=30%, Sub=50%) |
| :---- | :---- | :---- |
| House Amount | Actual × House% | $127.56 × 0.20 \= $25.51 |
| House Rep Amount | Actual × House Rep% | $127.56 × 0.30 \= $38.27 |
| Subagent Amount | Actual × Subagent% | $127.56 × 0.50 \= $63.78 |
| Validation | Sum of all splits must \= 100% | 20+30+50=100 — valid |

## 5.6 Dependency Chain

| If This Changes | Then This Updates | And Then Updates |
| :---- | :---- | :---- |
| OpportunityProduct.price | RS.expected\_commission | Dashboard Commission YTD |
| OpportunityProduct.commission\_pct | RS.expected\_commission | Dashboard Commission YTD |
| DepositLineItem finalized | RS.actual\_commission | RS.commission\_difference \+ Dashboard YTD \+ CommissionSplit amounts |
| RS.actual\_commission adjusted post-finalization | RS.commission\_difference | CommissionSplit amounts recalculated |
| Opportunity stage → ClosedWon\_Provisioning | New RS records generated | expected\_commission computed for each |

# SECTION 6: REPORTING CATALOG

## 6.1 Reports Discovered

| Report | Type | Status | Created | Last Run |
| :---- | :---- | :---- | :---- | :---- |
| Monthly Commission Report | Commission | Completed | 2025-09-01 | 2025-09-10 |
| Revenue Analysis Q3 | Revenue | Completed | 2025-09-01 | Not observed |

## 6.2 Monthly Commission Report

| Attribute | Details |
| :---- | :---- |
| Purpose | Summarize total commissions earned across all distributors for a given month, broken down by account, opportunity, and split recipient |
| Filters (inferred) | Commission Period (YYYY-MM), Distributor, Vendor, Opportunity Stage, Owner/Rep |
| Grouping (inferred) | By Distributor → Opportunity → Revenue Schedule |
| Data Sources | RevenueSchedule (actual/expected/difference), DepositRecord, CommissionSplit |
| Export Formats | CSV, PDF (inferred) |
| Questions Answered | Total commission this month? Which distributors underpaid? How much did each rep earn? Any unreconciled items? |
| Recon Confidence Indicator | Should show % of RS finalized vs unreconciled for the period |

## 6.3 Revenue Analysis Q3

| Attribute | Details |
| :---- | :---- |
| Purpose | Quarterly P\&L view of gross usage revenue across all accounts and products |
| Filters (inferred) | Quarter, Distributor, Vendor, Product Family, Account |
| Grouping (inferred) | By month within quarter; by product family; by distributor |
| Data Sources | RevenueSchedule (usage\_gross, usage\_net), DepositRecord |
| Questions Answered | Total gross revenue in Q3? Which product families drove most revenue? Q3 vs Q2 comparison? |

## 6.4 Dashboard Panels

| Panel | Data Shown | Questions Answered |
| :---- | :---- | :---- |
| KPI Tiles | Counts and YTD totals | Overall business performance? Past-due items? |
| Reconciliation Health | Open deposits, unmatched %, period coverage | How current is reconciliation? What needs attention? |
| Recent Activity | Latest activities logged | What happened recently across accounts and opportunities? |

# SECTION 7: OLD WAY vs NEW WAY

Comparison of manual/spreadsheet-based commission management vs Commissable CRM.

## 7.1 Multi-Distributor Commission Reconciliation

| Dimension | Old Way (Manual/Spreadsheet) | New Way (Commissable) |
| :---- | :---- | :---- |
| Data collection | Log into each distributor portal (Telarus, Intelisys, Avant, etc.) separately; download each statement manually | Upload all deposits into Commissable; one normalized view regardless of distributor format |
| Normalization | Manually reformat each distributor CSV into consistent Excel columns | Column mapping step normalizes all deposits to standard DepositLineItem fields |
| Matching | Manually VLOOKUP distributor order IDs to internal deal tracker rows | AI matching engine suggests matches based on Service ID, Order ID, Account ID |
| Discrepancy detection | Compare expected vs actual in formulas; easy to miss or miscalculate | Commission Difference computed automatically; discrepancies flagged on every RS |
| Split calculation | Separate formulas for house/rep/subagent; error-prone | Splits computed automatically from % stored on opportunity after finalization |
| Audit trail | None, or manual comments/notes | Full audit log on every record: user, timestamp, before/after values |
| Period locking | No enforcement; anyone edits any cell at any time | Finalization locks deposit and RS records for the period |
| Cross-distributor view | Must merge multiple spreadsheets; complex and time-consuming | Single Revenue Schedules view across all distributors with common status fields |
| Time per close | 4-8 hours per month per distributor (estimate) | Target: 30-60 minutes per distributor after initial setup |

## 7.2 Direct Vendor Pay \+ Distributor Pay Overlap

| Scenario | Old Way | New Way |
| :---- | :---- | :---- |
| Agent receives from Telarus AND directly from AT\&T | Two spreadsheets; easy to double-count or miss one | Two DepositRecords with distributor vs direct-vendor flag; P\&L and Commission ledgers kept separate |
| Clawback from distributor for cancelled service | Negative row; may not link back to original month | Negative Commission Adjustment on deposit line; linked to original RS; difference flagged |
| Vendor changes commission rate mid-year | Manually update all future spreadsheet rows | Update OpportunityProduct.commission\_pct; future RS auto-recompute expected amounts |

## 7.3 Risks Avoided

| Risk | Manual Exposure | Commissable Mitigation |
| :---- | :---- | :---- |
| Double counting commission | High — merging spreadsheets creates duplicate rows | Deposit line item is atomic; duplicate detection on upload |
| Missed commission | High — easy to miss a service line in large statement | Every active RS is tracked; unmatched lines flagged |
| Incorrect split payment | Medium — formula errors in split calculations | Splits computed from stored %; not manual formulas |
| Audit gaps | High — no record of who changed what or when | Full audit log on all objects |
| Period close errors | High — no enforcement mechanism | Finalization locks period; re-open requires Admin |
| Cross-distributor inconsistency | High — each distributor uses different field names/formats | Normalization layer maps all to standard fields |
| Commission rate drift | Medium — rate changes not propagated | Rate stored on OpportunityProduct; future schedules inherit updated rate |

# SECTION 8: CLARIFICATIONS NEEDED \+ PRIORITIZED BACKLOG

Open questions and assumptions from the product bible analysis. These need confirmation from product owner or dev team. Assumptions are labeled "Assumption flagged" throughout this document.

## 8.1 Open Questions

| \# | Area | Question | Current Assumption |
| :---- | :---- | :---- | :---- |
| Q1 | RBAC | Does Salesperson role see only owned records across ALL modules? | Assumed yes — view assigned only applies to all modules |
| Q2 | Reconciliation | What happens to unmatched deposit lines after finalization? | Assumed they remain Open/Unmatched for future matching |
| Q3 | Revenue Schedules | What triggers auto-stage advance ClosedWon\_Provisioning → ClosedWon\_Billing? | Assumed event-based (billing starts when first deposit match detected) |
| Q4 | Multi-Distributor | Can one opportunity have products from multiple distributors? | Assumed yes; each OpportunityProduct has own distributor\_id; generates separate RS |
| Q5 | Direct Vendor Pay | Is there a separate workflow for direct vendor pay (not through distributor)? | Assumed flag on deposit or separate deposit type — not confirmed in UI |
| Q6 | Duplicate Detection | What duplicate logic exists on deposit upload? | Assumed period \+ distributor \+ vendor combination check |
| Q7 | PDF Parsing | Does OCR parsing work in production? Fallback if it fails? | Assumed fallback to manual entry mode |
| Q8 | Commission Splits | Are splits at opportunity level or opportunity-product level? | Observed at opportunity level (Roles tab); product-level not confirmed |
| Q9 | RS Generation | Are revenue schedules generated indefinitely or for fixed contract term? | Assumed indefinitely until product status \= Cancelled |
| Q10 | Catalog Updates | When catalog product price/commission% updated, does it retroactively update existing OpportunityProducts? | Assumed NO — OpportunityProduct stores snapshot at creation time |
| Q11 | Groups | What is the practical use case for Groups? | Observed SalesTeam and AccountGroup types — exact use case not documented |
| Q12 | Tickets | Is the Tickets module in scope? It was empty in dev. | Appears to be a future feature or external integration |

## 8.2 Prioritized Backlog

### Data Integrity (Critical)

| \# | Item | Risk |
| :---- | :---- | :---- |
| DI-01 | Duplicate deposit detection — confirm logic prevents same-period same-distributor double upload | Critical |
| DI-02 | Commission split % validation — enforce sum=100% at save time, not just display time | High |
| DI-03 | RevenueSchedule orphan detection — identify schedules where product is Cancelled but schedule not ended | High |
| DI-04 | Confirm referential integrity between DepositLineItem.matched\_RS\_id and RevenueSchedule.id | High |
| DI-05 | Verify Actual Commission on RS is immutable after finalization without explicit re-open | Critical |

### UX (High)

| \# | Item | Priority |
| :---- | :---- | :---- |
| UX-01 | Bulk match confirmation — approve all high-confidence AI matches at once | High |
| UX-02 | Visual indicator for Disputed status distinct from Unmatched on RS list | High |
| UX-03 | Deposit upload progress indicator for large files | Medium |
| UX-04 | In-line commission difference highlighting: red=underpaid, green=exact/over | High |
| UX-05 | Period selector on Reconciliation list to navigate months without URL manipulation | Medium |

### Automation (High)

| \# | Item | Priority |
| :---- | :---- | :---- |
| AU-01 | Auto-advance stage ClosedWon\_Provisioning → ClosedWon\_Billing — define and document trigger conditions | Critical |
| AU-02 | Scheduled RS generation — confirm monthly cron job vs event-based creation | High |
| AU-03 | Email notification on deposit finalization to relevant rep(s) | Medium |
| AU-04 | Auto-reject AI match suggestions below configurable confidence threshold | Medium |

### Reporting (Medium)

| \# | Item | Priority |
| :---- | :---- | :---- |
| RP-01 | Add reconciliation confidence % to all commission reports (% finalized vs total) | High |
| RP-02 | Cross-distributor consolidated commission view — all distributors in one report per period | High |
| RP-03 | Commission trend report — MoM and YoY by distributor and product family | Medium |
| RP-04 | Underpayment aging report — how long each RS has been unreconciled | High |
| RP-05 | Rep commission statement — per-salesperson view of earned commission split amounts | High |

### Security (High)

| \# | Item | Priority |
| :---- | :---- | :---- |
| SC-01 | Confirm Copy Protection permission prevents clipboard export of financial data | High |
| SC-02 | Confirm finalized deposit re-open requires Admin role and creates audit log entry | Critical |
| SC-03 | Verify all /api/reconciliation/\* endpoints require Finance permission, not just auth session | Critical |
| SC-04 | File upload: confirm server-side content validation (not just extension check) to prevent malicious files | High |

### Performance (Medium)

| \# | Item | Priority |
| :---- | :---- | :---- |
| PF-01 | 86 unreconciled RS listed in dev — test pagination/performance at 1000+ schedules | Medium |
| PF-02 | AI matching engine response time for deposits with 500+ line items | Medium |
| PF-03 | Dashboard KPI aggregation — confirm server-side (not client-side) for large datasets | Medium |

# APPENDIX: MERMAID DIAGRAM SOURCE CODE

Render at mermaid.live or embed in documentation tools. Each diagram includes plain-English description and suggested export filename.

## A.1 Reconciliation Workflow

Description: Complete lifecycle of a commission deposit from upload through finalization, including AI matching decision points and manual override.  
Filename: commissable-reconciliation-workflow.png  
flowchart TD  
  A\[Upload Deposit File\] \--\> B\[Select Distributor \+ Vendor \+ Period\]  
  B \--\> C\[File Parsed Server-Side\]  
  C \--\> D{Parse OK?}  
  D \--\>|No| E\[Error: Show row/col details\]  
  D \--\>|Yes| F\[Column Mapping Step\]  
  F \--\> G\[Map to Standard Fields\]  
  G \--\> H\[Normalization: Create DepositLineItems\]  
  H \--\> I\[AI Matching Engine Runs\]  
  I \--\> J{AI Confidence \>= Threshold?}  
  J \--\>|Yes| K\[Auto-Suggest Match\]  
  J \--\>|No| L\[Flag for Manual Review\]  
  K \--\> M\[User Reviews Suggestions\]  
  L \--\> M  
  M \--\> N{All Lines Matched?}  
  N \--\>|No| O\[Manual Match or Mark Unrecognized\]  
  O \--\> N  
  N \--\>|Yes| P\[Accounting/Admin Reviews\]  
  P \--\> Q\[Finalize Deposit\]  
  Q \--\> R\[Write Actual Commission to Revenue Schedules\]  
  R \--\> S\[Compute Commission Differences\]  
  S \--\> T\[Calculate Commission Splits\]  
  T \--\> U\[Period Locked / Deposit Finalized\]

## A.2 Opportunity Stage Lifecycle

Description: How an opportunity moves through pipeline stages including automatic post-close advances.  
Filename: commissable-opportunity-stages.png  
stateDiagram-v2  
  \[\*\] \--\> Qualification  
  Qualification \--\> Discovery  
  Discovery \--\> Proposal  
  Proposal \--\> Negotiation  
  Negotiation \--\> ClosedWon\_Provisioning  
  Negotiation \--\> ClosedLost  
  Qualification \--\> OnHold : pause  
  Discovery \--\> OnHold : pause  
  Proposal \--\> OnHold : pause  
  OnHold \--\> Qualification : resume  
  ClosedWon\_Provisioning \--\> ClosedWon\_Billing : AUTO \- billing starts  
  ClosedWon\_Billing \--\> ClosedWon\_BillingEnded : AUTO \- service ends  
  ClosedLost \--\> \[\*\]  
  ClosedWon\_BillingEnded \--\> \[\*\]

## A.3 Entity Relationship Diagram

Description: All primary data entities and their relationships with cardinality notation.  
Filename: commissable-er-diagram.png  
erDiagram  
  ACCOUNT ||--o{ CONTACT : has  
  ACCOUNT ||--o{ OPPORTUNITY : is\_primary\_on  
  ACCOUNT ||--o{ DEPOSIT\_RECORD : submits  
  OPPORTUNITY ||--o{ OPPORTUNITY\_PRODUCT : contains  
  OPPORTUNITY\_PRODUCT ||--o{ REVENUE\_SCHEDULE : generates  
  DEPOSIT\_RECORD ||--o{ DEPOSIT\_LINE\_ITEM : contains  
  DEPOSIT\_LINE\_ITEM }o--|| REVENUE\_SCHEDULE : matches\_to  
  REVENUE\_SCHEDULE ||--o{ TRANSACTION : has  
  OPPORTUNITY ||--o{ COMMISSION\_SPLIT : has\_roles

## A.4 RBAC Permission Matrix

| Permission | Accounting | Administrator | Sales Management | Salesperson |
| :---- | :---- | :---- | :---- | :---- |
| View all accounts | Yes | Yes | Yes (team scope) | No (own only) |
| Create accounts | Unknown | Yes | Yes | Unknown |
| View all financial data | Yes | Yes | Unknown | No |
| Modify financial records | Yes | Yes | No | No |
| Export financial data | Yes | Yes | Unknown | No |
| Access reconciliation | Yes | Yes | No | No |
| Admin panel access | No | Yes | No | No |
| Manage roles/users | No | Yes | No | No |
| Finalize deposits | Yes | Yes | No | No |
| Copy protection enabled | Yes | Unknown | Unknown | Unknown |
| Total observed permissions | 7 | 37 | 22 | 13 |

\=== END OF COMMISSABLE PRODUCT BIBLE (Dev-Grade) \===  
Generated by automated crawl and analysis of commissable-crm-dev.vercel.app  
Assumptions are labeled "Assumption flagged" throughout the document.  
See Section 8.1 for all open clarification questions.