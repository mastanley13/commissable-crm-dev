"use client"

import { useMemo, useState } from "react"
import {
  CalendarRange,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileDown,
  Filter as FilterIcon,
  Link2,
  Search,
  Settings2,
  Trash2
} from "lucide-react"
import { DynamicTable, type Column } from "./dynamic-table"
import { calculateMinWidth } from "@/lib/column-width-utils"
import { cn } from "@/lib/utils"
import type { DepositLineItemRow, SuggestedMatchScheduleRow } from "@/lib/mock-data"

export interface DepositReconciliationMetadata {
  id: string
  depositName: string
  depositDate: string
  createdBy: string
  paymentType: string
  usageTotal: number
  unallocated: number
  allocated: number
}

type LineTabKey = "matched" | "unmatched" | "partial" | "all"
type ScheduleTabKey = "suggested" | "all" | "reconciled" | "unreconciled"

const lineTabOptions: Array<{ id: LineTabKey; label: string }> = [
  { id: "matched", label: "Matched" },
  { id: "unmatched", label: "Unmatched" },
  { id: "partial", label: "Partial" },
  { id: "all", label: "All" }
]

const scheduleTabOptions: Array<{ id: ScheduleTabKey; label: string }> = [
  { id: "suggested", label: "Suggested" },
  { id: "all", label: "All Schedules" },
  { id: "reconciled", label: "Reconciled" },
  { id: "unreconciled", label: "Un-Reconciled" }
]

const lineStatusStyles: Record<DepositLineItemRow["status"], string> = {
  Matched: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  Unreconciled: "bg-red-100 text-red-700 border border-red-200",
  "Partially Matched": "bg-amber-100 text-amber-700 border border-amber-200"
}

const scheduleStatusStyles: Record<SuggestedMatchScheduleRow["status"], string> = {
  Suggested: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  Reconciled: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Un-Reconciled": "bg-amber-50 text-amber-700 border border-amber-200"
}

interface DepositReconciliationDetailViewProps {
  metadata: DepositReconciliationMetadata
  lineItems: DepositLineItemRow[]
  schedules: SuggestedMatchScheduleRow[]
  loading?: boolean
}

interface SegmentedTabsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: Array<{ id: T; label: string }>
}

