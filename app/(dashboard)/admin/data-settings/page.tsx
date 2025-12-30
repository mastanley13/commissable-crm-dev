"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Settings2, Users, Layers, Grid3X3, DollarSign } from "lucide-react"
import { Trash2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

type SectionId = "manage-fields"

type Section = {
  id: SectionId
  title: string
  icon: any
  description: string
}

const SECTIONS: Section[] = [
  {
    id: "manage-fields",
    title: "Manage Fields",
    icon: Layers,
    description:
      "Manage allowed values for Product Families, Account Types, and more."
  }
]

interface ProductFamilyType {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  isSystem: boolean
  usageCount?: number
}

interface ProductSubtypeType {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  isSystem: boolean
  productFamilyId: string | null
  family?: {
    id: string
    name: string
  } | null
}

interface AccountTypeSetting {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  isSystem: boolean
  usageCount?: number
}

interface RevenueTypeSetting {
  code: string
  label: string
  description: string
  category: "NRC" | "MRC"
  isEnabled: boolean
  isSystem: boolean
}

type FieldId =
  | "account-types"
  | "revenue-types"
  | "product-families"
  | "product-subtypes"

type FieldCategoryId = "accounts" | "opportunities" | "products"

interface FieldDefinition {
  id: FieldId
  category: FieldCategoryId
  label: string
  entityLabel: string
  helperText: string
  usedOn: string
  badges?: string[]
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    id: "account-types",
    category: "accounts",
    label: "Account Type",
    entityLabel: "Account · Field",
    helperText:
      "Choose which account types users see in the Account Type dropdown. At least one value must remain enabled.",
    usedOn: "Used on: Accounts, filters, imports",
    badges: ["Global picklist", "Preserves historical values"]
  },
  {
    id: "revenue-types",
    category: "opportunities",
    label: "Revenue Type",
    entityLabel: "Opportunity · Field",
    helperText:
      "Configure which revenue types can be used on products and revenue schedules.",
    usedOn: "Used on: Opportunities, Revenue schedules",
    badges: ["Global picklist"]
  },
  {
    id: "product-families",
    category: "products",
    label: "Product Family",
    entityLabel: "Product · Field",
    helperText:
      "Define top-level product families used to group related products.",
    usedOn: "Used on: Products, Opportunities",
    badges: ["Top-level grouping"]
  },
  {
    id: "product-subtypes",
    category: "products",
    label: "Product Subtype",
    entityLabel: "Product · Field",
    helperText:
      "Configure detailed product subcategories that roll up to product families.",
    usedOn: "Used on: Products, Reporting",
    badges: ["Rolls up into Product Family"]
  }
]

const FIELD_CATEGORIES: { id: FieldCategoryId; label: string; description: string }[] =
  [
    {
      id: "accounts",
      label: "Accounts",
      description: "Fields used on accounts."
    },
    {
      id: "opportunities",
      label: "Opportunities",
      description: "Fields used on opportunities."
    },
    {
      id: "products",
      label: "Products",
      description: "Fields used on products."
    }
  ]

const FIELD_TABLE_MAX_BODY_HEIGHT = 470
const FIELD_TABLE_PAGE_SIZE = 10

