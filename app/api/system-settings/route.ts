import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['system.settings.read'],
    async (req) => {
      const tenantId = req.user.tenantId

      try {
        const settings = await prisma.systemSetting.findMany({
          where: { tenantId },
          select: {
            key: true,
            value: true,
            description: true,
            scope: true
          }
        })

        // Convert to key-value object
        const settingsMap = settings.reduce((acc, setting) => {
          acc[setting.key] = {
            value: setting.value,
            description: setting.description,
            scope: setting.scope
          }
          return acc
        }, {} as Record<string, any>)

        return NextResponse.json({
          data: settingsMap
        })
      } catch (error) {
        console.error("Failed to load system settings", error)
        return NextResponse.json({ error: "Failed to load system settings" }, { status: 500 })
      }
    }
  )
}

export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ['system.settings.write'],
    async (req) => {
      const tenantId = req.user.tenantId
      const body = await request.json()

      try {
        const { key, value, description, scope = 'Tenant' } = body

        if (!key) {
          return NextResponse.json({ error: "Setting key is required" }, { status: 400 })
        }

        // Upsert the setting
        const setting = await prisma.systemSetting.upsert({
          where: {
            tenantId_key: {
              tenantId,
              key
            }
          },
          update: {
            value: value ? JSON.stringify(value) : null,
            description,
            scope
          },
          create: {
            tenantId,
            key,
            value: value ? JSON.stringify(value) : null,
            description,
            scope
          }
        })

        return NextResponse.json({
          data: {
            key: setting.key,
            value: setting.value ? JSON.parse(setting.value) : null,
            description: setting.description,
            scope: setting.scope
          }
        })
      } catch (error) {
        console.error("Failed to save system setting", error)
        return NextResponse.json({ error: "Failed to save system setting" }, { status: 500 })
      }
    }
  )
}
