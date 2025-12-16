# Deposit Upload Mapping – Improvement Plan

This document outlines a set of targeted improvements to the Deposit Upload + Field Mapping + Template system. It is structured around the gaps identified during the review and proposes concrete changes, options, and sequencing for implementation.

---

## 1. Template Selection When Multiple Templates Exist

**Current state**

- `DepositUploadListPage` fetches templates with:
  - `GET /api/reconciliation/templates?distributorAccountId=...&vendorAccountId=...&pageSize=1`
  - Uses the *first* result (sorted by name) without exposing the template choice in the UI.
- `ReconciliationTemplate` is unique per `(tenantId, distributorAccountId, vendorAccountId)` today, but nothing enforces that we only ever have one template per pair.

**Risks / gaps**

- If a second template is created for the same Distributor/Vendor (e.g., different Telarus models or “Custom” vs “Telarus”), the upload wizard will silently pick one, which is ambiguous and hard to debug.

**Proposed plan**

1. **Short‑term guardrail**
   - Enforce at the API level that only one template is created per `(tenantId, distributorAccountId, vendorAccountId)`:
     - We already have a Prisma unique constraint; the `POST /api/reconciliation/templates` route returns 409 when violated.
     - Document this rule in `docs/deposit-upload-mapping.md` and any admin UI that edits templates.
   - In the deposit upload flow, keep `pageSize=1` but explicitly log (server‑side or in dev tools) when more than one template exists (via a separate internal diagnostic query).

2. **Optional medium‑term enhancement (if product wants multiple templates per pair)**
   - Relax the uniqueness constraint and introduce:
     - `isDefault: boolean` on `ReconciliationTemplate` or `sortOrder: number` to break ties.
   - Deposit Upload UI changes:
     - In Step 2, show the name of the template being applied (e.g., “Using template: Telarus‑Spectrum (default)”).
     - Optionally add a small dropdown allowing users to switch templates for that upload.
   - Import route:
     - Persist the ID of the template actually used (see section 6) so analytics/debugging knows which template produced which import.

**Priority**

- Short‑term: clarify and document the “single template per pair” rule; surface multi‑template situations in logs.
- Medium‑term: only if we need multiple templates per Distributor/Vendor by design.

---

## 2. Telarus Label Coverage in the Seed Script

**Current state**

- `scripts/seed-telarus-reconciliation-templates.ts` maps only a subset of Telarus `Commissable Field Label`s through `COMMISSABLE_LABEL_TO_DEPOSIT_FIELD_ID`.
- Everything else is effectively left as “Additional info” in templates.

**Risks / gaps**

- Seeded templates are useful but not as rich as they could be; many high‑value fields may remain unmapped until a user fixes them manually.

**Proposed plan**

1. **Add visibility into unmapped labels**
   - During seeding, log all distinct `commissableFieldLabel` values that are *not* recognized by `COMMISSABLE_LABEL_TO_DEPOSIT_FIELD_ID`, along with counts.
   - Optionally, write these to a CSV or JSON in `docs/reference-data/` for easier review.

2. **Define a label‑review workflow**
   - On a periodic basis (e.g., once per quarter):
     - Review unmapped labels and categorize them:
       - Should map to an existing `DepositFieldId`?
       - Should map to a new canonical field (requires schema work)?
       - Should remain “Additional info” (low priority / reporting only)?
   - Extend `COMMISSABLE_LABEL_TO_DEPOSIT_FIELD_ID` accordingly.

3. **Re‑seed templates safely**
   - For non‑production environments:
     - Allow re‑running the seed script to update templates in place.
   - For production:
     - Provide a toggle/flag to control whether existing templates should be overwritten or only enriched when a new label mapping is introduced.
   - Use the “template source” metadata (see section 5) to distinguish between strictly Telarus‑sourced mappings and user‑learned mappings.

**Priority**

- Medium: improves import experience, but current behavior is safe (extra fields just become “Additional info”). Good next step once base behavior is stable.

---

## 3. Seed Script Account Matching and Tenant Handling

**Current state**

- The seed script:
  - Picks the first `Tenant` in the DB.
  - Resolves Distributor and Vendor by case‑insensitive `accountName` equals Telarus `Origin` / `CompanyName` values.

**Risks / gaps**

