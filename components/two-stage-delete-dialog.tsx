'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2, RotateCcw, Shield, X, ChevronRight, Info } from 'lucide-react'
import type { DeletionConstraint } from '@/lib/deletion'

interface DeleteDialogEntitySummary {
  id: string
  name: string
  subtitle?: string
  accountType?: string
  legalName?: string
  accountOwner?: string
  roleName?: string
  email?: string
  workPhone?: string
  mobile?: string
}
export interface TwoStageDeleteDialogProps {
  isOpen: boolean
  onClose: () => void
  entity: string
  entityName: string
  entityId: string
  isDeleted?: boolean
  onSoftDelete: (entityId: string, bypassConstraints?: boolean, reason?: string) => Promise<{ success: boolean, constraints?: DeletionConstraint[], error?: string }>
  onPermanentDelete: (entityId: string, reason?: string) => Promise<{ success: boolean, error?: string }>
  onBulkPermanentDelete?: (entities: DeleteDialogEntitySummary[], reason?: string) => Promise<{ success: boolean, error?: string }>
  onRestore?: (entityId: string) => Promise<{ success: boolean, error?: string }>
  userCanPermanentDelete?: boolean
  multipleEntities?: DeleteDialogEntitySummary[]
  entitySummary?: DeleteDialogEntitySummary
  entityLabelPlural?: string
  onBulkSoftDelete?: (entities: DeleteDialogEntitySummary[], bypassConstraints?: boolean, reason?: string) => Promise<{ success: boolean, constraints?: DeletionConstraint[], error?: string }>
  // When true, disables the Delete action (used to prevent deleting active records defensively)
  disallowActiveDelete?: boolean
  // Matches the larger Revenue Schedules Deactivate/Delete modal sizing
  modalSize?: 'default' | 'revenue-schedules'
  // When true, user must provide a reason before proceeding
  requireReason?: boolean
  reasonLabel?: string
  reasonPlaceholder?: string
  primaryActionLabel?: string
  noteLabel?: string
  note?: string
}

type DialogStage = 'initial' | 'constraints' | 'confirm-soft' | 'confirm-permanent' | 'confirm-restore' | 'loading' | 'success' | 'error'

