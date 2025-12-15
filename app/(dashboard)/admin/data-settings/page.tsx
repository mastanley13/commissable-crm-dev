"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Settings2, Users, Layers, Grid3X3, DollarSign } from "lucide-react"
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
}

interface RevenueTypeSetting {
  code: string
  label: string
  description: string
  category: "NRC" | "MRC"
  isEnabled: boolean
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

const FIELD_TABLE_MAX_BODY_HEIGHT = 420
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
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  )
}

function ProductSubtypeSettings() {
  const [subtypes, setSubtypes] = useState<ProductSubtypeType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [page, setPage] = useState(1)

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

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3"
      >
        <div className="text-sm font-medium text-gray-900">Add Product Subtype</div>
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
              Description (optional)
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

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div
          className="overflow-y-auto"
          style={{ maxHeight: FIELD_TABLE_MAX_BODY_HEIGHT }}
        >
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Name
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Code
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Description
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                    Loading product subtypes...
                  </td>
                </tr>
              )}
              {!loading && subtypes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                    No product subtypes found.
                  </td>
                </tr>
              )}
              {!loading &&
                visibleSubtypes.map(subtype => (
                  <tr key={subtype.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {subtype.name}
                        </span>
                        {subtype.isSystem && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      {subtype.code}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      {subtype.description || (
                        <span className="text-gray-400">No description</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => handleToggle(subtype)}
                        disabled={savingId === subtype.id}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
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
    </div>
  )
}

function ManageFieldsSection() {
  const [activeField, setActiveField] = useState<FieldId>("account-types")

  const activeFieldDef =
    FIELD_DEFINITIONS.find(field => field.id === activeField) ??
    FIELD_DEFINITIONS[0]

  const renderFieldContent = () => {
    switch (activeField) {
      case "account-types":
        return <AccountTypeSettings />
      case "revenue-types":
        return <RevenueTypeSettings />
      case "product-families":
        return <ProductFamilySettings />
      case "product-subtypes":
        return <ProductSubtypeSettings />
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-gray-900">Manage Fields</h1>
        <p className="text-xs text-gray-600">
          Choose a field below to manage its allowed values. Changes here affect
          the dropdown options users see across Accounts, Products, and Revenue
          Schedules.
        </p>
      </div>

      {/* Field directory grouped by category in a 3-column grid */}
      <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
              Fields
            </p>
            <p className="text-[11px] text-gray-500">
              Select a field below to manage its allowed values.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {FIELD_CATEGORIES.map(category => {
            const fieldsInCategory = FIELD_DEFINITIONS.filter(
              field => field.category === category.id
            )

            if (fieldsInCategory.length === 0) return null

            return (
              <div
                key={category.id}
                className="space-y-1.5 rounded-md border border-gray-200 bg-white p-3"
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                    {category.label}
                  </div>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {category.description}
                  </p>
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
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <p className="text-[11px] text-gray-500">{definition.entityLabel}</p>
        <h2 className="mt-0.5 text-base font-semibold text-gray-900">
          {definition.label}
        </h2>
        <p className="mt-1 text-xs text-gray-600">{definition.helperText}</p>
        {definition.badges && definition.badges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {definition.badges.map(badge => (
              <span
                key={badge}
                className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="text-[11px] text-gray-500 md:text-right">
        <div className="font-medium">Used on</div>
        <div>{definition.usedOn}</div>
      </div>
    </div>
  )
}

function ProductFamilySettings() {
  const [families, setFamilies] = useState<ProductFamilyType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [page, setPage] = useState(1)

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

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="space-y-2.5 rounded-md border border-gray-200 bg-gray-50 p-3"
      >
        <div className="text-xs font-semibold text-gray-900">
          Add Product Family Type
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              Description (optional)
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              placeholder="Short explanation of when to use this family"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "Adding..." : "Add Product Family Type"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div
          className="overflow-y-auto"
          style={{ maxHeight: FIELD_TABLE_MAX_BODY_HEIGHT }}
        >
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Name
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Code
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Description
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                    Loading product family types...
                  </td>
                </tr>
              )}
              {!loading && families.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                    No product family types found.
                  </td>
                </tr>
              )}
              {!loading &&
                visibleFamilies.map(family => (
                  <tr key={family.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {family.name}
                        </span>
                        {family.isSystem && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      {family.code}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      {family.description || (
                        <span className="text-gray-400">No description</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => handleToggle(family)}
                        disabled={savingId === family.id}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
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
    </div>
  )
}

function AccountTypeSettings() {
  const [items, setItems] = useState<AccountTypeSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [page, setPage] = useState(1)

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

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-2.5"
      >
        <div className="text-xs font-medium text-gray-900">
          Add Account Type
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,1fr,auto]">
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
              Description (optional)
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

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div
          className="overflow-y-auto"
          style={{ maxHeight: FIELD_TABLE_MAX_BODY_HEIGHT }}
        >
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Name
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Code
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Description
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                    Loading account types...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                    No account types found.
                  </td>
                </tr>
              )}
              {!loading &&
                visibleItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {item.name}
                        </span>
                        {item.isSystem && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            System
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      {item.code}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      {item.description || (
                        <span className="text-gray-400">No description</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => handleToggle(item)}
                        disabled={savingId === item.id}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
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
    </div>
  )
}

function RevenueTypeSettings() {
  const [items, setItems] = useState<RevenueTypeSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [page, setPage] = useState(1)

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
          style={{ maxHeight: FIELD_TABLE_MAX_BODY_HEIGHT }}
        >
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Label
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Code
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Category
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Description
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Status
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
                      <span className="font-medium text-gray-900">
                        {item.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      {item.code}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-gray-600">
                      {item.description}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => handleToggle(item)}
                        disabled={savingCode === item.code}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
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
    </div>
  )
}
