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
  accountId?: string
  accountName?: string
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

export function GroupCreateModal({ isOpen, accountId, accountName, onClose, onCreated }: GroupCreateModalProps) {
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
  // Add-to-existing tab state
  const [activeTab, setActiveTab] = useState<"create" | "add">("create")
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupOptions, setGroupOptions] = useState<SelectOption[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [selectedGroups, setSelectedGroups] = useState<SelectOption[]>([])
  const [addGroupOwnerId, setAddGroupOwnerId] = useState("")
  const [addGroupVisibility, setAddGroupVisibility] = useState<GroupVisibility>(GroupVisibility.Private)
  const [addGroupDescription, setAddGroupDescription] = useState("")
  const [addDetailsLoading, setAddDetailsLoading] = useState(false)
  const [initialAddDetails, setInitialAddDetails] = useState<{ ownerId?: string; visibility?: GroupVisibility; description?: string } | null>(null)
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
    setActiveTab("create")
    setSelectedGroupId("")
    setSelectedGroups([])
    setAddGroupOwnerId("")
    setAddGroupVisibility(GroupVisibility.Private)
    setAddGroupDescription("")
    setInitialAddDetails(null)

    setOptionsLoading(true)
    fetch("/api/admin/users?limit=100", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load owners")
        }
        const payload = await response.json()
        const items = Array.isArray(payload?.data?.users) ? payload.data.users : []
        const ownerOptions = items.map((userItem: any) => ({
          value: userItem.id,
          label: userItem.fullName || userItem.email
        }))
        setOwners(ownerOptions)
        // Default to current user if available, otherwise use first option
        if (ownerOptions.length > 0) {
          const currentUserOption = user?.id ? ownerOptions.find(o => o.value === user.id) : null
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

  // Load groups when switching to Add tab
  useEffect(() => {
    if (!isOpen || activeTab !== "add") return
    let cancelled = false
    async function loadGroups() {
      setGroupsLoading(true)
      try {
        const res = await fetch("/api/groups/options?status=Active&limit=200", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load groups")
        const payload = await res.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data?.groups) ? payload.data.groups : []
        if (cancelled) return
        const opts = items.map((g: any) => ({ value: g.value ?? g.id, label: g.label ?? g.name }))
        setGroupOptions(opts)
        setSelectedGroupId("")
      } finally {
        if (!cancelled) setGroupsLoading(false)
      }
    }
    loadGroups()
    return () => { cancelled = true }
  }, [isOpen, activeTab])

  // Prefill group details once a group is chosen
  useEffect(() => {
    if (!isOpen || activeTab !== "add" || selectedGroups.length !== 1) return
    let cancelled = false
    async function loadDetails() {
      setAddDetailsLoading(true)
      try {
        const res = await fetch(`/api/groups/${selectedGroups[0].value}`, { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load group details")
        const payload = await res.json().catch(() => null)
        const data = payload?.data || {}
        if (cancelled) return
        setInitialAddDetails({ ownerId: data.ownerId || "", visibility: data.visibility || GroupVisibility.Private, description: data.description || "" })
        setAddGroupOwnerId(data.ownerId || "")
        setAddGroupVisibility(data.visibility || GroupVisibility.Private)
        setAddGroupDescription(data.description || "")
      } finally {
        if (!cancelled) setAddDetailsLoading(false)
      }
    }
    loadDetails()
    return () => { cancelled = true }
  }, [isOpen, activeTab, selectedGroups])

  const handleAddExisting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canAddExisting || !accountId) {
      showError("Missing information", "Please select at least one group to add this account to.")
      return
    }
    setLoading(true)
    try {
      const outcomes = await Promise.allSettled(
        selectedGroups.map(async (g) => {
          const res = await fetch(`/api/groups/${g.value}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountId })
          })
          if (!res.ok) {
            const payload = await res.json().catch(() => null)
            throw new Error(payload?.error || `Failed to add to ${g.label}`)
          }
          return g.value
        })
      )
      const successes = outcomes.filter(r => r.status === "fulfilled").length
      const failures = outcomes.length - successes
      if (successes > 0) {
        showSuccess(`Added to ${successes} group${successes === 1 ? "" : "s"}`, accountName ? `${accountName} added successfully.` : "Account added successfully.")
      }
      if (failures > 0 && successes === 0) {
        showError("Add to group failed", "Please try again.")
      }
      onCreated?.(selectedGroups[0]?.value || "")
      onClose()
    } catch (error) {
      console.error("Failed to add account to group", error)
      showError("Unable to add to group", error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = useMemo(() => form.name.trim().length >= 3 && form.ownerId.length > 0, [form.name, form.ownerId])
  const canAddExisting = useMemo(() => Boolean(selectedGroups.length > 0 && accountId), [selectedGroups.length, accountId])

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
        isActive: form.isActive,
        accountId: accountId ?? null
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
      showSuccess("Group created", accountName ? `The group has been created and ${accountName} has been added.` : "The group has been created.")
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
            <p className="text-xs font-semibold uppercase text-primary-600">{activeTab === "create" ? "Create Group" : "Add To Group"}</p>
            <h2 className="text-lg font-semibold text-gray-900">
              {activeTab === "create" ? (
                <>New Group{accountName ? ` for ${accountName}` : ""}</>
              ) : (
                <>Add {accountName ?? "this account"} to a Group</>
              )}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Tab Switch */}
        <div className="px-6 pt-4">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
            <button type="button" className={`rounded-md px-3 py-1.5 ${activeTab === "create" ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`} onClick={() => setActiveTab("create")}>Create New</button>
            <button type="button" className={`rounded-md px-3 py-1.5 ${activeTab === "add" ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`} onClick={() => setActiveTab("add")}>Add to Existing</button>
          </div>
        </div>

        {activeTab === "create" && (
        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            </div>
          </div>

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
        )}

        {activeTab === "add" && (
        <form onSubmit={handleAddExisting} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Select Groups<span className="ml-1 text-red-500">*</span></label>
              <select
                value={selectedGroupId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedGroupId("")
                  if (!id) return
                  const option = groupOptions.find(o => o.value === id)
                  if (!option) return
                  setSelectedGroups(prev => prev.some(p => p.value === id) ? prev : [...prev, option])
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={groupsLoading || !accountId}
              >
                <option value="">{groupsLoading ? "Loading groups..." : "Add a group..."}</option>
                {groupOptions.filter(o => !selectedGroups.some(s => s.value === o.value)).map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              {selectedGroups.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedGroups.map(g => (
                    <span key={g.value} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs">
                      <span className="truncate max-w-[220px] font-medium text-blue-900" title={g.label}>{g.label}</span>
                      <button type="button" className="ml-1 text-blue-600 hover:text-blue-800" aria-label={`Remove ${g.label}`}
                        onClick={() => setSelectedGroups(prev => prev.filter(p => p.value !== g.value))}
                      ><X className="h-2.5 w-2.5" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-full bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300">Cancel</button>
            <button type="submit" disabled={loading || !canAddExisting} className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add to Group
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
