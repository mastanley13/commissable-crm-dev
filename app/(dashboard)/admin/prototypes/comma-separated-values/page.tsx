'use client'

import { useMemo, useState } from 'react'
import { CopyProtectionWrapper } from '@/components/copy-protection'

type SeparatorKey = 'comma' | 'semicolon' | 'newline'

type ParseConfig = {
  separators: Record<SeparatorKey, boolean>
  trimValues: boolean
  dedupeValues: boolean
  supportQuotes: boolean
  maxItems: number
}

const defaultConfig: ParseConfig = {
  separators: {
    comma: true,
    semicolon: false,
    newline: false
  },
  trimValues: true,
  dedupeValues: true,
  supportQuotes: true,
  maxItems: 25
}

function parseMultiValueInput(raw: string, config: ParseConfig): { values: string[]; warnings: string[] } {
  const warnings: string[] = []
  const separators = new Set<string>()
  if (config.separators.comma) separators.add(',')
  if (config.separators.semicolon) separators.add(';')
  if (config.separators.newline) {
    separators.add('\n')
    separators.add('\r')
  }

  if (!separators.size) {
    return { values: config.trimValues ? [raw.trim()].filter(Boolean) : [raw].filter(Boolean), warnings }
  }

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

    if (!inQuotes && separators.has(character)) {
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
    .map(value => (config.trimValues ? value.trim() : value))
    .map(value => value.replace(/\s+/g, ' '))
    .filter(value => value.length > 0)
    .filter(value => !/^null$/i.test(value) && !/^n\/a$/i.test(value) && !/^na$/i.test(value) && value !== '--')

  const limited = cleaned.slice(0, Math.max(0, config.maxItems))
  if (cleaned.length > limited.length) {
    warnings.push(`Trimmed to first ${config.maxItems} values.`)
  }

  if (!config.dedupeValues) {
    return { values: limited, warnings }
  }

  const seen = new Set<string>()
  const deduped: string[] = []
  for (const value of limited) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(value)
  }

  return { values: deduped, warnings }
}

