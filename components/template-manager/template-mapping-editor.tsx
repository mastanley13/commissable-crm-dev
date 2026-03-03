"use client"

import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type {
  DepositImportFieldTarget,
} from "@/lib/deposit-import/field-catalog"
import type {
  DepositMappingConfigV2,
  DepositMappingColumnConfigV2,
} from "@/lib/deposit-import/template-mapping-v2"
import type { DepositCustomFieldSection } from "@/lib/deposit-import/template-mapping"

const inputClass =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

function cloneMapping(mapping: DepositMappingConfigV2): DepositMappingConfigV2 {
  return {
    ...mapping,
    targets: { ...(mapping.targets ?? {}) },
    columns: { ...(mapping.columns ?? {}) },
    customFields: { ...(mapping.customFields ?? {}) },
    header: mapping.header ? { ...mapping.header } : undefined,
    options: mapping.options ? { ...mapping.options } : undefined,
  }
}

function normalizeColumnsForTargets(mapping: DepositMappingConfigV2): DepositMappingConfigV2 {
  const next = cloneMapping(mapping)
  const normalizedColumns: Record<string, DepositMappingColumnConfigV2> = {}

  for (const [columnName, config] of Object.entries(next.columns ?? {})) {
    if (!columnName.trim()) continue
    if (config.mode !== "target") {
      normalizedColumns[columnName] = config
      continue
    }

    const targetId = config.targetId?.trim() ?? ""
    if (!targetId) continue
    if (next.targets?.[targetId] !== columnName) continue
    normalizedColumns[columnName] = { mode: "target", targetId }
  }

  for (const [targetId, columnNameRaw] of Object.entries(next.targets ?? {})) {
    const columnName = (columnNameRaw ?? "").trim()
    if (!targetId.trim() || !columnName) continue
    normalizedColumns[columnName] = { mode: "target", targetId }
  }

  return { ...next, columns: normalizedColumns }
}

function setTargetColumn(mapping: DepositMappingConfigV2, targetId: string, columnNameRaw: string): DepositMappingConfigV2 {
  const target = targetId.trim()
  const columnName = columnNameRaw.trim()
  const next = cloneMapping(mapping)

  if (!target) return next

  const previousColumn = next.targets?.[target]
  if (previousColumn && previousColumn !== columnName) {
    const prevConfig = next.columns?.[previousColumn]
    if (prevConfig?.mode === "target" && prevConfig.targetId === target) {
      delete next.columns[previousColumn]
    }
  }

  if (!columnName) {
    delete next.targets[target]
    return normalizeColumnsForTargets(next)
  }

  for (const [otherTargetId, otherColumn] of Object.entries(next.targets ?? {})) {
    if (otherTargetId === target) continue
    if ((otherColumn ?? "").trim() === columnName) {
      delete next.targets[otherTargetId]
    }
  }

  next.targets[target] = columnName
  next.columns[columnName] = { mode: "target", targetId: target }
  return normalizeColumnsForTargets(next)
}

function getCustomKeyColumn(mapping: DepositMappingConfigV2, customKey: string) {
  for (const [columnName, config] of Object.entries(mapping.columns ?? {})) {
    if (config.mode === "custom" && config.customKey === customKey) {
      return columnName
    }
  }
  return ""
}

function setCustomKeyColumn(mapping: DepositMappingConfigV2, customKey: string, columnNameRaw: string): DepositMappingConfigV2 {
  const key = customKey.trim()
  const columnName = columnNameRaw.trim()
  const next = cloneMapping(mapping)
  if (!key) return next

  for (const [existingColumnName, config] of Object.entries(next.columns ?? {})) {
    if (config.mode === "custom" && config.customKey === key && existingColumnName !== columnName) {
      delete next.columns[existingColumnName]
    }
  }

  if (!columnName) {
    return next
  }

  next.columns[columnName] = { mode: "custom", customKey: key }
  return next
}

function uniqueKey(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base
  let counter = 1
  while (taken.has(`${base}_${counter}`)) counter += 1
  return `${base}_${counter}`
}

