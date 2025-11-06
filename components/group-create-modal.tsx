"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { GroupType, GroupVisibility } from "@prisma/client"
import { useToasts } from "@/components/toast"
import { useAuth } from "@/lib/auth-context"

interface SelectOption {
  value: string
  label: string
}

interface GroupCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (groupId: string) => void
}

interface GroupFormState {
  name: string
  type: GroupType
  visibility: GroupVisibility
  ownerId: string
  description: string
  isActive: boolean
}

const groupTypeOptions: SelectOption[] = Object.values(GroupType).map(type => ({
  value: type,
  label: type.replace(/([A-Z])/g, " $1").trim()
}))

const visibilityOptions: SelectOption[] = Object.values(GroupVisibility).map(option => ({
  value: option,
  label: option
}))

export function GroupCreateModal({ isOpen, onClose, onCreated }: GroupCreateModalProps) {
  const [form, setForm] = useState<GroupFormState>({
    name: "",
    type: GroupType.SalesTeam,
    visibility: GroupVisibility.Private,
    ownerId: "",
    description: "",
    isActive: true
  })
  const [owners, setOwners] = useState<SelectOption[]>([])
  const [ownerQuery, setOwnerQuery] = useState("")
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [submitMode, setSubmitMode] = useState<"save" | "saveAndNew">("save")
  const { showError, showSuccess } = useToasts()
  const { user } = useAuth()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm({
      name: "",
      type: GroupType.SalesTeam,
      visibility: GroupVisibility.Private,
      ownerId: user?.id || "",
      description: "",
      isActive: true
    })
    setSubmitMode("save")

    setOptionsLoading(true)
    fetch("/api/admin/users?limit=100", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load owners")
        }
        const payload = await response.json()
        const items = Array.isArray(payload?.data?.users) ? payload.data.users : []
        const ownerOptions: SelectOption[] = items.map((userItem: any) => ({
          value: userItem.id,
          label: userItem.fullName || userItem.email
        }))
        setOwners(ownerOptions)
        // Default to current user if available, otherwise use first option
        if (ownerOptions.length > 0) {
          const currentUserOption = user?.id ? ownerOptions.find((o: SelectOption) => o.value === user.id) : null
          const defaultOwner = currentUserOption || ownerOptions[0]
          // Only set if not already set (from initial state above)
          setForm(prev => ({ ...prev, ownerId: prev.ownerId || defaultOwner.value }))
          // Set the query to match the owner
          const ownerToQuery = currentUserOption || ownerOptions[0]
          setOwnerQuery(ownerToQuery.label)
        }
      })
      .catch(() => {
        setOwners([])
        showError("Unable to load group owners", "Please try again later")
      })
      .finally(() => setOptionsLoading(false))
  }, [isOpen, showError, user?.id])

  const canSubmit = useMemo(() => form.name.trim().length >= 3 && form.ownerId.length > 0, [form.name, form.ownerId])

  const filteredOwners = useMemo(() => {
    if (!ownerQuery.trim()) return owners
    const q = ownerQuery.toLowerCase()
    return owners.filter(o => o.label.toLowerCase().includes(q))
  }, [owners, ownerQuery])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      showError("Missing information", "Group name and owner are required.")
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        groupType: form.type,
        visibility: form.visibility,
        ownerId: form.ownerId,
        description: form.description.trim() || null,
        isActive: form.isActive
      }

      const response = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? "Failed to create group")
      }

      const data = await response.json().catch(() => null)
      const groupId: string | undefined = data?.data?.id
      showSuccess("Group created", "The group has been created successfully.")
      onCreated?.(groupId ?? "")

      if (submitMode === "saveAndNew") {
        setForm(prev => ({
          ...prev,
          name: "",
          description: ""
        }))
        setSubmitMode("save")
      } else {
        onClose()
      }
    } catch (error) {
      console.error("Failed to create group", error)
      showError(
        "Unable to create group",
        error instanceof Error ? error.message : "Unknown error"
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Create Group</p>
            <h2 className="text-lg font-semibold text-gray-900">New Group for Jordan Cole</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Group Name<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Enter group name"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Group Type</label>
              <select
                value={form.type}
                onChange={event => setForm(prev => ({ ...prev, type: event.target.value as GroupType }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              >
                {groupTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Visibility</label>
              <select
                value={form.visibility}
                onChange={event => setForm(prev => ({ ...prev, visibility: event.target.value as GroupVisibility }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              >
                {visibilityOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Group Owner<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={ownerQuery}
                onChange={e => {
                  setOwnerQuery(e.target.value)
                  setShowOwnerDropdown(true)
                }}
                onFocus={() => setShowOwnerDropdown(true)}
                onBlur={() => setTimeout(() => setShowOwnerDropdown(false), 200)}
                placeholder="Type to search owners..."
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                disabled={optionsLoading}
                required
              />
              {showOwnerDropdown && ownerQuery.length > 0 && filteredOwners.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredOwners.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, ownerId: option.value }))
                        setOwnerQuery(option.label)
                        setShowOwnerDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Active</label>
              <div className="flex items-center gap-3 px-0 py-1">
                <span className="text-xs text-gray-600">{form.isActive ? "Yes" : "No"}</span>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${form.isActive ? "bg-primary-600" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${form.isActive ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Description</label>
              <textarea
                value={form.description}
                onChange={event => setForm(prev => ({ ...prev, description: event.target.value.slice(0, 500) }))}
                rows={3}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Describe the purpose of this group"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={() => setSubmitMode("saveAndNew")}
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-full border border-primary-600 px-6 py-2 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-primary-300 disabled:text-primary-300"
            >
              {loading && submitMode === "saveAndNew" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save & New
            </button>
            <button
              type="submit"
              onClick={() => setSubmitMode("save")}
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {loading && submitMode === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
