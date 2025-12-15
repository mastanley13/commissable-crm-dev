# Reconciliation Dropdown Options – Deposit Line Items & Suggested Revenue Schedules

## 1. Scope

This document defines the **status dropdown options and behaviors** on the Reconciliation Workbench for:

- **Top table:** Deposit Line Items (for a single deposit)
- **Bottom table:** Suggested Revenue Schedule Matches (for the selected deposit line)

It is derived from:

- *Commissable – Reconciliation SOW / Exhaustive Workflow*:contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
- *Workflow Overview & Guide – Reconciliation* (DB schema for deposit_line_items):contentReference[oaicite:2]{index=2}
- *Commissable Summary & Transcript – 12‑02‑25* (reconciliation UI review call):contentReference[oaicite:3]{index=3}:contentReference[oaicite:4]{index=4}

---

## 2. Underlying Status Model (From Specs & Calls)

### 2.1 Conceptual line‑level statuses (SOW)

The reconciliation SOW defines a shared line‑level status model (for deposit lines and/or revenue schedules):

> **Line-level:** `Unmatched`, `Suggested`, `Partially Paid`, `Settled (not Reconciled)`, `Underpaid`, `Reconciled`:contentReference[oaicite:5]{index=5}

Deposit-level and schedule-level behavior:

- **Deposit:** flips to `Reconciled` when *all* lines are allocated (including Flex/CB).:contentReference[oaicite:6]{index=6}
- **Revenue schedule:** status closes upon reconciliation; single reconciliation per schedule unless admin reopens.:contentReference[oaicite:7]{index=7}

### 2.2 Deposit line item DB status (schema)

The DB schema for `deposit_line_items` is:

```sql
status ENUM('Unmatched', 'Matched', 'Split', 'FLEX', 'Exception') DEFAULT 'Unmatched'
