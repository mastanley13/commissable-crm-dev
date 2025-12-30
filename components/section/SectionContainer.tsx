import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface SectionContainerProps {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  hideHeader?: boolean
}

export function SectionContainer({
  title,
  description,
  actions,
  children,
  className,
  hideHeader = false
}: SectionContainerProps) {
  const shouldShowHeader = !hideHeader && (Boolean(title) || Boolean(description) || Boolean(actions))

  return (
    <section className={cn("space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm", className)}>
      {shouldShowHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            {title ? <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</h3> : null}
            {description ? <p className="text-[11px] text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="text-[11px] text-slate-800">{children}</div>
    </section>
  )
}

