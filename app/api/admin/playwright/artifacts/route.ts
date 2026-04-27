import fs from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'
import { withPermissions, createErrorResponse } from '@/lib/api-auth'
import {
  getAllowedArtifactContentType,
  resolveRunArtifactPath,
} from '@/lib/playwright-reconciliation-results'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withPermissions(request, ['admin.playwright.read'], async () => {
    const runId = request.nextUrl.searchParams.get('run')
    const artifactPath = request.nextUrl.searchParams.get('path')
    const shouldDownload = request.nextUrl.searchParams.get('download') === '1'

    if (!runId || !artifactPath) {
      return createErrorResponse('Both "run" and "path" query parameters are required.', 400)
    }

    const resolvedPath = resolveRunArtifactPath(runId, artifactPath)
    if (!resolvedPath) {
      return createErrorResponse('Artifact not found.', 404)
    }

    const contentType = getAllowedArtifactContentType(resolvedPath)
    if (!contentType) {
      return createErrorResponse(
        `Artifact type "${path.extname(resolvedPath).toLowerCase() || 'unknown'}" is not allowed for inline access.`,
        415
      )
    }

    const content = fs.readFileSync(resolvedPath)
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename="${path.basename(resolvedPath)}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })
}
