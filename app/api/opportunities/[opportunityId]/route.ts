import { NextRequest, NextResponse } from "next/server"
import { LeadSource, OpportunityStage, OpportunityStatus, AuditAction, RevenueScheduleStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { mapOpportunityToDetail, mapOpportunityToRow } from "../helpers"
import { revalidateOpportunityPaths } from "../revalidate"
import { ensureActiveOwnerOrNull } from "@/lib/validation"
import {
  deriveStatusFromStage,
  fetchOpportunityProductStatuses,
  recalculateOpportunityStage,
  validateStageTransition
} from "@/lib/opportunities/stage"
import type { OpportunityStageValue } from "@/lib/opportunity-stage"
import { logOpportunityAudit } from "@/lib/audit"

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

const opportunityActivityInclude = {
  creator: { select: { firstName: true, lastName: true } },
  assignee: { select: { firstName: true, lastName: true } },
  attachments: {
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } }
    }
  }
} as const

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
          account: {
            select: {
              id: true,
              accountName: true,
              accountLegalName: true,
              shippingAddress: {
                select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true }
              },
              billingAddress: {
                select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true }
              }
            }
          },
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
            where: { deletedAt: null },
            include: {
              product: {
                select: {
                id: true,
                  productNameVendor: true,
                  commissionPercent: true,
                  priceEach: true
                }
              },
            distributor: { select: { id: true, accountName: true } },
            vendor: { select: { id: true, accountName: true } },
              account: { select: { id: true, accountName: true } },
              opportunity: { select: { id: true, name: true } },
              opportunityProduct: {
                select: {
                id: true,
                productId: true,
                  quantity: true,
                  unitPrice: true
                }
              }
            },
            orderBy: { scheduleDate: "asc" }
          },
          activities: {
            include: opportunityActivityInclude as any,
            orderBy: [
              { dueDate: "desc" },
              { createdAt: "desc" }
            ]
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

      // Load roles linked to this opportunity
      let roles: Array<{
        id: string
        role: string
        fullName: string
        jobTitle: string | null
        email: string | null
        workPhone: string | null
        phoneExtension: string | null
        mobile: string | null
        active: boolean
      }> = []

      try {
        const roleRows = await prisma.opportunityRole.findMany({
          where: { tenantId, opportunityId },
          orderBy: { createdAt: "asc" }
        })
        roles = roleRows.map((r) => ({
          id: r.id,
          role: r.role ?? "",
          fullName: r.fullName ?? "",
          jobTitle: r.jobTitle ?? null,
          email: r.email ?? null,
          workPhone: r.workPhone ?? null,
          phoneExtension: r.phoneExtension ?? null,
          mobile: r.mobile ?? null,
          active: r.active !== false
        }))
      } catch {
        roles = []
      }
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
          detail: { ...detail, roles }
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

      const bypassConstraints = new URL(request.url).searchParams.get("bypassConstraints") === "true"
      const payload = await request.json().catch(() => null)
      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const existing = await prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
        select: {
          id: true,
          accountId: true,
          ownerId: true,
          stage: true,
          status: true,
          active: true,
          name: true,
          leadSource: true,
          estimatedCloseDate: true,
          description: true,
          referredBy: true,
          shippingAddress: true,
          billingAddress: true,
          subagentPercent: true,
          houseRepPercent: true,
          houseSplitPercent: true
        }
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
      let stageWasUpdated = false

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
        let desiredStage = payload.stage as OpportunityStageValue
        if (desiredStage === OpportunityStage.ClosedWon) {
          desiredStage = "ClosedWon_Provisioning"
        }

        const productStatuses = await fetchOpportunityProductStatuses(existing.id)
        validateStageTransition(desiredStage, existing.stage as OpportunityStageValue, productStatuses)
        const derivedStatus = deriveStatusFromStage(desiredStage)
        if (derivedStatus !== existing.status) {
          data.status = derivedStatus
          hasChanges = true
        }

        if (desiredStage !== existing.stage) {
          data.stage = desiredStage
          hasChanges = true
          stageWasUpdated = true
        } else if (derivedStatus !== existing.status) {
          data.status = derivedStatus
          hasChanges = true
        }
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

      // Loss Reason (optional string) - used when deactivating opportunities from the Delete modal
      if ("lossReason" in payload) {
        if (payload.lossReason === null) {
          data.lossReason = null
        } else if (typeof payload.lossReason === "string") {
          const trimmed = payload.lossReason.trim()
          data.lossReason = trimmed.length > 0 ? trimmed : null
        }
        hasChanges = true
      }

      if (typeof payload.status === "string") {
        return NextResponse.json({ error: "Opportunity status is managed automatically by stage" }, { status: 400 })
      }

      // Allow explicit active/inactive toggles using the dedicated `active` flag.
      if (typeof payload.active === "boolean") {
        if (!payload.active && !bypassConstraints) {
          const activeRevenueScheduleCount = await prisma.revenueSchedule.count({
            where: {
              tenantId: req.user.tenantId,
              opportunityId: existing.id,
              deletedAt: null,
              status: {
                in: [
                  RevenueScheduleStatus.Unreconciled,
                  RevenueScheduleStatus.Underpaid,
                  RevenueScheduleStatus.Overpaid
                ]
              }
            }
          })

          if (activeRevenueScheduleCount > 0) {
            return NextResponse.json(
              {
                error: "Opportunity has active revenue schedules and cannot be deleted.",
                constraints: [
                  {
                    entity: "Revenue Schedules",
                    field: "opportunityId",
                    count: activeRevenueScheduleCount,
                    message: `Cannot delete opportunity with ${activeRevenueScheduleCount} active revenue schedule(s). Please complete or cancel revenue schedules first.`
                  }
                ]
              },
              { status: 409 }
            )
          }
        }

        const currentStage = existing.stage as OpportunityStageValue
        const isTerminalStage =
          currentStage === OpportunityStage.ClosedLost ||
          currentStage === "ClosedWon_BillingEnded"

        // Guardrails: do not allow reactivating fully closed-out opportunities.
        if (payload.active && isTerminalStage) {
          return NextResponse.json(
            { error: "Closed Lost / Billing Ended opportunities cannot be reactivated. Create a new opportunity instead." },
            { status: 400 }
          )
        }

        data.active = payload.active
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
      const percentFields = ["subagentPercent", "houseRepPercent", "houseSplitPercent"] as const

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

      const updateWithPrisma = async () => {
        return prisma.opportunity.update({
          where: { id: existing.id },
          data,
          include: { owner: { select: { firstName: true, lastName: true } } }
        })
      }

      const updateWithRaw = async () => {
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
        if ("active" in data) pushSet("active", data.active)
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

      let updated: Awaited<ReturnType<typeof updateWithPrisma>> | null = null
      try {
        updated = await updateWithPrisma()
      } catch (e) {
        // Fallback to raw when Prisma client is out-of-sync with DB schema
        const rawResult = await updateWithRaw()
        if (rawResult) {
          updated = await prisma.opportunity.findFirst({
            where: { id: existing.id, tenantId },
            include: { owner: { select: { firstName: true, lastName: true } } }
          })
        }
      }

      if (!updated) {
        console.error("Raw opportunity update failed to return updated record", { id: existing.id })
        return NextResponse.json({ error: "Failed to update opportunity" }, { status: 500 })
      }

      // Log audit trail for opportunity update
      await logOpportunityAudit(
        AuditAction.Update,
        existing.id,
        req.user.id,
        req.user.tenantId,
        request,
        {
          name: existing.name,
          stage: existing.stage,
          leadSource: existing.leadSource,
          ownerId: existing.ownerId,
          estimatedCloseDate: existing.estimatedCloseDate,
          description: existing.description,
          referredBy: existing.referredBy,
          shippingAddress: existing.shippingAddress,
          billingAddress: existing.billingAddress,
          subagentPercent: existing.subagentPercent,
          houseRepPercent: existing.houseRepPercent,
          houseSplitPercent: existing.houseSplitPercent
        },
        {
          name: updated.name,
          stage: updated.stage,
          leadSource: updated.leadSource,
          ownerId: updated.ownerId,
          estimatedCloseDate: updated.estimatedCloseDate,
          description: updated.description,
          referredBy: updated.referredBy,
          shippingAddress: updated.shippingAddress,
          billingAddress: updated.billingAddress,
          subagentPercent: updated.subagentPercent,
          houseRepPercent: updated.houseRepPercent,
          houseSplitPercent: updated.houseSplitPercent
        }
      )

      await revalidateOpportunityPaths(existing.accountId)
      if (stageWasUpdated) {
        try {
          await recalculateOpportunityStage(existing.id)
        } catch (error) {
          console.error("Failed to recalculate opportunity stage after manual update", error)
        }
      }

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

      let reason: string | null = null
      try {
        const body = await request.json().catch(() => null) as any
        if (body && typeof body.reason === "string") {
          reason = body.reason.trim() || null
        }
      } catch (_) {
        // ignore missing/invalid JSON bodies
      }

      const tenantId = req.user.tenantId
      const existing = await prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
        select: {
          id: true,
          accountId: true,
          name: true,
          stage: true,
          leadSource: true,
          ownerId: true
        }
      })

      if (!existing) {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
      }

      // Guardrails:
      // - OpportunityRole has an FK that can block Opportunity deletion; roles are lightweight so we remove them automatically.
      // - OpportunityProduct has an FK that blocks Opportunity deletion; users must delete products via the Products tab workflow.
      const productCount = await prisma.$transaction(async tx => {
        await tx.opportunityRole.deleteMany({ where: { tenantId, opportunityId: existing.id } })
        return tx.opportunityProduct.count({ where: { tenantId, opportunityId: existing.id } })
      })

      if (productCount > 0) {
        return NextResponse.json(
          {
            error:
              `Cannot permanently delete opportunity while it has ${productCount} product line item(s) (including inactive). ` +
              `Switch the Products tab filter to Inactive and delete the remaining line items first.`
          },
          { status: 409 }
        )
      }

      await prisma.opportunity.delete({ where: { id: existing.id } })

      // Log audit trail for opportunity deletion
      await logOpportunityAudit(
        AuditAction.Delete,
        existing.id,
        req.user.id,
        req.user.tenantId,
        request,
        {
          name: existing.name,
          stage: existing.stage,
          leadSource: existing.leadSource,
          ownerId: existing.ownerId,
          accountId: existing.accountId,
          reason
        },
        undefined
      )

      await revalidateOpportunityPaths(existing.accountId)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Failed to delete opportunity", error)
      // Prisma FK/constraint failures should come back as 409 so the UI can guide the user.
      if (error && typeof error === "object" && "code" in error) {
        const prismaError = error as { code?: string; meta?: any }
        if (prismaError.code === "P2003") {
          return NextResponse.json(
            {
              error:
                "Cannot delete opportunity due to related records. " +
                "If Products/Roles look empty, switch their status filters to Inactive to reveal hidden records, then delete them and try again."
            },
            { status: 409 }
          )
        }
      }
      return NextResponse.json({ error: "Failed to delete opportunity" }, { status: 500 })
    }
  })
}
