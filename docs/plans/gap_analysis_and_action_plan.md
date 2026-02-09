# Commissable CRM — Gap Analysis & Action Plan

**Generated:** 2026-02-09
**Based on:** `strategix_hunter_plan_of_attack.md` + `strategix_hunter_ticket_checklist.csv` vs. current codebase

---

## Executive Summary

Of the **21 developer-owned tickets** in the checklist, **7 are fully complete**, **8 are partially implemented** (code exists but gaps remain), and **6 are not started or missing entirely**. The biggest risks to Rob's testing timeline are the **bulk-edit recalculation bug** (data-integrity), the missing **vendor filter on mapping** (scale blocker), and the two **documentation deliverables** Rob is expecting (propagation/undo write-up and CloudBot 1-pager).

---

## Ticket-by-Ticket Status

### Legend

| Symbol | Meaning |
|--------|---------|
| DONE | Fully implemented, ready for testing |
| PARTIAL | Code exists but has known gaps |
| NOT STARTED | No implementation found |

---

### P0 — ASAP / Before Next Testing Touchpoint

| Ticket | Title | Status | Details |
|--------|-------|--------|---------|
| CRM-DATA-RESET | Clear deposit data in test env | DONE | `prisma/seed.ts` has full `clearDatabase()` covering 39+ entity types. Run via `npm run prisma:seed`. |
| CRM-RS-BULK-RECALC | Bulk edit Price Each recalculation | PARTIAL | Bulk update endpoint exists and recalculates `expectedUsage` and `expectedCommission`. **Missing:** split-derived amounts (house/rep/subagent dollar values) are NOT recalculated; no cascading validation or business-rule checks after bulk update. |
| CRM-RS-DATE-TZ | Schedule date 1st-of-month @ 8am ET | PARTIAL | Dates are normalized to 1st-of-month UTC via `toMonthStartUtc()`. Recent commit `e0ab5a5` added `lib/date-only.ts` for UTC formatting. **Missing:** no 8am ET anchor, no EST/EDT awareness, no tenant-level timezone config. Stored as date-only so time component is irrelevant at the DB level, but the scheduled-job trigger time is not pinned to 8am ET. |
| CRM-PROD-DATES-BACKFILL | Backfill First/Last Schedule Dates | DONE | Calculated client-side in `opportunity-details-view.tsx` by aggregating min/max `scheduleDate` per product. Displayed in the Products tab. Not persisted to the Product table (computed on the fly). This approach works but may need revisiting for performance at scale. |
| CRM-RS-DETAIL-FIELDS | RS detail page field fixes | PARTIAL | "Revenue Type" correctly pulls from product catalog; legacy "Payment Type" explicitly nulled. Field ordering (House Rep then Subagent) is correct. **Missing:** House Rep is **not** marked required (no validation). Subagent does **not** default to "None/N/A". |
| CRM-RS-INLINE-EDIT-POPUP | Inline edit effective date + old/new price | PARTIAL | Full inline editing exists in the RS detail view with save/cancel, unsaved-changes indicator, and toast notifications. **Missing:** no "Old Price / New Price" side-by-side comparison display; effective-date defaulting needs confirmation (currently defaults to the schedule's existing date, not "oldest unreconciled" as Rob may expect). |
| CRM-DOC-PROPAGATION-UNDO | Data propagation + Undo write-up | PARTIAL | The **code** is fully implemented (`lib/matching/auto-fill.ts` propagates vendor data from deposit → opportunity → product on match; `lib/audit/undo-auto-fill.ts` reverts with conflict detection). **Missing:** the actual **document/write-up** Rob requested has not been created. |
| CLOUDBOT-ONEPAGER | CloudBot security/scope 1-pager | NOT STARTED | No documentation, no code, no references in codebase. Owner is Mykel per checklist. |

---

### P1 — Before Data Migration Planning (Feb 19)

| Ticket | Title | Status | Details |
|--------|-------|--------|---------|
| CRM-MV-VENDOR-FILTER | Vendor filter on mapping screen | PARTIAL | Multi-vendor toggle, template resolver, and preview API are all fully implemented. Upload creates per-vendor deposits. **Missing:** no per-vendor filter/selector on the mapping screen — users cannot isolate and map one vendor at a time (critical for files with thousands of rows). |
| CRM-MV-SAVE-TEMPLATE-PROMPT | Warn before navigating away | NOT STARTED | "Save mapping to template" checkbox exists for single-vendor uploads only. **Missing:** no `beforeunload` handler, no unsaved-changes detection, no navigation-away prompt for the mapping step. |
| CRM-MV-NEW-FIELDS-LAYOUT | Move "New fields" below tabs | DONE | Tabbed interface implemented with three tabs (Template Fields / New Fields / Exclude). Layout flows: info section → help text → tabs → column table. |
| CRM-REC-VENDOR-SUMMARY-WIDGET | Floating vendor summary widget | DONE | Fully implemented as a draggable, resizable, floating widget (not a modal). Shows vendor dropdown, unallocated metrics, status badges, sortable columns, color-coded allocation %, and persists position to localStorage. Comprehensive test suite (6 tests). |
| CRM-REC-FLEX-CHARGEBACKS-BUTTON | Flex/Chargebacks button on recon page | PARTIAL | Auto-creation of Flex Chargeback / ChargebackReversal / FlexProduct works when matching negative line items. Flex Review Queue page exists at `/reconciliation/flex-review`. **Missing:** no prominent, dedicated "Flex/Chargebacks" button or entry point on the deposit detail page header. |
| CRM-REC-FLEX-UI-REFINE | Refine Flex/Chargebacks UI | PARTIAL | Expected/Actual/Delta data is present in the match preview API response. Green highlighting exists for fully-allocated rows in the vendor summary. **Missing:** explicit "Expected / Actual / Delta" column labels side-by-side; no green highlight in the apply-preview step for successfully-matched lines; related-schedule column needs more prominence. |
| CRM-PDF-VALIDATION | PDF upload end-to-end validation | DONE | Full PDF parsing via `pdfjs-dist` with text extraction, table-structure recognition, and error handling (password-protected, image-only). Test suite exists. **Dependency:** needs Rob's sample PDF + matching opportunity to do a real end-to-end test. |
| CRM-OPP-INLINE-EDIT-MACRO | Inline edit macro in Opportunity view | DONE | Reusable `useEntityEditor` hook + `EditableField` component implemented across all entity types (Accounts, Contacts, Opportunities, Products, Revenue Schedules). Feature-flagged via `NEXT_PUBLIC_INLINE_DETAIL_EDIT`. Full rollout plan documented. |
| MIGRATION-PREWORK | Pre-work for Feb 19 migration session | PARTIAL | One specific migration is documented (`split-percent-points-migration-option-b.md`). **Missing:** overall migration strategy document covering cold-start vs. full-migration vs. hybrid scenarios. |

---

### P2 — Important But Not Blocking Immediate Testing

| Ticket | Title | Status | Details |
|--------|-------|--------|---------|
| CRM-REC-BACK-BUTTON-FIX | Fix Back button on recon/deposit pages | DONE | Fully implemented — "← Back" button navigates to `/reconciliation` via `router.push`. No known issues detected. |
| CRM-REC-MATCH-SEEDS-DETAIL | Match Seeds "Y" indicator detail | NOT STARTED | No match-seeds or match-criteria visualization exists. No tooltip, icon, or criteria breakdown UI. |
| CRM-REC-APPLY-PREVIEW-HIGHLIGHT | Apply action preview + green highlight | PARTIAL | Preview API endpoint and wizard step are fully functional — shows before/after allocations, validation issues, tolerance warnings. **Missing:** green row highlighting for successfully-matched lines in the preview; no explicit "before → after" visual comparison. |

---

### Client-Owned / External Dependencies

| Ticket | Title | Status | Notes |
|--------|-------|--------|-------|
| ROB-TEST-DATA | Clean test datasets | WAITING | Need from Rob: 1:1, 1:M, M:1, overage/Flex, chargeback, lump-sum datasets |
| ROB-PDF-SAMPLE | Sample PDF deposit + matching opp | WAITING | Need from Rob to unblock CRM-PDF-VALIDATION end-to-end test |
| ROB-MULTIVENDOR-SAMPLE | 10-12 row multi-vendor deposit | WAITING | Need from Rob to test vendor filter at scale |
| ROB-WIDGET-MOCKUP | Vendor summary widget mockup | DONE (N/A) | Widget already implemented — mockup may no longer be needed |

---

## Consolidated Scorecard

| Category | Done | Partial | Not Started | Total |
|----------|------|---------|-------------|-------|
| P0 (ASAP) | 2 | 5 | 1* | 8 |
| P1 (Before Feb 19) | 4 | 4 | 1 | 9 |
| P2 (When possible) | 1 | 1 | 1 | 3 |
| **Totals** | **7** | **10** | **3** | **20** |

*\*CloudBot 1-pager is owned by Mykel, not Hunter*

---

## Key Gaps & Inconsistencies

### 1. Data Integrity Risk: Bulk Edit Recalculation (CRM-RS-BULK-RECALC)
**Severity: HIGH** — Rob flagged this as P0 because stale calculated fields mean reconciliation numbers won't add up.

- `expectedUsage` and `expectedCommission` ARE recalculated, which covers the primary use case.
- Split-derived dollar amounts (house $, house rep $, subagent $) are NOT recalculated after a bulk Price Each change. If Rob is reconciling at the split level, this is a blocker.
- **Action needed:** Audit all fields downstream of `priceEach` and `quantity`; add recalculation for any that are currently stale after bulk updates.

### 2. Multi-Vendor Mapping at Scale (CRM-MV-VENDOR-FILTER)
**Severity: HIGH** — The backend (template resolver, preview, import) is solid. The gap is entirely on the UI: users can't filter the mapping screen to one vendor at a time. With thousands of rows, the mapping screen becomes unusable.

- **Action needed:** Add a vendor dropdown/filter to `MapFieldsStep` that filters the visible column-mapping rows by vendor.

### 3. Missing Documentation Deliverables
**Severity: MEDIUM-HIGH** — Rob explicitly requested two write-ups. Both are P0.

- **Propagation + Undo write-up** (CRM-DOC-PROPAGATION-UNDO): Code is done, doc is not. The auto-fill and undo logic is well-structured — this should be a straightforward document to produce from the code.
- **CloudBot 1-pager** (CLOUDBOT-ONEPAGER): Mykel-owned, but still not delivered. If it's blocking trust/security sign-off, it's a project risk.

### 4. RS Detail Validation Gaps (CRM-RS-DETAIL-FIELDS)
**Severity: MEDIUM** — Field labels and ordering are correct, but:
- House Rep not required → users can save schedules without a House Rep, violating Rob's data quality rules.
- Subagent not defaulting → null/blank Subagent instead of "None/N/A" creates ambiguity.

### 5. Save-Template Navigation Guard (CRM-MV-SAVE-TEMPLATE-PROMPT)
**Severity: MEDIUM** — Users can lose mapping work by accidentally navigating away. This is a standard UX guard that's completely absent.

### 6. Flex/Chargebacks Discoverability (CRM-REC-FLEX-CHARGEBACKS-BUTTON)
**Severity: MEDIUM** — Auto-creation works, but there's no obvious way for a user to manually initiate a Flex/Chargeback from the reconciliation detail page without knowing the right-click/selection workflow.

### 7. Schedule Date Timezone (CRM-RS-DATE-TZ)
**Severity: LOW-MEDIUM** — Dates are stored as date-only (no time component), which sidesteps most DST issues at the DB level. The "8am ET" requirement is about the cron job trigger time, not the stored date. Current implementation normalizes to 1st-of-month UTC, which is functionally correct for date-only storage. The gap is narrow: ensure the scheduled job runner fires at the right wall-clock time.

---

## Recommended Action Plan

### Sprint 1: Unblock Rob's Testing (Target: Before Next Touchpoint)

| # | Ticket | Action | Effort |
|---|--------|--------|--------|
| 1 | CRM-RS-BULK-RECALC | Audit dependent fields; add split-amount recalculation to bulk-update endpoint | Medium |
| 2 | CRM-RS-DETAIL-FIELDS | Add `required` validation to House Rep; default Subagent to "None" when blank | Small |
| 3 | CRM-RS-INLINE-EDIT-POPUP | Add "Old → New" price display when editing Price Each; confirm effective-date default behavior with Rob | Small |
| 4 | CRM-DOC-PROPAGATION-UNDO | Write the propagation/undo explainer doc (code is done, just needs the write-up) | Small |
| 5 | CRM-DATA-RESET | Run seed to clear test data; confirm with Rob that environment is clean | Trivial |

### Sprint 2: Multi-Vendor & Recon UX (Target: Before Feb 19 Migration Meeting)

| # | Ticket | Action | Effort |
|---|--------|--------|--------|
| 6 | CRM-MV-VENDOR-FILTER | Add vendor dropdown filter to `MapFieldsStep` that filters column-mapping rows by selected vendor | Medium |
| 7 | CRM-MV-SAVE-TEMPLATE-PROMPT | Add `beforeunload` handler + in-app navigation guard when mapping has unsaved changes | Small |
| 8 | CRM-REC-FLEX-CHARGEBACKS-BUTTON | Add a visible "Create Flex/Chargeback" button to the deposit detail page action bar | Small |
| 9 | CRM-REC-FLEX-UI-REFINE | Add explicit "Expected / Actual / Delta" column headers; green highlight on fully-matched lines in preview | Small-Medium |
| 10 | MIGRATION-PREWORK | Draft overall migration strategy doc (cold-start vs. full vs. hybrid) for Feb 19 session | Medium |

### Sprint 3: Polish & P2 Items (Target: Ongoing)

| # | Ticket | Action | Effort |
|---|--------|--------|--------|
| 11 | CRM-REC-MATCH-SEEDS-DETAIL | Add tooltip/icon on match indicator showing which criteria triggered the match | Medium |
| 12 | CRM-REC-APPLY-PREVIEW-HIGHLIGHT | Add green row highlighting in match preview for successfully-allocated lines | Small |
| 13 | CRM-RS-DATE-TZ | Pin cron job to 8am ET (if using a job scheduler); verify no edge cases with month-boundary UTC dates | Small |
| 14 | CRM-PROD-DATES-BACKFILL | Evaluate whether to persist first/last dates to Product table for performance (current computed approach works but may not scale) | Deferred |

### External / Waiting on Rob

| # | Item | Action |
|---|------|--------|
| A | ROB-TEST-DATA | Follow up with Rob for clean test datasets |
| B | ROB-PDF-SAMPLE | Follow up with Rob for sample PDF deposit + matching opportunity |
| C | ROB-MULTIVENDOR-SAMPLE | Follow up with Rob for 10-12 row multi-vendor sample file |
| D | CLOUDBOT-ONEPAGER | Confirm status with Mykel; escalate if not in progress |

---

## Architecture Notes

### What's Working Well
- **Multi-vendor backend** is solid: template resolver, preview API, per-vendor deposit creation, and import logic are all production-ready with test coverage.
- **Vendor summary widget** is fully featured — draggable, resizable, sortable, with comprehensive metrics and status badges.
- **Inline editing** is well-architected with a reusable hook (`useEntityEditor`) and component (`EditableField`) pattern used across all entity types.
- **Auto-fill + Undo** pattern is clean: non-destructive propagation with conflict-aware undo and audit trail.
- **PDF parsing** handles real-world edge cases (password-protected, image-only, table recognition).

### Watch Out For
- **`deposit-reconciliation-detail-view.tsx` is 3,869 lines** — this is the main reconciliation component and it's getting unwieldy. Consider extracting sub-components (flex resolution, match wizard, table configs) before adding more features.
- **Client-side schedule date computation** (first/last dates) requires fetching all schedules per opportunity. At scale, this could become a performance bottleneck.
- **Feature flags** (`NEXT_PUBLIC_INLINE_DETAIL_EDIT`) are in use — make sure test environment has them enabled to avoid "works on my machine" issues during Rob's testing.
- **No integration tests** for the bulk-edit → recalculation → reconciliation pipeline end-to-end. This is the most data-sensitive flow and should be tested.

---

## Quick Reference: Key File Locations

| Area | Key Files |
|------|-----------|
| Bulk edit | `app/api/revenue-schedules/bulk-update/route.ts`, `bulk/update-rate/route.ts`, `bulk/update-split/route.ts` |
| Date handling | `lib/date-only.ts`, `jobs/month-to-month-schedule-runner.ts` |
| RS detail/edit | `components/revenue-schedule-details-view.tsx`, `app/api/revenue-schedules/helpers.ts` |
| Multi-vendor | `lib/deposit-import/multi-vendor-template-resolver.ts`, `app/api/reconciliation/templates/multi-vendor-preview/` |
| Deposit mapping | `components/deposit-upload/map-fields-step.tsx`, `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx` |
| Vendor summary | `components/deposit-vendor-summary-floating-widget.tsx`, `lib/reconciliation/vendor-summary.ts` |
| Reconciliation | `components/deposit-reconciliation-detail-view.tsx` |
| Auto-fill/Undo | `lib/matching/auto-fill.ts`, `lib/audit/undo-auto-fill.ts` |
| PDF parsing | `lib/deposit-import/parse-file.ts` |
| Inline editing | `hooks/useEntityEditor.ts`, `components/editable-field.tsx` |
| Data reset | `prisma/seed.ts` |
