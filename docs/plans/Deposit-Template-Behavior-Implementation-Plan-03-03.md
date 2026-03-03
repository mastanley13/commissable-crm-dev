# Deposit Template Bucket Behavior — Implementation Plan (03-03-2026)

This plan implements the acceptance criteria in `docs/plans/Deposit-Template-Behavior-03-03.md` for the three buckets:

- **Template Fields**
- **New Fields**
- **Exclude**

It also bakes in the decision: **New Fields “move” into Template Fields only on the next upload after the saved template is reloaded** (i.e., no in-session bucket migration).

---

## 1) Goals (acceptance criteria)

### Bucket definitions (source of truth)

1. **Template Fields**
   - “Known set” for a vendor: fields/columns that are already saved into that vendor’s template and are reusable.
2. **New Fields**
   - Columns that **have values** and are **not currently in the vendor’s saved template** and are **unmapped** (still need action).
3. **Exclude**
   - Everything else, especially:
     - columns with null/blank values
     - columns the user manually ignores

### “System gets easier over time”

- After a user maps fields and chooses **Save mapping updates**, the **next upload** for the same vendor should:
  - show more columns under **Template Fields**
  - show fewer columns under **New Fields** (ideally trending toward ~0)
  - avoid ballooning **Exclude** unexpectedly

### “Units” / repeating-unknown-field behavior

- If an unknown column repeats later (e.g., “Units”), the system should:
  - suggest consistently and correctly
  - avoid creating duplicate “new fields” over and over (clear memory/recognition rules)

---

## 2) Explicit decision (for this iteration)

**New Fields do not move buckets immediately when the user maps them.**

- In the **current upload session**, the bucket membership stays stable based on the **saved template**.
- After import completes and updates the template (when “Save mapping updates” is enabled), the next upload reloads the template and the newly-saved fields appear under **Template Fields**.

Rationale: this makes the “over time” behavior easy to validate and keeps bucket logic deterministic.

---

## 3) Current behavior summary (what’s inconsistent today)

Today’s Map Fields bucketing is driven by “template-ness” + suggestions, not the acceptance rules:

- **Exclude** is only computed from non-template columns.
- **New Fields** can include mapped columns and is suggestion-gated (unrecognized-but-valued can drop into Exclude).
- “Ignore” and “blank” do not reliably end up in Exclude for template columns.
- Saving template updates can accidentally cause ignored/noise columns to become “template columns” forever (because template column keys are treated as Template Fields on later uploads).

---

## 4) Proposed behavior (rules we implement)

We separate two concepts:

- **Mapping status** (per column): mapped vs unmapped vs ignored
- **Bucket** (Template/New/Exclude): what list the column appears in

### 4.1 Mapping status (unchanged conceptually)

- **Mapped** = column is mapped to a canonical target OR a custom field
- **Ignored** = user selected “Do Not Map”
- **Unmapped** = “Additional info” (no specific field)

### 4.2 Bucket membership (new deterministic rules)

For each file column `H`:

1. If `H` is **ignored** → **Exclude**
2. Else if `H` has **no values** → **Exclude**
3. Else if `H` is in the **saved template known set** → **Template Fields**
4. Else if `H` is **unmapped** and has values → **New Fields**
5. Else → **Exclude**

Notes:
- This intentionally makes **New Fields = “needs mapping”**.
- Mapped-but-not-in-template columns fall into **Exclude** for the current upload session (because we are not moving buckets in-session).

### 4.3 UX guardrail (so mapped “new” columns aren’t “lost”)

Because mapped-but-not-template columns will land in **Exclude** in-session, we should add at least one of:

- Global search/filter for the mapping table (across all buckets)
- A “Show mapped columns” toggle within Exclude (or a badge/count)
- A quick link: “View mapped columns in Review step”

This is a UX mitigation for the chosen “no in-session movement” rule.

---

## 5) Implementation steps (phased)

### Phase 0 — Spec lock + examples (must-do)

Deliverable: a short spec section (could live in this file or a dev ticket) with explicit examples and expected bucket results.

Examples to include (minimum):
- Template column, has values, unmapped → Template Fields
- Template column, blank → Exclude
- Template column, ignored → Exclude
- Non-template column, has values, unmapped → New Fields
- Non-template column, has values, mapped-to-target → Exclude (in-session), becomes Template Fields on next upload if saved
- Non-template column, blank → Exclude

### Phase 1 — Refactor bucketing into a testable helper (must-do)

Goal: make bucket logic deterministic and unit-testable.

Work:
- Extract a pure “classifier” function from `components/deposit-upload/map-fields-step.tsx` into `lib/` (or a nearby `lib/deposit-import/` helper).
- Inputs should include only what’s needed:
  - headers
  - template-known set (derived from template mapping + template fields)
  - per-column selection (target/custom/additional/ignore)
  - per-column hasValues boolean
