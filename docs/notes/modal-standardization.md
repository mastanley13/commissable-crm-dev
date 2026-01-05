# Modal standardization

## Dismissal rules

- **Cancel is the only exit** for modals and modal-like overlays.
- Do not add a top-right **Close** or **X** button.
- Do not close on backdrop click.
- Do not close on `Esc`.

## Implementation guidance

- Ensure every modal has a visible **Cancel** button in the footer that calls the provided `onClose`/`onCancel` handler.
- Prefer using `components/ui/modal-shell.tsx` for new modals to keep layout consistent.

