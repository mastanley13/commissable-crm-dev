import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type SplitPoints = {
  house: number | null
  houseRep: number | null
  subagent: number | null
}

type Classification =
  | "aligned"
  | "safe_sync"
  | "ambiguous"
  | "partial_override"
  | "invalid_total"
  | "missing_base"
  | "no_active_schedules"

function parseArgs() {
  const args = process.argv.slice(2)
  const out: { tenant?: string; verbose?: boolean } = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if ((arg === "--tenant" || arg === "-t") && index + 1 < args.length) {
      out.tenant = args[index + 1]
      index += 1
      continue
    }
    if (arg === "--verbose" || arg === "-v") {
      out.verbose = true
    }
  }
  return out
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const numeric = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeSplitPoints(split: SplitPoints): SplitPoints {
  const finite = [split.house, split.houseRep, split.subagent].filter((value) => value !== null && Number.isFinite(value)) as number[]
  const sum = finite.reduce((acc, value) => acc + value, 0)
  const maxAbs = finite.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0)
  const looksLikeFractions = finite.length > 0 && maxAbs <= 1.5 && sum <= 1.5
  const factor = looksLikeFractions ? 100 : 1

  return {
    house: split.house === null ? null : Number((split.house * factor).toFixed(2)),
    houseRep: split.houseRep === null ? null : Number((split.houseRep * factor).toFixed(2)),
    subagent: split.subagent === null ? null : Number((split.subagent * factor).toFixed(2))
  }
}

function splitKey(split: SplitPoints): string {
  return [
    split.house === null ? "null" : split.house.toFixed(2),
    split.houseRep === null ? "null" : split.houseRep.toFixed(2),
    split.subagent === null ? "null" : split.subagent.toFixed(2)
  ].join("|")
}

function splitLabel(split: SplitPoints): string {
  const format = (value: number | null) => (value === null ? "--" : `${value.toFixed(2)}%`)
  return `house=${format(split.house)}, houseRep=${format(split.houseRep)}, subagent=${format(split.subagent)}`
}

function splitTotal(split: SplitPoints): number | null {
  const finite = [split.house, split.houseRep, split.subagent].filter((value) => value !== null && Number.isFinite(value)) as number[]
  if (finite.length === 0) return null
  return Number(finite.reduce((acc, value) => acc + value, 0).toFixed(2))
}

function isBlankBase(split: SplitPoints): boolean {
  return [split.house, split.houseRep, split.subagent].every((value) => value === null || value === 0)
}

async function main() {
  const { tenant, verbose } = parseArgs()

  const opportunities = await prisma.opportunity.findMany({
    where: {
      ...(tenant ? { tenantId: tenant } : {})
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
      houseSplitPercent: true,
      houseRepPercent: true,
      subagentPercent: true,
      revenueSchedules: {
        select: {
          id: true,
          deletedAt: true,
          houseSplitPercentOverride: true,
          houseRepSplitPercentOverride: true,
          subagentSplitPercentOverride: true
        }
      }
    },
    orderBy: [{ tenantId: "asc" }, { name: "asc" }]
  })

  const summary = new Map<Classification, number>()
  const rows: Array<{
    tenantId: string
    opportunityId: string
    opportunityName: string
    classification: Classification
    baseSplits: string
    activeScheduleCount: number
    distinctEffectiveScheduleSplits: string
  }> = []

  for (const opportunity of opportunities) {
    const base = normalizeSplitPoints({
      house: toNumber(opportunity.houseSplitPercent),
      houseRep: toNumber(opportunity.houseRepPercent),
      subagent: toNumber(opportunity.subagentPercent)
    })

    const activeSchedules = opportunity.revenueSchedules.filter((schedule) => schedule.deletedAt === null)
    let classification: Classification = "aligned"
    const distinctEffective = new Set<string>()
    let sawPartialOverride = false
    let sawInvalidTotal = false

    for (const schedule of activeSchedules) {
      const overridePresence = [
        schedule.houseSplitPercentOverride,
        schedule.houseRepSplitPercentOverride,
        schedule.subagentSplitPercentOverride
      ].filter((value) => value !== null && value !== undefined).length

      if (overridePresence > 0 && overridePresence < 3) {
        sawPartialOverride = true
      }

      const effective = normalizeSplitPoints({
        house: toNumber(schedule.houseSplitPercentOverride ?? opportunity.houseSplitPercent),
        houseRep: toNumber(schedule.houseRepSplitPercentOverride ?? opportunity.houseRepPercent),
        subagent: toNumber(schedule.subagentSplitPercentOverride ?? opportunity.subagentPercent)
      })

      const total = splitTotal(effective)
      if (total !== null && Math.abs(total - 100) > 0.01) {
        sawInvalidTotal = true
      }

      distinctEffective.add(splitKey(effective))
    }

    if (activeSchedules.length === 0) {
      classification = "no_active_schedules"
    } else if (sawInvalidTotal) {
      classification = "invalid_total"
    } else if (distinctEffective.size > 1) {
      classification = "ambiguous"
    } else if (sawPartialOverride) {
      classification = "partial_override"
    } else if (distinctEffective.size === 1) {
      const [onlyEffective] = Array.from(distinctEffective)
      classification = onlyEffective === splitKey(base)
        ? "aligned"
        : isBlankBase(base)
          ? "missing_base"
          : "safe_sync"
    }

    summary.set(classification, (summary.get(classification) ?? 0) + 1)

    if (verbose || classification !== "aligned") {
      rows.push({
        tenantId: opportunity.tenantId,
        opportunityId: opportunity.id,
        opportunityName: opportunity.name,
        classification,
        baseSplits: splitLabel(base),
        activeScheduleCount: activeSchedules.length,
        distinctEffectiveScheduleSplits: Array.from(distinctEffective)
          .map((key) => {
            const [house, houseRep, subagent] = key.split("|")
            return splitLabel({
              house: house === "null" ? null : Number(house),
              houseRep: houseRep === "null" ? null : Number(houseRep),
              subagent: subagent === "null" ? null : Number(subagent)
            })
          })
          .join(" || ")
      })
    }
  }

  console.log("Opportunity / Revenue Schedule split divergence audit")
  if (tenant) {
    console.log(`Tenant filter: ${tenant}`)
  }
  console.log(`Total opportunities scanned: ${opportunities.length}`)

  const ordered: Classification[] = [
    "aligned",
    "safe_sync",
    "ambiguous",
    "partial_override",
    "invalid_total",
    "missing_base",
    "no_active_schedules"
  ]

  for (const key of ordered) {
    console.log(`${key}: ${summary.get(key) ?? 0}`)
  }

  if (rows.length > 0) {
    console.log("\nDetailed rows:")
    for (const row of rows) {
      console.log(
        [
          row.tenantId,
          row.opportunityId,
          JSON.stringify(row.opportunityName),
          row.classification,
          JSON.stringify(row.baseSplits),
          row.activeScheduleCount,
          JSON.stringify(row.distinctEffectiveScheduleSplits)
        ].join(",")
      )
    }
  }
}

main()
  .catch((error) => {
    console.error("Failed to audit split divergence:", error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
