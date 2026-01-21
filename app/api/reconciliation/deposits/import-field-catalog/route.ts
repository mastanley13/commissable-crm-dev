import { NextRequest, NextResponse } from "next/server"
import { FieldModule } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { buildDepositImportFieldCatalog } from "@/lib/deposit-import/field-catalog"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withPermissions(request, ["reconciliation.view"], async req => {
    const tenantId = req.user.tenantId
    const opportunityFields = await prisma.fieldDefinition.findMany({
      where: { tenantId, module: FieldModule.Opportunities },
      select: { fieldCode: true, label: true, dataType: true },
      orderBy: { displayOrder: "asc" },
    })

    const catalog = buildDepositImportFieldCatalog({ opportunityFieldDefinitions: opportunityFields })
    return NextResponse.json({ data: catalog })
  })
}
