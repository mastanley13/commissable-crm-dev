'use client'

import { ReactNode } from 'react'

interface DashboardClientWrapperProps {
  children: ReactNode
}

export function DashboardClientWrapper({ children }: DashboardClientWrapperProps) {
  return <>{children}</>
}