- Multi‑tenant environments: seed only affects the first tenant.
- Name mismatches: minor spelling or naming differences between Telarus and our `Account` records result in templates not being created, without a clear remediation path.

**Proposed plan**

1. **Tenant scoping**
   - Add configuration to the seed script:
     - Read `TENANT_ID` from an env var or CLI argument.
     - If not supplied, either refuse to run or prompt (in interactive contexts).
   - For multi‑tenant installs, allow running the seeder once per tenant.

2. **Account mapping configuration**
   - Introduce a small JSON mapping file in `docs/reference-data/`:

     ```json
     {
       "Telarus|Spectrum": { "distributorAccountId": "…", "vendorAccountId": "…" },
       "Telarus|Zayo UK": { "distributorAccountId": "…", "vendorAccountId": "…" }
     }
     ```

   - Seed script behavior:
     - First, look for a direct mapping in this JSON using `${origin}|${companyName}`.
     - If not found, fall back to `accountName` lookup.
     - Log both successful and failed matches to aid reconciliation.

3. **Operational docs**
   - Update `docs/deposit-upload-mapping.md` with:
     - Instructions for creating/maintaining the account mapping JSON.
     - Examples of seeding per tenant: `TENANT_ID=… npx tsx scripts/seed-telarus-reconciliation-templates.ts`.

**Priority**

- Medium‑high in environments with multiple tenants or non‑standard account naming.

---

## 4. Template Config Shape & Versioning

**Current state**

- `ReconciliationTemplate.config` is an unstructured `Json?` field that we treat as `{ depositMapping: DepositMappingConfigV1, ... }`.
- `extractDepositMappingFromTemplateConfig` expects a `depositMapping` key with `version === 1` and validates shape.

**Risks / gaps**

- If `config` is repurposed or mutated elsewhere, it could drift from the expected structure, causing mapping extraction to silently degrade or reset to an empty mapping.

**Proposed plan**

1. **Document a reserved structure**
   - In `docs/deposit-upload-mapping.md`, explicitly define `config` as:

     ```ts
     interface ReconciliationTemplateConfig {
       depositMapping: DepositMappingConfigV1
       telarusTemplateId?: string | null
       telarusOrigin?: string | null
       source?: "telarus" | "learned" | "manual"
       // additional keys must not conflict with `depositMapping`
     }
     ```

2. **Guard writes from non‑deposit contexts**
   - Any new consumer of `ReconciliationTemplate.config` should:
     - Preserve `depositMapping` and `source` keys.
     - Only add additional keys under a separate namespace (e.g., `notes`, `metadata`).

3. **Future‑proofing versioning**
   - If we ever introduce `DepositMappingConfigV2`:
     - Add `depositMappingV2` or a `mappingVersion` and keep `extractDepositMappingFromTemplateConfig` backward‑compatible.
   - For now, documenting that `version: 1` is required is sufficient.

**Priority**

- Low‑medium: more about preventing future misuse than about fixing a current bug.

---

## 5. Template “Learning” Semantics (Overwrite vs Preserve)

**Current state**

- After each successful import, the import route:
  - Serializes `mappingConfigForTemplate` and upserts it into `ReconciliationTemplate.config` for the Distributor/Vendor pair.
  - That effectively overwrites any prior template (including Telarus‑seeded ones).

**Risks / gaps**

- There’s no distinction between:
  - “Reference Telarus template” (seeded from CSV).
  - “Learned default mapping” (from user uploads).
  - “Manually curated template” (created by an admin).

**Proposed plan**

1. **Introduce a `source` indicator in config**
   - When seeding from Telarus, store:

     ```json
     {
       "depositMapping": { ... },
       "telarusTemplateId": "2449",
       "telarusOrigin": "Telarus",
       "source": "telarus"
     }
     ```

   - When the import route auto‑creates a template, set:

     ```json
     {
       "depositMapping": { ... },
       "source": "learned"
     }
     ```

   - For manually created templates, include `"source": "manual"` if applicable.

2. **Adjust update behavior**
   - On import:
     - If an existing template has `source: "telarus"`:
       - Option A (safe): create or update a separate `"learned"` template and leave the Telarus reference intact.
       - Option B (simpler, but destructive): allow overwrite only when a flag is enabled or in non‑prod environments.
     - If `source: "learned"`:
       - Always overwrite with the latest mapping (current behavior).

