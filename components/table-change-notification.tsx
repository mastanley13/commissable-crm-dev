"use client"

import { useState, useEffect } from "react"
import { Save, Check, AlertCircle } from "lucide-react"
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
    // Show saved state when no changes
    return (
      <div className={cn("flex items-center gap-2 text-sm text-green-600", className)}>
        <div className="flex items-center gap-1.5">
          <Check className="h-4 w-4 text-green-500" />
          <span>Current table state has already been saved/updated to your settings</span>
        </div>
        {lastSaved && (
          <span className="text-xs text-gray-400">
            {formatLastSaved(lastSaved)}
          </span>
        )}
      </div>
    )
  }

  if (isSaving) {
    // Show saving state
    return (
      <div className={cn("flex items-center gap-2 text-sm text-blue-600", className)}>
        <div className="flex items-center gap-1.5">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
          <span>Saving changes...</span>
        </div>
      </div>
    )
  }

  // Show unsaved changes with ping effect
  return (
    <div className={cn("relative", className)}>
      <div className={cn(
        "flex items-center gap-2 text-sm text-amber-600 transition-all duration-300",
        showPing && "animate-pulse"
      )}>
        <div className="relative">
          <AlertCircle className="h-4 w-4" />
          {showPing && (
            <div className="absolute inset-0 animate-ping">
              <AlertCircle className="h-4 w-4 text-amber-400" />
            </div>
          )}
        </div>
        <span>Unsaved table changes</span>
      </div>
      
      {onSave && (
        <button
          onClick={onSave}
          className="ml-3 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
        >
          <Save className="h-3 w-3" />
          Save Now
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
