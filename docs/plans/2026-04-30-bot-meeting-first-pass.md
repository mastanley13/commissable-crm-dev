# Commissable Bot Meeting First Pass - April 30, 2026

## One-Minute Client Status

Commissable Bot is in a controlled V1 pilot stage. It is connected to the CRM through a read-only capability layer and is intended to help users look up, summarize, and understand CRM, import, and reconciliation information without changing records or financial data.

Today, the bot can support account context lookup, revenue schedule search, top usage account questions, deposit lookup, reconciliation summaries, recent import status, and import-error visibility. It can also complete non-persistent draft/preview work: support ticket drafts, import correction plans, reconciliation exception handoffs, match-review previews, and client follow-up drafts. It does not yet run imports, apply matches, update schedules, create records, delete data, finalize deposits, or perform rollback actions.

This read-only posture is intentional. Because the bot touches financial and reconciliation workflows, action-taking should wait until approval records, audit logs, rollback behavior, duplicate checks, and permission controls are proven.

## Best Meeting Position

Use this framing:

> We have a safe read-only V1 assistant path. The first version is focused on visibility, lookup, import status, and reconciliation summaries. The next step is proving answer quality and channel reliability before we expand into previews and controlled actions.

Updated meeting framing after the first implementation pass:

> We now have a safe V1.5 demo layer. The bot still does not mutate CRM data, but it can complete useful draft/preview work for operators: ticket drafts, import correction plans, reconciliation handoffs, match-review previews, and client follow-up drafts.

Avoid this framing:

> The bot is a production autonomous reconciliation operator.

## Demo Prompts To Use

These map to current reviewed V1 capabilities:

```text
What are the top 5 usage accounts for March 2026?

What recent imports failed?

Look up account context for ACC Business.

Give me a reconciliation summary.

Find revenue schedules for ACC Business.

Draft a support ticket for this failed revenue schedule import: rows failed validation and need accounting review.

Draft an import correction plan for failed account rows that need a corrected CSV re-upload.

Draft a reconciliation handoff for this unmatched payment: vendor amount does not clearly match the expected schedule balance.

Preview the match review for this deposit line before applying it: compare account, vendor, usage, commission, and rate.

Draft a client follow-up note about the current import cleanup review.
```

## Prompts To Avoid In The Meeting

These expose roadmap items or unsupported V1 actions:

```text
Fix this import.

Apply this match.

Create a customer record.

Undo this reconciliation.

Which accounts have the biggest problems?

Which accounts have the largest variances?
```

If asked, answer:

> That is on the roadmap, but V1 is intentionally read-only. The next phase is preview mode, where the bot can show what it would recommend without changing CRM data. Controlled actions come after human approval, audit logging, and rollback proof are in place.

## Current Strengths

- Read-only capability registry exists for approved business intents.
- The bot has a purpose-built CRM tool surface rather than broad internal route access.
- Top usage account questions support calendar-month and explicit date ranges.
- Write-style requests are routed to read-only preview/guidance behavior.
- Five V1.5 draft/preview actions now route directly instead of falling into generic refusal copy.
- Unsupported insights are explicitly identified instead of letting the bot guess internal routes.
- The in-app bot shell exists with role/topic navigation and chat.
- The UI can show CRM read-only mode when live OpenClaw transport is not available.

## Current Shortcomings To Be Transparent About

- Live browser/OpenClaw gateway and Telegram smoke proof still need to be completed or re-run before production-readiness claims.
- Current insight coverage is useful but narrow; variance rollups and cross-entity issue rankings are not yet reviewed V1 capabilities.
- The starter prompt experience can still lead users into broad workflow questions that exceed V1.
- Transcript-level evals are the next quality gate; route-level tests alone do not prove client answer quality.
- Data completeness matters. If March 2026 schedules/imports are not present in the current tenant, the bot may correctly return no records.

## One-Hour Improvement Priority

1. Verify current `/bot` status badge: live OpenClaw, CRM read-only, or offline fallback.
2. Run the five demo prompts and record which return useful answers in the current tenant.
3. If a prompt returns no data, classify whether that is a bot issue or missing tenant data.
4. Keep the meeting demo inside read-only capabilities.
5. Assign the next sprint to browser/Telegram smoke, transcript evals, and high-value read-only insight expansion.

## Next Sprint Recommendations

- Complete browser and Telegram smoke tests from the same approved prompt set.
- Add a 10-15 prompt transcript eval corpus with expected answer classes.
- Tighten bot starter prompts so they map directly to supported V1 capabilities.
- Add read-only insights for variance summaries, accounts with issues, deposits needing review, and schedule exception rollups.
- Add observability fields for detected intent, answer class, source mode, fallback mode, and tool path.
- Define V1.5 preview mode for match suggestions, variance previews, duplicate-risk checks, and non-persistent impact previews.
- Define V2 controlled-action gates: human approval, exact payload, payload hash, audit log, before/after state, rollback plan, and focused tests.

## Verification From This Pass

- `node --import tsx --test tests/openclaw-readonly-tools.test.ts`
- Result: 7 tests passed, 0 failed.
- Covered: capability registry, top usage intent resolution, March 2026 date parsing, rejected ambiguous date params, write-request preview routing, unsupported-intent routing, and read-only system prompt guardrails.
- `node scripts/openclaw/check-operator-preflight.cjs`
- Result: pass.
- Covered: deployed dev bot-tools auth contract rejects an intentionally invalid OpenClaw token with `401 Invalid API token`.
- Note: authenticated browser status contract was skipped because `OPENCLAW_PREFLIGHT_COOKIE` is not set in this local environment.
- After V1.5 draft/preview pass: `node --import tsx --test tests/openclaw-readonly-tools.test.ts`
- Result: 8 tests passed, 0 failed.
- Covered: five draft/preview starter prompts route to specific V1.5 intents.
- `npx tsc --noEmit --incremental false`
- Result: passed.
- `node --import tsx --test tests/integration-openclaw-readonly-tools.test.ts`
- Result: integration cases skipped because `RUN_INTEGRATION_TESTS=1` is not enabled.
- Accuracy caveat from browser review: a failed/undone account import may appear in the app as `Completed` with `errorCount > 0` plus `undoStatus = Undone`, not as `status = Failed`. The bot import troubleshooting path has been adjusted to treat failed-import questions as "Failed status, error rows, or undo activity" instead of only `status = Failed`.
- Environment caveat: local `.env.local` read-only DB check did not contain the import history visible in the browser screenshot, so final answer-quality validation must happen against the same app tenant/environment where the import was run.
