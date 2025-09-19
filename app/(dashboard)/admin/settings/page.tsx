"use client"

import { useState, useEffect } from 'react'
import { SystemSettingsErrorBoundary } from '@/components/system-settings-error-boundary'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useAuth } from '@/lib/auth-context'

export default function SystemSettingsPage() {
  const { user } = useAuth()
  const { settings, loading, error, updateSetting, getSetting } = useSystemSettings()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Check if user has admin permissions
  const isAdmin = user?.role?.code === 'Admin'

  const loadingFallback = (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  )

  useEffect(() => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Access denied. Admin permissions required.' })
    }
  }, [isAdmin])

  const handleCopyProtectionToggle = async (enabled: boolean) => {
    if (!isAdmin) return

    try {
      setSaving(true)
      setMessage(null)
      
      await updateSetting(
        'copyProtection.enabled',
        enabled,
        'Enable copy protection for all users (overrides role-based protection)'
      )
      
      setMessage({ 
        type: 'success', 
        text: `Copy protection ${enabled ? 'enabled' : 'disabled'} successfully` 
      })
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: 'Failed to update copy protection setting' 
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAuditLogRetentionChange = async (days: number) => {
    if (!isAdmin) return

    try {
      setSaving(true)
      setMessage(null)
      
      await updateSetting(
        'auditLog.retentionDays',
        days,
        'Number of days to retain audit log entries'
      )
      
      setMessage({ 
        type: 'success', 
        text: 'Audit log retention updated successfully' 
      })
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: 'Failed to update audit log retention' 
      })
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800">Access Denied</h2>
          <p className="text-red-600">You need admin permissions to access system settings.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return loadingFallback
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800">Error Loading Settings</h2>
          <p className="text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <SystemSettingsErrorBoundary fallback={loadingFallback}>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h1>

          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-6">
            {/* Copy Protection Settings */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Copy Protection</h2>
              <p className="text-gray-600 mb-4">
                Control copy protection settings for data security. Copy protection is automatically enabled for Accounting role users.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Enable Copy Protection for All Users
                    </label>
                    <p className="text-xs text-gray-500">
                      When enabled, copy protection will be applied to all users regardless of role
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopyProtectionToggle(!getSetting('copyProtection.enabled', false))}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      getSetting('copyProtection.enabled', false) ? 'bg-primary-600' : 'bg-gray-300'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        getSetting('copyProtection.enabled', false) ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">Copy Protection Features</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>- Blocks Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+V keyboard shortcuts</li>
                    <li>- Disables right-click context menu</li>
                    <li>- Prevents text selection and drag-and-drop</li>
                    <li>- Adds subtle watermark overlay</li>
                    <li>- Blocks developer tools access (F12, Ctrl+Shift+I)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Audit Log Settings */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Audit Logging</h2>
              <p className="text-gray-600 mb-4">
                Configure audit log retention and management settings.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Audit Log Retention (Days)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      value={getSetting('auditLog.retentionDays', 365)}
                      onChange={(e) => handleAuditLogRetentionChange(parseInt(e.target.value) || 365)}
                      disabled={saving}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="text-sm text-gray-500">days</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Audit log entries older than this will be automatically deleted
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-green-800 mb-2">Audit Log Coverage</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>- Account creation, updates, and deletions</li>
                    <li>- Contact creation, updates, and deletions</li>
                    <li>- User login and logout events</li>
                    <li>- Role and permission changes</li>
                    <li>- System setting modifications</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Current Settings Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-700">Copy Protection:</span>
                  <span className={`ml-2 text-sm ${
                    getSetting('copyProtection.enabled', false) ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {getSetting('copyProtection.enabled', false) ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Audit Log Retention:</span>
                  <span className="ml-2 text-sm text-gray-600">
                    {getSetting('auditLog.retentionDays', 365)} days
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">User Role:</span>
                  <span className="ml-2 text-sm text-gray-600">
                    {user?.role?.name || 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Copy Protection Status:</span>
                  <span className={`ml-2 text-sm ${
                    user?.role?.code === 'Accounting' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {user?.role?.code === 'Accounting' ? 'Active (Role-based)' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SystemSettingsErrorBoundary>
  )
}

