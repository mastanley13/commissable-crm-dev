"use client"

import { useEffect, useState } from "react"
import { FileSpreadsheet, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { depositFieldDefinitions, requiredDepositFieldIds } from "@/lib/deposit-import/fields"
import { normalizeKey } from "@/lib/deposit-import/normalize"
import {
  getColumnSelection,
  type DepositMappingConfigV1,
  type DepositColumnSelection,
  type DepositCustomFieldSection,
} from "@/lib/deposit-import/template-mapping"
import type { TelarusTemplateFieldsV1 } from "@/lib/deposit-import/telarus-template-fields"

const PREVIEW_PAGE_SIZE = 1
const COLUMN_TABLE_PAGE_SIZE = 12
// Fixed scroll area height for both column tables.
const COLUMN_TABLE_MAX_HEIGHT_CLASS = "h-[280px] overflow-y-auto"

interface MapFieldsStepProps {
  file: File | null
  csvHeaders: string[]
  sampleRows: string[][]
  mapping: DepositMappingConfigV1
  templateMapping: DepositMappingConfigV1 | null
  templateFields: TelarusTemplateFieldsV1 | null
  parsingError: string | null
  onColumnSelectionChange: (columnName: string, selection: DepositColumnSelection) => void
  onCreateCustomField: (columnName: string, input: { label: string; section: DepositCustomFieldSection }) => void
  canProceed: boolean
  onBack: () => void
  onProceed: () => void
}

export function MapFieldsStep({
  file,
  csvHeaders,
  sampleRows,
  mapping,
  templateMapping,
  templateFields,
  parsingError,
  onColumnSelectionChange,
  onCreateCustomField,
  canProceed,
  onBack,
  onProceed,
}: MapFieldsStepProps) {
  const [previewRowIndex, setPreviewRowIndex] = useState(0)
  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null)
  const [templateTablePage, setTemplateTablePage] = useState(0)
  const [additionalTablePage, setAdditionalTablePage] = useState(0)
  const [customDrafts, setCustomDrafts] = useState<
    Record<string, { label: string; section: DepositCustomFieldSection }>
  >({})

  useEffect(() => {
    setPreviewRowIndex(0)
  }, [sampleRows.length])

  useEffect(() => {
    setTemplateTablePage(0)
    setAdditionalTablePage(0)
  }, [csvHeaders.length, file?.name])

  const totalPreviewRows = sampleRows.length
  const effectiveIndex =
    totalPreviewRows === 0 ? 0 : Math.min(previewRowIndex, Math.max(0, totalPreviewRows - 1))
  const windowStart = effectiveIndex
  const windowEndExclusive =
    totalPreviewRows === 0 ? 0 : Math.min(totalPreviewRows, windowStart + PREVIEW_PAGE_SIZE)
  const previewWindow = sampleRows.slice(windowStart, windowEndExclusive)
  const isFirstWindow = windowStart === 0
  const isLastWindow = windowEndExclusive >= totalPreviewRows
  const previewRangeLabel =
    totalPreviewRows === 0
      ? "No rows"
      : windowStart + 1 === windowEndExclusive
        ? `Row ${windowStart + 1} of ${totalPreviewRows}`
        : `Rows ${windowStart + 1}-${windowEndExclusive} of ${totalPreviewRows}`

  const canonicalFieldMapping: Record<string, string> = Object.entries(mapping.line ?? {}).reduce(
    (acc, [fieldId, columnName]) => {
      if (typeof columnName === "string" && columnName.trim()) {
        acc[fieldId] = columnName
      }
      return acc
    },
    {} as Record<string, string>,
  )

  const missingRequired = requiredDepositFieldIds.filter(fieldId => !canonicalFieldMapping[fieldId])

  const columnRows = csvHeaders.map((header, index) => ({ header, index }))

  const normalizedHeaderLookup = new Map<string, string>()
  for (const header of csvHeaders) {
    const key = normalizeKey(header)
    if (key && !normalizedHeaderLookup.has(key)) {
      normalizedHeaderLookup.set(key, header)
    }
  }

  const templateHintByNormalizedHeader = new Map<string, string>()
  if (templateFields?.fields?.length) {
    for (const field of templateFields.fields) {
      const key = normalizeKey(field.telarusFieldName)
      if (!key || templateHintByNormalizedHeader.has(key)) continue
      templateHintByNormalizedHeader.set(key, field.commissableFieldLabel)
    }
  }

  const templateColumnCandidates = new Set<string>()
  if (templateMapping) {
    for (const columnName of Object.values(templateMapping.line ?? {})) {
      if (typeof columnName === "string" && columnName.trim()) {
        templateColumnCandidates.add(columnName)
      }
    }
    for (const columnName of Object.keys(templateMapping.columns ?? {})) {
      if (columnName.trim()) templateColumnCandidates.add(columnName)
    }
  }

  const CORE_TEMPLATE_FIELDS = ["accountNameRaw", "usage", "commission", "vendorNameRaw"] as const
  for (const fieldId of CORE_TEMPLATE_FIELDS) {
    const columnName = canonicalFieldMapping[fieldId]
    if (typeof columnName === "string" && columnName.trim()) {
      templateColumnCandidates.add(columnName)
    }
  }

  if (templateFields?.fields?.length) {
    for (const field of templateFields.fields) {
      if (field.telarusFieldName?.trim()) templateColumnCandidates.add(field.telarusFieldName)
    }
  }

  const templateColumnNames = new Set<string>()
  for (const candidate of templateColumnCandidates) {
    if (csvHeaders.includes(candidate)) {
      templateColumnNames.add(candidate)
      continue
    }
    const resolved = normalizedHeaderLookup.get(normalizeKey(candidate))
    if (resolved) templateColumnNames.add(resolved)
  }

  const templateRows = columnRows.filter(({ header }) => templateColumnNames.has(header))
  const templateIndexes = new Set(templateRows.map(row => row.index))
  const additionalRows = columnRows.filter(row => !templateIndexes.has(row.index))

  const updateCustomDraft = (
    draftKey: string,
    updates: Partial<{ label: string; section: DepositCustomFieldSection }>,
  ) => {
    setCustomDrafts(previous => {
      const existing = previous[draftKey] ?? { label: "", section: "additional" as const }
      return {
        ...previous,
        [draftKey]: { ...existing, ...updates },
      }
    })
  }

  const goToPreviousRow = () => {
    setPreviewRowIndex(previous => {
      if (totalPreviewRows === 0) return previous
      const next = previous - PREVIEW_PAGE_SIZE
      return next > 0 ? next : 0
    })
  }

  const goToNextRow = () => {
    setPreviewRowIndex(previous => {
      if (totalPreviewRows === 0) return previous
      const next = previous + PREVIEW_PAGE_SIZE
      if (next >= totalPreviewRows) {
        return previous
      }
      return next
    })
  }

  const renderColumnTable = ({
    title,
    description,
    rows,
    emptyLabel,
    pagination,
  }: {
    title: string
    description?: string
    rows: Array<{ header: string; index: number }>
    emptyLabel: string
    pagination: { page: number; setPage: (nextPage: number) => void }
  }) => {
    const pageCount = Math.max(1, Math.ceil(rows.length / COLUMN_TABLE_PAGE_SIZE))
    const currentPage = Math.max(0, Math.min(pagination.page, pageCount - 1))
    const startIndex = currentPage * COLUMN_TABLE_PAGE_SIZE
    const endIndexExclusive = Math.min(rows.length, startIndex + COLUMN_TABLE_PAGE_SIZE)
    const pagedRows = rows.slice(startIndex, endIndexExclusive)

    return (
      <div className="rounded-lg border border-gray-200 text-sm text-gray-700">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-1.5">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {title} <span className="font-normal text-gray-500">({rows.length})</span>
            </p>
            {description ? <p className="mt-0.5 text-xs text-gray-600">{description}</p> : null}
          </div>
        </div>

        <div className="hidden border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_120px_minmax(0,1.7fr)]">
          <div>Field label in file</div>
          <div>Preview information</div>
          <div>Status</div>
          <div>Map to Commissable field</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-3 py-3 text-sm text-gray-500">{emptyLabel}</div>
        ) : (
          <>
            <div className={`${COLUMN_TABLE_MAX_HEIGHT_CLASS} divide-y divide-gray-200`}>
              {pagedRows.map(({ header, index }) => {
              const previewValues = previewWindow
                .map(row => row[index] ?? "")
                .filter(value => typeof value === "string" && value.trim().length > 0)
              const selection = getColumnSelection(mapping, header)
              const customDefinition =
                selection.type === "custom" ? mapping.customFields[selection.customKey] : undefined

              const selectedLabel =
                selection.type === "canonical"
                  ? depositFieldDefinitions.find(field => field.id === selection.fieldId)?.label ?? "Mapped field"
                  : selection.type === "custom"
                    ? customDefinition?.label ?? "Custom field"
                    : selection.type === "product"
                      ? "Product info column"
                      : selection.type === "ignore"
                        ? "Ignore this column"
                        : "Additional info (no specific field)"

              const draftKey = `${index}:${header}`
              const draft = customDrafts[draftKey] ?? { label: header?.trim() ?? "", section: "additional" as const }
              const isMenuOpen = openDropdownKey === draftKey

              const closeMenu = () => {
                setOpenDropdownKey(previous => (previous === draftKey ? null : previous))
              }

              const applySelection = (next: DepositColumnSelection) => {
                onColumnSelectionChange(header, next)
                closeMenu()
              }

              const handleCreateCustomFieldInline = () => {
                const label = draft.label.trim()
                if (!label) return
                onCreateCustomField(header, { label, section: draft.section })
                updateCustomDraft(draftKey, { label: "" })
                closeMenu()
              }

              const mappedField =
                selection.type === "canonical"
                  ? depositFieldDefinitions.find(field => field.id === selection.fieldId)
                  : undefined

              let statusLabel = "Unmapped"
              let statusClass = "border-gray-200 bg-gray-50 text-gray-600"
              const templateHint = templateHintByNormalizedHeader.get(normalizeKey(header))

              if (selection.type === "canonical" || selection.type === "custom" || selection.type === "product") {
                statusLabel = "Mapped"
                statusClass = "border-emerald-300 bg-emerald-50 text-emerald-700"
              } else if (selection.type === "ignore") {
                statusLabel = "Unmapped"
                statusClass = "border-gray-200 bg-gray-50 text-gray-500"
              } else {
                // selection.type === "additional"
                statusLabel = "Unmapped"
                statusClass = templateHint
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-gray-200 bg-gray-50 text-gray-600"
              }

              const columnName = header || "(unnamed column)"

              return (
                <div
                  key={`${header}-${index}`}
                  className="grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_120px_minmax(0,1.7fr)] md:items-center"
                >
                  <div className="flex flex-col justify-center gap-0.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                      Field label in file
                    </p>
                    <p className="text-sm font-semibold text-gray-900 break-words">{columnName}</p>
                  </div>

                  <div className="flex flex-col justify-center gap-0.5 text-xs text-gray-600">
                    <p className="font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                      Preview information
                    </p>
                    {previewValues.length > 0 ? (
                      previewValues.map((value, valueIndex) => (
                        <p
                          key={`${header}-preview-${valueIndex}`}
                          className={valueIndex === 0 ? "truncate" : "truncate text-gray-500"}
                          title={value}
                        >
                          {value}
                        </p>
                      ))
                    ) : (
                      <p className="text-gray-400">No sample values in these rows.</p>
                    )}
                  </div>

                  <div className="flex flex-col justify-center gap-0.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                      Status
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="flex flex-col justify-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                      Map to Commissable field
                    </p>
                    <DropdownMenu.Root
                      open={isMenuOpen}
                      onOpenChange={open => {
                        if (open) {
                          setOpenDropdownKey(draftKey)
                          if (!customDrafts[draftKey]) {
                            updateCustomDraft(draftKey, { label: header?.trim() ?? "", section: "additional" })
                          }
                          return
                        }
                        closeMenu()
                      }}
                    >
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          disabled={csvHeaders.length === 0}
                          className="inline-flex w-full items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2 py-1 text-left text-sm text-gray-900 focus:border-primary-500 focus:outline-none disabled:bg-gray-100"
                          aria-label="Map to Commissable field"
                        >
                          <span className="truncate">{selectedLabel}</span>
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        </button>
                      </DropdownMenu.Trigger>

                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="z-50 min-w-[320px] rounded-lg border border-gray-200 bg-white p-2 shadow-lg animate-in fade-in-0 zoom-in-95"
                          sideOffset={6}
                          align="start"
                        >
                          {!customDefinition ? (
                            <div className="space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Create custom field
                              </p>
                              <input
                                value={draft.label}
                                onChange={event => updateCustomDraft(draftKey, { label: event.target.value })}
                                onKeyDown={event => {
                                  if (event.key === "Enter") {
                                    event.preventDefault()
                                    handleCreateCustomFieldInline()
                                  }
                                }}
                                placeholder="Type new custom field label…"
                                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-primary-500 focus:outline-none"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${draft.section === "additional" ? "border-primary-200 bg-primary-50 text-primary-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                                  onClick={() => updateCustomDraft(draftKey, { section: "additional" })}
                                >
                                  Additional
                                </button>
                                <button
                                  type="button"
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${draft.section === "product" ? "border-primary-200 bg-primary-50 text-primary-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                                  onClick={() => updateCustomDraft(draftKey, { section: "product" })}
                                >
                                  Product
                                </button>
                                <button
                                  type="button"
                                  className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                  onClick={handleCreateCustomFieldInline}
                                  disabled={!draft.label.trim()}
                                >
                                  Create
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
                              <p className="font-semibold text-gray-900">Custom field</p>
                              <p className="text-gray-600">
                                {customDefinition.label} ({customDefinition.section === "product" ? "Product" : "Additional"})
                              </p>
                            </div>
                          )}

                          <DropdownMenu.Separator className="my-2 h-px bg-gray-200" />

                          <div className="max-h-[320px] overflow-y-auto pr-1">
                            <DropdownMenu.Item
                              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
                              onSelect={() => applySelection({ type: "additional" })}
                            >
                              <span>Additional info (no specific field)</span>
                              {selection.type === "additional" ? <Check className="h-4 w-4 text-primary-600" /> : null}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
                              onSelect={() => applySelection({ type: "product" })}
                            >
                              <span>Product info column</span>
                              {selection.type === "product" ? <Check className="h-4 w-4 text-primary-600" /> : null}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
                              onSelect={() => applySelection({ type: "ignore" })}
                            >
                              <span>Ignore this column</span>
                              {selection.type === "ignore" ? <Check className="h-4 w-4 text-primary-600" /> : null}
                            </DropdownMenu.Item>

                            <div className="my-2 border-t border-gray-100" />
                            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                              Map to Commissable field
                            </p>
                            {depositFieldDefinitions.map(field => (
                              <DropdownMenu.Item
                                key={field.id}
                                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
                                onSelect={() => applySelection({ type: "canonical", fieldId: field.id })}
                              >
                                <span className="truncate">
                                  {field.label}
                                  {field.required ? " (Required)" : ""}
                                </span>
                                {selection.type === "canonical" && selection.fieldId === field.id ? (
                                  <Check className="h-4 w-4 text-primary-600" />
                                ) : null}
                              </DropdownMenu.Item>
                            ))}
                          </div>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>

                    {templateHint && !customDefinition && selection.type !== "canonical" ? (
                      <p className="text-xs text-gray-600">
                        Template suggests: <span className="font-semibold">{templateHint}</span>.
                      </p>
                    ) : null}

                    {customDefinition ? (
                      <p className="text-xs text-gray-600">
                        This column is mapped to a custom{" "}
                        {customDefinition.section === "product"
                          ? "Product Information"
                          : "Additional Information"}{" "}
                        field: <span className="font-semibold">{customDefinition.label}</span>.
                      </p>
                    ) : null}
                  </div>
                </div>
              )
              })}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
              <span>
                Showing {rows.length === 0 ? 0 : startIndex + 1}-{endIndexExclusive} of {rows.length}
              </span>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => pagination.setPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 disabled:border-gray-200 disabled:text-gray-300"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="min-w-[92px] text-center">
                  Page {currentPage + 1} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => pagination.setPage(Math.min(pageCount - 1, currentPage + 1))}
                  disabled={currentPage >= pageCount - 1}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 disabled:border-gray-200 disabled:text-gray-300"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 md:p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2 md:items-start">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary-50 p-2 text-primary-600">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Map Fields</h2>
            <p className="text-sm text-gray-600">Match upload columns to Commissable fields.</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Uploaded file</p>
          {file ? (
            <div className="mt-2 space-y-1 text-gray-600">
              <p>{file.name}</p>
              <p className="text-xs text-gray-500">Columns detected: {csvHeaders.length || "0"}</p>
              {parsingError ? (
                <p className="text-xs text-red-600">{parsingError}</p>
              ) : csvHeaders.length === 0 ? (
                <p className="text-xs text-gray-500">Select a CSV/XLS file with a header row to begin mapping.</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-gray-500">No file selected. Return to Create Deposit to attach a file.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">Mapping guidance</p>
        <p className="mt-1.5 text-xs text-gray-600">
          Map required fields like Usage and Commission to columns from your uploaded file. Optional fields can be left
          unmapped. If a saved mapping exists for the selected Distributor + Vendor, those columns (plus core fields) will
          appear in the Template-mapped section below.
        </p>
      </div>

      {parsingError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to read file</p>
            <p>{parsingError}</p>
          </div>
        </div>
      ) : null}

      {csvHeaders.length > 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Uploaded columns</p>
              <p className="mt-1 text-xs text-gray-600">
                Review sample data and map each column from your file to a Commissable field.
              </p>
            </div>
            {totalPreviewRows > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
                <button
                  type="button"
                  onClick={goToPreviousRow}
                  disabled={isFirstWindow}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 disabled:border-gray-200 disabled:text-gray-300"
                  aria-label="Previous sample row"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="min-w-[120px] text-center">
                  {previewRangeLabel}
                </span>
                <button
                  type="button"
                  onClick={goToNextRow}
                  disabled={isLastWindow}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 disabled:border-gray-200 disabled:text-gray-300"
                  aria-label="Next sample row"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-4">
            {renderColumnTable({
              title: `Template-mapped columns (${templateRows.length})`,
              description:
                templateRows.length > 0
                  ? "Columns included in the saved Distributor/Vendor template mapping."
                  : "No saved template mapping was found for the selected Distributor/Vendor.",
              rows: templateRows,
              emptyLabel: "Select a Distributor and Vendor with a saved mapping to pre-fill this section.",
              pagination: { page: templateTablePage, setPage: setTemplateTablePage },
            })}

            {renderColumnTable({
              title: `Additional columns (${additionalRows.length})`,
              description: "All other columns (not included in the template mapping).",
              rows: additionalRows,
              emptyLabel: "No additional columns found.",
              pagination: { page: additionalTablePage, setPage: setAdditionalTablePage },
            })}
          </div>

          {/*
          <div className="mt-3 rounded-lg border border-gray-200 text-sm text-gray-700">
            <div className="hidden border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_120px_minmax(0,1.7fr)]">
              <div>Field label in file</div>
              <div>Preview information</div>
              <div>Status</div>
              <div>Map to Commissable field</div>
            </div>

            <div className="divide-y divide-gray-200">
              {csvHeaders.map((header, index) => {
                const previewValues = previewWindow
                  .map(row => row[index] ?? "")
                  .filter(value => typeof value === "string" && value.trim().length > 0)
                const selection = getColumnSelection(mapping, header)
                const customDefinition =
                  selection.type === "custom" ? mapping.customFields[selection.customKey] : undefined

                const selectedLabel =
                  selection.type === "canonical"
                    ? depositFieldDefinitions.find(field => field.id === selection.fieldId)?.label ?? "Mapped field"
                    : selection.type === "custom"
                      ? customDefinition?.label ?? "Custom field"
                      : selection.type === "product"
                        ? "Product info column"
                        : selection.type === "ignore"
                          ? "Ignore this column"
                          : "Additional info (no specific field)"

                const draftKey = `${index}:${header}`
                const draft = customDrafts[draftKey] ?? { label: header?.trim() ?? "", section: "additional" as const }
                const isMenuOpen = openDropdownKey === draftKey

                const closeMenu = () => {
                  setOpenDropdownKey(previous => (previous === draftKey ? null : previous))
                }

                const applySelection = (next: DepositColumnSelection) => {
                  onColumnSelectionChange(header, next)
                  closeMenu()
                }

                const handleCreateCustomFieldInline = () => {
                  const label = draft.label.trim()
                  if (!label) return
                  onCreateCustomField(header, { label, section: draft.section })
                  updateCustomDraft(draftKey, { label: "" })
                  closeMenu()
                }

                const mappedField =
                  selection.type === "canonical"
                    ? depositFieldDefinitions.find(field => field.id === selection.fieldId)
                    : undefined

                let statusLabel = "Unmapped"
                let statusClass = "border-gray-200 bg-gray-50 text-gray-600"

                if (selection.type === "canonical") {
                  statusLabel = mappedField?.required ? "Required mapped" : "Mapped"
                  statusClass = "border-emerald-300 bg-emerald-50 text-emerald-700"
                } else if (selection.type === "custom") {
                  statusLabel = "Custom field"
                  statusClass = "border-sky-300 bg-sky-50 text-sky-700"
                } else if (selection.type === "product") {
                  statusLabel = "Product info"
                  statusClass = "border-indigo-300 bg-indigo-50 text-indigo-700"
                } else if (selection.type === "ignore") {
                  statusLabel = "Ignored"
                  statusClass = "border-gray-200 bg-gray-50 text-gray-500"
                } else if (selection.type === "additional") {
                  statusLabel = "Additional info"
                  statusClass = "border-gray-200 bg-gray-50 text-gray-600"
                }

                const columnName = header || "(unnamed column)"

                return (
                  <div
                    key={`${header}-${index}`}
                    className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_120px_minmax(0,1.7fr)] md:items-start"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                        Field label in file
                      </p>
                      <p className="text-sm font-semibold text-gray-900 break-words">{columnName}</p>
                    </div>

                    <div className="space-y-0.5 text-xs text-gray-600">
                      <p className="font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                        Preview information
                      </p>
                      {previewValues.length > 0 ? (
                        previewValues.map((value, valueIndex) => (
                          <p
                            key={`${header}-preview-${valueIndex}`}
                            className={valueIndex === 0 ? "truncate" : "truncate text-gray-500"}
                            title={value}
                          >
                            {value}
                          </p>
                        ))
                      ) : (
                        <p className="text-gray-400">No sample values in these rows.</p>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                        Status
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                        Map to Commissable field
                      </p>
                      <DropdownMenu.Root
                        open={isMenuOpen}
                        onOpenChange={open => {
                          if (open) {
                            setOpenDropdownKey(draftKey)
                            if (!customDrafts[draftKey]) {
                              updateCustomDraft(draftKey, { label: header?.trim() ?? "", section: "additional" })
                            }
                            return
                          }
                          closeMenu()
                        }}
                      >
                        <DropdownMenu.Trigger asChild>
                          <button
                            type="button"
                            disabled={csvHeaders.length === 0}
                            className="inline-flex w-full items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-left text-sm text-gray-900 focus:border-primary-500 focus:outline-none disabled:bg-gray-100"
                            aria-label="Map to Commissable field"
                          >
                            <span className="truncate">{selectedLabel}</span>
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            className="z-50 min-w-[320px] rounded-lg border border-gray-200 bg-white p-2 shadow-lg animate-in fade-in-0 zoom-in-95"
                            sideOffset={6}
                            align="start"
                          >
                            {!customDefinition ? (
                              <div className="space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                  Create custom field
                                </p>
                                <input
                                  value={draft.label}
                                  onChange={event => updateCustomDraft(draftKey, { label: event.target.value })}
                                  onKeyDown={event => {
                                    if (event.key === "Enter") {
                                      event.preventDefault()
                                      handleCreateCustomFieldInline()
                                    }
                                  }}
                                  placeholder="Type new custom field label…"
                                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                                />
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex rounded-md border border-gray-300 p-0.5">
                                    <button
                                      type="button"
                                      className={`rounded px-2 py-1 text-[11px] font-semibold ${
                                        draft.section === "additional"
                                          ? "bg-primary-50 text-primary-700"
                                          : "text-gray-600 hover:bg-gray-50"
                                      }`}
                                      onClick={() => updateCustomDraft(draftKey, { section: "additional" })}
                                    >
                                      Additional
                                    </button>
                                    <button
                                      type="button"
                                      className={`rounded px-2 py-1 text-[11px] font-semibold ${
                                        draft.section === "product"
                                          ? "bg-primary-50 text-primary-700"
                                          : "text-gray-600 hover:bg-gray-50"
                                      }`}
                                      onClick={() => updateCustomDraft(draftKey, { section: "product" })}
                                    >
                                      Product
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={!draft.label.trim()}
                                    onClick={handleCreateCustomFieldInline}
                                    className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                  >
                                    Create
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                  Custom field mapped
                                </p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {customDefinition.label}{" "}
                                  <span className="text-xs font-medium text-gray-500">
                                    ({customDefinition.section === "product" ? "Product" : "Additional"})
                                  </span>
                                </p>
                              </div>
                            )}

                            <DropdownMenu.Separator className="my-2 h-px bg-gray-200" />

                            <div className="max-h-[320px] overflow-y-auto pr-1">
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
                                onSelect={() => applySelection({ type: "additional" })}
                              >
                                <span>Additional info (no specific field)</span>
                                {selection.type === "additional" ? <Check className="h-4 w-4 text-primary-600" /> : null}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
                                onSelect={() => applySelection({ type: "product" })}
                              >
                                <span>Product info column</span>
                                {selection.type === "product" ? <Check className="h-4 w-4 text-primary-600" /> : null}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
                                onSelect={() => applySelection({ type: "ignore" })}
                              >
                                <span>Ignore this column</span>
                                {selection.type === "ignore" ? <Check className="h-4 w-4 text-primary-600" /> : null}
                              </DropdownMenu.Item>

                              <div className="my-2 border-t border-gray-100" />
                              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Map to Commissable field
                              </p>
                              {depositFieldDefinitions.map(field => (
                                <DropdownMenu.Item
                                  key={field.id}
                                  className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
                                  onSelect={() => applySelection({ type: "canonical", fieldId: field.id })}
                                >
                                  <span className="truncate">
                                    {field.label}
                                    {field.required ? " (Required)" : ""}
                                  </span>
                                  {selection.type === "canonical" && selection.fieldId === field.id ? (
                                    <Check className="h-4 w-4 text-primary-600" />
                                  ) : null}
                                </DropdownMenu.Item>
                              ))}
                            </div>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>

                      {customDefinition ? (
                        <p className="text-xs text-gray-600">
                          This column is mapped to a custom{" "}
                          {customDefinition.section === "product"
                            ? "Product Information"
                            : "Additional Information"}{" "}
                          field: <span className="font-semibold">{customDefinition.label}</span>.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          */}
        </div>
      ) : null}

      {missingRequired.length > 0 ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <p className="font-semibold">Unmapped required fields</p>
            <p className="text-xs">
              Map the following fields before continuing:{" "}
              {missingRequired
                .map(fieldId => depositFieldDefinitions.find(field => field.id === fieldId)?.label || fieldId)
                .join(", ")}
              .
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-end border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onProceed}
          disabled={!canProceed}
          className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Continue to Review
        </button>
      </div>
    </div>
  )
}
