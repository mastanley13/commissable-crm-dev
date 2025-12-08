"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { useToasts } from "./toast"
import { EditableSwitch } from "./editable-field"

type SelectOption = { value: string; label: string }

type CatalogProductOption = {
  id: string
  name: string
  distributorName?: string | null
  vendorName?: string | null
  distributorId?: string | null
  vendorId?: string | null
  productNameVendor?: string | null
  productFamilyVendor?: string | null
  productSubtypeVendor?: string | null
  productFamilyHouse?: string | null
  productSubtypeHouse?: string | null
  distributorProductSubtype?: string | null
  productCode?: string | null
  revenueType?: string | null
  priceEach?: number | null
  commissionPercent?: number | null
}

interface ProductOptionsPayload {
  accounts?: SelectOption[]
  distributorAccounts?: SelectOption[]
  vendorAccounts?: SelectOption[]
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
  productSubtypeHouse: string
  distributorProductSubtype: string
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
  productSubtypeHouse: "",
  distributorProductSubtype: "",
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

const normalizeDecimalInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, "")
  const [intPart, ...rest] = cleaned.split(".")
  const fractional = rest.join("")
  return rest.length ? `${intPart}.${fractional}` : intPart
}

const formatDecimalToFixed = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const num = Number(trimmed)
  if (!Number.isFinite(num)) return trimmed
  return num.toFixed(2)
}

