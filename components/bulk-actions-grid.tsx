"use client"

import { type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type BulkActionTone = "danger" | "primary" | "info" | "neutral"

export interface BulkActionButtonConfig {
  key: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  tooltip?: string | ((count: number) => string)
  tone?: BulkActionTone
  disabled?: boolean
  hidden?: boolean
  wrapper?: (button: ReactNode) => ReactNode
}

export interface BulkActionsGridProps {
  selectedCount: number
  actions: BulkActionButtonConfig[]
  entityName?: string
  isBusy?: boolean
  density?: "default" | "compact"
  className?: string
}

const toneClasses: Record<BulkActionTone, string> = {
  danger: "text-red-600 hover:bg-red-50 hover:text-red-700",
  primary: "text-primary-700 hover:bg-primary-50 hover:text-primary-900",
  info: "text-blue-700 hover:bg-blue-50 hover:text-blue-900",
  neutral: "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
}

export function BulkActionsGrid({
  selectedCount,
  actions,
  entityName = "items",
  isBusy = false,
  density = "default",
  className,
}: BulkActionsGridProps) {
  const visibleActions = actions.filter(action => !action.hidden)
  if (visibleActions.length === 0) {
    return null
  }

  const buttonSize = density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"
  const iconSize = density === "compact" ? "h-2.5 w-2.5" : "h-3 w-3"

  return (
    <div
      className={cn(
        "inline-grid grid-cols-2 overflow-hidden rounded-md border border-gray-300 bg-white",
        className
      )}
    >
      {visibleActions.map((action, index) => {
        const Icon = action.icon
        const disabled = isBusy || selectedCount === 0 || action.disabled
        const tooltip =
          typeof action.tooltip === "function"
            ? action.tooltip(selectedCount)
            : action.tooltip ?? `${action.label} selected ${entityName}`

        const button = (
          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                action.onClick?.()
              }
            }}
            disabled={disabled}
            aria-disabled={disabled}
            aria-label={action.label}
            title={tooltip}
            className={cn(
              "flex items-center justify-center bg-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
              buttonSize,
              !disabled && toneClasses[action.tone ?? "neutral"],
              disabled && "cursor-not-allowed text-gray-300"
            )}
          >
            <Icon className={iconSize} aria-hidden="true" />
          </button>
        )

        const cellBorders = cn(
          "flex h-full w-full items-center justify-center border-gray-200",
          index < 2 && "border-b",
          index % 2 === 0 && "border-r"
        )

        if (action.wrapper) {
          return (
            <div key={action.key} className={cellBorders}>
              {action.wrapper(button)}
            </div>
          )
        }

        return (
          <div key={action.key} className={cellBorders}>
            {button}
          </div>
        )
      })}
    </div>
  )
}
