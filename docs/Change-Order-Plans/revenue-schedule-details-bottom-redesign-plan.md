# Revenue Schedule Details – Bottom Section Redesign

Owner: Engineering + Design
Target: Bottom section of Revenue Schedule Details (Financial Summary, Opportunity Details, Product Details, Reconciled Deposits, Payments Made, Activities & Notes)

## Goal
Create a unified, attractive, and consistent presentation across all subsections. Reduce visual drift between tabs, establish a common layout skeleton, improve readability, and preserve existing functionality (filters, tables, and actions).

## Current State (repo context)
- Container: `components/revenue-schedule-details-view.tsx` renders the top area and mounts `RevenueScheduleSupportingDetails` below the summary row.
- Sections and content: `components/revenue-schedule-supporting-details.tsx` implements the left rail navigation and highly custom layouts per section (custom grids for details, bespoke tables for deposits/payments, dynamic table for activities).
- UI variance: Each section uses different table/spacing patterns, headings, and typography.

## Design Principles
- Consistent section skeleton across all tabs.
- Compact, legible typography (11–12px body, small uppercase labels), clear headers.
- Keyboard accessible; no layout shift on tab change; single-scroll region.
- Reusable primitives so other modules can later adopt the same pattern.

## Proposed UX Structure (shared for every tab)
- Section Header Row
  - Left: Title + 1-line description; optional icon.
  - Right: Contextual controls (e.g., export, add, filters). Sticky to top of the section when scrolling.
- Optional Metrics Strip (when relevant)
  - Up to 3–6 stat tiles with consistent sizing, in a single row.
- Content Body
  - Mode A: Key/Value grid with two columns (label/value) using a shared `KeyValueGrid`.
  - Mode B: Data table (shared `DataTableLite` style) with matching header/body styles.
  - Mode C: Rich panel (e.g., Financial Splits) using a pill-tab strip inside content for subviews (House, House Rep, Subagent) with the same header + two-column detail layout.
- Empty/Loading/Error states
  - Reusable `EmptyState`, `LoadingState`, `ErrorBanner` components.

## Visual Options
- Option A – Keep left rail nav; standardize the right content using the structure above.
  - Minimal interaction change; lowest risk.
- Option B – Replace left rail with horizontal tabs across the content header, and move section description under the active tab.
  - More standard “tabs” look, denser vertical space; slightly more refactor.

We can implement Option A quickly, then toggle to Option B later with a small wrapper.

## Components To Add
- `components/section/SectionContainer.tsx`
  - Props: `title`, `description`, `icon?`, `actions? (ReactNode)`, `children`, `stickyHeader?: boolean`.
- `components/section/KeyValueGrid.tsx`
  - Props: `items: Array<{ label: string; value?: ReactNode; emphasize?: boolean }>` and `columns=2`.
- `components/section/DataTableLite.tsx`
  - Lightweight, consistent table styling (thead/tbody, compact cells, numeric alignment) used by Deposits and Payments.
- `components/section/PillTabs.tsx`
  - For Financial Summary sub-tabs (House, House Rep, Subagent); controlled component.
- `components/section/EmptyState.tsx`, `components/section/ErrorBanner.tsx`, `components/section/LoadingState.tsx`.

All components keep styling tokenized via Tailwind utility classes already in use.

## Mapping Each Section
- Financial Summary
  - Header: "Financial Summary" + description.
  - Body: `PillTabs` with three tabs. Each tab renders two `KeyValueGrid` blocks (Reconciled vs Receivables) with the same line spacing and emphasis rules; optional stat tiles for Net/Gross.
- Opportunity Details
  - Body: `KeyValueGrid` with two columns; same typography and truncation.
- Product Details
  - Body: `KeyValueGrid` with two columns; same typography.
- Reconciled Deposits
  - Body: `DataTableLite` with columns: Item, Deposit Date, Payee, Product (truncate), Usage Actual, Commission Actual, Payment Method, Payment Reference.
  - Footer row for totals using the same style across tables.
