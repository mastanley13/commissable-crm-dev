import { NextRequest, NextResponse } from "next/server"
import { LeadSource, OpportunityStage, OpportunityStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { ensureActiveOwnerOrNull } from "@/lib/validation"
import { hasAnyPermission } from "@/lib/auth"
import { mapOpportunityToRow } from "./helpers"
import { dedupeColumnFilters } from "@/lib/filter-utils"
import type { ColumnFilter } from "@/components/list-header"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OPPORTUNITY_VIEW_ANY_PERMISSIONS = [
  "opportunities.view.all",
  "opportunities.edit.all",
  "opportunities.manage",
  "accounts.manage",
  "accounts.read",
  "opportunities.read"
]

const OPPORTUNITY_VIEW_ASSIGNED_PERMISSIONS = [
  "opportunities.view.assigned",
  "opportunities.edit.assigned"
]

const OPPORTUNITY_VIEW_PERMISSIONS = Array.from(new Set([
  ...OPPORTUNITY_VIEW_ANY_PERMISSIONS,
  ...OPPORTUNITY_VIEW_ASSIGNED_PERMISSIONS
]))

const ACTIVE_STATUS_FILTER: OpportunityStatus[] = [OpportunityStatus.Open, OpportunityStatus.OnHold]
const INACTIVE_STATUS_FILTER: OpportunityStatus[] = [OpportunityStatus.Lost, OpportunityStatus.Won]

function resolveSortOrder(sortColumn: string, direction: "asc" | "desc"): Prisma.OpportunityOrderByWithRelationInput[] {
  if (sortColumn === "closeDate") {
    return [
      { actualCloseDate: direction },
      { estimatedCloseDate: direction },
      { createdAt: direction }
    ]
  }

  const orderByMap: Record<string, Prisma.OpportunityOrderByWithRelationInput> = {
    opportunityName: { name: direction },
    estimatedCloseDate: { estimatedCloseDate: direction },
    stage: { stage: direction },
    owner: { owner: { fullName: direction } },
    status: { status: direction },
    accountLegalName: { account: { accountLegalName: direction } },
    createdAt: { createdAt: direction }
  }

  const resolved = orderByMap[sortColumn] ?? null
  const fallbacks: Prisma.OpportunityOrderByWithRelationInput[] = []

  if (resolved) {
    fallbacks.push(resolved)
  }

  if (!resolved || !("estimatedCloseDate" in resolved)) {
    fallbacks.push({ estimatedCloseDate: direction })
  }

  if (!resolved || !("createdAt" in resolved)) {
    fallbacks.push({ createdAt: direction })
  }

  return fallbacks
}

function isValidStage(value: string): value is OpportunityStage {
  return Object.values(OpportunityStage).includes(value as OpportunityStage)
}

function isValidLeadSource(value: string): value is LeadSource {
  return Object.values(LeadSource).includes(value as LeadSource)
}

export async function GET(request: NextRequest) {
  return withPermissions(request, OPPORTUNITY_VIEW_PERMISSIONS, async (req) => {
    try {
      const searchParams = request.nextUrl.searchParams
      const tenantId = req.user.tenantId

      const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
      const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")))
      const query = searchParams.get("q")?.trim() ?? ""
      const statusParam = (searchParams.get("status") ?? "active").toLowerCase()
      const sortColumn = searchParams.get("sort") ?? "closeDate"
      const sortDirection: "asc" | "desc" = searchParams.get("direction") === "asc" ? "asc" : "desc"

      let columnFilters: ColumnFilter[] = []
      const filtersParam = searchParams.get("filters")
      if (filtersParam) {
        try {
          const parsed = JSON.parse(filtersParam)
          if (Array.isArray(parsed)) {
            columnFilters = parsed
          }
        } catch {
          columnFilters = []
        }
      }

      const dedupedFilters = dedupeColumnFilters(columnFilters)

      const canViewAny = hasAnyPermission(req.user, OPPORTUNITY_VIEW_ANY_PERMISSIONS)
      const canViewAssigned = hasAnyPermission(req.user, OPPORTUNITY_VIEW_ASSIGNED_PERMISSIONS)

      if (!canViewAny && !canViewAssigned) {
        return NextResponse.json({ error: "Insufficient permissions to view opportunities" }, { status: 403 })
      }

      const where: Prisma.OpportunityWhereInput = {
        tenantId
      }

      if (!canViewAny) {
        where.ownerId = req.user.id
      }

      const andConditions: Prisma.OpportunityWhereInput[] = []

      if (statusParam === "inactive") {
        andConditions.push({ status: { in: INACTIVE_STATUS_FILTER } })
      } else if (statusParam === "all") {
        // No additional status filter
      } else {
        andConditions.push({ status: { in: ACTIVE_STATUS_FILTER } })
      }

      if (query.length > 0) {
        andConditions.push({
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { account: { accountName: { contains: query, mode: "insensitive" } } },
            { owner: { fullName: { contains: query, mode: "insensitive" } } }
          ]
        })
      }

      if (dedupedFilters.length > 0) {
        const filterConditions: Prisma.OpportunityWhereInput[] = []

        dedupedFilters.forEach((filter) => {
          const rawValue = (filter.value ?? "").trim()
          if (!rawValue) {
            return
          }

          const valueLower = rawValue.toLowerCase()

          switch (filter.columnId) {
            case "opportunityName":
              filterConditions.push({ name: { contains: rawValue, mode: "insensitive" } })
              break
            case "stage": {
              const matches = (Object.values(OpportunityStage) as string[]).filter(stage =>
                stage.toLowerCase().includes(valueLower)
              )
              if (matches.length > 0) {
                filterConditions.push({ stage: { in: matches as OpportunityStage[] } })
              }
              break
            }
            case "owner":
              filterConditions.push({
                OR: [
                  { owner: { fullName: { contains: rawValue, mode: "insensitive" } } },
                  { owner: { firstName: { contains: rawValue, mode: "insensitive" } } },
                  { owner: { lastName: { contains: rawValue, mode: "insensitive" } } }
                ]
              })
              break
            case "referredBy": {
              const matches = (Object.values(LeadSource) as string[]).filter(source =>
                source.toLowerCase().includes(valueLower)
              )
              if (matches.length > 0) {
                filterConditions.push({ leadSource: { in: matches as LeadSource[] } })
              }
              break
            }
            case "status": {
              const matches = (Object.values(OpportunityStatus) as string[]).filter(status =>
                status.toLowerCase().includes(valueLower)
              )
              if (matches.length > 0) {
                filterConditions.push({ status: { in: matches as OpportunityStatus[] } })
              }
              break
            }
            default:
              break
          }
        })

        if (filterConditions.length > 0) {
          andConditions.push(...filterConditions)
        }
      }

      if (andConditions.length > 0) {
        if (where.AND) {
          const existing = Array.isArray(where.AND) ? where.AND : [where.AND]
          where.AND = [...existing, ...andConditions]
        } else {
          where.AND = andConditions
        }
      }

      const orderBy = resolveSortOrder(sortColumn, sortDirection)

      const [opportunities, total] = await Promise.all([
        prisma.opportunity.findMany({
          where,
          include: {
            owner: { select: { firstName: true, lastName: true, fullName: true } },
            account: { select: { accountName: true, accountLegalName: true } },
            products: {
              select: {
                expectedUsage: true,
                expectedCommission: true,
                product: {
                  select: {
                    distributor: { select: { accountName: true } },
                    vendor: { select: { accountName: true } }
                  }
                }
              }
            }
          },
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.opportunity.count({ where })
      ])

      const totalPages = Math.max(1, Math.ceil(total / pageSize))

      return NextResponse.json({
        data: opportunities.map(mapOpportunityToRow),
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        }
      })
    } catch (error) {
      console.error("Failed to load opportunities", error)
      return NextResponse.json({ error: "Failed to load opportunities" }, { status: 500 })
    }
  })
}

export async function POST(request: NextRequest) {
  return withPermissions(request, ["opportunities.create", "opportunities.manage", "accounts.manage", "accounts.create", "contacts.manage"], async (req) => {
    try {
      const payload = await request.json().catch(() => null)

      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const accountId = typeof payload.accountId === "string" ? payload.accountId : ""
      const name = typeof payload.name === "string" ? payload.name.trim() : ""
      const stageValue = typeof payload.stage === "string" ? payload.stage : ""
      const leadSourceValue = typeof payload.leadSource === "string" ? payload.leadSource : ""
      const ownerId = typeof payload.ownerId === "string" ? payload.ownerId : ""
      const estimatedCloseDate = typeof payload.estimatedCloseDate === "string" ? payload.estimatedCloseDate : ""
      const subAgent = typeof payload.subAgent === "string" ? payload.subAgent.trim() : ""

      if (!accountId || !name || !ownerId || !stageValue || !leadSourceValue || !estimatedCloseDate) {
        return NextResponse.json({ error: "Account, name, owner, stage, lead source, and estimated close date are required" }, { status: 400 })
      }

      if (!isValidStage(stageValue)) {
        return NextResponse.json({ error: "Invalid opportunity stage" }, { status: 400 })
      }

      if (!isValidLeadSource(leadSourceValue)) {
        return NextResponse.json({ error: "Invalid lead source" }, { status: 400 })
      }

      const closeDate = new Date(estimatedCloseDate)
      if (Number.isNaN(closeDate.getTime())) {
        return NextResponse.json({ error: "Estimated close date must be a valid date" }, { status: 400 })
      }

      // Validate owner must be Active
      const validatedOwnerId = await ensureActiveOwnerOrNull(ownerId, req.user.tenantId)

      const opportunity = await prisma.opportunity.create({
        data: {
          tenantId: req.user.tenantId,
          accountId,
          name,
          stage: stageValue,
          leadSource: leadSourceValue,
          estimatedCloseDate: closeDate,
          ownerId: validatedOwnerId,
          description: subAgent ? `Subagent: ${subAgent}` : null,
          createdById: req.user.id,
          updatedById: req.user.id
        }
      })

      return NextResponse.json({ data: opportunity })
    } catch (error) {
      console.error("Failed to create opportunity", error)
      return NextResponse.json({ error: "Failed to create opportunity" }, { status: 500 })
    }
  })
}


