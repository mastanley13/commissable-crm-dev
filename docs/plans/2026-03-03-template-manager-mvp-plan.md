# Plan: Data Settings — Template Manager (Deposit Upload / Reconciliation)

Last updated: 2026-03-03

## Confirmation: where templates live

- **Templates are persisted in Google Cloud SQL (Postgres)** (the app DB) via the Prisma model `ReconciliationTemplate` (`prisma/schema.prisma`).
- The Deposit Upload workflow already creates/reads/updates templates through existing endpoints under `GET/POST/PATCH /api/reconciliation/templates` (documented in `docs/deposit-system-complete-reference.md`).

> Note: “Google Cloud DQL” is assumed to mean **Google Cloud SQL** (Postgres). If you meant a different storage system, call it out and we’ll adjust.

## Problem statement

Today, templates (reconciliation/deposit upload field mappings) can be created/updated indirectly through the Deposit Upload wizard, but there’s no dedicated place for admins to:

- Review existing templates across distributors/vendors
- Edit template metadata and mappings intentionally (without running an import)
- Clone/retire templates safely
- Understand which templates are actively used and when they were last updated

## Goal (MVP)

Create a **Template Manager** as a **new page inside Admin → Data Settings** that lets admins **review, edit, and manage** templates used in the Deposit Upload reconciliation workflow.

### MVP user stories

- As an admin, I can **list** templates with filters (Distributor, Vendor, Name) and see key metadata (Updated At, Created By, Description).
- As an admin, I can **view template details** including the current mapping config (V2).
- As an admin, I can **edit**:
  - Name + Description
  - Mapping config (DepositMappingConfigV2) used by the wizard/import
- As an admin, I can **clone** a template (to iterate without breaking an existing template).
- As an admin, I can **retire** (archive/disable) a template so it won’t be auto-selected for future uploads.
- As an admin, I can **see usage** (e.g., deposit count / last used) to make safe decisions before retiring.

## Non-goals (MVP)

- Retroactively updating mappings for already-imported deposits (templates impact **future uploads only**).
- Full version history + diff viewer for template changes (nice-to-have).
- Rebuilding the entire Deposit Upload wizard (we reuse existing mapping logic/UI where possible).

## Proposed UX (Admin → Data Settings → Templates)

### Navigation

- Add a new left-nav item under Data Settings: **Templates**
  - Existing items: Manage Fields, Imports, Merges (per current UI)

### Templates list page

- Table columns:
  - Template Name
  - Distributor
  - Vendor
  - Updated
  - Created By
  - Status (Active/Archived)
  - Usage (Deposits count; optional for MVP if cheap)
- Actions:
  - View / Edit
  - Clone
  - Archive / Unarchive
  - Delete (optional; gated and blocked when “in use”)

### Template edit experience (MVP recommendation)

Two-tier editing (keeps MVP shippable):

1. **Metadata editor**: name, description, status.
2. **Mapping editor**:
   - Reuse the Deposit Upload “Map Fields” UI patterns where possible.
   - Allow uploading a **sample file** (CSV/XLS/XLSX) to derive headers, then edit mapping against those headers.
   - Save updates back into `ReconciliationTemplate.config.depositMappingV2`.

If UI reuse is too heavy initially, fallback to a guarded **JSON editor** for `depositMappingV2` + a validation preview (but still ship a real editor later).

## Data model (existing + small extensions)

### Existing (today)

Prisma model: `ReconciliationTemplate`

- `name`, `description`
- `distributorAccountId`, `vendorAccountId`
- `config` (JSON) — contains the deposit mapping config (`depositMappingV2`) and other metadata
- `createdAt`, `updatedAt`
- relation to `Deposit[]` (usage signal)

### MVP extension (recommended)

Prefer **soft-retire** over hard delete:

- Add `isActive` boolean (default `true`) OR `archivedAt` timestamp
- Ensure template resolution logic ignores archived templates (unless explicitly requested)

This avoids breaking imports and preserves history.

## API / backend plan

### Reuse existing reconciliation template APIs

Deposit Upload already uses:

- `GET /api/reconciliation/templates` (list, filtered by distributor/vendor)
- `POST /api/reconciliation/templates` (create)
- `GET /api/reconciliation/templates/:templateId` (detail)
- `PATCH /api/reconciliation/templates/:templateId` (update)

For the Template Manager page, either:

1. Reuse these endpoints directly (preferred for MVP), ensuring the permission model matches intended admins-only editing, **or**
2. Add admin wrappers under `GET/PATCH /api/admin/data-settings/templates...` that call the same underlying service.

### Add/confirm behaviors needed for “management”

- List endpoint supports:
  - paging/sorting (`updatedAt desc` default)
  - search by name
  - filter by distributor/vendor
  - include status (active/archived)
- Update endpoint supports:
  - name/description updates
  - mapping config updates (validated server-side)
- Clone endpoint (new):
  - `POST /api/reconciliation/templates/:templateId/clone`
  - creates a new template row with copied config and a “Copy of …” name (uniqueness respected)
- Archive/unarchive endpoint (new if we add soft-retire):
  - `POST /api/reconciliation/templates/:templateId/archive`
  - `POST /api/reconciliation/templates/:templateId/unarchive`

### Validation (server-side)

- Enforce uniqueness: `(tenantId, distributorAccountId, vendorAccountId, name)`
- Validate `config.depositMappingV2` shape before save (reject invalid JSON / mismatched schema)
- Optional: block “archive/delete” if:
  - template is the only template for a distributor/vendor pair and would break deterministic selection
  - template is referenced by existing deposits (if hard delete is attempted)

## Implementation steps (sequenced)

1. **Discovery**
   - Confirm how templates are selected (single vs multi-template per distributor/vendor; “latest updated wins” rules).
   - Confirm whether non-admin users should ever edit templates outside deposit upload.
2. **Backend support**
   - Add soft-retire fields (if approved) + filtering in template selection.
   - Add clone + archive endpoints and tests.
3. **Frontend (new page)**
   - Add route under `Admin → Data Settings` for Templates.
   - Implement list table + details drawer/page.
4. **Mapping editor**
   - Reuse mapping UI or ship JSON editor fallback (with validation and preview).
   - Save mapping to template config.
5. **Permissions + audit**
   - Ensure only intended roles can manage templates.
   - Log who changed what (at minimum: `updatedAt` + `createdByUserId` on create; optional audit log later).
6. **QA + rollout**
   - Smoke test with Cloud SQL Proxy in local dev.
   - Test flows: create, edit, clone, archive, import uses updated mapping.

## Rollout / safety

- Feature-flag the Template Manager page (UI-only) for initial rollout.
- Prefer “Archive” over “Delete”.
- Add clear UI copy: “Template changes affect future uploads only.”

## Open questions

- Should Template Manager be **admins-only**, or can power users manage templates?
- Do we need template “ownership” by team/account, or is tenant-wide enough?
- Should archived templates still be selectable manually in the Deposit Upload wizard?
- What is the long-term requirement for template versioning/audit history?

## References

- `docs/deposit-system-complete-reference.md` (Reconciliation Templates, DepositMappingConfigV2)
- `docs/plans/2026-02-27-multi-vendor-template-selector-field-mapping-plan.md` (template selection + per-template mapping behavior)
- `docs/runbooks/Cloud_SQL_Proxy_Launch_Guide.md` (local Cloud SQL access)

