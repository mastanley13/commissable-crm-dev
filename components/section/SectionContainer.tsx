import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface SectionContainerProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionContainer({ title, description, actions, children, className }: SectionContainerProps) {
  return (
    <section className={cn("space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
          {description ? <p className="text-[11px] text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="text-[11px] text-slate-800">{children}</div>
    </section>
  )
}

