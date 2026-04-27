# GitHub Update Prep - 2026-04-27

## Verification Status

- `npx tsc --noEmit --incremental false`: passed after fixing the literal type for `rankingBasis` in `lib/openclaw/read-only-tools.ts`.
- `npm run test`: passed with 268 total tests, 143 pass, 125 skipped, 0 fail.
- `npm run build`: passed. Build emitted one existing-style Next lint warning for `<img>` usage in `app/(dashboard)/admin/playwright/page.tsx`.

## Fix Applied

- `lib/openclaw/read-only-tools.ts`
  - Annotated `rankingBasis` as `RankedTopUsageAccount["rankingBasis"]` so `rankTopUsageAccounts` returns the declared literal union type.

## Recommended Review Lanes

Keep these as separate GitHub branches or PRs. Do not stage the whole worktree at once.

### Lane 1: OpenClaw Read-Only Bot Surface

Purpose: ship the read-only tool gateway and browser/chat readiness work.

Core paths:

- `app/api/bot/v1/route.ts`
- `app/api/bot/v1/tools/[...path]/route.ts`
- `app/api/bot/v1/reconciliation/**`
- `app/api/bot/v1/revenue-schedules/**`
- `app/api/bot/v1/tickets/**`
- `app/api/openclaw/**`
- `app/(dashboard)/bot/**`
- `components/commissable-bot-chat.tsx`
- `lib/openclaw/**`
- `scripts/openclaw/**`
- `tests/openclaw-readonly-tools.test.ts`
- `tests/integration-openclaw-readonly-tools.test.ts`
- `docs/runbooks/2026-04-22_openclaw-readonly-tool-gateway.md`

Hold for security review:

- `Commissable Bot Build - Status & Next Steps.md`
- OpenClaw deployment/runbook docs with tokens, API keys, Telegram setup, hostnames, or service environment details.

### Lane 2: Admin Imports, Import Jobs, Undo, and Data Settings

Purpose: ship import validation, import job records, row error export, recent import display, and import undo support.

Core paths:

- `app/api/admin/data-settings/imports/**`
- `app/api/admin/data-settings/*/route.ts`
- `app/(dashboard)/admin/data-settings/page.tsx`
- `components/data-settings-imports-section.tsx`
- `components/data-settings-recent-imports-view.tsx`
- `lib/data-import/catalog.ts`
- `lib/deposit-import/admin-deposit-transactions.ts`
- `lib/deposit-import/shared.ts`
- `lib/deposit-import/parse-file.ts`
- `lib/deposit-import/multi-vendor-template-resolver.ts`
- `lib/server-revenue-types.ts`
- `docs/test-data/data-settings-imports/minimum-validation/**`
- `tests/admin-import-error-account-context.test.ts`
- `tests/integration-admin-data-settings-*.test.ts`
- `tests/full-import-readiness.test.ts`
- `prisma/migrations/20260413100000_add_admin_deposit_transaction_history/**`
- `prisma/migrations/20260413113000_add_opportunity_line_item_import_entity/**`
- `prisma/migrations/20260422100000_add_import_job_undo_tracking/**`

Needs DB proof before merge:

- migration deploy against the approved test/dev DB,
- `RUN_INTEGRATION_TESTS=1` integration run,
- validation-only no-write proof,
- import undo proof for created records.

### Lane 3: Salesforce ID and CRM Table/UI Updates

Purpose: ship account Salesforce ID support plus related CRM table/detail updates.

Core paths:

- `app/api/accounts/**`
- `components/account-create-modal.tsx`
- `components/account-edit-modal.tsx`
- `components/account-details-view.tsx`
- `lib/salesforce-id.ts`
- `prisma/migrations/20260422110000_add_account_salesforce_id/**`
- account import tests that cover Salesforce ID handling.

Review carefully:

- `app/api/accounts/[accountId]/route.ts` also changes delete behavior by removing the active-account delete guard; confirm this is intentional before including it.

### Lane 4: Reconciliation Playwright QA and Evidence Browser

Purpose: ship repeatable reconciliation suite tooling and admin artifact review.

Core paths:

