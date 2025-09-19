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

const SYSTEM_SETTINGS_READ_PERMISSION = 'system.settings.read'

/**
 * Hook to manage system settings including copy protection
 */
export function useSystemSettings(): UseSystemSettingsReturn {
  const { user } = useAuth()
  const [settings, setSettings] = useState<SystemSettings>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasPermission = hasSystemSettingsReadPermission(user)

  const loadSettings = useCallback(async () => {
    if (!user) {
      setSettings({})
      setError(null)
      setLoading(false)
      return
    }

    if (!hasPermission) {
      setSettings({})
      setError(null)
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
        if (response.status === 403) {
          setSettings({})
          setError(null)
          return
        }

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
  }, [user, hasPermission])

  const updateSetting = useCallback(async (key: string, value: any, description?: string) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    if (!hasPermission) {
      throw new Error('User lacks permission to update system settings')
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
        if (response.status === 403) {
          throw new Error('Insufficient permissions to update system settings')
        }

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
  }, [user, hasPermission])

  const getSetting = useCallback((key: string, defaultValue?: any) => {
    const setting = settings[key]
    return setting ? setting.value : defaultValue
  }, [settings])

  const isCopyProtectionEnabled = (user?.role?.code === 'Accounting') || Boolean(settings['copyProtection.enabled']?.value)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return {
    settings,
    loading,
    error,
    updateSetting,
    getSetting,
    isCopyProtectionEnabled
  }
}

export function useSystemSettingsWithPermission() {
  const { user } = useAuth()
  const hasPermission = hasSystemSettingsReadPermission(user)
  const systemSettings = useSystemSettings()

  return {
    hasPermission,
    ...systemSettings
  }
}

function hasSystemSettingsReadPermission(user: ReturnType<typeof useAuth>['user']) {
  return user?.role?.permissions?.some(permission => permission.code === SYSTEM_SETTINGS_READ_PERMISSION) ?? false
}
