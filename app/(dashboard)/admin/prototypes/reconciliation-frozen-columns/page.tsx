'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { DynamicTable, type Column } from '@/components/dynamic-table'
import { cn } from '@/lib/utils'

type LineItemRow = {
  id: string
  distributorName: string
  vendorName: string
  lineItem: number
  paymentDate: string
  accountName: string
  productName: string
  depositStatus: 'Matched' | 'Unmatched'
  usageAllocated: number
  usageUnallocated: number
  actualCommissionRatePercent: number
  actualUsage: number
  actualCommission: number
  commissionAllocated: number
  commissionUnallocated: number
  otherCustomerId: string
  otherOrderId: string
}

type ScheduleRow = {
  id: string
  vendorName: string
  aiConfidence: number
  status: 'Suggested' | 'Linked' | 'Reconciled'
  lineItem: number
  revenueScheduleDate: string
  legalName: string
  productName: string
  revenueScheduleName: string
  paymentDate: string
  quantity: number
  priceEach: number
  expectedUsageNet: number
  actualUsage: number
  usageBalance: number
  expectedCommissionNet: number
  actualCommissionRatePercent: number
  actualCommission: number
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

function useSyncedHorizontalScroll(enabled: boolean, topRootRef: RefObject<HTMLElement | null>, bottomRootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!enabled) return
    const topRoot = topRootRef.current
    const bottomRoot = bottomRootRef.current
    if (!topRoot || !bottomRoot) return

    const topScroll = topRoot.querySelector<HTMLDivElement>('.table-scroll-container')
    const bottomScroll = bottomRoot.querySelector<HTMLDivElement>('.table-scroll-container')
    if (!topScroll || !bottomScroll) return

    let isSyncing = false
    let rafId = 0

    const sync = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (isSyncing) return
      isSyncing = true
      const nextLeft = source.scrollLeft
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        target.scrollLeft = nextLeft
        isSyncing = false
      })
    }

    const onTopScroll = () => sync(topScroll, bottomScroll)
    const onBottomScroll = () => sync(bottomScroll, topScroll)

    topScroll.addEventListener('scroll', onTopScroll, { passive: true })
    bottomScroll.addEventListener('scroll', onBottomScroll, { passive: true })

    return () => {
      topScroll.removeEventListener('scroll', onTopScroll)
      bottomScroll.removeEventListener('scroll', onBottomScroll)
      cancelAnimationFrame(rafId)
    }
  }, [enabled, topRootRef, bottomRootRef])
}

function reorderColumnsForFreeze(columns: Column[], frozenColumnIds: string[]) {
  const frozenSet = new Set(frozenColumnIds)
  const byId = new Map(columns.map(column => [column.id, column] as const))
  const frozen = frozenColumnIds.map(id => byId.get(id)).filter(Boolean) as Column[]
  const rest = columns.filter(column => !frozenSet.has(column.id))
  return [...frozen, ...rest]
}

function buildFrozenCss(scopeClass: string, columns: Column[], frozenCount: number) {
  const visibleColumns = columns.filter(column => !column.hidden)
  const clampedFrozenCount = Math.max(0, Math.min(frozenCount, visibleColumns.length))

  let left = 0
  const rules: string[] = []

  for (let index = 0; index < clampedFrozenCount; index++) {
    const col = visibleColumns[index]
    const nth = index + 1
    const leftPx = Math.max(0, Math.round(left))
    const zHeader = 60 + (clampedFrozenCount - index)
    const zBody = 30 + (clampedFrozenCount - index)
    const isLast = index === clampedFrozenCount - 1

    rules.push(`
.${scopeClass} .table-header .table-cell:nth-child(${nth}) {
  position: sticky;
  left: ${leftPx}px;
  z-index: ${zHeader};
}
.${scopeClass} .table-row > .table-cell:nth-child(${nth}) {
  position: sticky;
  left: ${leftPx}px;
  z-index: ${zBody};
}
${isLast ? `.${scopeClass} .table-row > .table-cell:nth-child(${nth}) { box-shadow: 8px 0 10px -10px rgba(0,0,0,0.35); }` : ''}
${isLast ? `.${scopeClass} .table-header .table-cell:nth-child(${nth}) { box-shadow: 8px 0 10px -10px rgba(0,0,0,0.35); }` : ''}
    `)

    left += col.width
  }

  return rules.join('\n')
}

