"use client"

import Link from "next/link"
import { ChangeEvent, ReactNode, useCallback, useEffect, useState, useMemo, useRef, useLayoutEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Filter, Paperclip, Plus, Search, Settings, Trash2, ChevronDown, Check } from "lucide-react"
import { OpportunityStatus } from "@prisma/client"

import { cn } from "@/lib/utils"
import { TwoStageDeleteDialog } from "./two-stage-delete-dialog"
import type { DeletionConstraint } from "@/lib/deletion"
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
import { GroupBulkActionBar } from "./group-bulk-action-bar"
import { GroupBulkOwnerModal } from "./group-bulk-owner-modal"
import { GroupBulkStatusModal } from "./group-bulk-status-modal"
import { EditableField } from "./editable-field"
import { useEntityEditor, type EntityEditor } from "@/hooks/useEntityEditor"
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt"
import { useAuth } from "@/lib/auth-context"
import { VALIDATION_PATTERNS, formatPhoneNumber } from "@/lib/validation-shared"

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
  attachment?: string | null
  fileName?: string | null
  activityOwner?: string
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
  closeDate?: string | Date | null
  subAgent?: string
  accountIdVendor?: string
  customerIdVendor?: string
  locationId?: string
  orderIdVendor?: string
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

export interface ContactAddress {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface ContactDetail {
  id: string
  accountId?: string
  accountTypeId?: string | null
  accountTypeName?: string
  ownerId?: string | null
  ownerName?: string
  suffix?: string
  prefix?: string
  firstName: string
  middleName?: string
  lastName: string
  accountName: string
  accountShippingAddress?: string
  jobTitle?: string
  department?: string
  contactType?: string
  active: boolean
  emailAddress?: string
  alternateEmail?: string
  preferredContactMethod?: string | null
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
  syncAddressWithAccount?: boolean
  mailingAddress?: ContactAddress | null
  reportsToContactId?: string | null
  reportsToContactName?: string | null
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

type SelectOption = { value: string; label: string }

interface AccountOption extends SelectOption {
  accountTypeId?: string | null
  accountTypeName?: string
}

interface ContactInlineForm {
  prefix: string
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  accountId: string
  contactType: string
  accountTypeName: string
  ownerId: string
  jobTitle: string
  department: string
  workPhone: string
  workPhoneExt: string
  mobilePhone: string
  otherPhone: string
  fax: string
  emailAddress: string
  alternateEmail: string
  assistantName: string
  assistantPhone: string
  linkedinUrl: string
  websiteUrl: string
  preferredContactMethod: string
  isPrimary: boolean
  isDecisionMaker: boolean
  description: string
  notes: string
  syncAddressWithAccount: boolean
  reportsToContactId: string
  reportsToContactName: string
}

function createContactInlineForm(detail: ContactDetail | null | undefined): ContactInlineForm | null {
  if (!detail) return null
  return {
    prefix: detail.prefix ?? "",
    firstName: detail.firstName ?? "",
    middleName: detail.middleName ?? "",
    lastName: detail.lastName ?? "",
    suffix: detail.suffix ?? "",
    accountId: detail.accountId ?? "",
    contactType: detail.contactType ?? "",
    accountTypeName: detail.accountTypeName ?? "",
    ownerId: detail.ownerId ?? "",
    jobTitle: detail.jobTitle ?? "",
    department: detail.department ?? "",
    workPhone: detail.workPhone ?? "",
    workPhoneExt: detail.workPhoneExt ?? "",
    mobilePhone: detail.mobilePhone ?? "",
    otherPhone: detail.otherPhone ?? "",
    fax: detail.fax ?? "",
    emailAddress: detail.emailAddress ?? "",
    alternateEmail: detail.alternateEmail ?? "",
    assistantName: detail.assistantName ?? "",
    assistantPhone: detail.assistantPhone ?? "",
    linkedinUrl: detail.linkedinUrl ?? "",
    websiteUrl: detail.websiteUrl ?? "",
    preferredContactMethod: detail.preferredContactMethod ?? "Email",
    isPrimary: Boolean(detail.isPrimary),
    isDecisionMaker: Boolean(detail.isDecisionMaker),
    description: detail.description ?? "",
    notes: detail.notes ?? "",
    syncAddressWithAccount: Boolean(detail.syncAddressWithAccount),
    reportsToContactId: detail.reportsToContactId ?? "",
    reportsToContactName: detail.reportsToContactName ?? ""
  }
}

function buildContactPayload(patch: Partial<ContactInlineForm>, draft: ContactInlineForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  const trimmed = (value: string) => value.trim()
  const nullableString = (value: string) => {
    const trimmedValue = trimmed(value)
    return trimmedValue.length > 0 ? trimmedValue : null
  }

  if ("prefix" in patch) payload.prefix = nullableString(draft.prefix)
  if ("firstName" in patch) payload.firstName = trimmed(draft.firstName)
  if ("middleName" in patch) payload.middleName = nullableString(draft.middleName)
  if ("lastName" in patch) payload.lastName = trimmed(draft.lastName)
  if ("suffix" in patch) payload.suffix = nullableString(draft.suffix)
  if ("accountId" in patch) payload.accountId = draft.accountId ? trimmed(draft.accountId) : null
  if ("ownerId" in patch) payload.ownerId = draft.ownerId ? trimmed(draft.ownerId) : null
  if ("jobTitle" in patch) payload.jobTitle = nullableString(draft.jobTitle)
  if ("department" in patch) payload.department = nullableString(draft.department)
  if ("workPhone" in patch) payload.workPhone = nullableString(draft.workPhone) ? formatPhoneNumber(trimmed(draft.workPhone)) : null
  if ("workPhoneExt" in patch) payload.workPhoneExt = nullableString(draft.workPhoneExt)
  if ("mobilePhone" in patch) payload.mobilePhone = nullableString(draft.mobilePhone) ? formatPhoneNumber(trimmed(draft.mobilePhone)) : null
  if ("otherPhone" in patch) payload.otherPhone = nullableString(draft.otherPhone) ? formatPhoneNumber(trimmed(draft.otherPhone)) : null
  if ("fax" in patch) payload.fax = nullableString(draft.fax)
  if ("emailAddress" in patch) payload.emailAddress = nullableString(draft.emailAddress)
  if ("alternateEmail" in patch) payload.alternateEmail = nullableString(draft.alternateEmail)
  if ("assistantName" in patch) payload.assistantName = nullableString(draft.assistantName)
  if ("assistantPhone" in patch) payload.assistantPhone = nullableString(draft.assistantPhone) ? formatPhoneNumber(trimmed(draft.assistantPhone)) : null
  if ("linkedinUrl" in patch) payload.linkedinUrl = nullableString(draft.linkedinUrl)
  if ("websiteUrl" in patch) payload.websiteUrl = nullableString(draft.websiteUrl)
  if ("preferredContactMethod" in patch) payload.preferredContactMethod = nullableString(draft.preferredContactMethod)
  if ("isPrimary" in patch) payload.isPrimary = Boolean(draft.isPrimary)
  if ("isDecisionMaker" in patch) payload.isDecisionMaker = Boolean(draft.isDecisionMaker)
  if ("description" in patch) payload.description = nullableString(draft.description)
  if ("notes" in patch) payload.notes = nullableString(draft.notes)
  if ("syncAddressWithAccount" in patch) payload.syncAddressWithAccount = Boolean(draft.syncAddressWithAccount)
  if ("reportsToContactId" in patch) payload.reportsToContactId = draft.reportsToContactId ? trimmed(draft.reportsToContactId) : null

  return payload
}

function validateContactForm(form: ContactInlineForm): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!form.firstName.trim()) {
    errors.firstName = "First name is required."
  }

