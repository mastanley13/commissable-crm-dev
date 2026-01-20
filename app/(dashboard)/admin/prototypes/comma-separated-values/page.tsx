'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { Copy, Edit, Star, X } from 'lucide-react'
import { useToasts } from '@/components/toast'

type ParseConfig = {
  supportQuotes: boolean
  maxItems: number
}

type DisplayMode = 'chips' | 'comma'

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

function sanitizeValueList(values: string[], maxItems: number) {
  return mergeUniqueValues([], values, maxItems)
}

function formatCommaSeparated(values: string[]) {
  return values.join(', ')
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers / restricted contexts
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
      <span className="pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function DisplayModeToggle({
  value,
  onChange
}: {
  value: DisplayMode
  onChange: (next: DisplayMode) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-semibold text-gray-700">Field display</span>
      <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => onChange('comma')}
          className={[
            'rounded px-2.5 py-1 text-xs font-semibold transition',
            value === 'comma' ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-50'
          ].join(' ')}
          aria-pressed={value === 'comma'}
        >
          Comma-separated
        </button>
        <button
          type="button"
          onClick={() => onChange('chips')}
          className={[
            'rounded px-2.5 py-1 text-xs font-semibold transition',
            value === 'chips' ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-50'
          ].join(' ')}
          aria-pressed={value === 'chips'}
        >
          Chips
        </button>
      </div>
    </div>
  )
}

type ToastApi = Pick<ReturnType<typeof useToasts>, 'showSuccess' | 'showError' | 'showInfo' | 'showWarning'>

