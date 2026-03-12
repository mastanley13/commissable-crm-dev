# Match Wizard Modal — Updated Implementation Handoff

## Purpose
This document consolidates the client-requested Match Wizard Modal and many-to-one modal changes from recent Commissable CRM meetings into a single implementation handoff for a coding agent.

This is a **behavior and requirements document**, not a coding document.

---

## Final Clarifications Applied
These two clarifications are now the controlling requirements for this handoff version:

1. **Step 3 is not a separate wizard page, tab flow, or additional popup.**
   - The 3-step logic must be handled **inside the current modal**.
   - The experience should guide the user through the logic in the current modal with **minimal change to the existing modal structure**.
   - The UI should communicate the order of operations, but the user should not feel like they are navigating a new multi-page wizard.
   - Step 3 is **residual logic handled through the flex-schedule path**.

2. **Bundle should always be visible in the many-to-one modal.**
   - Bundle should only succeed when the underlying rules allow it.
   - If a user attempts an invalid bundle, the system must show a **plain-language explanation** of why the bundle is not allowed.

---

## Governing Product Decisions

### 1) Keep the current modal and guide the user within it
The client does **not** want a new multi-page wizard experience. The modal should remain the current modal, with the 3-step business logic handled inside it using lightweight UI guidance, staged choices, previews, and validation messaging.

### 2) The 3-step logic is required, but it is a logic sequence, not a page sequence
The user must be guided through the following order:

1. **Usage Overage**
2. **Commission Rate Variance**
3. **Residual Commission Amount via flex-schedule logic only**

The system must apply this order whenever multiple issues are present on the same reconciliation case.

### 3) The many-to-one modal should match the newer modal design language
The client wants the many-to-one modal simplified and visually aligned with the other updated reconciliation modals.

---

## Scope
This handoff covers:
- standard match / reconciliation modal behavior
- many-to-one modal behavior
- preview and validation behavior
- bundle rules and bundle messaging
- modal-related quality-of-life fixes and guardrails

---

# A. Standard Match / Reconciliation Modal Requirements

## A1. Single-modal 3-step guided logic
### Requirement
The standard reconciliation modal must enforce the client’s ordered business logic **within the current modal**.

### Required Behavior
- The modal must detect whether the case includes:
  - usage variance
  - commission-rate variance
  - residual commission-amount variance
- The modal must guide the user in this order:
  1. usage first
  2. commission rate second
  3. residual commission handling last, through flex-schedule logic only
- The modal must **not** open additional wizard pages or extra popups just to move between these steps.
- The modal may use labels, visual states, inline indicators, helper text, or completion markers to show progress.
- The system must support cases where more than one issue exists at the same time.

### Acceptance Criteria
- A case with both usage and commission-rate variance is handled in the correct order.
- The modal stays in one modal experience rather than splitting the user into separate pages/popups.
- The user can tell which part of the decision flow they are currently resolving.
- Earlier unresolved logic prevents final completion.

---

## A2. Step 1 — Usage overage behavior
### Requirement
Usage must be handled first.

### Required Behavior
- If usage is within variance, the system should auto-adjust one time.
- If usage is outside variance, the user must be able to choose from the approved usage actions:
  - one-time adjustment for the current schedule only
  - apply to this and all future schedules
  - create flex schedule for unknown overage
- “Apply to all future schedules” must behave as a forward-looking schedule change, not just a one-time reconciliation override.
- The effect of the user’s selected action should preview in the modal before submission.

### Acceptance Criteria
- Within-variance usage does not force unnecessary manual intervention.
- Outside-variance usage presents the approved user choices.
- Applying to future schedules updates the preview to reflect the forward-looking outcome.
- Flex schedule remains available for unexplained or unknown overage scenarios.

---

## A3. Step 2 — Commission-rate variance behavior
### Requirement
Commission-rate logic must run after usage is settled.

### Required Behavior
- If the actual commission rate is higher than expected, the user must be able to:
  - accept the higher rate one time
  - apply the higher rate to future schedules
- If the actual commission rate is lower than expected, the system must:
  - flag the schedule as low-rate
  - create a ticket for investigation
  - preserve the issue in a report / review queue
