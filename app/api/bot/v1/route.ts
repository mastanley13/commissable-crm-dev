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
      recommendedReadOnlyManifestPath: "/api/bot/v1/tools/manifest",
      recommendedCapabilityRegistryPath: "/api/bot/v1/tools/capabilities",
      recommendedCapabilityResolverPath: "/api/bot/v1/tools/capabilities/resolve",
      legacyOpenApiFile: "docs/openapi/openclaw-bot-v1.openapi.yaml",
      note: "Production/client-facing OpenClaw v1 should use the read-only /api/bot/v1/tools surface instead of the legacy mixed /api/bot/v1 route map.",
    },
  })
}
