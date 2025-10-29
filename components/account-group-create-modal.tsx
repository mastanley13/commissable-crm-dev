"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { GroupType, GroupVisibility } from "@prisma/client"
import { useToasts } from "@/components/toast"

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

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm({
      name: "",
      type: GroupType.SalesTeam,
      visibility: GroupVisibility.Private,
      ownerId: "",
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
        setOwners(
          items.map((user: any) => ({
            value: user.id,
            label: user.fullName || user.email
          }))
        )
      })
      .catch(() => {
        setOwners([])
        showError("Unable to load group owners", "Please try again later")
      })
      .finally(() => setOptionsLoading(false))
  }, [isOpen, showError])

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
        setSelectedGroupId(prev => prev || (opts[0]?.value ?? ""))
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
      // If exactly one group selected, patch before adding
      if (selectedGroups.length === 1 && initialAddDetails) {
        const targetId = selectedGroups[0].value
        const patch: Record<string, any> = {}
        if (addGroupOwnerId && addGroupOwnerId !== initialAddDetails.ownerId) patch.ownerId = addGroupOwnerId
        if (addGroupVisibility && addGroupVisibility !== initialAddDetails.visibility) patch.visibility = addGroupVisibility
        if ((addGroupDescription ?? "").trim() !== (initialAddDetails.description ?? "")) patch.description = (addGroupDescription ?? "").trim()
        if (Object.keys(patch).length > 0) {
          const updateRes = await fetch(`/api/groups/${targetId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch)
          })
          if (!updateRes.ok) {
            const payload = await updateRes.json().catch(() => null)
            throw new Error(payload?.error || "Failed to update group")
          }
        }
      }

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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Group Owner<span className="ml-1 text-red-500">*</span></label>
              <select
                value={form.ownerId}
                onChange={event => setForm(prev => ({ ...prev, ownerId: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                disabled={optionsLoading}
              >
                <option value="">{optionsLoading ? "Loading contacts..." : "Select owner"}</option>
                {owners.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Group Owner</label>
              <select value={addGroupOwnerId} onChange={(e) => setAddGroupOwnerId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500" disabled={optionsLoading || selectedGroups.length !== 1 || addDetailsLoading}>
                <option value="">{optionsLoading ? "Loading owners..." : "Keep current owner"}</option>
                {owners.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Visibility</label>
              <select value={addGroupVisibility} onChange={(e) => setAddGroupVisibility(e.target.value as GroupVisibility)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500" disabled={selectedGroups.length !== 1 || addDetailsLoading}>
                {visibilityOptions.map(v => (<option key={v.value} value={v.value}>{v.label}</option>))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea rows={3} value={addGroupDescription} onChange={(e) => setAddGroupDescription(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder={addDetailsLoading ? "Loading description..." : "Update group description (optional)"} disabled={selectedGroups.length !== 1 || addDetailsLoading} />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-full bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300">Cancel</button>
            <button type="submit" disabled={loading || !canAddExisting} className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {Object.keys(initialAddDetails || {}).length ? "Update & Add" : "Add to Group"}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
