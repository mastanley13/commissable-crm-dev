import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    name: "Commissable OpenClaw Bot API",
    version: "v1",
    basePath: "/api/bot/v1",
    auth: {
      scheme: "Bearer",
      header: "Authorization: Bearer <OPENCLAW_API_KEY>",
      contentType: "application/json",
    },
    docs: {
      openapiFile: "docs/openapi/openclaw-bot-v1.openapi.yaml",
    },
  })
}
