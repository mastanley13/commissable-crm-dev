"use client"

import Link from "next/link"
import { ChangeEvent, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown,
  Edit,
  Filter,
  Loader2,
  Plus,
  Search,
  Settings,
  Trash2,
  Check
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DynamicTable, Column } from "./dynamic-table"
import { useToasts } from "./toast"
import { ContactCreateModal } from "./contact-create-modal"
import { ListHeader, type ColumnFilter } from "./list-header"
import { applySimpleFilters } from "@/lib/filter-utils"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import type { DeletionConstraint } from "@/lib/deletion"
import { OpportunityCreateModal } from "./account-opportunity-create-modal"
import { OpportunityStatus } from "@prisma/client"
import { GroupCreateModal } from "./account-group-create-modal"
import { GroupEditModal } from "./group-edit-modal"
import { ActivityNoteCreateModal } from "./activity-note-create-modal"
import { ColumnChooserModal } from "./column-chooser-modal"
import { calculateMinWidth } from "@/lib/column-width-utils"
import { OpportunityBulkActionBar } from "./opportunity-bulk-action-bar"
import { GroupBulkActionBar } from "./group-bulk-action-bar"
import { OpportunityBulkOwnerModal } from "./opportunity-bulk-owner-modal"
import { OpportunityBulkStatusModal } from "./opportunity-bulk-status-modal"
import { OpportunityEditModal } from "./opportunity-edit-modal"
import { TwoStageDeleteDialog } from "./two-stage-delete-dialog"
import { GroupBulkOwnerModal } from "./group-bulk-owner-modal"
import { GroupBulkStatusModal } from "./group-bulk-status-modal"
import { ContactBulkActionBar } from "./contact-bulk-action-bar"
import { ContactBulkOwnerModal } from "./contact-bulk-owner-modal"
import { ContactBulkStatusModal } from "./contact-bulk-status-modal"
import { ActivityBulkActionBar } from "./activity-bulk-action-bar"
import { ActivityBulkOwnerModal } from "./activity-bulk-owner-modal"
import { ActivityBulkStatusModal } from "./activity-bulk-status-modal"
import { ContactEditModal } from "./contact-edit-modal"
import { ActivityNoteEditModal } from "./activity-note-edit-modal"
import { EditableField } from "./editable-field"
import { useEntityEditor, type EntityEditor } from "@/hooks/useEntityEditor"
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt"
import { useAuth } from "@/lib/auth-context"
import { VALIDATION_PATTERNS } from "@/lib/validation-shared"

export interface AccountAddress {
  line1: string
  line2?: string
  shippingStreet2?: string
  billingStreet2?: string
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
  mobile?: string
  extension?: string
  owner?: string
  isPrimary?: boolean
  isDeleted?: boolean
  deletedAt?: string | null
}

export interface AccountOpportunityRow {
  id: string
  select: boolean
  active: boolean
  status?: string
  orderIdHouse?: string
  opportunityName: string
  stage?: string
  owner?: string
  ownerId?: string | null
  distributorName?: string
  vendorName?: string
  estimatedCloseDate?: string | Date | null
  closeDate?: string | Date | null
  referredBy?: string
  isDeleted?: boolean
  subAgent?: string
  subagentPercent?: number | null
  houseRepPercent?: number | null
  houseSplitPercent?: number | null
  accountIdHouse?: string
  accountIdVendor?: string
  accountLegalName?: string
  accountName?: string
  customerIdVendor?: string
  locationId?: string
  description?: string
  opportunityId?: string
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
  parentAccountId?: string | null
  accountType: string
  accountTypeId?: string | null
  active: boolean
  accountOwner?: string
  ownerId?: string | null
  industry?: string
  industryId?: string | null
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
  onEdit?: (account: AccountDetail) => void
  onRefresh?: () => void
}

type AccountOption = { value: string; label: string }

interface AccountAddressForm {
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
}

interface AccountInlineForm {
  accountName: string
  accountLegalName: string
  parentAccountId: string
  accountTypeId: string
  ownerId: string
  industryId: string
  websiteUrl: string
  description: string
  active: boolean
  billingSameAsShipping: boolean
  shippingAddress: AccountAddressForm
  billingAddress: AccountAddressForm
}

const DEFAULT_COUNTRY = "United States"

const US_STATES: Array<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" }
]

function createEmptyAddress(): AccountAddressForm {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: DEFAULT_COUNTRY
  }
}

function mapShippingAddress(address: AccountAddress | null | undefined): AccountAddressForm {
  if (!address) return createEmptyAddress()
  return {
    line1: address.line1 ?? "",
    line2: address.shippingStreet2 ?? address.line2 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postalCode: address.postalCode ?? "",
    country: address.country ?? DEFAULT_COUNTRY
  }
}

function mapBillingAddress(address: AccountAddress | null | undefined): AccountAddressForm {
  if (!address) return createEmptyAddress()
  return {
    line1: address.line1 ?? "",
    line2: address.billingStreet2 ?? address.line2 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postalCode: address.postalCode ?? "",
    country: address.country ?? DEFAULT_COUNTRY
  }
}

function normaliseAddressForPayload(address: AccountAddressForm): AccountAddressForm {
  return {
    line1: address.line1.trim(),
    line2: address.line2.trim(),
    city: address.city.trim(),
    state: address.state.trim(),
    postalCode: address.postalCode.trim(),
    country: address.country.trim() || DEFAULT_COUNTRY
  }
}

function createAccountInlineForm(detail: AccountDetail | null | undefined): AccountInlineForm | null {
  if (!detail) return null
  return {
    accountName: detail.accountName ?? "",
    accountLegalName: detail.accountLegalName ?? "",
    parentAccountId: detail.parentAccountId ?? "",
    accountTypeId: detail.accountTypeId ?? "",
    ownerId: detail.ownerId ?? "",
    industryId: detail.industryId ?? "",
    websiteUrl: detail.websiteUrl ?? "",
    description: detail.description ?? "",
    active: Boolean(detail.active),
    billingSameAsShipping: Boolean(detail.billingSameAsShipping),
    shippingAddress: mapShippingAddress(detail.shippingAddress),
    billingAddress: mapBillingAddress(
      detail.billingSameAsShipping ? detail.shippingAddress : detail.billingAddress
    )
  }
}

function buildAccountPayload(patch: Partial<AccountInlineForm>, draft: AccountInlineForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if ("accountName" in patch) {
    payload.accountName = draft.accountName.trim()
  }

  if ("accountLegalName" in patch) {
    const value = draft.accountLegalName.trim()
    payload.accountLegalName = value.length > 0 ? value : null
  }

  if ("parentAccountId" in patch) {
    payload.parentAccountId = draft.parentAccountId ? draft.parentAccountId : null
  }

  if ("accountTypeId" in patch) {
    payload.accountTypeId = draft.accountTypeId ? draft.accountTypeId : null
  }

  if ("ownerId" in patch) {
    payload.ownerId = draft.ownerId ? draft.ownerId : null
  }

  if ("industryId" in patch) {
    payload.industryId = draft.industryId ? draft.industryId : null
  }

  if ("websiteUrl" in patch) {
    const value = draft.websiteUrl.trim()
    payload.websiteUrl = value.length > 0 ? value : null
  }

  if ("description" in patch) {
    const value = draft.description.trim()
    payload.description = value.length > 0 ? value : null
  }

  if ("active" in patch) {
    payload.active = draft.active
  }

  if ("billingSameAsShipping" in patch) {
    payload.billingSameAsShipping = draft.billingSameAsShipping
  }

  if ("shippingAddress" in patch) {
    payload.shippingAddress = normaliseAddressForPayload(draft.shippingAddress)
  }

  if ("billingAddress" in patch || (draft.billingSameAsShipping && "shippingAddress" in patch)) {
    const baseAddress = draft.billingSameAsShipping ? draft.shippingAddress : draft.billingAddress
    payload.billingAddress = normaliseAddressForPayload(baseAddress)
  }

  return payload
}

function validateAccountForm(form: AccountInlineForm, currentAccountId?: string): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!form.accountName.trim()) {
    errors.accountName = "Account name is required."
  }

  if (!form.accountTypeId.trim()) {
    errors.accountTypeId = "Account type is required."
  }

  if (currentAccountId && form.parentAccountId && form.parentAccountId === currentAccountId) {
    errors.parentAccountId = "Account cannot be its own parent."
  }

  const website = form.websiteUrl.trim()
  if (website && !VALIDATION_PATTERNS.url.test(website)) {
    errors.websiteUrl = "Enter a valid URL (https://example.com)."
  }

  const shipping = form.shippingAddress
  if (!shipping.line1.trim()) {
    errors["shippingAddress.line1"] = "Shipping street is required."
  }

  if (!shipping.city.trim()) {
    errors["shippingAddress.city"] = "Shipping city is required."
  }

  if (!form.billingSameAsShipping) {
    const billing = form.billingAddress
    if (!billing.line1.trim()) {
      errors["billingAddress.line1"] = "Billing street is required."
    }
    if (!billing.city.trim()) {
      errors["billingAddress.city"] = "Billing city is required."
    }
  }

  return errors
}


const TABS: { id: TabKey; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "opportunities", label: "Opportunities" },
  { id: "groups", label: "Groups" },
  { id: "activities", label: "Activities & Notes" }
]

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap flex items-center"
const fieldBoxClass = "flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis"
export const CONTACT_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 180,
    minWidth: calculateMinWidth({ label: "Select All", type: "multi-action", sortable: false }),
    maxWidth: 220,
    type: "multi-action",
  },
  {
    id: "suffix",
    label: "Suffix",
    width: 100,
    minWidth: calculateMinWidth({ label: "Suffix", type: "text", sortable: true }),
    maxWidth: 140,
    sortable: true,
    accessor: "suffix",
  },
  {
    id: "fullName",
    label: "Full Name",
    width: 220,
    minWidth: calculateMinWidth({ label: "Full Name", type: "text", sortable: true }),
    maxWidth: 320,
    sortable: true,
    accessor: "fullName",
  },
  {
    id: "firstName",
    label: "First Name",
    width: 180,
    minWidth: calculateMinWidth({ label: "First Name", type: "text", sortable: true }),
    maxWidth: 250,
    sortable: true,
    accessor: "firstName",
    hidden: true,
  },
  {
    id: "lastName",
    label: "Last Name",
    width: 180,
    minWidth: calculateMinWidth({ label: "Last Name", type: "text", sortable: true }),
    maxWidth: 250,
    sortable: true,
    accessor: "lastName",
    hidden: true,
  },
  {
    id: "jobTitle",
    label: "Job Title",
    width: 200,
    minWidth: calculateMinWidth({ label: "Job Title", type: "text", sortable: true }),
    maxWidth: 280,
    sortable: true,
    accessor: "jobTitle",
  },
  {
    id: "contactType",
    label: "Contact Type",
    width: 180,
    minWidth: calculateMinWidth({ label: "Contact Type", type: "text", sortable: true }),
    maxWidth: 240,
    sortable: true,
    accessor: "contactType",
  },
  {
    id: "emailAddress",
    label: "Email",
    width: 240,
    minWidth: calculateMinWidth({ label: "Email", type: "email", sortable: true }),
    maxWidth: 320,
    sortable: true,
    accessor: "emailAddress",
  },
  {
    id: "workPhone",
    label: "Work Phone",
    width: 180,
    minWidth: calculateMinWidth({ label: "Work Phone", type: "phone", sortable: true }),
    maxWidth: 220,
    sortable: true,
    accessor: "workPhone",
  },
  {
    id: "mobile",
    label: "Mobile",
    width: 180,
    minWidth: calculateMinWidth({ label: "Mobile", type: "phone", sortable: true }),
    maxWidth: 220,
    sortable: true,
    accessor: "mobile",
  },
  {
    id: "extension",
    label: "Extension",
    width: 120,
    minWidth: calculateMinWidth({ label: "Extension", type: "text", sortable: true }),
    maxWidth: 150,
    sortable: true,
    accessor: "extension",
  },
]

