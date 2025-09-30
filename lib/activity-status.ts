import { ActivityStatus } from "@prisma/client"

function pickStatuses(keys: string[]): ActivityStatus[] {
  return keys
    .map(k => (ActivityStatus as any)[k])
    .filter(Boolean) as ActivityStatus[]
}

const CLOSED_STATUSES = pickStatuses(["Completed", "Cancelled", "Deferred"]) // whatever exists

export const OPEN_ACTIVITY_STATUSES: ActivityStatus[] = (() => {
  const open = (ActivityStatus as any).Open as ActivityStatus | undefined
  if (open) return [open]

  const candidates = pickStatuses(["Scheduled", "InProgress"]) // for schemas that split open
  if (candidates.length > 0) return candidates

  // Fallback: anything not closed
  const all = Object.values(ActivityStatus) as ActivityStatus[]
  return all.filter(s => !CLOSED_STATUSES.includes(s))
})()

export const DEFAULT_OPEN_ACTIVITY_STATUS: ActivityStatus = (
  ((ActivityStatus as any).Open ?? OPEN_ACTIVITY_STATUSES[0] ?? (Object.values(ActivityStatus)[0] as ActivityStatus))
)

export function isActivityOpen(status: ActivityStatus): boolean {
  return OPEN_ACTIVITY_STATUSES.includes(status)
}
