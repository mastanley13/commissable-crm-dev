"use client"

import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react"

export type AutosizeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  maxHeight?: number
}

export const AutosizeTextarea = forwardRef<HTMLTextAreaElement, AutosizeTextareaProps>(function AutosizeTextarea(
  { maxHeight = 180, onChange, onInput, style, value, ...props },
  forwardedRef
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const rafIdRef = useRef<number | null>(null)

  const resizeNow = useCallback(() => {
    const el = innerRef.current
    if (!el) return

    const cap = maxHeight > 0 ? maxHeight : Number.POSITIVE_INFINITY

    el.style.height = "auto"
    const nextHeight = Math.min(el.scrollHeight, cap)
    el.style.height = `${nextHeight}px`
    el.style.overflowY = el.scrollHeight > cap ? "auto" : "hidden"
  }, [maxHeight])

  const queueResize = useCallback(() => {
    if (rafIdRef.current != null) return
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null
      resizeNow()
    })
  }, [resizeNow])

  useLayoutEffect(() => {
    resizeNow()
  }, [resizeNow, value])

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [])

  return (
    <textarea
      {...props}
      ref={(node) => {
        innerRef.current = node
        if (typeof forwardedRef === "function") {
          forwardedRef(node)
        } else if (forwardedRef) {
          forwardedRef.current = node
        }
      }}
      style={{ ...style, overflowY: style?.overflowY ?? "hidden" }}
      value={value}
      onChange={(e) => {
        onChange?.(e)
        queueResize()
      }}
      onInput={(e) => {
        onInput?.(e)
        queueResize()
      }}
    />
  )
})
