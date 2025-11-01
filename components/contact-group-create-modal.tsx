"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { useToasts } from "@/components/toast"

interface SelectOption {
  value: string
  label: string
}

interface ContactGroupFormState {
  groupName: string
  groupType: string
  visibility: string
  owner: string
  isActive: boolean
  description: string
  addContactAsMember: boolean
}

export interface ContactGroupCreateModalProps {
  isOpen: boolean
  contactName?: string
  accountId?: string
  contactId?: string
  onClose: () => void
  onSuccess?: () => void
}

const createInitialState = (): ContactGroupFormState => ({
  groupName: "",
  groupType: "SalesTeam",
  visibility: "Private",
  owner: "",
  isActive: true,
  description: "",
  addContactAsMember: true
})

const GROUP_TYPE_OPTIONS: SelectOption[] = [
  { value: "SalesTeam", label: "Sales Team" },
  { value: "AccountGroup", label: "Account Group" },
  { value: "SupportTeam", label: "Support Team" },
  { value: "Management", label: "Management" }
]

const VISIBILITY_OPTIONS: SelectOption[] = [
  { value: "Private", label: "Private" },
  { value: "Shared", label: "Shared" },
  { value: "Public", label: "Public" }
]

export function ContactGroupCreateModal({ isOpen, contactName, accountId, contactId, onClose, onSuccess }: ContactGroupCreateModalProps) {
  const [form, setForm] = useState<ContactGroupFormState>(() => createInitialState())
  const [loading, setLoading] = useState(false)
  const [ownerOptions, setOwnerOptions] = useState<SelectOption[]>([])
  const [ownersLoading, setOwnersLoading] = useState(false)
  const [ownerQuery, setOwnerQuery] = useState("")
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<"create" | "add">("create")
  const [groupOptions, setGroupOptions] = useState<SelectOption[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [selectedGroups, setSelectedGroups] = useState<SelectOption[]>([])
  const [addGroupOwnerId, setAddGroupOwnerId] = useState("")
  const [addGroupVisibility, setAddGroupVisibility] = useState("Private")
  const [addGroupDescription, setAddGroupDescription] = useState("")
  const [addDetailsLoading, setAddDetailsLoading] = useState(false)
  const [initialAddDetails, setInitialAddDetails] = useState<{ ownerId?: string; visibility?: string; description?: string } | null>(null)
  const { showError, showSuccess } = useToasts()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm(createInitialState())
    setOwnerQuery("")
    setActiveTab("create")
    setSelectedGroupId("")
    setSelectedGroups([])
    setAddGroupOwnerId("")
    setAddGroupVisibility("Private")
    setAddGroupDescription("")
    setInitialAddDetails(null)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let cancelled = false

    async function loadOwners() {
      setOwnersLoading(true)
      try {
        const response = await fetch("/api/admin/users?limit=100", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Request failed")
        }
        const payload = await response.json().catch(() => null)
        const users: any[] = Array.isArray(payload?.data?.users) ? payload.data.users : []
        if (cancelled) return
        const options = users.map(user => ({
          value: user.id,
          label: user.fullName || user.email
        }))
        setOwnerOptions(options)
        // Default owner + prefill query like opportunity modal
        if (options.length > 0) {
          setForm(prev => (prev.owner ? prev : { ...prev, owner: options[0].value }))
          setOwnerQuery(options[0].label)
        }
      } catch (error) {
        if (!cancelled) {
          setOwnerOptions([])
        }
      } finally {
        if (!cancelled) {
          setOwnersLoading(false)
        }
      }
    }

    loadOwners()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  const canSubmit = useMemo(() => {
    return Boolean(form.groupName.trim() && form.owner)
  }, [form.groupName, form.owner])

  const filteredOwners = useMemo(() => {
    if (!ownerQuery.trim()) return ownerOptions
    const q = ownerQuery.toLowerCase()
    return ownerOptions.filter(o => o.label.toLowerCase().includes(q))
  }, [ownerOptions, ownerQuery])

  const handleClose = () => {
    setForm(createInitialState())
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      showError("Missing information", "Please provide a group name and owner.")
      return
    }

    const payload: Record<string, unknown> = {
      name: form.groupName.trim(),
      groupType: form.groupType,
      visibility: form.visibility,
      ownerId: form.owner,
      description: form.description.trim() || null,
      isActive: form.isActive,
      addContactAsMember: form.addContactAsMember
    }

    if (accountId) {
      payload.accountId = accountId
    }
    if (form.addContactAsMember && contactId) {
      payload.contactId = contactId
    }

    setLoading(true)
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? "Unable to create group")
      }

      showSuccess("Group created", form.addContactAsMember && contactName
        ? `${contactName} has been added to the new group.`
        : "The group has been created.")
      onSuccess?.()
      handleClose()
    } catch (error) {
      console.error("Failed to create group", error)
      showError("Unable to create group", error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  // Load groups for the "Add to Existing" tab
  useEffect(() => {
    if (!isOpen || activeTab !== "add") return
    let cancelled = false
    async function loadGroups() {
      setGroupsLoading(true)
      try {
        const response = await fetch("/api/groups/options?status=Active&limit=200", { cache: "no-store" })
        if (!response.ok) throw new Error("Failed to load groups")
        const payload = await response.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data?.groups) ? payload.data.groups : []
        if (cancelled) return
        const opts = items.map((g: any) => ({ value: g.value ?? g.id, label: g.label ?? g.name }))
        setGroupOptions(opts)
        setSelectedGroupId(prev => prev || (opts[0]?.value ?? ""))
      } catch (err) {
        if (!cancelled) {
          setGroupOptions([])
        }
      } finally {
        if (!cancelled) setGroupsLoading(false)
      }
    }
    loadGroups()
    return () => { cancelled = true }
  }, [isOpen, activeTab])

  const canAddExisting = useMemo(() => {
    return Boolean(selectedGroups.length > 0 && contactId)
  }, [selectedGroups.length, contactId])

  const handleAddExistingSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canAddExisting || !contactId) {
      showError("Missing information", "Please select at least one group to add this contact to.")
      return
    }
    setLoading(true)
    try {
      // If exactly one group selected, apply optional updates before adding
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
            throw new Error(payload?.error || "Failed to update group before adding contact")
          }
        }
      }

      const outcomes = await Promise.allSettled(
        selectedGroups.map(async (g) => {
          const res = await fetch(`/api/groups/${g.value}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactId })
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
        showSuccess(
          `Added to ${successes} group${successes === 1 ? "" : "s"}`,
          contactName ? `${contactName} added successfully.` : "Contact added successfully."
        )
      }
      if (failures > 0 && successes === 0) {
        showError("Add to group failed", "Please try again.")
      }
      onSuccess?.()
      handleClose()
    } catch (error) {
      console.error("Failed to add to group", error)
      showError("Unable to add to group", error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  // When a group is selected on the Add tab, load its details to prefill owner/visibility/description
  // Determine which group should load details (only when exactly one is selected)
  const detailsGroupId = useMemo(() => selectedGroups.length === 1 ? selectedGroups[0].value : "", [selectedGroups])

  useEffect(() => {
    if (!isOpen || activeTab !== "add" || !detailsGroupId) {
      return
    }
    let cancelled = false
    async function loadGroupDetails() {
      setAddDetailsLoading(true)
      try {
        const res = await fetch(`/api/groups/${detailsGroupId}`, { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load group details")
        const payload = await res.json().catch(() => null)
        const data = payload?.data || {}
        if (cancelled) return
        setInitialAddDetails({
          ownerId: data.ownerId || "",
          visibility: data.visibility || "Private",
          description: data.description || ""
        })
        setAddGroupOwnerId(data.ownerId || "")
        setAddGroupVisibility(data.visibility || "Private")
        setAddGroupDescription(data.description || "")
      } catch (e) {
        if (!cancelled) {
          setInitialAddDetails(null)
        }
      } finally {
        if (!cancelled) setAddDetailsLoading(false)
      }
    }
    loadGroupDetails()
    return () => { cancelled = true }
  }, [isOpen, activeTab, detailsGroupId])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">{activeTab === "create" ? "Create Group" : "Add To Group"}</p>
            <h2 className="text-lg font-semibold text-gray-900">
              {activeTab === "create" ? (
                <>New Group for {contactName ?? "this contact"}</>
              ) : (
                <>Add {contactName ?? "this contact"} to a Group</>
              )}
            </h2>
            <p className="text-sm text-gray-500">Organize contacts into segments for collaboration and reporting.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 ${activeTab === "create" ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
              onClick={() => setActiveTab("create")}
            >
              Create New
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 ${activeTab === "add" ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
              onClick={() => setActiveTab("add")}
            >
              Add to Existing
            </button>
          </div>
        </div>

        {activeTab === "create" && (
        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Group Name<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.groupName}
                onChange={event => setForm(prev => ({ ...prev, groupName: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Customer Advisory Board"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Group Type</label>
              <select
                value={form.groupType}
                onChange={event => setForm(prev => ({ ...prev, groupType: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {GROUP_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Visibility</label>
              <select
                value={form.visibility}
                onChange={event => setForm(prev => ({ ...prev, visibility: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {VISIBILITY_OPTIONS.map(option => (
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
                disabled={ownersLoading}
                required
              />
              {showOwnerDropdown && ownerQuery.length > 0 && filteredOwners.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredOwners.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, owner: option.value }))
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

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={event => setForm(prev => ({ ...prev, isActive: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Mark group as active</span>
            </label>

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.addContactAsMember}
                onChange={event => setForm(prev => ({ ...prev, addContactAsMember: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                disabled={!contactId}
              />
              <span className="text-sm text-gray-700">Automatically add {contactName ?? "this contact"} as a member</span>
            </label>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe the purpose of this group or collaboration space."
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
              disabled={loading || !canSubmit}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Group
            </button>
          </div>
        </form>
        )}

        {activeTab === "add" && (
        <form onSubmit={handleAddExistingSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
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
                disabled={groupsLoading || !contactId}
              >
                <option value="">{groupsLoading ? "Loading groups..." : "Add a group..."}</option>
                {groupOptions.filter(o => !selectedGroups.some(s => s.value === o.value)).map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              {!contactId && (
                <p className="mt-1 text-xs text-amber-700">Contact ID missing. Open from Contact Details to add.</p>
              )}
              {selectedGroups.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedGroups.map(g => (
                    <span key={g.value} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs">
                      <span className="truncate max-w-[220px] font-medium text-blue-900" title={g.label}>{g.label}</span>
                      <button
                        type="button"
                        className="ml-1 text-blue-600 hover:text-blue-800"
                        aria-label={`Remove ${g.label}`}
                        onClick={() => setSelectedGroups(prev => prev.filter(p => p.value !== g.value))}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Group Owner</label>
              <select
                value={addGroupOwnerId}
                onChange={(e) => setAddGroupOwnerId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={ownersLoading || selectedGroups.length !== 1 || addDetailsLoading}
              >
                <option value="">{ownersLoading ? "Loading owners..." : "Keep current owner"}</option>
                {ownerOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Visibility</label>
              <select
                value={addGroupVisibility}
                onChange={(e) => setAddGroupVisibility(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={selectedGroups.length !== 1 || addDetailsLoading}
              >
                {VISIBILITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                rows={3}
                value={addGroupDescription}
                onChange={(e) => setAddGroupDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={addDetailsLoading ? "Loading description..." : "Update group description (optional)"}
                disabled={selectedGroups.length !== 1 || addDetailsLoading}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
              disabled={loading || !canAddExisting}
            >
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


