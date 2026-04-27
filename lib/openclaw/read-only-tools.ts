export type OpenClawToolDefinition = {
  method: "GET" | "POST"
  path: string
  summary: string
}

export type OpenClawCapabilityParam = {
  name: string
  required: boolean
  format: string
  description: string
}

export type OpenClawCapabilityToolMapping = {
  method: "GET" | "POST"
  path: string
  purpose: string
}

export type OpenClawCapabilityAvailability = "supported" | "preview_only" | "not_yet_supported"

export type OpenClawHandlingMode =
  | "direct_tool_call"
  | "clarify_business_lookup"
  | "preview_only"
  | "unsupported"

export type OpenClawCapability = {
  intent: string
  availability: OpenClawCapabilityAvailability
  handlingMode: OpenClawHandlingMode
  summary: string
  exampleUtterances: string[]
  normalizedParams: OpenClawCapabilityParam[]
  toolMappings: OpenClawCapabilityToolMapping[]
  responsePattern: string
  phaseBoundary: "read-only-v1"
  fallbackRule: string
}

export type OpenClawSuggestedParamValue = string | number | boolean | null

export type OpenClawIntentResolutionMatch = {
  intent: string
  availability: OpenClawCapabilityAvailability
  handlingMode: OpenClawHandlingMode
  confidence: "high" | "medium" | "low"
  summary: string
  matchedTerms: string[]
  suggestedParams: Record<string, OpenClawSuggestedParamValue>
  toolMappings: OpenClawCapabilityToolMapping[]
  responsePattern: string
  fallbackRule: string
}

export type OpenClawIntentResolution = {
  message: string
  normalizedMessage: string
  routeDiscoveryAllowed: false
  primaryMatch: OpenClawIntentResolutionMatch | null
  matches: OpenClawIntentResolutionMatch[]
}

export type OpenClawRuntimeContract = {
  version: string
  routingMode: "business_intent_first"
  routeDiscoveryAllowed: false
  capabilityRegistryPath: string
  capabilityResolverPath: string
  executionModel: string[]
  supportedIntentCount: number
  previewIntentCount: number
  unsupportedIntentCount: number
}

export type TopUsageAccountAggregate = {
  accountId: string
  account?: {
    id: string
    accountName: string
    accountLegalName: string | null
    accountNumber: string | null
  } | null
  scheduleCount: number
  expectedUsage: unknown
  usageAdjustment: unknown
  actualUsage: unknown
  actualUsageAdjustment: unknown
  expectedCommission: unknown
  actualCommission: unknown
}

export type RankedTopUsageAccount = {
  rank: number
  account: {
    id: string
    accountName: string
    accountLegalName: string | null
    accountNumber: string | null
  }
  scheduleCount: number
  expectedUsage: number
  usageAdjustment: number
  expectedUsageNet: number
  actualUsage: number
  actualUsageAdjustment: number
  actualUsageNet: number
  expectedCommission: number
  actualCommission: number
  rankingUsageNet: number
  rankingBasis: "actual_usage_net" | "expected_usage_net"
}

export type ResolvedCalendarRange = {
  mode: "default_current_month" | "calendar_month" | "explicit_date_range"
  month: string | null
  from: Date
  toInclusive: Date
  toExclusive: Date
  fromDate: string
  toDate: string
}

type CalendarRangeResult =
  | {
      ok: true
      value: ResolvedCalendarRange
    }
  | {
      ok: false
      error: string
    }

type IntentMatchRule = {
  allOf?: string[]
  anyOf?: string[]
  noneOf?: string[]
  score: number
}

const MONTH_PATTERN = /^\d{4}-\d{2}$/
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_NAME_PATTERN =
  /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{4})\b/i

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  january: "01",
  jan: "01",
  february: "02",
  feb: "02",
  march: "03",
  mar: "03",
  april: "04",
  apr: "04",
  may: "05",
  june: "06",
  jun: "06",
  july: "07",
  jul: "07",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  october: "10",
  oct: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12",
}

