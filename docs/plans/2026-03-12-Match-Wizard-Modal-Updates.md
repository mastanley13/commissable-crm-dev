According to documents from February 17, March 5, and March 11, 2026, the client’s recent **Match Wizard Modal** changes break into two related areas: the **variance/match resolution modal** and the **many-to-one matching modal**. The March 11 meeting is the controlling source for the newest UI direction, while February 17 adds an important bundling rule and March 5 adds a validation/UI clarity refinement.

## 1. Core client direction for the Match Wizard / variance modal

### A. The modal must enforce a fixed decision order

The client wanted the modal to guide reconciliation in a strict sequence: **Step 1 = Usage Overage**, **Step 2 = Commission Rate**, and then only address any remaining commission amount issue after those are handled. The intent was to stop ambiguous handling when one deposit has more than one type of variance.

### B. Usage step options were explicitly defined

For the **usage** step, the client approved this behavior:

* if within variance, auto-adjust one time
* one-time manual adjustment
* apply to all future schedules
* create flex schedule for unknown overage

The “apply to all future schedules” path should absorb the difference into future schedule pricing logic rather than behave like a one-off fix.

### C. Commission-rate step options were explicitly defined

After usage is resolved, the modal should evaluate **commission rate**. If the rate is higher than expected, the user should be able to adjust once or apply the update to future schedules. If the rate is lower than expected, the client wanted it **flagged**, a **ticket created**, and the issue routed to a **report/review queue** rather than silently corrected away.

### D. The modal should visibly show step labels and completion state

Rob asked that the modal tabs/sections be relabeled as explicit steps, such as **“Step 1 – Usage Overage”** and **“Step 2 – Commission Rate”**, and that resolved steps get a visual completion marker such as a checkbox. This was a direct client request to make the workflow obvious to the user.

## 2. Modal interaction changes the client wanted

### A. No immediate matching on click

The client did **not** want the modal to commit actions immediately when the user clicks Match or selects an option. StrategixAI specifically said they had to make it **check first instead of matching right away**, and Rob approved that direction. The modal should stage the decision first, then let the user confirm it deliberately.

### B. If multiple issues exist, the modal must account for both

A key March 11 clarification was that a deposit can have more than one issue at once. The client-approved direction was that the modal cannot only show one problem state if both usage and commission-rate variances are present. It needs to support the full multi-step sequence rather than hiding one issue because another exists.

### C. Smaller buttons, “or” separators, and helper text

Rob wanted the action buttons to remain visually strong but take up less space. He specifically asked for **smaller buttons**, an **“or”** separator between choices, and even a short helper line such as **“choose one of the two options below”** to make the action flow clearer for users landing in the modal.

### D. Consistent modal styling across the experience

The March 11 direction was to standardize modal styling so this workflow looks like the newer modal patterns. The client wanted consistent headers, clearer visual grouping, and a more cohesive design language instead of each wizard/modal feeling like a separate UI pattern.

## 3. Preview behavior the client requested

### A. Show the effect of the choice before submit

The client wanted the modal to preview the result of the user’s choice before final submission. StrategixAI described updating the modal so the user could see how values would change before they commit. This was part of making the modal safer and easier to understand.

### B. Highlight changed values with a yellow-style background

Rob explicitly requested that changed values be highlighted using the same yellow-ish background already present elsewhere because he noted color visibility concerns. He did not want the UI to rely only on text color; he wanted the changed fields to stand out clearly through background highlighting.

### C. Apply the preview/highlight behavior in both modals

The March 11 action items say the yellow highlight preview behavior should be implemented **in both modals**, which means this is not limited to just one wizard state. It is part of the broader matching / variance modal standardization effort.

## 4. Many-to-one Match Wizard Modal redesign

### A. Make the many-to-one popup look like the newer modals

Rob directly asked whether the many-to-one popup would be made to “look just like the others,” and the agreed direction was yes. The many-to-one modal should stop looking like its old standalone wizard and adopt the same newer structure/pattern as the rest of the reconciliation experience.

### B. Replace the old “selected line + schedule” layout

Instead of the older presentation, the client wanted the many-to-one modal reorganized into a cleaner structure:

* deposit line item / deposit preview at the top
* schedule information below
* unified preview treatment similar to the other modal

This was described as replacing the old selected-line/schedule arrangement with a more readable deposit-versus-schedule comparison layout.

### C. Remove the old wizard bubbles

The client explicitly wanted the legacy progress bubbles removed from the many-to-one modal. The labels called out were **Selection**, **Allocation**, **Validation**, and **Apply**, and Rob said those should go away. This is one of the clearest March 11 design decisions and should be treated as superseding the older wizard-style pattern.

### D. Make “Edit Allocation” the primary action

Rob said the only button they “really need” is **Edit Allocation**. That makes Edit Allocation the primary client-approved action in the redesigned many-to-one modal.

### E. Keep Bundle visible when applicable

