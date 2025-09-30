# GUI-07: Clone/Duplicate Record Implementation Plan

## Project Requirement
- When exactly one record is selected, the Duplicate action should create a copy of the record with a new ID, append `(Copy)` to any human-readable name, and open the cloned record in edit mode.
- Implementation will proceed one entity at a time; the Accounts page will be the pilot to keep scope focused.

## Current Status
- No clone or duplicate UI controls exist in the dashboard.
- Accounts API handlers cover create/update/delete only; there is no clone endpoint.
- Permission catalogues do not define `accounts.clone`, so access cannot be enforced.
- The plan in this document supersedes the earlier generic approach.

## Architecture Snapshot

### Existing Infrastructure to Reuse
- **DynamicTable** (`components/dynamic-table.tsx`) already supports `selectedItems`, `onItemSelect`, and `onSelectAll`. We simply need to opt in on each page.
- **Account modals and validation** (`components/account-create-modal.tsx`, `@/lib/validation`, `app/api/accounts/helpers.ts`) already encode required account fields, address parsing, and Prisma includes.
- **API wrappers** (`@/lib/api-auth`, `@/lib/audit`) provide tenant scoping, permission checks, and audit logging that a clone endpoint can reuse.
- **Routing/navigation** (`next/navigation` router) is already used to push into account detail and edit pages.

### Confirmed Gaps
- The Accounts page (`app/(dashboard)/accounts/page.tsx`) does not track row selection, so the UI cannot enforce "exactly one record".
- There is no spot in the current UI for a Duplicate action; the existing action column is wired to deletion.
- No `/api/accounts/{accountId}/clone` route exists, and there is no shared clone helper.
- Permission configuration (`components/role-edit-modal.tsx`) lacks clone-specific codes.

## Blockers Identified & Resolutions
- **Action column API mismatch**: Extending `Column` with an `actions` array would require rewriting `DynamicTable`.  
  _Resolution_: Continue using the `render` callback in the Accounts page to inject buttons; add a dedicated Duplicate control without touching the table contract.
- **Context menu and bulk toolbar assumptions**: The earlier plan required right-click menus and bulk action toolbars that do not exist.  
  _Resolution_: Provide a single Duplicate entry point (header button or inline action) scoped to the Accounts page instead of building a menu framework now.
- **Over-scoped clone modal**: The proposed `clone-confirm-modal` attempted relationship cloning before the core flow works.  
  _Resolution_: Skip the modal for the pilot. Use inline confirmation messaging and revisit optional related-entity cloning after the base feature ships.
- **Missing selection state on Accounts page**: The UI currently cannot tell which row is selected.  
  _Resolution_: Add a checkbox column, manage `selectedAccountIds` state locally, and pass it down to `DynamicTable`.
- **Generic clone service requirement**: Pulling all entities into one helper conflicts with the account-specific validation and auditing that already exists.  
  _Resolution_: Implement a focused `/api/accounts/[accountId]/clone` handler that reuses existing account helpers; evaluate generalisation only after multiple entities share the same needs.

## Accounts Page Pilot Implementation

### 1. Table Selection Enablement
- Insert a checkbox column at the start of `accountColumns`.
- Track `selectedAccountIds` with `useState`, clearing it on data refresh, pagination change, or modal close.
- Pass `selectedItems`, `onItemSelect`, and `onSelectAll` to `DynamicTable`.
- Update row click handling to open the record while leaving checkbox clicks to manage selection.

### 2. Duplicate Entry Point
- Add a `Duplicate` button to `ListHeader` (next to `onCreateClick`) that is enabled only when `selectedAccountIds.length === 1` and the user has the clone permission.
- Alternatively, render a secondary action button in the table action column for rows when the user hovers. Either approach uses the existing `render` override.

### 3. Clone API Route
- Create `app/api/accounts/[accountId]/clone/route.ts`.
- Steps inside the handler:
  - Wrap with `withPermissions` requiring `accounts.manage` or the new `accounts.clone`.
  - Fetch the source account (including address IDs) using existing helpers; bail out with 404 if not found.
  - Duplicate related address records (shipping and billing) so the clone has its own addresses.
  - Compose the payload: copy fields, set status to Active by default, append `(Copy)` when the name already lacks it, and set `createdById` and `updatedById` to the current user.
  - Persist via Prisma and map back to the list row shape.
  - Log the operation with `logAccountAudit` and trigger `revalidatePath` for `/accounts` and the account detail route.
- Return `{ accountId: string }` so the client can navigate.

### 4. Front-End Clone Flow
- Implement `handleDuplicateAccount` on the Accounts page: guard for a single selection, call the clone API, surface loading and toast states, and on success `router.push(`/accounts/${newId}?mode=edit`)`.
- Refresh table data after cloning to show the new row.
- Ensure errors reset selection and notify the user.

### 5. Permissions and Security
- Add `accounts.clone` to the permission catalogue (`components/role-edit-modal.tsx`) with an appropriate description.
- Update role seeding or default assignments (if applicable) so administrators retain clone access.
- In the API handler, check for either `accounts.clone` or a higher privilege such as `accounts.manage` to avoid regressions for existing admins.

### 6. Auditing and Telemetry
- Record a Clone (or Create with metadata) audit entry referencing the source and new IDs.
- Capture metrics (if available) around clone usage to inform rollout to other entities.

## Testing Strategy
- **Unit**: Verify name suffix logic, address duplication helper, and permission guard behaviour.
- **Integration and API**: Exercise the clone endpoint with valid and invalid IDs, missing permissions, and accounts that lack optional fields.
- **UI and E2E**: Assert that selecting a single row enables the button, cloning navigates to edit mode, and multiple selections keep the control disabled.

## Success Criteria
- The Duplicate control is available only when exactly one account row is selected.
- Cloning produces a new account with distinct IDs for the account and any addresses.
- The new account name ends with `(Copy)` (or `(Copy n)` if we extend for multiple clones later).
- The cloned account opens directly in edit mode.
- Audit logs reflect the clone operation and reference both source and target IDs.
- Users without the `accounts.clone` (or higher) permission cannot see the button and receive a 403 if they hit the API.

## Future Rollout
- Once the Accounts pilot is stable, repeat the slice (selection wiring, UI button, clone endpoint) for Contacts, Opportunities, and other entities as needed.
- Re-evaluate whether shared utilities (for example clone helpers or a confirmation modal) provide enough benefit after at least two entities are implemented.
- Consider relationship cloning (contacts and opportunities) as a follow-up once the base workflow is validated.
