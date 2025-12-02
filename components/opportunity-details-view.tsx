"use client"

import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Copy, Loader2, Trash2, Calendar, Download, ToggleLeft, ToggleRight } from "lucide-react"
import { LeadSource, OpportunityStage, OpportunityStatus } from "@prisma/client"
import { cn } from "@/lib/utils"
import { ListHeader, type ColumnFilter } from "@/components/list-header"
import { ColumnChooserModal } from "@/components/column-chooser-modal"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import { DynamicTable, type Column } from "@/components/dynamic-table"
import { applySimpleFilters } from "@/lib/filter-utils"
import { EditableField } from "@/components/editable-field"
import { useEntityEditor, type EntityEditor } from "@/hooks/useEntityEditor"
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt"
import { useFieldHistory } from "@/hooks/useFieldHistory"
import { calculateMinWidth } from "@/lib/column-width-utils"
import { DEFAULT_OPEN_ACTIVITY_STATUS } from "@/lib/activity-status"
import {
  OpportunityDetailRecord,
  OpportunityActivityRecord,
  OpportunityLineItemRecord,
  OpportunityRevenueScheduleRecord,
  HistoryRow,
  MOCK_HISTORY_ROWS
} from "./opportunity-types"
import { OpportunityLineItemCreateModal } from "./opportunity-line-item-create-modal"
import { OpportunityLineItemEditModal } from "./opportunity-line-item-edit-modal"
import { ActivityNoteCreateModal } from "./activity-note-create-modal"
import { ActivityNoteEditModal } from "./activity-note-edit-modal"
import { ActivityBulkOwnerModal } from "./activity-bulk-owner-modal"
import { ActivityBulkStatusModal } from "./activity-bulk-status-modal"
import { ConfirmDialog } from "./confirm-dialog"
import { RevenueScheduleCreateModal } from "./revenue-schedule-create-modal"
import { useAuth } from "@/lib/auth-context"
import { useToasts } from "@/components/toast"
import { OpportunityRoleCreateModal } from "./opportunity-role-create-modal"
import { getOpportunityStageLabel, getOpportunityStageOptions, isOpportunityStageAutoManaged, isOpportunityStageValue, type OpportunityStageOption } from "@/lib/opportunity-stage"
import { getRevenueTypeLabel } from "@/lib/revenue-types"
import { StatusFilterDropdown } from "@/components/status-filter-dropdown"
import { AuditHistoryTab } from "./audit-history-tab"
import { buildStandardBulkActions } from "@/components/standard-bulk-actions"
import type { BulkActionsGridProps } from "@/components/bulk-actions-grid"
import { RevenueScheduleCloneModal } from "@/components/revenue-schedule-clone-modal"

// Helper function to parse currency values
const parseCurrency = (val: any): number => {
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const cleaned = val.replace(/[$,]/g, "")
    const num = parseFloat(cleaned)
    return Number.isNaN(num) ? 0 : num
  }
  return 0
}

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap"
const fieldBoxClass =
  "flex min-h-[28px] w-full min-w-0 max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent pl-[3px] pr-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis tabular-nums"

type RevenueEditableColumnId = "quantity" | "unitPrice" | "expectedUsageAdjustment" | "expectedCommissionRatePercent"

type RevenueFillDownPrompt = {
  columnId: RevenueEditableColumnId
  label: string
  value: number
  rowId: string
  selectedCount: number
  anchor: { top: number; left: number }
}

const PRODUCT_FILTER_COLUMNS: Array<{ id: string; label: string }> = [
  { id: "productName", label: "Product Name" },
  { id: "productCode", label: "Product Code" },
  { id: "revenueType", label: "Revenue Type" },
  { id: "distributorName", label: "Distributor" },
  { id: "vendorName", label: "Vendor" }
]

const ACTIVITY_FILTER_COLUMNS: Array<{ id: string; label: string }> = [
  { id: "activityDate", label: "Activity Date" },
  { id: "activityType", label: "Activity Type" },
  { id: "activityStatus", label: "Activity Status" },
  { id: "description", label: "Description" },
  { id: "activityOwner", label: "Activity Owner" },
  { id: "createdBy", label: "Created By" }
]

export const ACTIVITY_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: calculateMinWidth({ label: "Select All", type: "multi-action", sortable: false }),
    maxWidth: 240,
    type: "multi-action",
    hideable: false
  },
  {
    id: "id",
    label: "Activity ID",
    width: 180,
    minWidth: calculateMinWidth({ label: "Activity ID", type: "text", sortable: true }),
    maxWidth: 220,
    accessor: "id",
    sortable: true
  },
  {
    id: "activityDate",
    label: "Activity Date",
    width: 160,
    minWidth: calculateMinWidth({ label: "Activity Date", type: "text", sortable: true }),
    maxWidth: 220,
    accessor: "activityDate",
    sortable: true
  },
  {
    id: "activityType",
    label: "Activity Type",
    width: 160,
    minWidth: calculateMinWidth({ label: "Activity Type", type: "text", sortable: true }),
    maxWidth: 220,
    accessor: "activityType",
    sortable: true
  },
  {
    id: "activityOwner",
    label: "Activity Owner",
    width: 180,
    minWidth: calculateMinWidth({ label: "Activity Owner", type: "text", sortable: true }),
    maxWidth: 240,
    accessor: "activityOwner",
    sortable: true
  },
  {
    id: "description",
    label: "Activity Description",
    width: 260,
    minWidth: calculateMinWidth({ label: "Activity Description", type: "text", sortable: true }),
    maxWidth: 400,
    accessor: "description",
    sortable: true
  },
  {
    id: "activityStatus",
    label: "Activity Status",
    width: 160,
    minWidth: calculateMinWidth({ label: "Activity Status", type: "text", sortable: true }),
    maxWidth: 220,
    accessor: "activityStatus",
    sortable: true
  },
  {
    id: "attachment",
    label: "Attachment",
    width: 140,
    minWidth: calculateMinWidth({ label: "Attachment", type: "text", sortable: true }),
    maxWidth: 200,
    accessor: "attachment",
    sortable: true
  },
  {
    id: "fileName",
    label: "File Name",
    width: 220,
    minWidth: calculateMinWidth({ label: "File Name", type: "text", sortable: true }),
    maxWidth: 280,
    accessor: "fileName",
    sortable: true
  },
  {
    id: "createdBy",
    label: "Created By",
    width: 180,
    minWidth: calculateMinWidth({ label: "Created By", type: "text", sortable: true }),
    maxWidth: 240,
    accessor: "createdBy",
    sortable: true
  }
]

type OwnerOption = { value: string; label: string }

const STAGE_OPTIONS: OpportunityStageOption[] = getOpportunityStageOptions()

const formatStageLabel = (option: OpportunityStageOption) =>
  option.autoManaged ? `${option.label} (auto-managed)` : option.label

const isAutoManagedStageValue = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false
  }
  return isOpportunityStageValue(value) && isOpportunityStageAutoManaged(value)
}

export const PRODUCT_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 140,
    minWidth: calculateMinWidth({ label: "Select All", type: "multi-action", sortable: false }),
    maxWidth: 180,
    type: "multi-action",
    hideable: false
  },
  { id: "productName", label: "Product", width: 240, minWidth: calculateMinWidth({ label: "Product", type: "text", sortable: true }), accessor: "productName", sortable: true },
  { id: "productCode", label: "Product Code", width: 160, minWidth: calculateMinWidth({ label: "Product Code", type: "text", sortable: true }), accessor: "productCode", sortable: true },
  {
    id: "revenueType",
    label: "Revenue Type",
    width: 160,
    minWidth: calculateMinWidth({ label: "Revenue Type", type: "text", sortable: true }),
    accessor: "revenueType",
    sortable: true,
    render: (value: string) => getRevenueTypeLabel(value) ?? value ?? "--"
  },
  { id: "quantity", label: "Quantity", width: 120, minWidth: calculateMinWidth({ label: "Quantity", type: "text", sortable: true }), accessor: "quantity", sortable: true },
  { id: "unitPrice", label: "Unit Price", width: 140, minWidth: calculateMinWidth({ label: "Unit Price", type: "text", sortable: true }), accessor: "unitPrice", sortable: true },
  { id: "expectedRevenue", label: "Expected Revenue", width: 180, minWidth: calculateMinWidth({ label: "Expected Revenue", type: "text", sortable: true }), accessor: "expectedRevenue", sortable: true },
  { id: "expectedCommission", label: "Expected Commission", width: 200, minWidth: calculateMinWidth({ label: "Expected Commission", type: "text", sortable: true }), accessor: "expectedCommission", sortable: true },
  { id: "expectedUsage", label: "Expected Usage", width: 160, minWidth: calculateMinWidth({ label: "Expected Usage", type: "text", sortable: true }), accessor: "expectedUsage", sortable: true },
  { id: "revenueStartDate", label: "Start Date", width: 150, minWidth: calculateMinWidth({ label: "Start Date", type: "text", sortable: true }), accessor: "revenueStartDate", sortable: true },
  { id: "revenueEndDate", label: "End Date", width: 150, minWidth: calculateMinWidth({ label: "End Date", type: "text", sortable: true }), accessor: "revenueEndDate", sortable: true },
  { id: "distributorName", label: "Distributor", width: 200, minWidth: calculateMinWidth({ label: "Distributor", type: "text", sortable: true }), accessor: "distributorName", sortable: true },
  { id: "vendorName", label: "Vendor", width: 200, minWidth: calculateMinWidth({ label: "Vendor", type: "text", sortable: true }), accessor: "vendorName", sortable: true },
  { id: "createdAt", label: "Created", width: 160, minWidth: calculateMinWidth({ label: "Created", type: "text", sortable: true }), accessor: "createdAt", sortable: true },
  { id: "updatedAt", label: "Updated", width: 160, minWidth: calculateMinWidth({ label: "Updated", type: "text", sortable: true }), accessor: "updatedAt", sortable: true }
]

const REVENUE_FILTER_COLUMNS: Array<{ id: string; label: string }> = [
  { id: "productNameVendor", label: "Product Name" },
  { id: "scheduleNumber", label: "Revenue Schedule" },
  { id: "scheduleDate", label: "Schedule Date" },
  { id: "status", label: "Status" },
  { id: "vendorName", label: "Vendor" },
  { id: "distributorName", label: "Distributor" }
]

export const REVENUE_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: calculateMinWidth({ label: "Select All", type: "multi-action", sortable: false }),
    maxWidth: 240,
    type: "multi-action",
    hideable: false
  },
  { id: "productNameVendor", label: "Product Name - Vendor", width: 220, minWidth: calculateMinWidth({ label: "Product Name - Vendor", type: "text", sortable: true }), accessor: "productNameVendor", sortable: true },
  { id: "vendorName", label: "Vendor Name", width: 200, minWidth: calculateMinWidth({ label: "Vendor Name", type: "text", sortable: true }), accessor: "vendorName", sortable: true },
  { id: "distributorName", label: "Distributor Name", width: 200, minWidth: calculateMinWidth({ label: "Distributor Name", type: "text", sortable: true }), accessor: "distributorName", sortable: true },
  { id: "scheduleNumber", label: "Revenue Schedule", width: 180, minWidth: calculateMinWidth({ label: "Revenue Schedule", type: "text", sortable: true }), accessor: "scheduleNumber", sortable: true },
  { id: "scheduleDate", label: "Schedule Date", width: 160, minWidth: calculateMinWidth({ label: "Schedule Date", type: "text", sortable: true }), accessor: "scheduleDate", sortable: true },
  { id: "status", label: "Status", width: 150, minWidth: calculateMinWidth({ label: "Status", type: "text", sortable: true }), accessor: "status", sortable: true },
  { id: "quantity", label: "Quantity", width: 120, minWidth: calculateMinWidth({ label: "Quantity", type: "text", sortable: true }), accessor: "quantity", sortable: true },
  { id: "unitPrice", label: "Price Each", width: 140, minWidth: calculateMinWidth({ label: "Price Each", type: "text", sortable: true }), accessor: "unitPrice", sortable: true },
  { id: "expectedUsageGross", label: "Expected Usage Gross", width: 200, minWidth: calculateMinWidth({ label: "Expected Usage Gross", type: "text", sortable: true }), accessor: "expectedUsageGross", sortable: true },
  { id: "expectedUsageAdjustment", label: "Expected Usage Adjustment", width: 220, minWidth: calculateMinWidth({ label: "Expected Usage Adjustment", type: "text", sortable: true }), accessor: "expectedUsageAdjustment", sortable: true },
  { id: "expectedUsageNet", label: "Expected Usage Net", width: 200, minWidth: calculateMinWidth({ label: "Expected Usage Net", type: "text", sortable: true }), accessor: "expectedUsageNet", sortable: true },
  { id: "actualUsage", label: "Actual Usage", width: 180, minWidth: calculateMinWidth({ label: "Actual Usage", type: "text", sortable: true }), accessor: "actualUsage", sortable: true },
  { id: "usageBalance", label: "Usage Balance", width: 180, minWidth: calculateMinWidth({ label: "Usage Balance", type: "text", sortable: true }), accessor: "usageBalance", sortable: true },
  { id: "expectedCommissionGross", label: "Expected Commission Gross", width: 220, minWidth: calculateMinWidth({ label: "Expected Commission Gross", type: "text", sortable: true }), accessor: "expectedCommissionGross", sortable: true },
  { id: "expectedCommissionAdjustment", label: "Expected Commission Adjustment", width: 240, minWidth: calculateMinWidth({ label: "Expected Commission Adjustment", type: "text", sortable: true }), accessor: "expectedCommissionAdjustment", sortable: true },
  { id: "expectedCommissionNet", label: "Expected Commission Net", width: 220, minWidth: calculateMinWidth({ label: "Expected Commission Net", type: "text", sortable: true }), accessor: "expectedCommissionNet", sortable: true },
  { id: "actualCommission", label: "Actual Commission", width: 200, minWidth: calculateMinWidth({ label: "Actual Commission", type: "text", sortable: true }), accessor: "actualCommission", sortable: true },
  { id: "commissionDifference", label: "Commission Difference", width: 200, minWidth: calculateMinWidth({ label: "Commission Difference", type: "text", sortable: true }), accessor: "commissionDifference", sortable: true },
  { id: "expectedCommissionRatePercent", label: "Expected Commission Rate %", width: 220, minWidth: calculateMinWidth({ label: "Expected Commission Rate %", type: "text", sortable: true }), accessor: "expectedCommissionRatePercent", sortable: true },
  { id: "actualCommissionRatePercent", label: "Actual Commission Rate %", width: 200, minWidth: calculateMinWidth({ label: "Actual Commission Rate %", type: "text", sortable: true }), accessor: "actualCommissionRatePercent", sortable: true },
  { id: "commissionRateDifferencePercent", label: "Commission Rate Difference", width: 220, minWidth: calculateMinWidth({ label: "Commission Rate Difference", type: "text", sortable: true }), accessor: "commissionRateDifferencePercent", sortable: true }
]

const REVENUE_INACTIVE_STATUSES = new Set(["completed", "closed", "inactive", "cancelled"])

const REVENUE_CURRENCY_COLUMN_IDS = new Set([
  "unitPrice",
  "expectedUsageGross",
  "expectedUsageAdjustment",
  "expectedUsageNet",
  "actualUsage",
  "usageBalance",
  "expectedCommissionGross",
  "expectedCommissionAdjustment",
  "expectedCommissionNet",
  "actualCommission",
  "commissionDifference"
])

const REVENUE_PERCENT_COLUMN_IDS = new Set([
  "expectedCommissionRatePercent",
  "actualCommissionRatePercent",
  "commissionRateDifferencePercent"
])

const REVENUE_NUMBER_COLUMN_IDS = new Set(["quantity"])

const ROLE_FILTER_COLUMNS: Array<{ id: string; label: string }> = [
  { id: "role", label: "Role" },
  { id: "fullName", label: "Full Name" },
  { id: "email", label: "Email Address" },
  { id: "workPhone", label: "Work Phone" },
  { id: "mobile", label: "Mobile" }
]

export const ROLE_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: 100,
    maxWidth: 240,
    type: "multi-action",
    hideable: false
  },
  { id: "role", label: "Role", width: 180, minWidth: 150, accessor: "role", sortable: true },
  { id: "fullName", label: "Full Name", width: 220, minWidth: 160, accessor: "fullName", sortable: true },
  { id: "jobTitle", label: "Job Title", width: 180, minWidth: 140, accessor: "jobTitle", sortable: true },
  { id: "email", label: "Email Address", width: 220, minWidth: 180, accessor: "email", sortable: true },
  { id: "workPhone", label: "Work Phone", width: 160, minWidth: 140, accessor: "workPhone" },
  { id: "phoneExtension", label: "Phone Extension", width: 150, minWidth: 120, accessor: "phoneExtension" },
  { id: "mobile", label: "Mobile", width: 160, minWidth: 140, accessor: "mobile" }
]

interface OpportunityRoleRow {
  id: string
  role: string
  fullName: string
  jobTitle: string
  email: string
  workPhone: string
  phoneExtension: string
  mobile: string
  isActive: boolean
}

interface OpportunityActivityRow {
  id: string
  active: boolean
  activityDate?: string | Date | null
  activityType?: string | null
  activityStatus?: string | null
  description?: string | null
  activityOwner?: string | null
  createdBy?: string | null
  attachment: string
  fileName: string | null
  attachments?: OpportunityActivityRecord["attachments"]
}

