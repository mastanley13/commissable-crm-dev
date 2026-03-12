According to a document from March 11, 2026, here is a development implementation guide based on the March 11 Commissable CRM meeting transcript and summary.

The controlling decisions from this meeting are: use a mandatory 3-step reconciliation order of **Usage → Commission Rate → Commission Amount**, standardize the modal UX, simplify the many-to-one modal, fix the stale-selection/search/validation bugs, and prepare the first AI bot testing pass with explicit permissions and restrictions.

## **Core Features**

### **1\. Three-step deposit variance resolution workflow**

**Description:** Build a mandatory reconciliation workflow that resolves deposit variances in a fixed order: first usage variance, then commission-rate variance, then any remaining commission-amount variance. Users must not be allowed to bypass the sequence when multiple issues exist on the same deposit/schedule pairing. The meeting explicitly resolved the ambiguity around “which variance gets handled first.”

**Business/Product Intent:** Prevent incorrect reconciliation outcomes when one deposit contains more than one type of variance. The goal is to produce a repeatable human workflow and cleaner downstream financial logic.

**System Area Affected:** Frontend / Backend / Automation

**Implementation Notes:**

* Step 1 must handle usage first.  
* Step 2 must only occur after Step 1 is resolved.  
* Step 3 should only be evaluated after usage and commission-rate decisions are complete.  
* The UI should visually indicate which step is active and which steps are complete. Rob specifically requested step labels and completion checkboxes in the modal/tab flow.

**Dependencies:** Existing reconciliation matching flow, variance thresholds, flex-schedule creation, ticket/report surfaces.

**Acceptance Criteria:**

* Given a deposit with both usage and commission-rate variance, the system always prompts usage resolution first.  
* The user cannot finalize the match until required earlier steps are resolved.  
* Completed steps are visibly marked complete.  
* The final matched outcome reflects the ordered decision path, not parallel/unordered edits.

### **2\. Usage variance decision flow**

**Description:** For usage overage, implement the approved decision tree: if within variance, auto-adjust one time; if outside variance, present three user choices—one-time adjustment, apply to all future schedules, or create flex schedule for unknown overage. “Apply to all future schedules” must absorb the overage into price-each for the current and future schedules.

**Business/Product Intent:** Handle usage discrepancies in a way that supports both one-off corrections and permanent schedule corrections without forcing manual recurring cleanup.

**System Area Affected:** Frontend / Backend

**Implementation Notes:**

* “One-time adjustment” should be treated as current-schedule-only behavior.  
* “Apply to all future schedules” should update future schedule economics, not just the current reconciliation result.  
* “Create flex schedule” is the fallback for unexplained or temporary overage.  
* The choice must not commit immediately on click; it should stage a preview and wait for submit confirmation.

**Dependencies:** Price-each update flow, future-schedule propagation logic, flex schedule workflow.

**Acceptance Criteria:**

* Usage within variance auto-adjusts one time without extra user input.  
* Usage outside variance presents the 3 approved options.  
* “Apply to all future schedules” visibly updates the previewed price-each impact before submit.  
* Flex creation is available from this step for unexplained overages.

### **3\. Commission-rate variance decision flow**

**Description:** After usage is resolved, commission-rate variance must be evaluated. If the actual rate is higher than expected, the user must be able to accept it once or apply it to all future schedules. If the actual rate is lower than expected, the system must flag the schedule as low-rate, create a ticket, and send it to a report/queue for investigation rather than silently reconciling it away.

**Business/Product Intent:** Capture potential underpayments and rate drift without losing visibility into revenue leakage or vendor issues.

**System Area Affected:** Frontend / Backend / Automation / Reporting

**Implementation Notes:**

* Higher rate path: “adjust once” or “apply to all future.”  
* Lower rate path: do not treat as resolved by default; tag it, ticket it, and surface it in a review report.  
* The meeting language strongly implies the low-rate path is an exception workflow, not a silent correction path.

**Dependencies:** Ticket module, report/filtering surface, schedule-level exception state.

**Acceptance Criteria:**

* A lower-than-expected commission rate never disappears without an exception artifact.  
* A ticket is created automatically for low-rate cases.  
* Low-rate cases appear in a report/queue with the reason preserved.  
* Higher-rate changes can be applied once or propagated forward.

## **UI / UX Changes**

### **4\. Standardize reconciliation modal design**

**Description:** Apply a consistent modal standard across reconciliation modals: gradient-style header, smaller option buttons, “or” separator text between options, and a required Submit action rather than immediate execution on click. Rob explicitly asked for consistency across modals and for staged choice selection before submit.

