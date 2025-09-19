"use client"

import { ReactNode, useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  Filter,
  Loader2,
  Plus,
  Search,
  Settings,
  Trash2,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"

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

interface AccountDetailsModalProps {
  isOpen: boolean
  account: AccountDetail | null
  loading?: boolean
  error?: string | null
  onClose: () => void
  onEdit?: (account: AccountDetail) => void
}

interface DetailsTableColumn<RowType> {
  key: string
  label: string
  align?: "left" | "center" | "right"
  widthClass?: string
  render?: (row: RowType) => ReactNode
}

const TABS: { id: TabKey; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "opportunities", label: "Opportunities" },
  { id: "groups", label: "Groups" },
  { id: "activities", label: "Activities & Notes" }
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
    <div className="grid items-start gap-3 sm:grid-cols-[160px,1fr]">
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
        {suffix}
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
                    column.align === "right" && "text-right",
                    column.widthClass
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

export function AccountDetailsModal({ isOpen, account, loading = false, error, onClose, onEdit }: AccountDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("contacts")
  const [activityFilter, setActivityFilter] = useState<string>("All")

  useEffect(() => {
    if (isOpen) {
      setActiveTab("contacts")
      setActivityFilter("All")
    }
  }, [isOpen, account?.id])

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

  if (!isOpen) {
    return null
  }

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
    <div className="fixed inset-0 z-50 flex items-center justify.center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl">
        <div className="flex h-[85vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
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
                Loading account details...
              </div>
            ) : !hasAccount ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
                {error ?? "Account details are not available."}
              </div>
            ) : account ? (
              <div className="space-y-8">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                  <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
                    <div className="space-y-4">
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
                          <div className="flex flex-wrap items-center gap-3">
                            <div className={cn(fieldBoxClass, "justify-between")}>
                              <span>{account.accountType || "—"}</span>
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            </div>
                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-sm">
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
                      <FieldRow
                        label="Industry"
                        value={
                          <div className={cn(fieldBoxClass, "justify-between")}>
                            <span>{account.industry || "—"}</span>
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          </div>
                        }
                      />
                      <FieldRow
                        label="Order ID - House"
                        value={<div className={fieldBoxClass}>{account.orderIdHouse || "—"}</div>}
                      />
                      <FieldRow
                        label="Website URL"
                        value={<div className={fieldBoxClass}>{account.websiteUrl || "—"}</div>}
                      />
                      <FieldRow
                        label="Description"
                        value={
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 shadow-sm">
                            {account.description || "No description provided."}
                          </div>
                        }
                      />
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-800">Ship To Address</h3>
                          <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">Default</span>
                        </div>
                        {account.shippingAddress ? (
                          <div className="space-y-3 text-sm text-gray-700">
                            <div>
                              <div className={fieldLabelClass}>Street</div>
                              <div className={fieldBoxClass}>{account.shippingAddress.line1}</div>
                            </div>
                            {account.shippingAddress.line2 && (
                              <div>
                                <div className={fieldLabelClass}>Street 2</div>
                                <div className={fieldBoxClass}>{account.shippingAddress.line2}</div>
                              </div>
                            )}
                            <div className="grid gap-3 md:grid-cols-[1.2fr,0.6fr]">
                              <div>
                                <div className={fieldLabelClass}>City</div>
                                <div className={fieldBoxClass}>{account.shippingAddress.city}</div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className={fieldLabelClass}>State</div>
                                  <div className={cn(fieldBoxClass, "justify-between")}>
                                    <span>{account.shippingAddress.state || "—"}</span>
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                  </div>
                                </div>
                                <div>
                                  <div className={fieldLabelClass}>Zip</div>
                                  <div className={fieldBoxClass}>{account.shippingAddress.postalCode || "—"}</div>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>Country</div>
                              <div className={cn(fieldBoxClass, "justify-between")}>
                                <span>{account.shippingAddress.country || "—"}</span>
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No shipping address on file.</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-800">Bill To Address</h3>
                          <label className="flex items-center gap-2 text-xs text-gray-600">
                            <ReadOnlyCheckbox checked={Boolean(account.billingSameAsShipping)} />
                            <span>Same as Ship</span>
                          </label>
                        </div>
                        {account.billingAddress ? (
                          <div className="space-y-3 text-sm text-gray-700">
                            <div>
                              <div className={fieldLabelClass}>Street</div>
                              <div className={fieldBoxClass}>{account.billingAddress.line1}</div>
                            </div>
                            {account.billingAddress.line2 && (
                              <div>
                                <div className={fieldLabelClass}>Street 2</div>
                                <div className={fieldBoxClass}>{account.billingAddress.line2}</div>
                              </div>
                            )}
                            <div className="grid gap-3 md:grid-cols-[1.2fr,0.6fr]">
                              <div>
                                <div className={fieldLabelClass}>City</div>
                                <div className={fieldBoxClass}>{account.billingAddress.city}</div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className={fieldLabelClass}>State</div>
                                  <div className={cn(fieldBoxClass, "justify-between")}>
                                    <span>{account.billingAddress.state || "—"}</span>
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                  </div>
                                </div>
                                <div>
                                  <div className={fieldLabelClass}>Zip</div>
                                  <div className={fieldBoxClass}>{account.billingAddress.postalCode || "—"}</div>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className={fieldLabelClass}>Country</div>
                              <div className={cn(fieldBoxClass, "justify-between")}>
                                <span>{account.billingAddress.country || "—"}</span>
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

                  {activeTab === "contacts" && (
                    <div className="flex flex-col gap-4">
                      <TabToolbar />
                      <DetailsTable<AccountContactRow>
                        columns={[
                          {
                            key: "actions",
                            label: "Actions",
                            render: () => (
                              <button className="rounded-full border border-red-200 p-2 text-red-500 transition hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )
                          },
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
                          { key: "suffix", label: "Suffix" },
                          { key: "fullName", label: "Full Name" },
                          { key: "jobTitle", label: "Job Title" },
                          { key: "contactType", label: "Contact Type" },
                          {
                            key: "emailAddress",
                            label: "Email Address",
                            render: row => <span className="text-primary-600">{row.emailAddress || "—"}</span>
                          },
                          { key: "workPhone", label: "Work Phone" },
                          { key: "extension", label: "Extension" }
                        ]}
                        rows={account.contacts}
                      />
                    </div>
                  )}

                  {activeTab === "opportunities" && (
                    <div className="flex flex-col gap-4">
                      <TabToolbar />
                      <DetailsTable<AccountOpportunityRow>
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
                        rows={account.opportunities}
                      />
                    </div>
                  )}

                  {activeTab === "groups" && (
                    <div className="flex flex-col gap-4">
                      <TabToolbar
                        suffix={
                          <button className="text-sm font-semibold text-primary-600 transition hover:text-primary-700">
                            Join an Existing Group
                          </button>
                        }
                      />
                      <DetailsTable<AccountGroupRow>
                        columns={[
                          {
                            key: "active",
                            label: "Active",
                            render: row => (
                              <div className="flex items.center gap-2">
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
                        rows={account.groups}
                      />
                    </div>
                  )}

                  {activeTab === "activities" && (
                    <div className="flex flex-col gap-4">
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
                      <DetailsTable<AccountActivityRow>
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
                          {
                            key: "activityDate",
                            label: "Activity Date",
                            render: row => formatDate(row.activityDate)
                          },
                          { key: "activityType", label: "Activity Type" },
                          { key: "description", label: "Activity Description" },
                          { key: "accountName", label: "Account Name" },
                          { key: "attachment", label: "Attachment" },
                          { key: "fileName", label: "File Name" },
                          { key: "createdBy", label: "Created By" }
                        ]}
                        rows={filteredActivities}
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
    </div>
  )
}
