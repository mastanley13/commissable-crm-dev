"use client"

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useSystemSettingsWithPermission } from '@/hooks/useSystemSettings'

interface CopyProtectionWrapperProps {
  children: React.ReactNode
  className?: string
}

/**
 * Copy Protection Component for Accounting Role
 * Implements contract requirement: Copy protection blocks Ctrl+C for Accounting role
 */
export function CopyProtectionWrapper({ children, className = "" }: CopyProtectionWrapperProps) {
  const { user } = useAuth()
  const { hasPermission, isCopyProtectionEnabled, loading } = useSystemSettingsWithPermission()
  const containerRef = useRef<HTMLDivElement>(null)

  const roleEnforcedCopyProtection = user?.role?.code === 'Accounting'

  // Check if copy protection should be enabled
  const shouldEnableCopyProtection = loading
    ? roleEnforcedCopyProtection
    : hasPermission
      ? isCopyProtectionEnabled
      : roleEnforcedCopyProtection

  useEffect(() => {
    if (!shouldEnableCopyProtection || !containerRef.current) {
      return
    }

    const container = containerRef.current

    // Block keyboard shortcuts
    const isInteractive = (el: EventTarget | null) => { if (!(el instanceof HTMLElement)) return false; const tag = el.tagName.toLowerCase(); return (el.isContentEditable || tag === "input" || tag === "textarea" || tag === "select"); };
    const handleKeyDown = (event: KeyboardEvent) => { if (isInteractive(event.target)) return;
      // Block Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+V
      if (event.ctrlKey && ['c', 'a', 'x', 'v'].includes(event.key.toLowerCase())) {
        event.preventDefault()
        event.stopPropagation()
        showCopyProtectionMessage()
        return false
      }
      
      // Block F12 (Developer Tools)
      if (event.key === 'F12') {
        event.preventDefault()
        event.stopPropagation()
        return false
      }
      
      // Block Ctrl+Shift+I (Developer Tools)
      if (event.ctrlKey && event.shiftKey && event.key === 'I') {
        event.preventDefault()
        event.stopPropagation()
        return false
      }
      
      // Block Ctrl+U (View Source)
      if (event.ctrlKey && event.key === 'u') {
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    }

    // Block right-click context menu
    const handleContextMenu = (event: MouseEvent) => { if (isInteractive(event.target)) return;
      event.preventDefault()
      event.stopPropagation()
      showCopyProtectionMessage()
      return false
    }

    // Block text selection
    const handleSelectStart = (event: Event) => { if (isInteractive(event.target)) return;
      event.preventDefault()
      event.stopPropagation()
      return false
    }

    // Block drag and drop
    const handleDragStart = (event: DragEvent) => { if (isInteractive(event.target)) return;
      event.preventDefault()
      event.stopPropagation()
      return false
    }

    // Add event listeners
    container.addEventListener('keydown', handleKeyDown, true)
    container.addEventListener('contextmenu', handleContextMenu, true)
    container.addEventListener('selectstart', handleSelectStart, true)
    container.addEventListener('dragstart', handleDragStart, true)

    // Disable text selection via CSS
    container.style.userSelect = 'none'
    ;(container.style as any).webkitUserSelect = 'none'
    ;(container.style as any).mozUserSelect = 'none'
    ;(container.style as any).msUserSelect = 'none'

    // Add watermark overlay
    const watermark = document.createElement('div')
    watermark.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 1000;
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(0, 0, 0, 0.03) 10px,
        rgba(0, 0, 0, 0.03) 20px
      );
      background-image: url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='%23ccc' text-anchor='middle' dy='.3em' transform='rotate(-45 100 100)'%3ECONFIDENTIAL%3C/text%3E%3C/svg%3E");
      background-repeat: repeat;
      opacity: 0.1;
    `
    container.style.position = 'relative'
    container.appendChild(watermark)

    // Cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown, true)
      container.removeEventListener('contextmenu', handleContextMenu, true)
      container.removeEventListener('selectstart', handleSelectStart, true)
      container.removeEventListener('dragstart', handleDragStart, true)
      
      // Remove watermark
      if (watermark.parentNode) {
        watermark.parentNode.removeChild(watermark)
      }
      
      // Reset styles
      container.style.userSelect = ''
      ;(container.style as any).webkitUserSelect = ''
      ;(container.style as any).mozUserSelect = ''
      ;(container.style as any).msUserSelect = ''
    }
  }, [shouldEnableCopyProtection])

  // Show copy protection message
  const showCopyProtectionMessage = () => {
    // Create temporary message element
    const message = document.createElement('div')
    message.textContent = 'Copy protection enabled for Accounting role'
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10000;
      pointer-events: none;
    `
    
    document.body.appendChild(message)
    
    // Remove message after 2 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message)
      }
    }, 2000)
  }

  return (
    <div 
      ref={containerRef}
      className={`copy-protection-wrapper ${className}`}
      style={{
        position: 'relative',
        ...(shouldEnableCopyProtection && {
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        })
      }}
    >
      {children}
      {shouldEnableCopyProtection && (
        <div className="copy-protection-indicator">
          <div className="absolute top-2 right-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full border border-red-200">
            Copy Protected
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Hook to check if copy protection is enabled for current user
 */
export function useCopyProtection() {
  const { user } = useAuth()
  const isAccountingRole = user?.role?.code === 'Accounting'
  
  return {
    isCopyProtectionEnabled: isAccountingRole,
    userRole: user?.role?.code
  }
}

/**
 * Utility function to check if copy protection should be enabled
 */
export function shouldEnableCopyProtection(userRole?: string): boolean {
  return userRole === 'Accounting'
}

