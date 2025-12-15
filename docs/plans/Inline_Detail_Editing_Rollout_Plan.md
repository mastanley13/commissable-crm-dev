# Inline Detail Editing – Rollout Plan

Goal: Replace edit modals with inline editing on all entity detail pages (Accounts, Contacts, Opportunities, Products). Users can edit fields directly in the detail header/sections and commit changes via a top‑right Update button; no modal required.

Scope Summary
- Pages: Account Details, Contact Details, Opportunity Details, Product Details
- Editing model: inline inputs in place of read‑only boxes; Update/Cancel toolbar; PATCH only changed fields
- Out of scope (for initial rollout): list‑page inline editing, drag‑and‑drop column edits, creation flows (create modals remain)

## 1) UX/Interaction Model

- Edit affordance
  - Always show an `Update` button at top‑right of each detail card (already present on Opportunity; add to Account/Contact/Product). Button is enabled when there are unsaved changes.
  - Add a `Cancel` secondary button (or link) that reverts all unsaved changes to the last persisted state.
  - Show a subtle “Unsaved changes” badge when dirty; when saving, show spinner and temporary “Saved” toast on success.

- Fields presentation
  - Replace read‑only boxes with inputs matching type: text, textarea, number, date, switch, select, async lookup.
  - Preserve existing two‑column grid, labels, and help text. Keep compact sizes recently adopted.
  - For view‑only relationships (e.g., Parent Account, Owner), convert to selects with async lookup.

- Validation
  - Inline errors under each field on blur and on submit; top‑level summary for focusable navigation.
  - Common validations: required, max length, email/phone format, numeric ranges, date validity.

- Navigation guards
  - Warn on route change or browser close with unsaved changes.

- Accessibility
  - Labels bound to inputs, proper `aria-invalid` and `aria-describedby` on error, keyboard focus order preserved.

## 2) Technical Architecture

- Core primitives (shared)
  - `EditableField` wrapper: label, hint, error, and one of input types; supports `value`, `onChange`, `onBlur`, `error`, `disabled`.
  - `useEntityEditor<T>` hook: holds original entity, draft state, dirty map, `setField`, `reset`, `save`, `isDirty`, `changedPatch`.
  - `diffPatch(original, draft)`: deep diff to produce minimum PATCH payload. Handles nested objects like addresses.
  - `zod` schemas per entity for validation; sync validation in UI, server validation fallback for authoritative checks.
  - `useUnsavedChangesPrompt(isDirty)` to register unload/router guards.

- API layer
  - Continue using existing `PATCH /api/<entity>/:id` endpoints. Send only changed fields; keep server as source of truth.
  - Concurrency: include an `updatedAt` precondition header or field and handle 409 conflicts by offering “Reload and merge” dialog.
  - Dates: UI uses HTML date inputs (`YYYY-MM-DD`) and converts to API ISO (`toISOString()` or `YYYY-MM-DD` where server expects). Display continues as `YYYY/MM/DD`.

- State + performance
  - Local draft state per page; no global write cache needed. Memoize field render groups.
  - Optimistic UI optional later; initial pass uses pessimistic save (wait for 200 then commit draft → original).

## 3) Entity‑Specific Mapping

- Account
  - Core: name, legal name, type, owner, active, website, description
  - Parent account: async select
  - Addresses: shipping + billing groups; `Same as Ship` toggles billing copy

- Contact
  - Name parts (first/last/suffix), contact type, account, job title, phones, email, description, active/primary
  - Account selection fetches and displays addresses (existing fetch already present in edit modal)

- Opportunity
  - Header fields: name, account, legal name, owner, stage, estimated close date, referred by, description, address fields
  - Keep Products/Revenue/Activities tabs unchanged (their inline editing plans are separate)

- Product
  - Displayed fields editable except immutable identifiers; for v1, treat product edit as read‑only (show “coming soon” toast) unless back‑end is ready—feature flagged per environment.

## 4) Feature Flags and Rollout Strategy

- Gate the new inline editing per module via `NEXT_PUBLIC_INLINE_DETAIL_EDIT=<accounts|contacts|opportunities|products|all>`.
- Progressive rollout order:
  1) Opportunity Details (smallest delta; Update button exists)
  2) Account Details
  3) Contact Details
  4) Product Details (optional v1 if API not ready)

- Keep existing modals in code for one release as a fallback; hide their triggers behind the flag.

## 5) Implementation Phases

Phase 0 – Prep (1–2 days)
- Add shared components: `EditableField`, `useEntityEditor`, `diffPatch`, `useUnsavedChangesPrompt` scaffold
- Add zod schemas: `accountSchema`, `contactSchema`, `opportunitySchema` (product optional)
- Add env flag and configuration helper

Phase 1 – Opportunity Details (2–3 days)
- Replace FieldRow values with inputs; wire `useEntityEditor`
- Map draft → PATCH; POST save; error handling + toasts
- Add `Update` + `Cancel` actions; dirty guard
- QA with real data (date, selects, conflict)

Phase 2 – Account Details (3–4 days)
- Convert field groups (core + addresses)
- Implement `Same as Ship` behavior in draft
- Validate URLs, phone/email (where applicable)

Phase 3 – Contact Details (3–4 days)
- Convert field groups; async account lookup; name decomposition
- Ensure list ↔ detail consistency for active/inactive

Phase 4 – Product Details (optional, 3–5 days)
- If API supports PATCH, enable inline editing. If not, keep Update button with “coming soon” toast behind flag.

Phase 5 – Cleanup & Remove Modals (1–2 days)
- Remove edit modal triggers; keep create modals
- Remove dead code + imports; update docs

## 6) Validation & Testing

- Unit
  - `diffPatch` deep diff, date conversion helpers, zod schema edge cases
- Component
  - `EditableField` types (text, textarea, date, select, switch)
- Integration
  - Each detail page saves only changed fields; conflicts show merge prompt; guard dialogs appear when dirty
- E2E (happy paths)
  - Edit critical fields per entity and persist; reload verifies data

## 7) Error Handling & Edge Cases

- 400 validation errors → field messages + summary
- 401/403 → disable inputs, show permission message
- 404 → navigate back/list with toast
- 409 conflict → dialog with choices: Reload, Overwrite, or Copy changed values
- Network failure → retain draft, allow retry

## 8) Security & Permissions

- Respect existing permission checks to disable editing for read‑only users
- Server validates and audits changes (consider adding `changedBy` and `changedFields` to audit trail)

## 9) Analytics/Telemetry (optional)

- Track saves, errors, conflicts, and cancellations per entity to monitor adoption and issues

## 10) Rollback Plan

- Keep a flag to disable inline editing and re‑enable modals without redeploying code
- Maintain server PATCH compatibility with prior modal payloads

## 11) Acceptance Criteria

- All detail pages show Update/Cancel and allow inline edits
- Only changed fields are sent; server updates succeed; UI reflects latest persisted values
- Dirty guard, validation, and error states function correctly
- No edit modals are required for field edits; creation flows remain unaffected

## 12) Task Checklist (Engineering)

- [ ] Add feature flagging and shared editing primitives
- [ ] Opportunity Details inline edit + tests
- [ ] Account Details inline edit + tests
- [ ] Contact Details inline edit + tests
- [ ] Product Details (if API ready) or keep toast
- [ ] Remove edit modal triggers; update docs and screenshots
- [ ] QA + release notes