StrategixAI said the **bundle option doesn’t need to be hidden**, and Rob agreed. So even though the modal is being simplified, Bundle should remain visible when it is a valid path rather than being buried or concealed from the user.

### F. Pre-populate and highlight actual usage / actual commission fields

In the redesigned many-to-one modal, Rob wanted the relevant fields pre-populated and highlighted — specifically the **usage actual** and **commission actual** preview fields — so the user can immediately see what the edit/allocation decision is affecting.

### G. Remove the separate “what changed” area in favor of one unified preview

StrategixAI confirmed that the top explanatory/change section could go away because the client preferred everything be visible **in one spot**. The intent was to reduce duplication and make the modal easier to scan quickly.

## 5. Data layout and readability requirements

### A. Align expected vs actual values vertically

Rob asked for the modal to align the important comparison values straight across:

* expected commission rate vs actual commission rate
* usage vs actual usage
* commission vs actual commission

The goal was to make the core comparison view easier to read without the user mentally tracking values across uneven columns.

### B. Widen the popup if needed

Rob explicitly said that if widening the popup helps readability, that is acceptable. He described this screen as “the meat and potatoes of the application,” so usability takes priority over keeping the popup narrow.

### C. Add stronger visual hierarchy between sections

On March 5, Rob said it was hard to tell where the eye should go because too much of the UI shared the same pale background. He suggested stronger section separation, contrasting treatments, and divider-style visual guidance so the different parts of the wizard are easier to follow.

## 6. Validation and guardrails that affect the Match Wizard Modal

### A. Auto-run validation where possible

On March 5, StrategixAI suggested that instead of making users click a separate preview/validation step, the system could just **run the validation automatically**, and Rob agreed that would improve clarity. This points toward fewer manual “preview” clicks and more immediate system guidance inside the modal itself.

### B. Bundling is not allowed when commission rates differ

From February 17, the client set a hard rule: **do not allow bundling if the selected schedules have different commission rates**. Rob explained that bundling mixed rates creates bad blended-rate projections, so the modal should block it and explain why plainly.

### C. Show a plain-language error for invalid bundle attempts

March 5 reinforced that the many-to-one flow should not just fail silently. When a commission-rate mismatch makes bundling invalid, the client wanted a clearer validation experience and easier-to-follow UI messaging, not a vague or easily missed state.

### D. Cross-deal matching must be blocked

The client also wanted the modal/workflow to prevent matching items from different deals, using the example of **DW Realty** and **Edge Business**. This is a validation rule that should appear before the user finalizes a bad match path.

### E. Clear stale selections after successful match

A bug discovered in March 11 was causing previous selections to persist invisibly and trigger false many-to-one behavior. The client-approved fix was that after a successful match, prior selections must be deselected so the next wizard state opens correctly.

## 7. Older but still-relevant many-to-one business rule from recent meetings

On February 17, Rob also described the preferred many-to-one outcome for certain cases: instead of preserving one old combined schedule, the system should be able to **break it out into multiple individual schedules** that line up with the deposit lines. That rule still matters because it explains when a many-to-one flow should create a cleaner future state rather than rely on a misleading bundle structure.

## 8. Recommended organized spec list for the Match Wizard Modal

If you want this as a clean spec inventory, I’d organize the client-requested changes like this:

**Match Wizard / Variance Modal**

1. Enforce ordered flow: Usage → Commission Rate → remaining variance logic.
2. Add step labels and completion checkboxes.
3. Do not auto-match on click; require staged review/confirmation.
4. Support cases where both usage and rate issues exist simultaneously.
5. Use smaller buttons, “or” separators, and helper text.
6. Show before-submit previews of changed values.
7. Highlight changed values with yellow-style background for accessibility.
8. Align expected vs actual fields vertically; widen modal if needed.

**Many-to-One Match Wizard Modal**

1. Make it visually match the newer modal style.
2. Replace old selected-line/schedule layout with deposit preview + schedule preview layout.
3. Remove Selection / Allocation / Validation / Apply bubbles.
4. Make Edit Allocation the primary action.
5. Keep Bundle visible when valid/applicable.
6. Pre-populate and highlight usage actual / commission actual fields.
7. Collapse redundant “what changed” content into one unified preview area.
8. Auto-run validation where possible and surface plain-language errors.
9. Block bundles when commission rates differ.
10. Block cross-deal matches and clear stale selections after successful matching.

## 9. Two items I would still mark for clarification

1. **Whether “Step 3 – Commission Amount” needs its own visible modal state** or is just residual logic handled through the flex-schedule path. March 11 describes it both as a step and as something that may effectively collapse into the Step 1 flex path.

2. **Whether Bundle should always be shown or only shown conditionally when allowed.** March 11 says not to hide it, but February 17 adds the hard business rule that bundling is invalid when commission rates differ, so the safest interpretation is “visible when applicable, blocked with explanation when invalid.”

I can turn this into a clean backlog-ready ticket group next.
