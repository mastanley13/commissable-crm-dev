import { NextRequest } from "next/server"
import { createErrorResponse, withPermissions } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]

function toCsvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function serializeRawRow(rawData: unknown) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return ""
  }

  const row = "row" in rawData ? (rawData as { row?: unknown }).row : rawData
  return JSON.stringify(row ?? {})
}

function readErrorType(rawData: unknown) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return ""
  }

  const errorType = "errorType" in rawData ? (rawData as { errorType?: unknown }).errorType : null
  return typeof errorType === "string" ? errorType : ""
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ importJobId: string }> }
) {
  return withPermissions(request, MANAGE_PERMISSIONS, async req => {
    const { importJobId } = await context.params
    if (!importJobId) {
      return createErrorResponse("Import job id is required.", 400)
    }

    const importJob = await prisma.importJob.findFirst({
      where: {
        id: importJobId,
        tenantId: req.user.tenantId
      },
      select: {
        id: true,
        fileName: true,
        errors: {
          orderBy: [{ rowNumber: "asc" }, { createdAt: "asc" }],
          select: {
            rowNumber: true,
            fieldName: true,
            message: true,
            rawData: true
          }
        }
      }
    })

    if (!importJob) {
      return createErrorResponse("Import job not found.", 404)
    }

    const header = ["Row Number", "Field", "Error Type", "Message", "Raw Row"]
    const rows = importJob.errors.map(error =>
      [
        String(error.rowNumber),
        error.fieldName ?? "",
        readErrorType(error.rawData),
        error.message,
        serializeRawRow(error.rawData)
      ].map(toCsvValue).join(",")
    )

    const csv = `\uFEFF${[header.map(toCsvValue).join(","), ...rows].join("\n")}`
    const baseName = importJob.fileName.replace(/\.[^.]+$/, "") || "admin-import"

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}-errors.csv"`,
        "Cache-Control": "no-store"
      }
    })
  })
}
