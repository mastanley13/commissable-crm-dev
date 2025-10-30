"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { useToasts } from "./toast"
import { EditableSwitch } from "./editable-field"

type SelectOption = { value: string; label: string }

interface ProductOptionsPayload {
  accounts: SelectOption[]
  revenueTypes: SelectOption[]
}

interface ProductCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ProductFormState {
  isActive: boolean
  distributorAccountId: string
  vendorAccountId: string
  productFamilyVendor: string
  productSubtypeVendor: string
  productNameVendor: string
  productCode: string
  productDescriptionVendor: string
  revenueType: string
  priceEach: string
  commissionPercent: string
  productNameHouse: string
  partNumberHouse: string
  description: string
  partNumberDistributor: string
  distributorProductFamily: string
  productDescriptionDistributor: string
}

const INITIAL_FORM: ProductFormState = {
  isActive: true,
  distributorAccountId: "",
  vendorAccountId: "",
  productFamilyVendor: "",
  productSubtypeVendor: "",
  productNameVendor: "",
  productCode: "",
  productDescriptionVendor: "",
  revenueType: "",
  priceEach: "",
  commissionPercent: "",
  productNameHouse: "",
  partNumberHouse: "",
  description: "",
  partNumberDistributor: "",
  distributorProductFamily: "",
  productDescriptionDistributor: "",
}

