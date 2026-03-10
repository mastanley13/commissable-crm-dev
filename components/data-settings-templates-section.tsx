"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Plus, Search, Copy, Save } from "lucide-react"
import { ModalHeader } from "@/components/ui/modal-header"
import { TemplateMappingEditor } from "@/components/template-manager/template-mapping-editor"
import type { DepositImportFieldTarget } from "@/lib/deposit-import/field-catalog"
import {
  createEmptyDepositMappingV2,
  extractDepositMappingV2FromTemplateConfig,
  serializeDepositMappingForTemplateV2,
  type DepositMappingConfigV2,
} from "@/lib/deposit-import/template-mapping-v2"

type AccountOption = { value: string; label: string; detail?: string }

type TemplateListRow = {
  id: string
  name: string
  description: string
  distributorAccountId: string
  distributorName: string
  vendorAccountId: string
  vendorName: string
  createdByUserName: string | null
  createdByContactName: string | null
  createdAt: string
  updatedAt: string
  depositsCount: number
  config: Record<string, unknown> | null
}

const inputClass =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

const selectorClass =
  "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return ""
  }
}

function mergeTemplateConfig(
  baseConfig: Record<string, unknown> | null,
  mapping: DepositMappingConfigV2,
) {
  const base =
    baseConfig && typeof baseConfig === "object" && !Array.isArray(baseConfig) ? baseConfig : {}
  return {
    ...base,
    ...serializeDepositMappingForTemplateV2(mapping),
  }
}

function mergeTemplateRow(previous: TemplateListRow, next: any): TemplateListRow {
  return {
    ...previous,
    id: typeof next?.id === "string" ? next.id : previous.id,
    name: typeof next?.name === "string" ? next.name : previous.name,
    description: typeof next?.description === "string" ? next.description : previous.description,
    distributorAccountId:
      typeof next?.distributorAccountId === "string" ? next.distributorAccountId : previous.distributorAccountId,
    distributorName: typeof next?.distributorName === "string" ? next.distributorName : previous.distributorName,
    vendorAccountId: typeof next?.vendorAccountId === "string" ? next.vendorAccountId : previous.vendorAccountId,
    vendorName: typeof next?.vendorName === "string" ? next.vendorName : previous.vendorName,
    createdByUserName:
      next?.createdByUserName === null || typeof next?.createdByUserName === "string"
        ? next.createdByUserName
        : previous.createdByUserName,
    createdByContactName:
      next?.createdByContactName === null || typeof next?.createdByContactName === "string"
        ? next.createdByContactName
        : previous.createdByContactName,
    createdAt: typeof next?.createdAt === "string" ? next.createdAt : previous.createdAt,
    updatedAt: typeof next?.updatedAt === "string" ? next.updatedAt : previous.updatedAt,
    depositsCount: Number(next?.depositsCount ?? previous.depositsCount ?? 0),
    config:
      next && Object.prototype.hasOwnProperty.call(next, "config")
        ? ((next.config as Record<string, unknown> | null) ?? null)
        : previous.config,
  }
}

async function fetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init)
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const message = typeof json?.error === "string" ? json.error : "Request failed"
    throw new Error(message)
  }
  return json
}

