"use client"

import Link from "next/link"
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  Filter,
  Loader2,
  Plus,
  Search,
  Settings,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DynamicTable, Column } from "./dynamic-table"
import { useToasts } from "./toast"
import { ContactCreateModal } from "./contact-create-modal"
import { ListHeader, type ColumnFilter } from "./list-header"
import { applySimpleFilters } from "@/lib/filter-utils"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import { OpportunityCreateModal } from "./account-opportunity-create-modal"
import { GroupCreateModal } from "./account-group-create-modal"
import { ActivityNoteCreateModal } from "./activity-note-create-modal"

export interface AccountAddress {
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: string
}

export interface AccountContactRow {
  id: string
  active: boolean
  suffix?: string
  fullName: string
  jobTitle?: string
  contactType?: string
  emailAddress?: string
  workPhone?: string
  extension?: string
}

export interface AccountOpportunityRow {
  id: string
  active: boolean
  orderIdHouse?: string
  opportunityName: string
  stage?: string
  owner?: string
  estimatedCloseDate?: string | Date | null
  referredBy?: string
}

export interface AccountGroupRow {
  id: string
  active: boolean
  groupName: string
  visibility?: string
  description?: string
  owner?: string
}

export interface AccountActivityRow {
  id: string
  active: boolean
  activityDate?: string | Date | null
  activityType?: string
  activityStatus?: string
  description?: string
  accountName?: string
  attachment?: string | null
  fileName?: string | null
  createdBy?: string
}

export interface AccountDetail {
  id: string
  accountName: string
  accountLegalName?: string
  parentAccount?: string
  accountType: string
  active: boolean
  accountOwner?: string
  industry?: string
  orderIdHouse?: string
  websiteUrl?: string
  description?: string
  shippingAddress: AccountAddress | null
  billingAddress: AccountAddress | null
  billingSameAsShipping: boolean
  contacts: AccountContactRow[]
  opportunities: AccountOpportunityRow[]
  groups: AccountGroupRow[]
  activities: AccountActivityRow[]
}

type TabKey = "contacts" | "opportunities" | "groups" | "activities"

interface ContactModalAccountOption {
  value: string
  label: string
  accountNumber?: string
  accountTypeId?: string
  accountTypeName?: string
}

interface ContactModalOptions {
  accounts: ContactModalAccountOption[]
  owners?: Array<{ value: string; label: string; firstName?: string; lastName?: string }>
  accountTypes?: Array<{ value: string; label: string; code?: string }>
  contactMethods: Array<{ value: string; label: string }>
}


interface AccountDetailsViewProps {
  account: AccountDetail | null
  loading?: boolean
  error?: string | null
  onBack: () => void
  onEdit?: (account: AccountDetail) => void
  onRefresh?: () => void
}


const TABS: { id: TabKey; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "opportunities", label: "Opportunities" },
  { id: "groups", label: "Groups" },
  { id: "activities", label: "Activities & Notes" }
]

const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-gray-500"
const fieldBoxClass = "flex min-h-[28px] items-center justify-between rounded-lg border-2 border-gray-400 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm"
const CONTACT_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "actions",
    label: "Actions",
    width: 90,
    minWidth: 80,
    maxWidth: 110,
    sortable: false,
    resizable: false,
    type: "action",
  },
  {
    id: "active",
    label: "Active",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: "toggle",
    accessor: "active",
  },
  {
    id: "suffix",
    label: "Suffix",
    width: 100,
    minWidth: 80,
    maxWidth: 140,
    sortable: true,
    accessor: "suffix",
  },
  {
    id: "fullName",
    label: "Full Name",
    width: 220,
    minWidth: 180,
    maxWidth: 320,
    sortable: true,
    accessor: "fullName",
  },
  {
    id: "jobTitle",
    label: "Job Title",
    width: 200,
    minWidth: 150,
    maxWidth: 280,
    sortable: true,
    accessor: "jobTitle",
  },
  {
    id: "contactType",
    label: "Contact Type",
    width: 180,
    minWidth: 140,
    maxWidth: 240,
    sortable: true,
    accessor: "contactType",
  },
  {
    id: "emailAddress",
    label: "Email",
    width: 240,
    minWidth: 200,
    maxWidth: 320,
    sortable: true,
    accessor: "emailAddress",
  },
  {
    id: "workPhone",
    label: "Work Phone",
    width: 180,
    minWidth: 150,
    maxWidth: 220,
    sortable: true,
    accessor: "workPhone",
  },
  {
    id: "extension",
    label: "Extension",
    width: 120,
    minWidth: 90,
    maxWidth: 150,
    sortable: true,
    accessor: "extension",
  },
]

const OPPORTUNITY_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "active",
    label: "Active",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: "toggle",
    accessor: "active"
  },
  {
    id: "orderIdHouse",
    label: "Order ID - House",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    accessor: "orderIdHouse"
  },
  {
    id: "opportunityName",
    label: "Opportunity Name",
    width: 250,
    minWidth: 200,
    maxWidth: 350,
    sortable: true,
    accessor: "opportunityName"
  },
  {
    id: "stage",
    label: "Opportunity Stage",
    width: 180,
    minWidth: 150,
    maxWidth: 220,
    sortable: true,
    accessor: "stage"
  },
  {
    id: "owner",
    label: "Owner",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    accessor: "owner"
  },
  {
    id: "estimatedCloseDate",
    label: "Estimated Close Date",
    width: 180,
    minWidth: 150,
    maxWidth: 220,
    sortable: true,
    accessor: "estimatedCloseDate"
  },
  {
    id: "referredBy",
    label: "Referred By",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    accessor: "referredBy"
  }
]

