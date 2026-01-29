---

# **Commissable CRM — Master Dev Plan (Meetings Jan 21, 22, 26, 2026\)**

**Purpose:** This is the master, implementation-ready backlog \+ sprint plan covering *only* the updates/changes discussed in the **Jan 21, Jan 22, and Jan 26** meetings.

---

## **Source docs (for traceability)**

* Jan 21 meeting summary \+ transcript  
* Jan 22 meeting summary \+ transcript  
* Jan 26 meeting summary \+ transcript

---

## **How to use this file**

* **P0 / P1 / P2** indicate recommended priority *for a single sprint dev push*.  
* Each item includes:  
  * **Client Impact**: High / Med / Low  
  * **Effort**: Easy / Medium / Hard  
  * **Time**: rough engineering estimate (ranges)  
  * **Dependencies**  
  * **Acceptance Criteria** (implementation-ready)

**NOTE:** Where meeting notes do not fully define a behavior (e.g., exact status picklist values), it’s marked **ASSUMED** and explains why.

---

## **Sprint Goal (recommended)**

**Unblock reconciliation matching \+ improve usability of deposit/reconciliation workflows**, so Rob can run realistic end-to-end tests (upload → map → match → verify → reconcile) without “Unknown Account” and without missing schedule candidates.

This aligns with:

* Jan 22: “Matching logic is top priority” and match-type workflows (1:1, 1:M, M:1) drive the reconciliation process  
* Jan 26: AI matching currently not suggesting schedules due to mapping \+ missing schedules; plus UI enhancements \+ deposit verification requested  
* Jan 21: deposit mapping UI updates \+ reconciliation usability fixes (multi-select, default view, etc.)

---

## **Effort / time sizing scale (for this plan)**

* **Easy**: 1–6 hours (mostly UI \+ small backend changes)  
* **Medium**: 1–3 days (multi-step UI \+ backend \+ tests)  
* **Hard**: 3–7+ days (new workflow logic, edge cases, major parsing)

---

## **Recommended sprint execution order**

### **Day 0 (setup / sanity)**

1. **Create a repeatable “smoke” dataset**: opportunities \+ schedules \+ deposit uploads so each change can be validated quickly (this is explicitly called out as a testing action item).  
2. Confirm current reconciliation UI issues (scrollbar, auto-select line, broken links) and capture before/after screenshots for Rob.

### **Day 1–2 (P0: unblock matching \+ core UX)**

* Fix Account Legal Name mapping gap (prevents “Unknown Account”).  
* Create missing test schedules (e.g., VoIP) so AI suggestions can actually appear.  
* Fix core reconciliation UI issues (filters, multi-select, default view, link, scrollbar, commission rate display).

### **Day 3–4 (P0: deposit verification \+ ticket metadata)**

* Add deposit verification fields and required relabels.  
* Add ticket fields and relabels.

### **Day 5+ (P1/P2: bigger workflows)**

* Change Start Date tool  
* Match-type validation \+ Flex wizard  
* Chargeback manager approval, collections workflow  
* Multi-vendor uploads \+ migration scaffolding

---

# **MASTER BACKLOG (prioritized)**

## **P0 — Must ship (highest impact \+ unblocks end-to-end reconciliation)**

### **P0-REC-001 — Add Account Legal Name as a deposit mapping option (fix “Unknown Account”)**

* **Client Impact:** High (unblocks AI matching and correct account attribution)  
* **Effort:** Easy–Medium  
* **Time:** \~0.5–1.5 days  
* **Source:** Jan 26 AI matching root cause \+ fix  
* **Dependencies:** Deposit upload mapping UI already supports adding mapping options.  
* **Implementation notes (practical):**  
  1. Add “Account Legal Name” to selectable mapping fields.  
  2. Ensure importer writes this field onto deposit line (or an intermediate normalized object) such that matching can use it.  
  3. Ensure matching pipeline uses Account Legal Name to find candidate schedules (at least as a strong/primary filter when present).  