- `playwright.config.ts`
- `package.json`
- `package-lock.json`
- `app/(dashboard)/admin/playwright/**`
- `app/api/admin/playwright/artifacts/route.ts`
- `lib/playwright-reconciliation-results.ts`
- `scripts/playwright/**`
- `tests/e2e/**`
- `tests/playwright-reconciliation-results.test.ts`
- `.artifacts/playwright/reconciliation-suite/latest.json`
- `.artifacts/playwright/reconciliation-suite/latest-partial.json`

Hold or externalize unless explicitly needed:

- full Playwright history folders,
- videos/traces/screenshots/html reports,
- one-off scenario triage CSV/JSON/MD files.

### Lane 5: Revenue Schedule Split Governance

Purpose: ship the local lockout of direct revenue schedule split editing and shared split display math.

Core paths:

- `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
- `app/api/revenue-schedules/bulk/update-split/route.ts`
- `components/revenue-schedule-details-view.tsx`
- `components/revenue-schedule-status-modal.tsx`
- `lib/revenue-schedule-math.ts`
- `tests/revenue-schedule-split-display.test.ts`
- `commissable_total_split_handoff.md`

Review decision needed:

- confirm schedule-level split edits should be blocked now rather than hidden behind a feature flag.

### Lane 6: Resource Center

Purpose: ship the support/resource-center UI and content search.

Core paths:

- `app/(dashboard)/resources/**`
- `components/resources/**`
- `lib/resources/**`
- `docs/plans/2026-04-20-support-resource-center-plan.md`

Need browser QA:

- desktop/mobile resource list,
- resource article page,
- search/filter behavior.

### Lane 7: Full Import Data Package and Planning Docs

Purpose: preserve import source data and planning evidence only if the repo is intended to store operational data packages.

Candidate paths:

- `2026-04-17_Import_Test_Data/**`
- `docs/test-data/data-settings-imports/full-import/**`
- `docs/plans/2026-04-20-import-openclaw-completion-sprint/**`
- root-level workbooks and CSV exports.

Default recommendation:

- keep these out of app-code PRs,
- move client/source workbooks to secure external storage if they contain customer data,
- commit only sanitized sample/minimum-validation files needed by automated tests.

## Quarantine / Cleanup Buckets

No files were moved, deleted, or reverted during this prep pass. These are recommended buckets before staging.

### Security Review Before Any Commit

- `.env`
- `.env.local`
- `cookies.txt`
- `Commissable Bot Build - Status & Next Steps.md`
- OpenClaw systemd/deployment files under `docs/plans/2026-04-20-import-openclaw-completion-sprint/**`
- any docs/runbooks mentioning API keys, bearer tokens, Telegram tokens, passwords, hostnames, SSH keys, or production database URLs.

Action:

- rotate any exposed bot/API tokens,
- redact credentials from docs,
- keep real env files out of Git,
- consider removing tracked `cookies.txt` in a dedicated cleanup PR if it is not intentionally versioned.

### Generated / Evidence Artifacts

- `.artifacts/playwright/reconciliation-suite/latest*.json`
- `docs/plans/**/generated/**`
- root `test-scenario-*` files,
- root `wave-*.csv` files,
- Playwright reports, traces, videos, screenshots, and HTML output,
- exported spreadsheets and source workbooks.

Action:

- commit only small canonical summaries needed by the admin Playwright UI,
- externalize bulky evidence and customer/source data,
- avoid mixing generated evidence with app code in the same PR.

### Source-Code Candidates

- `app/**`
- `components/**`
- `lib/**`
- `prisma/**`
- `scripts/**`
- `tests/**`
- `package.json`
- `package-lock.json`
- `playwright.config.ts`

Action:

- stage by lane, review each diff, and run verification per lane.

## Suggested Pre-Push Checklist

1. Confirm which lane is being prepared first.
2. Review only that lane's diff with `git diff -- <paths>`.
3. Keep generated artifacts and security-sensitive docs unstaged unless explicitly approved.
4. Run:
   - `npx tsc --noEmit --incremental false`
   - `npm run test`
   - `npm run build`
5. For admin import lanes, additionally run DB-backed tests with the approved test database.
6. For OpenClaw lanes, rerun browser and Telegram smoke checks after gateway env is configured.
7. Commit lane-specific changes only.
