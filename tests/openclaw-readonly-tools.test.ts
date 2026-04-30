import test from "node:test"
import assert from "node:assert/strict"

import {
  OPENCLAW_V1_INTENT_CAPABILITIES,
  buildOpenClawReadOnlySystemPrompt,
  rankTopUsageAccounts,
  resolveCalendarDateRange,
  resolveIntentFromMessage,
} from "@/lib/openclaw/read-only-tools"

test("OpenClaw capability registry includes the supported top usage insight and explicit unsupported intents", () => {
  const topUsage = OPENCLAW_V1_INTENT_CAPABILITIES.find((entry) => entry.intent === "insight.top_usage_accounts")
  const accountsWithIssues = OPENCLAW_V1_INTENT_CAPABILITIES.find((entry) => entry.intent === "insight.accounts_with_issues")

  assert.ok(topUsage)
  assert.equal(topUsage.availability, "supported")
  assert.ok(topUsage.toolMappings.some((tool) => tool.path === "revenue-schedules/top-usage-accounts"))

  assert.ok(accountsWithIssues)
  assert.equal(accountsWithIssues.availability, "not_yet_supported")
  assert.equal(accountsWithIssues.toolMappings.length, 0)
})

test("resolveCalendarDateRange supports month=YYYY-MM and deterministic current-month defaults", () => {
  const monthParams = new URLSearchParams("month=2026-03")
  const monthResult = resolveCalendarDateRange({ searchParams: monthParams })

  assert.equal(monthResult.ok, true)
  if (!monthResult.ok) {
    throw new Error(monthResult.error)
  }

  assert.equal(monthResult.value.mode, "calendar_month")
  assert.equal(monthResult.value.month, "2026-03")
  assert.equal(monthResult.value.fromDate, "2026-03-01")
  assert.equal(monthResult.value.toDate, "2026-03-31")
  assert.equal(monthResult.value.toExclusive.toISOString(), "2026-04-01T00:00:00.000Z")

  const defaultResult = resolveCalendarDateRange({
    searchParams: new URLSearchParams(),
    defaultNow: new Date("2026-04-23T12:00:00.000Z"),
  })

  assert.equal(defaultResult.ok, true)
  if (!defaultResult.ok) {
    throw new Error(defaultResult.error)
  }

  assert.equal(defaultResult.value.mode, "default_current_month")
  assert.equal(defaultResult.value.fromDate, "2026-04-01")
  assert.equal(defaultResult.value.toDate, "2026-04-30")
})

test("resolveCalendarDateRange rejects ambiguous or invalid historical parameters", () => {
  const mixed = resolveCalendarDateRange({
    searchParams: new URLSearchParams("month=2026-03&from=2026-03-01&to=2026-03-31"),
  })
  assert.equal(mixed.ok, false)
  if (mixed.ok) {
    throw new Error("Expected mixed month/from/to to fail")
  }
  assert.match(mixed.error, /either month=YYYY-MM or from\/to/i)

  const partial = resolveCalendarDateRange({
    searchParams: new URLSearchParams("from=2026-03-01"),
  })
  assert.equal(partial.ok, false)
  if (partial.ok) {
    throw new Error("Expected partial explicit range to fail")
  }
  assert.match(partial.error, /both be provided together/i)

  const backwards = resolveCalendarDateRange({
    searchParams: new URLSearchParams("from=2026-03-31&to=2026-03-01"),
  })
  assert.equal(backwards.ok, false)
  if (backwards.ok) {
    throw new Error("Expected backwards range to fail")
  }
  assert.match(backwards.error, /on or before/i)
})

test("rankTopUsageAccounts sorts by the ranking value returned in the response", () => {
  const ranked = rankTopUsageAccounts([
    {
      accountId: "account-a",
      account: { id: "account-a", accountName: "Adjustment Heavy", accountLegalName: null, accountNumber: null },
      scheduleCount: 1,
      expectedUsage: 100,
      usageAdjustment: 0,
      actualUsage: 100,
      actualUsageAdjustment: -20,
      expectedCommission: 10,
      actualCommission: 8,
    },
    {
      accountId: "account-b",
      account: { id: "account-b", accountName: "Steady Net", accountLegalName: null, accountNumber: null },
      scheduleCount: 1,
      expectedUsage: 90,
      usageAdjustment: 0,
      actualUsage: 90,
      actualUsageAdjustment: 0,
      expectedCommission: 9,
      actualCommission: 9,
    },
    {
      accountId: "account-c",
      account: { id: "account-c", accountName: "Expected Only", accountLegalName: null, accountNumber: null },
      scheduleCount: 1,
      expectedUsage: 120,
      usageAdjustment: 5,
      actualUsage: null,
      actualUsageAdjustment: null,
      expectedCommission: 12,
      actualCommission: 0,
    },
  ])

  assert.deepEqual(
    ranked.map((row) => [row.account.accountName, row.rankingBasis, row.rankingUsageNet]),
    [
      ["Expected Only", "expected_usage_net", 125],
      ["Steady Net", "actual_usage_net", 90],
      ["Adjustment Heavy", "actual_usage_net", 80],
    ],
  )
  assert.deepEqual(
    ranked.map((row) => row.rank),
    [1, 2, 3],
  )
})

