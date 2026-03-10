# Match Wizard Modal Review & Improvement Recommendations

**Date:** 2026-03-10
**Reviewed against:** Screenshot of M:1 mixed-rate scenario, component source (`components/reconciliation-match-wizard-modal.tsx`), validation logic (`lib/matching/match-group-preview.ts`), and design docs (`docs/plans/many-to-one-fix.md`, reconciliation specs).

---

## 1. Screenshot Observations

The screenshot shows:
- **Match 2 lines to 1 schedule** (M:1 detected)
- Selected Lines: Usage $194.90 / Commission $31.18
- Selected Schedules: Expected usage net $29.90 / Expected commission net $4.78
- Validation error: _"You can't match this directly because the selected lines use different commission rates (15.99%, 16.00%). Replace the bundle with individual schedules instead."_
- Apply is blocked with "Fix preview errors before applying"
- Allocation section is collapsed ("Edit allocations" button visible)

---

## 2. Identified Issues

### 2.1 Critical: Bundle Replacement Path Is Hidden

**Problem:** When the mixed-rate error fires, the user is told to "Replace the bundle with individual schedules instead" but the M:1 Mode radio buttons and the "Confirm replacement" button are inside the **collapsed Allocation section**. The user must click "Edit allocations" to find the remedy, which is non-obvious. The error message provides no actionable next step within the visible UI.

