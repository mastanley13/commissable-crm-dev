"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ListHeader, type ColumnFilter as ListColumnFilter } from "@/components/list-header"
import { DynamicTable, Column } from "@/components/dynamic-table"
import { ContactCreateModal } from "@/components/contact-create-modal"
import { ColumnChooserModal } from "@/components/column-chooser-modal"
import { TwoStageDeleteDialog } from "@/components/two-stage-delete-dialog"
import { DeletionConstraint } from "@/lib/deletion"
import { useToasts } from "@/components/toast"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import { formatPhoneNumber } from "@/lib/utils"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { ContactBulkActionBar } from "@/components/contact-bulk-action-bar"
import { ContactBulkOwnerModal } from "@/components/contact-bulk-owner-modal"
import { ContactBulkStatusModal } from "@/components/contact-bulk-status-modal"
import { ContactEditModal } from "@/components/contact-edit-modal"
import { Trash2, Edit } from "lucide-react"

interface ContactRow {
  id: string
  select: boolean
  active: boolean
  suffix: string
  fullName: string
  jobTitle: string
  contactType: string
  mobile: string
  workPhone: string
  emailAddress: string
  extension: string
  // Additional fields from API
  accountId: string
  accountName: string
  ownerId: string
  ownerName: string
  isPrimary: boolean
  isDecisionMaker: boolean
  preferredContactMethod: string
  createdAt: string
  // Deletion status
  deletedAt: string | null
  isDeleted: boolean
}

interface ContactOptions {
  accountTypes: Array<{ value: string; label: string; code: string }>
  owners: Array<{ value: string; label: string; firstName: string; lastName: string }>
  accounts: Array<{ value: string; label: string; accountNumber?: string; accountTypeId: string; accountTypeName: string }>
  contactMethods: Array<{ value: string; label: string }>
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface Filters {
  accountTypeId?: string
  ownerId?: string
  isPrimary?: boolean
  isDecisionMaker?: boolean
  preferredContactMethod?: string
}


    
const contactColumns: Column[] = [
  {
    id: "select",
    label: "Select",
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    type: "checkbox",
    accessor: "select"
  },
  {
    id: "action",
    label: "Actions",
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    type: "action",
    sortable: false,
    resizable: true
  },
  {
    id: "active",
    label: "Active",
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    type: "toggle",
    accessor: "active"
  },
  {
    id: "suffix",
    label: "Suffix",
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    sortable: true,
    type: "text",
    accessor: "suffix"
  },
  {
    id: "fullName",
    label: "Full Name",
    width: 180,
    minWidth: 140,
    maxWidth: 300,
    sortable: true,
    type: "text",
    render: value => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
        {value}
      </span>
    )
  },
  {
    id: "accountName",
    label: "Account",
    width: 160,
    minWidth: 120,
    maxWidth: 250,
    sortable: true,
    type: "text",
    render: value => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
        {value}
      </span>
    )
  },
  {
    id: "jobTitle",
    label: "Job Title",
    width: 140,
    minWidth: 100,
    maxWidth: 250,
    sortable: true,
    type: "text"
  },
  {
    id: "contactType",
    label: "Contact Type",
    width: 120,
    minWidth: 100,
    maxWidth: 180,
    sortable: true,
    type: "text"
  },
  {
    id: "ownerName",
    label: "Owner",
    width: 120,
    minWidth: 100,
    maxWidth: 180,
    sortable: true,
    type: "text"
  },
  {
    id: "mobile",
    label: "Mobile",
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    sortable: true,
    type: "phone",
    render: value => value ? (
      <a href={`tel:${value}`} className="text-gray-900 hover:text-blue-600 transition-colors">
        {formatPhoneNumber(value)}
      </a>
    ) : <span className="text-gray-400">-</span>
  },
  {
    id: "workPhone",
    label: "Work Phone",
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    sortable: true,
    type: "phone",
    render: value => value ? (
      <a href={`tel:${value}`} className="text-gray-900 hover:text-blue-600 transition-colors">
        {formatPhoneNumber(value)}
      </a>
    ) : <span className="text-gray-400">-</span>
  },
  {
    id: "emailAddress",
    label: "Email Address",
    width: 200,
    minWidth: 160,
    maxWidth: 300,
    sortable: true,
    type: "email",
    render: value => value ? (
      <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800 transition-colors truncate">
        {value}
      </a>
    ) : <span className="text-gray-400">-</span>
  },
  {
    id: "extension",
    label: "Extension",
    width: 100,
    minWidth: 80,
    maxWidth: 150,
    sortable: true,
    type: "text",
    render: value => value || <span className="text-gray-400">-</span>
  }
]