- Lower-rate cases should not silently disappear as if they were fully resolved.

### Acceptance Criteria
- Higher-rate cases support one-time and future-apply paths.
- Lower-rate cases create an exception workflow rather than resolving silently.
- A low-rate case results in a visible exception artifact for later review.

---

## A4. Step 3 — Residual commission logic through flex-schedule path
### Requirement
Step 3 must **not** be implemented as a separate page, wizard step, or extra popup.

### Required Behavior
- Step 3 exists as **residual logic** only.
- If usage and commission-rate handling still leave a remaining commission amount issue, the system must resolve that through the **flex-schedule path inside the current modal flow**.
- The UI should make it clear that residual handling is part of the same modal experience.
- The modal should not introduce a distinct new “Step 3 page.”

### Acceptance Criteria
- Residual commission amount is handled without sending the user into a separate wizard experience.
- The current modal remains the primary place where the user completes the reconciliation.
- The implementation clearly treats Step 3 as residual flex-schedule handling, not as a standalone modal state that behaves like a separate workflow.

---

## A5. Guided UI states without turning the modal into a wizard
### Requirement
The client wants guidance, but only with minimal structural change.

### Required Behavior
- Use lightweight guidance elements such as:
  - step labels
  - completion indicators
  - helper text
  - staged option selection
  - inline previews
- Do **not** create a heavyweight wizard experience.
- Do **not** require the user to navigate between multiple modal pages to complete the logic.
- Do **not** overload the modal with unnecessary new navigation controls.

### Acceptance Criteria
- The modal feels like the current modal, improved.
- The modal does not feel like a new multi-step application.
- Users can understand the decision order with minimal training.

---

# B. Modal Interaction and UX Requirements

## B1. Do not commit on first click
### Requirement
User selection must stage a choice first, not immediately execute it.

### Required Behavior
- Clicking an option should select it and update the preview.
- The action should not commit until the user explicitly submits.
- This applies especially to high-impact actions such as applying changes to future schedules.

### Acceptance Criteria
- No option commits immediately on first click.
- The user must submit to finalize.
- Cancel / close leaves persisted data unchanged.

---

## B2. Show preview before submit
### Requirement
The user must see what will change before finalizing a choice.

### Required Behavior
- Display the effect of the selected action directly in the modal before submission.
- Preview changed schedule values such as:
  - price each
  - usage-related fields
  - commission-related fields
- Previews must update when the user changes their selected option.

### Acceptance Criteria
- A selected option visibly changes the preview state before final submission.
- The preview is accurate to the selected choice.
- Users can compare before vs. after without guessing.

---

## B3. Highlight changed values with accessible emphasis
### Requirement
Changed values must stand out clearly.

### Required Behavior
- Highlight changed values with a yellow-style background treatment rather than relying only on text color.
- The visual treatment should help the eye identify what changed.
- This same highlighting behavior should be applied consistently in both modal types where previewed changes appear.

### Acceptance Criteria
- Changed values are visually obvious before submit.
- The emphasis is accessible and not dependent only on font color.
- The same highlight treatment appears consistently across related modals.

---

## B4. Use a consistent modal style
### Requirement
The client wants modal consistency.

### Required Behavior
- Use the same modal design language across the relevant reconciliation modals.
- Keep the updated header treatment consistent.
- Use smaller action buttons.
- Add “or” separators where options are mutually exclusive.
- Add lightweight helper text where it reduces hesitation or confusion.

### Acceptance Criteria
- Related modals look like part of the same system.
- Option controls are easier to scan.
- The modal is easier to understand on first use.

---

## B5. Align expected vs actual values for readability
### Requirement
The comparison area must be easier to read.

### Required Behavior
- Align the comparison values vertically wherever possible, especially:
  - expected commission rate vs actual commission rate
  - expected usage vs actual usage
  - expected commission vs actual commission
- Widen the modal if needed to make the comparison readable.
- Prioritize scanability over keeping the modal narrow.

### Acceptance Criteria
- Users can compare key values straight across.
- The modal does not feel cramped.
- Critical comparison fields do not look visually disconnected.

