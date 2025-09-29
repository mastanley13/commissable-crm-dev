**Accounts and Contacts Modules**

**Executive Summary** 

The **Commissable CRM** is a desktop-only web application designed to be a central hub for managing business entities (Accounts) and individuals (Contacts). The system emphasizes efficiency and data integrity through a set of universal features and critical business rules.

**Key Takeaways:**

* **User-Centric Design:** The CRM's interface is highly customizable and remembers a user's preferences, including column order, filters, and sorting, across sessions. The **Dynamic Column System** is a universal feature that allows users to add, remove, and reorder fields on any data table.

* **Data Integrity & Security:** To prevent data loss, the system uses a **Two-Stage Deletion Process** (soft delete followed by an optional hard delete). The platform enforces strict rules to protect data, such as requiring that **Contact Type** always inherits from the **Account Type**.

* **Intuitive Navigation:** Key records like accounts and contacts are instantly navigable via **hyperlinked text**. The system uses **Breadcrumb Navigation** to help users track their location within the application.

* **Core Module Functionality:** The **Accounts Module** manages all business relationships. It features a **Tabbed Navigation Interface** on the Account Detail Page, where each tab (Contacts, Opportunities, Groups, Activities & Notes) operates as an independent workspace with its own controls.

* **Advanced Workflows:** A key feature for managers is the **Global Representative Reassignment** process. This manager-only tool allows for the bulk transfer of accounts, contacts, and open opportunities from a departing representative to a new one, based on three distinct commission reallocation strategies (Type A, B, or C).

---

**Developer's Guide**

This guide provides a technical overview of the CRM's architecture and rules for developers. The system is a desktop-only web application with a minimum resolution requirement of 1920x1080.

**1\. Universal UI & Data Management**

* **UI Persistence:** User settings for **column order**, widths, applied filters, and sorting are persisted across sessions via a backend mechanism.

* **Dynamic Column System:** A single, universal component accessed by a gear icon (⚙️) controls the field selection on all data tables. This includes tables on detail page tabs and the main list pages. The component allows for programmatic addition, removal, and reordering of columns.

* **Data Deletion:** The system's **Two-Stage Deletion** process consists of a soft delete (Inactivate) and a hard delete. Clicking the delete icon on an active record sets its status to inactive, preserving all historical data and relationships. A second delete action on an inactive record permanently removes it.

* **Filtering:** Filters on any list page or tab apply an AND condition when multiple filters are active.

**2\. Module-Specific Rules & Logic**

* **Accounts Module:**

  * **Account Creation:** The system validates required fields (marked with \*). Upon creation, it auto-generates a unique Order ID \- House. The Employee Count field on the Account Detail page is a **read-only, auto-calculated metric** based on the real-time count of active contacts linked to the account.

  * **Contacts Tab:** The **Contact Type** field is a critical rule. It **always inherits** from the parent Account's type and is **read-only** on the contact creation form when accessed from the Account Detail page.

* **Opportunities Module:**

  * **Stages:** Opportunities progress through **nine sequential stages**. The system enforces a rule that prevents skipping stages in the normal progression, with exceptions for moving to On Hold or Lost.

  * **Commission Validation:** The sum of the House Rep %, Subagent %, and House Split % must **equal exactly 100%**. The House Split % is a calculated field, and the entire structure is locked after the initial save.

* **Activities & Notes Tab:**

  * **Auto-Linking:** Any activity record created from an Account or Contact detail page is **automatically linked to that parent record's ID**. This is a critical rule for maintaining communication history.

**3\. Manager-Level Workflows (Level 3\)**

The **Global Representative Reassignment** workflow is a powerful tool for managers.

* **Initiation:** The process is triggered from the Account List via a bulk action.

* **Transferred Data:** The workflow moves Account ownership, active Contacts, Open Activities and Tasks, Active Group memberships, and Open Opportunities (future ownership/commission schedules).

* **Protected Data:** Closed Opportunities and Historical commission records are protected and remain with the original owner for audit purposes.

* **Commission Strategies:** The transfer requires a selection from three defined strategies: Type A (House Absorption), Type B (Direct Transfer), or Type C (Custom Redistribution).

