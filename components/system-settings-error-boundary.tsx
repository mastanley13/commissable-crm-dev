"use client"

import React from 'react'

interface SystemSettingsErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface SystemSettingsErrorBoundaryState {
  hasError: boolean
}

export class SystemSettingsErrorBoundary extends React.Component<SystemSettingsErrorBoundaryProps, SystemSettingsErrorBoundaryState> {
  state: SystemSettingsErrorBoundaryState = {
    hasError: false
  }

  static getDerivedStateFromError(): SystemSettingsErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('SystemSettingsErrorBoundary caught an error:', error)
  }

  render() {
    const { children, fallback = null } = this.props

    if (this.state.hasError) {
      return fallback
    }

    return (
      <React.Suspense fallback={fallback}>
        {children}
      </React.Suspense>
    )
  }
}
