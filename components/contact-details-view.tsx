"use client"

import { ReactNode, useCallback, useEffect, useState } from "react"
import { Loader2, Filter, Plus, Search, Settings, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TwoStageDeleteDialog } from "./two-stage-delete-dialog"
import { DeletionConstraint } from "@/lib/deletion"
import { DynamicTable, Column } from "./dynamic-table"

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
}

export interface ContactOpportunityRow {
  id: string
  active: boolean
  orderIdHouse?: string
  opportunityName: string
  stage?: string
  owner?: string
  estimatedCloseDate?: string | Date | null
  referredBy?: string
}

export interface ContactGroupRow {
  id: string
  active: boolean
  groupName: string
  visibility?: string
  description?: string
  owner?: string
}

export interface ContactDetail {
  id: string
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

interface ContactDetailsViewProps {
  contact: ContactDetail | null
  loading?: boolean
  error?: string | null
  onBack: () => void
  onEdit?: (contact: ContactDetail) => void
  onContactUpdated?: (contact: ContactDetail) => void
}


const TABS: { id: "activities" | "opportunities" | "groups"; label: string }[] = [
  { id: "activities", label: "Activities & Notes" },
  { id: "opportunities", label: "Opportunities" },
  { id: "groups", label: "Groups" }
]

const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-gray-500"
const fieldBoxClass = "flex min-h-[28px] items-center justify-between rounded-lg border-2 border-gray-400 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm"

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

function TabToolbar() {
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
      </div>
    </div>
  )
}