  if (!form.lastName.trim()) {
    errors.lastName = "Last name is required."
  }

  if (!form.accountId.trim()) {
    errors.accountId = "Account is required."
  }

  const validateEmail = (value: string | undefined, key: string) => {
    if (!value) return
    const trimmed = value.trim()
    if (trimmed && !VALIDATION_PATTERNS.email.test(trimmed)) {
      errors[key] = "Enter a valid email address."
    }
  }

  validateEmail(form.emailAddress, "emailAddress")
  validateEmail(form.alternateEmail, "alternateEmail")

  const validatePhone = (value: string | undefined, key: string) => {
    if (!value) return
    const trimmed = value.trim()
    if (trimmed && !VALIDATION_PATTERNS.phone.test(trimmed)) {
      errors[key] = "Enter phone as XXX-XXX-XXXX."
    }
  }

  validatePhone(form.workPhone, "workPhone")
  validatePhone(form.mobilePhone, "mobilePhone")
  validatePhone(form.otherPhone, "otherPhone")
  validatePhone(form.assistantPhone, "assistantPhone")

  if (form.preferredContactMethod.trim().length === 0) {
    errors.preferredContactMethod = "Select a preferred contact method."
  }

  return errors
}


const TABS: { id: "activities" | "opportunities" | "groups"; label: string }[] = [
  { id: "opportunities", label: "Opportunities" },
  { id: "groups", label: "Groups" },
  { id: "activities", label: "Activities & Notes" }
]

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap"
const fieldSubLabelClass = "text-[11px] font-medium text-gray-600"
const fieldBoxClass = "flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis"

const CONTACT_ACTIVITY_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: "multi-action",
  },
  {
    id: "id",
    label: "Activity ID",
    width: 180,
    minWidth: 140,
    maxWidth: 240,
    sortable: true,
    accessor: "id"
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
    width: 160,
    minWidth: 130,
    maxWidth: 220,
    sortable: true,
    accessor: "activityType"
  },
  {
    id: "activityOwner",
    label: "Activity Owner",
    width: 180,
    minWidth: 140,
    maxWidth: 240,
    sortable: true,
    accessor: "activityOwner"
  },
  {
    id: "description",
    label: "Activity Description",
    width: 260,
    minWidth: 200,
    maxWidth: 420,
    sortable: true,
    accessor: "description"
  },
  {
    id: "activityStatus",
    label: "Activity Status",
    width: 160,
    minWidth: 130,
    maxWidth: 220,
    sortable: true,
    accessor: "activityStatus"
  },
  {
    id: "attachment",
    label: "Attachment",
    width: 140,
    minWidth: 110,
    maxWidth: 200,
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
  }
]


const CONTACT_OPPORTUNITY_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: "multi-action",
  },
  {
    id: "closeDate",
    label: "Close Date",
    width: 160,
    minWidth: 130,
    maxWidth: 220,
    sortable: true,
    accessor: "closeDate"
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
    id: "orderIdHouse",
    label: "Order ID - House",
    width: 170,
    minWidth: 140,
    maxWidth: 220,
    sortable: true,
    accessor: "orderIdHouse"
  },
  {
    id: "owner",
    label: "Owner",
    width: 160,
    minWidth: 130,
    maxWidth: 220,
    sortable: true,
    accessor: "owner"
  },
  {
    id: "subAgent",
    label: "Subagent",
    width: 180,
    minWidth: 140,
    maxWidth: 240,
    sortable: true,
    accessor: "subAgent"
  },
  {
    id: "accountIdVendor",
    label: "Account ID - Vendor",
    width: 200,
    minWidth: 160,
    maxWidth: 260,
    sortable: true,
    accessor: "accountIdVendor"
  },
  {
    id: "customerIdVendor",
    label: "Customer ID - Vendor",
    width: 200,
    minWidth: 160,
    maxWidth: 260,
    sortable: true,
    accessor: "customerIdVendor"
  },
  {
    id: "locationId",
    label: "Location ID",
    width: 170,
    minWidth: 140,
    maxWidth: 220,
    sortable: true,
    accessor: "locationId"
  },
  {
    id: "orderIdVendor",
    label: "Order ID - Vendor",
    width: 180,
    minWidth: 150,
    maxWidth: 240,
    sortable: true,
    accessor: "orderIdVendor"
  }
]

