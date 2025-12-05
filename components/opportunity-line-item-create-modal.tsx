"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import { useToasts } from "@/components/toast"

interface ProductOption {
  id: string
  name: string
  productNameVendor?: string | null
  vendorName?: string | null
  distributorName?: string | null
  productCode?: string | null
  revenueType?: string | null
  priceEach?: number | null
  commissionPercent?: number | null
  productFamilyVendor?: string | null
  productSubtypeVendor?: string | null
  productFamilyHouse?: string | null
  productSubtypeHouse?: string | null
}

interface OpportunityLineItemCreateModalProps {
  isOpen: boolean
  opportunityId: string
  orderIdHouse?: string | null
  onClose: () => void
  onSuccess?: () => Promise<void> | void
}

interface LineItemFormState {
  productId: string
  quantity: string
  unitPrice: string
  expectedUsage: string
  expectedRevenue: string
  expectedCommission: string
  revenueStartDate: string
  revenueEndDate: string
  commissionPercent: string
  schedulePeriods: string
  commissionStartDate: string
}

const INITIAL_FORM_STATE: LineItemFormState = {
  productId: "",
  quantity: "1",
  unitPrice: "",
  expectedUsage: "",
  expectedRevenue: "",
  expectedCommission: "",
  revenueStartDate: "",
  revenueEndDate: "",
  commissionPercent: "",
  schedulePeriods: "",
  commissionStartDate: ""
}

