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
      return `${base}-F`
    case "FlexChargeback":
      return `${base}-CB`
    case "FlexChargebackReversal":
      return `${base}-CB-REV`
    default:
      return base
  }
}

