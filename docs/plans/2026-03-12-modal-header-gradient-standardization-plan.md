# Modal Header Gradient Standardization Plan

## Objective

Standardize all non-Variance modals/popups so the top header section uses the same blue gradient surface as the Variance review modal, while preserving each modal's existing header content, text copy, font sizing, text position, and overall layout structure.

## Findings

1. The Variance modal is the current visual reference, but its header is custom and not reusable today.
   - Source: `components/reconciliation-alert-modal.tsx`
   - Reference header classes: `border-b border-blue-700 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-700 px-6 py-5 text-white`
   - Important: this header also includes a subtitle line and metric cards. Those elements should not be copied.

2. Most standard modal headers do not come from the Variance modal. They come from a shared white header component.
   - Shared source: `components/ui/modal-header.tsx`
   - Current shared header classes: `flex items-center justify-between border-b border-gray-200 px-6 py-4`
   - This is the main implementation leverage point for a large portion of the modal inventory.

3. The codebase currently has two modal-header patterns that need to be accounted for.
   - Shared-header modals using `ModalHeader`
   - Inline custom headers that visually match the same white-header pattern but do not use `ModalHeader`

4. Updating `ModalHeader` alone will not standardize every modal.
   - A large group of modals will update automatically if `ModalHeader` changes.
   - Another group hard-codes its own white header container and will need separate updates or refactoring.

5. The Variance modal header is taller because it contains extra content.
   - Recommendation: copy only the gradient/border treatment.
   - Do not copy its extra line, metric cards, or taller multi-row composition.
   - For the non-Variance modals, keep the standard header sizing model (`px-6 py-4`) unless design explicitly wants a new shared height.

6. There is one design conflict to resolve before implementation.
   - The Variance modal uses light text on a dark gradient.
   - The existing standard modal headers mostly use dark title text and primary-blue kicker text.
   - If the team wants the exact Variance gradient and also wants current text colors preserved, contrast may become weak in some modals.
   - This needs a quick design decision before rollout.

## Affected Modal Inventory

### Group A: Shared `ModalHeader` consumers

These are the lowest-risk rollout targets because a shared header update will affect them automatically:

- `components/account-bulk-owner-modal.tsx`
- `components/account-bulk-status-modal.tsx`
- `components/account-create-modal.tsx`
- `components/account-edit-modal.tsx`
- `components/activities/activity-create-modal.tsx`
- `components/activity-bulk-owner-modal.tsx`
- `components/activity-bulk-status-modal.tsx`
- `components/activity-note-edit-modal.tsx`
- `components/auto-match-preview-modal.tsx`
- `components/bulk-owner-modal.tsx`
- `components/bulk-status-modal.tsx`
- `components/column-chooser-modal.tsx`
- `components/column-settings-modal.tsx`
- `components/commission-payout-create-modal.tsx`
- `components/confirm-dialog.tsx`
- `components/contact-bulk-owner-modal.tsx`
- `components/contact-bulk-status-modal.tsx`
- `components/contact-create-modal.tsx`
- `components/contact-edit-modal.tsx`
- `components/export-modal.tsx`
- `components/group-bulk-owner-modal.tsx`
- `components/group-bulk-status-modal.tsx`
- `components/import-modal.tsx`
- `components/opportunity-bulk-owner-modal.tsx`
- `components/opportunity-bulk-status-modal.tsx`
- `components/opportunity-edit-modal.tsx`
- `components/opportunity-line-item-create-modal.tsx`
- `components/opportunity-line-item-edit-modal.tsx`
- `components/product-create-modal.tsx`
- `components/reconciliation-match-wizard-modal.tsx`
- `components/revenue-schedule-clone-modal.tsx`

Note: `components/ui/modal-shell.tsx` also pipes through `ModalHeader`, so any modal using that shell will inherit the same change path.

### Group B: Inline white-header modals that will not update automatically

These use custom header markup that matches the same white-header pattern and need separate handling:

