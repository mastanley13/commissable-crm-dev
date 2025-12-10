"use client"

import Link from "next/link"
import { Loader2, AlertCircle } from "lucide-react"
import { useCallback, useMemo, useRef, type ReactNode } from "react"

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
  productNameVendor?: string
  productDescriptionVendor?: string
  productRevenueType?: string
  productRevenueTypeLabel?: string | null
  scheduleStatus?: string
  inDispute?: boolean
  opportunityId?: string | number | null
  opportunityName?: string | null
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

  const fieldBoxClass = `${baseFieldBoxClass} ${fullWidth ? "max-w-[18rem] whitespace-normal break-words" : "max-w-[18rem]"}`

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
    <div className="grid items-center gap-3 sm:grid-cols-[180px,minmax(0,1fr)]">
      <span className={fieldLabelClass}>{label}</span>
      <div className="max-w-[18rem] flex w-full flex-col gap-1">
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
  const supportingDetailsRef = useRef<RevenueScheduleSupportingDetailsHandle | null>(null)
  const enableInlineEditing = hasPermission("revenue-schedules.manage")
  const canCreateTickets = hasPermission("tickets.create")

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

  const submitInline = useCallback(
    async (_patch: Partial<RevenueScheduleInlineForm>, draft: RevenueScheduleInlineForm) => {
      if (!schedule?.id) {
        throw new Error("Revenue schedule id is required")
      }
      const payload: any = {
        revenueScheduleName: draft.revenueScheduleName?.trim(),
        revenueScheduleDate: draft.revenueScheduleDate?.trim(),
        productNameVendor: (draft as any).productNameVendor?.trim?.(),
        productDescriptionVendor: (draft as any).productDescriptionVendor?.trim?.(),
        productRevenueType: (draft as any).productRevenueType?.trim?.(),
        expectedCommissionRatePercent: (draft as any).expectedCommissionRatePercent?.trim?.(),
        houseSplitPercent: (draft as any).houseSplitPercent?.trim?.(),
        houseRepSplitPercent: (draft as any).houseRepSplitPercent?.trim?.(),
        subagentSplitPercent: (draft as any).subagentSplitPercent?.trim?.()
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
  const productNameField = enableInlineEditing ? editor.register("productNameVendor" as any) : null
  const productDescField = enableInlineEditing ? editor.register("productDescriptionVendor" as any) : null
  const productTypeField = enableInlineEditing ? editor.register("productRevenueType" as any) : null
  const expectedRateField = enableInlineEditing ? editor.register("expectedCommissionRatePercent" as any) : null
  const houseSplitField = enableInlineEditing ? editor.register("houseSplitPercent" as any) : null
  const houseRepSplitField = enableInlineEditing ? editor.register("houseRepSplitPercent" as any) : null
  const subagentSplitField = enableInlineEditing ? editor.register("subagentSplitPercent" as any) : null
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

  const productRevenueTypeDisplay =
    schedule.productRevenueTypeLabel ??
    getRevenueTypeLabel(schedule.productRevenueType) ??
    schedule.productRevenueType

  const columnOne: FieldDefinition[] = [
    { fieldId: "04.01.000", label: "Revenue Schedule Name", value: scheduleName },
    { fieldId: "04.01.001", label: "Revenue Schedule Date", value: scheduleDate },
    {
      fieldId: "04.01.002",
      label: "Vendor - Product Name",
      value:
        schedule.productId &&
        schedule.productNameVendor &&
        UUID_REGEX.test(schedule.productId) ? (
          <Link
            href={`/products/${schedule.productId}`}
            className="block w-full min-w-0 truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none no-underline"
          >
            {schedule.productNameVendor}
          </Link>
        ) : (
          schedule.productNameVendor
        )
    },
    { fieldId: "04.01.003", label: "Vendor - Product Description", value: schedule.productDescriptionVendor },
    { fieldId: "04.01.004", label: "Product Revenue Type", value: productRevenueTypeDisplay },
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
            className="block w-full min-w-0 truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none no-underline"
          >
            <span className="block w-full truncate text-primary-700 hover:text-primary-800 focus:text-primary-800 focus:outline-none">
              {schedule.opportunityName}
            </span>
          </Link>
        ) : (
          schedule.opportunityName
        )
    },
    {
      fieldId: "04.01.008",
      label: "Distributor Name",
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
      label: "Vendor Name",
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

  return (
    <div className="space-y-3 p-2">
      <div className="rounded-2xl bg-gray-100 p-3 shadow-sm h-[300px] overflow-y-auto">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">Revenue Schedule Detail</p>
            {enableInlineEditing && editor.isDirty ? (
              <span className="text-[11px] font-semibold text-amber-600">Unsaved changes</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {canCreateTickets ? (
              <button
                type="button"
                onClick={() => supportingDetailsRef.current?.openTicketCreateModal()}
                disabled={!schedule}
                className="flex items-center gap-2 rounded-md border border-primary-600 bg-white px-3 py-1.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create Ticket
              </button>
            ) : null}
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
                if (enableInlineEditing && field.fieldId === "04.01.002" && productNameField) {
                  return (
                    <EditRow
                      key={`${field.fieldId}-${field.label}`}
                      label="Vendor - Product Name"
                      control={
                        <EditableField.Input
                          value={(productNameField.value as string) ?? ""}
                          onChange={productNameField.onChange}
                          onBlur={productNameField.onBlur}
                          placeholder="Product name"
                        />
                      }
                    />
                  )
                }
                if (enableInlineEditing && field.fieldId === "04.01.003" && productDescField) {
                  return (
                    <EditRow
                      key={`${field.fieldId}-${field.label}`}
                      label="Vendor - Product Description"
                      control={
                        <EditableField.Input
                          value={(productDescField.value as string) ?? ""}
                          onChange={productDescField.onChange}
                          onBlur={productDescField.onBlur}
                          placeholder="Description"
                        />
                      }
                    />
                  )
                }
                  if (enableInlineEditing && field.fieldId === "04.01.004" && productTypeField) {
                    return (
                      <EditRow
                        key={`${field.fieldId}-${field.label}`}
                        label="Product Revenue Type"
                        control={
                          <EditableField.Select
                            value={(productTypeField.value as string) ?? ""}
                            onChange={productTypeField.onChange}
                            onBlur={productTypeField.onBlur}
                          >
                            <option value="">Select revenue type</option>
                            {REVENUE_TYPE_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </EditableField.Select>
                        }
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
                    />
                  )
                }
                return <FieldRow key={`${field.fieldId}-${field.label}`} {...field} />
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="border-y-2 border-blue-900 bg-blue-100 px-3 py-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1.5">Schedule Summary</h2>
        <div className="flex flex-wrap gap-2">
          {summaryMetrics.map(metric => (
            <MetricTile key={`${metric.fieldId}-${metric.label}`} {...metric} />
          ))}
        </div>
      </div>

      <RevenueScheduleSupportingDetails ref={supportingDetailsRef} schedule={schedule} />
    </div>
  )
}
