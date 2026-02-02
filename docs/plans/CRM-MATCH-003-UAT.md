# CRM-MATCH-003 - UAT / QA Test Script (Comma-separated values)

Date: **2026-02-02**

Scope: comma-separated **IDs**, **Other Product Names**, and **Other Part Numbers**, including **admin edits**, **matching robustness**, **auto-fill (no overwrite)**, and **undo**.

---

## Quick reference (what fields are multi-value)

### Opportunity (Other IDs)
- `accountIdVendor`
- `customerIdVendor`
- `orderIdVendor`

### Product (Other aliases)
- `productNameVendor` (Other - Product Name)
- `partNumberVendor` (Other - Part Number / aliases)

### Deposit line sources (raw/imported)
- `DepositLineItem.accountIdVendor`
- `DepositLineItem.customerIdVendor`
- `DepositLineItem.orderIdVendor`
- `DepositLineItem.productNameRaw`
- `DepositLineItem.partNumberRaw`
- `DepositLineItem.metadata.matching.externalScheduleId` (import-mapped ID)

---

## Parsing / formatting rules (expected behavior)

- Separators: comma `,`, semicolon `;`, newline.
- Quotes supported: `"A, B"` is treated as a single token; escaped quotes supported via `""`.
- De-dupe: case-insensitive (first casing wins).
- Matching: case-insensitive.
- Storage/display: canonical comma+space join: `A, B, C` (preserves original token casing as entered/first-seen).
- Placeholders are ignored: `N/A`, `NA`, `null`, `--`.
- Max items: capped (default 25).

---

## Test cases

### TC-1: Canonicalization (admin edit)
Preconditions:
- You have an Opportunity you can edit.

Steps:
1. Open Opportunity -> Edit.
2. In “Other IDs (comma-separated)”, set Customer ID to: ` A1, a1 ; "A2, A3"\n--\nnull `
3. Save.
4. Re-open the edit modal.

Expected:
- Stored value is canonicalized and de-duped: `A1, A2, A3` (exact casing may reflect the first-seen token, but matching is case-insensitive).
- Placeholders `--` / `null` do not persist.
- Quoted `A2, A3` is treated as **two tokens** only if the quote isn’t present; with quotes it stays a single token. (In this input it is a single token that contains a comma.)

### TC-2: Matching overlap across IDs
Preconditions:
- A Revenue Schedule exists whose linked Opportunity has `customerIdVendor = "ABC, DEF"`.
- A Deposit line exists with `customerIdVendor = "def"` (different casing).

Steps:
1. Open the Deposit -> Reconciliation workbench.
2. Select the deposit line and inspect suggested candidates.

Expected:
- The schedule is treated as an exact customer-ID match because `DEF` overlaps `def`.

### TC-3: External Schedule ID participates in matching
Preconditions:
- Deposit import mapping populates `metadata.matching.externalScheduleId` for at least one line.
- There is a schedule with matching `scheduleNumber`.

Steps:
1. Run matching (auto-match or open suggestions for that line).

Expected:
- Candidate receives a strong ID signal when external schedule ID overlaps schedule number.

### TC-4: Auto-fill missing IDs on match (no overwrite)
Preconditions:
- A Revenue Schedule is linked to an Opportunity with **empty** `customerIdVendor` (null/empty).
- A Deposit line has `customerIdVendor = "CUST-1, CUST-2"`.

Steps:
1. Apply a match between the deposit line and the schedule (manual apply or auto-match apply).
2. Open the Opportunity edit modal again.

Expected:
- Opportunity `customerIdVendor` is now populated with the deposit line’s IDs (canonicalized).
- If the Opportunity already had a value, it is **not overwritten**.

### TC-5: Auto-fill missing product aliases on match (no overwrite)
Preconditions:
- A Revenue Schedule is linked to a Product where `productNameVendor` and/or `partNumberVendor` is empty.
- Deposit line has `productNameRaw` and/or `partNumberRaw`.

Steps:
1. Apply a match for that line.
2. Open Product details -> Vendor tab (or edit surfaces).

Expected:
- Missing alias fields are filled from the deposit line raw values.
- Existing alias values are not overwritten.

### TC-6: Undo auto-fill (admin only)
Preconditions:
- You are logged in as a user with `auditLogs.manage`.
- You have at least one match that triggered auto-fill (TC-4 or TC-5).

Steps:
1. Open Opportunity/Product -> History tab.
2. Find the auto-fill audit entries and click “Undo”.

Expected:
- The affected fields revert to their prior stored values.
- A new audit entry is written for the undo action.

### TC-7: Undo conflict detection (safety)
Preconditions:
- You have an auto-fill audit entry visible in History.
- You can edit the same field manually.

Steps:
1. After auto-fill, manually edit the same field to a different value and save.
2. Return to History and try to “Undo” the old auto-fill entry.

Expected:
- Undo is blocked (conflict), because the current value no longer matches the audit entry’s `newValues`.

