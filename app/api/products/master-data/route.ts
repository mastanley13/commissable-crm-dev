import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { resolveTenantId } from "@/lib/server-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = await resolveTenantId(searchParams.get("tenantId"))

    const [families, subtypes] = await Promise.all([
      prisma.productFamily.findMany({
        where: {
          tenantId,
          isActive: true
        },
        orderBy: { name: "asc" }
      }),
      prisma.productSubtype.findMany({
        where: {
          tenantId,
          isActive: true
        },
        orderBy: { name: "asc" },
        include: {
          family: {
            select: { id: true, name: true }
          }
        }
      })
    ])

    return NextResponse.json({
      families: families.map(family => ({
        id: family.id,
        code: family.code,
        name: family.name,
        description: family.description,
        isSystem: family.isSystem
      })),
      subtypes: subtypes.map(subtype => ({
        id: subtype.id,
        code: subtype.code,
        name: subtype.name,
        description: subtype.description,
        isSystem: subtype.isSystem,
        productFamilyId: subtype.productFamilyId,
        familyName: subtype.family?.name ?? null
      }))
    })
  } catch (error) {
    console.error("Failed to load product master data", error)
    return NextResponse.json(
      { error: "Failed to load product master data" },
      { status: 500 }
    )
  }
}

