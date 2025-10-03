"use client"

import Link from "next/link"
import { ReactNode, useCallback, useEffect, useState, useMemo, useRef, useLayoutEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Filter, Paperclip, Plus, Search, Settings, Trash2, Edit, ChevronDown, ChevronUp, Check } from "lucide-react"
import { OpportunityStatus } from "@prisma/client"

import { cn } from "@/lib/utils"
import { TwoStageDeleteDialog } from "./two-stage-delete-dialog"
import { DeletionConstraint } from "@/lib/deletion"
import { DynamicTable, Column, PaginationInfo } from "./dynamic-table"
import { useToasts } from "./toast"
import { ActivityNoteCreateModal } from "./activity-note-create-modal"
import { ActivityNoteEditModal } from "./activity-note-edit-modal"
import { ContactOpportunityCreateModal } from "./contact-opportunity-create-modal"
import { ContactGroupCreateModal } from "./contact-group-create-modal"
import { ListHeader, type ColumnFilter } from "./list-header"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import { applySimpleFilters } from "@/lib/filter-utils"
import { ColumnChooserModal } from "./column-chooser-modal"
import { OpportunityEditModal } from "./opportunity-edit-modal"
import { GroupEditModal } from "./group-edit-modal"
import { ActivityBulkActionBar } from "./activity-bulk-action-bar"
import { ActivityBulkOwnerModal } from "./activity-bulk-owner-modal"
import { ActivityBulkStatusModal } from "./activity-bulk-status-modal"
import { OpportunityBulkActionBar } from "./opportunity-bulk-action-bar"
import { OpportunityBulkOwnerModal } from "./opportunity-bulk-owner-modal"
import { OpportunityBulkStatusModal } from "./opportunity-bulk-status-modal"

export interface ActivityAttachmentRow {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  uploadedAt?: string | Date
  uploadedByName?: string
}

export interface ContactActivityRow {
  id: string
  active: boolean
  activityDate?: string | Date | null
  activityStatus?: string
  description?: string
  accountName?: string
  attachment?: string | null
  fileName?: string | null
  createdBy?: string
  activityType?: string
  attachments?: ActivityAttachmentRow[]
}

export interface ContactOpportunityRow {
  id: string
  active: boolean
  status?: string
  orderIdHouse?: string
  opportunityName: string
  stage?: string
  owner?: string
  ownerId?: string | null
  estimatedCloseDate?: string | Date | null
  referredBy?: string
  isDeleted?: boolean
}

export interface ContactGroupRow {
  id: string
  active: boolean
  groupName: string
  groupType?: string
  visibility?: string
  description?: string
  owner?: string
  isDeleted?: boolean
}

export interface ContactDetail {
  id: string
  accountId?: string
  suffix?: string
  prefix?: string
  firstName: string
  middleName?: string
  lastName: string
  accountName: string
  jobTitle?: string
  department?: string
  contactType?: string
  active: boolean
  emailAddress?: string
  alternateEmail?: string
  description?: string
  notes?: string
  workPhone?: string
  workPhoneExt?: string
  mobilePhone?: string
  otherPhone?: string
  fax?: string
  assistantName?: string
  assistantPhone?: string
  linkedinUrl?: string
  websiteUrl?: string
  birthdate?: string | Date | null
  anniversary?: string | Date | null
  isPrimary?: boolean
  isDecisionMaker?: boolean
  activities: ContactActivityRow[]
  opportunities: ContactOpportunityRow[]
  groups: ContactGroupRow[]
  deletedAt?: string | null
}

function AttachmentChipList({
  activityId,
  attachments
}: {
  activityId: string
  attachments?: ActivityAttachmentRow[]
}) {
  if (!attachments || attachments.length === 0) {
    return <span className="text-xs text-gray-500">None</span>
  }

    return (
    <div className="flex flex-wrap gap-2 overflow-hidden">
      {attachments.map(attachment => (
        <a
          key={attachment.id}
          href={`/api/activities/${activityId}/attachments/${attachment.id}`}
          className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-primary-600 transition hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 sm:max-w-[220px]"
          target="_blank"
          rel="noopener noreferrer"
          title={attachment.uploadedByName ? `${attachment.fileName}\nUploaded by ${attachment.uploadedByName}` : attachment.fileName}
        >
          <Paperclip className="h-3 w-3" />
          <span className="truncate max-w-full" title={attachment.fileName}>{attachment.fileName}</span>
        </a>
      ))}
    </div>
  )
}

interface ContactDetailsViewProps {
  contact: ContactDetail | null
  loading?: boolean
  error?: string | null
  onEdit?: (contact: ContactDetail) => void
  onContactUpdated?: (contact: ContactDetail) => void
  onRefresh?: () => Promise<void> | void
}


const TABS: { id: "activities" | "opportunities" | "groups"; label: string }[] = [
  { id: "activities", label: "Activities & Notes" },
  { id: "opportunities", label: "Opportunities" },
  { id: "groups", label: "Groups" }
]

const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-gray-500"
const fieldBoxClass = "flex min-h-[24px] items-center justify-between rounded-lg border-2 border-gray-400 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm"

const CONTACT_ACTIVITY_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Actions",
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: "multi-action",
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
    id: "activityStatus",
    label: "Activity Status",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    accessor: "activityStatus"
  },
  {
    id: "description",
    label: "Description",
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
    width: 220,
    minWidth: 180,
    maxWidth: 280,
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

const CONTACT_OPPORTUNITY_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Actions",
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: "multi-action",
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

const CONTACT_GROUP_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Actions",
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: "multi-action",
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
    width: 180,
    minWidth: 140,
    maxWidth: 240,
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

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
    return (
    <div className="grid items-start gap-1.5 sm:grid-cols-[120px,1fr]">
      <span className={fieldLabelClass}>{label}</span>
      <div>{value}</div>
    </div>
  )
}

interface TabToolbarProps {
  onCreateNew?: () => void
  disabled?: boolean
  activeFilter?: "active" | "all"
  onFilterChange?: (filter: "active" | "all") => void
}

