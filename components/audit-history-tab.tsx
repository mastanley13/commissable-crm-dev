"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { DynamicTable, type Column } from "./dynamic-table"
import { ColumnChooserModal } from "./column-chooser-modal"
import { ListHeader, type ColumnFilter } from "./list-header"
import { calculateMinWidth } from "@/lib/column-width-utils"
import { HistoryRow } from "./opportunity-types"
import { TabDescription } from "@/components/section/TabDescription"

const normalizePageSize = (value: number): number => {
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(1, Math.floor(value)))
}

type SupportedEntities =
  | "Account"
  | "Contact"
  | "Opportunity"
  | "OpportunityProduct"
  | "Product"
  | "RevenueSchedule"
  | "Group"
  | "Ticket"

interface AuditHistoryTabProps {
  entityName: SupportedEntities
  entityId: string
  historyRows?: HistoryRow[]
  tableBodyMaxHeight?: number
  tableAreaRefCallback?: (node: HTMLDivElement | null) => void
  rowActionLabel?: string
  rowActionRenderer?: (row: HistoryRow) => ReactNode
  reloadToken?: number
  description?: string
}

interface AuditLogAPIResponse {
  id: string
  entityName: string
  entityId: string
  action: string
  createdAt: string
  userId: string | null
  userName: string | null
  changedFields: Record<string, { from: any; to: any }> | null
}

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

const HISTORY_ACTION_COLUMN_ID = "rowActions"

function buildBaseHistoryColumns(actionLabel?: string): Column[] {
  const columns: Column[] = [
    {
      id: "occurredAt",
      label: "Date / Time",
      accessor: "occurredAt",
      width: 200,
      minWidth: calculateMinWidth({ label: "Date / Time", type: "text", sortable: true }),
      maxWidth: 260,
      sortable: true
    },
    {
      id: "userName",
      label: "User",
      accessor: "userName",
      width: 200,
      minWidth: calculateMinWidth({ label: "User", type: "text", sortable: true }),
      maxWidth: 260,
      sortable: true
    },
    {
      id: "action",
      label: "Action",
      accessor: "action",
      width: 180,
      minWidth: calculateMinWidth({ label: "Action", type: "text", sortable: true }),
      maxWidth: 220,
      sortable: true
    },
    {
      id: "field",
      label: "Field",
      accessor: "field",
      width: 220,
      minWidth: calculateMinWidth({ label: "Field", type: "text", sortable: true }),
      maxWidth: 320,
      sortable: true
    },
    {
      id: "fromValue",
      label: "From",
      accessor: "fromValue",
      width: 260,
      minWidth: calculateMinWidth({ label: "From", type: "text", sortable: false }),
      maxWidth: 360
    },
    {
      id: "toValue",
      label: "To",
      accessor: "toValue",
      width: 260,
      minWidth: calculateMinWidth({ label: "To", type: "text", sortable: false }),
      maxWidth: 360
    }
  ]

  if (actionLabel) {
    columns.push({
      id: HISTORY_ACTION_COLUMN_ID,
      label: actionLabel,
      width: 120,
      minWidth: calculateMinWidth({ label: actionLabel, type: "action", sortable: false }),
      maxWidth: 180,
      sortable: false,
      type: "action"
    })
  }

  return columns
}

function syncColumnsWithBase(previous: Column[], base: Column[]): Column[] {
  const prevById = new Map(previous.map(column => [column.id, column]))

  return base.map(column => {
    const prior = prevById.get(column.id)
    if (!prior) {
      return column
    }

    return {
      ...column,
      width: prior.width ?? column.width,
      hidden: prior.hidden ?? column.hidden,
      minWidth: prior.minWidth ?? column.minWidth,
      maxWidth: prior.maxWidth ?? column.maxWidth
    }
  })
}

const HISTORY_FILTER_ACCESSOR: Record<string, keyof HistoryRow> = {
  occurredAt: "occurredAt",
  userName: "userName",
  action: "action",
  field: "field",
  fromValue: "fromValue",
  toValue: "toValue"
}