export const OPPORTUNITY_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: calculateMinWidth({ label: "Select All", type: "multi-action", sortable: false }),
    maxWidth: 240,
    type: "multi-action",
  },
  {
    id: "orderIdHouse",
    label: "Order ID - House",
    width: 150,
    minWidth: calculateMinWidth({ label: "Order ID - House", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "orderIdHouse",
  },
  {
    id: "opportunityName",
    label: "Opportunity Name",
    width: 250,
    minWidth: calculateMinWidth({ label: "Opportunity Name", type: "text", sortable: true }),
    maxWidth: 350,
    sortable: true,
    accessor: "opportunityName",
  },
  {
    id: "stage",
    label: "Opportunity Stage",
    width: 180,
    minWidth: calculateMinWidth({ label: "Opportunity Stage", type: "text", sortable: true }),
    maxWidth: 220,
    sortable: true,
    accessor: "stage",
  },
  {
    id: "referredBy",
    label: "Referred By",
    width: 150,
    minWidth: calculateMinWidth({ label: "Referred By", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "referredBy",
  },
  {
    id: "owner",
    label: "Owner",
    width: 150,
    minWidth: calculateMinWidth({ label: "Owner", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "owner",
  },
  {
    id: "closeDate",
    label: "Close Date",
    width: 150,
    minWidth: calculateMinWidth({ label: "Close Date", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "closeDate",
  },
  {
    id: "subAgent",
    label: "Subagent",
    width: 150,
    minWidth: calculateMinWidth({ label: "Subagent", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "subAgent",
  },
  {
    id: "subagentPercent",
    label: "Subagent %",
    width: 120,
    minWidth: calculateMinWidth({ label: "Subagent %", type: "text", sortable: true }),
    maxWidth: 150,
    sortable: true,
    accessor: "subagentPercent",
  },
  {
    id: "accountIdHouse",
    label: "Account ID - House",
    width: 150,
    minWidth: calculateMinWidth({ label: "Account ID - House", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "accountIdHouse",
  },
  {
    id: "accountIdVendor",
    label: "Account ID - Vendor",
    width: 150,
    minWidth: calculateMinWidth({ label: "Account ID - Vendor", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "accountIdVendor",
  },
  {
    id: "accountLegalName",
    label: "Account Legal Name",
    width: 200,
    minWidth: calculateMinWidth({ label: "Account Legal Name", type: "text", sortable: true }),
    maxWidth: 300,
    sortable: true,
    accessor: "accountLegalName",
  },
  {
    id: "accountName",
    label: "Account Name",
    width: 200,
    minWidth: calculateMinWidth({ label: "Account Name", type: "text", sortable: true }),
    maxWidth: 300,
    sortable: true,
    accessor: "accountName",
  },
  {
    id: "customerIdVendor",
    label: "Customer ID - Vendor",
    width: 150,
    minWidth: calculateMinWidth({ label: "Customer ID - Vendor", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "customerIdVendor",
  },
  {
    id: "houseRepPercent",
    label: "House Rep %",
    width: 120,
    minWidth: calculateMinWidth({ label: "House Rep %", type: "text", sortable: true }),
    maxWidth: 150,
    sortable: true,
    accessor: "houseRepPercent",
  },
  {
    id: "houseSplitPercent",
    label: "House Split %",
    width: 120,
    minWidth: calculateMinWidth({ label: "House Split %", type: "text", sortable: true }),
    maxWidth: 150,
    sortable: true,
    accessor: "houseSplitPercent",
  },
  {
    id: "locationId",
    label: "Location ID",
    width: 150,
    minWidth: calculateMinWidth({ label: "Location ID", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "locationId",
  },
  {
    id: "description",
    label: "Opportunity Description",
    width: 250,
    minWidth: calculateMinWidth({ label: "Opportunity Description", type: "text", sortable: true }),
    maxWidth: 400,
    sortable: true,
    accessor: "description",
  },
  {
    id: "opportunityId",
    label: "Opportunity ID",
    width: 150,
    minWidth: calculateMinWidth({ label: "Opportunity ID", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "opportunityId",
  }
]

export const GROUP_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: calculateMinWidth({ label: "Select All", type: "multi-action", sortable: false }),
    maxWidth: 240,
    type: "multi-action",
  },

  {
    id: "groupName",
    label: "Group Name",
    width: 220,
    minWidth: calculateMinWidth({ label: "Group Name", type: "text", sortable: true }),
    maxWidth: 320,
    sortable: true,
    accessor: "groupName"
  },
  {
    id: "visibility",
    label: "Public/Private",
    width: 160,
    minWidth: calculateMinWidth({ label: "Public/Private", type: "text", sortable: true }),
    maxWidth: 220,
    sortable: true,
    accessor: "visibility"
  },
  {
    id: "description",
    label: "Group Description",
    width: 260,
    minWidth: calculateMinWidth({ label: "Group Description", type: "text", sortable: true }),
    maxWidth: 400,
    sortable: true,
    accessor: "description"
  },
  {
    id: "owner",
    label: "Group Owner",
    width: 200,
    minWidth: calculateMinWidth({ label: "Group Owner", type: "text", sortable: true }),
    maxWidth: 260,
    sortable: true,
    accessor: "owner"
  }
]

export const ACTIVITY_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: calculateMinWidth({ label: "Select All", type: "multi-action", sortable: false }),
    maxWidth: 240,
    type: "multi-action",
  },
  {
    id: "activityDate",
    label: "Activity Date",
    width: 150,
    minWidth: calculateMinWidth({ label: "Activity Date", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "activityDate"
  },
  {
    id: "activityType",
    label: "Activity Type",
    width: 150,
    minWidth: calculateMinWidth({ label: "Activity Type", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "activityType"
  },
  {
    id: "description",
    label: "Activity Description",
    width: 250,
    minWidth: calculateMinWidth({ label: "Activity Description", type: "text", sortable: true }),
    maxWidth: 400,
    sortable: true,
    accessor: "description"
  },
  {
    id: "accountName",
    label: "Account Name",
    width: 180,
    minWidth: calculateMinWidth({ label: "Account Name", type: "text", sortable: true }),
    maxWidth: 250,
    sortable: true,
    accessor: "accountName"
  },
  {
    id: "attachment",
    label: "Attachment",
    width: 120,
    minWidth: calculateMinWidth({ label: "Attachment", type: "text", sortable: true }),
    maxWidth: 150,
    sortable: true,
    accessor: "attachment"
  },
  {
    id: "fileName",
    label: "File Name",
    width: 150,
    minWidth: calculateMinWidth({ label: "File Name", type: "text", sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: "fileName"
  },
  {
    id: "createdBy",
    label: "Created By",
    width: 150,
    minWidth: calculateMinWidth({ label: "Created By", type: "text", sortable: true }),
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

function FieldRow({ label, value, labelExtra }: { label: string; value: ReactNode; labelExtra?: ReactNode }) {
  return (
    <div className="grid items-start gap-4 sm:grid-cols-[140px,1fr]">
      <div className="flex flex-col gap-1">
        <span className={fieldLabelClass}>{label}</span>
        {labelExtra}
      </div>
      <div>{value}</div>
    </div>
  )
}

function AccountHeader({
  account,
  onEdit
}: {
  account: AccountDetail
  onEdit?: (account: AccountDetail) => void
}) {
  const renderAddressValue = (
    value: string | null | undefined,
    placeholder: string,
    extraClassName?: string
  ) => {
    const trimmed = typeof value === "string" ? value.trim() : ""
    return (
      <div className={cn(fieldBoxClass, extraClassName)}>
        {trimmed.length > 0 ? trimmed : <span className="text-gray-400">{placeholder}</span>}
      </div>
    )
  }

  const renderAddressSelectValue = (
    value: string | null | undefined,
    placeholder: string
  ) => {
    const trimmed = typeof value === "string" ? value.trim() : ""
    return (
      <div className={cn(fieldBoxClass, "justify-between max-w-none")}>
        <span className={trimmed.length > 0 ? undefined : "text-gray-400"}>{trimmed || placeholder}</span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">Account Detail</p>
        <div className="flex items-center gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(account)}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Update
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-1.5">
          <FieldRow
            label="Account Name"
            value={
              <div className="flex items-end gap-2 max-w-md">
                <div className={cn(fieldBoxClass, "flex-1 max-w-none")}>{account.accountName}</div>
                <div className="flex items-center gap-2 shrink-0 bg-transparent px-0 py-1 text-[11px] font-medium text-gray-600">
                  <span>Active (Y/N)</span>
                  <ReadOnlySwitch value={account.active} />
                </div>
              </div>
            }
          />
          <FieldRow
            label="Account Legal Name"
            value={<div className={fieldBoxClass}>{account.accountLegalName || ""}</div>}
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
              <div className={cn(fieldBoxClass, "justify-between")}>
                <span>{account.accountType || "-"}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
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
            label="Website URL"
            value={<div className={fieldBoxClass}>{account.websiteUrl || ""}</div>}
          />
          <FieldRow
            label="Description"
            value={
              <div className={cn(fieldBoxClass, "whitespace-normal")}>
                {account.description || "No description provided."}
              </div>
            }
          />
        </div>

        <div className="space-y-1.5">
          <FieldRow
            label="Ship To Address"
            value={
              account.shippingAddress ? (
                renderAddressValue(account.shippingAddress.line1, "Shipping Street")
              ) : (
                <p className="text-[11px] text-gray-500">No shipping address on file.</p>
              )
            }
          />
          <FieldRow
            label=""
            value={
              account.shippingAddress ? (
                renderAddressValue(
                  account.shippingAddress.shippingStreet2 || account.shippingAddress.line2,
                  "Shipping Street 2"
                )
              ) : (
                <div className="min-h-[28px]"></div>
              )
            }
          />
          <FieldRow
            label=""
            value={
              account.shippingAddress ? (
                <div className="grid max-w-md grid-cols-[2fr,1fr,1fr] gap-1">
                  {renderAddressValue(account.shippingAddress.city, "City", "max-w-none")}
                  {renderAddressSelectValue(account.shippingAddress.state, "State")}
                  {renderAddressValue(account.shippingAddress.postalCode, "Zip", "max-w-none")}
                </div>
              ) : (
                <div className="min-h-[28px]"></div>
              )
            }
          />
          {/* Empty row to align with Account Type */}
          <FieldRow
            label=""
            value={<div className="min-h-[28px]"></div>}
          />
          <FieldRow
            label="Bill To Address"
            value={
              account.billingAddress ? (
                renderAddressValue(account.billingAddress.line1, "Billing Street")
              ) : (
                <p className="text-[11px] text-gray-500">No billing address on file.</p>
              )
            }
          />
          <FieldRow
            label=""
            labelExtra={
              <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <ReadOnlyCheckbox checked={Boolean(account.billingSameAsShipping)} />
                <span>Same as Ship To</span>
              </label>
            }
            value={
              account.billingAddress ? (
                renderAddressValue(
                  account.billingAddress.billingStreet2 || account.billingAddress.line2,
                  "Billing Street 2"
                )
              ) : (
                <div className="min-h-[28px]"></div>
              )
            }
          />
          <FieldRow
            label=""
            value={
              account.billingAddress ? (
                <div className="grid max-w-md grid-cols-[2fr,1fr,1fr] gap-1">
                  {renderAddressValue(account.billingAddress.city, "City", "max-w-none")}
                  {renderAddressSelectValue(account.billingAddress.state, "State")}
                  {renderAddressValue(account.billingAddress.postalCode, "Zip", "max-w-none")}
                </div>
              ) : (
                <div className="min-h-[28px]"></div>
              )
            }
          />
        </div>
      </div>
    </div>
  )
}

interface EditableAccountHeaderProps {
  account: AccountDetail
  editor: EntityEditor<AccountInlineForm>
  accountTypeOptions: AccountOption[]
  ownerOptions: AccountOption[]
  parentAccountOptions: AccountOption[]
  optionsLoading: boolean
  onSave: () => Promise<void>
}

function EditableAccountHeader({
  account,
  editor,
  accountTypeOptions,
  ownerOptions,
  parentAccountOptions,
  optionsLoading,
  onSave
}: EditableAccountHeaderProps) {
  if (!editor.draft) {
    return (
      <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
          Preparing inline editor...
        </div>
      </div>
    )
  }

  const accountNameField = editor.register("accountName")
  const accountLegalNameField = editor.register("accountLegalName")
  const parentAccountField = editor.register("parentAccountId")
  const accountTypeField = editor.register("accountTypeId")
  const ownerField = editor.register("ownerId")
  const websiteField = editor.register("websiteUrl")
  const descriptionField = editor.register("description")
  const activeField = editor.register("active")
  const billingSameField = editor.register("billingSameAsShipping")

  const shippingLine1Field = editor.register("shippingAddress.line1")
  const shippingLine2Field = editor.register("shippingAddress.line2")
  const shippingCityField = editor.register("shippingAddress.city")
  const shippingStateField = editor.register("shippingAddress.state")
  const shippingPostalField = editor.register("shippingAddress.postalCode")

  const billingLine1Field = editor.register("billingAddress.line1")
  const billingLine2Field = editor.register("billingAddress.line2")
  const billingCityField = editor.register("billingAddress.city")
  const billingStateField = editor.register("billingAddress.state")
  const billingPostalField = editor.register("billingAddress.postalCode")

  const disableSave = editor.saving || !editor.isDirty
  const billingLinked = Boolean(editor.draft?.billingSameAsShipping)

  const syncBillingIfNeeded = (field: keyof AccountAddressForm, value: string) => {
    if (billingLinked) {
      editor.setField(`billingAddress.${field}`, value)
    }
  }

  const handleShippingLine1Change = (event: ChangeEvent<HTMLInputElement>) => {
    shippingLine1Field.onChange(event)
    syncBillingIfNeeded("line1", event.target.value)
  }

  const handleShippingLine2Change = (event: ChangeEvent<HTMLInputElement>) => {
    shippingLine2Field.onChange(event)
    syncBillingIfNeeded("line2", event.target.value)
  }

  const handleShippingCityChange = (event: ChangeEvent<HTMLInputElement>) => {
    shippingCityField.onChange(event)
    syncBillingIfNeeded("city", event.target.value)
  }

  const handleShippingStateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    shippingStateField.onChange(event)
    syncBillingIfNeeded("state", event.target.value)
  }

  const handleShippingPostalChange = (event: ChangeEvent<HTMLInputElement>) => {
    shippingPostalField.onChange(event)
    syncBillingIfNeeded("postalCode", event.target.value)
  }

  const handleBillingSameChange = (event: ChangeEvent<HTMLInputElement>) => {
    billingSameField.onChange(event)
    if (event.target.checked) {
      const shipping = editor.draft?.shippingAddress ?? createEmptyAddress()
      editor.setField("billingAddress", { ...shipping })
    }
  }

  const renderStandardRow = (label: string, control: ReactNode, error?: string) => (
    <FieldRow
      label={label}
      value={
        <div className="flex flex-col gap-1">
          <div className="max-w-md">{control}</div>
          {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
        </div>
      }
    />
  )

  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">Account Detail</p>
          {editor.isDirty ? (
            <span className="text-[11px] font-semibold text-amber-600">Unsaved changes</span>
          ) : null}
          {optionsLoading ? (
            <span className="text-[11px] text-gray-500">Loading field options...</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={disableSave}
          className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {editor.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-1.5">
          <FieldRow
            label="Account Name"
            value={
              <div className="flex flex-col gap-1">
                <div className="flex items-end gap-2 max-w-md">
                  <EditableField.Input
                    value={(accountNameField.value as string) ?? ""}
                    onChange={accountNameField.onChange}
                    onBlur={accountNameField.onBlur}
                    placeholder="Enter account name"
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2 shrink-0 bg-transparent px-0 py-1 text-[11px] font-medium text-gray-600">
                    <span>Active (Y/N)</span>
                    <EditableField.Switch
                      checked={Boolean(activeField.value)}
                      onChange={activeField.onChange}
                      disabled={editor.saving}
                    />
                  </div>
                </div>
                {editor.errors.accountName ? (
                  <p className="text-[10px] text-red-600">{editor.errors.accountName}</p>
                ) : null}
              </div>
            }
          />

          {renderStandardRow(
            "Account Legal Name",
            <EditableField.Input
              value={(accountLegalNameField.value as string) ?? ""}
              onChange={accountLegalNameField.onChange}
              onBlur={accountLegalNameField.onBlur}
              placeholder="Legal entity name"
            />
          )}

          {renderStandardRow(
            "Parent Account",
            <EditableField.Select
              value={(parentAccountField.value as string) ?? ""}
              onChange={parentAccountField.onChange}
              onBlur={parentAccountField.onBlur}
              disabled={optionsLoading}
            >
              <option value="">Not Linked</option>
              {parentAccountOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </EditableField.Select>,
            editor.errors.parentAccountId
          )}

          {renderStandardRow(
            "Account Type",
            <EditableField.Select
              value={(accountTypeField.value as string) ?? ""}
              onChange={accountTypeField.onChange}
              onBlur={accountTypeField.onBlur}
              disabled={optionsLoading}
            >
              <option value="">Select account type</option>
              {accountTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </EditableField.Select>,
            editor.errors.accountTypeId
          )}

          {renderStandardRow(
            "Account Owner",
            <EditableField.Select
              value={(ownerField.value as string) ?? ""}
              onChange={ownerField.onChange}
              onBlur={ownerField.onBlur}
              disabled={optionsLoading}
            >
              <option value="">Unassigned</option>
              {ownerOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </EditableField.Select>
          )}

          {renderStandardRow(
            "Website URL",
            <EditableField.Input
              value={(websiteField.value as string) ?? ""}
              onChange={websiteField.onChange}
              onBlur={websiteField.onBlur}
              placeholder="https://example.com"
            />,
            editor.errors.websiteUrl
          )}

          {renderStandardRow(
            "Description",
            <EditableField.Input
              value={(descriptionField.value as string) ?? ""}
              onChange={descriptionField.onChange}
              onBlur={descriptionField.onBlur}
              placeholder="Flagship enterprise customer"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <FieldRow
            label="Ship To Address"
            value={
              <div className="flex flex-col gap-1">
                <div className="max-w-md">
                  <EditableField.Input
                    value={(shippingLine1Field.value as string) ?? ""}
                    onChange={handleShippingLine1Change}
                    onBlur={shippingLine1Field.onBlur}
                    placeholder="Shipping Street"
                  />
                </div>
                {editor.errors["shippingAddress.line1"] ? (
                  <p className="text-[10px] text-red-600">{editor.errors["shippingAddress.line1"]}</p>
                ) : null}
              </div>
            }
          />

          <FieldRow
            label=""
            value={
              <div className="max-w-md">
                <EditableField.Input
                  value={(shippingLine2Field.value as string) ?? ""}
                  onChange={handleShippingLine2Change}
                  onBlur={shippingLine2Field.onBlur}
                  placeholder="Shipping Street 2"
                />
              </div>
            }
          />

          <FieldRow
            label=""
            value={
              <div className="flex flex-col gap-1">
                <div className="grid max-w-md grid-cols-[2fr,1fr,1fr] gap-1">
                  <EditableField.Input
                    value={(shippingCityField.value as string) ?? ""}
                    onChange={handleShippingCityChange}
                    onBlur={shippingCityField.onBlur}
                    placeholder="City"
                  />
                  <EditableField.Select
                    value={(shippingStateField.value as string) ?? ""}
                    onChange={handleShippingStateChange}
                    onBlur={shippingStateField.onBlur}
                  >
                    <option value="">State</option>
                    {US_STATES.map(state => (
                      <option key={state.code} value={state.code}>
                        {state.code}
                      </option>
                    ))}
                  </EditableField.Select>
                  <EditableField.Input
                    value={(shippingPostalField.value as string) ?? ""}
                    onChange={handleShippingPostalChange}
                    onBlur={shippingPostalField.onBlur}
                    placeholder="Zip"
                  />
                </div>
                {editor.errors["shippingAddress.city"] ||
                editor.errors["shippingAddress.state"] ||
                editor.errors["shippingAddress.postalCode"] ? (
                  <div className="grid max-w-md grid-cols-[2fr,1fr,1fr] gap-1 text-[10px] text-red-600">
                    <span>{editor.errors["shippingAddress.city"] ?? ""}</span>
                    <span>{editor.errors["shippingAddress.state"] ?? ""}</span>
                    <span>{editor.errors["shippingAddress.postalCode"] ?? ""}</span>
                  </div>
                ) : null}
              </div>
            }
          />

          {/* Empty row to align with Account Type */}
          <FieldRow
            label=""
            value={<div className="min-h-[28px]"></div>}
          />

          <FieldRow
            label="Bill To Address"
            value={
              <div className="flex flex-col gap-1">
                <div className="max-w-md">
                  <EditableField.Input
                    value={(billingLine1Field.value as string) ?? ""}
                    onChange={billingLine1Field.onChange}
                    onBlur={billingLine1Field.onBlur}
                    placeholder="Billing Street"
                    disabled={billingLinked}
                  />
                </div>
                {!billingLinked && editor.errors["billingAddress.line1"] ? (
                  <p className="text-[10px] text-red-600">{editor.errors["billingAddress.line1"]}</p>
                ) : null}
              </div>
            }
          />

          <FieldRow
            label=""
            labelExtra={
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={Boolean(billingSameField.value)}
                  onChange={handleBillingSameChange}
                  disabled={editor.saving}
                />
                <span>Same as Ship To</span>
              </label>
            }
            value={
              <div className="max-w-md">
                <EditableField.Input
                  value={(billingLine2Field.value as string) ?? ""}
                  onChange={billingLine2Field.onChange}
                  onBlur={billingLine2Field.onBlur}
                  placeholder="Billing Street 2"
                  disabled={billingLinked}
                />
              </div>
            }
          />

          <FieldRow
            label=""
            value={
              <div className="flex flex-col gap-1">
                <div className="grid max-w-md grid-cols-[2fr,1fr,1fr] gap-1">
                  <EditableField.Input
                    value={(billingCityField.value as string) ?? ""}
                    onChange={billingCityField.onChange}
                    onBlur={billingCityField.onBlur}
                    placeholder="City"
                    disabled={billingLinked}
                  />
                  <EditableField.Select
                    value={(billingStateField.value as string) ?? ""}
                    onChange={billingStateField.onChange}
                    onBlur={billingStateField.onBlur}
                    disabled={billingLinked}
                  >
                    <option value="">State</option>
                    {US_STATES.map(state => (
                      <option key={state.code} value={state.code}>
                        {state.code}
                      </option>
                    ))}
                  </EditableField.Select>
                  <EditableField.Input
                    value={(billingPostalField.value as string) ?? ""}
                    onChange={billingPostalField.onChange}
                    onBlur={billingPostalField.onBlur}
                    placeholder="Zip"
                    disabled={billingLinked}
                  />
                </div>
                {!billingLinked && (editor.errors["billingAddress.city"] || editor.errors["billingAddress.state"] || editor.errors["billingAddress.postalCode"]) ? (
                  <div className="grid max-w-md grid-cols-[2fr,1fr,1fr] gap-1 text-[10px] text-red-600">
                    <span>{editor.errors["billingAddress.city"] ?? ""}</span>
                    <span>{editor.errors["billingAddress.state"] ?? ""}</span>
                    <span>{editor.errors["billingAddress.postalCode"] ?? ""}</span>
                  </div>
                ) : null}
              </div>
            }
          />
        </div>
      </div>
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


export function AccountDetailsView({ account, loading = false, error, onEdit, onRefresh }: AccountDetailsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showSuccess, showError } = useToasts()
  const { hasPermission } = useAuth()
  const canManageAccounts = hasPermission("accounts.manage")
  const shouldEnableInline = canManageAccounts && Boolean(account)
  const [activeTab, setActiveTab] = useState<TabKey>("contacts")
  const [baseAccountTypeOptions, setBaseAccountTypeOptions] = useState<AccountOption[]>([])
  const [baseOwnerOptions, setBaseOwnerOptions] = useState<AccountOption[]>([])
  const [baseParentAccountOptions, setBaseParentAccountOptions] = useState<AccountOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const inlineInitialForm = useMemo(
    () => (shouldEnableInline ? createAccountInlineForm(account) : null),
    [shouldEnableInline, account]
  )

  // Sync initial tab selection from query param for breadcrumb deep links
  useEffect(() => {
    const tab = (searchParams?.get('tab') || '').toLowerCase()
    if (tab === 'contacts' || tab === 'opportunities' || tab === 'groups' || tab === 'activities') {
      setActiveTab(tab as TabKey)
    }
  }, [searchParams])

  const submitAccount = useCallback(
    async (patch: Partial<AccountInlineForm>, draft: AccountInlineForm) => {
      if (!account?.id) {
        throw new Error("Account ID is required")
      }

      const payload = buildAccountPayload(patch, draft)
      if (Object.keys(payload).length === 0) {
        return draft
      }

      try {
        const response = await fetch(`/api/accounts/${account.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })

        const body = await response.json().catch(() => null)

        if (!response.ok) {
          const message = body?.error ?? "Failed to update account"
          const serverErrors = (body?.errors ?? {}) as Record<string, string>
          showError("Unable to update account", message)
          const error = new Error(message) as Error & { serverErrors?: Record<string, string> }
          if (serverErrors && Object.keys(serverErrors).length > 0) {
            error.serverErrors = serverErrors
          }
          throw error
        }

        showSuccess("Account updated", "Changes saved.")
        await onRefresh?.()
        return draft
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error("Failed to update account")
      }
    },
    [account?.id, onRefresh, showError, showSuccess]
  )

  const editor = useEntityEditor<AccountInlineForm>({
    initial: inlineInitialForm,
    validate: shouldEnableInline ? draft => validateAccountForm(draft, account?.id) : undefined,
    onSubmit: shouldEnableInline ? submitAccount : undefined
  })

  const { confirmNavigation } = useUnsavedChangesPrompt(shouldEnableInline && editor.isDirty)

  const handleSaveInline = useCallback(async () => {
    if (!shouldEnableInline) return
    try {
      await editor.submit()
    } catch (error) {
      if (error && typeof error === "object" && "serverErrors" in error) {
        editor.setErrors((error as { serverErrors?: Record<string, string> }).serverErrors ?? {})
      }
    }
  }, [editor, shouldEnableInline])

  useEffect(() => {
    if (!shouldEnableInline || optionsLoaded) {
      return
    }

    let cancelled = false

    const loadOptions = async () => {
      try {
        setOptionsLoading(true)
        const response = await fetch("/api/accounts/options", { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load account options")
        }
        if (cancelled) return

        const accountTypes: AccountOption[] = Array.isArray(payload?.accountTypes)
          ? payload.accountTypes
              .filter((item: any) => item?.id)
              .map((item: any) => ({
                value: String(item.id),
                label: item.name ?? "Unnamed Type"
              }))
          : []

        const parentAccounts: AccountOption[] = Array.isArray(payload?.parentAccounts)
          ? payload.parentAccounts
              .filter((item: any) => item?.id)
              .map((item: any) => ({
                value: String(item.id),
                label: item.accountName ?? "Unnamed Account"
              }))
          : []

        const owners: AccountOption[] = Array.isArray(payload?.owners)
          ? payload.owners
              .filter((item: any) => item?.id)
              .map((item: any) => ({
                value: String(item.id),
                label: item.fullName ?? "Unnamed Owner"
              }))
          : []

        setBaseAccountTypeOptions(accountTypes)
        setBaseParentAccountOptions(parentAccounts)
        setBaseOwnerOptions(owners)
        setOptionsLoaded(true)
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load account options"
          showError("Unable to load account options", message)
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false)
        }
      }
    }

    loadOptions()

    return () => {
      cancelled = true
    }
  }, [shouldEnableInline, optionsLoaded, showError])

  const accountTypeOptions = useMemo(() => {
    if (!account?.accountTypeId || !account.accountType) {
      return baseAccountTypeOptions
    }
    if (baseAccountTypeOptions.some(option => option.value === account.accountTypeId)) {
      return baseAccountTypeOptions
    }
    return [{ value: account.accountTypeId, label: account.accountType }, ...baseAccountTypeOptions]
  }, [account?.accountType, account?.accountTypeId, baseAccountTypeOptions])

  const ownerOptions = useMemo(() => {
    if (!account?.ownerId || !account.accountOwner) {
      return baseOwnerOptions
    }
    if (baseOwnerOptions.some(option => option.value === account.ownerId)) {
      return baseOwnerOptions
    }
    return [{ value: account.ownerId, label: account.accountOwner }, ...baseOwnerOptions]
  }, [account?.accountOwner, account?.ownerId, baseOwnerOptions])

  const parentAccountOptions = useMemo(() => {
    const withoutSelf = baseParentAccountOptions.filter(option => option.value !== (account?.id ?? ""))
    if (!account?.parentAccountId || !account.parentAccount) {
      return withoutSelf
    }
    if (withoutSelf.some(option => option.value === account.parentAccountId)) {
      return withoutSelf
    }
    return [{ value: account.parentAccountId, label: account.parentAccount }, ...withoutSelf]
  }, [account?.id, account?.parentAccount, account?.parentAccountId, baseParentAccountOptions])

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
  }, [measureTableAreaHeight, activeTab, loading])

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

  const handleBack = useCallback(() => {
    if (shouldEnableInline && editor.isDirty) {
      const proceed = confirmNavigation()
      if (!proceed) {
        return
      }
    }
    router.push("/accounts")
  }, [confirmNavigation, editor.isDirty, router, shouldEnableInline])

  const handleTabSelect = useCallback(
    (tab: TabKey) => {
      if (tab === activeTab) return
      if (shouldEnableInline && editor.isDirty) {
        const proceed = confirmNavigation()
        if (!proceed) return
      }
      setActiveTab(tab)
    },
    [activeTab, confirmNavigation, editor.isDirty, shouldEnableInline]
  )

  const [activityFilter, setActivityFilter] = useState<string>("All")
  const [activeFilter, setActiveFilter] = useState<"active" | "inactive">("active")
  const [contactsColumnFilters, setContactsColumnFilters] = useState<ColumnFilter[]>([])
  const [contactsSearchQuery, setContactsSearchQuery] = useState("")
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactOptions, setContactOptions] = useState<ContactModalOptions | null>(null)
  const [contactOptionsLoading, setContactOptionsLoading] = useState(false)
  const [contactRows, setContactRows] = useState<AccountContactRow[]>([])
  const [contactDeleteTargets, setContactDeleteTargets] = useState<AccountContactRow[]>([])
  const [contactToDelete, setContactToDelete] = useState<AccountContactRow | null>(null)
  const [showContactDeleteDialog, setShowContactDeleteDialog] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [contactBulkActionLoading, setContactBulkActionLoading] = useState(false)
  const [showContactBulkOwnerModal, setShowContactBulkOwnerModal] = useState(false)
  const [showContactBulkStatusModal, setShowContactBulkStatusModal] = useState(false)
  const [opportunitiesColumnFilters, setOpportunitiesColumnFilters] = useState<ColumnFilter[]>([])
  const [opportunitiesSearchQuery, setOpportunitiesSearchQuery] = useState("")
  const [opportunityRows, setOpportunityRows] = useState<AccountOpportunityRow[]>([])
  const [selectedOpportunities, setSelectedOpportunities] = useState<string[]>([])
  const [showOpportunityBulkOwnerModal, setShowOpportunityBulkOwnerModal] = useState(false)
  const [showOpportunityBulkStatusModal, setShowOpportunityBulkStatusModal] = useState(false)
  const [opportunityBulkActionLoading, setOpportunityBulkActionLoading] = useState(false)
  const [opportunityDeleteTargets, setOpportunityDeleteTargets] = useState<AccountOpportunityRow[]>([])
  const [opportunityToDelete, setOpportunityToDelete] = useState<AccountOpportunityRow | null>(null)
  const [showOpportunityDeleteDialog, setShowOpportunityDeleteDialog] = useState(false)
  const [editingOpportunity, setEditingOpportunity] = useState<AccountOpportunityRow | null>(null)
  const [opportunityOwners, setOpportunityOwners] = useState<Array<{ value: string; label: string }>>([])
  const [updatingOpportunityIds, setUpdatingOpportunityIds] = useState<Set<string>>(new Set())
  const [opportunityModalOpen, setOpportunityModalOpen] = useState(false)
  const [opportunitiesCurrentPage, setOpportunitiesCurrentPage] = useState(1)
  const [opportunitiesPageSize, setOpportunitiesPageSize] = useState(10)
  const [groupsColumnFilters, setGroupsColumnFilters] = useState<ColumnFilter[]>([])
  const [groupsSearchQuery, setGroupsSearchQuery] = useState("")
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupsCurrentPage, setGroupsCurrentPage] = useState(1)
  const [groupsPageSize, setGroupsPageSize] = useState(10)
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [showGroupBulkOwnerModal, setShowGroupBulkOwnerModal] = useState(false)
  const [showGroupBulkStatusModal, setShowGroupBulkStatusModal] = useState(false)
  const [groupBulkActionLoading, setGroupBulkActionLoading] = useState(false)
  const [groupDeleteTargets, setGroupDeleteTargets] = useState<AccountGroupRow[]>([])
  const [groupToDelete, setGroupToDelete] = useState<AccountGroupRow | null>(null)
  const [showGroupDeleteDialog, setShowGroupDeleteDialog] = useState(false)
  const [activitiesColumnFilters, setActivitiesColumnFilters] = useState<ColumnFilter[]>([])
  const [activitiesSearchQuery, setActivitiesSearchQuery] = useState("")
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [activitiesCurrentPage, setActivitiesCurrentPage] = useState(1)
  const [activitiesPageSize, setActivitiesPageSize] = useState(10)
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const [activityBulkActionLoading, setActivityBulkActionLoading] = useState(false)
  const [showActivityBulkOwnerModal, setShowActivityBulkOwnerModal] = useState(false)
  const [showActivityBulkStatusModal, setShowActivityBulkStatusModal] = useState(false)
  const [contactsPage, setContactsPage] = useState(1)
  const [contactsPageSize, setContactsPageSize] = useState(10)
  const [showContactsColumnSettings, setShowContactsColumnSettings] = useState(false)
  const [showOpportunitiesColumnSettings, setShowOpportunitiesColumnSettings] = useState(false)
  const [showGroupsColumnSettings, setShowGroupsColumnSettings] = useState(false)
  const [showActivitiesColumnSettings, setShowActivitiesColumnSettings] = useState(false)
  const [editingGroup, setEditingGroup] = useState<AccountGroupRow | null>(null)
  const [showGroupEditModal, setShowGroupEditModal] = useState(false)
  const [editingContact, setEditingContact] = useState<AccountContactRow | null>(null)
  const [showContactEditModal, setShowContactEditModal] = useState(false)
  const [editingActivity, setEditingActivity] = useState<AccountActivityRow | null>(null)
  const [showActivityEditModal, setShowActivityEditModal] = useState(false)
  const accountContacts = account?.contacts
  const accountOpportunities = account?.opportunities
  useEffect(() => {
    fetch("/api/admin/users?limit=100&status=Active", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load owners")
        }
        const payload = await response.json().catch(() => null)
        const items = Array.isArray(payload?.data?.users) ? payload.data.users : []
        setOpportunityOwners(
          items.map((user: any) => ({ value: user.id, label: user.fullName || user.email }))
        )
      })
      .catch(error => {
        console.error(error)
        setOpportunityOwners([])
        showError("Unable to load owners", "Please try again later")
      })
    }, [showError])

  useEffect(() => {
    if (Array.isArray(accountContacts)) {
      setContactRows([...accountContacts])
      setSelectedContacts(prev => prev.filter(id => accountContacts.some(row => row.id === id)))
    } else {
      setContactRows([])
      setSelectedContacts([])
    }
  }, [accountContacts])

  useEffect(() => {
    if (Array.isArray(accountOpportunities)) {
      setOpportunityRows([...accountOpportunities])
      setSelectedOpportunities(prev => prev.filter(id => accountOpportunities?.some(row => row.id === id)))
    } else {
      setOpportunityRows([])
      setSelectedOpportunities([])
    }
  }, [accountOpportunities])

  useEffect(() => {
    if (Array.isArray(account?.groups)) {
      setSelectedGroups(prev => prev.filter(id => account.groups.some(row => row.id === id)))
    } else {
      setSelectedGroups([])
    }
  }, [account?.groups])

  useEffect(() => {
    setActiveTab("contacts")
    setActivityFilter("All")
    setActiveFilter("active")
    setContactsColumnFilters([])
    setContactsSearchQuery("")
    setContactModalOpen(false)
    setContactOptions(null)
    setContactRows([])
    setSelectedContacts([])
    setContactDeleteTargets([])
    setContactToDelete(null)
    setShowContactDeleteDialog(false)
    setContactBulkActionLoading(false)
    setOpportunitiesColumnFilters([])
    setOpportunitiesSearchQuery("")
    setOpportunityModalOpen(false)
    setSelectedOpportunities([])
    setOpportunityDeleteTargets([])
    setOpportunityToDelete(null)
    setShowOpportunityDeleteDialog(false)
    setEditingOpportunity(null)
    setOpportunityBulkActionLoading(false)
    setUpdatingOpportunityIds(new Set())
    setOpportunitiesCurrentPage(1)
    setOpportunitiesPageSize(10)
    setGroupsColumnFilters([])
    setGroupsSearchQuery("")
    setGroupModalOpen(false)
    setGroupsCurrentPage(1)
    setGroupsPageSize(10)
    setSelectedGroups([])
    setGroupDeleteTargets([])
    setGroupToDelete(null)
    setShowGroupDeleteDialog(false)
    setActivitiesColumnFilters([])
    setActivitiesSearchQuery("")
    setActivityModalOpen(false)
    setActivitiesCurrentPage(1)
    setActivitiesPageSize(10)
    setSelectedActivities([])
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
    if (Array.isArray(accountContacts)) {
      setContactRows([...accountContacts])
      setSelectedContacts(prev => prev.filter(id => accountContacts.some(row => row.id === id)))
    } else {
      setContactRows([])
      setSelectedContacts([])
    }
  }, [accountContacts])

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
    { id: "mobile", label: "Mobile" },
    { id: "suffix", label: "Suffix" },
    { id: "extension", label: "Extension" }
  ], [])

  const opportunitiesFilterColumns = useMemo(() => [
    { id: "orderIdHouse", label: "Order ID - House" },
    { id: "opportunityName", label: "Opportunity Name" },
    { id: "stage", label: "Opportunity Stage" },
    { id: "referredBy", label: "Referred By" },
    { id: "owner", label: "Owner" },
    { id: "closeDate", label: "Close Date" },
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
    saveChangesOnModalClose: saveContactPrefsOnModalClose,
  } = useTablePreferences("account-details:contacts", CONTACT_TABLE_BASE_COLUMNS)

  const {
    columns: opportunityPreferenceColumns,
    loading: opportunityPreferencesLoading,
    saving: opportunityPreferencesSaving,
    hasUnsavedChanges: opportunityHasUnsavedChanges,
    lastSaved: opportunityLastSaved,
    handleColumnsChange: handleOpportunityTableColumnsChange,
    saveChanges: saveOpportunityTablePreferences,
    saveChangesOnModalClose: saveOpportunityPrefsOnModalClose,
  } = useTablePreferences("account-details:opportunities", OPPORTUNITY_TABLE_BASE_COLUMNS)

  const {
    columns: groupPreferenceColumns,
    loading: groupPreferencesLoading,
    saving: groupPreferencesSaving,
    hasUnsavedChanges: groupHasUnsavedChanges,
    lastSaved: groupLastSaved,
    handleColumnsChange: handleGroupTableColumnsChange,
    saveChanges: saveGroupTablePreferences,
    saveChangesOnModalClose: saveGroupPrefsOnModalClose,
  } = useTablePreferences("account-details:groups", GROUP_TABLE_BASE_COLUMNS)

  const {
    columns: activityPreferenceColumns,
    loading: activityPreferencesLoading,
    saving: activityPreferencesSaving,
    hasUnsavedChanges: activityHasUnsavedChanges,
    lastSaved: activityLastSaved,
    handleColumnsChange: handleActivityTableColumnsChange,
    saveChanges: saveActivityTablePreferences,
    saveChangesOnModalClose: saveActivityPrefsOnModalClose,
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


  const filteredContacts = useMemo(() => {
    let rows = [...contactRows]
    if (activeFilter === "active") {
      rows = rows.filter(row => row.active && !row.isDeleted)
    } else if (activeFilter === "inactive") {
      // Show all records but sort: inactive first, then active
      rows = rows.filter(row => !row.isDeleted)
      rows.sort((a, b) => {
        if (!a.active && b.active) return -1
        if (a.active && !b.active) return 1
        return 0
      })
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
  }, [contactRows, activeFilter, contactsSearchQuery, contactsColumnFilters])

  const paginatedContacts = useMemo(() => {
    const start = (contactsPage - 1) * contactsPageSize
    return filteredContacts.slice(start, start + contactsPageSize)
  }, [filteredContacts, contactsPage, contactsPageSize])

  const contactsPagination = useMemo(() => {
    const total = filteredContacts.length
    const totalPages = Math.max(Math.ceil(total / contactsPageSize), 1)
    return { page: contactsPage, pageSize: contactsPageSize, total, totalPages }
  }, [filteredContacts.length, contactsPage, contactsPageSize])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredContacts.length / contactsPageSize), 1)
    if (contactsPage > maxPage) {
      setContactsPage(maxPage)
    }
  }, [filteredContacts.length, contactsPageSize, contactsPage])

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

  const handleContactSelect = useCallback((contactId: string, selected: boolean) => {
    setSelectedContacts(previous => {
      if (selected) {
        if (previous.includes(contactId)) return previous
        return [...previous, contactId]
      }
      return previous.filter(id => id !== contactId)
    })
  }, [])

  const handleSelectAllContacts = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedContacts(paginatedContacts.map(row => row.id))
      return
    }
    setSelectedContacts([])
  }, [paginatedContacts])
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

        const message = typeof data?.error === "string" && data.error.length > 0
          ? data.error
          : "Failed to delete contact"

        return { success: false, error: message }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete contact"
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

  const handleContactSoftDelete = useCallback(async (
    contactId: string,
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    setContactBulkActionLoading(true)
    try {
      const result = await softDeleteContactRequest(contactId, bypassConstraints)

      if (result.success) {
        const deletedAt = new Date().toISOString()
        setContactRows(previous =>
          previous.map(contact =>
            contact.id === contactId
              ? { ...contact, active: false, isPrimary: false, isDeleted: true, deletedAt }
              : contact
          )
        )
        setSelectedContacts(prev => prev.filter(id => id !== contactId))
        showSuccess("Contact deleted", "The contact has been soft deleted and can be restored if needed.")
        onRefresh?.()
      } else if (!result.constraints && result.error) {
        showError("Failed to delete contact", result.error)
      }

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete contact"
      showError("Failed to delete contact", message)
      return { success: false, error: message }
    } finally {
      setContactBulkActionLoading(false)
    }
  }, [softDeleteContactRequest, setContactRows, setSelectedContacts, showError, showSuccess, onRefresh])

  const executeBulkContactSoftDelete = useCallback(async (
    targets: AccountContactRow[],
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    if (!targets || targets.length === 0) {
      return { success: false, error: "No contacts selected" }
    }

    setContactBulkActionLoading(true)

    try {
      const deactivationCandidates = targets.filter(contact => contact.active && !contact.isDeleted)
      const deletionCandidates = targets.filter(contact => !contact.active || contact.isDeleted)

      const deactivatedIds: string[] = []
      const deactivationFailures: Array<{ contact: AccountContactRow; message: string }> = []

      if (deactivationCandidates.length > 0) {
        const outcomes = await Promise.allSettled(
          deactivationCandidates.map(contact => deactivateContactRequest(contact.id))
        )

        outcomes.forEach((result, index) => {
          const contact = deactivationCandidates[index]
          if (result.status === "fulfilled" && result.value.success) {
            deactivatedIds.push(contact.id)
          } else {
            const message =
              result.status === "fulfilled"
                ? result.value.error || "Failed to deactivate contact"
                : result.reason instanceof Error
                  ? result.reason.message
                  : "Failed to deactivate contact"

            deactivationFailures.push({
              contact,
              message
            })
          }
        })

        if (deactivatedIds.length > 0) {
          const deactivatedSet = new Set(deactivatedIds)
          setContactRows(previous =>
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
      const constraintResults: Array<{ contact: AccountContactRow; constraints: DeletionConstraint[] }> = []
      const deletionFailures: Array<{ contact: AccountContactRow; message: string }> = []

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

        setContactRows(previous =>
          previous.map(contact =>
            successSet.has(contact.id)
              ? { ...contact, active: false, isPrimary: false, isDeleted: true, deletedAt: deletedTimestamp }
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
      setContactDeleteTargets(targets.filter(contact => failureIdSet.has(contact.id)))

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

        if (failureMessage.length > 0) {
          showError("Bulk delete failed", failureMessage)
        }

        return { success: false, error: failureMessage }
      }

      if (deactivatedIds.length > 0 || deletionSuccessIds.length > 0) {
        onRefresh?.()
      }

      return { success: deactivatedIds.length > 0 || deletionSuccessIds.length > 0 }
    } catch (error) {
      console.error("Bulk contact soft delete failed", error)
      const message = error instanceof Error ? error.message : "Unable to delete selected contacts."
      showError("Bulk delete failed", message)
      return { success: false, error: message }
    } finally {
      setContactBulkActionLoading(false)
    }
  }, [deactivateContactRequest, softDeleteContactRequest, setContactRows, setSelectedContacts, setContactDeleteTargets, showError, showSuccess, onRefresh])

  const handleContactPermanentDelete = useCallback(async (
    contactId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setContactBulkActionLoading(true)
    try {
      const response = await fetch(`/api/contacts/${contactId}?stage=permanent`, { method: "DELETE" })

      if (!response.ok) {
        let data: any = null
        try {
          data = await response.json()
        } catch (_) {
          // Ignore JSON parse errors
        }

        const message = typeof data?.error === "string" && data?.error.length > 0
          ? data.error
          : "Failed to permanently delete contact"

        showError("Permanent delete failed", message)
        return { success: false, error: message }
      }

      setContactRows(previous => previous.filter(contact => contact.id !== contactId))
      setSelectedContacts(previous => previous.filter(id => id !== contactId))
      showSuccess("Contact permanently deleted", "The contact has been removed from the system.")
      onRefresh?.()

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete contact"
      showError("Permanent delete failed", message)
      return { success: false, error: message }
    } finally {
      setContactBulkActionLoading(false)
    }
  }, [showError, showSuccess, setContactRows, setSelectedContacts, onRefresh])

  const handleContactRestore = useCallback(async (
    contactId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setContactBulkActionLoading(true)
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" })
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = typeof payload?.error === "string" && payload.error.length > 0
          ? payload.error
          : "Failed to restore contact"

        showError("Restore failed", message)
        return { success: false, error: message }
      }

      const restoredContact = payload?.data ?? null

      setContactRows(previous =>
        previous.map(contact =>
          contact.id === contactId
            ? restoredContact
              ? { ...contact, ...restoredContact, isDeleted: false, deletedAt: null, active: restoredContact.active ?? true }
              : { ...contact, isDeleted: false, deletedAt: null, active: true }
            : contact
        )
      )
      showSuccess("Contact restored", "The contact has been restored and reactivated.")
      onRefresh?.()

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to restore contact"
      showError("Restore failed", message)
      return { success: false, error: message }
    } finally {
      setContactBulkActionLoading(false)
    }
  }, [showError, showSuccess, setContactRows, onRefresh])

  const requestContactDelete = useCallback((contact: AccountContactRow) => {
    setContactDeleteTargets([])
    setContactToDelete(contact)
    setShowContactDeleteDialog(true)
  }, [])

  const openContactBulkDeleteDialog = useCallback(() => {
    if (selectedContacts.length === 0) {
      showError("No contacts selected", "Select at least one contact to delete.")
      return
    }

    const targets = paginatedContacts.filter(row => selectedContacts.includes(row.id))

    if (targets.length === 0) {
      showError(
        "Contacts unavailable",
        "Unable to locate the selected contacts. Refresh the page and try again."
      )
      return
    }

    setContactDeleteTargets(targets)
    setContactToDelete(null)
    setShowContactDeleteDialog(true)
  }, [paginatedContacts, selectedContacts, showError])

  const closeContactDeleteDialog = useCallback(() => {
    setShowContactDeleteDialog(false)
    setContactToDelete(null)
    setContactDeleteTargets([])
  }, [])

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

  const handleEditContact = useCallback((contact: AccountContactRow) => {
    setEditingContact(contact)
    setShowContactEditModal(true)
  }, [])

  const handleCloseContactEditModal = useCallback(() => {
    setShowContactEditModal(false)
    setEditingContact(null)
  }, [])

  const handleContactEditSuccess = useCallback(() => {
    setShowContactEditModal(false)
    setEditingContact(null)
    showSuccess("Contact updated", "The contact has been updated successfully.")
    onRefresh?.()
  }, [showSuccess, onRefresh])

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

  const handleEditActivity = useCallback((activity: AccountActivityRow) => {
    setEditingActivity(activity)
    setShowActivityEditModal(true)
  }, [])

  const handleCloseActivityEditModal = useCallback(() => {
    setShowActivityEditModal(false)
    setEditingActivity(null)
  }, [])

  const handleActivityEditSuccess = useCallback(() => {
    setShowActivityEditModal(false)
    setEditingActivity(null)
    showSuccess("Activity updated", "The activity has been updated successfully.")
    onRefresh?.()
  }, [showSuccess, onRefresh])

  const handleDeleteActivity = useCallback(async (activity: AccountActivityRow) => {
    if (!confirm(`Are you sure you want to delete this activity?`)) return
    try {
      const response = await fetch(`/api/activities/${activity.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete activity')
      showSuccess("Activity deleted", "The activity has been removed.")
      onRefresh?.()
    } catch (error) {
      console.error('Delete activity error:', error)
      showError("Failed to delete activity", error instanceof Error ? error.message : "Please try again.")
    }
  }, [showSuccess, showError, onRefresh])

  const handleToggleActivityStatus = useCallback(async (activity: AccountActivityRow, newStatus: boolean) => {
    if (!activity?.id) {
      showError("Activity unavailable", "Unable to locate this activity record.");
      return;
    }

    try {
      // Convert active/inactive to activity status
      // Active = Pending (or keep current open status), Inactive = Completed
      const status = newStatus ? "Pending" : "Completed";
      
      const response = await fetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to update activity status");
      }

      showSuccess(
        "Activity updated",
        `Activity ${newStatus ? "activated" : "completed"} successfully.`
      );
      
      // Refresh the account data
      onRefresh?.();
    } catch (error) {
      console.error("Failed to update activity status", error);
      const message = error instanceof Error ? error.message : "Unable to update activity status";
      showError("Failed to update activity", message);
    }
  }, [showSuccess, showError, onRefresh])

  const handleEditGroup = useCallback((group: AccountGroupRow) => {
    setEditingGroup(group)
    setShowGroupEditModal(true)
  }, [])

  const handleCloseGroupEditModal = useCallback(() => {
    setShowGroupEditModal(false)
    setEditingGroup(null)
  }, [])

  const handleDeleteGroup = useCallback(async (group: AccountGroupRow) => {
    if (!confirm(`Are you sure you want to delete the group "${group.groupName}"?`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete group')
      }
      
      showSuccess("Group deleted", "The group has been removed.")
      onRefresh?.()
    } catch (error) {
      console.error('Delete group error:', error)
      showError("Failed to delete group", error instanceof Error ? error.message : "Please try again.")
    }
  }, [showSuccess, showError, onRefresh])

  const handleToggleGroupStatus = useCallback(async (group: AccountGroupRow, newStatus: boolean) => {
    if (!group?.id) {
      showError("Group unavailable", "Unable to locate this group record.");
      return;
    }

    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to update group status");
      }

      showSuccess(
        "Group updated",
        `Group ${newStatus ? "activated" : "deactivated"} successfully.`
      );
      
      // Refresh the account data
      onRefresh?.();
    } catch (error) {
      console.error("Failed to update group status", error);
      const message = error instanceof Error ? error.message : "Unable to update group status";
      showError("Failed to update group", message);
    }
  }, [showSuccess, showError, onRefresh])

  const handleGroupEditSuccess = () => {
    setShowGroupEditModal(false)
    setEditingGroup(null)
    showSuccess("Group updated", "The group has been updated successfully.")
    onRefresh?.()
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
    let rows = [...opportunityRows]
    if (activeFilter === "active") {
      rows = rows.filter(row => row.active)
    } else if (activeFilter === "inactive") {
      // Show all records but sort: inactive first, then active
      rows.sort((a, b) => {
        if (!a.active && b.active) return -1
        if (a.active && !b.active) return 1
        return 0
      })
    }
    const query = opportunitiesSearchQuery.trim().toLowerCase()
    if (query.length > 0) {
      rows = rows.filter(row => {
        return [
          row.orderIdHouse,
          row.opportunityName,
          row.stage,
          row.owner,
          row.referredBy,
        ]
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .some(value => value.toLowerCase().includes(query))
      })
    }
    if (opportunitiesColumnFilters.length > 0) {
      rows = applySimpleFilters(rows as unknown as Record<string, unknown>[], opportunitiesColumnFilters) as unknown as AccountOpportunityRow[]
    }
    return rows
  }, [opportunityRows, activeFilter, opportunitiesSearchQuery, opportunitiesColumnFilters])

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

  const markOpportunityUpdating = useCallback((opportunityId: string, updating: boolean) => {
    setUpdatingOpportunityIds(previous => {
      const next = new Set(previous)
      if (updating) {
        next.add(opportunityId)
      } else {
        next.delete(opportunityId)
      }
      return next
    })
  }, [])

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

  const openOpportunityBulkDeleteDialog = useCallback(() => {
    if (selectedOpportunities.length === 0) {
      showError("No opportunities selected", "Select at least one opportunity to delete.")
      return
    }

    const targets = paginatedOpportunities.filter(row => selectedOpportunities.includes(row.id))

    if (targets.length === 0) {
      showError(
        "Opportunities unavailable",
        "Unable to locate the selected opportunities. Refresh the page and try again."
      )
      return
    }

    setOpportunityDeleteTargets(targets)
    setOpportunityToDelete(null)
    setShowOpportunityDeleteDialog(true)
  }, [selectedOpportunities, paginatedOpportunities, showError])

  const requestOpportunityDelete = useCallback((opportunity: AccountOpportunityRow) => {
    setOpportunityDeleteTargets([])
    setOpportunityToDelete(opportunity)
    setShowOpportunityDeleteDialog(true)
  }, [])

  const deleteOpportunityById = useCallback(async (opportunityId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, { method: "DELETE" })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return { success: false, error: payload?.error ?? "Failed to delete opportunity" }
      }

      setOpportunityRows(previous => previous.filter(row => row.id !== opportunityId))
      setSelectedOpportunities(previous => previous.filter(id => id !== opportunityId))
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete opportunity"
      return { success: false, error: message }
    }
  }, [])

  const softDeleteOpportunityById = useCallback(async (opportunityId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return { success: false, error: payload?.error ?? "Failed to update opportunity status" }
      }

      const payload = await response.json().catch(() => null)
      const updatedRow = payload?.data ?? null

      setOpportunityRows(previous =>
        previous.map(row =>
          row.id === opportunityId
            ? updatedRow
              ? { ...row, ...updatedRow, active: false, isDeleted: true, status: OpportunityStatus.Lost }
              : { ...row, active: false, isDeleted: true, status: OpportunityStatus.Lost }
            : row
        )
      )

      setSelectedOpportunities(previous => previous.filter(id => id !== opportunityId))
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update opportunity status"
      return { success: false, error: message }
    }
  }, [])

  const restoreOpportunityById = useCallback(async (opportunityId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return { success: false, error: payload?.error ?? "Failed to restore opportunity" }
      }

      const payload = await response.json().catch(() => null)
      const updatedRow = payload?.data ?? null

      setOpportunityRows(previous =>
        previous.map(row =>
          row.id === opportunityId
            ? updatedRow
              ? { ...row, ...updatedRow, active: true, isDeleted: false, status: OpportunityStatus.Open }
              : { ...row, active: true, isDeleted: false, status: OpportunityStatus.Open }
            : row
        )
      )

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to restore opportunity"
      return { success: false, error: message }
    }
  }, [])

  const handleOpportunitySoftDelete = useCallback(async (
    opportunityId: string,
    _bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    const result = await softDeleteOpportunityById(opportunityId)

    if (result.success) {
      showSuccess("Opportunity deleted", "The opportunity has been marked as inactive.")
      onRefresh?.()
    } else if (result.error) {
      showError("Failed to delete opportunity", result.error)
    }

    return result
  }, [softDeleteOpportunityById, onRefresh, showError, showSuccess])

  const executeBulkOpportunitySoftDelete = useCallback(async (
    targets: AccountOpportunityRow[],
    _bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    if (!targets || targets.length === 0) {
      return { success: false, error: "No opportunities selected" }
    }

    setOpportunityBulkActionLoading(true)

    try {
      const activeTargets = targets.filter(target => target.active && !target.isDeleted)
      const alreadyInactive = targets.filter(target => !target.active || target.isDeleted)

      const outcomes = await Promise.allSettled(activeTargets.map(target => softDeleteOpportunityById(target.id)))

      const successIds = new Set<string>(alreadyInactive.map(target => target.id))
      const failures: Array<{ target: AccountOpportunityRow; message: string }> = []

      outcomes.forEach((result, index) => {
        const target = activeTargets[index]
        if (result.status === "fulfilled" && result.value.success) {
          successIds.add(target.id)
        } else {
          const message = result.status === "fulfilled"
            ? result.value.error ?? "Failed to update opportunity status"
            : result.reason instanceof Error
              ? result.reason.message
              : "Failed to update opportunity status"
          failures.push({ target, message })
        }
      })

      if (successIds.size > 0) {
        setOpportunityRows(previous =>
          previous.map(row =>
            successIds.has(row.id)
              ? { ...row, active: false, isDeleted: true, status: OpportunityStatus.Lost }
              : row
          )
        )

        showSuccess(
          `Marked ${successIds.size} opportunity${successIds.size === 1 ? "" : "ies"} as inactive`,
          "Selected opportunities have been updated."
        )
        onRefresh?.()
      }

      if (failures.length > 0) {
        const detail = failures
          .map(item => `${item.target.opportunityName || "Opportunity"}: ${item.message}`)
          .join("; ")
        showError("Failed to update some opportunities", detail)
      }

      const failureIds = failures.map(item => item.target.id)
      setSelectedOpportunities(failureIds)
      setOpportunityDeleteTargets(failures.length > 0 ? failures.map(item => item.target) : [])

      if (failures.length === 0) {
        setShowOpportunityDeleteDialog(false)
        setOpportunityToDelete(null)
        setOpportunityDeleteTargets([])
      }

      return {
        success: failures.length === 0,
        error: failures.length > 0 ? "Some opportunities failed to update" : undefined
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update selected opportunities."
      showError("Bulk delete failed", message)
      return { success: false, error: message }
    } finally {
      setOpportunityBulkActionLoading(false)
    }
  }, [softDeleteOpportunityById, onRefresh, showError, showSuccess])

  const handleOpportunityPermanentDelete = useCallback(async (
    opportunityId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (opportunityDeleteTargets.length > 0) {
      setOpportunityBulkActionLoading(true)
      const targets = opportunityDeleteTargets

      try {
        const outcomes = await Promise.allSettled(targets.map(target => deleteOpportunityById(target.id)))

        let successCount = 0
        const failures: Array<{ target: AccountOpportunityRow; message: string }> = []

        outcomes.forEach((result, index) => {
          const target = targets[index]
          if (result.status === "fulfilled" && result.value.success) {
            successCount += 1
          } else {
            const message = result.status === "fulfilled"
              ? result.value.error ?? "Failed to delete opportunity"
              : result.reason instanceof Error
                ? result.reason.message
                : "Failed to delete opportunity"
            failures.push({ target, message })
          }
        })

        if (successCount > 0) {
          showSuccess(
            `Deleted ${successCount} opportunity${successCount === 1 ? "" : "ies"}`,
            "The selected opportunities have been permanently removed."
          )
          onRefresh?.()
        }

        if (failures.length > 0) {
          const detail = failures
            .map(item => `${item.target.opportunityName || "Opportunity"}: ${item.message}`)
            .join("; ")
          showError("Failed to delete some opportunities", detail)
          setSelectedOpportunities(failures.map(item => item.target.id))
          setOpportunityDeleteTargets(failures.map(item => item.target))
          return { success: false, error: detail }
        }

        setShowOpportunityDeleteDialog(false)
        setOpportunityToDelete(null)
        setOpportunityDeleteTargets([])
        return { success: successCount > 0 }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to delete selected opportunities."
        showError("Bulk delete failed", message)
        return { success: false, error: message }
      } finally {
        setOpportunityBulkActionLoading(false)
      }
    }

    const result = await deleteOpportunityById(opportunityId)

    if (result.success) {
      showSuccess("Opportunity permanently deleted", "The opportunity has been removed.")
      setShowOpportunityDeleteDialog(false)
      setOpportunityToDelete(null)
      onRefresh?.()
    } else if (result.error) {
      showError("Failed to delete opportunity", result.error)
    }

    return result
  }, [deleteOpportunityById, opportunityDeleteTargets, onRefresh, showError, showSuccess])

  const handleOpportunityRestore = useCallback(async (
    opportunityId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await restoreOpportunityById(opportunityId)

    if (result.success) {
      showSuccess("Opportunity restored", "The opportunity has been reactivated.")
      onRefresh?.()
    } else if (result.error) {
      showError("Failed to restore opportunity", result.error)
    }

    return result
  }, [restoreOpportunityById, onRefresh, showError, showSuccess])

  const closeOpportunityDeleteDialog = () => {
    setShowOpportunityDeleteDialog(false)
    setOpportunityToDelete(null)
    setOpportunityDeleteTargets([])
  }

  const handleOpportunityToggleActive = useCallback(async (opportunity: AccountOpportunityRow, nextActive: boolean) => {
    markOpportunityUpdating(opportunity.id, true)
    try {
      const response = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? "Failed to update opportunity")
      }

      const payload = await response.json().catch(() => null)
      const updatedRow = payload?.data ?? null

      setOpportunityRows(previous =>
        previous.map(row =>
          row.id === opportunity.id
            ? updatedRow
              ? { ...row, ...updatedRow }
              : {
                  ...row,
                  active: nextActive,
                  status: nextActive ? OpportunityStatus.Open : OpportunityStatus.Lost,
                  isDeleted: !nextActive
                }
            : row
        )
      )

      if (updatedRow?.active ?? nextActive) {
        showSuccess("Opportunity reactivated", "The opportunity is now marked as open.")
      } else {
        showSuccess("Opportunity marked inactive", "The opportunity has been marked as lost.")
      }

      onRefresh?.()
    } catch (error) {
      console.error(error)
      showError(
        "Failed to update opportunity",
        error instanceof Error ? error.message : "Unable to update opportunity status."
      )
    } finally {
      markOpportunityUpdating(opportunity.id, false)
    }
  }, [markOpportunityUpdating, onRefresh, showError, showSuccess])

  const handleBulkOpportunityExportCsv = useCallback(() => {
    if (selectedOpportunities.length === 0) {
      showError("No opportunities selected", "Select at least one opportunity to export.")
      return
    }

    const rows = paginatedOpportunities.filter(row => selectedOpportunities.includes(row.id))

    if (rows.length === 0) {
      showError(
        "Opportunities unavailable",
        "Unable to locate the selected opportunities. Refresh the page and try again."
      )
      return
    }

    const headers = [
      "Order ID - House",
      "Opportunity Name",
      "Opportunity Stage",
      "Referred By",
      "Owner",
      "Close Date"
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

    const formatCsvDate = (value: string | Date | null | undefined) => {
      if (!value) return ""
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
          row.orderIdHouse,
          row.opportunityName,
          row.stage,
          row.referredBy,
          row.owner,
          formatCsvDate(row.closeDate ?? null)
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
    link.download = `opportunities-export-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    showSuccess(
      `Exported ${rows.length} opportunity${rows.length === 1 ? "" : "ies"}`,
      "Check your downloads for the CSV file."
    )
  }, [paginatedOpportunities, selectedOpportunities, showError, showSuccess])

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
            body: JSON.stringify({ ownerId })
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? "Failed to update opportunity owner")
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
          const message = result.reason instanceof Error ? result.reason.message : "Unexpected error"
          failures.push({ opportunityId, message })
        }
      })

      if (successes.length > 0) {
        const successSet = new Set(successes)
        const ownerOption = ownerId ? opportunityOwners.find(owner => owner.value === ownerId) : undefined
        const ownerLabel = ownerId ? ownerOption?.label ?? "Selected owner" : "Unassigned"

        setOpportunityRows(previous =>
          previous.map(row =>
            successSet.has(row.id)
              ? {
                  ...row,
                  ownerId: ownerId ?? null,
                  owner: ownerId ? ownerOption?.label ?? "" : ""
                }
              : row
          )
        )

        showSuccess(
          `Updated ${successes.length} opportunity${successes.length === 1 ? "" : "ies"}`,
          `New owner: ${ownerLabel}.`
        )
        onRefresh?.()
      }


      if (failures.length > 0) {
        const nameMap = new Map(opportunityRows.map(row => [row.id, row.opportunityName || "Opportunity"]))
        const detail = failures
          .map(item => `${nameMap.get(item.opportunityId) || "Opportunity"}: ${item.message}`)
          .join("; ")
        showError("Failed to update owner for some opportunities", detail)
      }

      setSelectedOpportunities(failures.map(item => item.opportunityId))
      if (failures.length === 0) {
        setShowOpportunityBulkOwnerModal(false)
      }
    } catch (error) {
      console.error("Bulk owner update failed", error)
      showError(
        "Bulk owner update failed",
        error instanceof Error ? error.message : "Unable to update opportunity owners."
      )
    } finally {
      setOpportunityBulkActionLoading(false)
    }
  }, [selectedOpportunities, opportunityOwners, opportunityRows, onRefresh, showError, showSuccess])

  const handleBulkOpportunityStatusUpdate = useCallback(async (isActive: boolean) => {
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
            body: JSON.stringify({ status: isActive ? OpportunityStatus.Open : OpportunityStatus.Lost })
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
          const message = result.reason instanceof Error ? result.reason.message : "Unexpected error"
          failures.push({ opportunityId, message })
        }
      })

      if (successes.length > 0) {
        const successSet = new Set(successes)
        setOpportunityRows(previous =>
          previous.map(row =>
            successSet.has(row.id)
              ? {
                  ...row,
                  active: isActive,
                  status: isActive ? OpportunityStatus.Open : OpportunityStatus.Lost,
                  isDeleted: !isActive
                }
              : row
          )
        )

        const label = isActive ? "active" : "inactive"
        showSuccess(
          `Marked ${successes.length} opportunity${successes.length === 1 ? "" : "ies"} as ${label}`,
          "The opportunity status has been updated."
        )
        onRefresh?.()
      }

      if (failures.length > 0) {
        const nameMap = new Map(opportunityRows.map(row => [row.id, row.opportunityName || "Opportunity"]))
        const detail = failures
          .map(item => `${nameMap.get(item.opportunityId) || "Opportunity"}: ${item.message}`)
          .join("; ")
        showError("Failed to update status for some opportunities", detail)
      }

      setSelectedOpportunities(failures.map(item => item.opportunityId))
      if (failures.length === 0) {
        setShowOpportunityBulkStatusModal(false)
      }
    } catch (error) {
      console.error("Bulk status update failed", error)
      showError(
        "Bulk status update failed",
        error instanceof Error ? error.message : "Unable to update opportunity status."
      )
    } finally {
      setOpportunityBulkActionLoading(false)
    }
  }, [selectedOpportunities, opportunityRows, onRefresh, showError, showSuccess])

  const handleBulkGroupOwnerUpdate = useCallback(async (ownerId: string | null) => {
    if (selectedGroups.length === 0) {
      showError("No groups selected", "Select at least one group to update.")
      return
    }

    setGroupBulkActionLoading(true)

    try {
      const outcomes = await Promise.allSettled(
        selectedGroups.map(async (groupId) => {
          const response = await fetch(`/api/groups/${groupId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerId })
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error || "Failed to update group owner")
          }

          return groupId
        })
      )

      const successes: string[] = []
      const failures: Array<{ groupId: string; message: string }> = []

      outcomes.forEach((result, index) => {
        const groupId = selectedGroups[index]
        if (result.status === "fulfilled") {
          successes.push(groupId)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : "Unexpected error"
          failures.push({ groupId, message })
        }
      })

      if (successes.length > 0) {
        const successSet = new Set(successes)
        showSuccess(
          `Updated ${successes.length} group${successes.length === 1 ? "" : "s"}`,
          `New owner assigned successfully.`
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(
          account?.groups?.map(group => [group.id, group.groupName || "Group"]) || []
        )
        const detail = failures
          .map(({ groupId, message }) => `${nameMap.get(groupId) || "Group"}: ${message}`)
          .join("; ")
        showError("Failed to update owner for some groups", detail)
      }

      setSelectedGroups(failures.map(item => item.groupId))
      if (failures.length === 0) {
        setShowGroupBulkOwnerModal(false)
      }
      onRefresh?.()
    } catch (error) {
      console.error("Bulk group owner update failed", error)
      showError(
        "Bulk group owner update failed",
        error instanceof Error ? error.message : "Unable to update group owners."
      )
    } finally {
      setGroupBulkActionLoading(false)
    }
  }, [selectedGroups, account?.groups, onRefresh, showError, showSuccess])

  const handleBulkGroupStatusUpdate = useCallback(async (isActive: boolean) => {
    if (selectedGroups.length === 0) {
      showError("No groups selected", "Select at least one group to update.")
      return
    }

    setGroupBulkActionLoading(true)

    try {
      const outcomes = await Promise.allSettled(
        selectedGroups.map(async (groupId) => {
          const response = await fetch(`/api/groups/${groupId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive })
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error || "Failed to update group status")
          }

          return groupId
        })
      )

      const successes: string[] = []
      const failures: Array<{ groupId: string; message: string }> = []

      outcomes.forEach((result, index) => {
        const groupId = selectedGroups[index]
        if (result.status === "fulfilled") {
          successes.push(groupId)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : "Unexpected error"
          failures.push({ groupId, message })
        }
      })

      if (successes.length > 0) {
        const successSet = new Set(successes)
        const label = isActive ? "active" : "inactive"
        showSuccess(
          `Marked ${successes.length} group${successes.length === 1 ? "" : "s"} as ${label}`,
          "The status has been updated successfully."
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(
          account?.groups?.map(group => [group.id, group.groupName || "Group"]) || []
        )
        const detail = failures
          .map(({ groupId, message }) => `${nameMap.get(groupId) || "Group"}: ${message}`)
          .join("; ")
        showError("Failed to update status for some groups", detail)
      }

      setSelectedGroups(failures.map(item => item.groupId))
      if (failures.length === 0) {
        setShowGroupBulkStatusModal(false)
      }
      onRefresh?.()
    } catch (error) {
      console.error("Bulk group status update failed", error)
      showError(
        "Bulk group status update failed",
        error instanceof Error ? error.message : "Unable to update group status."
      )
    } finally {
      setGroupBulkActionLoading(false)
    }
  }, [selectedGroups, account?.groups, onRefresh, showError, showSuccess])

  const handleBulkActivityOwnerUpdate = useCallback(async (ownerId: string | null) => {
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

      const successes: string[] = []
      const failures: Array<{ activityId: string; message: string }> = []

      outcomes.forEach((result, index) => {
        const activityId = selectedActivities[index]
        if (result.status === "fulfilled") {
          successes.push(activityId)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : "Unexpected error"
          failures.push({ activityId, message })
        }
      })

      if (successes.length > 0) {
        const successSet = new Set(successes)
        showSuccess(
          `Updated ${successes.length} activit${successes.length === 1 ? "y" : "ies"}`,
          `New owner assigned successfully.`
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(
          account?.activities?.map(activity => [activity.id, activity.description || "Activity"]) || []
        )
        const detail = failures
          .map(({ activityId, message }) => `${nameMap.get(activityId) || "Activity"}: ${message}`)
          .join("; ")
        showError("Failed to update owner for some activities", detail)
      }

      setSelectedActivities(failures.map(item => item.activityId))
      if (failures.length === 0) {
        setShowActivityBulkOwnerModal(false)
      }
      onRefresh?.()
    } catch (error) {
      console.error("Bulk activity owner update failed", error)
      showError(
        "Bulk activity owner update failed",
        error instanceof Error ? error.message : "Unable to update activity owners."
      )
    } finally {
      setActivityBulkActionLoading(false)
    }
  }, [selectedActivities, account?.activities, onRefresh, showError, showSuccess])

  const handleBulkActivityStatusUpdate = useCallback(async (isActive: boolean) => {
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

      const successes: string[] = []
      const failures: Array<{ activityId: string; message: string }> = []

      outcomes.forEach((result, index) => {
        const activityId = selectedActivities[index]
        if (result.status === "fulfilled") {
          successes.push(activityId)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : "Unexpected error"
          failures.push({ activityId, message })
        }
      })

      if (successes.length > 0) {
        const successSet = new Set(successes)
        const label = isActive ? "open" : "completed"
        showSuccess(
          `Marked ${successes.length} activit${successes.length === 1 ? "y" : "ies"} as ${label}`,
          "The status has been updated successfully."
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(
          account?.activities?.map(activity => [activity.id, activity.description || "Activity"]) || []
        )
        const detail = failures
          .map(({ activityId, message }) => `${nameMap.get(activityId) || "Activity"}: ${message}`)
          .join("; ")
        showError("Failed to update status for some activities", detail)
      }

      setSelectedActivities(failures.map(item => item.activityId))
      if (failures.length === 0) {
        setShowActivityBulkStatusModal(false)
      }
      onRefresh?.()
    } catch (error) {
      console.error("Bulk activity status update failed", error)
      showError(
        "Bulk activity status update failed",
        error instanceof Error ? error.message : "Unable to update activity status."
      )
    } finally {
      setActivityBulkActionLoading(false)
    }
  }, [selectedActivities, account?.activities, onRefresh, showError, showSuccess])

  const handleBulkContactOwnerUpdate = useCallback(async (ownerId: string | null) => {
    if (selectedContacts.length === 0) {
      showError("No contacts selected", "Select at least one contact to update.")
      return
    }

    setContactBulkActionLoading(true)

    try {
      const outcomes = await Promise.allSettled(
        selectedContacts.map(async (contactId) => {
          const response = await fetch(`/api/contacts/${contactId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerId })
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error || "Failed to update contact owner")
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
        showSuccess(
          `Updated ${successes.length} contact${successes.length === 1 ? "" : "s"}`,
          `New owner assigned successfully.`
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(
          contactRows.map(contact => [contact.id, contact.fullName || "Contact"])
        )
        const detail = failures
          .map(({ contactId, message }) => `${nameMap.get(contactId) || "Contact"}: ${message}`)
          .join("; ")
        showError("Failed to update owner for some contacts", detail)
      }

      setSelectedContacts(failures.map(item => item.contactId))
      if (failures.length === 0) {
        setShowContactBulkOwnerModal(false)
      }
      onRefresh?.()
    } catch (error) {
      console.error("Bulk contact owner update failed", error)
      showError(
        "Bulk contact owner update failed",
        error instanceof Error ? error.message : "Unable to update contact owners."
      )
    } finally {
      setContactBulkActionLoading(false)
    }
  }, [selectedContacts, contactRows, onRefresh, showError, showSuccess])

  const handleBulkContactStatusUpdate = useCallback(async (isActive: boolean) => {
    if (selectedContacts.length === 0) {
      showError("No contacts selected", "Select at least one contact to update.")
      return
    }

    setContactBulkActionLoading(true)

    try {
      const outcomes = await Promise.allSettled(
        selectedContacts.map(async (contactId) => {
          const response = await fetch(`/api/contacts/${contactId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: isActive })
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error || "Failed to update contact status")
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
        const label = isActive ? "active" : "inactive"
        showSuccess(
          `Marked ${successes.length} contact${successes.length === 1 ? "" : "s"} as ${label}`,
          "The status has been updated successfully."
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(
          contactRows.map(contact => [contact.id, contact.fullName || "Contact"])
        )
        const detail = failures
          .map(({ contactId, message }) => `${nameMap.get(contactId) || "Contact"}: ${message}`)
          .join("; ")
        showError("Failed to update status for some contacts", detail)
      }

      setSelectedContacts(failures.map(item => item.contactId))
      if (failures.length === 0) {
        setShowContactBulkStatusModal(false)
      }
      onRefresh?.()
    } catch (error) {
      console.error("Bulk contact status update failed", error)
      showError(
        "Bulk contact status update failed",
        error instanceof Error ? error.message : "Unable to update contact status."
      )
    } finally {
      setContactBulkActionLoading(false)
    }
  }, [selectedContacts, contactRows, onRefresh, showError, showSuccess])

  const handleOpportunityEdit = useCallback((opportunity: AccountOpportunityRow) => {
    setEditingOpportunity(opportunity)
  }, [])

  const handleCloseOpportunityEditModal = useCallback(() => {
    setEditingOpportunity(null)
  }, [])

  const handleOpportunityEditSuccess = useCallback(() => {
    handleCloseOpportunityEditModal()
    onRefresh?.()
  }, [handleCloseOpportunityEditModal, onRefresh])

  const contactTableColumns = useMemo(() => {
    return contactPreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_value: unknown, row: AccountContactRow) => {
            const checked = selectedContacts.includes(row.id)
            const activeValue = !!row.active
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                {/* Checkbox */}
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select contact ${row.fullName || row.id}`}
                    onChange={() => handleContactSelect(row.id, !checked)}
                  />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                {/* Active toggle (local state) */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setContactRows(prev => prev.map(c => c.id === row.id ? { ...c, active: !activeValue } : c))
                  }}
                  className="relative inline-flex items-center cursor-pointer"
                  title={activeValue ? 'Active' : 'Inactive'}
                >
                  <span className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    activeValue ? "bg-primary-600" : "bg-gray-300"
                  )}>
                    <span className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                      activeValue ? "translate-x-5" : "translate-x-1"
                    )} />
                  </span>
                </button>
                {/* Delete action - only when contact is inactive */}
                {!activeValue && (
                  <div className="flex gap-0.5">
                    <button type="button" className="p-1 rounded transition-colors text-red-500 hover:text-red-700" onClick={(event) => { event.stopPropagation(); requestContactDelete(row) }} aria-label="Delete contact">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          }
        }
      }
      if (column.id === "actions") {
        return {
          ...column,
          render: (_value: unknown, row: AccountContactRow) => (
            <div className="flex gap-1">
              <button
                type="button"
                className="text-primary-600 transition hover:text-primary-700"
                aria-label="Edit contact"
              >
                <Edit className="h-4 w-4" />
              </button>
                            <button
                type="button"
                className="text-red-500 transition hover:text-red-700"
                aria-label="Delete contact"
                onClick={event => {
                  event.stopPropagation()
                  requestContactDelete(row)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        }
      }
      if (column.id === "fullName") {
        return {
          ...column,
          render: (value?: string, row?: AccountContactRow) => (
            row?.id ? (
              <Link
                href={`/contacts/${row.id}?ctx=accounts${account?.id ? `&ctxId=${encodeURIComponent(account.id)}` : ''}${account?.accountName ? `&ctxName=${encodeURIComponent(account.accountName)}` : ''}`}
                className="text-primary-600 transition hover:text-primary-700 hover:underline"
              >
                {value || "View contact"}
              </Link>
            ) : (
              <span className="text-gray-500">{value || "-"}</span>
            )
          )
        }
      }
      return column
    })
  }, [contactPreferenceColumns, requestContactDelete, handleEditContact])

  const opportunityTableColumns = useMemo(() => {
    return opportunityPreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_value: unknown, row: AccountOpportunityRow) => {
            const checked = selectedOpportunities.includes(row.id)
            const activeValue = !!row.active
            const isUpdating = updatingOpportunityIds.has(row.id)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="sr-only" checked={checked} aria-label={`Select opportunity ${row.opportunityName || row.id}`} onChange={() => handleOpportunitySelect(row.id, !checked)} />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                <button type="button" onClick={(event) => { event.stopPropagation(); if (!isUpdating) { handleOpportunityToggleActive(row, !activeValue) } }} className="relative inline-flex items-center cursor-pointer" disabled={isUpdating} title={activeValue ? 'Active' : 'Lost'}>
                  <span className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    activeValue ? "bg-primary-600" : "bg-gray-300",
                    isUpdating ? "opacity-50" : ""
                  )}>
                    <span className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                      activeValue ? "translate-x-5" : "translate-x-1"
                    )} />
                  </span>
                </button>
                {!activeValue && (
                  <div className="flex gap-0.5">
                    <button type="button" className="p-1 rounded transition-colors text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); requestOpportunityDelete(row) }} aria-label="Delete opportunity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          }
        }
      }

      if (column.id === "estimatedCloseDate") {
        return {
          ...column,
          render: (value?: string | Date | null) => formatDate(value)
        }
      }

      if (column.id === "subagentPercent" || column.id === "houseRepPercent" || column.id === "houseSplitPercent") {
        return {
          ...column,
          render: (value: unknown) => {
            if (value === null || value === undefined) return "--"
            const num = typeof value === "number" ? value : Number(value)
            if (!Number.isFinite(num)) return "--"
            // Normalize: if > 1, it's already a percentage; if <= 1, it's a decimal
            const normalized = num > 1 ? num / 100 : num
            return `${(normalized * 100).toFixed(2)}%`
          }
        }
      }

      if (column.id === "opportunityName") {
        return {
          ...column,
          render: (value: unknown, row: AccountOpportunityRow) => {
            const label = String(value ?? '')
            const opportunityId = row?.id

            if (!opportunityId) {
              return <span className="font-medium text-primary-600">{label}</span>
            }

            return (
              <Link
                href={`/opportunities/${opportunityId}?ctx=accounts${account?.id ? `&ctxId=${encodeURIComponent(account.id)}` : ''}${account?.accountName ? `&ctxName=${encodeURIComponent(account.accountName)}` : ''}`}
                className="cursor-pointer font-medium text-primary-600 hover:text-primary-800 hover:underline"
                onClick={(event) => event.stopPropagation()}
                prefetch={false}
              >
                {label}
              </Link>
            )
          },
        }
      }

      return column
    })
  }, [
    opportunityPreferenceColumns,
    updatingOpportunityIds,
    handleOpportunityToggleActive,
    requestOpportunityDelete,
  ])

  const activityTableColumns = useMemo(() => {
    return activityPreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_value: unknown, row: AccountActivityRow) => {
            const checked = selectedActivities.includes(row.id)
            const activeValue = !!row.active
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="sr-only" checked={checked} aria-label={`Select activity ${row.id}`} onChange={() => handleActivitySelect(row.id, !checked)} />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                {/* Active Toggle */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleActivityStatus(row, !activeValue);
                  }}
                  className="relative inline-flex items-center cursor-pointer"
                  title={activeValue ? "Active" : "Inactive"}
                >
                  <span
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      activeValue ? "bg-primary-600" : "bg-gray-300"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                        activeValue ? "translate-x-5" : "translate-x-1"
                      )}
                    />
                  </span>
                </button>
                {!activeValue && (
                  <div className="flex gap-0.5">
                    <button type="button" className="p-1 text-red-500 hover:text-red-700 transition-colors rounded" onClick={(e) => { e.stopPropagation(); handleDeleteActivity(row) }} aria-label="Delete activity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          }
        }
      }
      if (column.id === "activityDate") {
        return {
          ...column,
          render: (value?: string | Date | null) => {
            if (!value) return "--"
            return formatDate(value) || "--"
          }
        }
      }
      return column
    })
  }, [activityPreferenceColumns, selectedActivities, handleDeleteActivity, handleToggleActivityStatus])

  const filteredGroups = useMemo(() => {
    if (!account) return []
    let rows = [...account.groups]
    if (activeFilter === "active") {
      rows = rows.filter(row => row.active)
    } else if (activeFilter === "inactive") {
      // Show all records but sort: inactive first, then active
      rows.sort((a, b) => {
        if (!a.active && b.active) return -1
        if (a.active && !b.active) return 1
        return 0
      })
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

  const handleGroupSelect = useCallback((groupId: string, selected: boolean) => {
    setSelectedGroups(previous => {
      if (selected) {
        if (previous.includes(groupId)) {
          return previous
        }
        return [...previous, groupId]
      }
      return previous.filter(id => id !== groupId)
    })
  }, [])

  const handleSelectAllGroups = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedGroups(paginatedGroups.map(row => row.id))
      return
    }
    setSelectedGroups([])
  }, [paginatedGroups])

  const openGroupBulkDeleteDialog = useCallback(() => {
    if (selectedGroups.length === 0) {
      showError("No groups selected", "Select at least one group to delete.")
      return
    }

    const targets = paginatedGroups.filter(row => selectedGroups.includes(row.id))

    if (targets.length === 0) {
      showError(
        "Groups unavailable",
        "Unable to locate the selected groups. Refresh the page and try again."
      )
      return
    }

    setGroupDeleteTargets(targets)
    setGroupToDelete(null)
    setShowGroupDeleteDialog(true)
  }, [selectedGroups, paginatedGroups, showError])

  const requestGroupDelete = useCallback((group: AccountGroupRow) => {
    setGroupDeleteTargets([])
    setGroupToDelete(group)
    setShowGroupDeleteDialog(true)
  }, [])

  const handleBulkGroupExportCsv = useCallback(() => {
    if (selectedGroups.length === 0) {
      showError("No groups selected", "Select at least one group to export.")
      return
    }

    const rows = paginatedGroups.filter(row => selectedGroups.includes(row.id))

    if (rows.length === 0) {
      showError(
        "Groups unavailable",
        "Unable to locate the selected groups. Refresh the page and try again."
      )
      return
    }

    const headers = [
      "Group Name",
      "Public/Private",
      "Group Description",
      "Group Owner",
      "Active"
    ]

    const escapeCsv = (value: string | null | undefined) => {
      if (value === null || value === undefined) return ""
      const s = String(value)
      if (s.includes("\"") || s.includes(",") || s.includes("\n")) return `"${s.replace(/\"/g, '""')}"`
      return s
    }

    const lines = [
      headers.join(","),
      ...rows.map(row => [
        row.groupName,
        row.visibility,
        row.description,
        row.owner,
        row.active ? "Active" : "Inactive"
      ].map(escapeCsv).join(","))
    ]

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
    link.href = url
    link.download = `groups-export-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    showSuccess(`Exported ${rows.length} group${rows.length === 1 ? "" : "s"}`, "Check your downloads for the CSV file.")
  }, [paginatedGroups, selectedGroups, showError, showSuccess])

  const groupTableColumns = useMemo(() => {
    return groupPreferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_value: unknown, row: AccountGroupRow) => {
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
                {/* Active Toggle */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleGroupStatus(row, !activeValue);
                  }}
                  className="relative inline-flex items-center cursor-pointer"
                  title={activeValue ? "Active" : "Inactive"}
                >
                  <span
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      activeValue ? "bg-primary-600" : "bg-gray-300"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                        activeValue ? "translate-x-5" : "translate-x-1"
                      )}
                    />
                  </span>
                </button>
                {!activeValue && (
                  <div className="flex gap-0.5">
                    <button type="button" className="p-1 rounded transition-colors text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); requestGroupDelete(row) }} aria-label="Delete group">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          }
        }
      }
      return column
    })
  }, [groupPreferenceColumns, selectedGroups, requestGroupDelete, handleToggleGroupStatus])

  const filteredActivities = useMemo(() => {
    if (!account) return []
    let rows = [...account.activities]
    if (activeFilter === "active") {
      rows = rows.filter(row => row.active)
    } else if (activeFilter === "inactive") {
      // Show all records but sort: inactive first, then active
      rows.sort((a, b) => {
        if (!a.active && b.active) return -1
        if (a.active && !b.active) return 1
        return 0
      })
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

  const handleActivitySelect = useCallback((activityId: string, selected: boolean) => {
    setSelectedActivities(previous => {
      if (selected) {
        if (previous.includes(activityId)) return previous
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

  

  const hasAccount = Boolean(account)

  const headerNode = !account
    ? null
    : shouldEnableInline ? (
        <EditableAccountHeader
          account={account}
          editor={editor}
          accountTypeOptions={accountTypeOptions}
          ownerOptions={ownerOptions}
          parentAccountOptions={parentAccountOptions}
          optionsLoading={optionsLoading}
          onSave={handleSaveInline}
        />
      ) : (
        <AccountHeader account={account} onEdit={onEdit} />
      )


  const formatDate = (value?: string | Date | null) => {
    if (!value) return ""
    const date = value instanceof Date ? value : new Date(value as any)
    if (Number.isNaN(date.getTime())) return ""
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}/${month}/${day}`
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
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
              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                <div className="w-full xl:max-w-[1800px]">
                  {headerNode}
                </div>

                <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                  <div className="flex flex-wrap gap-1 border-x border-t border-gray-200 bg-gray-100 pt-2 px-2 pb-0">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabSelect(tab.id)}
                        className={cn(
                          "px-3 py-1.5 text-sm font-semibold transition rounded-t-md border shadow-sm",
                          activeTab === tab.id
                            ? "relative -mb-[1px] z-10 border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                            : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:from-blue-200 hover:to-blue-300 hover:border-blue-400"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === "contacts" && (
                    <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-1 border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white min-h-0 overflow-hidden pt-0.5 px-3 pb-0">
                      <ListHeader
                        onCreateClick={handleCreateContact}
                        onFilterChange={(filter: string) => setActiveFilter(filter === "active" ? "active" : "inactive")}
                        statusFilter={activeFilter}
                        onSearch={handleContactsSearch}
                        filterColumns={contactsFilterColumns}
                        columnFilters={contactsColumnFilters}
                        onColumnFiltersChange={handleContactsColumnFiltersChange}
                        hasUnsavedTableChanges={contactHasUnsavedChanges}
                        isSavingTableChanges={contactPreferencesSaving}
                        lastTableSaved={contactLastSaved ?? undefined}
                        onSaveTableChanges={saveContactTablePreferences}
                        onSettingsClick={() => setShowContactsColumnSettings(true)}
                        showCreateButton={Boolean(account)}
                        searchPlaceholder="Search contacts"
                      />
                      <ContactBulkActionBar
                        count={selectedContacts.length}
                        disabled={contactBulkActionLoading}
                        onSoftDelete={openContactBulkDeleteDialog}
                        onExportCsv={() => {
                          if (selectedContacts.length === 0) {
                            showError("No contacts selected", "Select at least one contact to export.")
                            return
                          }
                          const rows = paginatedContacts.filter(row => selectedContacts.includes(row.id))
                          const headers = ["Suffix","Full Name","Job Title","Contact Type","Email","Work Phone","Mobile","Extension","Active"]
                          const escapeCsv = (value: string | null | undefined) => {
                            if (value === null || value === undefined) return ""
                            const s = String(value)
                            if (s.includes("\"") || s.includes(",") || s.includes("\n")) return `"${s.replace(/\"/g,'""')}"`
                            return s
                          }
                          const lines = [
                            headers.join(","),
                            ...rows.map(r => [r.suffix, r.fullName, r.jobTitle, r.contactType, r.emailAddress, r.workPhone, r.mobile, r.extension, r.active ? "Active" : "Inactive"].map(escapeCsv).join(","))
                          ]
                          const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement("a")
                          const ts = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
                          a.href = url
                          a.download = `contacts-export-${ts}.csv`
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          window.URL.revokeObjectURL(url)
                          showSuccess(`Exported ${rows.length} contact${rows.length === 1 ? "" : "s"}`, "Check your downloads for the CSV file.")
                        }}
                        onChangeOwner={() => setShowContactBulkOwnerModal(true)}
                        onUpdateStatus={() => setShowContactBulkStatusModal(true)}
                      />
                      <div
                        className="flex flex-1 min-h-0 flex-col overflow-hidden"
                        ref={tableAreaRefCallback}
                      >
                        <DynamicTable
                        className="flex flex-col"
                        columns={contactTableColumns}
                        data={paginatedContacts}
                        emptyMessage="No contacts found for this account"
                        onColumnsChange={handleContactTableColumnsChange}
                        loading={loading || contactPreferencesLoading}
                        pagination={contactsPagination}
                        onPageChange={(p) => setContactsPage(p)}
                        onPageSizeChange={(s) => { setContactsPageSize(s); setContactsPage(1) }}
                        selectedItems={selectedContacts}
                        onItemSelect={handleContactSelect}
                        onSelectAll={handleSelectAllContacts}
                        autoSizeColumns={true}
                        fillContainerWidth
                        maxBodyHeight={tableBodyMaxHeight}
                        alwaysShowPagination
                      />
                      </div>
                    </div>
                  )}
                  {activeTab === "opportunities" && (
                    <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-1 border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white min-h-0 overflow-hidden pt-0.5 px-3 pb-0">
                      <ListHeader
                        onCreateClick={handleCreateOpportunity}
                        onFilterChange={(filter: string) => setActiveFilter(filter === "active" ? "active" : "inactive")}
                        statusFilter={activeFilter}
                        onSearch={handleOpportunitiesSearch}
                        filterColumns={opportunitiesFilterColumns}
                        columnFilters={opportunitiesColumnFilters}
                        onColumnFiltersChange={handleOpportunitiesColumnFiltersChange}
                        hasUnsavedTableChanges={opportunityHasUnsavedChanges}
                        isSavingTableChanges={opportunityPreferencesSaving}
                        lastTableSaved={opportunityLastSaved ?? undefined}
                        onSaveTableChanges={saveOpportunityTablePreferences}
                        onSettingsClick={() => setShowOpportunitiesColumnSettings(true)}
                        showCreateButton={Boolean(account)}
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
                        className="flex flex-1 min-h-0 flex-col overflow-hidden"
                        ref={tableAreaRefCallback}
                      >
                        <DynamicTable
                        className="flex flex-col"
                        columns={opportunityTableColumns}
                        data={paginatedOpportunities}
                        emptyMessage="No opportunities found for this account"
                        onColumnsChange={handleOpportunityTableColumnsChange}
                        loading={loading || opportunityPreferencesLoading}
                        pagination={opportunitiesPagination}
                        onPageChange={handleOpportunitiesPageChange}
                        onPageSizeChange={handleOpportunitiesPageSizeChange}
                        selectedItems={selectedOpportunities}
                        onItemSelect={handleOpportunitySelect}
                        onSelectAll={handleSelectAllOpportunities}
                        onToggle={(row, columnId, value) => {
                          if (columnId === "active") {
                            handleOpportunityToggleActive(row as AccountOpportunityRow, value)
                          }
                        }}
                        autoSizeColumns={true}
                        fillContainerWidth
                        maxBodyHeight={tableBodyMaxHeight}
                        alwaysShowPagination
                      />
                      </div>
                    </div>
                  )}

                  {activeTab === "groups" && (
                    <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-1 border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white min-h-0 overflow-hidden pt-0.5 px-3 pb-0">
                      <ListHeader
                        onCreateClick={handleCreateGroup}
                        onFilterChange={(filter: string) => setActiveFilter(filter === "active" ? "active" : "inactive")}
                        statusFilter={activeFilter}
                        onSearch={handleGroupsSearch}
                        filterColumns={groupsFilterColumns}
                        columnFilters={groupsColumnFilters}
                        onColumnFiltersChange={handleGroupsColumnFiltersChange}
                        hasUnsavedTableChanges={groupHasUnsavedChanges}
                        isSavingTableChanges={groupPreferencesSaving}
                        lastTableSaved={groupLastSaved ?? undefined}
                        onSaveTableChanges={saveGroupTablePreferences}
                        onSettingsClick={() => setShowGroupsColumnSettings(true)}
                        showCreateButton={Boolean(account)}
                        searchPlaceholder="Search groups"
                      />
                      <GroupBulkActionBar
                        count={selectedGroups.length}
                        disabled={groupBulkActionLoading}
                        onSoftDelete={() => openGroupBulkDeleteDialog()}
                        onExportCsv={() => handleBulkGroupExportCsv()}
                        onChangeOwner={() => setShowGroupBulkOwnerModal(true)}
                        onUpdateStatus={() => setShowGroupBulkStatusModal(true)}
                      />
                      <div
                        className="flex flex-1 min-h-0 flex-col overflow-hidden"
                        ref={tableAreaRefCallback}
                      >
                        <DynamicTable
                        className="flex flex-col"
                        columns={groupTableColumns}
                        data={paginatedGroups}
                        emptyMessage="No groups found for this account"
                        onColumnsChange={handleGroupTableColumnsChange}
                        loading={loading || groupPreferencesLoading}
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

                  {activeTab === "activities" && (
                    <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-1 border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white min-h-0 overflow-hidden pt-0.5 px-3 pb-0">
                      <ListHeader
                        onCreateClick={handleCreateActivity}
                        onFilterChange={(filter: string) => setActiveFilter(filter === "active" ? "active" : "inactive")}
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
                        showCreateButton={Boolean(account)}
                        searchPlaceholder="Search activities"
                      />
                      <ActivityBulkActionBar
                        count={selectedActivities.length}
                        disabled={activityBulkActionLoading}
                        onSoftDelete={openContactBulkDeleteDialog}
                        onExportCsv={() => {
                          if (selectedActivities.length === 0) {
                            showError("No activities selected", "Select at least one activity to export.")
                            return
                          }
                          const rows = paginatedActivities.filter(row => selectedActivities.includes(row.id))
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
                            if (value === null || value === undefined) return ""
                            const s = String(value)
                            if (s.includes("\"") || s.includes(",") || s.includes("\n")) return `"${s.replace(/\"/g, '""')}"`
                            return s
                          }
                          const lines = [
                            headers.join(","),
                            ...rows.map(row => [
                              row.activityDate ? formatDate(row.activityDate as any) : "",
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
                          link.download = `activities-export-${timestamp}.csv`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          window.URL.revokeObjectURL(url)
                          showSuccess(`Exported ${rows.length} activity${rows.length === 1 ? "" : "ies"}`, "Check your downloads for the CSV file.")
                        }}
                        onChangeOwner={() => setShowActivityBulkOwnerModal(true)}
                        onUpdateStatus={() => setShowActivityBulkStatusModal(true)}
                      />
                      <div
                        className="flex flex-1 min-h-0 flex-col overflow-hidden"
                        ref={tableAreaRefCallback}
                        // Disable fixed height for Activities tab to allow natural flex growth
                        style={undefined}
                      >
                        <DynamicTable
                        className="flex flex-col"
                        columns={activityTableColumns}
                        data={paginatedActivities}
                        emptyMessage="No activities found for this account"
                        onColumnsChange={handleActivityTableColumnsChange}
                        loading={loading || activityPreferencesLoading}
                        pagination={activitiesPagination}
                        onPageChange={handleActivitiesPageChange}
                        onPageSizeChange={handleActivitiesPageSizeChange}
                        selectedItems={selectedActivities}
                        onItemSelect={handleActivitySelect}
                        onSelectAll={handleSelectAllActivities}
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
        <ContactBulkOwnerModal
          isOpen={showContactBulkOwnerModal}
          owners={(contactOptions?.owners ?? []).map(o => ({ value: o.value, label: o.label }))}
          onClose={() => setShowContactBulkOwnerModal(false)}
          onSubmit={handleBulkContactOwnerUpdate}
          isSubmitting={contactBulkActionLoading}
        />
        <ContactBulkStatusModal
          isOpen={showContactBulkStatusModal}
          onClose={() => setShowContactBulkStatusModal(false)}
          onSubmit={handleBulkContactStatusUpdate}
          isSubmitting={contactBulkActionLoading}
        />
        <TwoStageDeleteDialog
          isOpen={showContactDeleteDialog}
          onClose={closeContactDeleteDialog}
          entity="Contact"
          entityName={
            contactDeleteTargets.length > 0
              ? `${contactDeleteTargets.length} contact${contactDeleteTargets.length === 1 ? "" : "s"}`
              : contactToDelete?.fullName || "Unknown Contact"
          }
          entityId={
            contactDeleteTargets.length > 0
              ? contactDeleteTargets[0]?.id || ""
              : contactToDelete?.id || ""
          }
          multipleEntities={
            contactDeleteTargets.length > 0
              ? contactDeleteTargets.map(contact => ({
                  id: contact.id,
                  name: contact.fullName || "Contact",
                  subtitle: contact.emailAddress
                }))
              : undefined
          }
          entityLabelPlural="Contacts"
          isDeleted={
            contactDeleteTargets.length > 0
              ? contactDeleteTargets.every(contact => contact.isDeleted)
              : contactToDelete?.isDeleted || false
          }
          onSoftDelete={handleContactSoftDelete}
          onBulkSoftDelete={
            contactDeleteTargets.length > 0
              ? (entities, bypassConstraints) =>
                  executeBulkContactSoftDelete(
                    contactDeleteTargets.filter(contact =>
                      entities.some(entity => entity.id === contact.id)
                    ),
                    bypassConstraints
                  )
              : undefined
          }
          onPermanentDelete={handleContactPermanentDelete}
          onRestore={handleContactRestore}
          userCanPermanentDelete={true}
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
        
        <GroupEditModal
          isOpen={showGroupEditModal}
          group={editingGroup}
          onClose={handleCloseGroupEditModal}
          onSuccess={handleGroupEditSuccess}
        />
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

        <ContactEditModal
          isOpen={showContactEditModal}
          contact={
            editingContact && account
              ? {
                  id: editingContact.id,
                  suffix: editingContact.suffix || "",
                  fullName: editingContact.fullName || "",
                  jobTitle: editingContact.jobTitle || "",
                  mobile: editingContact.mobile || "",
                  workPhone: editingContact.workPhone || "",
                  emailAddress: editingContact.emailAddress || "",
                  extension: editingContact.extension || "",
                  accountId: account.id,
                  accountName: account.accountName,
                  isPrimary: Boolean(editingContact.isPrimary),
                  active: Boolean(editingContact.active),
                }
              : null
          }
          onClose={handleCloseContactEditModal}
          onSuccess={handleContactEditSuccess}
        />

        <ActivityNoteEditModal
          isOpen={showActivityEditModal}
          activityId={editingActivity?.id ?? null}
          accountId={account?.id}
          onClose={handleCloseActivityEditModal}
          onSuccess={handleActivityEditSuccess}
        />

        <ActivityBulkOwnerModal
          isOpen={showActivityBulkOwnerModal}
          owners={opportunityOwners}
          onClose={() => setShowActivityBulkOwnerModal(false)}
          onSubmit={handleBulkActivityOwnerUpdate}
          isSubmitting={activityBulkActionLoading}
        />
        <ActivityBulkStatusModal
          isOpen={showActivityBulkStatusModal}
          onClose={() => setShowActivityBulkStatusModal(false)}
          onSubmit={handleBulkActivityStatusUpdate}
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
        <OpportunityEditModal
          isOpen={Boolean(editingOpportunity)}
          opportunityId={editingOpportunity?.id ?? null}
          onClose={handleCloseOpportunityEditModal}
          onSuccess={handleOpportunityEditSuccess}
        />
        <GroupBulkOwnerModal
          isOpen={showGroupBulkOwnerModal}
          owners={opportunityOwners}
          onClose={() => setShowGroupBulkOwnerModal(false)}
          onSubmit={handleBulkGroupOwnerUpdate}
          isSubmitting={groupBulkActionLoading}
        />
        <GroupBulkStatusModal
          isOpen={showGroupBulkStatusModal}
          onClose={() => setShowGroupBulkStatusModal(false)}
          onSubmit={handleBulkGroupStatusUpdate}
          isSubmitting={groupBulkActionLoading}
        />
        <TwoStageDeleteDialog
          isOpen={showOpportunityDeleteDialog}
          onClose={closeOpportunityDeleteDialog}
          entity="Opportunity"
          entityName={
            opportunityDeleteTargets.length > 0
              ? `${opportunityDeleteTargets.length} opportunity${opportunityDeleteTargets.length === 1 ? "" : "ies"}`
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
              ? async (entities, bypassConstraints) =>
                  executeBulkOpportunitySoftDelete(
                    opportunityDeleteTargets.filter(opportunity =>
                      entities.some(entity => entity.id === opportunity.id)
                    ),
                    bypassConstraints
                  )
              : undefined
          }
          onPermanentDelete={handleOpportunityPermanentDelete}
          onRestore={handleOpportunityRestore}
          userCanPermanentDelete={true}
        />
        <TwoStageDeleteDialog
          isOpen={showGroupDeleteDialog}
          onClose={() => {
            setShowGroupDeleteDialog(false)
            setGroupToDelete(null)
            setGroupDeleteTargets([])
          }}
          entity="Group"
          entityName={
            groupDeleteTargets.length > 0
              ? `${groupDeleteTargets.length} group${groupDeleteTargets.length === 1 ? "" : "s"}`
              : groupToDelete?.groupName || "Unknown Group"
          }
          entityId={
            groupDeleteTargets.length > 0
              ? groupDeleteTargets[0]?.id || ""
              : groupToDelete?.id || ""
          }
          multipleEntities={
            groupDeleteTargets.length > 0
              ? groupDeleteTargets.map(group => ({
                  id: group.id,
                  name: group.groupName || "Group",
                  subtitle: group.owner ? `Owner: ${group.owner}` : undefined
                }))
              : undefined
          }
          entityLabelPlural="Groups"
          isDeleted={false}
          onSoftDelete={async (id, bypass) => {
            try {
              const response = await fetch(`/api/groups/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: false })
              })
              if (!response.ok) {
                const payload = await response.json().catch(() => null)
                if (response.status === 409 && payload?.constraints) {
                  return { success: false, constraints: payload.constraints }
                }
                return { success: false, error: payload?.error || "Failed to update group" }
              }
              onRefresh?.()
              return { success: true }
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : "Unexpected error" }
            }
          }}
          onBulkSoftDelete={
            groupDeleteTargets.length > 0
              ? async (entities, bypass) => {
                  const outcomes = await Promise.allSettled(
                    entities.map(async e => {
                      const res = await fetch(`/api/groups/${e.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: false })
                      })
                      if (!res.ok) {
                        const payload = await res.json().catch(() => null)
                        if (res.status === 409 && payload?.constraints) {
                          throw { constraints: payload.constraints }
                        }
                        throw new Error(payload?.error || "Failed to update group")
                      }
                      return e.id
                    })
                  )
                  const anyConstraint = outcomes.find(o => o.status === "rejected" && (o as any).reason?.constraints)
                  if (anyConstraint && (anyConstraint as any).reason?.constraints) {
                    return { success: false, constraints: (anyConstraint as any).reason.constraints }
                  }
                  const anyError = outcomes.find(o => o.status === "rejected")
                  if (anyError) {
                    return { success: false, error: "Some updates failed" }
                  }
                  onRefresh?.()
                  return { success: true }
                }
              : undefined
          }
          onPermanentDelete={async (id) => {
            try {
              const res = await fetch(`/api/groups/${id}`, { method: "DELETE" })
              if (!res.ok) {
                const payload = await res.json().catch(() => null)
                if (res.status === 409 && payload?.constraints) {
                  return { success: false, error: "Blocked by constraints" }
                }
                return { success: false, error: payload?.error || "Failed to delete group" }
              }
              onRefresh?.()
              return { success: true }
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : "Unexpected error" }
            }
          }}
          onRestore={async (id) => {
            try {
              const res = await fetch(`/api/groups/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: true })
              })
              if (!res.ok) {
                const payload = await res.json().catch(() => null)
                return { success: false, error: payload?.error || "Failed to restore group" }
              }
              onRefresh?.()
              return { success: true }
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : "Unexpected error" }
            }
          }}
          userCanPermanentDelete={true}
        />
        {/* Column Chooser Modals for each tab */}
        <ColumnChooserModal
          isOpen={showContactsColumnSettings}
          columns={contactPreferenceColumns}
          onApply={handleContactTableColumnsChange}
          onClose={async () => {
            setShowContactsColumnSettings(false)
            await saveContactPrefsOnModalClose()
          }}
        />
        <ColumnChooserModal
          isOpen={showOpportunitiesColumnSettings}
          columns={opportunityPreferenceColumns}
          onApply={handleOpportunityTableColumnsChange}
          onClose={async () => {
            setShowOpportunitiesColumnSettings(false)
            await saveOpportunityPrefsOnModalClose()
          }}
        />
        <ColumnChooserModal
          isOpen={showGroupsColumnSettings}
          columns={groupPreferenceColumns}
          onApply={handleGroupTableColumnsChange}
          onClose={async () => {
            setShowGroupsColumnSettings(false)
            await saveGroupPrefsOnModalClose()
          }}
        />
        <ColumnChooserModal
          isOpen={showActivitiesColumnSettings}
          columns={activityPreferenceColumns}
          onApply={handleActivityTableColumnsChange}
          onClose={async () => {
            setShowActivitiesColumnSettings(false)
            await saveActivityPrefsOnModalClose()
          }}
        />
        </div>
      </div>
    </div>
  )
}

