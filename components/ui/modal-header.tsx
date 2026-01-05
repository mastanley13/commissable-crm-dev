'use client'

import type { ReactNode } from 'react'
import clsx from 'clsx'

interface ModalHeaderProps {
  kicker?: ReactNode
  title: ReactNode
  right?: ReactNode
  className?: string
}

export function ModalHeader({ kicker, title, right, className }: ModalHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between border-b border-gray-200 px-6 py-4', className)}>
      <div>
        {kicker ? <p className="text-xs font-semibold uppercase text-primary-600">{kicker}</p> : null}
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  )
}
