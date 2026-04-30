"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, Loader2, RotateCcw } from "lucide-react"
import {
  DATA_IMPORT_ENTITIES,
  getDataImportEntityDefinition,
  type DataImportEntityType
} from "@/lib/data-import/catalog"

type ImportJobStatus = "Pending" | "Processing" | "Completed" | "Failed"
type ImportJobUndoStatus = "NotTracked" | "Undoable" | "Blocked" | "Undoing" | "Undone" | "UndoFailed"

interface RecentImportJob {
  id: string
  entityType: DataImportEntityType
  status: ImportJobStatus
  undoStatus: ImportJobUndoStatus
  fileName: string
  totalRows: number | null
  processedRows: number | null
  successCount: number | null
  errorCount: number | null
  trackedRecordCount: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

interface UndoPreview {
  importJobId: string
  canUndo: boolean
  undoStatus: ImportJobUndoStatus
  blockers: string[]
  recordCount: number
  countsByEntity: Record<string, number>
}

interface DataSettingsRecentImportsViewProps {
  entityType: DataImportEntityType
  onBack: () => void
  onEntityTypeChange: (entityType: DataImportEntityType) => void
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error"
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return date.toLocaleString()
}

function statusBadgeClasses(status: ImportJobStatus) {
  switch (status) {
    case "Completed":
      return "border-green-200 bg-green-50 text-green-700"
    case "Failed":
      return "border-red-200 bg-red-50 text-red-700"
    case "Processing":
      return "border-blue-200 bg-blue-50 text-blue-700"
    default:
      return "border-gray-200 bg-gray-50 text-gray-700"
  }
}

function undoStatusLabel(status: ImportJobUndoStatus) {
  switch (status) {
    case "Undoable":
      return "Undoable"
    case "Blocked":
      return "Undo blocked"
    case "Undoing":
      return "Undoing"
    case "Undone":
      return "Undone"
    case "UndoFailed":
      return "Undo failed"
    default:
      return null
  }
}

function formatCountsByEntity(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([entityName, count]) => `${entityName}: ${count}`)
}