export function OpportunityLineItemCreateModal({ isOpen, opportunityId, orderIdHouse, onClose, onSuccess }: OpportunityLineItemCreateModalProps) {
  const [form, setForm] = useState<LineItemFormState>(INITIAL_FORM_STATE)
  const [loading, setLoading] = useState(false)
  // Tab state to mirror Groups modal UX
  const [activeTab, setActiveTab] = useState<"create" | "add">("add")

  // Typeahead state
  const [distributorInput, setDistributorInput] = useState("")
  const [vendorInput, setVendorInput] = useState("")
  const [catalogFamilyInput, setCatalogFamilyInput] = useState("")
  const [catalogFamilyFilter, setCatalogFamilyFilter] = useState("")
  const [catalogSubtypeInput, setCatalogSubtypeInput] = useState("")
  const [catalogSubtypeFilter, setCatalogSubtypeFilter] = useState("")
  const [productInput, setProductInput] = useState("")
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [showDistributorDropdown, setShowDistributorDropdown] = useState(false)
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [showSubtypeDropdown, setShowSubtypeDropdown] = useState(false)
  const [showProductNameDropdown, setShowProductNameDropdown] = useState(false)
  const [showCatalogFamilyDropdown, setShowCatalogFamilyDropdown] = useState(false)
  const [showCatalogSubtypeDropdown, setShowCatalogSubtypeDropdown] = useState(false)

  const [distributorOptions, setDistributorOptions] = useState<Array<{ value: string; label: string }>>([])
  const [vendorOptions, setVendorOptions] = useState<Array<{ value: string; label: string }>>([])
  const [familyOptions, setFamilyOptions] = useState<string[]>([])
  const [subtypeOptions, setSubtypeOptions] = useState<string[]>([])
  const [productNameOptions, setProductNameOptions] = useState<string[]>([])
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false)
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  // Product create state
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>("")
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")
  const [productNameHouse, setProductNameHouse] = useState("")
  const [productNameVendor, setProductNameVendor] = useState("")
  const [productFamilyVendorInput, setProductFamilyVendorInput] = useState("")
  const [productSubtypeVendor, setProductSubtypeVendor] = useState("")
  const [productCode, setProductCode] = useState("")
  const [revenueType, setRevenueType] = useState("")
  const [revenueTypeOptions, setRevenueTypeOptions] = useState<Array<{ value: string; label: string }>>([])
  const [productActive, setProductActive] = useState(true)
  const [dedupeExactMatch, setDedupeExactMatch] = useState<ProductOption | null>(null)
  const [dedupeLikelyMatches, setDedupeLikelyMatches] = useState<ProductOption[]>([])

  const { showError, showSuccess } = useToasts()

  // Accounts lookup (Distributor/Vendor)
  const fetchAccounts = useCallback(async (type: 'Distributor' | 'Vendor', query: string) => {
    const params = new URLSearchParams({ page: '1', pageSize: '25', accountType: type })
    if (query.trim()) params.set('q', query.trim())
    const res = await fetch(`/api/accounts?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return [] as Array<{ value: string; label: string }>
    const payload = await res.json().catch(() => null)
    const items: any[] = Array.isArray(payload?.data?.accounts) ? payload.data.accounts : Array.isArray(payload?.data) ? payload.data : []
    return items.map((a: any) => ({ value: a.id, label: a.accountName || a.accountLegalName || 'Account' }))
  }, [])

  // Products lookup, filtered by inputs
  const fetchProducts = useCallback(async () => {
    const params = new URLSearchParams({ page: '1', pageSize: '25' })
    const filters: Array<{ columnId: string; value: string }> = []
    if (distributorInput.trim()) filters.push({ columnId: 'distributorName', value: distributorInput.trim() })
    if (vendorInput.trim()) filters.push({ columnId: 'vendorName', value: vendorInput.trim() })
    if (selectedDistributorId) filters.push({ columnId: 'distributorId', value: selectedDistributorId })
    if (selectedVendorId) filters.push({ columnId: 'vendorId', value: selectedVendorId })
    if (catalogFamilyFilter.trim()) filters.push({ columnId: 'productFamilyVendor', value: catalogFamilyFilter.trim() })
    if (catalogSubtypeFilter.trim()) filters.push({ columnId: 'productSubtypeVendor', value: catalogSubtypeFilter.trim() })
    if (productInput.trim()) filters.push({ columnId: 'productNameVendor', value: productInput.trim() })
    if (filters.length > 0) params.set('filters', JSON.stringify(filters))
    const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) { setProductOptions([]); return }
    const payload = await res.json().catch(() => null)
    const items = Array.isArray(payload?.data) ? payload.data : []
    const mapped: ProductOption[] = items.map((it: any) => ({
      id: it.id,
      name: it.productNameHouse || it.productNameVendor || 'Product',
      vendorName: it.vendorName,
      distributorName: it.distributorName,
      productCode: it.partNumberVendor,
      revenueType: it.revenueType,
      priceEach: typeof it.priceEach === 'number' ? it.priceEach : null,
      commissionPercent: typeof it.commissionPercent === 'number' ? it.commissionPercent : null,
      productFamilyVendor: it.productFamilyVendor ?? null,
      productSubtypeVendor: it.productSubtypeVendor ?? null,
      productNameVendor: it.productNameVendor ?? null,
      productFamilyHouse: it.productFamilyHouse ?? null,
      productSubtypeHouse: it.productSubtypeHouse ?? null
    }))
    setProductOptions(mapped)
    const fams = Array.from(new Set(mapped.map(p => p.productFamilyVendor).filter(Boolean))) as string[]
    setFamilyOptions(fams)
    const subs = Array.from(new Set(mapped.map(p => p.productSubtypeVendor).filter(Boolean))) as string[]
    setSubtypeOptions(subs)
    const names = Array.from(new Set(mapped.map(p => p.productNameVendor || p.name).filter(Boolean))) as string[]
    setProductNameOptions(names)
  }, [distributorInput, vendorInput, catalogFamilyFilter, catalogSubtypeFilter, productInput, selectedDistributorId, selectedVendorId])

  const ensureProductInOptions = useCallback((product: ProductOption) => {
    setProductOptions(prev => prev.some(p => p.id === product.id) ? prev : [product, ...prev])
  }, [])

  const runProductDedupe = useCallback(async (): Promise<{ exact: ProductOption | null; likely: ProductOption[] }> => {
    const params = new URLSearchParams({ page: '1', pageSize: '25' })
    const filters: Array<{ columnId: string; value: string }> = []
    if (selectedVendorId) filters.push({ columnId: 'vendorId', value: selectedVendorId })
    if (selectedDistributorId) filters.push({ columnId: 'distributorId', value: selectedDistributorId })
    if (productCode.trim()) filters.push({ columnId: 'partNumberVendor', value: productCode.trim() })
    if (productNameVendor.trim()) filters.push({ columnId: 'productNameVendor', value: productNameVendor.trim() })
    if (filters.length > 0) params.set('filters', JSON.stringify(filters))
    const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return { exact: null, likely: [] }
    const payload = await res.json().catch(() => null)
    const items = Array.isArray(payload?.data) ? payload.data : []
    const mapped: ProductOption[] = items.map((it: any) => ({
      id: it.id,
      name: it.productNameHouse || it.productNameVendor || 'Product',
      vendorName: it.vendorName,
      distributorName: it.distributorName,
      productCode: it.partNumberVendor,
      revenueType: it.revenueType,
      priceEach: typeof it.priceEach === 'number' ? it.priceEach : null,
      commissionPercent: typeof it.commissionPercent === 'number' ? it.commissionPercent : null,
      productFamilyVendor: it.productFamilyVendor ?? null,
      productSubtypeVendor: it.productSubtypeVendor ?? null,
      productNameVendor: it.productNameVendor ?? null,
      productFamilyHouse: it.productFamilyHouse ?? null,
      productSubtypeHouse: it.productSubtypeHouse ?? null
    }))
    const exact = mapped.find(p => {
      const codeMatch = productCode.trim() && p.productCode && p.productCode.toLowerCase() === productCode.trim().toLowerCase()
      const nameMatch = productNameVendor.trim() && p.productNameVendor && p.productNameVendor.toLowerCase() === productNameVendor.trim().toLowerCase()
      return Boolean(codeMatch || nameMatch)
    }) ?? null
    const likely = mapped.filter(p => p.id !== exact?.id)
    return { exact, likely }
  }, [selectedVendorId, selectedDistributorId, productCode, productNameVendor])

  const switchToCatalogWithProduct = useCallback((product: ProductOption) => {
    ensureProductInOptions(product)
    const now = new Date()
    const firstDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0,10)
    setActiveTab("add")
    setProductInput(product.name)
    setForm(prev => ({
      ...prev,
      productId: product.id,
      quantity: "1",
      unitPrice: product.priceEach != null ? Number(product.priceEach).toFixed(2) : prev.unitPrice,
      commissionPercent: product.commissionPercent != null ? Number(product.commissionPercent).toFixed(2) : prev.commissionPercent,
      commissionStartDate: firstDate,
      schedulePeriods: "1"
    }))
    setDedupeExactMatch(null)
    setDedupeLikelyMatches([])
  }, [ensureProductInOptions])

  // Debounce product fetch
  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(() => { void fetchProducts() }, 200)
    return () => clearTimeout(t)
  }, [isOpen, fetchProducts])

  // Fetch account suggestions on type
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const run = async () => {
      const [d, v] = await Promise.all([
        fetchAccounts('Distributor', distributorInput),
        fetchAccounts('Vendor', vendorInput)
      ])
      if (!cancelled) { setDistributorOptions(d); setVendorOptions(v) }
    }
    void run()
    return () => { cancelled = true }
  }, [isOpen, distributorInput, vendorInput, fetchAccounts])

  // Reset on open
  useEffect(() => {
    if (!isOpen) return
    setForm(INITIAL_FORM_STATE)
    setDistributorInput(''); setVendorInput(''); setCatalogFamilyInput(''); setCatalogFamilyFilter(''); setCatalogSubtypeInput(''); setCatalogSubtypeFilter(''); setProductInput('')
    setDistributorOptions([]); setVendorOptions([]); setFamilyOptions([]); setSubtypeOptions([]); setProductNameOptions([]); setProductOptions([])
    setSelectedDistributorId(""); setSelectedVendorId("")
    setProductNameHouse(""); setProductNameVendor(""); setProductFamilyVendorInput(""); setProductSubtypeVendor(""); setProductCode(""); setRevenueType(""); setProductActive(true)
    setDedupeExactMatch(null); setDedupeLikelyMatches([])
    const now = new Date(); const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    setForm(prev => ({ ...prev, commissionStartDate: first.toISOString().slice(0,10) }))
    // Default to Add Product from Catalog when modal opens
    setActiveTab("add")
  }, [isOpen])

  // Load product options (revenue types) once when modal opens
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    fetch('/api/products/options', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((payload) => {
        if (cancelled) return
        const types = Array.isArray(payload?.revenueTypes) ? payload.revenueTypes : Array.isArray(payload?.data?.revenueTypes) ? payload.data.revenueTypes : []
        const normalized = types.map((t: any) => ({ value: t.value ?? t, label: t.label ?? t }))
        setRevenueTypeOptions(normalized)
        if (normalized.length > 0) {
          setRevenueType(prev => prev || normalized[0].value)
        }
      })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [isOpen])

  // Expected revenue auto-calc when quantity/price change
  const [expectedRevenueDirty, setExpectedRevenueDirty] = useState(false)
  useEffect(() => {
    if (expectedRevenueDirty) return
    const q = Number(form.quantity); const p = Number(form.unitPrice)
    if (Number.isFinite(q) && Number.isFinite(p)) setForm(prev => ({ ...prev, expectedRevenue: (q*p).toFixed(2) }))
  }, [form.quantity, form.unitPrice, expectedRevenueDirty])

  // Prefill unit price + commission % from selected product
  const selectedProduct = useMemo(() => productOptions.find(p => p.id === form.productId) ?? null, [productOptions, form.productId])
  useEffect(() => {
    if (!selectedProduct) return
    setForm(prev => ({
      ...prev,
      unitPrice: selectedProduct.priceEach != null ? Number(selectedProduct.priceEach).toFixed(2) : prev.unitPrice,
      commissionPercent: selectedProduct.commissionPercent != null ? Number(selectedProduct.commissionPercent).toFixed(2) : prev.commissionPercent
    }))
  }, [selectedProduct])

  const handleCreateSubmit = useCallback(async ({ skipLikelyCheck = false }: { skipLikelyCheck?: boolean } = {}) => {
    // Basic validation: only revenue type is required for Create New.
    if (!revenueType.trim()) {
      showError('Missing information', 'Revenue type is required.')
      return
    }
    const defaultStartDate = () => {
      const now = new Date()
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0,10)
    }
    setLoading(true)
    try {
      const { exact, likely } = await runProductDedupe()
      setDedupeExactMatch(exact)
      setDedupeLikelyMatches(likely)

      if (exact) {
        showError('Existing product found', 'Use the existing product instead to avoid duplicates.')
        return
      }
      if (likely.length > 0 && !skipLikelyCheck) {
        showError('Possible duplicates found', 'Review the matches or proceed anyway.')
        return
      }

      const derivedProductNameHouse = (productNameHouse.trim() || productNameVendor.trim() || 'New Product').slice(0, 120)
      const derivedProductCode = (productCode.trim() || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`).slice(0, 64)
      const productPayload: Record<string, unknown> = {
        productNameHouse: derivedProductNameHouse,
        productCode: derivedProductCode,
        revenueType,
        priceEach: form.unitPrice ? Number(form.unitPrice) : undefined,
        commissionPercent: form.commissionPercent ? Number(form.commissionPercent) : undefined,
        isActive: productActive,
        productNameVendor: productNameVendor.trim() || undefined,
        productFamilyVendor: productFamilyVendorInput.trim() || undefined,
        productSubtypeVendor: productSubtypeVendor.trim() || undefined,
        vendorAccountId: selectedVendorId || undefined,
        distributorAccountId: selectedDistributorId || undefined,
      }

      // Attempt to create product
      let createdProductId: string | null = null
      let createRes = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productPayload) })
      if (createRes.status === 201) {
        const data = await createRes.json().catch(()=>null)
        createdProductId = data?.data?.id ?? data?.data?.productId ?? null
      } else if (createRes.status === 409) {
        // Dedupe: find existing by product code
        const params = new URLSearchParams({ page: '1', pageSize: '10', q: productCode.trim() })
        const searchRes = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' })
        if (searchRes.ok) {
          const payload = await searchRes.json().catch(()=>null)
          const items: any[] = Array.isArray(payload?.data) ? payload.data : []
          createdProductId = items[0]?.id ?? null
        }
      } else if (!createRes.ok) {
        const errorPayload = await createRes.json().catch(()=>null)
        throw new Error(errorPayload?.error || 'Failed to create product')
      }

      if (!createdProductId) {
        throw new Error('No existing product found with that part number')
      }

      // Attach as line item
      const liPayload: Record<string, unknown> = { productId: createdProductId, quantity: Number(form.quantity || '1') || 1 }
      const unitPriceValue = Number(form.unitPrice); if (Number.isFinite(unitPriceValue)) liPayload.unitPrice = unitPriceValue
      const expectedUsageValue = Number(form.expectedUsage); if (Number.isFinite(expectedUsageValue)) liPayload.expectedUsage = expectedUsageValue
      const expectedRevenueValue = Number(form.expectedRevenue); if (Number.isFinite(expectedRevenueValue)) liPayload.expectedRevenue = expectedRevenueValue
      const expectedCommissionValue = Number(form.expectedCommission); if (Number.isFinite(expectedCommissionValue)) liPayload.expectedCommission = expectedCommissionValue
      const schedulePeriodsValue = Number(form.schedulePeriods)
      liPayload.schedulePeriods = Number.isFinite(schedulePeriodsValue) && schedulePeriodsValue > 0 ? schedulePeriodsValue : 1
      liPayload.commissionStartDate = form.commissionStartDate || defaultStartDate()

      const attachRes = await fetch(`/api/opportunities/${opportunityId}/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(liPayload) })
      if (!attachRes.ok) {
        const ep = await attachRes.json().catch(()=>null)
        throw new Error(ep?.error ?? 'Failed to add line item')
      }
      showSuccess('Line item added', createRes.status === 409 ? 'Existing product matched and added.' : 'New product created and added.')
      setDedupeExactMatch(null); setDedupeLikelyMatches([])
      await onSuccess?.(); onClose()
    } catch (err: any) {
      console.error(err)
      showError('Unable to add product', err?.message ?? 'Please try again later.')
    } finally {
      setLoading(false)
    }
  }, [revenueType, showError, runProductDedupe, productNameHouse, productNameVendor, productCode, form.unitPrice, form.commissionPercent, productActive, productFamilyVendorInput, productSubtypeVendor, selectedVendorId, selectedDistributorId, form.quantity, form.expectedUsage, form.expectedRevenue, form.expectedCommission, form.schedulePeriods, form.commissionStartDate, opportunityId, showSuccess, onSuccess, onClose])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.productId) { showError('Missing product', 'Select a product before saving.'); return }
    const quantityValue = Number(form.quantity)
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) { showError('Invalid quantity', 'Quantity must be greater than zero.'); return }
    const defaultStartDate = () => {
      const now = new Date()
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0,10)
    }
    const payload: Record<string, unknown> = { productId: form.productId, quantity: quantityValue }
    const unitPriceValue = Number(form.unitPrice); if (Number.isFinite(unitPriceValue)) payload.unitPrice = unitPriceValue
    const expectedUsageValue = Number(form.expectedUsage); if (Number.isFinite(expectedUsageValue)) payload.expectedUsage = expectedUsageValue
    const expectedRevenueValue = Number(form.expectedRevenue); if (Number.isFinite(expectedRevenueValue)) payload.expectedRevenue = expectedRevenueValue
    const expectedCommissionValue = Number(form.expectedCommission); if (Number.isFinite(expectedCommissionValue)) payload.expectedCommission = expectedCommissionValue
    if (form.revenueStartDate) payload.revenueStartDate = form.revenueStartDate
    if (form.revenueEndDate) payload.revenueEndDate = form.revenueEndDate
    const commissionPercentValue = form.commissionPercent.trim() ? Number(form.commissionPercent) : NaN
    if (Number.isFinite(commissionPercentValue)) payload.commissionPercent = commissionPercentValue
    const schedulePeriodsValue = Number(form.schedulePeriods); if (Number.isFinite(schedulePeriodsValue) && schedulePeriodsValue > 0) { payload.schedulePeriods = schedulePeriodsValue } else { payload.schedulePeriods = 1 }
    payload.commissionStartDate = form.commissionStartDate || defaultStartDate()
    setLoading(true)
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const ep = await res.json().catch(()=>null); throw new Error(ep?.error ?? 'Failed to create line item') }
      showSuccess('Line item added', 'The product has been added to this opportunity.')
      await onSuccess?.(); onClose()
    } catch (err: any) {
      console.error(err); showError('Unable to create line item', err?.message ?? 'Please try again later.')
    } finally { setLoading(false) }
  }

  if (!isOpen) return null

  const labelCls = 'mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500'
  const inputCls = 'w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{activeTab === "add" ? "Add Line Item" : "Create Product"}</p>
            <h2 className="text-lg font-semibold text-gray-900">{activeTab === "add" ? "Add Existing Product" : "Create New Product"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600" aria-label="Close" disabled={loading}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switch */}
        <div className="px-6 pt-3">
          <div className="inline-flex gap-1 text-sm">
            <button
              type="button"
              onClick={() => setActiveTab("add")}
              disabled={loading}
              className={`rounded-md border px-3 py-1.5 font-semibold shadow-sm transition ${
                activeTab === "add"
                  ? "border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                  : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:from-blue-200 hover:to-blue-300 hover:border-blue-400"
              }`}
            >
              Add Product from Catalog
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              disabled={loading}
              className={`rounded-md border px-3 py-1.5 font-semibold shadow-sm transition ${
                activeTab === "create"
                  ? "border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                  : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:from-blue-200 hover:to-blue-300 hover:border-blue-400"
              }`}
            >
              Create New
            </button>
          </div>
        </div>

        {activeTab === "add" && (
          <form className="max-h-[80vh] overflow-y-auto px-6 py-3" onSubmit={handleSubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Left column: catalog filters + product lookup */}
              <div className="space-y-4">
                <div className="relative">
                  <label className={labelCls}>Distributor Name</label>
                  <input
                    value={distributorInput}
                    onChange={e=>{ setDistributorInput(e.target.value); setSelectedDistributorId(""); setShowDistributorDropdown(true) }}
                    onFocus={()=>setShowDistributorDropdown(true)}
                    onBlur={()=>setTimeout(()=>setShowDistributorDropdown(false),200)}
                    placeholder="Type or select distributor"
                    className={inputCls}
                  />
                  {showDistributorDropdown && distributorOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {distributorOptions.filter(o=>o.label.toLowerCase().includes(distributorInput.toLowerCase())).map(opt=> (
                        <button key={opt.value} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50" onClick={()=>{ setDistributorInput(opt.label); setSelectedDistributorId(opt.value); setShowDistributorDropdown(false) }}>
                          <div className="font-medium text-gray-900">{opt.label}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className={labelCls}>Vendor Name</label>
                  <input
                    value={vendorInput}
                    onChange={e=>{ setVendorInput(e.target.value); setSelectedVendorId(""); setShowVendorDropdown(true) }}
                    onFocus={()=>setShowVendorDropdown(true)}
                    onBlur={()=>setTimeout(()=>setShowVendorDropdown(false),200)}
                    placeholder="Type or select vendor"
                    className={inputCls}
                  />
                  {showVendorDropdown && vendorOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {vendorOptions.filter(o=>o.label.toLowerCase().includes(vendorInput.toLowerCase())).map(opt=> (
                        <button key={opt.value} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50" onClick={()=>{ setVendorInput(opt.label); setSelectedVendorId(opt.value); setShowVendorDropdown(false) }}>
                          <div className="font-medium text-gray-900">{opt.label}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className={labelCls}>Product Family</label>
                  <input
                    value={catalogFamilyInput}
                    onChange={e=>{
                      const nextValue = e.target.value
                      setCatalogFamilyInput(nextValue)
                      if (!nextValue.trim()) {
                        setCatalogFamilyFilter("")
                        setCatalogSubtypeInput("")
                        setCatalogSubtypeFilter("")
                      }
                      setShowCatalogFamilyDropdown(true)
                    }}
                    onFocus={()=>setShowCatalogFamilyDropdown(true)}
                    onBlur={()=>setTimeout(()=>setShowCatalogFamilyDropdown(false),200)}
                    placeholder="Search or pick a family"
                    className={inputCls}
                  />
                  {showCatalogFamilyDropdown && familyOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {familyOptions.filter(f => f.toLowerCase().includes((catalogFamilyInput||'').toLowerCase())).map(fam => (
                        <button
                          key={fam}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                          onClick={()=>{
                            setCatalogFamilyInput(fam)
                            setCatalogFamilyFilter(fam)
                            setCatalogSubtypeInput("")
                            setCatalogSubtypeFilter("")
                            setShowCatalogFamilyDropdown(false)
                          }}
                        >
                          <div className="font-medium text-gray-900">{fam}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className={labelCls}>Product Subtype</label>
                  <input
                    value={catalogSubtypeInput}
                    onChange={e=>{
                      const nextValue = e.target.value
                      setCatalogSubtypeInput(nextValue)
                      if (!nextValue.trim()) {
                        setCatalogSubtypeFilter("")
                      }
                      setShowCatalogSubtypeDropdown(true)
                    }}
                    onFocus={()=>setShowCatalogSubtypeDropdown(true)}
                    onBlur={()=>setTimeout(()=>setShowCatalogSubtypeDropdown(false),200)}
                    placeholder="Search or pick a subtype"
                    className={inputCls}
                    disabled={!catalogFamilyInput.trim()}
                  />
                  {showCatalogSubtypeDropdown && subtypeOptions.length > 0 && catalogFamilyInput.trim() && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {subtypeOptions.filter(f => f.toLowerCase().includes((catalogSubtypeInput||'').toLowerCase())).map(sub => (
                        <button
                          key={sub}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                          onClick={()=>{
                            setCatalogSubtypeInput(sub)
                            setCatalogSubtypeFilter(sub)
                            setShowCatalogSubtypeDropdown(false)
                          }}
                        >
                          <div className="font-medium text-gray-900">{sub}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Select Product<span className="ml-1 text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      value={productInput}
                      onChange={e=>{ setProductInput(e.target.value); setShowProductDropdown(true) }}
                      onFocus={()=>setShowProductDropdown(true)}
                      onBlur={()=>setTimeout(()=>setShowProductDropdown(false),200)}
                      placeholder="Type to search products by name, code, or vendor..."
                      className={inputCls}
                      aria-autocomplete="list"
                    />
                    {showProductDropdown && (
                      <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {productOptions.filter(p=>{
                          const q = productInput.toLowerCase();
                          return !q || p.name.toLowerCase().includes(q) || (p.productCode??'').toLowerCase().includes(q) || (p.vendorName??'').toLowerCase().includes(q)
                        }).map(option => {
                          const metaParts = [
                            option.productCode ?? '',
                            option.vendorName ?? '',
                            option.productFamilyHouse ?? ''
                          ].filter(Boolean)
                          const meta = metaParts.join(' - ')
                          const firstOfMonth = new Date()
                          const firstDate = new Date(Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth(), 1)).toISOString().slice(0,10)
                          return (
                            <button key={option.id} type="button" onClick={()=>{
                              setForm(prev=>({
                                ...prev,
                                productId: option.id,
                                quantity: "1",
                                unitPrice: option.priceEach != null ? Number(option.priceEach).toFixed(2) : prev.unitPrice,
                                commissionPercent: option.commissionPercent != null ? Number(option.commissionPercent).toFixed(2) : prev.commissionPercent,
                                commissionStartDate: firstDate,
                                schedulePeriods: "1"
                              }))
                              setProductInput(option.name)
                              setShowProductDropdown(false)
                            }} className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50">
                              <div className="font-medium text-gray-900">{option.name}</div>
                              {meta && <div className="text-xs text-gray-500">{meta}</div>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column: defaults that can be overridden */}
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Quantity<span className="ml-1 text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.quantity}
                    onChange={e=>setForm(prev=>({...prev, quantity: e.target.value }))}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Price Each</label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unitPrice}
                      onChange={e=>setForm(prev=>({...prev, unitPrice: e.target.value }))}
                      onBlur={e=>{ const n = Number(e.target.value); if (Number.isFinite(n)) setForm(prev=>({...prev, unitPrice: n.toFixed(2)})) }}
                      className={`${inputCls} pl-3`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Expected Commission Rate %</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.commissionPercent}
                      onChange={e=>setForm(prev=>({...prev, commissionPercent: e.target.value }))}
                      onBlur={e=>{ const n = Number(e.target.value); if (Number.isFinite(n)) setForm(prev=>({...prev, commissionPercent: n.toFixed(2)})) }}
                      className={`${inputCls} pr-4`}
                      placeholder="e.g., 10.00"
                    />
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">%</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Expected Commission Start Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={form.commissionStartDate}
                      onChange={e=>setForm(prev=>({...prev, commissionStartDate: e.target.value}))}
                      className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:outline-none focus:border-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0"
                      style={{ colorScheme: 'light' }}
                    />
                    <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">
                      {form.commissionStartDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                    </span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Number of Periods</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.schedulePeriods}
                    onChange={e=>setForm(prev=>({...prev, schedulePeriods: e.target.value}))}
                    className={inputCls}
                    placeholder="e.g., 1"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
              <button type="button" onClick={onClose} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading}>Cancel</button>
              <button type="submit" disabled={loading || !form.productId} className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300">Add</button>
            </div>
          </form>
        )}

        {activeTab === "create" && (
          <form
            className="max-h-[80vh] overflow-y-auto px-6 py-3"
            onSubmit={(e) => { e.preventDefault(); void handleCreateSubmit(); }}
          >
            {dedupeExactMatch && (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="font-semibold">Existing product found</div>
                <div className="mt-1">We found a product with the same name/code. Use the existing product instead to avoid duplicates.</div>
                <div className="mt-2 flex gap-2">
                  <button type="button" className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700" onClick={()=>switchToCatalogWithProduct(dedupeExactMatch)} disabled={loading}>
                    Use existing product
                  </button>
                  <button type="button" className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100" onClick={()=>{ setDedupeExactMatch(null); setDedupeLikelyMatches([]) }} disabled={loading}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {dedupeLikelyMatches.length > 0 && (
              <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                <div className="font-semibold">Possible duplicates</div>
                <div className="mt-1">We found similar products. Choose one to use, or proceed anyway.</div>
                <div className="mt-2 space-y-2">
                  {dedupeLikelyMatches.map(match => (
                    <div key={match.id} className="flex flex-col rounded-md border border-yellow-100 bg-white/60 px-3 py-2 text-xs text-gray-800">
                      <div className="font-semibold text-gray-900">{match.name}</div>
                      <div className="text-gray-600">
                        {[match.productCode, match.vendorName, match.productFamilyVendor].filter(Boolean).join(" • ")}
                      </div>
                      <div className="mt-1 flex gap-2">
                        <button type="button" className="rounded-md border border-primary-300 px-2 py-1 font-semibold text-primary-700 hover:bg-primary-50" onClick={()=>switchToCatalogWithProduct(match)} disabled={loading}>
                          Use this product
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700" onClick={()=>handleCreateSubmit({ skipLikelyCheck: true })} disabled={loading}>
                    Proceed anyway
                  </button>
                  <button type="button" className="rounded-md border border-yellow-300 px-3 py-1.5 text-xs font-semibold text-yellow-800 hover:bg-yellow-100" onClick={()=>setDedupeLikelyMatches([])} disabled={loading}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
              {/* Left column: product context */}
              <div className="space-y-4">
                <div className="relative">
                  <label className={labelCls}>Distributor Name</label>
                  <input
                    value={distributorInput}
                    onChange={e=>{ setDistributorInput(e.target.value); setSelectedDistributorId(""); setShowDistributorDropdown(true) }}
                    onFocus={()=>setShowDistributorDropdown(true)}
                    onBlur={()=>setTimeout(()=>setShowDistributorDropdown(false),200)}
                    placeholder="Type distributor name"
                    className={inputCls}
                  />
                  {showDistributorDropdown && distributorOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {distributorOptions.filter(o=>o.label.toLowerCase().includes(distributorInput.toLowerCase())).map(opt=> (
                        <button key={opt.value} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50" onClick={()=>{ setDistributorInput(opt.label); setSelectedDistributorId(opt.value); setShowDistributorDropdown(false) }}>
                          <div className="font-medium text-gray-900">{opt.label}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className={labelCls}>Vendor Name</label>
                  <input
                    value={vendorInput}
                    onChange={e=>{ setVendorInput(e.target.value); setSelectedVendorId(""); setShowVendorDropdown(true) }}
                    onFocus={()=>setShowVendorDropdown(true)}
                    onBlur={()=>setTimeout(()=>setShowVendorDropdown(false),200)}
                    placeholder="Type vendor name"
                    className={inputCls}
                  />
                  {showVendorDropdown && vendorOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {vendorOptions.filter(o=>o.label.toLowerCase().includes(vendorInput.toLowerCase())).map(opt=> (
                        <button key={opt.value} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50" onClick={()=>{ setVendorInput(opt.label); setSelectedVendorId(opt.value); setShowVendorDropdown(false) }}>
                          <div className="font-medium text-gray-900">{opt.label}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className={labelCls}>Product Family<span className="ml-1 text-red-500">*</span></label>
                  <input
                    value={productFamilyVendorInput}
                    onChange={e=>{ setProductFamilyVendorInput(e.target.value); setShowFamilyDropdown(true) }}
                    onFocus={()=>setShowFamilyDropdown(true)}
                    onBlur={()=>setTimeout(()=>setShowFamilyDropdown(false),200)}
                    placeholder="e.g., UCaaS"
                    className={inputCls}
                    disabled={!selectedDistributorId || !selectedVendorId}
                  />
                  {showFamilyDropdown && familyOptions.length > 0 && selectedDistributorId && selectedVendorId && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {familyOptions.filter(f => f.toLowerCase().includes((productFamilyVendorInput||'').toLowerCase())).map(fam => (
                        <button key={fam} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50" onClick={()=>{ setProductFamilyVendorInput(fam); setShowFamilyDropdown(false) }}>
                          <div className="font-medium text-gray-900">{fam}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className={labelCls}>Product Subtype</label>
                  <input
                    value={productSubtypeVendor}
                    onChange={e => { setProductSubtypeVendor(e.target.value); setShowSubtypeDropdown(true) }}
                    onFocus={()=>setShowSubtypeDropdown(true)}
                    onBlur={()=>setTimeout(()=>setShowSubtypeDropdown(false),200)}
                    placeholder="Optional subtype"
                    className={inputCls}
                    disabled={!productFamilyVendorInput.trim()}
                  />
                  {showSubtypeDropdown && subtypeOptions.length > 0 && productFamilyVendorInput.trim() && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {subtypeOptions.filter(s => s.toLowerCase().includes((productSubtypeVendor||'').toLowerCase())).map(sub => (
                        <button key={sub} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50" onClick={()=>{ setProductSubtypeVendor(sub); setShowSubtypeDropdown(false) }}>
                          <div className="font-medium text-gray-900">{sub}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className={labelCls}>Product Name</label>
                  <input
                    value={productNameVendor}
                    onChange={e=> { setProductNameVendor(e.target.value); setShowProductNameDropdown(true) }}
                    onFocus={()=>setShowProductNameDropdown(true)}
                    onBlur={()=>setTimeout(()=>setShowProductNameDropdown(false),200)}
                    placeholder="Vendor-facing product name"
                    className={inputCls}
                    disabled={!productFamilyVendorInput.trim()}
                  />
                  {showProductNameDropdown && productNameOptions.length > 0 && productFamilyVendorInput.trim() && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {productNameOptions.filter(n => n.toLowerCase().includes((productNameVendor||'').toLowerCase())).map(name => (
                        <button key={name} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50" onClick={()=>{ setProductNameVendor(name); setShowProductNameDropdown(false) }}>
                          <div className="font-medium text-gray-900">{name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right column: pricing and schedule */}
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Quantity<span className="ml-1 text-red-500">*</span></label>
                  <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e=>setForm(prev=>({...prev, quantity: e.target.value}))} className={inputCls} required />
                </div>

                <div>
                  <label className={labelCls}>Price Each</label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">$</span>
                    <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={e=>setForm(prev=>({...prev, unitPrice: e.target.value}))} onBlur={e=>{ const n = Number(e.target.value); if (Number.isFinite(n)) setForm(prev=>({...prev, unitPrice: n.toFixed(2)})) }} className={`${inputCls} pl-3`} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Revenue Schedule Start Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={form.revenueStartDate}
                      onChange={e=>setForm(prev=>({...prev, revenueStartDate: e.target.value}))}
                      className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:outline-none focus:border-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0"
                      style={{ colorScheme: 'light' }}
                    />
                    <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">
                      {form.revenueStartDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                    </span>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Number of Periods</label>
                  <input type="number" min="1" step="1" value={form.schedulePeriods} onChange={e=>setForm(prev=>({...prev, schedulePeriods: e.target.value}))} className={inputCls} placeholder="e.g., 12" />
                </div>

                <div>
                  <label className={labelCls}>Expected Commission Rate %</label>
                  <div className="relative">
                    <input type="number" min="0" max="100" step="0.01" value={form.commissionPercent} onChange={e=>setForm(prev=>({...prev, commissionPercent: e.target.value}))} onBlur={e=>{ const n = Number(e.target.value); if (Number.isFinite(n)) setForm(prev=>({...prev, commissionPercent: n.toFixed(2)})) }} className={`${inputCls} pr-4`} placeholder="e.g., 10.00" />
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
              <button type="button" onClick={onClose} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300">Add</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}


