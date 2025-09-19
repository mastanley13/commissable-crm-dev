"use client"

import { ReactNode, useEffect, useState } from "react"
import { Loader2, Filter, Plus, Search, Settings, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"

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
  contactType?: string
  active: boolean
  emailAddress?: string
  description?: string
  workPhone?: string
  workPhoneExt?: string
  mobilePhone?: string
  activities: ContactActivityRow[]
  opportunities: ContactOpportunityRow[]
  groups: ContactGroupRow[]
}

interface ContactDetailsModalProps {
  isOpen: boolean
  contact: ContactDetail | null
  loading?: boolean
  error?: string | null
  onClose: () => void
  onEdit?: (contact: ContactDetail) => void
}

interface DetailsTableColumn<RowType> {
  key: string
  label: string
  align?: "left" | "center" | "right"
  render?: (row: RowType) => ReactNode
}

const TABS: { id: "activities" | "opportunities" | "groups"; label: string }[] = [
  { id: "activities", label: "Activities & Notes" },
  { id: "opportunities", label: "Opportunities" },
  { id: "groups", label: "Groups" }
]

const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-gray-500"
const fieldBoxClass = "flex min-h-[44px] items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm"

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
    <div className="grid items-start gap-3 sm:grid-cols-[140px,1fr]">
      <span className={fieldLabelClass}>{label}</span>
      <div>{value}</div>
    </div>
  )
}

function TabToolbar() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <button className="flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
          <Plus className="h-4 w-4" />
          Create New
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            readOnly
            className="w-40 rounded-full border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 focus:outline-none"
            placeholder="Search Here"
          />
        </div>
        <button className="flex items-center gap-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
          <span>Filter By Column</span>
          <Settings className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600">
          <Filter className="h-4 w-4" />
          Apply Filter
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          Active
        </button>
        <button className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-primary-400 hover:text-primary-600">
          Show All
        </button>
      </div>
    </div>
  )
}