const IMPORT_ENTITY_TERMS: Array<{ entity: string; terms: string[] }> = [
  { entity: "RevenueSchedules", terms: ["revenue schedule", "revenue schedules", "schedule import", "schedule imports"] },
  { entity: "Accounts", terms: ["account import", "account imports", "accounts import", "accounts imports"] },
  { entity: "Contacts", terms: ["contact import", "contact imports", "contacts import", "contacts imports"] },
  { entity: "Opportunities", terms: ["opportunity import", "opportunity imports", "opportunities import", "opportunities imports"] },
  { entity: "OpportunityLineItems", terms: ["line item import", "line item imports", "opportunity line item", "opportunity line items"] },
  { entity: "Products", terms: ["product import", "product imports", "products import", "products imports"] },
  { entity: "DepositTransactions", terms: ["deposit import", "deposit imports", "deposit transaction", "deposit transactions"] },
  { entity: "Reconciliations", terms: ["reconciliation import", "reconciliation imports"] },
  { entity: "Activities", terms: ["activity import", "activity imports", "activities import", "activities imports"] },
  { entity: "Tickets", terms: ["ticket import", "ticket imports", "tickets import", "tickets imports"] },
  { entity: "Users", terms: ["user import", "user imports", "users import", "users imports"] },
]

const INTENT_MATCH_RULES: Record<string, IntentMatchRule[]> = {
  "insight.top_usage_accounts": [
    { allOf: ["usage"], anyOf: ["top", "highest", "largest", "biggest"], score: 8 },
    { allOf: ["usage"], anyOf: ["account", "accounts"], score: 6 },
    { allOf: ["top"], anyOf: ["usage accounts", "usage account"], score: 10 },
  ],
  "lookup.account_context": [
    { allOf: ["account"], anyOf: ["context", "summary", "lookup", "look up"], score: 8 },
    { allOf: ["account"], anyOf: ["show me", "crm context"], score: 6 },
  ],
  "lookup.revenue_schedule_search": [
    { anyOf: ["revenue schedule", "revenue schedules", "schedule", "schedules"], score: 7 },
    { allOf: ["schedule"], anyOf: ["find", "show", "search"], score: 5 },
  ],
  "lookup.deposit_detail": [
    { anyOf: ["deposit", "deposits"], score: 7 },
    { allOf: ["deposit"], anyOf: ["detail", "find", "show", "search"], score: 5 },
  ],
  "workflow.reconciliation_summary": [
    { anyOf: ["reconciliation summary", "reconciliation status", "unreconciled deposits"], score: 9 },
    { allOf: ["reconciliation"], anyOf: ["summary", "totals", "status"], score: 6 },
  ],
  "workflow.import_status": [
    { anyOf: ["import", "imports"], score: 7 },
    { allOf: ["import"], anyOf: ["failed", "failure", "errors", "blockers", "status", "recent", "latest"], score: 8 },
  ],
  "action.preview_write_request": [
    { anyOf: ["create", "update", "delete", "apply", "undo", "run", "draft"], score: 5 },
    { allOf: ["ticket"], anyOf: ["create", "draft"], score: 9 },
    { anyOf: ["apply match", "undo import", "run import", "update schedule", "create ticket"], score: 10 },
  ],
  "insight.accounts_with_issues": [
    { allOf: ["account", "accounts"], anyOf: ["issues", "problems", "open issues"], score: 10 },
  ],
  "insight.variance_summary": [
    { anyOf: ["variance", "variances"], score: 8 },
    { allOf: ["largest"], anyOf: ["variance", "variances"], score: 9 },
  ],
}

export const OPENCLAW_V1_CAPABILITY_REGISTRY_VERSION = "2026-04-23"

export const OPENCLAW_READ_ONLY_TOOL_DEFINITIONS: OpenClawToolDefinition[] = [
  { method: "GET", path: "manifest", summary: "Describe the approved read-only tool surface." },
  { method: "GET", path: "capabilities", summary: "Return the business intent to capability registry for v1." },
  { method: "GET", path: "capabilities/resolve", summary: "Resolve a user business question to capability matches and suggested params." },
  { method: "GET", path: "accounts/search", summary: "Search accounts by business identifiers and names." },
  { method: "GET", path: "accounts/:id/context", summary: "Return account context including linked CRM activity." },
  { method: "GET", path: "contacts/search", summary: "Search contacts and contact-account context." },
  { method: "GET", path: "products/search", summary: "Search products by code, name, vendor, or distributor." },
  { method: "GET", path: "opportunities/search", summary: "Search opportunities by account, order, or stage." },
  { method: "GET", path: "opportunities/:id/context", summary: "Return opportunity context including schedules." },
  { method: "GET", path: "revenue-schedules/search", summary: "Search revenue schedules with explicit read-only filters." },
  { method: "GET", path: "revenue-schedules/top-usage-accounts", summary: "Rank accounts by usage for a month or explicit date range." },
  { method: "GET", path: "reconciliation/deposits/search", summary: "Search deposits and reconciliation status." },
  { method: "GET", path: "reconciliation/deposits/:id/detail", summary: "Return deposit detail and line-item context." },
  { method: "GET", path: "reconciliation/summary", summary: "Return reconciliation summary totals for a date range." },
  { method: "GET", path: "imports/readiness", summary: "Summarize import readiness and recent import outcomes." },
  { method: "GET", path: "imports/recent", summary: "Return recent import jobs with status context." },
  { method: "GET", path: "imports/:id/errors", summary: "Return import errors for a specific import job." },
  { method: "GET", path: "records/link", summary: "Build a CRM link for a supported record type." },
  { method: "POST", path: "tickets/draft", summary: "Create a non-persistent draft ticket payload only." },
]

