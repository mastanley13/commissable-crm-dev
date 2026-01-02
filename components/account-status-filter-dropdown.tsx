"use client"

import { useMemo } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown } from "lucide-react"

interface AccountStatusFilterDropdownProps {
  value: "active" | "inactive" | "all"
  options?: Array<"active" | "inactive" | "all">
  onChange: (value: "active" | "inactive" | "all") => void
  labels?: {
    active?: string
    inactive?: string
    all?: string
  }
}

const defaultStatusOptions = ["active", "inactive"] as const

export function AccountStatusFilterDropdown({
  value,
  options,
  onChange,
  labels,
}: AccountStatusFilterDropdownProps) {
  const statusOptions = useMemo(() => {
    const configured = Array.isArray(options) && options.length > 0 ? options : [...defaultStatusOptions]

    return configured.map((option) => {
      if (option === "active") {
        return { id: option, label: labels?.active ?? "Active" }
      }

      if (option === "all") {
        return { id: option, label: labels?.all ?? "All" }
      }

      const isThreeState = configured.includes("all")
      const fallback = isThreeState ? "Inactive" : "Show Inactive"
      return { id: option, label: labels?.inactive ?? fallback }
    })
  }, [labels, options])

  const selectedOption = statusOptions.find((opt) => opt.id === value)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="inline-flex w-[150px] items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          aria-label="Filter by account status"
        >
          <span>{selectedOption?.label || "Active"}</span>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[200px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
          sideOffset={5}
        >
          {statusOptions.map((option) => (
            <DropdownMenu.Item
              key={option.id}
              className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
              onSelect={() => onChange(option.id)}
            >
              <span>{option.label}</span>
              {value === option.id && (
                <Check className="h-4 w-4 text-primary-600" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
