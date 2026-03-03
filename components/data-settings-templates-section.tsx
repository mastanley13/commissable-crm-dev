"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Plus, Search, Copy, Pencil, Upload } from "lucide-react"
import { ModalHeader } from "@/components/ui/modal-header"
import { MapFieldsStep } from "@/components/deposit-upload/map-fields-step"
import { parseSpreadsheetFile } from "@/lib/deposit-import/parse-file"
import type { DepositImportFieldTarget } from "@/lib/deposit-import/field-catalog"
import {
  createEmptyDepositMappingV2,
  extractDepositMappingV2FromTemplateConfig,
  seedDepositMappingV2,
  setColumnSelectionV2,
  createCustomFieldForColumnV2,
  serializeDepositMappingForTemplateV2,
  type DepositMappingConfigV2,
  type DepositColumnSelectionV2,
} from "@/lib/deposit-import/template-mapping-v2"
import type { DepositCustomFieldSection } from "@/lib/deposit-import/template-mapping"

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

type Pagination = { page: number; pageSize: number; total: number }

const inputClass =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

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
              <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
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
  mode,
  distributorAccountId,
  vendorAccountId,
  template,
  onClose,
  onSaved,
}: {
  isOpen: boolean
  mode: "create" | "edit"
  distributorAccountId: string
  vendorAccountId: string
  template: TemplateListRow | null
  onClose: () => void
  onSaved: (templateId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<"mapping" | "json">("mapping")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [configText, setConfigText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldCatalog, setFieldCatalog] = useState<DepositImportFieldTarget[]>([])
  const [fieldCatalogError, setFieldCatalogError] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [sampleRows, setSampleRows] = useState<string[][]>([])
  const [columnHasValuesByIndex, setColumnHasValuesByIndex] = useState<boolean[]>([])
  const [parsingError, setParsingError] = useState<string | null>(null)

  const [templateMapping, setTemplateMapping] = useState<DepositMappingConfigV2 | null>(null)
  const [mapping, setMapping] = useState<DepositMappingConfigV2>(() => createEmptyDepositMappingV2())

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSaving(false)
    setActiveTab("mapping")
    setName(template?.name ?? "")
    setDescription(template?.description ?? "")
    setConfigText(template ? safeJsonStringify(template.config) : "")
    const extracted = template ? extractDepositMappingV2FromTemplateConfig(template.config) : createEmptyDepositMappingV2()
    setTemplateMapping(extracted)
    setMapping(extracted)
    setFile(null)
    setCsvHeaders([])
    setSampleRows([])
    setColumnHasValuesByIndex([])
    setParsingError(null)
  }, [isOpen, template?.id])

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

  const canSubmit = name.trim().length > 0 && (mode === "edit" || (distributorAccountId && vendorAccountId))

  const buildConfigFromMapping = useCallback(
    (base: unknown) => {
      const baseObject =
        base && typeof base === "object" && !Array.isArray(base) ? (base as Record<string, unknown>) : {}
      return {
        ...baseObject,
        ...serializeDepositMappingForTemplateV2(mapping),
      }
    },
    [mapping],
  )

  const syncJsonFromMapping = () => {
    try {
      const base = configText.trim().length > 0 ? JSON.parse(configText) : (template?.config ?? {})
      setConfigText(safeJsonStringify(buildConfigFromMapping(base)))
      setError(null)
    } catch {
      setConfigText(safeJsonStringify(buildConfigFromMapping(template?.config ?? {})))
      setError(null)
    }
  }

  const handleFileChange = async (nextFile: File | null) => {
    setFile(nextFile)
    setCsvHeaders([])
    setSampleRows([])
    setColumnHasValuesByIndex([])
    setParsingError(null)
    if (!nextFile) return
    try {
      const parsed = await parseSpreadsheetFile(nextFile, nextFile.name, nextFile.type)
      const headers = parsed.headers
      setCsvHeaders(headers)
      setSampleRows(parsed.rows.slice(0, 25))
      const hasValues = new Array(headers.length).fill(false)
      let remaining = headers.length
      for (const row of parsed.rows) {
        if (remaining === 0) break
        for (let index = 0; index < headers.length; index++) {
          if (hasValues[index]) continue
          const cell = row[index]
          if (typeof cell === "string" ? cell.trim().length > 0 : String(cell ?? "").trim().length > 0) {
            hasValues[index] = true
            remaining -= 1
            if (remaining === 0) break
          }
        }
      }
      setColumnHasValuesByIndex(hasValues)
      const seeded = seedDepositMappingV2({ headers, templateMapping })
      setMapping(seeded)
    } catch (e) {
      setParsingError(e instanceof Error ? e.message : "Failed to parse file.")
    }
  }

  const handleSave = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      let config: any = undefined
      if (activeTab === "mapping") {
        const base = (() => {
          const trimmed = configText.trim()
          if (trimmed.length === 0) return template?.config ?? {}
          try {
            return JSON.parse(trimmed)
          } catch {
            return template?.config ?? {}
          }
        })()
        config = buildConfigFromMapping(base)
        setConfigText(safeJsonStringify(config))
      } else {
        const trimmed = configText.trim()
        if (trimmed.length > 0) {
          config = JSON.parse(trimmed)
        } else {
          config = null
        }
      }

      if (mode === "create") {
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
        const createdId = payload?.data?.id as string | undefined
        if (!createdId) throw new Error("Template created but no id returned")
        onSaved(createdId)
        onClose()
        return
      }

      if (!template?.id) {
        throw new Error("Missing template id")
      }

      await fetchJson(`/api/admin/data-settings/templates/${encodeURIComponent(template.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          config,
        }),
      })

      onSaved(template.id)
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
          kicker={mode === "create" ? "New" : "Edit"}
          title={mode === "create" ? "Create Template" : "Edit Template"}
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

          {mode === "create" && (!distributorAccountId || !vendorAccountId) ? (
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
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Mapping editor</div>
                    <div className="text-xs text-gray-600">
                      Upload a sample file to edit mappings using the same UI as Deposit Upload.
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Upload className="h-4 w-4" />
                    <span>{file ? "Change file" : "Upload sample file"}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv,.xls,.xlsx"
                      onChange={event => void handleFileChange(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                {file ? (
                  <div className="mt-2 text-xs text-gray-600">
                    Using file: <span className="font-medium">{file.name}</span>
                  </div>
                ) : null}
                {parsingError ? (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {parsingError}
                  </div>
                ) : null}
                {fieldCatalogError ? (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {fieldCatalogError}
                  </div>
                ) : null}
              </div>

              {file && csvHeaders.length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <MapFieldsStep
                    file={file}
                    csvHeaders={csvHeaders}
                    sampleRows={sampleRows}
                    columnHasValuesByIndex={columnHasValuesByIndex}
                    fieldCatalog={fieldCatalog}
                    fieldCatalogError={fieldCatalogError}
                    mapping={mapping}
                    templateMapping={templateMapping}
                    templateFields={null}
                    templateLabel={name.trim() || template?.name || undefined}
                    parsingError={parsingError}
                    onColumnSelectionChange={(columnName: string, selection: DepositColumnSelectionV2) => {
                      setMapping(previous => setColumnSelectionV2(previous, columnName, selection))
                    }}
                    onCreateCustomField={(columnName: string, input: { label: string; section: DepositCustomFieldSection }) => {
                      setMapping(previous => createCustomFieldForColumnV2(previous, columnName, input).nextMapping)
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-md border border-gray-200 bg-white px-3 py-3 text-sm text-gray-600">
                  Upload a sample file to edit mappings.
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={syncJsonFromMapping}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sync Raw JSON from mapping
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Config (JSON)</label>
              <textarea
                value={configText}
                onChange={event => setConfigText(event.target.value)}
                className="h-72 w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder='{"depositMapping": {"version": 2, "targets": {}, "columns": {}, "customFields": {}}}'
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
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DataSettingsTemplatesSection() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [query, setQuery] = useState("")

  const [distributor, setDistributor] = useState<{ id: string; name: string } | null>(null)
  const [vendor, setVendor] = useState<{ id: string; name: string } | null>(null)

  const [templates, setTemplates] = useState<TemplateListRow[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create")
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListRow | null>(null)
  const [cloneLoadingId, setCloneLoadingId] = useState<string | null>(null)

  const canCreate = Boolean(distributor?.id && vendor?.id)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (query.trim().length > 0) params.set("q", query.trim())
      if (distributor?.id) params.set("distributorAccountId", distributor.id)
      if (vendor?.id) params.set("vendorAccountId", vendor.id)

      const payload = await fetchJson(`/api/admin/data-settings/templates?${params.toString()}`, { cache: "no-store" })
      const rows: TemplateListRow[] = Array.isArray(payload?.data) ? payload.data : []
      const nextPagination: Pagination =
        payload?.pagination && typeof payload.pagination === "object"
          ? {
              page: Number(payload.pagination.page ?? page),
              pageSize: Number(payload.pagination.pageSize ?? pageSize),
              total: Number(payload.pagination.total ?? rows.length),
            }
          : { page, pageSize, total: rows.length }
      setTemplates(rows)
      setPagination(nextPagination)
    } catch (e) {
      setTemplates([])
      setPagination({ page, pageSize, total: 0 })
      setError(e instanceof Error ? e.message : "Failed to load templates")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, query, distributor?.id, vendor?.id])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    setPage(1)
  }, [query, distributor?.id, vendor?.id])

  const totalPages = useMemo(() => Math.max(1, Math.ceil((pagination.total ?? 0) / pageSize)), [pagination.total, pageSize])

  const openCreate = () => {
    setEditorMode("create")
    setSelectedTemplate(null)
    setEditorOpen(true)
  }

  const openEdit = (template: TemplateListRow) => {
    setEditorMode("edit")
    setSelectedTemplate(template)
    setEditorOpen(true)
  }

  const handleClone = async (templateId: string) => {
    setCloneLoadingId(templateId)
    try {
      const payload = await fetchJson(
        `/api/admin/data-settings/templates/${encodeURIComponent(templateId)}/clone`,
        { method: "POST" },
      )
      const created: TemplateListRow | null = payload?.data ?? null
      await loadTemplates()
      if (created?.id) {
        setSelectedTemplate(created)
        setEditorMode("edit")
        setEditorOpen(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clone template")
    } finally {
      setCloneLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Template Manager</h1>
          <p className="text-sm text-gray-600">
            Review and manage reconciliation templates used during Deposit Upload.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            disabled={!canCreate}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            title={!canCreate ? "Select a Distributor and Vendor to create templates" : undefined}
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <AccountAutocomplete
          label="Distributor"
          placeholder="Search distributors…"
          accountType="Distributor"
          selected={distributor}
          onSelect={value => setDistributor(value)}
        />
        <AccountAutocomplete
          label="Vendor"
          placeholder="Search vendors…"
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
              placeholder="Search templates…"
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="text-sm font-medium text-gray-900">
            Templates ({pagination.total})
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </div>

        <table className="w-full table-auto">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Distributor</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Created By</th>
              <th className="px-4 py-3">Deposits</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-sm text-gray-500" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-gray-500" colSpan={7}>
                  No templates found.
                </td>
              </tr>
            ) : (
              templates.map(row => (
                <tr key={row.id} className="text-sm text-gray-900 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">{row.distributorName}</td>
                  <td className="px-4 py-3">{row.vendorName}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(row.updatedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.createdByContactName ?? row.createdByUserName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.depositsCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        onClick={() => void handleClone(row.id)}
                        disabled={cloneLoadingId === row.id}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {cloneLoadingId === row.id ? "Cloning…" : "Clone"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TemplateEditorModal
        isOpen={editorOpen}
        mode={editorMode}
        distributorAccountId={distributor?.id ?? ""}
        vendorAccountId={vendor?.id ?? ""}
        template={selectedTemplate}
        onClose={() => setEditorOpen(false)}
        onSaved={async (templateId) => {
          await loadTemplates()
          const updated = templates.find(t => t.id === templateId) ?? null
          if (updated) setSelectedTemplate(updated)
        }}
      />
    </div>
  )
}