export const OPENCLAW_V1_INTENT_CAPABILITIES: OpenClawCapability[] = [
  {
    intent: "insight.top_usage_accounts",
    availability: "supported",
    handlingMode: "direct_tool_call",
    summary: "Answer top usage account questions directly from reviewed revenue schedule aggregates.",
    exampleUtterances: [
      "What are the top 5 usage accounts for March 2026?",
      "Show me the highest usage accounts this month.",
    ],
    normalizedParams: [
      { name: "month", required: false, format: "YYYY-MM", description: "Preferred for a calendar-month ranking request." },
      { name: "from", required: false, format: "YYYY-MM-DD", description: "Explicit inclusive range start. Must be paired with to." },
      { name: "to", required: false, format: "YYYY-MM-DD", description: "Explicit inclusive range end. Must be paired with from." },
      { name: "limit", required: false, format: "1-25 integer", description: "Number of ranked accounts to return. Defaults to 5." },
    ],
    toolMappings: [
      {
        method: "GET",
        path: "revenue-schedules/top-usage-accounts",
        purpose: "Return ranked account usage totals with explicit range context and deterministic ordering.",
      },
    ],
    responsePattern: "Return ranked accounts, usage totals, the resolved date range, and the usage metric used for ranking.",
    phaseBoundary: "read-only-v1",
    fallbackRule: "If month/from/to are invalid or mixed, fail with a specific parameter error instead of probing routes or guessing.",
  },
  {
    intent: "lookup.account_context",
    availability: "supported",
    handlingMode: "clarify_business_lookup",
    summary: "Find an account and summarize its related CRM context.",
    exampleUtterances: [
      "Look up Acme Telecom and summarize the account context.",
      "Show me the CRM context for account 123.",
    ],
    normalizedParams: [
      { name: "q", required: false, format: "string", description: "Search phrase when the account ID is not already known." },
      { name: "accountId", required: false, format: "UUID", description: "Direct account lookup when already resolved." },
    ],
    toolMappings: [
      { method: "GET", path: "accounts/search", purpose: "Resolve the account when only a name or account number is provided." },
      { method: "GET", path: "accounts/:id/context", purpose: "Return the account summary, contacts, opportunities, schedules, and tickets." },
    ],
    responsePattern: "Return the matched account and its related read-only CRM context.",
    phaseBoundary: "read-only-v1",
    fallbackRule: "If multiple accounts match, ask a business clarification about which account the user means instead of searching for routes.",
  },
  {
    intent: "lookup.revenue_schedule_search",
    availability: "supported",
    handlingMode: "direct_tool_call",
    summary: "Search revenue schedules by account, product, vendor, status, or date range.",
    exampleUtterances: [
      "Find revenue schedules for Test Vendor in April 2026.",
      "Show unreconciled schedules for Acme.",
    ],
    normalizedParams: [
      { name: "q", required: false, format: "string", description: "Search phrase across schedule number and related entity names." },
      { name: "accountId", required: false, format: "UUID", description: "Restrict to a single account when already known." },
      { name: "vendorAccountId", required: false, format: "UUID", description: "Restrict to a specific vendor account." },
      { name: "productId", required: false, format: "UUID", description: "Restrict to a specific product." },
      { name: "from", required: false, format: "YYYY-MM-DD", description: "Explicit inclusive range start." },
      { name: "to", required: false, format: "YYYY-MM-DD", description: "Explicit inclusive range end." },
    ],
    toolMappings: [
      { method: "GET", path: "revenue-schedules/search", purpose: "Return schedule rows that match the resolved filters." },
    ],
    responsePattern: "Return matching schedules with account, product, balance, and status context.",
    phaseBoundary: "read-only-v1",
    fallbackRule: "If the request is too broad, narrow by business entity or time period instead of attempting endpoint discovery.",
  },
  {
    intent: "lookup.deposit_detail",
    availability: "supported",
    handlingMode: "clarify_business_lookup",
    summary: "Find deposits and return deposit or line-item detail for reconciliation review.",
    exampleUtterances: [
      "Find the April ACH deposit for Test Vendor.",
      "Show me deposit detail for deposit 456.",
    ],
    normalizedParams: [
      { name: "q", required: false, format: "string", description: "Deposit name or related account/vendor/distributor text." },
      { name: "status", required: false, format: "Deposit status enum", description: "Restrict to a specific deposit status when needed." },
      { name: "depositId", required: false, format: "UUID", description: "Direct deposit lookup when already known." },
    ],
    toolMappings: [
      { method: "GET", path: "reconciliation/deposits/search", purpose: "Resolve the deposit from business text or status filters." },
      { method: "GET", path: "reconciliation/deposits/:id/detail", purpose: "Return deposit summary and line-item detail." },
    ],
    responsePattern: "Return the matching deposit summary or deposit detail without mutating reconciliation state.",
    phaseBoundary: "read-only-v1",
    fallbackRule: "If no deposit matches, say so clearly and keep the user on read-only lookup guidance.",
  },
  {
    intent: "workflow.reconciliation_summary",
    availability: "supported",
    handlingMode: "direct_tool_call",
    summary: "Summarize reconciliation totals for a requested time window.",
    exampleUtterances: [
      "Give me a reconciliation summary for April 2026.",
      "How many unreconciled deposits do we have right now?",
    ],
    normalizedParams: [
      { name: "from", required: false, format: "YYYY-MM-DD", description: "Explicit inclusive range start." },
      { name: "to", required: false, format: "YYYY-MM-DD", description: "Explicit inclusive range end." },
    ],
    toolMappings: [
      { method: "GET", path: "reconciliation/summary", purpose: "Return deposit counts, statuses, and allocation totals." },
    ],
    responsePattern: "Return summary counts and totals for the resolved reconciliation window.",
    phaseBoundary: "read-only-v1",
    fallbackRule: "If the request implies applying or reversing reconciliation, switch to preview/guidance mode and do not mutate data.",
  },
  {
    intent: "workflow.import_status",
    availability: "supported",
    handlingMode: "direct_tool_call",
    summary: "Summarize import readiness, recent imports, and import errors.",
    exampleUtterances: [
      "What recent imports failed?",
      "Show me the latest revenue schedule import blockers.",
    ],
    normalizedParams: [
      { name: "entity", required: false, format: "DataEntity enum", description: "Restrict results to a single import entity type." },
      { name: "status", required: false, format: "Job status enum", description: "Restrict recent jobs to a specific status." },
      { name: "importJobId", required: false, format: "UUID", description: "Fetch detailed errors for a known import job." },
    ],
    toolMappings: [
      { method: "GET", path: "imports/readiness", purpose: "Return summarized import readiness and status totals." },
      { method: "GET", path: "imports/recent", purpose: "Return recent import jobs for the resolved entity or status." },
      { method: "GET", path: "imports/:id/errors", purpose: "Return row-level import errors when a job is selected." },
    ],
    responsePattern: "Return readiness and recent import status, optionally drilling into a selected import job's errors.",
    phaseBoundary: "read-only-v1",
    fallbackRule: "If the request asks to run or undo an import, explain that v1 is read-only and provide the human workflow instead.",
  },
  {
    intent: "action.preview_write_request",
    availability: "preview_only",
    handlingMode: "preview_only",
    summary: "Handle write-action requests by summarizing the requested action and staying non-persistent.",
    exampleUtterances: [
      "Create a ticket for this reconciliation issue.",
      "Update the schedule and tell me what would happen.",
    ],
    normalizedParams: [
      { name: "issue", required: false, format: "string", description: "Short issue summary for a non-persistent preview draft." },
      { name: "recommendation", required: false, format: "string", description: "Suggested next step or handoff guidance." },
    ],
    toolMappings: [
      { method: "POST", path: "tickets/draft", purpose: "Create a non-persistent ticket draft payload when a written handoff is useful." },
    ],
    responsePattern: "Explain that v1 is read-only and, when helpful, return a draft-only summary that a human can review.",
    phaseBoundary: "read-only-v1",
    fallbackRule: "Never execute CRM writes, imports, reconciliation apply/unapply, or schedule/account/product mutations.",
  },
  {
    intent: "insight.accounts_with_issues",
    availability: "not_yet_supported",
    handlingMode: "unsupported",
    summary: "Cross-entity issue rollups are not yet a direct read-only v1 capability.",
    exampleUtterances: [
      "Which accounts have the most issues?",
      "Show me accounts with open problems.",
    ],
    normalizedParams: [],
    toolMappings: [],
    responsePattern: "Explain that there is not yet a reviewed direct issue-rollup capability in v1.",
    phaseBoundary: "read-only-v1",
    fallbackRule: "Use account context, reconciliation summary, or deposit lookup only when the user narrows the business question to a supported read-only path.",
  },
  {
    intent: "insight.variance_summary",
    availability: "not_yet_supported",
    handlingMode: "unsupported",
    summary: "Variance-heavy account ranking is not yet exposed as a direct purpose-built v1 insight tool.",
    exampleUtterances: [
      "Which accounts have the biggest variances?",
      "Show me the largest schedule variances this month.",
    ],
    normalizedParams: [],
    toolMappings: [],
    responsePattern: "Explain that a direct variance-summary insight is not yet available in reviewed v1.",
    phaseBoundary: "read-only-v1",
    fallbackRule: "Do not guess at internal routes. Ask the user to narrow to a supported schedule or reconciliation lookup instead.",
  },
]

function toFiniteNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof value === "object" && value && "toNumber" in value) {
    try {
      const parsed = (value as { toNumber: () => number }).toNumber()
      return Number.isFinite(parsed) ? parsed : 0
    } catch {
      return 0
    }
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function buildUtcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0))
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseDateOnlyInput(raw: string): Date | null {
  if (!DATE_ONLY_PATTERN.test(raw)) {
    return null
  }

  const [yearText, monthText, dayText] = raw.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const parsed = buildUtcDate(year, month - 1, day)
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return parsed
}

function parseMonthInput(raw: string): ResolvedCalendarRange | null {
  if (!MONTH_PATTERN.test(raw)) {
    return null
  }

  const [yearText, monthText] = raw.split("-")
  const year = Number(yearText)
  const month = Number(monthText)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  const from = buildUtcDate(year, month - 1, 1)
  const toExclusive = buildUtcDate(year, month, 1)
  const toInclusive = addUtcDays(toExclusive, -1)

  return {
    mode: "calendar_month",
    month: raw,
    from,
    toInclusive,
    toExclusive,
    fromDate: formatDateOnly(from),
    toDate: formatDateOnly(toInclusive),
  }
}

function normalizeMessage(message: string) {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function includesTerm(normalizedMessage: string, term: string) {
  return normalizedMessage.includes(normalizeMessage(term))
}

function resolveConfidence(score: number): "high" | "medium" | "low" {
  if (score >= 12) return "high"
  if (score >= 7) return "medium"
  return "low"
}

function resolveSuggestedMonth(normalizedMessage: string, defaultNow: Date): string | null {
  const monthNameMatch = normalizedMessage.match(MONTH_NAME_PATTERN)
  if (monthNameMatch) {
    const monthToken = monthNameMatch[1]?.toLowerCase() ?? ""
    const yearToken = monthNameMatch[2] ?? ""
    const monthNumber = MONTH_NAME_TO_NUMBER[monthToken]
    if (monthNumber && yearToken) {
      return `${yearToken}-${monthNumber}`
    }
  }

  const rawMonthMatch = normalizedMessage.match(/\b(20\d{2}-\d{2})\b/)
  if (rawMonthMatch?.[1] && MONTH_PATTERN.test(rawMonthMatch[1])) {
    return rawMonthMatch[1]
  }

  if (includesTerm(normalizedMessage, "this month") || includesTerm(normalizedMessage, "current month")) {
    return `${defaultNow.getUTCFullYear()}-${String(defaultNow.getUTCMonth() + 1).padStart(2, "0")}`
  }

  return null
}

function resolveSuggestedLimit(normalizedMessage: string): number | null {
  const match = normalizedMessage.match(/\btop\s+(\d{1,2})\b/)
  if (!match?.[1]) {
    return null
  }

  const value = Number.parseInt(match[1], 10)
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.min(value, 25)
}

function resolveImportEntity(normalizedMessage: string): string | null {
  for (const candidate of IMPORT_ENTITY_TERMS) {
    if (candidate.terms.some((term) => includesTerm(normalizedMessage, term))) {
      return candidate.entity
    }
  }
  return null
}

function resolveImportStatus(normalizedMessage: string): string | null {
  if (
    includesTerm(normalizedMessage, "failed")
    || includesTerm(normalizedMessage, "failure")
    || includesTerm(normalizedMessage, "blocker")
    || includesTerm(normalizedMessage, "blockers")
    || includesTerm(normalizedMessage, "error")
    || includesTerm(normalizedMessage, "errors")
  ) {
    return "Failed"
  }

  if (includesTerm(normalizedMessage, "completed") || includesTerm(normalizedMessage, "finished")) {
    return "Completed"
  }

  if (includesTerm(normalizedMessage, "processing") || includesTerm(normalizedMessage, "running")) {
    return "Processing"
  }

  if (includesTerm(normalizedMessage, "pending")) {
    return "Pending"
  }

  return null
}

function resolveSuggestedParams(intent: string, normalizedMessage: string, defaultNow: Date) {
  const suggestedParams: Record<string, OpenClawSuggestedParamValue> = {}

  if (intent === "insight.top_usage_accounts") {
    const month = resolveSuggestedMonth(normalizedMessage, defaultNow)
    const limit = resolveSuggestedLimit(normalizedMessage)
    if (month) suggestedParams.month = month
    if (limit) suggestedParams.limit = limit
  }

  if (intent === "workflow.import_status") {
    const entity = resolveImportEntity(normalizedMessage)
    const status = resolveImportStatus(normalizedMessage)
    if (entity) suggestedParams.entity = entity
    if (status) suggestedParams.status = status
  }

  if (intent === "action.preview_write_request") {
    if (includesTerm(normalizedMessage, "ticket")) {
      suggestedParams.issue = "Ticket-worthy CRM issue requested by user"
    }
  }

  return suggestedParams
}

function collectMatchedTerms(normalizedMessage: string, rules: IntentMatchRule[]) {
  const matched = new Set<string>()

  for (const rule of rules) {
    for (const term of rule.allOf ?? []) {
      if (includesTerm(normalizedMessage, term)) matched.add(term)
    }
    for (const term of rule.anyOf ?? []) {
      if (includesTerm(normalizedMessage, term)) matched.add(term)
    }
  }

  return Array.from(matched)
}

function scoreIntent(normalizedMessage: string, intent: string) {
  const rules = INTENT_MATCH_RULES[intent] ?? []
  let score = 0

  for (const rule of rules) {
    const allOfMatched = (rule.allOf ?? []).every((term) => includesTerm(normalizedMessage, term))
    const anyOfMatched = rule.anyOf ? rule.anyOf.some((term) => includesTerm(normalizedMessage, term)) : true
    const noneOfMatched = (rule.noneOf ?? []).every((term) => !includesTerm(normalizedMessage, term))

    if (allOfMatched && anyOfMatched && noneOfMatched) {
      score += rule.score
    }
  }

  return {
    score,
    matchedTerms: collectMatchedTerms(normalizedMessage, rules),
  }
}

export function buildOpenClawRuntimeContract(basePath = "/api/bot/v1/tools"): OpenClawRuntimeContract {
  const supportedIntentCount = OPENCLAW_V1_INTENT_CAPABILITIES.filter((capability) => capability.availability === "supported").length
  const previewIntentCount = OPENCLAW_V1_INTENT_CAPABILITIES.filter((capability) => capability.availability === "preview_only").length
  const unsupportedIntentCount = OPENCLAW_V1_INTENT_CAPABILITIES.filter((capability) => capability.availability === "not_yet_supported").length

  return {
    version: OPENCLAW_V1_CAPABILITY_REGISTRY_VERSION,
    routingMode: "business_intent_first",
    routeDiscoveryAllowed: false,
    capabilityRegistryPath: `${basePath}/capabilities`,
    capabilityResolverPath: `${basePath}/capabilities/resolve`,
    executionModel: [
      "Interpret the user message as a business intent.",
      "Normalize dates, limits, filters, and entity hints from the user message.",
      "Resolve the request through the server-owned capability registry before any tool call.",
      "Use only the reviewed read-only tools mapped to the chosen intent.",
      "Return a direct business answer for supported intents.",
      "Switch to preview/guidance mode for write requests.",
      "Fail clearly for unsupported intents instead of asking for endpoints or route names.",
    ],
    supportedIntentCount,
    previewIntentCount,
    unsupportedIntentCount,
  }
}

export function buildOpenClawReadOnlySystemPrompt(basePath = "/api/bot/v1/tools") {
  const runtimeContract = buildOpenClawRuntimeContract(basePath)
  const supportedLines = OPENCLAW_V1_INTENT_CAPABILITIES
    .filter((capability) => capability.availability === "supported")
    .map((capability) => `- ${capability.intent}: ${capability.summary}`)
  const previewLines = OPENCLAW_V1_INTENT_CAPABILITIES
    .filter((capability) => capability.availability === "preview_only")
    .map((capability) => `- ${capability.intent}: ${capability.summary}`)

  return [
    "You are embedded in the Commissable CRM.",
    "Keep OpenClaw v1 read-only.",
    "Do not ask for or reveal secrets, credentials, raw exports, or production-only data.",
    `Use ${runtimeContract.capabilityRegistryPath} as the source of truth for supported business intents.`,
    `Use ${runtimeContract.capabilityResolverPath} to map supported user questions to business intents before tool calls when the intent is not already obvious.`,
    "Do not ask users for route names, endpoint details, HTTP methods, or API discovery help when their business question is covered by the registry.",
    "If the user asks for a write action, stay in preview/guidance mode and do not mutate CRM data.",
    "If the request is unsupported, fail clearly and truthfully instead of guessing at internal tools.",
    "Supported business intents:",
    ...supportedLines,
    "Preview-only intent handling:",
    ...previewLines,
    "Keep answers concise and operational.",
  ].join("\n")
}

export function resolveIntentFromMessage(args: {
  message: string
  defaultNow?: Date
}): OpenClawIntentResolution {
  const defaultNow = args.defaultNow ?? new Date()
  const message = args.message.trim()
  const normalizedMessage = normalizeMessage(message)

  const matches = OPENCLAW_V1_INTENT_CAPABILITIES
    .map((capability) => {
      const { score, matchedTerms } = scoreIntent(normalizedMessage, capability.intent)
      if (score <= 0) {
        return null
      }

      return {
        intent: capability.intent,
        availability: capability.availability,
        handlingMode: capability.handlingMode,
        confidence: resolveConfidence(score),
        summary: capability.summary,
        matchedTerms,
        suggestedParams: resolveSuggestedParams(capability.intent, normalizedMessage, defaultNow),
        toolMappings: capability.toolMappings,
        responsePattern: capability.responsePattern,
        fallbackRule: capability.fallbackRule,
        score,
      }
    })
    .filter((match): match is OpenClawIntentResolutionMatch & { score: number } => match !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      const availabilityPriority: Record<OpenClawCapabilityAvailability, number> = {
        supported: 3,
        preview_only: 2,
        not_yet_supported: 1,
      }

      if (availabilityPriority[right.availability] !== availabilityPriority[left.availability]) {
        return availabilityPriority[right.availability] - availabilityPriority[left.availability]
      }

      return left.intent.localeCompare(right.intent)
    })
    .map(({ score: _score, ...match }) => match)

  return {
    message,
    normalizedMessage,
    routeDiscoveryAllowed: false,
    primaryMatch: matches[0] ?? null,
    matches,
  }
}