**Business/Product Intent:** Reduce user confusion, improve visual consistency, and prevent accidental commits.

**System Area Affected:** Frontend

**Implementation Notes:**

* Selected options should highlight, but not execute until Submit is clicked.  
* Add simple helper copy such as “choose one of three options” where helpful.  
* March 11 should supersede any older step-bubble-heavy modal styling for this flow.

**Dependencies:** Shared modal component/styling system.

**Acceptance Criteria:**

* Reconciliation modals share the same header treatment and control sizing.  
* Option buttons do not auto-apply on click.  
* Users must click Submit to commit the selected choice.  
* The control layout remains readable at normal laptop widths.

### **5\. Pre-submit preview with yellow highlight**

**Description:** Add real-time previews inside the modal so the user can see exactly what their choice will change before submission. Rob specifically requested previewed value changes, especially for price-each and commission impacts, highlighted with the same yellow-style background already used elsewhere in the interface.

**Business/Product Intent:** Help users make confident choices and reduce mistaken schedule edits.

**System Area Affected:** Frontend

**Implementation Notes:**

* Preview the before/after value in place.  
* Use background highlight rather than relying only on text color; Rob noted colorblindness concerns.  
* Apply the same behavior in both relevant reconciliation modals.

**Dependencies:** Modal state model, preview-calculation layer.

**Acceptance Criteria:**

* Clicking an option updates a temporary preview without persisting data.  
* Changed fields are visually highlighted with the agreed background treatment.  
* Both usage and commission-related preview fields behave consistently across both modals.

### **6\. Align expected vs actual comparison columns**

**Description:** In the reconciliation modals, align expected and actual usage/commission/rate fields vertically so users can compare them straight across, and widen the modal if needed to make the comparison clear.

**Business/Product Intent:** Make the core comparison view readable. Rob called this “the meat and potatoes of the application.”

**System Area Affected:** Frontend

**Implementation Notes:**

* Align expected commission rate vs actual commission rate, expected usage vs actual usage, and expected commission vs actual commission.  
* Favor readability over keeping the modal narrow.

**Dependencies:** Modal layout redesign.

**Acceptance Criteria:**

* Comparison fields are visually aligned top-to-bottom.  
* The modal can grow wider where needed.  
* No critical comparison field wraps or becomes visually detached from its counterpart.

### **7\. Many-to-one matching modal redesign**

**Description:** Replace the current many-to-one wizard-style modal with a simpler layout using the new standard structure: deposit line item, preview state, and schedule data. Remove the legacy “Selection / Allocation / Validation / Apply” progress bubbles. Make “Edit Allocation” the primary visible action, and keep bundle behavior accessible when relevant rather than hidden away. Rob explicitly asked for the bundle option to be visible and for the modal to mirror the newer modal style.

**Business/Product Intent:** Reduce modal complexity and make many-to-one review faster and more understandable.

**System Area Affected:** Frontend

**Implementation Notes:**

* Pre-populate and highlight the temporary actual-usage and actual-commission values in the preview area.  
* Remove redundant “what changed” sections if the same information is already displayed in the unified preview.  
* **ASSUMED:** Bundle should remain as an explicit secondary action only in scenarios where bundling is still valid; the meeting clearly makes Edit Allocation primary, but the exact bundle trigger logic was not fully restated on March 11\.

**Dependencies:** Preview engine, allocation logic.

**Acceptance Criteria:**

* The many-to-one modal no longer displays the four legacy progress bubbles.  
* Deposit and schedule previews are shown in a unified comparison layout.  
* Edit Allocation is clearly available.  
* Bundle is not hidden when bundling is applicable.

## **Backend Logic Updates**

### **8\. Sequential gating and step-completion state**

**Description:** Add backend-controlled gating so the match action evaluates the approved steps in order and the UI reflects that sequence. StrategixAI specifically noted they had to stop the modal from immediately matching and had to handle cases where more than one variance tab could be present at once.

**Business/Product Intent:** Make the ordered workflow enforceable, not just presentational.

**System Area Affected:** Backend / Frontend

**Implementation Notes:**

* The system should recognize that both usage and commission-rate issues may exist simultaneously.  
* Step completion must be evaluable before match finalization.  
* The UI checkbox/step state should be backed by actual validation state, not just front-end decoration.

**Dependencies:** Variance detection rules, modal flow.

**Acceptance Criteria:**

* The system can represent multiple active variance issues at once.  
* Earlier unresolved steps block later-step completion.  
* Step-complete indicators only appear when the system considers the step resolved.

### **9\. Cross-deal reconciliation guard**

**Description:** Prevent users from reconciling deposit items against unrelated deals. Rob’s explicit example was not allowing DW Realty and Edge Business to reconcile against each other.

