"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ListHeader } from "@/components/list-header"
import { DynamicTable, Column } from "@/components/dynamic-table"
import { ContactCreateModal } from "@/components/contact-create-modal"
import { ColumnChooserModal } from "@/components/column-chooser-modal"
import { TwoStageDeleteDialog } from "@/components/two-stage-delete-dialog"
import { DeletionConstraint } from "@/lib/deletion"
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
    width: 120,
    minWidth: 100,
    maxWidth: 160,
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
  const [contactToDelete, setContactToDelete] = useState<ContactRow | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
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
  }, [pagination.page, pagination.pageSize, searchQuery, sortBy, sortDir, filters, showError])

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

  const requestContactDeletion = useCallback((contact: ContactRow) => {
    setContactToDelete(contact)
    setShowDeleteDialog(true)
  }, [])

  const handleSoftDelete = useCallback(async (
    contactId: string, 
    bypassConstraints?: boolean
  ): Promise<{ success: boolean, constraints?: DeletionConstraint[], error?: string }> => {
    try {
      const url = `/api/contacts/${contactId}?stage=soft${bypassConstraints ? '&bypassConstraints=true' : ''}`;
      const response = await fetch(url, { method: "DELETE" });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409 && data.constraints) {
          return { success: false, constraints: data.constraints };
        }
        return { success: false, error: data.error || "Failed to delete contact" };
      }

      // Update the contact status in the local state
      setContacts((previous) =>
        previous.map((contact) =>
          contact.id === contactId 
            ? { ...contact, isDeleted: true, deletedAt: new Date().toISOString() }
            : contact
        )
      );

      showSuccess("Contact deleted", "The contact has been soft deleted and can be restored if needed.");
      return { success: true };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unable to delete contact" 
      };
    }
  }, [showSuccess]);

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
    setShowDeleteDialog(false);
    setContactToDelete(null);
  };

  const tableLoading = loading || preferenceLoading
  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === "action") {
        return {
          ...column,
          render: (_value: unknown, row: ContactRow) => (
            <button
              type="button"
              className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                row.isDeleted 
                  ? "border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                  : "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                requestContactDeletion(row);
              }}
            >
              {row.isDeleted ? "Manage" : "Delete"}
            </button>
          ),
        };
      }
      return column;
    });
  }, [preferenceColumns, requestContactDeletion])
  
  // Get hidden columns by comparing all columns with visible ones
  const hiddenColumns = useMemo(() => {
    return contactColumns
      .filter(col => !tableColumns.some(visibleCol => visibleCol.id === col.id))
      .map(col => col.id)
  }, [tableColumns])

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
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
        <div className="px-4 text-sm text-red-600">{error || preferenceError}</div>
      )}

      <div className="flex-1 p-4 min-h-0">
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
          autoSizeColumns={false} // Explicitly disable auto-sizing to prevent conflicts
        />
      </div>

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

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={closeDeleteDialog}
        entity="Contact"
        entityName={contactToDelete?.fullName || "Unknown Contact"}
        entityId={contactToDelete?.id || ""}
        isDeleted={contactToDelete?.isDeleted || false}
        onSoftDelete={handleSoftDelete}
        onPermanentDelete={handlePermanentDelete}
        onRestore={handleRestore}
        userCanPermanentDelete={true} // TODO: Check user permissions
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}