**Code reference:** The M:1 mode selector renders at [reconciliation-match-wizard-modal.tsx:970-1002](components/reconciliation-match-wizard-modal.tsx#L970-L1002) inside the `allocationExpanded` conditional at line 915.

**Recommendation:**
- Auto-expand the Allocation section when `replacementRequired` is `true`.
- Or: surface a prominent "Replace Bundle" call-to-action button directly within the error banner, bypassing the need to discover the hidden allocation panel.

### 2.2 Major: False Positive on Nearly Identical Commission Rates

**Problem:** The validation flags 15.99% vs 16.00% as "different commission rates." This 0.01 percentage point difference is almost certainly a rounding artifact in the source data, not a genuine rate discrepancy. The current logic in `analyzeBundleLineRates()` uses strict equality on unique rates with no tolerance.

**Code reference:** [bundle-replacement.ts:51-75](lib/matching/bundle-replacement.ts#L51-L75) — `hasMixedRates` is true whenever `uniqueRates.size > 1`, with no epsilon/tolerance.

**Recommendation:**
- Add a configurable tolerance (e.g., 0.005 or 0.5 percentage points) when comparing commission rate fractions.
- Display a warning instead of an error when rates differ by less than the tolerance threshold, allowing the user to proceed with allocation if desired.
- Example: `hasMixedRates = uniqueRates spread > tolerance` instead of `uniqueRates.size > 1`.

### 2.3 Major: Duplicate Error Display

**Problem:** The same error message appears in **three** places simultaneously:
1. Red text above the ISSUES box (the `previewError` state set at line 531)
2. Inside the ISSUES bulleted list (from `preview.issues`)
3. Inside the "Apply is blocked" banner at the bottom

This creates visual noise and makes the modal feel broken rather than informative.

**Code reference:** [reconciliation-match-wizard-modal.tsx:1185](components/reconciliation-match-wizard-modal.tsx#L1185) sets `previewError` from the first issue. Lines 1189-1202 render all issues. Lines 1282-1286 render the apply-blocked banner.

**Recommendation:**
- Remove the standalone `previewError` text display when `preview.issues` are already rendered in the ISSUES section.
- Keep only the structured ISSUES list and the Apply blocked banner (which serves a different purpose — blocking apply).
- Alternatively, change `previewError` to only display network/unexpected errors, not validation issues.

### 2.4 Major: Large Amount Mismatch Not Flagged

**Problem:** Selected lines total $194.90 usage but the schedule expects only $29.90 — a ~6.5x difference. The modal shows these numbers side by side but provides no visual warning about this significant mismatch. Users could easily overlook this before diving into allocation.

**Code reference:** The Selection section at [reconciliation-match-wizard-modal.tsx:873-899](components/reconciliation-match-wizard-modal.tsx#L873-L899) renders both cards without comparison logic.

**Recommendation:**
- Add a comparison indicator (e.g., delta or percentage difference) between selected lines and expected schedules.
- Show a warning banner in the Selection section when the ratio exceeds a threshold (e.g., >2x or >50% difference).
- This aligns with the variance tolerance concept already used in schedule-level validation.

### 2.5 Moderate: "Run Validation Again" Button Label Is Confusing

**Problem:** For M:1 matches, the Preview button says "Run Validation Again" even on the first display (because auto-validation already ran). Combined with the "Run Preview" button in the footer bar, users see two different labels for the same action.

**Code reference:** [reconciliation-match-wizard-modal.tsx:1174](components/reconciliation-match-wizard-modal.tsx#L1174) — button text is always "Run Validation Again" for M:1, regardless of whether it's the first or subsequent run. Footer button at line 1353 always says "Run Preview".

**Recommendation:**
- Use consistent labeling: either "Run Preview" everywhere or "Run Validation" everywhere.
- Differentiate first-run vs re-run: "Run Preview" initially, "Re-run Preview" after changes.
- Consider removing the footer "Run Preview" button when auto-validation is active (M:1 mode).

### 2.6 Moderate: Step Pills Don't Guide the User

**Problem:** The Selection/Allocation/Preview/Apply pills at the top serve as scroll-to anchors and status indicators, but they don't communicate what action is needed. In the screenshot, "Selection" is green, "Allocation" is gray, "Preview" is red, "Apply" is gray — but the user doesn't know _why_ each is in that state without reading tooltips.

**Code reference:** [reconciliation-match-wizard-modal.tsx:748-825](components/reconciliation-match-wizard-modal.tsx#L748-L825)

**Recommendation:**
- Add a small icon or badge to each pill (checkmark for complete, warning triangle for issues, a "1"/"2" for sequential step).
- Show a one-line status beneath the pills row: "Fix the validation error in Preview to proceed."
- Consider making the current step more visually prominent (larger, outlined, etc.).

### 2.7 Moderate: Raw UUIDs in Preview Summaries

**Problem:** When preview succeeds (not shown in this screenshot, but visible in the code at lines 1209-1249), line and schedule summaries display raw UUIDs (e.g., `line.lineId`, `schedule.scheduleId`) instead of human-readable names. This makes the preview results hard to interpret.

**Code reference:** [reconciliation-match-wizard-modal.tsx:1212](components/reconciliation-match-wizard-modal.tsx#L1212) — `{line.lineId}` and line 1228 — `{schedule.scheduleId}`.

**Recommendation:**
- Include `accountName`, `productName`, `revenueScheduleName` in the preview API response.
- Display human-readable labels (account/product for lines, schedule name/date for schedules).
- Fall back to truncated IDs only if names are unavailable.

### 2.8 Moderate: No Keyboard/Accessibility Support

**Problem:** The modal uses `onClick` on the backdrop for close, but there's no `onKeyDown` handler for Escape. The step pills are `<button>` elements (good) but form inputs lack `aria-label` attributes. The allocation table isn't a proper `<table>` with headers.

**Code reference:** [reconciliation-match-wizard-modal.tsx:740](components/reconciliation-match-wizard-modal.tsx#L740) — no keydown listener for Escape.

**Recommendation:**
- Add `onKeyDown` Escape handler to close the modal.
- Add `aria-label` or `aria-labelledby` to the modal container.
- Add `role="dialog"` and `aria-modal="true"`.
- Consider using `<table>` for allocation rows with proper `<th>` headers.

### 2.9 Minor: Fixed 900px Height May Overflow on Smaller Screens

**Problem:** The modal has a fixed `h-[900px]` class. On laptop screens (e.g., 768px viewport height), this overflows the viewport.

**Code reference:** [reconciliation-match-wizard-modal.tsx:742](components/reconciliation-match-wizard-modal.tsx#L742)

**Recommendation:**
- Change to `max-h-[90vh]` or `max-h-[900px]` with `h-auto` to be responsive.
- The inner content already has `overflow-y-auto`, so the scrollable area will handle overflow correctly.

### 2.10 Minor: 1:1 Match Type Missing from Allocation Rows

**Problem:** `allocationRows` returns an empty array for `OneToOne` match type (falls through to the final `return []` at line 442). If a user selects a 1:1 match and expands allocations, they see nothing.

**Code reference:** [reconciliation-match-wizard-modal.tsx:375-443](components/reconciliation-match-wizard-modal.tsx#L375-L443) — no `OneToOne` branch.

**Recommendation:**
- Add a `OneToOne` case that returns a single allocation row (one line to one schedule).
- This provides a consistent editing experience across all match types.

### 2.11 Minor: Excessive State Variables

**Problem:** The component manages 20+ `useState` calls (lines 216-243). This makes the component hard to maintain and increases the risk of state inconsistencies.

**Code reference:** [reconciliation-match-wizard-modal.tsx:216-243](components/reconciliation-match-wizard-modal.tsx#L216-L243)

**Recommendation:**
- Consider consolidating related state into `useReducer` with typed actions (e.g., `WizardState` with `selection`, `allocation`, `preview`, `apply`, `bundle` sub-states).
- This would simplify the reset logic in the `useEffect` at lines 262-296 to a single `dispatch({ type: 'RESET' })`.

---

## 3. Documentation vs Implementation Gaps

### 3.1 many-to-one-fix.md Spec Mismatch

The spec at `docs/plans/many-to-one-fix.md` says:

> _"If selected **schedules** have different expected commission rates..."_

But the actual implementation checks **lines** (deposit line items) for different commission rates, not schedules. The code at [match-group-preview.ts:375](lib/matching/match-group-preview.ts#L375) calls `analyzeBundleLineRates(lines)`.

**Impact:** The spec document is outdated or inaccurate. For M:1 (many lines to one schedule), checking line rates is correct behavior. The spec should be updated.

### 3.2 Missing Error Code in User-Facing Documentation

The error code `many_to_one_mixed_rate_requires_replacement` and the user flow for bundle replacement are not documented in any user-facing guide. The reconciliation guide (`docs/guides/reconciliation.md`) covers the basic 5-step workflow but doesn't mention the bundle replacement scenario.

**Recommendation:** Add a section to the reconciliation guide covering the M:1 mixed-rate workflow and what "Replace the bundle" means.

### 3.3 Commission Rate Discrepancy Alert Plan Not Integrated

`docs/plans/commission_rate_discrepancy_alert_plan.md` describes detecting when a match implies a rate different from the schedule's expected rate and offering to update future schedules. This feature appears to be planned but not yet integrated into the Match Wizard modal.

**Recommendation:** Track this as a separate enhancement — when rates differ slightly (within tolerance), offer to adjust the schedule's expected rate rather than blocking the match.

---

## 4. Prioritized Improvement Roadmap

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0 | 2.1 — Auto-expand allocation or surface replacement CTA | Small | Unblocks users stuck on the error |
| P0 | 2.2 — Add tolerance to rate comparison | Small | Eliminates false positives |
| P1 | 2.3 — Deduplicate error display | Small | Cleaner UX |
| P1 | 2.4 — Selection mismatch warning | Medium | Prevents bad matches |
| P1 | 2.5 — Consistent button labels | Small | Reduces confusion |
| P1 | 2.7 — Human-readable names in preview | Medium | Usable preview results |
| P2 | 2.6 — Step pill improvements | Medium | Better guidance |
| P2 | 2.8 — Accessibility improvements | Medium | Compliance |
| P2 | 2.9 — Responsive modal height | Tiny | Mobile/laptop support |
| P2 | 2.10 — 1:1 allocation row | Small | Completeness |
| P3 | 2.11 — State consolidation refactor | Large | Maintainability |
| P3 | 3.1 — Update spec doc | Tiny | Documentation accuracy |
| P3 | 3.2 — User-facing bundle docs | Small | User self-service |
| P3 | 3.3 — Rate discrepancy alert integration | Large | Future enhancement |

---

## 5. Quick Wins (Can Ship This Week)

1. **Auto-expand allocations on replacement required** — Add `useEffect` to set `allocationExpanded(true)` when `replacementRequired` becomes true.
2. **Rate tolerance** — Add `const RATE_TOLERANCE = 0.005` to `analyzeBundleLineRates()` and compare `Math.abs(rateA - rateB) > RATE_TOLERANCE`.
3. **Remove duplicate error text** — Only show `previewError` for network errors, not validation issues already in the issues list.
4. **Fix modal height** — Change `h-[900px]` to `max-h-[min(900px,90vh)]`.
5. **Consistent button label** — Use "Run Preview" for both inline and footer buttons; only say "Re-run Preview" when `preview !== null`.
