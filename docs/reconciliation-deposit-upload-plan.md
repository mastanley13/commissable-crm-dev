**Title**
- Reconciliation: Add "Deposit Upload List" button and new Deposit Reconciliation wizard page

**Overview**
- Goal: Update the existing Reconciliation page to include a primary button labeled "Deposit Upload List" that routes to a new page which mirrors the layout and flow shown in `Commissable-Screenshots/Reconciliation Page.PNG`.
- Target route for the new page: `/reconciliation/deposit-upload-list`.
- The new page presents a four-step wizard: 1) Create Template, 2) Map Fields, 3) Review, 4) Confirm. It includes fields for Deposit Name, Customer, Date, an Excel file uploader, Template Selection (Distributor, Vendor), Available Templates, a "+ Create New Template" action, and a "Proceed" button.

**Progress To Date**
- Navigation button added on the Reconciliation list and wired to route:
  - `app/(dashboard)/reconciliation/page.tsx` – adds a primary "Deposit Upload" button that routes to `/reconciliation/deposit-upload-list`.
- New route scaffolded with the Deposit Reconciliation wizard shell:
  - `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx` – page title, step container, sticky bottom-left Proceed button, and Step 2 placeholder.
- Reusable stepper built and styled for compact density:
  - `components/stepper.tsx` – smaller circles, tighter spacing, and active/completed states.
- Create Template step UI implemented (UI only):
  - Deposit Name, Customer (select), Date (date), Upload Deposit Excel Sheet (slim dropzone + Browse), Template Selection (Distributor, Vendor), Available Templates notice, `+ Create New Template`.
- Compact spacing pass completed to avoid footer overlap and reduce scroll:
  - Reduced paddings/gaps and card radius; tighter form grid and labels; slimmed upload zone.
- Breadcrumbs updated to show the correct trail and avoid duplicates:
  - Page sets breadcrumbs via `useBreadcrumbs` to `Home > Reconciliation > Deposit Upload List`.

**Still To Do**
- Map Fields step (UI) using import-modal mapping patterns.
- Review step (UI) with summary/sample rows.
- Confirm step (UI) with simulated submit and success state.
- Optional: Template creation modal/flow and Available Templates list.

**Deliverables**
- A new button on the Reconciliation index labeled `Deposit Upload List` that navigates to `/reconciliation/deposit-upload-list`.
- A new page at `/reconciliation/deposit-upload-list` that mirrors the provided PNG layout, including:
  - Title: "Deposit Reconciliation" with breadcrumb `Home > Reconciliation > Deposit Upload List`.
  - Top stepper with 4 steps and clear active state.
  - Form fields: Deposit Name (text), Customer (select), Date (date picker).
  - File upload control labeled "Upload Deposit Excel Sheet".
  - Template Selection block with Distributor and Vendor dropdowns, an "Available Templates" area, and a `+ Create New Template` button.
  - A primary `Proceed` button that advances the wizard to "Map Fields".

**Routes and Navigation**
- Add client-side navigation from the Reconciliation index:
  - Insert a button into the header actions of `app/(dashboard)/reconciliation/page.tsx` that calls `router.push('/reconciliation/deposit-upload-list')`.
- New page directory and file:
  - `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx` (client component).
  - Optional co-located components under `app/(dashboard)/reconciliation/deposit-upload-list/`.

**Components To Create**
- `components/stepper.tsx` (simple, reusable horizontal stepper)
  - Props: `steps: { id: string; label: string }[]`, `activeStepId: string`.
  - Renders numbered circles with connecting line and an active style (as in PNG).

- `components/deposit-upload/create-template-step.tsx`
  - Fields per PNG: Deposit Name, Customer (select), Date (date input), Excel upload (accept `.xlsx,.xls,.csv`), Distributor (select), Vendor (select), Available Templates list + `+ Create New Template`.
  - Emits `onContinue(payload)` when `Proceed` is clicked; basic client-side validation for required fields (Deposit Name, Customer, Date, File).

- `components/deposit-upload/map-fields-step.tsx`
  - Reuse mapping patterns from `components/import-modal.tsx`: show CSV/Excel headers on left, entity fields on right, allow mapping via selects.
  - Props: `file`, `onBack()`, `onContinue(mapping)`.

- `components/deposit-upload/review-step.tsx`
  - Shows a summary of mapping, first N parsed rows, and selected template metadata. `Back` and `Continue` actions.

- `components/deposit-upload/confirm-step.tsx`
  - Final confirmation with `Start Import` (simulated) and success state. Hook to `components/job-progress-tracker.tsx` can be added later.

