Executive summary (what FLEX is “for”)

FLEX Products / FLEX Schedules are temporary revenue schedules created during reconciliation to handle:

Unmatched deposit lines (no confident match to existing schedules)

Overages (deposit exceeds expected)

Unknown products (new service not in catalog)

Bonuses / one-time commissions

Chargebacks / reversals (negative deposits)

They ensure:

The deposit can still be fully processed and reconciled at the deposit level

Exceptions are captured in a dedicated queue for management review

Everything is auditable and reportable (FLEX tracker, aging, etc.) 

Revenue Reconciliation Specific…

Workflow Overview and Guide - R…

Core spec rules for when FLEX is created
1) Confidence / “no match” path

If matching confidence is below the threshold, the spec explicitly calls for creating a FLEX schedule:

Below 70% confidence = No match → create FLEX schedule 

Revenue Reconciliation Specific…

2) Variance / threshold-driven overage path

FLEX is also created when the system does identify the likely schedule, but the overage exceeds the configured variance threshold (example given: 30% threshold; 50% overage triggers FLEX for the difference). 

Workflow Overview and Guide - R…

Workflow Overview and Guide - R…

FLEX types (taxonomy)

Milestone 3 explicitly defines FLEX types:

FLEX-O = Overage (customer paid more)

FLEX-U = Underpayment (customer paid less)

FLEX-B = Bonus (unexpected commission)

FLEX-CB = Chargeback (negative amount) 

Revenue Reconciliation Specific…

Note: Other docs also discuss chargebacks/reversals as “special schedules,” with naming tags (below).

Naming conventions (how FLEX schedules appear)

The reconciliation guide defines naming conventions:

Standard schedule: RS-1004321

FLEX: RS-1004321-F

Chargeback: RS-1004321-CB

Chargeback reversal: RS-1004321-CB-REV 

Workflow Overview and Guide - R…

FLEX auto-configuration (the “default field values”)

Milestone 3 spells out the FLEX auto-config rules:

Quantity = 1 (always)

Price = overage amount

Commission Rate = 100% if commission-only

Schedule Date = previous month’s 1st 

Revenue Reconciliation Specific…

Important conflict to resolve (spec mismatch)

The “Exhaustive Workflow (SOW)” states FLEX overpayments:

Auto-create Flex schedules when deposit exceeds expectations

Default date = 1st of current month (user-editable pre-reconciliation) 

Commissable - Reconciliation - …

So there is a document conflict on the FLEX schedule default date:

Milestone 3: “Previous month’s 1st” 

Revenue Reconciliation Specific…

Exhaustive SOW: “1st of current month” 

Commissable - Reconciliation - …

Strong recommendation: pick one rule and lock it as the controlling behavior (ideally in your MSAP/decision log). If you want consistency with “schedule dates always 1st-of-month” while reflecting that the deposit is for the prior commission period, previous month’s 1st is usually the cleaner accounting interpretation—but the SOW explicitly says current month’s 1st, so you need to choose and standardize.

How FLEX fits into the reconciliation workflow
Step-level behavior (line settlement → deposit reconcile)

The reconciliation guide describes the operational flow:

User (or system) settles each deposit line:

Apply suggested matches within tolerance (adjust original schedule)

Create FLEX for overages/out-of-threshold or unknown items

Result: original + FLEX schedules are considered handled/“settled” 

Workflow Overview and Guide - R…

Once all lines are handled:

System prompts to “Accept all matches and reconcile deposit?”

Deposit and line items become Reconciled

Revenue schedules become Reconciled when balances hit $0; remaining balances stay Underpaid 

Workflow Overview and Guide - R…

Required management controls

All FLEX items are required to go through management review:

“All FLEX products require management review”

Admin can convert to permanent schedule or apply to existing schedule

Audit trail maintained; urgent notifications sent for FLEX creation 

Workflow Overview and Guide - R…

Chargebacks and reversals (negative deposits)

Specs are explicit that negative amounts are chargebacks and should not mutate reconciled schedules:

“Negative amounts = chargebacks” is a critical rule 

Revenue Reconciliation Specific…

Chargeback scenario explicitly states: never modify original reconciled schedule, instead create a new chargeback schedule; requires admin approval; urgent notification; reversal creates CB-REV and links for audit trail 

