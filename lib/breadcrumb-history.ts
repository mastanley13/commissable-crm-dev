"use client"

import type { BreadcrumbItem } from "@/components/breadcrumb"
import { navigation } from "@/lib/nav"

type HistoryItem = { name: string; href: string }

const STORAGE_KEY = "breadcrumb:history"
const MAX_ITEMS = 6

function read(): HistoryItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    const value = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? value.filter(validItem) : []
  } catch {
    return []
  }
}

function write(items: HistoryItem[]) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS)))
  } catch {
    // ignore storage errors
  }
}

function validItem(it: any): it is HistoryItem {
  return it && typeof it.href === "string" && typeof it.name === "string"
}

export function getBreadcrumbHistory(): HistoryItem[] {
  return read()
}

export function clearBreadcrumbHistory() {
  write([])
}

export function pushBreadcrumbHistory(item: HistoryItem) {
  if (!validItem(item)) return
  if (item.href === "/dashboard") return // don't store Home
  const items = read()
  const last = items[items.length - 1]
  if (last && last.href === item.href) return // no duplicate consecutive
  // Remove earlier duplicate of same href
  const filtered = items.filter((i) => i.href !== item.href)
  filtered.push(item)
  write(filtered)
}

export function pushIfModuleListPath(pathname: string) {
  // push only when we're on an exact module list route (e.g., "/products")
  const nav = navigation.find((n) => n.href === pathname)
  if (!nav) return
  if (nav.href === "/dashboard") return
  pushBreadcrumbHistory({ name: nav.name, href: nav.href })
}

export function mergeHistoryWithTrail(base: BreadcrumbItem[], pathname: string): BreadcrumbItem[] {
  // Ensure Home in front
  const home: BreadcrumbItem = { name: "Home", href: "/dashboard" }
  const history = getBreadcrumbHistory()

  // Strip Home from base if present
  const baseWithoutHome = base.filter((it) => it.href !== "/dashboard" && it.name !== "Home")

  // Convert history to BreadcrumbItem[] and drop duplicates that would repeat the first base segment
  const historyItems: BreadcrumbItem[] = history.map((it) => ({ name: it.name, href: it.href }))

  // Remove any history item that is the same as the base items (keep the base item with current flag)
  const baseHrefs = new Set(baseWithoutHome.map((b) => b.href))
  const filteredHistory = historyItems.filter((h) => !baseHrefs.has(h.href))

  // Compose: Home + history + base trail
  const composed = [home, ...filteredHistory, ...baseWithoutHome]

  // De-duplicate consecutive by href/name
  const deduped: BreadcrumbItem[] = []
  for (const item of composed) {
    const prev = deduped[deduped.length - 1]
    if (prev && ((prev.href && prev.href === item.href) || prev.name === item.name)) {
      continue
    }
    deduped.push(item)
  }

  // Ensure exactly the final item has current=true
  for (let i = 0; i < deduped.length; i++) {
    deduped[i].current = i === deduped.length - 1
  }

  return deduped
}

// Push the current page into history based on the computed breadcrumb items
export function pushFromBreadcrumbs(base: BreadcrumbItem[], pathname: string) {
  if (typeof window === "undefined") return
  if (!Array.isArray(base) || base.length === 0) return
  const last = base[base.length - 1]
  // Prefer the last item name; prefer href if present else current pathname
  const name = last?.name || pathname
  const href = last?.href || pathname
  if (!name || !href) return
  if (href === "/dashboard") return
  pushBreadcrumbHistory({ name, href })
}
