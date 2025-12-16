# AI-Assisted Deposit Upload Mapping – Concept & Plan

This document explores how to evolve the current Deposit Upload + Field Mapping + Template system so that AI can automatically propose mappings for uploaded deposit files, while keeping humans in control and preserving deterministic behavior.

It builds on the existing architecture described in `docs/deposit-upload-mapping.md`.

---

## 1. Vision: What “AI Handles Mapping” Means

Goal: when a user uploads a deposit file for a given Distributor & Vendor, the system should:

- Understand the file structure (headers + sample data).
- Use Distributor/Vendor context and history.
- Apply existing templates.
- Use AI to infer the most likely mapping for remaining fields.
- Present a nearly complete mapping in the Map Fields step, ready for quick review and confirmation.

AI is an assistant, not a replacement:

- The canonical mapping is still persisted only after user confirmation.
- The existing `DepositMappingConfigV1` and template system remain the core contract.

---

## 2. Where AI Fits in the Current Architecture

Today:

- `seedDepositMapping({ headers, templateMapping })` combines:
  - An optional `templateMapping` from `ReconciliationTemplate.config`.
  - Heuristic auto‑mapping via `applyAutoMapping` (`AUTO_FIELD_SYNONYMS`).
- `DepositUploadListPage` passes the resulting `DepositMappingConfigV1` into `MapFieldsStep`.
- Users adjust mapping and import; the import route writes the final mapping back into `ReconciliationTemplate.config`.

With AI:

- AI becomes a new “suggestor” used inside or alongside `seedDepositMapping`:

  ```ts
  const templateMapping = loadTemplateMapping(...)
  const baseline = seedDepositMapping({ headers, templateMapping })
  const aiSuggestion = await suggestMappingWithAI({
    distributor,
    vendor,
    headers,
    sampleRows,
    templateMapping,
    baselineMapping: baseline,
  })
  const mapping = mergeMappings(baseline, aiSuggestion)
  ```

- The rest of the flow (UI, import, templates) stays the same; only the way we *propose* mappings changes.

---

## 3. Inputs and Outputs for AI

**Inputs to AI:**

- Context:
  - Tenant (ID or slug).
  - Distributor and Vendor identifiers and human‑readable names.
- Canonical schema:
  - `depositFieldDefinitions` (IDs, labels, descriptions, required flags, types).
- File sample:
  - Column headers (`string[]`).
  - A small number of data rows (e.g., 5–10) to show value patterns per column.
- Optional prior knowledge:
  - Existing template mapping (`ReconciliationTemplate.config.depositMapping`).
  - Baseline heuristic mapping (`seedDepositMapping` result).

**Desired AI output:**

- Minimal and structured:

  ```jsonc
  {
    "line": {
      "usage": "Total Usage",
      "commission": "Total Commission",
      "accountIdVendor": "Customer Account",
      "productNameRaw": "Product Name",
      "commissionRate": null // leave unmapped
    }
  }
  ```

- Values must be either:
  - `null` (no mapping), or
  - An exact header string drawn from the provided `headers`.

We then transform this into a partial `DepositMappingConfigV1` and merge it with template/heuristic mappings.

---

## 4. Initial Implementation: Prompt-Only AI Suggestor

### 4.1. New API endpoint

Create a new internal endpoint, e.g.:

- `POST /api/reconciliation/deposits/ai-suggest-mapping`

Request body:

```ts
interface AiSuggestMappingRequest {
  distributorAccountId: string
  vendorAccountId: string
  distributorName: string
  vendorName: string
  headers: string[]
  sampleRows: string[][] // limited to N rows
  depositFields: Array<{
    id: string
    label: string
    description?: string
    required?: boolean
    type: "string" | "number" | "date"
  }>
  templateMapping?: DepositMappingConfigV1 | null
  baselineMapping?: DepositMappingConfigV1 | null
}
```

Response body:

```ts
interface AiSuggestMappingResponse {
  line: Partial<Record<string, string | null>> // DepositFieldId -> header or null
}
```

Behavior:

- Validates the request.
- Builds a detailed prompt for an LLM (system + user messages).
- Calls the model.
- Validates the returned JSON:
  - Only field IDs that exist in `depositFieldDefinitions`.
  - Only header strings that exist in `headers`.
  - Strips invalid entries.
- Returns the normalized `line` map.

### 4.2. Prompt sketch

System message (example):

> You are a data import assistant for a CRM. Your job is to map columns from a vendor deposit file to canonical deposit fields.
> 
> Always return valid JSON. Do not invent column names; only use the headers provided.

User message structure:

- High‑level context:
  - Distributor: `Telarus`
  - Vendor: `Spectrum`
- Canonical fields:
  - For each `DepositFieldDefinition`: `id`, `label`, `description`, `type`, whether `required`.
- Any existing template mapping:
  - “For past files from Spectrum, we used: `usage ← "Total Usage"`, `commission ← "Commission Amount"`…”
- File structure:
  - `headers`: `["Vendor", "Customer Account", "Total Usage", "Total Commission", ...]`
  - Sample data:
    - Show per‑column samples, e.g. first 3 values under each header.
- Task:

> Decide which header best matches each canonical field. If you are not confident, leave the field unmapped (null).
> 
> Return JSON in the following shape:
> 
> ```json
> { "line": { "fieldId": "Column Header or null" } }
> ```

### 4.3. Integration into the wizard

In `DepositUploadListPage`, after parsing the file and seeding the mapping:

