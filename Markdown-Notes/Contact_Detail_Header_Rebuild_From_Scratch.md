# Contact Detail — Top Section Rebuild Plan (Alignment Parity)

Purpose: Rebuild the Contact Detail header from scratch so its two-column label/value layout aligns exactly with the pattern used by Opportunity, Account, Product, and Revenue Schedule pages.

## Goals
- Perfect left/right row alignment at all viewport sizes.
- Shared label column width and consistent value widths (`max-w-md`).
- Baseline-aligned labels; single-line value boxes with truncation.
- Preserve existing field content and the Active (Y/N) toggle position.
- Keep header height behavior consistent with others (`min-h-[300px]`).

## Non‑Goals
- Moving, renaming, or removing fields.
- Changing API, data shape, or validation.
- Styling tabs or body tables.

## Current Gaps (What breaks alignment today)
- Two independent vertical stacks in the header, which allows rows to drift vertically when one side is taller.
- Mixed widths: some values stretch (`flex-1 max-w-none`) while others cap at `max-w-md`.
- Labels not consistently baseline aligned.
- Complex left rows (Name, Account+Active, Work Phone+Ext) create taller rows than the right side.

## Design Decisions
- Use a single CSS grid that lays out rows in pairs — left row then right row — so both cells occupy the same grid row.
- Keep a fixed label column width across all detail pages: `180px`.
- Constrain value content to `max-w-md` and wrap value containers with `min-w-0` to allow truncation.
- Keep inline extras (Active/Ext clusters) inside the value cell as `shrink-0` elements after the main box.
- Maintain header container: `rounded-2xl bg-gray-100 p-3 shadow-sm min-h-[300px]`.

## Layout Spec
- Header container: `div.rounded-2xl.bg-gray-100.p-3.shadow-sm.min-h-[300px]`
- Grid: `div.grid.gap-6.lg:grid-cols-2` where children are ordered row pairs:
  - Order of children: `[Row1-Left, Row1-Right, Row2-Left, Row2-Right, ...]`
  - Each child is a FieldRow (label+value) using the shared pattern.

### Shared Classes
- `fieldLabelClass`:
  - `text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap`
- `fieldBoxClass` (read-only value box):
  - `flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis tabular-nums`
- FieldRow wrapper grid:
  - `grid items-start gap-3 sm:grid-cols-[180px,minmax(0,1fr)]`
- Value wrapper shell inside FieldRow:
  - `div.min-w-0` (prevents overflow from pushing layout)

## Components To Create
- `components/detail/FieldRow.tsx` (shared by all pages)
  - Props: `{ label: string; value: ReactNode; labelExtra?: ReactNode }`
  - Renders the shared grid with the label and a `min-w-0` value container.
- `components/detail/RowPair.tsx`
  - Props: `{ left: FieldRowProps; right?: FieldRowProps }`
  - Renders two FieldRows as siblings in the main header grid so they share the same row.
- `components/contact-header-v2.tsx`
  - Pure display (read-only) header built from RowPair.
  - Mirrors Opportunity/Product header spacing and rhythm.

## Row Mapping (Read‑only)
Render these in order to guarantee per-row alignment:

1. Left: Name (First, Last, Suffix)
   - Value: inner 3-col grid `grid grid-cols-[1fr,1fr,6rem] gap-2 max-w-md`
   - Each cell uses `fieldBoxClass`.
   Right: Job Title
   - Value: single `fieldBoxClass`.

2. Left: Contact Type
   Right: Email Address

3. Left: Account Name + Active (Y/N)
   - Value: `div.flex.items-center.gap-2.w-full.max-w-md`
     - Main: `fieldBoxClass` for account name
     - Extra: `div.flex.items-center.gap-2.shrink-0 ...` with label and switch
   Right: Shipping Address
   - Value: single `fieldBoxClass` (one line; truncates long addresses)

4. Left: Work Phone + Ext
   - Value: `div.flex.items-center.gap-2.w-full.max-w-md`
     - Main: `fieldBoxClass`
     - Extra: `div.flex.items-center.gap-2.shrink-0` with `Ext` label + small box
   Right: Contact ID
   - Value: `fieldBoxClass`

5. Left: Mobile Phone
   Right: Description
   - Value: `fieldBoxClass`; if multiline is needed later, keep single-line here and show full text in Details tab.

Notes:
- If any right-side field occasionally needs two lines, add an explicit `min-h-[44px]` to both members of that row to maintain visual parity.

## Editable Header Parity
- Create `components/contact-header-edit-v2.tsx` using the same RowPair structure.
- Inputs/selects keep the same widths (`w-full max-w-md`).
- Use the existing `EditableField.*` controls; the layout should be identical to read-only.
- Native date or long text controls remain single-line within the header; longer editing goes to body tabs.

## Implementation Steps
1. Build shared primitives
   - `components/detail/FieldRow.tsx`
   - `components/detail/RowPair.tsx`
   - Export shared classes from a small `components/detail/shared.ts` (fieldLabelClass, fieldBoxClass).
2. Create `contact-header-v2.tsx` (read-only)
   - Implement the five RowPairs listed above.
3. Create `contact-header-edit-v2.tsx` (editable)
   - Same structure and widths; reuse Existing `EditableField` controls.
4. Wire up behind a feature flag (optional)
   - Add a prop `useV2Header?: boolean` on the page and render the new header when enabled.
5. Remove the flag and old header after review.

## Acceptance Criteria
- Every left/right pair shares the same grid row; no vertical drift across the entire header.
- Labels align baseline and share the same width.
- Value fields cap at `max-w-md` with truncation and no horizontal overflow.
- Active toggle and Ext cluster do not shift row height on the opposite side.
- Header height matches others (`min-h-[300px]`).
- No layout shift between read-only and editable modes.

## Risks & Mitigations
- Multi-line values (Description/Address) can break row parity.
  - Mitigation: keep single-line in header; expand within Details tab.
- Long organization names/IDs
  - Mitigation: `min-w-0 + text-ellipsis` on value wrappers.

## QA Checklist
- Compare Contact vs Opportunity/Account/Product at 1280px, 1440px, and 1920px widths.
- Verify truncation behavior on long values.
- Verify tab order and keyboard focus within the header.
- Confirm no scrollbars appear within the header at common widths.

## Rollout
- Implement V2 components in parallel.
- Enable for internal tenant first via prop/flag.
- After approval, switch default to V2 and remove the old header.

