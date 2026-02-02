export function formatRevenueScheduleDisplayName({
  scheduleNumber,
  fallbackId,
  flexClassification,
}: {
  scheduleNumber: string | null | undefined
  fallbackId: string
  flexClassification: string | null | undefined
}): string {
  const base = (scheduleNumber ?? fallbackId ?? "").trim() || fallbackId
  const classification = (flexClassification ?? "").trim()
  if (!classification) return base

  switch (classification) {
    case "FlexProduct":
      // When a Flex Product is created as a child schedule (spec-style numbering like 1234.1),
      // prefer the literal stored scheduleNumber without adding a suffix.
      return base.includes(".") ? base : `${base}-F`
    case "FlexChargeback":
      return `${base}-CB`
    case "FlexChargebackReversal":
      return `${base}-CB-REV`
    default:
      return base
  }
}
