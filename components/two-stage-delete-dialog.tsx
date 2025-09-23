'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2, RotateCcw, Shield, X, ChevronRight } from 'lucide-react'
import { DeletionConstraint } from '@/lib/deletion'

export interface TwoStageDeleteDialogProps {
  isOpen: boolean
  onClose: () => void
  entity: string
  entityName: string
  entityId: string
  isDeleted?: boolean
  onSoftDelete: (entityId: string, bypassConstraints?: boolean) => Promise<{ success: boolean, constraints?: DeletionConstraint[], error?: string }>
  onPermanentDelete: (entityId: string) => Promise<{ success: boolean, error?: string }>
  onRestore?: (entityId: string) => Promise<{ success: boolean, error?: string }>
  userCanPermanentDelete?: boolean
}

type DialogStage = 'initial' | 'constraints' | 'confirm-soft' | 'confirm-permanent' | 'loading' | 'success' | 'error'

export function TwoStageDeleteDialog({
  isOpen,
  onClose,
  entity,
  entityName,
  entityId,
  isDeleted = false,
  onSoftDelete,
  onPermanentDelete,
  onRestore,
  userCanPermanentDelete = false
}: TwoStageDeleteDialogProps) {
  const [stage, setStage] = useState<DialogStage>('initial')
  const [constraints, setConstraints] = useState<DeletionConstraint[]>([])
  const [error, setError] = useState<string>('')
  const [bypassConstraints, setBypassConstraints] = useState(false)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStage('initial')
      setConstraints([])
      setError('')
      setBypassConstraints(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSoftDelete = async () => {
    setStage('loading')
    setError('')

    try {
      const result = await onSoftDelete(entityId, bypassConstraints)
      
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
      const result = await onPermanentDelete(entityId)
      
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
    if (isDeleted) {
      return (
        <div className="p-6">
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
                <p className="font-medium text-gray-900">{entityName}</p>
                <p className="text-sm text-gray-600">Status: Deleted</p>
              </div>
              <div className="text-sm text-gray-500">
                ID: {entityId.slice(0, 8)}...
              </div>
            </div>
          </div>

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
      <div className="p-6">
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

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{entityName}</p>
              <p className="text-sm text-gray-600">{entity}</p>
            </div>
            <div className="text-sm text-gray-500">
              ID: {entityId.slice(0, 8)}...
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => setStage('confirm-soft')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
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
            This {entity.toLowerCase()} has dependencies that may prevent deletion.
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
      <div className="p-6">
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
              <p className="font-medium text-gray-900">{entityName}</p>
              <p className="text-sm text-gray-600">{entity}</p>
            </div>
          </div>
        </div>

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
          <p className="text-sm text-red-600">{error}</p>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {stage === 'constraints' ? 'Deletion Constraints' : 
             stage === 'confirm-permanent' ? 'Permanent Deletion' :
             stage === 'confirm-restore' ? 'Restore Record' :
             'Delete Record'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {stage === 'initial' && renderInitialStage()}
        {stage === 'constraints' && renderConstraintsStage()}
        {stage === 'confirm-soft' && renderConfirmationStage('soft')}
        {stage === 'confirm-permanent' && renderConfirmationStage('permanent')}
        {stage === 'confirm-restore' && renderConfirmationStage('restore')}
        {stage === 'loading' && renderLoadingStage()}
        {stage === 'success' && renderSuccessStage()}
        {stage === 'error' && renderErrorStage()}
      </div>
    </div>
  )
}