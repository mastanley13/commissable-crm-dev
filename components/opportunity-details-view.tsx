"use client"

import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Copy, Loader2, Trash2, Calendar, Download, ToggleLeft, ToggleRight, ExternalLink } from "lucide-react"
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
import { TwoStageDeleteDialog } from "./two-stage-delete-dialog"
import { RevenueScheduleCreateModal } from "./revenue-schedule-create-modal"
import { useAuth } from "@/lib/auth-context"
import { useToasts } from "@/components/toast"
import type { DeletionConstraint } from "@/lib/deletion"
import { OpportunityRoleCreateModal } from "./opportunity-role-create-modal"
import { getOpportunityStageLabel, getOpportunityStageOptions, isOpportunityStageAutoManaged, isOpportunityStageValue, type OpportunityStageOption } from "@/lib/opportunity-stage"
import { getRevenueTypeLabel } from "@/lib/revenue-types"

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })

const normalizePageSize = (value: number): number => {
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(1, Math.floor(value)))
}
import { StatusFilterDropdown } from "@/components/status-filter-dropdown"
import { AuditHistoryTab } from "./audit-history-tab"
import { buildStandardBulkActions } from "@/components/standard-bulk-actions"
import type { BulkActionsGridProps } from "@/components/bulk-actions-grid"
import { RevenueScheduleCloneModal, type SourceScheduleData } from "@/components/revenue-schedule-clone-modal"
import { RevenueBulkApplyPanel } from "@/components/revenue-bulk-apply-panel"
import { TabDescription } from "@/components/section/TabDescription"

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
  "flex min-h-[28px] w-full min-w-0 max-w-[260px] items-center justify-between border-b-2 border-gray-300 bg-transparent pl-[3px] pr-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis tabular-nums"

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
type ContactOption = { value: string; label: string; accountName?: string }

const STAGE_OPTIONS: OpportunityStageOption[] = getOpportunityStageOptions()

const formatStageLabel = (option: OpportunityStageOption) =>
  option.autoManaged ? `${option.label} (auto-managed)` : option.label

const isAutoManagedStageValue = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false
  }
  return isOpportunityStageValue(value) && isOpportunityStageAutoManaged(value)
}

const formatProductBillingStatus = (status: unknown): string => {
  if (!status || typeof status !== "string") {
    return ""
  }

  switch (status) {
    case "ActiveBilling":
      return "Active - Billing"
    case "BillingEnded":
      return "Closed - Billing Ended"
    case "Provisioning":
      return "Provisioning"
    case "Cancelled":
      return "Cancelled"
    default:
      return status
  }
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
  { id: "productNameHouse", label: "House - Product Name", width: 240, minWidth: calculateMinWidth({ label: "House - Product Name", type: "text", sortable: true }), accessor: "productNameHouse", sortable: true },
  { id: "productNameVendor", label: "Vendor - Product Name", width: 240, minWidth: calculateMinWidth({ label: "Vendor - Product Name", type: "text", sortable: true }), accessor: "productNameVendor", sortable: true },
  {
    id: "partNumberVendor",
    label: "Vendor - Part Number",
    width: 200,
    minWidth: calculateMinWidth({ label: "Vendor - Part Number", type: "text", sortable: true }),
    accessor: "productCode",
    sortable: true,
    hidden: true
  },
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
  { id: "billingStatus", label: "Billing Status", width: 180, minWidth: calculateMinWidth({ label: "Billing Status", type: "text", sortable: true }), accessor: "billingStatus", sortable: true },
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
  { id: "distributorName", label: "Distributor" },
  { id: "accountName", label: "Account Name" },
  { id: "opportunityName", label: "Opportunity Name" }
]

export const REVENUE_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    type: "multi-action",
    hideable: false
  },
  { id: "status", label: "Status", width: 120, minWidth: 110, accessor: "status", sortable: true },
  { id: "distributorName", label: "Distributor Name", width: 200, minWidth: calculateMinWidth({ label: "Distributor Name", type: "text", sortable: true }), accessor: "distributorName", sortable: true },
  { id: "vendorName", label: "Vendor Name", width: 200, minWidth: calculateMinWidth({ label: "Vendor Name", type: "text", sortable: true }), accessor: "vendorName", sortable: true },
  { id: "opportunityName", label: "Opportunity Name", width: 220, minWidth: calculateMinWidth({ label: "Opportunity Name", type: "text", sortable: true }), accessor: "opportunityName", sortable: true },
  { id: "productNameVendor", label: "Vendor - Product Name", width: 220, minWidth: calculateMinWidth({ label: "Vendor - Product Name", type: "text", sortable: true }), accessor: "productNameVendor", sortable: true },
  { id: "scheduleDate", label: "Schedule Date", width: 160, minWidth: calculateMinWidth({ label: "Schedule Date", type: "text", sortable: true }), accessor: "scheduleDate", sortable: true },
  { id: "accountName", label: "Account Name", width: 220, minWidth: calculateMinWidth({ label: "Account Name", type: "text", sortable: true }), accessor: "accountName", sortable: true },
  { id: "scheduleNumber", label: "Revenue Schedule", width: 180, minWidth: calculateMinWidth({ label: "Revenue Schedule", type: "text", sortable: true }), accessor: "scheduleNumber", sortable: true },
  { id: "quantity", label: "Quantity", width: 100, minWidth: 90, accessor: "quantity", sortable: true },
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

const PRODUCT_CURRENCY_COLUMN_IDS = new Set([
  "unitPrice",
  "expectedRevenue",
  "expectedCommission"
])

const PRODUCT_NUMBER_COLUMN_IDS = new Set(["quantity"])

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
  isSynthetic?: boolean
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
    { label: "House - Account ID", value: identifiers.accountIdHouse },
    { label: "Vendor - Account ID", value: identifiers.accountIdVendor },
    { label: "Distributor - Account ID", value: identifiers.accountIdDistributor },
    { label: "House - Customer ID", value: identifiers.customerIdHouse },
    { label: "Vendor - Customer ID", value: identifiers.customerIdVendor },
    { label: "Distributor - Customer ID", value: identifiers.customerIdDistributor },
    { label: "Location ID", value: identifiers.locationId },
    { label: "House - Order ID", value: identifiers.orderIdHouse },
    { label: "Vendor - Order ID", value: identifiers.orderIdVendor },
    { label: "Distributor - Order ID", value: identifiers.orderIdDistributor },
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
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return "--"
  }
  return currencyFormatter.format(numeric)
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
  return percentFormatter.format(normalised)
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--"
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return "--"
  }
  return numberFormatter.format(numeric)
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "--"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "--"
  }

  // Treat all incoming timestamps as UTC-backed "calendar dates" so
  // that 2025-12-01T00:00:00.000Z always renders as 2025-12-01,
  // regardless of the user's local timezone. This avoids the
  // offâ€‘byâ€‘oneâ€‘day behavior (showing 2025-11-30, 2025-12-31, etc.).
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
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
  return `${year}-${month}-${day}`
}

