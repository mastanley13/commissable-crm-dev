# Flex and M2M User Guide (Plain Language)

Date: 2026-02-24  
Audience: Clients, operations users, reconciliation users, managers

## What this guide covers

This guide explains two related but different features:

1. **Flex Product (Exception Workflow)**: used during reconciliation when a deposit line cannot be cleanly matched.
2. **M2M Schedule Extension (Month-to-Month)**: used when a customer keeps billing after planned schedules are exhausted.

These features solve different problems. They should not be treated as the same workflow.

---

## Quick summary

- Use **Flex Product** when money needs to be tracked now, but product/schedule details still need review.
- Use **M2M** when billing continues normally into new months and schedules need to be extended automatically.

If your team asks, "Is this an exception or normal continuation?"
- Exception -> Flex Product
- Normal continuation -> M2M

---

## Part 1: Flex Product (Exception Workflow)

## What problem Flex Product solves

Sometimes a deposit line does not fit cleanly into existing schedules.  
Instead of losing track of money or forcing a bad match, the system creates a **Flex Product schedule** so the amount is captured and reviewed.

## When Flex Product is used

Typical cases:
- Unknown or unmappable line (no confident match)
- Overage outside tolerance (allocation is higher than expected and requires review)

## When Flex Product is not used

- Minor overage within tolerance (system uses adjustment workflow)
- Negative line items (handled by chargeback workflows)
- Regular monthly continuation (handled by M2M, not Flex)

## How users interact with Flex Product

### Step A: Create/trigger Flex Product

From deposit reconciliation:
- Select a line item
- If unmatched or overage requires exception handling, choose Flex Product path

### Step B: System captures and routes the exception

The system:
- Creates a Flex-classified schedule for the exception amount
- Links the source context (deposit/line) for traceability
- Adds a queue item in **Flex Review Queue**
- Keeps the item visible until someone resolves it

### Step C: Resolve in Flex Review Queue

A manager/reconciler resolves the item by choosing one of the supported outcomes:
- **Apply to existing schedule** (move amount into a known schedule)
- **Convert to regular schedule** (assign to a real product/schedule path)
- **Bonus commission** (when this is the correct business outcome)

## What users should verify for each Flex item

- Exception amount is captured and not lost
- Queue item is created and assigned
- Resolution path is documented (who resolved, what decision was made)
- Final schedule outcome matches business intent

---

## Part 2: M2M Schedule Extension (Month-to-Month)

## What problem M2M solves

When a contract schedule sequence ends but billing continues, teams should not manually create schedules each month.

M2M automatically creates the next month schedule so normal billing can continue without gaps.

## M2M behavior in plain terms

- If a product is still billing and no schedule exists for the target month, M2M creates one.
- Running the process again for the same month does not create duplicates.
- Products can move from active billing into an explicit month-to-month state.
- If no deposits are seen for the configured period, product status can move to billing ended.

## How users interact with M2M

Most users do not manually edit each M2M schedule creation event.
Instead, they:
- Confirm product billing state is correct
- Trigger/check the M2M job as needed in test or operations workflows
- Verify schedule appeared for the new month
- Confirm no duplicate schedules were created

---

## Flex vs M2M (side-by-side)

| Topic | Flex Product | M2M Schedule Extension |
|---|---|---|
| Purpose | Exception handling | Normal billing continuation |
| Trigger | Unmatched/overage exception | Ongoing billing after schedule exhaustion |
| User flow | Reconciliation + queue resolution | Scheduled job + monthly verification |
| Typical owner | Reconciliation/Finance ops | Billing ops / platform automation |
| End state | Exception resolved to a clear schedule outcome | New month schedule exists and billing continues |

---

## Roles and responsibilities

### Reconciliation users
- Identify lines that need Flex handling
- Capture required notes/context
- Route to queue if unresolved

### Managers/approvers
- Review open Flex items
- Choose proper resolution outcome
- Ensure auditability and consistency

### Billing/ops users
- Monitor month-to-month schedule generation
- Confirm no duplicate monthly schedules
- Confirm product lifecycle status transitions are correct

---

## Common questions

### "Why did I get a Flex item instead of a regular match?"
Because the system detected an exception condition where automatic normal matching would be unreliable or misleading.

### "Why did a new monthly schedule appear without manual creation?"
Because M2M continuation is designed to auto-create next-month schedules for ongoing billing products.

### "Are Flex Product and M2M the same thing?"
No. Flex handles exceptions; M2M handles expected continuation.

---

## Best practices for client teams

- Keep terminology consistent in training:
  - "Flex Product" for exceptions
  - "M2M Schedule Extension" for continuation
- Review Flex Queue daily during active reconciliation periods
- Use a monthly check for M2M output (created count, no duplicates, lifecycle status)
- Capture screenshot evidence and IDs for high-impact reconciliations

---

## Where to go next

- For detailed operator steps: `docs/runbooks/Flex_Product_Guide.md`
- For M2M operations and job behavior: `docs/runbooks/M2M_Schedule_Extension_Guide.md`
- For UAT checklists (TC-12 / TC-13): `docs/runbooks/TC12_TC13_Flex_M2M_UAT_One_Page_Checklist.md`

