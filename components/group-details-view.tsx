"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { FieldRow } from "./detail/FieldRow"
import { GroupType, GroupVisibility } from "@prisma/client"
import { AuditHistoryTab } from "./audit-history-tab"

export interface GroupDetailRecord {
  id: string
  name: string
  groupType: GroupType
  visibility: GroupVisibility
  description: string | null
  isActive: boolean
  ownerId: string | null
  ownerName: string
  memberCount: number
  createdAt: string
  updatedAt: string
}

export interface GroupDetailsViewProps {
  group: GroupDetailRecord | null
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
}

const GROUP_HISTORY_TABLE_HEIGHT = 360

const fieldBoxClass =
  "flex min-h-[28px] w-full min-w-0 max-w-[260px] items-center justify-between border-b-2 border-gray-300 bg-transparent pl-[3px] pr-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis tabular-nums"

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString()
}

export function GroupDetailsView({
  group,
  loading,
  error,
  onRefresh
}: GroupDetailsViewProps) {
  const [activeTab] = useState<"history">("history")

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
          <span>Loading group details...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Unable to load group details</p>
            <p className="mt-1 text-xs text-red-700">{error}</p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
        Group details are not available.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden gap-4 pt-3 pb-4">
          {/* Top detail section – mirrors Account Detail */}
          <div className="rounded-2xl bg-gray-100 p-3 shadow-sm h-[300px] overflow-y-auto">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">
                Group Detail
              </p>
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-700"
                >
                  Refresh
                </button>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1">
                <FieldRow
                  label="Group Name"
                  value={
                    <div className="flex items-end gap-2 max-w-[260px]">
                      <div className={cn(fieldBoxClass, "flex-1")}>{group.name}</div>
                      <div className="flex items-center gap-2 shrink-0 bg-transparent px-0 py-1 text-[11px] font-medium text-gray-600">
                        <span>Active (Y/N)</span>
                        <div
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            group.isActive ? "bg-primary-600" : "bg-gray-300"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                              group.isActive ? "translate-x-4" : "translate-x-1"
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  }
                />
                <FieldRow
                  label="Group Type"
                  value={<div className={fieldBoxClass}>{group.groupType || "-"}</div>}
                />
                <FieldRow
                  label="Group Owner"
                  value={<div className={fieldBoxClass}>{group.ownerName || "Unassigned"}</div>}
                />
                <FieldRow
                  label="Group Description"
                  value={
                    <div className={cn(fieldBoxClass, "whitespace-normal")}>
                      {group.description || "No description provided."}
                    </div>
                  }
                />
              </div>

              <div className="space-y-1">
                <FieldRow
                  label="Public/Private"
                  value={<div className={fieldBoxClass}>{group.visibility || "-"}</div>}
                />
                <FieldRow
                  label="Member Count"
                  value={<div className={fieldBoxClass}>{group.memberCount ?? 0}</div>}
                />
                <FieldRow
                  label="Created At"
                  value={<div className={fieldBoxClass}>{formatDate(group.createdAt) || "-"}</div>}
                />
                <FieldRow
                  label="Last Updated"
                  value={<div className={fieldBoxClass}>{formatDate(group.updatedAt) || "-"}</div>}
                />
              </div>
            </div>
          </div>

          {/* Bottom History tab + table – mirror Account tabs container */}
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex flex-wrap gap-1 border-x border-t border-gray-200 bg-gray-100 pt-2 px-3 pb-0">
              <button
                type="button"
                className={cn(
                  "px-3 py-1.5 text-sm font-semibold transition rounded-t-md border shadow-sm",
                  "relative -mb-[1px] z-10 border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                )}
              >
                History
              </button>
            </div>

            {activeTab === "history" && (
              <AuditHistoryTab
                entityName={"Group" as any}
                entityId={group.id}
                tableBodyMaxHeight={GROUP_HISTORY_TABLE_HEIGHT}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