export function ContactDetailsView({ contact, loading = false, error, onBack, onEdit, onContactUpdated }: ContactDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<"activities" | "opportunities" | "groups">("activities")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)

  useEffect(() => {
    setActiveTab("activities")
    setIsDeleted(Boolean(contact?.deletedAt))
  }, [contact?.id, contact?.deletedAt])

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
      onBack();
      return { success: true };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unable to permanently delete contact" 
      };
    }
  }, [onBack]);

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

  const hasContact = Boolean(contact)

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
      <div className="mx-auto w-full max-w-7xl">
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
                Loading contact details...
              </div>
            ) : !hasContact ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
                {error ?? "Contact details are not available."}
              </div>
            ) : contact ? (
              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-gray-400 bg-gray-50 p-4 shadow-sm">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2.5">
                      <FieldRow
                        label="Name"
                        value={
                          <div className="grid gap-2 md:grid-cols-5">
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
                        value={<div className={fieldBoxClass}>{contact.jobTitle || "—"}</div>}
                      />
                      <FieldRow
                        label="Department"
                        value={<div className={fieldBoxClass}>{contact.department || "—"}</div>}
                      />
                      <FieldRow
                        label="Active (Y/N)"
                        value={
                          <div className="flex items-center gap-2 rounded-lg border-2 border-gray-400 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm">
                            <ReadOnlySwitch value={contact.active} />
                            <span>{contact.active ? "Active" : "Inactive"}</span>
                          </div>
                        }
                      />
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <span className={fieldLabelClass}>Primary Contact</span>
                          <div className="flex items-center gap-2 rounded-lg border-2 border-gray-400 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm">
                            <ReadOnlySwitch value={Boolean(contact.isPrimary)} />
                            <span>{contact.isPrimary ? "Yes" : "No"}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className={fieldLabelClass}>Decision Maker</span>
                          <div className="flex items-center gap-2 rounded-lg border-2 border-gray-400 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm">
                            <ReadOnlySwitch value={Boolean(contact.isDecisionMaker)} />
                            <span>{contact.isDecisionMaker ? "Yes" : "No"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                    
                      <FieldRow
                        label="Contact Type"
                        value={<div className={fieldBoxClass}>{contact.contactType || "—"}</div>}
                      />
                      <FieldRow
                        label="Email Address"
                        value={<div className={fieldBoxClass}>{contact.emailAddress || "—"}</div>}
                      />
                      <FieldRow
                        label="Alternate Email"
                        value={<div className={fieldBoxClass}>{contact.alternateEmail || "—"}</div>}
                      />
                      <FieldRow
                        label="Work Phone"
                        value={
                          <div className="grid gap-2 md:grid-cols-[1fr,110px]">
                            <div className={fieldBoxClass}>{contact.workPhone || "-"}</div>
                            <div className={fieldBoxClass}>Ext {contact.workPhoneExt || "-"}</div>
                          </div>
                        }
                      />
                      <FieldRow
                        label="Mobile"
                        value={<div className={fieldBoxClass}>{contact.mobilePhone || "—"}</div>}
                      />
                      <FieldRow
                        label="Other Phone"
                        value={<div className={fieldBoxClass}>{contact.otherPhone || "—"}</div>}
                      />
                      <FieldRow
                        label="Fax"
                        value={<div className={fieldBoxClass}>{contact.fax || "—"}</div>}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className={fieldLabelClass}>Description</div>
                    <div className="mt-1 rounded-lg border-2 border-gray-400 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm">
                      {contact.description || "No description provided."}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className={fieldLabelClass}>Notes</div>
                    <div className="mt-1 rounded-lg border-2 border-gray-400 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm">
                      {contact.notes || "No notes provided."}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2.5">
                      <FieldRow
                        label="Assistant Name"
                        value={<div className={fieldBoxClass}>{contact.assistantName || "—"}</div>}
                      />
                      <FieldRow
                        label="Assistant Phone"
                        value={<div className={fieldBoxClass}>{contact.assistantPhone || "—"}</div>}
                      />
                      <FieldRow
                        label="LinkedIn URL"
                        value={<div className={fieldBoxClass}>{contact.linkedinUrl || "—"}</div>}
                      />
                    </div>
                    <div className="space-y-2.5">
                      <FieldRow
                        label="Website URL"
                        value={<div className={fieldBoxClass}>{contact.websiteUrl || "—"}</div>}
                      />
                      <FieldRow
                        label="Birthdate"
                        value={<div className={fieldBoxClass}>{contact.birthdate ? formatDate(contact.birthdate) : "—"}</div>}
                      />
                      <FieldRow
                        label="Anniversary"
                        value={<div className={fieldBoxClass}>{contact.anniversary ? formatDate(contact.anniversary) : "—"}</div>}
                      />
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

                  {activeTab === "activities" && (
                    <div className="flex flex-col gap-2">
                      <TabToolbar />
                      <DynamicTable
                        columns={[
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
                            accessor: "activityDate",
                            render: (value) => formatDate(value)
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
                        ]}
                        data={contact.activities}
                        emptyMessage="No activities found for this contact"
                      />
                    </div>
                  )}

                  {activeTab === "opportunities" && (
                    <div className="flex flex-col gap-2">
                      <TabToolbar />
                      <DynamicTable
                        columns={[
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
                            accessor: "estimatedCloseDate",
                            render: (value) => formatDate(value)
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
                        ]}
                        data={contact.opportunities}
                        emptyMessage="No opportunities found for this contact"
                      />
                    </div>
                  )}

                  {activeTab === "groups" && (
                    <div className="flex flex-col gap-2">
                      <TabToolbar />
                      <DynamicTable
                        columns={[
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
                            width: 200,
                            minWidth: 150,
                            maxWidth: 300,
                            sortable: true,
                            accessor: "groupName"
                          },
                          {
                            id: "visibility",
                            label: "Public/Private",
                            width: 150,
                            minWidth: 120,
                            maxWidth: 200,
                            sortable: true,
                            accessor: "visibility"
                          },
                          {
                            id: "description",
                            label: "Group Description",
                            width: 250,
                            minWidth: 200,
                            maxWidth: 400,
                            sortable: true,
                            accessor: "description"
                          },
                          {
                            id: "owner",
                            label: "Group Owner",
                            width: 180,
                            minWidth: 150,
                            maxWidth: 250,
                            sortable: true,
                            accessor: "owner"
                          }
                        ]}
                        data={contact.groups}
                        emptyMessage="No groups found for this contact"
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
    </div>
  )
}