* **Acceptance Criteria:**  
  1. Deposit mapping dropdown includes “Account Legal Name”.  
  2. Uploading a deposit file with Account Legal Name mapped results in deposit line items tied to the correct account (not “Unknown Account”) when the name exists in the system.  
  3. AI matching suggestions can run without failing due to missing account attribution (i.e., “Match” no longer returns empty purely due to missing Account Legal Name mapping).

---

### **P0-REC-002 — Create missing test revenue schedules (e.g., VoIP) to validate AI matching**

* **Client Impact:** High (prevents “no candidates exist” false negatives)  
* **Effort:** Easy  
* **Time:** \~1–3 hours  
* **Source:** Jan 26 AI matching root cause: missing schedules for products like VoIP  
* **Dependencies:** Access to test environment \+ ability to create schedules.  
* **Acceptance Criteria:**  
  1. For each deposit product line in the sample dataset, there is at least one corresponding revenue schedule.  
  2. Running “Match” on a deposit line with known corresponding schedules produces at least one candidate suggestion.

---

### **P0-UI-001 — Fix commission rate display/calculation issue in reconciliation grid**

* **Client Impact:** High (financial accuracy \+ user trust)  
* **Effort:** Easy  
* **Time:** \~2–6 hours  
* **Source:** Jan 26 next steps \+ action item  
* **Acceptance Criteria:**  
  1. Commission rate shown in the reconciliation UI matches the expected commission rate for the revenue schedule (or derived per business logic).  
  2. Values render consistently across rows with no truncation/wrapping that obscures meaning.  
  3. A regression test (manual acceptable) demonstrates the corrected commission rate on known sample data.

---

### **P0-UI-002 — Fix column wrapping \+ allow tighter columns for reconciliation usability**

* **Client Impact:** Medium–High (improves speed \+ reduces errors)  
* **Effort:** Easy  
* **Time:** \~2–6 hours  
* **Source:** Jan 26 next steps (“Fix column wrapping”) and discussion  
* **Acceptance Criteria:**  
  1. Key “usage/commission” columns no longer wrap in a way that makes scanning difficult.  
  2. Columns can be resized/tightened to a reasonable width without breaking header/body alignment.

---

### **P0-UI-003 — Ensure bottom revenue schedule grid filters dynamically based on selected status / context in top deposit grid**

* **Client Impact:** High (core reconciliation flow speed)  
* **Effort:** Medium  
* **Time:** \~0.5–2 days  
* **Source:** Jan 26 dynamic filtering requirement  
* **Dependencies:** Current filtering/state management between the two grids.  
* **Acceptance Criteria:**  
  1. When a user clicks a status segment in the top deposit grid (e.g., “Unmatched”), the bottom grid auto-filters to the corresponding schedules.  
  2. Changing the top filter always refreshes the bottom filter state without requiring a manual refresh.  
  3. Filtering works alongside vendor/account filters (i.e., combined filters don’t break).

---

### **P0-UI-004 — Enable multi-select on reconciliation page**

* **Client Impact:** High (required for 1:M and M:1 matching workflows)  
* **Effort:** Medium  
* **Time:** \~1–2 days  
* **Source:** Jan 21 action item and Jan 22 match-type workflows  
* **Dependencies:** None, but must interoperate with match validation script (P1-MATCH-001).  
* **Acceptance Criteria:**  
  1. User can select multiple deposit lines and/or multiple revenue schedules (depending on current UX design).  
  2. UI clearly indicates multi-selection state (checkboxes \+ selection count).  
  3. No silent auto-deselection occurs when scrolling or filtering (unless explicitly designed).

---

### **P0-UI-005 — Set reconciliation default view to Unmatched and remove “Suggested” tab**

* **Client Impact:** Medium–High (reduces confusion and click count)  
* **Effort:** Easy  
* **Time:** \~1–4 hours  
* **Source:** Jan 21 action item  
* **Acceptance Criteria:**  
  1. On opening reconciliation, the top grid shows Unmatched items by default.  
  2. “Suggested” tab is removed (or hidden) as agreed.  
  3. No regression: users can still access suggestions via the intended “Match” workflow.

---

### **P0-UI-006 — Disable auto-selection of the first deposit line item**

