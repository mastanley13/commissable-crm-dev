"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { getColumnSelectionV2, type DepositMappingConfigV2 } from "@/lib/deposit-import/template-mapping-v2"
import type { DepositImportFieldTarget } from "@/lib/deposit-import/field-catalog"

interface ReviewStepProps {
  csvHeaders: string[]
  mapping: DepositMappingConfigV2
  fieldCatalog: DepositImportFieldTarget[]
  validationIssues: string[]
  totalRows: number
  mappedFields: number
  submitting: boolean
  error: string | null
  result: { depositId: string } | null
  onSubmit: () => void
}

export function ReviewStep({
  csvHeaders,
  mapping,
  fieldCatalog,
  validationIssues,
  totalRows,
  mappedFields,
  submitting,
  error,
  result,
  onSubmit
}: ReviewStepProps) {
  const [activeTab, setActiveTab] = useState<"mapped" | "unmapped">("mapped")

  const fieldCatalogById = useMemo(() => new Map(fieldCatalog.map(target => [target.id, target])), [fieldCatalog])

  const mappingRows = useMemo(() => {
    return csvHeaders.map((header, index) => {
      const selection = getColumnSelectionV2(mapping, header)
      const customDefinition =
        selection.type === "custom" ? mapping.customFields[selection.customKey] : undefined
      const selectedTarget =
        selection.type === "target" ? fieldCatalogById.get(selection.targetId) : undefined

      const mappedToLabel =
        selection.type === "target"
          ? selectedTarget?.label ?? "Mapped field"
          : selection.type === "custom"
            ? customDefinition?.label ?? "Custom field"
            : selection.type === "ignore"
              ? "Ignore this column"
              : "Additional info (no specific field)"

      const status: "Mapped" | "Unmapped" | "Excluded" =
        selection.type === "target" || selection.type === "custom"
          ? "Mapped"
          : selection.type === "ignore"
            ? "Excluded"
            : "Unmapped"

      return {
        key: `${index}:${header}`,
        header: header || "(unnamed column)",
        mappedToLabel,
        status
      }
    })
  }, [csvHeaders, fieldCatalogById, mapping])

  const mappedRows = useMemo(() => mappingRows.filter(row => row.status === "Mapped"), [mappingRows])
  const unmappedRows = useMemo(() => mappingRows.filter(row => row.status !== "Mapped"), [mappingRows])
  const visibleRows = activeTab === "mapped" ? mappedRows : unmappedRows

  const statusBadge = (status: "Mapped" | "Unmapped" | "Excluded") => {
    const statusClass =
      status === "Mapped"
        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
        : status === "Excluded"
          ? "border-gray-200 bg-gray-50 text-gray-500"
          : "border-gray-200 bg-gray-50 text-gray-600"

    const dotClass =
      status === "Mapped"
        ? "bg-emerald-600"
        : status === "Excluded"
          ? "bg-gray-500"
          : "bg-gray-500"

    return (
      <span
        className={`inline-flex w-fit items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-semibold leading-4 whitespace-nowrap ${statusClass}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {status}
      </span>
    )
  }

  const blockedReasons: string[] = []
  if (result) blockedReasons.push("Import already completed.")
  if (submitting) blockedReasons.push("Import is already in progress.")
  if (!Number.isFinite(totalRows) || totalRows <= 0) blockedReasons.push("No rows detected from the uploaded file.")
  if (!Number.isFinite(mappedFields) || mappedFields <= 0) blockedReasons.push("No mapped fields selected.")
  if (validationIssues.length > 0) blockedReasons.push("Resolve the validation issues before importing.")

  const canStartImport = blockedReasons.length === 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Review</h2>
          <p className="text-sm text-gray-600">Confirm mappings and spot-check parsed rows before you import.</p>
        </div>
        <div className="flex flex-row gap-3 sm:flex-col sm:items-end sm:gap-1 text-sm text-gray-600">
          <div>
            <span className="font-semibold text-gray-900">{Number.isFinite(totalRows) ? totalRows : 0}</span>{" "}
            <span>Rows detected</span>
          </div>
          <div>
            <span className="font-semibold text-gray-900">{Number.isFinite(mappedFields) ? mappedFields : 0}</span>{" "}
            <span>Mapped fields</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-gray-900">Mapping review</p>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("mapped")}
              className={`rounded-full border px-3 py-1 font-semibold ${
                activeTab === "mapped"
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Mapped ({mappedRows.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("unmapped")}
              className={`rounded-full border px-3 py-1 font-semibold ${
                activeTab === "unmapped"
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Unmapped ({unmappedRows.length})
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="hidden border-b border-primary-700 bg-primary-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white md:grid md:grid-cols-[minmax(0,1.6fr)_120px_minmax(0,1.8fr)]">
            <div>Field label in file</div>
            <div>Status</div>
            <div>Map to import field</div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-500">
              {activeTab === "mapped" ? "No mapped columns." : "No unmapped columns."}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {visibleRows.map(row => (
                <div
                  key={row.key}
                  className="grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,1.6fr)_120px_minmax(0,1.8fr)] md:items-center"
                >
                  <div className="flex flex-col justify-center gap-0.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                      Field label in file
                    </p>
                    <p className="text-sm font-semibold text-gray-900 break-words">{row.header}</p>
                  </div>

                  <div className="flex flex-col justify-center gap-0.5 md:items-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Status</p>
                    {statusBadge(row.status)}
                  </div>

                  <div className="flex flex-col justify-center gap-0.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                      Map to import field
                    </p>
                    <p className="text-sm text-gray-700 break-words">{row.mappedToLabel}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-900">Validation</p>
        {validationIssues.length === 0 ? (
          <p className="mt-2 text-sm text-green-600">No blocking issues detected.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-600">
            {validationIssues.map(issue => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {result ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 space-y-2">
          <p className="font-semibold">Import completed</p>
          <p>
            Deposit created successfully.{" "}
            <Link href={`/reconciliation/${result.depositId}`} className="underline font-semibold">
              View deposit detail
            </Link>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          This step will create a deposit, deposit line items, and a reconciliation import job.
        </div>
      )}

      {!canStartImport && blockedReasons.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold">Cannot start import</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockedReasons.map(reason => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-end border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canStartImport}
          className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {submitting ? "Importing..." : "Start Import"}
        </button>
      </div>
    </div>
  )
}