1. Call the AI endpoint (behind a feature flag).
2. Merge AI suggestions into the `mapping` state:
   - Only fill `mapping.line[fieldId]` when it is currently empty and AI provided a header.
   - Do not override:
     - Template mappings.
     - Existing heuristic mappings.
     - Any user selections.
3. Re‑run the required‑fields validation and update the Map Fields UI.

UI can show a small note: “Field mappings suggested based on history and AI. Please review before importing.”

---

## 5. Dataset and Feedback Loop

### 5.1. Data we already have

- `ReconciliationTemplate.config.depositMapping`:
  - For each `(tenantId, distributorAccountId, vendorAccountId)`, we store the latest user‑confirmed mapping.
- `ImportJob.filters`:
  - Contains `mapping: mappingPayload` and can be extended to include `templateId`.
- Uploaded deposit files:
  - At minimum, headers and a few sample rows can be logged or stored for training/analysis.

### 5.2. Logging AI suggestions vs final mappings

To improve mapping quality over time:

- Log, for each import:
  - AI suggestion (`aiLine`).
  - Final mapping (`finalLine` from `mappingConfigForTemplate.line`).
  - Distributor/Vendor context.
  - Headers and maybe a small sample of per‑column values.
- Compute metrics offline:
  - For each canonical field:
    - Precision: fraction of AI‑mapped fields that matched the final mapping.
    - Recall: fraction of fields that were ultimately mapped and AI predicted correctly.
  - Break down by Vendor and Distributor for targeted improvements.

This can inform better label dictionaries, improved prompts, or future fine‑tuning.

---

## 6. Template Evolution with AI

AI does not change the core lifecycle:

1. A template (Telarus‑seeded, manual, or learned) provides a baseline mapping for a Distributor/Vendor.
2. AI proposes additional or refined mappings based on the current file.
3. User reviews and adjusts mappings in the Map Fields step.
4. On successful import, the final mapping is written back into `ReconciliationTemplate.config`.

Consider adding:

- `config.source: "telarus" | "learned" | "manual" | "learned+ai"` (see improvement plan).
- Optional `lastUsedAt` and `usageCount` fields on `ReconciliationTemplate` to track how often AI‑assisted mappings are used and corrected.

---

## 7. UX Considerations

### 7.1. Transparency

- Clearly indicate when AI suggestions are in play:
  - Small badge or note in Map Fields: “AI‑assisted mapping applied. Please review.”
  - Optional column‑level tooltips: “Suggested based on prior imports from Spectrum.”

### 7.2. Control

- Feature flagging:
  - Per‑environment: disabled in development or staging until ready.
  - Per‑tenant or per‑role: only for admins or early adopters initially.
- Allow users to override anything:
  - The UI already supports manual changes; AI never locks a mapping.

### 7.3. Auto‑skip modes (later)

Once confidence is high for certain vendors:

- Tenant‑level or template‑level option:
  - “If all required fields are confidently mapped, skip Map Fields and go directly to Review.”
  - Eventually, for highly trusted combos, “silent imports” might be possible, but that would require strong guardrails and auditing.

---

## 8. Safety & Guardrails

- **Validation remains hard‑coded**:
  - Required fields must be mapped; server enforces it.
  - Column presence and types are validated regardless of AI.
- **No direct file content injection into prompts** without sanitization:
  - Normalize header and value strings.
  - Avoid including user‑provided text as instructions.
- **Rate limiting and caching**:
  - Cache AI suggestions keyed by `(tenantId, distributorAccountId, vendorAccountId, headerHash)` to avoid repeated calls for identical file structures.
  - Apply rate limits to prevent runaway costs or abuse.

---

## 9. Phased Roadmap

**Phase 1 – Instrumentation (no AI yet)**

- Ensure:
  - `ImportJob.filters.mapping` always stores the final mapping payload.
  - `ImportJob.filters.templateId` is recorded once template ID wiring is in place.
  - `ReconciliationTemplate.config.source` is set appropriately (Telarus vs learned vs manual).

**Phase 2 – AI Suggestion Endpoint**

- Implement `/api/reconciliation/deposits/ai-suggest-mapping`.
- Integrate with an external LLM provider using prompts as described above.
- Validate and normalize AI output.

**Phase 3 – Wizard Integration (behind a feature flag)**

- In `DepositUploadListPage`:
  - After template + heuristic seeding, call AI.
  - Merge AI suggestions into `mapping`.
  - Add a subtle UI indicator for AI‑assisted mapping.

**Phase 4 – Feedback Loop & Metrics**

- Log AI vs final mappings for analysis.
- Build basic metrics (precision/recall per field and per vendor).
- Use insights to refine prompts and label mappings (`COMMISSABLE_LABEL_TO_DEPOSIT_FIELD_ID` and `AUTO_FIELD_SYNONYMS`).

**Phase 5 – Advanced Modes & UI Enhancements**

- Optional:
  - Template selection UI when multiple templates exist per pair.
  - “AI confidence” display for each mapping.
  - Auto‑skip Map Fields for highly trusted templates/vendors (with strong auditing and rollback).

---

## 10. Summary

The current deposit upload system already has the right primitives for AI‑assisted mapping:

- A canonical schema, a mapping model (`DepositMappingConfigV1`), per‑Distributor/Vendor templates, and a strong review UI.

To add AI:

- Introduce a focused AI suggestion service that returns a partial `line` mapping.
- Feed it Distributor/Vendor context, headers, sample rows, and existing templates.
- Merge AI suggestions with templates and heuristics, always keeping user review in the loop.
- Persist final mappings back into templates so AI and templates get better over time.

This approach minimizes risk, keeps behavior explainable, and allows gradual rollout and continuous improvement.

