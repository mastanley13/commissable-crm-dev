# Opportunity Stage Phase 6 — Staging Rollout Checklist

## Goal

Validate the opportunity stage automation end-to-end in staging while monitoring logs and ensuring users can continue working without disruption.

## Pre-flight

- [ ] Confirm database backfill has run (`npx tsx scripts/backfill-opportunity-stages.ts`) and verify sample opportunities mirror expected stage/status combos.
- [ ] Deploy the latest build (Phase 1–7 code) to staging.
- [ ] Review monitoring/alerting configuration (logs & metrics) so baseline is understood before testing.

## Enablement Steps

1. **Smoke Tests**
   - Create a new opportunity; ensure stage dropdown shows new labels and Billing stages are disabled.
   - Add/update opportunity product status; confirm opportunity stage auto-updates (Closed Won – Billing, etc.).
   - Verify opportunity list/detail screens show friendly labels and the “Auto” badge for managed stages.
2. **Logging**
   - Review server logs for `Failed to recalculate opportunity stage` warnings. Investigate any occurrences.
3. **Data Checks**
   - Run spot queries (optional `npx prisma studio`) to validate `Opportunity.stage` vs `Opportunity.status` alignment across tenants.

## Monitoring & Rollback

- Automatic recalculation errors produce console warnings — configure alerts for the string `Failed to recalculate opportunity stage`.
- Rollback procedure: redeploy the previous build (automation remains enabled) and, if necessary, run `npx tsx scripts/backfill-opportunity-stages.ts` to re-normalize data. Schema changes are additive, so data remains intact.

## Post-enablement

- Gather stakeholder feedback (billing/provisioning flows) within 1–2 days.
- Update the project plan (Phase 6 section) once QA sign-off is received.
- Use this checklist as the basis for the production rollout (Phase 7).
