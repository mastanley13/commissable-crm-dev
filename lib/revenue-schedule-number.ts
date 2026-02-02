import { Prisma } from "@prisma/client"

const SEQUENCE_NAME = "revenue_schedule_number_seq"
const MIN_SEQUENCE_FLOOR = 10000

type SequenceRow = {
  value: bigint | number | string | null
}

type ScheduleNumberRow = {
  scheduleNumber: string | null
}

function formatSequenceValue(rawValue: SequenceRow["value"]): string {
  let numeric = Number.MIN_SAFE_INTEGER

  if (typeof rawValue === "bigint") {
    numeric = Number(rawValue)
  } else if (typeof rawValue === "number") {
    numeric = rawValue
  } else if (typeof rawValue === "string") {
    const parsed = Number(rawValue)
    numeric = Number.isFinite(parsed) ? parsed : Number.MIN_SAFE_INTEGER
  }

  if (!Number.isFinite(numeric) || numeric <= 0) {
    numeric = Date.now()
  }

  const safeValue = Math.max(MIN_SEQUENCE_FLOOR, Math.floor(numeric))
  return String(safeValue).padStart(5, "0")
}

/**
 * Generates the next sequential revenue schedule name using a Postgres sequence.
 * Falls back to a timestamp-backed identifier if the sequence is unavailable.
 */
export async function generateRevenueScheduleName(
  tx: Prisma.TransactionClient
): Promise<string> {
  try {
    const rows = await tx.$queryRaw<SequenceRow[]>(
      Prisma.sql`SELECT nextval(${Prisma.raw(`'${SEQUENCE_NAME}'`)}) AS value`
    )
    const row = rows?.[0]
    return formatSequenceValue(row?.value ?? null)
  } catch (error) {
    console.warn("Falling back to timestamp revenue schedule name", error)
    return formatSequenceValue(null)
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Generates a child schedule number derived from the parent's stored scheduleNumber.
 *
 * Example: parent "1234" -> first child "1234.1", next child "1234.2", etc.
 *
 * Uses a row lock on the parent schedule to reduce duplicate child numbering under concurrency.
 * If parent scheduleNumber is missing, falls back to `generateRevenueScheduleName`.
 */
export async function generateChildRevenueScheduleName(
  tx: Prisma.TransactionClient,
  parentRevenueScheduleId: string,
): Promise<string> {
  if (!parentRevenueScheduleId?.trim()) {
    return generateRevenueScheduleName(tx)
  }

  try {
    const parentRows = await tx.$queryRaw<ScheduleNumberRow[]>(
      Prisma.sql`
        SELECT "scheduleNumber"
        FROM "RevenueSchedule"
        WHERE "id" = ${parentRevenueScheduleId}
        FOR UPDATE
      `,
    )
    const parentScheduleNumber = (parentRows?.[0]?.scheduleNumber ?? "").trim()

    if (!parentScheduleNumber) {
      return generateRevenueScheduleName(tx)
    }

    const childRows = await tx.revenueSchedule.findMany({
      where: {
        parentRevenueScheduleId,
        scheduleNumber: { startsWith: `${parentScheduleNumber}.` },
      },
      select: { scheduleNumber: true },
    })

    const pattern = new RegExp(`^${escapeRegex(parentScheduleNumber)}\\.(\\d+)$`)
    let maxSuffix = 0

    for (const row of childRows) {
      const scheduleNumber = (row.scheduleNumber ?? "").trim()
      const match = scheduleNumber.match(pattern)
      if (!match?.[1]) continue
      const parsed = Number(match[1])
      if (Number.isFinite(parsed) && parsed > maxSuffix) {
        maxSuffix = parsed
      }
    }

    return `${parentScheduleNumber}.${maxSuffix + 1}`
  } catch (error) {
    console.warn("Falling back to non-child revenue schedule name", error)
    return generateRevenueScheduleName(tx)
  }
}