export default function DataSettingsPage() {
  const { user, isLoading, hasPermission } = useAuth()
  const [activeSection, setActiveSection] = useState<SectionId>("manage-fields")

  const canManage = hasPermission("admin.data_settings.manage")

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="mb-6 h-8 w-1/4 rounded bg-gray-200" />
          <div className="space-y-3">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    )
  }

  if (!user || !canManage) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-lg font-semibold text-red-800">Access Denied</h2>
          <p className="text-sm text-red-600">
            You need the appropriate admin permissions to manage Data Settings.
          </p>
        </div>
      </div>
    )
  }

  const renderSection = () => {
    switch (activeSection) {
      case "manage-fields":
        return <ManageFieldsSection />
      default:
        return null
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1">
        {/* Left navigation (mirrors Settings layout) */}
        <aside className="w-72 border-r border-gray-200 bg-white p-3">
          <div className="mb-4 flex items-center space-x-2">
            <Settings2 className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Data Settings</h2>
          </div>
          <nav className="space-y-1">
            {SECTIONS.map(section => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? "border-r-2 border-blue-700 bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="mr-3 h-4 w-4" />
                    <span>{section.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{section.description}</p>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Section content */}
        <main className="flex-1 p-4">
          {renderSection()}
        </main>
      </div>
    </div>
  )
}

function ProductSubtypeSettings({ editMode }: { editMode: boolean }) {
  const [subtypes, setSubtypes] = useState<ProductSubtypeType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [page, setPage] = useState(1)
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; code: string; description: string }>
  >({})
  const [confirmDelete, setConfirmDelete] = useState<ProductSubtypeType | null>(
    null
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const prevEditModeRef = useRef(editMode)

  const pageSize = FIELD_TABLE_PAGE_SIZE

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(
          "/api/admin/data-settings/product-subtypes?includeInactive=true",
          { cache: "no-store" }
        )

        if (!res.ok) throw new Error("Failed to load product subtypes")

        const json = await res.json()

        setSubtypes(json.data ?? [])
      } catch (err) {
        console.error(err)
        setError(
          err instanceof Error ? err.message : "Failed to load product subtypes"
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const totalPages = Math.max(1, Math.ceil(subtypes.length / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const visibleSubtypes = useMemo(() => {
    const start = (page - 1) * pageSize
    return subtypes.slice(start, start + pageSize)
  }, [page, pageSize, subtypes])

  useEffect(() => {
    if (!editMode) {
      setDrafts({})
      return
    }

    setDrafts(prev => {
      const next = { ...prev }
      for (const subtype of subtypes) {
        if (!next[subtype.id]) {
          next[subtype.id] = {
            name: subtype.name ?? "",
            code: subtype.code ?? "",
            description: subtype.description ?? ""
          }
        }
      }
      return next
    })
  }, [editMode, subtypes])

  const handleToggle = async (subtype: ProductSubtypeType) => {
    try {
      setSavingId(subtype.id)
      setError(null)
      const res = await fetch("/api/admin/data-settings/product-subtypes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: subtype.id, isActive: !subtype.isActive })
      })
      if (!res.ok) throw new Error("Failed to update product subtype")
      const json = await res.json()
      const updated: ProductSubtypeType = json.data
      setSubtypes(prev => prev.map(s => (s.id === updated.id ? updated : s)))
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to update product subtype"
      )
    } finally {
      setSavingId(null)
    }
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) {
      setError("Name is required to add a product subtype.")
      return
    }

    try {
      setCreating(true)
      setError(null)
      const res = await fetch("/api/admin/data-settings/product-subtypes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newDescription.trim() || null,
          isActive: true
        })
      })
      if (!res.ok) throw new Error("Failed to create product subtype")
      const json = await res.json()
      const created: ProductSubtypeType = json.data
      setSubtypes(prev => [...prev, created])
      setNewName("")
      setNewDescription("")
      setPage(1)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to create product subtype"
      )
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (subtype: ProductSubtypeType) => {
    const draft = drafts[subtype.id]

    if (!draft) {
      return
    }

    const name = draft.name.trim()
    const code = draft.code.trim()
    const description = draft.description.trim()

    if (!name) {
      setError("Name is required for product subtypes.")
      return
    }

    const payload: any = { id: subtype.id }

    // Allow editing name and code for all subtypes.
    payload.name = name
    if (code) {
      payload.code = code
    }

    payload.description = description

    try {
      setSavingId(subtype.id)
      setError(null)
      const res = await fetch("/api/admin/data-settings/product-subtypes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        let message = "Failed to update product subtype"
        try {
          const parsed = await res.json()
          if (parsed && typeof parsed.error === "string") {
            message = parsed.error
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(message)
      }
      const json = await res.json()
      const updated: ProductSubtypeType = json.data
      setSubtypes(prev =>
        prev.map(s => (s.id === updated.id ? updated : s))
      )
      setDrafts(prev => ({
        ...prev,
        [updated.id]: {
          name: updated.name,
          code: updated.code,
          description: updated.description ?? ""
        }
      }))
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to update product subtype"
      )
    } finally {
      setSavingId(null)
    }
  }

  const saveAllDrafts = async () => {
    if (!Object.keys(drafts).length) return
    setBulkSaving(true)
    try {
      for (const [id] of Object.entries(drafts)) {
        const subtype = subtypes.find(s => s.id === id)
        if (!subtype) continue

        const draft = drafts[id]
        const name = draft.name.trim()
        if (!name) {
          setError("Name is required for product subtypes.")
          throw new Error("Name is required")
        }

        const code = draft.code.trim()
        const description = draft.description.trim()

        const currentDescription = subtype.description ?? ""
        const hasNameChange = name !== subtype.name
        const hasCodeChange = code && code !== (subtype.code ?? "")
        const hasDescriptionChange = description !== currentDescription

        if (!hasNameChange && !hasCodeChange && !hasDescriptionChange) {
          continue
        }

        await handleUpdate(subtype)
      }
    } finally {
      setBulkSaving(false)
    }
  }

  useEffect(() => {
    if (prevEditModeRef.current && !editMode) {
      void saveAllDrafts()
    }
    prevEditModeRef.current = editMode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, drafts])

  const handleRequestDelete = (subtype: ProductSubtypeType) => {
    if (subtype.isSystem) {
      return
    }
    setConfirmDelete(subtype)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return

    try {
      setDeletingId(confirmDelete.id)
      setError(null)
      const res = await fetch("/api/admin/data-settings/product-subtypes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: confirmDelete.id })
      })
      if (!res.ok) {
        let message = "Failed to delete product subtype"
        try {
          const parsed = await res.json()
          if (parsed && typeof parsed.error === "string") {
            message = parsed.error
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(message)
      }

      setSubtypes(prev => prev.filter(s => s.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to delete product subtype"
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div
          className="overflow-y-auto"
          style={{
            maxHeight: FIELD_TABLE_MAX_BODY_HEIGHT,
            minHeight: FIELD_TABLE_MAX_BODY_HEIGHT
          }}
        >
          <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                  style={{ width: "6%" }}
                >
                  Actions
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                  style={{ width: "12%" }}
                >
                  <div className="flex flex-col leading-tight">
                    <span>Enabled</span>
                    <span className="mt-0.5 text-[10px] font-normal text-gray-500">
                      Click to toggle
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "24%" }}
                >
                  Name
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "18%" }}
                >
                  Code
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "40%" }}
                >
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    Loading product subtypes...
                  </td>
                </tr>
              )}
              {!loading && subtypes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    No product subtypes found.
                  </td>
                </tr>
              )}
              {!loading &&
                visibleSubtypes.map(subtype => (
                  <tr key={subtype.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center gap-2">
                        {!subtype.isSystem && (
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(subtype)}
                            disabled={deletingId === subtype.id || bulkSaving}
                            className="inline-flex items-center rounded-full border border-red-200 bg-red-50 p-1 text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Delete this product subtype"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={subtype.isActive}
                        aria-label={`Toggle ${subtype.name} (${subtype.isActive ? "Enabled" : "Disabled"})`}
                        title={
                          savingId === subtype.id
                            ? "Updating status..."
                            : subtype.isActive
                            ? "Click to disable"
                            : "Click to enable"
                        }
                        onClick={() => handleToggle(subtype)}
                        disabled={savingId === subtype.id || bulkSaving}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          subtype.isActive
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        }`}
                      >
                        <span
                          className={`mr-2 inline-block h-2 w-2 rounded-full ${
                            subtype.isActive ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        {savingId === subtype.id
                          ? "Updating..."
                          : subtype.isActive
                          ? "Enabled"
                          : "Disabled"}
                      </button>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center space-x-2">
                        <div className="min-h-[20px] flex-1 text-xs font-medium text-gray-900">
                          {editMode ? (
                            <input
                              type="text"
                              value={
                                drafts[subtype.id]?.name !== undefined
                                  ? drafts[subtype.id]?.name
                                  : subtype.name
                              }
                              onChange={e =>
                                setDrafts(prev => ({
                                  ...prev,
                                  [subtype.id]: {
                                    name: e.target.value,
                                    code: prev[subtype.id]?.code ?? subtype.code,
                                    description:
                                      prev[subtype.id]?.description ??
                                      subtype.description ??
                                      ""
                                  }
                                }))
                              }
                              className="w-full bg-transparent px-0 py-1 focus:outline-none"
                            />
                          ) : (
                            <span className="block px-0 py-1">
                              {subtype.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      <div className="min-h-[20px]">
                        {editMode ? (
                          <input
                            type="text"
                            value={
                              drafts[subtype.id]?.code !== undefined
                                ? drafts[subtype.id]?.code
                                : subtype.code
                            }
                            onChange={e =>
                              setDrafts(prev => ({
                                ...prev,
                                [subtype.id]: {
                                  name: prev[subtype.id]?.name ?? subtype.name,
                                  code: e.target.value,
                                  description:
                                    prev[subtype.id]?.description ??
                                    subtype.description ??
                                    ""
                                }
                              }))
                            }
                            className="w-full bg-transparent px-0 py-1 text-xs text-gray-900 focus:outline-none"
                          />
                        ) : (
                          <span className="block px-0 py-1">{subtype.code}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      <div className="min-h-[20px]">
                        {editMode ? (
                          <input
                            type="text"
                            value={
                              drafts[subtype.id]?.description !== undefined
                                ? drafts[subtype.id]?.description
                                : subtype.description ?? ""
                            }
                            onChange={e =>
                              setDrafts(prev => ({
                                ...prev,
                                [subtype.id]: {
                                  name: prev[subtype.id]?.name ?? subtype.name,
                                  code: prev[subtype.id]?.code ?? subtype.code,
                                  description: e.target.value
                                }
                              }))
                            }
                            className="w-full bg-transparent px-0 py-1 text-xs text-gray-900 focus:outline-none"
                            placeholder="No description"
                          />
                        ) : subtype.description ? (
                          <span className="block px-0 py-1">
                            {subtype.description}
                          </span>
                        ) : (
                          <span className="block px-0 py-1 text-gray-400">
                            No description
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
          <div>
            {subtypes.length === 0
              ? "No product subtypes to display."
              : `Showing ${(page - 1) * pageSize + 1}-${Math.min(
                  page * pageSize,
                  subtypes.length
                )} of ${subtypes.length} subtypes`}
          </div>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3"
      >
        <div className="text-xs font-medium text-gray-900">Add Product Subtype</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,1fr,auto]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              placeholder="e.g. UCaaS"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Description
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              placeholder="Short explanation of when to use this subtype"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center self-end rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 md:w-auto"
          >
            {creating ? "Adding..." : "Add Product Subtype"}
          </button>
        </div>
      </form>

      {confirmDelete && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">
              Delete Product Subtype
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{confirmDelete.name}</span>? This
              will remove it from future dropdowns.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId === confirmDelete.id}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {deletingId === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ManageFieldsSection() {
  const [activeField, setActiveField] = useState<FieldId>("account-types")
  const [editMode, setEditMode] = useState(false)

  const activeFieldDef =
    FIELD_DEFINITIONS.find(field => field.id === activeField) ??
    FIELD_DEFINITIONS[0]

  const renderFieldContent = () => {
    switch (activeField) {
      case "account-types":
        return <AccountTypeSettings editMode={editMode} />
      case "revenue-types":
        return <RevenueTypeSettings editMode={editMode} />
      case "product-families":
        return <ProductFamilySettings editMode={editMode} />
      case "product-subtypes":
        return <ProductSubtypeSettings editMode={editMode} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Manage Fields</h1>
        <button
          type="button"
          onClick={() => setEditMode(prev => !prev)}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          {editMode ? "Done Editing" : "Edit Values"}
        </button>
      </div>

      {/* Field directory grouped by category in a 3-column grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {FIELD_CATEGORIES.map(category => {
          const fieldsInCategory = FIELD_DEFINITIONS.filter(
            field => field.category === category.id
          )

          if (fieldsInCategory.length === 0) return null

          return (
            <div
              key={category.id}
              className="space-y-2 rounded-md border border-gray-200 bg-white p-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                {category.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {fieldsInCategory.map(field => (
                  <FieldTab
                    key={field.id}
                    id={field.id}
                    activeField={activeField}
                    setActiveField={setActiveField}
                    label={field.label}
                    icon={getFieldIcon(field.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Standardized header for the selected field */}
      <FieldHeader definition={activeFieldDef} />

      {/* Field-specific values editor */}
      {renderFieldContent()}
    </div>
  )
}

interface FieldTabProps {
  id: FieldId
  label: string
  icon: any
  activeField: FieldId
  setActiveField: (id: FieldId) => void
}

function FieldTab({ id, label, icon: Icon, activeField, setActiveField }: FieldTabProps) {
  const isActive = activeField === id

  return (
    <button
      type="button"
      onClick={() => setActiveField(id)}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
        isActive
          ? "border-blue-600 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <Icon className="mr-2 h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function getFieldIcon(id: FieldId) {
  switch (id) {
    case "product-families":
    case "product-subtypes":
      return Layers
    case "account-types":
      return Users
    case "revenue-types":
      return DollarSign
    default:
      return Grid3X3
  }
}

interface FieldHeaderProps {
  definition: FieldDefinition
}

function FieldHeader({ definition }: FieldHeaderProps) {
  return (
    <h2 className="text-base font-semibold text-gray-900">
      {definition.label}
    </h2>
  )
}

function ProductFamilySettings({ editMode }: { editMode: boolean }) {
  const [families, setFamilies] = useState<ProductFamilyType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [page, setPage] = useState(1)
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; code: string; description: string }>
  >({})
  const [confirmDelete, setConfirmDelete] = useState<ProductFamilyType | null>(
    null
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const prevEditModeRef = useRef(editMode)

  const pageSize = FIELD_TABLE_PAGE_SIZE

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(
          "/api/admin/data-settings/product-families?includeInactive=true",
          { cache: "no-store" }
        )
        if (!res.ok) throw new Error("Failed to load product family types")
        const json = await res.json()
        setFamilies(json.data ?? [])
      } catch (err) {
        console.error(err)
        setError(
          err instanceof Error ? err.message : "Failed to load product family types"
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalPages = Math.max(1, Math.ceil(families.length / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const visibleFamilies = useMemo(() => {
    const start = (page - 1) * pageSize
    return families.slice(start, start + pageSize)
  }, [page, pageSize, families])

  useEffect(() => {
    if (!editMode) {
      setDrafts({})
      return
    }

    setDrafts(prev => {
      const next = { ...prev }
      for (const family of families) {
        if (!next[family.id]) {
          next[family.id] = {
            name: family.name ?? "",
            code: family.code ?? "",
            description: family.description ?? ""
          }
        }
      }
      return next
    })
  }, [editMode, families])

  const handleToggle = async (family: ProductFamilyType) => {
    try {
      setSavingId(family.id)
      setError(null)
      const res = await fetch("/api/admin/data-settings/product-families", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: family.id, isActive: !family.isActive })
      })
      if (!res.ok) throw new Error("Failed to update product family type")
      const json = await res.json()
      const updated: ProductFamilyType = json.data
      setFamilies(prev => prev.map(f => (f.id === updated.id ? updated : f)))
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to update product family type"
      )
    } finally {
      setSavingId(null)
    }
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) {
      setError("Name is required to add a product family type.")
      return
    }

    try {
      setCreating(true)
      setError(null)
      const res = await fetch("/api/admin/data-settings/product-families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newDescription.trim() || null,
          isActive: true
        })
      })
      if (!res.ok) throw new Error("Failed to create product family type")
      const json = await res.json()
      const created: ProductFamilyType = json.data
      setFamilies(prev => [...prev, created])
      setNewName("")
      setNewDescription("")
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to create product family type"
      )
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (family: ProductFamilyType) => {
    const draft = drafts[family.id]

    if (!draft) {
      return
    }

    const name = draft.name.trim()
    const code = draft.code.trim()
    const description = draft.description.trim()

    if (!name) {
      setError("Name is required for product families.")
      return
    }

    const payload: any = { id: family.id }

    // Allow editing name and code for all families.
    payload.name = name
    if (code) {
      payload.code = code
    }

    payload.description = description

    try {
      setSavingId(family.id)
      setError(null)
      const res = await fetch("/api/admin/data-settings/product-families", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        let message = "Failed to update product family type"
        try {
          const parsed = await res.json()
          if (parsed && typeof parsed.error === "string") {
            message = parsed.error
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(message)
      }
      const json = await res.json()
      const updated: ProductFamilyType = json.data
      setFamilies(prev =>
        prev.map(f => (f.id === updated.id ? updated : f))
      )
      setDrafts(prev => ({
        ...prev,
        [updated.id]: {
          name: updated.name,
          code: updated.code,
          description: updated.description ?? ""
        }
      }))
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to update product family type"
      )
    } finally {
      setSavingId(null)
    }
  }

  const saveAllDrafts = async () => {
    if (!Object.keys(drafts).length) return
    setBulkSaving(true)
    try {
      for (const [id] of Object.entries(drafts)) {
        const family = families.find(f => f.id === id)
        if (!family) continue

        const draft = drafts[id]
        const name = draft.name.trim()
        if (!name) {
          setError("Name is required for product families.")
          throw new Error("Name is required")
        }

        const code = draft.code.trim()
        const description = draft.description.trim()

        const currentDescription = family.description ?? ""
        const hasNameChange = name !== family.name
        const hasCodeChange = code && code !== (family.code ?? "")
        const hasDescriptionChange = description !== currentDescription

        if (!hasNameChange && !hasCodeChange && !hasDescriptionChange) {
          continue
        }

        await handleUpdate(family)
      }
    } finally {
      setBulkSaving(false)
    }
  }

  useEffect(() => {
    if (prevEditModeRef.current && !editMode) {
      void saveAllDrafts()
    }
    prevEditModeRef.current = editMode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, drafts])

  const handleRequestDelete = (family: ProductFamilyType) => {
    if (family.isSystem) {
      return
    }

    if ((family.usageCount ?? 0) > 0) {
      setError(
        "Product families that still have product subtypes cannot be deleted. Remove or reassign those subtypes first."
      )
      return
    }

    setConfirmDelete(family)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return

    try {
      setDeletingId(confirmDelete.id)
      setError(null)
      const res = await fetch("/api/admin/data-settings/product-families", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: confirmDelete.id })
      })
      if (!res.ok) {
        let message = "Failed to delete product family type"
        try {
          const parsed = await res.json()
          if (parsed && typeof parsed.error === "string") {
            message = parsed.error
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(message)
      }

      setFamilies(prev => prev.filter(f => f.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to delete product family type"
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div
          className="overflow-y-auto"
          style={{
            maxHeight: FIELD_TABLE_MAX_BODY_HEIGHT,
            minHeight: FIELD_TABLE_MAX_BODY_HEIGHT
          }}
        >
          <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                  style={{ width: "6%" }}
                >
                  Actions
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                  style={{ width: "12%" }}
                >
                  <div className="flex flex-col leading-tight">
                    <span>Enabled</span>
                    <span className="mt-0.5 text-[10px] font-normal text-gray-500">
                      Click to toggle
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "24%" }}
                >
                  Name
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "18%" }}
                >
                  Code
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "40%" }}
                >
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    Loading product family types...
                  </td>
                </tr>
              )}
              {!loading && families.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    No product family types found.
                  </td>
                </tr>
              )}
              {!loading &&
                visibleFamilies.map(family => (
                  <tr key={family.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center gap-2">
                        {!family.isSystem && (
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(family)}
                            disabled={
                              deletingId === family.id ||
                              bulkSaving ||
                              (family.usageCount ?? 0) > 0
                            }
                            className="inline-flex items-center rounded-full border border-red-200 bg-red-50 p-1 text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              (family.usageCount ?? 0) > 0
                                ? "Cannot delete a product family that still has product subtypes"
                                : "Delete this product family"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={family.isActive}
                        aria-label={`Toggle ${family.name} (${family.isActive ? "Enabled" : "Disabled"})`}
                        title={
                          savingId === family.id
                            ? "Updating status..."
                            : family.isActive
                            ? "Click to disable"
                            : "Click to enable"
                        }
                        onClick={() => handleToggle(family)}
                        disabled={savingId === family.id || bulkSaving}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          family.isActive
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        }`}
                      >
                        <span
                          className={`mr-2 inline-block h-2 w-2 rounded-full ${
                            family.isActive ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        {savingId === family.id
                          ? "Updating..."
                          : family.isActive
                          ? "Enabled"
                          : "Disabled"}
                      </button>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center space-x-2">
                        <div className="min-h-[20px] flex-1 text-xs font-medium text-gray-900">
                          {editMode ? (
                            <input
                              type="text"
                              value={
                                drafts[family.id]?.name !== undefined
                                  ? drafts[family.id]?.name
                                  : family.name
                              }
                              onChange={e =>
                                setDrafts(prev => ({
                                  ...prev,
                                  [family.id]: {
                                    name: e.target.value,
                                    code: prev[family.id]?.code ?? family.code,
                                    description:
                                      prev[family.id]?.description ??
                                      family.description ??
                                      ""
                                  }
                                }))
                              }
                              className="w-full bg-transparent px-0 py-1 focus:outline-none"
                            />
                          ) : (
                            <span className="block px-0 py-1">
                              {family.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      <div className="min-h-[20px]">
                        {editMode ? (
                          <input
                            type="text"
                            value={
                              drafts[family.id]?.code !== undefined
                                ? drafts[family.id]?.code
                                : family.code
                            }
                            onChange={e =>
                              setDrafts(prev => ({
                                ...prev,
                                [family.id]: {
                                  name: prev[family.id]?.name ?? family.name,
                                  code: e.target.value,
                                  description:
                                    prev[family.id]?.description ??
                                    family.description ??
                                    ""
                                }
                              }))
                            }
                            className="w-full bg-transparent px-0 py-1 text-xs text-gray-900 focus:outline-none"
                          />
                        ) : (
                          <span className="block px-0 py-1">{family.code}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      <div className="min-h-[20px]">
                        {editMode ? (
                          <input
                            type="text"
                            value={
                              drafts[family.id]?.description !== undefined
                                ? drafts[family.id]?.description
                                : family.description ?? ""
                            }
                            onChange={e =>
                              setDrafts(prev => ({
                                ...prev,
                                [family.id]: {
                                  name: prev[family.id]?.name ?? family.name,
                                  code: prev[family.id]?.code ?? family.code,
                                  description: e.target.value
                                }
                              }))
                            }
                            className="w-full bg-transparent px-0 py-1 text-xs text-gray-900 focus:outline-none"
                            placeholder="No description"
                          />
                        ) : family.description ? (
                          <span className="block px-0 py-1">
                            {family.description}
                          </span>
                        ) : (
                          <span className="block px-0 py-1 text-gray-400">
                            No description
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
          <div>
            {families.length === 0
              ? "No product family types to display."
              : `Showing ${(page - 1) * pageSize + 1}-${Math.min(
                  page * pageSize,
                  families.length
                )} of ${families.length} product family types`}
          </div>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3"
      >
        <div className="text-xs font-medium text-gray-900">
          Add Product Family Type
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,1fr,auto]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              placeholder="e.g. AI Services"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Description
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              placeholder="Short explanation of when to use this family"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center self-end rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 md:w-auto"
          >
            {creating ? "Adding..." : "Add Product Family Type"}
          </button>
        </div>
      </form>

      {confirmDelete && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">
              Delete Product Family
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{confirmDelete.name}</span>? This
              will remove it from future dropdowns. Families with existing
              product subtypes cannot be deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId === confirmDelete.id}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {deletingId === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AccountTypeSettings({ editMode }: { editMode: boolean }) {
  const [items, setItems] = useState<AccountTypeSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [page, setPage] = useState(1)
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; code: string; description: string }>
  >({})
  const [confirmDelete, setConfirmDelete] = useState<AccountTypeSetting | null>(
    null
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const prevEditModeRef = useRef(editMode)

  const pageSize = FIELD_TABLE_PAGE_SIZE

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(
          "/api/admin/data-settings/account-types?includeInactive=true",
          { cache: "no-store" }
        )
        if (!res.ok) throw new Error("Failed to load account types")
        const json = await res.json()
        setItems(json.data ?? [])
      } catch (err) {
        console.error(err)
        setError(
          err instanceof Error ? err.message : "Failed to load account types"
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!editMode) {
      setDrafts({})
      return
    }

    setDrafts(prev => {
      const next = { ...prev }
      for (const item of items) {
        if (!next[item.id]) {
          next[item.id] = {
            name: item.name ?? "",
            code: item.code ?? "",
            description: item.description ?? ""
          }
        }
      }
      return next
    })
  }, [editMode, items])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const visibleItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [page, pageSize, items])

  const handleToggle = async (item: AccountTypeSetting) => {
    try {
      setSavingId(item.id)
      setError(null)
      const res = await fetch("/api/admin/data-settings/account-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive })
      })
      if (!res.ok) throw new Error("Failed to update account type")
      const json = await res.json()
      const updated: AccountTypeSetting = json.data
      setItems(prev => prev.map(it => (it.id === updated.id ? updated : it)))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to update account type")
    } finally {
      setSavingId(null)
    }
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) {
      setError("Name is required to add an account type.")
      return
    }

    try {
      setCreating(true)
      setError(null)
      const res = await fetch("/api/admin/data-settings/account-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newDescription.trim() || null,
          isActive: true
        })
      })
      if (!res.ok) throw new Error("Failed to create account type")
      const json = await res.json()
      const created: AccountTypeSetting = json.data
      setItems(prev => [...prev, created])
      setNewName("")
      setNewDescription("")
      setPage(1)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to create account type"
      )
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (item: AccountTypeSetting) => {
    const draft = drafts[item.id]

    if (!draft) {
      return
    }

    const name = draft.name.trim()
    const code = draft.code.trim()
    const description = draft.description.trim()

    if (!name) {
      setError("Name is required for account types.")
      return
    }

    const payload: any = { id: item.id }

    // Allow editing name and code for both system and custom types.
    payload.name = name
    if (code) {
      payload.code = code
    }

    payload.description = description

    try {
      setSavingId(item.id)
      setError(null)
      const res = await fetch("/api/admin/data-settings/account-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        let message = "Failed to update account type"
        try {
          const parsed = await res.json()
          if (parsed && typeof parsed.error === "string") {
            message = parsed.error
          }
        } catch {
          // Ignore JSON parse errors and fall back to default message
        }
        throw new Error(message)
      }
      const json = await res.json()
      const updated: AccountTypeSetting = json.data
      setItems(prev => prev.map(it => (it.id === updated.id ? updated : it)))
      setDrafts(prev => ({
        ...prev,
        [updated.id]: {
          name: updated.name,
          code: updated.code,
          description: updated.description ?? ""
        }
      }))
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to update account type"
      )
    } finally {
      setSavingId(null)
    }
  }

  const saveAllDrafts = async () => {
    if (!Object.keys(drafts).length) return

    setBulkSaving(true)
    try {
      for (const [id] of Object.entries(drafts)) {
        const item = items.find(it => it.id === id)
        if (!item) continue

        const draft = drafts[id]
        const name = draft.name.trim()
        if (!name) {
          setError("Name is required for account types.")
          throw new Error("Name is required")
        }

        const code = draft.code.trim()
        const description = draft.description.trim()

        const currentDescription = item.description ?? ""
        const hasNameChange = name !== item.name
        const hasCodeChange = code && code !== (item.code ?? "")
        const hasDescriptionChange = description !== currentDescription

        if (!hasNameChange && !hasCodeChange && !hasDescriptionChange) {
          continue
        }

        await handleUpdate(item)
      }
    } finally {
      setBulkSaving(false)
    }
  }

  useEffect(() => {
    if (prevEditModeRef.current && !editMode) {
      // Transition from editing -> not editing, save all staged changes
      void saveAllDrafts()
    }
    prevEditModeRef.current = editMode
    // Intentionally exclude saveAllDrafts from deps to avoid re-running
    // on every draft change; we only care about the editMode transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, drafts])

  const handleRequestDelete = (item: AccountTypeSetting) => {
    if (item.isSystem) {
      return
    }

    if ((item.usageCount ?? 0) > 0) {
      setError(
        "Account types that are in use on accounts or contacts cannot be deleted."
      )
      return
    }

    setConfirmDelete(item)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return

    try {
      setDeletingId(confirmDelete.id)
      setError(null)
      const res = await fetch("/api/admin/data-settings/account-types", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: confirmDelete.id })
      })
      if (!res.ok) {
        let message = "Failed to delete account type"
        try {
          const parsed = await res.json()
          if (parsed && typeof parsed.error === "string") {
            message = parsed.error
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(message)
      }

      setItems(prev => prev.filter(it => it.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to delete account type"
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div
          className="overflow-y-auto"
          style={{
            maxHeight: FIELD_TABLE_MAX_BODY_HEIGHT,
            minHeight: FIELD_TABLE_MAX_BODY_HEIGHT
          }}
        >
          <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                  style={{ width: "6%" }}
                >
                  Actions
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                  style={{ width: "12%" }}
                >
                  <div className="flex flex-col leading-tight">
                    <span>Enabled</span>
                    <span className="mt-0.5 text-[10px] font-normal text-gray-500">
                      Click to toggle
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "24%" }}
                >
                  Name
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "18%" }}
                >
                  Code
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "40%" }}
                >
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    Loading account types...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    No account types found.
                  </td>
                </tr>
              )}
              {!loading &&
                visibleItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center gap-2">
                        {!item.isSystem && (
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(item)}
                            disabled={
                              deletingId === item.id ||
                              (item.usageCount ?? 0) > 0 ||
                              bulkSaving
                            }
                            className="inline-flex items-center rounded-full border border-red-200 bg-red-50 p-1 text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              (item.usageCount ?? 0) > 0
                                ? "Cannot delete an account type that is in use"
                                : "Delete this account type"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.isActive}
                        aria-label={`Toggle ${item.name} (${item.isActive ? "Enabled" : "Disabled"})`}
                        title={
                          savingId === item.id
                            ? "Updating status..."
                            : item.isActive
                            ? "Click to disable"
                            : "Click to enable"
                        }
                        onClick={() => handleToggle(item)}
                        disabled={savingId === item.id || bulkSaving}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          item.isActive
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        }`}
                      >
                        <span
                          className={`mr-2 inline-block h-2 w-2 rounded-full ${
                            item.isActive ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        {savingId === item.id
                          ? "Updating..."
                          : item.isActive
                          ? "Enabled"
                          : "Disabled"}
                      </button>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center space-x-2">
                        <div className="min-h-[20px] flex-1 text-xs font-medium text-gray-900">
                          {editMode ? (
                            <input
                              type="text"
                              value={
                                drafts[item.id]?.name !== undefined
                                  ? drafts[item.id]?.name
                                  : item.name
                              }
                              onChange={e =>
                                setDrafts(prev => ({
                                  ...prev,
                                  [item.id]: {
                                    name: e.target.value,
                                    code: prev[item.id]?.code ?? item.code,
                                    description:
                                      prev[item.id]?.description ??
                                      item.description ??
                                      ""
                                  }
                                }))
                              }
                              className="w-full bg-transparent px-0 py-1 focus:outline-none"
                            />
                          ) : (
                            <span className="block px-0 py-1">
                              {item.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      <div className="min-h-[20px]">
                        {editMode ? (
                          <input
                            type="text"
                            value={
                              drafts[item.id]?.code !== undefined
                                ? drafts[item.id]?.code
                                : item.code
                            }
                            onChange={e =>
                              setDrafts(prev => ({
                                ...prev,
                                [item.id]: {
                                  name: prev[item.id]?.name ?? item.name,
                                  code: e.target.value,
                                  description:
                                    prev[item.id]?.description ??
                                    item.description ??
                                    ""
                                }
                              }))
                            }
                            className="w-full bg-transparent px-0 py-1 text-xs text-gray-900 focus:outline-none"
                          />
                        ) : (
                          <span className="block px-0 py-1">{item.code}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      <div className="min-h-[20px]">
                        {editMode ? (
                          <input
                            type="text"
                            value={
                              drafts[item.id]?.description !== undefined
                                ? drafts[item.id]?.description
                                : item.description ?? ""
                            }
                            onChange={e =>
                              setDrafts(prev => ({
                                ...prev,
                                [item.id]: {
                                  name: prev[item.id]?.name ?? item.name,
                                  code: prev[item.id]?.code ?? item.code,
                                  description: e.target.value
                                }
                              }))
                            }
                            className="w-full bg-transparent px-0 py-1 text-xs text-gray-900 focus:outline-none"
                            placeholder="No description"
                          />
                        ) : item.description ? (
                          <span className="block px-0 py-1">
                            {item.description}
                          </span>
                        ) : (
                          <span className="block px-0 py-1 text-gray-400">
                            No description
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
          <div>
            {items.length === 0
              ? "No account types to display."
              : `Showing ${(page - 1) * pageSize + 1}-${Math.min(
                  page * pageSize,
                  items.length
                )} of ${items.length} account types`}
          </div>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3"
      >
        <div className="text-xs font-medium text-gray-900">
          Add Account Type
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,1fr,auto]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              placeholder="e.g. Partner"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Description
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              placeholder="Short explanation of when to use this type"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center self-end rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 md:w-auto"
          >
            {creating ? "Adding..." : "Add Account Type"}
          </button>
        </div>
      </form>

      {confirmDelete && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">
              Delete Account Type
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{confirmDelete.name}</span>? This
              will remove it from future dropdowns. The type is not currently
              used on any accounts or contacts.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId === confirmDelete.id}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {deletingId === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RevenueTypeSettings({ editMode }: { editMode: boolean }) {
  const [items, setItems] = useState<RevenueTypeSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [page, setPage] = useState(1)
  const [drafts, setDrafts] = useState<
    Record<string, { label: string; description: string }>
  >({})
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null)
  const [deletingCode, setDeletingCode] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const prevEditModeRef = useRef(editMode)

  const pageSize = FIELD_TABLE_PAGE_SIZE

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch("/api/admin/data-settings/revenue-types", {
          cache: "no-store"
        })
        if (!res.ok) throw new Error("Failed to load revenue types")
        const json = await res.json()
        setItems(json.data ?? [])
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Failed to load revenue types")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const visibleItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [page, pageSize, items])

  useEffect(() => {
    if (!editMode) {
      setDrafts({})
      return
    }

    setDrafts(prev => {
      const next = { ...prev }
      for (const item of items) {
        if (!next[item.code]) {
          next[item.code] = {
            label: item.label ?? "",
            description: item.description ?? ""
          }
        }
      }
      return next
    })
  }, [editMode, items])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    const label = newLabel.trim()
    if (!label) {
      setError("Label is required to add a revenue type.")
      return
    }

    const upperLabel = label.toUpperCase()
    const category: "NRC" | "MRC" =
      upperLabel.startsWith("MRC") ? "MRC" : "NRC"

    try {
      setCreating(true)
      setError(null)
      const res = await fetch("/api/admin/data-settings/revenue-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          description: newDescription.trim(),
          category
        })
      })
      if (!res.ok) throw new Error("Failed to create revenue type")
      const json = await res.json()
      const created: RevenueTypeSetting = json.data
      setItems(prev => [...prev, created])
      setNewLabel("")
      setNewDescription("")
      setPage(1)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to create revenue type"
      )
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (item: RevenueTypeSetting) => {
    try {
      setSavingCode(item.code)
      setError(null)
      const nextEnabled = items
        .map(it =>
          it.code === item.code ? { ...it, isEnabled: !it.isEnabled } : it
        )
        .filter(it => it.isEnabled)
        .map(it => it.code)

      const res = await fetch("/api/admin/data-settings/revenue-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledCodes: nextEnabled })
      })
      if (!res.ok) throw new Error("Failed to update revenue types")
      const json = await res.json()
      setItems(json.data ?? [])
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to update revenue types"
      )
    } finally {
      setSavingCode(null)
    }
  }

  const handleUpdate = async (item: RevenueTypeSetting) => {
    const draft = drafts[item.code]
    if (!draft) return

    const label = draft.label.trim()
    const description = draft.description.trim()

    if (!label) {
      setError("Label is required for revenue types.")
      return
    }

    try {
      setSavingCode(item.code)
      setError(null)
      const res = await fetch("/api/admin/data-settings/revenue-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: item.code,
          label,
          description
        })
      })
      if (!res.ok) {
        let message = "Failed to update revenue type"
        try {
          const parsed = await res.json()
          if (parsed && typeof parsed.error === "string") {
            message = parsed.error
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(message)
      }

      const json = await res.json()
      const updated: RevenueTypeSetting = json.data
      setItems(prev =>
        prev.map(it => (it.code === updated.code ? updated : it))
      )
      setDrafts(prev => ({
        ...prev,
        [updated.code]: {
          label: updated.label,
          description: updated.description ?? ""
        }
      }))
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to update revenue type"
      )
    } finally {
      setSavingCode(null)
    }
  }

  const saveAllDrafts = async () => {
    if (!Object.keys(drafts).length) return
    setBulkSaving(true)
    try {
      for (const [code] of Object.entries(drafts)) {
        const item = items.find(it => it.code === code)
        if (!item) continue

        const draft = drafts[code]
        const label = draft.label.trim()
        if (!label) {
          setError("Label is required for revenue types.")
          throw new Error("Label is required")
        }

        const description = draft.description.trim()

        const hasLabelChange = label !== item.label
        const hasDescriptionChange = description !== (item.description ?? "")

        if (!hasLabelChange && !hasDescriptionChange) {
          continue
        }

        await handleUpdate(item)
      }
    } finally {
      setBulkSaving(false)
    }
  }

  useEffect(() => {
    if (prevEditModeRef.current && !editMode) {
      void saveAllDrafts()
    }
    prevEditModeRef.current = editMode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, drafts])

  const handleRequestDelete = (item: RevenueTypeSetting) => {
    if (item.isSystem) {
      return
    }
    setConfirmDeleteCode(item.code)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDeleteCode) return

    try {
      setDeletingCode(confirmDeleteCode)
      setError(null)
      const res = await fetch("/api/admin/data-settings/revenue-types", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: confirmDeleteCode })
      })
      if (!res.ok) {
        let message = "Failed to delete revenue type"
        try {
          const parsed = await res.json()
          if (parsed && typeof parsed.error === "string") {
            message = parsed.error
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(message)
      }

      setItems(prev => prev.filter(it => it.code !== confirmDeleteCode))
      setConfirmDeleteCode(null)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to delete revenue type"
      )
    } finally {
      setDeletingCode(null)
    }
  }

  return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <div
            className="overflow-y-auto"
            style={{
              maxHeight: FIELD_TABLE_MAX_BODY_HEIGHT,
              minHeight: FIELD_TABLE_MAX_BODY_HEIGHT
            }}
        >
          <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                  style={{ width: "6%" }}
                >
                  Actions
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                  style={{ width: "12%" }}
                >
                  <div className="flex flex-col leading-tight">
                    <span>Enabled</span>
                    <span className="mt-0.5 text-[10px] font-normal text-gray-500">
                      Click to toggle
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "24%" }}
                >
                  Label
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "18%" }}
                >
                  Code
                </th>
                <th
                  className="px-4 py-2 text-left font-medium text-gray-700"
                  style={{ width: "40%" }}
                >
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    Loading revenue types...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    No revenue types found.
                  </td>
                </tr>
              )}
              {!loading &&
                visibleItems.map(item => (
                  <tr key={item.code} className="hover:bg-gray-50">
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center gap-2">
                        {!item.isSystem && (
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(item)}
                            disabled={deletingCode === item.code || bulkSaving}
                            className="inline-flex items-center rounded-full border border-red-200 bg-red-50 p-1 text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Delete this revenue type"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.isEnabled}
                        aria-label={`Toggle ${item.label} (${item.isEnabled ? "Enabled" : "Disabled"})`}
                        title={
                          savingCode === item.code
                            ? "Updating status..."
                            : item.isEnabled
                            ? "Click to disable"
                            : "Click to enable"
                        }
                        onClick={() => handleToggle(item)}
                        disabled={savingCode === item.code || bulkSaving}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          item.isEnabled
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        }`}
                      >
                        <span
                          className={`mr-2 inline-block h-2 w-2 rounded-full ${
                            item.isEnabled ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        {savingCode === item.code
                          ? "Updating..."
                          : item.isEnabled
                          ? "Enabled"
                          : "Disabled"}
                      </button>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="min-h-[20px] text-xs font-medium text-gray-900">
                        {editMode ? (
                          <input
                            type="text"
                            value={
                              drafts[item.code]?.label !== undefined
                                ? drafts[item.code]?.label
                                : item.label
                            }
                            onChange={e =>
                              setDrafts(prev => ({
                                ...prev,
                                [item.code]: {
                                  label: e.target.value,
                                  description:
                                    prev[item.code]?.description ??
                                    item.description ??
                                    ""
                                }
                              }))
                            }
                            className="w-full bg-transparent px-0 py-1 focus:outline-none"
                          />
                        ) : (
                          <span className="block px-0 py-1">
                            {item.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      {item.code}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      <div className="min-h-[20px]">
                        {editMode ? (
                          <input
                            type="text"
                            value={
                              drafts[item.code]?.description !== undefined
                                ? drafts[item.code]?.description
                                : item.description ?? ""
                            }
                            onChange={e =>
                              setDrafts(prev => ({
                                ...prev,
                                [item.code]: {
                                  label: prev[item.code]?.label ?? item.label,
                                  description: e.target.value
                                }
                              }))
                            }
                            className="w-full bg-transparent px-0 py-1 text-xs text-gray-900 focus:outline-none"
                            placeholder="No description"
                          />
                        ) : (
                          <span className="block px-0 py-1">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
          <div>
            {items.length === 0
              ? "No revenue types to display."
              : `Showing ${(page - 1) * pageSize + 1}-${Math.min(
                  page * pageSize,
                  items.length
                )} of ${items.length} revenue types`}
          </div>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3"
      >
        <div className="text-xs font-medium text-gray-900">
          Add Revenue Type
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,1fr,auto]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Label
            </label>
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              placeholder="e.g. NRC - Setup Fee"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Description
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              placeholder="Short explanation of when to use this type"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center self-end rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 md:w-auto"
          >
            {creating ? "Adding..." : "Add Revenue Type"}
          </button>
        </div>
      </form>

      {confirmDeleteCode && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">
              Delete Revenue Type
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete this custom revenue type? This
              will remove it from future dropdowns.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteCode(null)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingCode === confirmDeleteCode}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {deletingCode === confirmDeleteCode ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
