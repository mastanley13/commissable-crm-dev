'use client'

import { useState, useEffect, type ReactNode } from 'react'
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
  // When set to "permanent", the initial flow uses permanent deletion copy and confirmation.
  deleteKind?: 'soft' | 'permanent'
  onSoftDelete: (entityId: string, bypassConstraints?: boolean, reason?: string) => Promise<{ success: boolean, constraints?: DeletionConstraint[], error?: string }>
  // Optional "Deactivate" action (mark inactive without deleting)
  onDeactivate?: (entityId: string, reason?: string) => Promise<{ success: boolean; error?: string }>
  onBulkDeactivate?: (entities: DeleteDialogEntitySummary[], reason?: string) => Promise<{ success: boolean; error?: string }>
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
type DialogPrimaryAction = 'deactivate' | 'delete'

export function TwoStageDeleteDialog({
  isOpen,
  onClose,
  entity,
  entityName,
  entityId,
  isDeleted = false,
  deleteKind = 'soft',
  onSoftDelete,
  onDeactivate,
  onBulkDeactivate,
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
  const initialDeleteStage: DialogStage = deleteKind === 'permanent' ? 'confirm-permanent' : 'confirm-soft'
  const [stage, setStage] = useState<DialogStage>('initial')
  const [primaryAction, setPrimaryAction] = useState<DialogPrimaryAction>('delete')
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
  const canShowActionSelection = Boolean(onDeactivate) && !isDeleted
  const initialFooterDisabled =
    reasonMissing ||
    (primaryAction === 'delete' && disallowActiveDelete) ||
    (primaryAction === 'deactivate' && !onDeactivate)
  const initialFooterPrimaryLabel = primaryActionLabel ?? (deleteKind === 'permanent' ? 'Delete Permanently' : 'Delete')
  const initialFooterNoteLabel = noteLabel ?? (entity === 'Account' ? 'Legend' : 'Note')
  const initialFooterEffectiveLabel = canShowActionSelection
    ? (primaryAction === 'delete' ? (deleteKind === 'permanent' ? 'Delete Permanently' : 'Delete') : 'Deactivate')
    : initialFooterPrimaryLabel
  const initialFooterEffectiveTitle =
    reasonMissing
      ? 'Provide a reason before proceeding'
      : primaryAction === 'delete' && disallowActiveDelete
        ? 'Deactivate the record before deleting'
        : primaryAction === 'deactivate' && !onDeactivate
          ? 'Deactivation is not available for this record'
          : initialFooterEffectiveLabel

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStage('initial')
      setConstraints([])
      setError('')
      setBypassConstraints(false)
      setReason('')
      setPrimaryAction(disallowActiveDelete && onDeactivate ? 'deactivate' : 'delete')
    }
  }, [disallowActiveDelete, isOpen, onDeactivate])

  if (!isOpen) return null

  const renderActionSelection = () => {
    if (!canShowActionSelection) return null

    return (
      <div>
        <label className="block text-xs font-semibold text-gray-700">
          Action<span className="ml-1 text-red-500">*</span>
        </label>
        <div className="mt-2 flex items-center gap-6 text-xs text-gray-700">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="deactivate-delete-action"
              checked={primaryAction === 'deactivate'}
              onChange={() => setPrimaryAction('deactivate')}
              className="h-4 w-4 accent-primary-600"
            />
            Deactivate
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="deactivate-delete-action"
              checked={primaryAction === 'delete'}
              onChange={() => setPrimaryAction('delete')}
              className="h-4 w-4 accent-primary-600"
            />
            Delete
          </label>
        </div>
      </div>
    )
  }

  const renderReasonAndAction = (): ReactNode => {
    if (!requireReason && !canShowActionSelection) return null

    if (isRevenueSchedulesSize && requireReason && canShowActionSelection) {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
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
          {renderActionSelection()}
        </div>
      )
    }

    return (
      <>
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
        {canShowActionSelection ? (
          <div className={requireReason ? "mt-4" : ""}>
            {renderActionSelection()}
          </div>
        ) : null}
      </>
    )
  }

  const handleDeactivate = async () => {
    if (!onDeactivate) return

    setStage('loading')
    setError('')

    try {
      const result = await onDeactivate(entityId, reasonTrimmed)

      if (result.success) {
        setStage('success')
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        setError(result.error || 'Failed to deactivate record')
        setStage('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStage('error')
    }
  }

  const handleBulkDeactivate = async () => {
    if (!multipleEntities || multipleEntities.length === 0) {
      setError('No records selected to deactivate')
      setStage('error')
      return
    }

    if (!onDeactivate) {
      setError('Deactivate handler is missing')
      setStage('error')
      return
    }

    setStage('loading')
    setError('')

    try {
      if (onBulkDeactivate) {
        const result = await onBulkDeactivate(multipleEntities, reasonTrimmed)
        if (result.success) {
          setStage('success')
          setTimeout(() => onClose(), 1500)
          return
        }
        setError(result.error || 'Failed to deactivate records')
        setStage('error')
        return
      }

      const targets = multipleEntities.map(entity => entity.id)
      const entityNameById = new Map(multipleEntities.map(entity => [entity.id, entity.name]))
      const results = await Promise.allSettled(
        targets.map(id => onDeactivate(id, reasonTrimmed)),
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
          failures.push({ id, name, error: result.value.error || 'Failed to deactivate record' })
        }
      })

      if (failures.length === 0) {
        setStage('success')
        setTimeout(() => onClose(), 1500)
        return
      }

      const preview = failures
        .slice(0, 5)
        .map(item => `- ${item.name}: ${item.error}`)
        .join('\n')

      setError(
        `${failures.length} of ${targets.length} ${targets.length === 1 ? entity.toLowerCase() : lowerPluralLabel} could not be deactivated.\n\n${preview}` +
          (failures.length > 5 ? `\n- and ${failures.length - 5} more` : ''),
      )
      setStage('error')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStage('error')
    }
  }

  type SelectedTableColumn = {
    header: string
    render: (item: DeleteDialogEntitySummary) => ReactNode
  }

  const SelectedTableCheckboxCell = ({ title }: { title?: string }) => (
    <div className="flex items-center justify-center gap-2 pr-2" title={title}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-400 text-primary-600 accent-primary-600"
        checked
        onChange={() => {}}
        aria-label="Selected"
      />
    </div>
  )

  const renderSelectedGridTable = ({
    items,
    minWidth = 880,
    gridCols,
    columns,
  }: {
    items: DeleteDialogEntitySummary[]
    minWidth?: number
    gridCols: string
    columns: SelectedTableColumn[]
  }) => (
    <div className="mt-3 h-56 overflow-y-auto rounded-lg border border-gray-200">
      <div style={{ minWidth }}>
        <div className={`grid ${gridCols} border-b bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500`}>
          <div className="text-center">Selected</div>
          {columns.map(col => (
            <div key={col.header}>{col.header}</div>
          ))}
        </div>
        {items.map(item => (
          <div
            key={item.id}
            title={`ID: ${item.id}`}
            className={`grid ${gridCols} items-center border-b px-3 py-2 text-xs text-gray-700 last:border-b-0`}
          >
            <SelectedTableCheckboxCell />
            {columns.map(col => (
              <div key={col.header} className="truncate">
                {col.render(item) || '--'}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  const renderSelectedAccountsTable = (items: DeleteDialogEntitySummary[]) =>
    renderSelectedGridTable({
      items,
      minWidth: 880,
      gridCols: "grid-cols-[auto_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,2fr)_minmax(0,1.4fr)]",
      columns: [
        { header: "Account Name", render: item => <span className="font-semibold text-gray-900">{item.name || "--"}</span> },
        { header: "Account Type", render: item => item.accountType || "--" },
        { header: "Legal Name", render: item => item.legalName || "--" },
        { header: "Account Owner", render: item => item.accountOwner || "--" },
      ],
    })

  const renderSelectedContactsTable = (items: DeleteDialogEntitySummary[]) =>
    renderSelectedGridTable({
      items,
      minWidth: 880,
      gridCols: "grid-cols-[auto_minmax(0,2.2fr)_minmax(0,2.3fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]",
      columns: [
        { header: "Contact Name", render: item => <span className="font-semibold text-gray-900">{item.name || "--"}</span> },
        { header: "Email", render: item => item.email || "--" },
        { header: "Work Phone", render: item => item.workPhone || "--" },
        { header: "Mobile", render: item => item.mobile || "--" },
      ],
    })

  const renderSelectedRolesTable = (items: DeleteDialogEntitySummary[]) =>
    renderSelectedGridTable({
      items,
      minWidth: 880,
      gridCols: "grid-cols-[auto_minmax(0,1.2fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]",
      columns: [
        { header: "Role", render: item => item.roleName || item.subtitle || "--" },
        { header: "Full Name", render: item => <span className="font-semibold text-gray-900">{item.name || "--"}</span> },
        { header: "Email", render: item => item.email || "--" },
        { header: "Work Phone", render: item => item.workPhone || "--" },
        { header: "Mobile", render: item => item.mobile || "--" },
      ],
    })

  const renderSelectedGenericTable = (items: DeleteDialogEntitySummary[]) =>
    renderSelectedGridTable({
      items,
      minWidth: 880,
      gridCols: "grid-cols-[auto_minmax(0,2.2fr)_minmax(0,2.8fr)]",
      columns: [
        { header: "Name", render: item => <span className="font-semibold text-gray-900">{item.name || "--"}</span> },
        { header: "Details", render: item => item.subtitle || "--" },
      ],
    })

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
      const showContactsTable = entity === 'Contact'
      const showRolesTable = entity === 'Opportunity Role' || entity === 'OpportunityRole' || entity === 'Role'
      const bulkDescription = isDeleted
        ? `This will permanently remove the selected ${lowerPluralLabel}. This action cannot be undone.`
        : canShowActionSelection
          ? primaryAction === 'delete'
            ? deleteKind === 'permanent'
              ? `This action will permanently remove the selected ${lowerPluralLabel}. This action cannot be undone.`
              : `This action will delete the selected ${lowerPluralLabel}. You can restore them later if needed.`
            : `This action will deactivate the selected ${lowerPluralLabel}. You can reactivate them later if needed.`
          : deleteKind === 'permanent'
            ? `This action will permanently remove the selected ${lowerPluralLabel}. This action cannot be undone.`
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

          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Selected {pluralLabel} ({multipleEntities!.length})
            </p>
            {showAccountsTable
              ? renderSelectedAccountsTable(multipleEntities!)
              : showContactsTable
                ? renderSelectedContactsTable(multipleEntities!)
                : showRolesTable
                  ? renderSelectedRolesTable(multipleEntities!)
                  : renderSelectedGenericTable(multipleEntities!)}
          </div>

          {renderReasonAndAction()}

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
                onClick={() => setStage(isDeleted ? 'confirm-permanent' : initialDeleteStage)}
                disabled={initialFooterDisabled}
                className={`px-4 py-2 rounded-lg transition-colors ${initialFooterDisabled
                  ? 'bg-red-400 text-white opacity-60 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'}`}
                title={initialFooterEffectiveTitle}
              >
                {initialFooterEffectiveLabel}
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
              {canShowActionSelection
                ? primaryAction === 'delete'
                  ? deleteKind === 'permanent'
                    ? `This action will permanently remove the ${entity.toLowerCase()}. This action cannot be undone.`
                    : `This action will delete the ${entity.toLowerCase()}. You can restore it later if needed.`
                  : `This action will deactivate the ${entity.toLowerCase()}. You can reactivate it later if needed.`
                : deleteKind === 'permanent'
                  ? `This action will permanently remove the ${entity.toLowerCase()}. This action cannot be undone.`
                  : `This action will deactivate the ${entity.toLowerCase()}. You can restore it later if needed.`}
            </p>
          </div>
        </div>

        {isRevenueSchedulesSize ? (
          <div className="mb-6">
            <p className="text-sm text-gray-600">Selected {pluralLabel} (1)</p>
            {entity === 'Account' && entitySummary
              ? renderSelectedAccountsTable([entitySummary])
              : entity === 'Contact' && entitySummary
                ? renderSelectedContactsTable([entitySummary])
                : entity === 'Opportunity Role' || entity === 'OpportunityRole' || entity === 'Role'
                  ? renderSelectedRolesTable([entitySummary ?? { id: entityId, name: effectiveEntityName }])
                  : renderSelectedGenericTable([entitySummary ?? { id: entityId, name: effectiveEntityName }])}
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
              onClick={() => setStage(initialDeleteStage)}
              disabled={initialFooterDisabled}
              className={`px-4 py-2 rounded-lg transition-colors ${initialFooterDisabled
                ? 'bg-red-400 text-white opacity-60 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'}`}
              title={initialFooterEffectiveTitle}
            >
              {initialFooterEffectiveLabel}
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
      const softConfig =
        primaryAction === 'deactivate'
          ? {
              title: 'Confirm Deactivation',
              icon: <Trash2 className="h-5 w-5 text-red-600" />,
              bgColor: 'bg-red-100',
              description: `This will deactivate the selected ${lowerPluralLabel}. You can reactivate them later if needed.`,
              action: 'Deactivate',
              actionClass: 'bg-red-600 hover:bg-red-700',
              onConfirm: handleBulkDeactivate
            }
          : {
              title: 'Confirm Deletion',
              icon: <Trash2 className="h-5 w-5 text-red-600" />,
              bgColor: 'bg-red-100',
              description: `This will delete the selected ${lowerPluralLabel}. You can restore them later if needed.`,
              action: 'Delete',
              actionClass: 'bg-red-600 hover:bg-red-700',
              onConfirm: handleSoftDelete
            }
      const configs = {
        soft: {
          ...softConfig
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

          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Selected {pluralLabel} ({multipleEntities!.length})
            </p>
            {entity === 'Account'
              ? renderSelectedAccountsTable(multipleEntities!)
              : entity === 'Contact'
                ? renderSelectedContactsTable(multipleEntities!)
                : entity === 'Opportunity Role' || entity === 'OpportunityRole' || entity === 'Role'
                  ? renderSelectedRolesTable(multipleEntities!)
                  : renderSelectedGenericTable(multipleEntities!)}
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

    const softConfig =
      primaryAction === 'deactivate'
        ? {
            title: `Confirm Deactivate ${entity}`,
            icon: <Trash2 className="h-5 w-5 text-red-600" />,
            bgColor: 'bg-red-100',
            description: `This will deactivate the ${entity.toLowerCase()}. You can reactivate it later if needed.`,
            action: 'Deactivate',
            actionClass: 'bg-red-600 hover:bg-red-700',
            onConfirm: handleDeactivate
          }
        : {
            title: `Confirm Delete ${entity}`,
            icon: <Trash2 className="h-5 w-5 text-red-600" />,
            bgColor: 'bg-red-100',
            description: `This will delete the ${entity.toLowerCase()}. You can restore it later if needed.`,
            action: 'Delete',
            actionClass: 'bg-red-600 hover:bg-red-700',
            onConfirm: handleSoftDelete
          }

    const configs = {
      soft: {
        ...softConfig
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

        {isRevenueSchedulesSize ? (
          <div className="mb-6">
            <p className="text-sm text-gray-600">Selected {pluralLabel} (1)</p>
            {entity === 'Account' && entitySummary
              ? renderSelectedAccountsTable([entitySummary])
              : entity === 'Contact' && entitySummary
                ? renderSelectedContactsTable([entitySummary])
                : entity === 'Opportunity Role' || entity === 'OpportunityRole' || entity === 'Role'
                  ? renderSelectedRolesTable([entitySummary ?? { id: entityId, name: effectiveEntityName }])
                  : renderSelectedGenericTable([entitySummary ?? { id: entityId, name: effectiveEntityName }])}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{effectiveEntityName}</p>
                <p className="text-sm text-gray-600">{entity}</p>
              </div>
            </div>
          </div>
        )}

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
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              title={initialFooterEffectiveTitle}
            >
              {initialFooterEffectiveLabel}
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
                onClick={primaryAction === 'deactivate'
                  ? (hasMultipleEntities ? handleBulkDeactivate : handleDeactivate)
                  : handleSoftDelete}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {primaryAction === 'deactivate' ? 'Deactivate' : 'Delete'}
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










