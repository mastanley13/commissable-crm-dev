"use client"

import Link from "next/link"
import { ReactNode, useCallback, useMemo, useEffect, useState } from "react"
import { Edit, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { sortByPicklistName } from "@/lib/picklist-sort"
import { EditableField } from "./editable-field"
import { useToasts } from "./toast"
import { useEntityEditor, type EntityEditor } from "@/hooks/useEntityEditor"
import { useAuth } from "@/lib/auth-context"
import { getRevenueTypeLabel, REVENUE_TYPE_OPTIONS } from "@/lib/revenue-types"
import { AuditHistoryTab } from "./audit-history-tab"
import { PicklistCombobox } from "./picklist-combobox"
import { SelectCombobox } from "./select-combobox"
import { TabDescription } from "@/components/section/TabDescription"
import type { HistoryRow } from "./opportunity-types"

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
  productSubtypeHouse?: string | null
  productFamilyVendor?: string | null
  productSubtypeVendor?: string | null
  productNameDistributor?: string | null
  productNameOther?: string | null
  partNumberVendor?: string | null
  partNumberDistributor?: string | null
  partNumberOther?: string | null
  distributorProductFamily?: string | null
  distributorProductSubtype?: string | null
  productDescriptionDistributor?: string | null
  productDescriptionVendor?: string | null
  productDescriptionOther?: string | null
  otherSource?: "Vendor" | "Distributor" | null
  productDescriptionHouse?: string | null
  usage?: {
    opportunities: ProductOpportunityUsage[]
    revenueSchedules: ProductRevenueSchedule[]
  }
  auditLog?: ProductAuditLogEntry[]
}

type TabKey = "vendor" | "history"

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
  productSubtypeHouse: string
  productFamilyVendor: string
  productSubtypeVendor: string
  productNameDistributor: string
  partNumberVendor: string
  partNumberDistributor: string
  distributorProductFamily: string
  distributorProductSubtype: string
  productDescriptionVendor: string
  productDescriptionDistributor: string
  vendorAccountId: string
  distributorAccountId: string
}

type ProductFamilyPicklistOption = { id: string; name: string }
type ProductSubtypePicklistOption = {
  id: string
  name: string
  productFamilyId: string | null
  familyName: string | null
}

function getAllowedSubtypesForFamilyName(
  subtypes: ProductSubtypePicklistOption[],
  familyIdByName: Map<string, string>,
  familyName: string
): string[] {
  const trimmedFamily = familyName.trim()
  const familyId = trimmedFamily.length > 0 ? (familyIdByName.get(trimmedFamily) ?? null) : null
  return subtypes
    .filter((subtype) => familyId == null || subtype.productFamilyId == null || subtype.productFamilyId === familyId)
    .map((subtype) => subtype.name)
}