3. **Expose source in admin tools**
   - In any admin UI listing templates, show the source and whether it’s auto‑learned vs Telarus‑derived.

**Priority**

- Medium: helpful once we rely on Telarus seeds and/or manual templates heavily and want to preserve them as references.

---

## 6. Link Imports to the Template Used

**Current state**

- `ImportJob.filters.mapping` stores the raw mapping payload used for import.
- We do not persist the ID of the `ReconciliationTemplate` (if any) that was applied to seed the mapping.

**Risks / gaps**

- Hard to answer questions like “Which template did we use for this import?” or “Did this import run against a Telarus template or a learned one?”

**Proposed plan**

1. **Track `templateId` on the client**
   - When `DepositUploadListPage` successfully fetches a template:
     - Store `selectedTemplateId` in component state alongside `mapping`.
   - Include `templateId` as an additional field in the `FormData` payload submitted to `/api/reconciliation/deposits/import`.

2. **Persist `templateId` in `ImportJob`**
   - Extend `ImportJob.filters` to include `templateId`:

     ```json
     {
       "distributorAccountId": "...",
       "vendorAccountId": "...",
       "mapping": { ... },
       "templateId": "…",
       "commissionPeriod": "…"
     }
     ```

   - This is backwards‑compatible because `filters` is a JSON blob.

3. **Optional: store last template usage on `ReconciliationTemplate`**
   - Consider adding:
     - `lastUsedAt: DateTime?`
     - `usageCount: Int @default(0)`
   - Update these counters inside the same transaction that creates the `ImportJob`.

**Priority**

- Medium‑high: low effort, high value for debugging and analytics.

---

## 7. Auto‑Mapping vs Template‑Mapping Interactions

**Current state**

- `seedDepositMapping`:
  - Starts from `templateMapping` (if provided).
  - Prunes invalid headers.
  - Runs `applyAutoMapping` to fill in missing canonical fields.

**Risks / gaps**

- In most cases, this is desirable. However, in edge cases:
  - If Telarus templates deliberately omit certain fields or rename them, auto‑mapping might select a suboptimal column for that canonical field based on heuristics.

**Proposed plan**

1. **Parameterize auto‑mapping behavior**
   - Extend `seedDepositMapping`’s signature to accept an optional `mode`:

     ```ts
     type SeedMode = "auto-fill-only" | "template-only" | "auto-only"
     ```

   - Default to `"auto-fill-only"` (current behavior):
     - Use template where provided, supplement with heuristics.
   - `"template-only"`:
     - Use template mapping exactly as provided; do *not* run `applyAutoMapping`.
   - `"auto-only"`:
     - Ignore templates; map purely from heuristics (for debugging or fallback scenarios).

2. **Expose control points**
   - For now, keep the UI behavior as `"auto-fill-only"` but document the other modes for advanced debugging or future product options.
   - In tests, exercise all modes to ensure determinism.

3. **Guard against unexpected overrides**
   - Consider tracking which fields came from templates vs auto‑mapping vs user edits (e.g., via comments or additional metadata in `config`), if we later need fine‑grained introspection.

**Priority**

- Low‑medium: not strictly needed today, but a useful enhancement if we encounter subtle template vs heuristic conflicts.

---

## 8. Canonical Field & Schema Coverage

**Current state**

- Canonical deposit fields cover core usage and commission metrics plus account/vendor IDs, product names, and some ancillary identifiers.
- Telarus CSV includes a richer set of metrics (activation commission, equipment commission, bandwidth commission, etc.) that are currently not mapped to dedicated canonical fields.

**Risks / gaps**

- We may not be able to represent or report on some detailed commission breakdowns without relying on “Additional info” columns, which are harder to query and reason about.

**Proposed plan**

1. **Requirements gathering**
   - With product / reporting stakeholders, identify which Telarus fields are crucial for downstream reporting and analytics.
   - Categorize them by:
     - Must be canonical / first‑class fields.
     - Nice‑to‑have, can remain “Additional info” for now.

2. **Schema design**
   - For fields that need to be canonical, propose:
     - New `DepositLineItem` columns (e.g., `activationCommission`, `equipmentCommission`, `bandwidthCommission`, etc.) with appropriate types.
     - New `DepositFieldDefinition` entries with matching `id`s and labels.
   - Ensure these additions are backward‑compatible and optional at first.