const CONTACT_GROUP_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
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
    <div className="grid items-center gap-4 sm:grid-cols-[140px,1fr]">
      <span className={fieldLabelClass}>{label}</span>
      <div>{value}</div>
    </div>
  )
}

function ContactHeader({
  contact,
  onEdit,
  isDeleted
}: {
  contact: ContactDetail
  onEdit?: (contact: ContactDetail) => void
  isDeleted: boolean
}) {
  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">Contact Detail</p>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && !isDeleted ? (
            <button
              type="button"
              onClick={() => onEdit(contact)}
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
            label="Name"
            value={
                <div className="w-full max-w-md">
                <div className="flex gap-2">
                  <div className="w-[10.5rem] min-w-[10.5rem]">
                    <div className={fieldSubLabelClass}>First</div>
                    <div className={fieldBoxClass}>{contact.firstName}</div>
                  </div>
                  <div className="w-[10.5rem] min-w-[10.5rem]">
                    <div className={fieldSubLabelClass}>Last</div>
                    <div className={fieldBoxClass}>{contact.lastName}</div>
                  </div>
                  <div className="w-[6rem] min-w-[6rem]">
                    <div className={fieldSubLabelClass}>Suffix</div>
                    <div className={fieldBoxClass}>{contact.suffix || "--"}</div>
                  </div>
                </div>
              </div>
            }
          />
          <FieldRow label="Contact Type" value={<div className={fieldBoxClass}>{contact.contactType || "--"}</div>} />
          <FieldRow
            label="Account Name"
            value={
              <div className="flex items-end gap-2 w-full max-w-md">
                <div className="flex-1 min-w-[12rem]">
                  <div className={fieldBoxClass}>{contact.accountName || "--"}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2 border-b-2 border-gray-300 bg-transparent px-0 py-1 text-[11px] font-medium text-gray-600 whitespace-nowrap">
                  <span>Active (Y/N)</span>
                  <ReadOnlySwitch value={contact.active} />
                </div>
              </div>
            }
          />
          <FieldRow
            label="Work Phone"
            value={
              <div className="flex items-center gap-2 w-full max-w-md">
                <div className="flex-1 min-w-[12rem]">
                  <div className={fieldBoxClass}>{contact.workPhone || "--"}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2 bg-transparent px-0 py-0 text-[11px] font-medium text-gray-600 whitespace-nowrap">
                  <span>Extension</span>
                  <div className="min-w-[3rem] text-center border-b-2 border-gray-300 py-1">{contact.workPhoneExt || "--"}</div>
                </div>
              </div>
            }
          />
          <FieldRow label="Mobile" value={<div className={fieldBoxClass}>{contact.mobilePhone || "--"}</div>} />
        </div>
        <div className="space-y-1.5 lg:pt-1">
          <FieldRow label="Job Title" value={<div className={fieldBoxClass}>{contact.jobTitle || "--"}</div>} />
          <FieldRow label="Email Address" value={<div className={fieldBoxClass}>{contact.emailAddress || "--"}</div>} />
          <FieldRow
            label="Shipping Address"
            value={<div className={fieldBoxClass}>{contact.accountShippingAddress || "--"}</div>}
          />
          <FieldRow label="Contact ID" value={<div className={fieldBoxClass}>{contact.id}</div>} />
          <FieldRow
            label="Description"
            value={<div className={fieldBoxClass}>{contact.description || "No description provided."}</div>}
          />
        </div>
      </div>
    </div>
  )
}

interface EditableContactHeaderProps {
  contact: ContactDetail
  editor: EntityEditor<ContactInlineForm>
  accountOptions: AccountOption[]
  ownerOptions: SelectOption[]
  contactMethodOptions: SelectOption[]
  optionsLoading: boolean
  onSave: () => Promise<void>
}

