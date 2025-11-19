"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useToasts } from "@/components/toast"
import { DynamicTable, type Column } from "@/components/dynamic-table"
import { calculateMinWidth } from "@/lib/column-width-utils"
import { Check } from "lucide-react"

type EditableColumnId = "quantity" | "priceEach" | "expectedCommissionRatePercent"

interface RevenueScheduleRow {
  id: string
  scheduleLabel: string
  accountName: string
  status: "Active" | "Pending" | "In Dispute"
  quantity: number
  priceEach: number
  expectedCommissionRatePercent: number
}

interface BulkPromptState {
  columnId: EditableColumnId
  label: string
  value: number
  rowId: string
  selectedCount: number
  anchor: { top: number; left: number }
}

const editableColumnMeta: Record<
  EditableColumnId,
  { label: string; step: number; min: number; suffix?: string; prefix?: string; decimals: number }
> = {
  quantity: { label: "Quantity", step: 10, min: 0, decimals: 0 },
  priceEach: { label: "Price Each", step: 0.25, min: 0, prefix: "$", decimals: 2 },
  expectedCommissionRatePercent: { label: "Expected Commission Rate %", step: 0.25, min: 0, suffix: "%", decimals: 2 }
}

const seedRows: RevenueScheduleRow[] = [
  {
    id: "RS-1001",
    scheduleLabel: "Streaming Bundle - January",
    accountName: "Acme Entertainment",
    status: "Active",
    quantity: 1200,
    priceEach: 12.5,
    expectedCommissionRatePercent: 2.5
  },
  {
    id: "RS-1002",
    scheduleLabel: "Hardware Refresh Q1",
    accountName: "Northwind Systems",
    status: "Pending",
    quantity: 800,
    priceEach: 19.25,
    expectedCommissionRatePercent: 1.75
  },
  {
    id: "RS-1003",
    scheduleLabel: "Analytics Retainer - Expansion",
    accountName: "Globex Media",
    status: "Active",
    quantity: 450,
    priceEach: 29.99,
    expectedCommissionRatePercent: 2.25
  },
  {
    id: "RS-1004",
    scheduleLabel: "Promotional Inserts - March Flight",
    accountName: "Initech Corp",
    status: "In Dispute",
    quantity: 300,
    priceEach: 8.5,
    expectedCommissionRatePercent: 3.1
  },
  {
    id: "RS-1005",
    scheduleLabel: "Co-op Ad Buy Spring",
    accountName: "Contoso Brands",
    status: "Active",
    quantity: 950,
    priceEach: 15.75,
    expectedCommissionRatePercent: 2.9
  }
]

function formatValue(columnId: EditableColumnId, value: number) {
  const meta = editableColumnMeta[columnId]
  if (columnId === "quantity") {
    return value.toLocaleString()
  }
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals
  })
  if (meta.prefix) {
    return `${meta.prefix}${formatted}`
  }
  if (meta.suffix) {
    return `${formatted}${meta.suffix}`
  }
  return formatted
}

interface EditableInputProps {
  columnId: EditableColumnId
  value: number
  onValueChange: (value: number, rect: DOMRect) => void
}

function EditableInput({ columnId, value, onValueChange }: EditableInputProps) {
  const spanRef = useRef<HTMLSpanElement | null>(null)

  const commit = useCallback(() => {
    if (!spanRef.current) return
    const raw = spanRef.current.innerText.trim()
    if (!raw) return

    // Strip out non-numeric characters except decimal and minus
    const sanitized = raw.replace(/[^0-9.\-]/g, "")
    const parsed = sanitized === "" ? NaN : Number(sanitized)
    if (Number.isNaN(parsed) || parsed === value) {
      return
    }

    onValueChange(parsed, spanRef.current.getBoundingClientRect())
  }, [onValueChange, value])

  return (
    <span
      ref={spanRef}
      contentEditable
      suppressContentEditableWarning
      data-disable-row-click="true"
      className="block min-w-0 truncate text-sm text-gray-900"
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === "Enter") {
          event.preventDefault()
          commit()
        }
      }}
    >
      {formatValue(columnId, value)}
    </span>
  )
}

function statusBadgeClass(status: RevenueScheduleRow["status"]) {
  switch (status) {
    case "Active":
      return "bg-green-50 text-green-700 border-green-200"
    case "Pending":
      return "bg-amber-50 text-amber-700 border-amber-200"
    default:
      return "bg-red-50 text-red-700 border-red-200"
  }
}

