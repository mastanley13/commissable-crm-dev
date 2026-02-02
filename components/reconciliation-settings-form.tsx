'use client'

import { useState, useEffect } from 'react'
import { useReconciliationSettings } from '@/hooks/useReconciliationSettings'
import { useReconciliationUserSettings } from '@/hooks/useReconciliationUserSettings'
import { PercentSliderWithInput } from '@/components/percent-slider-with-input'

export function ReconciliationSettingsForm() {
  const {
    settings: tenantSettings,
    loading: tenantLoading,
    error: tenantError,
    save: saveTenantSettings,
  } = useReconciliationSettings()
  const {
    settings: userSettings,
    loading: userLoading,
    error: userError,
    save: saveUserSettings,
  } = useReconciliationUserSettings()
  const [varianceTolerance, setVarianceTolerance] = useState(0)
  const [suggestedMatchesMinConfidence, setSuggestedMatchesMinConfidence] = useState(70)
  const [autoMatchMinConfidence, setAutoMatchMinConfidence] = useState(95)
  const [finalizeDisputedDepositsPolicy, setFinalizeDisputedDepositsPolicy] = useState<
    "block_all" | "allow_manager_admin" | "allow_all"
  >("allow_manager_admin")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (tenantSettings?.varianceTolerance !== undefined) {
      setVarianceTolerance(Number((tenantSettings.varianceTolerance * 100).toFixed(1)))
    }
    if (tenantSettings?.finalizeDisputedDepositsPolicy) {
      setFinalizeDisputedDepositsPolicy(tenantSettings.finalizeDisputedDepositsPolicy)
    }
  }, [tenantSettings])

  useEffect(() => {
    if (userSettings?.suggestedMatchesMinConfidence !== undefined) {
      setSuggestedMatchesMinConfidence(Math.round(userSettings.suggestedMatchesMinConfidence * 100))
    }
    if (userSettings?.autoMatchMinConfidence !== undefined) {
      setAutoMatchMinConfidence(Math.round(userSettings.autoMatchMinConfidence * 100))
    }
  }, [userSettings])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await Promise.all([
        saveTenantSettings({
          varianceTolerance: varianceTolerance / 100,
          finalizeDisputedDepositsPolicy,
        }),
        saveUserSettings({
          suggestedMatchesMinConfidence: suggestedMatchesMinConfidence / 100,
          autoMatchMinConfidence: autoMatchMinConfidence / 100,
        }),
      ])
      setMessage('Settings saved successfully!')
    } catch (err) {
      setMessage('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const loading = tenantLoading || userLoading
  const error = tenantError || userError

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Reconciliation Settings
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Configure reconciliation matching behavior
        </p>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-4">
          {error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <PercentSliderWithInput
            label="Variance Tolerance (tenant default, percent)"
            helpText="Used by Pass A matching and auto-match algorithms. Stored at tenant level."
            value={varianceTolerance}
            onChange={setVarianceTolerance}
            min={0}
            max={30}
            step={0.1}
          />

          <PercentSliderWithInput
            label="Suggested Matches Display Confidence (your preference)"
            helpText="Filters the Suggested Matches table to show schedules at or above this confidence."
            value={suggestedMatchesMinConfidence}
            onChange={setSuggestedMatchesMinConfidence}
            min={0}
            max={100}
            step={1}
          />

          <PercentSliderWithInput
            label="AI Auto-Match Confidence (your preference)"
            helpText="AI Matching will only auto-apply the top candidate when confidence meets or exceeds this threshold."
            value={autoMatchMinConfidence}
            onChange={setAutoMatchMinConfidence}
            min={0}
            max={100}
            step={1}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-900">
              Deposit finalization when disputed (tenant default)
            </label>
            <p className="text-sm text-slate-600">
              A deposit is considered disputed if it has applied allocations to any revenue schedule with Billing Status
              set to &quot;In Dispute&quot;. This setting controls whether finalization is blocked and (optionally) restricted by
              role/permission.
            </p>
            <select
              value={finalizeDisputedDepositsPolicy}
              onChange={event =>
                setFinalizeDisputedDepositsPolicy(
                  event.target.value as "block_all" | "allow_manager_admin" | "allow_all",
                )
              }
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="allow_manager_admin">
                Allow Managers/Admins to finalize disputed deposits (default)
              </option>
              <option value="block_all">Block finalization if any disputes exist</option>
              <option value="allow_all">Allow any authorized user to finalize disputed deposits</option>
            </select>
            <p className="text-xs text-slate-500">
              Default behavior: Managers (users with reconciliation.manage) and Admins can finalize deposits even when
              disputes exist; other users will be blocked.
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
