"use client"

import { createContext, useContext, useMemo, useState } from "react"
import type { BreadcrumbItem } from "@/components/breadcrumb"

interface BreadcrumbContextValue {
  items: BreadcrumbItem[] | null
  setBreadcrumbs: (items: BreadcrumbItem[] | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | undefined>(undefined)

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[] | null>(null)

  const value = useMemo<BreadcrumbContextValue>(() => ({
    items,
    setBreadcrumbs: setItems
  }), [items])

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>
}

export function useBreadcrumbs() {
  const context = useContext(BreadcrumbContext)
  if (!context) {
    throw new Error('useBreadcrumbs must be used within a BreadcrumbProvider')
  }
  return context
}
