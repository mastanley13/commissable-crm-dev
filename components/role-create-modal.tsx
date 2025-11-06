"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { useToasts } from "@/components/toast"

interface PermissionOption {
  id: string
  code: string
  name: string
  category: string
}

interface RoleCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (roleId: string) => void
}

interface RoleFormState {
  code: string
  name: string
  description: string
  isDefault: boolean
  permissionIds: string[]
}

export function RoleCreateModal({ isOpen, onClose, onCreated }: RoleCreateModalProps) {
  const [form, setForm] = useState<RoleFormState>({
    code: "",
    name: "",
    description: "",
    isDefault: false,
    permissionIds: []
  })
  const [permissions, setPermissions] = useState<PermissionOption[]>([])
  const [permissionSearch, setPermissionSearch] = useState("")
  const [showPermissionDropdown, setShowPermissionDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [submitMode, setSubmitMode] = useState<"save" | "saveAndNew">("save")
  const { showError, showSuccess } = useToasts()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm({
      code: "",
      name: "",
      description: "",
      isDefault: false,
      permissionIds: []
    })
    setPermissionSearch("")
    setSubmitMode("save")

    setOptionsLoading(true)
    fetch("/api/admin/permissions", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load permissions")
        }
        const payload = await response.json()
        const items = Array.isArray(payload?.data?.permissions) ? payload.data.permissions : []
        const permissionOptions: PermissionOption[] = items.map((permItem: any) => ({
          id: permItem.id,
          code: permItem.code,
          name: permItem.name || permItem.code,
          category: permItem.category || "General"
        }))
        setPermissions(permissionOptions)
      })
      .catch(() => {
        setPermissions([])
        showError("Unable to load permissions", "Please try again later")
      })
      .finally(() => setOptionsLoading(false))
  }, [isOpen, showError])

  const canSubmit = useMemo(() =>
    form.code.trim().length > 0 &&
    form.name.trim().length > 0,
    [form.code, form.name]
  )

  const filteredPermissions = useMemo(() => {
    if (!permissionSearch.trim()) return permissions
    const q = permissionSearch.toLowerCase()
    return permissions.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  }, [permissions, permissionSearch])

  const selectedPermissions = useMemo(() => {
    return permissions.filter(p => form.permissionIds.includes(p.id))
  }, [permissions, form.permissionIds])

  const groupedSelectedPermissions = useMemo(() => {
    const grouped: Record<string, PermissionOption[]> = {}
    selectedPermissions.forEach(p => {
      if (!grouped[p.category]) {
        grouped[p.category] = []
      }
      grouped[p.category].push(p)
    })
    return grouped
  }, [selectedPermissions])

  const handleAddPermission = (permissionId: string) => {
    if (!form.permissionIds.includes(permissionId)) {
      setForm(prev => ({
        ...prev,
        permissionIds: [...prev.permissionIds, permissionId]
      }))
    }
    setPermissionSearch("")
    setShowPermissionDropdown(false)
  }

  const handleRemovePermission = (permissionId: string) => {
    setForm(prev => ({
      ...prev,
      permissionIds: prev.permissionIds.filter(id => id !== permissionId)
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      showError("Missing information", "Code and name are required.")
      return
    }

    setLoading(true)
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        isDefault: form.isDefault,
        permissionIds: form.permissionIds
      }

      const response = await fetch("/api/admin/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? "Failed to create role")
      }

      const data = await response.json().catch(() => null)
      const roleId: string | undefined = data?.data?.role?.id
      showSuccess("Role created", "The role has been created successfully.")
      onCreated?.(roleId ?? "")

      if (submitMode === "saveAndNew") {
        setForm(prev => ({
          ...prev,
          code: "",
          name: "",
          description: "",
          permissionIds: []
        }))
        setSubmitMode("save")
      } else {
        onClose()
      }
    } catch (error) {
      console.error("Failed to create role", error)
      showError(
        "Unable to create role",
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
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Create Role</p>
            <h2 className="text-lg font-semibold text-gray-900">New Role</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Role Code<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.code}
                onChange={event => setForm(prev => ({ ...prev, code: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="e.g., SALES_MGR"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Role Name<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="e.g., Sales Manager"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Description</label>
              <textarea
                value={form.description}
                onChange={event => setForm(prev => ({ ...prev, description: event.target.value.slice(0, 500) }))}
                rows={3}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Describe the purpose and responsibilities of this role"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Default Role</label>
              <div className="flex items-center gap-3 px-0 py-1">
                <span className="text-xs text-gray-600">{form.isDefault ? "Yes" : "No"}</span>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, isDefault: !prev.isDefault }))}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${form.isDefault ? "bg-primary-600" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${form.isDefault ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-gray-500">If enabled, new users will be assigned this role by default</p>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Permissions</label>
              <div className="relative">
                <input
                  type="text"
                  value={permissionSearch}
                  onChange={e => {
                    setPermissionSearch(e.target.value)
                    setShowPermissionDropdown(true)
                  }}
                  onFocus={() => setShowPermissionDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPermissionDropdown(false), 200)}
                  placeholder="Type to search and add permissions..."
                  className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                  disabled={optionsLoading}
                />
                {showPermissionDropdown && permissionSearch.length > 0 && filteredPermissions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {filteredPermissions
                      .filter(p => !form.permissionIds.includes(p.id))
                      .map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleAddPermission(option.id)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                        >
                          <div className="font-medium text-gray-900">{option.name}</div>
                          <div className="text-xs text-gray-500">{option.category} - {option.code}</div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              {selectedPermissions.length > 0 && (
                <div className="mt-3 space-y-3">
                  {Object.entries(groupedSelectedPermissions).map(([category, perms]) => (
                    <div key={category}>
                      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600">{category}</h4>
                      <div className="flex flex-wrap gap-2">
                        {perms.map(permission => (
                          <div
                            key={permission.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs text-primary-700"
                          >
                            <span>{permission.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemovePermission(permission.id)}
                              className="rounded-full hover:bg-primary-100"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