- Output per header:
  - bucket: `template | new | exclude`
  - reason string (for debugging and tests)

### Phase 2 — Update Map Fields UI to use the new classifier (must-do)

Work:
- Replace the existing `templateRows/newRows/excludeRows` computation with classifier output.
- Ensure:
  - ignored and blank columns always end up in Exclude (even if “template”)
  - New Fields contains only “valued + non-template + unmapped”
  - Template Fields contains only “saved-template-known + not ignored + has values OR not?” (see note below)

Open point (resolve in Phase 0):
- Do we want Template Fields to show “template known” columns even when blank?
  - The acceptance doc strongly emphasizes “blank goes to excluded”.
  - If we still want visibility for “missing expected data”, do it via a secondary UI hint, not by breaking the bucket rule.

### Phase 3 — Template persistence (“auto-template evolution”) (must-do)

Goal: saving mapping updates should grow Template Fields over time **without saving noise**.

Work (single-vendor):
- On import when `saveTemplateMapping = true`, persist a **sanitized** mapping to the selected template:
  - Keep only:
    - `targets` mappings (canonical fields)
    - `columns` entries whose `mode` is `target` or `custom`
    - `customFields` definitions referenced by the remaining `columns`
  - Drop:
    - `ignore` columns
    - `additional` columns (unmapped)
    - any template “known columns” that were never mapped

Work (multi-vendor):
- Apply the same sanitization per template when `saveUpdatesByTemplateId[templateId] = true`.

Why: if we persist ignored/unmapped columns, they become “template known” forever and bloat Template Fields, breaking the “gets easier” goal.

### Phase 4 — “Units” repeating-unknown-field behavior (two-stage)

This acceptance criterion is ambiguous unless we define what “recognized” means.

#### Stage 4A (minimum viable: template-backed recognition)

Definition:
- A field is “recognized” iff it was saved into the template (either as a target mapping or a custom field mapping).

Result:
- If a user mapped “Units” and saved updates, the next upload:
  - shows “Units” in Template Fields
  - keeps the same custom field key (no duplicates)

This is achievable immediately with Phase 3 sanitization + stable custom-key logic.

#### Stage 4B (optional enhancement: recognition without template-save)

If you truly need “recognize even if not saved”, we add a separate memory store:

- A small table keyed by `(tenantId, distributorAccountId, vendorAccountId, normalizedHeader)`
  - lastSeenHeader
  - suggestedTargetId (optional)
  - suggestedCustomLabel/section (optional)
  - firstSeenAt / lastSeenAt

Then:
- New Fields can show “Units” with a consistent suggestion even if no template save occurred.
- We can prevent duplicate custom fields by reusing the stored suggestion/label when the user creates it again.

This is a larger product decision (data model + privacy + lifecycle), so treat as a separate ticket if needed.

### Phase 5 — Tests (must-do)

Unit tests:
- Add a test suite for the classifier covering the Phase 0 examples.

Integration tests:
- Add/extend import-route tests to ensure “save mapping updates” persists the sanitized mapping only.
- Add a regression test that ignored/unmapped columns do **not** become “template known” and inflate Template Fields next time.

### Phase 6 — Validation checklist A–D (must-do)

Run (and record expected outcomes):

A) First-time vendor file (new template)
- valued/unmapped/non-template → New Fields
- blank → Exclude
- (if base defaults exist) known base fields → Template Fields

B) After map + Save
- next upload: previously-new mapped fields now appear in Template Fields

C) Second upload same vendor
- New Fields materially smaller; only truly new valued/unmapped appear

D) Units repeat
- Stage 4A: if saved previously, should not recreate duplicates and should behave predictably
- Stage 4B (if implemented): suggest consistently even if not saved

---

## 6) File-level “where changes will land” (expected touch points)

UI:
- `components/deposit-upload/map-fields-step.tsx` (replace bucketing logic; add search/toggle mitigation)

Mapping/template logic:
- `lib/deposit-import/template-mapping-v2.ts` (if needed for sanitization helpers)
- `app/api/reconciliation/deposits/import/route.ts` (sanitize before persisting template config)

Tests:
- `tests/*` (new classifier tests + import persistence regression tests)

Docs:
- Update after behavior is stable (separate change): `docs/deposit-system-complete-reference.md`, relevant runbooks/guides.

---

## 7) Exit criteria (definition of done)

- Bucket rules match Section 4.2 for both single- and multi-vendor uploads.
- “Save mapping updates” produces measurable improvement over time (New Fields shrinks on next upload).
- No regression where ignored/unmapped columns become permanent Template Fields.
- Checklist A–D passes (with Stage 4A at minimum).

