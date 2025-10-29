"use client"

import Link from "next/link"
import { ReactNode, useCallback, useMemo, useEffect, useState } from "react"
import { Edit, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { EditableField } from "./editable-field"
import { useToasts } from "./toast"
import { useEntityEditor, type EntityEditor } from "@/hooks/useEntityEditor"
// import { useAuth } from "@/lib/auth-context"

export interface ProductOpportunityUsage {
  id: string
  name: string
  accountId: string
  accountName: string
  stage: string
  quantity: number | null
  unitPrice: number | null
  expectedRevenue: number | null
  estimatedCloseDate: string | null
}

export interface ProductRevenueSchedule {
  id: string
  scheduleNumber: string | null
  scheduleDate: string | null
  accountId: string
  accountName: string
  expectedUsage: number | null
  actualUsage: number | null
  expectedCommission: number | null
  actualCommission: number | null
  status: string
}

export interface ProductAuditLogEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  action: string
  changedFields: Record<string, { old: unknown; new: unknown }>
}

export interface ProductDetailRecord {
  id: string
  productCode: string
  productNameHouse: string
  productNameVendor: string | null
  description: string | null
  revenueType: string
  commissionPercent: number | null
  priceEach: number | null
  isActive: boolean
  distributor: {
    id: string
    accountName: string
    accountNumber: string | null
  } | null
  vendor: {
    id: string
    accountName: string
    accountNumber: string | null
  } | null
  createdBy: {
    id: string
    name: string
  } | null
  updatedBy: {
    id: string
    name: string
  } | null
  createdAt: string
  updatedAt: string
  productFamilyHouse?: string | null
  productFamilyVendor?: string | null
  productSubtypeVendor?: string | null
  productNameDistributor?: string | null
  partNumberVendor?: string | null
  partNumberDistributor?: string | null
  distributorProductFamily?: string | null
  productDescriptionDistributor?: string | null
  productDescriptionVendor?: string | null
  productDescriptionHouse?: string | null
  usage?: {
    opportunities: ProductOpportunityUsage[]
    revenueSchedules: ProductRevenueSchedule[]
  }
  auditLog?: ProductAuditLogEntry[]
}

type TabKey = "distributor" | "vendor"

interface ProductDetailsViewProps {
  product: ProductDetailRecord | null
  loading?: boolean
  error?: string | null
  onEdit?: () => void
  onRefresh?: () => Promise<void> | void
}

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-wide text-gray-500"
const fieldBoxClass =
  "flex min-h-[28px] w-full max-w-md items-center justify-between border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis"

interface ProductInlineForm {
  active: boolean
  productNameHouse: string
  productNameVendor: string
  productCode: string
  revenueType: string
  priceEach: string
  commissionPercent: string
  description: string
  productFamilyHouse: string
  productFamilyVendor: string
  productSubtypeVendor: string
  productNameDistributor: string
  partNumberVendor: string
  partNumberDistributor: string
  distributorProductFamily: string
  productDescriptionVendor: string
  productDescriptionDistributor: string
  vendorAccountId: string
  distributorAccountId: string
}

const REVENUE_TYPE_OPTIONS = [
  { value: "NRC_PerItem", label: "NRC - Per Item" },
  { value: "NRC_FlatFee", label: "NRC - Flat Fee" },
  { value: "MRC_PerItem", label: "MRC - Per Item" },
  { value: "MRC_FlatFee", label: "MRC - Flat Fee" }
]

const TABS: { id: TabKey; label: string }[] = [
  { id: "distributor", label: "Distributor" },
  { id: "vendor", label: "Vendor" }
]

function numberToInputString(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return ""
  }
  const normalised = Number(value)
  if (!Number.isFinite(normalised)) return ""
  return `${normalised}`
}

function percentToInputString(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return ""
  }
  const percentValue = value > 1 ? value : value * 100
  const rounded = Math.round((percentValue + Number.EPSILON) * 100) / 100
  return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : String(rounded)
}

function inputStringToPercent(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  if (parsed === 0) return 0
  return parsed > 1 ? parsed / 100 : parsed
}

