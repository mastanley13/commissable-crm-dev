import { NextRequest, NextResponse } from "next/server"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import {
  mergeMultiVendorTemplateConfigs,
  resolveMultiVendorTemplates,
} from "@/lib/deposit-import/multi-vendor-template-resolver"

function parseDistinctVendorNames(value: unknown) {
  if (!Array.isArray(value)) return []
  const names: string[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    if (typeof raw !== "string") continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(trimmed)
  }
  return names
}

export async function POST(request: NextRequest) {
  return withPermissions(request, ["reconciliation.view"], async req => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return createErrorResponse("Invalid request body", 400)
    }

    const distributorAccountId =
      typeof (body as any).distributorAccountId === "string"
        ? (body as any).distributorAccountId.trim()
        : ""
    const vendorNames = parseDistinctVendorNames((body as any).vendorNames)

    if (!distributorAccountId) {
      return createErrorResponse("Distributor is required", 400)
    }
    if (vendorNames.length === 0) {
      return NextResponse.json({
        data: {
          templatesUsed: [],
          missingVendors: [],
          vendorsMissingTemplates: [],
          mergedTemplateConfig: {
            depositMappingV2: null,
            telarusTemplateFields: null,
          },
          warnings: [],
        },
      })
    }

    const maxVendorsRaw = Number((body as any)?.options?.maxVendors ?? 100)
    const maxVendors = Number.isFinite(maxVendorsRaw)
      ? Math.max(1, Math.min(300, Math.floor(maxVendorsRaw)))
      : 100

    const truncatedVendorNames = vendorNames.slice(0, maxVendors)
    const warnings: string[] = []
    if (vendorNames.length > maxVendors) {
      warnings.push(
        `Preview limited to first ${maxVendors} vendors out of ${vendorNames.length} detected.`,
      )
    }

    const resolved = await resolveMultiVendorTemplates({
      db: prisma,
      tenantId: req.user.tenantId,
      distributorAccountId,
      vendorNamesInFile: truncatedVendorNames,
    })

    const mergedTemplateConfig = mergeMultiVendorTemplateConfigs(
      Array.from(resolved.byVendorKey.values()),
    )

    return NextResponse.json({
      data: {
        templatesUsed: resolved.templatesUsed,
        missingVendors: resolved.missingVendors,
        vendorsMissingTemplates: resolved.vendorsMissingTemplates,
        mergedTemplateConfig,
        warnings,
      },
    })
  })
}
