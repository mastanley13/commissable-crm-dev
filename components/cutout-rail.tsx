'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * CutoutRail overlays the main content's left edge using a dynamic SVG path
 * with even-odd fill to subtract circular "holes" that form smooth, curved
 * openings into the sidebar area (top notch + active-item dimple).
 */
export function CutoutRail() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [activeY, setActiveY] = useState<number | null>(null)
  const [topY, setTopY] = useState<number>(84)

  useEffect(() => {
    const update = () => {
      const container = document.getElementById('main-content-root')
      const overlay = containerRef.current
      const active = document.querySelector('[data-nav-active="true"]') as HTMLElement | null
      const header = document.getElementById('sidebar-header')
      
      if (!container || !overlay) return
      
      const c = container.getBoundingClientRect()
      setHeight(Math.max(0, Math.round(c.height)))
      
      if (header) {
        const hb = header.getBoundingClientRect()
        // place the top notch just below the header's bottom edge (tuned)
        setTopY(Math.max(0, hb.bottom - c.top + 14))
      }
      
      if (active && active.offsetParent) {
        const a = active.getBoundingClientRect()
        const newActiveY = a.top - c.top + a.height / 2
        // Only update if the position is within reasonable bounds
        if (newActiveY > 0 && newActiveY < c.height) {
          setActiveY(newActiveY)
        }
      } else {
        setActiveY(null)
      }
    }
    
    // Initial update
    update()
    
    // Set up observers with debouncing for better performance
    let timeoutId: NodeJS.Timeout
    const debouncedUpdate = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(update, 16) // ~60fps
    }
    
    const ro = new ResizeObserver(debouncedUpdate)
    const root = document.getElementById('main-content-root')
    
    if (root) ro.observe(root)
    
    window.addEventListener('resize', debouncedUpdate)
    document.addEventListener('scroll', debouncedUpdate, true)
    // Listen for navigation changes that might affect active state
    window.addEventListener('popstate', debouncedUpdate)
    
    return () => {
      clearTimeout(timeoutId)
      ro.disconnect()
      window.removeEventListener('resize', debouncedUpdate)
      window.removeEventListener('scroll', debouncedUpdate, true)
      window.removeEventListener('popstate', debouncedUpdate)
    }
  }, [])

  // Rail geometry (in px)
  const W = 72 // rail width (px) - reduced to prevent overlap
  const R = 36 // circle radius for shallower curves (px)
  const CX = 15 // circle X-offset to push curve deeper into rail

  const makeCircle = (cx: number, cy: number, r: number) =>
    `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 -${r * 2} 0`

  const d = (() => {
    const rect = `M 0 0 H ${W} V ${height} H 0 Z`
    const holes = [makeCircle(CX, topY, R)]
    if (activeY !== null) holes.push(makeCircle(CX, activeY, R))
    return `${rect} ${holes.join(' ')}`
  })()

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute -left-[18px] top-0 bottom-0 w-[72px] z-30"
      style={{ width: W }}
    >
      {/* SVG with even-odd fill: white rail minus circular holes */}
      <svg
        width={W}
        height={height}
        viewBox={`0 0 ${W} ${height || 1}`}
        className="absolute inset-0 text-gray-50"
        preserveAspectRatio="none"
      >
        <path
          d={d}
          fill="currentColor"
          fillRule="evenodd"
        />
      </svg>
    </div>
  )
}
