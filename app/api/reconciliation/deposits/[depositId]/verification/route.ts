import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseOptionalNumber(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : "invalid"
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed.replace(/[^0-9.\-]/g, ""))
    return Number.isFinite(parsed) ? parsed : "invalid"
  }
  return "invalid"
}

function parseOptionalDate(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return "invalid"
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return "invalid"
  return parsed
}

function parseOptionalString(value: unknown): string | null | "invalid" {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return "invalid"
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

export async function POST(request: NextRequest, { params }: { params: { depositId: string } }) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    try {
      const tenantId = req.user.tenantId
      const depositId = params?.depositId?.trim()
      if (!depositId) {
        return createErrorResponse("Deposit id is required", 400)
      }

      const body = await request.json().catch(() => null)
      if (!body || typeof body !== "object") {
        return createErrorResponse("Invalid request body", 400)
      }

      const amount = parseOptionalNumber((body as any).actualReceivedAmount)
      if (amount === "invalid") {
        return createErrorResponse("Invalid Actual Received Amount", 400)
      }

      const receivedDate = parseOptionalDate((body as any).receivedDate)
      if (receivedDate === "invalid") {
        return createErrorResponse("Invalid Received Date", 400)
      }

      const receivedBy = parseOptionalString((body as any).receivedBy)
      if (receivedBy === "invalid") {
        return createErrorResponse("Invalid Received By", 400)
      }

      const deposit = await prisma.deposit.findFirst({
        where: { id: depositId, tenantId },
        select: { id: true },
      })
      if (!deposit) {
        return createErrorResponse("Deposit not found", 404)
      }

      const updated = await prisma.deposit.update({
        where: { id: depositId },
        data: {
          actualReceivedAmount: amount,
          receivedDate,
          receivedBy,
        },
        select: {
          id: true,
          actualReceivedAmount: true,
          receivedDate: true,
          receivedBy: true,
        },
      })

      return NextResponse.json({
        data: {
          id: updated.id,
          actualReceivedAmount: updated.actualReceivedAmount != null ? Number(updated.actualReceivedAmount) : null,
          receivedDate: updated.receivedDate?.toISOString() ?? null,
          receivedBy: updated.receivedBy ?? null,
        },
      })
    } catch (error) {
      console.error("Failed to update deposit verification fields", error)
      const message =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? `Failed to update deposit verification fields: ${error.message}`
          : "Failed to update deposit verification fields"
      return createErrorResponse(message, 500)
    }
  })
}