---

# C. Many-to-One Modal Requirements

## C1. Redesign many-to-one modal to match the updated modal pattern
### Requirement
The many-to-one modal should visually match the newer reconciliation modals.

### Required Behavior
- Replace the older selected-line / schedule presentation with a cleaner layout that includes:
  - deposit line item information
  - preview state
  - schedule information
- Use a single, unified layout rather than fragmented sections.

### Acceptance Criteria
- The many-to-one modal no longer looks like a separate legacy wizard.
- Deposit, preview, and schedule information are presented in a unified way.

---

## C2. Remove the legacy step bubbles
### Requirement
The old progress bubbles are to be removed.

### Required Behavior
- Remove the old labels / bubbles such as:
  - Selection
  - Allocation
  - Validation
  - Apply
- The redesigned modal should not depend on this legacy progress indicator.

### Acceptance Criteria
- The old wizard bubbles are gone.
- The modal remains understandable without them.

---

## C3. Make Edit Allocation the primary action
### Requirement
The primary action in the many-to-one modal should be Edit Allocation.

### Required Behavior
- Edit Allocation should be clearly visible as the main user action.
- The action area should be simplified rather than overloaded.

### Acceptance Criteria
- Edit Allocation is easy to find.
- The modal does not force the user through unnecessary extra actions.

---

## C4. Pre-populate and highlight actual values in preview
### Requirement
The preview should show the meaningful values immediately.

### Required Behavior
- Pre-populate and highlight relevant actual-value fields in the preview area, especially:
  - usage actual
  - commission actual
- Do this in a way that supports the same preview logic used elsewhere in the reconciliation experience.

### Acceptance Criteria
- The user can immediately see what the allocation decision affects.
- Key actual-value fields are visible and emphasized in the preview area.

---

## C5. Remove redundant “what changed” section
### Requirement
The client wants one unified preview area instead of duplicated explanations.

### Required Behavior
- Remove the extra top section that separately describes what changed if the unified preview already shows the same information.
- Consolidate the information into one place.

### Acceptance Criteria
- The modal is less cluttered.
- Users do not need to compare two different sections to understand what changed.

---

# D. Bundle Rules and Validation Requirements

## D1. Bundle must always be visible
### Requirement
Bundle should always be shown in the many-to-one modal.

### Required Behavior
- Keep the Bundle option visible in the action area.
- Do not hide Bundle simply because it may not be valid in every case.
- Visibility does not mean guaranteed success.

### Acceptance Criteria
- Bundle is always present in the many-to-one UI.
- Users do not have to discover Bundle through hidden states.

---

## D2. Bundle succeeds only when rules allow it
### Requirement
Bundle must be guarded by validation rules.

### Required Behavior
- The system should allow Bundle only when the selected records pass the required business rules.
- The known hard rule from the meetings is that records with **different expected commission rates cannot be bundled**.
- Cross-deal mismatches must also be blocked.
- The system may include additional existing business-rule checks, but it must not allow invalid bundles through.

### Acceptance Criteria
- Valid bundle cases succeed.
- Invalid bundle cases are blocked.
- Different expected commission rates cannot be bundled together.
- Different deals cannot be bundled together.

---

## D3. Invalid bundle attempts must return plain-language explanations
### Requirement
If bundle fails validation, the user must understand why.

### Required Behavior
- When the user attempts an invalid bundle, show a plain-language message that explains the specific reason.
- The message should identify the actual issue, such as:
  - items have different expected commission rates
  - items belong to different deals
  - the selected records are not eligible to bundle together
- Avoid vague technical error states.

### Acceptance Criteria
- Invalid bundle attempts return a readable explanation.
- Users can understand what needs to change before trying again.
- The message does not feel like a generic system error.

---

## D4. Auto-run validation where possible
### Requirement
The client wants less manual preview / validation friction.

### Required Behavior
- Validation should run automatically where appropriate instead of depending on an extra “run preview” style step.
- The UI should immediately guide the user toward the valid next action.

### Acceptance Criteria
- The user does not have to click unnecessary validation steps to learn that the selection is invalid.
- Validation feedback appears at the right moment in the flow.

