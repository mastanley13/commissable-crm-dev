'use client'

import { useState, useEffect } from 'react'
import { useReconciliationSettings } from '@/hooks/useReconciliationSettings'

export function ReconciliationSettingsForm() {
  const { settings, loading, error, save } = useReconciliationSettings()
  const [varianceTolerance, setVarianceTolerance] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (settings?.varianceTolerance !== undefined) {
      setVarianceTolerance(settings.varianceTolerance * 100)
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await save({
        varianceTolerance: varianceTolerance / 100
      })
      setMessage('Settings saved successfully!')
    } catch (err) {
      setMessage('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Reconciliation Settings
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Configure tenant-wide reconciliation matching defaults
        </p>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Variance Tolerance Field */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">
              Variance Tolerance (percent)
            </label>
            <input
              type="number"
              min="0"
              max="30"
              step="0.1"
              value={varianceTolerance}
              onChange={e => setVarianceTolerance(Number(e.target.value))}
              className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-500">
              Used by Pass A matching and auto-match algorithms. Stored at tenant level.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {message && (
              <span className={message.includes('success') ? 'text-green-600' : 'text-red-600'}>
                {message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