export function resolveCalendarDateRange(args: {
  searchParams: URLSearchParams
  defaultNow?: Date
  monthKeys?: string[]
  fromKeys?: string[]
  toKeys?: string[]
}): CalendarRangeResult {
  const monthKeys = args.monthKeys ?? ["month", "period"]
  const fromKeys = args.fromKeys ?? ["from", "dateFrom"]
  const toKeys = args.toKeys ?? ["to", "dateTo"]
  const defaultNow = args.defaultNow ?? new Date()

  const pick = (keys: string[]) => {
    for (const key of keys) {
      const value = args.searchParams.get(key)?.trim()
      if (value) return value
    }
    return ""
  }

  const rawMonth = pick(monthKeys)
  const rawFrom = pick(fromKeys)
  const rawTo = pick(toKeys)

  if (rawMonth && (rawFrom || rawTo)) {
    return {
      ok: false,
      error: "Use either month=YYYY-MM or from/to=YYYY-MM-DD, not both.",
    }
  }

  if (rawMonth) {
    const parsedMonth = parseMonthInput(rawMonth)
    if (!parsedMonth) {
      return { ok: false, error: "month must use YYYY-MM format." }
    }
    return { ok: true, value: parsedMonth }
  }

  if (rawFrom || rawTo) {
    if (!rawFrom || !rawTo) {
      return {
        ok: false,
        error: "from and to must both be provided together in YYYY-MM-DD format.",
      }
    }

    const from = parseDateOnlyInput(rawFrom)
    const toInclusive = parseDateOnlyInput(rawTo)
    if (!from) {
      return { ok: false, error: "from must use YYYY-MM-DD format." }
    }
    if (!toInclusive) {
      return { ok: false, error: "to must use YYYY-MM-DD format." }
    }
    if (from.getTime() > toInclusive.getTime()) {
      return { ok: false, error: "from must be on or before to." }
    }

    return {
      ok: true,
      value: {
        mode: "explicit_date_range",
        month: null,
        from,
        toInclusive,
        toExclusive: addUtcDays(toInclusive, 1),
        fromDate: formatDateOnly(from),
        toDate: formatDateOnly(toInclusive),
      },
    }
  }

  const currentYear = defaultNow.getUTCFullYear()
  const currentMonth = defaultNow.getUTCMonth()
  const from = buildUtcDate(currentYear, currentMonth, 1)
  const toExclusive = buildUtcDate(currentYear, currentMonth + 1, 1)
  const toInclusive = addUtcDays(toExclusive, -1)

  return {
    ok: true,
    value: {
      mode: "default_current_month",
      month: null,
      from,
      toInclusive,
      toExclusive,
      fromDate: formatDateOnly(from),
      toDate: formatDateOnly(toInclusive),
    },
  }
}

