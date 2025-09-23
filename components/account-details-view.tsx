"use client"

import { ReactNode, useEffect, useMemo, useState } from "react"
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

interface AccountDetailsViewProps {
  account: AccountDetail | null
  loading?: boolean
  error?: string | null
  onBack: () => void
  onEdit?: (account: AccountDetail) => void
}

const TABS: { id: TabKey; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "opportunities", label: "Opportunities" },
  { id: "groups", label: "Groups" },
  { id: "activities", label: "Activities & Notes" }
]

const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-gray-500"
const fieldBoxClass = "flex min-h-[32px] items-center justify-between rounded-lg border-2 border-gray-400 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm"

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
    <div className="grid items-start gap-2 sm:grid-cols-[150px,1fr]">
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
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button className="flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700">
          <Plus className="h-4 w-4" />
          Create New
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2 h-4 w-4 text-gray-400" />
          <input
            readOnly
            className="w-36 rounded-full border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm text-gray-700 focus:outline-none"
            placeholder="Search Here"
          />
        </div>
        <button className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800">
          <span>Filter By Column</span>
          <Settings className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600">
          <Filter className="h-4 w-4" />
          Apply Filter
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">
          Active
        </button>
        <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600">
          Show All
        </button>
        {suffix}
      </div>
    </div>
  )
}


export function AccountDetailsView({ account, loading = false, error, onBack, onEdit }: AccountDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("contacts")
  const [activityFilter, setActivityFilter] = useState<string>("All")

  useEffect(() => {
    setActiveTab("contacts")
    setActivityFilter("All")
  }, [account?.id])

  const shippingSummary = useMemo(() => {
    if (!account?.shippingAddress) return ""
    const parts = [account.shippingAddress.city, account.shippingAddress.state, account.shippingAddress.postalCode]
      .filter(Boolean)
      .join(", ")
    return parts
  }, [account])

  const filteredActivities = useMemo(() => {
    if (!account) return []
    if (activityFilter === "All") return account.activities
    return account.activities.filter(activity => activity.activityStatus === activityFilter)
  }, [account, activityFilter])

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
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-6 mb-6">
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
                  <div className="flex flex-wrap gap-2 border-b-2 border-gray-400">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "rounded-t-lg px-3 py-1.5 text-sm font-semibold transition",
                          activeTab === tab.id
                            ? "border-2 border-b-white border-gray-400 bg-white text-primary-700 shadow-sm"
                            : "text-gray-500 hover:text-primary-600"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === "contacts" && (
                    <div className="flex flex-col gap-3">
                      <TabToolbar />
                      <DynamicTable
                        columns={[
                          {
                            id: "actions",
                            label: "Actions",
                            width: 80,
                            minWidth: 80,
                            maxWidth: 100,
                            sortable: false,
                            resizable: false,
                            type: "action",
                            render: () => (
                              <button className="rounded-full border border-red-200 p-2 text-red-500 transition hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )
                          },
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
                            id: "suffix",
                            label: "Suffix",
                            width: 100,
                            minWidth: 80,
                            maxWidth: 120,
                            sortable: true,
                            accessor: "suffix"
                          },
                          {
                            id: "fullName",
                            label: "Full Name",
                            width: 200,
                            minWidth: 150,
                            maxWidth: 300,
                            sortable: true,
                            accessor: "fullName"
                          },
                          {
                            id: "jobTitle",
                            label: "Job Title",
                            width: 180,
                            minWidth: 120,
                            maxWidth: 250,
                            sortable: true,
                            accessor: "jobTitle"
                          },
                          {
                            id: "contactType",
                            label: "Contact Type",
                            width: 150,
                            minWidth: 120,
                            maxWidth: 200,
                            sortable: true,
                            accessor: "contactType"
                          },
                          {
                            id: "emailAddress",
                            label: "Email Address",
                            width: 220,
                            minWidth: 180,
                            maxWidth: 300,
                            sortable: true,
                            type: "email",
                            accessor: "emailAddress"
                          },
                          {
                            id: "workPhone",
                            label: "Work Phone",
                            width: 150,
                            minWidth: 120,
                            maxWidth: 200,
                            sortable: true,
                            type: "phone",
                            accessor: "workPhone"
                          },
                          {
                            id: "extension",
                            label: "Extension",
                            width: 120,
                            minWidth: 80,
                            maxWidth: 150,
                            sortable: true,
                            accessor: "extension"
                          }
                        ]}
                        data={account.contacts}
                        emptyMessage="No contacts found for this account"
                      />
                    </div>
                  )}

                  {activeTab === "opportunities" && (
                    <div className="flex flex-col gap-3">
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
                        data={account.opportunities}
                        emptyMessage="No opportunities found for this account"
                      />
                    </div>
                  )}

                  {activeTab === "groups" && (
                    <div className="flex flex-col gap-3">
                      <TabToolbar
                        suffix={
                          <button className="text-sm font-semibold text-primary-600 transition hover:text-primary-700">
                            Join an Existing Group
                          </button>
                        }
                      />
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
                        data={account.groups}
                        emptyMessage="No groups found for this account"
                      />
                    </div>
                  )}

                  {activeTab === "activities" && (
                    <div className="flex flex-col gap-3">
                      <TabToolbar
                        suffix={
                          <div className="flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600">
                            {["All", "Call", "Notes", "Meeting", "To Do", "Other"].map(label => (
                              <button
                                key={label}
                                onClick={() => setActivityFilter(label)}
                                className={cn(
                                  "rounded-full px-3 py-1 transition",
                                  activityFilter === label
                                    ? "bg-primary-600 text-white"
                                    : "text-gray-600 hover:bg-gray-100"
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        }
                      />
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
                        ]}
                        data={filteredActivities}
                        emptyMessage="No activities found for this account"
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
        </div>
      </div>
    </div>
  )
}
