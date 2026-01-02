# Opportunity Stage Rules

This document reflects the current implemented behavior in:
- `lib/opportunities/stage.ts`
- `lib/opportunity-stage.ts`
- `app/api/opportunities/[opportunityId]/route.ts`

## Stage Options (Dropdown Order)

| Stage (value) | Label (UI) | Derived `Opportunity.status` | Manually selectable? | Notes |
|---|---|---:|---:|---|
| `Qualification` | Qualification | `Open` | Yes | Standard pipeline stage. |
| `Discovery` | Discovery | `Open` | Yes | Standard pipeline stage. |
| `Proposal` | Proposal | `Open` | Yes | Standard pipeline stage. |
| `Negotiation` | Negotiation | `Open` | Yes | Standard pipeline stage. |
| `OnHold` | On Hold | `OnHold` | Yes (with constraints) | Blocked if the opportunity is already in a “won” status (see “Transition Validation”). |
| `ClosedLost` | Closed Lost | `Lost` | Yes | Terminal stage for most flows. Cannot be reactivated once fully closed out. |
| `ClosedWon_Provisioning` | Closed Won - Provisioning | `Won` | Yes | “Won” but before billing is active/ended. Also used as the fallback for legacy `ClosedWon`. |
| `ClosedWon_Billing` | Closed Won - Billing | `Won` | No (auto-managed) | Stage is set automatically when any product is `ActiveBilling`. |
| `ClosedWon_BillingEnded` | Closed Won - Billing Ended | `Won` | No (auto-managed) | Stage is set automatically when all non-cancelled products are `BillingEnded`. Terminal for reactivation. |

## Auto-Managed Stage Rules (Products → Opportunity Stage)

When an opportunity has **at least one** product line item (`Opportunity.products`):
- If **any** product has status `ActiveBilling` → stage becomes `ClosedWon_Billing`
- Else if **all** non-cancelled products are `BillingEnded` → stage becomes `ClosedWon_BillingEnded`
- Else → stage becomes `ClosedWon_Provisioning`

When an opportunity has **no** products:
- Stage generally stays as-is.
- If stage is legacy `ClosedWon`, stage is normalized to `ClosedWon_Provisioning` during recalculation.

## Transition Validation (Server-Side)

The API rejects manual stage changes in these cases:
- If any product is `ActiveBilling`, stage is **locked** to `ClosedWon_Billing`.
- If all non-cancelled products are `BillingEnded`, stage is **locked** to `ClosedWon_BillingEnded`.
- `ClosedWon_Billing` and `ClosedWon_BillingEnded` are always rejected for manual selection because they are auto-managed.
- Setting `OnHold` is rejected if the existing stage currently derives a `Won` status (you must “reopen” first by moving to a non-won stage).
- Setting legacy `ClosedWon` is normalized to `ClosedWon_Provisioning`.

## Reactivation Rule (Server-Side)

The API rejects reactivating (`active = true`) an opportunity when the stage is:
- `ClosedLost`
- `ClosedWon_BillingEnded`

