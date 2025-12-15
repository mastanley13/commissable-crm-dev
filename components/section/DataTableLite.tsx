import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface DataTableColumn {
  id: string
  header: string
  align?: "left" | "right" | "center"
  widthClass?: string
}

export interface DataTableLiteProps<Row extends Record<string, any>> {
  columns: DataTableColumn[]
  rows: Row[]
  totalsRow?: Partial<Record<string, ReactNode>>
  getRowKey?: (row: Row, index: number) => string
  emptyMessage?: string
  className?: string
}

export function DataTableLite<Row extends Record<string, any>>({
  columns,
  rows,
  totalsRow,
  getRowKey,
  emptyMessage = "No records to display",
  className
}: DataTableLiteProps<Row>) {
  const hasRows = rows.length > 0

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[720px] table-fixed overflow-hidden rounded-2xl border border-slate-200 text-[11px]">
        <thead className="bg-indigo-50 text-indigo-700">
          <tr>
            {columns.map(column => {
              const align =
                column.align === "right"
                  ? "text-right"
                  : column.align === "center"
                    ? "text-center"
                    : "text-left"
              return (
                <th
                  key={column.id}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
                    align,
                    column.widthClass
                  )}
                >
                  {column.header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {hasRows ? (
            rows.map((row, index) => {
              const key = getRowKey ? getRowKey(row, index) : String(index)
              return (
                <tr key={key} className="border-t border-slate-100">
                  {columns.map(column => {
                    const align =
                      column.align === "right"
                        ? "text-right"
                        : column.align === "center"
                          ? "text-center"
                          : "text-left"
                    return (
                      <td key={column.id} className={cn("px-3 py-1.5", align)}>
                        {(row as any)[column.id] ?? <span className="text-slate-300">--</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-center text-[11px] text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
        {totalsRow ? (
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              {columns.map(column => {
                const align =
                  column.align === "right"
                    ? "text-right"
                    : column.align === "center"
                      ? "text-center"
                      : "text-left"
                return (
                  <td key={column.id} className={cn("px-3 py-1.5 font-semibold", align)}>
                    {totalsRow[column.id]}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
}

