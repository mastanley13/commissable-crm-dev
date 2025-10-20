"use client"

import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Check, Loader2, Trash2 } from "lucide-react"
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
import {
  OpportunityDetailRecord,
  OpportunityLineItemRecord,
  OpportunityRevenueScheduleRecord
} from "./opportunity-types"
import { OpportunityLineItemCreateModal } from "./opportunity-line-item-create-modal"
import { OpportunityLineItemEditModal } from "./opportunity-line-item-edit-modal"
import { ConfirmDialog } from "./confirm-dialog"
import { useAuth } from "@/lib/auth-context"
import { useToasts } from "@/components/toast"
import { ProductBulkActionBar } from "./product-bulk-action-bar"

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap"
const fieldBoxClass = "flex min-h-[28px] w-full max-w-md items-center justify-between rounded-lg border-2 border-gray-400 bg-white px-2 py-0.5 text-xs text-gray-900 shadow-sm whitespace-nowrap overflow-hidden text-ellipsis"

const PRODUCT_FILTER_COLUMNS: Array<{ id: string; label: string }> = [
  { id: "productName", label: "Product Name" },
  { id: "productCode", label: "Product Code" },
  { id: "revenueType", label: "Revenue Type" },
  { id: "distributorName", label: "Distributor" },
  { id: "vendorName", label: "Vendor" }
]

type OwnerOption = { value: string; label: string }

const STAGE_OPTIONS = Object.values(OpportunityStage).map(stage => ({
  value: stage,
  label: stage.replace(/([A-Z])/g, " $1").trim()
}))

const PRODUCT_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 220,
    minWidth: 180,
    maxWidth: 260,
    type: "multi-action",
    hideable: false
  },
  { id: "productName", label: "Product", width: 240, minWidth: 200, accessor: "productName", sortable: true },
  { id: "productCode", label: "Product Code", width: 160, minWidth: 140, accessor: "productCode", sortable: true },
  { id: "revenueType", label: "Revenue Type", width: 160, minWidth: 140, accessor: "revenueType", sortable: true },
  { id: "quantity", label: "Quantity", width: 120, minWidth: 100, accessor: "quantity", sortable: true },
  { id: "unitPrice", label: "Unit Price", width: 140, minWidth: 120, accessor: "unitPrice", sortable: true },
  { id: "expectedRevenue", label: "Expected Revenue", width: 180, minWidth: 160, accessor: "expectedRevenue", sortable: true },
  { id: "expectedCommission", label: "Expected Commission", width: 200, minWidth: 180, accessor: "expectedCommission", sortable: true },
  { id: "expectedUsage", label: "Expected Usage", width: 160, minWidth: 140, accessor: "expectedUsage", sortable: true },
  { id: "revenueStartDate", label: "Start Date", width: 150, minWidth: 130, accessor: "revenueStartDate", sortable: true },
  { id: "revenueEndDate", label: "End Date", width: 150, minWidth: 130, accessor: "revenueEndDate", sortable: true },
  { id: "distributorName", label: "Distributor", width: 200, minWidth: 160, accessor: "distributorName" },
  { id: "vendorName", label: "Vendor", width: 200, minWidth: 160, accessor: "vendorName" },
  { id: "createdAt", label: "Created", width: 160, minWidth: 140, accessor: "createdAt", sortable: true },
  { id: "updatedAt", label: "Updated", width: 160, minWidth: 140, accessor: "updatedAt", sortable: true }
]

const REVENUE_FILTER_COLUMNS: Array<{ id: string; label: string }> = [
  { id: "productNameVendor", label: "Product Name" },
  { id: "scheduleNumber", label: "Revenue Schedule" },
  { id: "scheduleDate", label: "Schedule Date" },
  { id: "status", label: "Status" },
  { id: "vendorName", label: "Vendor" },
  { id: "distributorName", label: "Distributor" }
]