export default function FillDownTestPage() {
  const [rows, setRows] = useState<RevenueScheduleRow[]>(seedRows)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkPrompt, setBulkPrompt] = useState<BulkPromptState | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [bulkLog, setBulkLog] = useState<string[]>([])
  const [apiPayload, setApiPayload] = useState<Record<string, unknown> | null>(null)
  const { showSuccess, showInfo, ToastContainer } = useToasts()
  const selectionHintShown = useRef(false)

  const selectedCount = selectedIds.length

  const toggleRowSelection = useCallback((rowId: string, explicit?: boolean) => {
    setSelectedIds(prev => {
      const alreadySelected = prev.includes(rowId)
      const shouldSelect = typeof explicit === "boolean" ? explicit : !alreadySelected
      if (shouldSelect === alreadySelected) {
        return prev
      }
      return shouldSelect ? [...prev, rowId] : prev.filter(id => id !== rowId)
    })
  }, [])

  const handleSelectAll = useCallback((selectAll: boolean) => {
    setSelectedIds(selectAll ? rows.map(row => row.id) : [])
  }, [rows])

  const handleInlineChange = useCallback(
    (rowId: string, columnId: EditableColumnId, nextValue: number, rect: DOMRect) => {
      if (Number.isNaN(nextValue)) {
        return
      }

      const formattedValue =
        columnId === "quantity"
          ? Math.max(0, Math.round(nextValue))
          : Number(Math.max(0, nextValue).toFixed(editableColumnMeta[columnId].decimals))

      setRows(prev =>
        prev.map(row =>
          row.id === rowId
            ? {
                ...row,
                [columnId]: formattedValue
              }
            : row
        )
      )

      if (selectedIds.length > 1 && selectedIds.includes(rowId)) {
        setBulkPrompt({
          columnId,
          label: editableColumnMeta[columnId].label,
          value: formattedValue,
          rowId,
          selectedCount: selectedIds.length,
          anchor: {
            top: rect.bottom + 8,
            left: rect.right + 12
          }
        })
      } else {
        setBulkPrompt(null)
      }
    },
    [selectedIds]
  )

  const applyFillDown = useCallback(async () => {
    if (!bulkPrompt || selectedIds.length <= 1) {
      return
    }
    setIsApplying(true)
    const targetIds = [...selectedIds]
    await new Promise(resolve => setTimeout(resolve, 350))
    setRows(prev =>
      prev.map(row =>
        targetIds.includes(row.id)
          ? {
              ...row,
              [bulkPrompt.columnId]:
                bulkPrompt.columnId === "quantity"
                  ? Math.round(bulkPrompt.value)
                  : Number(bulkPrompt.value.toFixed(editableColumnMeta[bulkPrompt.columnId].decimals))
            }
          : row
      )
    )
    const formattedValue = formatValue(bulkPrompt.columnId, bulkPrompt.value)
    setBulkLog(prev => {
      const entry = `${new Date().toLocaleTimeString()} • Applied ${bulkPrompt.label} = ${formattedValue} to ${targetIds.length} schedules`
      return [entry, ...prev].slice(0, 5)
    })
    setApiPayload({
      ids: targetIds,
      patch: { [bulkPrompt.columnId]: bulkPrompt.value }
    })
    showSuccess("Fill-down applied", `Updated ${targetIds.length} schedules with ${bulkPrompt.label}.`)
    setBulkPrompt(null)
    setIsApplying(false)
  }, [bulkPrompt, selectedIds, showSuccess])

  useEffect(() => {
    setBulkPrompt(prev => {
      if (!prev) {
        return prev
      }
      if (selectedIds.length <= 1 || !selectedIds.includes(prev.rowId)) {
        return null
      }
      return { ...prev, selectedCount: selectedIds.length }
    })
  }, [selectedIds])

  useEffect(() => {
    if (selectedIds.length === 0 && !selectionHintShown.current) {
      showInfo("Tip", "Select two or more schedules to enable fill-down testing.")
      selectionHintShown.current = true
    } else if (selectedIds.length > 0) {
      selectionHintShown.current = false
    }
  }, [selectedIds.length, showInfo])

  const selectedPreview = useMemo(
    () => rows.filter(row => selectedIds.includes(row.id)).map(row => row.scheduleLabel),
    [rows, selectedIds]
  )

  const tableColumns = useMemo<Column[]>(() => {
    const editableColumn = (columnId: EditableColumnId, width: number, label: string): Column => ({
      id: columnId,
      label,
      width,
      minWidth: calculateMinWidth({ label, type: "text", sortable: false }),
      sortable: false,
      render: (_value, row: RevenueScheduleRow) => (
        <EditableInput
          columnId={columnId}
          value={row[columnId]}
          onValueChange={(value, rect) => handleInlineChange(row.id, columnId, value, rect)}
        />
      )
    })

    return [
      {
        id: "multi-action",
        label: "Select",
        width: 200,
        minWidth: calculateMinWidth({ label: "Select", type: "multi-action", sortable: false }),
        type: "multi-action",
        sortable: false,
        resizable: false,
        render: (_value, row: RevenueScheduleRow) => {
          const rowId = row.id
          const checked = selectedIds.includes(rowId)
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
                  aria-label={`Select revenue schedule ${rowId}`}
                  onChange={() => toggleRowSelection(rowId, !checked)}
                />
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    checked ? "border-primary-500 bg-primary-600 text-white" : "border-gray-300 bg-white text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              </label>
            </div>
          )
        }
      },
      {
        id: "scheduleLabel",
        label: "Revenue Schedule",
        width: 260,
        minWidth: calculateMinWidth({ label: "Revenue Schedule", type: "text", sortable: false }),
        sortable: false,
        render: (_value, row: RevenueScheduleRow) => (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900">{row.scheduleLabel}</span>
            <span className="text-xs text-gray-500">{row.accountName}</span>
          </div>
        )
      },
      editableColumn("quantity", 140, "Quantity"),
      editableColumn("priceEach", 160, "Price Each"),
      editableColumn("expectedCommissionRatePercent", 220, "Expected Commission Rate %"),
      {
        id: "status",
        label: "Status",
        width: 140,
        minWidth: calculateMinWidth({ label: "Status", type: "text", sortable: false }),
        sortable: false,
        render: (_value, row: RevenueScheduleRow) => (
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}
          >
            {row.status}
          </span>
        )
      }
    ]
  }, [handleInlineChange, selectedIds, toggleRowSelection])

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <div className="space-y-6">
        <header className="rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Prototype Playground</p>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Schedule Fill-Down Test</h1>
          <p className="mt-1 text-sm text-gray-600">
            Exercise the in-cell “Apply to N selected” workflow on the same DynamicTable component used throughout the app.
          </p>
          <div className="mt-2 text-sm text-gray-500">
            Source plan:{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5">docs/Change-Order-Plans/bulk-actions-overhaul-plan.md</code>
          </div>
        </header>

        <section className="rounded-lg border border-blue-100 bg-blue-50 px-6 py-4 text-sm text-blue-900 shadow-sm">
          <h2 className="text-base font-semibold text-blue-900">How to test</h2>
          <ol className="ml-5 mt-2 list-decimal space-y-1">
            <li>Select multiple rows using the standard DynamicTable multi-select.</li>
            <li>Edit Quantity, Price, or Expected Commission Rate % inside any selected row.</li>
            <li>Use the floating “Apply to N selected” pill to copy the value to the rest of the selection.</li>
            <li>Review the simulated payload and log to confirm the request that would be sent to `/api/revenue-schedules/bulk-update`.</li>
          </ol>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-3 text-sm">
            <div className="font-semibold text-gray-900">{selectedCount} selected</div>
            {selectedCount > 0 && (
              <div className="text-gray-500">
                {selectedPreview.slice(0, 3).join(", ")}
                {selectedPreview.length > 3 ? "…" : ""}
              </div>
            )}
            <button
              type="button"
              className="text-sm font-semibold text-primary-600 underline"
              onClick={() => setSelectedIds([])}
            >
              Clear selection
            </button>
          </div>

          <div className="mt-4 flex min-h-[420px] flex-col">
            <DynamicTable
              columns={tableColumns}
              data={rows}
              selectedItems={selectedIds}
              onItemSelect={(id, selected) => {
                const resolved = typeof id === "string" ? id : String(id ?? "")
                if (!resolved) return
                toggleRowSelection(resolved, selected)
              }}
              onSelectAll={handleSelectAll}
              emptyMessage="No schedules"
              alwaysShowPagination={false}
              maxBodyHeight={420}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Simulated API payload</h3>
            <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-gray-900/95 p-4 text-xs text-green-200">
              {apiPayload ? JSON.stringify(apiPayload, null, 2) : "— edit a value and apply fill-down to see the payload —"}
            </pre>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Bulk update log</h3>
            {bulkLog.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No bulk edits recorded yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-gray-800">
                {bulkLog.map(entry => (
                  <li key={entry} className="rounded-md bg-gray-50 px-3 py-2">
                    {entry}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {bulkPrompt && (
        <button
          type="button"
          className="fixed z-40 rounded-full border border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-lg transition hover:bg-primary-50"
          style={{ top: bulkPrompt.anchor.top, left: bulkPrompt.anchor.left }}
          onClick={applyFillDown}
          disabled={isApplying}
        >
          {isApplying ? "Applying…" : `Apply to ${bulkPrompt.selectedCount} selected`}
        </button>
      )}

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
