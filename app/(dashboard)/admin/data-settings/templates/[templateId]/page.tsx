"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { ModalHeader } from "@/components/ui/modal-header"
import { TemplateMappingEditor } from "@/components/template-manager/template-mapping-editor"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"
import type { DepositImportFieldTarget } from "@/lib/deposit-import/field-catalog"
import {
  createEmptyDepositMappingV2,
  extractDepositMappingV2FromTemplateConfig,
  serializeDepositMappingForTemplateV2,
  type DepositMappingConfigV2,
} from "@/lib/deposit-import/template-mapping-v2"

type TemplateDetail = {
  id: string
  name: string
  description: string
  distributorName: string
  vendorName: string
  config: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  depositsCount: number
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

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return ""
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function DataSettingsTemplateDetailPage() {
  const router = useRouter()
  const { setBreadcrumbs } = useBreadcrumbs()
  const params = useParams<{ templateId: string }>()
  const templateId = (params?.templateId ?? "").toString()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldCatalog, setFieldCatalog] = useState<DepositImportFieldTarget[]>([])
  const [fieldCatalogError, setFieldCatalogError] = useState<string | null>(null)

  const [template, setTemplate] = useState<TemplateDetail | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [mapping, setMapping] = useState<DepositMappingConfigV2>(() => createEmptyDepositMappingV2())
  const [rawJson, setRawJson] = useState("")
  const [activeTab, setActiveTab] = useState<"mapping" | "json">("mapping")

  const canSave = useMemo(() => name.trim().length > 0 && Boolean(templateId) && !saving, [name, templateId, saving])

  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [templatePayload, catalogPayload] = await Promise.all([
          fetchJson(`/api/admin/data-settings/templates/${encodeURIComponent(templateId)}`, { cache: "no-store" }),
          fetchJson("/api/admin/data-settings/templates/import-field-catalog", { cache: "no-store" }).catch((e) => {
            throw e
          }),
        ])
        if (cancelled) return
        const data = templatePayload?.data as any
        const detail: TemplateDetail = {
          id: data.id,
          name: data.name ?? "",
          description: data.description ?? "",
          distributorName: data.distributorName ?? "",
          vendorName: data.vendorName ?? "",
          config: (data.config as any) ?? null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          depositsCount: Number(data.depositsCount ?? 0),
        }
        setTemplate(detail)
        setName(detail.name)
        setDescription(detail.description)

        const extracted = extractDepositMappingV2FromTemplateConfig(detail.config)
        setMapping(extracted)
        setRawJson(safeJsonStringify(detail.config))

        const catalog = Array.isArray(catalogPayload?.data) ? catalogPayload.data : []
        setFieldCatalog(catalog)
        setFieldCatalogError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load template")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [templateId])

  useEffect(() => {
    const name = template?.name ?? "Template"
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Admin", href: "/admin" },
      { name: "Data Settings", href: "/admin/data-settings" },
      { name: "Templates", href: "/admin/data-settings?section=templates" },
      { name, href: `/admin/data-settings/templates/${encodeURIComponent(templateId)}`, current: true },
    ])
    return () => {
      setBreadcrumbs(null)
    }
  }, [setBreadcrumbs, template?.name, templateId])

  useEffect(() => {
    if (!template) return
    if (activeTab !== "mapping") return
    const base = template.config ?? {}
    const merged = {
      ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}),
      ...serializeDepositMappingForTemplateV2(mapping),
    }
    setRawJson(safeJsonStringify(merged))
  }, [mapping, activeTab, template])

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const base = template?.config ?? {}
      const merged =
        activeTab === "mapping"
          ? {
              ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}),
              ...serializeDepositMappingForTemplateV2(mapping),
            }
          : (() => {
              const trimmed = rawJson.trim()
              return trimmed.length > 0 ? JSON.parse(trimmed) : null
            })()

      const payload = await fetchJson(`/api/admin/data-settings/templates/${encodeURIComponent(templateId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          config: merged,
        }),
      })

      const updated = payload?.data as any
      const nextTemplate: TemplateDetail = {
        id: updated.id,
        name: updated.name ?? "",
        description: updated.description ?? "",
        distributorName: updated.distributorName ?? "",
        vendorName: updated.vendorName ?? "",
        config: updated.config ?? null,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        depositsCount: Number(updated.depositsCount ?? 0),
      }
      setTemplate(nextTemplate)
      setRawJson(safeJsonStringify(nextTemplate.config))
      setMapping(extractDepositMappingV2FromTemplateConfig(nextTemplate.config))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4">
        <Link
          href="/admin/data-settings?section=templates"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Templates
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <ModalHeader
          kicker="Template"
          title={template ? template.name : "Loading…"}
          right={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.refresh()}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                disabled={loading || saving}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave || loading}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          }
        />

        <div className="space-y-6 p-6">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          {loading ? (
            <div className="text-sm text-gray-600">Loading template…</div>
          ) : null}

          {template ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">Name</label>
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">Description</label>
                <input
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="text-xs text-gray-600">
                <div>
                  <span className="font-semibold text-gray-700">Distributor:</span> {template.distributorName}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-gray-700">Vendor:</span> {template.vendorName}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-gray-700">Updated:</span> {formatDate(template.updatedAt)}
                </div>
              </div>
              <div className="text-xs text-gray-600">
                <div>
                  <span className="font-semibold text-gray-700">Created:</span> {formatDate(template.createdAt)}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-gray-700">Deposits:</span> {template.depositsCount}
                </div>
              </div>
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
                Editing raw JSON affects future uploads only. Saving will persist to Cloud SQL.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