function normalizeIdentifier(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function normalizeLooseText(value: string) {
  return value
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function MatchPreview({
  storedValues,
  normalizer,
  label
}: {
  storedValues: string[]
  normalizer: (value: string) => string
  label: string
}) {
  const [probe, setProbe] = useState('')
  const probeNormalized = useMemo(() => (probe.trim().length ? normalizer(probe) : ''), [probe, normalizer])
  const storedNormalized = useMemo(() => storedValues.map(normalizer).filter(Boolean), [storedValues, normalizer])

  const matches = probeNormalized.length > 0 && storedNormalized.includes(probeNormalized)

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Match test</div>
      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Incoming {label}
          </label>
          <input
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            value={probe}
            onChange={event => setProbe(event.target.value)}
            placeholder="Type a single value to test matching"
          />
          <div className="mt-1 text-xs text-gray-500">
            Normalized: <span className="font-mono">{probeNormalized || '--'}</span>
          </div>
        </div>
        <div className="flex items-end">
          <div
            className={`w-full rounded-md border px-3 py-2 text-sm font-semibold ${
              matches ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            {probeNormalized.length === 0 ? 'Enter a value' : matches ? 'Match found' : 'No match'}
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldCard({
  title,
  description,
  raw,
  onRawChange,
  config,
  normalizer,
  inputMode = 'text'
}: {
  title: string
  description: string
  raw: string
  onRawChange: (next: string) => void
  config: ParseConfig
  normalizer: (value: string) => string
  inputMode?: 'text' | 'textarea'
}) {
  const parsed = useMemo(() => parseMultiValueInput(raw, config), [raw, config])
  const normalized = useMemo(() => parsed.values.map(normalizer).filter(Boolean), [parsed.values, normalizer])

  const primary = parsed.values[0] ?? ''
  const primaryNormalized = primary ? normalizer(primary) : ''

  return (
    <section className="rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <div className="text-xs text-gray-500">
          Values: <span className="font-semibold text-gray-900">{parsed.values.length}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Input (comma-separated)
          </label>
          {inputMode === 'textarea' ? (
            <textarea
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm leading-5 focus:border-primary-500 focus:outline-none"
              value={raw}
              onChange={event => onRawChange(event.target.value)}
              placeholder='Example: "Value with, comma", Value 2, Value 3'
            />
          ) : (
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              value={raw}
              onChange={event => onRawChange(event.target.value)}
              placeholder='Example: Value 1, Value 2, Value 3'
            />
          )}

          {parsed.warnings.length > 0 && (
            <div className="mt-2 space-y-1 text-xs text-amber-700">
              {parsed.warnings.map(warning => (
                <div key={warning} className="rounded border border-amber-200 bg-amber-50 px-2 py-1">
                  {warning}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview (would store)</div>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Primary:</span>{' '}
                <span className="font-mono text-gray-900">{primary || '--'}</span>
              </div>
              <div>
                <span className="text-gray-600">Primary normalized:</span>{' '}
                <span className="font-mono text-gray-900">{primaryNormalized || '--'}</span>
              </div>
              <div className="rounded bg-white p-2 font-mono text-xs text-gray-900">
                {JSON.stringify(
                  {
                    values: parsed.values,
                    normalized
                  },
                  null,
                  2
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Parsed values</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {parsed.values.length === 0 ? (
                <span className="text-sm text-gray-500">--</span>
              ) : (
                parsed.values.map((value, index) => (
                  <span
                    key={`${value}-${index}`}
                    className="inline-flex max-w-full items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
                    title={value}
                  >
                    <span className="truncate">{value}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Normalized (for matching)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {normalized.length === 0 ? (
                <span className="text-sm text-gray-500">--</span>
              ) : (
                normalized.map((value, index) => (
                  <span
                    key={`${value}-${index}`}
                    className="inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                    title={value}
                  >
                    <span className="truncate font-mono">{value}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          <MatchPreview storedValues={parsed.values} normalizer={normalizer} label={title} />
        </div>
      </div>
    </section>
  )
}

export default function CommaSeparatedValuesPrototypePage() {
  const [config, setConfig] = useState<ParseConfig>(defaultConfig)

  const [accountIdOther, setAccountIdOther] = useState('ACCT-001, acct 002, ACCT003')
  const [productNameOther, setProductNameOther] = useState('Fiber DIA 1GB, Fiber DIA 1Gbps, "UCaaS, Seats"')
  const [partNumberOther, setPartNumberOther] = useState('PN-123, pn123, PN 124')
  const [descriptionOther, setDescriptionOther] = useState(
    '"Dedicated high-speed ethernet access, premium tier", Dedicated high speed Ethernet access'
  )

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <div className="space-y-6">
        <header className="rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Prototype Playground</p>
          <h1 className="text-2xl font-bold text-gray-900">Comma-Separated Values (Other Fields)</h1>
          <p className="mt-1 text-sm text-gray-600">
            Prototype to validate the user experience for entering multiple comma-separated values and previewing how
            they would be parsed and normalized for matching.
          </p>
          <div className="mt-2 text-sm text-gray-500">
            Source plan:{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">docs/plans/other-fields-comma-separated-values-plan.md</code>
          </div>
        </header>

        <section className="rounded-lg border border-blue-100 bg-blue-50 px-6 py-4 text-sm text-blue-900 shadow-sm">
          <h2 className="text-base font-semibold text-blue-900">How to test</h2>
          <ol className="ml-5 mt-2 list-decimal space-y-1">
            <li>Type multiple values separated by commas (try spaces, mixed casing, or duplicates).</li>
            <li>Optionally wrap values in quotes if they contain commas (example: &quot;UCaaS, Seats&quot;).</li>
            <li>Review the parsed list, normalized list, and the simple match tester for each field.</li>
          </ol>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Parsing options</h2>
              <p className="mt-1 text-sm text-gray-600">
                These are prototype controls to explore tradeoffs; they do not affect production behavior.
              </p>
            </div>
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => setConfig(defaultConfig)}
            >
              Reset options
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={config.separators.comma}
                onChange={event =>
                  setConfig(previous => ({
                    ...previous,
                    separators: { ...previous.separators, comma: event.target.checked }
                  }))
                }
              />
              Split on commas
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={config.separators.semicolon}
                onChange={event =>
                  setConfig(previous => ({
                    ...previous,
                    separators: { ...previous.separators, semicolon: event.target.checked }
                  }))
                }
              />
              Split on semicolons
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={config.separators.newline}
                onChange={event =>
                  setConfig(previous => ({
                    ...previous,
                    separators: { ...previous.separators, newline: event.target.checked }
                  }))
                }
              />
              Split on newlines
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={config.supportQuotes}
                onChange={event => setConfig(previous => ({ ...previous, supportQuotes: event.target.checked }))}
              />
              Support quotes
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={config.trimValues}
                onChange={event => setConfig(previous => ({ ...previous, trimValues: event.target.checked }))}
              />
              Trim whitespace
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={config.dedupeValues}
                onChange={event => setConfig(previous => ({ ...previous, dedupeValues: event.target.checked }))}
              />
              De-dupe values
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <span className="whitespace-nowrap">Max items</span>
              <input
                type="number"
                className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                min={1}
                max={100}
                value={config.maxItems}
                onChange={event => setConfig(previous => ({ ...previous, maxItems: Number(event.target.value || 1) }))}
              />
            </label>
          </div>
        </section>

        <FieldCard
          title="Other - Account ID"
          description="Example field for storing multiple account identifiers (helpful when vendors change account numbers)."
          raw={accountIdOther}
          onRawChange={setAccountIdOther}
          config={config}
          normalizer={normalizeIdentifier}
        />

        <FieldCard
          title="Other - Product Name"
          description="Example field for storing multiple product names/aliases."
          raw={productNameOther}
          onRawChange={setProductNameOther}
          config={config}
          normalizer={normalizeLooseText}
        />

        <FieldCard
          title="Other - Part Number"
          description="Example field for storing multiple part numbers/SKUs."
          raw={partNumberOther}
          onRawChange={setPartNumberOther}
          config={config}
          normalizer={normalizeIdentifier}
        />

        <FieldCard
          title="Other - Product Description"
          description="Example field for storing multiple descriptions/aliases. Quotes allow commas inside a single value."
          raw={descriptionOther}
          onRawChange={setDescriptionOther}
          config={config}
          normalizer={normalizeLooseText}
          inputMode="textarea"
        />
      </div>
    </CopyProtectionWrapper>
  )
}