export function ProductCreateModal({ isOpen, onClose, onSuccess }: ProductCreateModalProps) {
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [distributorAccounts, setDistributorAccounts] = useState<SelectOption[]>([])
  const [vendorAccounts, setVendorAccounts] = useState<SelectOption[]>([])
  const [revenueTypes, setRevenueTypes] = useState<SelectOption[]>([])
  const [distributorInput, setDistributorInput] = useState("")
  const [vendorInput, setVendorInput] = useState("")
  const [productFamilyInput, setProductFamilyInput] = useState("")
  const [productSubtypeInput, setProductSubtypeInput] = useState("")
  const [productSearchInput, setProductSearchInput] = useState("")
  const [showDistributorDropdown, setShowDistributorDropdown] = useState(false)
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false)
  const [showSubtypeDropdown, setShowSubtypeDropdown] = useState(false)
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [familyOptions, setFamilyOptions] = useState<string[]>([])
  const [subtypeOptions, setSubtypeOptions] = useState<string[]>([])
  const [productOptions, setProductOptions] = useState<CatalogProductOption[]>([])
  const { showError, showSuccess } = useToasts()


  useEffect(() => {
    if (!isOpen) return
    setForm(INITIAL_FORM)
    setErrors({})
    setDistributorInput("")
    setVendorInput("")
    setProductFamilyInput("")
    setProductSubtypeInput("")
    setProductSearchInput("")
    setFamilyOptions([])
    setSubtypeOptions([])
    setProductOptions([])
    setShowDistributorDropdown(false)
    setShowVendorDropdown(false)
    setShowFamilyDropdown(false)
    setShowSubtypeDropdown(false)
    setShowProductDropdown(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setOptionsLoading(true)
    fetch("/api/products/options", { cache: "no-store" })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as
          | ProductOptionsPayload
          | { data?: ProductOptionsPayload; error?: string }
          | null
        if (!res.ok) throw new Error((payload as any)?.error ?? "Failed to load options")

        const distributorOptions =
          Array.isArray((payload as any)?.distributorAccounts) && (payload as any)?.distributorAccounts.length > 0
            ? (payload as any).distributorAccounts
            : Array.isArray((payload as any)?.data?.distributorAccounts)
              ? (payload as any).data.distributorAccounts
              : []

        const vendorOptions =
          Array.isArray((payload as any)?.vendorAccounts) && (payload as any)?.vendorAccounts.length > 0
            ? (payload as any).vendorAccounts
            : Array.isArray((payload as any)?.data?.vendorAccounts)
              ? (payload as any).data.vendorAccounts
              : []

        const fallbackAccounts =
          Array.isArray((payload as any)?.accounts)
            ? (payload as any).accounts
            : Array.isArray((payload as any)?.data?.accounts)
              ? (payload as any).data.accounts
              : []

        setDistributorAccounts(distributorOptions.length > 0 ? distributorOptions : fallbackAccounts)
        setVendorAccounts(vendorOptions.length > 0 ? vendorOptions : fallbackAccounts)

        const revenueTypeOptions =
          Array.isArray((payload as any)?.revenueTypes)
            ? (payload as any).revenueTypes
            : Array.isArray((payload as any)?.data?.revenueTypes)
              ? (payload as any).data.revenueTypes
              : []
        setRevenueTypes(revenueTypeOptions)
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

  const handleDecimalChange = (field: keyof ProductFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeDecimalInput(event.target.value)
    setForm((prev) => ({ ...prev, [field]: normalized }))
  }

  const handleDecimalBlur = (field: keyof ProductFormState) => () => {
    setForm((prev) => ({ ...prev, [field]: formatDecimalToFixed(String(prev[field] ?? "")) }))
  }

  const handleClose = useCallback(() => {
    if (loading) return
    onClose()
  }, [loading, onClose])

  const fetchAccounts = useCallback(
    async (type: "Distributor" | "Vendor", query: string) => {
      const params = new URLSearchParams({ page: "1", pageSize: "25", accountType: type })
      if (query.trim()) params.set("q", query.trim())
      const res = await fetch(`/api/accounts?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) return [] as SelectOption[]
      const payload = await res.json().catch(() => null)
      const items: any[] = Array.isArray((payload as any)?.data?.accounts)
        ? (payload as any).data.accounts
        : Array.isArray((payload as any)?.data)
          ? (payload as any).data
          : []
      return items.map((a: any) => ({
        value: a.id,
        label: a.accountName || a.accountLegalName || "Account",
      }))
    },
    []
  )

  const fetchProducts = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", pageSize: "25" })
    const filters: Array<{ columnId: string; value: string }> = []
    if (form.distributorAccountId) filters.push({ columnId: "distributorId", value: form.distributorAccountId })
    if (form.vendorAccountId) filters.push({ columnId: "vendorId", value: form.vendorAccountId })
    if (productFamilyInput.trim()) filters.push({ columnId: "productFamilyVendor", value: productFamilyInput.trim() })
    if (productSubtypeInput.trim()) filters.push({ columnId: "productSubtypeVendor", value: productSubtypeInput.trim() })
    if (productSearchInput.trim()) filters.push({ columnId: "productNameVendor", value: productSearchInput.trim() })
    if (filters.length > 0) params.set("filters", JSON.stringify(filters))
    const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" })
    if (!res.ok) {
      setProductOptions([])
      return
    }
    const payload = await res.json().catch(() => null)
    const items = Array.isArray(payload?.data) ? payload.data : []
      const mapped: CatalogProductOption[] = items.map((it: any) => ({
        id: it.id,
        name: it.productNameHouse || it.productNameVendor || "Product",
        distributorName: it.distributorName ?? null,
        vendorName: it.vendorName ?? null,
        distributorId: it.distributorId ?? it.distributorAccountId ?? null,
        vendorId: it.vendorId ?? it.vendorAccountId ?? null,
        productNameVendor: it.productNameVendor ?? null,
        productFamilyVendor: it.productFamilyVendor ?? null,
        productSubtypeVendor: it.productSubtypeVendor ?? null,
        productFamilyHouse: it.productFamilyHouse ?? null,
        productSubtypeHouse: it.productSubtypeHouse ?? null,
        distributorProductSubtype: it.distributorProductSubtype ?? null,
        productCode: it.partNumberVendor ?? it.productCode ?? null,
        revenueType: it.revenueType ?? null,
        priceEach: typeof it.priceEach === "number" ? it.priceEach : null,
        commissionPercent: typeof it.commissionPercent === "number" ? it.commissionPercent : null,
      }))
    setProductOptions(mapped)
    const fams = Array.from(new Set(mapped.map((p) => p.productFamilyVendor).filter(Boolean))) as string[]
    const subs = Array.from(new Set(mapped.map((p) => p.productSubtypeVendor).filter(Boolean))) as string[]
    setFamilyOptions(fams)
    setSubtypeOptions(subs)
  }, [form.distributorAccountId, form.vendorAccountId, productFamilyInput, productSubtypeInput, productSearchInput])

  const ensureProductsLoaded = useCallback(() => {
    if (productOptions.length === 0) {
      void fetchProducts()
    }
  }, [productOptions.length, fetchProducts])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const run = async () => {
      const [d, v] = await Promise.all([fetchAccounts("Distributor", distributorInput), fetchAccounts("Vendor", vendorInput)])
      if (!cancelled) {
        if (d.length > 0) setDistributorAccounts(d)
        if (v.length > 0) setVendorAccounts(v)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [isOpen, distributorInput, vendorInput, fetchAccounts])

  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(() => {
      void fetchProducts()
    }, 200)
    return () => clearTimeout(t)
  }, [isOpen, fetchProducts])

  const applyProductOption = useCallback(
    (option: CatalogProductOption) => {
      setDistributorInput(option.distributorName || distributorInput)
      setVendorInput(option.vendorName || vendorInput)
      setProductFamilyInput(option.productFamilyVendor || productFamilyInput)
      setProductSubtypeInput(option.productSubtypeVendor || productSubtypeInput)
      setProductSearchInput(option.name || productSearchInput)
      setForm((prev) => ({
        ...prev,
        distributorAccountId: option.distributorId ?? prev.distributorAccountId,
        vendorAccountId: option.vendorId ?? prev.vendorAccountId,
        productFamilyVendor: option.productFamilyVendor ?? prev.productFamilyVendor,
        productSubtypeVendor: option.productSubtypeVendor ?? prev.productSubtypeVendor,
        productNameVendor: option.productNameVendor ?? prev.productNameVendor,
        productFamilyHouse: option.productFamilyHouse ?? prev.productFamilyHouse,
        productSubtypeHouse: option.productSubtypeHouse ?? prev.productSubtypeHouse,
        distributorProductSubtype: option.distributorProductSubtype ?? prev.distributorProductSubtype,
        productNameHouse: option.name || prev.productNameHouse,
        productCode: option.productCode ?? prev.productCode,
        revenueType: option.revenueType ?? prev.revenueType,
        priceEach: option.priceEach != null ? Number(option.priceEach).toFixed(2) : prev.priceEach,
        commissionPercent: option.commissionPercent != null ? Number(option.commissionPercent).toFixed(2) : prev.commissionPercent,
      }))
    },
    [distributorInput, vendorInput, productFamilyInput, productSubtypeInput, productSearchInput]
  )

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
        productSubtypeHouse: form.productSubtypeHouse.trim() || null,
        description: form.description.trim() || null,
        partNumberDistributor: form.partNumberDistributor.trim() || null,
        distributorProductFamily: form.distributorProductFamily.trim() || null,
        distributorProductSubtype: form.distributorProductSubtype.trim() || null,
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
                  <label className={labelCls}>Distributor Name</label>
                  <div className="relative">
                    <input
                      value={distributorInput}
                      onChange={(e) => {
                        setDistributorInput(e.target.value)
                        setForm((prev) => ({ ...prev, distributorAccountId: "" }))
                        setShowDistributorDropdown(true)
                      }}
                      onFocus={() => setShowDistributorDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDistributorDropdown(false), 200)}
                      placeholder="Type or select distributor"
                      className={inputCls}
                    />
                    {showDistributorDropdown && distributorAccounts.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {distributorAccounts
                          .filter((opt) => opt.label.toLowerCase().includes(distributorInput.toLowerCase()))
                          .map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                              onClick={() => {
                                setDistributorInput(opt.label)
                                setForm((prev) => ({ ...prev, distributorAccountId: opt.value }))
                                setShowDistributorDropdown(false)
                              }}
                            >
                              <div className="font-medium text-gray-900">{opt.label}</div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Vendor Name</label>
                  <div className="relative">
                    <input
                      value={vendorInput}
                      onChange={(e) => {
                        setVendorInput(e.target.value)
                        setForm((prev) => ({ ...prev, vendorAccountId: "" }))
                        setShowVendorDropdown(true)
                      }}
                      onFocus={() => setShowVendorDropdown(true)}
                      onBlur={() => setTimeout(() => setShowVendorDropdown(false), 200)}
                      placeholder="Type or select vendor"
                      className={inputCls}
                    />
                    {showVendorDropdown && vendorAccounts.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {vendorAccounts
                          .filter((opt) => opt.label.toLowerCase().includes(vendorInput.toLowerCase()))
                          .map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                              onClick={() => {
                                setVendorInput(opt.label)
                                setForm((prev) => ({ ...prev, vendorAccountId: opt.value }))
                                setShowVendorDropdown(false)
                              }}
                            >
                              <div className="font-medium text-gray-900">{opt.label}</div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Product Family - House</label>
                  <input className={inputCls} value={form.productFamilyHouse} onChange={handleChange("productFamilyHouse")} placeholder="Enter house family" />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>House - Product Subtype</label>
                  <input className={inputCls} value={form.productSubtypeHouse} onChange={handleChange("productSubtypeHouse")} placeholder="Enter house subtype" />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Product Name - House</label>
                  <input className={inputCls} value={form.productNameHouse} onChange={handleChange("productNameHouse")} placeholder="Enter product name" />
                  {errors.productNameHouse ? <p className="text-[11px] text-rose-600">{errors.productNameHouse}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Part Number - House</label>
                  <input className={inputCls} value={form.partNumberHouse} onChange={handleChange("partNumberHouse")} placeholder="Enter house part #" />
                </div>
              </div>

              {/* Right Column (Financial + Status) */}
              <div className="space-y-1.5">
                <div className="space-y-1">
                  <label className={labelCls}>Price Each</label>
                  <div className="flex items-center border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus-within:border-primary-500">
                    <span className="pointer-events-none mr-2 text-[11px] text-gray-500">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full bg-transparent text-xs focus:outline-none"
                      value={form.priceEach}
                      onChange={handleDecimalChange("priceEach")}
                      onBlur={handleDecimalBlur("priceEach")}
                      placeholder="$0.00"
                    />
                  </div>
                  {errors.priceEach ? <p className="text-[11px] text-rose-600">{errors.priceEach}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Commission %</label>
                  <div className="flex items-center border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus-within:border-primary-500">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full bg-transparent text-xs focus:outline-none"
                      value={form.commissionPercent}
                      onChange={handleDecimalChange("commissionPercent")}
                      onBlur={handleDecimalBlur("commissionPercent")}
                      placeholder="0.00%"
                    />
                    <span className="pointer-events-none ml-2 text-[11px] text-gray-500">%</span>
                  </div>
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
                  <input
                    className={inputCls}
                    value={form.distributorProductSubtype}
                    onChange={handleChange("distributorProductSubtype")}
                    placeholder="Enter distributor subtype"
                  />
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
                  <div className="relative">
                    <input
                      className={inputCls}
                      value={form.productNameVendor}
                      onChange={(e) => {
                        setProductSearchInput(e.target.value)
                        handleChange("productNameVendor")(e)
                        setShowProductDropdown(true)
                      }}
                      onFocus={() => { setShowProductDropdown(true); ensureProductsLoaded() }}
                      onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                      placeholder="Enter vendor product name"
                      aria-autocomplete="list"
                    />
                    {showProductDropdown && (
                      <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {(productOptions.length > 0 ? productOptions : []).filter((p) => {
                          const q = productSearchInput.toLowerCase()
                          return (
                            !q ||
                            p.name.toLowerCase().includes(q) ||
                            (p.productCode ?? "").toLowerCase().includes(q) ||
                            (p.vendorName ?? "").toLowerCase().includes(q)
                          )
                        }).map((option) => {
                          const metaParts = [option.productCode ?? "", option.vendorName ?? "", option.productFamilyVendor ?? ""].filter(Boolean)
                          const meta = metaParts.join(" • ")
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setProductSearchInput(option.name)
                                setForm((prev) => ({ ...prev, productNameVendor: option.productNameVendor ?? option.name }))
                                applyProductOption(option)
                                setShowProductDropdown(false)
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                            >
                              <div className="font-medium text-gray-900">{option.name}</div>
                              {meta ? <div className="text-xs text-gray-500">{meta}</div> : null}
                            </button>
                          )
                        })}
                        {productOptions.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No catalog matches yet. Keep typing to search.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Vendor - Part Number</label>
                  <input className={inputCls} value={form.productCode} onChange={handleChange("productCode")} placeholder="Enter vendor part #" />
                  {errors.productCode ? <p className="text-[11px] text-rose-600">{errors.productCode}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Vendor - Product Family</label>
                  <div className="relative">
                    <input
                      className={inputCls}
                      value={form.productFamilyVendor}
                      onChange={(e) => {
                        setProductFamilyInput(e.target.value)
                        handleChange("productFamilyVendor")(e)
                        setShowFamilyDropdown(true)
                      }}
                      onFocus={() => { setShowFamilyDropdown(true); ensureProductsLoaded() }}
                      onBlur={() => setTimeout(() => setShowFamilyDropdown(false), 200)}
                      placeholder="Enter vendor family"
                    />
                    {showFamilyDropdown && (
                      <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {familyOptions
                          .filter((fam) => fam.toLowerCase().includes((productFamilyInput || "").toLowerCase()))
                          .map((fam) => (
                            <button
                              key={fam}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                              onClick={() => {
                                setProductFamilyInput(fam)
                                setProductSubtypeInput("")
                                setForm((prev) => ({
                                  ...prev,
                                  productFamilyVendor: fam,
                                  productSubtypeVendor: "",
                                }))
                                setShowFamilyDropdown(false)
                              }}
                            >
                              <div className="font-medium text-gray-900">{fam}</div>
                            </button>
                          ))}
                        {familyOptions.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No families yet. Keep typing to search.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Vendor - Product Subtype</label>
                  <div className="relative">
                    <input
                      className={inputCls}
                      value={form.productSubtypeVendor}
                      onChange={(e) => {
                        setProductSubtypeInput(e.target.value)
                        handleChange("productSubtypeVendor")(e)
                        setShowSubtypeDropdown(true)
                      }}
                      onFocus={() => { setShowSubtypeDropdown(true); ensureProductsLoaded() }}
                      onBlur={() => setTimeout(() => setShowSubtypeDropdown(false), 200)}
                      placeholder="Enter vendor subtype"
                    />
                    {showSubtypeDropdown && productFamilyInput.trim() && (
                      <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {subtypeOptions
                          .filter((sub) => sub.toLowerCase().includes((productSubtypeInput || "").toLowerCase()))
                          .map((sub) => (
                            <button
                              key={sub}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                              onClick={() => {
                                setProductSubtypeInput(sub)
                                setForm((prev) => ({ ...prev, productSubtypeVendor: sub }))
                                setShowSubtypeDropdown(false)
                              }}
                            >
                              <div className="font-medium text-gray-900">{sub}</div>
                            </button>
                          ))}
                        {subtypeOptions.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No subtypes yet. Keep typing to search.</div>
                        )}
                      </div>
                    )}
                  </div>
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