export function DataSettingsRecentImportsView({
  entityType,
  onBack,
  onEntityTypeChange
}: DataSettingsRecentImportsViewProps) {
  const [recentImports, setRecentImports] = useState<RecentImportJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [undoPreview, setUndoPreview] = useState<UndoPreview | null>(null)
  const [undoJob, setUndoJob] = useState<RecentImportJob | null>(null)
  const [undoError, setUndoError] = useState<string | null>(null)
  const [isUndoLoading, setIsUndoLoading] = useState(false)
  const [undoingJobId, setUndoingJobId] = useState<string | null>(null)

  const entityDefinition = useMemo(() => getDataImportEntityDefinition(entityType), [entityType])

  const loadRecentImports = useCallback(async (nextEntityType: DataImportEntityType) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        entityType: nextEntityType,
        pageSize: "25"
      })
      const response = await fetch(`/api/admin/data-settings/imports?${params.toString()}`, {
        method: "GET",
        cache: "no-store"
      })

      const payload = (await response.json().catch(() => null)) as
        | { data?: RecentImportJob[]; error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load recent imports")
      }

      setRecentImports(Array.isArray(payload?.data) ? payload.data : [])
    } catch (requestError) {
      setError(readErrorMessage(requestError))
      setRecentImports([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecentImports(entityType)
  }, [entityType, loadRecentImports])

  const downloadImportErrors = useCallback((importJobId: string) => {
    const anchor = document.createElement("a")
    anchor.href = `/api/admin/data-settings/imports/${importJobId}/errors`
    anchor.click()
  }, [])

  const openUndoDialog = useCallback(async (job: RecentImportJob) => {
    setUndoJob(job)
    setUndoPreview(null)
    setUndoError(null)
    setIsUndoLoading(true)

    try {
      const response = await fetch(`/api/admin/data-settings/imports/${job.id}/undo`, {
        method: "GET",
        cache: "no-store"
      })
      const payload = (await response.json().catch(() => null)) as
        | { data?: UndoPreview; error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load undo preview")
      }
      if (!payload?.data) {
        throw new Error("Undo preview was not returned.")
      }

      setUndoPreview(payload.data)
    } catch (requestError) {
      setUndoError(readErrorMessage(requestError))
    } finally {
      setIsUndoLoading(false)
    }
  }, [])

  const closeUndoDialog = useCallback(() => {
    setUndoJob(null)
    setUndoPreview(null)
    setUndoError(null)
    setIsUndoLoading(false)
  }, [])

  const confirmUndo = useCallback(async () => {
    if (!undoJob) {
      return
    }

    setUndoingJobId(undoJob.id)
    setUndoError(null)
    try {
      const response = await fetch(`/api/admin/data-settings/imports/${undoJob.id}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
      const payload = (await response.json().catch(() => null)) as
        | { data?: unknown; error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to undo import")
      }

      closeUndoDialog()
      await loadRecentImports(entityType)
    } catch (requestError) {
      setUndoError(readErrorMessage(requestError))
    } finally {
      setUndoingJobId(null)
    }
  }, [closeUndoDialog, entityType, loadRecentImports, undoJob])

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-medium text-blue-700 hover:text-blue-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Imports
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Recent Imports</h1>
            <p className="text-sm text-gray-600">
              Review recent admin import runs for {entityDefinition?.label}.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadRecentImports(entityType)}
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {DATA_IMPORT_ENTITIES.map(entity => {
            const isActive = entity.type === entityType
            return (
              <button
                key={entity.type}
                type="button"
                onClick={() => onEntityTypeChange(entity.type)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {entity.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading recent imports...
          </div>
        ) : recentImports.length === 0 ? (
          <p className="text-sm text-gray-600">No recent imports recorded for this entity yet.</p>
        ) : (
          <div className="overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">File</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Rows</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Succeeded</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Errors</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Started</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Completed</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {recentImports.map(job => {
                  const undoLabel = undoStatusLabel(job.undoStatus)
                  const canOpenUndo =
                    job.status === "Completed" &&
                    job.undoStatus === "Undoable" &&
                    job.trackedRecordCount > 0
                  const isUndone = job.undoStatus === "Undone"
                  return (
                  <tr key={job.id}>
                    <td className="px-3 py-2 text-gray-800">
                      <div>{job.fileName}</div>
                      {undoLabel && (
                        <div className="mt-1 text-xs text-gray-500">{undoLabel}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeClasses(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{job.totalRows ?? "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{job.successCount ?? "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{job.errorCount ?? "-"}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {formatTimestamp(job.startedAt ?? job.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {formatTimestamp(job.completedAt ?? job.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-3">
                        {job.errorCount && job.errorCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => downloadImportErrors(job.id)}
                          className="text-xs font-medium text-blue-700 hover:text-blue-800"
                        >
                          Download errors
                        </button>
                        ) : null}
                        {canOpenUndo ? (
                          <button
                            type="button"
                            onClick={() => void openUndoDialog(job)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Undo
                          </button>
                        ) : null}
                        {isUndone ? (
                          <span className="text-xs font-medium text-gray-600">Undone</span>
                        ) : null}
                        {(!job.errorCount || job.errorCount <= 0) && !canOpenUndo && !isUndone ? (
                          <span className="text-xs text-gray-400">-</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {undoJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-gray-900">Undo Import</h2>
                <p className="mt-1 text-sm text-gray-700">
                  This will delete records created by {undoJob.fileName}. Later edits attached to
                  those records will be deleted too.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {isUndoLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading undo preview...
                </div>
              ) : undoPreview ? (
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">
                    {undoPreview.recordCount} tracked record(s) will be deleted.
                  </div>
                  {formatCountsByEntity(undoPreview.countsByEntity).length > 0 && (
                    <ul className="space-y-1 text-xs text-gray-600">
                      {formatCountsByEntity(undoPreview.countsByEntity).map(line => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  {undoPreview.blockers.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      {undoPreview.blockers.join(" ")}
                    </div>
                  )}
                </div>
              ) : (
                <span>Undo preview is not available.</span>
              )}
            </div>

            {undoError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {undoError}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeUndoDialog}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmUndo()}
                disabled={!undoPreview?.canUndo || undoingJobId === undoJob.id}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-red-700 bg-red-700 px-3 py-2 text-xs font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:border-red-300 disabled:bg-red-300"
              >
                {undoingJobId === undoJob.id && <Loader2 className="h-4 w-4 animate-spin" />}
                Undo Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