function SummaryTab({ opportunity }: { opportunity: OpportunityDetailRecord }) {
  const metrics = opportunity.summaryMetrics ?? {}

  const toNumberOrUndefined = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined

  const computeNet = (gross?: number, adjustments?: number) =>
    gross !== undefined && adjustments !== undefined ? gross - adjustments : undefined

  // Fallback helpers: sum across revenue schedules when metrics are missing
  const sumFromSchedules = (key: string): number | undefined => {
    const rows = opportunity?.revenueSchedules
    if (!Array.isArray(rows) || rows.length === 0) return undefined
    const total = rows.reduce((acc: number, row: any) => {
      const v = row?.[key]
      return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0)
    }, 0)
    return Number.isFinite(total) ? total : undefined
  }

  // Derive allocation totals using schedule-level splits if available; otherwise
  // fall back to the opportunity-level split percents.
  const deriveAllocationTotals = (grossKey: string) => {
    const rows = opportunity?.revenueSchedules
    let rep = 0
    let subagent = 0
    let house = 0

    if (Array.isArray(rows) && rows.length > 0) {
      for (const row of rows) {
        const __grossVal: unknown = (row as any)?.[grossKey];
        const gross = typeof __grossVal === "number" ? (__grossVal as number) : 0
        // Accept numbers (0..1 or 0..100), strings like "20%", or undefined
        const parseSplit = (value: unknown): number | null => {
          if (typeof value === "number") {
            // Treat >1 as percentage points
            return value > 1 ? value / 100 : value
          }
          if (typeof value === "string") {
            const trimmed = value.trim()
            if (!trimmed) return null
            const normalized = trimmed.replace(/\s+/g, "").replace(/%$/, "")
            const n = Number(normalized)
            if (!Number.isFinite(n)) return null
            return n > 1 ? n / 100 : n
          }
          return null
        }

        const repPct = parseSplit((row as any)?.houseRepSplitPercent)
        const subPct = parseSplit((row as any)?.subagentSplitPercent)
        const housePct = parseSplit((row as any)?.houseSplitPercent)

        const resolvedRep = repPct ?? normalisePercentValue(opportunity.houseRepPercent) ?? 0
        const resolvedSub = subPct ?? normalisePercentValue(opportunity.subagentPercent) ?? 0
        const resolvedHouse = housePct ?? calculateHouseSplitPercent({
          subagentPercent: opportunity.subagentPercent,
          houseRepPercent: opportunity.houseRepPercent,
          fallbackPercent: opportunity.houseSplitPercent
        }) ?? 0

        rep += gross * resolvedRep
        subagent += gross * resolvedSub
        house += gross * resolvedHouse
      }
      return { rep, subagent, house }
    }

    // No rows: attempt to allocate from metrics if present
    const gross = toNumberOrUndefined((opportunity as any)?.totals?.[grossKey]) ?? 0
    const repPct = normalisePercentValue(opportunity.houseRepPercent) ?? 0
    const subPct = normalisePercentValue(opportunity.subagentPercent) ?? 0
    const housePct = calculateHouseSplitPercent({
      subagentPercent: opportunity.subagentPercent,
      houseRepPercent: opportunity.houseRepPercent,
      fallbackPercent: opportunity.houseSplitPercent
    }) ?? 0
    return {
      rep: gross * repPct,
      subagent: gross * subPct,
      house: gross * housePct
    }
  }

  const expectedUsageGross = toNumberOrUndefined(
    metrics.expectedUsageGrossTotal ?? opportunity.totals.expectedUsageTotal ?? sumFromSchedules("expectedUsageGross")
  )
  const expectedUsageAdjustments = toNumberOrUndefined(
    (metrics.expectedUsageAdjustmentsGrossTotal ?? sumFromSchedules("expectedUsageAdjustment") ?? 0)
  )
  const expectedUsageNet = computeNet(expectedUsageGross, expectedUsageAdjustments)

  const expectedCommissionGross =
    toNumberOrUndefined(
      metrics.expectedCommissionGrossTotal ?? opportunity.totals.expectedCommissionTotal ?? sumFromSchedules("expectedCommissionGross")
    )
  const expectedCommissionAdjustments = toNumberOrUndefined(
    (metrics.expectedCommissionAdjustmentsGrossTotal ?? sumFromSchedules("expectedCommissionAdjustment") ?? 0)
  )
  const expectedCommissionNet = computeNet(expectedCommissionGross, expectedCommissionAdjustments)

  const actualUsageGross = toNumberOrUndefined(metrics.actualUsageGrossTotal ?? sumFromSchedules("actualUsage"))
  const actualUsageAdjustments = toNumberOrUndefined(
    (metrics.actualUsageAdjustmentsGrossTotal ?? sumFromSchedules("actualUsageAdjustment") ?? 0)
  )
  const actualUsageNet = computeNet(actualUsageGross, actualUsageAdjustments)

  const actualCommissionGross = toNumberOrUndefined(
    metrics.actualCommissionGrossTotal ?? sumFromSchedules("actualCommission")
  )
  const actualCommissionAdjustments = toNumberOrUndefined(
    (metrics.actualCommissionAdjustmentsGrossTotal ?? sumFromSchedules("actualCommissionAdjustment") ?? 0)
  )
  const actualCommissionNet = computeNet(actualCommissionGross, actualCommissionAdjustments)

  const remainingUsageGross =
    toNumberOrUndefined(metrics.remainingUsageGrossTotal) ??
    (expectedUsageGross !== undefined && actualUsageGross !== undefined
      ? expectedUsageGross - actualUsageGross
      : undefined)
  const remainingUsageAdjustments =
    toNumberOrUndefined(metrics.remainingUsageAdjustmentsGrossTotal) ??
    (expectedUsageAdjustments !== undefined && actualUsageAdjustments !== undefined
      ? expectedUsageAdjustments - actualUsageAdjustments
      : undefined)
  const remainingUsageNet = computeNet(remainingUsageGross, remainingUsageAdjustments)

  const remainingCommissionGross =
    toNumberOrUndefined(metrics.remainingCommissionGrossTotal) ??
    (expectedCommissionGross !== undefined && actualCommissionGross !== undefined
      ? expectedCommissionGross - actualCommissionGross
      : undefined)
  const remainingCommissionAdjustments =
    toNumberOrUndefined(metrics.remainingCommissionAdjustmentsGrossTotal) ??
    (expectedCommissionAdjustments !== undefined && actualCommissionAdjustments !== undefined
      ? expectedCommissionAdjustments - actualCommissionAdjustments
      : undefined)
  const remainingCommissionNet = computeNet(remainingCommissionGross, remainingCommissionAdjustments)

  // Allocation totals (House Rep, Subagent, House) fallbacks
  const expectedAlloc = deriveAllocationTotals("expectedCommissionGross")
  const actualAlloc = deriveAllocationTotals("actualCommission")
  const remainingAlloc = {
    rep: (expectedAlloc.rep ?? 0) - (actualAlloc.rep ?? 0),
    subagent: (expectedAlloc.subagent ?? 0) - (actualAlloc.subagent ?? 0),
    house: (expectedAlloc.house ?? 0) - (actualAlloc.house ?? 0)
  }

  const formatCurrencyValue = (value: number | undefined) =>
    value === undefined ? "--" : formatCurrency(value)

  const summaryColumns = [
    {
      title: "Expected",
      sections: [
        {
          title: "Usage Summary",
          items: [
            { label: "Expected Usage Gross Total", value: expectedUsageGross },
            { label: "Expected Usage Adjustments Gross Total", value: expectedUsageAdjustments },
            { label: "Expected Usage Gross Net", value: expectedUsageNet }
          ]
        },
        {
          title: "Commission Summary",
          items: [
            { label: "Expected Commission Gross Total", value: expectedCommissionGross },
            { label: "Expected Commission Adjustments Gross Total", value: expectedCommissionAdjustments },
            { label: "Expected Commission Gross Net", value: expectedCommissionNet }
          ]
        },
        {
          title: "Commission Allocation",
          items: [
            { label: "Expected Commission Gross Total House Rep", value: toNumberOrUndefined(metrics.expectedCommissionHouseRepTotal ?? expectedAlloc.rep) },
            { label: "Expected Commission Gross Total Subagent", value: toNumberOrUndefined(metrics.expectedCommissionSubAgentTotal ?? expectedAlloc.subagent) },
            { label: "Expected Commission Gross Total House", value: toNumberOrUndefined(metrics.expectedCommissionHouseTotal ?? expectedAlloc.house) }
          ]
        }
      ]
    },
    {
      title: "Actual",
      sections: [
        {
          title: "Usage Summary",
          items: [
            { label: "Actual Usage Gross Total", value: actualUsageGross },
            { label: "Actual Usage Adjustments Gross Total", value: actualUsageAdjustments },
            { label: "Actual Usage Gross Net", value: actualUsageNet }
          ]
        },
        {
          title: "Commission Summary",
          items: [
            { label: "Actual Commission Gross Total", value: actualCommissionGross },
            { label: "Actual Commission Adjustments Gross Total", value: actualCommissionAdjustments },
            { label: "Actual Commission Gross Net", value: actualCommissionNet }
          ]
        },
        {
          title: "Commission Allocation",
          items: [
            { label: "Actual Commission Gross Total House Rep", value: toNumberOrUndefined(metrics.actualCommissionHouseRepTotal ?? actualAlloc.rep) },
            { label: "Actual Commission Gross Total Subagent", value: toNumberOrUndefined(metrics.actualCommissionSubAgentTotal ?? actualAlloc.subagent) },
            { label: "Actual Commission Gross Total House", value: toNumberOrUndefined(metrics.actualCommissionHouseTotal ?? actualAlloc.house) }
          ]
        }
      ]
    },
    {
      title: "Remaining",
      sections: [
        {
          title: "Usage Summary",
          items: [
            { label: "Remaining Usage Gross Total", value: remainingUsageGross },
            { label: "Remaining Usage Adjustments Gross Total", value: remainingUsageAdjustments },
            { label: "Remaining Usage Gross Net", value: remainingUsageNet }
          ]
        },
        {
          title: "Commission Summary",
          items: [
            { label: "Remaining Commission Gross Total", value: remainingCommissionGross },
            { label: "Remaining Commission Adjustments Gross Total", value: remainingCommissionAdjustments },
            { label: "Remaining Commission Gross Net", value: remainingCommissionNet }
          ]
        },
        {
          title: "Commission Allocation",
          items: [
            { label: "Remaining Commission Gross Total House Rep", value: toNumberOrUndefined(metrics.remainingCommissionHouseRepTotal ?? remainingAlloc.rep) },
            { label: "Remaining Commission Gross Total Subagent", value: toNumberOrUndefined(metrics.remainingCommissionSubAgentTotal ?? remainingAlloc.subagent) },
            { label: "Remaining Commission Gross Total House", value: toNumberOrUndefined(metrics.remainingCommissionHouseTotal ?? remainingAlloc.house) }
          ]
        }
      ]
    }
  ]

  return (
    <div className="space-y-6">


      <div className="grid gap-y-6 gap-x-32 lg:grid-cols-3">
        {summaryColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="space-y-4">
            <h3 className="text-[11px] font-semibold text-gray-900 border-b border-gray-200 pb-2">
              {column.title}
            </h3>
            {column.sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-2">
                <h4 className="text-[11px] font-medium text-gray-700 uppercase tracking-wide">
                  {section.title}
                </h4>
                <div className="space-y-1">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 text-[11px]">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-gray-900 text-right tabular-nums whitespace-nowrap">
                        {formatCurrencyValue(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailsIdentifiersTab({ opportunity }: { opportunity: OpportunityDetailRecord }) {
  const identifiers = opportunity.identifiers ?? {}
  const fields = [
    { label: "Account ID - House", value: identifiers.accountIdHouse },
    { label: "Account ID - Vendor", value: identifiers.accountIdVendor },
    { label: "Account ID - Distributor", value: identifiers.accountIdDistributor },
    { label: "Customer ID - House", value: identifiers.customerIdHouse },
    { label: "Customer ID - Vendor", value: identifiers.customerIdVendor },
    { label: "Customer ID - Distributor", value: identifiers.customerIdDistributor },
    { label: "Location ID", value: identifiers.locationId },
    { label: "Order ID - House", value: identifiers.orderIdHouse },
    { label: "Order ID - Vendor", value: identifiers.orderIdVendor },
    { label: "Order ID - Distributor", value: identifiers.orderIdDistributor },
    { label: "Customer PO #", value: identifiers.customerPurchaseOrder }
  ]

  return (
    <div className="flex flex-col gap-2.5">

      <div className="grid gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:grid-cols-2">
        {fields.map(field => (
          <div key={field.label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{field.label}</p>
              <p className="text-[11px] font-medium text-gray-900 break-all">
                {field.value && String(field.value).trim().length > 0 ? String(field.value) : "--"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--"
  }
  // Use accounting-style negatives with leading minus per spec: -($X.XX)
  const isNegative = value < 0
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(abs)
  return isNegative ? `-(${formatted})` : formatted
}

function normalisePercentValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null
  }
  return value > 1 ? value / 100 : value
}

function formatPercent(value: number | null | undefined): string {
  const normalised = normalisePercentValue(value)
  if (normalised === null) {
    return "--"
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(normalised)
  } catch {
    return `${(normalised * 100).toFixed(2)}%`
  }
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--"
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "--"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "--"
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}/${month}/${day}`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "--"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "--"
  }
  return date.toLocaleString()
}

function humanizeLabel(value: string | null | undefined): string {
  if (!value) {
    return "--"
  }
  if (isOpportunityStageValue(value)) {
    return getOpportunityStageLabel(value)
  }
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}

interface OpportunityInlineForm {
  name: string
  stage: OpportunityStage | ""
  status: OpportunityStatus | ""
  ownerId: string
  estimatedCloseDate: string
  leadSource: LeadSource | ""
  subAgent: string
  referredBy: string
  shippingAddress: string
  billingAddress: string
  subagentPercent: string
  houseRepPercent: string
  houseSplitPercent: string
  description: string
}

function percentToInputString(value: number | null | undefined): string {
  const normalised = normalisePercentValue(value)
  if (normalised === null) return ""
  return `${(normalised * 100).toFixed(2)}%`
}

function inputStringToPercent(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // Accept values like "20", "20.00", "20%", "20.00 %"
  const normalised = trimmed.replace(/\s+/g, "").replace(/%$/, "")
  if (!normalised) return null
  const parsed = Number(normalised)
  if (!Number.isFinite(parsed)) return null
  if (parsed === 0) return 0
  // If user typed 0..100 treat numbers >1 as percentage points
  return parsed > 1 ? parsed / 100 : parsed
}

function calculateHouseSplitPercent({
  subagentPercent,
  houseRepPercent,
  fallbackPercent
}: {
  subagentPercent: number | null | undefined
  houseRepPercent: number | null | undefined
  fallbackPercent?: number | null | undefined
}): number | null {
  const subagent = normalisePercentValue(subagentPercent)
  const houseRep = normalisePercentValue(houseRepPercent)
  const fallback = normalisePercentValue(fallbackPercent)

  if (subagent == null && houseRep == null) {
    if (fallback != null) {
      return fallback
    }
    return 1
  }

  const computed = 1 - ((subagent ?? 0) + (houseRep ?? 0))
  if (!Number.isFinite(computed)) {
    return fallback ?? 1
  }
  const clamped = Math.max(0, Math.min(1, computed))
  return clamped
}

function normaliseStage(stage: string | null | undefined): OpportunityStage | "" {
  if (!stage) return ""
  return Object.values(OpportunityStage).includes(stage as OpportunityStage) ? (stage as OpportunityStage) : ""
}

function normaliseStatus(status: string | null | undefined): OpportunityStatus | "" {
  if (!status) return ""
  return Object.values(OpportunityStatus).includes(status as OpportunityStatus) ? (status as OpportunityStatus) : ""
}

function normaliseLeadSource(source: string | null | undefined): LeadSource | "" {
  if (!source) return ""
  return Object.values(LeadSource).includes(source as LeadSource) ? (source as LeadSource) : ""
}

function formatDateForInput(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}/${month}/${day}`
}

function parseInputDateToISO(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (!match) return null
  const [, y, m, d] = match
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  if (month < 1 || month > 12) return null
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 1 || day > daysInMonth) return null
  // Build ISO-friendly YYYY-MM-DD to avoid locale ambiguity
  return `${y}-${m}-${d}`
}

function createOpportunityInlineForm(detail: OpportunityDetailRecord | null | undefined): OpportunityInlineForm | null {
  if (!detail) return null

  const derivedHouseSplitPercent = calculateHouseSplitPercent({
    subagentPercent: detail.subagentPercent,
    houseRepPercent: detail.houseRepPercent,
    fallbackPercent: detail.houseSplitPercent
  })

  return {
    name: detail.name ?? "",
    stage: normaliseStage(detail.stage),
    status: normaliseStatus(detail.status),
    ownerId: detail.owner?.id ?? "",
    estimatedCloseDate: formatDateForInput(detail.estimatedCloseDate),
    leadSource: normaliseLeadSource(detail.leadSource),
    subAgent: detail.subAgent ?? "",
    referredBy: detail.referredBy ?? "",
    shippingAddress: detail.shippingAddress ?? "",
    billingAddress: detail.billingAddress ?? "",
    subagentPercent: percentToInputString(detail.subagentPercent ?? null),
    houseRepPercent: percentToInputString(detail.houseRepPercent ?? null),
    houseSplitPercent: percentToInputString(derivedHouseSplitPercent),
    description: detail.description ?? ""
  }
}

function buildOpportunityPayload(patch: Partial<OpportunityInlineForm>, draft: OpportunityInlineForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if ("name" in patch) payload.name = draft.name.trim()
  if ("stage" in patch) payload.stage = draft.stage || null
  if ("status" in patch) payload.status = draft.status || null
  if ("ownerId" in patch) payload.ownerId = draft.ownerId || null
  if ("estimatedCloseDate" in patch) {
    const isoLike = parseInputDateToISO(draft.estimatedCloseDate)
    payload.estimatedCloseDate = isoLike || null
  }
  if ("leadSource" in patch) payload.leadSource = draft.leadSource || null
  if ("subAgent" in patch) payload.subAgent = draft.subAgent.trim()
  if ("referredBy" in patch) payload.referredBy = draft.referredBy.trim()
  if ("shippingAddress" in patch) payload.shippingAddress = draft.shippingAddress.trim()
  if ("billingAddress" in patch) payload.billingAddress = draft.billingAddress.trim()
  if ("description" in patch) payload.description = draft.description.trim()
  const parsedSubagentPercent = inputStringToPercent(draft.subagentPercent)
  const parsedHouseRepPercent = inputStringToPercent(draft.houseRepPercent)
  const parsedHouseSplitPercent = inputStringToPercent(draft.houseSplitPercent)
  const derivedHouseSplitPercent = calculateHouseSplitPercent({
    subagentPercent: parsedSubagentPercent,
    houseRepPercent: parsedHouseRepPercent,
    fallbackPercent: parsedHouseSplitPercent
  })

  if ("subagentPercent" in patch) payload.subagentPercent = parsedSubagentPercent
  if ("houseRepPercent" in patch) payload.houseRepPercent = parsedHouseRepPercent
  if ("houseSplitPercent" in patch || "subagentPercent" in patch || "houseRepPercent" in patch) {
    payload.houseSplitPercent = derivedHouseSplitPercent
  }

  return payload
}

function validateOpportunityForm(form: OpportunityInlineForm): Record<string, string> {
  const errors: Record<string, string> = {}

  if (form.name.trim().length < 3) {
    errors.name = "Name must be at least 3 characters."
  }
  if (!form.stage) {
    errors.stage = "Stage is required."
  }
  // Status isn't editable inline yet; allow empty values to pass validation.
  if (!form.ownerId) {
    errors.ownerId = "Owner is required."
  }
  if (!form.estimatedCloseDate) {
    errors.estimatedCloseDate = "Estimated close date is required."
  } else if (!parseInputDateToISO(form.estimatedCloseDate)) {
    errors.estimatedCloseDate = "Enter a valid date in YYYY/MM/DD format."
  }
  if (form.leadSource && !Object.values(LeadSource).includes(form.leadSource as LeadSource)) {
    errors.leadSource = "Select a valid lead source."
  }

  const percentRules: Array<[keyof OpportunityInlineForm, string]> = [
    ["subagentPercent", "Subagent % must be between 0 and 100."],
    ["houseRepPercent", "House Rep % must be between 0 and 100."],
    ["houseSplitPercent", "House Split % must be between 0 and 100."]
  ]

  for (const [field, message] of percentRules) {
    const raw = form[field]
    if (!raw.trim()) continue
    const parsedFraction = inputStringToPercent(raw)
    if (parsedFraction === null || parsedFraction < 0 || parsedFraction > 1) {
      errors[field] = message
    }
  }

  return errors
}

function FieldRow({
  label,
  children,
  lastEdited,
  layout = "fixed",
  compact = false
}: {
  label: string
  children: React.ReactNode
  lastEdited?: { date: string; user: string }
  layout?: "fixed" | "auto"
  compact?: boolean
}) {
  const gridClass = layout === "auto"
    ? "sm:grid-cols-[180px,max-content,max-content]"
    : "sm:grid-cols-[180px,minmax(0,1fr),max-content]"

  return (
    <div
      className={cn(
        "grid w-full items-center",
        gridClass,
        compact ? "gap-x-1.5 gap-y-1.5" : "gap-x-2 gap-y-2"
      )}
    >
      <span className={cn(fieldLabelClass, "flex items-center min-h-[28px]")}>{label}</span>
      <div className="w-full min-w-0">{children}</div>
      {lastEdited ? (
        <span className="text-[10px] text-gray-400 whitespace-nowrap sm:justify-self-start leading-tight">
          Last edited {lastEdited.date} by {lastEdited.user}
        </span>
      ) : (
        <span className="sm:justify-self-start"></span>
      )}
    </div>
  )
}

function getLastEdit(history: HistoryRow[], fieldLabel: string): { date: string; user: string } | undefined {
  const entry = history.find(row => row.field === fieldLabel)
  if (!entry) return undefined
  return {
    date: entry.occurredAt,
    user: entry.userName
  }
}

function OpportunityHeader({
  opportunity,
  history = [],
  onEdit
}: {
  opportunity: OpportunityDetailRecord
  history?: HistoryRow[]
  onEdit?: () => void
}) {
  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
      {/* Header with title and controls */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">Opportunity Detail</p>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Update
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <FieldRow label="Opportunity Name">
            <div className={fieldBoxClass}>
              {opportunity.name || "Untitled Opportunity"}
            </div>
          </FieldRow>
          <FieldRow label="Account Name">
            {opportunity.account ? (
              <Link href={`/accounts/${opportunity.account.id}`} className="block w-full min-w-0">
                <div
                  className={cn(
                    fieldBoxClass,
                    "cursor-pointer text-primary-700 hover:border-primary-500 hover:text-primary-800"
                  )}
                >
                  <span className="truncate">{opportunity.account.accountName}</span>
                </div>
              </Link>
            ) : (
              <div className={fieldBoxClass}>Not linked</div>
            )}
          </FieldRow>
          <FieldRow label="Account Legal Name">
            <div className={fieldBoxClass}>
              {opportunity.account?.accountLegalName || "--"}
            </div>
          </FieldRow>
          <FieldRow label="Subagent">
            <div className={fieldBoxClass}>{opportunity.subAgent || "None"}</div>
          </FieldRow>
          <FieldRow label="Owner">
            <div className={fieldBoxClass}>{opportunity.owner?.name || "--"}</div>
          </FieldRow>
          <FieldRow label="Opportunity Stage">
            <div className={`${fieldBoxClass} gap-2`}>
              <span>{humanizeLabel(opportunity.stage)}</span>
              {typeof opportunity.stage === "string" &&
                isOpportunityStageValue(opportunity.stage) &&
                isOpportunityStageAutoManaged(opportunity.stage) && (
                  <span className="rounded bg-slate-200 px-1.5 text-[10px] font-semibold uppercase text-slate-600">
                    Auto
                  </span>
                )}
            </div>
          </FieldRow>
          <FieldRow label="Estimated Close Date">
            <div className={fieldBoxClass}>{formatDate(opportunity.estimatedCloseDate)}</div>
          </FieldRow>
        </div>
        <div className="space-y-1.5">
          <FieldRow label="Referred By">
            <div className={fieldBoxClass}>{opportunity.referredBy || "None"}</div>
          </FieldRow>
          <FieldRow label="Shipping Address">
            <div className={fieldBoxClass}>
              {opportunity.shippingAddress || "--"}
            </div>
          </FieldRow>
          <FieldRow label="Billing Address">
            <div className={fieldBoxClass}>
              {opportunity.billingAddress || "--"}
            </div>
          </FieldRow>
          <FieldRow label="Subagent %" lastEdited={getLastEdit(history, "Subagent %")} layout="auto">
            <div className={fieldBoxClass}>{formatPercent(opportunity.subagentPercent)}</div>
          </FieldRow>
          <FieldRow label="House Rep %" lastEdited={getLastEdit(history, "House Rep %")} layout="auto">
            <div className={fieldBoxClass}>{formatPercent(opportunity.houseRepPercent)}</div>
          </FieldRow>
          <FieldRow label="House Split %" lastEdited={getLastEdit(history, "House Split %")} layout="auto">
            <div className={fieldBoxClass}>
              {formatPercent(
                calculateHouseSplitPercent({
                  subagentPercent: opportunity.subagentPercent,
                  houseRepPercent: opportunity.houseRepPercent,
                  fallbackPercent: opportunity.houseSplitPercent
                })
              )}
            </div>
          </FieldRow>
          <FieldRow label="Description">
            <div className={fieldBoxClass}>
              {opportunity.description || "--"}
            </div>
          </FieldRow>
        </div>
      </div>
    </div>
  )
}

interface EditableOpportunityHeaderProps {
  opportunity: OpportunityDetailRecord
  editor: EntityEditor<OpportunityInlineForm>
  ownerOptions: OwnerOption[]
  ownersLoading: boolean
  onSave: () => Promise<void>
}

function EditableOpportunityHeader({
  opportunity,
  editor,
  ownerOptions,
  ownersLoading,
  onSave
}: EditableOpportunityHeaderProps) {
  const { fieldHistory } = useFieldHistory('Opportunity', opportunity.id, [
    'subagentPercent',
    'houseRepPercent',
    'houseSplitPercent'
  ])

  const nameField = editor.register("name")
  const stageField = editor.register("stage")
  const ownerField = editor.register("ownerId")
  const closeDateField = editor.register("estimatedCloseDate")
  const leadSourceField = editor.register("leadSource")
  const subAgentField = editor.register("subAgent")
  const referredField = editor.register("referredBy")
  const shippingField = editor.register("shippingAddress")
  const billingField = editor.register("billingAddress")
  const subagentPercentField = editor.register("subagentPercent")
  const houseRepPercentField = editor.register("houseRepPercent")
  const houseSplitPercentField = editor.register("houseSplitPercent")
  const descriptionField = editor.register("description")

  useEffect(() => {
    if (!editor.draft) return

    const subagentInput = typeof subagentPercentField.value === "string" ? subagentPercentField.value.trim() : ""
    const houseRepInput = typeof houseRepPercentField.value === "string" ? houseRepPercentField.value.trim() : ""

    const parsedSubagent = inputStringToPercent(subagentInput)
    const parsedHouseRep = inputStringToPercent(houseRepInput)
    const currentValue = typeof houseSplitPercentField.value === "string" ? houseSplitPercentField.value : ""
    const parsedCurrent = inputStringToPercent(currentValue)
    const computed = calculateHouseSplitPercent({
      subagentPercent: parsedSubagent,
      houseRepPercent: parsedHouseRep,
      fallbackPercent: parsedCurrent
    })

    const targetValue = computed === null ? "" : percentToInputString(computed)

    if (targetValue !== currentValue) {
      editor.setField("houseSplitPercent", targetValue)
    }
  }, [editor, subagentPercentField.value, houseRepPercentField.value, houseSplitPercentField.value])

  void leadSourceField

  const disableSave = editor.saving || !editor.isDirty

  // Native date picker bridge for YYYY/MM/DD text field
  const nativeDateRef = useRef<HTMLInputElement | null>(null)

  const nativeDateValue = useMemo(() => {
    const isoLike = parseInputDateToISO((closeDateField.value as string) ?? "")
    return isoLike ?? ""
  }, [closeDateField.value])

  const openNativeCalendar = useCallback(() => {
    const el = nativeDateRef.current as any
    if (!el) return
    if (typeof el.showPicker === "function") {
      el.showPicker()
    } else {
      el.focus()
      el.click()
    }
  }, [])

  const renderRow = (
    label: string,
    control: ReactNode,
    error?: string
  ) => (
    <FieldRow label={label}>
      <div className="flex flex-col gap-1 w-full max-w-md">
        {control}
        {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      </div>
    </FieldRow>
  )

  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">Opportunity Detail</p>
          {editor.isDirty ? (
            <span className="text-[11px] font-semibold text-amber-600">Unsaved changes</span>
          ) : null}
          {ownersLoading ? <span className="text-[11px] text-gray-500">Loading owners...</span> : null}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={disableSave}
          className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {editor.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          {renderRow(
            "Opportunity Name",
            <EditableField.Input
              className="w-full"
              value={(nameField.value as string) ?? ""}
              onChange={nameField.onChange}
              onBlur={nameField.onBlur}
            />,
            editor.errors.name
          )}

          <FieldRow label="Account Name">
            {opportunity.account ? (
              <Link href={`/accounts/${opportunity.account.id}`} className="block w-full min-w-0">
                <div
                  className={cn(
                    fieldBoxClass,
                    "cursor-pointer text-primary-700 hover:border-primary-500 hover:text-primary-800"
                  )}
                >
                  <span className="truncate">{opportunity.account.accountName}</span>
                </div>
              </Link>
            ) : (
              <div className={fieldBoxClass}>Not linked</div>
            )}
          </FieldRow>

          <FieldRow label="Account Legal Name">
            <div className={fieldBoxClass}>{opportunity.account?.accountLegalName || "--"}</div>
          </FieldRow>

          {renderRow(
            "Subagent",
            <EditableField.Input
              className="w-full"
              value={(subAgentField.value as string) ?? ""}
              onChange={subAgentField.onChange}
              onBlur={subAgentField.onBlur}
            />,
            editor.errors.subAgent
          )}

          {renderRow(
            "Owner",
            <EditableField.Select
              className="w-full"
              value={(ownerField.value as string) ?? ""}
              onChange={ownerField.onChange}
              onBlur={ownerField.onBlur}
              disabled={ownersLoading}
            >
              <option value="">Select owner</option>
              {ownerOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </EditableField.Select>,
            editor.errors.ownerId
          )}

          {renderRow(
            "Opportunity Stage",
            <div className="space-y-1">
              <EditableField.Select
                className="w-full"
                value={(stageField.value as string) ?? ""}
                onChange={stageField.onChange}
                onBlur={stageField.onBlur}
              >
                <option value="">Select stage</option>
                {STAGE_OPTIONS.map(option => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled && option.value !== (stageField.value as string)}
                    title={option.disabledReason}
                  >
                    {formatStageLabel(option)}
                  </option>
                ))}
              </EditableField.Select>
              {isAutoManagedStageValue(stageField.value) && (
                <p className="text-[11px] text-gray-500">
                  Stage updates automatically while products are billing.
                </p>
              )}
            </div>,
            editor.errors.stage
          )}

          {renderRow(
            "Estimated Close Date",
            <div className="relative w-full max-w-md">
              <EditableField.Input
                className="w-full pr-9"
                type="text"
                placeholder="YYYY/MM/DD"
                inputMode="numeric"
                maxLength={10}
                value={(closeDateField.value as string) ?? ""}
                onChange={closeDateField.onChange}
                onBlur={closeDateField.onBlur}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onClick={openNativeCalendar}
                aria-label="Open calendar"
                title="Open calendar"
              >
                <Calendar className="h-4 w-4" />
              </button>
              <input
                ref={nativeDateRef}
                type="date"
                className="sr-only"
                value={nativeDateValue}
                onChange={e => {
                  const iso = e.target.value // YYYY-MM-DD
                  if (!iso) return
                  const [y, m, d] = iso.split('-')
                  const display = `${y}/${m}/${d}`
                  // feed back into editor via onChange shape
                  closeDateField.onChange({ target: { value: display } } as any)
                  // trigger validation on blur
                  closeDateField.onBlur()
                }}
              />
            </div>,
            editor.errors.estimatedCloseDate
          )}
        </div>

        <div className="space-y-1.5">
          <FieldRow label="Referred By" compact>
            <div className="flex flex-col gap-1 w-full max-w-[260px]">
              <EditableField.Input
                className="w-full"
                value={(referredField.value as string) ?? ""}
                onChange={referredField.onChange}
                onBlur={referredField.onBlur}
              />
              {editor.errors.referredBy ? (
                <p className="text-[10px] text-red-600">{editor.errors.referredBy}</p>
              ) : null}
            </div>
          </FieldRow>

          <FieldRow label="Shipping Address" compact>
            <div className="flex flex-col gap-1 w-full max-w-[260px]">
              <EditableField.Input
                className="w-full"
                value={(shippingField.value as string) ?? ""}
                onChange={shippingField.onChange}
                onBlur={shippingField.onBlur}
              />
              {editor.errors.shippingAddress ? (
                <p className="text-[10px] text-red-600">{editor.errors.shippingAddress}</p>
              ) : null}
            </div>
          </FieldRow>

          <FieldRow label="Billing Address" compact>
            <div className="flex flex-col gap-1 w-full max-w-[260px]">
              <EditableField.Input
                className="w-full"
                value={(billingField.value as string) ?? ""}
                onChange={billingField.onChange}
                onBlur={billingField.onBlur}
              />
              {editor.errors.billingAddress ? (
                <p className="text-[10px] text-red-600">{editor.errors.billingAddress}</p>
              ) : null}
            </div>
          </FieldRow>

          {/* Manually render Subagent % */}
          <FieldRow label="Subagent %" lastEdited={fieldHistory['subagentPercent']} layout="auto" compact>
            <div className="flex flex-col gap-1 w-full max-w-[260px]">
              <EditableField.Input
                className="w-full pr-6"
                type="text"
                inputMode="decimal"
                placeholder="0.00%"
                value={(subagentPercentField.value as string) ?? ""}
                onChange={subagentPercentField.onChange}
                onBlur={(e: any) => {
                  const formatted = percentToInputString(inputStringToPercent(String(e.target.value)))
                  editor.setField("subagentPercent", formatted)
                  subagentPercentField.onBlur()
                }}
              />
              {editor.errors.subagentPercent ? <p className="text-[10px] text-red-600">{editor.errors.subagentPercent}</p> : null}
            </div>
          </FieldRow>

          {/* Manually render House Rep % */}
          <FieldRow label="House Rep %" lastEdited={fieldHistory['houseRepPercent']} layout="auto" compact>
            <div className="flex flex-col gap-1 w-full max-w-[260px]">
              <EditableField.Input
                className="w-full pr-6"
                type="text"
                inputMode="decimal"
                placeholder="0.00%"
                value={(houseRepPercentField.value as string) ?? ""}
                onChange={houseRepPercentField.onChange}
                onBlur={(e: any) => {
                  const formatted = percentToInputString(inputStringToPercent(String(e.target.value)))
                  editor.setField("houseRepPercent", formatted)
                  houseRepPercentField.onBlur()
                }}
              />
              {editor.errors.houseRepPercent ? <p className="text-[10px] text-red-600">{editor.errors.houseRepPercent}</p> : null}
            </div>
          </FieldRow>

          {/* Manually render House Split % */}
          <FieldRow label="House Split %" lastEdited={fieldHistory['houseSplitPercent']} layout="auto" compact>
            <div className="flex flex-col gap-1 w-full max-w-[260px]">
              <EditableField.Input
                className="w-full pr-6"
                type="text"
                inputMode="decimal"
                placeholder="0.00%"
                value={(houseSplitPercentField.value as string) ?? ""}
                readOnly
                title="House Split % is auto-calculated."
                onBlur={houseSplitPercentField.onBlur}
              />
              {editor.errors.houseSplitPercent ? <p className="text-[10px] text-red-600">{editor.errors.houseSplitPercent}</p> : null}
            </div>
          </FieldRow>

          <FieldRow label="Description" compact>
            <div className="flex flex-col gap-1 w-full max-w-[260px]">
              <EditableField.Textarea
                className="w-full"
                rows={1}
                value={(descriptionField.value as string) ?? ""}
                onChange={descriptionField.onChange}
                onBlur={descriptionField.onBlur}
              />
              {editor.errors.description ? (
                <p className="text-[10px] text-red-600">{editor.errors.description}</p>
              ) : null}
            </div>
          </FieldRow>
        </div>
      </div>
    </div>
  )
}


export interface OpportunityDetailsViewProps {
  opportunity: OpportunityDetailRecord | null
  loading?: boolean
  error?: string | null
  onEdit?: () => void
  onRefresh?: () => Promise<void> | void
}

type TabKey = "summary" | "roles" | "details" | "products" | "revenue-schedules" | "activities" | "history"

const DETAIL_TABS: { id: TabKey; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "roles", label: "Roles" },
  { id: "details", label: "Details" },
  { id: "products", label: "Products" },
  { id: "revenue-schedules", label: "Revenue Schedules" },
  { id: "activities", label: "Activities & Notes" },
  { id: "history", label: "History" }
]
export function OpportunityDetailsView({
  opportunity,
  loading,
  error,
  onEdit,
  onRefresh
}: OpportunityDetailsViewProps) {
  const { user: authUser, hasPermission, hasAnyPermission } = useAuth()
  const { showError, showSuccess } = useToasts()
  const router = useRouter()
  const searchParams = useSearchParams()
  const opportunityOwnerId = opportunity?.owner?.id
  const opportunityOwnerName = opportunity?.owner?.name

  // Lifted history state
  const [history] = useState<HistoryRow[]>(MOCK_HISTORY_ROWS)

  const getInitialTab = (): TabKey => {
    const tabParam = searchParams?.get("tab")
    const validTabs: TabKey[] = ["summary", "products", "revenue-schedules", "activities", "roles", "details", "history"]
    if (tabParam && validTabs.includes(tabParam as TabKey)) {
      return tabParam as TabKey
    }
    return "products"
  }

  const [activeTab, setActiveTab] = useState<TabKey>(getInitialTab())

  const isAssignedToUser = Boolean(opportunityOwnerId && opportunityOwnerId === authUser?.id)
  const canEditOpportunity =
    hasPermission("accounts.manage") ||
    hasPermission("opportunities.manage") ||
    hasPermission("opportunities.edit.all") ||
    (hasPermission("opportunities.edit.assigned") && isAssignedToUser)
  const shouldEnableInline = canEditOpportunity && Boolean(opportunity)

  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([])
  const [ownersLoading, setOwnersLoading] = useState(false)

  const inlineInitialForm = useMemo(
    () => (shouldEnableInline && opportunity ? createOpportunityInlineForm(opportunity) : null),
    [shouldEnableInline, opportunity]
  )

  const submitOpportunity = useCallback(
    async (patch: Partial<OpportunityInlineForm>, draft: OpportunityInlineForm) => {
      if (!opportunity?.id) {
        throw new Error("Opportunity ID is required")
      }

      const payload = buildOpportunityPayload(patch, draft)
      if (Object.keys(payload).length === 0) {
        return draft
      }

      try {
        const response = await fetch(`/api/opportunities/${opportunity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          const serverErrors = (body?.errors ?? {}) as Record<string, string>
          const message = body?.error ?? "Failed to update opportunity"
          showError("Unable to update opportunity", message)
          const error = new Error(message) as Error & { serverErrors?: Record<string, string> }
          if (serverErrors && Object.keys(serverErrors).length > 0) {
            error.serverErrors = serverErrors
          }
          throw error
        }

        const body = await response.json().catch(() => null)
        const updatedRecord = body?.data as OpportunityDetailRecord | undefined
        showSuccess("Opportunity updated", "Changes saved.")
        await onRefresh?.()
        const nextForm = updatedRecord ? createOpportunityInlineForm(updatedRecord) : null
        return nextForm ?? draft
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error("Failed to update opportunity")
        }
        throw error
      }
    },
    [opportunity?.id, onRefresh, showError, showSuccess]
  )

  const editor = useEntityEditor<OpportunityInlineForm>({
    initial: inlineInitialForm,
    validate: shouldEnableInline ? validateOpportunityForm : undefined,
    onSubmit: shouldEnableInline ? submitOpportunity : undefined
  })

  const { confirmNavigation } = useUnsavedChangesPrompt(shouldEnableInline && editor.isDirty)

  useEffect(() => {
    if (!shouldEnableInline) {
      setOwnerOptions([])
      setOwnersLoading(false)
      return
    }

    let cancelled = false
    setOwnersLoading(true)

    fetch("/api/admin/users?limit=100&status=Active", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load owners")
        }
        const payload = await response.json().catch(() => null)
        const users = Array.isArray(payload?.data?.users) ? payload.data.users : []
        const options: OwnerOption[] = users.map((user: any) => ({
          value: user.id,
          label: user.fullName || user.email || user.id
        }))

        if (opportunityOwnerId) {
          const exists = options.some(option => option.value === opportunityOwnerId)
          if (!exists) {
            options.unshift({
              value: opportunityOwnerId,
              label: opportunityOwnerName || "Current Owner"
            })
          }
        }

        if (!cancelled) {
          setOwnerOptions(options)
        }
      })
      .catch(error => {
        console.error(error)
        if (!cancelled) {
          setOwnerOptions(
            opportunityOwnerId
              ? [{ value: opportunityOwnerId, label: opportunityOwnerName || "Current Owner" }]
              : []
          )
          showError("Unable to load owners", error instanceof Error ? error.message : "Please try again later")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOwnersLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [shouldEnableInline, opportunityOwnerId, opportunityOwnerName, showError])

  const ownerSelectOptions = useMemo(() => {
    if (!shouldEnableInline) {
      return ownerOptions
    }
    if (!opportunityOwnerId) {
      return ownerOptions
    }
    const exists = ownerOptions.some(option => option.value === opportunityOwnerId)
    if (exists) {
      return ownerOptions
    }
    return [
      { value: opportunityOwnerId, label: opportunityOwnerName ?? "Current Owner" },
      ...ownerOptions
    ]
  }, [shouldEnableInline, ownerOptions, opportunityOwnerId, opportunityOwnerName])

  const handleSaveEdits = useCallback(async () => {
    try {
      await editor.submit()
    } catch (error) {
      if (error && typeof error === "object" && "serverErrors" in error) {
        editor.setErrors((error as { serverErrors?: Record<string, string> }).serverErrors ?? {})
      }
    }
  }, [editor])

  const handleTabSelect = useCallback(
    (tab: TabKey) => {
      if (tab === activeTab) return
      if (shouldEnableInline && editor.isDirty) {
        const proceed = confirmNavigation()
        if (!proceed) return
      }
      setActiveTab(tab)
    },
    [activeTab, confirmNavigation, editor.isDirty, shouldEnableInline]
  )

  // Roles state
  const [rolesSearchQuery, setRolesSearchQuery] = useState("")
  const [roleColumnFilters, setRoleColumnFilters] = useState<ColumnFilter[]>([])
  const [roleStatusFilter, setRoleStatusFilter] = useState<"active" | "inactive">("active")
  const [roleCurrentPage, setRoleCurrentPage] = useState(1)
  const [rolePageSize, setRolePageSize] = useState(10)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [showRoleColumnSettings, setShowRoleColumnSettings] = useState(false)
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false)

  const {
    columns: rolePreferenceColumns,
    loading: rolePreferencesLoading,
    saving: rolePreferencesSaving,
    hasUnsavedChanges: roleHasUnsavedChanges,
    lastSaved: roleLastSaved,
    handleColumnsChange: handleRoleColumnsChange,
    saveChanges: saveRolePreferences,
    saveChangesOnModalClose: saveRolePrefsOnModalClose
  } = useTablePreferences("opportunities:detail:roles", ROLE_TABLE_BASE_COLUMNS)

  // Product line items
  const [productSearchQuery, setProductSearchQuery] = useState("")
  const [productColumnFilters, setProductColumnFilters] = useState<ColumnFilter[]>([])
  const [productStatusFilter, setProductStatusFilter] = useState<"active" | "inactive">("active")
  const [productCurrentPage, setProductCurrentPage] = useState(1)
  const [productPageSize, setProductPageSize] = useState(10)
  const [showProductColumnSettings, setShowProductColumnSettings] = useState(false)
  const [showCreateLineItemModal, setShowCreateLineItemModal] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<OpportunityLineItemRecord | null>(null)
  const [lineItemToDelete, setLineItemToDelete] = useState<OpportunityLineItemRecord | null>(null)
  const [lineItemDeleteLoading, setLineItemDeleteLoading] = useState(false)
  const [lineItemDeleteError, setLineItemDeleteError] = useState<string | null>(null)
  const [selectedLineItems, setSelectedLineItems] = useState<string[]>([])
  const [lineItemBulkActionLoading, setLineItemBulkActionLoading] = useState(false)
  const [lineItemToggleLoading, setLineItemToggleLoading] = useState<Record<string, boolean>>({})
  const [lineItemStatusOverrides, setLineItemStatusOverrides] = useState<Record<string, boolean>>({})
  const [lineItemBulkDeleteTargets, setLineItemBulkDeleteTargets] = useState<OpportunityLineItemRecord[]>([])

  const {
    columns: productPreferenceColumns,
    loading: productPreferencesLoading,
    saving: productPreferencesSaving,
    hasUnsavedChanges: productHasUnsavedChanges,
    lastSaved: productLastSaved,
    handleColumnsChange: handleProductTableColumnsChange,
    saveChanges: saveProductTablePreferences,
    saveChangesOnModalClose: saveProductPrefsOnModalClose
  } = useTablePreferences("opportunities:detail:products", PRODUCT_TABLE_BASE_COLUMNS)

  // Revenue schedules state
  const [revenueSearchQuery, setRevenueSearchQuery] = useState("")
  const [revenueColumnFilters, setRevenueColumnFilters] = useState<ColumnFilter[]>([])
  const [revenueStatusFilter, setRevenueStatusFilter] = useState<'all' | 'open' | 'reconciled' | 'in_dispute'>('all')
  const [revenueCurrentPage, setRevenueCurrentPage] = useState(1)
  const [revenuePageSize, setRevenuePageSize] = useState(10)
  const [selectedRevenueSchedules, setSelectedRevenueSchedules] = useState<string[]>([])
  const [showRevenueColumnSettings, setShowRevenueColumnSettings] = useState(false)
  const [showRevenueCreateModal, setShowRevenueCreateModal] = useState(false)
  const [revenueBulkBusy, setRevenueBulkBusy] = useState(false)
  const [showRevenueCloneModal, setShowRevenueCloneModal] = useState(false)
  const [revenueCloneTargetId, setRevenueCloneTargetId] = useState<string | null>(null)
  const [revenueCloneDefaultDate, setRevenueCloneDefaultDate] = useState<string>("")
  const [revenueBulkPrompt, setRevenueBulkPrompt] = useState<RevenueFillDownPrompt | null>(null)
  const [revenueBulkApplying, setRevenueBulkApplying] = useState(false)

  const {
    columns: revenuePreferenceColumns,
    loading: revenuePreferencesLoading,
    saving: revenuePreferencesSaving,
    hasUnsavedChanges: revenueHasUnsavedChanges,
    lastSaved: revenueLastSaved,
    handleColumnsChange: handleRevenueColumnsChange,
    saveChanges: saveRevenuePreferences,
    saveChangesOnModalClose: saveRevenuePrefsOnModalClose
  } = useTablePreferences("opportunities:detail:revenue-schedules", REVENUE_TABLE_BASE_COLUMNS)

  // Activities & notes state
  const [activitySearchQuery, setActivitySearchQuery] = useState("")
  const [activitiesColumnFilters, setActivitiesColumnFilters] = useState<ColumnFilter[]>([])
  const [activityStatusFilter, setActivityStatusFilter] = useState<"active" | "inactive">("active")
  const [activitiesCurrentPage, setActivitiesCurrentPage] = useState(1)
  const [activitiesPageSize, setActivitiesPageSize] = useState(10)
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [activityBulkActionLoading, setActivityBulkActionLoading] = useState(false)
  const [showActivityBulkOwnerModal, setShowActivityBulkOwnerModal] = useState(false)
  const [showActivityBulkStatusModal, setShowActivityBulkStatusModal] = useState(false)
  const [editingActivity, setEditingActivity] = useState<OpportunityActivityRecord | null>(null)
  const [showActivityEditModal, setShowActivityEditModal] = useState(false)
  const [showActivityColumnSettings, setShowActivityColumnSettings] = useState(false)

  const {
    columns: activityPreferenceColumns,
    loading: activityPreferencesLoading,
    saving: activityPreferencesSaving,
    hasUnsavedChanges: activityHasUnsavedChanges,
    lastSaved: activityLastSaved,
    handleColumnsChange: handleActivityTableColumnsChange,
    saveChanges: saveActivityPreferences,
    saveChangesOnModalClose: saveActivityPrefsOnModalClose
  } = useTablePreferences("opportunities:detail:activities", ACTIVITY_TABLE_BASE_COLUMNS)

  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const [tableAreaMaxHeight, setTableAreaMaxHeight] = useState<number>()
  const TABLE_CONTAINER_PADDING = 16
  const TABLE_BODY_FOOTER_RESERVE = 96
  const TABLE_BODY_MIN_HEIGHT = 160
  const TABLE_BODY_MAX_HEIGHT = 520

  const measureTableAreaHeight = useCallback(() => {
    const container = tableAreaRef.current
    if (!container) {
      setTableAreaMaxHeight(undefined)
      return
    }
    const rect = container.getBoundingClientRect()
    const available = window.innerHeight - rect.top - TABLE_CONTAINER_PADDING
    if (!Number.isFinite(available)) {
      return
    }
    setTableAreaMaxHeight(Math.max(Math.floor(available), 0))
  }, [])

  const tableAreaRefCallback = useCallback((node: HTMLDivElement | null) => {
    tableAreaRef.current = node
    if (node) {
      window.requestAnimationFrame(() => {
        measureTableAreaHeight()
      })
    } else {
      setTableAreaMaxHeight(undefined)
    }
  }, [measureTableAreaHeight])

  useLayoutEffect(() => {
    measureTableAreaHeight()
  }, [
    measureTableAreaHeight,
    activeTab,
    loading,
    rolePreferencesLoading,
    productPreferencesLoading,
    revenuePreferencesLoading,
    activityPreferencesLoading
  ])

  useEffect(() => {
    const handleResize = () => measureTableAreaHeight()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [measureTableAreaHeight])

  const tableBodyMaxHeight = useMemo(() => {
    if (tableAreaMaxHeight == null) {
      return undefined
    }
    const maxBodyWithinContainer = Math.max(tableAreaMaxHeight - TABLE_CONTAINER_PADDING, 0)
    const preferredBodyHeight = Math.max(
      tableAreaMaxHeight - TABLE_BODY_FOOTER_RESERVE,
      Math.floor(tableAreaMaxHeight * 0.6),
      0
    )
    const boundedPreferredHeight = Math.min(preferredBodyHeight, maxBodyWithinContainer)
    const limitedPreferredHeight = Math.min(boundedPreferredHeight, TABLE_BODY_MAX_HEIGHT)
    if (limitedPreferredHeight >= TABLE_BODY_MIN_HEIGHT) {
      return limitedPreferredHeight
    }
    const minTarget = Math.min(TABLE_BODY_MIN_HEIGHT, maxBodyWithinContainer)
    return Math.max(limitedPreferredHeight, minTarget)
  }, [tableAreaMaxHeight])

  const roleRows = useMemo<OpportunityRoleRow[]>(() => {
    if (!opportunity) {
      return []
    }

    const baseRoles = (opportunity.roles ?? []).map<OpportunityRoleRow>(role => ({
      id: role.id,
      role: role.role ?? "",
      fullName: role.fullName ?? "",
      jobTitle: role.jobTitle ?? "",
      email: role.email ?? "",
      workPhone: role.workPhone ?? "",
      phoneExtension: role.phoneExtension ?? "",
      mobile: role.mobile ?? "",
      isActive: role.active !== false
    }))

    if (baseRoles.length > 0) {
      return baseRoles
    }

    const fallbackId = opportunity.owner?.id ?? `owner-${opportunity.id}`
    return [
      {
        id: fallbackId,
        role: "Opportunity Owner",
        fullName: opportunity.owner?.name ?? "Unassigned",
        jobTitle: "",
        email: "",
        workPhone: "",
        phoneExtension: "",
        mobile: "",
        isActive: true
      }
    ]
  }, [opportunity])

  const filteredRoleRows = useMemo(() => {
    let rows = [...roleRows]

    if (roleStatusFilter === "active") {
      rows = rows.filter(row => row.isActive !== false)
    } else if (roleStatusFilter === "inactive") {
      rows = rows.filter(row => row.isActive === false)
    }

    if (rolesSearchQuery.trim().length > 0) {
      const search = rolesSearchQuery.trim().toLowerCase()
      rows = rows.filter(row =>
        [row.role, row.fullName, row.jobTitle, row.email, row.workPhone, row.phoneExtension, row.mobile]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(search))
      )
    }

    if (roleColumnFilters.length > 0) {
      rows = applySimpleFilters(
        rows as unknown as Record<string, unknown>[],
        roleColumnFilters
      ) as unknown as OpportunityRoleRow[]
    }

    return rows
  }, [roleRows, roleStatusFilter, rolesSearchQuery, roleColumnFilters])

  const paginatedRoleRows = useMemo(() => {
    const start = (roleCurrentPage - 1) * rolePageSize
    return filteredRoleRows.slice(start, start + rolePageSize)
  }, [filteredRoleRows, roleCurrentPage, rolePageSize])

  const rolePagination = useMemo(() => {
    const total = filteredRoleRows.length
    const totalPages = Math.max(Math.ceil(total / rolePageSize), 1)
    return {
      page: roleCurrentPage,
      pageSize: rolePageSize,
      total,
      totalPages
    }
  }, [filteredRoleRows.length, roleCurrentPage, rolePageSize])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredRoleRows.length / rolePageSize), 1)
    if (roleCurrentPage > maxPage) {
      setRoleCurrentPage(maxPage)
    }
  }, [filteredRoleRows.length, roleCurrentPage, rolePageSize])

  useEffect(() => {
    setSelectedRoles(previous => previous.filter(id => filteredRoleRows.some(row => row.id === id)))
  }, [filteredRoleRows])

  useEffect(() => {
    setSelectedRoles([])
    setRoleStatusFilter("active")
    setRoleCurrentPage(1)
  }, [opportunity?.id])

  const selectedRoleRows = useMemo(() => {
    if (selectedRoles.length === 0) {
      return []
    }
    return roleRows.filter(row => selectedRoles.includes(row.id))
  }, [roleRows, selectedRoles])

  const handleRoleSelect = useCallback((roleId: string, selected: boolean) => {
    setSelectedRoles(previous => {
      if (selected) {
        if (previous.includes(roleId)) {
          return previous
        }
        return [...previous, roleId]
      }
      return previous.filter(id => id !== roleId)
    })
  }, [])

  const handleSelectAllRoles = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedRoles(paginatedRoleRows.map(row => row.id))
        return
      }
      setSelectedRoles([])
    },
    [paginatedRoleRows]
  )

  const handleRolePageChange = useCallback((page: number) => {
    setRoleCurrentPage(page)
  }, [])

  const handleRolePageSizeChange = useCallback((size: number) => {
    setRolePageSize(size)
    setRoleCurrentPage(1)
  }, [])

  const roleTableColumns = useMemo(() => {
    return rolePreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_: unknown, row: OpportunityRoleRow) => {
            const checked = selectedRoles.includes(row.id)
            const labelSource = row.fullName || row.role || row.email

            return (
              <div className="flex items-center" data-disable-row-click="true">
                <label
                  className="flex cursor-pointer items-center justify-center"
                  onClick={event => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select ${labelSource || "role"}`}
                    onChange={() => handleRoleSelect(row.id, !checked)}
                  />
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                      checked
                        ? "border-primary-500 bg-primary-600 text-white"
                        : "border-gray-300 bg-white text-transparent"
                    )}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
              </div>
            )
          }
        }
      }

      if (column.id === "email") {
        return {
          ...column,
          render: (value: unknown) => {
            const email = typeof value === "string" ? value.trim() : ""
            if (!email) {
              return "--"
            }
            return (
              <a href={`mailto:${email}`} className="text-primary-600 hover:text-primary-700">
                {email}
              </a>
            )
          }
        }
      }

      return {
        ...column,
        render: (value: unknown) =>
          value === null || value === undefined || String(value).trim().length === 0 ? "--" : String(value)
      }
    })
  }, [rolePreferenceColumns, selectedRoles, handleRoleSelect])

  const handleBulkRoleExportCsv = useCallback(() => {
    if (selectedRoles.length === 0) {
      showError("No roles selected", "Select at least one role to export.")
      return
    }

    if (selectedRoleRows.length === 0) {
      showError("Roles unavailable", "Unable to locate the selected roles. Refresh and try again.")
      return
    }

    const headers = ["Role", "Full Name", "Job Title", "Email", "Work Phone", "Extension", "Mobile", "Active"]
    const escapeCsv = (value: string | null | undefined) => {
      if (!value) {
        return ""
      }
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
    }

    const lines = selectedRoleRows.map(row =>
      [
        row.role,
        row.fullName,
        row.jobTitle,
        row.email,
        row.workPhone,
        row.phoneExtension,
        row.mobile,
        row.isActive ? "Active" : "Inactive",
      ]
        .map(value => escapeCsv(value))
        .join(",")
    )

    const blob = new Blob([[headers.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
    link.href = url
    link.download = `opportunity-roles-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    showSuccess(
      `Exported ${selectedRoleRows.length} role${selectedRoleRows.length === 1 ? "" : "s"}`,
      "Check your downloads for the CSV file."
    )
  }, [selectedRoles.length, selectedRoleRows, showError, showSuccess])

  const canEditAnyLineItems = hasAnyPermission(["opportunities.manage"])
  const canEditAssignedLineItems = hasPermission("opportunities.edit.assigned")
  const ownsOpportunity = Boolean(authUser?.id && opportunity?.owner?.id === authUser.id)
  const canModifyLineItems = canEditAnyLineItems || (canEditAssignedLineItems && ownsOpportunity)
  const lineItemIds = useMemo(() => opportunity?.lineItems.map(item => item.id) ?? [], [opportunity?.lineItems])

  const productRows = useMemo(() => {
    if (!opportunity) {
      return []
    }

    return opportunity.lineItems.map(item => ({
      id: item.id,
      productName: item.productName,
      productCode: item.productCode ?? "",
      revenueType: item.revenueType ?? "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      expectedRevenue: item.expectedRevenue,
      expectedCommission: item.expectedCommission,
      expectedUsage: item.expectedUsage,
      revenueStartDate: item.revenueStartDate,
      revenueEndDate: item.revenueEndDate,
      distributorName: item.distributorName ?? "",
      vendorName: item.vendorName ?? "",
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isActive: item.active !== false
    }))
  }, [opportunity])

  const effectiveProductRows = useMemo(() => {
    if (Object.keys(lineItemStatusOverrides).length === 0) {
      return productRows
    }
    return productRows.map(row => {
      if (lineItemStatusOverrides[row.id] === undefined) {
        return row
      }
      return { ...row, isActive: lineItemStatusOverrides[row.id] }
    })
  }, [productRows, lineItemStatusOverrides])

  const filteredProductRows = useMemo(() => {
    let rows = effectiveProductRows

    if (productStatusFilter === "active") {
      rows = rows.filter(row => row.isActive !== false)
    }

    if (productSearchQuery.trim().length > 0) {
      const search = productSearchQuery.trim().toLowerCase()
      rows = rows.filter(row =>
        [
          row.productName,
          row.productCode,
          getRevenueTypeLabel(row.revenueType) ?? row.revenueType ?? "",
          row.distributorName,
          row.vendorName
        ]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(search))
      )
    }

    if (productColumnFilters.length > 0) {
      rows = applySimpleFilters(rows as unknown as Record<string, unknown>[], productColumnFilters) as typeof rows
    }

    return rows
  }, [effectiveProductRows, productStatusFilter, productSearchQuery, productColumnFilters])

  const paginatedProductRows = useMemo(() => {
    const start = (productCurrentPage - 1) * productPageSize
    return filteredProductRows.slice(start, start + productPageSize)
  }, [filteredProductRows, productCurrentPage, productPageSize])

  const handleLineItemSelect = useCallback((lineItemId: string, selected: boolean) => {
    setSelectedLineItems(previous => {
      if (selected) {
        if (previous.includes(lineItemId)) {
          return previous
        }
        return [...previous, lineItemId]
      }
      return previous.filter(id => id !== lineItemId)
    })
  }, [])

  const handleSelectAllLineItems = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedLineItems(paginatedProductRows.map(row => row.id))
        return
      }
      setSelectedLineItems([])
    },
    [paginatedProductRows]
  )

  const selectedProductRows = useMemo(() => {
    if (selectedLineItems.length === 0) {
      return []
    }
    return filteredProductRows.filter(row => selectedLineItems.includes(row.id))
  }, [filteredProductRows, selectedLineItems])

  const revenueRows = useMemo(() => {
    if (!opportunity?.revenueSchedules || opportunity.revenueSchedules.length === 0) {
      return []
    }
    return opportunity.revenueSchedules.map(schedule => ({
      ...schedule
    }))
  }, [opportunity?.revenueSchedules])

  const filteredRevenueRows = useMemo(() => {
    let rows = [...revenueRows]

    if (revenueStatusFilter !== 'all') {
      rows = rows.filter(row => {
        const rawStatus = String(row.scheduleStatus ?? '').toLowerCase()
        const gross = parseCurrency(row.expectedUsageGross)
        const adj = parseCurrency(row.expectedUsageAdjustment)
        const net = gross + adj
        const isDispute = rawStatus.includes('dispute') || Boolean(row.inDispute)
        const isOpen = rawStatus === 'open' ? true : rawStatus === 'reconciled' ? false : Math.abs(net) > 0.0001
        const isReconciled = rawStatus === 'reconciled' ? true : rawStatus === 'open' ? false : !isOpen
        if (revenueStatusFilter === 'open') return isOpen
        if (revenueStatusFilter === 'reconciled') return isReconciled
        if (revenueStatusFilter === 'in_dispute') return isDispute
        return true
      })
    }

    if (revenueSearchQuery.trim().length > 0) {
      const search = revenueSearchQuery.trim().toLowerCase()
      rows = rows.filter(row =>
        [
          row.productNameVendor,
          row.scheduleNumber,
          row.vendorName,
          row.distributorName,
          row.status
        ]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(search))
      )
    }

    if (revenueColumnFilters.length > 0) {
      rows = applySimpleFilters(
        rows as unknown as Record<string, unknown>[],
        revenueColumnFilters
      ) as unknown as OpportunityRevenueScheduleRecord[]
    }

    return rows
  }, [revenueRows, revenueStatusFilter, revenueSearchQuery, revenueColumnFilters])

  const paginatedRevenueRows = useMemo(() => {
    const start = (revenueCurrentPage - 1) * revenuePageSize
    return filteredRevenueRows.slice(start, start + revenuePageSize)
  }, [filteredRevenueRows, revenueCurrentPage, revenuePageSize])

  const revenueEditableColumnsMeta: Record<RevenueEditableColumnId, { label: string; decimals: number; type: "number" | "currency" | "percent" }> = useMemo(
    () => ({
      quantity: { label: "Quantity", decimals: 0, type: "number" },
      unitPrice: { label: "Price Each", decimals: 2, type: "currency" },
      expectedUsageAdjustment: { label: "Expected Usage Adjustment", decimals: 2, type: "currency" },
      expectedCommissionRatePercent: { label: "Expected Commission Rate %", decimals: 2, type: "percent" }
    }),
    []
  )

  const isRevenueEditableColumn = useCallback(
    (columnId: string): columnId is RevenueEditableColumnId => Boolean(revenueEditableColumnsMeta[columnId as RevenueEditableColumnId]),
    [revenueEditableColumnsMeta]
  )

  const activityRows = useMemo<OpportunityActivityRow[]>(() => {
    if (!opportunity?.activities || opportunity.activities.length === 0) {
      return []
    }

    return opportunity.activities.map(activity => ({
      id: activity.id,
      active: activity.active !== false,
      activityDate: activity.activityDate ?? null,
      activityType: activity.activityType ?? null,
      activityStatus: activity.activityStatus ?? null,
      description: activity.description ?? "",
      activityOwner: activity.activityOwner ?? "",
      createdBy: activity.createdBy ?? "",
      attachment: activity.attachment ?? "None",
      fileName: activity.fileName ?? "",
      attachments: activity.attachments ?? []
    }))
  }, [opportunity?.activities])

  const filteredActivities = useMemo(() => {
    let rows = [...activityRows]

    if (activityStatusFilter === "active") {
      rows = rows.filter(row => row.active)
    } else if (activityStatusFilter === "inactive") {
      rows = rows.filter(row => !row.active)
    }

    if (activitySearchQuery.trim().length > 0) {
      const search = activitySearchQuery.trim().toLowerCase()
      rows = rows.filter(row =>
        [
          row.description,
          row.activityType,
          row.activityOwner,
          row.activityStatus,
          row.fileName,
          row.createdBy
        ]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(search))
      )
    }

    if (activitiesColumnFilters.length > 0) {
      const filtered = applySimpleFilters(
        rows as unknown as Record<string, unknown>[],
        activitiesColumnFilters
      )
      rows = filtered as unknown as OpportunityActivityRow[]
    }

    return rows
  }, [activityRows, activityStatusFilter, activitySearchQuery, activitiesColumnFilters])

  const paginatedActivities = useMemo(() => {
    const start = (activitiesCurrentPage - 1) * activitiesPageSize
    return filteredActivities.slice(start, start + activitiesPageSize)
  }, [filteredActivities, activitiesCurrentPage, activitiesPageSize])

  const activitiesPagination = useMemo(() => {
    const total = filteredActivities.length
    const totalPages = Math.max(Math.ceil(total / activitiesPageSize), 1)
    return { page: activitiesCurrentPage, pageSize: activitiesPageSize, total, totalPages }
  }, [filteredActivities.length, activitiesCurrentPage, activitiesPageSize])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredActivities.length / activitiesPageSize), 1)
    if (activitiesCurrentPage > maxPage) {
      setActivitiesCurrentPage(maxPage)
    }
  }, [filteredActivities.length, activitiesCurrentPage, activitiesPageSize])

  useEffect(() => {
    setSelectedActivities(previous => previous.filter(id => activityRows.some(row => row.id === id)))
  }, [activityRows])

  useEffect(() => {
    setActivityStatusFilter("active")
    setActivitySearchQuery("")
    setActivitiesColumnFilters([])
    setActivitiesCurrentPage(1)
    setSelectedActivities([])
    setActivityModalOpen(false)
    setShowActivityBulkOwnerModal(false)
    setShowActivityBulkStatusModal(false)
    setEditingActivity(null)
    setShowActivityEditModal(false)
  }, [opportunity?.id])

  const handleActivitiesPageChange = useCallback((page: number) => {
    setActivitiesCurrentPage(page)
  }, [])

  const handleActivitiesPageSizeChange = useCallback((size: number) => {
    setActivitiesPageSize(size)
    setActivitiesCurrentPage(1)
  }, [])

  const handleActivitySelect = useCallback((activityId: string, selected: boolean) => {
    setSelectedActivities(previous => {
      if (selected) {
        if (previous.includes(activityId)) {
          return previous
        }
        return [...previous, activityId]
      }
      return previous.filter(id => id !== activityId)
    })
  }, [])

  const handleSelectAllActivities = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedActivities(paginatedActivities.map(row => row.id))
        return
      }
      setSelectedActivities([])
    },
    [paginatedActivities]
  )

  const revenuePagination = useMemo(() => {
    const total = filteredRevenueRows.length
    const totalPages = Math.max(Math.ceil(total / revenuePageSize), 1)
    return {
      page: revenueCurrentPage,
      pageSize: revenuePageSize,
      total,
      totalPages
    }
  }, [filteredRevenueRows.length, revenueCurrentPage, revenuePageSize])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredRevenueRows.length / revenuePageSize), 1)
    if (revenueCurrentPage > maxPage) {
      setRevenueCurrentPage(maxPage)
    }
  }, [filteredRevenueRows.length, revenuePageSize, revenueCurrentPage])

  useEffect(() => {
    setSelectedRevenueSchedules(previous =>
      previous.filter(id => filteredRevenueRows.some(row => row.id === id))
    )
  }, [filteredRevenueRows])

  useEffect(() => {
    setSelectedRevenueSchedules([])
    setRevenueStatusFilter("all")
    setRevenueCurrentPage(1)
  }, [opportunity?.id])

  const handleRevenueSelect = useCallback((scheduleId: string, selected: boolean) => {
    setSelectedRevenueSchedules(previous => {
      if (selected) {
        if (previous.includes(scheduleId)) {
          return previous
        }
        return [...previous, scheduleId]
      }
      return previous.filter(id => id !== scheduleId)
    })
  }, [])

  const handleSelectAllRevenue = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedRevenueSchedules(paginatedRevenueRows.map(row => row.id))
        return
      }
      setSelectedRevenueSchedules([])
    },
    [paginatedRevenueRows]
  )

  const handleRevenuePageChange = useCallback((page: number) => {
    setRevenueCurrentPage(page)
  }, [])

  const handleRevenuePageSizeChange = useCallback((size: number) => {
    setRevenuePageSize(size)
    setRevenueCurrentPage(1)
  }, [])

  const normalizeRevenueEditValue = useCallback(
    (columnId: RevenueEditableColumnId, value: number) => {
      if (!Number.isFinite(value)) return null
      switch (columnId) {
        case "quantity":
          return Math.max(0, Math.round(value))
        case "unitPrice":
        case "expectedUsageAdjustment":
          return Number(Math.max(0, value).toFixed(revenueEditableColumnsMeta[columnId].decimals))
        case "expectedCommissionRatePercent":
          return Number(Math.max(0, value).toFixed(revenueEditableColumnsMeta[columnId].decimals))
        default:
          return null
      }
    },
    [revenueEditableColumnsMeta]
  )

  const getEditableDisplayValue = useCallback(
    (columnId: RevenueEditableColumnId, rowValue: unknown): number => {
      if (columnId === "expectedCommissionRatePercent") {
        const fraction = typeof rowValue === "number" ? rowValue : Number(rowValue) || 0
        return fraction * 100 // display percent points
      }
      return typeof rowValue === "number" ? rowValue : Number(rowValue) || 0
    },
    []
  )

  const handleRevenueInlineChange = useCallback(
    (rowId: string, columnId: RevenueEditableColumnId, nextValue: number, rect: DOMRect | null) => {
      const normalised = normalizeRevenueEditValue(columnId, nextValue)
      if (normalised === null) {
        return
      }

      if (selectedRevenueSchedules.length > 1 && selectedRevenueSchedules.includes(rowId) && rect) {
        setRevenueBulkPrompt({
          columnId,
          label: revenueEditableColumnsMeta[columnId].label,
          value: normalised,
          rowId,
          selectedCount: selectedRevenueSchedules.length,
          anchor: {
            top: rect.bottom + 8,
            left: rect.right + 12
          }
        })
      } else {
        setRevenueBulkPrompt(null)
      }
    },
    [normalizeRevenueEditValue, revenueEditableColumnsMeta, selectedRevenueSchedules]
  )

  const handleRevenueApplyFillDown = useCallback(async () => {
    if (!revenueBulkPrompt || selectedRevenueSchedules.length <= 1) {
      return
    }
    const columnId = revenueBulkPrompt.columnId
    const payload: Record<string, number> = {}
    if (columnId === "quantity") payload.quantity = revenueBulkPrompt.value
    if (columnId === "unitPrice") payload.priceEach = revenueBulkPrompt.value
    if (columnId === "expectedUsageAdjustment") payload.expectedUsageAdjustment = revenueBulkPrompt.value
    if (columnId === "expectedCommissionRatePercent") payload.expectedCommissionRatePercent = revenueBulkPrompt.value

    if (Object.keys(payload).length === 0) {
      return
    }

    setRevenueBulkApplying(true)
    try {
      const response = await fetch("/api/revenue-schedules/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedRevenueSchedules,
          patch: payload
        })
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const message = body?.error ?? "Unable to apply bulk update"
        throw new Error(message)
      }
      const updatedCount: number = body?.updated ?? selectedRevenueSchedules.length
      showSuccess(
        `Applied to ${updatedCount} schedule${updatedCount === 1 ? "" : "s"}`,
        `${revenueBulkPrompt.label} updated across the selected schedules.`
      )
      setRevenueBulkPrompt(null)
      await onRefresh?.()
    } catch (error) {
      console.error("Failed to apply bulk update for revenue schedules", error)
      const message = error instanceof Error ? error.message : "Unable to apply bulk update"
      showError("Bulk update failed", message)
    } finally {
      setRevenueBulkApplying(false)
    }
  }, [onRefresh, revenueBulkPrompt, selectedRevenueSchedules, showError, showSuccess])

  const selectedRevenueRows = useMemo(() => {
    if (selectedRevenueSchedules.length === 0) {
      return []
    }
    return filteredRevenueRows.filter(row => selectedRevenueSchedules.includes(row.id))
  }, [filteredRevenueRows, selectedRevenueSchedules])

  const revenueTableColumns = useMemo(() => {
    const renderEditableCell = (columnId: RevenueEditableColumnId, label: string) => {
      // eslint-disable-next-line react/display-name
      return (_: unknown, row: OpportunityRevenueScheduleRecord) => {
        let spanRef: HTMLSpanElement | null = null
        const displayValue = getEditableDisplayValue(columnId, (row as any)[columnId])

        const commit = () => {
          if (!spanRef) return
          const rawText = spanRef.innerText.trim()
          if (!rawText) return
          const sanitised = rawText.replace(/[^0-9.\-]/g, "")
          const parsed = sanitised === "" ? NaN : Number(sanitised)
          if (Number.isNaN(parsed)) return
          const nextValue = columnId === "expectedCommissionRatePercent" ? parsed : parsed
          handleRevenueInlineChange(row.id, columnId, nextValue, spanRef.getBoundingClientRect())
        }

        const formattedForDisplay = () => {
          if (!Number.isFinite(displayValue)) return ""
          if (columnId === "expectedCommissionRatePercent") {
            return displayValue.toLocaleString(undefined, {
              minimumFractionDigits: revenueEditableColumnsMeta[columnId].decimals,
              maximumFractionDigits: revenueEditableColumnsMeta[columnId].decimals
            })
          }
          const decimals = revenueEditableColumnsMeta[columnId].decimals
          return displayValue.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          })
        }

        return (
          <span
            ref={node => {
              spanRef = node
            }}
            contentEditable
            suppressContentEditableWarning
            data-disable-row-click="true"
            className="block min-w-0 truncate text-sm text-gray-900 focus:outline-none"
            onBlur={commit}
            onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault()
                commit()
              }
            }}
            aria-label={`Edit ${label}`}
          >
            {formattedForDisplay()}
          </span>
        )
      }
    }

    return revenuePreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_: unknown, row: OpportunityRevenueScheduleRecord) => {
            const checked = selectedRevenueSchedules.includes(row.id)

            return (
              <div className="flex items-center" data-disable-row-click="true">
                <label
                  className="flex cursor-pointer items-center justify-center"
                  onClick={event => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select revenue schedule ${row.scheduleNumber ?? row.productNameVendor ?? row.id}`}
                    onChange={() => handleRevenueSelect(row.id, !checked)}
                  />
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                      checked
                        ? "border-primary-500 bg-primary-600 text-white"
                        : "border-gray-300 bg-white text-transparent"
                    )}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
              </div>
            )
          }
        }
      }

      if (column.id === "scheduleDate") {
        return {
          ...column,
          render: (value: unknown) => formatDate(typeof value === "string" ? value : String(value ?? ""))
        }
      }

      if (column.id === "status") {
        return {
          ...column,
          render: (value: unknown) => {
            const label = value ? humanizeLabel(String(value)) : "--"
            return (
              <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {label}
              </span>
            )
          }
        }
      }

      if (isRevenueEditableColumn(column.id)) {
        return {
          ...column,
          render: renderEditableCell(column.id, column.label)
        }
      }

      if (REVENUE_CURRENCY_COLUMN_IDS.has(column.id)) {
        return {
          ...column,
          render: (value: unknown) => formatCurrency(typeof value === "number" ? value : Number(value) || 0)
        }
      }

      if (REVENUE_PERCENT_COLUMN_IDS.has(column.id)) {
        return {
          ...column,
          render: (value: unknown) => formatPercent(typeof value === "number" ? value : Number(value) || 0)
        }
      }

      if (REVENUE_NUMBER_COLUMN_IDS.has(column.id)) {
        return {
          ...column,
          render: (value: unknown) => formatNumber(typeof value === "number" ? value : Number(value) || 0)
        }
      }

      return {
        ...column,
        render: (value: unknown) => (value === null || value === undefined || String(value).trim().length === 0 ? "--" : String(value))
      }
    })
  }, [
    revenuePreferenceColumns,
    selectedRevenueSchedules,
    handleRevenueSelect,
    getEditableDisplayValue,
    handleRevenueInlineChange,
    revenueEditableColumnsMeta,
    isRevenueEditableColumn
  ])

  const handleRevenueExportCsv = useCallback(() => {
    if (selectedRevenueSchedules.length === 0) {
      showError("Nothing selected", "Select at least one revenue schedule to export.")
      return
    }

    if (selectedRevenueRows.length === 0) {
      showError("Schedules unavailable", "Unable to locate the selected revenue schedules. Refresh and try again.")
      return
    }

    const headers = [
      "Product Name - Vendor",
      "Vendor Name",
      "Distributor Name",
      "Revenue Schedule",
      "Schedule Date",
      "Status",
      "Quantity",
      "Price Each",
      "Expected Usage Gross",
      "Expected Usage Adjustment",
      "Expected Usage Net",
      "Actual Usage",
      "Usage Balance",
      "Expected Commission Gross",
      "Expected Commission Adjustment",
      "Expected Commission Net",
      "Actual Commission",
      "Commission Difference",
      "Expected Commission Rate %",
      "Actual Commission Rate %",
      "Commission Rate Difference"
    ]

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) {
        return ""
      }
      const stringValue = String(value)
      return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue
    }

    const formatCurrencyValue = (value: number) => {
      const formatted = formatCurrency(value)
      return formatted === "--" ? "" : formatted
    }

    const formatPercentValue = (value: number) => {
      const formatted = formatPercent(value)
      return formatted === "--" ? "" : formatted
    }

    const formatDateValue = (value: string | null | undefined) => (value ? formatDate(value) : "")

    const lines = selectedRevenueRows.map(row =>
      [
        row.productNameVendor ?? "",
        row.vendorName ?? "",
        row.distributorName ?? "",
        row.scheduleNumber ?? "",
        formatDateValue(row.scheduleDate),
        row.status ? humanizeLabel(row.status) : "",
        formatNumber(row.quantity),
        formatCurrencyValue(row.unitPrice),
        formatCurrencyValue(row.expectedUsageGross),
        formatCurrencyValue(row.expectedUsageAdjustment),
        formatCurrencyValue(row.expectedUsageNet),
        formatCurrencyValue(row.actualUsage),
        formatCurrencyValue(row.usageBalance),
        formatCurrencyValue(row.expectedCommissionGross),
        formatCurrencyValue(row.expectedCommissionAdjustment),
        formatCurrencyValue(row.expectedCommissionNet),
        formatCurrencyValue(row.actualCommission),
        formatCurrencyValue(row.commissionDifference),
        formatPercentValue(row.expectedCommissionRatePercent),
        formatPercentValue(row.actualCommissionRatePercent),
        formatPercentValue(row.commissionRateDifferencePercent)
      ].map(escapeCsv).join(",")
    )

    const csvContent = [headers.join(","), ...lines].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
    link.download = `opportunity-revenue-schedules-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showSuccess(
      `Exported ${selectedRevenueRows.length} schedule${selectedRevenueRows.length === 1 ? "" : "s"}`,
      "Check your downloads for the CSV file."
    )
  }, [selectedRevenueSchedules.length, selectedRevenueRows, showError, showSuccess])

  const computeRevenueCloneDefaultDate = useCallback((rawDate?: string | null) => {
    const fallback = new Date()
    const base = rawDate ? new Date(rawDate) : fallback
    if (Number.isNaN(base.getTime())) {
      return fallback.toISOString().slice(0, 10)
    }
    const next = new Date(base)
    if (next.getDate() === 1) {
      next.setDate(1)
    } else {
      next.setMonth(next.getMonth() + 1, 1)
    }
    next.setHours(0, 0, 0, 0)
    return next.toISOString().slice(0, 10)
  }, [])

  const handleRevenueCloneSchedule = useCallback(() => {
    if (selectedRevenueSchedules.length !== 1) {
      showError("Select a single schedule", "Choose exactly one revenue schedule to clone.")
      return
    }
    const sourceId = selectedRevenueSchedules[0]
    const targetRow = selectedRevenueRows.find(row => row.id === sourceId)
    if (!targetRow) {
      showError("Schedules unavailable", "Unable to locate the selected revenue schedules. Refresh and try again.")
      return
    }
    const defaultDate = computeRevenueCloneDefaultDate(targetRow.scheduleDate)
    setRevenueCloneTargetId(sourceId)
    setRevenueCloneDefaultDate(defaultDate)
    setShowRevenueCloneModal(true)
  }, [computeRevenueCloneDefaultDate, selectedRevenueRows, selectedRevenueSchedules, showError])

  const handleRevenueCloneCancel = useCallback(() => {
    setShowRevenueCloneModal(false)
    setRevenueCloneTargetId(null)
  }, [])

  const handleRevenueConfirmClone = useCallback(
    async (effectiveDate: string) => {
      if (!revenueCloneTargetId) {
        showError("Schedules unavailable", "Unable to locate the selected revenue schedules. Refresh and try again.")
        return
      }

      setRevenueBulkBusy(true)
      try {
        const response = await fetch(`/api/revenue-schedules/${encodeURIComponent(revenueCloneTargetId)}/clone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ effectiveDate }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          const message = payload?.error ?? "Unable to clone the selected revenue schedule."
          throw new Error(message)
        }

        const newId: string | undefined = payload?.data?.id ?? payload?.id
        if (!newId) {
          throw new Error("Clone completed but the new schedule id was not returned.")
        }

        setShowRevenueCloneModal(false)
        setRevenueCloneTargetId(null)
        showSuccess("Schedule cloned", "Opening the cloned schedule so you can review it.")
        router.push(`/revenue-schedules/${encodeURIComponent(newId)}`)
      } catch (err) {
        console.error("Failed to clone revenue schedule", err)
        const message = err instanceof Error ? err.message : "Unable to clone revenue schedule."
        showError("Clone failed", message)
      } finally {
        setRevenueBulkBusy(false)
      }
    },
    [revenueCloneTargetId, router, showError, showSuccess]
  )

  const handleCreateActivity = useCallback(() => {
    if (!opportunity) {
      showError("Opportunity not loaded", "Load an opportunity before logging activities.")
      return
    }
    setActivityModalOpen(true)
  }, [opportunity, showError])

  const handleCloseActivityModal = useCallback(() => {
    setActivityModalOpen(false)
  }, [])

  const openActivityBulkOwnerModal = useCallback(() => {
    setShowActivityBulkOwnerModal(true)
  }, [])

  const openActivityBulkStatusModal = useCallback(() => {
    setShowActivityBulkStatusModal(true)
  }, [])

  const handleActivityCreated = useCallback(async () => {
    setActivityModalOpen(false)
    showSuccess("Activity created", "The activity list will refresh shortly.")
    await onRefresh?.()
  }, [showSuccess, onRefresh])

  const handleEditActivity = useCallback((activity: OpportunityActivityRow) => {
    setEditingActivity(activity)
    setShowActivityEditModal(true)
  }, [])

  const handleCloseActivityEditModal = useCallback(() => {
    setShowActivityEditModal(false)
    setEditingActivity(null)
  }, [])

  const handleActivityEditSuccess = useCallback(async () => {
    setShowActivityEditModal(false)
    setEditingActivity(null)
    showSuccess("Activity updated", "The activity has been updated successfully.")
    await onRefresh?.()
  }, [showSuccess, onRefresh])

  const handleDeleteActivity = useCallback(
    async (activity: OpportunityActivityRow) => {
      const confirmed = window.confirm("Are you sure you want to delete this activity?")
      if (!confirmed) {
        return
      }

      try {
        const response = await fetch(`/api/activities/${activity.id}`, { method: "DELETE" })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || "Failed to delete activity")
        }
        showSuccess("Activity deleted", "The activity has been removed.")
        setSelectedActivities(previous => previous.filter(id => id !== activity.id))
        await onRefresh?.()
      } catch (error) {
        console.error("Delete activity error:", error)
        const message = error instanceof Error ? error.message : "Please try again."
        showError("Failed to delete activity", message)
      }
    },
    [showError, showSuccess, onRefresh]
  )

  const handleToggleActivityStatus = useCallback(
    async (activity: OpportunityActivityRow, newStatus: boolean) => {
      if (!activity?.id) {
        showError("Activity unavailable", "Unable to locate this activity record.")
        return
      }

      try {
        const status = newStatus ? DEFAULT_OPEN_ACTIVITY_STATUS : "Completed"
        const response = await fetch(`/api/activities/${activity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || "Failed to update activity status")
        }

        showSuccess(
          newStatus ? "Activity reopened" : "Activity completed",
          `Activity ${newStatus ? "marked as open" : "marked as completed"}.`
        )
        await onRefresh?.()
      } catch (error) {
        console.error("Failed to update activity status", error)
        const message = error instanceof Error ? error.message : "Unable to update activity status"
        showError("Failed to update activity", message)
      }
    },
    [showError, showSuccess, onRefresh]
  )

  const handleBulkActivityOwnerUpdate = useCallback(
    async (ownerId: string | null) => {
      if (selectedActivities.length === 0) {
        showError("No activities selected", "Select at least one activity to update.")
        return
      }

      setActivityBulkActionLoading(true)
      try {
        const outcomes = await Promise.allSettled(
          selectedActivities.map(async activityId => {
            const response = await fetch(`/api/activities/${activityId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assigneeId: ownerId })
            })
            if (!response.ok) {
              const payload = await response.json().catch(() => null)
              throw new Error(payload?.error || "Failed to update activity owner")
            }
            return activityId
          })
        )

        const successes: string[] = []
        const failures: Array<{ activityId: string; message: string }> = []
        outcomes.forEach((result, index) => {
          const activityId = selectedActivities[index]
          if (result.status === "fulfilled") {
            successes.push(activityId)
          } else {
            const message =
              result.reason instanceof Error ? result.reason.message : "Unexpected error"
            failures.push({ activityId, message })
          }
        })

        if (successes.length > 0) {
          showSuccess(
            `Updated ${successes.length} activit${successes.length === 1 ? "y" : "ies"}`,
            "New owner assigned successfully."
          )
        }

        if (failures.length > 0) {
          const nameMap = new Map(
            (opportunity?.activities ?? []).map(activity => [
              activity.id,
              activity.description || activity.activityType || "Activity"
            ])
          )
          const detail = failures
            .map(({ activityId, message }) => `${nameMap.get(activityId) || "Activity"}: ${message}`)
            .join("; ")
          showError("Failed to update owner for some activities", detail)
        }

        setSelectedActivities(failures.map(item => item.activityId))
        if (failures.length === 0) {
          setShowActivityBulkOwnerModal(false)
        }
        await onRefresh?.()
      } catch (error) {
        console.error("Bulk activity owner update failed", error)
        showError(
          "Bulk activity owner update failed",
          error instanceof Error ? error.message : "Unable to update activity owners."
        )
      } finally {
        setActivityBulkActionLoading(false)
      }
    },
    [selectedActivities, opportunity?.activities, onRefresh, showError, showSuccess]
  )

  const handleBulkActivityStatusUpdate = useCallback(
    async (isActive: boolean) => {
      if (selectedActivities.length === 0) {
        showError("No activities selected", "Select at least one activity to update.")
        return
      }

      setActivityBulkActionLoading(true)
      try {
        const outcomes = await Promise.allSettled(
          selectedActivities.map(async activityId => {
            const response = await fetch(`/api/activities/${activityId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: isActive ? DEFAULT_OPEN_ACTIVITY_STATUS : "Completed" })
            })
            if (!response.ok) {
              const payload = await response.json().catch(() => null)
              throw new Error(payload?.error || "Failed to update activity status")
            }
            return activityId
          })
        )

        const successes: string[] = []
        const failures: Array<{ activityId: string; message: string }> = []
        outcomes.forEach((result, index) => {
          const activityId = selectedActivities[index]
          if (result.status === "fulfilled") {
            successes.push(activityId)
          } else {
            const message =
              result.reason instanceof Error ? result.reason.message : "Unexpected error"
            failures.push({ activityId, message })
          }
        })

        if (successes.length > 0) {
          showSuccess(
            `Marked ${successes.length} activit${successes.length === 1 ? "y" : "ies"} as ${isActive ? "open" : "completed"}`,
            "The status has been updated successfully."
          )
        }

        if (failures.length > 0) {
          const nameMap = new Map(
            (opportunity?.activities ?? []).map(activity => [
              activity.id,
              activity.description || activity.activityType || "Activity"
            ])
          )
          const detail = failures
            .map(({ activityId, message }) => `${nameMap.get(activityId) || "Activity"}: ${message}`)
            .join("; ")
          showError("Failed to update status for some activities", detail)
        }

        setSelectedActivities(failures.map(item => item.activityId))
        if (failures.length === 0) {
          setShowActivityBulkStatusModal(false)
        }
        await onRefresh?.()
      } catch (error) {
        console.error("Bulk activity status update failed", error)
        showError(
          "Bulk activity status update failed",
          error instanceof Error ? error.message : "Unable to update activity status."
        )
      } finally {
        setActivityBulkActionLoading(false)
      }
    },
    [selectedActivities, opportunity?.activities, onRefresh, showError, showSuccess]
  )

  const handleBulkActivityDelete = useCallback(async () => {
    if (selectedActivities.length === 0) {
      showError("No activities selected", "Select at least one activity to delete.")
      return
    }

    const confirmDelete = window.confirm(
      `Delete ${selectedActivities.length} selected activit${selectedActivities.length === 1 ? "y" : "ies"}? This action cannot be undone.`
    )
    if (!confirmDelete) {
      return
    }

    setActivityBulkActionLoading(true)
    try {
      const outcomes = await Promise.allSettled(
        selectedActivities.map(async activityId => {
          const response = await fetch(`/api/activities/${activityId}`, { method: "DELETE" })
          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error || "Failed to delete activity")
          }
          return activityId
        })
      )

      const successes: string[] = []
      const failures: Array<{ activityId: string; message: string }> = []
      outcomes.forEach((result, index) => {
        const activityId = selectedActivities[index]
        if (result.status === "fulfilled") {
          successes.push(activityId)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : "Unexpected error"
          failures.push({ activityId, message })
        }
      })

      if (successes.length > 0) {
        showSuccess(
          `Deleted ${successes.length} activit${successes.length === 1 ? "y" : "ies"}`,
          "The selected activities have been removed."
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(
          (opportunity?.activities ?? []).map(activity => [
            activity.id,
            activity.description || activity.activityType || "Activity"
          ])
        )
        const detail = failures
          .map(({ activityId, message }) => `${nameMap.get(activityId) || "Activity"}: ${message}`)
          .join("; ")
        showError("Failed to delete some activities", detail)
      }

      setSelectedActivities(failures.map(item => item.activityId))
      await onRefresh?.()
    } catch (error) {
      console.error("Bulk activity delete failed", error)
      showError(
        "Bulk activity delete failed",
        error instanceof Error ? error.message : "Unable to delete activities."
      )
    } finally {
      setActivityBulkActionLoading(false)
    }
  }, [selectedActivities, opportunity?.activities, onRefresh, showError, showSuccess])

  const handleActivityExportCsv = useCallback(() => {
    if (selectedActivities.length === 0) {
      showError("No activities selected", "Select at least one activity to export.")
      return
    }

    const rows = paginatedActivities.filter(row => selectedActivities.includes(row.id))
    if (rows.length === 0) {
      showError("Activities unavailable", "Unable to locate the selected activities. Refresh and try again.")
      return
    }

    const headers = [
      "Activity Date",
      "Activity Type",
      "Description",
      "Activity Owner",
      "Created By",
      "Status",
      "File Name",
      "Attachment"
    ]

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) {
        return ""
      }
      const stringValue = String(value)
      return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue
    }

    const formatDateValue = (value: string | Date | null | undefined) => {
      if (!value) {
        return ""
      }
      const stringValue = value instanceof Date ? value.toISOString() : value
      return formatDate(stringValue)
    }

    const lines = [
      headers.join(","),
      ...rows.map(row =>
        [
          formatDateValue(row.activityDate),
          row.activityType ?? "",
          row.description ?? "",
          row.activityOwner ?? "",
          row.createdBy ?? "",
          row.activityStatus ?? "",
          row.fileName ?? "",
          row.attachment ?? ""
        ]
          .map(escapeCsv)
          .join(",")
      )
    ]

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
    link.href = url
    link.download = `activities-export-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    showSuccess(
      `Exported ${rows.length} activity${rows.length === 1 ? "" : "ies"}`,
      "Check your downloads for the CSV file."
    )
  }, [selectedActivities, paginatedActivities, showError, showSuccess])

  const activityTableColumns = useMemo(() => {
    return activityPreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_: unknown, row: OpportunityActivityRow) => {
            const checked = selectedActivities.includes(row.id)
            const activeValue = !!row.active

            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label
                  className="flex cursor-pointer items-center justify-center"
                  onClick={event => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select activity ${row.id}`}
                    onChange={() => handleActivitySelect(row.id, !checked)}
                  />
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                      checked
                        ? "border-primary-500 bg-primary-600 text-white"
                        : "border-gray-300 bg-white text-transparent"
                    )}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    handleToggleActivityStatus(row, !activeValue)
                  }}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  title={activeValue ? "Active" : "Inactive"}
                >
                  <span
                    className={cn(
                      "absolute inset-0 rounded-full transition-colors",
                      activeValue ? "bg-primary-600" : "bg-gray-300"
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                      activeValue ? "translate-x-5" : "translate-x-1"
                    )}
                  />
                </button>
                {!activeValue && (
                  <button
                    type="button"
                    className="p-1 text-red-500 transition-colors hover:text-red-700"
                    onClick={event => {
                      event.stopPropagation()
                      handleDeleteActivity(row)
                    }}
                    aria-label="Delete activity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          }
        }
      }

      if (column.id === "activityDate") {
        return {
          ...column,
          render: (value: unknown) => {
            if (!value) {
              return "--"
            }
            const dateValue =
              value instanceof Date ? value.toISOString() : typeof value === "string" ? value : String(value)
            return formatDate(dateValue)
          }
        }
      }

      return {
        ...column,
        render: (value: unknown) =>
          value === null || value === undefined || String(value).trim().length === 0 ? "--" : String(value)
      }
    })
  }, [activityPreferenceColumns, selectedActivities, handleActivitySelect, handleToggleActivityStatus, handleDeleteActivity])

  const handleToggleLineItemActive = useCallback(
    async (lineItemId: string, nextActive: boolean, lineItemLabel?: string) => {
      const previousActive =
        lineItemStatusOverrides[lineItemId] ?? productRows.find(row => row.id === lineItemId)?.isActive ?? true

      setLineItemStatusOverrides(current => ({
        ...current,
        [lineItemId]: nextActive
      }))

      setLineItemToggleLoading(current => ({
        ...current,
        [lineItemId]: true
      }))

      try {
        const response = await fetch(`/api/opportunities/line-items/${lineItemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: nextActive })
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? "Failed to update product status")
        }

        showSuccess(
          nextActive ? "Product activated" : "Product inactivated",
          `${lineItemLabel ?? "Line item"} has been marked ${nextActive ? "active" : "inactive"}.`
        )

        await onRefresh?.()
      } catch (error) {
        console.error(error)
        setLineItemStatusOverrides(current => {
          const copy = { ...current }
          if (previousActive === undefined) {
            delete copy[lineItemId]
          } else {
            copy[lineItemId] = previousActive
          }
          return copy
        })
        const message = error instanceof Error ? error.message : "Unable to update product status"
        showError("Unable to update product", message)
      } finally {
        setLineItemToggleLoading(current => {
          const { [lineItemId]: _ignored, ...rest } = current
          return rest
        })
      }
    },
    [lineItemStatusOverrides, onRefresh, productRows, showError, showSuccess]
  )

  const handleBulkDeleteLineItems = useCallback(() => {
    if (!opportunity) {
      showError("Unable to delete products", "Opportunity data is unavailable.")
      return
    }

    const targets = opportunity.lineItems.filter(item => selectedLineItems.includes(item.id))
    if (targets.length === 0) {
      showError("Nothing selected", "Select at least one product line item to delete.")
      return
    }

    setLineItemDeleteError(null)
    setLineItemBulkDeleteTargets(targets)
  }, [opportunity, selectedLineItems, showError])

  const handleBulkCloneLineItems = useCallback(async () => {
    if (!opportunity) {
      showError("Unable to clone products", "Opportunity data is unavailable.")
      return
    }

    if (selectedLineItems.length === 0) {
      showError("Nothing selected", "Select at least one product line item to clone.")
      return
    }

    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.id)}/line-items/clone`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineItemIds: selectedLineItems })
        }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error ?? "Failed to clone product line items"
        throw new Error(message)
      }

      const payload = await response.json().catch(() => null)
      const clonedCount: number =
        typeof payload?.clonedCount === "number" ? payload.clonedCount : selectedLineItems.length

      showSuccess(
        "Products cloned",
        `${clonedCount} product line item${clonedCount === 1 ? "" : "s"} cloned.`
      )
      await onRefresh?.()
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Unable to clone product line items"
      showError("Clone failed", message)
    }
  }, [opportunity, selectedLineItems, onRefresh, showError, showSuccess])

  const handleBulkExportLineItems = useCallback(() => {
    if (selectedProductRows.length === 0) {
      showError("Nothing selected", "Select at least one product line item to export.")
      return
    }

    const headers = [
      "Product",
      "Product Code",
      "Revenue Type",
      "Quantity",
      "Unit Price",
      "Expected Usage",
      "Expected Revenue",
      "Expected Commission",
      "Start Date",
      "End Date",
      "Distributor",
      "Vendor",
      "Active"
    ]

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) {
        return ""
      }
      const stringValue = String(value)
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }

    const lines = selectedProductRows.map(row =>
      [
        row.productName,
        row.productCode,
        getRevenueTypeLabel(row.revenueType) ?? row.revenueType ?? "",
        row.quantity,
        row.unitPrice,
        row.expectedUsage,
        row.expectedRevenue,
        row.expectedCommission,
        row.revenueStartDate,
        row.revenueEndDate,
        row.distributorName,
        row.vendorName,
        row.isActive ? "Active" : "Inactive"
      ].map(escapeCsv).join(",")
    )

    const csvContent = [headers.join(","), ...lines].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = `opportunity-products-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showSuccess(
      "Export ready",
      `${selectedProductRows.length} product line item${selectedProductRows.length === 1 ? "" : "s"} exported.`
    )
  }, [selectedProductRows, showError, showSuccess])

  const performBulkStatusUpdate = useCallback(
    async (targetIds: string[], nextActive: boolean) => {
      if (targetIds.length === 0) {
        showError("Nothing selected", "Select at least one product line item first.")
        return
      }

      setLineItemBulkActionLoading(true)
      try {
        const responses = await Promise.allSettled(
          targetIds.map(async id => {
            const response = await fetch(`/api/opportunities/line-items/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ active: nextActive })
            })
            if (!response.ok) {
              const payload = await response.json().catch(() => null)
              throw new Error(payload?.error ?? "Failed to update product status")
            }
            return id
          })
        )

        const successfulIds = responses
          .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
          .map(result => result.value)

        const failedCount = responses.length - successfulIds.length

        if (successfulIds.length > 0) {
          setLineItemStatusOverrides(current => {
            const next = { ...current }
            successfulIds.forEach(id => {
              next[id] = nextActive
            })
            return next
          })

          showSuccess(
            nextActive ? "Products activated" : "Products inactivated",
            `${successfulIds.length} product line item${successfulIds.length === 1 ? "" : "s"} updated.`
          )

          await onRefresh?.()
        }

        if (failedCount > 0) {
          showError(
            "Some updates failed",
            `${failedCount} product line item${failedCount === 1 ? "" : "s"} could not be updated. Try again.`
          )
        }
      } catch (error) {
        console.error(error)
        const message = error instanceof Error ? error.message : "Unable to update product status"
        showError("Bulk update failed", message)
      } finally {
        setLineItemBulkActionLoading(false)
      }
    },
    [onRefresh, showError, showSuccess]
  )

  const handleBulkActivateLineItems = useCallback(() => {
    void performBulkStatusUpdate(selectedLineItems, true)
  }, [performBulkStatusUpdate, selectedLineItems])

  const handleBulkDeactivateLineItems = useCallback(() => {
    void performBulkStatusUpdate(selectedLineItems, false)
  }, [performBulkStatusUpdate, selectedLineItems])

  const handleConfirmBulkDeleteLineItems = useCallback(async () => {
    if (lineItemBulkDeleteTargets.length === 0) {
      return
    }

    setLineItemBulkActionLoading(true)
    setLineItemDeleteError(null)

    try {
      const responses = await Promise.allSettled(
        lineItemBulkDeleteTargets.map(async item => {
          const response = await fetch(`/api/opportunities/line-items/${item.id}`, { method: "DELETE" })
          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? "Failed to delete line item")
          }
          return item.id
        })
      )

      const successfulIds = responses
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map(result => result.value)

      const failedCount = responses.length - successfulIds.length

      if (successfulIds.length > 0) {
        showSuccess(
          "Line items deleted",
          `${successfulIds.length} product line item${successfulIds.length === 1 ? "" : "s"} removed.`
        )
        setSelectedLineItems(previous => previous.filter(id => !successfulIds.includes(id)))
        await onRefresh?.()
      }

      if (failedCount > 0) {
        showError(
          "Some deletions failed",
          `${failedCount} line item${failedCount === 1 ? "" : "s"} could not be deleted. Try again later.`
        )
      }
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Unable to delete line items"
      showError("Delete failed", message)
    } finally {
      setLineItemBulkActionLoading(false)
      setLineItemBulkDeleteTargets([])
    }
  }, [lineItemBulkDeleteTargets, onRefresh, showError, showSuccess])

  const handleCancelBulkDeleteLineItems = useCallback(() => {
    if (lineItemBulkActionLoading) {
      return
    }
    setLineItemBulkDeleteTargets([])
    setLineItemDeleteError(null)
  }, [lineItemBulkActionLoading])

  const productPagination = useMemo(() => {
    const total = filteredProductRows.length
    const totalPages = Math.max(Math.ceil(total / productPageSize), 1)
    return {
      page: productCurrentPage,
      pageSize: productPageSize,
      total,
      totalPages
    }
  }, [filteredProductRows.length, productCurrentPage, productPageSize])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredProductRows.length / productPageSize), 1)
    if (productCurrentPage > maxPage) {
      setProductCurrentPage(maxPage)
    }
  }, [filteredProductRows.length, productPageSize, productCurrentPage])

  const handleProductPageChange = useCallback((page: number) => {
    setProductCurrentPage(page)
  }, [])

  const handleProductPageSizeChange = useCallback((pageSize: number) => {
    setProductPageSize(pageSize)
    setProductCurrentPage(1)
  }, [])

  useEffect(() => {
    setSelectedLineItems(previous =>
      previous.filter(id => filteredProductRows.some(row => row.id === id))
    )
  }, [filteredProductRows])

  useEffect(() => {
    setLineItemStatusOverrides({})
    setSelectedLineItems([])
  }, [opportunity?.id])
  const productTableColumns = useMemo(() => {
    return productPreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_: unknown, row: { id: string; productName: string; isActive: boolean }) => {
            const checked = selectedLineItems.includes(row.id)
            const activeValue = row.isActive !== false
            const toggleDisabled = !canModifyLineItems || lineItemToggleLoading[row.id] || lineItemBulkActionLoading
            const target = opportunity?.lineItems.find(item => item.id === row.id) ?? null

            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label
                  className="flex cursor-pointer items-center justify-center"
                  onClick={event => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select product line item ${row.productName}`}
                    onChange={() => handleLineItemSelect(row.id, !checked)}
                  />
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                      checked
                        ? "border-primary-500 bg-primary-600 text-white"
                        : "border-gray-300 bg-white text-transparent"
                    )}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>

                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    if (!canModifyLineItems || toggleDisabled) {
                      return
                    }
                    void handleToggleLineItemActive(row.id, !activeValue, row.productName)
                  }}
                  className={cn(
                    "relative inline-flex items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    "h-6 w-11",
                    activeValue ? "bg-primary-600" : "bg-gray-300",
                    toggleDisabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-primary-700"
                  )}
                  aria-label={activeValue ? "Mark product inactive" : "Mark product active"}
                  disabled={toggleDisabled}
                  aria-disabled={toggleDisabled}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                      activeValue ? "translate-x-5" : "translate-x-1",
                      toggleDisabled ? "opacity-80" : ""
                    )}
                  />
                </button>

                {!activeValue && (
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      className={cn(
                        "rounded p-1 transition-colors",
                        canModifyLineItems && target
                          ? "text-red-500 hover:text-red-600"
                          : "cursor-not-allowed text-gray-400"
                      )}
                      onClick={event => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (!target || !canModifyLineItems) {
                          return
                        }
                        setLineItemDeleteError(null)
                        setLineItemToDelete(target)
                      }}
                      aria-label="Delete line item"
                      disabled={!canModifyLineItems || !target}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          }
        }
      }

      if (["unitPrice", "expectedRevenue", "expectedCommission"].includes(column.id)) {
        return {
          ...column,
          render: (value: unknown) => formatCurrency(typeof value === "number" ? value : Number(value) || 0)
        }
      }

      if (["quantity", "expectedUsage"].includes(column.id)) {
        return {
          ...column,
          render: (value: unknown) => formatNumber(typeof value === "number" ? value : Number(value) || 0)
        }
      }

      if (["revenueStartDate", "revenueEndDate", "createdAt", "updatedAt"].includes(column.id)) {
        return {
          ...column,
          render: (value: unknown) => formatDate(typeof value === "string" ? value : String(value ?? ""))
        }
      }

      if (column.id === "productName") {
        return {
          ...column,
          render: (value: unknown, row: any) => {
            const displayValue = value === null || value === undefined ? "--" : String(value)
            return (
              <div className="flex flex-col leading-tight">
                <span className="font-medium text-gray-900">{displayValue}</span>
                {row.productCode ? (
                  <span className="text-xs text-gray-500">{String(row.productCode)}</span>
                ) : null}
              </div>
            )
          }
        }
      }

      return column
    })
  }, [
    productPreferenceColumns,
    selectedLineItems,
    canModifyLineItems,
    lineItemToggleLoading,
    lineItemBulkActionLoading,
    opportunity,
    handleLineItemSelect,
    handleToggleLineItemActive
  ])

  const handleConfirmDeleteLineItem = useCallback(async () => {
    if (!lineItemToDelete) {
      return
    }

    setLineItemDeleteLoading(true)
    setLineItemDeleteError(null)

    try {
      const response = await fetch(`/api/opportunities/line-items/${lineItemToDelete.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error ?? "Failed to delete line item"
        throw new Error(message)
      }

      showSuccess("Line item deleted", "The product has been removed from this opportunity.")
      await onRefresh?.()
      setLineItemToDelete(null)
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : "Unable to delete line item"
      setLineItemDeleteError(message)
      showError("Unable to delete line item", message)
    } finally {
      setLineItemDeleteLoading(false)
    }
  }, [lineItemToDelete, onRefresh, showError, showSuccess]);

  const productBulkActions = useMemo<BulkActionsGridProps>(
    () => ({
      selectedCount: selectedLineItems.length,
      isBusy: lineItemBulkActionLoading || lineItemDeleteLoading,
      entityName: "product line items",
      actions: [
        {
          key: "clone",
          label: "Clone",
          icon: Copy,
          tone: "primary",
          onClick: handleBulkCloneLineItems,
          tooltip: count =>
            count === 1
              ? "Clone this product line item"
              : `Clone ${count} product line items`
        },
        {
          key: "delete",
          label: "Delete",
          icon: Trash2,
          tone: "danger",
          onClick: handleBulkDeleteLineItems,
          tooltip: count => `Delete ${count} product${count === 1 ? "" : "s"}`,
        },
        {
          key: "export",
          label: "Export CSV",
          icon: Download,
          tone: "info",
          onClick: handleBulkExportLineItems,
          tooltip: count => `Export ${count} product${count === 1 ? "" : "s"} to CSV`,
        },
        {
          key: "activate",
          label: "Mark Active",
          icon: ToggleRight,
          tone: "primary",
          onClick: handleBulkActivateLineItems,
          tooltip: count => `Mark ${count} product${count === 1 ? "" : "s"} active`,
        },
        {
          key: "deactivate",
          label: "Mark Inactive",
          icon: ToggleLeft,
          tone: "neutral",
          onClick: handleBulkDeactivateLineItems,
          tooltip: count => `Mark ${count} product${count === 1 ? "" : "s"} inactive`,
        },
      ],
    }),
    [
      selectedLineItems.length,
      lineItemBulkActionLoading,
      lineItemDeleteLoading,
      handleBulkCloneLineItems,
      handleBulkDeleteLineItems,
      handleBulkExportLineItems,
      handleBulkActivateLineItems,
      handleBulkDeactivateLineItems,
    ]
  )

  const revenueBulkActions = useMemo<BulkActionsGridProps>(
    () => ({
      selectedCount: selectedRevenueSchedules.length,
      entityName: "revenue schedules",
      isBusy: revenueBulkBusy,
      actions: [
        {
          key: "revenue-clone",
          label: "Clone",
          icon: Copy,
          tone: "primary",
          onClick: handleRevenueCloneSchedule,
          tooltip: count => (count === 1 ? "Clone this revenue schedule" : "Select exactly one schedule to clone"),
          disabled: selectedRevenueSchedules.length !== 1,
        },
        {
          key: "revenue-export",
          label: "Export CSV",
          icon: Download,
          tone: "info",
          onClick: handleRevenueExportCsv,
          tooltip: count => `Export ${count} schedule${count === 1 ? "" : "s"} to CSV`,
        },
      ],
    }),
    [selectedRevenueSchedules.length, revenueBulkBusy, handleRevenueCloneSchedule, handleRevenueExportCsv]
  )

  const roleBulkActions = useMemo<BulkActionsGridProps>(
    () => ({
      selectedCount: selectedRoles.length,
      entityName: "roles",
      actions: [
        {
          key: "role-export",
          label: "Export CSV",
          icon: Download,
          tone: "info",
          onClick: handleBulkRoleExportCsv,
          tooltip: count => `Export ${count} role${count === 1 ? "" : "s"} to CSV`,
        },
      ],
    }),
    [selectedRoles.length, handleBulkRoleExportCsv]
  )

  const activityBulkActions = useMemo(
    () =>
      buildStandardBulkActions({
        selectedCount: selectedActivities.length,
        isBusy: activityBulkActionLoading,
        entityLabelPlural: "activities",
        labels: {
          delete: "Delete",
          reassign: "Change Owner",
          status: "Update Status",
          export: "Export",
        },
        tooltips: {
          delete: count => `Delete ${count} activit${count === 1 ? "y" : "ies"}`,
          reassign: count => `Change owner for ${count} activit${count === 1 ? "y" : "ies"}`,
          status: count => `Update status for ${count} activit${count === 1 ? "y" : "ies"}`,
          export: count => `Export ${count} activit${count === 1 ? "y" : "ies"} to CSV`,
        },
        onDelete: handleBulkActivityDelete,
        onReassign: openActivityBulkOwnerModal,
        onStatus: openActivityBulkStatusModal,
        onExport: handleActivityExportCsv,
      }),
    [
      selectedActivities.length,
      activityBulkActionLoading,
      handleBulkActivityDelete,
      openActivityBulkOwnerModal,
      openActivityBulkStatusModal,
      handleActivityExportCsv,
    ]
  )

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-sm text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        Loading opportunity details...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700">
        <p className="text-base font-semibold text-rose-800">Unable to load opportunity details</p>
        <p>{error}</p>
        {onRefresh ? (
          <button
            type="button"
            onClick={() => onRefresh()}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Try again
          </button>
        ) : null}
      </div>
    )
  }

  if (!opportunity) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        <p className="text-base font-semibold text-gray-900">Opportunity not found</p>
        <p>This record may have been removed or you might not have access to view it.</p>
      </div>
    )
  }

  const headerNode = shouldEnableInline ? (
    <EditableOpportunityHeader
      opportunity={opportunity}
      editor={editor}
      ownerOptions={ownerSelectOptions}
      ownersLoading={ownersLoading}
      onSave={handleSaveEdits}
    />
  ) : (
    <OpportunityHeader opportunity={opportunity} history={history} onEdit={onEdit} />
  )

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 sm:px-6 lg:px-8">
          <div className="w-full xl:max-w-[1800px]">
            <div className="flex flex-col gap-4">
              {headerNode}

            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
              <div className="flex flex-wrap gap-1 border-x border-t border-gray-200 bg-gray-100 pt-2 px-3 pb-0">
                {DETAIL_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabSelect(tab.id)}
                    className={cn(
                      "rounded-t-md border px-3 py-1.5 text-sm font-semibold shadow-sm transition",
                      activeTab === tab.id
                        ? "-mb-[1px] border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                        : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:from-blue-200 hover:to-blue-300 hover:border-blue-400"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                {activeTab === "summary" ? (
                  <div className="border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-3 px-3 pb-3">
                    <SummaryTab opportunity={opportunity} />
                  </div>
                ) : activeTab === "products" ? (
                  <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-1 border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0 px-3 pb-0">
                    <div className="border-t-2 border-t-primary-600 -mr-3 min-w-0 overflow-hidden">
                    <ListHeader
                      inTab
                      showCreateButton
                      onCreateClick={() => setShowCreateLineItemModal(true)}
                      createButtonLabel="Create/Add Product"
                      onSearch={setProductSearchQuery}
                      searchPlaceholder="Search line items"
                      showColumnFilters={false}
                      onSettingsClick={() => setShowProductColumnSettings(true)}
                      statusFilter={productStatusFilter}
                      onFilterChange={value =>
                        setProductStatusFilter(value === "inactive" ? "inactive" : "active")
                      }
                      hasUnsavedTableChanges={productHasUnsavedChanges}
                      isSavingTableChanges={productPreferencesSaving}
                      lastTableSaved={productLastSaved ?? undefined}
                      onSaveTableChanges={saveProductTablePreferences}
                      bulkActions={productBulkActions}
                    />
                    <div
                      className="flex flex-1 min-h-0 flex-col overflow-hidden"
                      ref={tableAreaRefCallback}
                    >
                      <DynamicTable
                        className="flex flex-col"
                        preferOverflowHorizontalScroll
                        columns={productTableColumns}
                        data={paginatedProductRows}
                        loading={productPreferencesLoading}
                        onColumnsChange={handleProductTableColumnsChange}
                        emptyMessage="No product line items"
                        maxBodyHeight={tableBodyMaxHeight}
                        pagination={productPagination}
                        onPageChange={handleProductPageChange}
                        onPageSizeChange={handleProductPageSizeChange}
                        selectedItems={selectedLineItems}
                        onItemSelect={handleLineItemSelect}
                        onSelectAll={handleSelectAllLineItems}
                        selectHeaderLabel="Select All"
                        alwaysShowPagination
                        fillContainerWidth
                      />
                    </div>
                    </div>
                  </div>
                ) : activeTab === "roles" ? (
                  <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-1 border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0 px-3 pb-0">
                    <div className="border-t-2 border-t-primary-600 -mr-3 min-w-0 overflow-hidden">
                      <ListHeader
                        inTab
                        showCreateButton
                        createButtonLabel="Add Role"
                        onCreateClick={() => setShowCreateRoleModal(true)}
                        onSearch={setRolesSearchQuery}
                        searchPlaceholder="Search roles"
                        filterColumns={ROLE_FILTER_COLUMNS}
                        columnFilters={roleColumnFilters}
                        onColumnFiltersChange={setRoleColumnFilters}
                        onSettingsClick={() => setShowRoleColumnSettings(true)}
                        statusFilter={roleStatusFilter}
                        onFilterChange={value =>
                          setRoleStatusFilter(value === "inactive" ? "inactive" : "active")
                        }
                        hasUnsavedTableChanges={roleHasUnsavedChanges}
                        isSavingTableChanges={rolePreferencesSaving}
                        lastTableSaved={roleLastSaved ?? undefined}
                        onSaveTableChanges={saveRolePreferences}
                        bulkActions={roleBulkActions}
                      />
                      <div
                        className="flex flex-1 min-h-0 flex-col overflow-hidden"
                        ref={tableAreaRefCallback}
                      >
                        <DynamicTable
                          key={rolePreferenceColumns.map(c => `${c.id}:${c.hidden ? 0 : 1}`).join("|")}
                          className="flex flex-col"
                          preferOverflowHorizontalScroll
                          columns={roleTableColumns}
                          data={paginatedRoleRows}
                          loading={rolePreferencesLoading}
                          onColumnsChange={handleRoleColumnsChange}
                          emptyMessage="No roles found for this opportunity"
                          maxBodyHeight={tableBodyMaxHeight}
                          pagination={rolePagination}
                          onPageChange={handleRolePageChange}
                          onPageSizeChange={handleRolePageSizeChange}
                          selectedItems={selectedRoles}
                          onItemSelect={(itemId: string, selected: boolean) => handleRoleSelect(itemId, selected)}
                          onSelectAll={handleSelectAllRoles}
                          selectHeaderLabel="Select All"
                          fillContainerWidth
                          alwaysShowPagination
                        />
                      </div>
                    </div>
                  </div>
                ) : activeTab === "revenue-schedules" ? (
                  <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-1 border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0 px-3 pb-0">
                    <div className="border-t-2 border-t-primary-600 -mr-3 min-w-0 overflow-hidden">
                      <ListHeader
                        inTab
                        onCreateClick={() => setShowRevenueCreateModal(true)}
                        showCreateButton={Boolean(opportunity)}
                        onSearch={setRevenueSearchQuery}
                        searchPlaceholder="Search revenue schedules"
                        filterColumns={REVENUE_FILTER_COLUMNS}
                        columnFilters={revenueColumnFilters}
                        onColumnFiltersChange={setRevenueColumnFilters}
                        onSettingsClick={() => setShowRevenueColumnSettings(true)}
                        showStatusFilter={false}
                        leftAccessory={
                          <StatusFilterDropdown
                            value={revenueStatusFilter}
                            onChange={value => {
                              setRevenueStatusFilter(value)
                              setRevenueCurrentPage(1)
                            }}
                          />
                        }
                        hasUnsavedTableChanges={revenueHasUnsavedChanges}
                        isSavingTableChanges={revenuePreferencesSaving}
                        lastTableSaved={revenueLastSaved ?? undefined}
                        onSaveTableChanges={saveRevenuePreferences}
                        bulkActions={revenueBulkActions}
                      />
                      <div
                        className="flex flex-1 min-h-0 flex-col overflow-hidden"
                        ref={tableAreaRefCallback}
                      >
                        <DynamicTable
                          className="flex flex-col"
                          preferOverflowHorizontalScroll
                          columns={revenueTableColumns}
                          data={paginatedRevenueRows}
                          loading={revenuePreferencesLoading}
                          onColumnsChange={handleRevenueColumnsChange}
                          emptyMessage="No revenue schedules available for this opportunity"
                          maxBodyHeight={tableBodyMaxHeight}
                          pagination={revenuePagination}
                          onPageChange={handleRevenuePageChange}
                          onPageSizeChange={handleRevenuePageSizeChange}
                          selectedItems={selectedRevenueSchedules}
                          onItemSelect={handleRevenueSelect}
                          onSelectAll={handleSelectAllRevenue}
                          selectHeaderLabel="Select All"
                          fillContainerWidth
                          alwaysShowPagination
                        />
                      </div>
                    </div>
                  </div>
                ) : activeTab === "activities" ? (
                  <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-1 border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0 px-3 pb-0">
                    <div className="border-t-2 border-t-primary-600 -mr-3 min-w-0 overflow-hidden">
                      <ListHeader
                        inTab
                        onCreateClick={handleCreateActivity}
                        showCreateButton={Boolean(opportunity)}
                        onSearch={setActivitySearchQuery}
                        searchPlaceholder="Search activities"
                        filterColumns={ACTIVITY_FILTER_COLUMNS}
                        columnFilters={activitiesColumnFilters}
                        onColumnFiltersChange={setActivitiesColumnFilters}
                        onSettingsClick={() => setShowActivityColumnSettings(true)}
                        statusFilter={activityStatusFilter}
                        onFilterChange={value =>
                          setActivityStatusFilter(value === "inactive" ? "inactive" : "active")
                        }
                        hasUnsavedTableChanges={activityHasUnsavedChanges}
                        isSavingTableChanges={activityPreferencesSaving}
                        lastTableSaved={activityLastSaved ?? undefined}
                        onSaveTableChanges={saveActivityPreferences}
                        bulkActions={activityBulkActions}
                      />
                      <div
                        className="flex flex-1 min-h-0 flex-col overflow-hidden"
                        ref={tableAreaRefCallback}
                      >
                        <DynamicTable
                          className="flex flex-col"
                          preferOverflowHorizontalScroll
                          columns={activityTableColumns}
                          data={paginatedActivities}
                          loading={activityPreferencesLoading}
                          onColumnsChange={handleActivityTableColumnsChange}
                          emptyMessage="No activities found for this opportunity"
                          maxBodyHeight={tableBodyMaxHeight}
                          pagination={activitiesPagination}
                          onPageChange={handleActivitiesPageChange}
                          onPageSizeChange={handleActivitiesPageSizeChange}
                          selectedItems={selectedActivities}
                          onItemSelect={handleActivitySelect}
                          onSelectAll={handleSelectAllActivities}
                          selectHeaderLabel="Select All"
                          onRowClick={(row: OpportunityActivityRow) => handleEditActivity(row)}
                          fillContainerWidth
                          alwaysShowPagination
                        />
                      </div>
                    </div>
                  </div>
                ) : activeTab === "details" ? (
                  <div className="border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-3 px-3 pb-3">
                    <DetailsIdentifiersTab opportunity={opportunity} />
                  </div>
                ) : activeTab === "history" ? (
                  <AuditHistoryTab
                    entityName="Opportunity"
                    entityId={opportunity.id}
                    tableAreaRefCallback={tableAreaRefCallback}
                    tableBodyMaxHeight={tableBodyMaxHeight}
                  />
                ) : null}
                </div>
              </div>

            <ColumnChooserModal
              isOpen={showRoleColumnSettings}
              columns={rolePreferenceColumns}
              onApply={handleRoleColumnsChange}
              onClose={async () => {
                setShowRoleColumnSettings(false)
                await saveRolePrefsOnModalClose()
              }}
            />

            <OpportunityRoleCreateModal
              isOpen={showCreateRoleModal}
              opportunityId={opportunity?.id ?? ""}
              onClose={() => setShowCreateRoleModal(false)}
              onSuccess={async () => {
                await onRefresh?.()
              }}
            />

            <ColumnChooserModal
              isOpen={showProductColumnSettings}
              columns={productPreferenceColumns}
              onApply={handleProductTableColumnsChange}
              onClose={async () => {
                setShowProductColumnSettings(false)
                await saveProductPrefsOnModalClose()
              }}
            />

            <ColumnChooserModal
              isOpen={showActivityColumnSettings}
              columns={activityPreferenceColumns}
              onApply={handleActivityTableColumnsChange}
              onClose={async () => {
                setShowActivityColumnSettings(false)
                await saveActivityPrefsOnModalClose()
              }}
            />

            <ColumnChooserModal
              isOpen={showRevenueColumnSettings}
              columns={revenuePreferenceColumns}
              onApply={handleRevenueColumnsChange}
              onClose={async () => {
                setShowRevenueColumnSettings(false)
                await saveRevenuePrefsOnModalClose()
              }}
            />
          </div>
        </div>
      </div>
      </div>

      {revenueBulkPrompt ? (
        <button
          type="button"
          className="fixed z-40 rounded-full border border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-lg transition hover:bg-primary-50 disabled:opacity-60"
          style={{ top: revenueBulkPrompt.anchor.top, left: revenueBulkPrompt.anchor.left }}
          onClick={handleRevenueApplyFillDown}
          disabled={revenueBulkApplying}
        >
          {revenueBulkApplying
            ? "Applying..."
            : `Apply to ${selectedRevenueSchedules.length} selected`}
        </button>
      ) : null}

      {opportunity && (
        <ActivityNoteCreateModal
          isOpen={activityModalOpen}
          context="opportunity"
          entityName={opportunity.name}
          opportunityId={opportunity.id}
          accountId={opportunity.account?.id}
          onClose={handleCloseActivityModal}
          onSuccess={handleActivityCreated}
        />
      )}

      <ActivityNoteEditModal
        isOpen={showActivityEditModal}
        activityId={editingActivity?.id ?? null}
        opportunityId={opportunity?.id}
        accountId={opportunity?.account?.id}
        onClose={handleCloseActivityEditModal}
        onSuccess={handleActivityEditSuccess}
      />

      <ActivityBulkOwnerModal
        isOpen={showActivityBulkOwnerModal}
        owners={ownerSelectOptions}
        onClose={() => setShowActivityBulkOwnerModal(false)}
        onSubmit={handleBulkActivityOwnerUpdate}
        isSubmitting={activityBulkActionLoading}
      />

      <ActivityBulkStatusModal
        isOpen={showActivityBulkStatusModal}
        onClose={() => setShowActivityBulkStatusModal(false)}
        onSubmit={handleBulkActivityStatusUpdate}
        isSubmitting={activityBulkActionLoading}
      />

      <OpportunityLineItemCreateModal
        isOpen={showCreateLineItemModal}
        opportunityId={opportunity.id}
        orderIdHouse={opportunity?.identifiers?.orderIdHouse}
        onClose={() => setShowCreateLineItemModal(false)}
        onSuccess={async () => {
          await onRefresh?.()
        }}
      />

      {/* Revenue Schedule Create Modal */}
      <RevenueScheduleCreateModal
        isOpen={showRevenueCreateModal}
        opportunityId={opportunity.id}
        opportunityName={opportunity.name}
        lineItems={opportunity.lineItems ?? []}
        schedules={opportunity.revenueSchedules ?? []}
        defaultCommissionSplits={{
          house: opportunity.houseSplitPercent ?? null,
          houseRep: opportunity.houseRepPercent ?? null,
          subagent: opportunity.subagentPercent ?? null
        }}
        onClose={() => setShowRevenueCreateModal(false)}
        onSuccess={async () => {
          setShowRevenueCreateModal(false)
          await onRefresh?.()
        }}
      />

      <RevenueScheduleCloneModal
        isOpen={showRevenueCloneModal}
        defaultDate={revenueCloneDefaultDate}
        submitting={revenueBulkBusy}
        onCancel={handleRevenueCloneCancel}
        onConfirm={handleRevenueConfirmClone}
      />

      <OpportunityLineItemEditModal
        isOpen={Boolean(editingLineItem)}
        opportunityId={opportunity.id}
        lineItem={editingLineItem}
        onClose={() => setEditingLineItem(null)}
        onSuccess={async () => {
          await onRefresh?.()
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(lineItemToDelete)}
        title="Delete Line Item"
        description={
          lineItemToDelete
            ? `Are you sure you want to delete ${lineItemToDelete.productName}? This action cannot be undone.`
            : "Are you sure you want to delete this line item?"
        }
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteLineItem}
        onCancel={() => {
          if (lineItemDeleteLoading) {
            return
          }
          setLineItemToDelete(null)
          setLineItemDeleteError(null)
        }}
        loading={lineItemDeleteLoading}
        error={lineItemDeleteError}
      />

      <ConfirmDialog
        isOpen={lineItemBulkDeleteTargets.length > 0}
        title="Delete Selected Line Items"
        description={
          lineItemBulkDeleteTargets.length === 1
            ? `Delete ${lineItemBulkDeleteTargets[0]?.productName ?? "this line item"}? This action cannot be undone.`
            : `Delete ${lineItemBulkDeleteTargets.length.toLocaleString()} selected product line items? This action cannot be undone.`
        }
        confirmLabel="Delete"
        onConfirm={handleConfirmBulkDeleteLineItems}
        onCancel={handleCancelBulkDeleteLineItems}
        loading={lineItemBulkActionLoading}
        error={lineItemDeleteError}
      />
    </>
  )
}



