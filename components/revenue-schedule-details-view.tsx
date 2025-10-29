"use client"

import Link from "next/link"
import { Loader2, AlertCircle } from "lucide-react"
import { useCallback, useMemo, type ReactNode } from "react"

import { RevenueScheduleSupportingDetails } from "./revenue-schedule-supporting-details"
import { useEntityEditor } from "@/hooks/useEntityEditor"
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt"
import { useAuth } from "@/lib/auth-context"
import { EditableField } from "./editable-field"
import { useToasts } from "./toast"

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
  productNameVendor?: string
  productDescriptionVendor?: string
  productRevenueType?: string
  scheduleStatus?: string
  inDispute?: boolean
  opportunityId?: string | number | null
  opportunityName?: string | null
  distributorName?: string | null
  vendorName?: string | null
  accountName?: string | null
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
}

interface RevenueScheduleDetailsViewProps {
  schedule: RevenueScheduleDetailRecord | null
  loading?: boolean
  error?: string | null
  scheduleKey?: string
  onRefresh?: () => void
}

const placeholder = <span className="text-gray-400">--</span>
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fieldLabelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap flex items-center"
const baseFieldBoxClass =
  "flex min-h-[28px] w-full items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis"

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

  const fieldBoxClass = `${baseFieldBoxClass} ${fullWidth ? "max-w-full whitespace-normal break-words" : "max-w-[24rem]"}`

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[220px,minmax(0,1fr)]">
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
    <div className="flex min-w-[140px] flex-col gap-0.5 rounded-lg border-2 border-gray-300 bg-white px-2 py-1.5 text-[11px] text-gray-900 shadow-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <div className="text-[11px] font-semibold text-gray-900">{displayValue}</div>
    </div>
  )
}

interface RevenueScheduleInlineForm {
  revenueScheduleName: string
  revenueScheduleDate: string
}

function mapDetailToInline(detail: RevenueScheduleDetailRecord | null): RevenueScheduleInlineForm {
  const name = detail?.revenueScheduleName ?? detail?.revenueSchedule ?? ""
  return {
    revenueScheduleName: name || "",
    revenueScheduleDate: detail?.revenueScheduleDate ?? ""
  }
}

function EditRow({ label, control, error }: { label: string; control: ReactNode; error?: string }) {
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[220px,minmax(0,1fr)]">
      <span className={fieldLabelClass}>{label}</span>
      <div className="max-w-[24rem] flex w-full flex-col gap-1">
        {control}
        {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      </div>
    </div>
  )
}

