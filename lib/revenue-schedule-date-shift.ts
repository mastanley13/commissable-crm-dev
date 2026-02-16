import { isDateOnlyString } from "@/lib/date-only"

export function parseDateInputToUtcDate(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (isDateOnlyString(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00.000Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function toMonthStartUtc(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
}

export function diffMonthsUtc(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
}

function daysInUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

export function addMonthsClampedUtc(value: Date, deltaMonths: number): Date {
  if (!Number.isFinite(deltaMonths) || deltaMonths === 0) {
    return new Date(value.getTime())
  }

  const year = value.getUTCFullYear()
  const month = value.getUTCMonth()
  const day = value.getUTCDate()

  const monthIndex = month + deltaMonths
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12

  const lastDay = daysInUtcMonth(targetYear, targetMonth)
  const clampedDay = Math.min(day, lastDay)

  return new Date(Date.UTC(targetYear, targetMonth, clampedDay))
}

export function shiftScheduleDateMonthStartUtc(original: Date, deltaMonths: number): Date {
  return toMonthStartUtc(addMonthsClampedUtc(original, deltaMonths))
}

