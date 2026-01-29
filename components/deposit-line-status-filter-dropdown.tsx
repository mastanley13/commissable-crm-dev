"use client"

import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown } from "lucide-react"

type DepositLineStatusFilterValue = "suggested" | "unmatched" | "matched" | "reconciled" | "all"
type DropdownSize = "default" | "compact"

interface DepositLineStatusFilterDropdownProps {
  value: DepositLineStatusFilterValue
  onChange: (value: DepositLineStatusFilterValue) => void
  size?: DropdownSize
}

const statusOptions: Array<{ id: DepositLineStatusFilterValue; label: string }> = [
  { id: "unmatched", label: "Unmatched" },
  { id: "matched", label: "Matched" },
  { id: "reconciled", label: "Reconciled" },
  { id: "all", label: "All" }
]

export function DepositLineStatusFilterDropdown({
  value,
  onChange,
  size = "default"
}: DepositLineStatusFilterDropdownProps) {
  const selectedOption = statusOptions.find(option => option.id === value)
  const paddingClasses = size === "compact" ? "px-3 py-1" : "px-4 py-2"
  const minHeightClass = size === "compact" ? "h-9" : "h-10"

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={`inline-flex w-[150px] items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${paddingClasses} ${minHeightClass}`}
          aria-label="Filter deposit line items"
        >
          <span>{selectedOption?.label ?? "Unmatched"}</span>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[200px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
          sideOffset={5}
        >
          {statusOptions.map(option => (
            <DropdownMenu.Item
              key={option.id}
              className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100"
              onSelect={() => onChange(option.id)}
            >
              <span>{option.label}</span>
              {value === option.id && <Check className="h-4 w-4 text-primary-600" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export type { DepositLineStatusFilterValue }
