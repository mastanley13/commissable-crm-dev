import { NextRequest, NextResponse } from "next/server"
import { LeadSource, OpportunityStage, OpportunityStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { mapOpportunityToDetail, mapOpportunityToRow } from "../helpers"
import { revalidateOpportunityPaths } from "../revalidate"
import { ensureActiveOwnerOrNull } from "@/lib/validation"

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

const OPPORTUNITY_EDIT_ANY_PERMISSIONS = [
  "opportunities.edit.all",
  "opportunities.manage",
  "accounts.manage",
  "accounts.update"
]

const OPPORTUNITY_EDIT_ASSIGNED_PERMISSIONS = ["opportunities.edit.assigned"]

const OPPORTUNITY_EDIT_PERMISSIONS = Array.from(new Set([
  ...OPPORTUNITY_EDIT_ANY_PERMISSIONS,
  ...OPPORTUNITY_EDIT_ASSIGNED_PERMISSIONS
]))

const OPPORTUNITY_DELETE_PERMISSIONS = [
  "opportunities.delete",
  "opportunities.edit.all",
  "opportunities.manage"
]

function isValidStage(value: unknown): value is OpportunityStage {
  return typeof value === "string" && (Object.values(OpportunityStage) as string[]).includes(value)
}

function isValidStatus(value: unknown): value is OpportunityStatus {
  return typeof value === "string" && (Object.values(OpportunityStatus) as string[]).includes(value)
}

function isValidLeadSource(value: unknown): value is LeadSource {
  return typeof value === "string" && (Object.values(LeadSource) as string[]).includes(value)
}

function extractSubAgent(description: string | null | undefined) {
  if (!description) {
    return ""
  }

  const match = description.match(/^Subagent:\s*(.*)$/i)
  return match?.[1]?.trim() ?? ""
}

function formatSubAgentDescription(value: string | null | undefined) {
  const finalValue = value?.trim()
  if (!finalValue) {
    return null
  }

  return `Subagent: ${finalValue}`
}

export async function GET(request: NextRequest, { params }: { params: { opportunityId: string } }) {
  return withPermissions(request, OPPORTUNITY_VIEW_PERMISSIONS, async (req) => {
    try {
      const { opportunityId } = params
      if (!opportunityId) {
        return NextResponse.json({ error: "Opportunity id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const canViewAny = hasAnyPermission(req.user, OPPORTUNITY_VIEW_ANY_PERMISSIONS)
      const canViewAssigned = hasAnyPermission(req.user, OPPORTUNITY_VIEW_ASSIGNED_PERMISSIONS)

      if (!canViewAny && !canViewAssigned) {
        return NextResponse.json({ error: "Insufficient permissions to view opportunities" }, { status: 403 })
      }

      let opportunity = await prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, fullName: true } },
          account: { select: { id: true, accountName: true, accountLegalName: true } },
          createdBy: { select: { id: true, fullName: true } },
          updatedBy: { select: { id: true, fullName: true } },
          products: {
            include: {
              product: {
                select: {
                  id: true,
                  productNameHouse: true,
                  productNameVendor: true,
                  productCode: true,
                  revenueType: true,
                  priceEach: true,
                  distributor: { select: { id: true, accountName: true } },
                  vendor: { select: { id: true, accountName: true } }
                }
              }
            },
            orderBy: { createdAt: "asc" }
          },
          revenueSchedules: {
            include: {
              product: {
                select: {
                  productNameVendor: true,
                  commissionPercent: true,
                  priceEach: true
                }
              },
              distributor: { select: { accountName: true } },
              vendor: { select: { accountName: true } },
              opportunityProduct: {
                select: {
                  quantity: true,
                  unitPrice: true
                }
              }
            },
            orderBy: { scheduleDate: "asc" }
          }
        }
      })

      if (!opportunity) {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
      }

      if (!canViewAny) {
        if (!canViewAssigned || opportunity.ownerId !== req.user.id) {
          return NextResponse.json({ error: "Insufficient permissions to view this opportunity" }, { status: 403 })
        }
      }

      // Raw-select extended fields that may not exist in an outdated Prisma client
      try {
        const extra: Array<{
          referredBy: string | null
          shippingAddress: string | null
          billingAddress: string | null
          subagentPercent: unknown
          houseRepPercent: unknown
          houseSplitPercent: unknown
        }> = await prisma.$queryRawUnsafe(
          `SELECT "referredBy", "shippingAddress", "billingAddress", "subagentPercent", "houseRepPercent", "houseSplitPercent"
           FROM "Opportunity"
           WHERE "id" = $1::uuid AND "tenantId" = $2::uuid
           LIMIT 1`,
          opportunityId,
          tenantId
        )
        if (extra && extra[0]) {
          opportunity = Object.assign({}, opportunity, extra[0]) as typeof opportunity
        }
      } catch (e) {
        // Non-fatal: continue without extended fields
      }

      const baseRow = mapOpportunityToRow(opportunity)
      const detail = mapOpportunityToDetail(opportunity)
      const subAgent = extractSubAgent(opportunity.description)

      return NextResponse.json({
        data: {
          ...baseRow,
          name: opportunity.name ?? "",
          stage: opportunity.stage ?? OpportunityStage.Qualification,
          status: opportunity.status ?? OpportunityStatus.Open,
          leadSource: opportunity.leadSource ?? null,
          ownerId: opportunity.ownerId ?? null,
          estimatedCloseDate: opportunity.estimatedCloseDate,
          subAgent,
          detail
        }
      })
    } catch (error) {
      console.error("Failed to load opportunity", error)
      return NextResponse.json({ error: "Failed to load opportunity" }, { status: 500 })
    }
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { opportunityId: string } }) {
  return withPermissions(request, OPPORTUNITY_EDIT_PERMISSIONS, async (req) => {
    try {
      const { opportunityId } = params
      if (!opportunityId) {
        return NextResponse.json({ error: "Opportunity id is required" }, { status: 400 })
      }

      const payload = await request.json().catch(() => null)
      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const existing = await prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
        select: { id: true, accountId: true, ownerId: true }
      })

      if (!existing) {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
      }

      const canEditAny = hasAnyPermission(req.user, OPPORTUNITY_EDIT_ANY_PERMISSIONS)
      const canEditAssigned = hasAnyPermission(req.user, OPPORTUNITY_EDIT_ASSIGNED_PERMISSIONS)

      if (!canEditAny) {
        if (!canEditAssigned || existing.ownerId !== req.user.id) {
          return NextResponse.json({ error: "Insufficient permissions to edit this opportunity" }, { status: 403 })
        }
      }

      const data: Record<string, unknown> = { updatedById: req.user.id }
      let hasChanges = false

      if (typeof payload.name === "string") {
        const name = payload.name.trim()
        if (name.length > 0) {
          data.name = name
          hasChanges = true
        }
      }

      if (typeof payload.stage === "string") {
        if (!isValidStage(payload.stage)) {
          return NextResponse.json({ error: "Invalid opportunity stage" }, { status: 400 })
        }
        data.stage = payload.stage
        hasChanges = true
      }

      if (typeof payload.leadSource === "string" && payload.leadSource.trim().length > 0) {
        if (!isValidLeadSource(payload.leadSource)) {
          return NextResponse.json({ error: "Invalid lead source" }, { status: 400 })
        }
        data.leadSource = payload.leadSource
        hasChanges = true
      } else if (payload.leadSource === null) {
        data.leadSource = null
        hasChanges = true
      }

      if ("ownerId" in payload) {
        const nextOwnerId = await ensureActiveOwnerOrNull(payload.ownerId, req.user.tenantId)
        data.ownerId = nextOwnerId
        hasChanges = true
      }

      if ("estimatedCloseDate" in payload) {
        if (payload.estimatedCloseDate === null || payload.estimatedCloseDate === "") {
          data.estimatedCloseDate = null
          hasChanges = true
        } else if (typeof payload.estimatedCloseDate === "string") {
          const closeDate = new Date(payload.estimatedCloseDate)
          if (Number.isNaN(closeDate.getTime())) {
            return NextResponse.json({ error: "Estimated close date must be a valid date" }, { status: 400 })
          }
          data.estimatedCloseDate = closeDate
          hasChanges = true
        }
      }

      // Description (free text)
      if ("description" in payload) {
        if (payload.description === null) {
          data.description = null
        } else if (typeof payload.description === "string") {
          const desc = payload.description.trim()
          data.description = desc.length > 0 ? desc : null
        }
        hasChanges = true
      } else if (typeof payload.subAgent === "string" || payload.subAgent === null) {
        // Maintain legacy behavior where subAgent is stored within description when explicit description is not provided
        data.description = formatSubAgentDescription(payload.subAgent)
        hasChanges = true
      }

      if (typeof payload.status === "string") {
        if (!isValidStatus(payload.status)) {
          return NextResponse.json({ error: "Invalid opportunity status" }, { status: 400 })
        }
        data.status = payload.status
        hasChanges = true
      } else if (typeof payload.active === "boolean") {
        data.status = payload.active ? OpportunityStatus.Open : OpportunityStatus.Lost
        hasChanges = true
      }

      // Referred By (optional string)
      if ("referredBy" in payload) {
        if (payload.referredBy === null) {
          data.referredBy = null
        } else if (typeof payload.referredBy === "string") {
          const value = payload.referredBy.trim()
          data.referredBy = value.length > 0 ? value : null
        }
        hasChanges = true
      }

      // Shipping/Billing addresses (optional strings)
      if ("shippingAddress" in payload) {
        if (payload.shippingAddress === null) {
          data.shippingAddress = null
        } else if (typeof payload.shippingAddress === "string") {
          const value = payload.shippingAddress.trim()
          data.shippingAddress = value.length > 0 ? value : null
        }
        hasChanges = true
      }

      if ("billingAddress" in payload) {
        if (payload.billingAddress === null) {
          data.billingAddress = null
        } else if (typeof payload.billingAddress === "string") {
          const value = payload.billingAddress.trim()
          data.billingAddress = value.length > 0 ? value : null
        }
        hasChanges = true
      }

      // Percent fields (numbers in 0..1 range or null)
      const percentFields: Array<keyof typeof payload> = [
        "subagentPercent" as const,
        "houseRepPercent" as const,
        "houseSplitPercent" as const
      ]

      for (const key of percentFields) {
        if (key in payload) {
          const raw = (payload as Record<string, unknown>)[key]
          if (raw === null) {
            ;(data as Record<string, unknown>)[key] = null
            hasChanges = true
          } else if (typeof raw === "number") {
            if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
              return NextResponse.json({ error: `${String(key)} must be between 0 and 1` }, { status: 400 })
            }
            ;(data as Record<string, unknown>)[key] = raw
            hasChanges = true
          } else if (typeof raw === "string") {
            const parsed = Number(raw)
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
              return NextResponse.json({ error: `${String(key)} must be between 0 and 1` }, { status: 400 })
            }
            ;(data as Record<string, unknown>)[key] = parsed
            hasChanges = true
          }
        }
      }

      if (!hasChanges) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 })
      }

      async function updateWithPrisma() {
        return prisma.opportunity.update({
          where: { id: existing.id },
          data,
          include: { owner: { select: { firstName: true, lastName: true } } }
        })
      }

      async function updateWithRaw() {
        const sets: string[] = []
        const params: any[] = []
        const pushSet = (col: string, val: unknown, cast?: string) => {
          if (val === undefined) return
          if (val === null) {
            sets.push(`"${col}" = NULL`)
            return
          }
          params.push(val)
          const idx = params.length
          sets.push(`"${col}" = $${idx}${cast ? `::${cast}` : ""}`)
        }

        // Mirror the same fields we handled via Prisma 'data'
        if ("name" in data) pushSet("name", data.name)
        if ("stage" in data) pushSet("stage", data.stage, '"OpportunityStage"')
        if ("status" in data) pushSet("status", data.status, '"OpportunityStatus"')
        if ("leadSource" in data) pushSet("leadSource", data.leadSource, '"LeadSource"')
        if ("ownerId" in data) pushSet("ownerId", data.ownerId, "uuid")
        if ("estimatedCloseDate" in data) pushSet("estimatedCloseDate", data.estimatedCloseDate, "timestamptz")
        if ("description" in data) pushSet("description", data.description)
        if ("referredBy" in data) pushSet("referredBy", data.referredBy)
        if ("shippingAddress" in data) pushSet("shippingAddress", data.shippingAddress)
        if ("billingAddress" in data) pushSet("billingAddress", data.billingAddress)
        if ("subagentPercent" in data) pushSet("subagentPercent", data.subagentPercent)
        if ("houseRepPercent" in data) pushSet("houseRepPercent", data.houseRepPercent)
        if ("houseSplitPercent" in data) pushSet("houseSplitPercent", data.houseSplitPercent)
        // Always set updatedById
        pushSet("updatedById", req.user.id, "uuid")
        // And updatedAt
        sets.push(`"updatedAt" = NOW()`)

        if (sets.length === 0) {
          return null
        }

        const sql = `UPDATE "Opportunity" SET ${sets.join(", ")}
                     WHERE "id" = $${params.length + 1}::uuid AND "tenantId" = $${params.length + 2}::uuid
                     RETURNING "id"`
        const result = await prisma.$queryRawUnsafe<{ id: string }[]>(sql, ...params, existing.id, tenantId)
        return result && result[0] ? { id: result[0].id } : null
      }

      let updated
      try {
        updated = await updateWithPrisma()
      } catch (e) {
        // Fallback to raw when Prisma client is out-of-sync with DB schema
        await updateWithRaw()
        updated = await prisma.opportunity.findFirst({
          where: { id: existing.id, tenantId },
          include: { owner: { select: { firstName: true, lastName: true } } }
        })
      }

      await revalidateOpportunityPaths(existing.accountId)

      return NextResponse.json({ data: mapOpportunityToRow(updated) })
    } catch (error) {
      console.error("Failed to update opportunity", error)
      return NextResponse.json({ error: "Failed to update opportunity" }, { status: 500 })
    }
  })
}

export async function DELETE(request: NextRequest, { params }: { params: { opportunityId: string } }) {
  return withPermissions(request, OPPORTUNITY_DELETE_PERMISSIONS, async (req) => {
    try {
      const { opportunityId } = params
      if (!opportunityId) {
        return NextResponse.json({ error: "Opportunity id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const existing = await prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
        select: { id: true, accountId: true }
      })

      if (!existing) {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
      }

      await prisma.opportunity.delete({ where: { id: existing.id } })

      await revalidateOpportunityPaths(existing.accountId)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Failed to delete opportunity", error)
      return NextResponse.json({ error: "Failed to delete opportunity" }, { status: 500 })
    }
  })
}
