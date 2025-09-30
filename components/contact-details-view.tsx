"use client"

import Link from "next/link"
import { ReactNode, useCallback, useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Filter, Paperclip, Plus, Search, Settings, Trash2, Edit, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { TwoStageDeleteDialog } from "./two-stage-delete-dialog"
import { DeletionConstraint } from "@/lib/deletion"
import { DynamicTable, Column, PaginationInfo } from "./dynamic-table"
import { useToasts } from "./toast"
import { ActivityNoteCreateModal } from "./activity-note-create-modal"
import { ContactOpportunityCreateModal } from "./contact-opportunity-create-modal"
import { ContactGroupCreateModal } from "./contact-group-create-modal"
import { ListHeader, type ColumnFilter } from "./list-header"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import { applySimpleFilters } from "@/lib/filter-utils"
import { ColumnChooserModal } from "./column-chooser-modal"
import { OpportunityEditModal } from "./opportunity-edit-modal"
import { GroupEditModal } from "./group-edit-modal"

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
  },
  {
    id: "actions",
    label: "Actions",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: false,
    resizable: false,
    hideable: false
  }
]

const CONTACT_OPPORTUNITY_TABLE_BASE_COLUMNS: Column[] = [
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
  },
  {
    id: "actions",
    label: "Actions",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: false,
    resizable: false,
    hideable: false
  }
]