const HISTORY_FILTER_COLUMNS = [
  { id: "occurredAt", label: "Date / Time" },
  { id: "userName", label: "User" },
  { id: "action", label: "Action" },
  { id: "field", label: "Field" },
  { id: "fromValue", label: "From" },
  { id: "toValue", label: "To" }
]

function isPercentField(fieldName: string): boolean {
  const name = fieldName.toLowerCase()
  return name.includes("percent") || name.endsWith("pct") || name.endsWith("_pct")
}

function isCurrencyField(fieldName: string): boolean {
  const name = fieldName.toLowerCase()
  return (
    name.includes("price") ||
    name.includes("amount") ||
    name.includes("revenue") ||
    name.includes("commission")
  )
}

function formatHistoryValue(fieldName: string, value: unknown): string {
  if (value === null || value === undefined) {
    return "-"
  }

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN

  if (Number.isFinite(numeric)) {
    if (isPercentField(fieldName)) {
      const ratio = numeric <= 1 ? numeric : numeric / 100
      return percentFormatter.format(ratio)
    }

    if (isCurrencyField(fieldName)) {
      return currencyFormatter.format(numeric)
    }
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 16).replace("T", " ")
  }

  return String(value)
}

// Helper function to convert API response to HistoryRow format
function convertAuditLogsToHistoryRows(logs: AuditLogAPIResponse[]): HistoryRow[] {
  const rows: HistoryRow[] = []

  logs.forEach(log => {
    const occurredAt = new Date(log.createdAt).toISOString().slice(0, 16).replace("T", " ")
    const userName = log.userName || "System"

    const changedEntries =
      log.changedFields && typeof log.changedFields === "object"
        ? Object.entries(log.changedFields)
        : []

    let addedRowForLog = false

    if (changedEntries.length > 0) {
      for (const [fieldName, change] of changedEntries) {
        const changeObj = change as { from?: unknown; to?: unknown }
        const formattedFrom = formatHistoryValue(fieldName, changeObj?.from)
        const formattedTo = formatHistoryValue(fieldName, changeObj?.to)

        // Skip no-op changes where formatted values are identical
        if (formattedFrom === formattedTo) {
          continue
        }

        rows.push({
          id: `${log.id}-${fieldName}`,
          occurredAt,
          userName,
          action: log.action,
          field: fieldName,
          fromValue: formattedFrom,
          toValue: formattedTo
        })
        addedRowForLog = true
      }
    }

    // If we didn't add any field-level rows, fall back to a single generic row.
    if (!addedRowForLog) {
      rows.push({
        id: log.id,
        occurredAt,
        userName,
        action: log.action,
        field: "-",
        fromValue: "-",
        toValue: "-"
      })
    }
  })

  return rows
}

