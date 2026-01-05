"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { GroupType, GroupVisibility } from "@prisma/client"
import { useToasts } from "@/components/toast"

interface SelectOption {
  value: string
  label: string
}

interface AccountGroupRow {
  id: string
  active: boolean
  groupName: string
  visibility?: string
  description?: string
  owner?: string
}

interface GroupEditModalProps {
  isOpen: boolean
  group: AccountGroupRow | null
  onClose: () => void
  onSuccess: () => void
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

function createInitialForm(group: AccountGroupRow | null): GroupFormState {
  if (!group) {
    return {
      name: "",
      type: GroupType.SalesTeam,
      visibility: GroupVisibility.Private,
      ownerId: "",
      description: "",
      isActive: true
    }
  }

  return {
    name: group.groupName || "",
    type: GroupType.SalesTeam, // Default - will be fetched from API
    visibility: group.visibility === "Public" ? GroupVisibility.Public : GroupVisibility.Private,
    ownerId: "", // Will be fetched from API
    description: group.description || "",
    isActive: group.active
  }
}

export function GroupEditModal({ isOpen, group, onClose, onSuccess }: GroupEditModalProps) {
  const [form, setForm] = useState<GroupFormState>(() => createInitialForm(group))
  const [owners, setOwners] = useState<SelectOption[]>([])
  const [ownerQuery, setOwnerQuery] = useState("")
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const { showError, showSuccess } = useToasts()

  // Reset form when modal opens/closes or group changes
  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm(createInitialForm(group))
  }, [isOpen, group])

  // Load group details and options when modal opens
  useEffect(() => {
    if (!isOpen || !group?.id) {
      return
    }

    // Load options
    setOptionsLoading(true)
    fetch("/api/admin/users?limit=100&status=Active", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load owners")
        }
        const payload = await response.json()
        const items = Array.isArray(payload?.data?.users) ? payload.data.users : []
        const ownerOptions = items.map((user: any) => ({
          value: user.id,
          label: user.fullName || user.email
        }))
        setOwners(ownerOptions)
      })
      .catch(() => {
        setOwners([])
        showError("Unable to load group owners", "Please try again later")
      })
      .finally(() => setOptionsLoading(false))

    // Load full group details
    setDetailsLoading(true)
    fetch(`/api/groups/${group.id}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load group details")
        }
        const payload = await response.json()
        const groupData = payload.data
        
        setForm(prev => ({
          ...prev,
          name: groupData.name || prev.name,
          type: groupData.groupType || prev.type,
          visibility: groupData.visibility || prev.visibility,
          ownerId: groupData.ownerId || prev.ownerId,
          description: groupData.description || prev.description,
          isActive: groupData.isActive ?? prev.isActive
        }))
      })
      .catch((error) => {
        console.error("Failed to load group details:", error)
        showError("Unable to load group details", "Please try again later")
      })
      .finally(() => setDetailsLoading(false))
  }, [isOpen, group?.id, showError])

  // Sync owner text with selected ownerId when options or form change
  useEffect(() => {
    if (!isOpen) return
    const match = owners.find(o => o.value === form.ownerId)
    if (match) {
      setOwnerQuery(match.label)
    }
  }, [isOpen, owners, form.ownerId])

  // Track which specific validations are failing
  const validationState = useMemo(() => ({
    hasName: form.name.trim().length >= 3,
    hasOwner: form.ownerId.length > 0
  }), [form.name, form.ownerId])

  const canSubmit = useMemo(() => 
    validationState.hasName && validationState.hasOwner,
    [validationState]
  )

  const filteredOwners = useMemo(() => {
    if (!ownerQuery.trim()) return owners
    const q = ownerQuery.toLowerCase()
    return owners.filter(o => o.label.toLowerCase().includes(q))
  }, [owners, ownerQuery])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!group?.id || !canSubmit) {
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

      const response = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? "Failed to update group")
      }

      showSuccess("Group updated", "The group has been updated successfully.")
      onSuccess()
    } catch (error) {
      console.error("Failed to update group", error)
      showError(
        "Unable to update group",
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
            <p className="text-xs font-semibold uppercase text-primary-600">Edit Group</p>
            <h2 className="text-lg font-semibold text-gray-900">Update Group Details</h2>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          {detailsLoading && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Loading group details...
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Group Name<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter group name"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Group Type</label>
              <select
                value={form.type}
                onChange={event => setForm(prev => ({ ...prev, type: event.target.value as GroupType }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {groupTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Visibility</label>
              <select
                value={form.visibility}
                onChange={event => setForm(prev => ({ ...prev, visibility: event.target.value as GroupVisibility }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {visibilityOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-gray-700">Group Owner<span className="ml-1 text-red-500">*</span></label>
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
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  !validationState.hasOwner && form.ownerId === "" ? 'border-amber-300' : 'border-gray-300'
                }`}
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Active</label>
              <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2">
                <span className="text-sm text-gray-700">{form.isActive ? "Yes" : "No"}</span>
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={form.description}
                onChange={event => setForm(prev => ({ ...prev, description: event.target.value.slice(0, 500) }))}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe the purpose of this group"
              />
              <p className="mt-1 text-xs text-gray-500">Maximum 500 characters.</p>
            </div>
          </div>

          {/* Validation Feedback */}
          {!canSubmit && (
            <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-800 mb-2">Please complete the following to save:</p>
              <ul className="text-sm text-amber-700 space-y-1 ml-4 list-disc">
                {!validationState.hasName && (
                  <li>Group name must be at least 3 characters</li>
                )}
                {!validationState.hasOwner && (
                  <li>Please select a group owner</li>
                )}
              </ul>
            </div>
          )}

          {detailsLoading && (
            <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading group details...</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit || detailsLoading}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Updating..." : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