const CONTACT_GROUP_TABLE_BASE_COLUMNS: Column[] = [
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
  },
  {
    id: "actions",
    label: "Actions",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: false,
    resizable: false,
    hideable: false
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
  const { showError } = useToasts()

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
  const [editingOpportunity, setEditingOpportunity] = useState<ContactOpportunityRow | null>(null)
  const [opportunityToDelete, setOpportunityToDelete] = useState<ContactOpportunityRow | null>(null)
  const [showOpportunityDeleteDialog, setShowOpportunityDeleteDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ContactGroupRow | null>(null)
  const [showGroupEditModal, setShowGroupEditModal] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<ContactGroupRow | null>(null)
  const [showGroupDeleteDialog, setShowGroupDeleteDialog] = useState(false)

  useEffect(() => {
    setActiveTab("activities")
    setIsDeleted(Boolean(contact?.deletedAt))
  }, [contact?.id, contact?.deletedAt])

  useEffect(() => {
    setActivityModalOpen(false)
    setOpportunityModalOpen(false)
    setGroupModalOpen(false)
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

    router.push(`/activities/${activity.id}`);
  }, [router, showError]);

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
    setOpportunityToDelete(opportunity);
    setShowOpportunityDeleteDialog(true);
  }, []);

  const closeOpportunityDeleteDialog = useCallback(() => {
    setShowOpportunityDeleteDialog(false);
    setOpportunityToDelete(null);
  }, []);

  const handleOpportunitySoftDelete = useCallback(async (
    opportunityId: string,
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false, bypassConstraints: Boolean(bypassConstraints) })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 409 && payload?.constraints) {
          return { success: false, constraints: payload.constraints };
        }
        const message = payload?.error ?? "Failed to delete opportunity";
        showError("Failed to delete opportunity", message);
        return { success: false, error: message };
      }

      showSuccess("Opportunity archived", "The opportunity has been marked as inactive.");
      await refreshContactData();
      return { success: true };
    } catch (error) {
      console.error("Failed to delete opportunity", error);
      const message = error instanceof Error ? error.message : "Unable to delete opportunity";
      showError("Failed to delete opportunity", message);
      return { success: false, error: message };
    }
  }, [refreshContactData, showError, showSuccess]);

  const handleOpportunityPermanentDelete = useCallback(async (
    opportunityId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error ?? "Failed to delete opportunity";
        showError("Failed to delete opportunity", message);
        return { success: false, error: message };
      }

      showSuccess("Opportunity deleted", "The opportunity has been permanently removed.");
      await refreshContactData();
      return { success: true };
    } catch (error) {
      console.error("Failed to permanently delete opportunity", error);
      const message = error instanceof Error ? error.message : "Unable to delete opportunity";
      showError("Failed to delete opportunity", message);
      return { success: false, error: message };
    }
  }, [refreshContactData, showError, showSuccess]);

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
      if (column.id === "actions") {
        return {
          ...column,
          render: (_: unknown, row: ContactActivityRow) => (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-primary-600 transition hover:text-primary-700"
                title="Edit activity"
                onClick={event => {
                  event.stopPropagation()
                  handleActivityEdit(row)
                }}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="text-red-500 transition hover:text-red-700"
                title="Delete activity"
                onClick={event => {
                  event.stopPropagation()
                  handleActivityDelete(row)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
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
      if (column.id === "estimatedCloseDate") {
        return { ...column, render: (value?: string | Date | null) => formatDate(value) }
      }
      if (column.id === "actions") {
        return {
          ...column,
          render: (_: unknown, row: ContactOpportunityRow) => (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-primary-600 transition hover:text-primary-700"
                title="Edit opportunity"
                onClick={event => {
                  event.stopPropagation()
                  handleOpportunityEdit(row)
                }}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="text-red-500 transition hover:text-red-700"
                title="Delete opportunity"
                onClick={event => {
                  event.stopPropagation()
                  requestOpportunityDelete(row)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        }
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

  const contactGroupTableColumns = useMemo(() => {
    return contactGroupPreferenceColumns.map(column => {
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
      if (column.id === "actions") {
        return {
          ...column,
          render: (_: unknown, row: ContactGroupRow) => (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-primary-600 transition hover:text-primary-700"
                title="Edit group"
                onClick={event => {
                  event.stopPropagation()
                  handleGroupEdit(row)
                }}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="text-red-500 transition hover:text-red-700"
                title="Delete group"
                onClick={event => {
                  event.stopPropagation()
                  requestGroupDelete(row)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        }
      }
      return column
    })
  }, [contactGroupPreferenceColumns, handleGroupEdit, requestGroupDelete])

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

  const handleOpportunitiesPageChange = (page: number) => {
    setOpportunitiesCurrentPage(page)
  }

  const handleOpportunitiesPageSizeChange = (size: number) => {
    setOpportunitiesPageSize(size)
    setOpportunitiesCurrentPage(1)
  }

  const handleGroupsPageChange = (page: number) => {
    setGroupsCurrentPage(page)
  }

  const handleGroupsPageSizeChange = (size: number) => {
    setGroupsPageSize(size)
    setGroupsCurrentPage(1)
  }
    return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-none">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Contact Detail</p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                {contact ? `${contact.firstName} ${contact.lastName}` : "Contact information"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{contact?.accountName ?? ""}</p>
              <p className="mt-1 text-sm text-gray-500">{contact?.jobTitle || (!loading && hasContact ? "No job title" : "")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {contact && (
                <button
                  onClick={handleDelete}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
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
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                >
                  Update
                </button>
              )}
              <button
                onClick={handleBack}
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
                Loading contact details...
              </div>
            ) : !hasContact ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
                {error ?? "Contact details are not available."}
              </div>
            ) : contact ? (
              <div className="space-y-3">
                <div className="rounded-2xl border-2 border-gray-400 bg-gray-50 p-3 shadow-sm">
                  {/* Header with expand/collapse toggle */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-medium text-gray-900">Contact Information</h3>
                    </div>
                    <button
                      onClick={toggleDetails}
                      className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors"
                      title={detailsExpanded ? "Minimize details" : "Expand details"}
                    >
                      {detailsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {detailsExpanded ? "Minimize" : "Expand"}
                    </button>
                  </div>

                  {!detailsExpanded ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200">
                          <span className="font-medium text-gray-900">{contact.firstName} {contact.lastName}</span>
                          <span className="text-sm text-gray-500">•</span>
                          <span className="text-sm text-gray-600">{contact.accountName}</span>
                          {contact.jobTitle && (
                            <>
                              <span className="text-sm text-gray-500">•</span>
                              <span className="text-sm text-gray-600">{contact.jobTitle}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-2 lg:grid-cols-2">
                    <div className="space-y-2">
                      <FieldRow
                        label="Name"
                        value={
                          <div className="grid gap-1.5 md:grid-cols-5">
                            <div>
                              <div className={fieldLabelClass}>Prefix</div>
                              <div className={fieldBoxClass}>{contact.prefix || "-"}</div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>First</div>
                              <div className={fieldBoxClass}>{contact.firstName}</div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>Middle</div>
                              <div className={fieldBoxClass}>{contact.middleName || "-"}</div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>Last</div>
                              <div className={fieldBoxClass}>{contact.lastName}</div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>Suffix</div>
                              <div className={fieldBoxClass}>{contact.suffix || "-"}</div>
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
                      <div className="grid gap-1.5 md:grid-cols-2">
                        <div className="space-y-0.5">
                          <span className={fieldLabelClass}>Primary Contact</span>
                          <div className="flex items-center gap-2 rounded-lg border-2 border-gray-400 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm">
                            <ReadOnlySwitch value={Boolean(contact.isPrimary)} />
                            <span>{contact.isPrimary ? "Yes" : "No"}</span>
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <span className={fieldLabelClass}>Decision Maker</span>
                          <div className="flex items-center gap-2 rounded-lg border-2 border-gray-400 bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm">
                            <ReadOnlySwitch value={Boolean(contact.isDecisionMaker)} />
                            <span>{contact.isDecisionMaker ? "Yes" : "No"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
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
                          <div className="grid gap-1.5 md:grid-cols-[1fr,110px]">
                            <div className={fieldBoxClass}>{contact.workPhone || "-"}</div>
                            <div className={fieldBoxClass}>Ext {contact.workPhoneExt || "-"}</div>
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
                      <FieldRow
                        label="Fax"
                        value={<div className={fieldBoxClass}>{contact.fax || "--"}</div>}
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
                  <div className="mt-2 grid gap-2 lg:grid-cols-2">
                    <div className="space-y-2">
                      <FieldRow
                        label="Assistant Name"
                        value={<div className={fieldBoxClass}>{contact.assistantName || "--"}</div>}
                      />
                      <FieldRow
                        label="Assistant Phone"
                        value={<div className={fieldBoxClass}>{contact.assistantPhone || "--"}</div>}
                      />
                      <FieldRow
                        label="LinkedIn URL"
                        value={<div className={fieldBoxClass}>{contact.linkedinUrl || "--"}</div>}
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldRow
                        label="Website URL"
                        value={<div className={fieldBoxClass}>{contact.websiteUrl || "--"}</div>}
                      />
                      <FieldRow
                        label="Birthdate"
                        value={<div className={fieldBoxClass}>{contact.birthdate ? formatDate(contact.birthdate) : "--"}</div>}
                      />
                      <FieldRow
                        label="Anniversary"
                        value={<div className={fieldBoxClass}>{contact.anniversary ? formatDate(contact.anniversary) : "--"}</div>}
                      />
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
                        hasUnsavedTableChanges={activityHasUnsavedChanges}
                        isSavingTableChanges={activityPreferencesSaving}
                        lastTableSaved={activityLastSaved ?? undefined}
                        onSaveTableChanges={saveActivityTablePreferences}
                        onSettingsClick={() => setShowActivitiesColumnSettings(true)}
                        showCreateButton={Boolean(contact) && !isDeleted && !loading}
                        searchPlaceholder="Search activities"
                      />
                      <DynamicTable
                        columns={contactActivityTableColumns}
                        data={paginatedActivities}
                        emptyMessage="No activities found for this contact"
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
                        hasUnsavedTableChanges={contactOpportunityHasUnsavedChanges}
                        isSavingTableChanges={contactOpportunityPreferencesSaving}
                        lastTableSaved={contactOpportunityLastSaved ?? undefined}
                        onSaveTableChanges={saveContactOpportunityTablePreferences}
                        onSettingsClick={() => setShowOpportunitiesColumnSettings(true)}
                        showCreateButton={Boolean(contact) && !isDeleted && !loading}
                        searchPlaceholder="Search opportunities"
                      />
                      <DynamicTable
                        columns={contactOpportunityTableColumns}
                        data={paginatedOpportunities}
                        emptyMessage="No opportunities found for this contact"
                        onColumnsChange={handleContactOpportunityTableColumnsChange}
                        loading={loading || contactOpportunityPreferencesLoading}
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
                        onCreateClick={handleCreateNewClick}
                        onFilterChange={setActiveFilter as unknown as (filter: string) => void}
                        statusFilter={activeFilter}
                        onSearch={handleGroupsSearch}
                        filterColumns={groupsFilterColumns}
                        columnFilters={groupsColumnFilters}
                        onColumnFiltersChange={handleGroupsColumnFiltersChange}
                        hasUnsavedTableChanges={contactGroupHasUnsavedChanges}
                        isSavingTableChanges={contactGroupPreferencesSaving}
                        lastTableSaved={contactGroupLastSaved ?? undefined}
                        onSaveTableChanges={saveContactGroupTablePreferences}
                        onSettingsClick={() => setShowGroupsColumnSettings(true)}
                        showCreateButton={Boolean(contact) && !isDeleted && !loading}
                        searchPlaceholder="Search groups"
                      />
                      <DynamicTable
                        columns={contactGroupTableColumns}
                        data={paginatedGroups}
                        emptyMessage="No groups found for this contact"
                        onColumnsChange={handleContactGroupTableColumnsChange}
                        loading={loading || contactGroupPreferencesLoading}
                        pagination={groupsPagination}
                        onPageChange={handleGroupsPageChange}
                        onPageSizeChange={handleGroupsPageSizeChange}
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
        entityName={opportunityToDelete?.opportunityName || "Unknown Opportunity"}
        entityId={opportunityToDelete?.id || ""}
        isDeleted={opportunityToDelete?.isDeleted || false}
        onSoftDelete={handleOpportunitySoftDelete}
        onPermanentDelete={handleOpportunityPermanentDelete}
        onRestore={handleOpportunityRestore}
        userCanPermanentDelete={true}
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
        </>
      )}
    </div>
  )
}























