'use client'

import { useMemo, useState } from 'react'
import { Beaker } from 'lucide-react'
import { DynamicTable, type Column } from '@/components/dynamic-table'
import { cn } from '@/lib/utils'

type PreviewVariant = 'minimal' | 'ag-flash' | 'row-band' | 'strikethrough' | 'delta-badge' | 'ghost-prev'

type PrototypeLineRow = {
  id: string
  paymentDate: string
  status: 'Unmatched' | 'Matched'
  distributorName: string
  lineItem: number
  vendorName: string
  accountLegalName: string
  accountName: string
  productName: string
  usageUnallocated: number
  actualUsage: number
  commissionAllocated: number
  commissionUnallocated: number
  actualCommission: number
  actualCommissionRatePercent: number
}

type PrototypeScheduleRow = {
  id: string
  confidence: number
  status: 'Suggested' | 'Matched'
  opportunityName: string
  vendorName: string
  accountLegalName: string
  accountName: string
  productName: string
  revenueScheduleName: string
  expectedUsageNet: number
  actualUsage: number
  usageBalance: number
  expectedCommissionGross: number
  expectedCommissionAdjustment: number
  expectedCommissionNet: number
  actualCommission: number
  actualCommissionRatePercent: number
}

type PreviewCellState = {
  actualUsage: number
  actualCommission: number
  actualCommissionRatePercent: number
  usageBalance: number
  changed: {
    actualUsage: boolean
    actualCommission: boolean
    actualCommissionRatePercent: boolean
    usageBalance: boolean
  }
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const previewVariantCopy: Record<
  PreviewVariant,
  { title: string; description: string }
> = {
  minimal: {
    title: 'Minimal Enterprise',
    description: 'Soft full-cell highlight with stronger number treatment and no decorative chip.'
  },
  'ag-flash': {
    title: 'AG Grid-Inspired Flash',
    description: 'Changed cells flash into a warmer highlight so the preview feels live without changing table density.'
  },
  'row-band': {
    title: 'Row Band + Changed Cells',
    description: 'Adds a row-level preview band while keeping changed cells highlighted for denser scan support.'
  },
  strikethrough: {
    title: 'Strikethrough Before/After',
    description: 'Old value crossed out above the new value — classic accounting ledger pattern for verifying replacements.'
  },
  'delta-badge': {
    title: 'Delta Badge',
    description: 'New value with an inline pill showing the change amount — trading terminal pattern for magnitude awareness.'
  },
  'ghost-prev': {
    title: 'Ghost Previous',
    description: 'New value prominent with old value as small muted text — clean revision history pattern.'
  }
}

const seedLineRows: PrototypeLineRow[] = [
  {
    id: 'line-01',
    paymentDate: '2025-12-01',
    status: 'Unmatched',
    distributorName: 'Telarus',
    lineItem: 1,
    vendorName: 'ACC Business',
    accountLegalName: 'DW Realty GA, LLC',
    accountName: 'DW Realty GA',
    productName: 'Ethernet - Fiber',
    usageUnallocated: 600,
    actualUsage: 600,
    commissionAllocated: 0,
    commissionUnallocated: 96,
    actualCommission: 96,
    actualCommissionRatePercent: 16
  },
  {
    id: 'line-02',
    paymentDate: '2025-12-01',
    status: 'Unmatched',
    distributorName: 'Telarus',
    lineItem: 2,
    vendorName: 'ACC Business',
    accountLegalName: 'Edge Business',
    accountName: 'Edge Business',
    productName: 'Ethernet - Fiber',
    usageUnallocated: 29.9,
    actualUsage: 29.9,
    commissionAllocated: 0,
    commissionUnallocated: 4.78,
    actualCommission: 4.78,
    actualCommissionRatePercent: 15.99
  },
  {
    id: 'line-03',
    paymentDate: '2025-12-01',
    status: 'Unmatched',
    distributorName: 'Telarus',
    lineItem: 3,
    vendorName: 'ACC Business',
    accountLegalName: 'Edge Business',
    accountName: 'Edge Business',
    productName: 'Business Cable',
    usageUnallocated: 165,
    actualUsage: 165,
    commissionAllocated: 0,
    commissionUnallocated: 26.4,
    actualCommission: 26.4,
    actualCommissionRatePercent: 16
  }
]

const seedScheduleRows: PrototypeScheduleRow[] = [
  {
    id: 'schedule-01',
    confidence: 1,
    status: 'Suggested',
    opportunityName: 'DW Realty - GA - Telarus - ACC - Fiber',
    vendorName: 'ACC Business',
    accountLegalName: 'DW Realty GA',
    accountName: 'DW Realty GA',
    productName: 'Ethernet - Fiber',
    revenueScheduleName: '12698',
    expectedUsageNet: 599,
    actualUsage: 0,
    usageBalance: 599,
    expectedCommissionGross: 95.84,
    expectedCommissionAdjustment: 0,
    expectedCommissionNet: 95.84,
    actualCommission: 0,
    actualCommissionRatePercent: 0
  },
  {
    id: 'schedule-02',
    confidence: 1,
    status: 'Suggested',
    opportunityName: 'DW Realty - GA - Telarus - ACC - Fiber',
    vendorName: 'ACC Business',
    accountLegalName: 'DW Realty GA',
    accountName: 'DW Realty GA',
    productName: 'Ethernet - Fiber',
    revenueScheduleName: '12710',
    expectedUsageNet: 599,
    actualUsage: 0,
    usageBalance: 599,
    expectedCommissionGross: 95.84,
    expectedCommissionAdjustment: 0,
    expectedCommissionNet: 95.84,
    actualCommission: 0,
    actualCommissionRatePercent: 0
  },
  {
    id: 'schedule-03',
    confidence: 0.94,
    status: 'Suggested',
    opportunityName: 'DW Realty - GA - Telarus - ACC - Cable',
    vendorName: 'ACC Business',
    accountLegalName: 'DW Realty GA',
    accountName: 'DW Realty GA',
    productName: 'Business Cable',
    revenueScheduleName: '12699',
    expectedUsageNet: 165,
    actualUsage: 0,
    usageBalance: 165,
    expectedCommissionGross: 26.4,
    expectedCommissionAdjustment: 0,
    expectedCommissionNet: 26.4,
    actualCommission: 0,
    actualCommissionRatePercent: 0
  }
]

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatPercent(value: number) {
  return `${percentFormatter.format(value)}%`
}

function renderStatusPill(value: string) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
        value === 'Suggested'
          ? 'bg-indigo-50 text-indigo-700'
          : value === 'Matched'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-red-50 text-red-700'
      )}
    >
      <span
        className={cn(
          'mr-1.5 h-2 w-2 rounded-full',
          value === 'Suggested'
            ? 'bg-indigo-500'
            : value === 'Matched'
              ? 'bg-emerald-500'
              : 'bg-red-500'
        )}
      />
      {value}
    </span>
  )
}