export function AuditHistoryTab({
  entityName,
  entityId,
  historyRows,
  tableBodyMaxHeight,
  tableAreaRefCallback,
  rowActionLabel,
  rowActionRenderer,
  reloadToken,
  description
}: AuditHistoryTabProps) {
  const baseColumns = useMemo(
    () => buildBaseHistoryColumns(rowActionRenderer ? (rowActionLabel ?? "Actions") : undefined),
    [rowActionLabel, rowActionRenderer]
  )
  const [historyTableColumns, setHistoryTableColumns] = useState<Column[]>(
    () => baseColumns.map(column => ({ ...column }))
  )
  const [showHistoryColumnSettings, setShowHistoryColumnSettings] = useState(false)
  const [historyColumnFilters, setHistoryColumnFilters] = useState<ColumnFilter[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [fetchedHistoryRows, setFetchedHistoryRows] = useState<HistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setHistoryTableColumns(prev => syncColumnsWithBase(prev, baseColumns))
  }, [baseColumns])

  // Fetch audit logs from API if historyRows prop is not provided
  useEffect(() => {
    if (historyRows !== undefined) {
      // Use provided historyRows prop
      return
    }

    const fetchAuditLogs = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const url = `/api/audit-logs?entityName=${entityName}&entityId=${entityId}&pageSize=200&summaryOnly=true`
        const response = await fetch(url)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to fetch audit logs: ${response.status}`)
        }
        const data = await response.json()
        const converted = convertAuditLogsToHistoryRows(data.data || [])
        setFetchedHistoryRows(converted)
      } catch (err) {
        console.error("[AuditHistoryTab] Error:", err)
        setError(err instanceof Error ? err.message : 'An error occurred')
        setFetchedHistoryRows([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchAuditLogs()
  }, [entityName, entityId, historyRows, reloadToken])

  // Use either provided historyRows or fetched data
  const actualHistoryRows = historyRows !== undefined ? historyRows : fetchedHistoryRows

  const filteredRows = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase()

    return actualHistoryRows.filter(row => {
      const matchesFilters = historyColumnFilters.every(filter => {
        const fieldKey = HISTORY_FILTER_ACCESSOR[filter.columnId]
        if (!fieldKey) return true
        const rowValue = String(row[fieldKey] ?? "").toLowerCase()
        return rowValue.includes(filter.value.trim().toLowerCase())
      })

      if (!matchesFilters) return false

      if (!trimmedQuery) return true

      return [row.userName, row.action, row.field, row.fromValue, row.toValue].some(value =>
        value.toLowerCase().includes(trimmedQuery)
      )
    })
  }, [historyColumnFilters, actualHistoryRows, searchQuery])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / pageSize)), [filteredRows.length, pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedRows = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredRows.slice(startIndex, startIndex + pageSize)
  }, [filteredRows, page, pageSize])

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      total: filteredRows.length,
      totalPages
    }),
    [filteredRows.length, page, pageSize, totalPages]
  )

  const columnsWithActions = useMemo(() => {
    if (!rowActionRenderer) return historyTableColumns
    return historyTableColumns.map(column => {
      if (column.id !== HISTORY_ACTION_COLUMN_ID) return column
      return {
        ...column,
        render: (_value: unknown, row: HistoryRow) => rowActionRenderer(row)
      }
    })
  }, [historyTableColumns, rowActionRenderer])

  return (
    <>
      <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-1 border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0 px-3 pb-0">
        <div className="border-t-2 border-t-primary-600 -mr-3 min-w-0 overflow-hidden">
          {description && <TabDescription>{description}</TabDescription>}
          <ListHeader
            inTab
            searchPlaceholder="Search history"
            onSearch={setSearchQuery}
            showCreateButton={false}
            showStatusFilter={false}
            filterColumns={HISTORY_FILTER_COLUMNS}
            columnFilters={historyColumnFilters}
            onColumnFiltersChange={setHistoryColumnFilters}
            onSettingsClick={() => setShowHistoryColumnSettings(true)}
          />
          <div
            className="flex flex-1 min-h-0 flex-col overflow-hidden"
            ref={tableAreaRefCallback}
          >
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-gray-500">Loading history...</p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-red-600">Error: {error}</p>
              </div>
            ) : (
              <DynamicTable
                className="flex flex-col"
                preferOverflowHorizontalScroll
                columns={columnsWithActions}
                data={paginatedRows}
                emptyMessage="No history entries yet"
                pagination={pagination}
                onPageChange={setPage}
                onPageSizeChange={size => {
                  const normalized = normalizePageSize(size)
                  setPageSize(normalized)
                  setPage(1)
                }}
                onColumnsChange={setHistoryTableColumns}
                autoSizeColumns
                fillContainerWidth
                alwaysShowPagination
                maxBodyHeight={tableBodyMaxHeight}
              />
            )}
          </div>
        </div>
      </div>

      <ColumnChooserModal
        isOpen={showHistoryColumnSettings}
        columns={columnsWithActions}
        onApply={columns => {
          setHistoryTableColumns(columns)
          setShowHistoryColumnSettings(false)
        }}
        onClose={() => setShowHistoryColumnSettings(false)}
      />
    </>
  )
}
