import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OPPORTUNITY_ROLE_EDIT_ANY_PERMISSIONS = [
  "opportunities.edit.all",
  "opportunities.manage",
  "accounts.manage",
  "accounts.update"
]

const OPPORTUNITY_ROLE_EDIT_ASSIGNED_PERMISSIONS = ["opportunities.edit.assigned"]

const OPPORTUNITY_ROLE_EDIT_PERMISSIONS = Array.from(
  new Set([
    ...OPPORTUNITY_ROLE_EDIT_ANY_PERMISSIONS,
    ...OPPORTUNITY_ROLE_EDIT_ASSIGNED_PERMISSIONS
  ])
)

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  return withPermissions(request, OPPORTUNITY_ROLE_EDIT_PERMISSIONS, async req => {
    try {
      const { opportunityId } = params
      if (!opportunityId) {
        return NextResponse.json({ error: "Opportunity id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const payload = await request.json().catch(() => null)
      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const existingOpportunity = await prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
        select: { id: true, accountId: true, ownerId: true }
      })

      if (!existingOpportunity) {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
      }

      const canEditAny = hasAnyPermission(req.user, OPPORTUNITY_ROLE_EDIT_ANY_PERMISSIONS)
      const canEditAssigned = hasAnyPermission(req.user, OPPORTUNITY_ROLE_EDIT_ASSIGNED_PERMISSIONS)
      if (!canEditAny) {
        if (!canEditAssigned || existingOpportunity.ownerId !== req.user.id) {
          return NextResponse.json({ error: "Insufficient permissions to modify this opportunity" }, { status: 403 })
        }
      }

      const role = normalizeString((payload as any).role)
      if (!role) {
        return NextResponse.json({ error: "Role is required" }, { status: 400 })
      }

      const contactIdRaw = (payload as any).contactId
      const contactId = typeof contactIdRaw === "string" && contactIdRaw.trim().length > 0 ? contactIdRaw.trim() : null

      let fullName = normalizeString((payload as any).fullName)
      let jobTitle = normalizeString((payload as any).jobTitle)
      let email = normalizeString((payload as any).email)
      let workPhone = normalizeString((payload as any).workPhone)
      let phoneExtension = normalizeString((payload as any).phoneExtension)
      let mobile = normalizeString((payload as any).mobile)
      const active: boolean = (payload as any).active === false ? false : true

      if (contactId) {
        const contact = await prisma.contact.findFirst({
          where: { id: contactId, tenantId },
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            emailAddress: true,
            workPhone: true,
            workPhoneExt: true,
            mobilePhone: true
          }
        })
        if (!contact) {
          return NextResponse.json({ error: "Contact not found" }, { status: 404 })
        }
        // Prefer provided overrides; otherwise use contact defaults
        if (!fullName) fullName = contact.fullName ?? ""
        if (!jobTitle) jobTitle = contact.jobTitle ?? ""
        if (!email) email = contact.emailAddress ?? ""
        if (!workPhone) workPhone = contact.workPhone ?? ""
        if (!phoneExtension) phoneExtension = contact.workPhoneExt ?? ""
        if (!mobile) mobile = contact.mobilePhone ?? ""
      }

      if (!fullName) {
        return NextResponse.json({ error: "Full name is required" }, { status: 400 })
      }

      const created = await prisma.opportunityRole.create({
        data: {
          tenantId,
          opportunityId: existingOpportunity.id,
          contactId,
          role,
          fullName,
          jobTitle: jobTitle || null,
          email: email || null,
          workPhone: workPhone || null,
          phoneExtension: phoneExtension || null,
          mobile: mobile || null,
          active,
          createdById: req.user.id
        }
      })

      const record = {
        id: created.id,
        role: created.role,
        fullName: created.fullName,
        jobTitle: created.jobTitle ?? null,
        email: created.email ?? null,
        workPhone: created.workPhone ?? null,
        phoneExtension: created.phoneExtension ?? null,
        mobile: created.mobile ?? null,
        active: created.active
      }

      return NextResponse.json({ data: record }, { status: 201 })
    } catch (error) {
      console.error("Failed to create opportunity role", error)
      return NextResponse.json({ error: "Failed to create role" }, { status: 500 })
    }
  })
}