function previewCellClassName(params: {
  changed: boolean
  variant: PreviewVariant
  selectedRow: boolean
}) {
  if (!params.changed) {
    return 'inline-flex min-h-[26px] w-full items-center justify-end px-2 py-1 text-slate-900'
  }

  if (params.variant === 'minimal') {
    return 'inline-flex min-h-[26px] w-full items-center justify-end rounded-sm bg-[#fff3bf] px-2 py-1 font-bold text-[#166534]'
  }

  if (params.variant === 'ag-flash') {
    return 'inline-flex min-h-[26px] w-full items-center justify-end rounded-sm bg-[linear-gradient(90deg,#fff7d6_0%,#ffe28a_45%,#fff2c2_100%)] px-2 py-1 font-bold text-[#166534] shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]'
  }

  return cn(
    'inline-flex min-h-[26px] w-full items-center justify-end rounded-sm px-2 py-1 font-bold text-[#166534]',
    params.selectedRow
      ? 'bg-[#fde68a] shadow-[inset_0_0_0_1px_rgba(217,119,6,0.24)]'
      : 'bg-[#fef3c7]'
  )
}

export default function ReconciliationLivePreviewPrototypePage() {
  const [previewVariant, setPreviewVariant] = useState<PreviewVariant>('minimal')
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(['line-01'])
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>(['schedule-01'])

  const selectedLine = useMemo(
    () => seedLineRows.find(row => row.id === selectedLineIds[0]) ?? null,
    [selectedLineIds]
  )

  const previewByScheduleId = useMemo(() => {
    const map = new Map<string, PreviewCellState>()
    if (!selectedLine || selectedScheduleIds.length === 0) return map

    for (const scheduleId of selectedScheduleIds) {
      const schedule = seedScheduleRows.find(row => row.id === scheduleId)
      if (!schedule) continue

      const nextActualUsage = selectedLine.actualUsage
      const nextActualCommission = selectedLine.actualCommission
      const nextActualRate =
        nextActualUsage > 0.005 ? (nextActualCommission / nextActualUsage) * 100 : 0
      const nextUsageBalance = schedule.expectedUsageNet - nextActualUsage

      map.set(scheduleId, {
        actualUsage: nextActualUsage,
        actualCommission: nextActualCommission,
        actualCommissionRatePercent: nextActualRate,
        usageBalance: nextUsageBalance,
        changed: {
          actualUsage: Math.abs(nextActualUsage - schedule.actualUsage) > 0.005,
          actualCommission: Math.abs(nextActualCommission - schedule.actualCommission) > 0.005,
          actualCommissionRatePercent:
            Math.abs(nextActualRate - schedule.actualCommissionRatePercent) > 0.005,
          usageBalance: Math.abs(nextUsageBalance - schedule.usageBalance) > 0.005
        }
      })
    }

    return map
  }, [selectedLine, selectedScheduleIds])

  const lineColumns = useMemo<Column[]>(() => {
    return [
      { id: 'select', label: 'Select', width: 64, type: 'checkbox', sortable: false, resizable: false, hideable: false },
      { id: 'paymentDate', label: 'Payment Date', width: 120, sortable: true },
      {
        id: 'status',
        label: 'Deposit Status',
        width: 140,
        sortable: true,
        render: (value: PrototypeLineRow['status']) => renderStatusPill(value)
      },
      { id: 'distributorName', label: 'Distributor Name', width: 150, sortable: true },
      { id: 'lineItem', label: 'Line Item', width: 90, sortable: true },
      { id: 'vendorName', label: 'Vendor Name', width: 150, sortable: true },
      { id: 'accountLegalName', label: 'Account Legal Name', width: 180, sortable: true, truncate: true },
      { id: 'accountName', label: 'Account Name', width: 160, sortable: true, truncate: true },
      { id: 'productName', label: 'Other - Product Name', width: 180, sortable: true, truncate: true },
      { id: 'usageUnallocated', label: 'Usage Unallocated', width: 150, sortable: true, render: (value: number) => formatCurrency(value) },
      { id: 'actualUsage', label: 'Actual Usage', width: 130, sortable: true, render: (value: number) => formatCurrency(value) },
      { id: 'commissionAllocated', label: 'Commission Allocated', width: 170, sortable: true, render: (value: number) => formatCurrency(value) },
      { id: 'commissionUnallocated', label: 'Commission Unallocated', width: 180, sortable: true, render: (value: number) => formatCurrency(value) },
      { id: 'actualCommission', label: 'Actual Commission', width: 150, sortable: true, render: (value: number) => formatCurrency(value) },
      {
        id: 'actualCommissionRatePercent',
        label: 'Actual Commission Rate %',
        width: 180,
        sortable: true,
        render: (value: number) => formatPercent(value)
      }
    ]
  }, [])

  const scheduleColumns = useMemo<Column[]>(() => {
    const renderPreviewValue = (
      row: PrototypeScheduleRow,
      field: keyof PreviewCellState['changed'],
      fallback: number,
      formatter: (value: number) => string
    ) => {
      const preview = previewByScheduleId.get(row.id)
      const selectedRow = selectedScheduleIds.includes(row.id)
      const nextValue =
        field === 'actualUsage'
          ? preview?.actualUsage
          : field === 'actualCommission'
            ? preview?.actualCommission
            : field === 'actualCommissionRatePercent'
              ? preview?.actualCommissionRatePercent
              : preview?.usageBalance
      const changed = preview?.changed[field] ?? false
      const oldValue = fallback
      const newValue = typeof nextValue === 'number' ? nextValue : fallback

      // --- Strikethrough Before/After ---
      if (previewVariant === 'strikethrough') {
        if (!changed) {
          return (
            <span className="inline-flex min-h-[26px] w-full items-center justify-end px-2 py-1 text-slate-900">
              {formatter(oldValue)}
            </span>
          )
        }
        return (
          <span className="inline-flex min-h-[40px] w-full flex-col items-end justify-center gap-0 rounded-sm bg-emerald-50 px-2 py-0.5">
            <span className="text-[10px] leading-tight text-slate-400 line-through decoration-slate-400/60">
              {formatter(oldValue)}
            </span>
            <span className="text-[13px] font-semibold leading-tight text-emerald-700">
              {formatter(newValue)}
            </span>
          </span>
        )
      }

      // --- Delta Badge ---
      if (previewVariant === 'delta-badge') {
        if (!changed) {
          return (
            <span className="inline-flex min-h-[26px] w-full items-center justify-end px-2 py-1 text-slate-900">
              {formatter(oldValue)}
            </span>
          )
        }
        const delta = newValue - oldValue
        const isPositive = delta >= 0
        return (
          <span className="inline-flex min-h-[26px] w-full items-center justify-end gap-1.5 px-2 py-1">
            <span className="font-semibold text-slate-900">{formatter(newValue)}</span>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap',
                isPositive
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60'
                  : 'bg-red-50 text-red-600 ring-1 ring-red-200/60'
              )}
            >
              <span className="text-[9px]">{isPositive ? '\u25B2' : '\u25BC'}</span>
              {isPositive ? '+' : ''}{formatter(delta)}
            </span>
          </span>
        )
      }

      // --- Ghost Previous Value ---
      if (previewVariant === 'ghost-prev') {
        if (!changed) {
          return (
            <span className="inline-flex min-h-[26px] w-full items-center justify-end px-2 py-1 text-slate-900">
              {formatter(oldValue)}
            </span>
          )
        }
        return (
          <span className="relative inline-flex min-h-[34px] w-full items-center justify-end rounded-sm border-l-2 border-emerald-400 bg-slate-50 px-2 py-1">
            <span className="font-semibold text-emerald-700">{formatter(newValue)}</span>
            <span className="absolute right-1.5 top-0.5 text-[9px] leading-none text-slate-400">
              was {formatter(oldValue)}
            </span>
          </span>
        )
      }

      // --- Original 3 variants (minimal, ag-flash, row-band) ---
      return (
        <span className={previewCellClassName({ changed, variant: previewVariant, selectedRow })}>
          {formatter(newValue)}
        </span>
      )
    }

    return [
      { id: 'select', label: 'Select', width: 64, type: 'checkbox', sortable: false, resizable: false, hideable: false },
      {
        id: 'confidence',
        label: 'AI Confidence',
        width: 120,
        sortable: true,
        render: (value: number) => `${Math.round(value * 100)}%`
      },
      {
        id: 'status',
        label: 'Status',
        width: 110,
        sortable: true,
        render: (value: PrototypeScheduleRow['status']) => renderStatusPill(value)
      },
      { id: 'opportunityName', label: 'Opportunity Name', width: 250, sortable: true, truncate: true },
      { id: 'vendorName', label: 'Vendor Name', width: 140, sortable: true },
      { id: 'accountLegalName', label: 'Account Legal Name', width: 150, sortable: true, truncate: true },
      { id: 'accountName', label: 'Account Name', width: 140, sortable: true, truncate: true },
      { id: 'productName', label: 'Other - Product Name', width: 180, sortable: true, truncate: true },
      { id: 'revenueScheduleName', label: 'Revenue Schedule Name', width: 160, sortable: true },
      {
        id: 'expectedUsageNet',
        label: 'Expected Usage Net',
        width: 160,
        sortable: true,
        render: (value: number) => formatCurrency(value)
      },
      {
        id: 'actualUsage',
        label: 'Actual Usage',
        width: 140,
        sortable: true,
        render: (value: number, row: PrototypeScheduleRow) =>
          renderPreviewValue(row, 'actualUsage', value, formatCurrency)
      },
      {
        id: 'usageBalance',
        label: 'Usage Balance',
        width: 140,
        sortable: true,
        render: (value: number, row: PrototypeScheduleRow) =>
          renderPreviewValue(row, 'usageBalance', value, formatCurrency)
      },
      {
        id: 'expectedCommissionGross',
        label: 'Expected Commission Gross',
        width: 190,
        sortable: true,
        render: (value: number) => formatCurrency(value)
      },
      {
        id: 'expectedCommissionAdjustment',
        label: 'Expected Commission Adjustment',
        width: 220,
        sortable: true,
        render: (value: number) => formatCurrency(value)
      },
      {
        id: 'expectedCommissionNet',
        label: 'Expected Commission Net',
        width: 180,
        sortable: true,
        render: (value: number) => formatCurrency(value)
      },
      {
        id: 'actualCommission',
        label: 'Actual Commission',
        width: 150,
        sortable: true,
        render: (value: number, row: PrototypeScheduleRow) =>
          renderPreviewValue(row, 'actualCommission', value, formatCurrency)
      },
      {
        id: 'actualCommissionRatePercent',
        label: 'Actual Commission Rate %',
        width: 190,
        sortable: true,
        render: (value: number, row: PrototypeScheduleRow) =>
          renderPreviewValue(row, 'actualCommissionRatePercent', value, formatPercent)
      }
    ]
  }, [previewByScheduleId, previewVariant, selectedScheduleIds])

  const scheduleTableClassName =
    previewVariant === 'row-band'
      ? 'prototype-preview-table prototype-preview-table--row-band'
      : 'prototype-preview-table'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <style>{`
        .prototype-preview-table--row-band .table-row[data-row-selected="true"] > .table-cell {
          background: linear-gradient(90deg, rgba(253, 230, 138, 0.28) 0, rgba(253, 230, 138, 0.14) 14px, transparent 14px);
        }
        .prototype-preview-table--row-band .table-row[data-row-selected="true"] > .table-cell:first-child {
          box-shadow: inset 4px 0 0 #d97706;
        }
        .prototype-live-preview-table .table-header .table-cell {
          padding-top: 1px;
          padding-bottom: 1px;
          padding-left: 8px;
          padding-right: 8px;
        }
        .prototype-live-preview-table .table-cell {
          min-height: 24px;
          padding: 3px 8px;
        }
        .prototype-live-preview-table .table-scroll-container::-webkit-scrollbar {
          height: 10px;
        }
      `}</style>

      <div className="flex-1 min-h-0 overflow-hidden px-3 py-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold leading-tight text-gray-900">Reconciliation Live Preview</h1>
          <div className="flex flex-wrap gap-1.5">
            {(['minimal', 'ag-flash', 'row-band', 'strikethrough', 'delta-badge', 'ghost-prev'] as PreviewVariant[]).map(variant => (
              <button
                key={variant}
                type="button"
                onClick={() => setPreviewVariant(variant)}
                className={cn(
                  'rounded-md border px-2.5 py-1.5 text-xs font-semibold transition',
                  previewVariant === variant
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                )}
                title={previewVariantCopy[variant].description}
              >
                {previewVariantCopy[variant].title}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-1 grid-rows-2 gap-2">
          <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm">
            <div className="mb-1">
              <h2 className="text-sm font-semibold text-slate-900">Deposit Line Items</h2>
            </div>
            <div className="min-h-0 flex-1">
              <DynamicTable
                className="prototype-live-preview-table"
                columns={lineColumns}
                data={seedLineRows}
                preferOverflowHorizontalScroll
                fillContainerWidth={false}
                maxBodyHeight={165}
                selectedItems={selectedLineIds}
                onItemSelect={(itemId, selected) => {
                  setSelectedLineIds(selected ? [itemId] : [])
                }}
                onSelectAll={selected => {
                  setSelectedLineIds(selected ? [seedLineRows[0]!.id] : [])
                }}
                selectHeaderLabel="Select"
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm">
            <div className="mb-1">
              <h2 className="text-sm font-semibold text-slate-900">Suggested Matches - Revenue Schedules</h2>
            </div>
            <div className="min-h-0 flex-1">
              <DynamicTable
                className={cn('prototype-live-preview-table', scheduleTableClassName)}
                columns={scheduleColumns}
                data={seedScheduleRows}
                preferOverflowHorizontalScroll
                fillContainerWidth={false}
                maxBodyHeight={185}
                selectedItems={selectedScheduleIds}
                onItemSelect={(itemId, selected) => {
                  setSelectedScheduleIds(selected ? [itemId] : [])
                }}
                onSelectAll={selected => {
                  setSelectedScheduleIds(selected ? [seedScheduleRows[0]!.id] : [])
                }}
                selectHeaderLabel="Select"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