export function RevenueScheduleDetailsView({
  schedule,
  loading = false,
  error,
  scheduleKey,
  onRefresh
}: RevenueScheduleDetailsViewProps) {
  const { hasPermission } = useAuth()
  const { showSuccess, showError } = useToasts()
  const enableInlineEditing = hasPermission("revenue-schedules.manage")

  const inlineInitial = useMemo(() => mapDetailToInline(schedule), [schedule])
  const validateInline = useCallback((draft: RevenueScheduleInlineForm) => {
    const errors: Record<string, string> = {}
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
    return errors
  }, [])

  const editor = useEntityEditor<RevenueScheduleInlineForm>({
    initial: enableInlineEditing ? inlineInitial : null,
    validate: enableInlineEditing ? validateInline : undefined
  })

  useUnsavedChangesPrompt(enableInlineEditing && editor.isDirty)

  const nameField = enableInlineEditing ? editor.register("revenueScheduleName") : null
  const dateField = enableInlineEditing ? editor.register("revenueScheduleDate") : null
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

  const columnOne: FieldDefinition[] = [
    { fieldId: "04.01.000", label: "Revenue Schedule Name", value: scheduleName },
    { fieldId: "04.01.001", label: "Revenue Schedule Date", value: scheduleDate },
    { fieldId: "04.01.002", label: "Product Name - Vendor", value: schedule.productNameVendor },
    { fieldId: "04.01.003", label: "Product Description - Vendor", value: schedule.productDescriptionVendor },
    { fieldId: "04.01.004", label: "Product Revenue Type", value: schedule.productRevenueType },
    {
      fieldId: "04.01.005",
      label: "Status",
      value: schedule.scheduleStatus ?? "Unknown"
    },
    {
      fieldId: "04.01.006",
      label: "In Dispute",
      value: schedule.inDispute ? "Yes" : "No"
    }
  ]

  const columnTwo: FieldDefinition[] = [
    {
      fieldId: "04.01.007",
      label: "Opportunity Name",
      value:
        schedule.opportunityId &&
        schedule.opportunityName &&
        typeof schedule.opportunityId === "string" &&
        UUID_REGEX.test(schedule.opportunityId) ? (
          <Link
            href={`/opportunities/${schedule.opportunityId}`}
            className="flex w-full items-center justify-between gap-2 text-primary-600 transition hover:text-primary-700"
          >
            <span className="truncate">{schedule.opportunityName}</span>
            <span aria-hidden="true" className="text-xs">-&gt;</span>
          </Link>
        ) : (
          schedule.opportunityName
        )
    },
    { fieldId: "04.01.008", label: "Distributor Name", value: schedule.distributorName },
    { fieldId: "04.01.009", label: "Vendor Name", value: schedule.vendorName },
    { fieldId: "04.01.010", label: "Account Name", value: schedule.accountName },
    { fieldId: "04.01.011", label: "Legal Name", value: schedule.legalName ?? schedule.accountName },
    {
      fieldId: "04.01.012",
      label: "Shipping Address",
      value: schedule.shippingAddress ? (
        <span className="block truncate" title={schedule.shippingAddress}>
          {schedule.shippingAddress}
        </span>
      ) : undefined,
      fullWidth: true
    },
    {
      fieldId: "04.01.013",
      label: "Billing Address",
      value: schedule.billingAddress ? (
        <span className="block truncate" title={schedule.billingAddress}>
          {schedule.billingAddress}
        </span>
      ) : undefined,
      fullWidth: true
    }
  ]

  const columnThree: FieldDefinition[] = [
    { fieldId: "04.01.014", label: "Commission Rate Expected", value: schedule.expectedCommissionRatePercent },
    { fieldId: "04.01.015", label: "Commission Rate Actual", value: schedule.actualCommissionRatePercent },
    { fieldId: "04.01.016", label: "Commission Rate Difference", value: schedule.commissionRateDifference },
    { fieldId: "04.01.017", label: "House Split %", value: schedule.houseSplitPercent },
    { fieldId: "04.01.018", label: "House Rep Split %", value: schedule.houseRepSplitPercent },
    { fieldId: "04.01.019", label: "Subagent Split %", value: schedule.subagentSplitPercent },
    { fieldId: "04.01.020", label: "Subagent", value: schedule.subagentName }
  ]

  const topColumns = [columnOne, columnTwo, columnThree]

  const summaryMetrics: MetricDefinition[] = [
    { fieldId: "04.01.021", label: "Revenue Schedule Name", value: scheduleName },
    { fieldId: "04.01.022", label: "Quantity", value: schedule.quantity },
    { fieldId: "04.01.023", label: "Price Each", value: schedule.priceEach },
    { fieldId: "N/A", label: "Expected Usage Gross", value: schedule.expectedUsageGross ?? schedule.expectedUsage },
    {
      fieldId: "04.01.024",
      label: "Expected Usage Adjustment",
      value: schedule.expectedUsageAdjustment ?? schedule.expectedUsage
    },
    { fieldId: "04.01.025", label: "Expected Usage Net", value: schedule.expectedUsageNet },
    { fieldId: "04.01.026", label: "Actual Usage", value: schedule.actualUsage },
    { fieldId: "04.01.027", label: "Usage Balance", value: schedule.usageBalance },
    { fieldId: "04.01.028", label: "Expected Commission Gross", value: schedule.expectedCommissionGross },
    { fieldId: "04.01.029", label: "Expected Commission Adjustment", value: schedule.expectedCommissionAdjustment },
    { fieldId: "04.01.030", label: "Expected Commission Net", value: schedule.expectedCommissionNet },
    { fieldId: "N/A", label: "Commission Actual", value: schedule.actualCommission },
    { fieldId: "N/A", label: "Commission Difference", value: schedule.commissionDifference }
  ]

  return (
    <div className="space-y-3 p-2">
      <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Revenue Schedule Detail</p>
            {enableInlineEditing && editor.isDirty ? (
              <span className="text-[11px] font-semibold text-amber-600">Unsaved changes</span>
            ) : null}
          </div>
          {enableInlineEditing ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={editor.saving || !editor.isDirty}
              className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editor.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
            </button>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {topColumns.map((column, index) => (
            <div key={`column-${index}`} className="space-y-1.5">
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
                        <EditableField.Input
                          type="date"
                          value={(dateField.value as string) ?? ""}
                          onChange={dateField.onChange}
                          onBlur={dateField.onBlur}
                        />
                      }
                      error={editor.errors.revenueScheduleDate}
                    />
                  )
                }
                return <FieldRow key={`${field.fieldId}-${field.label}`} {...field} />
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Schedule Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-2 rounded-2xl bg-gray-100 p-2 shadow-sm">
            {summaryMetrics.map(metric => (
              <MetricTile key={`${metric.fieldId}-${metric.label}`} {...metric} />
            ))}
          </div>
        </div>
      </div>

      <RevenueScheduleSupportingDetails schedule={schedule} />
    </div>
  )
}
