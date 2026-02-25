export type MergeEntity = "Account" | "Contact"

export type MergeWinner = "target" | "source"

export type RelatedCount = { label: string; count: number }

export type MergeCollision = { type: string; message: string }

export type FieldConflict = { field: string; target: unknown; source: unknown }

export type MergePreview = {
  entity: MergeEntity
  target: { id: string; displayLabel: string; fields: Record<string, unknown> }
  source: { id: string; displayLabel: string; fields: Record<string, unknown> }
  fieldConflicts: FieldConflict[]
  relatedCounts: RelatedCount[]
  collisions: MergeCollision[]
}

export type MergeExecuteRequest = {
  tenantId: string
  userId: string
  targetId: string
  sourceId: string
  fieldWinners: Record<string, MergeWinner | undefined>
  dryRun: boolean
}

export type MergeExecuteResult = {
  ok: true
  entity: MergeEntity
  targetId: string
  sourceId: string
  moved: RelatedCount[]
  auditLogId: string
}

