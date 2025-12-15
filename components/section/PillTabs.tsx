import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface PillTab {
  id: string
  label: ReactNode
}

interface PillTabsProps {
  tabs: PillTab[]
  activeId: string
  onChange: (id: string) => void
}

export function PillTabs({ tabs, activeId, onChange }: PillTabsProps) {
  if (!tabs.length) return null

  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full bg-blue-50 px-1 py-1">
      {tabs.map(tab => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-full px-3 py-0.5 text-[11px] font-semibold transition",
              isActive ? "bg-blue-700 text-white shadow-sm" : "bg-transparent text-blue-800 hover:bg-blue-100"
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