Workflow Overview and Guide - R…

Permissions and who can create FLEX

Milestone 3 RBAC indicates:

Accounting has full reconciliation access, including Create FLEX schedules and process chargebacks.

Sales reps have no reconciliation access. 

Revenue Reconciliation Specific…

Operational artifacts you should expect in the product

From the SOW/UI notes, FLEX needs first-class UI + reporting treatment:

Workbench action includes Create Flex

Visual indicators for Flex/CB/CB-REV

Flex Tracker: log with aging and assignment; filters by status/age/amount 

Commissable - Reconciliation - …

“Definition-level” wording you can reuse in docs / tickets

A clean, spec-aligned definition:

FLEX schedule/product = a temporary Revenue Schedule created during reconciliation to capture deposit amounts that cannot be confidently matched or that represent an overage/bonus/chargeback. FLEX items must be tracked in a management review queue with notifications, aging, and audit trail, and later resolved by converting to a proper product/schedule or applying/adjusting against an existing schedule.

### 

What aligns well with the written specs
1) “Create Flex” is an action on reconciliation/deposit lines

The workflow specs explicitly list Create Flex as a reconciliation action (alongside Approve, Split, FIFO, Mark Underpaid, etc.). So the existence of a button that operates on a selected deposit line item aligns with the intended workflow.
Evidence: “Actions: … Create Flex …” in the Reconciliation Workbench UI notes.

Commissable - Reconciliation - …

2) Creating a FLEX schedule for unmatched items is explicitly required

Milestone 3 states: “FLEX schedules for all unmatched” as a critical rule, and also describes a no-match flow where the system should create a FLEX schedule.
Evidence: Critical business rule “FLEX schedules for all unmatched.”

Revenue Reconciliation Specific…


Evidence: “Below 70% = No match (create FLEX schedule)” / “For unmatched deposits, create FLEX schedules.”

Revenue Reconciliation Specific…

Your behavior (“uses the currently selected deposit line item… creates a flex revenue schedule… auto-allocates it to the line”) matches this core intent.

3) Treating negative amounts as chargebacks is explicitly required

Specs consistently say negative amounts/deposits → chargebacks and require creation of a -CB schedule (and -CB-REV for reversals).
Evidence: Critical business rules include “Negative amounts = chargebacks.”

Revenue Reconciliation Specific…


Evidence: “Negative deposit: Create Chargeback RS (-CB); reversal creates CB-REV…”

Commissable - Reconciliation - …


Evidence: FLEX types include FLEX-CB = Chargeback (negative amount).

Revenue Reconciliation Specific…

So your rule “if the line has negative usage or commission, treat it as Create Chargeback” is consistent with the spec’s direction (negative → CB).

4) Auto-linking the created FLEX schedule back to the deposit line is consistent with the spec’s described flow

The “Workflow Overview and Guide” explicitly shows FLEX creation as a transaction that creates a schedule and updates the deposit line to link/match it (status + matched_schedule_id), plus review queue + notifications.
Evidence: Example workflow code shows updating deposit line items with matched_schedule_id / match_method: 'FLEX', then adding to review queue + notifying.

Workflow Overview and Guide - R…

Your summary’s “auto-allocates (matches) that schedule to the deposit line” aligns with that expected linkage model.

5) The concept of FLEX covering “unknown product” scenarios is aligned with meeting discussion

In the Jan 6, 2026 meeting summary, FLEX is discussed specifically as a mechanism for unknown product / outside tolerance cases to “mimic” and capture a deposit line item.
Evidence: “unknown product… create a flex product to mimic that…”

Commissable_Transcript_MeetingS…

So your implementation’s “create/reuse a Flex Product product for that customer account” fits the described business intent (even if “reusing a product” is an internal implementation choice).

Where your summary is missing spec requirements or may conflict
A) Schedule dating rule is a likely mismatch unless you implemented a 1st-of-month rule

The specs are very explicit that schedules are 1st of the month, and they give FLEX-specific default dating — but they conflict with each other:

Milestone 3: FLEX auto-configuration says “Schedule Date Previous month’s 1st”.

Revenue Reconciliation Specific…

Exhaustive Workflow SOW: FLEX overpayment section says default date = 1st of current month (user-editable pre-reconciliation).

