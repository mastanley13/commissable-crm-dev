'use client'

import React from 'react'
import { ChevronDown, Check } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

interface StatusFilterDropdownProps {
  value: 'all' | 'open' | 'reconciled' | 'in_dispute'
  onChange: (value: 'all' | 'open' | 'reconciled' | 'in_dispute') => void
}

const statusOptions = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'reconciled', label: 'Reconciled' },
  { id: 'in_dispute', label: 'In Dispute' },
] as const

export function StatusFilterDropdown({ value, onChange }: StatusFilterDropdownProps) {
  const selectedOption = statusOptions.find(opt => opt.id === value)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="inline-flex w-[130px] items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          aria-label="Filter by status"
        >
          <span>{selectedOption?.label || 'All'}</span>
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