const GROUP_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "active",
    label: "Active",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: "toggle",
    accessor: "active"
  },
  {
    id: "groupName",
    label: "Group Name",
    width: 220,
    minWidth: 160,
    maxWidth: 320,
    sortable: true,
    accessor: "groupName"
  },
  {
    id: "visibility",
    label: "Public/Private",
    width: 160,
    minWidth: 130,
    maxWidth: 220,
    sortable: true,
    accessor: "visibility"
  },
  {
    id: "description",
    label: "Group Description",
    width: 260,
    minWidth: 200,
    maxWidth: 400,
    sortable: true,
    accessor: "description"
  },
  {
    id: "owner",
    label: "Group Owner",
    width: 200,
    minWidth: 150,
    maxWidth: 260,
    sortable: true,
    accessor: "owner"
  }
]

const ACTIVITY_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "active",
    label: "Active",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: "toggle",
    accessor: "active"
  },
  {
    id: "activityDate",
    label: "Activity Date",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    accessor: "activityDate"
  },
  {
    id: "activityType",
    label: "Activity Type",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    accessor: "activityType"
  },
  {
    id: "description",
    label: "Activity Description",
    width: 250,
    minWidth: 200,
    maxWidth: 400,
    sortable: true,
    accessor: "description"
  },
  {
    id: "accountName",
    label: "Account Name",
    width: 180,
    minWidth: 150,
    maxWidth: 250,
    sortable: true,
    accessor: "accountName"
  },
  {
    id: "attachment",
    label: "Attachment",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    accessor: "attachment"
  },
  {
    id: "fileName",
    label: "File Name",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    accessor: "fileName"
  },
  {
    id: "createdBy",
    label: "Created By",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    accessor: "createdBy"
  }
]

const normalizeFilterKey = (filter: ColumnFilter) =>
  `${filter.columnId}::${(filter.operator ?? "contains").toLowerCase()}::${filter.value.trim().toLowerCase()}`

const dedupeColumnFilters = (filters: ColumnFilter[]) => {
  const seen = new Set<string>()
  return filters
    .map(filter => ({ ...filter, value: filter.value.trim() }))
    .filter(filter => filter.value.length > 0)
    .filter(filter => {
      const key = normalizeFilterKey(filter)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
}

function ReadOnlySwitch({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        value ? "bg-primary-600" : "bg-gray-300"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          value ? "translate-x-5" : "translate-x-1"
        )}
      />
    </span>
  )
}

function ReadOnlyCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded border",
        checked ? "border-primary-500 bg-primary-500" : "border-gray-300 bg-white"
      )}
    >
      {checked && <span className="h-2 w-2 rounded-sm bg-white" />}
    </span>
  )
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid items-start gap-1.5 sm:grid-cols-[120px,1fr]">
      <span className={fieldLabelClass}>{label}</span>
      <div>{value}</div>
    </div>
  )
}

interface TabToolbarProps {
  suffix?: ReactNode
}

function TabToolbar({ suffix }: TabToolbarProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border-2 border-gray-400 bg-gray-50 p-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className="flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
          <Plus className="h-3.5 w-3.5" />
          Create New
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1.5 h-3.5 w-3.5 text-gray-400" />
          <input
            readOnly
            className="w-32 rounded-full border border-gray-300 bg-white py-1 pl-7 pr-2.5 text-sm text-gray-700 focus:outline-none"
            placeholder="Search Here"
          />
        </div>
        <button className="flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-sm font-medium text-gray-600 hover:text-gray-800">
          <span>Filter By Column</span>
          <Settings className="h-3.5 w-3.5" />
        </button>
        <button className="flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600">
          <Filter className="h-3.5 w-3.5" />
          Apply Filter
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button className="rounded-full bg-primary-600 px-2.5 py-1 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          Active
        </button>
        <button className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-sm font-semibold text-gray-600 hover:border-primary-400 hover:text-primary-600">
          Show All
        </button>
        {suffix}
      </div>
    </div>
  )
}


