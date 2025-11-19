"use client"

import { type ReactNode } from "react"
import { Download, ToggleLeft, Trash2, UserCog } from "lucide-react"
import type { BulkActionsGridProps, BulkActionButtonConfig } from "./bulk-actions-grid"

type StandardActionKey = "delete" | "reassign" | "status" | "export"

interface StandardBulkActionLabels {
  delete?: string
  reassign?: string
  status?: string
  export?: string
}

interface StandardBulkActionTooltips {
  delete?: string | ((count: number) => string)
  reassign?: string | ((count: number) => string)
  status?: string | ((count: number) => string)
  export?: string | ((count: number) => string)
}

interface StandardBulkActionWrappers {
  delete?: (button: ReactNode) => ReactNode
  reassign?: (button: ReactNode) => ReactNode
  status?: (button: ReactNode) => ReactNode
  export?: (button: ReactNode) => ReactNode
}

export interface StandardBulkActionOptions {
  selectedCount: number
  isBusy?: boolean
  entityLabelPlural: string
  entityLabelSingular?: string
  onDelete: () => void
  onReassign: () => void
  onStatus: () => void
  onExport: () => void
  labels?: StandardBulkActionLabels
  tooltips?: StandardBulkActionTooltips
  wrappers?: StandardBulkActionWrappers
}

const defaultLabels: Required<StandardBulkActionLabels> = {
  delete: "Soft Delete",
  reassign: "Reassign",
  status: "Update Status",
  export: "Export CSV",
}

const toneMap: Record<StandardActionKey, BulkActionButtonConfig["tone"]> = {
  delete: "danger",
  reassign: "primary",
  status: "neutral",
  export: "info",
}

const iconMap: Record<StandardActionKey, BulkActionButtonConfig["icon"]> = {
  delete: Trash2,
  reassign: UserCog,
  status: ToggleLeft,
  export: Download,
}

const deriveSingular = (plural: string) => {
  if (plural.endsWith("ies")) {
    return `${plural.slice(0, -3)}y`
  }
  if (plural.endsWith("s")) {
    return plural.slice(0, -1)
  }
  return plural
}

const buildTooltip = (
  key: StandardActionKey,
  count: number,
  labels: Required<StandardBulkActionLabels>,
  singular: string,
  plural: string
) => {
  const entity = count === 1 ? singular : plural
  switch (key) {
    case "delete":
      return `${labels.delete} ${count} ${entity}`
    case "reassign":
      return `${labels.reassign} ${count} ${entity}`
    case "status":
      return `${labels.status} for ${count} ${entity}`
    case "export":
      return `${labels.export} for ${count} ${entity}`
    default:
      return `${count} ${entity}`
  }
}

export function buildStandardBulkActions({
  selectedCount,
  isBusy,
  entityLabelPlural,
  entityLabelSingular,
  onDelete,
  onReassign,
  onStatus,
  onExport,
  labels,
  tooltips,
  wrappers,
}: StandardBulkActionOptions): BulkActionsGridProps {
  const mergedLabels: Required<StandardBulkActionLabels> = {
    delete: labels?.delete ?? defaultLabels.delete,
    reassign: labels?.reassign ?? defaultLabels.reassign,
    status: labels?.status ?? defaultLabels.status,
    export: labels?.export ?? defaultLabels.export,
  }

  const singularLabel = entityLabelSingular ?? deriveSingular(entityLabelPlural)

  const actionEntries: Array<[StandardActionKey, () => void]> = [
    ["delete", onDelete],
    ["reassign", onReassign],
    ["status", onStatus],
    ["export", onExport],
  ]

  const actions: BulkActionButtonConfig[] = actionEntries.map(([key, handler]) => {
    const tooltipValue = tooltips?.[key]
    const tooltipFn =
      typeof tooltipValue === "function"
        ? tooltipValue
        : tooltipValue
          ? () => tooltipValue
          : (count: number) => buildTooltip(key, count, mergedLabels, singularLabel, entityLabelPlural)

    return {
      key,
      label: mergedLabels[key],
      icon: iconMap[key],
      tone: toneMap[key],
      onClick: handler,
      tooltip: tooltipFn,
      wrapper: wrappers?.[key],
    }
  })

  return {
    selectedCount,
    isBusy,
    entityName: entityLabelPlural,
    actions,
  }
}