function EditableContactHeader({
  contact,
  editor,
  accountOptions,
  ownerOptions: _ownerOptions,
  contactMethodOptions: _contactMethodOptions,
  optionsLoading,
  onSave
}: EditableContactHeaderProps) {
  void _ownerOptions
  void _contactMethodOptions
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

  const firstNameField = editor.register("firstName")
  const lastNameField = editor.register("lastName")
  const suffixField = editor.register("suffix")
  const accountField = editor.register("accountId")
  const jobTitleField = editor.register("jobTitle")
  const workPhoneField = editor.register("workPhone")
  const workPhoneExtField = editor.register("workPhoneExt")
  const mobilePhoneField = editor.register("mobilePhone")
  const emailField = editor.register("emailAddress")
  const descriptionField = editor.register("description")

  const disableSave = editor.saving || !editor.isDirty

  const handleAccountChange = (event: ChangeEvent<HTMLSelectElement>) => {
    accountField.onChange(event)
    const selected = accountOptions.find(option => option.value === event.target.value)
    editor.setField("accountTypeName", selected?.accountTypeName ?? "")
    editor.setField("contactType", selected?.accountTypeName ?? editor.draft?.contactType ?? "")
  }

  const renderStandardRow = (label: string, control: ReactNode, error?: string, wrapperClassName = "w-full max-w-md") => (
    <FieldRow
      label={label}
      value={
        <div className="flex flex-col gap-1">
          <div className={wrapperClassName}>{control}</div>
          {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
        </div>
      }
    />
  )

  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">Contact Detail</p>
          {editor.isDirty ? <span className="text-[11px] font-semibold text-amber-600">Unsaved changes</span> : null}
          {optionsLoading ? <span className="text-[11px] text-gray-500">Loading field options...</span> : null}
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
            label="Name"
            value={
              <div className="flex flex-col gap-1">
                <div className="w-full max-w-md">
                  <div className="flex gap-2">
                    <div className="w-[10.5rem] min-w-[10.5rem]">
                      <div className={fieldSubLabelClass}>First</div>
                      <EditableField.Input
                        className="w-full"
                        value={(firstNameField.value as string) ?? ""}
                        onChange={firstNameField.onChange}
                        onBlur={firstNameField.onBlur}
                        placeholder="First name"
                      />
                      {editor.errors.firstName ? (
                        <p className="text-[10px] text-red-600">{editor.errors.firstName}</p>
                      ) : null}
                    </div>
                    <div className="w-[10.5rem] min-w-[10.5rem]">
                      <div className={fieldSubLabelClass}>Last</div>
                      <EditableField.Input
                        className="w-full"
                        value={(lastNameField.value as string) ?? ""}
                        onChange={lastNameField.onChange}
                        onBlur={lastNameField.onBlur}
                        placeholder="Last name"
                      />
                      {editor.errors.lastName ? (
                        <p className="text-[10px] text-red-600">{editor.errors.lastName}</p>
                      ) : null}
                    </div>
                    <div className="w-[6rem] min-w-[6rem]">
                      <div className={fieldSubLabelClass}>Suffix</div>
                      <EditableField.Input
                        className="w-full"
                        value={(suffixField.value as string) ?? ""}
                        onChange={suffixField.onChange}
                        onBlur={suffixField.onBlur}
                        placeholder="--"
                      />
                    </div>
                  </div>
                </div>
              </div>
            }
          />

          {renderStandardRow(
            "Contact Type",
            <div className={fieldBoxClass}>{editor.draft?.contactType || "--"}</div>
          )}

          <FieldRow
            label="Account Name"
            value={
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-end gap-2 w-full max-w-md">
                  <div className="flex-1 min-w-[12rem]">
                    <EditableField.Select
                      className="w-full"
                      value={(accountField.value as string) ?? ""}
                      onChange={handleAccountChange}
                      onBlur={accountField.onBlur}
                      disabled={optionsLoading}
                    >
                      <option value="">Select account</option>
                      {accountOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </EditableField.Select>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 border-b-2 border-gray-300 bg-transparent px-0 py-1 text-[11px] font-medium text-gray-600">
                    <span>Active (Y/N)</span>
                    <ReadOnlySwitch value={contact.active} />
                  </div>
                </div>
                {editor.errors.accountId ? (
                  <p className="text-[10px] text-red-600">{editor.errors.accountId}</p>
                ) : null}
              </div>
            }
          />

          <FieldRow
            label="Work Phone"
            value={
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 w-full max-w-md">
                  <div className="flex-1 min-w-[12rem]">
                    <EditableField.Input
                      value={(workPhoneField.value as string) ?? ""}
                      onChange={workPhoneField.onChange}
                      onBlur={workPhoneField.onBlur}
                      placeholder="123-456-7890"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0 bg-transparent px-0 py-0 text-[11px] font-medium text-gray-600">
                    <span>Extension</span>
                    <EditableField.Input
                      className="w-20"
                      value={(workPhoneExtField.value as string) ?? ""}
                      onChange={workPhoneExtField.onChange}
                      onBlur={workPhoneExtField.onBlur}
                      placeholder="Ext"
                    />
                  </div>
                </div>
                {editor.errors.workPhone ? (
                  <p className="text-[10px] text-red-600">{editor.errors.workPhone}</p>
                ) : null}
              </div>
            }
          />

          {renderStandardRow(
            "Mobile Phone",
            <EditableField.Input
              value={(mobilePhoneField.value as string) ?? ""}
              onChange={mobilePhoneField.onChange}
              onBlur={mobilePhoneField.onBlur}
              placeholder="123-456-7890"
            />,
            editor.errors.mobilePhone
          )}

        </div>

        <div className="space-y-1.5">
          {renderStandardRow(
            "Job Title",
            <EditableField.Input
              value={(jobTitleField.value as string) ?? ""}
              onChange={jobTitleField.onChange}
              onBlur={jobTitleField.onBlur}
              placeholder="Job title"
            />
          )}

          {renderStandardRow(
            "Email Address",
            <EditableField.Input
              type="email"
              value={(emailField.value as string) ?? ""}
              onChange={emailField.onChange}
              onBlur={emailField.onBlur}
              placeholder="name@example.com"
            />,
            editor.errors.emailAddress
          )}

          {renderStandardRow(
            "Shipping Address",
            <div className={fieldBoxClass}>{contact.accountShippingAddress || "--"}</div>
          )}

          {renderStandardRow(
            "Contact ID",
            <div className={fieldBoxClass}>{contact.id}</div>
          )}

          {renderStandardRow(
            "Description",
            <EditableField.Textarea
              rows={3}
              value={(descriptionField.value as string) ?? ""}
              onChange={descriptionField.onChange}
              onBlur={descriptionField.onBlur}
              placeholder="Primary stakeholder for rollout"
            />
          )}
        </div>
      </div>
    </div>
  )
}
interface TabToolbarProps {
  onCreateNew?: () => void
  disabled?: boolean
  activeFilter?: "active" | "inactive"
  onFilterChange?: (filter: "active" | "inactive") => void
}

function TabToolbar({ onCreateNew, disabled, activeFilter = "active", onFilterChange }: TabToolbarProps) {
  const handleFilterChange = (filter: "active" | "inactive") => {
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
        {/* iOS-style Segmented Control for Active/Show Inactive */}
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
            onClick={() => handleFilterChange("inactive")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              activeFilter === "inactive"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            Show Inactive
          </button>
        </div>
      </div>
    </div>
  )
}


export function ContactDetailsView({ contact, loading = false, error, onEdit, onContactUpdated, onRefresh }: ContactDetailsViewProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState<"activities" | "opportunities" | "groups">("opportunities")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)
  const { showError, showSuccess, showInfo } = useToasts()
  const [baseAccountOptions, setBaseAccountOptions] = useState<AccountOption[]>([])
  const [baseOwnerOptions, setBaseOwnerOptions] = useState<SelectOption[]>([])
  const [baseContactMethodOptions, setBaseContactMethodOptions] = useState<SelectOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const shouldEnableInline = hasPermission("contacts.manage") && Boolean(contact) && !isDeleted

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

  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [opportunityModalOpen, setOpportunityModalOpen] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<"active" | "inactive">("active")
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
  const [showGroupBulkOwnerModal, setShowGroupBulkOwnerModal] = useState(false)
  const [showGroupBulkStatusModal, setShowGroupBulkStatusModal] = useState(false)
  const [groupOwners, setGroupOwners] = useState<Array<{ value: string; label: string }>>([])

  useEffect(() => {
    setActiveTab("activities")
    setIsDeleted(Boolean(contact?.deletedAt))
  }, [contact?.id, contact?.deletedAt])

  const inlineInitialForm = useMemo(
    () => (shouldEnableInline && contact ? createContactInlineForm(contact) : null),
    [shouldEnableInline, contact]
  )

  const submitContact = useCallback(
    async (patch: Partial<ContactInlineForm>, draft: ContactInlineForm) => {
      if (!contact?.id) {
        throw new Error("Contact ID is required")
      }

      const payload = buildContactPayload(patch, draft)
      if (Object.keys(payload).length === 0) {
        return draft
      }

      try {
        const response = await fetch(`/api/contacts/${contact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })

        const body = await response.json().catch(() => null)
        if (!response.ok) {
          const serverErrors = (body?.errors ?? {}) as Record<string, string>
          const message = body?.error ?? "Failed to update contact"
          showError("Unable to update contact", message)
          const error = new Error(message) as Error & { serverErrors?: Record<string, string> }
          if (serverErrors && Object.keys(serverErrors).length > 0) {
            error.serverErrors = serverErrors
          }
          throw error
        }

        const updatedRecord = body?.data as ContactDetail | undefined
        if (updatedRecord) {
          setIsDeleted(Boolean(updatedRecord.deletedAt))
          onContactUpdated?.(updatedRecord)
        }
        showSuccess("Contact updated", "Changes saved.")
        await onRefresh?.()
        return updatedRecord ? createContactInlineForm(updatedRecord) ?? draft : draft
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error("Failed to update contact")
        }
        throw error
      }
    },
    [contact?.id, onContactUpdated, onRefresh, showError, showSuccess]
  )

  const editor = useEntityEditor<ContactInlineForm>({
    initial: inlineInitialForm,
    validate: shouldEnableInline ? validateContactForm : undefined,
    onSubmit: shouldEnableInline ? submitContact : undefined
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
          const owners = users.map((user: any) => ({
            value: user.id,
            label: user.fullName || user.email || "Unassigned"
          }))
          setOpportunityOwners(owners)
          setGroupOwners(owners)
        }
      } catch (error) {
        console.error("Failed to load opportunity owners", error)
        if (!isCancelled) {
          setOpportunityOwners([])
          setGroupOwners([])
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
    // If inline editing is disabled, ensure loading state is cleared
    if (!shouldEnableInline) {
      setOptionsLoading(false)
      return
    }

    // Only load once
    if (optionsLoaded) {
      return
    }

    let cancelled = false

    const loadOptions = async () => {
      try {
        setOptionsLoading(true)
        const response = await fetch("/api/contacts/options", { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load contact options")
        }
        if (cancelled) return

        const accounts: AccountOption[] = Array.isArray(payload?.accounts)
          ? payload.accounts
              .filter((item: any) => item && (item.value ?? item.id))
              .map((item: any) => ({
                value: String(item.value ?? item.id),
                label: item.label ?? item.accountName ?? "Account",
                accountTypeId: item.accountTypeId ?? null,
                accountTypeName: item.accountTypeName ?? ""
              }))
          : []

        const owners: SelectOption[] = Array.isArray(payload?.owners)
          ? payload.owners
              .filter((item: any) => item && (item.value ?? item.id))
              .map((item: any) => ({
                value: String(item.value ?? item.id),
                label: item.label ?? item.fullName ?? item.email ?? "Owner"
              }))
          : []

        const methods: SelectOption[] = Array.isArray(payload?.contactMethods)
          ? payload.contactMethods
              .filter((item: any) => item && (item.value ?? item.id ?? item.label))
              .map((item: any) => ({
                value: String(item.value ?? item.id ?? item.label),
                label: item.label ?? String(item.value ?? item.id ?? "")
              }))
          : []

        setBaseAccountOptions(accounts)
        setBaseOwnerOptions(owners)
        setBaseContactMethodOptions(methods)
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load contact options"
          showError("Unable to load contact options", message)
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false)
          setOptionsLoaded(true)
        }
      }
    }

    loadOptions()

    return () => {
      cancelled = true
    }
  }, [shouldEnableInline, optionsLoaded, showError])

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

  const accountOptions = useMemo(() => {
    if (!contact?.accountId || !contact.accountName) {
      return baseAccountOptions
    }
    if (baseAccountOptions.some(option => option.value === contact.accountId)) {
      return baseAccountOptions
    }
    return [
      {
        value: contact.accountId,
        label: contact.accountName,
        accountTypeId: contact.accountTypeId ?? null,
        accountTypeName: contact.accountTypeName ?? contact.contactType ?? ""
      },
      ...baseAccountOptions
    ]
  }, [
    baseAccountOptions,
    contact?.accountId,
    contact?.accountName,
    contact?.accountTypeId,
    contact?.accountTypeName,
    contact?.contactType
  ])

  const ownerOptions = useMemo(() => {
    const seen = new Set<string>()
    const combined: SelectOption[] = []
    const source = [...baseOwnerOptions, ...opportunityOwners]
    for (const option of source) {
      if (!option?.value) continue
      if (seen.has(option.value)) continue
      combined.push(option)
      seen.add(option.value)
    }
    if (contact?.ownerId && contact.ownerName && !seen.has(contact.ownerId)) {
      combined.unshift({ value: contact.ownerId, label: contact.ownerName })
    }
    return combined
  }, [baseOwnerOptions, opportunityOwners, contact?.ownerId, contact?.ownerName])

  const contactMethodOptions = useMemo(() => {
    if (!contact?.preferredContactMethod) {
      return baseContactMethodOptions
    }
    if (baseContactMethodOptions.some(option => option.value === contact.preferredContactMethod)) {
      return baseContactMethodOptions
    }
    return [
      { value: contact.preferredContactMethod, label: contact.preferredContactMethod },
      ...baseContactMethodOptions
    ]
  }, [baseContactMethodOptions, contact?.preferredContactMethod])

  const headerNode = !contact
    ? null
    : shouldEnableInline ? (
        <EditableContactHeader
          contact={contact}
          editor={editor}
          accountOptions={accountOptions}
          ownerOptions={ownerOptions}
          contactMethodOptions={contactMethodOptions}
          optionsLoading={optionsLoading}
          onSave={handleSaveInline}
        />
      ) : (
        <ContactHeader contact={contact} onEdit={onEdit} isDeleted={isDeleted} />
      )

  const createButtonDisabled = !contact || refreshing || loading || isDeleted

  const handleTabSelect = useCallback(
    (tab: "activities" | "opportunities" | "groups") => {
      if (tab === activeTab) return
      if (shouldEnableInline && editor.isDirty) {
        const proceed = confirmNavigation()
        if (!proceed) {
          return
        }
      }
      setActiveTab(tab)
    },
    [activeTab, confirmNavigation, editor.isDirty, shouldEnableInline]
  )

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

  const handleToggleActivityStatus = useCallback(async (activity: ContactActivityRow, newStatus: boolean) => {
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

      // Refresh the contact data to update the activities list
      await refreshContactData();
      
      showSuccess(
        "Activity updated",
        `Activity ${newStatus ? "activated" : "completed"} successfully.`
      );
    } catch (error) {
      console.error("Failed to update activity status", error);
      const message = error instanceof Error ? error.message : "Unable to update activity status";
      showError("Failed to update activity", message);
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
      "Activity ID",
      "Activity Date",
      "Activity Type",
      "Activity Owner",
      "Activity Description",
      "Activity Status",
      "Attachment",
      "File Name"
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
        row.id,
        row.activityDate
          ? row.activityDate instanceof Date
            ? formatDate(row.activityDate)
            : formatDate(row.activityDate as any)
          : "",
        row.activityType,
        row.activityOwner,
        row.description,
        row.activityStatus,
        row.attachment,
        row.fileName
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
      "Close Date",
      "Opportunity Name",
      "Opportunity Stage",
      "Order ID - House",
      "Owner",
      "Subagent",
      "Account ID - Vendor",
      "Customer ID - Vendor",
      "Location ID",
      "Order ID - Vendor"
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
          formatCsvDate(row.closeDate ?? null),
          row.opportunityName,
          row.stage,
          row.orderIdHouse,
          row.owner,
          row.subAgent,
          row.accountIdVendor,
          row.customerIdVendor,
          row.locationId,
          row.orderIdVendor
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

  const handleToggleOpportunityStatus = useCallback(async (opportunity: ContactOpportunityRow, newStatus: boolean) => {
    if (!opportunity?.id) {
      showError("Opportunity unavailable", "Unable to locate this opportunity record.");
      return;
    }

    try {
      const response = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newStatus })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to update opportunity status");
      }

      // Refresh the contact data to update the opportunities list
      await refreshContactData();
      
      showSuccess(
        "Opportunity updated",
        `Opportunity ${newStatus ? "activated" : "deactivated"} successfully.`
      );
    } catch (error) {
      console.error("Failed to update opportunity status", error);
      const message = error instanceof Error ? error.message : "Unable to update opportunity status";
      showError("Failed to update opportunity", message);
    }
  }, [refreshContactData, showError, showSuccess]);

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

  const handleToggleGroupStatus = useCallback(async (group: ContactGroupRow, newStatus: boolean) => {
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

      // Refresh the contact data to update the groups list
      await refreshContactData();
      
      showSuccess(
        "Group updated",
        `Group ${newStatus ? "activated" : "deactivated"} successfully.`
      );
    } catch (error) {
      console.error("Failed to update group status", error);
      const message = error instanceof Error ? error.message : "Unable to update group status";
      showError("Failed to update group", message);
    }
  }, [refreshContactData, showError, showSuccess]);

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

  const openGroupBulkDeleteDialog = useCallback(async () => {
    if (selectedGroups.length === 0) {
      showError("No groups selected", "Select at least one group to delete.")
      return
    }
    const confirmed = window.confirm(`Delete ${selectedGroups.length} selected group${selectedGroups.length === 1 ? "" : "s"}? This action cannot be undone.`)
    if (!confirmed) return
    try {
      setGroupBulkActionLoading(true)
      let successCount = 0
      let failureCount = 0
      for (const id of selectedGroups) {
        try {
          const response = await fetch(`/api/groups/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: false })
          })
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
          `Deleted ${successCount} group${successCount === 1 ? "" : "s"}`,
          failureCount > 0 ? `${failureCount} failed. Try refresh and retry.` : ""
        )
      }
      if (failureCount > 0 && successCount === 0) {
        showError("Failed to delete groups", "Please refresh and try again.")
      }
      await refreshContactData()
      setSelectedGroups([])
    } finally {
      setGroupBulkActionLoading(false)
    }
  }, [selectedGroups, refreshContactData, showError, showSuccess])

  const handleBulkGroupExportCsv = useCallback(() => {
    if (selectedGroups.length === 0) {
      showError("No groups selected", "Select at least one group to export.")
      return
    }
    const rows = (contact?.groups ?? []).filter(row => selectedGroups.includes(row.id))
    if (rows.length === 0) {
      showError("Groups unavailable", "Unable to locate the selected groups. Refresh and try again.")
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
    link.download = "groups-export-" + timestamp + ".csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    showSuccess(
      "Exported " + rows.length + " group" + (rows.length === 1 ? "" : "s"),
      "Check your downloads for the CSV file."
    )
  }, [selectedGroups, contact?.groups, showError, showSuccess])

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
            body: JSON.stringify({ ownerId: ownerId ?? null })
          })
          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error || "Failed to update group owner")
          }
          return groupId
        })
      )
      const successes = outcomes.filter(r => r.status === "fulfilled").length
      const failures = outcomes.length - successes
      if (successes > 0) {
        showSuccess(`Updated ${successes} group${successes === 1 ? "" : "s"}`, "New owner assigned successfully.")
      }
      if (failures > 0 && successes === 0) {
        showError("Bulk group owner update failed", "Please try again.")
      }
      await refreshContactData()
      setSelectedGroups([])
      setShowGroupBulkOwnerModal(false)
    } finally {
      setGroupBulkActionLoading(false)
    }
  }, [selectedGroups, refreshContactData, showError, showSuccess])

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
      const successes = outcomes.filter(r => r.status === "fulfilled").length
      const failures = outcomes.length - successes
      if (successes > 0) {
        showSuccess(
          `Updated status for ${successes} group${successes === 1 ? "" : "s"}`,
          "The status has been updated successfully."
        )
      }
      if (failures > 0 && successes === 0) {
        showError("Bulk group status update failed", "Please try again.")
      }
      await refreshContactData()
      setSelectedGroups([])
      setShowGroupBulkStatusModal(false)
    } finally {
      setGroupBulkActionLoading(false)
    }
  }, [selectedGroups, refreshContactData, showError, showSuccess])

  const hasContact = Boolean(contact)

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "--"
    const dateValue = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(dateValue.getTime())) {
      return "--"
    }
    const year = dateValue.getFullYear()
    const month = String(dateValue.getMonth() + 1).padStart(2, "0")
    const day = String(dateValue.getDate()).padStart(2, "0")
    return `${year}/${month}/${day}`
  }

  const activitiesFilterColumns = useMemo(() => [
    { id: "id", label: "Activity ID" },
    { id: "activityDate", label: "Activity Date" },
    { id: "activityType", label: "Activity Type" },
    { id: "activityOwner", label: "Activity Owner" },
    { id: "activityStatus", label: "Activity Status" },
    { id: "description", label: "Activity Description" }
  ], [])

  const opportunitiesFilterColumns = useMemo(() => [
    { id: "id", label: "Opportunity ID" },
    { id: "closeDate", label: "Close Date" },
    { id: "opportunityName", label: "Opportunity Name" },
    { id: "stage", label: "Opportunity Stage" },
    { id: "status", label: "Status" },
    { id: "orderIdHouse", label: "Order ID - House" },
    { id: "owner", label: "Owner" },
    { id: "subAgent", label: "Subagent" },
    { id: "accountIdVendor", label: "Account ID - Vendor" },
    { id: "customerIdVendor", label: "Customer ID - Vendor" },
    { id: "locationId", label: "Location ID" },
    { id: "orderIdVendor", label: "Order ID - Vendor" },
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
                    className={`w-9 h-5 rounded-full transition-colors duration-300 ease-in-out ${
                      activeValue ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ease-in-out transform ${
                        activeValue ? "translate-x-4" : "translate-x-1"
                      } mt-0.5 ${activeValue ? "ring-1 ring-blue-300" : ""}`}
                    />
                  </span>
                </button>
                {/* Delete action - only when inactive */}
                {!activeValue && (
                  <div className="flex gap-0.5">
                    <button type="button" className="p-1 text-red-500 hover:text-red-700 transition-colors rounded" title="Delete activity" onClick={(e) => { e.stopPropagation(); handleActivityDelete(row) }}>
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
  }, [activityPreferenceColumns, selectedActivities, handleActivityDelete, handleToggleActivityStatus])

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
                {/* Active Toggle */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleOpportunityStatus(row, !activeValue);
                  }}
                  className="relative inline-flex items-center cursor-pointer"
                  title={activeValue ? "Active" : "Inactive"}
                >
                  <span
                    className={`w-9 h-5 rounded-full transition-colors duration-300 ease-in-out ${
                      activeValue ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ease-in-out transform ${
                        activeValue ? "translate-x-4" : "translate-x-1"
                      } mt-0.5 ${activeValue ? "ring-1 ring-blue-300" : ""}`}
                    />
                  </span>
                </button>
                {!activeValue && (
                  <div className="flex gap-0.5">
                    <button type="button" className="p-1 rounded transition-colors text-red-500 hover:text-red-700" title="Delete opportunity" onClick={(e) => { e.stopPropagation(); requestOpportunityDelete(row) }}>
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
          id: "closeDate",
          label: "Close Date",
          accessor: "closeDate",
          render: (value?: string | Date | null) => formatDate(value)
        }
      }
      if (column.id === "referredBy") {
        return {
          ...column,
          id: "subAgent",
          label: "Subagent",
          accessor: "subAgent"
        }
      }
      if (column.id === "closeDate") {
        return { ...column, render: (value?: string | Date | null) => formatDate(value) }
      }

      if (column.id === "opportunityName") {
        return {
          ...column,
          render: (value: unknown, row: ContactOpportunityRow) => {
            const label = String(value ?? '')
            const opportunityId = row?.id

            if (!opportunityId) {
              return <span className="font-medium text-primary-600">{label}</span>
            }

            return (
              <Link
                href={`/opportunities/${opportunityId}`}
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
  }, [contactOpportunityPreferenceColumns, selectedOpportunities, requestOpportunityDelete, handleToggleOpportunityStatus])

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
                    className={`w-9 h-5 rounded-full transition-colors duration-300 ease-in-out ${
                      activeValue ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ease-in-out transform ${
                        activeValue ? "translate-x-4" : "translate-x-1"
                      } mt-0.5 ${activeValue ? "ring-1 ring-blue-300" : ""}`}
                    />
                  </span>
                </button>
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
  }, [contactGroupPreferenceColumns, selectedGroups, requestGroupDelete, handleToggleGroupStatus])

  const filteredActivities = useMemo(() => {
    let rows: ContactActivityRow[] = [...(contact?.activities ?? [])]
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
          row.id,
          row.activityType,
          row.activityOwner,
          row.activityStatus,
          row.description,
          row.attachment,
          row.fileName
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
    let rows: ContactOpportunityRow[] = [...(contact?.opportunities ?? [])]
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
      // Support simple "column:value" scoped search to avoid overly broad matches
      // e.g., "subagent:test" or "owner:morgan" or "stage:qualification".
      const scopedMatch = query.match(/^([a-z_]+)\s*:\s*(.+)$/i)
      const aliasMap: Record<string, keyof ContactOpportunityRow> = {
        id: "id",
        name: "opportunityName",
        opportunity: "opportunityName",
        opportunityname: "opportunityName",
        stage: "stage",
        status: "status" as any,
        owner: "owner",
        subagent: "subAgent",
        referredby: "subAgent",
        order: "orderIdHouse",
        orderid: "orderIdHouse",
        orderidhouse: "orderIdHouse",
        house: "orderIdHouse",
        close: "closeDate" as any,
        closedate: "closeDate" as any,
        vendoraccount: "accountIdVendor",
        accountidvendor: "accountIdVendor",
        vendorcustomer: "customerIdVendor",
        customeridvendor: "customerIdVendor",
        location: "locationId",
        vendororder: "orderIdVendor",
        orderidvendor: "orderIdVendor",
      }

      if (scopedMatch) {
        const [, rawKey, rawValue] = scopedMatch
        const key = rawKey.toLowerCase()
        const value = rawValue.trim().toLowerCase()
        const mapped = aliasMap[key]
        if (mapped) {
          rows = rows.filter(row => {
            const field = row[mapped]
            const str = field == null
              ? undefined
              : mapped === "closeDate" && field
              ? String(formatDate(field as any)).toLowerCase()
              : String(field).toLowerCase()
            return typeof str === "string" && str.includes(value)
          })
        } else {
          // If unknown key, fall back to global search using entire query
          rows = rows.filter(row => {
            const values: Array<string | number | boolean | undefined | null | Date> = [
              row.id,
              row.closeDate ? formatDate(row.closeDate as any) : undefined,
              row.opportunityName,
              row.stage,
              row.status,
              row.orderIdHouse,
              row.owner,
              row.subAgent,
              row.accountIdVendor,
              row.customerIdVendor,
              row.locationId,
              row.orderIdVendor,
            ]
            return values
              .map(v => (v == null ? undefined : String(v)))
              .filter((val): val is string => typeof val === "string" && val.length > 0)
              .some(val => val.toLowerCase().includes(query))
          })
        }
      } else {
        // Global fuzzy search across common fields
        rows = rows.filter(row => {
          const values: Array<string | number | boolean | undefined | null | Date> = [
            row.id,
            row.closeDate ? formatDate(row.closeDate as any) : undefined,
            row.opportunityName,
            row.stage,
            row.status,
            row.orderIdHouse,
            row.owner,
            row.subAgent,
            row.accountIdVendor,
            row.customerIdVendor,
            row.locationId,
            row.orderIdVendor,
          ]
          return values
            .map(v => (v == null ? undefined : String(v)))
            .filter((val): val is string => typeof val === "string" && val.length > 0)
            .some(val => val.toLowerCase().includes(query))
        })
      }
    }
    if (opportunitiesColumnFilters.length > 0) {
      rows = applySimpleFilters(rows as unknown as Record<string, unknown>[], opportunitiesColumnFilters) as unknown as ContactOpportunityRow[]
    }
    return rows
  }, [contact?.opportunities, activeFilter, opportunitiesSearchQuery, opportunitiesColumnFilters])

  const filteredGroups = useMemo(() => {
    let rows: ContactGroupRow[] = [...(contact?.groups ?? [])]
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
    <div className="flex h-full flex-col overflow-hidden">

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
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
              <>
                <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                  <div className="w-full xl:max-w-[1800px]">
                    {headerNode}
                  </div>
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

                  {activeTab === "activities" && (
                    <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-1 border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white min-h-0 overflow-hidden pt-0.5 px-3 pb-0">
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
                        className="flex flex-1 min-h-0 flex-col overflow-hidden"
                        ref={tableAreaRefCallback}
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
                    <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-1 border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white min-h-0 overflow-hidden pt-0.5 px-3 pb-0">
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
                        className="flex flex-1 min-h-0 flex-col overflow-hidden"
                        ref={tableAreaRefCallback}
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
                    <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-1 border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white min-h-0 overflow-hidden pt-0.5 px-3 pb-0">
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
                      <GroupBulkActionBar
                        count={selectedGroups.length}
                        disabled={groupBulkActionLoading}
                        onSoftDelete={openGroupBulkDeleteDialog}
                        onExportCsv={handleBulkGroupExportCsv}
                        onChangeOwner={() => setShowGroupBulkOwnerModal(true)}
                        onUpdateStatus={() => setShowGroupBulkStatusModal(true)}
                      />
                      <div
                        className="flex flex-1 min-h-0 flex-col overflow-hidden"
                        ref={tableAreaRefCallback}
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
              </>
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
          <GroupBulkOwnerModal
            isOpen={showGroupBulkOwnerModal}
            owners={groupOwners}
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
        </>
      )}
    </div>
  )
}