---

# E. Guardrails and Related Fixes That Affect the Modal Experience

## E1. Do not match immediately when the user clicks Match
### Requirement
The system must check logic first instead of immediately finalizing a match.

### Required Behavior
- Clicking Match should open or continue the guided reconciliation logic.
- The system must evaluate the applicable variance logic before finalizing the match.

### Acceptance Criteria
- Match no longer bypasses required variance checks.
- Users are routed through the appropriate modal logic before anything final is committed.

---

## E2. Support multiple issue states in the same case
### Requirement
The modal must not assume only one issue exists.

### Required Behavior
- If a reconciliation case has both usage variance and commission-rate variance, the modal must reflect that reality.
- The UI cannot hide one issue just because another one is present.
- The system should let the user resolve the issues in the required order within the same modal experience.

### Acceptance Criteria
- Multi-issue cases behave correctly.
- The user is not misled into thinking only one problem exists.

---

## E3. Clear stale selections after successful match
### Requirement
Successful matching must reset selection state.

### Required Behavior
- After a successful match, clear prior selected state so it does not carry into the next matching action.
- This includes hidden or stale selected rows that can incorrectly trigger many-to-one behavior.

### Acceptance Criteria
- A completed match does not cause false many-to-one flows later.
- The next matching action starts from a clean state.

---

## E4. Block cross-deal reconciliation and bundling
### Requirement
Different deals must not be allowed to reconcile or bundle together.

### Required Behavior
- Prevent users from reconciling or bundling records from different deals.
- Return a clear explanation if the user attempts it.

### Acceptance Criteria
- Known bad combinations are blocked.
- Users receive a readable reason.

---

# F. Recommended QA Scenarios

The following scenarios should be tested before signoff:

1. **Usage only, within variance**
   - system auto-adjusts one time

2. **Usage only, outside variance**
   - one-time adjustment path
   - apply to all future schedules path
   - create flex schedule path

3. **Usage + higher commission-rate variance**
   - usage resolves first
   - higher-rate path resolves second
   - preview updates correctly before submit

4. **Usage settled + lower commission-rate variance**
   - low-rate flag created
   - ticket created
   - exception remains visible for review

5. **Residual commission issue after prior handling**
   - handled through flex-schedule logic without separate wizard page

6. **Many-to-one valid allocation**
   - preview renders correctly
   - Edit Allocation is primary and understandable

7. **Many-to-one valid bundle**
   - Bundle is visible
   - Bundle succeeds when rules are satisfied

8. **Many-to-one invalid bundle due to different commission rates**
   - Bundle remains visible
   - system blocks success
   - plain-language reason is shown

9. **Invalid bundle or reconciliation across different deals**
   - system blocks action
   - plain-language reason is shown

10. **Selection staging before submit**
   - option click previews the result but does not commit immediately

11. **Stale selection regression test**
   - prior selection does not remain active after successful match

12. **Readability check**
   - expected vs actual columns align correctly
   - modal width supports comparison without confusion

---

# G. Remaining Product Notes

## G1. Minimal-change principle
The coding agent should treat this as a guided upgrade to the existing modal, not a rewrite into a brand-new wizard architecture.

## G2. Plain-language principle
Wherever validation blocks an action, the user should be told **why** in straightforward business language.

## G3. Consistency principle
The standard reconciliation modal and the many-to-one modal should feel like part of the same system.

---

# Source Basis
This handoff is based on the recent Commissable CRM meetings, especially:

- **March 11, 2026**
  - ordered usage → commission-rate → residual logic discussion
  - current-modal guidance, not immediate matching, and support for multiple simultaneous issues
  - preview/highlight/alignment changes
  - many-to-one redesign
  - cross-deal validation

- **March 5, 2026**
  - auto-validation direction
  - need for plain-language messaging and clearer visual guidance

- **February 17, 2026**
  - hard business rule that items with different expected commission rates cannot be bundled

- **User clarification applied in this handoff version**
  - Step 3 is residual flex-schedule logic inside the current modal
  - Bundle is always shown, but only succeeds when validation allows it

