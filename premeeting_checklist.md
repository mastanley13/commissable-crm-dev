2025-11-14 Additional Notes 

User Reassignment Process - Developer Summary ( I thought this would be helpful as a reminder of this functionality as you build out the tables and functionality, Hunter. 

This document outlines the required system behavior when a user is terminated or replaced, necessitating the reassignment of their associated data and responsibilities. The process involves identifying objects linked to the "Previous User" and reassigning them, with specific granular handling for opportunities. 

Status key (as of 2025-11-24):

- [x] Completed in app
- [~] Partially implemented (see notes)
- [ ] Not implemented / planned only

1. Reassignment Trigger & General Object Reassignment 

Status (2025-11-24):

- [~] User reassignment is available only via an account-centric `AccountReassignmentModal`; there is no admin-level, user-centric wizard yet.
- [~] An effective date is captured in the modal, but it is not auto-enforced to the 1st of the month of user removal.
- [~] Identification is limited to Accounts plus an impact preview; Contacts, Groups, Reports, Products, Activities, and Tickets are not auto-listed from a "Previous User" perspective.
- [x] A "Reassign to New User" style action exists on the Accounts list and opens the reassignment modal.
- [~] Non-opportunity entities and open Activities/Tickets are not updated as part of the current bulk reassignment flow.

Trigger: An administrative action initiates the user reassignment process. This will be facilitated by a dedicated form within the admin section. 

Reassignment Date: The effective date for all reassignments and commission changes will be the 1st of the month of the user's removal. 

Identification: The system must provide functionality to filter and display all Accounts, Contacts, Groups, Reports, and Products (and any other relevant entities) where the "Previous User" is either the assigned_user or the creator. 

Action: A "Reassign to New User" button or similar mechanism will be available. 

Selection: The administrator will select a "New House Rep" (the designated successor). 

Update Logic (Non-Opportunities): All identified non-opportunity objects (Accounts, Contacts, Groups, Reports, and Products) will have their assigned_user or creator field updated to the selected "New House Rep". Open Activities and Tickets are also reassigned here (see Section 3). 

2. Opportunity Handling 

Status (2025-11-24):

- [~] Commission split fields exist on Opportunities and Revenue Schedules and are displayed with history, but reassignment logic that applies the described Type A/B/B flows is not wired into UI or APIs.
- [ ] The described behavior for commissioned/closed opportunities and in-flight opportunities (Options A and B) is not implemented end-to-end; only engine utilities and plans exist.
- [ ] No end-to-end flow currently updates future Revenue Schedules to move the Previous User’s commission share to House or a new rep based on an effective date.
- [ ] The "No House Rep" dummy contact does not exist; instead, the system uses special/dummy users via `lib/special-users.ts` and there is no house_rep contact field on Revenue Schedules.

This section details the nuanced handling of Opportunities and their associated Revenue Schedules based on their status at the time of reassignment. 

Definition: A "House Rep" refers to an internal company representative. 

Commission Share Structure: The system manages commission shares (up to 100%) split between the "House," "House Rep," and "Subagent." 

Impact of House Rep/Subagent Removal: If a "House Rep" or "Subagent" is removed, their commission shares for future periods will cease on the 1st of the month of the change. Their respective percentages will be added to the "House's" percentage of the take. For example, if a 50/50 split between House and House Rep exists, and the House Rep is removed on October 5, 2025, then starting October 1, 2025, the House will receive 100% of all commissions going forward for affected opportunities. 

Opportunities with Associated Revenue Schedules (Commissioned/Closed): 

Condition: For opportunities that were already commissioned (closed-won) before the user's reassignment date (1st of the month of removal). 

Future Revenue Schedules Impact: If a house rep is fired/quits/reassigned, and the house takes over management, any future revenue schedules associated with these opportunities will have the "Previous User's" commission portion (100% of their share, minus any sub-agent splits) converted to the "House's Portion”, unless the owner allows the new owner to earn commissions on that deal from the change date forward.  This is based upon the admin selection during the assignment process.   If a Subagent exists, the sub-agent splits will be preserved and managed independently, continuing to be paid to the sub-agents. 

Historical Data: Previously reconciled revenue schedules (those processed and paid out prior to the reassignment date) must remain associated with the "Previous User's" name and commission history. 

Opportunities "In-Flight" (Pipeline/Not Closed) - Granular Reassignment: 

Condition: For opportunities currently in the pipeline (not yet closed/commissioned) at the time of reassignment. The administrative form must allow the admin to review all in-flight opportunities owned by the "Previous User" and choose a reassignment path for each opportunity individually. 

Option A: Reassign to New House Rep: The administrator elects to reassign the entire opportunity to a "New House Rep." This new rep becomes the House Rep of Record for this opportunity and is eligible for their full commission split upon closure. 

Option B: Convert to House Account: The administrator elects to convert the opportunity into a "House Account." In this scenario, the "Previous User's" commission portion (100% of their share, minus any sub-agent splits) will be converted to the "House's Portion" upon closure. This commission conversion is effective the 1st of the month of removal. The "New House Rep" will manage the account/contact, but this specific in-flight deal pays commission to the house. 

"No House Rep" Contact: 

Creation: A new Contact record named "No House Rep" must be created in the system. This contact should be associated with the parent account of the agency utilizing the software. 

Usage: For any future revenue schedules where the commission is converted to the "House's Portion" (as described in Option B above), the house_rep field for these specific revenue schedules should be explicitly designated as this "No House Rep" contact. This "No House Rep" contact will have a 0% share of commissions and serves as a dummy contact for reassigning in-flight records where no individual rep is assigned commission. 

3. Activity and Ticket Handling 

Status (2025-11-24):

- [x] Closed or inactive Activities/Tickets are not altered by current reassignment flows and therefore remain associated with the Previous User as described.
- [ ] Open or pending Activities and Tickets are not automatically reassigned as part of the account-level bulk reassignment; they still require separate per-module bulk owner tools.

Closed or Inactive Items: 

Activities and Tickets created by the "Previous User" that are already closed or marked as inactive will remain associated with the "Previous User." Their creator or signature field will not be altered. 

Open or Pending Items: 

Activities and Tickets created by the "Previous User" that are currently open or pending will be reassigned to the "New House Rep" as part of the general reassignment. This ensures continuity for ongoing tasks. 

4. User Interface Considerations 

Status (2025-11-24):

- [ ] There is no dedicated admin "House Rep Replacement" form that starts from a Previous User and walks through all affected entities; current flows begin from selected Accounts instead.
- [ ] Module-specific UI to show "House Rep replaced" history per Account/Opportunity/Contact does not exist; status is visible only through generic History/Audit tabs.
- [~] Multi-schedule rate-editing UX exists in `RevenueScheduleCreateModal`, but there is no global vendor+product passthrough workflow or automation that distinguishes "existing and billing" vs "new" schedules by date.
- [ ] Products-module UI for changing global passthrough rates across multiple products from a vendor is not implemented and remains explicitly future scope.

House Rep Replacement Form: A dedicated form in the admin section is required to initiate the reassignment process, allowing the administrator to: 

Select the previous user and the effective reassignment date (automatically set to the 1st of the month). 

Select the New House Rep (for general reassignment of Accounts/Contacts/Activities). 

Review the list of in-flight Opportunities and apply Option A (New Rep) or Option B (House Account) to each one individually. 

Module-Specific House Rep Display: Consider adding a tab or section within each relevant module (e.g., Accounts, Opportunities, Contacts) to clearly display when a House Rep has been replaced and who the current House Rep for that specific record is. 

Changing the global passthrough rate % for a single vendor’s products from a specified date 

Calculate raw (distributor level) x passthrough rate % (for the agency) =  expected Commission rate %.  Raw commission rates on products from each vendor are negotiated for the distributor, who then takes a cut and passes-through based upon an agreed upon percentage, usually 80% or 90% for a specific vendor to the Agency.  Sometimes, this passthrough rate can be negotiated for an entire book (all vendors) or for specific vendors several years after a baseline is set by the two parties, and while current deals are in flight.  To remedy, we can discuss a way to find these raw numbers on Distribution or Direct commissions reports, multiply by the stated Agency rate %, and calculate the Agency Expected Commission rate %.  For multiple schedules, we need an easier method.  A user can select an existing product, see the revenue schedules related to that product listed below, then select one or more schedules via checkbox, select the new effective date to change the rate %, and then enter the new rate %, then save.  When saved, the system changes the expected commission rate % for said schedule(s) and saved, the result is all product revenue schedules in that opportunity will reflect the new commission rate.  This new calculation allows us to then augment the passthrough rate % with some type of programmatic function, so that after a certain date: 

All existing and billing Revenue schedules will be paid at the new % rate 

and/or All new Revenue schedules sold after a date will be paid at that new rate.   

 

Products Module  

Discuss a future option to change the global passthrough rate % for multiple products from a given vendor.  This is the “raw” rate that vendors pay to Distributors to carry their products and promote them to Agencies like ours.  For example, a raw rate might be 20% for a product, and the “passthrough” rate at 90% for the Agency means that we’ll be paid 18% (20% x .90) on any deal.  When this rate changes, we can change the products themselves in the product catalog for future sales, but we may have the opportunity to get paid a higher amount on all existing sales of that product, so we could adjust these revenue schedules from a certain date forward.  The difficulty here is that this data may not be available.  We could work it out by reversing the calculation, take the passthrough percentage and divide it by our passthrough rate? 

 

This summary provides a clear roadmap for implementing the granular, two-step user reassignment logic within the software. 

 

2025-11-10  Notes 

Development Feedback Notes: Products & Revenue Schedules (2025-11-10) 

These notes cover functional and UI/UX updates for Product Management (both in Opportunities and the main Navigation menu) and Revenue Schedule Management (both in Opportunities and the main Navigation menu). 

Shape 

🎨 General UI/Formatting Corrections 

These corrections apply system-wide for all databases and pages where the relevant fields appear. 

Financial Formatting: 

Price Each formatting should be consistently rendered as $XX.XX. 

Commission % formatting should be consistently rendered as XX.XX%. 

Date Formatting: Dates must adhere to the requested YYYY-MM-DD format. Please correct all instances where the format is incorrectly displayed as "YYYY/MM/DD". 

Placeholder Text Casing: All placeholder text in data entry fields should use Proper Case. For example, "Select distributor" should be updated to "Select Distributor." Please review all forms and fields to ensure consistency. 

Whitespace: Increase the vertical whitespace between the bottom section tabs (Distributor and Vendor) and the top field, "Distributor – Product Name," on the Product Detail Page (accessed through the main Products Navigation menu). 

Recalculation Logic: Crucial Note: Throughout the application, when a key value is modified (e.g., price, quantity, percentage, splits), all dependent fields must recalculate upon saving. For instance, changing the expected commission rate for a product must trigger an immediate recalculation of the house, house rep, and subagent splits based on the new rate. 

Shape 

⚙️ Product Management from Navigation Menu (Now referred to as “Catalog” on the Navigation Menu) 

These apply to the Products (Catalog) Module accessed via the main Navigation menu.   

1. Product Detail Page & "Create New" Form Layout  

For consistency, the field order and layout on the Product Detail Page and the "Create New" product popup form (accessible from the main list page) should be adjusted as follows: 

Left Column (Top Section): Product Name – House, Part Number – House, Distributor Name, Vendor Name, Product Family – House, Product Subtype - House. 

Right Column (Top Section): Price Each, Commission %, Revenue Type, Status. 

Bottom Field: House – Description. 

Bottom Section: Maintain the remaining two columns, left for Vendor fields and right for Distributor fields. 

2. Access/Security 

Product Editing: Once a product is created, its details should be editable by Admins only. 

3. Product Revenue Types 

The options for the Revenue Type field should be: 

NRC – Quantity (Example, we receive a $50 one-time bonus for every phone we sign up for service.  $50 * 5 phones = $250 bonus.  This simply is taken as revenue on a single month schedule, but reporting picks up the revenue type so as not to mix with MRC revenues, which are recurring. 

NRC - % (Example, we receive 200% of the monthly billing amount up front as a non-recurring bonus.  $200 * 200% = $400 bonus. This simply is taken as revenue on a single month schedule, but reporting picks up the revenue type so as not to mix with MRC revenues, which are recurring. 

NRC – Flat Fee – Where we receive a flat amount for any reason (Example – We receive a $100 gift card)  This simply is taken as revenue on a single month schedule, but reporting picks up the revenue type so as not to mix with MRC revenues, which are recurring.  

MRC – 3rd Party (Example, we help the client contract with AT&T for fiber for 60 months.  AT&T bills them, but we track it under 3rd party and receive the commission only. We use the normal formulas and reporting) 

MRC – House – Billed by the User.  (Example, our in house reps bill a 12 month consulting engagement for $100 a month.  This is revenue we collect ($100x 12, but we also calculate our commissions (Actual Gross Usage less any payments to Subagent , House Rep or incidental costs.  We use the same formula for this calculation, but reporting is just on “MRC – House”.   

NRC – Resale – From buying/selling products & services.  (Example, we sell a PC at $200 and we pay $100 for the cost of goods sold.  Non-Recurring Profit = $100.  We use a unique formula for this) 

4. Mass Product Commission Rate Adjustment within the Catalog Master Record 

We need a more granular way to change the expected commission rate for multiple products from a given vendor: 

Implement a button (e.g., "Adjust Commission Rates" and “Apply to All” (if multiple products are selected) where any change made on the first product is applied to others of the same product on the main list page.   

The user leverages the filtering tools (by Distributor, Vendor, etc.) and then select the products to change, makes the changes, and selects “Apply to All” All products added to an opportunity from that effective date forward must reflect the new rate. An audit record of this change should be created and show in a new “History” tab.  The user changes logged into History, recording the previous value, the new value changed, username and date/time of the change.   

5. Product(s) Inactivation/Deletion 

Mass Inactivation: Allow users to filter and then select a group of products from the main list page to make them Inactive.  Once inactive, they do not appear on the main page unless the user selects to view ALL or Inactive products only from the drop-down menu. 

Deletion Logic: Any product that has a related revenue schedule (past or future) cannot be deleted, only made Inactive. Products without any associated schedules can be deleted.  This change is logged into History. 

Shape 

🛍️ Product Management within an Opportunity 

These instructions apply to the Product tab inside an Opportunity record. 

Cloning Behavior: Products added to an Opportunity are created as unique clones of the master record from the Product Catalog. 

Data Integrity: Changes made to a product within the Opportunity are applied only to that specific clone and will not affect the original base product in the Product Catalog. 

2. Product Tab Management Tools 

The Product tab requires an "Add/Create Product" button that opens a popup with two distinct header options: "Add Product from Catalog" and "Create New Product." 

Add Product from Catalog (Lookup): 

Allows users to look up existing products using filters: Distributor Name, Vendor Name, Product Family – House, and Product Subtype – House. 

When an item is selected, the right side should default the following fields: Quantity (1), Price (from price book), Expected Commission % (default), Expected Commission Start Date (first of current month), and Number of Periods (1).  User can change these values to override prior to submission and schedule creation. 

Create New Product: 

The form/popup should use the exact same layout/field order as the updated "Create New" product popup in the main Products Module (see Section 1). 

Ensure all necessary fields are present, including the House - Description field and the full set of Product Revenue Type entries listed above. 

Note: Rob will provide the final field list for this form via an Excel sheet. 

Left Column 

03.04.110 

Left Column 

03.04.111 

Left Column 

03.04.112 

Left Column 

03.04.113 

Left Column 

03.04.114 

Left Column 

03.04.115 

Right Column 

03.04.116 

Right Column 

03.04.117 

Right Column 

03.04.118 

Right Column 

03.04.119 

Right Column 

03.04.120 

 

Dynamic Column: Add the field "Product Billing Status" to the dynamic column display on the Product tab (in an Opportunity) and the Catalog Main List Page 

Shape 

💵 Revenue Schedule Management from Navigation Menu 

These apply to the Managing Revenue Schedule module accessed via the main Navigation menu. 

1. Main List Page Layout 

Filter Wrapping: Ensure the "Apply Filters" button/section does not wrap when the user narrows the screen width. 

Redundant Field Removal: Remove the "Show In Dispute Only" checkbox, as its functionality is redundant with the existing "In Dispute" toggle. 

Status Filter: Consolidate "All," "Open," "Reconciled," "Unreconciled," and "In Dispute" into a single dropdown field for cleaner filtering. 

Action Button: "Manage" Revenue Schedule: 

Implement a "Manage" button that appears when one or more schedules are selected. 

This button presents a Popup Form with controls for bulk management. The size and placement of this popup must be consistent with other similar forms in the application. 

The management actions should include: 

Make Inactive/Delete buttons for selected schedules. 

Editing of Quantity, Price Per, and Expected Commission Rate % for multiple schedules simultaneously (Admin only). The user should not have to select each schedule individually. 

2. Revenue Schedule Detail Template Page 

The tabbed layout needs refinement for greater consistency across the application. 

Look and Feel Consistency: 

Add a separator line below the data blocks, similar to the line above "Schedule Summary." 

Ensure that the data entry areas for each field have underlined text for a consistent look/feel (matching other sections of the app). 

Financial Summary Tab: 

Move the "Receivables" section (currently on the right) to be displayed under the "Reconciled" section on the left. 

Use the "Reconciled Deposits" area as visual spacing. 

Add a separator line under the three Commission Split tabs. 

Consider adding a light blue background color to the middle Commission Split section for visual contrast. 

Opportunity Details Tab: Move the fields from the second column to display under the fields of the first column. No extra spacing is required between the original Column 1 and Column 2 fields. 

Product Details Tab: 

Move the dummy placeholder data: Display the second column's data entries under the first column's entries. 

The system should automatically start a second (and third, etc.) column as non-zero values are added via product matching during reconciliation. 

We need a defined rule for how the system handles the layout (e.g., number of items per column) for new fields added upon metadata inclusion during reconciliation. Please propose a layout logic. 

Future Discussion Tabs: Formatting for the following tabs will be discussed at a later date: Reconciled Deposits, Payments Made, Activities and Notes. 

Shape 

📈 Revenue Schedule Management within an Opportunity 

These apply to the Revenue Schedule tab inside an Opportunity record. 

Bulk Schedule Editing (Admin): Users need an easier method to change the commission rate percentage for multiple schedules: 

The user can select an existing product, view its related revenue schedules, then use a checkbox to select one or more schedules. 

The user then enters a new effective date and the new rate %. 

Upon saving, the system must update the expected commission rate % for all selected schedules from the specified effective date forward. 

Bulk Editable Fields: The following fields must be editable for single or multiple selected schedules from a given date forward: Quantity, Price Per, Expected Usage Adjustment, Expected Commission Rate %, and Expected Commission Adjustment. 

Commission Split Visibility: 

The commission split percentages are currently listed on the Opportunity Detail screen. Since the split percentage can change over time, perhaps this should be relocated or augmented with a History tab. 

In the current location, can we shrink the percentage display (e.g., XX.XX%) and add a label stating the "Last Edit Date/By" with the user name and date/time ? The change must be logged in the history tab as well. 

Other Functions in the Revenue Schedule Tab 

Clone Schedule: Allow users to select an existing schedule and use a "Clone" button to create an additional copy with a unique Revenue Schedule Name (autocreated). The user must validate all data and the schedule date. 

Add Existing Product & Schedules: Ability to add an existing product and generate its new schedules within the opportunity. 

Create New Product & Schedules: Ability to create a new product and generate available schedules within the opportunity. 

Auto-Create Schedule: The system should automatically create a new schedule (and Revenue Schedule autogenerated name) on the first of the subsequent month if the Product Billing status is still "billing" but the available schedules for the previous month have been exhausted. 

Inactivate Schedule: User ability to make a schedule(s) Inactive. 

Delete Schedule(s): User ability to Delete schedule(s).  Schedule cannot be deleted if any monies (usage or commission) are applied. 

Create Ticket/In Dispute (Future Phase): Option to Create Ticket, which will automatically mark the selected schedule(s) as "In Dispute." 

END OF DAY’S COMMENTS  2025-11-10 

 
