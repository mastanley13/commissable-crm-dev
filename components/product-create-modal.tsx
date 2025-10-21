"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { useToasts } from "./toast"

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm" onClick={handleClose}>
      <div className="w-full max-w-5xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create New Product</h2>
            <p className="text-sm text-gray-500">Enter the product information below.</p>
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

        <form onSubmit={handleSubmit} className="px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Active (Y/N)</label>
                <div className="flex items-center gap-2">
                  <input id="isActive" type="checkbox" checked={form.isActive} onChange={handleChange("isActive") as any} />
                  <label htmlFor="isActive" className="text-xs text-gray-700">{form.isActive ? "Active" : "Inactive"}</label>
                </div>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Distributor Name</label>
                <select className="rounded border px-2 py-1 text-sm" value={form.distributorAccountId} onChange={handleChange("distributorAccountId")}>
                  <option value="">-- Select Distributor --</option>
                  {accounts.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Vendor Name</label>
                <select className="rounded border px-2 py-1 text-sm" value={form.vendorAccountId} onChange={handleChange("vendorAccountId")}>
                  <option value="">-- Select Vendor --</option>
                  {accounts.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Family - Vendor</label>
                <input className="rounded border px-2 py-1 text-sm" value={form.productFamilyVendor} onChange={handleChange("productFamilyVendor")} placeholder="Enter family" />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Subtype - Vendor</label>
                <input className="rounded border px-2 py-1 text-sm" value={form.productSubtypeVendor} onChange={handleChange("productSubtypeVendor")} placeholder="Enter subtype" />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Name - Vendor</label>
                <input className="rounded border px-2 py-1 text-sm" value={form.productNameVendor} onChange={handleChange("productNameVendor")} placeholder="Enter vendor product name" />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Part Number - Vendor</label>
                <input className="rounded border px-2 py-1 text-sm" value={form.productCode} onChange={handleChange("productCode")} placeholder="Enter vendor part #" />
                {errors.productCode ? <p className="text-[10px] text-red-600">{errors.productCode}</p> : null}
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Description - Vendor</label>
                <textarea rows={3} className="rounded border px-2 py-1 text-sm" value={form.productDescriptionVendor} onChange={handleChange("productDescriptionVendor")} placeholder="Add vendor description" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Revenue Type</label>
                <select className="rounded border px-2 py-1 text-sm" value={form.revenueType} onChange={handleChange("revenueType")}>
                  <option value="">Select revenue type</option>
                  {revenueTypes.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.revenueType ? <p className="text-[10px] text-red-600">{errors.revenueType}</p> : null}
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Price Each</label>
                <input type="number" step="0.01" min="0" className="rounded border px-2 py-1 text-sm" value={form.priceEach} onChange={handleChange("priceEach")} placeholder="0.00" />
                {errors.priceEach ? <p className="text-[10px] text-red-600">{errors.priceEach}</p> : null}
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Expected Commission Rate %</label>
                <input type="number" step="0.01" min="0" max="100" className="rounded border px-2 py-1 text-sm" value={form.commissionPercent} onChange={handleChange("commissionPercent")} placeholder="Enter %" />
                {errors.commissionPercent ? <p className="text-[10px] text-red-600">{errors.commissionPercent}</p> : null}
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Name - House</label>
                <input className="rounded border px-2 py-1 text-sm" value={form.productNameHouse} onChange={handleChange("productNameHouse")} placeholder="Enter product name" />
                {errors.productNameHouse ? <p className="text-[10px] text-red-600">{errors.productNameHouse}</p> : null}
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Part Number - House</label>
                <input className="rounded border px-2 py-1 text-sm" value={form.partNumberHouse} onChange={handleChange("partNumberHouse")} placeholder="Enter house part #" />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-gray-600">Product Description - House</label>
                <textarea rows={4} className="rounded border px-2 py-1 text-sm" value={form.description} onChange={handleChange("description")} placeholder="Add description" />
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


