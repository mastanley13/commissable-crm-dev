'use client'

import { useCallback, useMemo, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { Edit, X } from 'lucide-react'

type ParseConfig = {
  supportQuotes: boolean
  maxItems: number
}

const DEFAULT_PARSE_CONFIG: ParseConfig = {
  supportQuotes: true,
  maxItems: 25
}

function parseMultiValueInput(raw: string, config: ParseConfig): { values: string[]; warnings: string[] } {
  const warnings: string[] = []

  const values: string[] = []
  let buffer = ''
  let inQuotes = false

  const input = raw ?? ''
  for (let index = 0; index < input.length; index++) {
    const character = input[index]

    if (config.supportQuotes && character === '"') {
      const next = input[index + 1]
      if (inQuotes && next === '"') {
        buffer += '"'
        index += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    const isSeparator = character === ',' || character === ';' || character === '\n' || character === '\r'
    if (!inQuotes && isSeparator) {
      values.push(buffer)
      buffer = ''
      continue
    }

    buffer += character
  }
  values.push(buffer)

  if (inQuotes) {
    warnings.push('Unclosed quote detected. Parsing continued anyway.')
  }

  const cleaned = values
    .map(value => value.trim())
    .map(value => value.replace(/\s+/g, ' '))
    .filter(value => value.length > 0)
    .filter(value => !/^null$/i.test(value) && !/^n\/a$/i.test(value) && !/^na$/i.test(value) && value !== '--')

  if (cleaned.length > config.maxItems) {
    warnings.push(`Trimmed to first ${config.maxItems} values.`)
  }

  return { values: cleaned.slice(0, Math.max(0, config.maxItems)), warnings }
}

function isInputInOpenQuote(raw: string) {
  let inQuotes = false
  for (let index = 0; index < raw.length; index++) {
    const character = raw[index]
    if (character !== '"') continue
    const next = raw[index + 1]
    if (inQuotes && next === '"') {
      index += 1
      continue
    }
    inQuotes = !inQuotes
  }
  return inQuotes
}

function mergeUniqueValues(existing: string[], additions: string[], maxItems: number) {
  const seen = new Set(existing.map(value => value.trim().toLowerCase()).filter(Boolean))
  const next = [...existing]

  for (const raw of additions) {
    if (next.length >= maxItems) break
    const cleaned = raw.trim().replace(/\s+/g, ' ')
    if (!cleaned) continue
    if (/^null$/i.test(cleaned) || /^n\/a$/i.test(cleaned) || /^na$/i.test(cleaned) || cleaned === '--') continue

    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(cleaned)
  }

  return next
}

function formatCommaSeparated(values: string[]) {
  return values.join(', ')
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
      <span className="pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function MultiValueTagInput({
  values,
  onChange,
  placeholder,
  helpText,
  parseConfig = DEFAULT_PARSE_CONFIG
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
  helpText?: string
  parseConfig?: ParseConfig
}) {
  const [input, setInput] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  const canAddMore = values.length < parseConfig.maxItems

  const commit = useCallback(
    (raw: string) => {
      const parsed = parseMultiValueInput(raw, parseConfig)
      setWarnings(parsed.warnings)
      if (!parsed.values.length) return

      onChange(mergeUniqueValues(values, parsed.values, parseConfig.maxItems))
      setInput('')
    },
    [onChange, parseConfig, values]
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      commit(input)
      return
    }

    if (event.key === ',') {
      if (parseConfig.supportQuotes && isInputInOpenQuote(input)) {
        return
      }
      event.preventDefault()
      commit(input)
      return
    }

    if (event.key === 'Backspace' && input.length === 0 && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  const handleBlur = () => {
    commit(input)
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text')
    if (!text) return
    event.preventDefault()
    commit(text)
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900 focus-within:border-primary-500">
        {values.map((value, index) => (
          <span key={`${value}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs">
            <span className="max-w-[240px] truncate font-medium text-blue-900" title={value}>{value}</span>
            <button
              type="button"
              className="ml-1 text-blue-600 hover:text-blue-800"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((_value, idx) => idx !== index))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {canAddMore ? (
          <input
            className="min-w-[180px] flex-1 bg-transparent pl-[3px] pr-0 py-1 text-xs text-gray-900 focus:outline-none"
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onPaste={handlePaste}
            placeholder={values.length === 0 ? placeholder : ''}
          />
        ) : (
          <span className="pl-[3px] text-[11px] text-gray-500">Max {parseConfig.maxItems} values reached</span>
        )}
      </div>

      {helpText ? (
        <div className="mt-1 text-[10px] text-gray-500">{helpText}</div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-1 space-y-1 text-[10px] text-amber-700">
          {warnings.map(warning => (
            <div key={warning} className="rounded border border-amber-200 bg-amber-50 px-2 py-1">
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-1 text-[10px] text-gray-500">
        Comma-separated:{' '}
        <span className="font-mono">{values.length ? formatCommaSeparated(values) : '--'}</span>
      </div>
    </div>
  )
}

export default function CommaSeparatedValuesPrototypePage() {
  const [stored, setStored] = useState(() => ({
    opportunityName: 'Edge Business - 394SMiledge - ACC - Cable',
    accountName: 'Edge Business - 394SMiledge',
    houseProductName: 'Cable Services',
    housePartNumber: 'CAB-001',
    otherAccountIds: ['ACCT-001', 'ACCT-002', 'ACCT003'],
    otherProductNames: ['Cable Services', 'Cable Services (Legacy Name)'],
    otherPartNumbers: ['PN-123', 'PN 124'],
    otherDescriptions: ['Sold a cable circuit', 'Provisioning - premium tier']
  }))

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(() => ({
    otherAccountIds: stored.otherAccountIds,
    otherProductNames: stored.otherProductNames,
    otherPartNumbers: stored.otherPartNumbers,
    otherDescriptions: stored.otherDescriptions
  }))

  const isDirty = useMemo(() => {
    const a = formatCommaSeparated(draft.otherAccountIds) !== formatCommaSeparated(stored.otherAccountIds)
    const b = formatCommaSeparated(draft.otherProductNames) !== formatCommaSeparated(stored.otherProductNames)
    const c = formatCommaSeparated(draft.otherPartNumbers) !== formatCommaSeparated(stored.otherPartNumbers)
    const d = formatCommaSeparated(draft.otherDescriptions) !== formatCommaSeparated(stored.otherDescriptions)
    return a || b || c || d
  }, [draft, stored])

  const startEdit = () => {
    setDraft({
      otherAccountIds: stored.otherAccountIds,
      otherProductNames: stored.otherProductNames,
      otherPartNumbers: stored.otherPartNumbers,
      otherDescriptions: stored.otherDescriptions
    })
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setDraft({
      otherAccountIds: stored.otherAccountIds,
      otherProductNames: stored.otherProductNames,
      otherPartNumbers: stored.otherPartNumbers,
      otherDescriptions: stored.otherDescriptions
    })
    setIsEditing(false)
  }

  const saveEdit = () => {
    setStored(previous => ({
      ...previous,
      otherAccountIds: draft.otherAccountIds,
      otherProductNames: draft.otherProductNames,
      otherPartNumbers: draft.otherPartNumbers,
      otherDescriptions: draft.otherDescriptions
    }))
    setIsEditing(false)
  }

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <div className="space-y-6">
        <header className="rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Prototype Playground</p>
          <h1 className="text-2xl font-bold text-gray-900">Comma-Separated Values (Detail Page Prototype)</h1>
          <p className="mt-1 text-sm text-gray-600">
            Detail-style prototype to test how multi-values look in fields and how users can add/remove values during an update.
          </p>
          <div className="mt-2 text-sm text-gray-500">
            Source plan:{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">docs/plans/other-fields-comma-separated-values-plan.md</code>
          </div>
        </header>

        <section className="rounded-lg border border-blue-100 bg-blue-50 px-6 py-4 text-sm text-blue-900 shadow-sm">
          <h2 className="text-base font-semibold text-blue-900">How to test</h2>
          <ol className="ml-5 mt-2 list-decimal space-y-1">
            <li>Review the table cell preview for how values render when joined by commas.</li>
            <li>Click Update in the detail header to enter edit mode.</li>
            <li>Add values by typing and pressing comma/Enter; remove values using the × on a chip.</li>
          </ol>
          <p className="mt-3 text-sm text-blue-900">
            Tip: use quotes to include commas inside a single value (example:{' '}
            <span className="font-mono">&quot;UCaaS, Seats&quot;</span>).
          </p>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Opportunity Products (table cell preview)</h2>
              <p className="mt-1 text-sm text-gray-600">
                Example row showing how multiple values would appear in the Products tab table.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Stored values: <span className="font-semibold text-gray-900">{stored.otherProductNames.length}</span>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full table-fixed text-xs">
              <thead className="bg-primary-600 text-white">
                <tr>
                  <th className="w-[220px] px-3 py-2 text-left font-semibold">House - Product Name</th>
                  <th className="w-[260px] px-3 py-2 text-left font-semibold">Other - Product Name</th>
                  <th className="w-[200px] px-3 py-2 text-left font-semibold">Other - Part Number</th>
                  <th className="px-3 py-2 text-left font-semibold">Other - Product Description</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr className="border-t border-gray-200">
                  <td className="px-3 py-2 text-gray-900">{stored.houseProductName}</td>
                  <td className="px-3 py-2 text-gray-900">
                    <div className="truncate" title={formatCommaSeparated(stored.otherProductNames)}>
                      {formatCommaSeparated(stored.otherProductNames) || '--'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    <div className="truncate" title={formatCommaSeparated(stored.otherPartNumbers)}>
                      {formatCommaSeparated(stored.otherPartNumbers) || '--'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    <div className="truncate" title={formatCommaSeparated(stored.otherDescriptions)}>
                      {formatCommaSeparated(stored.otherDescriptions) || '--'}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="rounded-t-2xl bg-gray-100 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">
                  Opportunity Product Detail (Prototype)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold text-gray-900">{stored.opportunityName}</h1>
                  {isEditing && isDirty ? (
                    <span className="text-xs font-semibold text-amber-600">Unsaved changes</span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={!isDirty}
                      className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Update</span>
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Update</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-1.5">
                <FieldRow label="Opportunity Name">
                  <div className="flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                    {stored.opportunityName}
                  </div>
                </FieldRow>
                <FieldRow label="Account Name">
                  <div className="flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                    {stored.accountName}
                  </div>
                </FieldRow>
                <FieldRow label="House - Product Name">
                  <div className="flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                    {stored.houseProductName}
                  </div>
                </FieldRow>
                <FieldRow label="House - Part Number">
                  <div className="flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                    {stored.housePartNumber}
                  </div>
                </FieldRow>
              </div>

              <div className="space-y-1.5">
                <FieldRow label="Other - Account ID">
                  {isEditing ? (
                    <MultiValueTagInput
                      values={draft.otherAccountIds}
                      onChange={(next) => setDraft(prev => ({ ...prev, otherAccountIds: next }))}
                      placeholder="Type an account ID and press comma"
                      helpText="Used for matching when account numbers change."
                    />
                  ) : (
                    <div
                      className="flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis"
                      title={formatCommaSeparated(stored.otherAccountIds)}
                    >
                      {formatCommaSeparated(stored.otherAccountIds) || <span className="text-gray-500">--</span>}
                    </div>
                  )}
                </FieldRow>

                <FieldRow label="Other - Product Name">
                  {isEditing ? (
                    <MultiValueTagInput
                      values={draft.otherProductNames}
                      onChange={(next) => setDraft(prev => ({ ...prev, otherProductNames: next }))}
                      placeholder="Type a product name and press comma"
                      helpText="Add product aliases used by different vendors/customers."
                    />
                  ) : (
                    <div
                      className="flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis"
                      title={formatCommaSeparated(stored.otherProductNames)}
                    >
                      {formatCommaSeparated(stored.otherProductNames) || <span className="text-gray-500">--</span>}
                    </div>
                  )}
                </FieldRow>

                <FieldRow label="Other - Part Number">
                  {isEditing ? (
                    <MultiValueTagInput
                      values={draft.otherPartNumbers}
                      onChange={(next) => setDraft(prev => ({ ...prev, otherPartNumbers: next }))}
                      placeholder="Type a part number and press comma"
                      helpText="Add part number variants (spacing, hyphens, legacy SKUs)."
                    />
                  ) : (
                    <div
                      className="flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis"
                      title={formatCommaSeparated(stored.otherPartNumbers)}
                    >
                      {formatCommaSeparated(stored.otherPartNumbers) || <span className="text-gray-500">--</span>}
                    </div>
                  )}
                </FieldRow>

                <FieldRow label="Other - Product Description">
                  {isEditing ? (
                    <MultiValueTagInput
                      values={draft.otherDescriptions}
                      onChange={(next) => setDraft(prev => ({ ...prev, otherDescriptions: next }))}
                      placeholder='Type a description and press Enter (quotes allow commas: "desc, with comma")'
                      helpText="Descriptions often contain commas; wrap in quotes to keep them together."
                    />
                  ) : (
                    <div
                      className="mt-1 w-full max-w-md border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900 whitespace-pre-wrap"
                      title={formatCommaSeparated(stored.otherDescriptions)}
                    >
                      {formatCommaSeparated(stored.otherDescriptions) || <span className="text-gray-500">--</span>}
                    </div>
                  )}
                </FieldRow>
              </div>
            </div>
          </div>
        </section>
      </div>
    </CopyProtectionWrapper>
  )
}