function AccountAutocomplete({
  label,
  placeholder,
  accountType,
  selected,
  onSelect,
}: {
  label: string
  placeholder: string
  accountType: "Distributor" | "Vendor"
  selected: { id: string; name: string } | null
  onSelect: (value: { id: string; name: string } | null) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState(selected?.name ?? "")
  const [options, setOptions] = useState<AccountOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setQuery(selected?.name ?? "")
  }, [selected?.id, selected?.name])

  const load = useCallback(
    async (q: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "25",
          accountType,
        })
        if (q.trim().length > 0) params.set("q", q.trim())
        const payload = await fetchJson(`/api/accounts?${params.toString()}`, { cache: "no-store" })
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        setOptions(
          items.map(item => ({
            value: item.id,
            label: item.accountName ?? "Unnamed account",
            detail: item.accountNumber ?? undefined,
          })),
        )
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    },
    [accountType],
  )

  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(() => {
      if (cancelled) return
      void load(query)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, load])

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      if (event.target instanceof Node && el.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handler, true)
    return () => document.removeEventListener("mousedown", handler, true)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block text-xs font-semibold text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={event => {
            setQuery(event.target.value)
            setOpen(true)
            onSelect(null)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={inputClass}
        />
        {selected ? (
          <button
            type="button"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => {
              onSelect(null)
              setQuery("")
              setOpen(false)
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="max-h-64 overflow-auto p-1">
            {loading ? (
              <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
            ) : options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
            ) : (
              options.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                  onClick={() => {
                    onSelect({ id: option.value, name: option.label })
                    setQuery(option.label)
                    setOpen(false)
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{option.label}</span>
                    {option.detail ? <span className="shrink-0 text-xs text-gray-500">{option.detail}</span> : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TemplateEditorModal({
  isOpen,
  distributorAccountId,
  vendorAccountId,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  distributorAccountId: string
  vendorAccountId: string
  onClose: () => void
  onCreated: (template: TemplateListRow) => void
}) {
  const [activeTab, setActiveTab] = useState<"mapping" | "json">("mapping")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [configText, setConfigText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldCatalog, setFieldCatalog] = useState<DepositImportFieldTarget[]>([])
  const [fieldCatalogError, setFieldCatalogError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<DepositMappingConfigV2>(() => createEmptyDepositMappingV2())

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSaving(false)
    setActiveTab("mapping")
    setName("")
    setDescription("")
    const empty = createEmptyDepositMappingV2()
    setMapping(empty)
    setConfigText(safeJsonStringify(serializeDepositMappingForTemplateV2(empty)))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const loadCatalog = async () => {
      setFieldCatalogError(null)
      try {
        const payload = await fetchJson("/api/admin/data-settings/templates/import-field-catalog", { cache: "no-store" })
        if (cancelled) return
        const catalog = Array.isArray(payload?.data) ? payload.data : []
        setFieldCatalog(catalog)
      } catch (e) {
        if (cancelled) return
        setFieldCatalog([])
        setFieldCatalogError(e instanceof Error ? e.message : "Unable to load deposit import fields.")
      }
    }
    void loadCatalog()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  const canSubmit = name.trim().length > 0 && distributorAccountId && vendorAccountId

  useEffect(() => {
    if (!isOpen) return
    if (activeTab !== "mapping") return
    setConfigText(safeJsonStringify(serializeDepositMappingForTemplateV2(mapping)))
  }, [mapping, activeTab, isOpen])

  const handleSave = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      let config: any = undefined
      if (activeTab === "mapping") {
        config = serializeDepositMappingForTemplateV2(mapping)
        setConfigText(safeJsonStringify(config))
      } else {
        const trimmed = configText.trim()
        config = trimmed.length > 0 ? JSON.parse(trimmed) : null
      }

      const payload = await fetchJson("/api/admin/data-settings/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          distributorAccountId,
          vendorAccountId,
          config,
        }),
      })

      const created = payload?.data as TemplateListRow | null
      if (!created?.id) throw new Error("Template created but no id returned")
      onCreated(created)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl">
        <ModalHeader
          kicker="New"
          title="Create Template"
          right={
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              Close
            </button>
          }
        />
        <div className="space-y-4 p-6">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          {!distributorAccountId || !vendorAccountId ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Select a Distributor and Vendor first.
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("mapping")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                activeTab === "mapping" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Mapping
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("json")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                activeTab === "json" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Raw JSON
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Name</label>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                className={inputClass}
                placeholder="Template name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Description</label>
              <input
                value={description}
                onChange={event => setDescription(event.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
          </div>

          {activeTab === "mapping" ? (
            <div className="space-y-3">
              {fieldCatalogError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {fieldCatalogError}
                </div>
              ) : null}
              <TemplateMappingEditor fieldCatalog={fieldCatalog} mapping={mapping} onChange={setMapping} />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Config (JSON)</label>
              <textarea
                value={configText}
                onChange={event => setConfigText(event.target.value)}
                className="h-72 w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={
                  '{"depositMapping": {"version": 2, "targets": {}, "columns": {}, "customFields": {}}}'
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                Tip: leave blank to clear config. Changes affect future uploads only.
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit || saving}
            className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DataSettingsTemplatesSection() {
  const router = useRouter()
  const pathname = usePathname() ?? "/admin/data-settings"
  const searchParams = useSearchParams()
  const templateIdParam = (searchParams?.get("templateId") ?? "").trim()

  const [query, setQuery] = useState("")
  const [distributor, setDistributor] = useState<{ id: string; name: string } | null>(null)
  const [vendor, setVendor] = useState<{ id: string; name: string } | null>(null)
  const [templates, setTemplates] = useState<TemplateListRow[]>([])
  const [hasLoadedTemplates, setHasLoadedTemplates] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [cloneLoadingId, setCloneLoadingId] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState(templateIdParam)
  const [fieldCatalog, setFieldCatalog] = useState<DepositImportFieldTarget[]>([])
  const [fieldCatalogError, setFieldCatalogError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"mapping" | "json">("mapping")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [mapping, setMapping] = useState<DepositMappingConfigV2>(() => createEmptyDepositMappingV2())
  const [rawJson, setRawJson] = useState("")

  const canCreate = Boolean(distributor?.id && vendor?.id)

  const syncTemplateQuery = useCallback(
    (templateId: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      params.set("section", "templates")
      if (templateId) params.set("templateId", templateId)
      else params.delete("templateId")
      const nextQuery = params.toString()
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
      })
      if (query.trim().length > 0) params.set("q", query.trim())
      if (distributor?.id) params.set("distributorAccountId", distributor.id)
      if (vendor?.id) params.set("vendorAccountId", vendor.id)

      const payload = await fetchJson(`/api/admin/data-settings/templates?${params.toString()}`, { cache: "no-store" })
      const rows: TemplateListRow[] = Array.isArray(payload?.data) ? payload.data : []
      setTemplates(rows)
    } catch (e) {
      setTemplates([])
      setError(e instanceof Error ? e.message : "Failed to load templates")
    } finally {
      setHasLoadedTemplates(true)
      setLoading(false)
    }
  }, [query, distributor?.id, vendor?.id])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    let cancelled = false
    const loadCatalog = async () => {
      setFieldCatalogError(null)
      try {
        const payload = await fetchJson("/api/admin/data-settings/templates/import-field-catalog", { cache: "no-store" })
        if (cancelled) return
        const catalog = Array.isArray(payload?.data) ? payload.data : []
        setFieldCatalog(catalog)
      } catch (e) {
        if (cancelled) return
        setFieldCatalog([])
        setFieldCatalogError(e instanceof Error ? e.message : "Unable to load deposit import fields.")
      }
    }
    void loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (templateIdParam && templateIdParam !== selectedTemplateId) {
      setSelectedTemplateId(templateIdParam)
    }
  }, [templateIdParam, selectedTemplateId])

  useEffect(() => {
    if (!hasLoadedTemplates) return

    if (templates.length === 0) {
      if (selectedTemplateId) {
        setSelectedTemplateId("")
      }
      if (templateIdParam) {
        syncTemplateQuery("")
      }
      return
    }

    const requestedExists = templateIdParam ? templates.some(template => template.id === templateIdParam) : false
    const currentExists = selectedTemplateId ? templates.some(template => template.id === selectedTemplateId) : false
    const nextSelectedTemplateId = requestedExists
      ? templateIdParam
      : currentExists
        ? selectedTemplateId
        : templates[0]?.id ?? ""

    if (nextSelectedTemplateId && nextSelectedTemplateId !== selectedTemplateId) {
      setSelectedTemplateId(nextSelectedTemplateId)
    }
    if (nextSelectedTemplateId !== templateIdParam) {
      syncTemplateQuery(nextSelectedTemplateId)
    }
  }, [hasLoadedTemplates, selectedTemplateId, syncTemplateQuery, templateIdParam, templates])

  const selectedTemplate = useMemo(
    () => templates.find(template => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  )

  useEffect(() => {
    setEditorError(null)

    if (!selectedTemplate) {
      const emptyMapping = createEmptyDepositMappingV2()
      setName("")
      setDescription("")
      setMapping(emptyMapping)
      setRawJson(safeJsonStringify(serializeDepositMappingForTemplateV2(emptyMapping)))
      setActiveTab("mapping")
      return
    }

    const extracted = extractDepositMappingV2FromTemplateConfig(selectedTemplate.config)
    setName(selectedTemplate.name ?? "")
    setDescription(selectedTemplate.description ?? "")
    setMapping(extracted)
    setRawJson(safeJsonStringify(selectedTemplate.config))
    setActiveTab("mapping")
  }, [selectedTemplate])

  useEffect(() => {
    if (activeTab !== "mapping" || !selectedTemplate) return
    setRawJson(safeJsonStringify(mergeTemplateConfig(selectedTemplate.config, mapping)))
  }, [activeTab, mapping, selectedTemplate])

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId)
      setEditorError(null)
      syncTemplateQuery(templateId)
    },
    [syncTemplateQuery],
  )

  const handleTemplateCreated = useCallback(
    (created: TemplateListRow) => {
      setTemplates(previous => {
        const withoutCreated = previous.filter(template => template.id !== created.id)
        return [created, ...withoutCreated]
      })
      setQuery("")
      handleTemplateSelect(created.id)
    },
    [handleTemplateSelect],
  )

  const handleCloneSelected = async () => {
    if (!selectedTemplate) return
    setCloneLoadingId(selectedTemplate.id)
    setEditorError(null)
    try {
      const payload = await fetchJson(
        `/api/admin/data-settings/templates/${encodeURIComponent(selectedTemplate.id)}/clone`,
        { method: "POST" },
      )
      const created = payload?.data as TemplateListRow | null
      if (!created?.id) throw new Error("Template cloned but no id returned")
      setTemplates(previous => [created, ...previous.filter(template => template.id !== created.id)])
      handleTemplateSelect(created.id)
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : "Failed to clone template")
    } finally {
      setCloneLoadingId(null)
    }
  }

  const canSave = Boolean(selectedTemplate && name.trim().length > 0) && !saving

  const handleSave = async () => {
    if (!selectedTemplate || !canSave) return
    setSaving(true)
    setEditorError(null)
    try {
      const config =
        activeTab === "mapping"
          ? mergeTemplateConfig(selectedTemplate.config, mapping)
          : (() => {
              const trimmed = rawJson.trim()
              return trimmed.length > 0 ? JSON.parse(trimmed) : null
            })()

      const payload = await fetchJson(`/api/admin/data-settings/templates/${encodeURIComponent(selectedTemplate.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          config,
        }),
      })

      const updated = payload?.data
      setTemplates(previous =>
        previous.map(template => (template.id === selectedTemplate.id ? mergeTemplateRow(template, updated) : template)),
      )
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const selectedTemplateCreatedBy =
    selectedTemplate?.createdByContactName ?? selectedTemplate?.createdByUserName ?? "-"

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Template Manager</h1>
          <p className="text-sm text-gray-600">
            Review, select, and edit reconciliation templates used during Deposit Upload.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!canCreate}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            title={!canCreate ? "Select a Distributor and Vendor to create templates" : undefined}
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
          <button
            type="button"
            onClick={() => void handleCloneSelected()}
            disabled={!selectedTemplate || cloneLoadingId === selectedTemplate.id}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Copy className="h-4 w-4" />
            {cloneLoadingId === selectedTemplate?.id ? "Cloning..." : "Clone Selected"}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <AccountAutocomplete
          label="Distributor"
          placeholder="Search distributors..."
          accountType="Distributor"
          selected={distributor}
          onSelect={value => setDistributor(value)}
        />
        <AccountAutocomplete
          label="Vendor"
          placeholder="Search vendors..."
          accountType="Vendor"
          selected={vendor}
          onSelect={value => setVendor(value)}
        />
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">Template name</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Search templates..."
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="bg-white text-sm text-gray-700">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Template</p>
              <p className="text-xs text-slate-500">
                {loading ? "Loading templates..." : `${templates.length} template${templates.length === 1 ? "" : "s"} loaded`}
              </p>
            </div>
            <select
              className={selectorClass}
              value={selectedTemplateId}
              onChange={event => handleTemplateSelect(event.target.value)}
              disabled={loading || templates.length === 0}
              aria-label="Select template"
            >
              {templates.length === 0 ? (
                <option value="">{loading ? "Loading templates..." : "No templates found"}</option>
              ) : null}
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.vendorName} - {template.name}
                </option>
              ))}
            </select>
            {selectedTemplate ? (
              <>
                <p className="text-xs leading-4 text-emerald-700">
                  Editing the saved template changes future uploads that use this mapping.
                </p>
              </>
            ) : (
              <p className="text-xs leading-4 text-slate-500">
                Filter templates above, then choose one from the dropdown to edit inline on this page.
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected Template</p>
            {selectedTemplate ? (
              <div className="grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-gray-700">Distributor:</span> {selectedTemplate.distributorName}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Vendor:</span> {selectedTemplate.vendorName}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Updated:</span> {formatDate(selectedTemplate.updatedAt)}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Created:</span> {formatDate(selectedTemplate.createdAt)}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Created by:</span> {selectedTemplateCreatedBy}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Deposits:</span> {selectedTemplate.depositsCount}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                {loading ? "Loading templates..." : "No template matches the current filters."}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        The field mapping table below mirrors Deposit Upload so template selection and editing happen in one place.
      </p>

      {editorError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editorError}</div>
      ) : null}

      {selectedTemplate ? (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Name</label>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                className={inputClass}
                placeholder="Template name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Description</label>
              <input
                value={description}
                onChange={event => setDescription(event.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("mapping")}
              className={`rounded-t-md border px-4 py-2 text-sm font-semibold ${
                activeTab === "mapping"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              Field Mapping
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("json")}
              className={`rounded-t-md border px-4 py-2 text-sm font-semibold ${
                activeTab === "json"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              Raw JSON
            </button>
          </div>

          {activeTab === "mapping" ? (
            <div className="space-y-3">
              {fieldCatalogError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {fieldCatalogError}
                </div>
              ) : null}
              <TemplateMappingEditor fieldCatalog={fieldCatalog} mapping={mapping} onChange={setMapping} />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Config (JSON)</label>
              <textarea
                value={rawJson}
                onChange={event => setRawJson(event.target.value)}
                className="h-96 w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Editing raw JSON affects future uploads only. Saving will persist the selected template config.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
          {loading
            ? "Loading templates..."
            : "No templates available for the current filters. Select a distributor and vendor, then create a template."}
        </div>
      )}

      <TemplateEditorModal
        isOpen={createOpen}
        distributorAccountId={distributor?.id ?? ""}
        vendorAccountId={vendor?.id ?? ""}
        onClose={() => setCreateOpen(false)}
        onCreated={created => {
          handleTemplateCreated(created)
        }}
      />
    </div>
  )
}