function createProductInlineForm(product: ProductDetailRecord | null | undefined): ProductInlineForm | null {
  if (!product) return null
  return {
    active: Boolean(product.isActive),
    productNameHouse: product.productNameHouse ?? "",
    productNameVendor: product.productNameVendor ?? "",
    productCode: product.productCode ?? "",
    revenueType: product.revenueType ?? "",
    priceEach: numberToInputString(product.priceEach),
    commissionPercent: percentToInputString(product.commissionPercent),
    description: product.description ?? "",
    productFamilyHouse: product.productFamilyHouse ?? "",
    productFamilyVendor: product.productFamilyVendor ?? "",
    productSubtypeVendor: product.productSubtypeVendor ?? "",
    productNameDistributor: product.productNameDistributor ?? "",
    partNumberVendor: product.partNumberVendor ?? "",
    partNumberDistributor: product.partNumberDistributor ?? "",
    distributorProductFamily: product.distributorProductFamily ?? "",
    productDescriptionVendor: product.productDescriptionVendor ?? "",
    productDescriptionDistributor: product.productDescriptionDistributor ?? "",
    vendorAccountId: product.vendor?.id ?? "",
    distributorAccountId: product.distributor?.id ?? ""
  }
}

function buildProductPayload(
  patch: Partial<ProductInlineForm>,
  draft: ProductInlineForm
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if ("active" in patch) {
    payload.active = Boolean(draft.active)
  }
  if ("productNameHouse" in patch) {
    payload.productNameHouse = draft.productNameHouse.trim()
  }
  if ("productNameVendor" in patch) {
    const value = draft.productNameVendor.trim()
    payload.productNameVendor = value.length > 0 ? value : null
  }
  if ("productCode" in patch) {
    payload.productCode = draft.productCode.trim()
  }
  if ("productFamilyHouse" in patch) {
    const value = draft.productFamilyHouse.trim()
    payload.productFamilyHouse = value.length > 0 ? value : null
  }
  if ("revenueType" in patch) {
    payload.revenueType = draft.revenueType
  }
  if ("productNameDistributor" in patch) {
    const value = draft.productNameDistributor.trim()
    payload.productNameDistributor = value.length > 0 ? value : null
  }
  if ("partNumberVendor" in patch) {
    const value = draft.partNumberVendor.trim()
    payload.partNumberVendor = value.length > 0 ? value : null
  }
  if ("partNumberDistributor" in patch) {
    const value = draft.partNumberDistributor.trim()
    payload.partNumberDistributor = value.length > 0 ? value : null
  }
  if ("priceEach" in patch) {
    const trimmed = draft.priceEach.trim()
    if (!trimmed) {
      payload.priceEach = null
    } else {
      const parsed = Number(trimmed)
      payload.priceEach = Number.isFinite(parsed) ? parsed : null
    }
  }
  if ("commissionPercent" in patch) {
    const percent = inputStringToPercent(draft.commissionPercent)
    payload.commissionPercent = percent
  }
  if ("description" in patch) {
    const value = draft.description.trim()
    payload.description = value.length > 0 ? value : null
  }
  if ("productFamilyVendor" in patch) {
    const value = draft.productFamilyVendor.trim()
    payload.productFamilyVendor = value.length > 0 ? value : null
  }
  if ("productSubtypeVendor" in patch) {
    const value = draft.productSubtypeVendor.trim()
    payload.productSubtypeVendor = value.length > 0 ? value : null
  }
  if ("distributorProductFamily" in patch) {
    const value = draft.distributorProductFamily.trim()
    payload.distributorProductFamily = value.length > 0 ? value : null
  }
  if ("productDescriptionVendor" in patch) {
    const value = draft.productDescriptionVendor.trim()
    payload.productDescriptionVendor = value.length > 0 ? value : null
  }
  if ("productDescriptionDistributor" in patch) {
    const value = draft.productDescriptionDistributor.trim()
    payload.productDescriptionDistributor = value.length > 0 ? value : null
  }
  if ("vendorAccountId" in patch) {
    const value = draft.vendorAccountId.trim()
    payload.vendorAccountId = value.length > 0 ? value : null
  }
  if ("distributorAccountId" in patch) {
    const value = draft.distributorAccountId.trim()
    payload.distributorAccountId = value.length > 0 ? value : null
  }

  return payload
}