function parseInputDateToISO(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
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
    errors.estimatedCloseDate = "Enter a valid date in YYYY-MM-DD format."
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
  const [referredByOptions, setReferredByOptions] = useState<ContactOption[]>([])
  const [referredByLoading, setReferredByLoading] = useState(false)
  const [showReferredByDropdown, setShowReferredByDropdown] = useState(false)
  const [subagentOptions, setSubagentOptions] = useState<Array<{ value: string; label: string }>>([])
  const [subagentLoading, setSubagentLoading] = useState(false)
  const [showSubagentDropdown, setShowSubagentDropdown] = useState(false)

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

  // Native date picker bridge for YYYY-MM-DD text field
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

  useEffect(() => {
    if (!showReferredByDropdown) {
      return
    }

    const controller = new AbortController()

    const fetchContacts = async () => {
      setReferredByLoading(true)
      try {
        const query = (referredField.value as string | undefined)?.trim() ?? ""
        const params = new URLSearchParams({
          page: "1",
          pageSize: "50"
        })

        if (query.length > 0) {
          params.set("q", query)
        }

        const response = await fetch(`/api/contacts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error("Failed to load contacts")
        }

        const payload = await response.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []

        const options: ContactOption[] = items.map(item => {
          const fullName = typeof item.fullName === "string" ? item.fullName.trim() : ""
          return {
            value: fullName || item.id,
            label: fullName || "Unnamed contact",
            accountName: typeof item.accountName === "string" ? item.accountName : undefined
          }
        })

        setReferredByOptions(options)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        console.error("Unable to load contacts for Referred By", error)
        setReferredByOptions([])
      } finally {
        setReferredByLoading(false)
      }
    }

    const debounce = setTimeout(() => {
      void fetchContacts()
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(debounce)
    }
  }, [referredField.value, showReferredByDropdown])

  useEffect(() => {
    if (!showSubagentDropdown) {
      return
    }

    const controller = new AbortController()

    const fetchSubagents = async () => {
      setSubagentLoading(true)
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "50",
          accountType: "Subagent",
          status: "Active"
        })

        const query = typeof subAgentField.value === "string" ? subAgentField.value.trim() : ""
        if (query.length > 0) {
          params.set("q", query)
        }

        const response = await fetch(`/api/accounts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error("Failed to load subagents")
        }

        const payload = await response.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []

        const options = items
          .map((item) => {
            const name = (item.accountName ?? "").trim()
            const legal = (item.accountLegalName ?? "").trim()
            const label =
              name && legal && name.toLowerCase() !== legal.toLowerCase()
                ? `${name} (${legal})`
                : name || legal || "Unnamed account"

            return {
              value: String(item.id ?? ""),
              label
            }
          })
          .filter(option => option.value.length > 0)

        setSubagentOptions(options)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        console.error("Unable to load subagents", error)
        setSubagentOptions([])
      } finally {
        setSubagentLoading(false)
      }
    }

    const debounce = setTimeout(() => {
      void fetchSubagents()
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(debounce)
    }
  }, [showSubagentDropdown, subAgentField.value])

  const renderRow = (
    label: string,
    control: ReactNode,
    error?: string
  ) => (
    <FieldRow label={label}>
      <div className="flex flex-col gap-1 w-full max-w-[260px]">
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
            <div className="relative w-full">
              <EditableField.Input
                className="w-full"
                value={(subAgentField.value as string) ?? ""}
                placeholder="Search or pick a subagent"
                onChange={event => {
                  subAgentField.onChange(event)
                  setShowSubagentDropdown(true)
                }}
                onFocus={() => setShowSubagentDropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowSubagentDropdown(false), 160)
                  subAgentField.onBlur()
                }}
              />
              {showSubagentDropdown && (subagentLoading || subagentOptions.length > 0) && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {subagentLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                  ) : (
                    subagentOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => {
                          editor.setField("subAgent", option.label)
                          setShowSubagentDropdown(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                      >
                        <div className="font-medium text-gray-900">{option.label}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
              {showSubagentDropdown &&
                !subagentLoading &&
                subagentOptions.length === 0 &&
                String(subAgentField.value ?? "").trim().length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="px-3 py-2 text-sm text-gray-500">No matching subagents found.</div>
                  </div>
                )}
            </div>,
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
                placeholder="YYYY-MM-DD"
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
                  const display = `${y}-${m}-${d}`
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
            <div className="relative flex flex-col gap-1 w-full max-w-[260px]">
              <EditableField.Input
                className="w-full"
                value={(referredField.value as string) ?? ""}
                placeholder="Type to search contacts..."
                onChange={event => {
                  referredField.onChange(event)
                  setShowReferredByDropdown(true)
                }}
                onFocus={() => setShowReferredByDropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowReferredByDropdown(false), 160)
                  referredField.onBlur()
                }}
              />
              {showReferredByDropdown && (referredByLoading || referredByOptions.length > 0) && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {referredByLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                  ) : (
                    referredByOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          editor.setField("referredBy", option.label)
                          setShowReferredByDropdown(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                      >
                        <div className="font-medium text-gray-900">{option.label}</div>
                        {option.accountName && (
                          <div className="text-xs text-gray-500">{option.accountName}</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
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
          <FieldRow label="Subagent %" lastEdited={fieldHistory['subagentPercent']} compact>
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
          <FieldRow label="House Rep %" lastEdited={fieldHistory['houseRepPercent']} compact>
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
          <FieldRow label="House Split %" lastEdited={fieldHistory['houseSplitPercent']} compact>
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
  { id: "products", label: "Products" },
  { id: "revenue-schedules", label: "Revenue Schedules" },
  { id: "activities", label: "Activities & Notes" },
  { id: "summary", label: "Summary" },
  { id: "roles", label: "Roles" },
  { id: "details", label: "Details" },
  { id: "history", label: "History" }
]

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  products: "This section displays all products included in this opportunity. Add, edit, or remove products to update pricing and expected revenue calculations.",
  "revenue-schedules": "This section shows the recurring revenue schedules tied to this opportunity. Revenue schedules track expected billing cycles, commission calculations, and payment timing.",
  activities: "This section provides a timeline of all activities, notes, tasks, and files associated with this opportunity. Add notes to track important updates or attach relevant documents.",
  summary: "This section provides a high-level overview of key opportunity metrics including total value, commission estimates, and status indicators at a glance.",
  roles: "This section defines the partner relationships and commission split assignments for this opportunity. Configure house, subagent, and representative allocations here.",
  details: "This section displays account, order, customer, location, and service IDs associated with this opportunity. These identifiers link the opportunity to external systems and records.",
  history: "This section shows a complete audit log of all changes made to this opportunity, including who made each change and when. Use the restore functionality to revert to previous versions if needed."
}

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
  const canManageAccounts = hasPermission("accounts.manage")
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
  const [rolePageSize, setRolePageSize] = useState(100)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [showRoleColumnSettings, setShowRoleColumnSettings] = useState(false)
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false)
  const [roleDeleteTargets, setRoleDeleteTargets] = useState<OpportunityRoleRow[]>([])
  const [showRoleDeleteDialog, setShowRoleDeleteDialog] = useState(false)

  const {
    columns: rolePreferenceColumns,
    loading: rolePreferencesLoading,
    saving: rolePreferencesSaving,
    pageSize: rolePreferencePageSize,
    handlePageSizeChange: persistRolePageSize,
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
  const [productPageSize, setProductPageSize] = useState(100)
  const [productSort, setProductSort] = useState<{ columnId: string; direction: "asc" | "desc" } | null>(null)
  const [showProductColumnSettings, setShowProductColumnSettings] = useState(false)
  const [showCreateLineItemModal, setShowCreateLineItemModal] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<OpportunityLineItemRecord | null>(null)
  const [lineItemToDelete, setLineItemToDelete] = useState<OpportunityLineItemRecord | null>(null)
  const [selectedLineItems, setSelectedLineItems] = useState<string[]>([])
  const [lineItemBulkActionLoading, setLineItemBulkActionLoading] = useState(false)
  const [lineItemToggleLoading, setLineItemToggleLoading] = useState<Record<string, boolean>>({})
  const [lineItemStatusOverrides, setLineItemStatusOverrides] = useState<Record<string, boolean>>({})
  const [lineItemBulkDeleteTargets, setLineItemBulkDeleteTargets] = useState<OpportunityLineItemRecord[]>([])

  const {
    columns: productPreferenceColumns,
    loading: productPreferencesLoading,
    saving: productPreferencesSaving,
    pageSize: productPreferencePageSize,
    handlePageSizeChange: persistProductPageSize,
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
  const [revenuePageSize, setRevenuePageSize] = useState(100)
  const [selectedRevenueSchedules, setSelectedRevenueSchedules] = useState<string[]>([])
  const [showRevenueColumnSettings, setShowRevenueColumnSettings] = useState(false)
  const [showRevenueCreateModal, setShowRevenueCreateModal] = useState(false)
  const [revenueBulkBusy, setRevenueBulkBusy] = useState(false)
  const [showRevenueCloneModal, setShowRevenueCloneModal] = useState(false)
  const [revenueCloneTargetId, setRevenueCloneTargetId] = useState<string | null>(null)
  const [revenueCloneDefaultDate, setRevenueCloneDefaultDate] = useState<string>("")
  const [revenueCloneSourceData, setRevenueCloneSourceData] = useState<SourceScheduleData | null>(null)
  const [revenueBulkPrompt, setRevenueBulkPrompt] = useState<RevenueFillDownPrompt | null>(null)
  const [revenueBulkApplying, setRevenueBulkApplying] = useState(false)
  const [revenueSort, setRevenueSort] = useState<{ columnId: string; direction: "asc" | "desc" } | null>(null)

  const {
    columns: revenuePreferenceColumns,
    loading: revenuePreferencesLoading,
    saving: revenuePreferencesSaving,
    pageSize: revenuePreferencePageSize,
    handlePageSizeChange: persistRevenuePageSize,
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
  const [activitiesPageSize, setActivitiesPageSize] = useState(100)
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
    pageSize: activityPreferencePageSize,
    handlePageSizeChange: persistActivityPageSize,
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
      isActive: role.active !== false,
      isSynthetic: false
    }))

    return baseRoles
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
  if (!rolePreferencePageSize) return
  const normalized = normalizePageSize(rolePreferencePageSize)
  if (normalized !== rolePageSize) {
    setRolePageSize(normalized)
    setRoleCurrentPage(1)
  }
}, [rolePreferencePageSize, rolePageSize])

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
    setShowRoleDeleteDialog(false)
    setRoleDeleteTargets([])
  }, [opportunity?.id])

  const selectedRoleRows = useMemo(() => {
    if (selectedRoles.length === 0) {
      return []
    }
    return roleRows.filter(row => !row.isSynthetic && selectedRoles.includes(row.id))
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
        setSelectedRoles(paginatedRoleRows.filter(row => !row.isSynthetic).map(row => row.id))
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
  const normalized = normalizePageSize(size)
  setRolePageSize(normalized)
  setRoleCurrentPage(1)
  void persistRolePageSize(normalized)
}, [persistRolePageSize])

  const roleTableColumns = useMemo(() => {
    return rolePreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_: unknown, row: OpportunityRoleRow) => {
            const disabled = Boolean(row.isSynthetic)
            const checked = !disabled && selectedRoles.includes(row.id)
            const labelSource = row.fullName || row.role || row.email

            return (
              <div className="flex items-center" data-disable-row-click="true">
                <label
                  className={cn(
                    "flex items-center justify-center",
                    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  )}
                  onClick={event => event.stopPropagation()}
                  title={disabled ? "Opportunity Owner is informational and cannot be deleted." : undefined}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={disabled}
                    aria-label={`Select ${labelSource || "role"}`}
                    onChange={event => {
                      event.stopPropagation()
                      handleRoleSelect(row.id, event.target.checked)
                      event.target.blur()
                    }}
                  />
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                      checked
                        ? "border-primary-500 bg-primary-600 text-white"
                        : disabled
                          ? "border-gray-200 bg-gray-100 text-transparent"
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

  const canDeleteRoles = hasAnyPermission(["opportunities.manage", "opportunities.edit.all"])

  const openBulkRoleDeleteDialog = useCallback(() => {
    if (!canDeleteRoles) {
      showError("Insufficient permissions", "Only admins can delete opportunity roles.")
      return
    }

    if (selectedRoleRows.length === 0) {
      showError("No roles selected", "Select at least one role to delete.")
      return
    }

    const targets = selectedRoleRows.filter(role => !role.isSynthetic)

    if (targets.length === 0) {
      showError("Roles unavailable", "The selected roles cannot be deleted.")
      return
    }

    setRoleDeleteTargets(targets)
    setShowRoleDeleteDialog(true)
  }, [canDeleteRoles, selectedRoleRows, showError])

  const closeRoleDeleteDialog = useCallback(() => {
    setShowRoleDeleteDialog(false)
    setRoleDeleteTargets([])
  }, [])

  const deleteRoleById = useCallback(async (
    roleId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedReason = typeof reason === "string" ? reason.trim() : ""
      const response = await fetch(`/api/opportunities/roles/${roleId}`, {
        method: "DELETE",
        ...(trimmedReason
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: trimmedReason })
            }
          : {})
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return { success: false, error: payload?.error ?? "Failed to delete role" }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete role"
      return { success: false, error: message }
    }
  }, [])

  const handleBulkPermanentRoleDelete = useCallback(async (
    entities: Array<{ id: string; name?: string }>,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!entities || entities.length === 0) {
      return { success: false, error: "No roles selected" }
    }

    const outcomes = await Promise.allSettled(entities.map(entity => deleteRoleById(entity.id, reason)))

    let successCount = 0
    const failures: Array<{ id: string; message: string }> = []

    outcomes.forEach((result, index) => {
      const id = entities[index]?.id ?? ""
      if (result.status === "fulfilled") {
        if (result.value.success) {
          successCount += 1
        } else {
          failures.push({ id, message: result.value.error ?? "Failed to delete role" })
        }
        return
      }
      const message = result.reason instanceof Error ? result.reason.message : "Failed to delete role"
      failures.push({ id, message })
    })

    if (successCount > 0) {
      showSuccess(
        `Deleted ${successCount} role${successCount === 1 ? "" : "s"}`,
        "The selected roles have been removed."
      )
      setSelectedRoles([])
      await onRefresh?.()
    }

    if (failures.length > 0) {
      const preview = failures
        .slice(0, 5)
        .map(item => `- ${item.id.slice(0, 8)}: ${item.message}`)
        .join("\n")
      return {
        success: false,
        error: `${failures.length} role(s) failed to delete.\n\n${preview}` +
          (failures.length > 5 ? `\n- and ${failures.length - 5} more` : "")
      }
    }

    return { success: true }
  }, [deleteRoleById, onRefresh, showSuccess])

  const canEditAnyLineItems = hasAnyPermission(["opportunities.manage"])
  const canEditAssignedLineItems = hasPermission("opportunities.edit.assigned")
  const ownsOpportunity = Boolean(authUser?.id && opportunity?.owner?.id === authUser.id)
  const canModifyLineItems = canEditAnyLineItems || (canEditAssignedLineItems && ownsOpportunity)
  const lineItemIds = useMemo(() => opportunity?.lineItems.map(item => item.id) ?? [], [opportunity?.lineItems])

  const productRows = useMemo(() => {
    if (!opportunity) {
      return []
    }

    return opportunity.lineItems.map(item => {
      const productName = item.productName ?? ""
      const productNameHouse = item.productNameHouse ?? productName
      const productNameVendor = item.productNameVendor ?? productName

      return {
        id: item.id,
        productId: item.productId,
        productName,
        productNameHouse,
        productNameVendor,
        productCode: item.productCode ?? "",
        revenueType: item.revenueType ?? "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        expectedRevenue: item.expectedRevenue,
        expectedCommission: item.expectedCommission,
        expectedUsage: item.expectedUsage,
        revenueStartDate: item.revenueStartDate,
        revenueEndDate: item.revenueEndDate,
        distributorId: item.distributorId ?? null,
        distributorName: item.distributorName ?? "",
        vendorId: item.vendorId ?? null,
        vendorName: item.vendorName ?? "",
        priceEach: item.priceEach ?? null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        status: item.status ?? null,
        billingStatus: formatProductBillingStatus(item.status),
        isActive: item.active !== false
      }
    })
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

    if (productSort) {
      const { columnId, direction } = productSort
      const multiplier = direction === "asc" ? 1 : -1
      const numericColumn =
        PRODUCT_CURRENCY_COLUMN_IDS.has(columnId) ||
        PRODUCT_NUMBER_COLUMN_IDS.has(columnId)

      const toComparable = (row: OpportunityLineItemRecord): number | string => {
        const raw = (row as any)?.[columnId]
        if (numericColumn) {
          const numeric = Number(raw)
          return Number.isFinite(numeric) ? numeric : 0
        }
        return raw === null || raw === undefined ? "" : String(raw).toLowerCase()
      }

      rows.sort((a, b) => {
        const aVal = toComparable(a)
        const bVal = toComparable(b)
        if (aVal < bVal) return -1 * multiplier
        if (aVal > bVal) return 1 * multiplier
        return 0
      })
    }

    return rows
  }, [effectiveProductRows, productStatusFilter, productSearchQuery, productColumnFilters, productSort])

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

  const revenueRows = useMemo<OpportunityRevenueScheduleRecord[]>(() => {
    if (!opportunity?.revenueSchedules || opportunity.revenueSchedules.length === 0) {
      return []
    }
    return opportunity.revenueSchedules.map(schedule => ({
      ...schedule,
      accountId: schedule.accountId ?? opportunity.account?.id ?? null,
      accountName: schedule.accountName ?? opportunity.account?.accountName ?? null,
      opportunityId: schedule.opportunityId ?? opportunity.id ?? null,
      opportunityName: schedule.opportunityName ?? opportunity.name ?? null
    }))
  }, [opportunity])

  const compareDefaultOpportunityRevenueScheduleSort = useCallback(
    (a: OpportunityRevenueScheduleRecord, b: OpportunityRevenueScheduleRecord) => {
      const normalizeText = (value: unknown) => {
        if (value === null || value === undefined) {
          return { missing: true, value: "" }
        }
        const text = String(value).trim().toLowerCase()
        return { missing: text.length === 0, value: text }
      }

      const normalizeDate = (value: string | null | undefined) => {
        const formatted = formatDate(value)
        if (!formatted || formatted === "--") {
          return { missing: true, value: "" }
        }
        return { missing: false, value: formatted }
      }

      const compareKey = (aKey: { missing: boolean; value: string }, bKey: { missing: boolean; value: string }) => {
        if (aKey.missing !== bKey.missing) {
          return aKey.missing ? 1 : -1
        }
        if (aKey.value === bKey.value) return 0
        return aKey.value.localeCompare(bKey.value)
      }

      const comparisons = [
        compareKey(normalizeText(a.distributorName), normalizeText(b.distributorName)),
        compareKey(normalizeText(a.vendorName), normalizeText(b.vendorName)),
        compareKey(normalizeText(a.opportunityName), normalizeText(b.opportunityName)),
        compareKey(normalizeText(a.productNameVendor), normalizeText(b.productNameVendor)),
        compareKey(normalizeDate(a.scheduleDate), normalizeDate(b.scheduleDate)),
        compareKey(normalizeText(a.scheduleNumber), normalizeText(b.scheduleNumber)),
        compareKey(normalizeText(a.id), normalizeText(b.id)),
      ]

      return comparisons.find(result => result !== 0) ?? 0
    },
    []
  )

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
          row.accountName,
          row.opportunityName,
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

    if (revenueSort) {
      const { columnId, direction } = revenueSort
      const multiplier = direction === "asc" ? 1 : -1
      const numericColumn =
        REVENUE_CURRENCY_COLUMN_IDS.has(columnId) ||
        REVENUE_PERCENT_COLUMN_IDS.has(columnId) ||
        REVENUE_NUMBER_COLUMN_IDS.has(columnId)

      const toComparable = (row: OpportunityRevenueScheduleRecord): number | string => {
        const raw = (row as any)?.[columnId]
        if (columnId === "scheduleDate") {
          const date = raw ? new Date(raw as string) : null
          return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0
        }
        if (numericColumn) {
          const numeric = Number(raw)
          return Number.isFinite(numeric) ? numeric : 0
        }
        return raw === null || raw === undefined ? "" : String(raw).toLowerCase()
      }

      rows.sort((a, b) => {
        const aVal = toComparable(a)
        const bVal = toComparable(b)

        if (typeof aVal === "number" && typeof bVal === "number") {
          if (aVal === bVal) return 0
          return aVal < bVal ? -1 * multiplier : 1 * multiplier
        }

        const aStr = String(aVal)
        const bStr = String(bVal)
        if (aStr === bStr) return 0
        return aStr < bStr ? -1 * multiplier : 1 * multiplier
      })
    } else {
      rows.sort(compareDefaultOpportunityRevenueScheduleSort)
    }

    return rows
  }, [
    revenueRows,
    revenueStatusFilter,
    revenueSearchQuery,
    revenueColumnFilters,
    revenueSort,
    compareDefaultOpportunityRevenueScheduleSort,
  ])

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

  const revenueCurrencyRenderer = useCallback((value: unknown) => {
    const numeric = typeof value === "number" ? value : Number(value) || 0
    return formatCurrency(numeric)
  }, [])

  const revenuePercentRenderer = useCallback((value: unknown) => {
    const numeric = typeof value === "number" ? value : Number(value) || 0
    return formatPercent(numeric)
  }, [])

  const revenueNumberRenderer = useCallback((value: unknown) => {
    const numeric = typeof value === "number" ? value : Number(value) || 0
    return formatNumber(numeric)
  }, [])

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
  if (!activityPreferencePageSize) return
  const normalized = normalizePageSize(activityPreferencePageSize)
  if (normalized !== activitiesPageSize) {
    setActivitiesPageSize(normalized)
    setActivitiesCurrentPage(1)
  }
}, [activityPreferencePageSize, activitiesPageSize])

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
  const normalized = normalizePageSize(size)
  setActivitiesPageSize(normalized)
  setActivitiesCurrentPage(1)
  void persistActivityPageSize(normalized)
}, [persistActivityPageSize])

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
  if (!revenuePreferencePageSize) return
  const normalized = normalizePageSize(revenuePreferencePageSize)
  if (normalized !== revenuePageSize) {
    setRevenuePageSize(normalized)
    setRevenueCurrentPage(1)
  }
}, [revenuePreferencePageSize, revenuePageSize])

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
    setRevenueSort(null)
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
  const normalized = normalizePageSize(size)
  setRevenuePageSize(normalized)
  setRevenueCurrentPage(1)
  void persistRevenuePageSize(normalized)
}, [persistRevenuePageSize])

  const handleRevenueSort = useCallback((columnId: string, direction: "asc" | "desc") => {
    setRevenueSort({ columnId, direction })
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

      if (selectedRevenueSchedules.length >= 1 && selectedRevenueSchedules.includes(rowId) && rect) {
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

  const handleRevenueApplyFillDown = useCallback(
    async (effectiveDate: string) => {
      if (!revenueBulkPrompt || selectedRevenueSchedules.length < 1) {
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
            patch: payload,
            effectiveDate
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
    },
    [onRefresh, revenueBulkPrompt, selectedRevenueSchedules, showError, showSuccess],
  )

  const selectedRevenueRows = useMemo(() => {
    if (selectedRevenueSchedules.length === 0) {
      return []
    }
    return filteredRevenueRows.filter(row => selectedRevenueSchedules.includes(row.id))
  }, [filteredRevenueRows, selectedRevenueSchedules])

  const revenueBulkDefaultEffectiveDate = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }, [])

  const revenueBulkPromptValueLabel = useMemo(() => {
    if (!revenueBulkPrompt) {
      return ""
    }
    const meta = revenueEditableColumnsMeta[revenueBulkPrompt.columnId]
    const value = revenueBulkPrompt.value
    if (meta.type === "currency") {
      return formatCurrency(value)
    }
    if (meta.type === "percent") {
      return formatPercent(value)
    }
    return formatNumber(value)
  }, [revenueBulkPrompt, revenueEditableColumnsMeta])

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

          const { decimals, type } = revenueEditableColumnsMeta[columnId]

          if (type === "currency") {
            return displayValue.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals
            })
          }

          if (type === "percent") {
            // Normalize: if value > 1, divide by 100 to convert to decimal form
            const normalized = displayValue > 1 ? displayValue / 100 : displayValue
            return normalized.toLocaleString("en-US", {
              style: "percent",
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals
            })
          }

          // type === "number"
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
            onFocus={() => {
              if (!spanRef) return
              if (selectedRevenueSchedules.length >= 1 && selectedRevenueSchedules.includes(row.id)) {
                setRevenueBulkPrompt({
                  columnId,
                  label,
                  value: displayValue,
                  rowId: row.id,
                  selectedCount: selectedRevenueSchedules.length,
                  anchor: {
                    top: spanRef.getBoundingClientRect().bottom + 8,
                    left: spanRef.getBoundingClientRect().right + 12
                  }
                })
              } else {
                setRevenueBulkPrompt(null)
              }
            }}
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
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select revenue schedule ${row.scheduleNumber ?? row.productNameVendor ?? row.id}`}
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
                    checked
                      ? "border-primary-500 bg-primary-600 text-white"
                      : "border-gray-300 bg-white text-transparent"
                  )}
                  onClick={event => {
                    event.stopPropagation()
                    handleRevenueSelect(row.id, !checked)
                  }}
                  onMouseDown={event => event.preventDefault()}
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                </button>
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

      if (column.id === "scheduleNumber") {
        return {
          ...column,
          render: (value: unknown, row: unknown) => {
            const label = String(value ?? '')
            const scheduleRow = row as OpportunityRevenueScheduleRecord | undefined
            const scheduleId = scheduleRow?.id

            if (!scheduleId || !label) {
              return <span className="text-gray-900">{label || "--"}</span>
            }

            return (
              <Link
                href={`/revenue-schedules/${scheduleId}`}
                className="cursor-pointer text-blue-600 hover:text-blue-800"
                onClick={(event) => event.stopPropagation()}
                prefetch={false}
              >
                {label}
              </Link>
            )
          }
        }
      }

      if (column.id === "productNameVendor") {
        return {
          ...column,
          render: (value: unknown, row: OpportunityRevenueScheduleRecord) => {
            const label = String(value ?? "")
            const productId = row.productId

            if (!productId || !label) {
              return <span className="text-gray-900">{label || "--"}</span>
            }

            return (
              <Link
                href={`/products/${productId}`}
                className="cursor-pointer text-blue-600 hover:text-blue-800"
                onClick={event => event.stopPropagation()}
                prefetch={false}
              >
                {label}
              </Link>
            )
          }
        }
      }

      if (column.id === "vendorName") {
        return {
          ...column,
          render: (value: unknown, row: OpportunityRevenueScheduleRecord) => {
            const displayValue = value === null || value === undefined ? "--" : String(value)
            if (row.vendorId) {
              return (
                <Link
                  href={`/accounts/${row.vendorId}`}
                  className="text-primary-700 hover:text-primary-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  onClick={event => event.stopPropagation()}
                  prefetch={false}
                >
                  {displayValue}
                </Link>
              )
            }
            return <span>{displayValue}</span>
          }
        }
      }

      if (column.id === "distributorName") {
        return {
          ...column,
          render: (value: unknown, row: OpportunityRevenueScheduleRecord) => {
            const displayValue = value === null || value === undefined ? "--" : String(value)
            if (row.distributorId) {
              return (
                <Link
                  href={`/accounts/${row.distributorId}`}
                  className="text-primary-700 hover:text-primary-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  onClick={event => event.stopPropagation()}
                  prefetch={false}
                >
                  {displayValue}
                </Link>
              )
            }
            return <span>{displayValue}</span>
          }
        }
      }

      if (column.id === "accountName") {
        return {
          ...column,
          render: (value: unknown, row: OpportunityRevenueScheduleRecord) => {
            const displayValue = value === null || value === undefined ? "--" : String(value)
            if (row.accountId) {
              return (
                <Link
                  href={`/accounts/${row.accountId}`}
                  className="text-primary-700 hover:text-primary-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  onClick={event => event.stopPropagation()}
                  prefetch={false}
                >
                  {displayValue}
                </Link>
              )
            }
            return <span>{displayValue}</span>
          }
        }
      }

      if (column.id === "opportunityName") {
        return {
          ...column,
          render: (value: unknown, row: OpportunityRevenueScheduleRecord) => {
            const displayValue = value === null || value === undefined ? "--" : String(value)
            if (row.opportunityId) {
              return (
                <Link
                  href={`/opportunities/${row.opportunityId}`}
                  className="text-primary-700 hover:text-primary-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  onClick={event => event.stopPropagation()}
                  prefetch={false}
                >
                  {displayValue}
                </Link>
              )
            }
            return <span>{displayValue}</span>
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
          render: revenueCurrencyRenderer
        }
      }

      if (REVENUE_PERCENT_COLUMN_IDS.has(column.id)) {
        return {
          ...column,
          render: revenuePercentRenderer
        }
      }

      if (REVENUE_NUMBER_COLUMN_IDS.has(column.id)) {
        return {
          ...column,
          render: revenueNumberRenderer
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
    isRevenueEditableColumn,
    revenueCurrencyRenderer,
    revenuePercentRenderer,
    revenueNumberRenderer
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
      "Vendor - Product Name",
      "Vendor Name",
      "Distributor Name",
      "Account Name",
      "Opportunity Name",
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
        row.accountName ?? "",
        row.opportunityName ?? "",
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
      showError("Select a single schedule", "Choose exactly one revenue schedule to copy/extend.")
      return
    }
    const sourceId = selectedRevenueSchedules[0]
    const targetRow = selectedRevenueRows.find(row => row.id === sourceId)
    if (!targetRow) {
      showError("Schedules unavailable", "Unable to locate the selected revenue schedules. Refresh and try again.")
      return
    }
    const defaultDate = computeRevenueCloneDefaultDate(targetRow.scheduleDate)

    // Prepare source schedule data for modal
    setRevenueCloneSourceData({
      scheduleNumber: targetRow.scheduleNumber ?? null,
      scheduleDate: targetRow.scheduleDate ?? null,
      quantity: targetRow.quantity ?? null,
      unitPrice: targetRow.unitPrice ?? null,
      usageAdjustment: targetRow.expectedUsageAdjustment ?? null,
      commissionRatePercent: targetRow.expectedCommissionRatePercent ?? null,
    })

    setRevenueCloneTargetId(sourceId)
    setRevenueCloneDefaultDate(defaultDate)
    setShowRevenueCloneModal(true)
  }, [computeRevenueCloneDefaultDate, selectedRevenueRows, selectedRevenueSchedules, showError])

  const handleRevenueCloneCancel = useCallback(() => {
    setShowRevenueCloneModal(false)
    setRevenueCloneTargetId(null)
    setRevenueCloneSourceData(null)
  }, [])

  const handleRevenueConfirmClone = useCallback(
    async (params: {
      effectiveDate: string
      months: number
      scheduleNumber?: string
      quantity?: number
      unitPrice?: number
      usageAdjustment?: number
    }) => {
      if (!revenueCloneTargetId) {
        showError("Schedules unavailable", "Unable to locate the selected revenue schedules. Refresh and try again.")
        return
      }

      setRevenueBulkBusy(true)
      try {
        const response = await fetch(`/api/revenue-schedules/${encodeURIComponent(revenueCloneTargetId)}/clone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...params, mode: "copyExtend" }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          const message = payload?.error ?? "Unable to copy/extend the selected revenue schedule."
          throw new Error(message)
        }

        const newId: string | undefined = payload?.data?.id ?? payload?.id
        if (!newId) {
          throw new Error("Copy/Extend completed but the new schedule id was not returned.")
        }

        setShowRevenueCloneModal(false)
        setRevenueCloneTargetId(null)
        setRevenueCloneSourceData(null)
        showSuccess("Schedule copied/extended", "Opening the new schedule so you can review it.")
        router.push(`/revenue-schedules/${encodeURIComponent(newId)}`)
      } catch (err) {
        console.error("Failed to copy/extend revenue schedule", err)
        const message = err instanceof Error ? err.message : "Unable to copy/extend revenue schedule."
        showError("Copy/Extend failed", message)
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
                    onChange={event => {
                      event.stopPropagation()
                      handleActivitySelect(row.id, event.target.checked)
                      event.target.blur()
                    }}
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

  const handleProductCopyExtendSchedules = useCallback(() => {
    if (!opportunity) {
      showError("Unable to copy/extend schedules", "Opportunity data is unavailable.")
      return
    }

    if (selectedLineItems.length !== 1) {
      showError(
        "Select a single product",
        "Choose exactly one product line item to copy/extend schedules for."
      )
      return
    }

    const lineItemId = selectedLineItems[0]
    const schedules = (opportunity.revenueSchedules ?? []).filter(
      schedule => schedule.opportunityProductId === lineItemId
    )

    if (schedules.length === 0) {
      showError(
        "No schedules found",
        "The selected product does not have any revenue schedules to copy/extend."
      )
      return
    }

    let template = schedules[0]
    for (const schedule of schedules) {
      if (!schedule.scheduleDate) continue
      if (!template.scheduleDate) {
        template = schedule
        continue
      }
      const current = new Date(schedule.scheduleDate)
      const best = new Date(template.scheduleDate)
      if (!Number.isNaN(current.getTime()) && current > best) {
        template = schedule
      }
    }

    if (!template.id) {
      showError(
        "Schedule unavailable",
        "Unable to locate a schedule to copy/extend for this product."
      )
      return
    }

    const defaultDate = computeRevenueCloneDefaultDate(template.scheduleDate)

    setRevenueCloneSourceData({
      scheduleNumber: template.scheduleNumber ?? null,
      scheduleDate: template.scheduleDate ?? null,
      quantity: template.quantity ?? null,
      unitPrice: template.unitPrice ?? null,
      usageAdjustment: template.expectedUsageAdjustment ?? null,
      commissionRatePercent: template.expectedCommissionRatePercent ?? null,
    })
    setRevenueCloneTargetId(template.id)
    setRevenueCloneDefaultDate(defaultDate)
    setShowRevenueCloneModal(true)
  }, [computeRevenueCloneDefaultDate, opportunity, selectedLineItems, showError])

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

  const deactivateLineItemForDialog = useCallback(async (
    lineItemId: string,
    _reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/opportunities/line-items/${lineItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false })
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = payload?.error ?? "Failed to update product status"
        return { success: false, error: message }
      }

      setLineItemStatusOverrides(current => ({ ...current, [lineItemId]: false }))
      showSuccess("Product inactivated", "The product line item was marked inactive.")
      await onRefresh?.()
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update product status"
      return { success: false, error: message }
    }
  }, [onRefresh, showSuccess])

  const bulkDeactivateLineItemsForDialog = useCallback(async (
    entities: Array<{ id: string; name: string }>,
    _reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!entities || entities.length === 0) {
      return { success: false, error: "No line items selected" }
    }

    setLineItemBulkActionLoading(true)
    try {
      const responses = await Promise.allSettled(
        entities.map(async entity => {
          const response = await fetch(`/api/opportunities/line-items/${entity.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: false })
          })
          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? "Failed to update product status")
          }
          return entity.id
        })
      )

      const successIds = responses
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map(result => result.value)
      const failedCount = responses.length - successIds.length

      if (successIds.length > 0) {
        setLineItemStatusOverrides(current => {
          const next = { ...current }
          successIds.forEach(id => {
            next[id] = false
          })
          return next
        })

        showSuccess(
          "Products inactivated",
          `${successIds.length} product line item${successIds.length === 1 ? "" : "s"} marked inactive.`
        )
        await onRefresh?.()
      }

      if (failedCount > 0) {
        return { success: false, error: `${failedCount} product line item${failedCount === 1 ? "" : "s"} could not be inactivated.` }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update product status"
      return { success: false, error: message }
    } finally {
      setLineItemBulkActionLoading(false)
    }
  }, [onRefresh, showSuccess])

  const deleteLineItemForDialog = useCallback(async (
    lineItemId: string,
    _bypassConstraints?: boolean,
    _reason?: string
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    try {
      const response = await fetch(`/api/opportunities/line-items/${lineItemId}`, { method: "DELETE" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? "Failed to delete line item" }
      }

      showSuccess("Line item deleted", "The product has been removed from this opportunity.")
      setSelectedLineItems(previous => previous.filter(id => id !== lineItemId))
      setLineItemToDelete(null)
      await onRefresh?.()
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete line item"
      showError("Delete failed", message)
      return { success: false, error: message }
    }
  }, [onRefresh, showError, showSuccess])

  const bulkDeleteLineItemsForDialog = useCallback(async (
    entities: Array<{ id: string; name: string }>,
    _bypassConstraints?: boolean,
    _reason?: string
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    if (!entities || entities.length === 0) {
      return { success: false, error: "No line items selected" }
    }

    setLineItemBulkActionLoading(true)
    try {
      const outcomes = await Promise.allSettled(
        entities.map(async entity => {
          const response = await fetch(`/api/opportunities/line-items/${entity.id}`, { method: "DELETE" })
          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? "Failed to delete line item")
          }
          return entity.id
        })
      )

      const successIds = outcomes
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map(result => result.value)
      const failedCount = outcomes.length - successIds.length

      if (successIds.length > 0) {
        showSuccess(
          "Line items deleted",
          `${successIds.length} product line item${successIds.length === 1 ? "" : "s"} removed.`
        )
        setSelectedLineItems(previous => previous.filter(id => !successIds.includes(id)))
        await onRefresh?.()
      }

      setLineItemBulkDeleteTargets([])

      if (failedCount > 0) {
        return { success: false, error: `${failedCount} line item${failedCount === 1 ? "" : "s"} could not be deleted.` }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete line items"
      showError("Delete failed", message)
      return { success: false, error: message }
    } finally {
      setLineItemBulkActionLoading(false)
    }
  }, [onRefresh, showError, showSuccess])

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
  if (!productPreferencePageSize) return
  const normalized = normalizePageSize(productPreferencePageSize)
  if (normalized !== productPageSize) {
    setProductPageSize(normalized)
    setProductCurrentPage(1)
  }
}, [productPreferencePageSize, productPageSize])

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
  const normalized = normalizePageSize(pageSize)
  setProductPageSize(normalized)
  setProductCurrentPage(1)
  void persistProductPageSize(normalized)
}, [persistProductPageSize])

  const handleProductSort = useCallback((columnId: string, direction: "asc" | "desc") => {
    setProductSort({ columnId, direction })
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
    setProductSort(null)
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
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select product line item ${row.productName}`}
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
                    checked
                      ? "border-primary-500 bg-primary-600 text-white"
                      : "border-gray-300 bg-white text-transparent"
                  )}
                  onClick={event => {
                    event.stopPropagation()
                    handleLineItemSelect(row.id, !checked)
                  }}
                  onMouseDown={event => event.preventDefault()}
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                </button>

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

      if (column.id === "productNameHouse") {
        return {
          ...column,
          render: (value: unknown, row: OpportunityLineItemRecord) => {
            const label = String(value ?? '')

            if (!row.productId || !label) {
              return <span className="text-gray-900">{label || "--"}</span>
            }

            return (
              <div className="flex items-center gap-1">
                <Link
                  href={`/opportunities/${opportunity?.id ?? ""}/products/${row.id}`}
                  className="cursor-pointer text-blue-600 hover:text-blue-800"
                  onClick={(event) => event.stopPropagation()}
                  prefetch={false}
                >
                  {label}
                </Link>

                <Link
                  href={`/products/${row.productId}`}
                  className="text-blue-600 hover:text-blue-800"
                  onClick={event => event.stopPropagation()}
                  prefetch={false}
                  title="Open product catalog record"
                  aria-label="Open product catalog record"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            )
          }
        }
      }

      if (column.id === "productNameVendor") {
        return {
          ...column,
          render: (value: unknown, row: OpportunityLineItemRecord) => {
            const label = String(value ?? '')

            if (!row.productId || !label) {
              return <span className="text-gray-900">{label || "--"}</span>
            }

            return (
              <div className="flex items-center gap-1">
                <Link
                  href={`/opportunities/${opportunity?.id ?? ""}/products/${row.id}`}
                  className="cursor-pointer text-blue-600 hover:text-blue-800"
                  onClick={(event) => event.stopPropagation()}
                  prefetch={false}
                >
                  {label}
                </Link>

                <Link
                  href={`/products/${row.productId}`}
                  className="text-blue-600 hover:text-blue-800"
                  onClick={event => event.stopPropagation()}
                  prefetch={false}
                  title="Open product catalog record"
                  aria-label="Open product catalog record"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            )
          }
        }
      }

      if (column.id === "distributorName") {
        return {
          ...column,
          render: (value: unknown, row: OpportunityLineItemRecord) => {
            const displayValue = value === null || value === undefined ? "--" : String(value)
            if (row.distributorId) {
              return (
                <Link
                  href={`/accounts/${row.distributorId}`}
                  className="cursor-pointer text-blue-600 hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  onClick={event => event.stopPropagation()}
                  prefetch={false}
                >
                  {displayValue}
                </Link>
              )
            }
            return <span>{displayValue}</span>
          }
        }
      }

      if (column.id === "vendorName") {
        return {
          ...column,
          render: (value: unknown, row: OpportunityLineItemRecord) => {
            const displayValue = value === null || value === undefined ? "--" : String(value)
            if (row.vendorId) {
              return (
                <Link
                  href={`/accounts/${row.vendorId}`}
                  className="cursor-pointer text-blue-600 hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  onClick={event => event.stopPropagation()}
                  prefetch={false}
                >
                  {displayValue}
                </Link>
              )
            }
            return <span>{displayValue}</span>
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

  const productBulkActions = useMemo<BulkActionsGridProps>(
    () => ({
      selectedCount: selectedLineItems.length,
      isBusy: lineItemBulkActionLoading,
      entityName: "product line items",
      actions: [
        {
          key: "copy-extend-schedules",
          label: "Copy/Extend Schedules",
          icon: Calendar,
          tone: "primary",
          onClick: handleProductCopyExtendSchedules,
          tooltip: count =>
            count === 1
              ? "Copy/Extend revenue schedules for this product"
              : "Select a single product to copy/extend schedules",
        },
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
      handleProductCopyExtendSchedules,
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
          key: "revenue-copy-extend",
          label: "Copy/Extend",
          icon: Copy,
          tone: "primary",
          onClick: handleRevenueCloneSchedule,
          tooltip: count =>
            count === 1
              ? "Copy/Extend this revenue schedule"
              : "Select exactly one schedule to copy/extend",
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
          key: "role-delete",
          label: "Delete",
          icon: Trash2,
          tone: "danger",
          onClick: openBulkRoleDeleteDialog,
          tooltip: count => `Delete ${count} role${count === 1 ? "" : "s"}`,
          hidden: !canDeleteRoles,
        },
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
    [selectedRoles.length, canDeleteRoles, openBulkRoleDeleteDialog, handleBulkRoleExportCsv]
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
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="w-full xl:max-w-[1800px]">
              {headerNode}
            </div>

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
                  <div className="border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0 px-3 pb-3">
                    <div className="border-t-2 border-t-primary-600 -mr-3 pt-3">
                      <TabDescription>{TAB_DESCRIPTIONS.summary}</TabDescription>
                      <SummaryTab opportunity={opportunity} />
                    </div>
                  </div>
                ) : activeTab === "products" ? (
                  <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-1 border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0 px-3 pb-0">
                    <div className="border-t-2 border-t-primary-600 -mr-3 min-w-0 overflow-hidden">
                    <TabDescription>{TAB_DESCRIPTIONS.products}</TabDescription>
                    <ListHeader
                      inTab
                      showCreateButton
                      onCreateClick={() => setShowCreateLineItemModal(true)}
                      createButtonLabel="Create/Add Product"
                      onSearch={setProductSearchQuery}
                        searchPlaceholder="Search line items"
                        filterColumns={PRODUCT_FILTER_COLUMNS}
                        columnFilters={productColumnFilters}
                        onColumnFiltersChange={setProductColumnFilters}
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
                        onSort={handleProductSort}
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
                      <TabDescription>{TAB_DESCRIPTIONS.roles}</TabDescription>
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
                      <TabDescription>{TAB_DESCRIPTIONS["revenue-schedules"]}</TabDescription>
                      <ListHeader
                        inTab
                        onCreateClick={() => setShowRevenueCreateModal(true)}
                        showCreateButton={Boolean(opportunity)}
                        createButtonLabel="Manage"
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
                          onSort={handleRevenueSort}
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
                      <TabDescription>{TAB_DESCRIPTIONS.activities}</TabDescription>
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
                  <div className="border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0 px-3 pb-3">
                    <div className="border-t-2 border-t-primary-600 -mr-3 pt-3">
                      <TabDescription>{TAB_DESCRIPTIONS.details}</TabDescription>
                      <DetailsIdentifiersTab opportunity={opportunity} />
                    </div>
                  </div>
                ) : activeTab === "history" ? (
                  <AuditHistoryTab
                    entityName="Opportunity"
                    entityId={opportunity.id}
                    tableAreaRefCallback={tableAreaRefCallback}
                    tableBodyMaxHeight={tableBodyMaxHeight}
                    description={TAB_DESCRIPTIONS.history}
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

      <RevenueBulkApplyPanel
        isOpen={Boolean(revenueBulkPrompt)}
        selectedCount={selectedRevenueSchedules.length}
        fieldLabel={revenueBulkPrompt?.label ?? ""}
        valueLabel={revenueBulkPromptValueLabel}
        initialEffectiveDate={revenueBulkDefaultEffectiveDate}
        onClose={() => setRevenueBulkPrompt(null)}
        onSubmit={handleRevenueApplyFillDown}
        onBeforeSubmit={() => {
          if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
        }}
        isSubmitting={revenueBulkApplying}
        entityLabelSingular="revenue schedule"
        entityLabelPlural="revenue schedules"
      />

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
        initialStatusSelection={selectedRevenueSchedules}
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
        sourceSchedule={revenueCloneSourceData ?? undefined}
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

      <TwoStageDeleteDialog
        isOpen={Boolean(lineItemToDelete) || lineItemBulkDeleteTargets.length > 0}
        onClose={() => {
          setLineItemToDelete(null)
          setLineItemBulkDeleteTargets([])
        }}
        entity="Line Item"
        entityName={
          lineItemBulkDeleteTargets.length > 0
            ? `${lineItemBulkDeleteTargets.length} line item${lineItemBulkDeleteTargets.length === 1 ? "" : "s"}`
            : lineItemToDelete?.productName || "Line Item"
        }
        entityId={
          lineItemBulkDeleteTargets.length > 0
            ? lineItemBulkDeleteTargets[0]?.id || ""
            : lineItemToDelete?.id || ""
        }
        multipleEntities={
          lineItemBulkDeleteTargets.length > 0
            ? lineItemBulkDeleteTargets.map(item => ({
                id: item.id,
                name: item.productName || item.productCode || "Line item",
                subtitle: item.productCode ? `Code: ${item.productCode}` : undefined
              }))
            : undefined
        }
        entitySummary={
          lineItemBulkDeleteTargets.length === 0 && lineItemToDelete
            ? {
                id: lineItemToDelete.id,
                name: lineItemToDelete.productName || lineItemToDelete.productCode || "Line item",
                subtitle: lineItemToDelete.productCode ? `Code: ${lineItemToDelete.productCode}` : undefined
              }
            : undefined
        }
        entityLabelPlural="Line Items"
        isDeleted={false}
        onDeactivate={deactivateLineItemForDialog}
        onBulkDeactivate={bulkDeactivateLineItemsForDialog}
        onSoftDelete={deleteLineItemForDialog}
        onBulkSoftDelete={bulkDeleteLineItemsForDialog}
        onPermanentDelete={async (id, reason) => {
          const result = await deleteLineItemForDialog(id, undefined, reason)
          return result.success ? { success: true } : { success: false, error: result.error }
        }}
        userCanPermanentDelete={false}
        disallowActiveDelete={
          lineItemBulkDeleteTargets.length > 0
            ? lineItemBulkDeleteTargets.some(item => item.active !== false)
            : (lineItemToDelete ? lineItemToDelete.active !== false : false)
        }
        modalSize="revenue-schedules"
        requireReason
        note="Product line items must be inactive before they can be deleted. Use Action = Deactivate to mark them inactive."
      />


      <TwoStageDeleteDialog
        isOpen={showRoleDeleteDialog}
        onClose={closeRoleDeleteDialog}
        entity="Role"
        entityName={
          roleDeleteTargets.length > 0
            ? `${roleDeleteTargets.length} role${roleDeleteTargets.length === 1 ? "" : "s"}`
            : "Role"
        }
        entityId={roleDeleteTargets[0]?.id || ""}
        multipleEntities={
          roleDeleteTargets.length > 0
            ? roleDeleteTargets.map(role => ({
                id: role.id,
                name: role.fullName || role.role || "Role",
                roleName: role.role || "",
                email: role.email || "",
                workPhone: role.workPhone || "",
                mobile: role.mobile || ""
              }))
            : undefined
        }
        entityLabelPlural="Roles"
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: "Roles cannot be deactivated." })}
        onPermanentDelete={deleteRoleById}
        onBulkPermanentDelete={handleBulkPermanentRoleDelete}
        userCanPermanentDelete={true}
        modalSize="revenue-schedules"
        requireReason
        primaryActionLabel="Apply"
        noteLabel="Legend"
        note="Roles are removed from this opportunity. Deleting a role does not delete the underlying contact record."
      />
    </>
  )
}
