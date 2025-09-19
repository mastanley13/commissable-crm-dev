"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ListHeader } from "@/components/list-header"
import { DynamicTable, Column } from "@/components/dynamic-table"
import { ContactCreateModal } from "@/components/contact-create-modal"
import { ContactDetailsModal, ContactDetail } from "@/components/contact-details-modal"
import { ColumnChooserModal } from "@/components/column-chooser-modal"
import { useToasts } from "@/components/toast"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import { formatPhoneNumber } from "@/lib/utils"
import { TableChangeNotification } from "@/components/table-change-notification"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { Settings } from "lucide-react"

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
}

interface ContactOptions {
  accountTypes: Array<{ value: string; label: string; code: string }>
  owners: Array<{ value: string; label: string; firstName: string; lastName: string }>
  accounts: Array<{ value: string; label: string; accountNumber?: string }>
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
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    type: "checkbox",
    accessor: "select"
  },
  {
    id: "active",
    label: "Primary",
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    type: "toggle",
    accessor: "active"
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
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [selectedContactDetail, setSelectedContactDetail] = useState<ContactDetail | null>(null)
  
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

      const response = await fetch(`/api/contacts?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to load contacts")
      }

      const payload = await response.json()
      const rows: ContactRow[] = (Array.isArray(payload?.data) ? payload.data : []).map((row: any) => ({
        ...row,
        select: selectedContacts.includes(row.id)
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
  }, [pagination.page, pagination.pageSize, searchQuery, sortBy, sortDir, filters, selectedContacts, showError])

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
    const detail = buildContactDetail(contact)
    setSelectedContactDetail(detail)
  }, [])

  const handleCloseContactDetail = useCallback(() => {
    setSelectedContactDetail(null)
  }, [])


  const handleCreateContact = () => {
    setShowCreateModal(true)
  }

  const handleCreateSuccess = () => {
    // Refresh the contacts list
    loadContacts()
    showSuccess("Contact created successfully", "The new contact has been added to your contacts list.")
  }

  const handleFilterChange = (filter: string) => {
    if (filter === "primary") {
      setFilters(prev => ({ ...prev, isPrimary: true }))
    } else {
      setFilters(prev => {
        const { isPrimary, ...rest } = prev
        return rest
      })
    }
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleContactSelect = (contactId: string, selected: boolean) => {
    setSelectedContacts(prev => 
      selected 
        ? [...prev, contactId]
        : prev.filter(id => id !== contactId)
    )
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedContacts(contacts.map(contact => contact.id))
    } else {
      setSelectedContacts([])
    }
  }

  const tableLoading = loading || preferenceLoading
  const tableColumns = useMemo(() => preferenceColumns, [preferenceColumns])
  
  // Get hidden columns by comparing all columns with visible ones
  const hiddenColumns = useMemo(() => {
    return contactColumns
      .filter(col => !tableColumns.some(visibleCol => visibleCol.id === col.id))
      .map(col => col.id)
  }, [tableColumns])

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Search */}
          <div className="flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search contacts..."
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Table Change Notification - Always show */}
          <div className="flex items-center">
            <TableChangeNotification
              hasUnsavedChanges={hasUnsavedChanges || false}
              isSaving={preferenceSaving || false}
              lastSaved={lastSaved || undefined}
              onSave={saveChanges}
            />
          </div>

          {/* Center - Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateContact}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create New
            </button>
            
            <button
              onClick={() => setShowColumnSettings(true)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Column Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* Right side - Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFilterChange("primary")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filters.isPrimary
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Primary
            </button>
            <button
              onClick={() => handleFilterChange("all")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                !filters.isPrimary
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Show All
            </button>
          </div>
        </div>
      </div>

      {(error || preferenceError) && (
        <div className="px-6 text-sm text-red-600">{error || preferenceError}</div>
      )}

      <div className="flex-1 p-6 min-h-0">
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
        />
      </div>

      <ContactDetailsModal
        isOpen={selectedContactDetail !== null}
        contact={selectedContactDetail}
        onClose={handleCloseContactDetail}
      />

      <ContactCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        options={options || undefined}
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

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}