Commissable - Reconciliation - …

Milestone 3 also states “Revenue Schedule Date (always 1st of month)” generally.

Revenue Reconciliation Specific…

Your summary does not mention what date the FLEX/CB schedule is created with.

Why this matters:
If your created flex schedule date is set to the deposit line’s payment date (or “today”), it would violate both versions of the spec (previous month’s 1st vs current month’s 1st) and also violate the broader “always 1st of month” rule.

Revenue Reconciliation Specific…

Revenue Reconciliation Specific…

✅ Conclusion: I can’t confirm compliance here; this is a must-verify area.

B) FLEX “auto-configuration” fields are not addressed in your summary

Milestone 3 specifies several default configuration rules for FLEX schedules:

Quantity = 1 (always)

Price = overage amount

Commission Rate = 100% if commission-only

Schedule Date = previous month’s 1st

Revenue Reconciliation Specific…

Your implementation description says:

“creates a new flex revenue schedule with expected usage/commission equal to the deposit line…”

That might be compatible depending on your data model, but it does not confirm whether you’re meeting these specific rules (Quantity, Price, Commission Rate). In particular, the spec calls out a special commission-only rule (rate=100%).

Revenue Reconciliation Specific…

Also, the Exhaustive Workflow doc separately calls out commission-only handling:

“If no RS found, create Flex with Usage = Commission, Rate = 100%.”

Commissable - Reconciliation - …

✅ Conclusion: Your summary suggests you’re setting expected usage/commission, but it’s unclear whether you’re implementing Quantity/Price and the commission-only 100% rule as specified.

C) Management review queue + notifications are explicit requirements, but not mentioned

Multiple specs state that FLEX creation should be queued for review / tracked and that admins get notified.

Workflow Overview explicitly says: “Queue all FLEX products for management review” + “Send notifications…”

Workflow Overview and Guide - R…

The example flow shows inserting into a review queue and sending notifications after creating the schedule.

Workflow Overview and Guide - R…

The Exhaustive Workflow doc also references admin notifications/review tasks/aging/tracking for Flex schedules.

Commissable - Reconciliation - …

Your summary does not mention:

creating a review-queue record

triggering notifications

ensuring it appears in Flex tracking/aging views

✅ Conclusion: Unless these happen elsewhere in your system (outside the button handler), this looks like a spec gap.

D) Chargeback approval/permissions may conflict with “auto-allocate”

One of the written scenarios explicitly says a chargeback schedule:

must not modify the original reconciled schedule

“Requires administrative approval before application”

urgent notification to finance team

Workflow Overview and Guide - R…

The Exhaustive Workflow also calls out that the role/permissions matrix must govern who can approve chargebacks.

Commissable - Reconciliation - …

Your implementation summary says the chargeback flow:

“…creates a Flex Chargeback product + revenue schedule, then auto-allocates (matches) that schedule to the deposit line…”

If “auto-allocates” = fully applied without an approval gate, then this is potentially inconsistent with the “admin approval before application / approve chargebacks” expectation.

Workflow Overview and Guide - R…

Commissable - Reconciliation - …

✅ Conclusion: This is a possible mismatch unless:

only admins can click it, or

the allocation is created in a pending/unapproved state until an admin approves/finalizes.

E) Your “attach into deal context if exactly one schedule selected” is not explicitly specified

Your last bullet says:

If exactly one revenue schedule is selected… attach flex schedule into that deal context … only if same customer account.

I did not find an explicit requirement that FLEX creation should depend on “exactly one selected schedule.” However, the specs do indicate FLEX schedules can/should carry contextual links like opportunity_id and be handled within an opportunity/product context (example flexSchedule object includes opportunity_id, and the SOW discusses propagation within Opportunity/Product context).

Workflow Overview and Guide - R…

Commissable - Reconciliation - …

So I’d classify this as:

ASSUMED acceptable enhancement if it adds context and doesn’t block creating the FLEX schedule when context is ambiguous.

Potential risk if it prevents creation when multiple schedules are selected but the deposit line still needs a FLEX exception.

✅ Conclusion: Not a clear violation, but it’s not directly specified. I’d treat this as an implementation choice that should be validated against intended UX.