**Business/Product Intent:** Protect data integrity and stop false cross-deal matches.

**System Area Affected:** Backend / Frontend

**Implementation Notes:**

* **ASSUMED:** The primary guard should be deal/opportunity context.  
* The action-item wording also referenced distributor/vendor validation, but the spoken example was deal mismatch. Confirm whether the final guard must enforce deal only, or deal plus distributor/vendor.  
* The UI should block invalid match combinations clearly before commit.

**Dependencies:** Access to consistent deal identity in both deposit and schedule contexts.

**Acceptance Criteria:**

* Invalid cross-deal selections are blocked before reconciliation completes.  
* The user receives a plain-language explanation.  
* Known-bad combinations like DW Realty vs Edge Business cannot be reconciled together.

## **Data / Schema Changes**

### **10\. Reconciliation exception and resolution metadata**

**Description:** The meeting did not explicitly approve field names, but the approved behaviors imply the system needs durable metadata to track resolution step, resolution choice, low-rate exception state, and linked investigation/ticket artifacts. This is an **ASSUMED** data-model requirement to make the approved behavior reportable and auditable.

**Business/Product Intent:** Preserve decision history and make low-rate/report/ticket flows operationally usable.

**System Area Affected:** Database / Backend

**Implementation Notes:**

* **ASSUMED likely stored items:** current variance step/status, chosen resolution mode, apply-to-future scope, low-rate flag/reason, linked ticket reference, and possibly flex provenance.  
* Confirm with product owner before hardening schema decisions.

**Dependencies:** Ticket/report design.

**Acceptance Criteria:**

* The system can persist enough structured state to recreate why a reconciliation was allowed, flagged, propagated, or ticketed.  
* Low-rate report entries can link back to the underlying schedule and ticket.

## **Integration Changes**

### **11\. AI bot v1 action catalog, permissions, and training structure**

**Description:** Prepare the CRM for the first AI bot testing cycle with Michael. The meeting set three clear requirements: define what the bot can access, define what actions it must not be allowed to take, and organize training using markdown-based skills/protocols so Rob can test real actions on Friday.

**Business/Product Intent:** Move AI testing from concept to controlled operational testing without exposing admin/security risk.

**System Area Affected:** Integration / Automation / Security

**Implementation Notes:**

* Produce an access inventory showing what the bot can read and act on.  
* Produce an allowed/disallowed action list.  
* Explicitly restrict high-risk actions such as admin-permission changes and database deletion.  
* Organize v1 training rules in markdown/skill-style instructions tied to desired CRM outcomes.

**Dependencies:** Michael’s integration timing, auth/permissions model, exposed CRM actions.

**Acceptance Criteria:**

* A documented v1 bot action catalog exists.  
* A documented restricted-actions list exists.  
* Training artifacts exist in markdown/skill format.  
* Rob can test approved actions without the bot being able to perform prohibited admin/destructive actions.

## **Bug Fixes**

### **12\. Stale selection / false many-to-one prompt fix**

**Description:** Fix the bug where previous selections remain selected after a successful match and cause later actions to incorrectly trigger many-to-one behavior. StrategixAI already identified the root cause during the meeting: successful submissions were not deselecting prior hidden selections.

**Business/Product Intent:** Prevent misleading workflows and restore trust in the matching interface.

**System Area Affected:** Frontend / Backend state handling

**Implementation Notes:**

* On successful match, clear both visible and hidden selection state.  
* Ensure refreshes do not preserve stale checkbox state in a way the user cannot see.

**Dependencies:** Match submission lifecycle.

**Acceptance Criteria:**

* After a successful match, the next reconciliation starts with no stale selected items.  
* The user is no longer incorrectly routed into many-to-one because of prior hidden state.

### **13\. Global revenue schedule search repair**

**Description:** Fix the broken global search bar used in the revenue schedule reconciliation context. Rob confirmed it would not return anything, and StrategixAI confirmed it appears broken globally rather than only on one page.

**Business/Product Intent:** Restore a core navigation/filtering tool needed for manual lookup and QA.

**System Area Affected:** Frontend / Backend query layer

**Implementation Notes:**

* Search should run across the available columns for the specific table/object.  
* For revenue schedules, Rob indicated searching the revenue schedule object should be sufficient because the schedule already carries inherited opportunity metadata.

**Dependencies:** Table search utility / global search component.

**Acceptance Criteria:**

* Entering a valid account/schedule-related term returns matching rows.  
* Search works in the revenue schedule table without requiring users to change tabs or filters incorrectly.  
* The bug is resolved anywhere the same shared search component is used.