* **Client Impact:** Medium (prevents accidental matches/filters)  
* **Effort:** Easy  
* **Time:** \~1–2 hours  
* **Source:** Jan 21 action item  
* **Acceptance Criteria:**  
  1. On load, no deposit line is selected by default.  
  2. Bottom grid shows neutral state until user selects a line (or uses filters).

---

### **P0-NAV-001 — Fix “Go to revenue schedule” link**

* **Client Impact:** Medium (navigation unblocker)  
* **Effort:** Easy  
* **Time:** \~1–3 hours  
* **Source:** Jan 21 action item  
* **Acceptance Criteria:**  
  1. Clicking “Go to revenue schedule” reliably navigates to the intended schedule detail view.  
  2. Link works from all relevant contexts (deposit line, reconciliation grid, etc.).

---

### **P0-UI-007 — Fix reconciliation summary scrollbar**

* **Client Impact:** Low–Medium (usability)  
* **Effort:** Easy  
* **Time:** \~1–2 hours  
* **Source:** Jan 21 action item  
* **Acceptance Criteria:**  
  1. Summary panel scroll behaves correctly (no double scrollbars / cut off totals).  
  2. Works on common viewport sizes (laptop 1366×768 and larger).

---

### **P0-DEP-001 — Add Deposit Verification workflow fields \+ relabel “Date” → “Report Date”**

* **Client Impact:** High (prevents reconciliation gaps between vendor report and actual cash)  
* **Effort:** Easy–Medium  
* **Time:** \~0.5–1.5 days  
* **Source:** Jan 26 deposit verification requirement and action items  
* **Requirements:**  
  1. Add 3 fields to **deposit detail page**:  
     * Payment Received Date (date)  
     * Actual Confirmed Deposit Amount (currency)  
     * Received By (dropdown of admin/banking contacts)  
  2. Relabel existing “Date” field → **Report Date**  
  3. Shrink existing text areas to make room for fields  
* **Dependencies:** Need list source for “Received By” dropdown (**ASSUMED**: pull from admin/banking contacts already represented as contacts/users).  
* **Acceptance Criteria:**  
  1. Deposit detail page contains the three new fields with correct data types.  
  2. Existing Date label reads “Report Date”.  
  3. Fields persist to backend and re-load correctly.  
  4. User can leave verification fields blank (unless you decide they should be required—**ASSUMED optional** because meeting says “manual verification” but not “required”).  
  5. UI layout remains usable (no overlap, no clipped labels).

---

### **P0-DEP-002 — Add ticket fields \+ relabels (Vendor Ticket ID, Vendor Contact, Created By; “Ticket ID” → House Ticket Number)**

* **Client Impact:** Medium–High (supports tracking disputes and auditability)  
* **Effort:** Easy–Medium  
* **Time:** \~0.5–1.5 days  
* **Source:** Jan 26 next steps \+ action items  
* **Requirements:**  
  1. New fields:  
     * Vendor Ticket ID  
     * Vendor Contact (lookup)  
     * Created By  
  2. Relabels:  
     * Ticket ID → House Ticket Number  
     * Owner → Created By  
* **Dependencies:** “Vendor Contact lookup” requires an existing contact lookup component.  
* **Acceptance Criteria:**  
  1. Fields exist on the relevant record(s) (deposit? ticket? dispute record — **ASSUMED deposit detail context**, since Jan 26 notes are under deposit/reconciliation workflow).  
  2. Vendor Contact field can search and select an existing contact.  
  3. Relabeled fields show updated labels everywhere (list view, detail view, exports if applicable).

---

### **P0-MAP-001 — Deposit upload mapping UI updates (table height/layout \+ “Suggested Match” \+ prevent duplicate maps)**

* **Client Impact:** High (deposit uploads are frequent and drive reconciliation)  
* **Effort:** Medium  
* **Time:** \~1–3 days  
* **Source:** Jan 21 action items \+ next steps for UI changes  
* **Requirements (from meeting):**  
  1. Increase mapping table height  
  2. Add **Suggested Match** column  
  3. Enforce **no duplicate maps** (a system field cannot be mapped twice)  
  4. Update column layout  