export function rankTopUsageAccounts(rows: TopUsageAccountAggregate[]): RankedTopUsageAccount[] {
  return rows
    .map((row) => {
      const expectedUsage = toFiniteNumber(row.expectedUsage)
      const usageAdjustment = toFiniteNumber(row.usageAdjustment)
      const actualUsage = toFiniteNumber(row.actualUsage)
      const actualUsageAdjustment = toFiniteNumber(row.actualUsageAdjustment)
      const expectedUsageNet = round(expectedUsage + usageAdjustment)
      const actualUsageNet = round(actualUsage + actualUsageAdjustment)
      const hasActualUsageData = row.actualUsage !== null || row.actualUsageAdjustment !== null
      const rankingBasis: RankedTopUsageAccount["rankingBasis"] = hasActualUsageData
        ? "actual_usage_net"
        : "expected_usage_net"
      const rankingUsageNet = hasActualUsageData ? actualUsageNet : expectedUsageNet

      return {
        rank: 0,
        account: row.account ?? {
          id: row.accountId,
          accountName: "Unknown account",
          accountLegalName: null,
          accountNumber: null,
        },
        scheduleCount: row.scheduleCount,
        expectedUsage: round(expectedUsage),
        usageAdjustment: round(usageAdjustment),
        expectedUsageNet,
        actualUsage: round(actualUsage),
        actualUsageAdjustment: round(actualUsageAdjustment),
        actualUsageNet,
        expectedCommission: round(toFiniteNumber(row.expectedCommission)),
        actualCommission: round(toFiniteNumber(row.actualCommission)),
        rankingUsageNet: round(rankingUsageNet),
        rankingBasis,
      }
    })
    .sort((left, right) => {
      if (right.rankingUsageNet !== left.rankingUsageNet) {
        return right.rankingUsageNet - left.rankingUsageNet
      }
      if (right.actualUsageNet !== left.actualUsageNet) {
        return right.actualUsageNet - left.actualUsageNet
      }
      if (right.expectedUsageNet !== left.expectedUsageNet) {
        return right.expectedUsageNet - left.expectedUsageNet
      }
      if (right.scheduleCount !== left.scheduleCount) {
        return right.scheduleCount - left.scheduleCount
      }
      return left.account.accountName.localeCompare(right.account.accountName)
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }))
}