function MultiValueTableCell({
  label,
  values,
  toasts
}: {
  label: string
  values: string[]
  toasts: ToastApi
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const commaSeparated = formatCommaSeparated(values)
  const hasCommaInside = values.some(value => value.includes(','))

  useEffect(() => {
    if (!open) return
    const handleOutside = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const handleCopy = async () => {
    const ok = await copyToClipboard(commaSeparated)
    if (ok) {
      toasts.showSuccess('Copied', `${label} copied as comma-separated text.`)
    } else {
      toasts.showError('Copy failed', 'Unable to access clipboard in this browser context.')
    }
  }

  if (!values.length) {
    return <span className="text-gray-500">--</span>
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen(previous => !previous)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate" title={commaSeparated}>
            {commaSeparated}
          </div>
        </div>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[340px] rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-3 py-2">
            <div>
              <div className="text-xs font-semibold text-gray-900">{label}</div>
              <div className="text-[10px] text-gray-500">{values.length} value{values.length === 1 ? '' : 's'}</div>
            </div>
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
              onClick={handleCopy}
            >
              <span className="inline-flex items-center gap-1">
                <Copy className="h-3 w-3" />
                Copy
              </span>
            </button>
          </div>

          {hasCommaInside ? (
            <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
              Some values contain commas, which can make comma-separated exports ambiguous. This is why a chip/list UI can be clearer.
            </div>
          ) : null}

          <ol className="max-h-56 overflow-auto px-3 py-2 text-xs text-gray-900">
            {values.map((value, index) => (
              <li key={`${value}-${index}`} className="flex gap-2 py-1">
                <span className="w-5 shrink-0 text-gray-400">{index === 0 ? 'P' : `${index + 1}.`}</span>
                <span className="break-words">{value}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}

function MultiValueReadOnly({
  label,
  values,
  toasts
}: {
  label: string
  values: string[]
  toasts: ToastApi
}) {
  const commaSeparated = formatCommaSeparated(values)
  const extraCount = Math.max(0, values.length - 1)

  const handleCopy = async () => {
    const ok = await copyToClipboard(commaSeparated)
    if (ok) {
      toasts.showSuccess('Copied', `${label} copied as comma-separated text.`)
    } else {
      toasts.showError('Copy failed', 'Unable to access clipboard in this browser context.')
    }
  }

  if (!values.length) {
    return <span className="text-gray-500">--</span>
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gray-300 py-1">
        <div className="flex flex-wrap gap-2">
          {values.slice(0, 6).map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs"
              title={value}
            >
              {index === 0 ? <Star className="h-3 w-3 text-blue-700" /> : null}
              <span className="max-w-[240px] truncate font-medium text-blue-900">{value}</span>
            </span>
          ))}
          {values.length > 6 ? (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
              +{values.length - 6} more
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
          onClick={handleCopy}
        >
          <span className="inline-flex items-center gap-1">
            <Copy className="h-3 w-3" />
            Copy
          </span>
        </button>
      </div>
      <div className="mt-1 text-[10px] text-gray-500">
        Primary{extraCount ? ` (+${extraCount})` : ''}:{' '}
        <span className="font-mono">{values[0] ?? '--'}</span>
      </div>
    </div>
  )
}

function MultiValueReadOnlyComma({
  label,
  values,
  toasts
}: {
  label: string
  values: string[]
  toasts: ToastApi
}) {
  const commaSeparated = formatCommaSeparated(values)

  const handleCopy = async () => {
    const ok = await copyToClipboard(commaSeparated)
    if (ok) {
      toasts.showSuccess('Copied', `${label} copied as comma-separated text.`)
    } else {
      toasts.showError('Copy failed', 'Unable to access clipboard in this browser context.')
    }
  }

  if (!values.length) {
    return <span className="text-gray-500">--</span>
  }

  return (
    <div className="flex min-h-[28px] w-full max-w-md items-center justify-between gap-3 border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900">
      <div className="min-w-0 flex-1 truncate" title={commaSeparated}>
        {commaSeparated}
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
        onClick={handleCopy}
      >
        <span className="inline-flex items-center gap-1">
          <Copy className="h-3 w-3" />
          Copy
        </span>
      </button>
    </div>
  )
}

function MultiValueReadOnlyList({
  label,
  values,
  toasts
}: {
  label: string
  values: string[]
  toasts: ToastApi
}) {
  const handleCopyCsv = async () => {
    const ok = await copyToClipboard(formatCommaSeparated(values))
    if (ok) {
      toasts.showSuccess('Copied', `${label} copied as comma-separated text.`)
    } else {
      toasts.showError('Copy failed', 'Unable to access clipboard in this browser context.')
    }
  }

  const handleCopyLines = async () => {
    const ok = await copyToClipboard(values.join('\n'))
    if (ok) {
      toasts.showSuccess('Copied', `${label} copied as newline-separated text.`)
    } else {
      toasts.showError('Copy failed', 'Unable to access clipboard in this browser context.')
    }
  }

  if (!values.length) {
    return <span className="text-gray-500">--</span>
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
          onClick={handleCopyLines}
        >
          <span className="inline-flex items-center gap-1">
            <Copy className="h-3 w-3" />
            Copy lines
          </span>
        </button>
        <button
          type="button"
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
          onClick={handleCopyCsv}
        >
          <span className="inline-flex items-center gap-1">
            <Copy className="h-3 w-3" />
            Copy CSV
          </span>
        </button>
      </div>
      <ul className="mt-2 space-y-1 border-b-2 border-gray-300 pb-2 text-xs text-gray-900">
        {values.map((value, index) => (
          <li key={`${value}-${index}`} className="flex gap-2">
            <span className="w-4 shrink-0 text-gray-400">{index === 0 ? 'P' : '-'}</span>
            <span className="break-words">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MultiValueTextareaListEditor({
  label,
  values,
  onChange,
  toasts,
  parseConfig = DEFAULT_PARSE_CONFIG
}: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  toasts: ToastApi
  parseConfig?: ParseConfig
}) {
  const [paste, setPaste] = useState('')

  const setPrimary = (index: number) => {
    if (index <= 0) return
    const value = values[index]
    const next = [value, ...values.filter((_value, idx) => idx !== index)]
    onChange(next)
    toasts.showInfo('Primary updated', `Set primary ${label} to: ${value}`)
  }

  const updateAt = (index: number, nextValue: string) => {
    const next = values.map((value, idx) => (idx === index ? nextValue : value))
    onChange(next)
  }

  const removeAt = (index: number) => {
    onChange(values.filter((_value, idx) => idx !== index))
  }

  const addEmpty = () => {
    if (values.length >= parseConfig.maxItems) {
      toasts.showWarning('Max values reached', `${label} is limited to ${parseConfig.maxItems} values.`)
      return
    }
    onChange([...values, ''])
  }

  const addFromPaste = () => {
    const parsed = parseMultiValueInput(paste, parseConfig)
    if (parsed.warnings.length) {
      toasts.showWarning('Input warning', parsed.warnings.join('\n'))
    }
    if (!parsed.values.length) {
      toasts.showInfo('Nothing to add', 'No values were detected in the pasted text.')
      return
    }

    const before = values
    const next = mergeUniqueValues(before, parsed.values, parseConfig.maxItems)
    const added = next.length - before.length
    onChange(next)
    setPaste('')

    if (added === 0) {
      toasts.showInfo('No new values', 'Duplicates/empty values were ignored.')
    } else if (added < parsed.values.length) {
      toasts.showInfo('Some values skipped', 'Duplicates were ignored and/or the max value limit was reached.')
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="space-y-2 border-b-2 border-gray-300 pb-2">
        {values.length === 0 ? (
          <div className="text-xs text-gray-500">--</div>
        ) : (
          values.map((value, index) => (
            <div key={`${value}-${index}`} className="flex items-start gap-2">
              <div className="mt-2 w-4 shrink-0 text-gray-400">{index === 0 ? 'P' : '-'}</div>
              <textarea
                rows={2}
                className="flex-1 resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-primary-500 focus:outline-none"
                value={value}
                onChange={event => updateAt(index, event.target.value)}
                placeholder={index === 0 ? 'Primary description' : 'Alternate description'}
              />
              <div className="mt-2 flex shrink-0 items-center gap-1">
                {index > 0 ? (
                  <button
                    type="button"
                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                    onClick={() => setPrimary(index)}
                    title="Make primary"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Primary
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={() => removeAt(index)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
          onClick={addEmpty}
        >
          + Add description
        </button>
        <div className="text-[10px] text-gray-500">
          {values.length}/{parseConfig.maxItems} values
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="text-[11px] font-semibold text-gray-700">Paste multiple</div>
        <div className="mt-1 text-[10px] text-gray-500">
          Paste comma/semicolon/newline-separated values. Use quotes to keep commas inside a single value (example:{' '}
          <span className="font-mono">&quot;desc, with comma&quot;</span>).
        </div>
        <textarea
          rows={2}
          className="mt-2 w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-primary-500 focus:outline-none"
          value={paste}
          onChange={event => setPaste(event.target.value)}
          placeholder="Paste here"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="rounded-md bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-700"
            onClick={addFromPaste}
            disabled={paste.trim().length === 0}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function MultiValueCommaInput({
  label,
  values,
  onChange,
  placeholder,
  helpText,
  toasts,
  multiline = false,
  parseConfig = DEFAULT_PARSE_CONFIG
}: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
  helpText?: string
  toasts: ToastApi
  multiline?: boolean
  parseConfig?: ParseConfig
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [raw, setRaw] = useState(() => formatCommaSeparated(values))
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setRaw(formatCommaSeparated(values))
  }, [values])

  const parseAndApply = useCallback(
    (nextRaw: string, { toast }: { toast: boolean }) => {
      const parsed = parseMultiValueInput(nextRaw, parseConfig)
      const sanitized = sanitizeValueList(parsed.values, parseConfig.maxItems)
      setWarnings(parsed.warnings)
      onChange(sanitized)

      if (toast && parsed.warnings.length) {
        toasts.showWarning('Input warning', parsed.warnings.join('\n'))
      }

      return sanitized
    },
    [onChange, parseConfig, toasts]
  )

  const parsedCount = values.length

  return (
    <div className="w-full max-w-md">
      <div className="flex items-start gap-2 border-b-2 border-gray-300 py-1 focus-within:border-primary-500">
        {multiline ? (
          <textarea
            ref={element => {
              inputRef.current = element
            }}
            rows={3}
            className="min-h-[28px] w-full flex-1 resize-y bg-transparent px-0 text-xs text-gray-900 focus:outline-none"
            value={raw}
            onChange={event => {
              const nextRaw = event.target.value
              setRaw(nextRaw)
              parseAndApply(nextRaw, { toast: false })
            }}
            onBlur={() => {
              const sanitized = parseAndApply(raw, { toast: true })
              setRaw(formatCommaSeparated(sanitized))
            }}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={element => {
              inputRef.current = element
            }}
            className="min-h-[28px] w-full flex-1 bg-transparent px-0 text-xs text-gray-900 focus:outline-none"
            value={raw}
            onChange={event => {
              const nextRaw = event.target.value
              setRaw(nextRaw)
              parseAndApply(nextRaw, { toast: false })
            }}
            onBlur={() => {
              const sanitized = parseAndApply(raw, { toast: true })
              setRaw(formatCommaSeparated(sanitized))
            }}
            placeholder={placeholder}
          />
        )}

        <button
          type="button"
          className="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
          onClick={async () => {
            const ok = await copyToClipboard(raw)
            if (ok) {
              toasts.showSuccess('Copied', `${label} copied.`)
            } else {
              toasts.showError('Copy failed', 'Unable to access clipboard in this browser context.')
            }
          }}
        >
          <span className="inline-flex items-center gap-1">
            <Copy className="h-3 w-3" />
            Copy
          </span>
        </button>
      </div>

      {helpText ? <div className="mt-1 text-[10px] text-gray-500">{helpText}</div> : null}

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
        Parsed: <span className="font-semibold text-gray-700">{parsedCount}</span> value{parsedCount === 1 ? '' : 's'}
      </div>
    </div>
  )
}

function MultiValueTagInput({
  label,
  values,
  onChange,
  placeholder,
  helpText,
  toasts,
  parseConfig = DEFAULT_PARSE_CONFIG
}: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
  helpText?: string
  toasts: ToastApi
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

      const next = mergeUniqueValues(values, parsed.values, parseConfig.maxItems)
      const added = next.length - values.length
      const maxed = next.length >= parseConfig.maxItems

      onChange(next)
      setInput('')

      if (parsed.warnings.length) {
        toasts.showWarning('Input warning', parsed.warnings.join('\n'))
      }

      if (added === 0) {
        if (!canAddMore || maxed) {
          toasts.showWarning('Max values reached', `${label} is limited to ${parseConfig.maxItems} values.`)
        } else {
          toasts.showInfo('No new values', 'Duplicates/empty values were ignored.')
        }
        return
      }

      if (added < parsed.values.length || maxed) {
        toasts.showInfo('Some values skipped', 'Duplicates were ignored and/or the max value limit was reached.')
      }
    },
    [canAddMore, label, onChange, parseConfig, toasts, values]
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
            <span className="max-w-[220px] truncate font-medium text-blue-900" title={value}>{value}</span>
            {index === 0 ? (
              <span className="ml-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                Primary
              </span>
            ) : (
              <button
                type="button"
                className="ml-0.5 text-blue-700 hover:text-blue-900"
                aria-label={`Make ${value} primary`}
                title="Make primary"
                onClick={() => {
                  const next = [value, ...values.filter((_value, idx) => idx !== index)]
                  onChange(next)
                  toasts.showInfo('Primary updated', `Set primary ${label} to: ${value}`)
                }}
              >
                <Star className="h-3 w-3" />
              </button>
            )}
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
  const { showSuccess, showError, showInfo, showWarning, ToastContainer } = useToasts()
  const toastApi: ToastApi = useMemo(() => ({ showSuccess, showError, showInfo, showWarning }), [
    showError,
    showInfo,
    showSuccess,
    showWarning
  ])

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
  const [displayMode, setDisplayMode] = useState<DisplayMode>('comma')
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
    const maxItems = DEFAULT_PARSE_CONFIG.maxItems
    const nextAccountIds = sanitizeValueList(draft.otherAccountIds, maxItems)
    const nextProductNames = sanitizeValueList(draft.otherProductNames, maxItems)
    const nextPartNumbers = sanitizeValueList(draft.otherPartNumbers, maxItems)
    const nextDescriptions = sanitizeValueList(draft.otherDescriptions, maxItems)

    setStored(previous => ({
      ...previous,
      otherAccountIds: nextAccountIds,
      otherProductNames: nextProductNames,
      otherPartNumbers: nextPartNumbers,
      otherDescriptions: nextDescriptions
    }))
    setDraft({
      otherAccountIds: nextAccountIds,
      otherProductNames: nextProductNames,
      otherPartNumbers: nextPartNumbers,
      otherDescriptions: nextDescriptions
    })
    setIsEditing(false)
    toastApi.showSuccess('Updated', 'Prototype values saved.')
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
            <li>Add values by typing and pressing comma/Enter; remove values using the x on a chip.</li>
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
                    <MultiValueTableCell label="Other - Product Name" values={stored.otherProductNames} toasts={toastApi} />
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    <MultiValueTableCell label="Other - Part Number" values={stored.otherPartNumbers} toasts={toastApi} />
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    <MultiValueTableCell
                      label="Other - Product Description"
                      values={stored.otherDescriptions}
                      toasts={toastApi}
                    />
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

            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <DisplayModeToggle value={displayMode} onChange={setDisplayMode} />
              <div className="text-xs text-gray-500">Table cells always show comma-separated.</div>
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
                    displayMode === 'comma' ? (
                      <MultiValueCommaInput
                        label="Other - Account ID"
                        values={draft.otherAccountIds}
                        onChange={next => setDraft(prev => ({ ...prev, otherAccountIds: next }))}
                        placeholder="ACCT-001, ACCT-002"
                        helpText="Used for matching when account numbers change."
                        toasts={toastApi}
                      />
                    ) : (
                      <MultiValueTagInput
                        label="Other - Account ID"
                        values={draft.otherAccountIds}
                        onChange={next => setDraft(prev => ({ ...prev, otherAccountIds: next }))}
                        placeholder="Type an account ID and press comma"
                        helpText="Used for matching when account numbers change."
                        toasts={toastApi}
                      />
                    )
                  ) : (
                    displayMode === 'comma' ? (
                      <MultiValueReadOnlyComma
                        label="Other - Account ID"
                        values={stored.otherAccountIds}
                        toasts={toastApi}
                      />
                    ) : (
                      <MultiValueReadOnly label="Other - Account ID" values={stored.otherAccountIds} toasts={toastApi} />
                    )
                  )}
                </FieldRow>

                <FieldRow label="Other - Product Name">
                  {isEditing ? (
                    displayMode === 'comma' ? (
                      <MultiValueCommaInput
                        label="Other - Product Name"
                        values={draft.otherProductNames}
                        onChange={next => setDraft(prev => ({ ...prev, otherProductNames: next }))}
                        placeholder="Cable Services, Cable Services (Legacy Name)"
                        helpText="Add product aliases used by different vendors/customers."
                        toasts={toastApi}
                      />
                    ) : (
                      <MultiValueTagInput
                        label="Other - Product Name"
                        values={draft.otherProductNames}
                        onChange={next => setDraft(prev => ({ ...prev, otherProductNames: next }))}
                        placeholder="Type a product name and press comma"
                        helpText="Add product aliases used by different vendors/customers."
                        toasts={toastApi}
                      />
                    )
                  ) : (
                    displayMode === 'comma' ? (
                      <MultiValueReadOnlyComma
                        label="Other - Product Name"
                        values={stored.otherProductNames}
                        toasts={toastApi}
                      />
                    ) : (
                      <MultiValueReadOnly label="Other - Product Name" values={stored.otherProductNames} toasts={toastApi} />
                    )
                  )}
                </FieldRow>

                <FieldRow label="Other - Part Number">
                  {isEditing ? (
                    displayMode === 'comma' ? (
                      <MultiValueCommaInput
                        label="Other - Part Number"
                        values={draft.otherPartNumbers}
                        onChange={next => setDraft(prev => ({ ...prev, otherPartNumbers: next }))}
                        placeholder="PN-123, PN 124"
                        helpText="Add part number variants (spacing, hyphens, legacy SKUs)."
                        toasts={toastApi}
                      />
                    ) : (
                      <MultiValueTagInput
                        label="Other - Part Number"
                        values={draft.otherPartNumbers}
                        onChange={next => setDraft(prev => ({ ...prev, otherPartNumbers: next }))}
                        placeholder="Type a part number and press comma"
                        helpText="Add part number variants (spacing, hyphens, legacy SKUs)."
                        toasts={toastApi}
                      />
                    )
                  ) : (
                    displayMode === 'comma' ? (
                      <MultiValueReadOnlyComma
                        label="Other - Part Number"
                        values={stored.otherPartNumbers}
                        toasts={toastApi}
                      />
                    ) : (
                      <MultiValueReadOnly label="Other - Part Number" values={stored.otherPartNumbers} toasts={toastApi} />
                    )
                  )}
                </FieldRow>

                <FieldRow label="Other - Product Description">
                  {isEditing ? (
                    displayMode === 'comma' ? (
                      <MultiValueCommaInput
                        label="Other - Product Description"
                        values={draft.otherDescriptions}
                        onChange={next => setDraft(prev => ({ ...prev, otherDescriptions: next }))}
                        placeholder="Sold a cable circuit, Provisioning - premium tier"
                        helpText="Comma-separated descriptions. Use quotes for commas inside a single value."
                        toasts={toastApi}
                        multiline
                      />
                    ) : (
                      <MultiValueTextareaListEditor
                        label="Other - Product Description"
                        values={draft.otherDescriptions}
                        onChange={next => setDraft(prev => ({ ...prev, otherDescriptions: next }))}
                        toasts={toastApi}
                      />
                    )
                  ) : (
                    displayMode === 'comma' ? (
                      <MultiValueReadOnlyComma
                        label="Other - Product Description"
                        values={stored.otherDescriptions}
                        toasts={toastApi}
                      />
                    ) : (
                      <MultiValueReadOnlyList
                        label="Other - Product Description"
                        values={stored.otherDescriptions}
                        toasts={toastApi}
                      />
                    )
                  )}
                </FieldRow>
              </div>
            </div>
          </div>
        </section>
      </div>
      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