* **Acceptance Criteria:**  
  1. Mapping table displays more rows without scrolling excessively.  
  2. “Suggested Match” column appears and shows system suggestions (even if simple v1 heuristic—**ASSUMED**; meeting doesn’t define suggestion algorithm).  
  3. UI prevents selecting the same target field twice; shows clear validation message.  
  4. Mapping still saves and applies correctly on subsequent uploads.

---

### **P0-MAP-002 — Restyle mapping review (Mapped/Unmapped tabs; remove sample rows; 3-column layout; row count)**

* **Client Impact:** Medium (improves mapping confidence and speed)  
* **Effort:** Medium  
* **Time:** \~1–2 days  
* **Source:** Jan 21 action item  
* **Acceptance Criteria:**  
  1. Review UI has two tabs: **Mapped** and **Unmapped**.  
  2. Sample rows are removed (or hidden by default).  
  3. Layout uses a clearer 3-column layout (as described).  
  4. Row count is visible per tab.

---

### **P0-MAP-003 — Merge “Review” step into the main field mapping page**

* **Client Impact:** Medium (simplifies workflow)  
* **Effort:** Medium  
* **Time:** \~0.5–2 days  
* **Source:** Jan 21 “StrategixAI” next steps  
* **Acceptance Criteria:**  
  1. Upload → mapping flow no longer requires a separate dedicated “Review” step/page.  
  2. User can see mapped/unmapped status and proceed/confirm on the same mapping page.  
  3. No regression: user can still back out/cancel mapping without corrupting template state (**ASSUMED** best practice).

---

## **P1 — Should ship (high value; may be larger / needs more integration)**

### **P1-REV-001 — “Change Start Date” tool for revenue schedules (single product, bulk shift, mandatory reason)**

* **Client Impact:** High (critical for real-world billing delays and credits)  
* **Effort:** Medium  
* **Time:** \~1–3 days  
* **Source:** Jan 22 revenue schedule management \+ requirements and transcript detail about tab/UI  
* **Requirements:**  
  1. Add a **Change Start Date** tab/tool on revenue schedule management.  
  2. Must apply to **only one product at a time**.  
  3. Must require a **mandatory reason** logged in history/audit.  
  4. Bulk shift *future schedules* forward/back by month.  
* **ASSUMED details (because meeting doesn’t fully specify):**  
  1. The “reason” is stored as a text note in an audit trail table and shown in UI.  
  2. Only schedules **on/after a selected “from” date** are shifted (meeting implies “March on” example).  
* **Acceptance Criteria:**  
  1. Tool is accessible from a single-product context.  
  2. User selects a new start date and system previews affected schedule dates before applying.  
  3. System shifts the relevant schedule dates correctly (month-to-month progression preserved).  
  4. Mandatory reason is required and is stored and viewable in history.  
  5. Attempting to use the tool with multiple products selected is blocked with an error message.

---

### **P1-MATCH-001 — Implement match-type validation on “Match” (detect 1:1, 1:M, M:1 → trigger workflows)**

* **Client Impact:** High (core reconciliation automation)  
* **Effort:** Hard  
* **Time:** \~3–7 days  
* **Source:** Jan 22 matching logic \+ trigger on Match button  
* **Dependencies:** P0-UI-004 multi-select (recommended), candidate retrieval logic.  
* **Implementation notes:**  
  1. On Match click: run validation script to determine selected counts and candidate relationships.  
  2. Route to the appropriate workflow: 1:1 direct match; 1:M or M:1 opens guided “wizard” flow.  
  3. Capture user’s decisions/actions so “system will learn from user actions” (log mapping decisions / match decisions).  
* **Acceptance Criteria:**  
  1. With one deposit line \+ one schedule selected, system treats it as 1:1 and proceeds directly.  
  2. With one deposit line \+ multiple schedules selected, system identifies 1:M and routes to the appropriate flow.  
  3. With multiple deposit lines \+ one schedule selected, system identifies M:1 and routes to the appropriate flow.  
  4. For each case, the UI clearly tells the user what match type was detected and what steps are next.  
  5. The system logs match-type and user action outcomes for reuse (at minimum: store in an audit log table). (**ASSUMED** logging implementation.)

