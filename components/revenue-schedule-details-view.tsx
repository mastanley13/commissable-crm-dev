"use client"

import Link from "next/link"
import { Loader2, AlertCircle } from "lucide-react"
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { RevenueScheduleSupportingDetails, type RevenueScheduleSupportingDetailsHandle } from "./revenue-schedule-supporting-details"
import { useEntityEditor } from "@/hooks/useEntityEditor"
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt"
import { useAuth } from "@/lib/auth-context"
import { EditableField } from "./editable-field"
import { useToasts } from "./toast"
import { getRevenueTypeLabel, REVENUE_TYPE_OPTIONS } from "@/lib/revenue-types"

interface FieldDefinition {
  fieldId: string
  label: string
  value?: ReactNode
  fullWidth?: boolean
}

interface MetricDefinition {
  fieldId: string
  label: string
  value?: ReactNode
}

export interface RevenueScheduleDetailRecord {
  id: string
  revenueSchedule?: string
  revenueScheduleName?: string
  revenueScheduleDate?: string
  revenueMonth?: string | null
  billingMonth?: string | null
  deletedAt?: string | null
  productNameVendor?: string
  productNameHouse?: string | null
  productDescriptionVendor?: string
  productRevenueType?: string
  productRevenueTypeLabel?: string | null
  scheduleStatus?: string
  inDispute?: boolean
  opportunityId?: string | number | null
  opportunityName?: string | null
  opportunityOwnerName?: string | null
  orderIdHouse?: string | null
  orderIdVendor?: string | null
  orderIdDistributor?: string | null
  customerIdHouse?: string | null
  customerIdVendor?: string | null
  customerIdDistributor?: string | null
  locationId?: string | null
  distributorName?: string | null
  distributorId?: string | null
  vendorName?: string | null
  vendorId?: string | null
  accountName?: string | null
  accountId?: string | null
  productId?: string | null
  legalName?: string | null
  shippingAddress?: string | null
  billingAddress?: string | null
  expectedCommissionRatePercent?: string | null
  actualCommissionRatePercent?: string | null
  commissionRateDifference?: string | null
  houseSplitPercent?: string | null
  houseRepSplitPercent?: string | null
  subagentSplitPercent?: string | null
  subagentName?: string | null
  quantity?: string | null
  priceEach?: string | null
  expectedUsage?: string | null
  expectedUsageGross?: string | null
  expectedUsageAdjustment?: string | null
  expectedUsageNet?: string | null
  actualUsage?: string | null
  usageBalance?: string | null
  expectedCommissionGross?: string | null
  expectedCommissionAdjustment?: string | null
  expectedCommissionNet?: string | null
  actualCommission?: string | null
  commissionDifference?: string | null
  paymentType?: string | null
  comments?: string | null
  houseRepName?: string | null
}

interface RevenueScheduleDetailsViewProps {
  schedule: RevenueScheduleDetailRecord | null
  loading?: boolean
  error?: string | null
  scheduleKey?: string
  onRefresh?: () => void
  // When true, shows the V2 Financial Summary section and passes the redesign
  // flag down to supporting details for horizontal tabs, etc.
  supportingDetailsV2?: boolean
}

const placeholder = <span className="text-gray-400">--</span>
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fieldLabelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap flex items-center"
const baseFieldBoxClass =
  "flex min-h-[28px] w-full items-center justify-between border-b-2 border-gray-300 bg-transparent pl-[3px] pr-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis"

function renderValue(value?: ReactNode) {
  if (value === undefined || value === null) {
    return placeholder
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return placeholder
    }
    return trimmed
  }

  return value
}

function FieldRow({ label, value, fullWidth }: FieldDefinition) {
  const resolvedValue = renderValue(value)
  const displayValue =
    typeof resolvedValue === "string" ? (
      <span className="block truncate" title={resolvedValue}>
        {resolvedValue}
      </span>
    ) : (
      resolvedValue
    )

  const fieldBoxClass = `${baseFieldBoxClass} ${fullWidth ? "max-w-none whitespace-normal break-words" : "max-w-[18rem]"}`

  return (
    <div className="grid items-center gap-3 sm:grid-cols-[180px,minmax(0,1fr)]">
      <span className={fieldLabelClass}>{label}</span>
      <div className={fieldBoxClass}>{displayValue}</div>
    </div>
  )
}

function MetricTile({ fieldId, label, value }: MetricDefinition) {
  const resolvedValue = renderValue(value)
  const displayValue =
    typeof resolvedValue === "string" ? (
      <span className="block truncate" title={resolvedValue}>
        {resolvedValue}
      </span>
    ) : (
      resolvedValue
    )

  return (
    <div className="flex min-w-[110px] flex-1 flex-col justify-between gap-0.5 border-2 border-gray-300 bg-white px-2 py-1.5 text-[11px] text-gray-900 shadow-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-normal break-words leading-tight">{label}</span>
      <div className="text-left text-[11px] font-semibold text-gray-900 whitespace-nowrap">{displayValue}</div>
    </div>
  )
}

interface RevenueScheduleInlineForm {
  revenueScheduleName: string
  revenueScheduleDate: string
  quantity: string
  priceEach: string
  expectedUsageAdjustment: string
  expectedCommissionAdjustment: string
  expectedCommissionRatePercent?: string
  houseSplitPercent?: string
  houseRepSplitPercent?: string
  subagentSplitPercent?: string
  comments: string
}

function mapDetailToInline(detail: RevenueScheduleDetailRecord | null): RevenueScheduleInlineForm {
  const name = detail?.revenueScheduleName ?? detail?.revenueSchedule ?? ""
  return {
    revenueScheduleName: name || "",
    revenueScheduleDate: detail?.revenueScheduleDate ?? "",
    quantity: detail?.quantity ?? "",
    priceEach: detail?.priceEach ?? "",
    expectedUsageAdjustment: detail?.expectedUsageAdjustment ?? "",
    expectedCommissionAdjustment: detail?.expectedCommissionAdjustment ?? "",
    expectedCommissionRatePercent: detail?.expectedCommissionRatePercent ?? "",
    houseSplitPercent: detail?.houseSplitPercent ?? "",
    houseRepSplitPercent: detail?.houseRepSplitPercent ?? "",
    subagentSplitPercent: detail?.subagentSplitPercent ?? "",
    comments: detail?.comments ?? ""
  }
}

function EditRow({ label, control, error }: { label: string; control: ReactNode; error?: string }) {
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[180px,minmax(0,1fr)]">
      <span className={fieldLabelClass}>{label}</span>
      <div className="max-w-[18rem] flex w-full flex-col gap-1">
        {control}
        {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      </div>
    </div>
  )
}

