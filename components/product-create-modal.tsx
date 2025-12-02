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
  productNameDistributor: string
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
  productFamilyHouse: string
  description: string
  partNumberDistributor: string
  distributorProductFamily: string
  productDescriptionDistributor: string
}

const INITIAL_FORM: ProductFormState = {
  isActive: true,
  distributorAccountId: "",
  vendorAccountId: "",
  productNameDistributor: "",
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
  productFamilyHouse: "",
  description: "",
  partNumberDistributor: "",
  distributorProductFamily: "",
  productDescriptionDistributor: "",
}

const labelCls = "mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
const inputCls =
  "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
const selectCls =
  "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
const textAreaCls =
  "min-h-[60px] w-full resize-y border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs leading-5 focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"

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
      productNameDistributor: form.productNameDistributor.trim() || null,
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
      productFamilyHouse: form.productFamilyHouse.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[98vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create New Product</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close modal"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form id="product-create-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-3">
          <div className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-2">
              {/* Left Column (House + Account assignments) */}
              <div className="space-y-1.5">
                <div className="space-y-1">
                  <label className={labelCls}>Product Name - House</label>
                  <input className={inputCls} value={form.productNameHouse} onChange={handleChange("productNameHouse")} placeholder="Enter product name" />
                  {errors.productNameHouse ? <p className="text-[11px] text-rose-600">{errors.productNameHouse}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Part Number - House</label>
                  <input className={inputCls} value={form.partNumberHouse} onChange={handleChange("partNumberHouse")} placeholder="Enter house part #" />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Distributor Name</label>
                  <select className={selectCls} value={form.distributorAccountId} onChange={handleChange("distributorAccountId")}>
                    <option value="">-- Select Distributor --</option>
                    {accounts.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Vendor Name</label>
                  <select className={selectCls} value={form.vendorAccountId} onChange={handleChange("vendorAccountId")}>
                    <option value="">-- Select Vendor --</option>
                    {accounts.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Product Family - House</label>
                  <input className={inputCls} value={form.productFamilyHouse} onChange={handleChange("productFamilyHouse")} placeholder="Enter house family" />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>House - Product Subtype</label>
                  <input className={`${inputCls} text-gray-500`} placeholder="--" disabled />
                </div>
              </div>

              {/* Right Column (Financial + Status) */}
              <div className="space-y-1.5">
                <div className="space-y-1">
                  <label className={labelCls}>Price Each</label>
                  <input type="number" step="0.01" min="0" className={inputCls} value={form.priceEach} onChange={handleChange("priceEach")} placeholder="0.00" />
                  {errors.priceEach ? <p className="text-[11px] text-rose-600">{errors.priceEach}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Commission %</label>
                  <input type="number" step="0.01" min="0" max="100" className={inputCls} value={form.commissionPercent} onChange={handleChange("commissionPercent")} placeholder="Enter %" />
                  {errors.commissionPercent ? <p className="text-[11px] text-rose-600">{errors.commissionPercent}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Revenue Type</label>
                  <select className={selectCls} value={form.revenueType} onChange={handleChange("revenueType")}>
                    <option value="">Select revenue type</option>
                    {revenueTypes.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {errors.revenueType ? <p className="text-[11px] text-rose-600">{errors.revenueType}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Status</label>
                  <div className="flex items-center gap-3 py-1.5">
                    <EditableSwitch checked={form.isActive} onChange={handleChange("isActive") as any} />
                    <span className="text-xs font-semibold text-gray-600">{form.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>

                {/* Combined field spanning two rows to align with Product Family + Product Subtype */}
                <div className="space-y-1">
                  <label className={labelCls}>House - Description</label>
                  <textarea className={`${textAreaCls} h-[90px]`} value={form.description} onChange={handleChange("description")} placeholder="Add description" />
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {/* Distributor column */}
              <div className="space-y-1.5">
                <div className="space-y-1">
                  <label className={labelCls}>Distributor - Product Name</label>
                  <input className={inputCls} value={form.productNameDistributor} onChange={handleChange("productNameDistributor")} placeholder="Enter distributor product name" />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Distributor - Part Number</label>
                  <input className={inputCls} value={form.partNumberDistributor} onChange={handleChange("partNumberDistributor")} placeholder="Enter distributor part #" />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Distributor - Product Family</label>
                  <input className={inputCls} value={form.distributorProductFamily} onChange={handleChange("distributorProductFamily")} placeholder="Enter distributor family" />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Distributor - Product Subtype</label>
                  <input className={inputCls} value="" placeholder="Enter distributor subtype" disabled readOnly />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Distributor - Description</label>
                  <textarea rows={1} className={textAreaCls} value={form.productDescriptionDistributor} onChange={handleChange("productDescriptionDistributor")} placeholder="Add distributor description" />
                </div>
              </div>

              {/* Vendor column */}
              <div className="space-y-1.5">
                <div className="space-y-1">
                  <label className={labelCls}>Vendor - Product Name</label>
                  <input className={inputCls} value={form.productNameVendor} onChange={handleChange("productNameVendor")} placeholder="Enter vendor product name" />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Vendor - Part Number</label>
                  <input className={inputCls} value={form.productCode} onChange={handleChange("productCode")} placeholder="Enter vendor part #" />
                  {errors.productCode ? <p className="text-[11px] text-rose-600">{errors.productCode}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Vendor - Product Family</label>
                  <input className={inputCls} value={form.productFamilyVendor} onChange={handleChange("productFamilyVendor")} placeholder="Enter vendor family" />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Vendor - Product Subtype</label>
                  <input className={inputCls} value={form.productSubtypeVendor} onChange={handleChange("productSubtypeVendor")} placeholder="Enter vendor subtype" />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Vendor - Description</label>
                  <textarea rows={1} className={textAreaCls} value={form.productDescriptionVendor} onChange={handleChange("productDescriptionVendor")} placeholder="Add vendor description" />
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-create-form"
            disabled={!canSubmit || loading || optionsLoading}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  )
}


