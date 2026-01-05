'use client'

import { useEffect, type ReactNode } from 'react'
import clsx from 'clsx'

export type ModalShellSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<ModalShellSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl'
}

interface ModalShellProps {
  isOpen: boolean
  title?: string
  description?: string
  size?: ModalShellSize
  children: ReactNode
  footer?: ReactNode
  className?: string
  lockBodyScroll?: boolean
}

export function ModalShell({
  isOpen,
  title,
  description,
  size = 'lg',
  children,
  footer,
  className,
  lockBodyScroll = true
}: ModalShellProps) {
  useEffect(() => {
    if (!lockBodyScroll) return
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, lockBodyScroll])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'w-full rounded-xl bg-white shadow-xl',
          SIZE_CLASSES[size],
          'max-h-[calc(100vh-2rem)] min-h-0 flex flex-col',
          className
        )}
      >
        {title ? (
          <div className="border-b border-gray-200 px-6 py-3">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-6 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