function DetailsTable<RowType>({
  columns,
  rows,
  emptyMessage = "No data available in table"
}: {
  columns: DetailsTableColumn<RowType>[]
  rows: RowType[]
  emptyMessage?: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600",
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right"
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={(row as unknown as { id?: string }).id ?? index} className="hover:bg-gray-50">
                  {columns.map(column => {
                    const defaultValue = (row as Record<string, unknown>)[column.key]
                    const cellContent = column.render
                      ? column.render(row)
                      : defaultValue !== undefined && defaultValue !== null && defaultValue !== ""
                        ? (defaultValue as ReactNode)
                        : "—"

                    return (
                      <td
                        key={column.key}
                        className={cn(
                          "whitespace-nowrap px-4 py-3 text-sm text-gray-700",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right"
                        )}
                      >
                        {cellContent}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
        <span>Showing {rows.length === 0 ? 0 : 1} to {rows.length} of {rows.length} entries</span>
        <div className="flex items-center gap-2">
          <span>Show</span>
          <select className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700">
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
          <span>entries</span>
        </div>
      </div>
    </div>
  )
}

export function ContactDetailsModal({ isOpen, contact, loading = false, error, onClose, onEdit }: ContactDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"activities" | "opportunities" | "groups">("activities")

  useEffect(() => {
    if (isOpen) {
      setActiveTab("activities")
    }
  }, [isOpen, contact?.id])

  const hasContact = Boolean(contact)

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "—"
    const dateValue = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(dateValue.getTime())) {
      return "—"
    }
    return dateValue.toLocaleDateString()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl">
        <div className="flex h-[80vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Contact Detail</p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                {contact ? `${contact.firstName} ${contact.lastName}` : "Contact information"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{contact?.accountName ?? ""}</p>
              <p className="mt-1 text-sm text-gray-500">{contact?.jobTitle || (!loading && hasContact ? "No job title" : "")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {onEdit && contact && (
                <button
                  onClick={() => onEdit(contact)}
                  className="rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                >
                  Update
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-600 hover:border-primary-400 hover:text-primary-600"
              >
                Back
              </button>
              <button
                onClick={onClose}
                className="rounded-full border border-gray-200 p-2 text-gray-400 transition hover:border-gray-300 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                Loading contact details...
              </div>
            ) : !hasContact ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
                {error ?? "Contact details are not available."}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                  <div className="grid gap-8 lg:grid-cols-2">
                    <div className="space-y-4">
                      <FieldRow
                        label="Name"
                        value={
                          <div className="grid gap-3 md:grid-cols-3">
                            <div>
                              <div className={fieldLabelClass}>Suffix</div>
                              <div className={fieldBoxClass}>{contact.suffix || "—"}</div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>First</div>
                              <div className={fieldBoxClass}>{contact.firstName}</div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>Last</div>
                              <div className={fieldBoxClass}>{contact.lastName}</div>
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
                        label="Active (Y/N)"
                        value={
                          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-sm">
                            <ReadOnlySwitch value={contact.active} />
                            <span>{contact.active ? "Active" : "Inactive"}</span>
                          </div>
                        }
                      />
                    </div>
                    <div className="space-y-4">
                      <FieldRow
                        label="Contact Type"
                        value={<div className={fieldBoxClass}>{contact.contactType || "—"}</div>}
                      />
                      <FieldRow
                        label="Email Address"
                        value={<div className={fieldBoxClass}>{contact.emailAddress || "—"}</div>}
                      />
                      <FieldRow
                        label="Work Phone"
                        value={
                          <div className="grid gap-3 md:grid-cols-[1fr,120px]">
                            <div className={fieldBoxClass}>{contact.workPhone || "—"}</div>
                            <div className={fieldBoxClass}>Ext {contact.workPhoneExt || "—"}</div>
                          </div>
                        }
                      />
                      <FieldRow
                        label="Mobile"
                        value={<div className={fieldBoxClass}>{contact.mobilePhone || "—"}</div>}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className={fieldLabelClass}>Description</div>
                    <div className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 shadow-sm">
                      {contact.description || "No description provided."}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap gap-2 border-b border-gray-200">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "rounded-t-lg px-4 py-2 text-sm font-semibold transition",
                          activeTab === tab.id
                            ? "border border-b-white border-gray-200 bg-white text-primary-700 shadow-sm"
                            : "text-gray-500 hover:text-primary-600"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === "activities" && (
                    <div className="flex flex-col gap-4">
                      <TabToolbar />
                      <DetailsTable<ContactActivityRow>
                        columns={[
                          {
                            key: "active",
                            label: "Active",
                            render: row => (
                              <div className="flex items center gap-2">
                                <ReadOnlySwitch value={row.active} />
                                <span className="text-xs text-gray-500">{row.active ? "Active" : "Inactive"}</span>
                              </div>
                            )
                          },
                          {
                            key: "activityDate",
                            label: "Activity Date",
                            render: row => formatDate(row.activityDate)
                          },
                          { key: "activityStatus", label: "Activity Status" },
                          { key: "description", label: "Description" },
                          { key: "accountName", label: "Account Name" },
                          { key: "attachment", label: "Attachment" },
                          { key: "fileName", label: "File Name" },
                          { key: "createdBy", label: "Created By" }
                        ]}
                        rows={contact.activities}
                      />
                    </div>
                  )}

                  {activeTab === "opportunities" && (
                    <div className="flex flex-col gap-4">
                      <TabToolbar />
                      <DetailsTable<ContactOpportunityRow>
                        columns={[
                          {
                            key: "active",
                            label: "Active",
                            render: row => (
                              <div className="flex items-center gap-2">
                                <ReadOnlySwitch value={row.active} />
                                <span className="text-xs text-gray-500">{row.active ? "Active" : "Inactive"}</span>
                              </div>
                            )
                          },
                          { key: "orderIdHouse", label: "Order ID - House" },
                          { key: "opportunityName", label: "Opportunity Name" },
                          { key: "stage", label: "Opportunity Stage" },
                          { key: "owner", label: "Owner" },
                          {
                            key: "estimatedCloseDate",
                            label: "Estimated Close Date",
                            render: row => formatDate(row.estimatedCloseDate)
                          },
                          { key: "referredBy", label: "Referred By" }
                        ]}
                        rows={contact.opportunities}
                      />
                    </div>
                  )}

                  {activeTab === "groups" && (
                    <div className="flex flex-col gap-4">
                      <TabToolbar />
                      <DetailsTable<ContactGroupRow>
                        columns={[
                          {
                            key: "active",
                            label: "Active",
                            render: row => (
                              <div className="flex items-center gap-2">
                                <ReadOnlySwitch value={row.active} />
                                <span className="text-xs text-gray-500">{row.active ? "Active" : "Inactive"}</span>
                              </div>
                            )
                          },
                          { key: "groupName", label: "Group Name" },
                          { key: "visibility", label: "Public/Private" },
                          { key: "description", label: "Group Description" },
                          { key: "owner", label: "Group Owner" }
                        ]}
                        rows={contact.groups}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
