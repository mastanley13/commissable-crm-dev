"use client"

import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type DropdownChevronProps = {
  open?: boolean
  className?: string
}

export function DropdownChevron({ open, className }: DropdownChevronProps) {
  return (
    <ChevronDown
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform",
        open ? "rotate-180" : null,
        className
      )}
    />
  )
}

