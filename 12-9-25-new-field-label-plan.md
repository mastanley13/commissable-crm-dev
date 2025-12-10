# Field Label Search/Replace Patterns (Based on CSV)

This plan uses **Commissable - Global - Fields by Page(Field Label to Adjust).csv** as the single source of truth.
The file defines 70 specific field-label changes that collapse to **16 unique label patterns**.

All automated search/replace or validation scripts should use the arrays below and **must not** introduce
patterns that are not present in the CSV (for example, `Account ID - Distributor` is intentionally excluded).

```bash
# Unique old label patterns (from CSV)
OLD_PATTERNS=(
  "Account ID - House"
  "Account ID - Vendor"
  "Customer ID - Distributor"
  "Customer ID - House"
  "Customer ID - Vendor"
  "Order ID - Distributor"
  "Order ID - House"
  "Order ID - Vendor"
  "Part Number - House"
  "Part Number - Vendor"
  "Product Description - House"
  "Product Description - Vendor"
  "Product Family - Vendor"
  "Product Name - House"
  "Product Name - Vendor"
  "Product Subtype - Vendor"
)

# Corresponding new label patterns (same index as OLD_PATTERNS)
NEW_PATTERNS=(
  "House - Account ID"
  "Vendor - Account ID"
  "Distributor - Customer ID"
  "House - Customer ID"
  "Vendor - Customer ID"
  "Distributor - Order ID"
  "House - Order ID"
  "Vendor - Order ID"
  "House - Part Number"
  "Vendor - Part Number"
  "House - Product Description"
  "Vendor - Product Description"
  "Vendor - Product Family"
  "House - Product Name"
  "Vendor - Product Name"
  "Vendor - Product Subtype"
)
```

**Usage note:** when performing refactors, iterate over indices and replace each `OLD_PATTERNS[i]`
with `NEW_PATTERNS[i]` so the mapping stays consistent with the CSV.

---

## Implementation Status (Dec 10, 2025)

- All 70 label instances from the CSV have been updated in the codebase to use the `[Entity] - [Field]` pattern, using the mappings above.
- `FIELD_LABEL_REFACTOR_PLAN.md` validation script now uses this same `OLD_PATTERNS` list as its source of truth.
- Search verification: `rg` over `*.tsx`, `*.ts`, and `*.sql` shows **no remaining occurrences** of any `OLD_PATTERNS` strings.
- New labels (e.g., `House - Order ID`, `Vendor - Product Name`, `Distributor - Customer ID`) are present in the expected components, pages, Prisma migration comments, mock data, and helper scripts.
- TypeScript build (`npx tsc --noEmit`) currently fails only on an unrelated issue in `prisma/seed.ts` (`houseType` vs `houseRepType`); this refactor did not touch that file.
- Out-of-scope labels such as `Account ID - Distributor` remain unchanged by design and are not part of these patterns.