export function TwoStageDeleteDialog({
  isOpen,
  onClose,
  entity,
  entityName,
  entityId,
  isDeleted = false,
  onSoftDelete,
  onPermanentDelete,
  onBulkPermanentDelete,
  onRestore,
  userCanPermanentDelete = false,
  multipleEntities,
  entitySummary,
  entityLabelPlural,
  onBulkSoftDelete,
  disallowActiveDelete = false,
  modalSize = 'default',
  requireReason = false,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Provide the reason for this change',
  primaryActionLabel,
  noteLabel,
  note
}: TwoStageDeleteDialogProps) {
  const isRevenueSchedulesSize = modalSize === 'revenue-schedules'
  const [stage, setStage] = useState<DialogStage>('initial')
  const [constraints, setConstraints] = useState<DeletionConstraint[]>([])
  const [error, setError] = useState<string>('')
  const [bypassConstraints, setBypassConstraints] = useState(false)
  const [reason, setReason] = useState('')
  const selectedCount = Array.isArray(multipleEntities) ? multipleEntities.length : 0
  const hasMultipleEntities = selectedCount > 0
  const pluralLabel = entityLabelPlural ?? `${entity}${entity.endsWith('s') ? 'es' : 's'}`
  const lowerPluralLabel = pluralLabel.toLowerCase()
  const effectiveEntityName = hasMultipleEntities
    ? (selectedCount === 1 ? entityName : `${selectedCount} ${pluralLabel}`)
    : entityName
  const reasonTrimmed = reason.trim()
  const reasonMissing = requireReason && reasonTrimmed.length === 0
  const initialFooterDisabled = disallowActiveDelete || reasonMissing
  const initialFooterPrimaryLabel = primaryActionLabel ?? (entity === 'Account' ? 'Apply' : 'Delete')
  const initialFooterNoteLabel = noteLabel ?? (entity === 'Account' ? 'Legend' : 'Note')

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStage('initial')
      setConstraints([])
      setError('')
      setBypassConstraints(false)
      setReason('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleBulkPermanentDelete = async () => {
    if (!Array.isArray(multipleEntities) || multipleEntities.length === 0) {
      setError('No records selected for permanent deletion')
      setStage('error')
      return
    }

    setStage('loading')
    setError('')

    try {
      if (onBulkPermanentDelete) {
        const result = await onBulkPermanentDelete(multipleEntities, reasonTrimmed)
        if (result.success) {
          setStage('success')
          setTimeout(() => {
            onClose()
          }, 1500)
          return
        }
        setError(result.error || 'Failed to permanently delete records')
        setStage('error')
        return
      }

      const targets = multipleEntities.map(entity => entity.id)
      const entityNameById = new Map(multipleEntities.map(entity => [entity.id, entity.name]))
      const results = await Promise.allSettled(
        targets.map(id => onPermanentDelete(id, reasonTrimmed))
      )

      const failures: Array<{ id: string; name: string; error: string }> = []
      results.forEach((result, index) => {
        const id = targets[index]
        const name = entityNameById.get(id) || id.slice(0, 8) + '...'
        if (result.status !== 'fulfilled') {
          failures.push({ id, name, error: result.reason instanceof Error ? result.reason.message : 'Unknown error' })
          return
        }
        if (!result.value.success) {
          failures.push({ id, name, error: result.value.error || 'Failed to permanently delete record' })
        }
      })

      if (failures.length === 0) {
        setStage('success')
        setTimeout(() => {
          onClose()
        }, 1500)
        return
      }

      const preview = failures
        .slice(0, 5)
        .map(item => `- ${item.name}: ${item.error}`)
        .join('\n')

      setError(
        `${failures.length} of ${targets.length} ${targets.length === 1 ? entity.toLowerCase() : lowerPluralLabel} could not be permanently deleted.\n\n${preview}` +
          (failures.length > 5 ? `\n- and ${failures.length - 5} more` : ''),
      )
      setStage('error')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStage('error')
    }
  }

  const handleBulkRestore = async () => {
    if (!onRestore) return
    if (!Array.isArray(multipleEntities) || multipleEntities.length === 0) {
      setError('No records selected for restoration')
      setStage('error')
      return
    }

    setStage('loading')
    setError('')

    try {
      const targets = multipleEntities.map(entity => entity.id)
      const entityNameById = new Map(multipleEntities.map(entity => [entity.id, entity.name]))
      const results = await Promise.allSettled(
        targets.map(id => onRestore(id))
      )

      const failures: Array<{ id: string; name: string; error: string }> = []
      results.forEach((result, index) => {
        const id = targets[index]
        const name = entityNameById.get(id) || id.slice(0, 8) + '...'
        if (result.status !== 'fulfilled') {
          failures.push({ id, name, error: result.reason instanceof Error ? result.reason.message : 'Unknown error' })
          return
        }
        if (!result.value.success) {
          failures.push({ id, name, error: result.value.error || 'Failed to restore record' })
        }
      })

      if (failures.length === 0) {
        setStage('success')
        setTimeout(() => {
          onClose()
        }, 1500)
        return
      }

      const preview = failures
        .slice(0, 5)
        .map(item => `- ${item.name}: ${item.error}`)
        .join('\n')

      setError(
        `${failures.length} of ${targets.length} ${targets.length === 1 ? entity.toLowerCase() : lowerPluralLabel} could not be restored.\n\n${preview}` +
          (failures.length > 5 ? `\n- and ${failures.length - 5} more` : ''),
      )
      setStage('error')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStage('error')
    }
  }

  const handleSoftDelete = async () => {
    setStage('loading')
    setError('')

    try {
      let result
      if (hasMultipleEntities) {
        if (!onBulkSoftDelete || !multipleEntities) {
          setError('Bulk delete handler is missing')
          setStage('error')
          return
        }
        result = await onBulkSoftDelete(multipleEntities, bypassConstraints, reasonTrimmed)
      } else {
        result = await onSoftDelete(entityId, bypassConstraints, reasonTrimmed)
      }
      
      if (result.success) {
        setStage('success')
        setTimeout(() => {
          onClose()
        }, 1500)
      } else if (result.constraints && result.constraints.length > 0) {
        setConstraints(result.constraints)
        setStage('constraints')
      } else {
        setError(result.error || 'Failed to delete record')
        setStage('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStage('error')
    }
  }

  const handlePermanentDelete = async () => {
    setStage('loading')
    setError('')

    try {
      const result = await onPermanentDelete(entityId, reasonTrimmed)
      
      if (result.success) {
        setStage('success')
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        setError(result.error || 'Failed to permanently delete record')
        setStage('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStage('error')
    }
  }

  const handleRestore = async () => {
    if (!onRestore) return
    
    setStage('loading')
    setError('')

    try {
      const result = await onRestore(entityId)
      
      if (result.success) {
        setStage('success')
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        setError(result.error || 'Failed to restore record')
        setStage('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStage('error')
    }
  }

  const renderInitialStage = () => {
    if (hasMultipleEntities) {
      const showAccountsTable = entity === 'Account'
      const showRolesTable = entity === 'Opportunity Role' || entity === 'OpportunityRole' || entity === 'Role'
      const bulkDescription = isDeleted
        ? `This will permanently remove the selected ${lowerPluralLabel}. This action cannot be undone.`
        : `This action will deactivate the selected ${lowerPluralLabel}. You can restore them later if needed.`
      const bulkTitle = isDeleted ? `Delete ${pluralLabel}` : `Delete ${pluralLabel}`
      return (
        <div className={isRevenueSchedulesSize ? "px-6 py-5" : "p-6"}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {bulkTitle}
              </h3>
              <p className="text-sm text-gray-600">
                {bulkDescription}
              </p>
            </div>
          </div>

          {showAccountsTable ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">
                Selected {pluralLabel} ({multipleEntities!.length})
              </p>
              <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="px-3 py-2">Account Name</th>
                      <th className="px-3 py-2">Account Type</th>
                      <th className="px-3 py-2">Legal Name</th>
                      <th className="px-3 py-2">Account Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multipleEntities!.map(item => (
                      <tr key={item.id} className="border-t border-gray-100 text-gray-700">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-gray-900">{item.name || '--'}</div>
                          <div className="text-[11px] text-gray-500">ID: {item.id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-3 py-2">{item.accountType || '--'}</td>
                        <td className="px-3 py-2">{item.legalName || '--'}</td>
                        <td className="px-3 py-2">{item.accountOwner || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : showRolesTable ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">
                Selected {pluralLabel} ({multipleEntities!.length})
              </p>
              <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Full Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Work Phone</th>
                      <th className="px-3 py-2">Mobile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multipleEntities!.map(item => (
                      <tr key={item.id} className="border-t border-gray-100 text-gray-700">
                        <td className="px-3 py-2">{item.roleName || item.subtitle || '--'}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-gray-900">{item.name || '--'}</div>
                          <div className="text-[11px] text-gray-500">ID: {item.id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-3 py-2">{item.email || '--'}</td>
                        <td className="px-3 py-2">{item.workPhone || '--'}</td>
                        <td className="px-3 py-2">{item.mobile || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">
                Selected {pluralLabel} ({multipleEntities!.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {multipleEntities!.map(item => (
                  <div
                    key={item.id}
                    className="rounded border border-gray-200 bg-white px-3 py-2"
                  >
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">ID: {item.id.slice(0, 8)}...</p>
                    {item.subtitle && (
                      <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {requireReason ? (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700">
                {reasonLabel}<span className="ml-1 text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={event => setReason(event.target.value)}
                className="min-h-[84px] w-full resize-y border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs leading-5 focus:border-primary-500 focus:outline-none"
                placeholder={reasonPlaceholder}
              />
            </div>
          ) : null}

          {!isRevenueSchedulesSize && note ? (
            <div
              className="mb-6 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-600"
              title={note}
            >
              <Info className="mt-0.5 h-4 w-4 text-gray-400" aria-hidden="true" />
              <p>
                <span className="font-semibold text-gray-700">Note:</span>{' '}
                {note}
              </p>
            </div>
          ) : null}

          {!isRevenueSchedulesSize ? (
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStage('confirm-soft')}
                disabled={disallowActiveDelete || reasonMissing}
                className={`px-4 py-2 rounded-lg transition-colors ${disallowActiveDelete || reasonMissing
                  ? 'bg-red-400 text-white opacity-60 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'}`}
                title={disallowActiveDelete ? 'Deactivate the record before deleting' : reasonMissing ? 'Provide a reason before deleting' : 'Delete'}
              >
                {disallowActiveDelete ? 'Delete (Disabled)' : 'Delete'}
              </button>
            </div>
          ) : null}
        </div>
      )
    }

    if (isDeleted) {
      return (
        <div className={isRevenueSchedulesSize ? "px-6 py-5" : "p-6"}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Manage Deleted {entity}
              </h3>
              <p className="text-sm text-gray-600">
                This {entity.toLowerCase()} has been deleted. Choose an action:
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{effectiveEntityName}</p>
                <p className="text-sm text-gray-600">Status: Deleted</p>
              </div>
              <div className="text-sm text-gray-500">
                ID: {entityId.slice(0, 8)}...
              </div>
            </div>
          </div>

          {requireReason ? (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700">
                {reasonLabel}<span className="ml-1 text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={event => setReason(event.target.value)}
                className="min-h-[84px] w-full resize-y border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs leading-5 focus:border-primary-500 focus:outline-none"
                placeholder={reasonPlaceholder}
              />
            </div>
          ) : null}

          {note ? (
            <div
              className="mb-6 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-600"
              title={note}
            >
              <Info className="mt-0.5 h-4 w-4 text-gray-400" aria-hidden="true" />
              <p>
                <span className="font-semibold text-gray-700">Note:</span>{' '}
                {note}
              </p>
            </div>
          ) : null}

          <div className="flex gap-3">
            {onRestore && (
              <button
                onClick={() => setStage('confirm-restore')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Restore
              </button>
            )}
            
            {userCanPermanentDelete && (
              <button
                onClick={() => setStage('confirm-permanent')}
                disabled={reasonMissing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete Permanently
              </button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className={isRevenueSchedulesSize ? "px-6 py-5" : "p-6"}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Delete {entity}
            </h3>
            <p className="text-sm text-gray-600">
              This action will deactivate the {entity.toLowerCase()}. You can restore it later if needed.
            </p>
          </div>
        </div>

        {entity === 'Account' && entitySummary ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Selected {pluralLabel} (1)
            </p>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="px-3 py-2">Account Name</th>
                    <th className="px-3 py-2">Account Type</th>
                    <th className="px-3 py-2">Legal Name</th>
                    <th className="px-3 py-2">Account Owner</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100 text-gray-700">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-gray-900">{entitySummary.name || '--'}</div>
                      <div className="text-[11px] text-gray-500">ID: {entitySummary.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-3 py-2">{entitySummary.accountType || '--'}</td>
                    <td className="px-3 py-2">{entitySummary.legalName || '--'}</td>
                    <td className="px-3 py-2">{entitySummary.accountOwner || '--'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{effectiveEntityName}</p>
                <p className="text-sm text-gray-600">{entity}</p>
              </div>
              <div className="text-sm text-gray-500">
                ID: {entityId.slice(0, 8)}...
              </div>
            </div>
          </div>
        )}

        {requireReason ? (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700">
              {reasonLabel}<span className="ml-1 text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value)}
              className="min-h-[84px] w-full resize-y border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs leading-5 focus:border-primary-500 focus:outline-none"
              placeholder={reasonPlaceholder}
            />
          </div>
        ) : null}

        {!isRevenueSchedulesSize && note ? (
          <div
            className="mb-6 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-600"
            title={note}
          >
            <Info className="mt-0.5 h-4 w-4 text-gray-400" aria-hidden="true" />
            <p>
              <span className="font-semibold text-gray-700">Note:</span>{' '}
              {note}
            </p>
          </div>
        ) : null}

        {!isRevenueSchedulesSize ? (
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setStage('confirm-soft')}
              disabled={disallowActiveDelete || reasonMissing}
              className={`px-4 py-2 rounded-lg transition-colors ${disallowActiveDelete
                ? 'bg-red-400 text-white opacity-60 cursor-not-allowed'
                : reasonMissing
                  ? 'bg-red-400 text-white opacity-60 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'}`}
              title={disallowActiveDelete ? 'Deactivate the record before deleting' : reasonMissing ? 'Provide a reason before deleting' : 'Delete'}
            >
              {disallowActiveDelete ? 'Delete (Disabled)' : 'Delete'}
            </button>
          </div>
        ) : null}
      </div>
    )
  }
  const renderConstraintsStage = () => (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Deletion Constraints
          </h3>
          <p className="text-sm text-gray-600">
            This {hasMultipleEntities ? lowerPluralLabel : entity.toLowerCase()} has dependencies that may prevent deletion.
          </p>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-yellow-800 mb-3">Related Records Found:</h4>
        <div className="space-y-2">
          {constraints.map((constraint, index) => (
            <div key={index} className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-700">
                <span className="font-medium">{constraint.entity}:</span> {constraint.message}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={bypassConstraints}
            onChange={(e) => setBypassConstraints(e.target.checked)}
            className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
          />
          <div className="text-sm">
            <div className="font-medium text-gray-900">Force Delete</div>
            <div className="text-gray-600">
              Delete anyway, leaving related records orphaned. This may cause data integrity issues.
            </div>
          </div>
        </label>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => setStage('initial')}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSoftDelete}
          disabled={!bypassConstraints}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {bypassConstraints ? 'Force Delete' : 'Delete (Blocked)'}
        </button>
      </div>
    </div>
  )

  const renderConfirmationStage = (type: 'soft' | 'permanent' | 'restore') => {
    if (hasMultipleEntities) {
      const configs = {
        soft: {
          title: 'Confirm Deletion',
          icon: <Trash2 className="h-5 w-5 text-red-600" />,
          bgColor: 'bg-red-100',
          description: `This will deactivate the selected ${lowerPluralLabel}. You can restore them later if needed.`,
          action: 'Delete',
          actionClass: 'bg-red-600 hover:bg-red-700',
          onConfirm: handleSoftDelete
        },
        permanent: {
          title: 'Confirm Permanent Deletion',
          icon: <Shield className="h-5 w-5 text-red-600" />,
          bgColor: 'bg-red-100',
          description: `This will permanently remove the selected ${lowerPluralLabel}. This action cannot be undone.`,
          action: 'Delete Permanently',
          actionClass: 'bg-red-700 hover:bg-red-800',
          onConfirm: handleBulkPermanentDelete
        },
        restore: {
          title: `Restore ${pluralLabel}`,
          icon: <RotateCcw className="h-5 w-5 text-green-600" />,
          bgColor: 'bg-green-100',
          description: `This will reactivate the selected ${lowerPluralLabel} and make them available again.`,
          action: 'Restore',
          actionClass: 'bg-green-600 hover:bg-green-700',
          onConfirm: handleBulkRestore
        }
      }

      const config = configs[type]

      return (
        <div className={isRevenueSchedulesSize ? "px-6 py-5" : "p-6"}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex-shrink-0 w-10 h-10 ${config.bgColor} rounded-full flex items-center justify-center`}>
              {config.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {config.title}
              </h3>
              <p className="text-sm text-gray-600">
                {config.description}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Selected {pluralLabel} ({multipleEntities!.length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {multipleEntities!.map(item => (
                <div
                  key={item.id}
                  className="rounded border border-gray-200 bg-white px-3 py-2"
                >
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">ID: {item.id.slice(0, 8)}...</p>
                  {item.subtitle && (
                    <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {!isRevenueSchedulesSize && (
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setStage('initial')}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={config.onConfirm}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${config.actionClass}`}
              >
                {config.action}
              </button>
            </div>
          )}
        </div>
      )
    }

    const configs = {
      soft: {
        title: `Confirm Delete ${entity}`,
        icon: <Trash2 className="h-5 w-5 text-red-600" />,
        bgColor: 'bg-red-100',
        description: `This will deactivate the ${entity.toLowerCase()}. You can restore it later if needed.`,
        action: 'Delete',
        actionClass: 'bg-red-600 hover:bg-red-700',
        onConfirm: handleSoftDelete
      },
      permanent: {
        title: `Permanently Delete ${entity}`,
        icon: <Shield className="h-5 w-5 text-red-600" />,
        bgColor: 'bg-red-100',
        description: `This will permanently remove the ${entity.toLowerCase()} and all its data. This action cannot be undone.`,
        action: 'Delete Permanently',
        actionClass: 'bg-red-700 hover:bg-red-800',
        onConfirm: handlePermanentDelete
      },
      restore: {
        title: `Restore ${entity}`,
        icon: <RotateCcw className="h-5 w-5 text-green-600" />,
        bgColor: 'bg-green-100',
        description: `This will reactivate the ${entity.toLowerCase()} and make it available again.`,
        action: 'Restore',
        actionClass: 'bg-green-600 hover:bg-green-700',
        onConfirm: handleRestore
      }
    }

    const config = configs[type]

    return (
      <div className={isRevenueSchedulesSize ? "px-6 py-5" : "p-6"}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex-shrink-0 w-10 h-10 ${config.bgColor} rounded-full flex items-center justify-center`}>
            {config.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {config.title}
            </h3>
            <p className="text-sm text-gray-600">
              {config.description}
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{effectiveEntityName}</p>
              <p className="text-sm text-gray-600">{entity}</p>
            </div>
          </div>
        </div>

        {!isRevenueSchedulesSize && (
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setStage('initial')}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={config.onConfirm}
              className={`px-4 py-2 text-white rounded-lg transition-colors ${config.actionClass}`}
            >
              {config.action}
            </button>
          </div>
        )}
      </div>
    )
  }
  const renderLoadingStage = () => (
    <div className="p-6">
      <div className="flex items-center justify-center gap-3 py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-600">Processing...</p>
      </div>
    </div>
  )

  const renderSuccessStage = () => (
    <div className="p-6">
      <div className="flex items-center justify-center gap-3 py-8">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-green-600 font-medium">Operation completed successfully</p>
      </div>
    </div>
  )

  const renderErrorStage = () => (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
          <X className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Error</h3>
          <p className="max-h-64 overflow-y-auto text-sm text-red-600 whitespace-pre-line break-words">{error}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setStage('initial')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )

  return (
    <div className={isRevenueSchedulesSize
      ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4'
      : 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    }>
      <div className={isRevenueSchedulesSize
        ? 'flex h-[900px] w-full max-w-[1024px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl'
        : 'bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto'
      }>
        <div className={isRevenueSchedulesSize
          ? 'flex items-center justify-between border-b border-gray-200 px-6 py-4'
          : 'flex items-center justify-between p-4 border-b border-gray-200'
        }>
          <h2 className="text-lg font-semibold text-gray-900">
            {stage === 'constraints' ? 'Deletion Constraints' : 
             stage === 'confirm-permanent' ? 'Permanent Deletion' :
             stage === 'confirm-restore' ? 'Restore Record' :
             'Delete Record'}
          </h2>
          <button
            onClick={onClose}
            className={isRevenueSchedulesSize
              ? 'rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700'
              : 'text-gray-400 hover:text-gray-600 transition-colors'
            }
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={isRevenueSchedulesSize ? 'flex-1 overflow-y-auto' : ''}>
          {stage === 'initial' && renderInitialStage()}
          {stage === 'constraints' && renderConstraintsStage()}
          {stage === 'confirm-soft' && renderConfirmationStage('soft')}
          {stage === 'confirm-permanent' && renderConfirmationStage('permanent')}
          {stage === 'confirm-restore' && renderConfirmationStage('restore')}
          {stage === 'loading' && renderLoadingStage()}
          {stage === 'success' && renderSuccessStage()}
          {stage === 'error' && renderErrorStage()}
        </div>

        {isRevenueSchedulesSize && stage === 'initial' && note && (hasMultipleEntities || !isDeleted) ? (
          <div className="mx-6 mb-3 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-600" title={note}>
            <Info className="mt-0.5 h-4 w-4 text-gray-400" aria-hidden="true" />
            <p>
              <span className="font-semibold text-gray-700">{initialFooterNoteLabel}:</span>{' '}
              {note}
            </p>
          </div>
        ) : null}

        {isRevenueSchedulesSize && stage === 'initial' && (hasMultipleEntities || !isDeleted) ? (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStage(isDeleted ? 'confirm-permanent' : 'confirm-soft')}
              disabled={initialFooterDisabled}
              className={initialFooterPrimaryLabel === 'Apply'
                ? 'inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300'
                : 'inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300'
              }
              title={disallowActiveDelete ? 'Deactivate the record before deleting' : reasonMissing ? 'Provide a reason before deleting' : 'Delete'}
            >
              {initialFooterPrimaryLabel}
            </button>
          </div>
        ) : null}

        {isRevenueSchedulesSize && (stage === 'confirm-soft' || stage === 'confirm-permanent' || stage === 'confirm-restore') ? (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={() => setStage('initial')}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            {stage === 'confirm-soft' && (
              <button
                type="button"
                onClick={handleSoftDelete}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                Delete
              </button>
            )}
            {stage === 'confirm-permanent' && (
              <button
                type="button"
                onClick={hasMultipleEntities ? handleBulkPermanentDelete : handlePermanentDelete}
                className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                Delete Permanently
              </button>
            )}
            {stage === 'confirm-restore' && (
              <button
                type="button"
                onClick={hasMultipleEntities ? handleBulkRestore : handleRestore}
                className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
              >
                Restore
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}










