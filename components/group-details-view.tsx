"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { FieldRow } from "./detail/FieldRow"
import { GroupType, GroupVisibility } from "@prisma/client"
import { AuditHistoryTab } from "./audit-history-tab"
import { TabDescription } from "@/components/section/TabDescription"
import { EditableField } from "./editable-field"
import { useEntityEditor, type EntityEditor } from "@/hooks/useEntityEditor"
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt"
import { useToasts } from "./toast"

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

interface GroupInlineForm {
  name: string
  groupType: GroupType
  visibility: GroupVisibility
  description: string
  isActive: boolean
  ownerId: string
}

type GroupOption = { value: string; label: string }

const GROUP_HISTORY_TABLE_HEIGHT = 360

const fieldBoxClass =
  "flex min-h-[28px] w-full min-w-0 max-w-[260px] items-center justify-between border-b-2 border-gray-300 bg-transparent pl-[3px] pr-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis tabular-nums"

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString()
}

function createGroupInlineForm(group: GroupDetailRecord | null): GroupInlineForm | null {
  if (!group) return null
  return {
    name: group.name ?? "",
    groupType: group.groupType ?? GroupType.SalesTeam,
    visibility: group.visibility ?? GroupVisibility.Public,
    description: group.description ?? "",
    isActive: Boolean(group.isActive),
    ownerId: group.ownerId ?? ""
  }
}

function buildGroupPayload(patch: Partial<GroupInlineForm>, draft: GroupInlineForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if ("name" in patch) {
    payload.name = draft.name.trim()
  }

  if ("groupType" in patch) {
    payload.groupType = draft.groupType
  }

  if ("visibility" in patch) {
    payload.visibility = draft.visibility
  }

  if ("description" in patch) {
    const value = draft.description.trim()
    payload.description = value.length > 0 ? value : null
  }

  if ("isActive" in patch) {
    payload.isActive = draft.isActive
  }

  if ("ownerId" in patch) {
    payload.ownerId = draft.ownerId ? draft.ownerId : null
  }

  return payload
}

function validateGroupForm(form: GroupInlineForm): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!form.name.trim()) {
    errors.name = "Group name is required."
  }

  return errors
}

