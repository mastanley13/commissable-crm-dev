"use client"

import { useState, useEffect } from "react"
import { Save, Check, AlertCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface TableChangeNotificationProps {
  hasUnsavedChanges: boolean
  isSaving: boolean
  lastSaved?: Date
  onSave?: () => void
  className?: string
}

export function TableChangeNotification({
  hasUnsavedChanges,
  isSaving,
  lastSaved,
  onSave,
  className
}: TableChangeNotificationProps) {
  const [showPing, setShowPing] = useState(false)

  // Trigger ping animation when changes are detected
  useEffect(() => {
    if (hasUnsavedChanges) {
      setShowPing(true)
      const timer = setTimeout(() => setShowPing(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [hasUnsavedChanges])

  if (!hasUnsavedChanges && !isSaving) {
    // Show compact saved badge
    return (
      <div className={cn("flex items-center", className)} title="Table settings are saved and up to date">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
          <Check className="h-3 w-3" />
          <span>Saved</span>
        </div>
        {lastSaved && (
          <span className="ml-2 text-xs text-gray-500" title={`Last saved: ${lastSaved.toLocaleString()}`}>
            <Clock className="h-3 w-3 inline mr-1" />
            {formatLastSaved(lastSaved)}
          </span>
        )}
      </div>
    )
  }

  if (isSaving) {
    // Show compact saving badge
    return (
      <div className={cn("flex items-center", className)} title="Saving table settings...">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent" />
          <span>Saving</span>
        </div>
      </div>
    )
  }

  // Show compact unsaved changes badge with ping effect
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 transition-all duration-300",
          showPing && "animate-pulse"
        )}
        title="You have unsaved table changes"
      >
        <div className="relative">
          <AlertCircle className="h-3 w-3" />
          {showPing && (
            <div className="absolute inset-0 animate-ping">
              <AlertCircle className="h-3 w-3 text-amber-400" />
            </div>
          )}
        </div>
        <span>Unsaved</span>
      </div>

      {onSave && (
        <button
          onClick={onSave}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
          title="Save your table changes now"
        >
          <Save className="h-3 w-3" />
          Save
        </button>
      )}
    </div>
  )
}

function formatLastSaved(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) {
    return "just now"
  } else if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}
