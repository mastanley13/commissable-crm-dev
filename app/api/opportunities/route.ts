import { NextRequest, NextResponse } from "next/server"
import { LeadSource, OpportunityStage } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isValidStage(value: string): value is OpportunityStage {
  return Object.values(OpportunityStage).includes(value as OpportunityStage)
}

function isValidLeadSource(value: string): value is LeadSource {
  return Object.values(LeadSource).includes(value as LeadSource)
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

      const opportunity = await prisma.opportunity.create({
        data: {
          tenantId: req.user.tenantId,
          accountId,
          name,
          stage: stageValue,
          leadSource: leadSourceValue,
          estimatedCloseDate: closeDate,
          ownerId,
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