export function ProductCreateModal({ isOpen, onClose, onSuccess }: ProductCreateModalProps) {
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [accounts, setAccounts] = useState<SelectOption[]>([])
  const [revenueTypes, setRevenueTypes] = useState<SelectOption[]>([])
  const { showError, showSuccess } = useToasts()

  useEffect(() => {
    if (!isOpen) return
    setForm(INITIAL_FORM)
    setErrors({})
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setOptionsLoading(true)
    fetch("/api/products/options", { cache: "no-store" })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as ProductOptionsPayload | null
        if (!res.ok) throw new Error((payload as any)?.error ?? "Failed to load options")
        setAccounts(Array.isArray(payload?.accounts) ? payload!.accounts : [])
        setRevenueTypes(Array.isArray(payload?.revenueTypes) ? payload!.revenueTypes : [])
      })
      .catch((err) => {
        showError("Unable to load options", err instanceof Error ? err.message : String(err))
      })
      .finally(() => setOptionsLoading(false))
  }, [isOpen, showError])

  const canSubmit = useMemo(() => {
    if (!form.productNameHouse.trim()) return false
    if (!form.productCode.trim()) return false
    if (!form.revenueType.trim()) return false
    const price = form.priceEach.trim()
    if (price) {
      const parsed = Number(price)
      if (!Number.isFinite(parsed) || parsed < 0) return false
    }
    const pct = form.commissionPercent.trim()
    if (pct) {
      const parsed = Number(pct)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return false
    }
    return true
  }, [form])

  const handleChange = (field: keyof ProductFormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = event.target.type === "checkbox" ? (event.target as HTMLInputElement).checked : event.target.value
    setForm((prev) => ({ ...prev, [field]: value as any }))
  }

  const handleClose = useCallback(() => {
    if (loading) return
    onClose()
  }, [loading, onClose])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!canSubmit) return

      setLoading(true)
      setErrors({})

      const payload = {
        isActive: Boolean(form.isActive),
        distributorAccountId: form.distributorAccountId || null,
        vendorAccountId: form.vendorAccountId || null,
        productFamilyVendor: form.productFamilyVendor.trim() || null,
        productSubtypeVendor: form.productSubtypeVendor.trim() || null,
        productNameVendor: form.productNameVendor.trim() || null,
        productCode: form.productCode.trim(),
        productDescriptionVendor: form.productDescriptionVendor.trim() || null,
        revenueType: form.revenueType,
        priceEach: form.priceEach.trim() ? Number(form.priceEach.trim()) : null,
        commissionPercent: form.commissionPercent.trim() ? Number(form.commissionPercent.trim()) : null,
        productNameHouse: form.productNameHouse.trim(),
        partNumberHouse: form.partNumberHouse.trim() || null,
        description: form.description.trim() || null,
        partNumberDistributor: form.partNumberDistributor.trim() || null,
        distributorProductFamily: form.distributorProductFamily.trim() || null,
        productDescriptionDistributor: form.productDescriptionDistributor.trim() || null,
      }

      try {
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          const serverErrors = (body?.errors ?? {}) as Record<string, string>
          setErrors(serverErrors)
          throw new Error(body?.error ?? "Failed to create product")
        }

        showSuccess("Product created", "The product has been added.")
        onSuccess()
        onClose()
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create product"
        showError("Unable to create product", message)
      } finally {
        setLoading(false)
      }
    },
    [canSubmit, form, onClose, onSuccess, showError, showSuccess]
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Create New Product</h2>
            <p className="text-xs text-gray-500">Enter the product information below.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md px-3 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4">
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Left column: Product Name - House through Active */}
            <div className="space-y-3">
              {/* Product Name - House */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Name - House</label>
                <input className="rounded border px-2 py-0.5 text-[13px]" value={form.productNameHouse} onChange={handleChange("productNameHouse")} placeholder="Enter product name" />
                {errors.productNameHouse ? <p className="text-[10px] text-red-600">{errors.productNameHouse}</p> : null}
              </div>

              {/* Part Number - House */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Part Number - House</label>
                <input className="rounded border px-2 py-0.5 text-[13px]" value={form.partNumberHouse} onChange={handleChange("partNumberHouse")} placeholder="Enter house part #" />
              </div>

              {/* Product Revenue Type */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Revenue Type</label>
                <select className="rounded border px-2 py-0.5 text-[13px]" value={form.revenueType} onChange={handleChange("revenueType")}>
                  <option value="">Select revenue type</option>
                  {revenueTypes.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.revenueType ? <p className="text-[10px] text-red-600">{errors.revenueType}</p> : null}
              </div>

              {/* Vendor Name */}
            <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Vendor Name</label>
                <select className="rounded border px-2 py-0.5 text-[13px]" value={form.vendorAccountId} onChange={handleChange("vendorAccountId")}>
                  <option value="">-- Select Vendor --</option>
                  {accounts.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Distributor Name */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Distributor Name</label>
                <select className="rounded border px-2 py-0.5 text-[13px]" value={form.distributorAccountId} onChange={handleChange("distributorAccountId")}>
                  <option value="">-- Select Distributor --</option>
                  {accounts.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Price Each */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Price Each</label>
                <input type="number" step="0.01" min="0" className="rounded border px-2 py-0.5 text-[13px]" value={form.priceEach} onChange={handleChange("priceEach")} placeholder="0.00" />
                {errors.priceEach ? <p className="text-[10px] text-red-600">{errors.priceEach}</p> : null}
              </div>

              {/* Expected Commission Rate % */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Expected Commission Rate %</label>
                <input type="number" step="0.01" min="0" max="100" className="rounded border px-2 py-0.5 text-[13px]" value={form.commissionPercent} onChange={handleChange("commissionPercent")} placeholder="Enter %" />
                {errors.commissionPercent ? <p className="text-[10px] text-red-600">{errors.commissionPercent}</p> : null}
              </div>

              {/* Product Name - Vendor */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Name - Vendor</label>
                <input className="rounded border px-2 py-0.5 text-[13px]" value={form.productNameVendor} onChange={handleChange("productNameVendor")} placeholder="Enter vendor product name" />
              </div>

              {/* Part Number - Vendor */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Part Number - Vendor</label>
                <input className="rounded border px-2 py-0.5 text-[13px]" value={form.productCode} onChange={handleChange("productCode")} placeholder="Enter vendor part #" />
                {errors.productCode ? <p className="text-[10px] text-red-600">{errors.productCode}</p> : null}
              </div>

              {/* Product Family - Vendor */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Family - Vendor</label>
                <input className="rounded border px-2 py-0.5 text-[13px]" value={form.productFamilyVendor} onChange={handleChange("productFamilyVendor")} placeholder="Enter family" />
              </div>

              {/* Product Subtype - Vendor */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Subtype - Vendor</label>
                <input className="rounded border px-2 py-0.5 text-[13px]" value={form.productSubtypeVendor} onChange={handleChange("productSubtypeVendor")} placeholder="Enter subtype" />
              </div>

              {/* Active (Y/N) */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Active (Y/N)</label>
                <div className="flex items-center gap-2">
                  <EditableSwitch checked={form.isActive} onChange={handleChange("isActive") as any} />
                  <span className="text-xs text-gray-700">{form.isActive ? "Active" : "Inactive"}</span>
                </div>
              </div>
            </div>

            {/* Right column: Part Number - Distributor through Product Description - Vendor */}
            <div className="space-y-3">
              {/* Part Number - Distributor */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Part Number - Distributor</label>
                <input className="rounded border px-2 py-0.5 text-[13px]" value={form.partNumberDistributor} onChange={handleChange("partNumberDistributor")} placeholder="Enter distributor part #" />
              </div>

              {/* Distributor Product Family */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Distributor Product Family</label>
                <input className="rounded border px-2 py-0.5 text-[13px]" value={form.distributorProductFamily} onChange={handleChange("distributorProductFamily")} placeholder="Enter family" />
              </div>

              {/* Product Description - House */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Description - House</label>
                <textarea rows={2} className="rounded border px-2 py-0.5 text-[13px]" value={form.description} onChange={handleChange("description")} placeholder="Add description" />
              </div>

              {/* Product Description - Distributor */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Description - Distributor</label>
                <textarea rows={2} className="rounded border px-2 py-0.5 text-[13px]" value={form.productDescriptionDistributor} onChange={handleChange("productDescriptionDistributor")} placeholder="Add distributor description" />
              </div>

              {/* Product Description - Vendor */}
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Description - Vendor</label>
                <textarea rows={2} className="rounded border px-2 py-0.5 text-[13px]" value={form.productDescriptionVendor} onChange={handleChange("productDescriptionVendor")} placeholder="Add vendor description" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || loading || optionsLoading}
              className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


