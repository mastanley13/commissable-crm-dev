"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { GripHorizontal, X } from "lucide-react"

import type { DepositLineItemRow } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

import { DepositVendorSummaryWidget } from "./deposit-vendor-summary-widget"

interface WidgetLayout {
  x: number
  y: number
  width: number
  height: number
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

interface ResizeState {
  pointerId: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}

export interface DepositVendorSummaryFloatingWidgetProps {
  open: boolean
  lineItems: DepositLineItemRow[]
  onClose: () => void
}

const STORAGE_KEY = "reconciliation.vendor-summary-floating-layout.v1"
const EDGE_GAP = 12
const MIN_WIDTH = 540
const MIN_HEIGHT = 280

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function getDefaultLayout(viewportWidth: number, viewportHeight: number): WidgetLayout {
  const safeWidth = Math.max(viewportWidth - EDGE_GAP * 2, 320)
  const safeHeight = Math.max(viewportHeight - EDGE_GAP * 2, 220)
  const width = Math.min(Math.max(980, MIN_WIDTH), safeWidth)
  const height = Math.min(Math.max(520, MIN_HEIGHT), safeHeight)
  const x = Math.max(EDGE_GAP, viewportWidth - width - EDGE_GAP)
  const y = Math.max(EDGE_GAP, Math.min(104, viewportHeight - height - EDGE_GAP))
  return { x, y, width, height }
}

function clampLayout(layout: WidgetLayout, viewportWidth: number, viewportHeight: number): WidgetLayout {
  const safeWidth = Math.max(viewportWidth - EDGE_GAP * 2, 320)
  const safeHeight = Math.max(viewportHeight - EDGE_GAP * 2, 220)
  const width = Math.min(Math.max(layout.width, Math.min(MIN_WIDTH, safeWidth)), safeWidth)
  const height = Math.min(Math.max(layout.height, Math.min(MIN_HEIGHT, safeHeight)), safeHeight)
  const maxX = Math.max(EDGE_GAP, viewportWidth - width - EDGE_GAP)
  const maxY = Math.max(EDGE_GAP, viewportHeight - height - EDGE_GAP)
  return {
    x: Math.min(Math.max(layout.x, EDGE_GAP), maxX),
    y: Math.min(Math.max(layout.y, EDGE_GAP), maxY),
    width,
    height,
  }
}

export function DepositVendorSummaryFloatingWidget({
  open,
  lineItems,
  onClose,
}: DepositVendorSummaryFloatingWidgetProps) {
  const [layout, setLayout] = useState<WidgetLayout>({ x: 24, y: 96, width: 980, height: 520 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  const clampToViewport = useCallback((nextLayout: WidgetLayout) => {
    return clampLayout(nextLayout, window.innerWidth, window.innerHeight)
  }, [])

  const resetLayout = useCallback(() => {
    setLayout(getDefaultLayout(window.innerWidth, window.innerHeight))
  }, [])

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      setLayout(getDefaultLayout(window.innerWidth, window.innerHeight))
      return
    }

    try {
      const parsed = JSON.parse(raw) as Partial<WidgetLayout>
      if (
        !isFiniteNumber(parsed.x) ||
        !isFiniteNumber(parsed.y) ||
        !isFiniteNumber(parsed.width) ||
        !isFiniteNumber(parsed.height)
      ) {
        setLayout(getDefaultLayout(window.innerWidth, window.innerHeight))
        return
      }
      setLayout(clampToViewport(parsed as WidgetLayout))
    } catch {
      setLayout(getDefaultLayout(window.innerWidth, window.innerHeight))
    }
  }, [clampToViewport])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [layout])

  useEffect(() => {
    const handleViewportResize = () => {
      setLayout(previous => clampLayout(previous, window.innerWidth, window.innerHeight))
    }
    window.addEventListener("resize", handleViewportResize)
    return () => window.removeEventListener("resize", handleViewportResize)
  }, [])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return

    const handlePointerMove = (event: PointerEvent) => {
      if (dragRef.current && event.pointerId === dragRef.current.pointerId) {
        const deltaX = event.clientX - dragRef.current.startX
        const deltaY = event.clientY - dragRef.current.startY
        setLayout(previous =>
          clampToViewport({
            ...previous,
            x: dragRef.current ? dragRef.current.originX + deltaX : previous.x,
            y: dragRef.current ? dragRef.current.originY + deltaY : previous.y,
          }),
        )
        return
      }

      if (resizeRef.current && event.pointerId === resizeRef.current.pointerId) {
        const deltaX = event.clientX - resizeRef.current.startX
        const deltaY = event.clientY - resizeRef.current.startY
        setLayout(previous =>
          clampToViewport({
            ...previous,
            width: resizeRef.current ? resizeRef.current.startWidth + deltaX : previous.width,
            height: resizeRef.current ? resizeRef.current.startHeight + deltaY : previous.height,
          }),
        )
      }
    }

    const stopInteraction = (event: PointerEvent) => {
      if (dragRef.current && event.pointerId === dragRef.current.pointerId) {
        dragRef.current = null
        setIsDragging(false)
      }
      if (resizeRef.current && event.pointerId === resizeRef.current.pointerId) {
        resizeRef.current = null
        setIsResizing(false)
      }
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", stopInteraction)
    window.addEventListener("pointercancel", stopInteraction)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", stopInteraction)
      window.removeEventListener("pointercancel", stopInteraction)
      dragRef.current = null
      resizeRef.current = null
      setIsDragging(false)
      setIsResizing(false)
    }
  }, [clampToViewport, open])

  useEffect(() => {
    if (!open || (!isDragging && !isResizing)) return
    const original = document.body.style.userSelect
    document.body.style.userSelect = "none"
    return () => {
      document.body.style.userSelect = original
    }
  }, [isDragging, isResizing, open])

  const handleDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      if ((event.target as HTMLElement).closest("[data-vendor-summary-control='true']")) return
      event.preventDefault()
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: layout.x,
        originY: layout.y,
      }
      setIsDragging(true)
    },
    [layout.x, layout.y],
  )

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      resizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: layout.width,
        startHeight: layout.height,
      }
      setIsResizing(true)
    },
    [layout.height, layout.width],
  )

  if (!open) return null

  return (
    <section
      className="fixed z-40"
      style={{
        left: `${layout.x}px`,
        top: `${layout.y}px`,
        width: `${layout.width}px`,
        height: `${layout.height}px`,
      }}
      aria-label="Floating vendor summary"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
        <div
          className={cn(
            "flex select-none items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
          onPointerDown={handleDragStart}
        >
          <div className="flex min-w-0 items-center gap-2">
            <GripHorizontal className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-600">Deposit</p>
              <p className="truncate text-sm font-semibold text-slate-900">Vendor Summary</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-vendor-summary-control="true"
              onClick={resetLayout}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Reset
            </button>
            <button
              type="button"
              data-vendor-summary-control="true"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded border border-slate-300 bg-white p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close vendor summary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          <DepositVendorSummaryWidget lineItems={lineItems} defaultVisibleRows={25} />
        </div>

        <button
          type="button"
          data-vendor-summary-control="true"
          onPointerDown={handleResizeStart}
          className={cn(
            "absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded-sm border border-slate-300 bg-white/90",
            isResizing ? "bg-slate-200" : "hover:bg-slate-100",
          )}
          aria-label="Resize vendor summary panel"
        >
          <span className="sr-only">Resize vendor summary panel</span>
          <svg viewBox="0 0 8 8" className="h-3 w-3 text-slate-500" aria-hidden="true">
            <path d="M8 0v2L2 8H0v-2L6 0h2zM8 4v2L6 8H4l4-4z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </section>
  )
}
