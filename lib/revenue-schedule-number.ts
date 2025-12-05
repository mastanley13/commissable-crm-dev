import { Prisma } from "@prisma/client"

const SEQUENCE_NAME = "revenue_schedule_number_seq"
const MIN_SEQUENCE_FLOOR = 10000

type SequenceRow = {
  value: bigint | number | string | null
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
