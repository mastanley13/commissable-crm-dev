'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ListHeader, type ColumnFilter } from '@/components/list-header'
import { DynamicTable, type Column, type PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { OpportunityBulkActionBar } from '@/components/opportunity-bulk-action-bar'
import { OpportunityBulkOwnerModal } from '@/components/opportunity-bulk-owner-modal'
import { OpportunityBulkStatusModal } from '@/components/opportunity-bulk-status-modal'
import { OpportunityEditModal } from '@/components/opportunity-edit-modal'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import { useToasts } from '@/components/toast'
import type { DeletionConstraint } from '@/lib/deletion'
import { OpportunityStatus } from '@prisma/client'
import { Check, Edit, Trash2 } from 'lucide-react'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function formatCurrency(value?: number | null) {
  return currencyFormatter.format(value ?? 0)
}

function formatDate(value?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

const OPPORTUNITY_FILTER_OPTIONS = [
  { id: 'opportunityName', label: 'Opportunity Name' },
  { id: 'closeDate', label: 'Close Date' },
  { id: 'stage', label: 'Opportunity Stage' },
  { id: 'owner', label: 'Owner' },
  { id: 'accountLegalName', label: 'Account Legal Name' },
  { id: 'orderIdHouse', label: 'Order ID - House' },
  { id: 'accountIdVendor', label: 'Account ID - Vendor' },
  { id: 'customerIdVendor', label: 'Customer ID - Vendor' },
  { id: 'locationId', label: 'Location ID' },
  { id: 'opportunityId', label: 'Opportunity ID' },
  { id: 'referredBy', label: 'Lead Source' },
  { id: 'status', label: 'Status' },
]

const BASE_COLUMNS: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: 'multi-action',
  },
  {
    id: 'closeDate',
    label: 'Close Date',
    width: 160,
    minWidth: 140,
    maxWidth: 220,
    sortable: true,
    accessor: 'closeDate',
  },
  {
    id: 'accountLegalName',
    label: 'Account Legal Name',
    width: 220,
    minWidth: 180,
    maxWidth: 320,
    sortable: true,
    accessor: 'accountLegalName',
  },
  {
    id: 'opportunityName',
    label: 'Opportunity Name',
    width: 220,
    minWidth: 160,
    maxWidth: 320,
    sortable: true,
    accessor: 'opportunityName',
  },
  {
    id: 'stage',
    label: 'Opportunity Stage',
    width: 180,
    minWidth: 140,
    maxWidth: 240,
    sortable: true,
    accessor: 'stage',
  },
  {
    id: 'orderIdHouse',
    label: 'Order ID - House',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    accessor: 'orderIdHouse',
  },
  {
    id: 'accountIdVendor',
    label: 'Account ID - Vendor',
    width: 180,
    minWidth: 140,
    maxWidth: 260,
    accessor: 'accountIdVendor',
    hidden: true,
  },
  {
    id: 'customerIdVendor',
    label: 'Customer ID - Vendor',
    width: 180,
    minWidth: 140,
    maxWidth: 260,
    accessor: 'customerIdVendor',
    hidden: true,
  },
  {
    id: 'locationId',
    label: 'Location ID',
    width: 160,
    minWidth: 120,
    maxWidth: 220,
    accessor: 'locationId',
    hidden: true,
  },
  {
    id: 'opportunityId',
    label: 'Opportunity ID',
    width: 180,
    minWidth: 140,
    maxWidth: 260,
    accessor: 'opportunityId',
    hidden: true,
  },
  {
    id: 'distributorName',
    label: 'Distributor Name',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    accessor: 'distributorName',
  },
  {
    id: 'vendorName',
    label: 'Vendor Name',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    accessor: 'vendorName',
  },
  {
    id: 'expectedUsageGrossTotal',
    label: 'Expected Usage Gross-Total',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    accessor: 'expectedUsageGrossTotal',
  },
  {
    id: 'expectedCommissionGrossTotal',
    label: 'Expected Commission Gross-Total',
    width: 220,
    minWidth: 180,
    maxWidth: 320,
    accessor: 'expectedCommissionGrossTotal',
  },
  {
    id: 'owner',
    label: 'Opportunity Owner',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    sortable: true,
    accessor: 'owner',
  },
  {
    id: 'referredBy',
    label: 'Referred By',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    accessor: 'referredBy',
    hidden: true,
  },
]
interface OpportunityRow {
  id: string
  select?: boolean
  active: boolean
  status?: OpportunityStatus | string | null
  orderIdHouse?: string | null
  accountLegalName?: string | null
  opportunityName: string
  stage?: string | null
  distributorName?: string | null
  vendorName?: string | null
  referredBy?: string | null
  subAgent?: string | null
  owner?: string | null
  ownerId?: string | null
  estimatedCloseDate?: string | null
  closeDate?: string | null
  expectedUsageGrossTotal?: number | null
  expectedCommissionGrossTotal?: number | null
  accountIdVendor?: string | null
  customerIdVendor?: string | null
  locationId?: string | null
  orderIdVendor?: string | null
  opportunityId?: string | null
  isDeleted?: boolean
}

