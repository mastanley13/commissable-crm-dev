Here’s a consolidated breakdown of the **column headers for every list/table UI** specified across the docs. I grouped them by module and screen/tab so you can wire them straight into your table components.

---

# Global / Cross-cutting

* **Dynamic Column Selector is present on all data tables** (gear icon); columns per-table are below, but note users can add/remove/reorder and widths persist. 

---

# Accounts module

## Accounts → Account List (default columns)

* Active
* Action
* Account Name
* Account Legal Name
* Account Type
* Account Owner
* Shipping Street
* Shipping Street 2
* Shipping City
* Shipping State
* Shipping Zip 

> (Same set is also documented in v1.0.) 

## Account Detail → Contacts tab (default columns)

* Actions
* Active
* Suffix
* Full Name
* Job Title
* Contact Type
* Email Address
* Work Phone
* Extension
* Mobile 

## Account Detail → Opportunities tab (default columns)

* Actions
* Active
* Estimated Close Date
* Order ID - House
* Opportunity Name
* Opportunity Stage
* Referred By
* Owner 

## Account Detail → Groups tab (default columns)

* Actions
* Active
* Group Name
* Public/Private
* Group Description
* Group Owner 

## Account Detail → Activities & Notes tab (default columns)

* Actions
* Active
* Activity Date
* Activity Type
* Activity Description
* Account Name
* Attachment
* File Name 

---

# Contacts module

## Contacts → Contact List (default columns)

* Active
* Action
* Suffix
* Full Name
* Extension
* Work Phone
* Contact Type
* Email Address
* Job Title
* Mobile 

> (Same list is also captured in the v1.0 spec.) 

## Contact Detail → Activities & Notes tab (default columns)

* Actions
* Active
* Activity Date
* Activity Type
* Activity Description
* Account Name
* Attachment
* File Name
  (plus hidden/available: Activity ID, Activity Owner, Activity Status, Created/Modified metadata) 

## Contact Detail → Opportunities tab (default columns)

* Close Date
* Opportunity Name
* Opportunity Stage
* Order ID - House
* Owner
* Subagent
* Account ID - Vendor
* Customer ID - Vendor
* Location ID
* Order ID - Vendor 

## Contact Detail → Groups tab (default columns)

* Actions
* Active (Y/N)
* Group Name
* Group Description
* Group Owner
* Public/Private 

---

# Activities & Notes module (universal tab used in multiple places)

## Activities & Notes → List (default columns)

* Actions
* Active
* Activity Date
* Activity Type
* Activity Description
* Account Name
* Attachment
* File Name

**Hidden/Available via Dynamic Columns:**

* Activity ID
* Activity Owner
* Activity Status
* Created By
* Created Date
* Modified By
* Modified Date 

---

# Groups module

## Groups → Group List (default columns)

* Actions
* Active
* Group Name
* Type
* Public/Private
* Group Description
* Group Owner
* Member Count
* Created Date
* Modified Date 

## Group Detail → Members list (expected columns)

* Actions
* Member Type
* Name
* Type
* Owner
* Date Added
* Added By 

## Contact Detail → Groups tab (columns)

* Active (Y/N)
* Group Name
* Group Description
* Group Owner
* Public/Private 

---

# Commission / Reassignment (queues & dashboards with tabular columns)

## Commission → Reassignment Queue table (columns)

* Priority
* Status
* Account
* Opportunity
* Current Rep
* New Rep
* Type
* Term Date
* Value
* Actions 

> Access points and wizard steps are also defined; the above is the explicit queue table column set. 

---

# Extra: Field tables referenced for reassignment (for your schemas)

While not UI lists, the reassignment specs enumerate **opportunity-level** and **contact-level** fields you’ll likely map to columns if you expose admin grids:

* Opportunity-level: Commission_End_Date, Reassignment_Type, Reassignment_Date, New_House_Rep, New_Commission_Split, Reassignment_Reason, Commission_Status. 
* Contact-level: Commission_Eligible, Commission_End_Date, Reassignment_Status, Active_Opportunity_Count. 

---

If you want, I can turn this into a **single JSON config** per table (id, defaultColumns, hiddenColumns), or a **TypeScript enum + zod schema** bundle for your table layer.