interface FinancialSummarySectionProps {
  schedule: RevenueScheduleDetailRecord
  onOpenSection?: (sectionId: string) => void
  enableInlineEditing?: boolean
  errors?: Record<string, string>
  quantityField?: { value: unknown; onChange: any; onBlur: any } | null
  priceEachField?: { value: unknown; onChange: any; onBlur: any } | null
  expectedUsageAdjustmentField?: { value: unknown; onChange: any; onBlur: any } | null
  expectedCommissionAdjustmentField?: { value: unknown; onChange: any; onBlur: any } | null
  expectedRateField?: { value: unknown; onChange: any; onBlur: any } | null
  houseSplitField?: { value: unknown; onChange: any; onBlur: any } | null
  houseRepSplitField?: { value: unknown; onChange: any; onBlur: any } | null
  subagentSplitField?: { value: unknown; onChange: any; onBlur: any } | null
}

function FinancialSummarySection({
  schedule,
  onOpenSection,
  enableInlineEditing = false,
  errors,
  quantityField,
  priceEachField,
  expectedUsageAdjustmentField,
  expectedCommissionAdjustmentField,
  expectedRateField,
  houseSplitField,
  houseRepSplitField,
  subagentSplitField
}: FinancialSummarySectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [splitMode, setSplitMode] = useState<"percent" | "amount">("percent")

  const isBlank = (value?: string | null) => {
    if (value === null || value === undefined) return true
    const trimmed = value.trim()
    return trimmed.length === 0 || trimmed === "-"
  }

  const parseCurrencyMaybe = (value?: string | null): number | null => {
    if (isBlank(value)) return null
    const cleaned = value.replace(/[^0-9.-]/g, "")
    const numeric = Number(cleaned)
    return Number.isFinite(numeric) ? numeric : null
  }

  const parseNumberMaybe = (value?: string | null): number | null => {
    if (isBlank(value)) return null
    const cleaned = value.replace(/[^0-9.-]/g, "")
    const numeric = Number(cleaned)
    return Number.isFinite(numeric) ? numeric : null
  }

  // Returns a fraction (0.18) from "18%", "18", or "0.18".
  const parsePercentFractionMaybe = (value?: string | null): number | null => {
    if (isBlank(value)) return null
    const cleaned = value.replace(/[^0-9.-]/g, "")
    const numeric = Number(cleaned)
    if (!Number.isFinite(numeric)) return null

    const hasPercent = value?.includes("%") ?? false
    const absValue = Math.abs(numeric)
    if (hasPercent) return numeric / 100
    if (absValue <= 1) return numeric
    return numeric / 100
  }

  const formatMoney = (value: number): string =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value)

  const inlineQuantity = enableInlineEditing ? (quantityField?.value as string | null | undefined) : null
  const inlinePriceEach = enableInlineEditing ? (priceEachField?.value as string | null | undefined) : null
  const inlineUsageAdj = enableInlineEditing
    ? (expectedUsageAdjustmentField?.value as string | null | undefined)
    : null
  const inlineCommissionAdj = enableInlineEditing
    ? (expectedCommissionAdjustmentField?.value as string | null | undefined)
    : null
  const inlineExpectedRate = enableInlineEditing ? (expectedRateField?.value as string | null | undefined) : null

  const quantityNumber = parseNumberMaybe(inlineQuantity ?? schedule.quantity)
  const priceEachNumber = parseCurrencyMaybe(inlinePriceEach ?? schedule.priceEach)
  const expectedUsageGrossNumber =
    quantityNumber !== null && priceEachNumber !== null
      ? quantityNumber * priceEachNumber
      : parseCurrencyMaybe(schedule.expectedUsageGross ?? schedule.expectedUsage ?? null)

  const expectedUsageAdjustmentNumber =
    parseCurrencyMaybe(inlineUsageAdj ?? schedule.expectedUsageAdjustment) ?? 0
  const hasUsageInputs =
    !isBlank(inlineQuantity ?? schedule.quantity) ||
    !isBlank(inlinePriceEach ?? schedule.priceEach) ||
    !isBlank(inlineUsageAdj ?? schedule.expectedUsageAdjustment) ||
    !isBlank(schedule.expectedUsageGross ?? schedule.expectedUsage ?? null)

  const expectedUsageNetNumber =
    hasUsageInputs && expectedUsageGrossNumber !== null
      ? expectedUsageGrossNumber + expectedUsageAdjustmentNumber
      : hasUsageInputs
        ? expectedUsageAdjustmentNumber
        : parseCurrencyMaybe(schedule.expectedUsageNet) ?? null

  const expectedUsageGrossDisplay =
    expectedUsageGrossNumber !== null
      ? formatMoney(expectedUsageGrossNumber)
      : schedule.expectedUsageGross ?? schedule.expectedUsage ?? null
  const expectedUsageNetDisplay =
    expectedUsageNetNumber !== null ? formatMoney(expectedUsageNetNumber) : schedule.expectedUsageNet ?? expectedUsageGrossDisplay

  const actualUsageMaybe = parseCurrencyMaybe(schedule.actualUsage)
  const hasActualUsage = !isBlank(schedule.actualUsage)
  const usageDifferenceNumber =
    expectedUsageNetNumber !== null || hasActualUsage
      ? (expectedUsageNetNumber ?? 0) - (actualUsageMaybe ?? 0)
      : null

  const expectedRateFraction = parsePercentFractionMaybe(inlineExpectedRate ?? schedule.expectedCommissionRatePercent)
  const expectedCommissionGrossNumber =
    expectedUsageNetNumber !== null && expectedRateFraction !== null
      ? expectedUsageNetNumber * expectedRateFraction
      : parseCurrencyMaybe(schedule.expectedCommissionGross ?? null) ?? parseCurrencyMaybe(schedule.expectedCommissionNet ?? null)

  const expectedCommissionAdjustmentNumber =
    parseCurrencyMaybe(inlineCommissionAdj ?? schedule.expectedCommissionAdjustment) ?? 0
  const hasCommissionInputs =
    !isBlank(inlineCommissionAdj ?? schedule.expectedCommissionAdjustment) ||
    !isBlank(schedule.expectedCommissionGross ?? null) ||
    !isBlank(schedule.expectedCommissionNet ?? null) ||
    !isBlank(schedule.actualCommission)

  const expectedCommissionNetNumber =
    expectedCommissionGrossNumber !== null
      ? expectedCommissionGrossNumber + expectedCommissionAdjustmentNumber
      : hasCommissionInputs
        ? expectedCommissionAdjustmentNumber
        : parseCurrencyMaybe(schedule.expectedCommissionNet) ?? null

  const commissionExpectedDisplay =
    expectedCommissionGrossNumber !== null
      ? formatMoney(expectedCommissionGrossNumber)
      : schedule.expectedCommissionGross ?? schedule.expectedCommissionNet ?? null
  const commissionNetDisplay =
    expectedCommissionNetNumber !== null ? formatMoney(expectedCommissionNetNumber) : schedule.expectedCommissionNet ?? commissionExpectedDisplay

  const actualCommissionMaybe = parseCurrencyMaybe(schedule.actualCommission)
  const commissionDifferenceNumber =
    expectedCommissionNetNumber !== null || !isBlank(schedule.actualCommission)
      ? (expectedCommissionNetNumber ?? 0) - (actualCommissionMaybe ?? 0)
      : null

  // Prefer the API-provided actual rate when present, otherwise derive it from usage/commission.
  const actualRateFractionFromApi = parsePercentFractionMaybe(schedule.actualCommissionRatePercent)
  const actualRateFractionDerived =
    actualUsageMaybe !== null && actualUsageMaybe !== 0 && actualCommissionMaybe !== null ? actualCommissionMaybe / actualUsageMaybe : null
  const actualRateFraction = actualRateFractionFromApi ?? actualRateFractionDerived
  const commissionRateDifferenceNumber =
    expectedRateFraction !== null && actualRateFraction !== null ? expectedRateFraction - actualRateFraction : null

  const splitsDisplay = (() => {
    const housePercent = schedule.houseSplitPercent ?? "--"
    const houseRepPercent = schedule.houseRepSplitPercent ?? "--"
    const subagentPercent = schedule.subagentSplitPercent ?? "--"

    if (splitMode === "percent") {
      const houseFraction = parsePercentFractionMaybe(housePercent) ?? 0
      const houseRepFraction = parsePercentFractionMaybe(houseRepPercent) ?? 0
      const subagentFraction = parsePercentFractionMaybe(subagentPercent) ?? 0
      const anySplitPresent = !isBlank(schedule.houseSplitPercent) || !isBlank(schedule.houseRepSplitPercent) || !isBlank(schedule.subagentSplitPercent)
      const totalFraction = anySplitPresent ? houseFraction + houseRepFraction + subagentFraction : null
      const formattedTotal = totalFraction !== null ? `${(totalFraction * 100).toFixed(2)}%` : "--"
      return {
        house: housePercent,
        houseRep: houseRepPercent,
        subagent: subagentPercent,
        total: formattedTotal
      }
    }

    const totalCommission = actualCommissionMaybe ?? expectedCommissionNetNumber ?? null
    if (totalCommission === null || totalCommission === 0) {
      return {
        house: schedule.houseSplitPercent ?? "--",
        houseRep: schedule.houseRepSplitPercent ?? "--",
        subagent: schedule.subagentSplitPercent ?? "--",
        total: totalCommission === 0 ? formatMoney(0) : "--"
      }
    }

    const houseFraction = parsePercentFractionMaybe(schedule.houseSplitPercent) ?? 0
    const houseRepFraction = parsePercentFractionMaybe(schedule.houseRepSplitPercent) ?? 0
    const subagentFraction = parsePercentFractionMaybe(schedule.subagentSplitPercent) ?? 0

    const houseAmount = totalCommission * houseFraction
    const houseRepAmount = totalCommission * houseRepFraction
    const subagentAmount = totalCommission * subagentFraction

    const totalAmount = houseAmount + houseRepAmount + subagentAmount

    return {
      house: formatMoney(houseAmount),
      houseRep: formatMoney(houseRepAmount),
      subagent: formatMoney(subagentAmount),
      total: formatMoney(totalAmount)
    }
  })()

  const formatDiff = (value: number | null): string => {
    if (value === null) return "--"
    if (!Number.isFinite(value) || value === 0) return "$0.00"
    const formatted = formatMoney(Math.abs(value))
    return value > 0 ? `+${formatted}` : `-${formatted}`
  }

  const formatPercentDiff = (value: number | null): string => {
    if (value === null) return "--"
    if (!Number.isFinite(value) || value === 0) return "0.00%"
    const formatter = new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    const formatted = formatter.format(Math.abs(value))
    return value > 0 ? `+${formatted}` : `-${formatted}`
  }

  const usageDiffClass =
    usageDifferenceNumber === null
      ? "text-gray-500"
      : usageDifferenceNumber === 0
        ? "text-gray-800"
        : usageDifferenceNumber > 0
          ? "text-green-700"
          : "text-red-700"
  const commissionDiffClass =
    commissionDifferenceNumber === null
      ? "text-gray-500"
      : commissionDifferenceNumber === 0
      ? "text-gray-800"
      : commissionDifferenceNumber > 0
        ? "text-green-700"
        : "text-red-700"
  const commissionRateDiffClass =
    commissionRateDifferenceNumber === null
      ? "text-gray-500"
      : commissionRateDifferenceNumber === 0
      ? "text-gray-800"
      : commissionRateDifferenceNumber > 0
        ? "text-green-700"
        : "text-red-700"

  return (
    <section className="bg-white">
      <button
        type="button"
        onClick={() => setCollapsed(previous => !previous)}
        className="flex w-full items-center px-3 py-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="mr-2 text-xs text-gray-500">
            {collapsed ? "▸" : "▾"}
          </span>
          <span className="text-[12px] font-semibold uppercase tracking-wide text-blue-600">
            Financial Summary
          </span>
        </div>
        <span className="hidden text-[10px] font-medium text-gray-500">
          {collapsed ? "Expand" : "Collapse"}
        </span>
      </button>
      {!collapsed ? (
        <div className="grid grid-cols-1 gap-2 p-1.5 md:grid-cols-3">
          {/* Usage Summary */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-[11px] text-gray-900 flex flex-col" style={{ height: "220px" }}>
            <h3 className="mb-0.5 border-b border-gray-300 pb-0.5 text-[12px] font-semibold text-blue-600">
              Usage Summary
            </h3>
            <div className="flex flex-col flex-1 gap-0.5">
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 text-gray-600">Quantity</span>
                <span className="w-3"></span>
                {enableInlineEditing && quantityField ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <EditableField.Input
                      value={(quantityField.value as string) ?? ""}
                      onChange={quantityField.onChange}
                      onBlur={quantityField.onBlur}
                      placeholder="1"
                      className="w-20 text-right border-b-0"
                    />
                    {errors?.quantity ? <span className="text-[10px] text-red-600">{errors.quantity}</span> : null}
                  </div>
                ) : (
                  <span className="w-20 text-right font-medium text-gray-900">{renderValue(schedule.quantity)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 text-gray-600">Price Per</span>
                <span className="w-3 text-center font-medium text-gray-900">x</span>
                {enableInlineEditing && priceEachField ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <EditableField.Input
                      value={(priceEachField.value as string) ?? ""}
                      onChange={priceEachField.onChange}
                      onBlur={priceEachField.onBlur}
                      placeholder="$500.00"
                      className="w-20 text-right border-b-0"
                    />
                    {errors?.priceEach ? <span className="text-[10px] text-red-600">{errors.priceEach}</span> : null}
                  </div>
                ) : (
                  <span className="w-20 text-right font-medium text-gray-900">{renderValue(schedule.priceEach)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 text-gray-600">Expected Usage Gross</span>
                <span className="w-3 text-center font-medium text-gray-900">=</span>
                <span className="w-20 text-right font-medium text-gray-900">{renderValue(expectedUsageGrossDisplay)}</span>
              </div>
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 text-gray-600">Expected Usage Adjustment</span>
                <span className="w-3 text-center font-medium text-gray-900">+</span>
                {enableInlineEditing && expectedUsageAdjustmentField ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <EditableField.Input
                      value={(expectedUsageAdjustmentField.value as string) ?? ""}
                      onChange={expectedUsageAdjustmentField.onChange}
                      onBlur={expectedUsageAdjustmentField.onBlur}
                      placeholder="$0.00"
                      className="w-20 text-right border-b-0"
                    />
                    {errors?.expectedUsageAdjustment ? (
                      <span className="text-[10px] text-red-600">{errors.expectedUsageAdjustment}</span>
                    ) : null}
                  </div>
                ) : (
                  <span className="w-20 text-right font-medium text-gray-900">{renderValue(schedule.expectedUsageAdjustment)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 rounded bg-gray-100 -mx-1 px-1 py-0.5 min-h-[18px]">
                <span className="flex-1 font-bold text-gray-700">Expected Usage Net</span>
                <span className="w-3 text-center font-bold text-gray-900">=</span>
                <span className="w-20 text-right font-bold text-gray-900">{renderValue(expectedUsageNetDisplay)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 border-t border-gray-300 pt-0.5 min-h-[18px]">
                <span className="flex-1 text-blue-600">Actual Usage</span>
                <span className="w-3"></span>
                <button
                  type="button"
                  onClick={() => onOpenSection?.("transactions")}
                  className="w-20 text-right font-medium text-blue-600"
                >
                  {renderValue(schedule.actualUsage)}
                </button>
              </div>
              <div className="mt-auto flex items-center gap-1 rounded bg-gray-100 -mx-1 px-1 py-0.5 pt-0.5 border-t border-gray-300 min-h-[18px]">
                <span className="flex-1 font-bold text-gray-700">Usage Difference (+/-)</span>
                <span className="w-3 text-center font-bold text-gray-900">=</span>
                <span className={cn("w-20 text-right font-bold", usageDiffClass)}>{formatDiff(usageDifferenceNumber)}</span>
              </div>
            </div>
          </div>

          {/* Commission Summary */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-[11px] text-gray-900 flex flex-col" style={{ height: "220px" }}>
            <h3 className="mb-0.5 border-b border-gray-300 pb-0.5 text-[12px] font-semibold text-blue-600">
              Commission Summary
            </h3>
            <div className="flex flex-col flex-1 gap-0.5">
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 text-gray-600">Billing Month</span>
                <span className="w-3"></span>
                <span className="w-20 text-right font-medium text-gray-900">{renderValue(schedule.billingMonth)}</span>
              </div>
              <div className="flex items-center gap-1 pt-0.5 mt-0.5 border-t border-gray-300 min-h-[18px]">
                <span className="flex-1 text-gray-600">Expected Commission</span>
                <span className="w-3"></span>
                <span className="w-20 text-right font-medium text-gray-900">{renderValue(commissionExpectedDisplay)}</span>
              </div>
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 text-gray-600">Expected Commission Adjustment</span>
                <span className="w-3 text-center font-medium text-gray-900">+</span>
                {enableInlineEditing && expectedCommissionAdjustmentField ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <EditableField.Input
                      value={(expectedCommissionAdjustmentField.value as string) ?? ""}
                      onChange={expectedCommissionAdjustmentField.onChange}
                      onBlur={expectedCommissionAdjustmentField.onBlur}
                      placeholder="$0.00"
                      className="w-20 text-right border-b-0"
                    />
                    {errors?.expectedCommissionAdjustment ? (
                      <span className="text-[10px] text-red-600">{errors.expectedCommissionAdjustment}</span>
                    ) : null}
                  </div>
                ) : (
                  <span className="w-20 text-right font-medium text-gray-900">{renderValue(schedule.expectedCommissionAdjustment)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 font-bold text-gray-600">Expected Commission Net</span>
                <span className="w-3"></span>
                <span className="w-20 text-right font-medium text-blue-600">{renderValue(commissionNetDisplay)}</span>
              </div>
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 font-bold text-gray-600">Actual Commission</span>
                <span className="w-3"></span>
                <button
                  type="button"
                  onClick={() => onOpenSection?.("transactions")}
                  className="w-20 text-right font-medium text-blue-600"
                >
                  {renderValue(schedule.actualCommission)}
                </button>
              </div>
              <div className="mt-auto flex items-center gap-1 rounded bg-gray-100 -mx-1 px-1 py-0.5 pt-0.5 border-t border-gray-300 min-h-[18px]">
                <span className="flex-1 font-bold text-gray-700">Commission Difference</span>
                <span className="w-3 text-center font-bold text-gray-900">=</span>
                <span className={cn("w-20 text-right font-bold", commissionDiffClass)}>{formatDiff(commissionDifferenceNumber)}</span>
              </div>
            </div>
          </div>

          {/* Splits */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-[11px] text-gray-900 flex flex-col" style={{ height: "220px" }}>
            <div className="mb-0.5 flex items-center justify-between border-b border-gray-300 pb-0.5 text-[12px]">
              <h3 className="text-[12px] font-semibold text-blue-600">Splits</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSplitMode("percent")}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px]",
                    splitMode === "percent"
                      ? "bg-blue-600 text-white font-medium"
                      : "text-blue-600 hover:bg-blue-100"
                  )}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode("amount")}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px]",
                    splitMode === "amount"
                      ? "bg-blue-600 text-white font-medium"
                      : "text-blue-600 hover:bg-blue-100"
                  )}
                >
                  $
                </button>
              </div>
            </div>
            <div className="flex flex-col flex-1 gap-0.5">
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 text-gray-600">{splitMode === "percent" ? "House Split %" : "House Split"}</span>
                <span className="w-3"></span>
                {enableInlineEditing && splitMode === "percent" && houseSplitField ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <EditableField.Input
                      value={(houseSplitField.value as string) ?? ""}
                      onChange={houseSplitField.onChange}
                      onBlur={houseSplitField.onBlur}
                      placeholder="20%"
                      className="w-20 text-right border-b-0"
                    />
                    {errors?.houseSplitPercent ? (
                      <span className="text-[10px] text-red-600">{errors.houseSplitPercent}</span>
                    ) : null}
                  </div>
                ) : (
                  <span className="w-20 text-right font-medium text-gray-900">{renderValue(splitsDisplay.house)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 text-gray-600">{splitMode === "percent" ? "House Rep Split %" : "House Rep Split"}</span>
                <span className="w-3 text-center font-medium text-gray-900">+</span>
                {enableInlineEditing && splitMode === "percent" && houseRepSplitField ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <EditableField.Input
                      value={(houseRepSplitField.value as string) ?? ""}
                      onChange={houseRepSplitField.onChange}
                      onBlur={houseRepSplitField.onBlur}
                      placeholder="30%"
                      className="w-20 text-right border-b-0"
                    />
                    {errors?.houseRepSplitPercent ? (
                      <span className="text-[10px] text-red-600">{errors.houseRepSplitPercent}</span>
                    ) : null}
                  </div>
                ) : (
                  <span className="w-20 text-right font-medium text-gray-900">{renderValue(splitsDisplay.houseRep)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 text-gray-600">{splitMode === "percent" ? "Subagent Split %" : "Subagent Split"}</span>
                <span className="w-3 text-center font-medium text-gray-900">+</span>
                {enableInlineEditing && splitMode === "percent" && subagentSplitField ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <EditableField.Input
                      value={(subagentSplitField.value as string) ?? ""}
                      onChange={subagentSplitField.onChange}
                      onBlur={subagentSplitField.onBlur}
                      placeholder="50%"
                      className="w-20 text-right border-b-0"
                    />
                    {errors?.subagentSplitPercent ? (
                      <span className="text-[10px] text-red-600">{errors.subagentSplitPercent}</span>
                    ) : null}
                  </div>
                ) : (
                  <span className="w-20 text-right font-medium text-gray-900">{renderValue(splitsDisplay.subagent)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 rounded bg-gray-100 -mx-1 px-1 py-0.5 min-h-[18px]">
                <span className="flex-1 font-bold text-gray-700">{splitMode === "percent" ? "Total Split %" : "Total Split"}</span>
                <span className="w-3 text-center font-bold text-gray-900">=</span>
                <span className="w-20 text-right font-bold text-gray-900">{renderValue(splitsDisplay.total)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 border-t border-gray-300 pt-0.5 min-h-[18px]">
                <span className="flex-1 text-gray-600">Expected Rate %</span>
                <span className="w-3"></span>
                {enableInlineEditing && expectedRateField ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <EditableField.Input
                      value={(expectedRateField.value as string) ?? ""}
                      onChange={expectedRateField.onChange}
                      onBlur={expectedRateField.onBlur}
                      placeholder="12.50%"
                      className="w-20 text-right border-b-0"
                    />
                    {errors?.expectedCommissionRatePercent ? (
                      <span className="text-[10px] text-red-600">{errors.expectedCommissionRatePercent}</span>
                    ) : null}
                  </div>
                ) : (
                  <span className="w-20 text-right font-medium text-gray-900">{renderValue(schedule.expectedCommissionRatePercent)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 min-h-[18px]">
                <span className="flex-1 text-blue-600">Actual Rate %</span>
                <span className="w-3"></span>
                <button
                  type="button"
                  onClick={() => onOpenSection?.("transactions")}
                  className="w-20 text-right font-medium text-blue-600"
                >
                  {renderValue(schedule.actualCommissionRatePercent)}
                </button>
              </div>
              <div className="mt-auto flex items-center gap-1 rounded bg-gray-100 -mx-1 px-1 py-0.5 pt-0.5 border-t border-gray-300 min-h-[18px]">
                <span className="flex-1 font-bold text-gray-700">Commission Rate Difference</span>
                <span className="w-3 text-center font-bold text-gray-900">=</span>
                <span className={cn("w-20 text-right font-bold", commissionRateDiffClass)}>{formatPercentDiff(commissionRateDifferenceNumber)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function RevenueScheduleDetailsView({
  schedule,
  loading = false,
  error,
  scheduleKey,
  onRefresh,
  supportingDetailsV2 = false
}: RevenueScheduleDetailsViewProps) {
  const { hasPermission } = useAuth()
  const { showSuccess, showError } = useToasts()
  const supportingDetailsRef = useRef<RevenueScheduleSupportingDetailsHandle | null>(null)
  const enableInlineEditing = hasPermission("revenue-schedules.manage")
  const canCreateTickets = hasPermission("tickets.create")

  const inlineInitial = useMemo(() => mapDetailToInline(schedule), [schedule])
  const validateInline = useCallback((draft: RevenueScheduleInlineForm) => {
    const errors: Record<string, string> = {}

    const parseNumberInput = (value: string): number | null => {
      const cleaned = value.replace(/[^0-9.-]/g, "")
      const numeric = Number(cleaned)
      return Number.isFinite(numeric) ? numeric : null
    }

    const parsePercentInput = (value: string): number | null => {
      const raw = value.trim()
      if (!raw) return null
      if (raw.endsWith("%")) {
        const num = Number(raw.slice(0, -1).trim())
        return Number.isFinite(num) ? num : null
      }
      const num = Number(raw.replace(/[^0-9.-]/g, ""))
      if (!Number.isFinite(num)) return null
      // Allow "0.05" to mean 5%
      return num <= 1 ? num * 100 : num
    }

    if (!draft.revenueScheduleName || draft.revenueScheduleName.trim().length === 0) {
      errors.revenueScheduleName = "Revenue schedule name is required."
    }
    if (draft.revenueScheduleDate) {
      const trimmed = draft.revenueScheduleDate.trim()
      const isoPattern = /^\d{4}-\d{2}-\d{2}$/
      if (!isoPattern.test(trimmed)) {
        errors.revenueScheduleDate = "Use YYYY-MM-DD format."
      } else {
        const parsed = new Date(trimmed)
        if (Number.isNaN(parsed.getTime())) {
          errors.revenueScheduleDate = "Invalid date."
        }
      }
    }

    if (typeof draft.quantity === "string" && draft.quantity.trim().length > 0) {
      const parsed = parseNumberInput(draft.quantity)
      if (parsed === null) {
        errors.quantity = "Enter a valid number."
      } else if (parsed < 0) {
        errors.quantity = "Quantity must be 0 or greater."
      }
    }

    if (typeof draft.priceEach === "string" && draft.priceEach.trim().length > 0) {
      const parsed = parseNumberInput(draft.priceEach)
      if (parsed === null) {
        errors.priceEach = "Enter a valid amount."
      } else if (parsed < 0) {
        errors.priceEach = "Price per must be 0 or greater."
      }
    }

    if (typeof draft.expectedUsageAdjustment === "string" && draft.expectedUsageAdjustment.trim().length > 0) {
      const parsed = parseNumberInput(draft.expectedUsageAdjustment)
      if (parsed === null) {
        errors.expectedUsageAdjustment = "Enter a valid amount."
      }
    }

    if (
      typeof draft.expectedCommissionAdjustment === "string" &&
      draft.expectedCommissionAdjustment.trim().length > 0
    ) {
      const parsed = parseNumberInput(draft.expectedCommissionAdjustment)
      if (parsed === null) {
        errors.expectedCommissionAdjustment = "Enter a valid amount."
      }
    }

    if (typeof draft.expectedCommissionRatePercent === "string" && draft.expectedCommissionRatePercent.trim().length > 0) {
      const parsed = parsePercentInput(draft.expectedCommissionRatePercent)
      if (parsed === null) {
        errors.expectedCommissionRatePercent = "Enter a valid percent."
      } else if (parsed < 0 || parsed > 100) {
        errors.expectedCommissionRatePercent = "Expected rate must be between 0 and 100."
      }
    }

    const splitInputs: Array<[keyof RevenueScheduleInlineForm, string | undefined]> = [
      ["houseSplitPercent", draft.houseSplitPercent],
      ["houseRepSplitPercent", draft.houseRepSplitPercent],
      ["subagentSplitPercent", draft.subagentSplitPercent]
    ]
    const splitPercents = splitInputs.map(([key, value]) => {
      if (typeof value !== "string" || value.trim().length === 0) return { key, value: null }
      return { key, value: parsePercentInput(value) }
    })

    const anySplitTouched = splitInputs.some(([, value]) => typeof value === "string" && value.trim().length > 0)
    if (anySplitTouched) {
      for (const split of splitPercents) {
        if (split.value === null) {
          errors[String(split.key)] = "Enter a valid percent."
          continue
        }
        if (split.value < 0 || split.value > 100) {
          errors[String(split.key)] = "Split percent must be between 0 and 100."
        }
      }

      const total = splitPercents.reduce((sum, item) => sum + (item.value ?? 0), 0)
      if (Number.isFinite(total) && Math.abs(total - 100) > 0.01) {
        const message = "Split total must equal 100%."
        errors.houseSplitPercent = errors.houseSplitPercent ?? message
        errors.houseRepSplitPercent = errors.houseRepSplitPercent ?? message
        errors.subagentSplitPercent = errors.subagentSplitPercent ?? message
      }
    }
    return errors
  }, [])

  const submitInline = useCallback(
    async (_patch: Partial<RevenueScheduleInlineForm>, draft: RevenueScheduleInlineForm) => {
      if (!schedule?.id) {
        throw new Error("Revenue schedule id is required")
      }
      const payload: any = {
        revenueScheduleName: draft.revenueScheduleName?.trim(),
        revenueScheduleDate: draft.revenueScheduleDate?.trim(),
        quantity: draft.quantity?.trim(),
        priceEach: draft.priceEach?.trim(),
        expectedUsageAdjustment: draft.expectedUsageAdjustment?.trim(),
        expectedCommissionAdjustment: draft.expectedCommissionAdjustment?.trim(),
        expectedCommissionRatePercent: (draft as any).expectedCommissionRatePercent?.trim?.(),
        houseSplitPercent: (draft as any).houseSplitPercent?.trim?.(),
        houseRepSplitPercent: (draft as any).houseRepSplitPercent?.trim?.(),
        subagentSplitPercent: (draft as any).subagentSplitPercent?.trim?.(),
        comments: draft.comments?.trim()
      }
      const response = await fetch(`/api/revenue-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const message = body?.error ?? "Failed to update revenue schedule"
        const serverErrors = (body?.errors ?? {}) as Record<string, string>
        showError("Unable to update revenue schedule", message)
        const error = new Error(message) as Error & { serverErrors?: Record<string, string> }
        if (serverErrors && Object.keys(serverErrors).length > 0) {
          error.serverErrors = serverErrors
        }
        throw error
      }
      await onRefresh?.()
      return draft
    },
    [schedule?.id, onRefresh, showError]
  )

  const editor = useEntityEditor<RevenueScheduleInlineForm>({
    initial: enableInlineEditing ? inlineInitial : null,
    validate: enableInlineEditing ? validateInline : undefined,
    onSubmit: enableInlineEditing ? submitInline : undefined
  })

  useUnsavedChangesPrompt(enableInlineEditing && editor.isDirty)

  const nameField = enableInlineEditing ? editor.register("revenueScheduleName") : null
  const dateField = enableInlineEditing ? editor.register("revenueScheduleDate") : null
  const quantityField = enableInlineEditing ? editor.register("quantity") : null
  const priceEachField = enableInlineEditing ? editor.register("priceEach") : null
  const expectedUsageAdjustmentField = enableInlineEditing ? editor.register("expectedUsageAdjustment") : null
  const expectedCommissionAdjustmentField = enableInlineEditing ? editor.register("expectedCommissionAdjustment") : null
  const expectedRateField = enableInlineEditing ? editor.register("expectedCommissionRatePercent" as any) : null
  const houseSplitField = enableInlineEditing ? editor.register("houseSplitPercent" as any) : null
  const houseRepSplitField = enableInlineEditing ? editor.register("houseRepSplitPercent" as any) : null
  const subagentSplitField = enableInlineEditing ? editor.register("subagentSplitPercent" as any) : null
  const commentsField = enableInlineEditing ? editor.register("comments") : null
  // derive display values from editor when enabled
  const baseScheduleName = schedule ? (schedule.revenueScheduleName ?? schedule.revenueSchedule ?? `Schedule #${schedule.id}`) : ""
  const scheduleName =
    enableInlineEditing && typeof nameField?.value === "string" && (nameField.value as string).length > 0
      ? (nameField.value as string)
      : baseScheduleName
  const scheduleDate = enableInlineEditing && typeof dateField?.value === "string" ? (dateField.value as string) : schedule?.revenueScheduleDate ?? ""

  const handleSave = useCallback(async () => {
    if (!enableInlineEditing) return
    try {
      const result = await editor.submit()
      if (result) {
        showSuccess("Revenue schedule updated", "Changes saved.")
        // Best-effort refresh
        try { onRefresh && (await onRefresh()) } catch {}
      }
    } catch (error) {
      if (error && typeof error === "object" && "serverErrors" in error) {
        editor.setErrors((error as { serverErrors?: Record<string, string> }).serverErrors ?? {})
      } else {
        showError("Unable to update revenue schedule", error instanceof Error ? error.message : "")
      }
    }
  }, [editor, enableInlineEditing, onRefresh, showError, showSuccess])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
          <span className="text-sm font-medium text-gray-700">Loading revenue schedule...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex max-w-lg items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Unable to load revenue schedule</p>
            <p className="mt-1 text-red-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!schedule) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
          <AlertCircle className="h-8 w-8 text-gray-400" />
          <div className="space-y-1">
            <p className="text-lg font-semibold text-gray-900">Revenue schedule not found</p>
            <p className="text-sm text-gray-600">
              <span>We could not locate a revenue schedule matching&nbsp;</span>
              <span className="font-semibold text-gray-800">{scheduleKey ?? "unknown"}</span>
              <span>. Return to the list to pick another record.</span>
            </p>
          </div>
          <Link
            href="/revenue-schedules"
            className="inline-flex items-center rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            Back to Revenue Schedules
          </Link>
        </div>
      </div>
    )
  }

  // scheduleName derived above to reflect inline edits
  const statusPillClass =
    schedule.scheduleStatus?.toLowerCase() === "reconciled"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : schedule.scheduleStatus?.toLowerCase() === "in dispute"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-blue-100 text-blue-700 border-blue-200"

  const disputePillClass = schedule.inDispute ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"

  const revenueMonth = schedule.revenueMonth ?? (schedule.revenueScheduleDate ? schedule.revenueScheduleDate.slice(0, 7) : null)
  const productNameHouse = schedule.productNameHouse ?? null
  const opportunityOwnerName = schedule.opportunityOwnerName ?? null

  const opportunityValue =
    schedule.opportunityId &&
    schedule.opportunityName &&
    typeof schedule.opportunityId === "string" &&
    UUID_REGEX.test(schedule.opportunityId) ? (
      <Link
        href={`/opportunities/${schedule.opportunityId}`}
        className="block w-full min-w-0 truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none no-underline"
      >
        <span className="block w-full truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none">
          {schedule.opportunityName}
        </span>
      </Link>
    ) : (
      schedule.opportunityName
    )

  const columnOne: FieldDefinition[] = [
    { fieldId: "04.01.000", label: "Revenue Schedule Name", value: scheduleName },
    { fieldId: "04.01.001", label: "Revenue Schedule Date", value: scheduleDate },
    { fieldId: "04.01.007", label: "Opportunity", value: opportunityValue },
    { fieldId: "revenueMonth", label: "Revenue Month", value: revenueMonth ?? undefined },
    {
      fieldId: "productNameHouse",
      label: "Product Name - House",
      value: productNameHouse ?? undefined
    },
    { fieldId: "opportunityOwnerName", label: "Opportunity Owner", value: opportunityOwnerName ?? undefined },
  ]

  const columnTwo: FieldDefinition[] = [
    {
      fieldId: "04.01.020",
      label: "Subagent",
      value: schedule.subagentName
    },
    {
      fieldId: "04.01.021",
      label: "House Rep",
      value: schedule.houseRepName
    },
    {
      fieldId: "04.01.008",
      label: "Distributor",
      value:
        schedule.distributorId &&
        schedule.distributorName &&
        UUID_REGEX.test(schedule.distributorId) ? (
          <Link
            href={`/accounts/${schedule.distributorId}`}
            className="block w-full min-w-0 truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none no-underline"
          >
            <span className="block w-full truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none">
              {schedule.distributorName}
            </span>
          </Link>
        ) : (
          schedule.distributorName
        )
    },
    {
      fieldId: "04.01.009",
      label: "Vendor",
      value:
        schedule.vendorId &&
        schedule.vendorName &&
        UUID_REGEX.test(schedule.vendorId) ? (
          <Link
            href={`/accounts/${schedule.vendorId}`}
            className="block w-full min-w-0 truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none no-underline"
          >
            <span className="block w-full truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none">
              {schedule.vendorName}
            </span>
          </Link>
        ) : (
          schedule.vendorName
        )
    },
    {
      fieldId: "04.01.034",
      label: "Payment Type",
      value: schedule.paymentType
    },
    {
      fieldId: "comments",
      label: "Comments",
      value: schedule.comments
    }
  ]

  const columnThreeBase: FieldDefinition[] = [
    {
      fieldId: "04.01.010",
      label: "Account Name",
      value:
        schedule.accountId &&
        schedule.accountName &&
        UUID_REGEX.test(schedule.accountId) ? (
          <Link
            href={`/accounts/${schedule.accountId}`}
            className="block w-full min-w-0 truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none no-underline"
          >
            <span className="block w-full truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none">
              {schedule.accountName}
            </span>
          </Link>
        ) : (
          schedule.accountName
        )
    },
    { fieldId: "04.01.011", label: "Account Legal Name", value: schedule.legalName ?? schedule.accountName },
    {
      fieldId: "04.01.012",
      label: "Shipping Address",
      value: schedule.shippingAddress ? (
        <span className="block truncate" title={schedule.shippingAddress}>
          {schedule.shippingAddress}
        </span>
      ) : undefined
    },
    {
      fieldId: "04.01.013",
      label: "Billing Address",
      value: schedule.billingAddress ? (
        <span className="block truncate" title={schedule.billingAddress}>
          {schedule.billingAddress}
        </span>
      ) : undefined
    }
  ]

  const columnThree: FieldDefinition[] = supportingDetailsV2
    ? columnThreeBase
    : [
        ...columnThreeBase,
        { fieldId: "04.01.014", label: "Commission Rate Expected", value: schedule.expectedCommissionRatePercent },
        { fieldId: "04.01.015", label: "Commission Rate Actual", value: schedule.actualCommissionRatePercent },
        { fieldId: "04.01.016", label: "Commission Rate Difference", value: schedule.commissionRateDifference },
        { fieldId: "04.01.017", label: "House Split %", value: schedule.houseSplitPercent },
        { fieldId: "04.01.018", label: "House Rep Split %", value: schedule.houseRepSplitPercent },
        { fieldId: "04.01.019", label: "Subagent Split %", value: schedule.subagentSplitPercent }
      ]

  const topColumns = [columnOne, columnTwo, columnThree]
  const topColumnHeadings = ["Opportunity Overview", "Partner Information", "Additional Details"] as const

  const summaryMetrics: MetricDefinition[] = [
    { fieldId: "04.01.022", label: "Quantity", value: schedule.quantity },
    { fieldId: "04.01.023", label: "Price Each", value: schedule.priceEach },
    { fieldId: "N/A", label: "Usage Gross (Est.)", value: schedule.expectedUsageGross ?? schedule.expectedUsage },
    {
      fieldId: "04.01.024",
      label: "Usage Adjustment",
      value: schedule.expectedUsageAdjustment ?? schedule.expectedUsage
    },
    { fieldId: "04.01.025", label: "Usage Net (Est.)", value: schedule.expectedUsageNet },
    { fieldId: "04.01.026", label: "Usage (Actual)", value: schedule.actualUsage },
    { fieldId: "04.01.027", label: "Usage Balance", value: schedule.usageBalance },
    { fieldId: "04.01.028", label: "Commission Gross (Est.)", value: schedule.expectedCommissionGross },
    { fieldId: "04.01.029", label: "Commission Adjustment", value: schedule.expectedCommissionAdjustment },
    { fieldId: "04.01.030", label: "Commission Net (Est.)", value: schedule.expectedCommissionNet },
    { fieldId: "N/A", label: "Commission (Actual)", value: schedule.actualCommission },
    { fieldId: "N/A", label: "Commission Variance", value: schedule.commissionDifference }
  ]

  const handleOpenSection = (sectionId: string) => {
    supportingDetailsRef.current?.openSection(sectionId)
  }

  return (
    <div className="space-y-0">
      <div className="overflow-y-auto bg-blue-50 h-[300px]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">Revenue Schedule Detail</p>
            <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium", statusPillClass)}>
              {schedule.scheduleStatus ?? "Unknown"}
            </span>
            {schedule.inDispute ? (
              <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium", disputePillClass)}>
                In Dispute
              </span>
            ) : null}
            {enableInlineEditing && editor.isDirty ? (
              <span className="text-xs font-semibold text-amber-700">Unsaved changes</span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {canCreateTickets ? (
              <button
                type="button"
                onClick={() => supportingDetailsRef.current?.openTicketCreateModal()}
                disabled={!schedule}
                className="rounded bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create Ticket
              </button>
            ) : null}
            {enableInlineEditing ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={editor.saving || !editor.isDirty}
                className="flex items-center gap-2 rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editor.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 px-4 py-2 lg:grid-cols-3">
          {topColumns.map((column, index) => (
            <div key={`column-${index}`} className="space-y-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-800">
                {topColumnHeadings[Math.min(index, topColumnHeadings.length - 1)]}
              </p>
              {column.map(field => {
                if (enableInlineEditing && field.fieldId === "04.01.000" && nameField) {
                  return (
                    <EditRow
                      key={`${field.fieldId}-${field.label}`}
                      label="Revenue Schedule Name"
                      control={
                        <EditableField.Input
                          value={(nameField.value as string) ?? ""}
                          onChange={nameField.onChange}
                          onBlur={nameField.onBlur}
                          placeholder="RS-10001"
                        />
                      }
                      error={editor.errors.revenueScheduleName}
                    />
                  )
                }
                if (enableInlineEditing && field.fieldId === "04.01.001" && dateField) {
                  return (
                    <EditRow
                      key={`${field.fieldId}-${field.label}`}
                      label="Revenue Schedule Date"
                      control={
                        <div className="relative">
                          <EditableField.Input
                            type="date"
                            value={(dateField.value as string) ?? ""}
                            onChange={dateField.onChange}
                            onBlur={dateField.onBlur}
                            className="pr-6 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-datetime-edit]:focus:opacity-100"
                            style={{ colorScheme: 'light' } as React.CSSProperties}
                            onFocus={(e) => {
                              e.currentTarget.classList.add('date-input-focused')
                            }}
                          />
                          <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">
                            {(dateField.value as string) || <span className="text-gray-400">YYYY-MM-DD</span>}
                          </span>
                        </div>
                      }
                      error={editor.errors.revenueScheduleDate}
                    />
                  )
                }
                if (enableInlineEditing && field.fieldId === "04.01.014" && expectedRateField) {
                  return (
                    <EditRow
                      key={`${field.fieldId}-${field.label}`}
                      label="Commission Rate Expected"
                      control={
                        <EditableField.Input
                          value={(expectedRateField.value as string) ?? ""}
                          onChange={expectedRateField.onChange}
                          onBlur={expectedRateField.onBlur}
                          placeholder="12.50%"
                        />
                      }
                      error={editor.errors.expectedCommissionRatePercent}
                    />
                  )
                }
                if (enableInlineEditing && field.fieldId === "04.01.017" && houseSplitField) {
                  return (
                    <EditRow
                      key={`${field.fieldId}-${field.label}`}
                      label="House Split %"
                      control={
                        <EditableField.Input
                          value={(houseSplitField.value as string) ?? ""}
                          onChange={houseSplitField.onChange}
                          onBlur={houseSplitField.onBlur}
                          placeholder="20%"
                        />
                      }
                      error={editor.errors.houseSplitPercent}
                    />
                  )
                }
                if (enableInlineEditing && field.fieldId === "04.01.018" && houseRepSplitField) {
                  return (
                    <EditRow
                      key={`${field.fieldId}-${field.label}`}
                      label="House Rep Split %"
                      control={
                        <EditableField.Input
                          value={(houseRepSplitField.value as string) ?? ""}
                          onChange={houseRepSplitField.onChange}
                          onBlur={houseRepSplitField.onBlur}
                          placeholder="30%"
                        />
                      }
                      error={editor.errors.houseRepSplitPercent}
                    />
                  )
                }
                if (enableInlineEditing && field.fieldId === "04.01.019" && subagentSplitField) {
                  return (
                    <EditRow
                      key={`${field.fieldId}-${field.label}`}
                      label="Subagent Split %"
                      control={
                        <EditableField.Input
                          value={(subagentSplitField.value as string) ?? ""}
                          onChange={subagentSplitField.onChange}
                          onBlur={subagentSplitField.onBlur}
                          placeholder="50%"
                        />
                      }
                      error={editor.errors.subagentSplitPercent}
                    />
                  )
                }
                if (enableInlineEditing && field.fieldId === "comments" && commentsField) {
                  return (
                    <EditRow
                      key={`${field.fieldId}-${field.label}`}
                      label="Comments"
                      control={
                        <EditableField.Input
                          value={(commentsField.value as string) ?? ""}
                          onChange={commentsField.onChange}
                          onBlur={commentsField.onBlur}
                          placeholder="Enter comments..."
                        />
                      }
                      error={editor.errors.comments}
                    />
                  )
                }
                return <FieldRow key={`${field.fieldId}-${field.label}`} {...field} />
              })}
            </div>
          ))}
        </div>
      </div>

      {supportingDetailsV2 ? (
        <FinancialSummarySection
          schedule={schedule}
          onOpenSection={handleOpenSection}
          enableInlineEditing={enableInlineEditing}
          errors={editor.errors}
          quantityField={quantityField}
          priceEachField={priceEachField}
          expectedUsageAdjustmentField={expectedUsageAdjustmentField}
          expectedCommissionAdjustmentField={expectedCommissionAdjustmentField}
          expectedRateField={expectedRateField}
          houseSplitField={houseSplitField}
          houseRepSplitField={houseRepSplitField}
          subagentSplitField={subagentSplitField}
        />
      ) : (
        <div className="border-y-2 border-blue-900 bg-blue-100 px-3 py-1.5">
          <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            Schedule Summary
          </h2>
          <div className="flex flex-wrap gap-2">
            {summaryMetrics.map(metric => (
              <MetricTile key={`${metric.fieldId}-${metric.label}`} {...metric} />
            ))}
          </div>
        </div>
      )}

      <RevenueScheduleSupportingDetails
        ref={supportingDetailsRef}
        schedule={schedule}
        enableRedesign={supportingDetailsV2}
        onRefresh={onRefresh}
      />
    </div>
  )
}