const contactFilterOptions = [
  { id: "fullName", label: "Full Name" },
  { id: "suffix", label: "Suffix" },
  { id: "accountName", label: "Account" },
  { id: "jobTitle", label: "Job Title" },
  { id: "contactType", label: "Contact Type" },
  { id: "ownerName", label: "Owner" },
  { id: "emailAddress", label: "Email" },
  { id: "mobile", label: "Mobile" },
  { id: "workPhone", label: "Work Phone" },
  { id: "extension", label: "Extension" }
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<ContactOptions | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0
  })
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [sortBy, setSortBy] = useState<string>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [filters, setFilters] = useState<Filters>({})
  const [columnFilters, setColumnFilters] = useState<ListColumnFilter[]>([])
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ContactRow[]>([])
  const [showBulkOwnerModal, setShowBulkOwnerModal] = useState(false)
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<ContactRow | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [contactToEdit, setContactToEdit] = useState<ContactRow | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const router = useRouter()
  
  const { showSuccess, showError, ToastContainer } = useToasts()

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    saving: preferenceSaving,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    handleHiddenColumnsChange,
    saveChanges,
    saveChangesOnModalClose,
  } = useTablePreferences("contacts:list", contactColumns)

  const loadContacts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      // Add pagination
      params.set("page", pagination.page.toString())
      params.set("pageSize", pagination.pageSize.toString())
      
      // Add search
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim())
      }
      
      // Add sorting
      params.set("sortBy", sortBy)
      params.set("sortDir", sortDir)
      
      // Add filters
      if (filters.accountTypeId) params.set("accountTypeId", filters.accountTypeId)
      if (filters.ownerId) params.set("ownerId", filters.ownerId)
      if (filters.isPrimary !== undefined) params.set("isPrimary", filters.isPrimary.toString())
      if (filters.isDecisionMaker !== undefined) params.set("isDecisionMaker", filters.isDecisionMaker.toString())
      if (filters.preferredContactMethod) params.set("preferredContactMethod", filters.preferredContactMethod)
      if (columnFilters.length > 0) {
        const serializedFilters = columnFilters
          .map(filter => ({
            columnId: filter.columnId,
            value: typeof filter.value === "string" ? filter.value.trim() : "",
            operator: filter.operator
          }))
          .filter(filter => filter.columnId && filter.value.length > 0)
        if (serializedFilters.length > 0) {
          params.set("columnFilters", JSON.stringify(serializedFilters))
        }
      }

      const response = await fetch(`/api/contacts?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to load contacts")
      }

      const payload = await response.json()
      const rows: ContactRow[] = (Array.isArray(payload?.data) ? payload.data : []).map((row: any) => ({
        ...row,
        select: false
      }))

      setContacts(rows)
      setPagination(prev => payload.pagination || prev)
      setError(null)
    } catch (err) {
      console.error(err)
      setContacts([])
      setError("Unable to load contacts")
      showError("Failed to load contacts", "Please try again or contact support if the issue persists.")
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.pageSize, searchQuery, sortBy, sortDir, filters, columnFilters, showError])

  const loadOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/contacts/options", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to load options")
      }
      const data = await response.json()
      setOptions(data)
    } catch (err) {
      console.error("Failed to load options:", err)
    }
  }, [])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    const timeout = setTimeout(() => {
      setSearchQuery(query)
      setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page on search
    }, 300)
    setSearchTimeout(timeout)
  }, [searchTimeout])

  const handleSearch = (query: string) => {
    debouncedSearch(query)
  }

  const handleSort = (columnId: string, direction: "asc" | "desc") => {
    setSortBy(columnId)
    setSortDir(direction)
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page on sort
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handlePageSizeChange = (pageSize: number) => {
    setPagination(prev => ({ ...prev, pageSize, page: 1 }))
  }

  const handleRowClick = useCallback((contact: ContactRow) => {
    router.push(`/contacts/${contact.id}`)
  }, [router])


  const handleCreateContact = () => {
    setShowCreateModal(true)
  }

  const handleCreateSuccess = () => {
    // Refresh the contacts list
    loadContacts()
    showSuccess("Contact created successfully", "The new contact has been added to your contacts list.")
  }

  const handleStatusFilterChange = (filter: string) => {
    setPagination(prev => ({ ...prev, page: 1 }))

    if (filter === "active") {
      setFilters(prev => ({ ...prev, isPrimary: true }))
      return
    }

    setFilters(prev => {
      const { isPrimary, ...rest } = prev
      return rest
    })
  }

  const handleColumnFiltersChange = useCallback((filters: ListColumnFilter[]) => {
    setPagination(prev => ({ ...prev, page: 1 }))

    if (!Array.isArray(filters) || filters.length === 0) {
      setColumnFilters([])
      return
    }

    const sanitized = filters
      .filter(filter => filter && typeof filter.columnId === "string")
      .map(filter => ({
        columnId: filter.columnId,
        value: typeof filter.value === "string" ? filter.value.trim() : "",
        operator: filter.operator
      }))
      .filter(filter => filter.columnId && filter.value.length > 0) as ListColumnFilter[]

    setColumnFilters(sanitized)
  }, [])

  const handleContactSelect = useCallback((contactId: string, selected: boolean) => {
    setSelectedContacts(prev => {
      if (selected) {
        if (prev.includes(contactId)) {
          return prev
        }
        return [...prev, contactId]
      }

      if (!prev.includes(contactId)) {
        return prev
      }

      return prev.filter(id => id !== contactId)
    })
  }, [])

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedContacts(contacts.map(contact => contact.id))
    } else {
      setSelectedContacts([])
    }
  }

  const openBulkDeleteDialog = useCallback(() => {
    if (selectedContacts.length === 0) {
      showError("No contacts selected", "Select at least one contact to delete.")
      return
    }

    const targets = contacts.filter(contact => selectedContacts.includes(contact.id))

    if (targets.length === 0) {
      showError(
        "Contacts unavailable",
        "Unable to locate the selected contacts. Refresh the page and try again."
      )
      return
    }

    setBulkDeleteTargets(targets)
    setContactToDelete(null)
    setShowDeleteDialog(true)
  }, [contacts, selectedContacts, showError])

  const softDeleteContactRequest = useCallback(async (
    contactId: string,
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    try {
      const url = `/api/contacts/${contactId}?stage=soft${bypassConstraints ? "&bypassConstraints=true" : ""}`
      const response = await fetch(url, { method: "DELETE" })

      if (!response.ok) {
        let data: any = null
        try {
          data = await response.json()
        } catch (_) {
          // Ignore JSON parse errors
        }

        if (response.status === 409 && Array.isArray(data?.constraints)) {
          return { success: false, constraints: data.constraints as DeletionConstraint[] }
        }

        const message = typeof data?.error === 'string' && data.error.length > 0
          ? data.error
          : 'Failed to delete contact'

        return { success: false, error: message }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete contact'
      return { success: false, error: message }
    }
  }, [])

  const deactivateContactRequest = useCallback(async (
    contactId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: false })
      })

      if (!response.ok) {
        let data: any = null
        try {
          data = await response.json()
        } catch (_) {
          // Ignore JSON parse errors
        }

        const message = typeof data?.error === "string" && data.error.length > 0
          ? data.error
          : "Failed to update contact status"

        return { success: false, error: message }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update contact status"
      return { success: false, error: message }
    }
  }, [])

  const handleSoftDelete = useCallback(async (
    contactId: string,
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    const result = await softDeleteContactRequest(contactId, bypassConstraints)

    if (result.success) {
      setContacts(previous =>
        previous.map(contact =>
          contact.id === contactId
            ? { ...contact, isDeleted: true, deletedAt: new Date().toISOString() }
            : contact
        )
      )

      showSuccess("Contact deleted", "The contact has been soft deleted and can be restored if needed.")
    }

    return result
  }, [setContacts, showSuccess, softDeleteContactRequest])
  const executeBulkSoftDelete = useCallback(async (
    targets: ContactRow[],
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    if (!targets || targets.length === 0) {
      return { success: false, error: "No contacts selected" }
    }

    setBulkActionLoading(true)

    try {
      const deactivationCandidates = targets.filter(contact => contact.active && !contact.isDeleted)
      const deletionCandidates = targets.filter(contact => !contact.active || contact.isDeleted)

      const deactivatedIds: string[] = []
      const deactivationFailures: Array<{ contact: ContactRow; message: string }> = []

      if (deactivationCandidates.length > 0) {
        const outcomes = await Promise.allSettled(
          deactivationCandidates.map(contact => deactivateContactRequest(contact.id))
        )

        outcomes.forEach((result, index) => {
          const contact = deactivationCandidates[index]
          if (result.status === "fulfilled" && result.value.success) {
            deactivatedIds.push(contact.id)
          } else {
            const errorMessage =
              result.status === "fulfilled"
                ? result.value.error || "Failed to deactivate contact"
                : result.reason instanceof Error
                  ? result.reason.message
                  : "Failed to deactivate contact"

            deactivationFailures.push({
              contact,
              message: errorMessage
            })
          }
        })

        if (deactivatedIds.length > 0) {
          const deactivatedSet = new Set(deactivatedIds)
          setContacts(previous =>
            previous.map(contact =>
              deactivatedSet.has(contact.id)
                ? { ...contact, active: false, isPrimary: false }
                : contact
            )
          )

          showSuccess(
            `Marked ${deactivatedIds.length} contact${deactivatedIds.length === 1 ? "" : "s"} inactive`,
            "Inactive contacts can be deleted if needed."
          )
        }
      }

      const deletionSuccessIds: string[] = []
      const constraintResults: Array<{ contact: ContactRow; constraints: DeletionConstraint[] }> = []
      const deletionFailures: Array<{ contact: ContactRow; message: string }> = []

      for (const contact of deletionCandidates) {
        const result = await softDeleteContactRequest(contact.id, bypassConstraints)

        if (result.success) {
          deletionSuccessIds.push(contact.id)
        } else if (result.constraints && result.constraints.length > 0) {
          constraintResults.push({ contact, constraints: result.constraints })
        } else {
          deletionFailures.push({
            contact,
            message: result.error || "Failed to delete contact"
          })
        }
      }

      if (deletionSuccessIds.length > 0) {
        const successSet = new Set(deletionSuccessIds)
        const deletedTimestamp = new Date().toISOString()

        setContacts(previous =>
          previous.map(contact =>
            successSet.has(contact.id)
              ? { ...contact, isDeleted: true, deletedAt: deletedTimestamp }
              : contact
          )
        )

        showSuccess(
          `Soft deleted ${deletionSuccessIds.length} contact${deletionSuccessIds.length === 1 ? "" : "s"}`,
          "Deleted contacts can be restored later from their detail page."
        )
      }

      const failureIds = [
        ...constraintResults.map(item => item.contact.id),
        ...deletionFailures.map(item => item.contact.id),
        ...deactivationFailures.map(item => item.contact.id)
      ]
      const failureIdSet = new Set(failureIds)

      setSelectedContacts(prev => prev.filter(id => failureIdSet.has(id)))
      setBulkDeleteTargets(targets.filter(contact => failureIdSet.has(contact.id)))

      if (deactivationFailures.length > 0 || deletionFailures.length > 0) {
        const failureMessage = [
          ...deletionFailures.map(item => `${item.contact.fullName || "Contact"}: ${item.message}`),
          ...deactivationFailures.map(item => `${item.contact.fullName || "Contact"}: ${item.message}`)
        ].join("; ")
        if (failureMessage.length > 0) {
          showError("Bulk delete failed", failureMessage)
        }
      }

      if (constraintResults.length > 0) {
        const aggregatedConstraints = constraintResults.flatMap(item =>
          item.constraints.map(constraint => ({
            ...constraint,
            message: `${item.contact.fullName || "Contact"}: ${constraint.message}`
          }))
        )

        return { success: false, constraints: aggregatedConstraints }
      }

      if (deletionFailures.length > 0 || deactivationFailures.length > 0) {
        const failureMessage = [
          ...deletionFailures.map(item => `${item.contact.fullName || "Contact"}: ${item.message}`),
          ...deactivationFailures.map(item => `${item.contact.fullName || "Contact"}: ${item.message}`)
        ].join("; ")

        return { success: false, error: failureMessage }
      }

      return { success: deactivatedIds.length > 0 || deletionSuccessIds.length > 0 }
    } catch (error) {
      console.error("Bulk soft delete failed", error)
      const message = error instanceof Error ? error.message : "Unable to delete selected contacts."
      showError("Bulk delete failed", message)
      return { success: false, error: message }
    } finally {
      setBulkActionLoading(false)
    }
  }, [deactivateContactRequest, setBulkActionLoading, setBulkDeleteTargets, setContacts, setSelectedContacts, showError, showSuccess, softDeleteContactRequest])

  const handleBulkExportCsv = useCallback(() => {
    if (selectedContacts.length === 0) {
      showError("No contacts selected", "Select at least one contact to export.")
      return
    }

    const rows = contacts.filter(contact => selectedContacts.includes(contact.id))

    if (rows.length === 0) {
      showError(
        "Contacts not available",
        "The selected contacts are not on the current page. Reload the page before exporting."
      )
      return
    }

    const headers = [
      "Full Name",
      "Email",
      "Job Title",
      "Account",
      "Contact Type",
      "Mobile Phone",
      "Work Phone",
      "Owner",
      "Active",
      "Preferred Contact Method"
    ]

    const escapeCsv = (value: string | null | undefined) => {
      if (value === null || value === undefined) {
        return ""
      }
      const stringValue = String(value)
      if (stringValue.includes("\"") || stringValue.includes(",") || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }

    const lines = [
      headers.join(","),
      ...rows.map(row =>
        [
          row.fullName,
          row.emailAddress,
          row.jobTitle,
          row.accountName,
          row.contactType,
          formatPhoneNumber(row.mobile),
          formatPhoneNumber(row.workPhone),
          row.ownerName,
          row.isPrimary ? "Active" : "Inactive",
          row.preferredContactMethod
        ].map(escapeCsv).join(",")
      )
    ]

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
    link.href = url
    link.download = `contacts-export-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    showSuccess(
      `Exported ${rows.length} contact${rows.length === 1 ? "" : "s"}`,
      "Check your downloads for the CSV file."
    )
  }, [contacts, selectedContacts, showError, showSuccess])

  const handleBulkOwnerUpdate = useCallback(async (ownerId: string | null) => {
    if (selectedContacts.length === 0) {
      showError("No contacts selected", "Select at least one contact to update.")
      return
    }

    setBulkActionLoading(true)

    try {
      const outcomes = await Promise.allSettled(
        selectedContacts.map(async (contactId) => {
          const response = await fetch(`/api/contacts/${contactId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerId })
          })

          if (!response.ok) {
            const data = await response.json().catch(() => null)
            throw new Error(data?.error || "Failed to update contact owner")
          }

          return contactId
        })
      )

      const successes: string[] = []
      const failures: Array<{ contactId: string; message: string }> = []

      outcomes.forEach((result, index) => {
        const contactId = selectedContacts[index]
        if (result.status === "fulfilled") {
          successes.push(contactId)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : "Unexpected error"
          failures.push({ contactId, message })
        }
      })

      if (successes.length > 0) {
        const successSet = new Set(successes)
        const ownerOption = ownerId ? options?.owners.find(owner => owner.value === ownerId) : undefined
        const ownerNameForData = ownerOption?.label ?? ""
        const ownerNameForToast = ownerId ? (ownerNameForData || "Selected owner") : "Unassigned"

        setContacts(previous =>
          previous.map(contact =>
            successSet.has(contact.id)
              ? {
                  ...contact,
                  ownerId: ownerId ?? "",
                  ownerName: ownerNameForData
                }
              : contact
          )
        )

        showSuccess(
          `Updated ${successes.length} contact${successes.length === 1 ? "" : "s"}`,
          `New owner: ${ownerNameForToast}.`
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(contacts.map(contact => [contact.id, contact.fullName || "Contact"]))
        const detail = failures
          .map(item => `${nameMap.get(item.contactId) || "Contact"}: ${item.message}`)
          .join("; ")
        showError("Failed to update owner for some contacts", detail)
      }

      const remaining = failures.map(item => item.contactId)
      setSelectedContacts(remaining)
      if (failures.length === 0) {
        setShowBulkOwnerModal(false)
      }
    } catch (error) {
      console.error("Bulk owner update failed", error)
      showError(
        "Bulk owner update failed",
        error instanceof Error ? error.message : "Unable to update contact owners."
      )
    } finally {
      setBulkActionLoading(false)
    }
  }, [contacts, options, selectedContacts, showError, showSuccess])

  const handleToggleContactStatus = useCallback(async (contact: ContactRow, newStatus: boolean) => {
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: newStatus })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Failed to update contact status")
      }

      // Update local state immediately
      setContacts(previous =>
        previous.map(c =>
          c.id === contact.id
            ? { ...c, isPrimary: newStatus, active: newStatus }
            : c
        )
      )

      const label = newStatus ? "active" : "inactive"
      showSuccess(
        `Contact marked as ${label}`,
        "The Active toggle has been updated."
      )
    } catch (error) {
      console.error("Failed to update contact status", error)
      showError(
        "Failed to update contact status",
        error instanceof Error ? error.message : "Unable to update contact status."
      )
      // Revert the local state change on error
      setContacts(previous =>
        previous.map(c =>
          c.id === contact.id
            ? { ...c, isPrimary: !newStatus, active: !newStatus }
            : c
        )
      )
    }
  }, [showError, showSuccess])

  const handleBulkStatusUpdate = useCallback(async (isPrimary: boolean) => {
    if (selectedContacts.length === 0) {
      showError("No contacts selected", "Select at least one contact to update.")
      return
    }

    setBulkActionLoading(true)

    try {
      const outcomes = await Promise.allSettled(
        selectedContacts.map(async (contactId) => {
          const response = await fetch(`/api/contacts/${contactId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPrimary })
          })

          if (!response.ok) {
            const data = await response.json().catch(() => null)
            throw new Error(data?.error || "Failed to update contact status")
          }

          return contactId
        })
      )

      const successes: string[] = []
      const failures: Array<{ contactId: string; message: string }> = []

      outcomes.forEach((result, index) => {
        const contactId = selectedContacts[index]
        if (result.status === "fulfilled") {
          successes.push(contactId)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : "Unexpected error"
          failures.push({ contactId, message })
        }
      })

      if (successes.length > 0) {
        const successSet = new Set(successes)
        setContacts(previous =>
          previous.map(contact =>
            successSet.has(contact.id)
              ? { ...contact, isPrimary, active: isPrimary }
              : contact
          )
        )
        const label = isPrimary ? "active" : "inactive"
        showSuccess(
          `Marked ${successes.length} contact${successes.length === 1 ? "" : "s"} as ${label}`,
          "The Active toggle has been updated."
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(contacts.map(contact => [contact.id, contact.fullName || "Contact"]))
        const detail = failures
          .map(item => `${nameMap.get(item.contactId) || "Contact"}: ${item.message}`)
          .join("; ")
        showError("Failed to update status for some contacts", detail)
      }

      const remaining = failures.map(item => item.contactId)
      setSelectedContacts(remaining)
      if (failures.length === 0) {
        setShowBulkStatusModal(false)
      }
    } catch (error) {
      console.error("Bulk status update failed", error)
      showError(
        "Bulk status update failed",
        error instanceof Error ? error.message : "Unable to update contact status."
      )
    } finally {
      setBulkActionLoading(false)
    }
  }, [contacts, selectedContacts, showError, showSuccess])
  const requestContactDeletion = useCallback((contact: ContactRow) => {
    setBulkDeleteTargets([])
    setContactToDelete(contact)
    setShowDeleteDialog(true)
  }, [])

  const handlePermanentDelete = useCallback(async (
    contactId: string
  ): Promise<{ success: boolean, error?: string }> => {
    try {
      const response = await fetch(`/api/contacts/${contactId}?stage=permanent`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || "Failed to permanently delete contact" };
      }

      // Remove the contact from local state
      setContacts((previous) =>
        previous.filter((contact) => contact.id !== contactId)
      );

      showSuccess("Contact permanently deleted", "The contact has been permanently removed from the system.");
      return { success: true };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unable to permanently delete contact" 
      };
    }
  }, [showSuccess]);

  const handleRestore = useCallback(async (
    contactId: string
  ): Promise<{ success: boolean, error?: string }> => {
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" })
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || "Failed to restore contact" };
      }

      const payload = await response.json();
      const restoredContact = payload.data;

      if (restoredContact) {
        // Update the contact in local state
        setContacts((previous) =>
          previous.map((contact) =>
            contact.id === contactId 
              ? { ...contact, isDeleted: false, deletedAt: null }
              : contact
          )
        );
      }

      showSuccess("Contact restored", "The contact has been successfully restored.");
      return { success: true };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unable to restore contact" 
      };
    }
  }, [showSuccess]);

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setContactToDelete(null)
    setBulkDeleteTargets([])
  }

  const requestContactEdit = useCallback((contact: ContactRow) => {
    setContactToEdit(contact)
    setShowEditModal(true)
  }, [])

  const handleEditSuccess = useCallback(() => {
    setShowEditModal(false)
    setContactToEdit(null)
    loadContacts()
  }, [loadContacts])

  const closeEditModal = () => {
    setShowEditModal(false)
    setContactToEdit(null)
  }

  const tableLoading = loading || preferenceLoading
  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === "action") {
        return {
          ...column,
          render: (_value: unknown, row: ContactRow) => (
            <div className="flex gap-1">
              <button
                type="button"
                className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors"
                onClick={(event) => {
                  event.stopPropagation();
                  requestContactEdit(row);
                }}
                aria-label="Edit contact"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`p-1 rounded transition-colors ${
                  row.isDeleted
                    ? "text-gray-400 hover:text-gray-600"
                    : "text-red-500 hover:text-red-700"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  requestContactDeletion(row);
                }}
                aria-label={row.isDeleted ? "Manage contact" : "Delete contact"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ),
        };
      }
      return column;
    });
  }, [preferenceColumns, requestContactEdit, requestContactDeletion])
  
  // Get hidden columns by comparing all columns with visible ones
  const hiddenColumns = useMemo(() => {
    return contactColumns
      .filter(col => !tableColumns.some(visibleCol => visibleCol.id === col.id))
      .map(col => col.id)
  }, [tableColumns])

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        searchPlaceholder="Search contacts..."
        onSearch={handleSearch}
        onFilterChange={handleStatusFilterChange}
        onCreateClick={handleCreateContact}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={contactFilterOptions}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        statusFilter={filters.isPrimary ? "active" : "all"}
        hasUnsavedTableChanges={hasUnsavedChanges}
        isSavingTableChanges={preferenceSaving}
        lastTableSaved={lastSaved || undefined}
        onSaveTableChanges={saveChanges}
      />

      {(error || preferenceError) && (
        <div className="px-4 text-sm text-red-600">{error || preferenceError}</div>
      )}

      <div className="flex-1 p-4 min-h-0">
        <ContactBulkActionBar
          count={selectedContacts.length}
          disabled={bulkActionLoading}
          onSoftDelete={openBulkDeleteDialog}
          onExportCsv={handleBulkExportCsv}
          onChangeOwner={() => setShowBulkOwnerModal(true)}
          onUpdateStatus={() => setShowBulkStatusModal(true)}
        />
        <DynamicTable
          columns={tableColumns}
          data={contacts}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={tableLoading}
          emptyMessage="No contacts found"
          onColumnsChange={handleColumnsChange}
          pagination={pagination}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          selectedItems={selectedContacts}
          onItemSelect={handleContactSelect}
          onSelectAll={handleSelectAll}
          onToggle={(row, columnId, value) => {
            if (columnId === "active") {
              handleToggleContactStatus(row, value)
            }
          }}
          fillContainerWidth
          autoSizeColumns={false} // Explicitly disable auto-sizing to prevent conflicts
        />
      </div>

      <ContactBulkOwnerModal
        isOpen={showBulkOwnerModal}
        owners={options?.owners ?? []}
        onClose={() => setShowBulkOwnerModal(false)}
        onSubmit={handleBulkOwnerUpdate}
        isSubmitting={bulkActionLoading}
      />

      <ContactBulkStatusModal
        isOpen={showBulkStatusModal}
        onClose={() => setShowBulkStatusModal(false)}
        onSubmit={handleBulkStatusUpdate}
        isSubmitting={bulkActionLoading}
      />

      <ContactCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        options={options || undefined}
      />

      <ContactEditModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        onSuccess={handleEditSuccess}
        contact={contactToEdit}
      />

      <ColumnChooserModal
        isOpen={showColumnSettings}
        columns={preferenceColumns}
        onApply={handleColumnsChange}
        onClose={async () => {
          setShowColumnSettings(false)
          await saveChangesOnModalClose()
        }}
      />

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={closeDeleteDialog}
        entity="Contact"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} contact${bulkDeleteTargets.length === 1 ? "" : "s"}`
            : contactToDelete?.fullName || "Unknown Contact"
        }
        entityId={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets[0]?.id || ""
            : contactToDelete?.id || ""
        }
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map(contact => ({
                id: contact.id,
                name: contact.fullName || "Unknown Contact"
              }))
            : undefined
        }
        entityLabelPlural="Contacts"
        isDeleted={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.every(contact => contact.isDeleted)
            : contactToDelete?.isDeleted || false
        }
        onSoftDelete={handleSoftDelete}
        onBulkSoftDelete={
          bulkDeleteTargets.length > 0
            ? async (entities, bypassConstraints) =>
                executeBulkSoftDelete(
                  bulkDeleteTargets.filter(contact =>
                    entities.some(entity => entity.id === contact.id)
                  ),
                  bypassConstraints
                )
            : undefined
        }
        onPermanentDelete={handlePermanentDelete}
        onRestore={handleRestore}
        userCanPermanentDelete={true} // TODO: Check user permissions
      />
      <ToastContainer />
    </CopyProtectionWrapper>
  )
}






