const TABS: { id: TabKey; label: string }[] = [
  { id: "vendor", label: "Other" },
  { id: "history", label: "History" }
]

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  vendor: "This section displays Other product information (Vendor-first, fallback to Distributor) including product name, part number, and description.",
  history: "This section shows a complete audit log of all changes made to this product, including who made each change and when. Use the restore functionality to revert to previous versions if needed."
}

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
    productSubtypeHouse: product.productSubtypeHouse ?? "",
    productFamilyVendor: product.productFamilyVendor ?? "",
    productSubtypeVendor: product.productSubtypeVendor ?? "",
    productNameDistributor: product.productNameDistributor ?? "",
    partNumberVendor: product.partNumberVendor ?? "",
    partNumberDistributor: product.partNumberDistributor ?? "",
    distributorProductFamily: product.distributorProductFamily ?? "",
    distributorProductSubtype: product.distributorProductSubtype ?? "",
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
  if ("productSubtypeHouse" in patch) {
    const value = draft.productSubtypeHouse.trim()
    payload.productSubtypeHouse = value.length > 0 ? value : null
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
  if ("distributorProductSubtype" in patch) {
    const value = draft.distributorProductSubtype.trim()
    payload.distributorProductSubtype = value.length > 0 ? value : null
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

interface ProductHeaderProps {
  product: ProductDetailRecord
  onEdit?: (() => void) | null | undefined
  activeTab: TabKey
  onTabSelect: (tab: TabKey) => void
}

function ProductHeader({ product, onEdit, activeTab, onTabSelect }: ProductHeaderProps) {
  const productName = product.productNameHouse || product.productNameVendor || "Product"
  const priceEach = formatCurrency(product.priceEach)
  const commissionRate = formatPercent(product.commissionPercent)
  const revenueTypeLabel = getRevenueTypeLabel(product.revenueType) ?? product.revenueType
  const productDescriptionHouse = product.productDescriptionHouse ?? product.description ?? null
  const statusBadge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
        product.isActive
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-gray-100 text-gray-600 border-gray-300"
      )}
    >
      {product.isActive ? "Active" : "Inactive"}
    </span>
  )

  return (
    <div className="flex flex-col gap-0">
      {/* Header Section */}
      <div className="rounded-t-2xl bg-gray-100 p-3 shadow-sm h-[300px] overflow-y-auto">
        <div className="mb-2 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">Product Detail</p>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{productName}</h1>
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
            <FieldRow label="House - Product Name">
              <div className={fieldBoxClass}>
                {product.productNameHouse || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="House - Part Number">
              <div className={fieldBoxClass}>
                {product.productCode || <span className="text-gray-500">--</span>}
              </div>
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
            <FieldRow label="House - Product Family">
              <div className={fieldBoxClass}>
                {product.productFamilyHouse || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
            <FieldRow label="House - Product Subtype">
              <div className={fieldBoxClass}>
                {product.productSubtypeHouse || <span className="text-gray-500">--</span>}
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
                {commissionRate || <span className="text-gray-500">--</span>}
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
            <FieldRow label="House - Description">
              <div className={cn(fieldBoxClass, "min-h-[60px] items-start whitespace-pre-wrap py-2")}>
                {productDescriptionHouse || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 border-x border-gray-200 bg-gray-100 px-3 pb-0 pt-2">
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
      {activeTab === "vendor" && (
        <div className="rounded-b-2xl border-x border-b border-gray-200 bg-white pt-0 px-3 pb-4">
          <div className="border-t-2 border-t-primary-600 -mr-3 pt-3">
            <TabDescription>{TAB_DESCRIPTIONS.vendor}</TabDescription>
            <div className="space-y-1.5">
            <FieldRow label="Other - Product Name">
              <div className={fieldBoxClass}>
                {product.productNameOther || product.productNameVendor || product.productNameDistributor || <span className="text-gray-500">--</span>}
              </div>
            </FieldRow>
             <FieldRow label="Other - Part Number">
               <div className={fieldBoxClass}>
                 {product.partNumberOther || product.partNumberVendor || product.partNumberDistributor || <span className="text-gray-500">--</span>}
               </div>
             </FieldRow>
             <FieldRow label="Other - Source">
               <div className={fieldBoxClass}>
                 {product.otherSource ||
                   (product.productNameVendor || product.partNumberVendor || product.productDescriptionVendor
                     ? "Vendor"
                     : product.productNameDistributor || product.partNumberDistributor || product.productDescriptionDistributor
                       ? "Distributor"
                       : null) || <span className="text-gray-500">--</span>}
               </div>
             </FieldRow>
             <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
               <span className={cn(fieldLabelClass, "pt-1.5")}>Other - Product Description</span>
               <div className={cn(fieldBoxClass, "min-h-[80px] items-start whitespace-pre-wrap py-2")}>
                 {product.productDescriptionOther || product.productDescriptionVendor || product.productDescriptionDistributor || <span className="text-gray-500">--</span>}
               </div>
             </div>
          </div>
          </div>
        </div>
      )}
      {activeTab === "history" && (
        <div className="rounded-b-2xl border-x border-b border-gray-200 bg-white pt-0 px-3 pb-4">
          <div className="border-t-2 border-t-primary-600 -mr-3 pt-3">
            <AuditHistoryTab entityName="Product" entityId={product.id} description={TAB_DESCRIPTIONS.history} />
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
  onRefresh?: () => Promise<void> | void
  activeTab: TabKey
  onTabSelect: (tab: TabKey) => void
}

  function EditableProductHeader({ product, editor, onSave, onRefresh, activeTab, onTabSelect }: EditableProductHeaderProps) {
    const activeField = editor.register("active")
    const nameField = editor.register("productNameHouse")
    const vendorNameField = editor.register("productNameVendor")
    const codeField = editor.register("productCode")
    const familyHouseField = editor.register("productFamilyHouse")
    const subtypeHouseField = editor.register("productSubtypeHouse")
  const revenueTypeField = editor.register("revenueType")
  const priceField = editor.register("priceEach")
  const commissionField = editor.register("commissionPercent")
  const descriptionField = editor.register("description")
    const partNumberVendorField = editor.register("partNumberVendor")
    const familyVendorField = editor.register("productFamilyVendor")
    const subtypeVendorField = editor.register("productSubtypeVendor")
  const descVendorField = editor.register("productDescriptionVendor")
   const vendorAccountField = editor.register("vendorAccountId")
   const distributorAccountField = editor.register("distributorAccountId")
   const [historyReloadToken, setHistoryReloadToken] = useState(0)

   const handleUndoAutoFill = useCallback(async (row: HistoryRow) => {
     const undoableFields = new Set(["productNameVendor", "partNumberVendor"])
     if (!undoableFields.has(row.field)) return
     if (String(row.action ?? "").toLowerCase() !== "update") return

     const auditLogId = String(row.id ?? "").slice(0, 36)
     if (!auditLogId) return

     const confirmed = window.confirm("Undo this auto-filled value? This will revert the field(s) back to their prior value.")
     if (!confirmed) return

     try {
       const response = await fetch(`/api/audit-logs/${encodeURIComponent(auditLogId)}/undo`, {
         method: "POST",
       })
       const payload = await response.json().catch(() => null)
       if (!response.ok) {
         const message = payload?.error ?? "Undo failed"
         throw new Error(message)
       }

       setHistoryReloadToken(value => value + 1)
       await onRefresh?.()
     } catch (error) {
       const message = error instanceof Error ? error.message : "Undo failed"
       window.alert(message)
     }
   }, [onRefresh])

   const historyRowActionRenderer = useCallback((row: HistoryRow) => {
     const undoableFields = new Set(["productNameVendor", "partNumberVendor"])
     if (!undoableFields.has(row.field)) return null
     if (String(row.action ?? "").toLowerCase() !== "update") return null

     return (
       <button
         type="button"
         className="text-blue-700 hover:underline text-[11px] font-semibold"
         onClick={() => void handleUndoAutoFill(row)}
       >
         Undo
       </button>
     )
   }, [handleUndoAutoFill])

  type AccountOption = { value: string; label: string; accountTypeName?: string }
  const [vendorOptions, setVendorOptions] = useState<AccountOption[]>([])
  const [distributorOptions, setDistributorOptions] = useState<AccountOption[]>([])
  const [productFamilies, setProductFamilies] = useState<ProductFamilyPicklistOption[]>([])
  const [productSubtypes, setProductSubtypes] = useState<ProductSubtypePicklistOption[]>([])
  const [revenueTypeOptions, setRevenueTypeOptions] = useState<{ value: string; label: string }[]>(REVENUE_TYPE_OPTIONS)
  const [picklistError, setPicklistError] = useState<string | null>(null)

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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/products/master-data", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load product picklists")
        const payload = await res.json().catch(() => null)
        if (cancelled) return

        const families: ProductFamilyPicklistOption[] = Array.isArray(payload?.families)
          ? payload.families
              .map((f: any): ProductFamilyPicklistOption => ({
                id: String(f.id),
                name: String(f.name ?? "").trim()
              }))
              .filter((f: ProductFamilyPicklistOption) => f.name.length > 0)
          : []

        const subtypes: ProductSubtypePicklistOption[] = Array.isArray(payload?.subtypes)
          ? payload.subtypes
              .map((s: any): ProductSubtypePicklistOption => ({
                id: String(s.id),
                name: String(s.name ?? "").trim(),
                productFamilyId: s.productFamilyId ? String(s.productFamilyId) : null,
                familyName: s.familyName ? String(s.familyName) : null
              }))
              .filter((s: ProductSubtypePicklistOption) => s.name.length > 0)
          : []

        setProductFamilies(sortByPicklistName(families))
        setProductSubtypes(sortByPicklistName(subtypes))
        setPicklistError(null)
      } catch (error) {
        if (!cancelled) {
          setPicklistError(error instanceof Error ? error.message : "Failed to load product picklists")
          setProductFamilies([])
          setProductSubtypes([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/products/options", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load revenue types")
        const payload = await res.json().catch(() => null)
        if (cancelled) return
        const types = Array.isArray(payload?.revenueTypes)
          ? payload.revenueTypes
          : Array.isArray(payload?.data?.revenueTypes)
            ? payload.data.revenueTypes
            : []
        const normalized = types.map((t: any) => ({ value: String(t.value ?? t), label: String(t.label ?? t) }))
        if (normalized.length > 0) {
          setRevenueTypeOptions(normalized)
        }
      } catch {
        // keep defaults
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const familyIdByName = useMemo(
    () => new Map(productFamilies.map((family) => [family.name, family.id] as const)),
    [productFamilies]
  )

  const familyPicklistNames = useMemo(() => productFamilies.map((f) => f.name), [productFamilies])

  const houseFamilyValue = String(familyHouseField.value ?? "").trim()
  const houseSubtypeValue = String(subtypeHouseField.value ?? "").trim()
  const vendorFamilyValue = String(familyVendorField.value ?? "").trim()
  const vendorSubtypeValue = String(subtypeVendorField.value ?? "").trim()

  const houseSubtypePicklistNames = useMemo(
    () => getAllowedSubtypesForFamilyName(productSubtypes, familyIdByName, houseFamilyValue),
    [productSubtypes, familyIdByName, houseFamilyValue]
  )

  const vendorSubtypePicklistNames = useMemo(
    () => getAllowedSubtypesForFamilyName(productSubtypes, familyIdByName, vendorFamilyValue),
    [productSubtypes, familyIdByName, vendorFamilyValue]
  )

  const isActive = Boolean(activeField.value)
  const productName = (nameField.value as string) || product.productNameOther || product.productNameVendor || product.productNameDistributor || "Product"
  const disableSave = editor.saving || !editor.isDirty

  const renderRow = (label: string, control: ReactNode, error?: string) => (
    <FieldRow label={label}>
      <div className="flex w-full max-w-md flex-col gap-1">
        {control}
        {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      </div>
    </FieldRow>
  )

  const picklistInputCls =
    "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
  const dropdownCls =
    "absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
  const optionBtnCls = "w-full px-3 py-2 text-left text-sm hover:bg-primary-50"

  return (
    <div className="flex flex-col gap-0">
      {/* Header Section */}
      <div className="rounded-t-2xl bg-gray-100 p-3 shadow-sm h-[300px] overflow-y-auto">
        <div className="mb-2 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">Product Detail</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{productName}</h1>
              {editor.isDirty ? (
                <span className="text-xs font-semibold text-amber-600">Unsaved changes</span>
              ) : null}
            </div>
            {picklistError ? (
              <p className="text-[11px] text-rose-700">
                Unable to load Product Family/Subtype picklists from Data Settings. Dropdowns may be incomplete.
              </p>
            ) : null}
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
              "House - Product Name",
              <EditableField.Input
                value={(nameField.value as string) ?? ""}
                onChange={nameField.onChange}
                onBlur={nameField.onBlur}
                placeholder="Enter product name"
              />,
              editor.errors.productNameHouse
            )}

            {renderRow(
              "House - Part Number",
              <EditableField.Input
                value={(codeField.value as string) ?? ""}
                onChange={codeField.onChange}
                onBlur={codeField.onBlur}
                placeholder="Enter part #"
              />,
              editor.errors.productCode
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
              "House - Product Family",
              <PicklistCombobox
                value={houseFamilyValue}
                options={familyPicklistNames}
                placeholder="Search or pick a family"
                disabled={familyPicklistNames.length === 0 && !houseFamilyValue}
                inputClassName={picklistInputCls}
                dropdownClassName={dropdownCls}
                optionClassName={optionBtnCls}
                onBlur={familyHouseField.onBlur}
                onChange={(nextFamily) => {
                  editor.setField("productFamilyHouse", nextFamily)
                  const allowedSubtypes = getAllowedSubtypesForFamilyName(
                    productSubtypes,
                    familyIdByName,
                    nextFamily
                  )
                  if (houseSubtypeValue && !allowedSubtypes.includes(houseSubtypeValue)) {
                    editor.setField("productSubtypeHouse", "")
                  }
                  if (!nextFamily) {
                    editor.setField("productSubtypeHouse", "")
                  }
                }}
              />,
              editor.errors.productFamilyHouse
            )}

            {renderRow(
              "House - Product Subtype",
              <PicklistCombobox
                value={houseSubtypeValue}
                options={houseSubtypePicklistNames}
                placeholder="Search or pick a subtype"
                disabled={!houseFamilyValue || (houseSubtypePicklistNames.length === 0 && !houseSubtypeValue)}
                inputClassName={picklistInputCls}
                dropdownClassName={dropdownCls}
                optionClassName={optionBtnCls}
                onBlur={subtypeHouseField.onBlur}
                onChange={(nextSubtype) => editor.setField("productSubtypeHouse", nextSubtype)}
              />,
              editor.errors.productSubtypeHouse
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
              <SelectCombobox
                value={(revenueTypeField.value as string) ?? ""}
                options={revenueTypeOptions}
                placeholder="Select revenue type"
                disabled={revenueTypeOptions.length === 0}
                inputClassName={picklistInputCls}
                dropdownClassName={dropdownCls}
                optionClassName={optionBtnCls}
                onBlur={revenueTypeField.onBlur}
                onChange={(next) => editor.setField("revenueType", next)}
              />,
              editor.errors.revenueType
            )}

            {renderRow(
              "Status",
              <div className="flex min-h-[28px] items-center gap-3">
                <EditableField.Switch
                  checked={isActive}
                  onChange={activeField.onChange}
                  onBlur={activeField.onBlur}
                />
                <span className="text-xs font-semibold text-gray-700">{isActive ? "Active" : "Inactive"}</span>
              </div>
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
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 border-x border-gray-200 bg-gray-100 px-3 pb-0 pt-2">
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
      {activeTab === "vendor" && (
        <div className="rounded-b-2xl border-x border-b border-gray-200 bg-white pt-0 px-3 pb-4">
          <div className="border-t-2 border-t-primary-600 -mr-3 pt-3">
            <TabDescription>{TAB_DESCRIPTIONS.vendor}</TabDescription>
            <div className="space-y-1.5">
            {renderRow(
              "Other - Product Name",
              <EditableField.Input
                value={(vendorNameField.value as string) ?? ""}
                onChange={vendorNameField.onChange}
                onBlur={vendorNameField.onBlur}
                placeholder="Cable Services, Cable Services (Legacy Name)"
              />
            )}

            {renderRow(
              "Other - Part Number",
              <EditableField.Input
                value={(partNumberVendorField?.value as string) ?? ""}
                onChange={partNumberVendorField.onChange}
                onBlur={partNumberVendorField.onBlur}
                placeholder="PN-123, PN 124"
              />
            )}

            {renderRow(
              "Other - Product Description",
              <EditableField.Textarea
                rows={3}
                value={(descVendorField?.value as string) ?? ""}
                onChange={descVendorField.onChange}
                onBlur={descVendorField.onBlur}
                placeholder="Add other description"
              />
            )}
          </div>
          </div>
        </div>
      )}
      {activeTab === "history" && product && (
        <AuditHistoryTab
          entityName="Product"
          entityId={product.id}
          description={TAB_DESCRIPTIONS.history}
          rowActionLabel="Undo"
          rowActionRenderer={historyRowActionRenderer}
          reloadToken={historyReloadToken}
        />
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
  const { showError, showSuccess } = useToasts()
  const { user } = useAuth()
  const roleCode = user?.role?.code?.toLowerCase() ?? ""
  const canEditProduct = roleCode === "admin" || roleCode.includes("admin")
  const shouldEnableInline = Boolean(product) && canEditProduct
  const [activeTab, setActiveTab] = useState<TabKey>("vendor")
  
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
          onRefresh={onRefresh}
          activeTab={activeTab}
          onTabSelect={handleTabSelect}
        />
      )
    }
    return <ProductHeader product={product} onEdit={onEdit} activeTab={activeTab} onTabSelect={handleTabSelect} />
  }, [product, shouldEnableInline, editor, handleSaveInline, onEdit, onRefresh, activeTab, handleTabSelect])

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
    <div className="flex flex-col px-4 sm:px-6 lg:px-8">
      <div className="w-full">
        {headerNode}
        {!canEditProduct ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            Product details are read-only for your role. Contact an Admin to make changes.
          </div>
        ) : null}

        {/* Removed Audit Information and Identifiers per request */}
      </div>
    </div>
  )
}