function validateProductForm(form: ProductInlineForm): Record<string, string> {
  const errors: Record<string, string> = {}

  if (form.productNameHouse.trim().length === 0) {
    errors.productNameHouse = "Product name is required."
  }
  if (form.productCode.trim().length === 0) {
    errors.productCode = "Product code is required."
  }
  if (!form.revenueType) {
    errors.revenueType = "Select a revenue type."
  }

  const priceValue = form.priceEach.trim()
  if (priceValue) {
    const parsed = Number(priceValue)
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.priceEach = "Enter a valid price."
    }
  }

  const commissionValue = form.commissionPercent.trim()
  if (commissionValue) {
    const parsed = Number(commissionValue)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      errors.commissionPercent = "Commission must be between 0 and 100."
    }
  }

  return errors
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
      <span className={cn(fieldLabelClass, "pt-1.5")}>{label}</span>
      <div>{children}</div>
    </div>
  )
}

function formatCurrency(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatPercent(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null
  }
  const normalized = value > 1 ? value : value * 100
  const formatted = normalized % 1 === 0 ? normalized.toFixed(0) : normalized.toFixed(2)
  return `${formatted.replace(/\.00$/, "")}%`
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}/${month}/${day}`
}

function humanizeLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase())
}

interface ProductHeaderProps {
  product: ProductDetailRecord
  onEdit?: (() => void) | null | undefined
  activeTab: TabKey
  onTabSelect: (tab: TabKey) => void
}

function ProductHeader({ product, onEdit, activeTab, onTabSelect }: ProductHeaderProps) {
  const productName = product.productNameHouse || product.productNameVendor || "Product"
  const statusBadge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        product.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
      )}
    >
      {product.isActive ? "Active" : "Inactive"}
    </span>
  )
  const priceEach = formatCurrency(product.priceEach)
  const commissionRate = formatPercent(product.commissionPercent)
  const revenueTypeLabel = humanizeLabel(product.revenueType)
  const productDescriptionHouse = product.productDescriptionHouse ?? product.description ?? null

  return (
    <div className="flex flex-col gap-0">
      {/* Header Section */}
      <div className="rounded-t-2xl bg-gray-100 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Product Detail</p>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{productName}</h1>
              {statusBadge}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                <Edit className="h-4 w-4" />
                <span>Update</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-1.5">
            <FieldRow label="Product Name - House">
              <div className={fieldBoxClass}>
                {product.productNameHouse || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Part Number - House">
              <div className={fieldBoxClass}>
                {product.productCode || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Product Family - House">
              <div className={fieldBoxClass}>
                {product.productFamilyHouse || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="House - Product Subtype">
              <div className={fieldBoxClass}>
                <span className="text-gray-500">--</span>
              </div>
            </FieldRow>
            <FieldRow label="House - Description">
              <div className={cn(fieldBoxClass, "min-h-[60px] items-start whitespace-pre-wrap py-2")}>
                {productDescriptionHouse || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
          </div>

          <div className="space-y-1.5">
            <FieldRow label="Price Each">
              <div className={fieldBoxClass}>
                {priceEach || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Commission %">
              <div className={fieldBoxClass}>
                {product.commissionPercent !== null && product.commissionPercent !== undefined
                  ? `${product.commissionPercent}%`
                  : <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Revenue Type">
              <div className={fieldBoxClass}>
                {revenueTypeLabel || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Status">
              <div className={fieldBoxClass}>
                {statusBadge}
              </div>
            </FieldRow>
            <FieldRow label="Vendor Name">
              {product.vendor ? (
                <Link href={`/accounts/${product.vendor.id}`} className="w-full max-w-md">
                  <div
                    className={cn(
                      fieldBoxClass,
                      "cursor-pointer text-primary-700 hover:border-primary-500 hover:text-primary-800"
                    )}
                  >
                    <span className="truncate">{product.vendor.accountName}</span>
                  </div>
                </Link>
              ) : (
                <div className={fieldBoxClass}>
                  <span className="text-gray-500">--</span>
                </div>
              )}
            </FieldRow>
            <FieldRow label="Distributor Name">
              {product.distributor ? (
                <Link href={`/accounts/${product.distributor.id}`} className="w-full max-w-md">
                  <div
                    className={cn(
                      fieldBoxClass,
                      "cursor-pointer text-primary-700 hover:border-primary-500 hover:text-primary-800"
                    )}
                  >
                    <span className="truncate">{product.distributor.accountName}</span>
                  </div>
                </Link>
              ) : (
                <div className={fieldBoxClass}>
                  <span className="text-gray-500">--</span>
                </div>
              )}
            </FieldRow>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 border-x border-gray-200 bg-gray-100 px-2 pb-0 pt-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
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

      {/* Tab Content */}
      {activeTab === "distributor" && (
        <div className="rounded-b-2xl border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white p-4">
          <div className="space-y-1.5">
            <FieldRow label="Distributor - Product Name">
              <div className={fieldBoxClass}>
                {product.productNameDistributor || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Distributor - Part Number">
              <div className={fieldBoxClass}>
                {product.partNumberDistributor || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Distributor - Product Family">
              <div className={fieldBoxClass}>
                {product.distributorProductFamily || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Distributor - Product Subtype">
              <div className={fieldBoxClass}>
                <span className="text-gray-500">--</span>
              </div>
            </FieldRow>
            <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
              <span className={cn(fieldLabelClass, "pt-1.5")}>Distributor - Description</span>
              <div className={cn(fieldBoxClass, "min-h-[80px] items-start whitespace-pre-wrap py-2")}>
                {product.productDescriptionDistributor || <span className="text-gray-500">--</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "vendor" && (
        <div className="rounded-b-2xl border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white p-4">
          <div className="space-y-1.5">
            <FieldRow label="Vendor - Product Name">
              <div className={fieldBoxClass}>
                {product.productNameVendor || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Vendor - Part Number">
              <div className={fieldBoxClass}>
                {product.partNumberVendor || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Vendor - Product Family">
              <div className={fieldBoxClass}>
                {product.productFamilyVendor || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="Vendor - Product Subtype">
              <div className={fieldBoxClass}>
                {product.productSubtypeVendor || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
              <span className={cn(fieldLabelClass, "pt-1.5")}>Vendor - Description</span>
              <div className={cn(fieldBoxClass, "min-h-[80px] items-start whitespace-pre-wrap py-2")}>
                {product.productDescriptionVendor || <span className="text-gray-500">--</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface EditableProductHeaderProps {
  product: ProductDetailRecord
  editor: EntityEditor<ProductInlineForm>
  onSave: () => Promise<void>
  activeTab: TabKey
  onTabSelect: (tab: TabKey) => void
}

function EditableProductHeader({ product, editor, onSave, activeTab, onTabSelect }: EditableProductHeaderProps) {
  const activeField = editor.register("active")
  const nameField = editor.register("productNameHouse")
  const vendorNameField = editor.register("productNameVendor")
  const codeField = editor.register("productCode")
  const familyHouseField = editor.register("productFamilyHouse")
  const revenueTypeField = editor.register("revenueType")
  const priceField = editor.register("priceEach")
  const commissionField = editor.register("commissionPercent")
  const descriptionField = editor.register("description")
  const partNumberVendorField = editor.register("partNumberVendor")
  const familyVendorField = editor.register("productFamilyVendor")
  const subtypeVendorField = editor.register("productSubtypeVendor")
  const nameDistributorField = editor.register("productNameDistributor")
  const partNumberDistributorField = editor.register("partNumberDistributor")
  const familyDistributorField = editor.register("distributorProductFamily")
  const descVendorField = editor.register("productDescriptionVendor")
  const descDistributorField = editor.register("productDescriptionDistributor")
  const vendorAccountField = editor.register("vendorAccountId")
  const distributorAccountField = editor.register("distributorAccountId")

  type AccountOption = { value: string; label: string; accountTypeName?: string }
  const [vendorOptions, setVendorOptions] = useState<AccountOption[]>([])
  const [distributorOptions, setDistributorOptions] = useState<AccountOption[]>([])

  useEffect(() => {
    const fromWindow: { vendors?: AccountOption[]; distributors?: AccountOption[] } | undefined =
      typeof window !== "undefined" ? (window as any).__productAccountOptions : undefined
    if (fromWindow && (fromWindow.vendors?.length || fromWindow.distributors?.length)) {
      setVendorOptions(fromWindow.vendors || [])
      setDistributorOptions(fromWindow.distributors || [])
      return
    }
    ;(async () => {
      try {
        const res = await fetch('/api/contacts/options', { cache: 'no-store' })
        const payload = await res.json().catch(() => null)
        const accounts: AccountOption[] = Array.isArray(payload?.accounts) ? payload.accounts : []
        const vendors = accounts.filter(a => (a.accountTypeName || '').toLowerCase().includes('vendor'))
        const distributors = accounts.filter(a => (a.accountTypeName || '').toLowerCase().includes('distributor'))
        setVendorOptions(vendors)
        setDistributorOptions(distributors)
      } catch {}
    })()
  }, [])

  const isActive = Boolean(activeField.value)
  const productName = (nameField.value as string) || product.productNameVendor || "Product"
  const disableSave = editor.saving || !editor.isDirty

  const statusBadge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
      )}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  )

  const renderRow = (label: string, control: ReactNode, error?: string) => (
    <FieldRow label={label}>
      <div className="flex w-full max-w-md flex-col gap-1">
        {control}
        {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      </div>
    </FieldRow>
  )

  return (
    <div className="flex flex-col gap-0">
      {/* Header Section */}
      <div className="rounded-t-2xl bg-gray-100 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Product Detail</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{productName}</h1>
              {statusBadge}
              {editor.isDirty ? (
                <span className="text-xs font-semibold text-amber-600">Unsaved changes</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={disableSave}
              className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editor.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}
              <span>Update</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-1.5">
            {renderRow(
              "Product Name - House",
              <EditableField.Input
                value={(nameField.value as string) ?? ""}
                onChange={nameField.onChange}
                onBlur={nameField.onBlur}
                placeholder="Enter product name"
              />,
              editor.errors.productNameHouse
            )}

            {renderRow(
              "Part Number - House",
              <EditableField.Input
                value={(codeField.value as string) ?? ""}
                onChange={codeField.onChange}
                onBlur={codeField.onBlur}
                placeholder="Enter part #"
              />,
              editor.errors.productCode
            )}

            {renderRow(
              "Product Family - House",
              <EditableField.Input
                value={(familyHouseField?.value as string) ?? ""}
                onChange={familyHouseField.onChange}
                onBlur={familyHouseField.onBlur}
                placeholder="Enter family"
              />
            )}

            {renderRow(
              "House - Product Subtype",
              <EditableField.Input
                value=""
                onChange={() => {}}
                onBlur={() => {}}
                placeholder="Enter house subtype"
                disabled
              />
            )}

            {renderRow(
              "House - Description",
              <EditableField.Textarea
                rows={3}
                value={(descriptionField.value as string) ?? ""}
                onChange={descriptionField.onChange}
                onBlur={descriptionField.onBlur}
                placeholder="Add description"
              />
            )}
          </div>

          <div className="space-y-1.5">
            {renderRow(
              "Price Each",
              <EditableField.Input
                type="number"
                step="0.01"
                min="0"
                value={(priceField.value as string) ?? ""}
                onChange={priceField.onChange}
                onBlur={priceField.onBlur}
                placeholder="0.00"
              />,
              editor.errors.priceEach
            )}

            {renderRow(
              "Commission %",
              <EditableField.Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={(commissionField.value as string) ?? ""}
                onChange={commissionField.onChange}
                onBlur={commissionField.onBlur}
                placeholder="Enter %"
              />,
              editor.errors.commissionPercent
            )}

            {renderRow(
              "Revenue Type",
              <EditableField.Select
                value={(revenueTypeField.value as string) ?? ""}
                onChange={revenueTypeField.onChange}
                onBlur={revenueTypeField.onBlur}
              >
                <option value="">Select revenue type</option>
                {REVENUE_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </EditableField.Select>,
              editor.errors.revenueType
            )}

            {renderRow(
              "Status",
              <div className="flex min-h-[28px] items-center gap-3">
                <EditableField.Switch
                  checked={Boolean(activeField.value)}
                  onChange={activeField.onChange}
                  onBlur={activeField.onBlur}
                />
                <span className="text-xs font-semibold text-gray-700">{Boolean(activeField.value) ? "Active" : "Inactive"}</span>
              </div>
            )}

            {renderRow(
              "Vendor Name",
              <EditableField.Select
                value={(vendorAccountField.value as string) ?? ""}
                onChange={vendorAccountField.onChange}
                onBlur={vendorAccountField.onBlur}
              >
                <option value="">Select vendor</option>
                {vendorOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </EditableField.Select>
            )}

            {renderRow(
              "Distributor Name",
              <EditableField.Select
                value={(distributorAccountField.value as string) ?? ""}
                onChange={distributorAccountField.onChange}
                onBlur={distributorAccountField.onBlur}
              >
                <option value="">Select distributor</option>
                {distributorOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </EditableField.Select>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 border-x border-gray-200 bg-gray-100 px-2 pb-0 pt-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
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

      {/* Tab Content */}
      {activeTab === "distributor" && (
        <div className="rounded-b-2xl border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white p-4">
          <div className="space-y-1.5">
            {renderRow(
              "Distributor - Product Name",
              <EditableField.Input
                value={(nameDistributorField?.value as string) ?? ""}
                onChange={nameDistributorField.onChange}
                onBlur={nameDistributorField.onBlur}
                placeholder="Enter distributor product name"
              />
            )}

            {renderRow(
              "Distributor - Part Number",
              <EditableField.Input
                value={(partNumberDistributorField?.value as string) ?? ""}
                onChange={partNumberDistributorField.onChange}
                onBlur={partNumberDistributorField.onBlur}
                placeholder="Enter distributor part #"
              />
            )}

            {renderRow(
              "Distributor - Product Family",
              <EditableField.Input
                value={(familyDistributorField?.value as string) ?? ""}
                onChange={familyDistributorField.onChange}
                onBlur={familyDistributorField.onBlur}
                placeholder="Enter distributor family"
              />
            )}

            {renderRow(
              "Distributor - Product Subtype",
              <EditableField.Input
                value=""
                onChange={() => {}}
                onBlur={() => {}}
                placeholder="Enter distributor subtype"
                disabled
              />
            )}

            {renderRow(
              "Distributor - Description",
              <EditableField.Textarea
                rows={3}
                value={(descDistributorField?.value as string) ?? ""}
                onChange={descDistributorField.onChange}
                onBlur={descDistributorField.onBlur}
                placeholder="Add distributor description"
              />
            )}
          </div>
        </div>
      )}

      {activeTab === "vendor" && (
        <div className="rounded-b-2xl border-x border-b border-t-2 border-t-primary-600 border-gray-200 bg-white p-4">
          <div className="space-y-1.5">
            {renderRow(
              "Vendor - Product Name",
              <EditableField.Input
                value={(vendorNameField.value as string) ?? ""}
                onChange={vendorNameField.onChange}
                onBlur={vendorNameField.onBlur}
                placeholder="Enter vendor product name"
              />
            )}

            {renderRow(
              "Vendor - Part Number",
              <EditableField.Input
                value={(partNumberVendorField?.value as string) ?? ""}
                onChange={partNumberVendorField.onChange}
                onBlur={partNumberVendorField.onBlur}
                placeholder="Enter vendor part #"
              />
            )}

            {renderRow(
              "Vendor - Product Family",
              <EditableField.Input
                value={(familyVendorField?.value as string) ?? ""}
                onChange={familyVendorField.onChange}
                onBlur={familyVendorField.onBlur}
                placeholder="Enter vendor family"
              />
            )}

            {renderRow(
              "Vendor - Product Subtype",
              <EditableField.Input
                value={(subtypeVendorField?.value as string) ?? ""}
                onChange={subtypeVendorField.onChange}
                onBlur={subtypeVendorField.onBlur}
                placeholder="Enter vendor subtype"
              />
            )}

            {renderRow(
              "Vendor - Description",
              <EditableField.Textarea
                rows={3}
                value={(descVendorField?.value as string) ?? ""}
                onChange={descVendorField.onChange}
                onBlur={descVendorField.onBlur}
                placeholder="Add vendor description"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export function ProductDetailsView({
  product,
  loading,
  error,
  onEdit,
  onRefresh
}: ProductDetailsViewProps) {
  // Inline editing is enabled for all authenticated users per requirements
  const { showError, showSuccess } = useToasts()
  const shouldEnableInline = Boolean(product)
  const [activeTab, setActiveTab] = useState<TabKey>("distributor")
  
  // Lightweight options loader for vendor/distributor (uses contacts options endpoint)
  if (typeof window !== 'undefined' && !(window as any).__productAccountOptionsLoaded) {
    ;(async () => {
      try {
        const res = await fetch('/api/contacts/options', { cache: 'no-store' })
        const payload = await res.json().catch(() => null)
        const accounts: Array<{ value: string; label: string; accountTypeName?: string }> = Array.isArray(payload?.accounts)
          ? payload.accounts
          : []
        const vendors = accounts.filter(a => (a.accountTypeName || '').toLowerCase().includes('vendor'))
        const distributors = accounts.filter(a => (a.accountTypeName || '').toLowerCase().includes('distributor'))
        ;(window as any).__productAccountOptions = { vendors, distributors }
        ;(window as any).__productAccountOptionsLoaded = true
      } catch {}
    })()
  }

  const inlineInitialForm = useMemo(
    () => (shouldEnableInline ? createProductInlineForm(product) : null),
    [shouldEnableInline, product]
  )

  const submitProduct = useCallback(
    async (patch: Partial<ProductInlineForm>, draft: ProductInlineForm) => {
      if (!product?.id) {
        throw new Error("Product ID is required")
      }

      const payload = buildProductPayload(patch, draft)
      if (Object.keys(payload).length === 0) {
        return draft
      }

      try {
        const response = await fetch(`/api/products/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })

        const body = await response.json().catch(() => null)
        if (!response.ok) {
          const message = body?.error ?? "Failed to update product"
          const serverErrors = (body?.errors ?? {}) as Record<string, string>
          const error = new Error(message) as Error & { serverErrors?: Record<string, string> }
          if (serverErrors && Object.keys(serverErrors).length > 0) {
            error.serverErrors = serverErrors
          }
          throw error
        }

        showSuccess("Product updated", "Changes saved.")
        await onRefresh?.()
        return draft
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update product"
        showError("Failed to update product", message)
        throw err
      }
    },
    [product?.id, onRefresh, showError, showSuccess]
  )

  const editor = useEntityEditor<ProductInlineForm>({
    initial: inlineInitialForm,
    validate: shouldEnableInline ? validateProductForm : undefined,
    onSubmit: shouldEnableInline ? submitProduct : undefined
  })

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

  const handleTabSelect = useCallback((tab: TabKey) => {
    if (tab === activeTab) return
    // Optional: Add unsaved changes warning if needed
    setActiveTab(tab)
  }, [activeTab])

  const headerNode = useMemo(() => {
    if (!product) return null
    if (shouldEnableInline) {
      return (
        <EditableProductHeader
          product={product}
          editor={editor}
          onSave={handleSaveInline}
          activeTab={activeTab}
          onTabSelect={handleTabSelect}
        />
      )
    }
    return <ProductHeader product={product} onEdit={onEdit} activeTab={activeTab} onTabSelect={handleTabSelect} />
  }, [product, shouldEnableInline, editor, handleSaveInline, onEdit, activeTab, handleTabSelect])

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-sm text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        Loading product details...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700">
        <p className="text-base font-semibold text-rose-800">Unable to load product details</p>
        <p>{error}</p>
        {onRefresh ? (
          <button
            type="button"
            onClick={() => onRefresh()}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Try again
          </button>
        ) : null}
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        <p className="text-base font-semibold text-gray-900">Product not found</p>
        <p>This record may have been removed or you might not have access to view it.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full">
        {headerNode}

        {/* Removed Audit Information and Identifiers per request */}
      </div>
    </div>
  )
}