const REVENUE_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: "multi-action",
    hideable: false
  },
  { id: "productNameVendor", label: "Product Name - Vendor", width: 220, minWidth: 180, accessor: "productNameVendor", sortable: true },
  { id: "vendorName", label: "Vendor Name", width: 200, minWidth: 160, accessor: "vendorName", sortable: true },
  { id: "distributorName", label: "Distributor Name", width: 200, minWidth: 160, accessor: "distributorName", sortable: true },
  { id: "scheduleNumber", label: "Revenue Schedule", width: 180, minWidth: 150, accessor: "scheduleNumber", sortable: true },
  { id: "scheduleDate", label: "Schedule Date", width: 160, minWidth: 130, accessor: "scheduleDate", sortable: true },
  { id: "status", label: "Status", width: 150, minWidth: 130, accessor: "status", sortable: true },
  { id: "quantity", label: "Quantity", width: 120, minWidth: 100, accessor: "quantity", sortable: true },
  { id: "unitPrice", label: "Price Each", width: 140, minWidth: 120, accessor: "unitPrice", sortable: true },
  { id: "expectedUsageGross", label: "Expected Usage Gross", width: 200, minWidth: 160, accessor: "expectedUsageGross", sortable: true },
  { id: "expectedUsageAdjustment", label: "Expected Usage Adjustment", width: 220, minWidth: 180, accessor: "expectedUsageAdjustment", sortable: true },
  { id: "expectedUsageNet", label: "Expected Usage Net", width: 200, minWidth: 160, accessor: "expectedUsageNet", sortable: true },
  { id: "actualUsage", label: "Actual Usage", width: 180, minWidth: 150, accessor: "actualUsage", sortable: true },
  { id: "usageBalance", label: "Usage Balance", width: 180, minWidth: 150, accessor: "usageBalance", sortable: true },
  { id: "expectedCommissionGross", label: "Expected Commission Gross", width: 220, minWidth: 180, accessor: "expectedCommissionGross", sortable: true },
  { id: "expectedCommissionAdjustment", label: "Expected Commission Adjustment", width: 240, minWidth: 200, accessor: "expectedCommissionAdjustment", sortable: true },
  { id: "expectedCommissionNet", label: "Expected Commission Net", width: 220, minWidth: 180, accessor: "expectedCommissionNet", sortable: true },
  { id: "actualCommission", label: "Actual Commission", width: 200, minWidth: 160, accessor: "actualCommission", sortable: true },
  { id: "commissionDifference", label: "Commission Difference", width: 200, minWidth: 160, accessor: "commissionDifference", sortable: true },
  { id: "expectedCommissionRatePercent", label: "Expected Commission Rate %", width: 220, minWidth: 180, accessor: "expectedCommissionRatePercent", sortable: true },
  { id: "actualCommissionRatePercent", label: "Actual Commission Rate %", width: 200, minWidth: 160, accessor: "actualCommissionRatePercent", sortable: true },
  { id: "commissionRateDifferencePercent", label: "Commission Rate Difference", width: 220, minWidth: 180, accessor: "commissionRateDifferencePercent", sortable: true }
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

const ROLE_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: 160,
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

const HISTORY_FILTER_COLUMNS: Array<{ id: string; label: string }> = [
  { id: "actorName", label: "Actor" },
  { id: "action", label: "Action" },
  { id: "entityLabel", label: "Entity" },
  { id: "summary", label: "Summary" }
]

const HISTORY_TABLE_BASE_COLUMNS: Column[] = [
  { id: "createdAt", label: "When", width: 200, minWidth: 180, accessor: "createdAt" },
  { id: "action", label: "Action", width: 140, minWidth: 120, accessor: "action" },
  { id: "actorName", label: "Actor", width: 200, minWidth: 160, accessor: "actorName" },
  { id: "entityLabel", label: "Entity", width: 160, minWidth: 140, accessor: "entityLabel" },
  { id: "summary", label: "Details", width: 360, minWidth: 240, accessor: "summary" }
]

interface OpportunityHistoryRow {
  id: string
  entityName: string
  entityLabel: string
  entityId: string
  action: string
  actorName: string | null
  createdAt: string
  summary: string
  details: string[]
}

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