---

### **P1-FLEX-001 — Flex product workflow completion: create, convert, and resolution pop-up (one-time vs recurring)**

* **Client Impact:** High (handles deposits for products not in catalog)  
* **Effort:** Hard  
* **Time:** \~4–10 days  
* **Source:** Jan 22 Flex workflow gaps \+ conversion requirements  
* **Key requirements:**  
  1. Flex product created as an **opportunity product** tied to opportunity vendor/distributor.  
  2. Converting Flex → real product requires user to provide **Family** and **Subtype** to filter the catalog.  
  3. “Resolution pop-up” prompts **one-time vs recurring**, and creates additional schedules if needed.  
  4. Implement missing “child schedule creation (e.g., 12330.1)”  
* **ASSUMED (needs confirmation from spec doc, but not in these meeting notes):**  
  1. What “12330.1” means precisely: assumed to be a child schedule ID used for split/exception tracking under a parent schedule.  
* **Acceptance Criteria:**  
  1. Creating a Flex product creates a product-like record linked to the opportunity and vendor/distributor.  
  2. Converting to a real product requires Family \+ Subtype input and uses it to filter the catalog list.  
  3. Resolution pop-up supports:  
     * One-time: create exactly one schedule (or reconcile against one schedule)  
     * Recurring: create N schedules based on user input  
  4. Child schedule creation logic exists and is used where appropriate (must be demonstrable via a test scenario).

---

### **P1-CB-001 — Chargebacks: status change \+ manager approval workflow**

* **Client Impact:** High (negative deposits, disputes, and governance)  
* **Effort:** Hard  
* **Time:** \~3–7 days  
* **Source:** Jan 22 chargeback gaps  
* **Requirements:**  
  1. Status needs changing from **“Pending”** to **“In Dispute”**.  
  2. A **Manager Approval** workflow is missing.  
* **ASSUMED:**  
  1. “Manager” maps to a role (e.g., Admin / Sales Management). The meeting does not specify which role(s) can approve.  
* **Acceptance Criteria:**  
  1. Chargeback record/status uses “In Dispute” instead of “Pending”.  
  2. Attempting to finalize/close/resolve a chargeback requires manager approval.  
  3. Approval action is logged with approver identity and timestamp.

---

### **P1-COL-001 — Collections workflow for underpaid accounts**

* **Client Impact:** High (missing payments directly impact revenue)  
* **Effort:** Hard  
* **Time:** \~3–7 days  
* **Source:** Jan 22 “Collections: No workflow exists for underpaid accounts.”  
* **ASSUMED:**  
  1. Collections means: identify schedules with outstanding balances and create a tracking status/queue.  
* **Acceptance Criteria (v1 minimal):**  
  1. User can mark a revenue schedule (or deposit line) as “Underpaid / Collections”.  
  2. System provides a list/filter view to see all “Collections” items.  
  3. Item includes responsible party/owner and notes (even if simple).

---

### **P1-DATA-001 — Comma-separated values for “Other Account ID” (no spaces; normalization)**

* **Client Impact:** Medium–High (improves matching accuracy without complex UI)  
* **Effort:** Medium  
* **Time:** \~0.5–2 days  
* **Source:** Jan 22 CSV decision \+ formatting rules  
* **Requirements:**  
  1. Store multiple IDs in a simple CSV string (rather than bubble UI).  
  2. “No space after comma” recommended; system should handle stray spaces during search.  
* **Acceptance Criteria:**  
  1. Field accepts values like `ABC123,DEF456` and persists as-entered.  
  2. Matching/search logic treats `ABC123, DEF456` and `ABC123,DEF456` equivalently.  
  3. UI provides helper text explaining format (“comma-separated, no spaces”).

---

### **P1-STATUS-001 — Add “Billing Status” dedicated field (for filtering/reporting)**

* **Client Impact:** Medium–High (enables reporting/filtering by billing lifecycle)  
* **Effort:** Medium  
* **Time:** \~1–3 days  
* **Source:** Jan 22 billing status gap and need for dedicated field  
* **ASSUMED:**  
  1. Field appears on relevant entities (product and/or schedule); meeting doesn’t specify exact location.  
  2. Picklist values are defined in the external spec doc (not included here), so we’ll implement field \+ plumbing first and stub values.  