- `components/account-group-create-modal.tsx`
- `components/account-opportunity-create-modal.tsx`
- `components/activity-note-create-modal.tsx`
- `components/contact-group-create-modal.tsx`
- `components/contact-opportunity-create-modal.tsx`
- `components/group-create-modal.tsx`
- `components/group-edit-modal.tsx`
- `components/opportunity-create-modal.tsx`
- `components/opportunity-role-create-modal.tsx`
- `components/report-create-modal.tsx`
- `components/revenue-schedule-create-modal.tsx`
- `components/revenue-schedule-status-modal.tsx`
- `components/role-create-modal.tsx`
- `components/ticket-create-modal.tsx`
- `components/user-create-modal.tsx`

### Group C: Custom modal headers that are related, but not exact Account-style clones

These should still be reviewed during implementation, but they need more careful treatment because the header structure is different:

- `components/account-reassignment-modal.tsx`
- `components/role-edit-modal.tsx`
- `components/two-stage-delete-dialog.tsx`

### Explicitly excluded

- `components/reconciliation-alert-modal.tsx`

This is the reference only. It should not be edited as part of this standardization work.

## Recommended Implementation Approach

1. Extract the header surface treatment from the Variance modal into a reusable modal-header style.
   - Reuse only the gradient and divider treatment.
   - Do not reuse the Variance modal layout/content structure.
   - Candidate surface: `bg-gradient-to-r from-blue-950 via-blue-800 to-blue-700` plus the matching bottom border treatment.

2. Keep the non-Variance modal header sizing standardized around the existing shared header spacing.
   - Preserve `px-6 py-4` as the default header shell for standard modals.
   - This avoids accidentally making every modal as tall as the Variance modal.

3. Update `components/ui/modal-header.tsx` first.
   - This is the highest-leverage change surface.
   - Preserve the existing DOM structure so title placement, kicker placement, and right-slot positioning do not shift.
   - If needed, add a variant prop so there is still a clean opt-out path for any modal that must remain white.

4. Apply the same reusable header treatment to Group B inline-header modals.
   - Preferred: reuse the same shared gradient class/token rather than copy-pasting classes.
   - Keep each modal's existing title text, kicker text, and any modal-specific subtitle text exactly where it already sits.

5. Handle Group C separately.
   - `account-reassignment-modal.tsx`, `role-edit-modal.tsx`, and `two-stage-delete-dialog.tsx` have different header compositions.
   - Apply the gradient surface without forcing them into the simpler Account-style structure.

6. Leave the Variance modal untouched.
   - It remains the visual source only.

## Suggested Execution Order

1. Confirm the text-color decision.
   - Option A: exact Variance gradient + switch header text to light/white for accessibility
   - Option B: preserve existing dark text colors + use a lighter derivative blue gradient instead of the exact Variance treatment

2. Implement the reusable gradient header treatment in `components/ui/modal-header.tsx`.

3. Smoke test the Group A shared-header modals.

4. Update Group B inline-header modals one by one using the same gradient utility.

5. Finish with Group C custom headers.

6. Run a visual QA pass across all modal/pop-up entry points.

## QA Checklist

- Header background uses the approved blue gradient on all non-Variance modals in scope.
- Variance modal remains unchanged.
- Header text content is unchanged.
- Header title font size is unchanged.
- Header text position/alignment is unchanged.
- No extra subtitle line or metric cards were introduced into non-Variance modals.
- Divider line still appears in the correct place below the header.
- Header height is consistent across non-Variance standard modals.
- Small dialogs, wide forms, and tabbed modals still render correctly.
- Contrast remains readable in every modal state.

## Risks / Notes

- If implementation copies the Variance header too literally, it will unintentionally change header height and structure across many modals.
- If implementation changes `ModalHeader` without auditing inline headers, the UI will end up only partially standardized.
- If the team keeps the exact dark blue gradient and also keeps existing dark text colors, readability may regress.