function TabToolbar({ onCreateNew, disabled, activeFilter = "active", onFilterChange }: TabToolbarProps) {
  const handleFilterChange = (filter: "active" | "all") => {
    onFilterChange?.(filter)
  }

    return (
    <div className="flex flex-col gap-1.5 rounded-xl border-2 border-gray-400 bg-gray-50 p-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onCreateNew}
          disabled={disabled}
          className="flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
        >
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
        {/* iOS-style Segmented Control for Active/Show All */}
        <div className="inline-flex rounded-lg bg-gray-100 p-1 shadow-inner">
          <button
            onClick={() => handleFilterChange("active")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              activeFilter === "active"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => handleFilterChange("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              activeFilter === "all"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            Show All
          </button>
        </div>
      </div>
    </div>
  )
}


export function ContactDetailsView({ contact, loading = false, error, onEdit, onContactUpdated, onRefresh }: ContactDetailsViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"activities" | "opportunities" | "groups">("activities")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(true)
  const { showError, showSuccess, showInfo } = useToasts()

  // Table height management
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const [tableAreaMaxHeight, setTableAreaMaxHeight] = useState<number>()
  const TABLE_CONTAINER_PADDING = 16
  const TABLE_BODY_FOOTER_RESERVE = 96
  const TABLE_BODY_MIN_HEIGHT = 160

  const measureTableAreaHeight = useCallback(() => {
    const container = tableAreaRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const available = window.innerHeight - rect.top - TABLE_CONTAINER_PADDING
    if (!Number.isFinite(available)) return
    const nextHeight = Math.max(Math.floor(available), 0)
    setTableAreaMaxHeight(nextHeight)
  }, [])

  const tableAreaRefCallback = useCallback((node: HTMLDivElement | null) => {
    tableAreaRef.current = node
    if (node) {
      window.requestAnimationFrame(() => {
        measureTableAreaHeight()
      })
    }
  }, [measureTableAreaHeight])

  useLayoutEffect(() => {
    measureTableAreaHeight()
  }, [measureTableAreaHeight, activeTab, detailsExpanded, loading])

  useEffect(() => {
    const handleResize = () => measureTableAreaHeight()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [measureTableAreaHeight])

  const tableBodyMaxHeight = useMemo(() => {
    if (tableAreaMaxHeight == null) return undefined
    const maxBodyWithinContainer = Math.max(tableAreaMaxHeight - 16, 0)
    const preferredBodyHeight = Math.max(
      tableAreaMaxHeight - TABLE_BODY_FOOTER_RESERVE,
      Math.floor(tableAreaMaxHeight * 0.6),
      0
    )
    const boundedPreferredHeight = Math.min(preferredBodyHeight, maxBodyWithinContainer)
    if (boundedPreferredHeight >= TABLE_BODY_MIN_HEIGHT) {
      return boundedPreferredHeight
    }
    const minTarget = Math.min(TABLE_BODY_MIN_HEIGHT, maxBodyWithinContainer)
    return Math.max(boundedPreferredHeight, minTarget)
  }, [tableAreaMaxHeight])

  const tableContainerStyle = useMemo(() => {
    if (tableAreaMaxHeight == null) return undefined
    const cappedHeight = Math.max(tableAreaMaxHeight, 0)
    return {
      height: cappedHeight,
      maxHeight: cappedHeight,
      minHeight: Math.min(
        TABLE_BODY_MIN_HEIGHT + TABLE_BODY_FOOTER_RESERVE,
        cappedHeight
      )
    }
  }, [tableAreaMaxHeight])

  const handleBack = () => {
    router.push("/contacts")
  }

  const toggleDetails = () => {
    setDetailsExpanded(!detailsExpanded)
  }

  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [opportunityModalOpen, setOpportunityModalOpen] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<"active" | "all">("active")
  const [activitiesCurrentPage, setActivitiesCurrentPage] = useState(1)
  const [activitiesPageSize, setActivitiesPageSize] = useState(10)
  const [opportunitiesCurrentPage, setOpportunitiesCurrentPage] = useState(1)
  const [opportunitiesPageSize, setOpportunitiesPageSize] = useState(10)
  const [groupsCurrentPage, setGroupsCurrentPage] = useState(1)
  const [groupsPageSize, setGroupsPageSize] = useState(10)
  const [activitiesSearchQuery, setActivitiesSearchQuery] = useState("")
  const [activitiesColumnFilters, setActivitiesColumnFilters] = useState<ColumnFilter[]>([])
  const [opportunitiesSearchQuery, setOpportunitiesSearchQuery] = useState("")
  const [opportunitiesColumnFilters, setOpportunitiesColumnFilters] = useState<ColumnFilter[]>([])
  const [groupsSearchQuery, setGroupsSearchQuery] = useState("")
  const [groupsColumnFilters, setGroupsColumnFilters] = useState<ColumnFilter[]>([])
  const [showActivitiesColumnSettings, setShowActivitiesColumnSettings] = useState(false)
  const [showOpportunitiesColumnSettings, setShowOpportunitiesColumnSettings] = useState(false)
  const [showGroupsColumnSettings, setShowGroupsColumnSettings] = useState(false)
  const [editingActivity, setEditingActivity] = useState<ContactActivityRow | null>(null)
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const [activityBulkActionLoading, setActivityBulkActionLoading] = useState(false)
  const [showActivityBulkOwnerModal, setShowActivityBulkOwnerModal] = useState(false)
  const [showActivityBulkStatusModal, setShowActivityBulkStatusModal] = useState(false)
  const [editingOpportunity, setEditingOpportunity] = useState<ContactOpportunityRow | null>(null)
  const [selectedOpportunities, setSelectedOpportunities] = useState<string[]>([])
  const [opportunityBulkActionLoading, setOpportunityBulkActionLoading] = useState(false)
  const [showOpportunityBulkOwnerModal, setShowOpportunityBulkOwnerModal] = useState(false)
  const [showOpportunityBulkStatusModal, setShowOpportunityBulkStatusModal] = useState(false)
  const [opportunityDeleteTargets, setOpportunityDeleteTargets] = useState<ContactOpportunityRow[]>([])
  const [opportunityOwners, setOpportunityOwners] = useState<Array<{ value: string; label: string }>>([])
  const [opportunityToDelete, setOpportunityToDelete] = useState<ContactOpportunityRow | null>(null)
  const [showOpportunityDeleteDialog, setShowOpportunityDeleteDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ContactGroupRow | null>(null)
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [groupBulkActionLoading, setGroupBulkActionLoading] = useState(false)
  const [showGroupEditModal, setShowGroupEditModal] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<ContactGroupRow | null>(null)
  const [showGroupDeleteDialog, setShowGroupDeleteDialog] = useState(false)

  useEffect(() => {
    setActiveTab("activities")
    setIsDeleted(Boolean(contact?.deletedAt))
  }, [contact?.id, contact?.deletedAt])

  useEffect(() => {
    let isCancelled = false

    const loadOwners = async () => {
      try {
        const response = await fetch("/api/admin/users?limit=100", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Failed to load owners")
        }
        const payload = await response.json().catch(() => null)
        const users = Array.isArray(payload?.data?.users) ? payload.data.users : []
        if (!isCancelled) {
          setOpportunityOwners(
            users.map((user: any) => ({
              value: user.id,
              label: user.fullName || user.email || "Unassigned"
            }))
          )
        }
      } catch (error) {
        console.error("Failed to load opportunity owners", error)
        if (!isCancelled) {
          setOpportunityOwners([])
          showError("Unable to load owners", "Please try again later.")
        }
      }
    }

    loadOwners()

    return () => {
      isCancelled = true
    }
  }, [showError])

  useEffect(() => {
    setActivityModalOpen(false)
    setOpportunityModalOpen(false)
    setGroupModalOpen(false)
    setEditingActivity(null)
    setSelectedActivities([])
    setActivityBulkActionLoading(false)
    setEditingOpportunity(null)
    setSelectedOpportunities([])
    setOpportunityBulkActionLoading(false)
    setShowOpportunityBulkOwnerModal(false)
    setShowOpportunityBulkStatusModal(false)
    setOpportunityDeleteTargets([])
    setOpportunityToDelete(null)
    setShowOpportunityDeleteDialog(false)
    setEditingGroup(null)
    setSelectedGroups([])
    setGroupBulkActionLoading(false)
    setShowGroupEditModal(false)
    setGroupToDelete(null)
    setShowGroupDeleteDialog(false)
  }, [contact?.id])

  const contactDisplayName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : ""

  const createButtonDisabled = !contact || refreshing || loading || isDeleted

  const handleCreateNewClick = useCallback(() => {
    if (!contact || isDeleted) {
      return
    }

    switch (activeTab) {
      case "activities":
        setActivityModalOpen(true)
        break
      case "opportunities":
        setOpportunityModalOpen(true)
        break
      case "groups":
        setGroupModalOpen(true)
        break
      default:
        break
    }
  }, [activeTab, contact, isDeleted])

  const handleDelete = () => {
    setShowDeleteDialog(true)
  }

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

      setIsDeleted(true);
      if (onContactUpdated && contact) {
        onContactUpdated({ ...contact, deletedAt: new Date().toISOString() });
      }
      return { success: true };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unable to delete contact" 
      };
    }
  }, [contact, onContactUpdated]);

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

      // Redirect back to contacts list since contact no longer exists
      router.push("/contacts");
      return { success: true };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unable to permanently delete contact" 
      };
    }
  }, [router]);

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

      setIsDeleted(false);
      if (onContactUpdated && restoredContact) {
        onContactUpdated(restoredContact);
      }
      return { success: true };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unable to restore contact" 
      };
    }
  }, [onContactUpdated]);

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
  };

  const refreshContactData = useCallback(async () => {
    if (!onRefresh) {
      return;
    }

    try {
      setRefreshing(true);
      await Promise.resolve(onRefresh());
    } catch (error) {
      console.error("Failed to refresh contact details", error);
      showError("Unable to refresh contact data", "Please reload the page if the list does not update.");
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, showError]);

  const handlePostCreate = useCallback(async () => {
    await refreshContactData();
  }, [refreshContactData]);
  const handleActivityEdit = useCallback((activity: ContactActivityRow) => {
    if (!activity?.id) {
      showError("Activity unavailable", "Unable to locate this activity record.");
      return;
    }

    setEditingActivity(activity);
  }, [showError]);

  const handleCloseActivityEditModal = useCallback(() => {
    setEditingActivity(null);
  }, []);

  const handleActivityEditSuccess = useCallback(async () => {
    setEditingActivity(null);
    await refreshContactData();
  }, [refreshContactData]);

  const handleActivityDelete = useCallback(async (activity: ContactActivityRow) => {
    if (!activity?.id) {
      showError("Activity unavailable", "Unable to locate this activity record.");
      return;
    }

    const confirmationLabel = activity.description?.trim()?.slice(0, 60) || activity.activityStatus || activity.activityType || "this activity";
    if (!window.confirm(`Delete ${confirmationLabel}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/activities/${activity.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to delete activity");
      }

      showSuccess("Activity deleted", "The activity has been removed.");
      await refreshContactData();
    } catch (error) {
      console.error("Failed to delete activity", error);
      const message = error instanceof Error ? error.message : "Unable to delete activity";
      showError("Failed to delete activity", message);
    }
  }, [refreshContactData, showError, showSuccess]);

  const openActivityBulkDeleteDialog = useCallback(async () => {
    if (selectedActivities.length === 0) {
      showError("No activities selected", "Select at least one activity to delete.")
      return
    }
    const confirmed = window.confirm(`Delete ${selectedActivities.length} selected activit${selectedActivities.length === 1 ? "y" : "ies"}? This action cannot be undone.`)
    if (!confirmed) return
    try {
      setActivityBulkActionLoading(true)
      let successCount = 0
      let failureCount = 0
      for (const id of selectedActivities) {
        try {
          const response = await fetch(`/api/activities/${id}`, { method: "DELETE" })
          if (response.ok) {
            successCount++
          } else {
            failureCount++
          }
        } catch {
          failureCount++
        }
      }
      if (successCount > 0) {
        showSuccess(
          `Deleted ${successCount} activit${successCount === 1 ? "y" : "ies"}`,
          failureCount > 0 ? `${failureCount} failed. Try refresh and retry.` : ""
        )
      }
      if (failureCount > 0 && successCount === 0) {
        showError("Failed to delete activities", "Please refresh and try again.")
      }
      await refreshContactData()
      setSelectedActivities([])
    } finally {
      setActivityBulkActionLoading(false)
    }
  }, [selectedActivities, refreshContactData, showError, showSuccess])

  const handleBulkActivityExportCsv = useCallback(() => {
    if (selectedActivities.length === 0) {
      showError("No activities selected", "Select at least one activity to export.")
      return
    }
    const rows = (contact?.activities ?? []).filter(row => selectedActivities.includes(row.id))
    if (rows.length === 0) {
      showError("Activities unavailable", "Unable to locate the selected activities. Refresh and try again.")
      return
    }
    const headers = [
      "Activity Date",
      "Activity Type",
      "Description",
      "Account Name",
      "File Name",
      "Created By",
      "Active"
    ]
    const escapeCsv = (value: string | null | undefined) => {
      if (value === null || value === undefined) {
        return ""
      }
      const s = String(value)
      if (s.includes("\"") || s.includes(",") || s.includes("\n")) {
        return "\"" + s.replace(/"/g, "\"\"") + "\""
      }
      return s
    }
    const lines = [
      headers.join(","),
      ...rows.map(row => [
        row.activityDate
          ? row.activityDate instanceof Date
            ? row.activityDate.toLocaleDateString()
            : new Date(row.activityDate as any).toLocaleDateString()
          : "",
        row.activityType,
        row.description,
        row.accountName,
        row.fileName,
        row.createdBy,
        row.active ? "Active" : "Inactive"
      ].map(escapeCsv).join(","))
    ]
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
    link.href = url
    link.download = "activities-export-" + timestamp + ".csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    showSuccess(
      "Exported " + rows.length + " activity" + (rows.length === 1 ? "" : "ies"),
      "Check your downloads for the CSV file."
    )
  }, [selectedActivities, contact?.activities, showError, showSuccess])

  const openActivityBulkOwnerModal = useCallback(() => {
    setShowActivityBulkOwnerModal(true)
  }, [])

  const openActivityBulkStatusModal = useCallback(() => {
    setShowActivityBulkStatusModal(true)
  }, [])

  const openOpportunityBulkDeleteDialog = useCallback(() => {
    if (selectedOpportunities.length === 0) {
      showError("No opportunities selected", "Select at least one opportunity to delete.")
      return
    }

    const targets = (contact?.opportunities ?? []).filter(opportunity =>
      selectedOpportunities.includes(opportunity.id)
    )

    if (targets.length === 0) {
      showError(
        "Opportunities unavailable",
        "Unable to locate the selected opportunities. Refresh and try again."
      )
      return
    }

    setOpportunityDeleteTargets(targets)
    setOpportunityToDelete(null)
    setShowOpportunityDeleteDialog(true)
  }, [selectedOpportunities, contact?.opportunities, showError])

  const handleBulkOpportunityExportCsv = useCallback(() => {
    if (selectedOpportunities.length === 0) {
      showError("No opportunities selected", "Select at least one opportunity to export.")
      return
    }

    const rows = (contact?.opportunities ?? []).filter(row => selectedOpportunities.includes(row.id))

    if (rows.length === 0) {
      showError(
        "Opportunities unavailable",
        "Unable to locate the selected opportunities. Refresh and try again."
      )
      return
    }

    const headers = [
      "Opportunity Name",
      "Order ID - House",
      "Stage",
      "Status",
      "Owner",
      "Estimated Close Date",
      "Lead Source"
    ]

    const escapeCsv = (value: string | null | undefined) => {
      if (value === null || value === undefined) {
        return ""
      }
      const stringValue = String(value)
      if (stringValue.includes("\"") || stringValue.includes(",") || stringValue.includes("\n")) {
        return "\"" + stringValue.replace(/"/g, "\"\"") + "\""
      }
      return stringValue
    }

    const formatCsvDate = (value: string | Date | null | undefined) => {
      if (!value) {
        return ""
      }
      const dateValue = value instanceof Date ? value : new Date(value)
      if (Number.isNaN(dateValue.getTime())) {
        return ""
      }
      return dateValue.toISOString().slice(0, 10)
    }

    const lines = [
      headers.join(","),
      ...rows.map(row =>
        [
          row.opportunityName,
          row.orderIdHouse,
          row.stage,
          row.status,
          row.owner,
          formatCsvDate(row.estimatedCloseDate ?? null),
          row.referredBy
        ]
          .map(escapeCsv)
          .join(",")
      )
    ]

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
    link.href = url
    link.download = "opportunities-export-" + timestamp + ".csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    showSuccess(
      "Exported " + rows.length + " opportunity" + (rows.length === 1 ? "" : "ies"),
      "Check your downloads for the CSV file."
    )
  }, [contact?.opportunities, selectedOpportunities, showError, showSuccess])

  const handleOpportunityEdit = useCallback((opportunity: ContactOpportunityRow) => {
    setEditingOpportunity(opportunity);
  }, []);

  const handleCloseOpportunityEditModal = useCallback(() => {
    setEditingOpportunity(null);
  }, []);

  const handleOpportunityEditSuccess = useCallback(async () => {
    setEditingOpportunity(null);
    showSuccess("Opportunity updated", "The opportunity changes have been saved.");
    await refreshContactData();
  }, [refreshContactData, showSuccess]);

  const requestOpportunityDelete = useCallback((opportunity: ContactOpportunityRow) => {
    setOpportunityDeleteTargets([])
    setOpportunityToDelete(opportunity)
    setShowOpportunityDeleteDialog(true)
  }, []);

  const closeOpportunityDeleteDialog = useCallback(() => {
    setShowOpportunityDeleteDialog(false)
    setOpportunityToDelete(null)
    setOpportunityDeleteTargets([])
  }, []);

  const softDeleteContactOpportunity = useCallback(async (
    opportunityId: string,
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    try {
      const endpoint = bypassConstraints
        ? `/api/opportunities/${opportunityId}?bypassConstraints=true`
        : `/api/opportunities/${opportunityId}`

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false })
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const constraints = (payload?.constraints ?? []) as DeletionConstraint[]
        if (Array.isArray(constraints) && constraints.length > 0) {
          return { success: false, constraints }
        }

        const message = payload?.error ?? "Failed to update opportunity status"
        return { success: false, error: message }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update opportunity status"
      return { success: false, error: message }
    }
  }, [])

  const handleOpportunitySoftDelete = useCallback(async (
    opportunityId: string,
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    const result = await softDeleteContactOpportunity(opportunityId, bypassConstraints)

    if (result.success) {
      showSuccess("Opportunity archived", "The opportunity has been marked as inactive.")
      await refreshContactData()
      setSelectedOpportunities(prev => prev.filter(id => id !== opportunityId))
      setOpportunityDeleteTargets(prev => prev.filter(target => target.id !== opportunityId))
      return { success: true }
    }

    if (result.constraints && result.constraints.length > 0) {
      return { success: false, constraints: result.constraints }
    }

    const message = result.error ?? "Failed to delete opportunity"
    showError("Failed to delete opportunity", message)
    return { success: false, error: message }
  }, [refreshContactData, showError, showSuccess, softDeleteContactOpportunity]);

  const handleOpportunityPermanentDelete = useCallback(async (
    opportunityId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, { method: "DELETE" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = payload?.error ?? "Failed to delete opportunity"
        showError("Failed to delete opportunity", message)
        return { success: false, error: message }
      }

      showSuccess("Opportunity deleted", "The opportunity has been permanently removed.")
      await refreshContactData()
      setSelectedOpportunities(prev => prev.filter(id => id !== opportunityId))
      setOpportunityDeleteTargets(prev => prev.filter(target => target.id !== opportunityId))
      return { success: true }
    } catch (error) {
      console.error("Failed to permanently delete opportunity", error)
      const message = error instanceof Error ? error.message : "Unable to delete opportunity"
      showError("Failed to delete opportunity", message)
      return { success: false, error: message }
    }
  }, [refreshContactData, showError, showSuccess]);

  const executeContactOpportunityBulkSoftDelete = useCallback(async (
    entities: Array<{ id: string; name?: string; subtitle?: string }>,
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    const results = await Promise.all(
      entities.map(entity => softDeleteContactOpportunity(entity.id, bypassConstraints))
    )

    const successfulIds = entities
      .filter((_, index) => results[index]?.success)
      .map(entity => entity.id)

    if (successfulIds.length > 0) {
      await refreshContactData()
      setSelectedOpportunities(prev => prev.filter(id => !successfulIds.includes(id)))
      setOpportunityDeleteTargets(prev => prev.filter(target => !successfulIds.includes(target.id)))
      showSuccess(
        successfulIds.length === 1 ? "Opportunity archived" : "Opportunities archived",
        successfulIds.length === 1
          ? "The opportunity has been marked as inactive."
          : `${successfulIds.length} opportunities have been marked as inactive.`
      )
    }

    const constraints = results.flatMap(result => result.constraints ?? [])
    if (constraints.length > 0) {
      return { success: false, constraints }
    }

    const firstError = results.find(result => !result.success && !(result.constraints?.length))?.error
    if (firstError) {
      return { success: false, error: firstError }
    }

    return { success: successfulIds.length > 0 }
  }, [refreshContactData, setSelectedOpportunities, setOpportunityDeleteTargets, showSuccess, softDeleteContactOpportunity])

  const handleOpportunityRestore = useCallback(async (
    opportunityId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error ?? "Failed to restore opportunity";
        showError("Failed to restore opportunity", message);
        return { success: false, error: message };
      }

      showSuccess("Opportunity restored", "The opportunity has been reactivated.");
      await refreshContactData();
      return { success: true };
    } catch (error) {
      console.error("Failed to restore opportunity", error);
      const message = error instanceof Error ? error.message : "Unable to restore opportunity";
      showError("Failed to restore opportunity", message);
      return { success: false, error: message };
    }
  }, [refreshContactData, showError, showSuccess]);

  const handleGroupEdit = useCallback((group: ContactGroupRow) => {
    setEditingGroup(group);
    setShowGroupEditModal(true);
  }, []);

  const handleGroupEditModalClose = useCallback(() => {
    setShowGroupEditModal(false);
    setEditingGroup(null);
  }, []);

  const handleGroupEditSuccess = useCallback(async () => {
    setShowGroupEditModal(false);
    setEditingGroup(null);
    showSuccess("Group updated", "The group has been updated.");
    await refreshContactData();
  }, [refreshContactData, showSuccess]);

  const requestGroupDelete = useCallback((group: ContactGroupRow) => {
    setGroupToDelete(group);
    setShowGroupDeleteDialog(true);
  }, []);

  const closeGroupDeleteDialog = useCallback(() => {
    setShowGroupDeleteDialog(false);
    setGroupToDelete(null);
  }, []);

  const handleGroupSoftDelete = useCallback(async (
    groupId: string,
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false, bypassConstraints: Boolean(bypassConstraints) })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 409 && payload?.constraints) {
          return { success: false, constraints: payload.constraints };
        }
        const message = payload?.error ?? "Failed to delete group";
        showError("Failed to delete group", message);
        return { success: false, error: message };
      }

      showSuccess("Group archived", "The group has been marked as inactive.");
      await refreshContactData();
      return { success: true };
    } catch (error) {
      console.error("Failed to delete group", error);
      const message = error instanceof Error ? error.message : "Unable to delete group";
      showError("Failed to delete group", message);
      return { success: false, error: message };
    }
  }, [refreshContactData, showError, showSuccess]);

  const handleGroupPermanentDelete = useCallback(async (
    groupId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error ?? "Failed to delete group";
        showError("Failed to delete group", message);
        return { success: false, error: message };
      }

      showSuccess("Group deleted", "The group has been permanently removed.");
      await refreshContactData();
      return { success: true };
    } catch (error) {
      console.error("Failed to permanently delete group", error);
      const message = error instanceof Error ? error.message : "Unable to delete group";
      showError("Failed to delete group", message);
      return { success: false, error: message };
    }
  }, [refreshContactData, showError, showSuccess]);

  const handleGroupRestore = useCallback(async (
    groupId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error ?? "Failed to restore group";
        showError("Failed to restore group", message);
        return { success: false, error: message };
      }

      showSuccess("Group restored", "The group has been reactivated.");
      await refreshContactData();
      return { success: true };
    } catch (error) {
      console.error("Failed to restore group", error);
      const message = error instanceof Error ? error.message : "Unable to restore group";
      showError("Failed to restore group", message);
      return { success: false, error: message };
    }
  }, [refreshContactData, showError, showSuccess]);

  const hasContact = Boolean(contact)

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "--"
    const dateValue = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(dateValue.getTime())) {
      return "--"
    }
    return dateValue.toLocaleDateString()
  }

  const activitiesFilterColumns = useMemo(() => [
    { id: "activityDate", label: "Activity Date" },
    { id: "activityType", label: "Activity Type" },
    { id: "activityStatus", label: "Activity Status" },
    { id: "description", label: "Description" },
    { id: "accountName", label: "Account Name" },
    { id: "createdBy", label: "Created By" }
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

  const {
    columns: activityPreferenceColumns,
    loading: activityPreferencesLoading,
    saving: activityPreferencesSaving,
    hasUnsavedChanges: activityHasUnsavedChanges,
    lastSaved: activityLastSaved,
    handleColumnsChange: handleActivityTableColumnsChange,
    saveChanges: saveActivityTablePreferences,
    saveChangesOnModalClose: saveActivityPrefsOnModalClose,
  } = useTablePreferences("contact-details:activities", CONTACT_ACTIVITY_TABLE_BASE_COLUMNS)

  const {
    columns: contactOpportunityPreferenceColumns,
    loading: contactOpportunityPreferencesLoading,
    saving: contactOpportunityPreferencesSaving,
    hasUnsavedChanges: contactOpportunityHasUnsavedChanges,
    lastSaved: contactOpportunityLastSaved,
    handleColumnsChange: handleContactOpportunityTableColumnsChange,
    saveChanges: saveContactOpportunityTablePreferences,
    saveChangesOnModalClose: saveContactOpportunityPrefsOnModalClose,
  } = useTablePreferences("contact-details:opportunities", CONTACT_OPPORTUNITY_TABLE_BASE_COLUMNS)

  const {
    columns: contactGroupPreferenceColumns,
    loading: contactGroupPreferencesLoading,
    saving: contactGroupPreferencesSaving,
    hasUnsavedChanges: contactGroupHasUnsavedChanges,
    lastSaved: contactGroupLastSaved,
    handleColumnsChange: handleContactGroupTableColumnsChange,
    saveChanges: saveContactGroupTablePreferences,
    saveChangesOnModalClose: saveContactGroupPrefsOnModalClose,
  } = useTablePreferences("contact-details:groups", CONTACT_GROUP_TABLE_BASE_COLUMNS)

  const handleActivitiesSearch = useCallback((query: string) => {
    setActivitiesSearchQuery(query)
  }, [])

  const handleActivitiesColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    setActivitiesColumnFilters(filters)
  }, [])

  const contactActivityTableColumns = useMemo(() => {
    return activityPreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_: unknown, row: ContactActivityRow) => {
            const checked = selectedActivities.includes(row.id)
            const activeValue = !!row.active
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                {/* Checkbox */}
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="sr-only" checked={checked} aria-label={`Select activity ${row.id}`} onChange={() => handleActivitySelect(row.id, !checked)} />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                {/* Visual toggle */}
                <span className={`w-9 h-5 rounded-full ${activeValue ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform ${activeValue ? 'translate-x-4' : 'translate-x-1'} mt-0.5`} />
                </span>
                {/* Actions */}
                <div className="flex gap-0.5">
                  <button type="button" className="p-1 text-primary-600 hover:text-primary-700 transition-colors rounded" title="Edit activity" onClick={(e) => { e.stopPropagation(); handleActivityEdit(row) }}>
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="p-1 text-red-500 hover:text-red-700 transition-colors rounded" title="Delete activity" onClick={(e) => { e.stopPropagation(); handleActivityDelete(row) }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          }
        }
      }
      if (column.id === "activityDate") {
        return { ...column, render: (value?: string | Date | null) => formatDate(value) }
      }
      if (column.id === "description") {
        return {
          ...column,
          render: (value: string, row: ContactActivityRow) => (
            row.id ? (
              <Link
                href={`/activities/${row.id}`}
                className="block max-w-[360px] truncate text-primary-600 transition hover:text-primary-700 hover:underline"
              >
                {value || "View activity"}
              </Link>
            ) : (
              <span className="text-gray-500">{value || "--"}</span>
            )
          )
        }
      }
      if (column.id === "fileName") {
        return {
          ...column,
          render: (_: unknown, row: ContactActivityRow) => (
            <AttachmentChipList activityId={row.id} attachments={row.attachments} />
          )
        }
      }
      if (column.id === "attachment") {
        return {
          ...column,
          render: (_: unknown, row: ContactActivityRow) => (
            <span className="text-xs font-medium text-gray-700">
              {row.attachments?.length ? `${row.attachments.length} file${row.attachments.length === 1 ? "" : "s"}` : "None"}
            </span>
          )
        }
      }
      return column
    })
  }, [activityPreferenceColumns, handleActivityEdit, handleActivityDelete])

  const handleOpportunitiesSearch = useCallback((query: string) => {
    setOpportunitiesSearchQuery(query)
  }, [])

  const handleOpportunitiesColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    setOpportunitiesColumnFilters(filters)
  }, [])

  const contactOpportunityTableColumns = useMemo(() => {
    return contactOpportunityPreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_: unknown, row: ContactOpportunityRow) => {
            const checked = selectedOpportunities.includes(row.id)
            const activeValue = !!row.active
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="sr-only" checked={checked} aria-label={`Select opportunity ${row.opportunityName || row.id}`} onChange={() => handleOpportunitySelect(row.id, !checked)} />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                {/* Visual toggle */}
                <span className={`w-9 h-5 rounded-full ${activeValue ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform ${activeValue ? 'translate-x-4' : 'translate-x-1'} mt-0.5`} />
                </span>
                <div className="flex gap-0.5">
                  <button type="button" className="p-1 text-primary-600 hover:text-primary-700 transition-colors rounded" title="Edit opportunity" onClick={(e) => { e.stopPropagation(); handleOpportunityEdit(row) }}>
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={`p-1 rounded transition-colors ${activeValue ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'}`} title="Delete opportunity" onClick={(e) => { e.stopPropagation(); requestOpportunityDelete(row) }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          }
        }
      }
      if (column.id === "estimatedCloseDate") {
        return { ...column, render: (value?: string | Date | null) => formatDate(value) }
      }
      return column
    })
  }, [contactOpportunityPreferenceColumns, handleOpportunityEdit, requestOpportunityDelete])

  const handleGroupsSearch = useCallback((query: string) => {
    setGroupsSearchQuery(query)
  }, [])

  const handleGroupsColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    setGroupsColumnFilters(filters)
  }, [])
  
  // Selection for groups table
  const handleGroupSelect = useCallback((groupId: string, selected: boolean) => {
    setSelectedGroups(previous => {
      if (selected) {
        if (previous.includes(groupId)) return previous
        return [...previous, groupId]
      }
      return previous.filter(id => id !== groupId)
    })
  }, [])


  const contactGroupTableColumns = useMemo(() => {
    return contactGroupPreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_: unknown, row: ContactGroupRow) => {
            const checked = selectedGroups.includes(row.id)
            const activeValue = !!row.active
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="sr-only" checked={checked} aria-label={`Select group ${row.groupName || row.id}`} onChange={() => handleGroupSelect(row.id, !checked)} />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                {/* Visual toggle */}
                <span className={`w-9 h-5 rounded-full ${activeValue ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform ${activeValue ? 'translate-x-4' : 'translate-x-1'} mt-0.5`} />
                </span>
                <div className="flex gap-0.5">
                  <button type="button" className="p-1 text-primary-600 hover:text-primary-700 transition-colors rounded" title="Edit group" onClick={(e) => { e.stopPropagation(); handleGroupEdit(row) }}>
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={`p-1 rounded transition-colors ${activeValue ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'}`} title="Delete group" onClick={(e) => { e.stopPropagation(); requestGroupDelete(row) }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          }
        }
      }
      if (column.id === "groupName") {
        return {
          ...column,
          render: (value?: string) => (
            <span className="font-medium text-primary-600">{value || "--"}</span>
          )
        }
      }
      if (column.id === "visibility") {
        return {
          ...column,
          render: (value?: string) => {
            const displayValue = value || "--"
            if (displayValue === "--") {
              return <span className="text-gray-500">--</span>
            }
            return (
              <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                {displayValue}
              </span>
            )
          }
        }
      }
      return column
    })
  }, [contactGroupPreferenceColumns, selectedGroups, handleGroupSelect, handleGroupEdit, requestGroupDelete])

  const filteredActivities = useMemo(() => {
    let rows: ContactActivityRow[] = contact?.activities ?? []
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
      rows = applySimpleFilters(rows as unknown as Record<string, unknown>[], activitiesColumnFilters) as unknown as ContactActivityRow[]
    }
    return rows
  }, [contact?.activities, activeFilter, activitiesSearchQuery, activitiesColumnFilters])

  const filteredOpportunities = useMemo(() => {
    let rows: ContactOpportunityRow[] = contact?.opportunities ?? []
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
      rows = applySimpleFilters(rows as unknown as Record<string, unknown>[], opportunitiesColumnFilters) as unknown as ContactOpportunityRow[]
    }
    return rows
  }, [contact?.opportunities, activeFilter, opportunitiesSearchQuery, opportunitiesColumnFilters])

  const filteredGroups = useMemo(() => {
    let rows: ContactGroupRow[] = contact?.groups ?? []
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
      rows = applySimpleFilters(rows as unknown as Record<string, unknown>[], groupsColumnFilters) as unknown as ContactGroupRow[]
    }
    return rows
  }, [contact?.groups, activeFilter, groupsSearchQuery, groupsColumnFilters])

  const handleSelectAllGroups = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedGroups(filteredGroups.map(row => row.id))
      return
    }
    setSelectedGroups([])
  }, [filteredGroups])

  useEffect(() => {
    setSelectedActivities(prev => prev.filter(id => filteredActivities.some(row => row.id === id)));
  }, [filteredActivities]);

  useEffect(() => {
    setSelectedOpportunities(prev => prev.filter(id => filteredOpportunities.some(row => row.id === id)));
  }, [filteredOpportunities]);

  useEffect(() => {
    setOpportunityDeleteTargets(prev =>
      prev.filter(target => filteredOpportunities.some(row => row.id === target.id))
    )
  }, [filteredOpportunities])

  useEffect(() => {
    setSelectedGroups(prev => prev.filter(id => filteredGroups.some(row => row.id === id)));
  }, [filteredGroups]);

  const paginatedActivities = useMemo(() => {
    const start = (activitiesCurrentPage - 1) * activitiesPageSize
    return filteredActivities.slice(start, start + activitiesPageSize)
  }, [filteredActivities, activitiesCurrentPage, activitiesPageSize])

  const paginatedOpportunities = useMemo(() => {
    const start = (opportunitiesCurrentPage - 1) * opportunitiesPageSize
    return filteredOpportunities.slice(start, start + opportunitiesPageSize)
  }, [filteredOpportunities, opportunitiesCurrentPage, opportunitiesPageSize])

  const paginatedGroups = useMemo(() => {
    const start = (groupsCurrentPage - 1) * groupsPageSize
    return filteredGroups.slice(start, start + groupsPageSize)
  }, [filteredGroups, groupsCurrentPage, groupsPageSize])

  const activitiesPagination: PaginationInfo = useMemo(() => {
    const total = filteredActivities.length
    const totalPages = Math.max(Math.ceil(total / activitiesPageSize), 1)
    return {
      page: activitiesCurrentPage,
      pageSize: activitiesPageSize,
      total,
      totalPages
    }
  }, [filteredActivities.length, activitiesCurrentPage, activitiesPageSize])

  const opportunitiesPagination: PaginationInfo = useMemo(() => {
    const total = filteredOpportunities.length
    const totalPages = Math.max(Math.ceil(total / opportunitiesPageSize), 1)
    return {
      page: opportunitiesCurrentPage,
      pageSize: opportunitiesPageSize,
      total,
      totalPages
    }
  }, [filteredOpportunities.length, opportunitiesCurrentPage, opportunitiesPageSize])

  const groupsPagination: PaginationInfo = useMemo(() => {
    const total = filteredGroups.length
    const totalPages = Math.max(Math.ceil(total / groupsPageSize), 1)
    return {
      page: groupsCurrentPage,
      pageSize: groupsPageSize,
      total,
      totalPages
    }
  }, [filteredGroups.length, groupsCurrentPage, groupsPageSize])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredActivities.length / activitiesPageSize), 1)
    if (activitiesCurrentPage > maxPage) {
      setActivitiesCurrentPage(maxPage)
    }
  }, [filteredActivities.length, activitiesPageSize, activitiesCurrentPage])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredOpportunities.length / opportunitiesPageSize), 1)
    if (opportunitiesCurrentPage > maxPage) {
      setOpportunitiesCurrentPage(maxPage)
    }
  }, [filteredOpportunities.length, opportunitiesPageSize, opportunitiesCurrentPage])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredGroups.length / groupsPageSize), 1)
    if (groupsCurrentPage > maxPage) {
      setGroupsCurrentPage(maxPage)
    }
  }, [filteredGroups.length, groupsPageSize, groupsCurrentPage])

  const handleActivitiesPageChange = (page: number) => {
    setActivitiesCurrentPage(page)
  }

  const handleActivitiesPageSizeChange = (size: number) => {
    setActivitiesPageSize(size)
    setActivitiesCurrentPage(1)
  }

  const handleActivitySelect = useCallback((activityId: string, selected: boolean) => {
    setSelectedActivities(previous => {
      if (selected) {
        if (previous.includes(activityId)) {
          return previous
        }
        return [...previous, activityId]
      }
      return previous.filter(id => id !== activityId)
    })
  }, [])

  const handleSelectAllActivities = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedActivities(paginatedActivities.map(row => row.id))
      return
    }
    setSelectedActivities([])
  }, [paginatedActivities])

  const handleOpportunitiesPageChange = (page: number) => {
    setOpportunitiesCurrentPage(page)
  }

  const handleOpportunitiesPageSizeChange = (size: number) => {
    setOpportunitiesPageSize(size)
    setOpportunitiesCurrentPage(1)
  }

  const handleOpportunitySelect = useCallback((opportunityId: string, selected: boolean) => {
    setSelectedOpportunities(previous => {
      if (selected) {
        if (previous.includes(opportunityId)) {
          return previous
        }
        return [...previous, opportunityId]
      }
      return previous.filter(id => id !== opportunityId)
    })
  }, [])

  const handleSelectAllOpportunities = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedOpportunities(paginatedOpportunities.map(row => row.id))
      return
    }
    setSelectedOpportunities([])
  }, [paginatedOpportunities])

  const handleGroupsPageChange = (page: number) => {
    setGroupsCurrentPage(page)
  }

  const handleGroupsPageSizeChange = (size: number) => {
    setGroupsPageSize(size)
    setGroupsCurrentPage(1)
  }

  const handleBulkOpportunityOwnerUpdate = useCallback(async (ownerId: string | null) => {
    if (selectedOpportunities.length === 0) {
      showError("No opportunities selected", "Select at least one opportunity to update.")
      return
    }
    setOpportunityBulkActionLoading(true)
    try {
      const outcomes = await Promise.allSettled(
        selectedOpportunities.map(async (opportunityId) => {
          const response = await fetch(`/api/opportunities/${opportunityId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerId: ownerId ?? null })
          })
          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error || "Failed to update opportunity owner")
          }
          return opportunityId
        })
      )
      const successes = outcomes.filter(r => r.status === "fulfilled").length
      const failures = outcomes.length - successes
      if (successes > 0) {
        showSuccess(`Updated ${successes} opportunit${successes === 1 ? "y" : "ies"}`, "New owner assigned successfully.")
      }
      if (failures > 0 && successes === 0) {
        showError("Bulk opportunity owner update failed", "Please try again.")
      }
      await refreshContactData()
      setSelectedOpportunities([])
      setShowOpportunityBulkOwnerModal(false)
    } finally {
      setOpportunityBulkActionLoading(false)
    }
  }, [selectedOpportunities, refreshContactData, showError, showSuccess])

  const handleBulkOpportunityStatusUpdate = useCallback(async (isActive: boolean) => {
    if (selectedOpportunities.length === 0) {
      showError("No opportunities selected", "Select at least one opportunity to update.")
      return
    }

    setOpportunityBulkActionLoading(true)

    try {
      const targetStatus = isActive ? OpportunityStatus.Open : OpportunityStatus.Lost

      const outcomes = await Promise.allSettled(
        selectedOpportunities.map(async (opportunityId) => {
          const response = await fetch(`/api/opportunities/${opportunityId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: targetStatus })
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? "Failed to update opportunity status")
          }

          return opportunityId
        })
      )

      const successes: string[] = []
      const failures: Array<{ opportunityId: string; message: string }> = []

      outcomes.forEach((result, index) => {
        const opportunityId = selectedOpportunities[index]
        if (result.status === "fulfilled") {
          successes.push(opportunityId)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : "Unexpected error"
          failures.push({ opportunityId, message })
        }
      })

      if (successes.length > 0) {
        const label = isActive ? "active" : "inactive"
        const summary =
          "Marked " +
          successes.length +
          " opportunity" +
          (successes.length === 1 ? "" : "ies") +
          " as " +
          label
        showSuccess(summary, "The opportunity status has been updated.")
        await refreshContactData()
      }

      if (failures.length > 0) {
        const opportunityNameMap = new Map(
          (contact?.opportunities ?? []).map((opportunity) => [
            opportunity.id,
            opportunity.opportunityName || "Opportunity"
          ])
        )

        const detail = failures
          .map((item) => (opportunityNameMap.get(item.opportunityId) ?? "Opportunity") + ": " + item.message)
          .join("; ")

        showError("Failed to update status for some opportunities", detail)
      }

      setSelectedOpportunities(
        failures.length > 0 ? failures.map((item) => item.opportunityId) : []
      )

      if (failures.length === 0) {
        setShowOpportunityBulkStatusModal(false)
      }
    } catch (error) {
      console.error("Bulk opportunity status update failed", error)
      showError(
        "Bulk opportunity status update failed",
        error instanceof Error ? error.message : "Unable to update opportunity status."
      )
    } finally {
      setOpportunityBulkActionLoading(false)
    }
  }, [selectedOpportunities, contact?.opportunities, refreshContactData, showError, showSuccess])

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-none">

        <div>
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                Loading contact details...
              </div>
            ) : !hasContact ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
                {error ?? "Contact details are not available."}
              </div>
            ) : contact ? (
              <div className="space-y-3">
                <div className="rounded-2xl border-2 border-gray-400 bg-gray-50 p-3 shadow-sm">
                  {/* Header with title and controls */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Contact Detail</p>
                      <h3 className="text-base font-medium text-gray-900">Contact Information</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {contact && (
                        <button
                          onClick={handleDelete}
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                            isDeleted
                              ? "border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-700"
                              : "border border-red-300 text-red-600 hover:border-red-400 hover:text-red-700"
                          }`}
                        >
                          {isDeleted ? "Manage" : "Delete"}
                        </button>
                      )}
                      {onEdit && contact && !isDeleted && (
                        <button
                          onClick={() => onEdit(contact)}
                          className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
                        >
                          Update
                        </button>
                      )}
                      <button
                        onClick={handleBack}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600"
                      >
                        Back
                      </button>
                      <button
                        onClick={toggleDetails}
                        className="flex items-center gap-1 rounded-md bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-300 hover:text-gray-800 transition-colors"
                        title={detailsExpanded ? "Minimize details" : "Expand details"}
                      >
                        {detailsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>

                  {!detailsExpanded ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200">
                          <span className="font-medium text-gray-900">{contact.firstName} {contact.lastName}</span>
                          <span className="text-sm text-gray-500">â€¢</span>
                          <span className="text-sm text-gray-600">{contact.accountName}</span>
                          {contact.jobTitle && (
                            <>
                              <span className="text-sm text-gray-500">â€¢</span>
                              <span className="text-sm text-gray-600">{contact.jobTitle}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <FieldRow
                        label="Name"
                        value={
                          <div className="grid gap-2 md:grid-cols-5">
                            <div>
                              <div className={fieldLabelClass}>Prefix</div>
                              <div className={fieldBoxClass}>{contact.prefix || "--"}</div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>First</div>
                              <div className={fieldBoxClass}>{contact.firstName}</div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>Middle</div>
                              <div className={fieldBoxClass}>{contact.middleName || "--"}</div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>Last</div>
                              <div className={fieldBoxClass}>{contact.lastName}</div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>Suffix</div>
                              <div className={fieldBoxClass}>{contact.suffix || "--"}</div>
                            </div>
                          </div>
                        }
                      />
                      <FieldRow
                        label="Account Name"
                        value={<div className={fieldBoxClass}>{contact.accountName}</div>}
                      />
                      <FieldRow
                        label="Job Title"
                        value={<div className={fieldBoxClass}>{contact.jobTitle || "--"}</div>}
                      />
                      <FieldRow
                        label="Department"
                        value={<div className={fieldBoxClass}>{contact.department || "--"}</div>}
                      />
                      <FieldRow
                        label="Active (Y/N)"
                        value={
                          <div className="flex items-center gap-2 rounded-lg border-2 border-gray-400 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm">
                            <ReadOnlySwitch value={contact.active} />
                            <span>{contact.active ? "Active" : "Inactive"}</span>
                          </div>
                        }
                      />
                    </div>
                    <div className="space-y-3">
                      <FieldRow
                        label="Contact Type"
                        value={<div className={fieldBoxClass}>{contact.contactType || "--"}</div>}
                      />
                      <FieldRow
                        label="Email Address"
                        value={<div className={fieldBoxClass}>{contact.emailAddress || "--"}</div>}
                      />
                      <FieldRow
                        label="Alternate Email"
                        value={<div className={fieldBoxClass}>{contact.alternateEmail || "--"}</div>}
                      />
                      <FieldRow
                        label="Work Phone"
                        value={
                          <div className="grid gap-2 md:grid-cols-[1fr,110px]">
                            <div className={fieldBoxClass}>{contact.workPhone || "--"}</div>
                            <div className={fieldBoxClass}>Ext {contact.workPhoneExt || "--"}</div>
                          </div>
                        }
                      />
                      <FieldRow
                        label="Mobile"
                        value={<div className={fieldBoxClass}>{contact.mobilePhone || "--"}</div>}
                      />
                      <FieldRow
                        label="Other Phone"
                        value={<div className={fieldBoxClass}>{contact.otherPhone || "--"}</div>}
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className={fieldLabelClass}>Description</div>
                    <div className="mt-0.5 rounded-lg border-2 border-gray-400 bg-white px-2.5 py-1 text-sm text-gray-700 shadow-sm">
                      {contact.description || "No description provided."}
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className={fieldLabelClass}>Notes</div>
                    <div className="mt-0.5 rounded-lg border-2 border-gray-400 bg-white px-2.5 py-1 text-sm text-gray-700 shadow-sm">
                      {contact.notes || "No notes provided."}
                    </div>
                  </div>
                    </>
                  )}
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

                  {activeTab === "activities" && (
                    <div className="flex flex-col gap-2">
                      <ListHeader
                        onCreateClick={handleCreateNewClick}
                        onFilterChange={setActiveFilter as unknown as (filter: string) => void}
                        statusFilter={activeFilter}
                        onSearch={handleActivitiesSearch}
                        filterColumns={activitiesFilterColumns}
                        columnFilters={activitiesColumnFilters}
                        onColumnFiltersChange={handleActivitiesColumnFiltersChange}
                        onSettingsClick={() => setShowActivitiesColumnSettings(true)}
                        showCreateButton={Boolean(contact) && !isDeleted && !loading}
                        searchPlaceholder="Search activities"
                      />
                      <ActivityBulkActionBar
                        count={selectedActivities.length}
                        disabled={activityBulkActionLoading}
                        onSoftDelete={openActivityBulkDeleteDialog}
                        onExportCsv={handleBulkActivityExportCsv}
                        onChangeOwner={openActivityBulkOwnerModal}
                        onUpdateStatus={openActivityBulkStatusModal}
                      />
                      <div
                        className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-lg"
                        ref={tableAreaRefCallback}
                        style={tableContainerStyle}
                      >
                        <DynamicTable
                          className="flex flex-col"
                          columns={contactActivityTableColumns}
                          data={paginatedActivities}
                          emptyMessage="No activities found for this contact"
                          onColumnsChange={handleActivityTableColumnsChange}
                          loading={loading || activityPreferencesLoading}
                          pagination={activitiesPagination}
                          onPageChange={handleActivitiesPageChange}
                          onPageSizeChange={handleActivitiesPageSizeChange}
                          selectedItems={selectedActivities}
                          onItemSelect={(id, selected) => handleActivitySelect(id, selected)}
                          onSelectAll={handleSelectAllActivities}
                          autoSizeColumns={true}
                          fillContainerWidth
                          maxBodyHeight={tableBodyMaxHeight}
                          alwaysShowPagination
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === "opportunities" && (
                    <div className="flex flex-col gap-2">
                      <ListHeader
                        onCreateClick={handleCreateNewClick}
                        onFilterChange={setActiveFilter as unknown as (filter: string) => void}
                        statusFilter={activeFilter}
                        onSearch={handleOpportunitiesSearch}
                        filterColumns={opportunitiesFilterColumns}
                        columnFilters={opportunitiesColumnFilters}
                        onColumnFiltersChange={handleOpportunitiesColumnFiltersChange}
                        onSettingsClick={() => setShowOpportunitiesColumnSettings(true)}
                        showCreateButton={Boolean(contact) && !isDeleted && !loading}
                        searchPlaceholder="Search opportunities"
                      />
                      <OpportunityBulkActionBar
                        count={selectedOpportunities.length}
                        disabled={opportunityBulkActionLoading}
                        onSoftDelete={openOpportunityBulkDeleteDialog}
                        onExportCsv={handleBulkOpportunityExportCsv}
                        onChangeOwner={() => setShowOpportunityBulkOwnerModal(true)}
                        onUpdateStatus={() => setShowOpportunityBulkStatusModal(true)}
                      />
                      <div
                        className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-lg"
                        ref={tableAreaRefCallback}
                        style={tableContainerStyle}
                      >
                        <DynamicTable
                          className="flex flex-col"
                          columns={contactOpportunityTableColumns}
                          data={paginatedOpportunities}
                          emptyMessage="No opportunities found for this contact"
                          onColumnsChange={handleContactOpportunityTableColumnsChange}
                          loading={loading || contactOpportunityPreferencesLoading}
                          pagination={opportunitiesPagination}
                          onPageChange={handleOpportunitiesPageChange}
                          onPageSizeChange={handleOpportunitiesPageSizeChange}
                          selectedItems={selectedOpportunities}
                          onItemSelect={(id, selected) => handleOpportunitySelect(id, selected)}
                          onSelectAll={handleSelectAllOpportunities}
                          autoSizeColumns={true}
                          fillContainerWidth
                          maxBodyHeight={tableBodyMaxHeight}
                          alwaysShowPagination
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === "groups" && (
                    <div className="flex flex-col gap-2">
                      <ListHeader
                        onCreateClick={handleCreateNewClick}
                        onFilterChange={setActiveFilter as unknown as (filter: string) => void}
                        statusFilter={activeFilter}
                        onSearch={handleGroupsSearch}
                        filterColumns={groupsFilterColumns}
                        columnFilters={groupsColumnFilters}
                        onColumnFiltersChange={handleGroupsColumnFiltersChange}
                        onSettingsClick={() => setShowGroupsColumnSettings(true)}
                        showCreateButton={Boolean(contact) && !isDeleted && !loading}
                        searchPlaceholder="Search groups"
                      />
                      <div
                        className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-lg"
                        ref={tableAreaRefCallback}
                        style={tableContainerStyle}
                      >
        <DynamicTable
          className="flex flex-col"
          columns={contactGroupTableColumns}
          data={paginatedGroups}
          emptyMessage="No groups found for this contact"
          onColumnsChange={handleContactGroupTableColumnsChange}
          loading={loading || contactGroupPreferencesLoading}
          pagination={groupsPagination}
          onPageChange={handleGroupsPageChange}
          onPageSizeChange={handleGroupsPageSizeChange}
          selectedItems={selectedGroups}
          onItemSelect={handleGroupSelect}
          onSelectAll={handleSelectAllGroups}
          autoSizeColumns={true}
          fillContainerWidth
          maxBodyHeight={tableBodyMaxHeight}
          alwaysShowPagination
        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
                Contact details are not available.
              </div>
            )}
        </div>
      </div>

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={closeDeleteDialog}
        entity="Contact"
        entityName={contact ? `${contact.firstName} ${contact.lastName}` : "Unknown Contact"}
        entityId={contact?.id || ""}
        isDeleted={isDeleted}
        onSoftDelete={handleSoftDelete}
        onPermanentDelete={handlePermanentDelete}
        onRestore={handleRestore}
        userCanPermanentDelete={true} // TODO: Check user permissions
      />

      <TwoStageDeleteDialog
        isOpen={showOpportunityDeleteDialog}
        onClose={closeOpportunityDeleteDialog}
        entity="Opportunity"
        entityName={
          opportunityDeleteTargets.length > 0
            ? `${opportunityDeleteTargets.length} opportunity${opportunityDeleteTargets.length === 1 ? '' : 'ies'}`
            : opportunityToDelete?.opportunityName || "Unknown Opportunity"
        }
        entityId={
          opportunityDeleteTargets.length > 0
            ? opportunityDeleteTargets[0]?.id || ""
            : opportunityToDelete?.id || ""
        }
        multipleEntities={
          opportunityDeleteTargets.length > 0
            ? opportunityDeleteTargets.map(opportunity => ({
                id: opportunity.id,
                name: opportunity.opportunityName || "Opportunity",
                subtitle: opportunity.owner ? `Owner: ${opportunity.owner}` : undefined
              }))
            : undefined
        }
        entityLabelPlural="Opportunities"
        isDeleted={
          opportunityDeleteTargets.length > 0
            ? opportunityDeleteTargets.every(opportunity => opportunity.isDeleted)
            : opportunityToDelete?.isDeleted || false
        }
        onSoftDelete={handleOpportunitySoftDelete}
        onBulkSoftDelete={
          opportunityDeleteTargets.length > 0
            ? (entities, bypassConstraints) =>
                executeContactOpportunityBulkSoftDelete(
                  opportunityDeleteTargets.filter(opportunity =>
                    entities.some(entity => entity.id === opportunity.id)
                  ),
                  bypassConstraints
                )
            : undefined
        }
        onPermanentDelete={handleOpportunityPermanentDelete}
        onRestore={handleOpportunityRestore}
        userCanPermanentDelete={opportunityDeleteTargets.length === 0}
      />

      <TwoStageDeleteDialog
        isOpen={showGroupDeleteDialog}
        onClose={closeGroupDeleteDialog}
        entity="Group"
        entityName={groupToDelete?.groupName || "Unknown Group"}
        entityId={groupToDelete?.id || ""}
        isDeleted={groupToDelete?.isDeleted || false}
        onSoftDelete={handleGroupSoftDelete}
        onPermanentDelete={handleGroupPermanentDelete}
        onRestore={handleGroupRestore}
        userCanPermanentDelete={true}
      />

      {contact && (
        <>
          <ActivityNoteCreateModal
            isOpen={activityModalOpen}
            context="contact"
            entityName={contactDisplayName || contact.accountName}
            accountId={contact.accountId}
            contactId={contact.id}
            onClose={() => setActivityModalOpen(false)}
            onSuccess={handlePostCreate}
          />
          <ActivityNoteEditModal
            isOpen={Boolean(editingActivity)}
            activityId={editingActivity?.id ?? null}
            accountId={contact.accountId}
            contactId={contact.id}
            onClose={handleCloseActivityEditModal}
            onSuccess={handleActivityEditSuccess}
          />
          <ContactOpportunityCreateModal
            isOpen={opportunityModalOpen}
            contactName={contactDisplayName}
            accountId={contact.accountId}
            accountName={contact.accountName}
            onClose={() => setOpportunityModalOpen(false)}
            onSuccess={handlePostCreate}
          />
          <ContactGroupCreateModal
            isOpen={groupModalOpen}
            contactName={contactDisplayName}
            accountId={contact.accountId}
            contactId={contact.id}
            onClose={() => setGroupModalOpen(false)}
            onSuccess={handlePostCreate}
          />

          <OpportunityEditModal
            isOpen={Boolean(editingOpportunity)}
            opportunityId={editingOpportunity?.id ?? null}
            onClose={handleCloseOpportunityEditModal}
            onSuccess={handleOpportunityEditSuccess}
          />

          <GroupEditModal
            isOpen={showGroupEditModal}
            group={editingGroup}
            onClose={handleGroupEditModalClose}
            onSuccess={handleGroupEditSuccess}
          />

          {/* Column chooser modals */}
          <ColumnChooserModal
            isOpen={showActivitiesColumnSettings}
            columns={activityPreferenceColumns}
            onApply={handleActivityTableColumnsChange}
            onClose={async () => {
              setShowActivitiesColumnSettings(false)
              await saveActivityPrefsOnModalClose()
            }}
          />
          <ColumnChooserModal
            isOpen={showOpportunitiesColumnSettings}
            columns={contactOpportunityPreferenceColumns}
            onApply={handleContactOpportunityTableColumnsChange}
            onClose={async () => {
              setShowOpportunitiesColumnSettings(false)
              await saveContactOpportunityPrefsOnModalClose()
            }}
          />
          <ColumnChooserModal
            isOpen={showGroupsColumnSettings}
            columns={contactGroupPreferenceColumns}
            onApply={handleContactGroupTableColumnsChange}
            onClose={async () => {
              setShowGroupsColumnSettings(false)
              await saveContactGroupPrefsOnModalClose()
            }}
          />

          {/* Activity bulk modals */}
          <ActivityBulkOwnerModal
            isOpen={showActivityBulkOwnerModal}
            owners={[]}
            onClose={() => setShowActivityBulkOwnerModal(false)}
            onSubmit={async (ownerId) => {
              if (selectedActivities.length === 0) {
                showError("No activities selected", "Select at least one activity to update.")
                return
              }
              setActivityBulkActionLoading(true)
              try {
                const outcomes = await Promise.allSettled(
                  selectedActivities.map(async (activityId) => {
                    const response = await fetch(`/api/activities/${activityId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ assigneeId: ownerId })
                    })
                    if (!response.ok) {
                      const payload = await response.json().catch(() => null)
                      throw new Error(payload?.error || "Failed to update activity owner")
                    }
                    return activityId
                  })
                )
                const successes = outcomes.filter(r => r.status === "fulfilled").length
                const failures = outcomes.length - successes
                if (successes > 0) {
                  showSuccess(`Updated ${successes} activit${successes === 1 ? "y" : "ies"}`, "New owner assigned successfully.")
                }
                if (failures > 0 && successes === 0) {
                  showError("Bulk activity owner update failed", "Please try again.")
                }
                await refreshContactData()
                setSelectedActivities([])
                setShowActivityBulkOwnerModal(false)
              } finally {
                setActivityBulkActionLoading(false)
              }
            }}
            isSubmitting={activityBulkActionLoading}
          />
          <ActivityBulkStatusModal
            isOpen={showActivityBulkStatusModal}
            onClose={() => setShowActivityBulkStatusModal(false)}
            onSubmit={async (isActive) => {
              if (selectedActivities.length === 0) {
                showError("No activities selected", "Select at least one activity to update.")
                return
              }
              setActivityBulkActionLoading(true)
              try {
                const outcomes = await Promise.allSettled(
                  selectedActivities.map(async (activityId) => {
                    const response = await fetch(`/api/activities/${activityId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: isActive ? "Open" : "Completed" })
                    })
                    if (!response.ok) {
                      const payload = await response.json().catch(() => null)
                      throw new Error(payload?.error || "Failed to update activity status")
                    }
                    return activityId
                  })
                )
                const successes = outcomes.filter(r => r.status === "fulfilled").length
                const failures = outcomes.length - successes
                if (successes > 0) {
                  showSuccess(
                    `Updated status for ${successes} activit${successes === 1 ? "y" : "ies"}`,
                    "The status has been updated successfully."
                  )
                }
                if (failures > 0 && successes === 0) {
                  showError("Bulk activity status update failed", "Please try again.")
                }
                await refreshContactData()
                setSelectedActivities([])
                setShowActivityBulkStatusModal(false)
              } finally {
                setActivityBulkActionLoading(false)
              }
            }}
            isSubmitting={activityBulkActionLoading}
          />
          <OpportunityBulkOwnerModal
            isOpen={showOpportunityBulkOwnerModal}
            owners={opportunityOwners}
            onClose={() => setShowOpportunityBulkOwnerModal(false)}
            onSubmit={handleBulkOpportunityOwnerUpdate}
            isSubmitting={opportunityBulkActionLoading}
          />
          <OpportunityBulkStatusModal
            isOpen={showOpportunityBulkStatusModal}
            onClose={() => setShowOpportunityBulkStatusModal(false)}
            onSubmit={handleBulkOpportunityStatusUpdate}
            isSubmitting={opportunityBulkActionLoading}
          />
        </>
      )}
    </div>
  )
}