**New Page Structure** (`app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`)
- Uses `"use client"` and the above components.
- Layout blocks:
  - Breadcrumb set via `useBreadcrumbs` to `[Home, Reconciliation, Deposit Upload List]` (no additional breadcrumb rendered by the page).
  - Page title: "Deposit Reconciliation".
  - `Stepper` pinned under the title.
  - Step container that switches between the four steps.

**UX and Behavior**
- Step 1: All inputs match PNG; `Proceed` moves to Map Fields only after basic validation.
- Step 2: Display columns from uploaded file and allow mapping to entity fields.
- Step 3: Review selected values and a small data sample; `Proceed` triggers client-side checks.
- Step 4: Confirm: show summary and a `Submit`/`Start Import` action. For now, simulate success, then route back to `/reconciliation` or show a success banner.

**Data and Mocking**
- Continue with mock data until backend is integrated:
  - Customers, Distributors, Vendors options can reuse existing `accountsData` filtered by type (`Customer`, `Distributor`, `Vendor`).
  - Available Templates: simple mock array persisted in component state or `localStorage`.
  - File parsing: for CSV, reuse `FileReader` approach from `components/import-modal.tsx`. For `.xlsx`, initially show filename only or use a small utility once allowed to add dependencies.

**Styling**
- Use Tailwind classes to match PNG’s spacing and light-blue stepper bar.
- Keep consistent with existing dashboard container (`dashboard-page-container`).
- Buttons: primary = blue, secondary = light/outline, consistent with current UI.

**Implementation Steps**
1) Add navigation button on the index page – DONE
   - `app/(dashboard)/reconciliation/page.tsx` adds a right-aligned "Deposit Upload" button that routes to `/reconciliation/deposit-upload-list`.
2) Scaffold route and page – DONE
   - `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx` with page title, stepper, Create Template step, and sticky Proceed.
3) Build Stepper component – DONE
   - `components/stepper.tsx` with the four steps and compact active state styles.
4) Implement Step 1 (Create Template) – DONE (UI only)
   - All fields present; compact spacing; slim upload dropzone; Proceed advances to Step 2 placeholder.
5) Implement Step 2 (Map Fields)
   - Build mapping UI using patterns from `components/import-modal.tsx`.
6) Implement Step 3 (Review)
   - Show mapping summary and a sample of parsed rows; allow Back/Proceed.
7) Implement Step 4 (Confirm)
   - Simulate submit; display success state and give option to return to `/reconciliation`.
8) Wire steps together and persist transient state across steps – IN PROGRESS
   - Step state stored in the page component; toggles between Create Template and Map Fields placeholder.
9) Polish and parity checks – IN PROGRESS
   - Compact pass complete; breadcrumb reads `Home > Reconciliation > Deposit Upload List`.

**Acceptance Criteria**
- Reconciliation index (`/reconciliation`) shows a `Deposit Upload List` button in its header area; clicking it routes to `/reconciliation/deposit-upload-list` without full reload.
- The new page displays the 4-step wizard and form sections that visually match the PNG:
  - Top stepper with steps 1–4 and active highlighting.
  - Deposit Name, Customer (dropdown), Date (date input), Upload Deposit Excel Sheet (file input), Template Selection (Distributor, Vendor), Available Templates, `+ Create New Template`, and `Proceed` button.
- `Proceed` validates required fields and advances to Map Fields.
- Map Fields allows mapping between upload columns and internal fields; Review and Confirm flow works end-to-end (mocked).

**File Changes (to date)**
- Updated: `app/(dashboard)/reconciliation/page.tsx` (added "Deposit Upload" button + navigation)
- Added: `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx` (wizard shell + Create Template UI + sticky Proceed + breadcrumbs)
- Added: `components/stepper.tsx` (compact stepper)
- Pending: `components/deposit-upload/create-template-step.tsx`
- Pending: `components/deposit-upload/map-fields-step.tsx`
- Pending: `components/deposit-upload/review-step.tsx`
- Pending: `components/deposit-upload/confirm-step.tsx`

**Risks / Open Questions**
- File parsing for `.xlsx`: OK to start with CSV or filename-only feedback; if Excel parsing is required now, we will request permission to add a lightweight parser.
- Template management: Is `+ Create New Template` meant to open a modal or route to a dedicated template builder? Plan assumes a modal or inline creation stub for now.
- Where should the flow return after Confirm? Plan assumes back to `/reconciliation` with a toast.

**Next Actions**
- Build Map Fields, Review, and Confirm steps (UI-only, mocked interactions).
- Decide desired behavior for `+ Create New Template` (modal vs. separate page) and implement minimal UX.
- Optional: two-column layout toggle or collapsible Template Selection to further reduce vertical space.