* **Acceptance Criteria:**  
  1. Billing Status field exists and is usable in filters and reports.  
  2. Field is editable per role permissions (or at least by Admin).  
  3. Reporting/filtering can isolate records by Billing Status.

---

### **P1-REPORT-001 — Add PDF export to deposit workflow**

* **Client Impact:** Medium (reporting/exports)  
* **Effort:** Medium  
* **Time:** \~1–3 days  
* **Source:** Jan 22 action item \+ discussion  
* **ASSUMED:**  
  1. Export creates a PDF of the deposit detail page (header \+ line items \+ statuses).  
* **Acceptance Criteria:**  
  1. “Export PDF” action exists from deposit workflow.  
  2. Generated PDF includes deposit header, totals, and all line items.  
  3. PDF export works for deposits with 1–500+ lines (pagination ok).

---

### **P1-UI-008 — Add vendor-specific summary widget on deposit detail page**

* **Client Impact:** Medium–High (reconciliation progress visibility)  
* **Effort:** Medium  
* **Time:** \~1–3 days  
* **Source:** Jan 26 vendor summary widget  
* **Acceptance Criteria:**  
  1. Deposit detail page shows a widget summarizing reconciliation progress for the currently filtered vendor.  
  2. Widget updates when user changes filters (e.g., vendor filter).  
  3. Widget does not block core entry fields (layout is readable).

---

### **P1-UI-009 — Frozen columns \+ “lock comparison view” toggle (align columns between deposit and schedule grids)**

* **Client Impact:** Medium–High (major speed \+ accuracy benefit)  
* **Effort:** Medium–Hard  
* **Time:** \~2–6 days  
* **Source:** Jan 26 frozen columns requirement \+ implementation idea  
* **Requirements:**  
  1. Lock key columns on left side of reconciliation grid.  
  2. Provide toggle/button to align column order/width across top deposit and bottom schedule grids.  
* **Acceptance Criteria:**  
  1. Selected columns remain visible while horizontally scrolling.  
  2. “Lock comparison view” (or similar) aligns chosen columns order \+ width between grids.  
  3. Feature works without breaking user column customization (if dynamic table framework supports it).

---

## **P2 — Could ship (valuable, but likely larger / needs more data & iteration)**

### **P2-UPLOAD-001 — Multi-vendor deposit upload option (parse complex reports, ignore totals, apply correct template per row)**

* **Client Impact:** High (major workflow simplification)  
* **Effort:** Hard  
* **Time:** \~4–10 days  
* **Source:** Jan 26 multi-vendor uploads requirement  
* **Requirements:**  
  1. Add “multi-vendor” option on upload screen.  
  2. System reads vendor name per row and applies correct template for each vendor.  
  3. Pre-work: parse complex reports and ignore non-transaction rows (“Total” lines).  
  4. UI grouping: show a single “Multi-Vendor” row on main reconciliation page.  
* **Acceptance Criteria:**  
  1. User can toggle “Multi-vendor” at upload.  
  2. For a mixed-vendor file, system correctly assigns each row to its vendor template.  
  3. “Total” and other non-transaction rows do not create deposit lines.  
  4. Reconciliation page groups result under “Multi-Vendor” deposit record.

---

### **P2-MIG-001 — Historical product data migration approach (placeholder product per account)**

* **Client Impact:** Medium–High (accelerates onboarding/migration)  
* **Effort:** Hard  
* **Time:** \~1–2+ weeks (depending on import tooling)  
* **Source:** Jan 26 data migration strategy \+ rationale  
* **Dependencies:** Change Start Date tool (recommended) as mitigation for arrears complexities.  
* **Acceptance Criteria (v1):**  
  1. Admin can create a “historical product” per account.  
  2. Bulk import creates revenue schedules linked to that historical product.  
  3. Users can later convert/migrate historical schedules into real products (future enhancement; **ASSUMED**).

---

### **P2-BUNDLE-001 — Bundle/split logic (spec \+ implementation)**

