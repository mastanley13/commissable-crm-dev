# Reconciliation Settings — Percentage Sliders + Manual Input Plan

## Goal

Update **Settings → Reconciliation Settings** to:

1. **Shorten** the visible slider control width (so it doesn’t span the entire card).
2. Add a **manual percentage input box** next to each slider (users can drag *or* type).
3. Change **Variance Tolerance** to use the same **slider + manual input** pattern as:
   - Suggested Matches Display Confidence
   - AI Auto-Match Confidence

Primary UI file today: `components/reconciliation-settings-form.tsx`.

---

## Current State (baseline)

- **Variance Tolerance** is a standalone numeric input (percent shown, stored as `0–1` in API).
- **Suggested Matches Display Confidence** and **AI Auto-Match Confidence** are sliders only (range `0–100`) with a read-only `%` text label.

---

## UX Requirements

### Layout

- Each “percent setting row” should have:
  - Slider (shorter width than today)
  - Manual percent input box (numeric)
  - Percent sign shown consistently (either inside the input group or next to it)
- Responsive behavior:
  - Desktop: slider + input on one row.
  - Small screens: stack cleanly (slider above input) or allow wrap.

### Interaction + Validation

- Slider drag updates the input box immediately.
- Typing in the input box updates the slider immediately (or on blur if we need to allow partial typing).
- Values clamp to valid bounds:
  - Confidence sliders: `0–100` (step `1`)
  - Variance Tolerance: confirm desired range (see Open Questions); current UI implies `0–30` (step `0.1`)
- Handle “partial typing” safely:
  - Allow temporary empty value while editing
  - On blur: normalize to a number + clamp (no `NaN` state)
- Keyboard support:
  - Slider arrow keys work
  - Input arrow keys increment by `step`

### Consistency

- Use the same visual pattern and spacing for all three controls.
- Keep existing help text beneath each setting.

---

## Data / API Notes (do not break)

- Tenant setting:
  - `varianceTolerance` is stored as a decimal `0–1` via `POST /api/reconciliation/settings`
  - Server validates `0 <= varianceTolerance <= 1` (`app/api/reconciliation/settings/route.ts`)
- User settings:
  - `suggestedMatchesMinConfidence` and `autoMatchMinConfidence` stored as `0–1` via `POST /api/reconciliation/user-settings`

UI should continue to display percentages while converting to/from decimals on save/load.

---

## Technical Approach

### 1) Introduce a reusable control component

Create a small reusable component, e.g.:

- `components/percent-slider-with-input.tsx` (or colocate in `components/reconciliation/` if that pattern exists)

Props (suggested):

- `label: string`
- `helpText?: string`
- `value: number` (in *percent units*, e.g. `70` or `2.5`)
- `onChange: (next: number) => void`
- `min: number`
- `max: number`
- `step: number`
- `sliderMaxWidthClass?: string` (default something like `max-w-[520px]`)

Implementation notes:

- Keep the source of truth as a number in state, but track an `inputText` string while typing if needed to avoid fighting the user.
- Clamp with a helper: `clamp(value, min, max)`.
- Normalize to `step` on blur for the input (and optionally on slider move).

### 2) Apply the reusable control to each setting

Update `components/reconciliation-settings-form.tsx`:

- Replace:
  - the two existing slider blocks (Suggested Matches / Auto-Match) with the new component
  - the Variance Tolerance numeric input with the new component (so it matches)
- Configure bounds:
  - Confidence sliders: `min=0, max=100, step=1`
  - Variance Tolerance: `min=0, max=? , step=?` (see Open Questions)

### 3) Shorten slider length

Within the component, constrain the slider width (examples):

- Slider wrapper: `className="flex-1 max-w-[520px]"` (desktop)
- Allow wrap on small screens: `className="flex flex-wrap items-center gap-3"`

The manual input box stays a fixed width (e.g. `w-24`).

---

## Implementation Steps (checklist)

1. Confirm min/max/step requirements for **Variance Tolerance** (and whether decimals are allowed on confidence sliders).
2. Implement `PercentSliderWithInput` component (UI + input/slider sync + clamping).
3. Swap Suggested Matches and AI Auto-Match to use the new component.
4. Swap Variance Tolerance to use the new component and match styling.
5. Verify load/save conversions:
   - tenant: percent ⇄ decimal
   - user: percent ⇄ decimal
6. Add inline validation messaging if we want explicit feedback (optional if clamping is sufficient).
7. QA pass for keyboard + mouse, and layout across breakpoints.

---

## Test / QA Plan

Manual QA:

- Drag slider: input updates; save persists expected percent.
- Type a value: slider updates; save persists expected percent.
- Type invalid values:
  - negative, > max, blank, decimals (as applicable)
  - verify clamping + stable save behavior
- Refresh page: values round-trip and render correctly.

Automated (if desired):

- Component unit test for clamp/normalize behavior (if the repo has a test harness for React components).
- Playwright/Cypress UI test (if present) to assert slider/input sync and save request payloads.

---

## Open Questions (need product decision)

1. **Variance Tolerance range**: keep `0–30%` (current UI) or allow `0–100%` (API supports up to 100%)?
2. **Decimals**:
   - Variance Tolerance: keep `0.1%` steps?
   - Confidence sliders: keep integer only, or allow decimals via the input box?
3. **Typing behavior**: update slider on every keystroke vs update on blur (keystroke is nicer but needs careful handling of empty/partial input).