const seedLineItems: LineItemRow[] = [
  {
    id: 'DL-1001',
    distributorName: 'Telarus',
    vendorName: 'ACC Business',
    lineItem: 1,
    paymentDate: '2025-12-01',
    accountName: 'iResearch',
    productName: 'MIS',
    depositStatus: 'Unmatched',
    usageAllocated: 0,
    usageUnallocated: 686,
    actualCommissionRatePercent: 16,
    actualUsage: 686,
    actualCommission: 109.76,
    commissionAllocated: 0,
    commissionUnallocated: 109.76,
    otherCustomerId: '1671920',
    otherOrderId: 'ORD-4318'
  },
  {
    id: 'DL-1002',
    distributorName: 'Telarus',
    vendorName: 'ACC Business',
    lineItem: 2,
    paymentDate: '2025-12-01',
    accountName: 'iResearch',
    productName: 'SIP Trunk',
    depositStatus: 'Matched',
    usageAllocated: 200,
    usageUnallocated: 0,
    actualCommissionRatePercent: 12.5,
    actualUsage: 200,
    actualCommission: 25,
    commissionAllocated: 25,
    commissionUnallocated: 0,
    otherCustomerId: '1671920',
    otherOrderId: 'ORD-4319'
  }
]

const seedSchedules: ScheduleRow[] = [
  {
    id: 'RS-2001',
    vendorName: 'ACC Business',
    aiConfidence: 0.92,
    status: 'Suggested',
    lineItem: 1,
    revenueScheduleDate: '2026-02-01',
    legalName: 'iResearch',
    productName: 'MIS',
    revenueScheduleName: 'MIS - Feb 2026',
    paymentDate: '2025-12-01',
    quantity: 686,
    priceEach: 1,
    expectedUsageNet: 686,
    actualUsage: 686,
    usageBalance: 0,
    expectedCommissionNet: 109.76,
    actualCommissionRatePercent: 16,
    actualCommission: 109.76
  },
  {
    id: 'RS-2002',
    vendorName: 'ACC Business',
    aiConfidence: 0.71,
    status: 'Suggested',
    lineItem: 2,
    revenueScheduleDate: '2026-02-01',
    legalName: 'iResearch',
    productName: 'SIP Trunk',
    revenueScheduleName: 'SIP Trunk - Feb 2026',
    paymentDate: '2025-12-01',
    quantity: 200,
    priceEach: 1,
    expectedUsageNet: 200,
    actualUsage: 200,
    usageBalance: 0,
    expectedCommissionNet: 25,
    actualCommissionRatePercent: 12.5,
    actualCommission: 25
  }
]

function buildLineItemColumns(): Column[] {
  return [
    { id: 'select', label: 'Select', width: 70, type: 'checkbox', sortable: false, resizable: false, hideable: false },
    { id: 'distributorName', label: 'Distributor Name', width: 170, sortable: true },
    { id: 'vendorName', label: 'Vendor Name', width: 160, sortable: true },
    { id: 'lineItem', label: 'Line Item', width: 90, sortable: true },
    { id: 'paymentDate', label: 'Payment Date', width: 130, sortable: true },
    { id: 'accountName', label: 'Account Name', width: 160, sortable: true, truncate: true },
    { id: 'productName', label: 'Other - Product Name', width: 170, sortable: true, truncate: true },
    {
      id: 'depositStatus',
      label: 'Deposit Status',
      width: 140,
      sortable: true,
      render: (value: LineItemRow['depositStatus']) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold',
            value === 'Matched' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          )}
        >
          <span className={cn('mr-1.5 h-2 w-2 rounded-full', value === 'Matched' ? 'bg-emerald-500' : 'bg-red-500')} />
          {value}
        </span>
      )
    },
    { id: 'usageAllocated', label: 'Usage Allocated', width: 130, sortable: true, render: (value: number) => formatCurrency(value) },
    { id: 'usageUnallocated', label: 'Usage Unallocated', width: 140, sortable: true, render: (value: number) => formatCurrency(value) },
    {
      id: 'actualCommissionRatePercent',
      label: 'Actual Commission Rate %',
      width: 170,
      sortable: true,
      render: (value: number) => formatPercent(value)
    },
    { id: 'actualUsage', label: 'Actual Usage', width: 120, sortable: true, render: (value: number) => formatCurrency(value) },
    { id: 'actualCommission', label: 'Actual Commission', width: 140, sortable: true, render: (value: number) => formatCurrency(value) },
    { id: 'commissionAllocated', label: 'Commission Allocated', width: 170, sortable: true, render: (value: number) => formatCurrency(value) },
    { id: 'commissionUnallocated', label: 'Commission Unallocated', width: 180, sortable: true, render: (value: number) => formatCurrency(value) },
    { id: 'otherCustomerId', label: 'Other - Customer ID', width: 160, sortable: true },
    { id: 'otherOrderId', label: 'Other - Order ID', width: 150, sortable: true }
  ]
}

