"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'

interface SystemSetting {
  value: any
  description?: string
  scope: string
}

interface SystemSettings {
  [key: string]: SystemSetting
}

interface UseSystemSettingsReturn {
  settings: SystemSettings
  loading: boolean
  error: string | null
  updateSetting: (key: string, value: any, description?: string) => Promise<void>
  getSetting: (key: string, defaultValue?: any) => any
  isCopyProtectionEnabled: boolean
}

/**
 * Hook to manage system settings including copy protection
 */
export function useSystemSettings(): UseSystemSettingsReturn {
  const { user } = useAuth()
  const [settings, setSettings] = useState<SystemSettings>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/system-settings', {
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error('Failed to load system settings')
      }

      const data = await response.json()
      setSettings(data.data || {})
    } catch (err) {
      console.error('Failed to load system settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to load system settings')
    } finally {
      setLoading(false)
    }
  }, [user])

  const updateSetting = useCallback(async (key: string, value: any, description?: string) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    try {
      const response = await fetch('/api/system-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key,
          value,
          description,
          scope: 'Tenant'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update system setting')
      }

      const data = await response.json()
      
      // Update local state
      setSettings(prev => ({
        ...prev,
        [key]: {
          value: data.data.value,
          description: data.data.description,
          scope: data.data.scope
        }
      }))
    } catch (err) {
      console.error('Failed to update system setting:', err)
      throw err
    }
  }, [user])

  const getSetting = useCallback((key: string, defaultValue?: any) => {
    const setting = settings[key]
    return setting ? setting.value : defaultValue
  }, [settings])

  // Check if copy protection is enabled
  const isCopyProtectionEnabled = useCallback(() => {
    // Copy protection is enabled if:
    // 1. User has Accounting role, OR
    // 2. System setting 'copyProtection.enabled' is true
    const userRole = user?.role?.code
    const settingEnabled = getSetting('copyProtection.enabled', false)
    
    return userRole === 'Accounting' || settingEnabled
  }, [user?.role?.code, getSetting])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return {
    settings,
    loading,
    error,
    updateSetting,
    getSetting,
    isCopyProtectionEnabled: isCopyProtectionEnabled()
  }
}
