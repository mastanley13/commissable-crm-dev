"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Search } from "lucide-react"
import type { FieldConflict, MergeCollision, MergePreview, MergeWinner, RelatedCount } from "@/lib/merge/merge-types"

type Entity = "Account" | "Contact"

type PickerOption = { id: string; label: string; subtitle?: string }

function isBlockingCollision(entity: Entity, collision: MergeCollision): boolean {
  const blocking = new Set([
    "target_already_merged",
    "source_already_merged",
    "target_deleted",
    "source_deleted",
    "different_accounts",
    "reconciliation_unique_month",
    "reconciliation_template_unique_distributor",
    "reconciliation_template_unique_vendor",
  ])

  if (blocking.has(collision.type)) return true
  // For accounts, treat most collisions as blocking by default.
  if (entity === "Account" && collision.type.startsWith("reconciliation_")) return true
  return false
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString()
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function MergeRecordPicker({
  entity,
  label,
  value,
  onChange,
  disabled,
}: {
  entity: Entity
  label: string
  value: PickerOption | null
  onChange: (next: PickerOption | null) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PickerOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }

    const handle = setTimeout(async () => {
      try {
        setIsSearching(true)
        const url = `/api/admin/data-settings/merges/search?entity=${entity}&q=${encodeURIComponent(trimmed)}`

        const res = await fetch(url, { cache: "no-store" })
        if (!res.ok) {
          setResults([])
          return
        }
        const json = (await res.json()) as any
        const data = Array.isArray(json?.data) ? (json.data as PickerOption[]) : []
        setResults(
          data
            .filter(entry => typeof entry?.id === "string" && typeof entry?.label === "string")
            .map(entry => ({ id: entry.id, label: entry.label, subtitle: entry.subtitle }))
        )
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(handle)
  }, [entity, open, query])

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-800">{label}</label>
      {value ? (
        <div className="flex items-start justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
          <div>
            <div className="text-sm font-medium text-gray-900">{value.label}</div>
            {value.subtitle ? <div className="text-xs text-gray-500">{value.subtitle}</div> : null}
            <div className="mt-1 text-xs text-gray-400">{value.id}</div>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-blue-700 hover:text-blue-800"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center rounded-md border border-gray-200 bg-white px-3 py-2">
            <Search className="mr-2 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={`Search ${entity === "Account" ? "accounts" : "contacts"}...`}
              className="w-full text-sm outline-none"
              disabled={disabled}
            />
            {isSearching ? <Loader2 className="ml-2 h-4 w-4 animate-spin text-gray-400" /> : null}
          </div>
          {open && results.length > 0 ? (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-sm">
              {results.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-gray-50"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    onChange(option)
                    setQuery("")
                    setResults([])
                    setOpen(false)
                  }}
                >
                  <div className="text-sm font-medium text-gray-900">{option.label}</div>
                  {option.subtitle ? <div className="text-xs text-gray-500">{option.subtitle}</div> : null}
                </button>
              ))}
            </div>
          ) : null}
          {open && query.trim().length >= 2 && results.length === 0 && !isSearching ? (
            <div className="mt-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
              No results
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function RelatedCounts({ counts }: { counts: RelatedCount[] }) {
  if (!counts.length) return <div className="text-sm text-gray-500">No related records found.</div>
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {counts.map(entry => (
        <div key={entry.label} className="rounded-md border border-gray-200 bg-white px-3 py-2">
          <div className="text-xs text-gray-500">{entry.label}</div>
          <div className="text-sm font-semibold text-gray-900">{entry.count}</div>
        </div>
      ))}
    </div>
  )
}

function FieldConflictsTable({
  conflicts,
  winners,
  onChangeWinner,
}: {
  conflicts: FieldConflict[]
  winners: Record<string, MergeWinner | "auto">
  onChangeWinner: (field: string, winner: MergeWinner | "auto") => void
}) {
  if (!conflicts.length) return <div className="text-sm text-gray-500">No field conflicts detected.</div>

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Field</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Target</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Source</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Winner</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map(conflict => {
            const winner = winners[conflict.field] ?? "auto"
            return (
              <tr key={conflict.field} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{conflict.field}</td>
                <td className="px-3 py-2 text-gray-700">{formatValue(conflict.target)}</td>
                <td className="px-3 py-2 text-gray-700">{formatValue(conflict.source)}</td>
                <td className="px-3 py-2">
                  <select
                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm"
                    value={winner}
                    onChange={e => onChangeWinner(conflict.field, e.target.value as any)}
                  >
                    <option value="auto">Auto</option>
                    <option value="target">Target</option>
                    <option value="source">Source</option>
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function DataSettingsMergesSection() {
  const [entity, setEntity] = useState<Entity>("Account")
  const [target, setTarget] = useState<PickerOption | null>(null)
  const [source, setSource] = useState<PickerOption | null>(null)

  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [winners, setWinners] = useState<Record<string, MergeWinner | "auto">>({})

  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ auditLogId: string } | null>(null)

  const blockingCollisions = useMemo(() => {
    const collisions = preview?.collisions ?? []
    return collisions.filter(c => isBlockingCollision(entity, c))
  }, [entity, preview?.collisions])

  const canPreview = Boolean(target?.id && source?.id && target?.id !== source?.id)

  const canExecute =
    Boolean(preview) &&
    Boolean(target?.id && source?.id) &&
    target?.id !== source?.id &&
    blockingCollisions.length === 0 &&
    !isExecuting

  useEffect(() => {
    setPreview(null)
    setWinners({})
    setError(null)
    setSuccess(null)
  }, [entity, target?.id, source?.id])

  async function runPreview() {
    if (!target?.id || !source?.id) return
    setError(null)
    setSuccess(null)
    setIsPreviewing(true)
    try {
      const res = await fetch("/api/admin/data-settings/merges/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, targetId: target.id, sourceId: source.id }),
      })
      const json = (await res.json()) as any
      if (!res.ok) {
        setError(json?.error ?? "Preview failed.")
        setPreview(null)
        return
      }
      setPreview(json?.data ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.")
      setPreview(null)
    } finally {
      setIsPreviewing(false)
    }
  }

  async function runExecute() {
    if (!target?.id || !source?.id) return

    const typed = window.prompt('Type MERGE to confirm this operation.')
    if (typed !== "MERGE") return

    setError(null)
    setSuccess(null)
    setIsExecuting(true)
    try {
      const fieldWinners: Record<string, MergeWinner | undefined> = {}
      for (const [field, winner] of Object.entries(winners)) {
        if (winner === "target" || winner === "source") {
          fieldWinners[field] = winner
        }
      }

      const res = await fetch("/api/admin/data-settings/merges/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, targetId: target.id, sourceId: source.id, fieldWinners, dryRun: false }),
      })
      const json = (await res.json()) as any
      if (!res.ok) {
        setError(json?.error ?? "Merge failed.")
        return
      }

      const auditLogId = json?.data?.auditLogId as string | undefined
      setSuccess({ auditLogId: auditLogId ?? "" })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed.")
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Merges</h1>
        <p className="mt-1 text-sm text-gray-600">
          Merge duplicate records into a single survivor. This operation is transactional and audited.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            entity === "Account" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
          onClick={() => setEntity("Account")}
        >
          Accounts
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            entity === "Contact" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
          onClick={() => setEntity("Contact")}
        >
          Contacts
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MergeRecordPicker entity={entity} label="Target (Survivor)" value={target} onChange={setTarget} />
        <MergeRecordPicker entity={entity} label="Source (Merged)" value={source} onChange={setSource} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runPreview}
          disabled={!canPreview || isPreviewing}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${
            !canPreview || isPreviewing ? "bg-gray-200 text-gray-500" : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {isPreviewing ? "Previewing..." : "Preview Merge"}
        </button>

        <button
          type="button"
          onClick={runExecute}
          disabled={!canExecute}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${
            !canExecute ? "bg-gray-200 text-gray-500" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isExecuting ? "Merging..." : "Merge Records"}
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>{error}</div>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4" />
          <div>
            Merge completed.
            {success.auditLogId ? <div className="mt-1 text-xs text-green-700">Audit Log ID: {success.auditLogId}</div> : null}
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <p className="mt-1 text-sm text-gray-600">
              Review related records, field conflicts, and warnings before merging.
            </p>
          </div>

          {preview.collisions?.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="mb-1 text-sm font-semibold text-amber-900">Warnings / Blocks</div>
              <ul className="space-y-1 text-sm text-amber-900">
                {preview.collisions.map(c => (
                  <li key={`${c.type}:${c.message}`} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <span>
                      <span className="font-mono text-xs">{c.type}</span>: {c.message}
                    </span>
                  </li>
                ))}
              </ul>
              {blockingCollisions.length ? (
                <div className="mt-2 text-xs font-semibold text-amber-900">
                  Merge disabled until blocking items are resolved.
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold text-gray-900">Related Records (Source {"->"} Target)</h3>
            <div className="mt-2">
              <RelatedCounts counts={preview.relatedCounts ?? []} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">Field Conflicts</h3>
            <p className="mt-1 text-xs text-gray-500">
              Winner defaults to Auto (target wins + fill blanks). You can override per-field.
            </p>
            <div className="mt-2">
              <FieldConflictsTable
                conflicts={preview.fieldConflicts ?? []}
                winners={winners}
                onChangeWinner={(field, winner) => setWinners(prev => ({ ...prev, [field]: winner }))}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