export function TemplateMappingEditor({
  fieldCatalog,
  mapping,
  onChange,
}: {
  fieldCatalog: DepositImportFieldTarget[]
  mapping: DepositMappingConfigV2
  onChange: (next: DepositMappingConfigV2) => void
}) {
  const [addTargetId, setAddTargetId] = useState("")
  const [addColumnName, setAddColumnName] = useState("")
  const [newCustomLabel, setNewCustomLabel] = useState("")
  const [newCustomSection, setNewCustomSection] = useState<DepositCustomFieldSection>("additional")

  const fieldById = useMemo(() => {
    const map = new Map<string, DepositImportFieldTarget>()
    for (const field of fieldCatalog) {
      map.set(field.id, field)
    }
    return map
  }, [fieldCatalog])

  const mappedTargets = useMemo(() => {
    const items = Object.entries(mapping.targets ?? {}).map(([targetId, columnName]) => ({
      targetId,
      columnName: (columnName ?? "").trim(),
      label: fieldById.get(targetId)?.label ?? targetId,
      required: Boolean(fieldById.get(targetId)?.required),
    }))
    items.sort((a, b) => a.label.localeCompare(b.label))
    return items
  }, [mapping.targets, fieldById])

  const availableTargets = useMemo(() => {
    const mapped = new Set(Object.keys(mapping.targets ?? {}))
    return fieldCatalog
      .filter(field => !mapped.has(field.id))
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [fieldCatalog, mapping.targets])

  const customFields = useMemo(() => {
    const items = Object.entries(mapping.customFields ?? {}).map(([customKey, def]) => ({
      customKey,
      label: def.label,
      section: def.section,
      columnName: getCustomKeyColumn(mapping, customKey),
    }))
    items.sort((a, b) => a.label.localeCompare(b.label))
    return items
  }, [mapping.customFields, mapping.columns])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Mapped Fields</h3>
        <p className="mt-1 text-xs text-gray-600">
          These are the saved target → column mappings used during Deposit Upload (future uploads only).
        </p>

        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full table-auto">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                <th className="px-4 py-3">Field</th>
                <th className="px-4 py-3">Mapped Column Name</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mappedTargets.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-600" colSpan={3}>
                    No saved mappings yet.
                  </td>
                </tr>
              ) : (
                mappedTargets.map(item => (
                  <tr key={item.targetId} className="text-sm text-gray-900">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.label}</span>
                        {item.required ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Required
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">{item.targetId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className={inputClass}
                        value={item.columnName}
                        onChange={event => onChange(setTargetColumn(mapping, item.targetId, event.target.value))}
                        placeholder="e.g. Usage Amount"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          onClick={() => onChange(setTargetColumn(mapping, item.targetId, ""))}
                          title="Remove mapping"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-gray-700">Add field</label>
            <select
              className={inputClass}
              value={addTargetId}
              onChange={event => setAddTargetId(event.target.value)}
            >
              <option value="">Select a field…</option>
              {availableTargets.map(field => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-gray-700">Column name</label>
            <input
              className={inputClass}
              value={addColumnName}
              onChange={event => setAddColumnName(event.target.value)}
              placeholder="e.g. Vendor"
            />
          </div>
          <div className="flex items-end md:col-span-1">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={!addTargetId.trim() || !addColumnName.trim()}
              onClick={() => {
                onChange(setTargetColumn(mapping, addTargetId, addColumnName))
                setAddTargetId("")
                setAddColumnName("")
              }}
            >
              <Plus className="h-4 w-4" />
              Add mapping
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Custom Fields</h3>
        <p className="mt-1 text-xs text-gray-600">
          Custom fields are stored on the template and can be mapped to a column by name.
        </p>

        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full table-auto">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Mapped Column Name</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customFields.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-600" colSpan={4}>
                    No custom fields defined.
                  </td>
                </tr>
              ) : (
                customFields.map(field => (
                  <tr key={field.customKey} className="text-sm text-gray-900">
                    <td className="px-4 py-3">
                      <div className="font-medium">{field.label}</div>
                      <div className="mt-0.5 text-xs text-gray-500">{field.customKey}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{field.section}</td>
                    <td className="px-4 py-3">
                      <input
                        className={inputClass}
                        value={field.columnName}
                        onChange={event => onChange(setCustomKeyColumn(mapping, field.customKey, event.target.value))}
                        placeholder="e.g. Service Month"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          onClick={() => {
                            const next = cloneMapping(mapping)
                            delete next.customFields[field.customKey]
                            for (const [columnName, config] of Object.entries(next.columns ?? {})) {
                              if (config.mode === "custom" && config.customKey === field.customKey) {
                                delete next.columns[columnName]
                              }
                            }
                            onChange(next)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-gray-700">New custom label</label>
            <input
              className={inputClass}
              value={newCustomLabel}
              onChange={event => setNewCustomLabel(event.target.value)}
              placeholder="e.g. Service Month"
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-gray-700">Section</label>
            <select
              className={inputClass}
              value={newCustomSection}
              onChange={event => setNewCustomSection(event.target.value === "product" ? "product" : "additional")}
            >
              <option value="additional">additional</option>
              <option value="product">product</option>
            </select>
          </div>
          <div className="flex items-end md:col-span-1">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={!newCustomLabel.trim()}
              onClick={() => {
                const next = cloneMapping(mapping)
                const taken = new Set(Object.keys(next.customFields ?? {}))
                const base = `cf_${newCustomLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field"}`
                const key = uniqueKey(base, taken)
                next.customFields[key] = { label: newCustomLabel.trim(), section: newCustomSection }
                onChange(next)
                setNewCustomLabel("")
                setNewCustomSection("additional")
              }}
            >
              <Plus className="h-4 w-4" />
              Add custom field
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