interface OpportunityListResponse {
  data?: OpportunityRow[]
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages?: number
  }
}

const DEFAULT_PAGINATION: PaginationInfo = {
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 1,
}

const TABLE_BOTTOM_RESERVE = 140
const TABLE_MIN_BODY_HEIGHT = 320

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([])
  const [selectedOpportunities, setSelectedOpportunities] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGINATION.page)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGINATION.pageSize)
  const [pagination, setPagination] = useState<PaginationInfo>(DEFAULT_PAGINATION)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])
  const [sortState, setSortState] = useState<{ columnId: string; direction: 'asc' | 'desc' }>({
    columnId: 'closeDate',
    direction: 'desc',
  })
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [showBulkOwnerModal, setShowBulkOwnerModal] = useState(false)
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false)
  const [ownerOptions, setOwnerOptions] = useState<Array<{ value: string; label: string }>>([])
  const [opportunityToEdit, setOpportunityToEdit] = useState<OpportunityRow | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [opportunityToDelete, setOpportunityToDelete] = useState<OpportunityRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<OpportunityRow[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [updatingOpportunityIds, setUpdatingOpportunityIds] = useState<Set<string>>(new Set())
  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)

  const {
    showError,
    showSuccess,
    showInfo,
    ToastContainer,
  } = useToasts()

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    saving: preferenceSaving,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    saveChanges,
    saveChangesOnModalClose,
  } = useTablePreferences('opportunities:list', BASE_COLUMNS)

  const normalizedPreferenceColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'estimatedCloseDate') {
        return {
          ...column,
          id: 'closeDate',
          accessor: 'closeDate',
          label: column.label === 'Estimated Close Date' ? 'Close Date' : column.label,
        }
      }
      return column
    })
  }, [preferenceColumns])

  const tableLoading = loading || preferenceLoading
  const fetchOpportunities = useCallback(
    async (page: number, size: number) => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(size),
          status: statusFilter,
          sort: sortState.columnId,
          direction: sortState.direction,
        })

        if (searchQuery.trim().length > 0) {
          params.set('q', searchQuery.trim())
        }

        if (columnFilters.length > 0) {
          params.set('filters', JSON.stringify(columnFilters))
        }

        const response = await fetch(`/api/opportunities?${params.toString()}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Failed to load opportunities')
        }

        const payload = (await response.json().catch(() => null)) as OpportunityListResponse | null
        const data = Array.isArray(payload?.data) ? payload!.data : []

        setOpportunities(data)
        setSelectedOpportunities((previous) =>
          previous.filter((id) => data.some((row) => row.id === id)),
        )

        const paginationPayload = payload?.pagination
        if (paginationPayload) {
          setPagination({
            page: paginationPayload.page,
            pageSize: paginationPayload.pageSize,
            total: paginationPayload.total,
            totalPages:
              paginationPayload.totalPages ??
              Math.max(1, Math.ceil(paginationPayload.total / paginationPayload.pageSize)),
          })
        } else {
          setPagination({
            page,
            pageSize: size,
            total: data.length,
            totalPages: Math.max(1, Math.ceil(data.length / size)),
          })
        }
      } catch (err) {
        console.error('Failed to load opportunities', err)
        const message = err instanceof Error ? err.message : 'Failed to load opportunities'
        setError(message)
        showError('Unable to load opportunities', message)
        setOpportunities([])
        setPagination({
          page,
          pageSize: size,
          total: 0,
          totalPages: 1,
        })
      } finally {
        setLoading(false)
      }
    },
    [columnFilters, searchQuery, showError, sortState.columnId, sortState.direction, statusFilter],
  )

  useEffect(() => {
    void fetchOpportunities(currentPage, pageSize)
  }, [fetchOpportunities, currentPage, pageSize])

  const reloadOpportunities = useCallback(() => {
    void fetchOpportunities(currentPage, pageSize)
  }, [fetchOpportunities, currentPage, pageSize])

  const measureTableArea = useCallback(() => {
    const node = tableAreaNodeRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    const rect = node.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    if (viewportHeight <= 0) {
      return
    }

    const available = viewportHeight - rect.top - TABLE_BOTTOM_RESERVE
    if (!Number.isFinite(available)) {
      return
    }

    const nextHeight = Math.max(TABLE_MIN_BODY_HEIGHT, Math.floor(available))
    if (nextHeight !== tableBodyHeight) {
      setTableBodyHeight(nextHeight)
    }
  }, [tableBodyHeight])

  const tableAreaRef = useCallback(
    (node: HTMLDivElement | null) => {
      tableAreaNodeRef.current = node
      if (node) {
        window.requestAnimationFrame(() => {
          measureTableArea()
        })
      }
    },
    [measureTableArea],
  )

  useLayoutEffect(() => {
    measureTableArea()
  }, [measureTableArea])

  useEffect(() => {
    const handleResize = () => measureTableArea()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [measureTableArea])

  useEffect(() => {
    window.requestAnimationFrame(() => {
      measureTableArea()
    })
  }, [
    measureTableArea,
    opportunities.length,
    selectedOpportunities.length,
    tableLoading,
    pagination.page,
    pagination.pageSize,
  ])

  useEffect(() => {
    let active = true

    fetch('/api/admin/users?limit=100', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to load owners')
        }
        const payload = await response.json().catch(() => null)
        const items = Array.isArray(payload?.data?.users) ? payload.data.users : []
        if (!active) {
          return
        }
        setOwnerOptions(
          items.map((user: any) => ({
            value: user.id,
            label: user.fullName || user.email || 'User',
          })),
        )
      })
      .catch((err) => {
        console.error('Unable to load opportunity owners', err)
      })

    return () => {
      active = false
    }
  }, [])
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }, [])

  const handleStatusFilterChange = useCallback((value: string) => {
    const next: 'active' | 'inactive' = value === 'inactive' ? 'inactive' : 'active'
    setStatusFilter(next)
    setCurrentPage(1)
  }, [])

  const handleColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    setColumnFilters(filters)
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  const handleSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    if (columnId === 'multi-action') {
      return
    }
    setSortState({ columnId, direction })
    setCurrentPage(1)
  }, [])

  const handleOpportunitySelect = useCallback((opportunityId: string, selected: boolean) => {
    setSelectedOpportunities((previous) => {
      if (selected) {
        if (previous.includes(opportunityId)) {
          return previous
        }
        return [...previous, opportunityId]
      }
      return previous.filter((id) => id !== opportunityId)
    })
  }, [])

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      setSelectedOpportunities((previous) => {
        if (selected) {
          const ids = opportunities.map((row) => row.id)
          const merged = new Set([...previous, ...ids])
          return Array.from(merged)
        }

        const idsToRemove = new Set(opportunities.map((row) => row.id))
        return previous.filter((id) => !idsToRemove.has(id))
      })
    },
    [opportunities],
  )

  const handleRowClick = useCallback((row: OpportunityRow) => {
    setOpportunityToEdit(row)
    setShowEditModal(true)
  }, [])

  const handleOpportunityEdit = useCallback((row: OpportunityRow) => {
    setOpportunityToEdit(row)
    setShowEditModal(true)
  }, [])

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false)
    setOpportunityToEdit(null)
  }, [])

  const handleEditSuccess = useCallback(() => {
    handleCloseEditModal()
    reloadOpportunities()
  }, [handleCloseEditModal, reloadOpportunities])

  const openBulkDeleteDialog = useCallback(() => {
    const targets = opportunities.filter((row) => selectedOpportunities.includes(row.id))
    if (targets.length === 0) {
      showError('No opportunities selected', 'Select at least one opportunity to delete.')
      return
    }
    setBulkDeleteTargets(targets)
    setOpportunityToDelete(null)
    setShowDeleteDialog(true)
  }, [opportunities, selectedOpportunities, showError])

  const requestOpportunityDelete = useCallback((row: OpportunityRow) => {
    setBulkDeleteTargets([])
    setOpportunityToDelete(row)
    setShowDeleteDialog(true)
  }, [])

  const closeDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false)
    setBulkDeleteTargets([])
    setOpportunityToDelete(null)
  }, [])

  const handleCreateOpportunity = useCallback(() => {
    showInfo('Create opportunity', 'Opportunity creation will be available soon.')
  }, [showInfo])

  const handleBulkExportCsv = useCallback(() => {
    const rows =
      selectedOpportunities.length > 0
        ? opportunities.filter((row) => selectedOpportunities.includes(row.id))
        : opportunities

    if (rows.length === 0) {
      showError('Nothing to export', 'There are no opportunities to export.')
      return
    }

    const header = [
      'Close Date',
      'Account Legal Name',
      'Opportunity Name',
      'Stage',
      'Order ID - House',
      'Account ID - Vendor',
      'Customer ID - Vendor',
      'Location ID',
      'Opportunity ID',
      'Owner',
      'Expected Usage',
      'Expected Commission',
      'Distributor',
      'Vendor',
      'Status',
    ]

    const lines = [header.join(',')]

    rows.forEach((row) => {
      const cells = [
        formatDate(row.closeDate ?? row.estimatedCloseDate ?? null),
        row.accountLegalName ?? '',
        row.opportunityName,
        row.stage ?? '',
        row.orderIdHouse ?? '',
        row.accountIdVendor ?? '',
        row.customerIdVendor ?? '',
        row.locationId ?? '',
        row.opportunityId ?? (typeof row.id === 'string' ? row.id : ''),
        row.owner ?? '',
        formatCurrency(row.expectedUsageGrossTotal ?? 0),
        formatCurrency(row.expectedCommissionGrossTotal ?? 0),
        row.distributorName ?? '',
        row.vendorName ?? '',
        typeof row.status === 'string' ? row.status : row.status ?? '',
      ]

      lines.push(
        cells
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
    })

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0]
    link.href = url
    link.download = `opportunities-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    showSuccess(
      `Exported ${rows.length} opportunity${rows.length === 1 ? '' : 'ies'}`,
      'Check your downloads for the CSV file.',
    )
  }, [opportunities, selectedOpportunities, showError, showSuccess])
  const handleOpportunityToggleActive = useCallback(
    async (row: OpportunityRow, nextValue: boolean) => {
      const opportunityId = row.id
      setUpdatingOpportunityIds((previous) => {
        const next = new Set(previous)
        next.add(opportunityId)
        return next
      })

      try {
        const response = await fetch(`/api/opportunities/${opportunityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: nextValue }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Failed to update opportunity status')
        }

        const payload = await response.json().catch(() => null)
        const updatedRow = (payload?.data ?? null) as OpportunityRow | null

        setOpportunities((previous) =>
          previous.map((current) =>
            current.id === opportunityId
              ? {
                  ...current,
                  ...(updatedRow ?? {}),
                  active: nextValue,
                  status: nextValue ? OpportunityStatus.Open : OpportunityStatus.Lost,
                  isDeleted: !nextValue,
                }
              : current,
          ),
        )

        showSuccess(
          `Opportunity ${nextValue ? 'activated' : 'deactivated'}`,
          `The opportunity has been marked ${nextValue ? 'active' : 'inactive'}.`,
        )
      } catch (err) {
        console.error('Failed to toggle opportunity status', err)
        showError(
          'Unable to update opportunity',
          err instanceof Error ? err.message : 'Please try again later.',
        )
      } finally {
        setUpdatingOpportunityIds((previous) => {
          const next = new Set(previous)
          next.delete(opportunityId)
          return next
        })
      }
    },
    [showError, showSuccess],
  )

  const softDeleteOpportunityById = useCallback(
    async (opportunityId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/opportunities/${opportunityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          return { success: false, error: payload?.error ?? 'Failed to update opportunity status' }
        }

        const payload = await response.json().catch(() => null)
        const updatedRow = (payload?.data ?? null) as OpportunityRow | null

        setOpportunities((previous) =>
          previous.map((row) =>
            row.id === opportunityId
              ? {
                  ...row,
                  ...(updatedRow ?? {}),
                  active: false,
                  status: OpportunityStatus.Lost,
                  isDeleted: true,
                }
              : row,
          ),
        )

        setSelectedOpportunities((previous) => previous.filter((id) => id !== opportunityId))

        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update opportunity status'
        return { success: false, error: message }
      }
    },
    [],
  )

  const restoreOpportunityById = useCallback(
    async (opportunityId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/opportunities/${opportunityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: true }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          return { success: false, error: payload?.error ?? 'Failed to restore opportunity' }
        }

        const payload = await response.json().catch(() => null)
        const updatedRow = (payload?.data ?? null) as OpportunityRow | null

        setOpportunities((previous) =>
          previous.map((row) =>
            row.id === opportunityId
              ? {
                  ...row,
                  ...(updatedRow ?? {}),
                  active: true,
                  status: OpportunityStatus.Open,
                  isDeleted: false,
                }
              : row,
          ),
        )

        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to restore opportunity'
        return { success: false, error: message }
      }
    },
    [],
  )

  const deleteOpportunityById = useCallback(
    async (opportunityId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/opportunities/${opportunityId}`, { method: 'DELETE' })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          return { success: false, error: payload?.error ?? 'Failed to delete opportunity' }
        }

        setOpportunities((previous) => previous.filter((row) => row.id !== opportunityId))
        setSelectedOpportunities((previous) => previous.filter((id) => id !== opportunityId))

        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to delete opportunity'
        return { success: false, error: message }
      }
    },
    [],
  )

  const handleOpportunitySoftDelete = useCallback(
    async (
      opportunityId: string,
      _bypassConstraints?: boolean,
    ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
      const result = await softDeleteOpportunityById(opportunityId)

      if (result.success) {
        showSuccess('Opportunity deleted', 'The opportunity has been marked as inactive.')
        reloadOpportunities()
      } else if (result.error) {
        showError('Failed to delete opportunity', result.error)
      }

      return result
    },
    [reloadOpportunities, showError, showSuccess, softDeleteOpportunityById],
  )

  const executeBulkOpportunitySoftDelete = useCallback(
    async (
      targets: OpportunityRow[],
      _bypassConstraints?: boolean,
    ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
      if (!targets || targets.length === 0) {
        return { success: false, error: 'No opportunities selected' }
      }

      setBulkActionLoading(true)

      try {
        const outcomes = await Promise.allSettled(
          targets.map((target) => softDeleteOpportunityById(target.id)),
        )

        const failures: Array<{ opportunity: OpportunityRow; message: string }> = []

        outcomes.forEach((result, index) => {
          const opportunity = targets[index]
          if (result.status === 'fulfilled') {
            if (!result.value.success) {
              failures.push({
                opportunity,
                message: result.value.error ?? 'Failed to delete opportunity',
              })
            }
          } else {
            const message =
              result.reason instanceof Error ? result.reason.message : 'Failed to delete opportunity'
            failures.push({ opportunity, message })
          }
        })

        if (failures.length === 0) {
          showSuccess(
            `Deleted ${targets.length} opportunity${targets.length === 1 ? '' : 'ies'}`,
            'The selected opportunities have been marked inactive.',
          )
          reloadOpportunities()
          return { success: true }
        }

        const detail = failures
          .map((item) => `${item.opportunity.opportunityName || 'Opportunity'}: ${item.message}`)
          .join('; ')
        showError('Failed to delete some opportunities', detail)
        return { success: false, error: detail }
      } finally {
        setBulkActionLoading(false)
      }
    },
    [reloadOpportunities, showError, showSuccess, softDeleteOpportunityById],
  )

  const handleBulkOpportunityOwnerUpdate = useCallback(
    async (ownerId: string | null) => {
      if (selectedOpportunities.length === 0) {
        showError('No opportunities selected', 'Select at least one opportunity to update.')
        return
      }

      setBulkActionLoading(true)

      try {
        const outcomes = await Promise.allSettled(
          selectedOpportunities.map(async (opportunityId) => {
            const response = await fetch(`/api/opportunities/${opportunityId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ownerId }),
            })

            if (!response.ok) {
              const payload = await response.json().catch(() => null)
              throw new Error(payload?.error ?? 'Failed to update opportunity owner')
            }

            return opportunityId
          }),
        )

        const successes: string[] = []
        const failures: Array<{ opportunityId: string; message: string }> = []

        outcomes.forEach((result, index) => {
          const opportunityId = selectedOpportunities[index]
          if (result.status === 'fulfilled') {
            successes.push(opportunityId)
          } else {
            const message =
              result.reason instanceof Error ? result.reason.message : 'Unexpected error'
            failures.push({ opportunityId, message })
          }
        })

        if (successes.length > 0) {
          const successSet = new Set(successes)
          const ownerOption = ownerId
            ? ownerOptions.find((owner) => owner.value === ownerId)
            : undefined
          const ownerLabel = ownerId ? ownerOption?.label ?? 'Selected owner' : 'Unassigned'

          setOpportunities((previous) =>
            previous.map((row) =>
              successSet.has(row.id)
                ? {
                    ...row,
                    ownerId: ownerId ?? null,
                    owner: ownerId ? ownerLabel : '',
                  }
                : row,
            ),
          )

          showSuccess(
            `Updated ${successes.length} opportunity${successes.length === 1 ? '' : 'ies'}`,
            `New owner: ${ownerLabel}.`,
          )
          reloadOpportunities()
        }

        if (failures.length > 0) {
          const nameMap = new Map(
            opportunities.map((row) => [row.id, row.opportunityName || 'Opportunity']),
          )
          const detail = failures
            .map((item) => `${nameMap.get(item.opportunityId) || 'Opportunity'}: ${item.message}`)
            .join('; ')
          showError('Failed to update owner for some opportunities', detail)
        }

        setSelectedOpportunities(failures.map((item) => item.opportunityId))
        if (failures.length === 0) {
          setShowBulkOwnerModal(false)
        }
      } catch (error) {
        console.error('Bulk owner update failed', error)
        showError(
          'Bulk owner update failed',
          error instanceof Error ? error.message : 'Unable to update opportunity owners.',
        )
      } finally {
        setBulkActionLoading(false)
      }
    },
    [opportunities, ownerOptions, reloadOpportunities, selectedOpportunities, showError, showSuccess],
  )

  const handleBulkOpportunityStatusUpdate = useCallback(
    async (isActive: boolean) => {
      if (selectedOpportunities.length === 0) {
        showError('No opportunities selected', 'Select at least one opportunity to update.')
        return
      }

      setBulkActionLoading(true)

      try {
        const statusValue = isActive ? OpportunityStatus.Open : OpportunityStatus.Lost

        const outcomes = await Promise.allSettled(
          selectedOpportunities.map(async (opportunityId) => {
            const response = await fetch(`/api/opportunities/${opportunityId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: statusValue }),
            })

            if (!response.ok) {
              const payload = await response.json().catch(() => null)
              throw new Error(payload?.error ?? 'Failed to update opportunity status')
            }

            return opportunityId
          }),
        )

        const successes: string[] = []
        const failures: Array<{ opportunityId: string; message: string }> = []

        outcomes.forEach((result, index) => {
          const opportunityId = selectedOpportunities[index]
          if (result.status === 'fulfilled') {
            successes.push(opportunityId)
          } else {
            const message =
              result.reason instanceof Error ? result.reason.message : 'Unexpected error'
            failures.push({ opportunityId, message })
          }
        })

        if (successes.length > 0) {
          const successSet = new Set(successes)
          setOpportunities((previous) =>
            previous.map((row) =>
              successSet.has(row.id)
                ? {
                    ...row,
                    active: isActive,
                    status: statusValue,
                    isDeleted: !isActive,
                  }
                : row,
            ),
          )

          const label = isActive ? 'active' : 'inactive'
          showSuccess(
            `Marked ${successes.length} opportunity${successes.length === 1 ? '' : 'ies'} as ${label}`,
            'The opportunity status has been updated.',
          )
          reloadOpportunities()
        }

        if (failures.length > 0) {
          const nameMap = new Map(
            opportunities.map((row) => [row.id, row.opportunityName || 'Opportunity']),
          )
          const detail = failures
            .map((item) => `${nameMap.get(item.opportunityId) || 'Opportunity'}: ${item.message}`)
            .join('; ')
          showError('Failed to update status for some opportunities', detail)
        }

        setSelectedOpportunities(failures.map((item) => item.opportunityId))
        if (failures.length === 0) {
          setShowBulkStatusModal(false)
        }
      } catch (error) {
        console.error('Bulk status update failed', error)
        showError(
          'Bulk status update failed',
          error instanceof Error ? error.message : 'Unable to update opportunity status.',
        )
      } finally {
        setBulkActionLoading(false)
      }
    },
    [opportunities, reloadOpportunities, selectedOpportunities, showError, showSuccess],
  )

  const handleOpportunityPermanentDelete = useCallback(
    async (opportunityId: string) => {
      const result = await deleteOpportunityById(opportunityId)

      if (result.success) {
        showSuccess('Opportunity deleted', 'The opportunity has been permanently deleted.')
        reloadOpportunities()
      } else if (result.error) {
        showError('Failed to delete opportunity', result.error)
      }

      return result
    },
    [deleteOpportunityById, reloadOpportunities, showError, showSuccess],
  )

  const handleOpportunityRestore = useCallback(
    async (opportunityId: string) => {
      const result = await restoreOpportunityById(opportunityId)

      if (result.success) {
        showSuccess('Opportunity restored', 'The opportunity has been marked active.')
        reloadOpportunities()
      } else if (result.error) {
        showError('Failed to restore opportunity', result.error)
      }

      return result
    },
    [reloadOpportunities, restoreOpportunityById, showError, showSuccess],
  )
  const tableColumns = useMemo(() => {
    return normalizedPreferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: OpportunityRow) => {
            const checked = selectedOpportunities.includes(row.id)
            const activeValue = !!row.active
            const isUpdating = updatingOpportunityIds.has(row.id)

            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label
                  className="flex cursor-pointer items-center justify-center"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select opportunity ${row.opportunityName || row.id}`}
                    onChange={() => handleOpportunitySelect(row.id, !checked)}
                  />
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      checked
                        ? 'border-primary-500 bg-primary-600 text-white'
                        : 'border-gray-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!isUpdating) {
                      void handleOpportunityToggleActive(row, !activeValue)
                    }
                  }}
                  className={`relative inline-flex cursor-pointer items-center rounded-full transition-opacity ${
                    isUpdating ? 'opacity-60' : ''
                  }`}
                  disabled={isUpdating}
                  title={activeValue ? 'Active' : 'Inactive'}
                >
                  <span
                    className={`h-5 w-9 rounded-full transition-colors duration-300 ease-in-out ${
                      activeValue ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ease-in-out ${
                        activeValue ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    className="rounded p-1 text-blue-500 transition-colors hover:text-blue-700"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleOpportunityEdit(row)
                    }}
                    aria-label="Edit opportunity"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className={`rounded p-1 transition-colors ${
                      activeValue ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'
                    }`}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      requestOpportunityDelete(row)
                    }}
                    aria-label={activeValue ? 'Delete opportunity' : 'Manage opportunity'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          },
        }
      }

      if (column.id === 'opportunityName') {
        return {
          ...column,
          render: (value: unknown) => (
            <span className="cursor-pointer font-medium text-blue-600 hover:text-blue-800">
              {String(value ?? '')}
            </span>
          ),
        }
      }

      if (column.id === 'expectedUsageGrossTotal' || column.id === 'expectedCommissionGrossTotal') {
        return {
          ...column,
          render: (value: unknown) => formatCurrency(typeof value === 'number' ? value : Number(value) || 0),
        }
      }

      if (column.id === 'closeDate') {
        return {
          ...column,
          render: (_: unknown, row: OpportunityRow) =>
            formatDate(row.closeDate ?? row.estimatedCloseDate ?? null),
        }
      }

      if (column.id === 'opportunityId') {
        return {
          ...column,
          render: (_: unknown, row: OpportunityRow) =>
            row.opportunityId ?? (typeof row.id === 'string' ? row.id : ''),
        }
      }

      return column
    })
  }, [
    handleOpportunityEdit,
    handleOpportunitySelect,
    handleOpportunityToggleActive,
    normalizedPreferenceColumns,
    requestOpportunityDelete,
    selectedOpportunities,
    updatingOpportunityIds,
  ])
  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="OPPORTUNITIES LIST"
        searchPlaceholder="Search opportunities..."
        onSearch={handleSearch}
        onFilterChange={handleStatusFilterChange}
        onCreateClick={handleCreateOpportunity}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={OPPORTUNITY_FILTER_OPTIONS}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        statusFilter={statusFilter}
        hasUnsavedTableChanges={hasUnsavedChanges}
        isSavingTableChanges={preferenceSaving}
        lastTableSaved={lastSaved || undefined}
        onSaveTableChanges={saveChanges}
      />

      {(error || preferenceError) && (
        <div className="px-4 text-sm text-red-600">{error || preferenceError}</div>
      )}

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        <div className="flex-shrink-0">
          <OpportunityBulkActionBar
            count={selectedOpportunities.length}
            disabled={bulkActionLoading}
            onSoftDelete={openBulkDeleteDialog}
            onExportCsv={handleBulkExportCsv}
            onChangeOwner={() => setShowBulkOwnerModal(true)}
            onUpdateStatus={() => setShowBulkStatusModal(true)}
          />
        </div>

        <div ref={tableAreaRef} className="flex-1 min-h-0">
          <DynamicTable
            columns={tableColumns}
            data={opportunities}
            onSort={handleSort}
            onRowClick={(row) => handleRowClick(row as OpportunityRow)}
            loading={tableLoading}
            emptyMessage="No opportunities found"
            onColumnsChange={handleColumnsChange}
            pagination={pagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedOpportunities}
            onItemSelect={(id, selected) => handleOpportunitySelect(String(id), selected)}
            onSelectAll={handleSelectAll}
            autoSizeColumns={false}
            alwaysShowPagination
            maxBodyHeight={tableBodyHeight}
          />
        </div>
      </div>

      <OpportunityBulkOwnerModal
        isOpen={showBulkOwnerModal}
        owners={ownerOptions}
        onClose={() => setShowBulkOwnerModal(false)}
        onSubmit={handleBulkOpportunityOwnerUpdate}
        isSubmitting={bulkActionLoading}
      />

      <OpportunityBulkStatusModal
        isOpen={showBulkStatusModal}
        onClose={() => setShowBulkStatusModal(false)}
        onSubmit={handleBulkOpportunityStatusUpdate}
        isSubmitting={bulkActionLoading}
      />

      <OpportunityEditModal
        isOpen={showEditModal}
        opportunityId={opportunityToEdit?.id ?? null}
        onClose={handleCloseEditModal}
        onSuccess={handleEditSuccess}
      />

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={closeDeleteDialog}
        entity="Opportunity"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} opportunity${bulkDeleteTargets.length === 1 ? '' : 'ies'}`
            : opportunityToDelete?.opportunityName || 'Unknown Opportunity'
        }
        entityId={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets[0]?.id ?? ''
            : opportunityToDelete?.id ?? ''
        }
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((opportunity) => ({
                id: opportunity.id,
                name: opportunity.opportunityName || 'Opportunity',
              }))
            : undefined
        }
        entityLabelPlural="Opportunities"
        isDeleted={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.every((opportunity) => opportunity.isDeleted)
            : opportunityToDelete?.isDeleted ?? false
        }
        onSoftDelete={handleOpportunitySoftDelete}
        onBulkSoftDelete={
          bulkDeleteTargets.length > 0
            ? async (entities, bypassConstraints) =>
                executeBulkOpportunitySoftDelete(
                  bulkDeleteTargets.filter((opportunity) =>
                    entities.some((entity) => entity.id === opportunity.id),
                  ),
                  bypassConstraints,
                )
            : undefined
        }
        onPermanentDelete={handleOpportunityPermanentDelete}
        onRestore={handleOpportunityRestore}
        userCanPermanentDelete
      />

      <ColumnChooserModal
        isOpen={showColumnSettings}
        columns={normalizedPreferenceColumns}
        onApply={handleColumnsChange}
        onClose={async () => {
          setShowColumnSettings(false)
          await saveChangesOnModalClose()
        }}
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