function SegmentedTabs<T extends string>({ value, onChange, options }: SegmentedTabsProps<T>) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
      {options.map(option => (
        <button
          type="button"
          key={option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-full px-3 py-1 transition-colors",
            value === option.id
              ? "bg-white text-primary-600 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface DateInputProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function DateInput({ label, value, onChange }: DateInputProps) {
  return (
    <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
      <span className="relative mt-1">
        <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="date"
          value={value}
          onChange={event => onChange(event.target.value)}
          className="w-32 rounded-full border border-slate-200 bg-white px-10 py-1.5 text-sm font-medium text-slate-700 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </span>
    </label>
  )
}

interface FilterToolbarProps {
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  onColumnButtonClick?: () => void
  onApplyFilter?: () => void
  onSettingsClick?: () => void
  className?: string
}

function FilterToolbar({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search Here",
  onColumnButtonClick,
  onApplyFilter,
  onSettingsClick,
  className
}: FilterToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <DateInput label="Start Date" value={startDate} onChange={onStartDateChange} />
        <DateInput label="End Date" value={endDate} onChange={onEndDateChange} />

        <button
          type="button"
          onClick={() => onColumnButtonClick?.()}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
        >
          Filter By Column
          <ChevronDown className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => onApplyFilter?.()}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          <FilterIcon className="h-4 w-4" />
          Apply Filter
        </button>

        <button
          type="button"
          onClick={() => onSettingsClick?.()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:text-primary-600"
          aria-label="Table settings"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </div>

      <div className="ml-auto flex w-full sm:w-auto">
        <div className="relative w-full sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchValue}
            onChange={event => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-1.5 pl-10 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>
    </div>
  )
}

interface MetaStatProps {
  label: string
  value: string
  emphasis?: boolean
  wrapValue?: boolean
}

function MetaStat({ label, value, emphasis = false, wrapValue = false }: MetaStatProps) {
  return (
    <div className="px-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-semibold text-slate-900",
          emphasis ? "text-base" : "text-sm",
          wrapValue ? "break-all" : undefined
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function DepositReconciliationDetailView({
  metadata,
  lineItems,
  schedules,
  loading = false
}: DepositReconciliationDetailViewProps) {
  const [lineTab, setLineTab] = useState<LineTabKey>("matched")
  const [scheduleTab, setScheduleTab] = useState<ScheduleTabKey>("suggested")
  const [lineSearch, setLineSearch] = useState("")
  const [scheduleSearch, setScheduleSearch] = useState("")
  const [lineStartDate, setLineStartDate] = useState("")
  const [lineEndDate, setLineEndDate] = useState("")
  const [scheduleStartDate, setScheduleStartDate] = useState("")
  const [scheduleEndDate, setScheduleEndDate] = useState("")

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2
      }),
    []
  )
  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }),
    []
  )
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }),
    []
  )

  const lineSearchValue = lineSearch.trim().toLowerCase()
  const scheduleSearchValue = scheduleSearch.trim().toLowerCase()

  const filteredLineItems = useMemo(() => {
    return lineItems.filter(item => {
      const matchesTab =
        lineTab === "all"
          ? true
          : lineTab === "matched"
            ? item.status === "Matched"
            : lineTab === "unmatched"
              ? item.status === "Unreconciled"
              : item.status === "Partially Matched"

      const matchesSearch = lineSearchValue
        ? [item.accountName, item.accountId, item.productName]
            .map(value => value.toLowerCase())
            .some(value => value.includes(lineSearchValue))
        : true

      return matchesTab && matchesSearch
    })
  }, [lineItems, lineTab, lineSearchValue])

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      const matchesTab =
        scheduleTab === "all"
          ? true
          : scheduleTab === "suggested"
            ? schedule.status === "Suggested"
            : scheduleTab === "reconciled"
              ? schedule.status === "Reconciled"
              : schedule.status === "Un-Reconciled"

      const matchesSearch = scheduleSearchValue
        ? [
            schedule.name,
            schedule.number,
            schedule.accountLegalName,
            schedule.product,
            schedule.vendorName
          ]
            .map(value => value.toLowerCase())
            .some(value => value.includes(scheduleSearchValue))
        : true

      return matchesTab && matchesSearch
    })
  }, [schedules, scheduleTab, scheduleSearchValue])

  const lineColumns = useMemo<Column[]>(() => {
    return [
      {
        id: "match",
        label: "Match",
        width: 140,
        minWidth: 120,
        accessor: "id",
        render: () => (
          <button
            type="button"
            className="rounded-full border border-primary-200 bg-white px-4 py-1.5 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            Match
          </button>
        )
      },
      {
        id: "status",
        label: "Status",
        width: 160,
        minWidth: calculateMinWidth({ label: "Status", type: "text", sortable: false }),
        render: (value: DepositLineItemRow["status"]) => (
          <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", lineStatusStyles[value])}>
            {value}
          </span>
        )
      },
      {
        id: "paymentDate",
        label: "Payment Date",
        width: 160,
        minWidth: calculateMinWidth({ label: "Payment Date", type: "text", sortable: false }),
        render: (value: string) => {
          const parsed = new Date(value)
          return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed)
        }
      },
      {
        id: "accountName",
        label: "Account",
        width: 200,
        minWidth: calculateMinWidth({ label: "Account", type: "text", sortable: false })
      },
      {
        id: "lineItem",
        label: "Line Item",
        width: 120,
        minWidth: 100
      },
      {
        id: "productName",
        label: "Product Name",
        width: 220,
        minWidth: 200
      },
      {
        id: "usage",
        label: "Usage",
        width: 140,
        minWidth: 120,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "commission",
        label: "Commission",
        width: 140,
        minWidth: 120,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "commissionRate",
        label: "Commission Rate",
        width: 160,
        minWidth: 140,
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "accountId",
        label: "Account ID",
        width: 160,
        minWidth: 140
      }
    ]
  }, [currencyFormatter, percentFormatter, dateFormatter])

  const scheduleColumns = useMemo<Column[]>(() => {
    return [
      {
        id: "actions",
        label: "Actions",
        width: 160,
        minWidth: 100,
        accessor: "id",
        render: () => (
          <div className="flex items-center gap-1 text-primary-500">
            {[Eye, Link2, ClipboardCheck, FileDown, Trash2].map((Icon, index) => (
              <button
                type="button"
                key={index}
                className="rounded-full border border-transparent p-1.5 transition hover:border-primary-100 hover:bg-primary-50"
                aria-label="Schedule action"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        )
      },
      {
        id: "sequence",
        label: "#",
        width: 60,
        minWidth: calculateMinWidth({ label: "#", type: "text", sortable: false })
      },
      {
        id: "name",
        label: "Name",
        width: 140,
        minWidth: calculateMinWidth({ label: "Name", type: "text", sortable: false })
      },
      {
        id: "date",
        label: "Date",
        width: 160,
        minWidth: calculateMinWidth({ label: "Date", type: "text", sortable: false }),
        render: (value: string) => {
          const parsed = new Date(value)
          return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed)
        }
      },
      {
        id: "accountLegalName",
        label: "Account Legal Name",
        width: 220,
        minWidth: calculateMinWidth({ label: "Account Legal Name", type: "text", sortable: false })
      },
      {
        id: "product",
        label: "Product",
        width: 220,
        minWidth: calculateMinWidth({ label: "Product", type: "text", sortable: false })
      },
      {
        id: "vendorName",
        label: "Vendor Name",
        width: 180,
        minWidth: calculateMinWidth({ label: "Vendor Name", type: "text", sortable: false })
      },
      {
        id: "quantity",
        label: "Quantity",
        width: 120,
        minWidth: calculateMinWidth({ label: "Quantity", type: "text", sortable: false })
      },
      {
        id: "priceEach",
        label: "Price Each",
        width: 140,
        minWidth: calculateMinWidth({ label: "Price Each", type: "text", sortable: false }),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedUsageGross",
        label: "Expected Usage Gross",
        width: 200,
        minWidth: calculateMinWidth({ label: "Expected Usage Gross", type: "text", sortable: false }),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedUsageAdjust",
        label: "Expected Usage Adjust",
        width: 200,
        minWidth: calculateMinWidth({ label: "Expected Usage Adjust", type: "text", sortable: false }),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "status",
        label: "Status",
        width: 160,
        minWidth: calculateMinWidth({ label: "Status", type: "text", sortable: false }),
        render: (value: SuggestedMatchScheduleRow["status"]) => (
          <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", scheduleStatusStyles[value])}>
            {value}
          </span>
        )
      }
    ]
  }, [currencyFormatter, dateFormatter])

  const formattedDate = useMemo(() => {
    const parsed = new Date(metadata.depositDate)
    return Number.isNaN(parsed.getTime()) ? metadata.depositDate : dateFormatter.format(parsed)
  }, [metadata.depositDate, dateFormatter])

  return (
    <div className="flex min-h-[calc(100vh-110px)] flex-col gap-3 px-4 pb-4 pt-3 sm:px-6">
      <div className="flex-shrink-0 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">Deposit Reconciliation</p>
        <div className="grid grid-cols-8 gap-4 text-sm font-medium text-slate-700">
          <div className="col-span-2 min-w-0">
            <MetaStat label="Deposit Name" value={metadata.depositName} emphasis wrapValue />
          </div>
          <MetaStat label="Date" value={formattedDate} />
          <MetaStat label="Created By" value={metadata.createdBy} />
          <MetaStat label="Payment Type" value={metadata.paymentType} />
          <MetaStat label="Usage Total" value={currencyFormatter.format(metadata.usageTotal)} emphasis />
          <MetaStat label="Unallocated" value={currencyFormatter.format(metadata.unallocated)} emphasis />
          <MetaStat label="Allocated" value={currencyFormatter.format(metadata.allocated)} emphasis />
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900">Deposit Line Items</p>
          </div>
          <SegmentedTabs value={lineTab} onChange={setLineTab} options={lineTabOptions} />
        </div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
          <FilterToolbar
            startDate={lineStartDate}
            endDate={lineEndDate}
            onStartDateChange={setLineStartDate}
            onEndDateChange={setLineEndDate}
            searchValue={lineSearch}
            onSearchChange={setLineSearch}
            searchPlaceholder="Search deposit line items"
            className="flex-shrink-0"
          />
          <div className="flex min-h-0 flex-1">
            <DynamicTable
              columns={lineColumns}
              data={filteredLineItems}
              loading={loading}
              emptyMessage="No deposit line items found"
              fillContainerWidth
              className="flex-1"
            />
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900">Suggested Matches &mdash; Revenue Schedules</p>
          </div>
          <SegmentedTabs value={scheduleTab} onChange={setScheduleTab} options={scheduleTabOptions} />
        </div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
          <FilterToolbar
            startDate={scheduleStartDate}
            endDate={scheduleEndDate}
            onStartDateChange={setScheduleStartDate}
            onEndDateChange={setScheduleEndDate}
            searchValue={scheduleSearch}
            onSearchChange={setScheduleSearch}
            searchPlaceholder="Search revenue schedules"
            className="flex-shrink-0"
          />
          <div className="flex min-h-0 flex-1">
            <DynamicTable
              columns={scheduleColumns}
              data={filteredSchedules}
              loading={loading}
              emptyMessage="No suggested schedules found"
              fillContainerWidth
              className="flex-1"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