export function GroupDetailsView({
  group,
  loading,
  error,
  onRefresh
}: GroupDetailsViewProps) {
  const [activeTab] = useState<"history">("history")
  const { showSuccess, showError } = useToasts()

  // Options state
  const [baseOwnerOptions, setBaseOwnerOptions] = useState<GroupOption[]>([])
  const [groupTypeOptions, setGroupTypeOptions] = useState<GroupOption[]>([])
  const [visibilityOptions, setVisibilityOptions] = useState<GroupOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsLoaded, setOptionsLoaded] = useState(false)

  // Initialize form
  const inlineInitialForm = useMemo(
    () => (group ? createGroupInlineForm(group) : null),
    [group]
  )

  // Submit handler
  const submitGroup = useCallback(
    async (patch: Partial<GroupInlineForm>, draft: GroupInlineForm) => {
      if (!group?.id) {
        throw new Error("Group ID is required")
      }

      const payload = buildGroupPayload(patch, draft)
      if (Object.keys(payload).length === 0) {
        return draft
      }

      try {
        const response = await fetch(`/api/groups/${group.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })

        const body = await response.json().catch(() => null)

        if (!response.ok) {
          const message = body?.error ?? "Failed to update group"
          showError("Unable to update group", message)
          throw new Error(message)
        }

        showSuccess("Group updated", "Changes saved.")
        await onRefresh?.()
        return draft
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error("Failed to update group")
      }
    },
    [group?.id, onRefresh, showError, showSuccess]
  )

  // Initialize editor
  const editor = useEntityEditor<GroupInlineForm>({
    initial: inlineInitialForm,
    validate: group ? draft => validateGroupForm(draft) : undefined,
    onSubmit: group ? submitGroup : undefined
  })

  const { confirmNavigation } = useUnsavedChangesPrompt(editor.isDirty)

  // Handle save
  const handleSaveInline = useCallback(async () => {
    if (!group) return
    try {
      await editor.submit()
    } catch (error) {
      // Error already handled in submitGroup
    }
  }, [editor, group])

  // Load options
  useEffect(() => {
    if (!group || optionsLoaded) {
      return
    }

    let cancelled = false

    const loadOptions = async () => {
      try {
        setOptionsLoading(true)
        const response = await fetch("/api/groups/options", { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load group options")
        }
        if (cancelled) return

        const owners: GroupOption[] = Array.isArray(payload?.owners)
          ? payload.owners
              .filter((item: any) => item?.value)
              .map((item: any) => ({
                value: String(item.value),
                label: item.label ?? "Unnamed Owner"
              }))
          : []

        const types: GroupOption[] = Array.isArray(payload?.groupTypes)
          ? payload.groupTypes
          : []

        const visibility: GroupOption[] = Array.isArray(payload?.visibilityOptions)
          ? payload.visibilityOptions
          : []

        setBaseOwnerOptions(owners)
        setGroupTypeOptions(types)
        setVisibilityOptions(visibility)
        setOptionsLoaded(true)
      } catch (error) {
        console.error("Failed to load group options", error)
      } finally {
        if (!cancelled) {
          setOptionsLoading(false)
        }
      }
    }

    loadOptions()

    return () => {
      cancelled = true
    }
  }, [group, optionsLoaded])

  // Memoize owner options with fallback
  const ownerOptions = useMemo(() => {
    if (!group?.ownerId || !group.ownerName) {
      return baseOwnerOptions
    }
    if (baseOwnerOptions.some(option => option.value === group.ownerId)) {
      return baseOwnerOptions
    }
    return [{ value: group.ownerId, label: group.ownerName }, ...baseOwnerOptions]
  }, [group?.ownerId, group?.ownerName, baseOwnerOptions])

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

  // Register fields with editor
  const nameField = editor.register("name")
  const groupTypeField = editor.register("groupType")
  const ownerIdField = editor.register("ownerId")
  const descriptionField = editor.register("description")
  const visibilityField = editor.register("visibility")
  const activeField = editor.register("isActive")

  const disableSave = !editor.isDirty || editor.saving || Object.keys(editor.errors).length > 0

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden gap-4 pt-3 pb-4">
          {/* Top detail section – mirrors Account Detail */}
          <div className="rounded-2xl bg-gray-100 p-3 shadow-sm h-[300px] overflow-y-auto">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">
                  Group Detail
                </p>
                {editor.isDirty ? (
                  <span className="text-[11px] font-semibold text-amber-600">Unsaved changes</span>
                ) : null}
                {optionsLoading ? (
                  <span className="text-[11px] text-gray-500">Loading field options...</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleSaveInline}
                disabled={disableSave}
                className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editor.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1">
                <FieldRow
                  label="Group Name"
                  value={
                    <div className="flex flex-col gap-1">
                      <div className="flex items-end gap-2 max-w-md">
                        <EditableField.Input
                          value={(nameField.value as string) ?? ""}
                          onChange={nameField.onChange}
                          onBlur={nameField.onBlur}
                          placeholder="Enter group name"
                          className="flex-1"
                        />
                        <div className="flex items-center gap-2 shrink-0 bg-transparent px-0 py-1 text-[11px] font-medium text-gray-600">
                          <span>Active (Y/N)</span>
                          <EditableField.Switch
                            checked={Boolean(activeField.value)}
                            onChange={activeField.onChange}
                            disabled={editor.saving}
                          />
                        </div>
                      </div>
                      {editor.errors.name ? (
                        <p className="text-[10px] text-red-600">{editor.errors.name}</p>
                      ) : null}
                    </div>
                  }
                />
                <FieldRow
                  label="Group Type"
                  value={
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md">
                        <EditableField.Select
                          value={groupTypeField.value as string}
                          onChange={groupTypeField.onChange}
                          onBlur={groupTypeField.onBlur}
                          disabled={editor.saving}
                        >
                          <option value="">Select type...</option>
                          {groupTypeOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </EditableField.Select>
                      </div>
                      {editor.errors.groupType ? (
                        <p className="text-[10px] text-red-600">{editor.errors.groupType}</p>
                      ) : null}
                    </div>
                  }
                />
                <FieldRow
                  label="Group Owner"
                  value={
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md">
                        <EditableField.Select
                          value={ownerIdField.value as string}
                          onChange={ownerIdField.onChange}
                          onBlur={ownerIdField.onBlur}
                          disabled={editor.saving}
                        >
                          <option value="">Unassigned</option>
                          {ownerOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </EditableField.Select>
                      </div>
                      {editor.errors.ownerId ? (
                        <p className="text-[10px] text-red-600">{editor.errors.ownerId}</p>
                      ) : null}
                    </div>
                  }
                />
                <FieldRow
                  label="Group Description"
                  value={
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md">
                        <EditableField.Textarea
                          value={(descriptionField.value as string) ?? ""}
                          onChange={descriptionField.onChange}
                          onBlur={descriptionField.onBlur}
                          placeholder="Enter description..."
                          rows={3}
                          disabled={editor.saving}
                        />
                      </div>
                      {editor.errors.description ? (
                        <p className="text-[10px] text-red-600">{editor.errors.description}</p>
                      ) : null}
                    </div>
                  }
                />
              </div>

              <div className="space-y-1">
                <FieldRow
                  label="Public/Private"
                  value={
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md">
                        <EditableField.Select
                          value={visibilityField.value as string}
                          onChange={visibilityField.onChange}
                          onBlur={visibilityField.onBlur}
                          disabled={editor.saving}
                        >
                          <option value="">Select visibility...</option>
                          {visibilityOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </EditableField.Select>
                      </div>
                      {editor.errors.visibility ? (
                        <p className="text-[10px] text-red-600">{editor.errors.visibility}</p>
                      ) : null}
                    </div>
                  }
                />
                <FieldRow
                  label="Member Count"
                  value={<div className={cn(fieldBoxClass, "max-w-md")}>{group.memberCount ?? 0}</div>}
                />
                <FieldRow
                  label="Created At"
                  value={<div className={cn(fieldBoxClass, "max-w-md")}>{formatDate(group.createdAt) || "-"}</div>}
                />
                <FieldRow
                  label="Last Updated"
                  value={<div className={cn(fieldBoxClass, "max-w-md")}>{formatDate(group.updatedAt) || "-"}</div>}
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
                description="This section shows a complete audit log of all changes made to this group, including who made each change and when. Track membership changes, setting updates, and ownership transfers."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
