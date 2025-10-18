"use client"

import Link from "next/link"
import { ReactNode, useCallback, useMemo } from "react"
import { Edit, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { EditableField } from "./editable-field"
import { useToasts } from "./toast"
import { useEntityEditor, type EntityEditor } from "@/hooks/useEntityEditor"
import { useAuth } from "@/lib/auth-context"
import { isInlineDetailEditEnabled } from "@/lib/featureFlags"

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

interface ProductDetailsViewProps {
  product: ProductDetailRecord | null
  loading?: boolean
  error?: string | null
  onEdit?: () => void
  onRefresh?: () => Promise<void> | void
}

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-wide text-gray-500"
const fieldBoxClass =
  "flex min-h-[28px] w-full max-w-md items-center justify-between rounded-lg border-2 border-gray-400 bg-white px-2 py-0.5 text-xs text-gray-900 shadow-sm whitespace-nowrap overflow-hidden text-ellipsis"

interface ProductInlineForm {
  active: boolean
}

function createProductInlineForm(product: ProductDetailRecord | null | undefined): ProductInlineForm | null {
  if (!product) return null
  return {
    active: Boolean(product.isActive)
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
  return payload
}

function validateProductForm(_form: ProductInlineForm): Record<string, string> {
  return {}
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
}

function ProductHeader({ product, onEdit }: ProductHeaderProps) {
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
  const productDescriptionVendor = product.productDescriptionVendor ?? null

  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
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
          <FieldRow label="Revenue Type">
            <div className={fieldBoxClass}>
              {revenueTypeLabel || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Vendor Name">
            {product.vendor ? (
              <Link href={`/accounts/${product.vendor.id}`}>
                <div className={cn(fieldBoxClass, "cursor-pointer text-primary-700 hover:border-primary-500")}>
                  {product.vendor.accountName}
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
              <Link href={`/accounts/${product.distributor.id}`}>
                <div className={cn(fieldBoxClass, "cursor-pointer text-primary-700 hover:border-primary-500")}>
                  {product.distributor.accountName}
                </div>
              </Link>
            ) : (
              <div className={fieldBoxClass}>
                <span className="text-gray-500">--</span>
              </div>
            )}
          </FieldRow>
          <FieldRow label="Price Each">
            <div className={fieldBoxClass}>
              {priceEach || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Commission">
            <div className={fieldBoxClass}>
              {commissionRate || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Product Name - Vendor">
            <div className={fieldBoxClass}>
              {product.productNameVendor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Part Number - Vendor">
            <div className={fieldBoxClass}>
              {product.partNumberVendor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Product Family - Vendor">
            <div className={fieldBoxClass}>
              {product.productFamilyVendor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Subtype - Vendor">
            <div className={fieldBoxClass}>
              {product.productSubtypeVendor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
        </div>

        <div className="space-y-1.5">
          <FieldRow label="Product Name - Distributor">
            <div className={fieldBoxClass}>
              {product.productNameDistributor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Part Number - Distributor">
            <div className={fieldBoxClass}>
              {product.partNumberDistributor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Distributor Product Family">
            <div className={fieldBoxClass}>
              {product.distributorProductFamily || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
            <span className={cn(fieldLabelClass, "pt-1.5")}>Product Description - House</span>
            <div className={cn(fieldBoxClass, "min-h-[80px] items-start whitespace-pre-wrap py-2")}>
              {productDescriptionHouse || <span className="text-gray-500">--</span>}
            </div>
          </div>
          <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
            <span className={cn(fieldLabelClass, "pt-1.5")}>Product Description - Vendor</span>
            <div className={cn(fieldBoxClass, "min-h-[80px] items-start whitespace-pre-wrap py-2")}>
              {productDescriptionVendor || <span className="text-gray-500">--</span>}
            </div>
          </div>
          <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
            <span className={cn(fieldLabelClass, "pt-1.5")}>Product Description - Distributor</span>
            <div className={cn(fieldBoxClass, "min-h-[80px] items-start whitespace-pre-wrap py-2")}>
              {product.productDescriptionDistributor || <span className="text-gray-500">--</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface EditableProductHeaderProps {
  product: ProductDetailRecord
  editor: EntityEditor<ProductInlineForm>
  onSave: () => Promise<void>
  onCancel: () => void
}

function EditableProductHeader({ product, editor, onSave, onCancel }: EditableProductHeaderProps) {
  const activeField = editor.register("active")
  const isActive = Boolean(activeField.value)
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
  const disableSave = editor.saving || !editor.isDirty
  const productName = product.productNameHouse || product.productNameVendor || "Product"
  const priceEach = formatCurrency(product.priceEach)
  const commissionRate = formatPercent(product.commissionPercent)
  const revenueTypeLabel = humanizeLabel(product.revenueType)
  const productDescriptionHouse = product.productDescriptionHouse ?? product.description ?? null
  const productDescriptionVendor = product.productDescriptionVendor ?? null

  return (
    <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Product Detail</p>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">{productName}</h1>
            {statusBadge}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={editor.saving}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
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
      <p className="mb-3 text-xs text-gray-500">
        Inline editing currently supports toggling the product&apos;s Active status. Additional fields will become
        editable once API support is ready.
      </p>

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
          <FieldRow label="Revenue Type">
            <div className={fieldBoxClass}>
              {revenueTypeLabel || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Status">
            <div className="flex min-h-[28px] items-center gap-3 rounded-lg border-2 border-gray-400 bg-white px-2 py-0.5 text-xs text-gray-900 shadow-sm">
              <EditableField.Switch
                checked={isActive}
                onChange={activeField.onChange}
                onBlur={activeField.onBlur}
              />
              <span className="font-semibold text-gray-700">{isActive ? "Active" : "Inactive"}</span>
            </div>
          </FieldRow>
          <FieldRow label="Vendor Name">
            {product.vendor ? (
              <Link href={`/accounts/${product.vendor.id}`}>
                <div className={cn(fieldBoxClass, "cursor-pointer text-primary-700 hover:border-primary-500")}>
                  {product.vendor.accountName}
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
              <Link href={`/accounts/${product.distributor.id}`}>
                <div className={cn(fieldBoxClass, "cursor-pointer text-primary-700 hover:border-primary-500")}>
                  {product.distributor.accountName}
                </div>
              </Link>
            ) : (
              <div className={fieldBoxClass}>
                <span className="text-gray-500">--</span>
              </div>
            )}
          </FieldRow>
          <FieldRow label="Price Each">
            <div className={fieldBoxClass}>
              {priceEach || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Commission">
            <div className={fieldBoxClass}>
              {commissionRate || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Product Name - Vendor">
            <div className={fieldBoxClass}>
              {product.productNameVendor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Part Number - Vendor">
            <div className={fieldBoxClass}>
              {product.partNumberVendor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Product Family - Vendor">
            <div className={fieldBoxClass}>
              {product.productFamilyVendor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Subtype - Vendor">
            <div className={fieldBoxClass}>
              {product.productSubtypeVendor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
        </div>

        <div className="space-y-1.5">
          <FieldRow label="Product Name - Distributor">
            <div className={fieldBoxClass}>
              {product.productNameDistributor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Part Number - Distributor">
            <div className={fieldBoxClass}>
              {product.partNumberDistributor || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <FieldRow label="Distributor Product Family">
            <div className={fieldBoxClass}>
              {product.distributorProductFamily || <span className="text-gray-500">--</span>}
            </div>
          </FieldRow>
          <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
            <span className={cn(fieldLabelClass, "pt-1.5")}>Product Description - House</span>
            <div className={cn(fieldBoxClass, "min-h-[80px] items-start whitespace-pre-wrap py-2")}>
              {productDescriptionHouse || <span className="text-gray-500">--</span>}
            </div>
          </div>
          <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
            <span className={cn(fieldLabelClass, "pt-1.5")}>Product Description - Vendor</span>
            <div className={cn(fieldBoxClass, "min-h-[80px] items-start whitespace-pre-wrap py-2")}>
              {productDescriptionVendor || <span className="text-gray-500">--</span>}
            </div>
          </div>
          <div className="grid items-start gap-6 sm:grid-cols-[200px,1fr]">
            <span className={cn(fieldLabelClass, "pt-1.5")}>Product Description - Distributor</span>
            <div className={cn(fieldBoxClass, "min-h-[80px] items-start whitespace-pre-wrap py-2")}>
              {product.productDescriptionDistributor || <span className="text-gray-500">--</span>}
            </div>
          </div>
        </div>
      </div>
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
  const { hasPermission } = useAuth()
  const { showError, showSuccess } = useToasts()
  const inlineEnabled = isInlineDetailEditEnabled("products")
  const canMutateProduct =
    hasPermission("products.update") || hasPermission("products.delete") || hasPermission("products.create")
  const shouldEnableInline = inlineEnabled && canMutateProduct && Boolean(product)

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

        showSuccess("Product updated", "Status saved.")
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

  const handleCancelInline = useCallback(() => {
    editor.reset()
    editor.setErrors({})
  }, [editor])

  const headerNode = useMemo(() => {
    if (!product) return null
    if (shouldEnableInline) {
      return (
        <EditableProductHeader
          product={product}
          editor={editor}
          onSave={handleSaveInline}
          onCancel={handleCancelInline}
        />
      )
    }
    return <ProductHeader product={product} onEdit={onEdit} />
  }, [product, shouldEnableInline, editor, handleSaveInline, handleCancelInline, onEdit])

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

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-primary-700">Audit Information</h3>
            <div className="space-y-1.5">
              <FieldRow label="Created By">
                <div className={fieldBoxClass}>
                  {product.createdBy?.name || <span className="text-gray-500">--</span>}
                </div>
              </FieldRow>
              <FieldRow label="Created At">
                <div className={fieldBoxClass}>
                  {formatDate(product.createdAt) || <span className="text-gray-500">--</span>}
                </div>
              </FieldRow>
              <FieldRow label="Updated By">
                <div className={fieldBoxClass}>
                  {product.updatedBy?.name || <span className="text-gray-500">--</span>}
                </div>
              </FieldRow>
              <FieldRow label="Updated At">
                <div className={fieldBoxClass}>
                  {formatDate(product.updatedAt) || <span className="text-gray-500">--</span>}
                </div>
              </FieldRow>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-primary-700">Identifiers</h3>
            <div className="space-y-1.5">
              <FieldRow label="Product Code">
                <div className={fieldBoxClass}>
                  {product.productCode || <span className="text-gray-500">--</span>}
                </div>
              </FieldRow>
              <FieldRow label="Distributor Account #">
                <div className={fieldBoxClass}>
                  {product.distributor?.accountNumber || <span className="text-gray-500">--</span>}
                </div>
              </FieldRow>
              <FieldRow label="Vendor Account #">
                <div className={fieldBoxClass}>
                  {product.vendor?.accountNumber || <span className="text-gray-500">--</span>}
                </div>
              </FieldRow>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
