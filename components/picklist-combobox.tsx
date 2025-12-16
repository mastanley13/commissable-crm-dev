"use client"

import { useEffect, useMemo, useState } from "react"

export interface PicklistComboboxProps {
  value: string
  options: string[]
  placeholder?: string
  disabled?: boolean
  inputClassName?: string
  dropdownClassName?: string
  optionClassName?: string
  emptyText?: string
  onBlur?: () => void
  onChange: (nextValue: string) => void
}

function findExactOption(options: string[], query: string): string | null {
  const q = query.trim()
  if (!q) return ""
  const lower = q.toLowerCase()
  const match = options.find((opt) => opt.toLowerCase() === lower)
  return match ?? null
}

export function PicklistCombobox({
  value,
  options,
  placeholder = "Select",
  disabled,
  inputClassName,
  dropdownClassName,
  optionClassName,
  emptyText = "No matches. Keep typing to search.",
  onBlur,
  onChange,
}: PicklistComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)

  useEffect(() => {
    if (!open) {
      setQuery(value)
    }
  }, [value, open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.toLowerCase().includes(q))
  }, [options, query])

  const commitValue = (next: string) => {
    onChange(next)
    onBlur?.()
    setQuery(next)
    setOpen(false)
  }

  const resolveBlur = () => {
    const exact = findExactOption(options, query)
    if (exact === "") {
      commitValue("")
      return
    }
    if (exact) {
      commitValue(exact)
      return
    }
    setQuery(value)
    setOpen(false)
    onBlur?.()
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(resolveBlur, 200)}
        placeholder={placeholder}
        className={inputClassName}
        disabled={Boolean(disabled)}
        aria-autocomplete="list"
      />
      {open && !disabled ? (
        <div className={dropdownClassName}>
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitValue(opt)}
                className={optionClassName}
              >
                <div className="font-medium text-gray-900">{opt}</div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">{emptyText}</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
