import type { ReactNode } from "react"

export interface KeyValueItem {
  label: string
  value?: ReactNode
  emphasize?: boolean
}

interface KeyValueGridProps {
  items: KeyValueItem[]
  columns?: number
}

export function KeyValueGrid({ items, columns = 2 }: KeyValueGridProps) {
  if (!items.length) {
    return <p className="text-[11px] text-slate-500">No data available.</p>
  }

  const perColumn = Math.ceil(items.length / columns)
  const columnItems = Array.from({ length: columns }, (_, index) =>
    items.slice(index * perColumn, (index + 1) * perColumn)
  )

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {columnItems.map((column, index) => (
        <div key={index} className="space-y-1.5">
          {column.map(item => (
            <div key={item.label} className="grid grid-cols-[minmax(0,160px),minmax(0,1fr)] gap-2 text-[11px]">
              <span className="text-slate-500">{item.label}</span>
              <span className={item.emphasize ? "font-semibold text-slate-900" : "text-slate-800"}>
                {item.value ?? <span className="text-slate-300">--</span>}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