function SummaryTab({ opportunity }: { opportunity: OpportunityDetailRecord }) {
  const metrics = opportunity.summaryMetrics ?? {}

  const toNumberOrUndefined = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined

  const computeNet = (gross?: number, adjustments?: number) =>
    gross !== undefined && adjustments !== undefined ? gross - adjustments : undefined

  const expectedUsageGross = toNumberOrUndefined(metrics.expectedUsageGrossTotal ?? opportunity.totals.expectedUsageTotal)
  const expectedUsageAdjustments = toNumberOrUndefined(metrics.expectedUsageAdjustmentsGrossTotal)
  const expectedUsageNet = computeNet(expectedUsageGross, expectedUsageAdjustments)

  const expectedCommissionGross =
    toNumberOrUndefined(metrics.expectedCommissionGrossTotal ?? opportunity.totals.expectedCommissionTotal)
  const expectedCommissionAdjustments = toNumberOrUndefined(metrics.expectedCommissionAdjustmentsGrossTotal)
  const expectedCommissionNet = computeNet(expectedCommissionGross, expectedCommissionAdjustments)

  const actualUsageGross = toNumberOrUndefined(metrics.actualUsageGrossTotal)
  const actualUsageAdjustments = toNumberOrUndefined(metrics.actualUsageAdjustmentsGrossTotal)
  const actualUsageNet = computeNet(actualUsageGross, actualUsageAdjustments)

  const actualCommissionGross = toNumberOrUndefined(metrics.actualCommissionGrossTotal)
  const actualCommissionAdjustments = toNumberOrUndefined(metrics.actualCommissionAdjustmentsGrossTotal)
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
            { label: "Expected Commission Gross Total House Rep", value: toNumberOrUndefined(metrics.expectedCommissionHouseRepTotal) },
            { label: "Expected Commission Gross Total Subagent", value: toNumberOrUndefined(metrics.expectedCommissionSubAgentTotal) },
            { label: "Expected Commission Gross Total House", value: toNumberOrUndefined(metrics.expectedCommissionHouseTotal) }
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
            { label: "Actual Commission Gross Total House Rep", value: toNumberOrUndefined(metrics.actualCommissionHouseRepTotal) },
            { label: "Actual Commission Gross Total Subagent", value: toNumberOrUndefined(metrics.actualCommissionSubAgentTotal) },
            { label: "Actual Commission Gross Total House", value: toNumberOrUndefined(metrics.actualCommissionHouseTotal) }
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
            { label: "Remaining Commission Gross Total House Rep", value: toNumberOrUndefined(metrics.remainingCommissionHouseRepTotal) },
            { label: "Remaining Commission Gross Total Subagent", value: toNumberOrUndefined(metrics.remainingCommissionSubAgentTotal) },
            { label: "Remaining Commission Gross Total House", value: toNumberOrUndefined(metrics.remainingCommissionHouseTotal) }
          ]
        }
      ]
    }
  ]

  return (
    <div className="space-y-6">
      

      <div className="grid gap-y-6 gap-x-14 lg:grid-cols-3">
        {summaryColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
              {column.title}
            </h3>
            {column.sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-2">
                <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                  {section.title}
                </h4>
                <div className="space-y-1">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-gray-900 whitespace-nowrap">
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
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{field.label}</p>
              <p className="text-sm font-medium text-gray-900 break-all">
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--"
  }
  const normalized = value > 1 ? value : value * 100
  return `${normalized.toFixed(0)}%`
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
  if (value === null || value === undefined || Number.isNaN(value)) {
    return ""
  }
  const percentValue = value > 1 ? value : value * 100
  const rounded = Math.round((percentValue + Number.EPSILON) * 100) / 100
  return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : String(rounded)
}

function inputStringToPercent(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  if (parsed === 0) return 0
  return parsed > 1 ? parsed / 100 : parsed
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
  return date.toISOString().slice(0, 10)
}

function createOpportunityInlineForm(detail: OpportunityDetailRecord | null | undefined): OpportunityInlineForm | null {
  if (!detail) return null

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
    houseSplitPercent: percentToInputString(detail.houseSplitPercent ?? null),
    description: detail.description ?? ""
  }
}

function buildOpportunityPayload(patch: Partial<OpportunityInlineForm>, draft: OpportunityInlineForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if ("name" in patch) payload.name = draft.name.trim()
  if ("stage" in patch) payload.stage = draft.stage || null
  if ("status" in patch) payload.status = draft.status || null
  if ("ownerId" in patch) payload.ownerId = draft.ownerId || null
  if ("estimatedCloseDate" in patch) payload.estimatedCloseDate = draft.estimatedCloseDate || null
  if ("leadSource" in patch) payload.leadSource = draft.leadSource || null
  if ("subAgent" in patch) payload.subAgent = draft.subAgent.trim()
  if ("referredBy" in patch) payload.referredBy = draft.referredBy.trim()
  if ("shippingAddress" in patch) payload.shippingAddress = draft.shippingAddress.trim()
  if ("billingAddress" in patch) payload.billingAddress = draft.billingAddress.trim()
  if ("description" in patch) payload.description = draft.description.trim()
  if ("subagentPercent" in patch) payload.subagentPercent = inputStringToPercent(draft.subagentPercent)
  if ("houseRepPercent" in patch) payload.houseRepPercent = inputStringToPercent(draft.houseRepPercent)
  if ("houseSplitPercent" in patch) payload.houseSplitPercent = inputStringToPercent(draft.houseSplitPercent)

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
  } else if (Number.isNaN(Date.parse(form.estimatedCloseDate))) {
    errors.estimatedCloseDate = "Enter a valid date."
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
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      errors[field] = message
    }
  }

  return errors
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[140px,1fr]">
      <span className={fieldLabelClass}>{label}</span>
      <div>{children}</div>
    </div>
  )
}

