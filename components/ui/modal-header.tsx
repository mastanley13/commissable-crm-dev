'use client'

import type { ReactNode } from 'react'
import clsx from 'clsx'

interface ModalHeaderProps {
  kicker?: ReactNode
  title: ReactNode
  right?: ReactNode
  className?: string
  variant?: 'default' | 'gradient'
}

export function ModalHeader({ kicker, title, right, className, variant = 'default' }: ModalHeaderProps) {
  const isGradient = variant === 'gradient'

  return (
    <div
      className={clsx(
        'flex items-center justify-between px-6 py-4',
        isGradient
          ? 'border-b border-blue-700 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-700 text-white'
          : 'border-b border-gray-200',
        className
      )}
    >
      <div>
        {kicker ? (
          <p className={clsx('text-xs font-semibold uppercase', isGradient ? 'text-blue-100' : 'text-primary-600')}>
            {kicker}
          </p>
        ) : null}
        <h2 className={clsx('text-lg font-semibold', isGradient ? 'text-white' : 'text-gray-900')}>{title}</h2>
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  )
}