## **Workflow / Automation Changes**

### **14\. Explicit confirmation workflow for modal options**

**Description:** Option clicks inside the variance modals should stage a choice and preview, but never commit automatically. Final action must occur only on Submit. Rob explicitly called this out to avoid accidental selection of the wrong option.

**Business/Product Intent:** Reduce accidental reconciliation changes.

**System Area Affected:** Frontend / Workflow state

**Implementation Notes:**

* Treat option clicks as “selected state,” not “committed state.”  
* This applies especially to “apply to all future schedules” behavior, which has broad downstream impact.

**Dependencies:** Modal redesign.

**Acceptance Criteria:**

* No modal choice commits on first click.  
* Submit is always required for commit.  
* Cancel/close leaves underlying data unchanged.

### **15\. Automatic low-rate ticket and investigation queue/report entry**

**Description:** When commission rate comes in lower than expected, create the exception workflow automatically instead of relying on a manual follow-up. The meeting explicitly called for both a ticket and a report/queue surface.

**Business/Product Intent:** Turn underpayment detection into a real operational workflow instead of an invisible discrepancy.

**System Area Affected:** Automation / Backend / Reporting

**Implementation Notes:**

* Ticket content should preserve the reason: “lower than expected commission rate.”  
* The schedule should remain visibly flagged until resolved.

**Dependencies:** Ticket creation service, queue/report surface, exception state.

**Acceptance Criteria:**

* Low-rate cases create a ticket automatically.  
* They appear in a dedicated report/queue.  
* The report entry links back to the affected schedule.

## **Risks / Unknowns**

1. **Step 3 ambiguity — confirm if commission-amount variance needs its own user action.**  
   The summary frames Step 3 as something only reached after usage and rate are settled, and implies any remaining issue should already be handled by flex logic from Step 1\. Earlier discussion in the same meeting briefly described a commission-only flex concept. I would treat the later simplified 3-step summary as controlling, but this is worth confirming before build-out.  
2. **Cross-validation scope is not fully pinned down.**  
   The spoken example is “different deals,” while the action item wording also references distributor/vendor. I would implement deal-level blocking first and confirm whether distributor/vendor must also be hard-gated.  
3. **Many-to-one action set still needs final product wording.**  
   March 11 clearly removes the wizard bubbles and makes Edit Allocation primary, but bundle visibility/behavior still needs exact trigger rules. I treated bundle as a conditional secondary action. **ASSUMED.**  
4. **Low-rate report destination is unspecified.**  
   The meeting requires a report/queue, but does not specify whether it is a standalone report, ticket report, dashboard queue, or reconciliation filter.  
5. **AI bot v1 scope is only partially defined.**  
   The meeting gives security boundaries and training approach, but not the precise CRM action list. That action catalog needs to be defined before Friday testing.  
6. **QA dependency: deleted test schedules.**  
   The $29.90 and $2.40 schedules were accidentally deleted and Rob said he would recreate them. Full validation of related matching behavior depends on those schedules existing again.

## **Recommended Development Roadmap**

1. **Fix immediate blockers first**  
   * stale selection reset  
   * global search repair  
   * cross-deal validation  
2. **Add the persistence layer for reconciliation decisions**  
   * low-rate flag/ticket/report metadata  
   * step-resolution metadata  
   * future-apply scope metadata  
     This is partly **ASSUMED**, but it is the cleanest way to support the approved behavior.  
3. **Implement the sequential variance engine**  
   * usage branch  
   * commission-rate branch  
   * step gating / step completion state  
4. **Standardize the modal framework**  
   * common header style  
   * smaller option controls  
   * explicit Submit behavior  
5. **Add the preview layer**  
   * before/after values  
   * yellow highlight treatment  
   * aligned expected vs actual comparison columns  
6. **Redesign the many-to-one modal on top of the new modal pattern**  
   * remove bubbles  
   * unified preview layout  
   * Edit Allocation primary  
   * Bundle conditional  
7. **Wire exception automation**  
   * low-rate auto-ticket creation  
   * low-rate report/queue entry  
8. **Prepare AI bot v1**  
   * allowed/disallowed action catalog  
   * access inventory  
   * markdown/skill training artifacts  
   * Friday test harness for Rob  
9. **Run QA with Rob’s recreated schedules and real variance scenarios**  
   * within-variance usage  
   * outside-variance usage  
   * higher commission rate  
   * lower commission rate  
   * dual-variance case  
   * many-to-one modal flow

The highest-value implementation priority is the reconciliation workbench itself: ordered variance handling, modal clarity, and bug-proof matching state. The AI work should proceed in parallel only after the permission boundaries and testable action set are explicit.

