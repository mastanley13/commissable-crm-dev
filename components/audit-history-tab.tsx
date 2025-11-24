"use client"

import { useEffect, useMemo, useState } from "react"
import { DynamicTable, type Column } from "./dynamic-table"
import { ColumnChooserModal } from "./column-chooser-modal"
import { ListHeader, type ColumnFilter } from "./list-header"
import { calculateMinWidth } from "@/lib/column-width-utils"
import { HistoryRow } from "./opportunity-types"

type SupportedEntities = "Account" | "Contact" | "Opportunity" | "Product" | "RevenueSchedule"

interface AuditHistoryTabProps {
  entityName: SupportedEntities
  entityId: string
  historyRows?: HistoryRow[]
  tableBodyMaxHeight?: number
  tableAreaRefCallback?: (node: HTMLDivElement | null) => void
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


const HISTORY_TABLE_BASE_COLUMNS: Column[] = [
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

// Helper function to convert API response to HistoryRow format
function convertAuditLogsToHistoryRows(logs: AuditLogAPIResponse[]): HistoryRow[] {
  const rows: HistoryRow[] = []

  logs.forEach(log => {
    if (!log.changedFields || typeof log.changedFields !== 'object' || Object.keys(log.changedFields).length === 0) {
      // If no changed fields, create a single row for the action
      rows.push({
        id: log.id,
        occurredAt: new Date(log.createdAt).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        userName: log.userName || 'System',
        action: log.action,
        field: '-',
        fromValue: '-',
        toValue: '-'
      })
    } else {
      // Create a row for each changed field
      Object.entries(log.changedFields).forEach(([fieldName, change]) => {
        const changeObj = change as any
        rows.push({
          id: `${log.id}-${fieldName}`,
          occurredAt: new Date(log.createdAt).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }),
          userName: log.userName || 'System',
          action: log.action,
          field: fieldName,
          fromValue: String(changeObj?.from ?? '-'),
          toValue: String(changeObj?.to ?? '-')
        })
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
  tableAreaRefCallback
}: AuditHistoryTabProps) {
  const [historyTableColumns, setHistoryTableColumns] = useState<Column[]>(
    () => HISTORY_TABLE_BASE_COLUMNS.map(column => ({ ...column }))
  )
  const [showHistoryColumnSettings, setShowHistoryColumnSettings] = useState(false)
  const [historyColumnFilters, setHistoryColumnFilters] = useState<ColumnFilter[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [fetchedHistoryRows, setFetchedHistoryRows] = useState<HistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        const url = `/api/audit-logs?entityName=${entityName}&entityId=${entityId}&pageSize=200`
        console.log('[AuditHistoryTab] Fetching from:', url)
        const response = await fetch(url)
        console.log('[AuditHistoryTab] Response status:', response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[AuditHistoryTab] Error response:', errorText)
          throw new Error(`Failed to fetch audit logs: ${response.status}`)
        }
        const data = await response.json()
        console.log('[AuditHistoryTab] Received data:', data)
        const converted = convertAuditLogsToHistoryRows(data.data || [])
        console.log('[AuditHistoryTab] Converted rows:', converted)
        setFetchedHistoryRows(converted)
      } catch (err) {
        console.error('[AuditHistoryTab] Error:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
        setFetchedHistoryRows([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchAuditLogs()
  }, [entityName, entityId, historyRows])

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

  return (
    <>
      <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-1 border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0 px-3 pb-0">
        <div className="border-t-2 border-t-primary-600 -mr-3">
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
                columns={historyTableColumns}
                data={paginatedRows}
                emptyMessage="No history entries yet"
                pagination={pagination}
                onPageChange={setPage}
                onPageSizeChange={size => {
                  setPageSize(size)
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
        columns={historyTableColumns}
        onApply={columns => {
          setHistoryTableColumns(columns)
          setShowHistoryColumnSettings(false)
        }}
        onClose={() => setShowHistoryColumnSettings(false)}
      />
    </>
  )
}