- Payments Made
  - Body: `DataTableLite` with columns: Item, Payment Date, Payee, Split %, Amount Paid, Payment Method, Payment Reference.
- Activities & Notes
  - Header actions: search box, Active/Show Inactive toggle, column chooser, Create New.
  - Body: reuse existing `DynamicTable` but wrap it in `SectionContainer` so headers/filters appear identical to other tabs.

## Interaction & Accessibility
- Single scrollable content area; sticky header within section to keep actions visible.
- Keyboard focus order predictable; headings and controls labeled.
- Truncation with tooltips for long values in key/value and tables.

## Step‑by‑Step Implementation Plan
1) Component scaffold (shared primitives) – 0.6–0.9 day
   - Build `SectionContainer`, `KeyValueGrid`, `DataTableLite`, `PillTabs`, and basic empty/loading/error variants.
2) Convert Financial Summary – 0.5–0.8 day
   - Swap current custom split panels for `SectionContainer` + `PillTabs` + two `KeyValueGrid` blocks.
3) Convert Opportunity Details – 0.3–0.5 day
   - Map fields into `KeyValueGrid`.
4) Convert Product Details – 0.3–0.5 day
   - Map fields into `KeyValueGrid`.
5) Convert Reconciled Deposits – 0.4–0.6 day
   - Replace bespoke table with `DataTableLite`; keep totals row.
6) Convert Payments Made – 0.3–0.5 day
   - Replace bespoke table with `DataTableLite`.
7) Wrap Activities & Notes – 0.3–0.5 day
   - Keep `DynamicTable` but unify header/actions within `SectionContainer`.
8) Polish & QA – 0.4–0.7 day
   - Responsive checks at common breakpoints, overflow and truncation audits, focus states, skeletons/empty states.

Estimated total (Option A): 3.1–4.5 days.

Option B delta (horizontal tabs): +0.4–0.7 day to add a tabbed switcher and remove the left rail.

## Risks & Mitigations
- Visual regressions: Ship behind a feature flag or param toggle; A/B on staging.
- Table widths/truncation: Define width utilities per column type and reuse across Deposits/Payments.
- Copy length variance: Enforce truncation + title tooltips; allow 2‑line wrap for labels when needed.
- Activities API errors: Reuse existing error handling; keep consistent `ErrorBanner`.

## Acceptance Criteria
- All six sections render inside the same visual skeleton (header + optional metrics + body).
- Typography, spacing, borders, and background are consistent across sections.
- Financial Summary sub‑tabs share identical layout and behavior.
- Deposits and Payments use the same `DataTableLite` styling and totals row.
- Activities & Notes header controls match the shared header and remain visible while scrolling.
- No change to existing data sources or business calculations.

## Concrete File Touch List (planned)
- New shared components under `components/section/`: `SectionContainer.tsx`, `KeyValueGrid.tsx`, `DataTableLite.tsx`, `PillTabs.tsx`, `EmptyState.tsx`, `ErrorBanner.tsx`, `LoadingState.tsx`.
- Update `components/revenue-schedule-supporting-details.tsx` to consume new components per section.
- Update `components/revenue-schedule-details-view.tsx` (cosmetic only if needed for container spacing).
- Optional: style tokens in Tailwind config (spacing/radius aliases) if we want named tokens.

## Timeline Options
- Single sprint delivery (Option A): 3.1–4.5 days
- With Option B horizontal tabs: 3.5–5.2 days
- Staged rollout (recommended):
  1) Scaffold + Financial Summary + Opportunity/Product (Day 1–2).
  2) Deposits + Payments (Day 2–3).
  3) Activities wrap + QA + polish (Day 3–4+).

## Next Steps
- Confirm final choice of left rail vs horizontal tabs.
- Approve the component names/props and the layout wire for one tab (Financial Summary).
- Proceed with scaffold + one tab, review, then convert remaining tabs.