export function AccountDetailsView({ account, loading = false, error, onBack, onEdit, onRefresh }: AccountDetailsViewProps) {
  const { showSuccess, showError } = useToasts()
  const [activeTab, setActiveTab] = useState<TabKey>("contacts")
  const [activityFilter, setActivityFilter] = useState<string>("All")
  const [activeFilter, setActiveFilter] = useState<"active" | "all">("active")
  const [contactsColumnFilters, setContactsColumnFilters] = useState<ColumnFilter[]>([])
  const [contactsSearchQuery, setContactsSearchQuery] = useState("")
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactOptions, setContactOptions] = useState<ContactModalOptions | null>(null)
  const [contactOptionsLoading, setContactOptionsLoading] = useState(false)
  const [opportunitiesColumnFilters, setOpportunitiesColumnFilters] = useState<ColumnFilter[]>([])
  const [opportunitiesSearchQuery, setOpportunitiesSearchQuery] = useState("")
  const [opportunityModalOpen, setOpportunityModalOpen] = useState(false)
  const [opportunitiesCurrentPage, setOpportunitiesCurrentPage] = useState(1)
  const [opportunitiesPageSize, setOpportunitiesPageSize] = useState(10)
  const [groupsColumnFilters, setGroupsColumnFilters] = useState<ColumnFilter[]>([])
  const [groupsSearchQuery, setGroupsSearchQuery] = useState("")
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupsCurrentPage, setGroupsCurrentPage] = useState(1)
  const [groupsPageSize, setGroupsPageSize] = useState(10)
  const [activitiesColumnFilters, setActivitiesColumnFilters] = useState<ColumnFilter[]>([])
  const [activitiesSearchQuery, setActivitiesSearchQuery] = useState("")
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [activitiesCurrentPage, setActivitiesCurrentPage] = useState(1)
  const [activitiesPageSize, setActivitiesPageSize] = useState(10)
  const [contactsPage, setContactsPage] = useState(1)
  const [contactsPageSize, setContactsPageSize] = useState(10)

  useEffect(() => {
    setActiveTab("contacts")
    setActivityFilter("All")
    setActiveFilter("active")
    setContactsColumnFilters([])
    setContactsSearchQuery("")
    setContactModalOpen(false)
    setContactOptions(null)
    setOpportunitiesColumnFilters([])
    setOpportunitiesSearchQuery("")
    setOpportunityModalOpen(false)
    setOpportunitiesCurrentPage(1)
    setOpportunitiesPageSize(10)
    setGroupsColumnFilters([])
    setGroupsSearchQuery("")
    setGroupModalOpen(false)
    setGroupsCurrentPage(1)
    setGroupsPageSize(10)
    setActivitiesColumnFilters([])
    setActivitiesSearchQuery("")
    setActivityModalOpen(false)
    setActivitiesCurrentPage(1)
    setActivitiesPageSize(10)
    setContactsPage(1)
    setContactsPageSize(10)
  }, [account?.id])
  const loadContactOptions = useCallback(async () => {
    try {
      setContactOptionsLoading(true)
      const response = await fetch("/api/contacts/options", {
        cache: "no-store"
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error("Failed to load contact options")
      }
      const nextOptions: ContactModalOptions = {
        accounts: Array.isArray(payload?.accounts) ? payload.accounts : [],
        contactMethods: Array.isArray(payload?.contactMethods) ? payload.contactMethods : []
      }
      if (Array.isArray(payload?.owners)) {
        nextOptions.owners = payload.owners
      }
      if (Array.isArray(payload?.accountTypes)) {
        nextOptions.accountTypes = payload.accountTypes
      }
      setContactOptions(nextOptions)
    } catch (error) {
      console.error(error)
      showError("Unable to load contact options", "Please try again.")
    } finally {
      setContactOptionsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    if (contactModalOpen && !contactOptions && !contactOptionsLoading) {
      loadContactOptions().catch(error => console.error(error))
    }
  }, [contactModalOpen, contactOptions, contactOptionsLoading, loadContactOptions])

  const contactsFilterColumns = useMemo(() => [
    { id: "fullName", label: "Full Name" },
    { id: "jobTitle", label: "Job Title" },
    { id: "contactType", label: "Contact Type" },
    { id: "emailAddress", label: "Email Address" },
    { id: "workPhone", label: "Work Phone" },
    { id: "suffix", label: "Suffix" },
    { id: "extension", label: "Extension" }
  ], [])

  const opportunitiesFilterColumns = useMemo(() => [
    { id: "orderIdHouse", label: "Order ID - House" },
    { id: "opportunityName", label: "Opportunity Name" },
    { id: "stage", label: "Opportunity Stage" },
    { id: "owner", label: "Owner" },
    { id: "estimatedCloseDate", label: "Estimated Close Date" },
    { id: "referredBy", label: "Referred By" },
  ], [])

  const groupsFilterColumns = useMemo(() => [
    { id: "groupName", label: "Group Name" },
    { id: "visibility", label: "Public/Private" },
    { id: "description", label: "Group Description" },
    { id: "owner", label: "Group Owner" }
  ], [])

  const activitiesFilterColumns = useMemo(() => [
    { id: "activityDate", label: "Activity Date" },
    { id: "activityType", label: "Activity Type" },
    { id: "activityStatus", label: "Activity Status" },
    { id: "description", label: "Description" },
    { id: "createdBy", label: "Created By" }
  ], [])

  const {
    columns: contactPreferenceColumns,
    loading: contactPreferencesLoading,
    saving: contactPreferencesSaving,
    hasUnsavedChanges: contactHasUnsavedChanges,
    lastSaved: contactLastSaved,
    handleColumnsChange: handleContactTableColumnsChange,
    saveChanges: saveContactTablePreferences,
  } = useTablePreferences("account-details:contacts", CONTACT_TABLE_BASE_COLUMNS)

  const {
    columns: opportunityPreferenceColumns,
    loading: opportunityPreferencesLoading,
    saving: opportunityPreferencesSaving,
    hasUnsavedChanges: opportunityHasUnsavedChanges,
    lastSaved: opportunityLastSaved,
    handleColumnsChange: handleOpportunityTableColumnsChange,
    saveChanges: saveOpportunityTablePreferences,
  } = useTablePreferences("account-details:opportunities", OPPORTUNITY_TABLE_BASE_COLUMNS)

  const {
    columns: groupPreferenceColumns,
    loading: groupPreferencesLoading,
    saving: groupPreferencesSaving,
    hasUnsavedChanges: groupHasUnsavedChanges,
    lastSaved: groupLastSaved,
    handleColumnsChange: handleGroupTableColumnsChange,
    saveChanges: saveGroupTablePreferences,
  } = useTablePreferences("account-details:groups", GROUP_TABLE_BASE_COLUMNS)

  const {
    columns: activityPreferenceColumns,
    loading: activityPreferencesLoading,
    saving: activityPreferencesSaving,
    hasUnsavedChanges: activityHasUnsavedChanges,
    lastSaved: activityLastSaved,
    handleColumnsChange: handleActivityTableColumnsChange,
    saveChanges: saveActivityTablePreferences,
  } = useTablePreferences("account-details:activities", ACTIVITY_TABLE_BASE_COLUMNS)

  const handleContactsColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    setContactsColumnFilters(dedupeColumnFilters(filters))
  }, [])

  const handleContactsSearch = useCallback((query: string) => {
    setContactsSearchQuery(query)
  }, [])

  const handleOpportunitiesColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    setOpportunitiesColumnFilters(dedupeColumnFilters(filters))
  }, [])

  const handleOpportunitiesSearch = useCallback((query: string) => {
    setOpportunitiesSearchQuery(query)
  }, [])

  const handleGroupsColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    setGroupsColumnFilters(dedupeColumnFilters(filters))
  }, [])

  const handleGroupsSearch = useCallback((query: string) => {
    setGroupsSearchQuery(query)
  }, [])

  const handleActivitiesColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    setActivitiesColumnFilters(dedupeColumnFilters(filters))
  }, [])

  const handleActivitiesSearch = useCallback((query: string) => {
    setActivitiesSearchQuery(query)
  }, [])

  const contactTableColumns = useMemo(() => {
    return contactPreferenceColumns.map(column => {
      if (column.id === "actions") {
        return {
          ...column,
          render: (_value: unknown, row: AccountContactRow) => (
            <button
              type="button"
              className="rounded-full border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
              onClick={event => {
                event.stopPropagation()
              }}
              aria-label="Remove contact"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )
        }
      }
      if (column.id === "fullName") {
        return {
          ...column,
          render: (value: string, row: AccountContactRow) => (
            <Link
              href={`/contacts/${row.id}`}
              className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
            >
              {value || "Unnamed"}
            </Link>
          )
        }
      }
      if (column.id === "emailAddress") {
        return {
          ...column,
          render: (value?: string) =>
            value ? (
              <a className="text-primary-600 hover:underline" href={`mailto:${value}`} >
                {value}
              </a>
            ) : (
              <span className="text-gray-500">-</span>
            ),
        }
      }
      if (column.id === "workPhone") {
        return {
          ...column,
          render: (value?: string) =>
            value ? (
              <a className="text-primary-600 hover:underline" href={`tel:${value}`} >
                {value}
              </a>
            ) : (
              <span className="text-gray-500">-</span>
            ),
        }
      }
      return column
    })
  }, [contactPreferenceColumns])

  const filteredContacts = useMemo(() => {
    if (!account) return []
    let rows = [...account.contacts]
    if (activeFilter === "active") {
      rows = rows.filter(row => row.active)
    }
    const query = contactsSearchQuery.trim().toLowerCase()
    if (query.length > 0) {
      rows = rows.filter(row => {
        return [
          row.fullName,
          row.jobTitle,
          row.contactType,
          row.emailAddress,
          row.workPhone,
          row.suffix,
          row.extension,
        ]
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .some(value => value.toLowerCase().includes(query))
      })
    }
    if (contactsColumnFilters.length > 0) {
      rows = applySimpleFilters(rows as unknown as Record<string, unknown>[], contactsColumnFilters) as unknown as AccountContactRow[]
    }
    return rows
  }, [account, activeFilter, contactsSearchQuery, contactsColumnFilters])

  const handleCreateContact = useCallback(() => {
    if (!account) {
      showError("Account not loaded", "Load an account before creating contacts.")
      return
    }
    setContactModalOpen(true)
    if (!contactOptions && !contactOptionsLoading) {
      loadContactOptions().catch(error => console.error(error))
    }
  }, [account, showError, contactOptions, contactOptionsLoading, loadContactOptions])

  const handleCreateOpportunity = useCallback(() => {
    if (!account) {
      showError("Account not loaded", "Load an account before creating opportunities.")
      return
    }
    setOpportunityModalOpen(true)
  }, [account, showError])

  const handleCreateGroup = useCallback(() => {
    if (!account) {
      showError("Account not loaded", "Load an account before creating groups.")
      return
    }
    setGroupModalOpen(true)
  }, [account, showError])

  const handleCreateActivity = useCallback(() => {
    if (!account) {
      showError("Account not loaded", "Load an account before logging activities.")
      return
    }
    setActivityModalOpen(true)
  }, [account, showError])

  const handleContactCreated = () => {
    setContactModalOpen(false)
    showSuccess("Contact created", "The contact list will refresh shortly.")
    onRefresh?.()
  }

  const handleCloseContactModal = () => {
    setContactModalOpen(false)
  }

  const handleOpportunityCreated = () => {
    setOpportunityModalOpen(false)
    showSuccess("Opportunity created", "The list will refresh shortly.")
    onRefresh?.()
  }

  const handleCloseOpportunityModal = () => {
    setOpportunityModalOpen(false)
  }

  const handleGroupCreated = () => {
    setGroupModalOpen(false)
    showSuccess("Group created", "The group list will refresh shortly.")
    onRefresh?.()
  }

  const handleCloseGroupModal = () => {
    setGroupModalOpen(false)
  }

  const handleActivityCreated = () => {
    setActivityModalOpen(false)
    showSuccess("Activity created", "The activity list will refresh shortly.")
    onRefresh?.()
  }

  const handleCloseActivityModal = () => {
    setActivityModalOpen(false)
  }

  const shippingSummary = useMemo(() => {
    if (!account?.shippingAddress) return ""
    const parts = [account.shippingAddress.city, account.shippingAddress.state, account.shippingAddress.postalCode]
      .filter(Boolean)
      .join(", ")
    return parts
  }, [account])

  const legacyFilteredActivities = useMemo(() => {
    if (!account) return []
    if (activityFilter === "All") return account.activities
    return account.activities.filter(activity => activity.activityStatus === activityFilter)
  }, [account, activityFilter])

  const filteredOpportunities = useMemo(() => {
    if (!account) return []
    let rows = [...account.opportunities]
    if (activeFilter === "active") {
      rows = rows.filter(row => row.active)
    }
    const query = opportunitiesSearchQuery.trim().toLowerCase()
    if (query.length > 0) {
      rows = rows.filter(row => {
        const values = [
          row.orderIdHouse,
          row.opportunityName,
          row.stage,
          row.owner,
          row.referredBy,
          row.estimatedCloseDate ? new Date(row.estimatedCloseDate as any).toLocaleDateString() : undefined,
        ]
        return values
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .some(value => value.toLowerCase().includes(query))
      })
    }
    if (opportunitiesColumnFilters.length > 0) {
      rows = applySimpleFilters(rows as unknown as Record<string, unknown>[], opportunitiesColumnFilters) as unknown as AccountOpportunityRow[]
    }
    return rows
  }, [account, activeFilter, opportunitiesSearchQuery, opportunitiesColumnFilters])

  const paginatedOpportunities = useMemo(() => {
    const start = (opportunitiesCurrentPage - 1) * opportunitiesPageSize
    return filteredOpportunities.slice(start, start + opportunitiesPageSize)
  }, [filteredOpportunities, opportunitiesCurrentPage, opportunitiesPageSize])

  const opportunitiesPagination = useMemo(() => {
    const total = filteredOpportunities.length
    const totalPages = Math.max(Math.ceil(total / opportunitiesPageSize), 1)
    return { page: opportunitiesCurrentPage, pageSize: opportunitiesPageSize, total, totalPages }
  }, [filteredOpportunities.length, opportunitiesCurrentPage, opportunitiesPageSize])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredOpportunities.length / opportunitiesPageSize), 1)
    if (opportunitiesCurrentPage > maxPage) {
      setOpportunitiesCurrentPage(maxPage)
    }
  }, [filteredOpportunities.length, opportunitiesPageSize, opportunitiesCurrentPage])

  const handleOpportunitiesPageChange = (page: number) => {
    setOpportunitiesCurrentPage(page)
  }

  const handleOpportunitiesPageSizeChange = (size: number) => {
    setOpportunitiesPageSize(size)
    setOpportunitiesCurrentPage(1)
  }

  const opportunityTableColumns = useMemo(() => {
    return opportunityPreferenceColumns.map(column => {
      if (column.id === "estimatedCloseDate") {
        return {
          ...column,
          render: (value?: string | Date | null) => formatDate(value)
        }
      }
      return column
    })
  }, [opportunityPreferenceColumns])

  const filteredGroups = useMemo(() => {
    if (!account) return []
    let rows = [...account.groups]
    if (activeFilter === "active") {
      rows = rows.filter(row => row.active)
    }
    const query = groupsSearchQuery.trim().toLowerCase()
    if (query.length > 0) {
      rows = rows.filter(row => {
        return [row.groupName, row.visibility, row.description, row.owner]
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .some(value => value.toLowerCase().includes(query))
      })
    }
    if (groupsColumnFilters.length > 0) {
      rows = applySimpleFilters(rows as unknown as Record<string, unknown>[], groupsColumnFilters) as unknown as AccountGroupRow[]
    }
    return rows
  }, [account, activeFilter, groupsSearchQuery, groupsColumnFilters])

  const paginatedGroups = useMemo(() => {
    const start = (groupsCurrentPage - 1) * groupsPageSize
    return filteredGroups.slice(start, start + groupsPageSize)
  }, [filteredGroups, groupsCurrentPage, groupsPageSize])

  const groupsPagination = useMemo(() => {
    const total = filteredGroups.length
    const totalPages = Math.max(Math.ceil(total / groupsPageSize), 1)
    return { page: groupsCurrentPage, pageSize: groupsPageSize, total, totalPages }
  }, [filteredGroups.length, groupsCurrentPage, groupsPageSize])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredGroups.length / groupsPageSize), 1)
    if (groupsCurrentPage > maxPage) {
      setGroupsCurrentPage(maxPage)
    }
  }, [filteredGroups.length, groupsPageSize, groupsCurrentPage])

  const handleGroupsPageChange = (page: number) => {
    setGroupsCurrentPage(page)
  }

  const handleGroupsPageSizeChange = (size: number) => {
    setGroupsPageSize(size)
    setGroupsCurrentPage(1)
  }

  const groupTableColumns = useMemo(() => groupPreferenceColumns, [groupPreferenceColumns])

  const filteredActivities = useMemo(() => {
    if (!account) return []
    let rows = [...account.activities]
    if (activeFilter === "active") {
      rows = rows.filter(row => row.active)
    }
    const query = activitiesSearchQuery.trim().toLowerCase()
    if (query.length > 0) {
      rows = rows.filter(row => {
        return [
          row.activityType,
          row.activityStatus,
          row.description,
          row.accountName,
          row.fileName,
          row.createdBy
        ]
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .some(value => value.toLowerCase().includes(query))
      })
    }
    if (activitiesColumnFilters.length > 0) {
      rows = applySimpleFilters(rows as unknown as Record<string, unknown>[], activitiesColumnFilters) as unknown as AccountActivityRow[]
    }
    return rows
  }, [account, activeFilter, activitiesSearchQuery, activitiesColumnFilters])

  const paginatedActivities = useMemo(() => {
    const start = (activitiesCurrentPage - 1) * activitiesPageSize
    return filteredActivities.slice(start, start + activitiesPageSize)
  }, [filteredActivities, activitiesCurrentPage, activitiesPageSize])

  const activitiesPagination = useMemo(() => {
    const total = filteredActivities.length
    const totalPages = Math.max(Math.ceil(total / activitiesPageSize), 1)
    return { page: activitiesCurrentPage, pageSize: activitiesPageSize, total, totalPages }
  }, [filteredActivities.length, activitiesCurrentPage, activitiesPageSize])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredActivities.length / activitiesPageSize), 1)
    if (activitiesCurrentPage > maxPage) {
      setActivitiesCurrentPage(maxPage)
    }
  }, [filteredActivities.length, activitiesPageSize, activitiesCurrentPage])

  const handleActivitiesPageChange = (page: number) => {
    setActivitiesCurrentPage(page)
  }

  const handleActivitiesPageSizeChange = (size: number) => {
    setActivitiesPageSize(size)
    setActivitiesCurrentPage(1)
  }

  const activityTableColumns = useMemo(() => {
    return activityPreferenceColumns.map(column => {
      if (column.id === "activityDate") {
        return { ...column, render: (value?: string | Date | null) => formatDate(value) }
      }
      return column
    })
  }, [activityPreferenceColumns])

  const hasAccount = Boolean(account)

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "—"
    const dateValue = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(dateValue.getTime())) {
      return "—"
    }
    return dateValue.toLocaleDateString()
  }

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-none">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Account Detail</p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900">{account?.accountName ?? "Account information"}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {account?.accountLegalName || (!loading && hasAccount ? "No legal name on file" : "")}
              </p>
              {hasAccount && account?.shippingAddress && (
                <p className="mt-2 text-sm text-gray-500">
                  Ship To: {account.shippingAddress.line1}
                  {shippingSummary ? ` - ${shippingSummary}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {onEdit && account && (
                <button
                  onClick={() => onEdit(account)}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                  Update
                </button>
              )}
              <button
                onClick={onBack}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600"
              >
                Back
              </button>
            </div>
        </div>

        <div>
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                Loading account details...
              </div>
            ) : !hasAccount ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
                {error ?? "Account details are not available."}
              </div>
            ) : account ? (
              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-gray-400 bg-gray-50 p-3 shadow-sm">
                  <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                    <div className="space-y-2">
                      <FieldRow
                        label="Account Name"
                        value={<div className={fieldBoxClass}>{account.accountName}</div>}
                      />
                      <FieldRow
                        label="Account Legal Name"
                        value={<div className={fieldBoxClass}>{account.accountLegalName || "—"}</div>}
                      />
                      <FieldRow
                        label="Parent Account"
                        value={
                          <div className={cn(fieldBoxClass, "justify-between")}>
                            <span>{account.parentAccount || "Not Linked"}</span>
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          </div>
                        }
                      />
                      <FieldRow
                        label="Account Type"
                        value={
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={cn(fieldBoxClass, "justify-between")}>
                              <span>{account.accountType || "-"}</span>
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            </div>
                            <div className="flex items-center gap-2.5 rounded-lg border-2 border-gray-400 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
                              <span>Active (Y/N)</span>
                              <ReadOnlySwitch value={account.active} />
                            </div>
                          </div>
                        }
                      />
                      <FieldRow
                        label="Account Owner"
                        value={
                          <div className={cn(fieldBoxClass, "justify-between")}>
                            <span>{account.accountOwner || "Unassigned"}</span>
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          </div>
                        }
                      />
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <span className={fieldLabelClass}>Industry</span>
                          <div className={cn(fieldBoxClass, "justify-between")}>
                            <span>{account.industry || "-"}</span>
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <span className={fieldLabelClass}>Order ID - House</span>
                          <div className={fieldBoxClass}>{account.orderIdHouse || "-"}</div>
                        </div>
                      </div>
                      <FieldRow
                        label="Website URL"
                        value={<div className={fieldBoxClass}>{account.websiteUrl || "—"}</div>}
                      />
                      <FieldRow
                        label="Description"
                        value={
                          <div className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
                            {account.description || "No description provided."}
                          </div>
                        }
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border-2 border-gray-400 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-800">Ship To Address</h3>
                          <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">Default</span>
                        </div>
                        {account.shippingAddress ? (
                          <div className="space-y-2 text-sm text-gray-700">
                            <div className="space-y-1.5">
                              <div className={fieldLabelClass}>Street</div>
                              <div className={fieldBoxClass}>{account.shippingAddress.line1}</div>
                            </div>
                            {account.shippingAddress.line2 && (
                              <div className="space-y-1.5">
                                <div className={fieldLabelClass}>Street 2</div>
                                <div className={fieldBoxClass}>{account.shippingAddress.line2}</div>
                              </div>
                            )}
                            <div className="grid gap-2 md:grid-cols-[1.2fr,0.45fr,0.55fr]">
                              <div className="space-y-1.5">
                                <div className={fieldLabelClass}>City</div>
                                <div className={fieldBoxClass}>{account.shippingAddress.city}</div>
                              </div>
                              <div className="space-y-1.5">
                                <div className={fieldLabelClass}>State</div>
                                <div className={cn(fieldBoxClass, "justify-between")}>
                                  <span>{account.shippingAddress.state || "-"}</span>
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <div className={fieldLabelClass}>Zip</div>
                                <div className={fieldBoxClass}>{account.shippingAddress.postalCode || "-"}</div>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className={fieldLabelClass}>Country</div>
                              <div className={cn(fieldBoxClass, "justify-between")}>
                                <span>{account.shippingAddress.country || "-"}</span>
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No shipping address on file.</p>
                        )}
                      </div>

                      <div className="rounded-xl border-2 border-gray-400 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-800">Bill To Address</h3>
                          <label className="flex items-center gap-2 text-xs text-gray-600">
                            <ReadOnlyCheckbox checked={Boolean(account.billingSameAsShipping)} />
                            <span>Same as Ship</span>
                          </label>
                        </div>
                        {account.billingAddress ? (
                          <div className="space-y-2 text-sm text-gray-700">
                            <div className="space-y-1.5">
                              <div className={fieldLabelClass}>Street</div>
                              <div className={fieldBoxClass}>{account.billingAddress.line1}</div>
                            </div>
                            {account.billingAddress.line2 && (
                              <div className="space-y-1.5">
                                <div className={fieldLabelClass}>Street 2</div>
                                <div className={fieldBoxClass}>{account.billingAddress.line2}</div>
                              </div>
                            )}
                            <div className="grid gap-2 md:grid-cols-[1.2fr,0.45fr,0.55fr]">
                              <div className="space-y-1.5">
                                <div className={fieldLabelClass}>City</div>
                                <div className={fieldBoxClass}>{account.billingAddress.city}</div>
                              </div>
                              <div className="space-y-1.5">
                                <div className={fieldLabelClass}>State</div>
                                <div className={cn(fieldBoxClass, "justify-between")}>
                                  <span>{account.billingAddress.state || "-"}</span>
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <div className={fieldLabelClass}>Zip</div>
                                <div className={fieldBoxClass}>{account.billingAddress.postalCode || "-"}</div>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className={fieldLabelClass}>Country</div>
                              <div className={cn(fieldBoxClass, "justify-between")}>
                                <span>{account.billingAddress.country || "-"}</span>
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No billing address on file.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1 border-b border-gray-200">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "px-3 py-1.5 text-sm font-medium transition border-b-2",
                          activeTab === tab.id
                            ? "border-primary-600 text-primary-700 bg-primary-50"
                            : "border-transparent text-gray-500 hover:text-primary-600 hover:border-gray-300"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === "contacts" && (
                    <div className="flex flex-col gap-2">
                      <ListHeader
                        onCreateClick={handleCreateContact}
                        onFilterChange={(filter: string) => setActiveFilter(filter === "active" ? "active" : "all")}
                        statusFilter={activeFilter}
                        onSearch={handleContactsSearch}
                        filterColumns={contactsFilterColumns}
                        columnFilters={contactsColumnFilters}
                        onColumnFiltersChange={handleContactsColumnFiltersChange}
                        hasUnsavedTableChanges={contactHasUnsavedChanges}
                        isSavingTableChanges={contactPreferencesSaving}
                        lastTableSaved={contactLastSaved ?? undefined}
                        onSaveTableChanges={saveContactTablePreferences}
                        showCreateButton={Boolean(account)}
                        searchPlaceholder="Search contacts"
                      />
                      <DynamicTable
                        columns={contactTableColumns}
                        data={filteredContacts.slice(0, contactsPageSize)}
                        emptyMessage="No contacts found for this account"
                        onColumnsChange={handleContactTableColumnsChange}
                        loading={loading || contactPreferencesLoading}
                        pagination={{ page: contactsPage, pageSize: contactsPageSize, total: filteredContacts.length, totalPages: Math.max(Math.ceil(filteredContacts.length / contactsPageSize), 1) }}
                        onPageChange={(p) => setContactsPage(p)}
                        onPageSizeChange={(s) => { setContactsPageSize(s); setContactsPage(1) }}
                        autoSizeColumns={true}
                        fillContainerWidth
                        alwaysShowPagination
                      />
                    </div>
                  )}
                  {activeTab === "opportunities" && (
                    <div className="flex flex-col gap-2">
                      <ListHeader
                        onCreateClick={handleCreateOpportunity}
                        onFilterChange={(filter: string) => setActiveFilter(filter === "active" ? "active" : "all")}
                        statusFilter={activeFilter}
                        onSearch={handleOpportunitiesSearch}
                        filterColumns={opportunitiesFilterColumns}
                        columnFilters={opportunitiesColumnFilters}
                        onColumnFiltersChange={handleOpportunitiesColumnFiltersChange}
                        hasUnsavedTableChanges={opportunityHasUnsavedChanges}
                        isSavingTableChanges={opportunityPreferencesSaving}
                        lastTableSaved={opportunityLastSaved ?? undefined}
                        onSaveTableChanges={saveOpportunityTablePreferences}
                        showCreateButton={Boolean(account)}
                        searchPlaceholder="Search opportunities"
                      />
                      <DynamicTable
                        columns={opportunityTableColumns}
                        data={paginatedOpportunities}
                        emptyMessage="No opportunities found for this account"
                        onColumnsChange={handleOpportunityTableColumnsChange}
                        loading={loading || opportunityPreferencesLoading}
                        pagination={opportunitiesPagination}
                        onPageChange={handleOpportunitiesPageChange}
                        onPageSizeChange={handleOpportunitiesPageSizeChange}
                        autoSizeColumns={true}
                        fillContainerWidth
                        alwaysShowPagination
                      />
                    </div>
                  )}

                  {activeTab === "groups" && (
                    <div className="flex flex-col gap-2">
                      <ListHeader
                        onCreateClick={handleCreateGroup}
                        onFilterChange={(filter: string) => setActiveFilter(filter === "active" ? "active" : "all")}
                        statusFilter={activeFilter}
                        onSearch={handleGroupsSearch}
                        filterColumns={groupsFilterColumns}
                        columnFilters={groupsColumnFilters}
                        onColumnFiltersChange={handleGroupsColumnFiltersChange}
                        hasUnsavedTableChanges={groupHasUnsavedChanges}
                        isSavingTableChanges={groupPreferencesSaving}
                        lastTableSaved={groupLastSaved ?? undefined}
                        onSaveTableChanges={saveGroupTablePreferences}
                        showCreateButton={Boolean(account)}
                        searchPlaceholder="Search groups"
                      />
                      <DynamicTable
                        columns={groupTableColumns}
                        data={paginatedGroups}
                        emptyMessage="No groups found for this account"
                        onColumnsChange={handleGroupTableColumnsChange}
                        loading={loading || groupPreferencesLoading}
                        pagination={groupsPagination}
                        onPageChange={handleGroupsPageChange}
                        onPageSizeChange={handleGroupsPageSizeChange}
                        autoSizeColumns={true}
                        fillContainerWidth
                        alwaysShowPagination
                      />
                    </div>
                  )}

                  {activeTab === "activities" && (
                    <div className="flex flex-col gap-2">
                      <ListHeader
                        onCreateClick={handleCreateActivity}
                        onFilterChange={(filter: string) => setActiveFilter(filter === "active" ? "active" : "all")}
                        statusFilter={activeFilter}
                        onSearch={handleActivitiesSearch}
                        filterColumns={activitiesFilterColumns}
                        columnFilters={activitiesColumnFilters}
                        onColumnFiltersChange={handleActivitiesColumnFiltersChange}
                        hasUnsavedTableChanges={activityHasUnsavedChanges}
                        isSavingTableChanges={activityPreferencesSaving}
                        lastTableSaved={activityLastSaved ?? undefined}
                        onSaveTableChanges={saveActivityTablePreferences}
                        showCreateButton={Boolean(account)}
                        searchPlaceholder="Search activities"
                      />
                      <DynamicTable
                        columns={activityTableColumns}
                        data={paginatedActivities}
                        emptyMessage="No activities found for this account"
                        onColumnsChange={handleActivityTableColumnsChange}
                        loading={loading || activityPreferencesLoading}
                        pagination={activitiesPagination}
                        onPageChange={handleActivitiesPageChange}
                        onPageSizeChange={handleActivitiesPageSizeChange}
                        autoSizeColumns={true}
                        fillContainerWidth
                        alwaysShowPagination
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
                Account details are not available.
              </div>
            )}
        <ContactCreateModal
          isOpen={contactModalOpen}
          onClose={handleCloseContactModal}
          onSuccess={handleContactCreated}
          options={(contactOptions ?? undefined) as any}
          defaultAccountId={account?.id}
        />
        {account && (
          <OpportunityCreateModal
            isOpen={opportunityModalOpen}
            accountId={account.id}
            accountName={account.accountName}
            onClose={handleCloseOpportunityModal}
            onCreated={handleOpportunityCreated}
          />
        )}
        {account && (
          <GroupCreateModal
            isOpen={groupModalOpen}
            accountId={account.id}
            accountName={account.accountName}
            onClose={handleCloseGroupModal}
            onCreated={handleGroupCreated}
          />
        )}
        {account && (
          <ActivityNoteCreateModal
            isOpen={activityModalOpen}
            context="account"
            entityName={account.accountName}
            accountId={account.id}
            onClose={handleCloseActivityModal}
            onSuccess={handleActivityCreated}
          />
        )}
        </div>
      </div>
    </div>
  )
}
