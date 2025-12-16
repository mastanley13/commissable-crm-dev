"use client"

import { useEffect, useMemo, useState } from "react"

export type SelectComboboxOption = { value: string; label: string }

export interface SelectComboboxProps {
  value: string
  options: SelectComboboxOption[]
  placeholder?: string
  disabled?: boolean
  inputClassName?: string
  dropdownClassName?: string
  optionClassName?: string
  emptyText?: string
  onBlur?: () => void
  onChange: (nextValue: string) => void
}

function findExactOption(options: SelectComboboxOption[], query: string): SelectComboboxOption | null {
  const q = query.trim()
  if (!q) return { value: "", label: "" }
  const lower = q.toLowerCase()
  const match = options.find((opt) => opt.label.toLowerCase() === lower)
  return match ?? null
}

export function SelectCombobox({
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
}: SelectComboboxProps) {
  const [open, setOpen] = useState(false)
  const selectedLabel = useMemo(
    () => options.find((opt) => opt.value === value)?.label ?? "",
    [options, value]
  )
  const [query, setQuery] = useState(selectedLabel)

  useEffect(() => {
    if (!open) {
      setQuery(selectedLabel)
    }
  }, [selectedLabel, open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    )
  }, [options, query])

  const commitValue = (nextValue: string) => {
    onChange(nextValue)
    onBlur?.()
    const nextLabel = options.find((opt) => opt.value === nextValue)?.label ?? ""
    setQuery(nextLabel)
    setOpen(false)
  }

  const resolveBlur = () => {
    const exact = findExactOption(options, query)
    if (exact && exact.value === "") {
      commitValue("")
      return
    }
    if (exact) {
      commitValue(exact.value)
      return
    }
    setQuery(selectedLabel)
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
                key={opt.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitValue(opt.value)}
                className={optionClassName}
              >
                <div className="font-medium text-gray-900">{opt.label}</div>
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

