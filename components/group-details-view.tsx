"use client"

import { ReactNode } from "react"
import { Loader2, Edit } from "lucide-react"
import { cn } from "@/lib/utils"
import { FieldRow } from "./detail/FieldRow"
import { fieldBoxClass, fieldLabelClass } from "./detail/shared"
import { GroupType, GroupVisibility } from "@prisma/client"

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
  onEdit?: () => void
  onRefresh?: () => void
}

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString()
}

function InfoCard({
  title,
  children
}: {
  title: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <div className="flex flex-col">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">
            {title}
          </p>
        </div>
      </header>
      <div className="px-5 py-4">
        {children}
      </div>
    </section>
  )
}

export function GroupDetailsView({
  group,
  loading,
  error,
  onEdit,
  onRefresh
}: GroupDetailsViewProps) {
  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
          <span>Loading group details…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Unable to load group</p>
            <p className="mt-1 text-xs text-red-700">{error}</p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
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
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-6 pt-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">
            Group Details
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold text-gray-900">
            {group.name || "Group"}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            <span>
              <span className="font-semibold">Type: </span>
              {group.groupType}
            </span>
            <span>
              <span className="font-semibold">Visibility: </span>
              {group.visibility}
            </span>
            <span>
              <span className="font-semibold">Active: </span>
              {group.isActive ? "Yes" : "No"}
            </span>
            <span>
              <span className="font-semibold">Members: </span>
              {group.memberCount ?? 0}
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-shrink-0 items-center gap-2 md:mt-0">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              Refresh
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <Edit className="h-4 w-4" />
              Edit Group
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <InfoCard title="Group Information">
          <div className="space-y-2">
            <FieldRow label="Active (Y/N)">
              <div className={fieldBoxClass}>
                <span className={cn("text-xs", group.isActive ? "text-gray-900" : "text-gray-600")}>
                  {group.isActive ? "Yes" : "No"}
                </span>
              </div>
            </FieldRow>
            <FieldRow label="Group Name">
              <div className={fieldBoxClass}>
                <span className="truncate text-xs text-gray-900">
                  {group.name || ""}
                </span>
              </div>
            </FieldRow>
            <FieldRow label="Group Type">
              <div className={fieldBoxClass}>
                <span className="truncate text-xs text-gray-900">
                  {group.groupType || ""}
                </span>
              </div>
            </FieldRow>
            <FieldRow label="Public/Private">
              <div className={fieldBoxClass}>
                <span className="truncate text-xs text-gray-900">
                  {group.visibility || ""}
                </span>
              </div>
            </FieldRow>
            <FieldRow label="Group Owner">
              <div className={fieldBoxClass}>
                <span className="truncate text-xs text-gray-900">
                  {group.ownerName || ""}
                </span>
              </div>
            </FieldRow>
          </div>
        </InfoCard>

        <InfoCard title="Group Metrics">
          <div className="space-y-2">
            <FieldRow label="Member Count">
              <div className={fieldBoxClass}>
                <span className="text-xs text-gray-900">
                  {group.memberCount ?? 0}
                </span>
              </div>
            </FieldRow>
            <FieldRow label="Created At">
              <div className={fieldBoxClass}>
                <span className="truncate text-xs text-gray-900">
                  {formatDate(group.createdAt)}
                </span>
              </div>
            </FieldRow>
            <FieldRow label="Last Updated">
              <div className={fieldBoxClass}>
                <span className="truncate text-xs text-gray-900">
                  {formatDate(group.updatedAt)}
                </span>
              </div>
            </FieldRow>
          </div>
        </InfoCard>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <header className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2">
          <p className={fieldLabelClass}>Group Description</p>
        </header>
        <div className="min-h-[48px] text-sm text-gray-900">
          {group.description ? (
            <p className="whitespace-pre-line text-xs leading-relaxed text-gray-900">
              {group.description}
            </p>
          ) : (
            <p className="text-xs text-gray-500">No description provided.</p>
          )}
        </div>
      </section>
    </div>
  )
}