function buildScheduleColumns(): Column[] {
  return [
    { id: 'select', label: 'Select', width: 70, type: 'checkbox', sortable: false, resizable: false, hideable: false },
    { id: 'vendorName', label: 'Vendor Name', width: 160, sortable: true },
    {
      id: 'aiConfidence',
      label: 'AI Confidence',
      width: 130,
      sortable: true,
      render: (value: number) => `${Math.round(value * 100)}%`
    },
    { id: 'status', label: 'Status', width: 110, sortable: true },
    { id: 'lineItem', label: 'Line Item', width: 90, sortable: true },
    { id: 'revenueScheduleDate', label: 'Revenue Schedule Date', width: 170, sortable: true },
    { id: 'legalName', label: 'Legal Name', width: 180, sortable: true, truncate: true },
    { id: 'productName', label: 'Other - Product Name', width: 170, sortable: true, truncate: true },
    { id: 'revenueScheduleName', label: 'Revenue Schedule Name', width: 190, sortable: true, truncate: true },
    { id: 'paymentDate', label: 'Payment Date', width: 130, sortable: true },
    { id: 'quantity', label: 'Quantity', width: 110, sortable: true, render: (value: number) => value.toLocaleString() },
    { id: 'priceEach', label: 'Price Each', width: 110, sortable: true, render: (value: number) => formatCurrency(value) },
    { id: 'expectedUsageNet', label: 'Expected Usage Net', width: 160, sortable: true, render: (value: number) => formatCurrency(value) },
    { id: 'actualUsage', label: 'Actual Usage', width: 120, sortable: true, render: (value: number) => formatCurrency(value) },
    { id: 'usageBalance', label: 'Usage Balance', width: 130, sortable: true, render: (value: number) => formatCurrency(value) },
    { id: 'expectedCommissionNet', label: 'Expected Commission Net', width: 180, sortable: true, render: (value: number) => formatCurrency(value) },
    {
      id: 'actualCommissionRatePercent',
      label: 'Actual Commission Rate %',
      width: 170,
      sortable: true,
      render: (value: number) => formatPercent(value)
    },
    { id: 'actualCommission', label: 'Actual Commission', width: 140, sortable: true, render: (value: number) => formatCurrency(value) }
  ]
}

const frozenLineColumnIds = ['select', 'usageUnallocated', 'actualCommissionRatePercent', 'actualCommission']
const frozenScheduleColumnIds = ['select', 'actualUsage', 'actualCommissionRatePercent', 'actualCommission']

