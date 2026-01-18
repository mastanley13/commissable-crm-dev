# Other Fields - Comma-Separated Values Plan

**Project:** Commissable CRM  
**Date Created:** 2026-01-18  
**Status:** Draft brainstorming plan (no implementation yet)

## Goal

Allow users to enter multiple values (comma-separated) for the following "Other" fields so matching can succeed even when vendors/customers change identifiers without notice:

- Other - Product Name
- Other - Part Number
- Other - Product Description
- Other - Account ID

## Scope (high level)

- Frontend: input UX, display, validation, and edit flows for the four fields above.
- Backend: data model changes, API payloads, parsing/normalization, search/filtering, and matching logic.
- Data migration: preserve existing single values and enable multi-value storage.
- Imports/exports: CSV mapping and display consistency.

## Discovery (what to inventory first)

- UI surfaces that render or edit the "Other" fields:
  - Product create/edit (Other - Product Name/Part Number/Description)
  - Opportunity product detail and line-item edit/create
  - Tickets list + create/edit
  - Revenue schedules list/detail
  - Reconciliation deposit line items/detail
  - Opportunities list/detail identifiers
  - Accounts/Contacts detail (Other - Account ID)
- API routes, helpers, and matching logic that read/write these values.
- Any label-based mapping for imports/exports (e.g., CSV headers).

## Key decisions to make early

- Storage model (string, array column, or normalized table).
- Input parsing rules (trim, de-dupe, case normalization, empty entries).
- Whether to allow commas inside values (quoting/escaping) or explicitly disallow.
- Limits (max items, max length per item, total length).
- Display format (joined string, chips/tags, "first + N more").
- Backward compatibility strategy for existing API consumers.

## Data model options (DB + Prisma)

### Option A: Keep existing string columns and store raw comma-separated text
- Pros: minimal schema change; lowest migration risk.
- Cons: matching/searching is less precise; harder to index; parsing needed in many code paths.

### Option B: Add array columns (Postgres text[])
- Example fields (names TBD): `accountIdVendorValues`, `productNameVendorValues`, `partNumberVendorValues`, `productDescriptionVendorValues`
- Pros: structured storage, easier "any match" queries, clear parsing boundary.
- Cons: schema change + migration; need Prisma list field support + indexes.

### Option C: Add a normalized child table for values
- Example: `OtherFieldValue` with `entityId`, `fieldKey`, `value`, `valueNormalized`.
- Pros: flexible, queryable, indexable, scalable.
- Cons: larger code changes; more joins; bigger migration effort.

**Recommendation to evaluate:** Option B if we want low-medium effort with good search/matching support; Option C if we expect heavy matching/analytics and long-term extensibility.

## Backend plan (API + matching + DB)

1. **Schema design**
   - Decide storage model (A/B/C above).
   - Add new columns/tables and indexes for fast matching (GIN for arrays, or btree for normalized values).

2. **Normalization utility**
   - Implement shared parsing helper: `splitCsvValues(raw: string) => string[]`
   - Trim whitespace, drop empties, de-dupe, normalize casing for match keys.
   - Define a single canonical "display string" helper (join with ", ").

3. **API payloads**
   - Accept string input (comma-separated) from existing forms.
   - Optionally add array fields in response payloads for new UI use.
   - Preserve existing string fields for backward compatibility.

4. **Matching and search logic**
   - Update matching engine to compare against any stored value.
   - Update filters and search endpoints to query arrays/normalized values.
   - Ensure case-insensitive matching is consistent across entities.

5. **Imports/exports**
   - CSV import: parse comma-separated values into arrays (or keep raw string if Option A).
   - CSV export: join arrays into comma-separated display strings.
   - Update mapping tables to keep header labels unchanged.

6. **Data migration**
   - Backfill arrays/tables from existing single values.
   - Decide whether to split existing values on commas or treat as single value.
   - Ensure migration is non-destructive and reversible.

## Frontend plan (UX + forms + display)

1. **Input UX**
   - Update helper text/placeholder: "Enter multiple values separated by commas".
   - Optional: chips/tags input for clarity (still stored as comma-separated).
   - Validate and show errors for too many items or overly long entries.

2. **Edit/save behavior**
   - On save: normalize input to canonical list (trim/de-dupe).
   - On load: render canonical display string (or tokens).
   - Preserve existing single-value edit behavior.

3. **Display**
   - Table cells: show joined list, or first value + "and N more" tooltip.
   - Detail views: show full list, optional tag layout for readability.

4. **Filtering and sorting**
   - Filters should match any value in the list.
   - Sorting: decide whether to sort by first value or concatenated string.

## Risk and compatibility considerations

- Backward compatibility for API consumers that expect a single string.
- Existing saved filters/columns should not break if field IDs remain unchanged.
- Matching logic must remain consistent with "Other" vendor-first precedence.

## QA and validation checklist (draft)

- Create/edit flows accept multiple values for all four fields.
- Values persist correctly and display consistently across list/detail views.
- Filtering/search returns matches for any of the stored values.
- Reconciliation matching finds records when account ID/product values change.
- CSV import/export round-trips the values without loss.

## Open questions

- Do we need to support quoted values with commas inside?
- What are acceptable max counts and lengths per field?
- Should we store normalized values for matching separately from display values?
- Should we allow space-separated or semicolon-separated values as fallback?

