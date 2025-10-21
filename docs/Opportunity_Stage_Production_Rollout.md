# Opportunity Stage Phase 7 — Production Rollout Checklist

## Goal

Graduate the opportunity stage automation to production with a controlled pilot and clear rollback path.

## Pre-flight

- [ ] Phase 6 (staging) sign-off complete and documented.
- [ ] Database backup/snapshot captured before rollout.
- [ ] Monitoring dashboards reviewed (error rates, opportunity KPIs).

## Rollout Steps

1. **Pilot Tenant Enablement**
   - Deploy the latest build (automation is on by default).
   - Select pilot tenant(s); notify stakeholders about new stage behaviour and auto-managed billing stages.
2. **Smoke Tests (Pilot)**
   - Create/edit opportunity for pilot tenant data.
   - Toggle opportunity product statuses; confirm stage transitions (Provisioning → Billing → Billing Ended).
   - Validate list/detail screens show friendly labels and “Auto” badge.
3. **Monitor**
   - Watch for `Failed to recalculate opportunity stage` log entries.
   - Track opportunity creation/edit success, product status transitions, and billing KPIs.
   - Maintain rapid feedback loop with pilot users.
4. **Full Rollout** (after pilot window)
   - Deploy to all tenants (no flag change required).
   - Re-run smoke tests on a random set of tenants.

## Monitoring & Alerting

- Log alerts: trigger on `Failed to recalculate opportunity stage` and unexpected 4xx/5xx spikes in opportunity APIs.
- Metrics: dashboards for opportunity stage distribution, product status mix, and error rates.
- Support: prepare communication macro explaining auto-managed stages and how billing transitions drive status.

## Rollback Plan

- Redeploy prior build if severe issues occur.
- Run `npx tsx scripts/backfill-opportunity-stages.ts` to normalize data if stages/statuses diverged.
- Communicate rollback to stakeholders and record incident follow-up.

## Post-rollout Tasks

- Update Opportunity_Stages_Update_Plan.md (Phase 7/8 sections) with rollout date and pilot outcomes.
- Document lessons learned, including any support tickets raised.
- Schedule a metrics review 1–2 weeks after launch to confirm stability.