export default function ReconciliationFrozenColumnsPrototypePage() {
  const [syncScroll, setSyncScroll] = useState(true)
  const [freezeKeyColumns, setFreezeKeyColumns] = useState(true)

  const [lineColumns, setLineColumns] = useState<Column[]>(() => buildLineItemColumns())
  const [scheduleColumns, setScheduleColumns] = useState<Column[]>(() => buildScheduleColumns())

  const [selectedLineItems, setSelectedLineItems] = useState<string[]>([])
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([])

  const lineTableRootRef = useRef<HTMLDivElement | null>(null)
  const scheduleTableRootRef = useRef<HTMLDivElement | null>(null)

  useSyncedHorizontalScroll(syncScroll, lineTableRootRef, scheduleTableRootRef)

  useEffect(() => {
    if (!freezeKeyColumns) {
      setLineColumns(buildLineItemColumns())
      setScheduleColumns(buildScheduleColumns())
      return
    }

    setLineColumns(reorderColumnsForFreeze(buildLineItemColumns(), frozenLineColumnIds))
    setScheduleColumns(reorderColumnsForFreeze(buildScheduleColumns(), frozenScheduleColumnIds))
  }, [freezeKeyColumns])

  const frozenLineCount = useMemo(() => (freezeKeyColumns ? frozenLineColumnIds.length : 0), [freezeKeyColumns])
  const frozenScheduleCount = useMemo(() => (freezeKeyColumns ? frozenScheduleColumnIds.length : 0), [freezeKeyColumns])

  const frozenCss = useMemo(() => {
    if (!freezeKeyColumns) return ''
    return [
      buildFrozenCss('proto-frozen-line', lineColumns, frozenLineCount),
      buildFrozenCss('proto-frozen-schedule', scheduleColumns, frozenScheduleCount)
    ].join('\n')
  }, [freezeKeyColumns, lineColumns, frozenLineCount, scheduleColumns, frozenScheduleCount])

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-6">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Prototype Playground</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Reconciliation: Frozen Columns + Synced Horizontal Scroll</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            This page is a sandbox to evaluate two UX techniques for the Deposit Reconciliation stacked tables:
            <span className="font-semibold"> (1) sync horizontal scrolling</span> and
            <span className="font-semibold"> (2) freeze key comparison columns</span>.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 accent-primary-600"
                checked={syncScroll}
                onChange={event => setSyncScroll(event.target.checked)}
              />
              Sync horizontal scroll
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 accent-primary-600"
                checked={freezeKeyColumns}
                onChange={event => setFreezeKeyColumns(event.target.checked)}
              />
              Freeze key columns (prototype moves them left)
            </label>
            <div className="text-xs text-slate-500">
              Note: This prototype freezes the <span className="font-semibold">left-most</span> columns, so key columns are
              temporarily moved left to validate the interaction.
            </div>
          </div>
        </div>

        <style>{frozenCss}</style>

        <div className="grid grid-cols-1 gap-8">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold text-slate-900">Deposit Line Items</div>
              <div className="mt-1 text-xs text-slate-500">
                Scroll horizontally in either table; when sync is enabled, the other table mirrors the position.
              </div>
            </div>
            <div ref={lineTableRootRef} className={cn(freezeKeyColumns ? 'proto-frozen-line' : '')}>
              <DynamicTable
                columns={lineColumns}
                data={seedLineItems}
                preferOverflowHorizontalScroll
                fillContainerWidth={false}
                maxBodyHeight={260}
                selectedItems={selectedLineItems}
                onItemSelect={(itemId, selected) => {
                  setSelectedLineItems(prev => (selected ? Array.from(new Set([...prev, itemId])) : prev.filter(id => id !== itemId)))
                }}
                onSelectAll={selected => {
                  setSelectedLineItems(selected ? seedLineItems.map(row => row.id) : [])
                }}
                onColumnsChange={setLineColumns}
                selectHeaderLabel="Select"
              />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold text-slate-900">Suggested Matches - Revenue Schedules</div>
              <div className="mt-1 text-xs text-slate-500">
                Use this section to verify key columns remain visible while comparing totals across both stacked tables.
              </div>
            </div>
            <div ref={scheduleTableRootRef} className={cn(freezeKeyColumns ? 'proto-frozen-schedule' : '')}>
              <DynamicTable
                columns={scheduleColumns}
                data={seedSchedules}
                preferOverflowHorizontalScroll
                fillContainerWidth={false}
                maxBodyHeight={260}
                selectedItems={selectedSchedules}
                onItemSelect={(itemId, selected) => {
                  setSelectedSchedules(prev => (selected ? Array.from(new Set([...prev, itemId])) : prev.filter(id => id !== itemId)))
                }}
                onSelectAll={selected => {
                  setSelectedSchedules(selected ? seedSchedules.map(row => row.id) : [])
                }}
                onColumnsChange={setScheduleColumns}
                selectHeaderLabel="Select"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