function OpportunityHeader({
  opportunity,
  onEdit
}: {
  opportunity: OpportunityDetailRecord
  onEdit?: () => void
}) {
  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
      {/* Header with title and controls */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Opportunity Detail</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-1.5">
          <FieldRow label="Opportunity Name">
            <div className={fieldBoxClass}>
              {opportunity.name || "Untitled Opportunity"}
            </div>
          </FieldRow>
          <FieldRow label="Account Name">
            {opportunity.account ? (
              <Link href={`/accounts/${opportunity.account.id}`} className="w-full max-w-md">
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
            <div className={fieldBoxClass}>{humanizeLabel(opportunity.stage)}</div>
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
          <FieldRow label="Subagent %">
            <div className={fieldBoxClass}>{formatPercent(opportunity.subagentPercent)}</div>
          </FieldRow>
          <FieldRow label="House Rep %">
            <div className={fieldBoxClass}>{formatPercent(opportunity.houseRepPercent)}</div>
          </FieldRow>
          <FieldRow label="House Split %">
            <div className={fieldBoxClass}>{formatPercent(opportunity.houseSplitPercent)}</div>
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

  void leadSourceField

  const disableSave = editor.saving || !editor.isDirty

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
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Opportunity Detail</p>
          {editor.isDirty ? (
            <span className="text-xs font-semibold text-amber-600">Unsaved changes</span>
          ) : null}
          {ownersLoading ? <span className="text-xs text-gray-500">Loading owners...</span> : null}
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

      <div className="grid gap-6 lg:grid-cols-2">
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
              <Link href={`/accounts/${opportunity.account.id}`} className="w-full max-w-md">
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
            <EditableField.Select
              className="w-full"
              value={(stageField.value as string) ?? ""}
              onChange={stageField.onChange}
              onBlur={stageField.onBlur}
            >
              <option value="">Select stage</option>
              {STAGE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </EditableField.Select>,
            editor.errors.stage
          )}

          {renderRow(
            "Estimated Close Date",
            <EditableField.Input
              className="w-full"
              type="date"
              value={(closeDateField.value as string) ?? ""}
              onChange={closeDateField.onChange}
              onBlur={closeDateField.onBlur}
            />,
            editor.errors.estimatedCloseDate
          )}
        </div>

        <div className="space-y-1.5">
          {renderRow(
            "Referred By",
            <EditableField.Input
              className="w-full"
              value={(referredField.value as string) ?? ""}
              onChange={referredField.onChange}
              onBlur={referredField.onBlur}
            />,
            editor.errors.referredBy
          )}

          {renderRow(
            "Shipping Address",
            <EditableField.Input
              className="w-full"
              value={(shippingField.value as string) ?? ""}
              onChange={shippingField.onChange}
              onBlur={shippingField.onBlur}
            />,
            editor.errors.shippingAddress
          )}

          {renderRow(
            "Billing Address",
            <EditableField.Input
              className="w-full"
              value={(billingField.value as string) ?? ""}
              onChange={billingField.onChange}
              onBlur={billingField.onBlur}
            />,
            editor.errors.billingAddress
          )}

          {renderRow(
            "Subagent %",
            <EditableField.Input
              className="w-full"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={(subagentPercentField.value as string) ?? ""}
              onChange={subagentPercentField.onChange}
              onBlur={subagentPercentField.onBlur}
            />,
            editor.errors.subagentPercent
          )}

          {renderRow(
            "House Rep %",
            <EditableField.Input
              className="w-full"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={(houseRepPercentField.value as string) ?? ""}
              onChange={houseRepPercentField.onChange}
              onBlur={houseRepPercentField.onBlur}
            />,
            editor.errors.houseRepPercent
          )}

          {renderRow(
            "House Split %",
            <EditableField.Input
              className="w-full"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={(houseSplitPercentField.value as string) ?? ""}
              onChange={houseSplitPercentField.onChange}
              onBlur={houseSplitPercentField.onBlur}
            />,
            editor.errors.houseSplitPercent
          )}

          {renderRow(
            "Description",
            <EditableField.Textarea
              className="w-full"
              rows={3}
              value={(descriptionField.value as string) ?? ""}
              onChange={descriptionField.onChange}
              onBlur={descriptionField.onBlur}
            />,
            editor.errors.description
          )}
        </div>
      </div>
    </div>
  )
}


function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—"
  }
  if (typeof value === "string") {
    return value.length > 60 ? `${value.slice(0, 57)}…` : value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export interface OpportunityDetailsViewProps {
  opportunity: OpportunityDetailRecord | null
  loading?: boolean
  error?: string | null
  onEdit?: () => void
  onRefresh?: () => Promise<void> | void
}

type TabKey = "summary" | "roles" | "details" | "products" | "revenue-schedules" | "activities" | "history"
export function OpportunityDetailsView({
  opportunity,
  loading,
  error,
  onEdit,
  onRefresh
}: OpportunityDetailsViewProps) {
  const { user: authUser, hasPermission, hasAnyPermission } = useAuth()
  const { showError, showSuccess } = useToasts()

  const [activeTab, setActiveTab] = useState<TabKey>("summary")

  const isAssignedToUser = Boolean(opportunity?.owner?.id && opportunity.owner.id === authUser?.id)
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

        if (opportunity?.owner?.id) {
          const exists = options.some(option => option.value === opportunity.owner!.id)
          if (!exists) {
            options.unshift({
              value: opportunity.owner.id,
              label: opportunity.owner.name || "Current Owner"
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
          setOwnerOptions(opportunity?.owner?.id
            ? [{ value: opportunity.owner.id, label: opportunity.owner.name || "Current Owner" }]
            : [])
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
  }, [shouldEnableInline, opportunity?.owner?.id, opportunity?.owner?.name, showError])

  const ownerSelectOptions = useMemo(() => {
    if (!shouldEnableInline) {
      return ownerOptions
    }
    if (!opportunity?.owner?.id) {
      return ownerOptions
    }
    const exists = ownerOptions.some(option => option.value === opportunity.owner!.id)
    if (exists) {
      return ownerOptions
    }
    return [
      { value: opportunity.owner.id, label: opportunity.owner.name ?? "Current Owner" },
      ...ownerOptions
    ]
  }, [shouldEnableInline, ownerOptions, opportunity?.owner?.id, opportunity?.owner?.name])

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
  const [revenueStatusFilter, setRevenueStatusFilter] = useState<"active" | "inactive">("active")
  const [revenueCurrentPage, setRevenueCurrentPage] = useState(1)
  const [revenuePageSize, setRevenuePageSize] = useState(10)
  const [selectedRevenueSchedules, setSelectedRevenueSchedules] = useState<string[]>([])
  const [showRevenueColumnSettings, setShowRevenueColumnSettings] = useState(false)

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

  // History tab state
  const [historyRows, setHistoryRows] = useState<OpportunityHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historySearchQuery, setHistorySearchQuery] = useState("")
  const [historyColumnFilters, setHistoryColumnFilters] = useState<ColumnFilter[]>([])
  const [showHistoryColumnSettings, setShowHistoryColumnSettings] = useState(false)

  const {
    columns: historyPreferenceColumns,
    loading: historyPreferencesLoading,
    saving: historyPreferencesSaving,
    hasUnsavedChanges: historyHasUnsavedChanges,
    lastSaved: historyLastSaved,
    handleColumnsChange: handleHistoryColumnsChange,
    saveChanges: saveHistoryPreferences,
    saveChangesOnModalClose: saveHistoryPrefsOnModalClose
  } = useTablePreferences("opportunities:detail:history", HISTORY_TABLE_BASE_COLUMNS)

  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const [tableAreaMaxHeight, setTableAreaMaxHeight] = useState<number>()
  const TABLE_CONTAINER_PADDING = 16
  const TABLE_BODY_FOOTER_RESERVE = 96
  const TABLE_BODY_MIN_HEIGHT = 160

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
    historyPreferencesLoading
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
    if (boundedPreferredHeight >= TABLE_BODY_MIN_HEIGHT) {
      return boundedPreferredHeight
    }
    const minTarget = Math.min(TABLE_BODY_MIN_HEIGHT, maxBodyWithinContainer)
    return Math.max(boundedPreferredHeight, minTarget)
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
        [row.productName, row.productCode, row.revenueType, row.distributorName, row.vendorName]
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

    if (revenueStatusFilter === "active") {
      rows = rows.filter(row => {
        const status = row.status ? String(row.status).toLowerCase() : ""
        return status.length === 0 || !REVENUE_INACTIVE_STATUSES.has(status)
      })
    } else if (revenueStatusFilter === "inactive") {
      rows = rows.filter(row => {
        const status = row.status ? String(row.status).toLowerCase() : ""
        return status.length > 0 && REVENUE_INACTIVE_STATUSES.has(status)
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
    setRevenueStatusFilter("active")
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

  const selectedRevenueRows = useMemo(() => {
    if (selectedRevenueSchedules.length === 0) {
      return []
    }
    return filteredRevenueRows.filter(row => selectedRevenueSchedules.includes(row.id))
  }, [filteredRevenueRows, selectedRevenueSchedules])

  const revenueTableColumns = useMemo(() => {
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
  }, [revenuePreferenceColumns, selectedRevenueSchedules, handleRevenueSelect])

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

  const summarizeChangedFields = useCallback((changed: any): { summary: string; details: string[] } => {
    const details: string[] = []
    if (changed && typeof changed === "object" && !Array.isArray(changed)) {
      for (const [key, value] of Object.entries(changed)) {
        if (value && typeof value === "object" && "from" in (value as any) && "to" in (value as any)) {
          details.push(`${key}: ${formatChangeValue((value as any).from)} -> ${formatChangeValue((value as any).to)}`)
        } else {
          details.push(`${key}: updated`)
        }
      }
    }
    if (details.length === 0) {
      return { summary: "Updated", details: [] }
    }
    return { summary: details[0], details }
  }, [])

  const fetchHistory = useCallback(async () => {
    if (!opportunity) {
      setHistoryRows([])
      return
    }

    setHistoryLoading(true)
    setHistoryError(null)

    try {
      const opportunityParams = new URLSearchParams({
        entityName: "Opportunity",
        entityId: opportunity.id,
        pageSize: "200"
      })

      const requests: Promise<Response>[] = [
        fetch(`/api/audit-logs?${opportunityParams.toString()}`, { cache: "no-store" })
      ]

      if (lineItemIds.length > 0) {
        const lineItemParams = new URLSearchParams({
          entityName: "OpportunityProduct",
          entityIds: lineItemIds.join(","),
          pageSize: "200"
        })
        requests.push(fetch(`/api/audit-logs?${lineItemParams.toString()}`, { cache: "no-store" }))
      }

      const responses = await Promise.all(requests)

      const allLogs: any[] = []
      for (const response of responses) {
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = payload?.error ?? "Failed to load audit history"
          throw new Error(message)
        }
        const payload = await response.json().catch(() => null)
        const items = Array.isArray(payload?.data) ? payload.data : []
        allLogs.push(...items)
      }

      const rows: OpportunityHistoryRow[] = allLogs.map(item => {
        const createdAt = item.createdAt ? new Date(item.createdAt) : null
        const entityLabel =
          item.entityName === "Opportunity"
            ? "Opportunity"
            : item.entityName === "OpportunityProduct"
              ? "Line Item"
              : item.entityName

        const { summary, details } = summarizeChangedFields(item.changedFields)

        return {
          id: item.id,
          entityName: item.entityName ?? "Unknown",
          entityLabel,
          entityId: item.entityId ?? "",
          action: item.action ?? "Update",
          actorName: item.userName ?? null,
          createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : new Date().toISOString(),
          summary,
          details
        }
      })

      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setHistoryRows(rows)
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : "Unable to load audit history"
      setHistoryRows([])
      setHistoryError(message)
    } finally {
      setHistoryLoading(false)
    }
  }, [lineItemIds, opportunity, summarizeChangedFields])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

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
        await fetchHistory()
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
    [fetchHistory, lineItemStatusOverrides, onRefresh, productRows, showError, showSuccess]
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
        row.revenueType,
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
          await fetchHistory()
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
    [fetchHistory, onRefresh, showError, showSuccess]
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
        await fetchHistory()
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
  }, [fetchHistory, lineItemBulkDeleteTargets, onRefresh, showError, showSuccess])

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
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    activeValue ? "bg-blue-600" : "bg-gray-300",
                    toggleDisabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-blue-500"
                  )}
                  aria-label={activeValue ? "Mark product inactive" : "Mark product active"}
                  disabled={toggleDisabled}
                  aria-disabled={toggleDisabled}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ease-in-out",
                      activeValue ? "translate-x-4 ring-1 ring-blue-300" : "translate-x-1",
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

  const historyTableColumns = useMemo(() => {
    return historyPreferenceColumns.map(column => {
      if (column.id === "createdAt") {
        return {
          ...column,
          render: (value: unknown) => formatDateTime(typeof value === "string" ? value : String(value ?? ""))
        }
      }
      return {
        ...column,
        render: (value: unknown) => (value === null || value === undefined || String(value).trim().length === 0 ? "--" : String(value))
      }
    })
  }, [historyPreferenceColumns])

  const filteredHistoryRows = useMemo(() => {
    let rows = historyRows

    if (historySearchQuery.trim()) {
      const search = historySearchQuery.trim().toLowerCase()
      rows = rows.filter(row =>
        [row.actorName, row.action, row.entityLabel, row.summary]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(search))
      )
    }

    if (historyColumnFilters.length > 0) {
      rows = applySimpleFilters(
        rows as unknown as Record<string, unknown>[],
        historyColumnFilters
      ) as unknown as OpportunityHistoryRow[]
    }

    return rows
  }, [historyRows, historySearchQuery, historyColumnFilters])

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
      await fetchHistory()
      setLineItemToDelete(null)
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : "Unable to delete line item"
      setLineItemDeleteError(message)
      showError("Unable to delete line item", message)
    } finally {
      setLineItemDeleteLoading(false)
    }
  }, [fetchHistory, lineItemToDelete, onRefresh, showError, showSuccess])
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
    <OpportunityHeader opportunity={opportunity} onEdit={onEdit} />
  )

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="w-full xl:max-w-[1800px]">
          <div className="flex flex-col gap-4">
            {headerNode}

            <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-100 p-2">
                {(["products", "revenue-schedules", "activities", "summary", "roles", "details"] as TabKey[]).map(tabId => (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => handleTabSelect(tabId)}
                    className={cn(
                      "rounded-t-md border px-3 py-1.5 text-sm font-semibold shadow-sm transition",
                      activeTab === tabId
                        ? "-mb-[1px] border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                        : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:from-blue-200 hover:to-blue-300 hover:border-blue-400"
                    )}
                  >
                    {tabId === "summary"
                      ? "Summary"
                      : tabId === "roles"
                        ? "Roles"
                        : tabId === "details"
                          ? "Details"
                      : tabId === "products"
                        ? "Products"
                        : tabId === "revenue-schedules"
                          ? "Revenue Schedules"
                          : tabId === "activities"
                            ? "Activities & Notes"
                            : "History"}
                  </button>
                ))}
              </div>

              <div className="min-h-[320px] border-t-2 border-t-primary-600 border-gray-200 bg-white p-4 flex flex-col overflow-hidden">
                {activeTab === "summary" ? (
                  <SummaryTab opportunity={opportunity} />
                ) : activeTab === "roles" ? (
                  <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
                    <ListHeader
                      showCreateButton={false}
                      onSearch={setRolesSearchQuery}
                      searchPlaceholder="Search roles"
                      filterColumns={ROLE_FILTER_COLUMNS}
                      columnFilters={roleColumnFilters}
                      onColumnFiltersChange={setRoleColumnFilters}
                      onSettingsClick={() => setShowRoleColumnSettings(true)}
                      statusFilter={roleStatusFilter}
                      onFilterChange={value => setRoleStatusFilter(value === "inactive" ? "inactive" : "active")}
                      hasUnsavedTableChanges={roleHasUnsavedChanges}
                      isSavingTableChanges={rolePreferencesSaving}
                      lastTableSaved={roleLastSaved ?? undefined}
                      onSaveTableChanges={saveRolePreferences}
                    />

                    <div className="flex min-h-0 flex-col overflow-hidden" ref={tableAreaRefCallback}>
                      <DynamicTable
                        className="flex flex-col"
                        columns={roleTableColumns}
                        data={paginatedRoleRows}
                        loading={rolePreferencesLoading}
                        onColumnsChange={handleRoleColumnsChange}
                        emptyMessage="No roles are assigned to this opportunity yet"
                        maxBodyHeight={tableBodyMaxHeight}
                        pagination={rolePagination}
                        onPageChange={handleRolePageChange}
                        onPageSizeChange={handleRolePageSizeChange}
                        selectedItems={selectedRoles}
                        onItemSelect={handleRoleSelect}
                        onSelectAll={handleSelectAllRoles}
                        selectHeaderLabel="Select All"
                        fillContainerWidth
                        alwaysShowPagination
                      />
                    </div>
                  </div>
                ) : activeTab === "details" ? (
                  <DetailsIdentifiersTab opportunity={opportunity} />
                ) : activeTab === "products" ? (
                  <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
                    <ListHeader
                      showCreateButton={canModifyLineItems}
                      onCreateClick={() => setShowCreateLineItemModal(true)}
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
                    />

                    <ProductBulkActionBar
                      count={selectedLineItems.length}
                      disabled={lineItemBulkActionLoading || lineItemDeleteLoading}
                      onDelete={handleBulkDeleteLineItems}
                      onExportCsv={handleBulkExportLineItems}
                      onActivate={handleBulkActivateLineItems}
                      onDeactivate={handleBulkDeactivateLineItems}
                    />

                  <div className="flex min-h-0 flex-col overflow-hidden" ref={tableAreaRefCallback}>
                    <DynamicTable
                      className="flex flex-col"
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
                ) : activeTab === "revenue-schedules" ? (
                  <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
                    <ListHeader
                      showCreateButton={false}
                      onSearch={setRevenueSearchQuery}
                      searchPlaceholder="Search revenue schedules"
                      filterColumns={REVENUE_FILTER_COLUMNS}
                      columnFilters={revenueColumnFilters}
                      onColumnFiltersChange={setRevenueColumnFilters}
                      onSettingsClick={() => setShowRevenueColumnSettings(true)}
                      statusFilter={revenueStatusFilter}
                      onFilterChange={value => setRevenueStatusFilter(value === "inactive" ? "inactive" : "active")}
                      hasUnsavedTableChanges={revenueHasUnsavedChanges}
                      isSavingTableChanges={revenuePreferencesSaving}
                      lastTableSaved={revenueLastSaved ?? undefined}
                      onSaveTableChanges={saveRevenuePreferences}
                      canExport={selectedRevenueSchedules.length > 0}
                      onExport={handleRevenueExportCsv}
                    />

                    <div className="flex min-h-0 flex-col overflow-hidden" ref={tableAreaRefCallback}>
                      <DynamicTable
                        className="flex flex-col"
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
                ) : activeTab === "activities" ? (
                  <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                    Activities & Notes are being rebuilt. Check back soon.
                  </div>
                ) : activeTab === "history" ? (

                  <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
                    <ListHeader
                      showCreateButton={false}
                      onSearch={setHistorySearchQuery}
                      searchPlaceholder="Search history"
                      filterColumns={HISTORY_FILTER_COLUMNS}
                      columnFilters={historyColumnFilters}
                      onColumnFiltersChange={setHistoryColumnFilters}
                      onSettingsClick={() => setShowHistoryColumnSettings(true)}
                      hasUnsavedTableChanges={historyHasUnsavedChanges}
                      isSavingTableChanges={historyPreferencesSaving}
                      lastTableSaved={historyLastSaved ?? undefined}
                      onSaveTableChanges={saveHistoryPreferences}
                    />

                    <div className="flex min-h-0 flex-col overflow-hidden" ref={tableAreaRefCallback}>
                      {historyError ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                          {historyError}
                        </div>
                      ) : (
                        <DynamicTable
                          className="flex flex-col"
                          columns={historyTableColumns}
                          data={filteredHistoryRows}
                          loading={historyLoading || historyPreferencesLoading}
                          onColumnsChange={handleHistoryColumnsChange}
                          emptyMessage="No audit history available yet"
                          maxBodyHeight={tableBodyMaxHeight}
                        />
                      )}
                    </div>
                  </div>
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
              isOpen={showRevenueColumnSettings}
              columns={revenuePreferenceColumns}
              onApply={handleRevenueColumnsChange}
              onClose={async () => {
                setShowRevenueColumnSettings(false)
                await saveRevenuePrefsOnModalClose()
              }}
            />
            <ColumnChooserModal
              isOpen={showHistoryColumnSettings}
              columns={historyPreferenceColumns}
              onApply={handleHistoryColumnsChange}
              onClose={async () => {
                setShowHistoryColumnSettings(false)
                await saveHistoryPrefsOnModalClose()
              }}
            />
          </div>
        </div>
      </div>

      <OpportunityLineItemCreateModal
        isOpen={showCreateLineItemModal}
        opportunityId={opportunity.id}
        onClose={() => setShowCreateLineItemModal(false)}
        onSuccess={async () => {
          await onRefresh?.()
          await fetchHistory()
        }}
      />

      <OpportunityLineItemEditModal
        isOpen={Boolean(editingLineItem)}
        opportunityId={opportunity.id}
        lineItem={editingLineItem}
        onClose={() => setEditingLineItem(null)}
        onSuccess={async () => {
          await onRefresh?.()
          await fetchHistory()
        }}
      /><ConfirmDialog
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
      /></>
  )
}