3. **Mapping updates**
   - Extend `COMMISSABLE_LABEL_TO_DEPOSIT_FIELD_ID` and `AUTO_FIELD_SYNONYMS` to include new fields.
   - Update import logic to read and store these values when they are mapped.

4. **Reporting alignment**
   - Verify that any downstream reporting or export logic understands the new fields.

**Priority**

- Business‑driven: once clear reporting requirements are defined, this becomes high‑impact.

---

## 9. UX Feedback for Template Lookup Failures

**Current state**

- If the template lookup in `DepositUploadListPage` fails:
  - The code logs to `console.warn` / `console.error` and falls back to heuristic auto‑mapping.
  - The user is not informed that a template lookup was attempted or failed.

**Risks / gaps**

- Users may have an expectation that “Telarus templates” are always used; if a lookup fails, they’ll see only auto‑mapping behavior and might not understand discrepancies.

**Proposed plan**

1. **Non‑blocking UI notice**
   - Add a small, dismissible info banner within the Map Fields step when:
     - A template lookup was attempted but the API returned an error, or
     - No template was found for the given Distributor/Vendor pair.
   - Example messages:
     - “No saved mapping template was found for this distributor and vendor. Using best‑effort auto‑mapping.”
     - “Unable to load mapping template. You can still map fields manually; your mapping will be learned once the import completes.”

2. **Telemetry / logging**
   - Log failed lookups with details (tenant, distributor, vendor) for later analysis, without exposing sensitive IDs.

3. **Admin troubleshooting**
   - In the admin templates view, surface counts for:
     - Templates that are never used.
     - Distributor/Vendor combinations that frequently upload deposits but have no template – to suggest where a manual or Telarus‑based template would help most.

**Priority**

- Medium‑low: improves transparency and supportability.

---

## 10. Script Robustness (Module Resolution)

**Current state**

- `scripts/seed-telarus-reconciliation-templates.ts` imports `@/lib/...` modules, relying on TypeScript/Next.js path aliases and the `tsx` runner.

**Risks / gaps**

- If scripts are run outside the usual environment or the alias configuration changes, the script may fail to resolve imports.

**Proposed plan**

1. **Switch to relative imports**
   - Update imports in the script to use relative paths from the repo root, for example:

     ```ts
     import { depositFieldDefinitions } from "../lib/deposit-import/fields"
     import {
       createEmptyDepositMapping,
       serializeDepositMappingForTemplate,
       type DepositFieldId,
       type DepositMappingConfigV1,
     } from "../lib/deposit-import/template-mapping"
     ```

2. **Add a package script for seeding**
   - In `package.json`, add:

     ```json
     "scripts": {
       "seed:telarus-templates": "tsx scripts/seed-telarus-reconciliation-templates.ts"
     }
     ```

   - This gives a standard entry point and ensures the proper runner is used.

3. **Doc updates**
   - Update `docs/deposit-upload-mapping.md` with a short “How to seed Telarus templates” section that references the new script name.

**Priority**

- Low: current setup is workable if we standardize on `tsx` and path aliases, but relative imports reduce future friction.

---

## Implementation Sequencing

Suggested order of work, balancing impact vs. complexity:

1. **Link imports to template (Section 6)** – easy to implement, high value for debugging and analytics.
2. **Template source semantics (Section 5)** – clarifies Telarus vs learned vs manual templates; useful for any future changes.
3. **Tenant scoping and account mapping for seeding (Section 3)** – important for correct Telarus seeding in multi‑tenant/prod setups.
4. **Telarus label coverage improvements (Section 2)** – incremental enhancement; start with logging unmapped labels.
5. **UX feedback for template lookup failures (Section 9)** – non‑breaking UX improvement.
6. **Script robustness (Section 10)** – low effort, improves maintainability.
7. **Auto‑mapping vs template‑mapping modes (Section 7)** – optional; implement when/if we see real conflicts.
8. **Canonical field expansion (Section 8)** – coordinate with product/reporting before schema changes.
9. **Multi‑template selection (Section 1, medium‑term path)** – only if product needs multiple templates per Distributor/Vendor.

This plan should keep the current system stable while incrementally improving reliability, transparency, and template effectiveness.