test("resolveIntentFromMessage maps a supported business question to the top usage intent with suggested params", () => {
  const resolution = resolveIntentFromMessage({
    message: "What are the top 5 usage accounts for March 2026?",
    defaultNow: new Date("2026-04-23T12:00:00.000Z"),
  })

  assert.equal(resolution.routeDiscoveryAllowed, false)
  assert.equal(resolution.primaryMatch?.intent, "insight.top_usage_accounts")
  assert.equal(resolution.primaryMatch?.handlingMode, "direct_tool_call")
  assert.equal(resolution.primaryMatch?.suggestedParams.month, "2026-03")
  assert.equal(resolution.primaryMatch?.suggestedParams.limit, 5)
  assert.ok(
    resolution.primaryMatch?.toolMappings.some((tool) => tool.path === "revenue-schedules/top-usage-accounts"),
  )
})

test("resolveIntentFromMessage maps realistic import blockers and write requests without route discovery", () => {
  const importResolution = resolveIntentFromMessage({
    message: "Show me the latest revenue schedule import blockers.",
  })
  assert.equal(importResolution.primaryMatch?.intent, "workflow.import_status")
  assert.equal(importResolution.primaryMatch?.suggestedParams.entity, "RevenueSchedules")
  assert.equal(importResolution.primaryMatch?.suggestedParams.status, "Failed")

  const previewResolution = resolveIntentFromMessage({
    message: "Create a ticket for this reconciliation issue.",
  })
  assert.equal(previewResolution.primaryMatch?.intent, "action.draft_support_ticket")
  assert.equal(previewResolution.primaryMatch?.availability, "preview_only")
  assert.equal(previewResolution.primaryMatch?.handlingMode, "preview_only")

  const unsupportedResolution = resolveIntentFromMessage({
    message: "Which accounts have the most issues?",
  })
  assert.equal(unsupportedResolution.primaryMatch?.intent, "insight.accounts_with_issues")
  assert.equal(unsupportedResolution.primaryMatch?.availability, "not_yet_supported")
  assert.equal(unsupportedResolution.primaryMatch?.handlingMode, "unsupported")
})

test("buildOpenClawReadOnlySystemPrompt references the registry and resolver instead of API discovery", () => {
  const prompt = buildOpenClawReadOnlySystemPrompt("/api/bot/v1/tools")

  assert.match(prompt, /\/api\/bot\/v1\/tools\/capabilities/)
  assert.match(prompt, /\/api\/bot\/v1\/tools\/capabilities\/resolve/)
  assert.match(prompt, /Do not ask users for route names, endpoint details, HTTP methods, or API discovery help/i)
  assert.match(prompt, /Keep OpenClaw v1 read-only/i)
})

test("resolveIntentFromMessage maps V1.5 demo action prompts to draft/preview intents", () => {
  const cases = [
    {
      prompt: "Draft a support ticket for this failed revenue schedule import.",
      intent: "action.draft_support_ticket",
    },
    {
      prompt: "Draft an import correction plan for failed account rows that need a corrected CSV re-upload.",
      intent: "action.draft_import_correction_plan",
    },
    {
      prompt: "Draft a reconciliation handoff for this unmatched payment.",
      intent: "action.draft_reconciliation_handoff",
    },
    {
      prompt: "Preview the match review for this deposit line before applying it.",
      intent: "action.preview_match_review",
    },
    {
      prompt: "Draft a client follow-up note about the current import cleanup review.",
      intent: "action.draft_client_follow_up",
    },
  ]

  for (const entry of cases) {
    const resolution = resolveIntentFromMessage({ message: entry.prompt })
    assert.equal(resolution.primaryMatch?.intent, entry.intent, entry.prompt)
    assert.equal(resolution.primaryMatch?.availability, "preview_only", entry.prompt)
    assert.equal(resolution.primaryMatch?.handlingMode, "preview_only", entry.prompt)
    assert.equal(resolution.routeDiscoveryAllowed, false, entry.prompt)
  }
})
