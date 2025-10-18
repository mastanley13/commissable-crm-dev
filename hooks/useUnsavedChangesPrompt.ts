"use client"

import { useCallback, useEffect } from "react"

const DEFAULT_MESSAGE = "You have unsaved changes. Are you sure you want to leave this page?"

interface Options {
  message?: string
}

export function useUnsavedChangesPrompt(shouldBlock: boolean, options: Options = {}) {
  const message = options.message ?? DEFAULT_MESSAGE

  useEffect(() => {
    if (!shouldBlock) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = message
      return message
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [shouldBlock, message])

  const confirmNavigation = useCallback(() => {
    if (!shouldBlock) return true
    return window.confirm(message)
  }, [shouldBlock, message])

  return { confirmNavigation }
}