* **Client Impact:** Medium–High (real-world vendor file complexity)  
* **Effort:** Hard  
* **Time:** TBD  
* **Source:** Jan 21 action item to draft bundle/split logic  
* **ASSUMED:**  
  1. Bundle/split refers to reconciling a single payment line against multiple schedules/products or decomposing bundled vendor lines.  
* **Acceptance Criteria (phase 1 \= spec):**  
  1. Written spec exists describing how bundles are detected and handled.  
  2. Includes at least 3 example scenarios and expected outcomes.  
* **Acceptance Criteria (phase 2 \= build):**  
  1. UI supports splitting a line into multiple allocations with totals validation.

---

### **P2-REV-002 — Revenue schedule extension action (Opportunity Revenue Schedules page)**

* **Client Impact:** Medium (contract extensions / M2M)  
* **Effort:** Medium–Hard  
* **Time:** \~2–6 days  
* **Source:** Jan 21 action item  
* **ASSUMED:**  
  1. “Extension” means add N additional monthly schedules to an existing product’s schedule series.  
* **Acceptance Criteria:**  
  1. User can add an extension action from Opportunity Revenue Schedules.  
  2. System creates additional schedules with correct dates and IDs.  
  3. Audit log records who extended, when, and why (reason prompt recommended).

---

### **P2-FLEX-002 — Flex chargeback handling**

* **Client Impact:** Medium–High  
* **Effort:** Hard  
* **Time:** \~3–7 days  
* **Source:** Jan 21 action item  
* **Acceptance Criteria (v1):**  
  1. Chargeback applied to a Flex-created schedule behaves consistently with standard chargebacks.  
  2. User can see audit trail linking original Flex and resulting chargeback.

---

## **QA / Documentation deliverables (supporting tasks)**

### **QA-001 — Share manual \+ automated test checklists (and keep updated)**

* **Client Impact:** Medium (reduces regressions, speeds UAT)  
* **Effort:** Easy  
* **Time:** \~1–3 hours  
* **Source:** Jan 21 next steps \+ action item  
* **Acceptance Criteria:**  
  1. Checklist document exists in repo (or shared drive) and covers deposit upload \+ reconciliation flows.  
  2. Checklist includes at least: upload→map→reconcile smoke run \+ edge cases.

### **QA-002 — Investigate matching logic failures (Account Legal Name \+ Other ID / House ID)**

* **Client Impact:** High (matching correctness)  
* **Effort:** Medium  
* **Time:** \~0.5–2 days  
* **Source:** Jan 21 next steps \+ action item  
* **Acceptance Criteria:**  
  1. A test file exists where matches should occur via Account Legal Name and/or Other/House IDs.  
  2. Matching produces expected candidate schedules.  
  3. Document root causes \+ fixes if mismatches persist.

---

# **Open questions / uncertainties (flagged for follow-up)**

These are explicitly mentioned but not fully specified in the meeting notes:

1. **Billing Status values** (picklist options \+ which entity/entities it lives on) — needs confirmation from approved spec doc.  
2. **Manager role definition** for chargeback approvals (which role(s) can approve).  
3. Exact meaning of **child schedule IDs like “12330.1”** (how IDs are generated; relationship to parent schedules).  
4. **PDF export formatting** requirements (whether it needs branding, exact column set, signatures, etc.).  
5. **Bundle/split workflow specifics** (rules, UI, edge cases) — only “draft bundle/split logic” is captured in meeting notes.

---

# **Appendix: High-Impact Quick Wins (do these first if sprint time is tight)**

If you have *very limited* sprint time, start here (high impact, low effort):

* P0-REC-001 Account Legal Name mapping option  
* P0-REC-002 Create missing test schedules (VoIP etc.)  
* P0-UI-001 Fix commission rate display  
* P0-UI-005 Default view Unmatched (remove Suggested tab)  
* P0-NAV-001 Fix “Go to revenue schedule” link  
* P0-DEP-001 Deposit verification fields \+ relabel Report Date

These directly address the issues called out across Jan 21/22/26 and make the system usable for realistic reconciliation testing.

