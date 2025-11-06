"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import { useToasts } from "@/components/toast"

interface ProductOption {
  id: string
  name: string
  vendorName?: string | null
  distributorName?: string | null
  productCode?: string | null
  revenueType?: string | null
  priceEach?: number | null
  commissionPercent?: number | null
  productFamilyVendor?: string | null
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
  const [familyInput, setFamilyInput] = useState("")
  const [productInput, setProductInput] = useState("")
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  const [distributorOptions, setDistributorOptions] = useState<Array<{ value: string; label: string }>>([])
  const [vendorOptions, setVendorOptions] = useState<Array<{ value: string; label: string }>>([])
  const [familyOptions, setFamilyOptions] = useState<string[]>([])
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false)
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  // Product create state
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>("")
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")
  const [productNameHouse, setProductNameHouse] = useState("")
  const [productNameVendor, setProductNameVendor] = useState("")
  const [productFamilyVendorInput, setProductFamilyVendorInput] = useState("")
  const [productCode, setProductCode] = useState("")
  const [revenueType, setRevenueType] = useState("")
  const [revenueTypeOptions, setRevenueTypeOptions] = useState<Array<{ value: string; label: string }>>([])
  const [productActive, setProductActive] = useState(true)

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
    if (familyInput.trim()) filters.push({ columnId: 'productFamilyVendor', value: familyInput.trim() })
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
      productFamilyVendor: it.productFamilyVendor ?? null
    }))
    setProductOptions(mapped)
    const fams = Array.from(new Set(mapped.map(p => p.productFamilyVendor).filter(Boolean))) as string[]
    setFamilyOptions(fams)
  }, [distributorInput, vendorInput, familyInput, productInput, selectedDistributorId, selectedVendorId])

  // Debounce product fetch
  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(() => { void fetchProducts() }, 200)
    return () => clearTimeout(t)
  }, [isOpen, fetchProducts])

  // Fetch account suggestions on type
  useEffect(() => {
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
  }, [distributorInput, vendorInput, fetchAccounts])

  // Reset on open
  useEffect(() => {
    if (!isOpen) return
    setForm(INITIAL_FORM_STATE)
    setDistributorInput(''); setVendorInput(''); setFamilyInput(''); setProductInput('')
    setDistributorOptions([]); setVendorOptions([]); setFamilyOptions([]); setProductOptions([])
    setSelectedDistributorId(""); setSelectedVendorId("")
    setProductNameHouse(""); setProductNameVendor(""); setProductFamilyVendorInput(""); setProductCode(""); setRevenueType(""); setProductActive(true)
    const now = new Date(); const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    setForm(prev => ({ ...prev, commissionStartDate: first.toISOString().slice(0,10) }))
    // Default to Add to Existing when modal opens
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
        if (normalized.length > 0 && !revenueType) setRevenueType(normalized[0].value)
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.productId) { showError('Missing product', 'Select a product before saving.'); return }
    const quantityValue = Number(form.quantity)
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) { showError('Invalid quantity', 'Quantity must be greater than zero.'); return }
    const payload: Record<string, unknown> = { productId: form.productId, quantity: quantityValue }
    const unitPriceValue = Number(form.unitPrice); if (Number.isFinite(unitPriceValue)) payload.unitPrice = unitPriceValue
    const expectedUsageValue = Number(form.expectedUsage); if (Number.isFinite(expectedUsageValue)) payload.expectedUsage = expectedUsageValue
    const expectedRevenueValue = Number(form.expectedRevenue); if (Number.isFinite(expectedRevenueValue)) payload.expectedRevenue = expectedRevenueValue
    const expectedCommissionValue = Number(form.expectedCommission); if (Number.isFinite(expectedCommissionValue)) payload.expectedCommission = expectedCommissionValue
    if (form.revenueStartDate) payload.revenueStartDate = form.revenueStartDate
    if (form.revenueEndDate) payload.revenueEndDate = form.revenueEndDate
    const commissionPercentValue = form.commissionPercent.trim() ? Number(form.commissionPercent) : NaN
    if (Number.isFinite(commissionPercentValue)) payload.commissionPercent = commissionPercentValue
    const schedulePeriodsValue = Number(form.schedulePeriods); if (Number.isFinite(schedulePeriodsValue) && schedulePeriodsValue > 0) payload.schedulePeriods = schedulePeriodsValue
    if (form.commissionStartDate) payload.commissionStartDate = form.commissionStartDate
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

        {/* Tab Switch (mirrors Groups modal) */}
        <div className="px-6 pt-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 ${activeTab === "create" ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
              onClick={() => setActiveTab("create")}
              disabled={loading}
            >
              Create New
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 ${activeTab === "add" ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
              onClick={() => setActiveTab("add")}
              disabled={loading}
            >
              Add to Existing
            </button>
          </div>
        </div>

        {activeTab === "add" && (
          <form className="max-h-[80vh] overflow-y-auto px-6 py-3" onSubmit={handleSubmit}>
            <div className="grid gap-x-8 gap-y-3">
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
                        const meta = [option.productCode ?? '', option.vendorName ?? ''].filter(Boolean).join(' - ')
                        return (
                          <button key={option.id} type="button" onClick={()=>{ setForm(prev=>({...prev, productId: option.id})); setProductInput(option.name); setShowProductDropdown(false) }} className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50">
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
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
              <button type="button" onClick={onClose} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading}>Cancel</button>
              <button type="submit" disabled={loading || !form.productId} className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300">Add</button>
            </div>
          </form>
        )}

        {activeTab === "create" && (
          <form className="max-h-[80vh] overflow-y-auto px-6 py-3" onSubmit={async (e) => {
            e.preventDefault()
            // Basic validation: only revenue type is required for Create New.
            if (!revenueType.trim()) {
              showError('Missing information', 'Revenue type is required.')
              return
            }
            setLoading(true)
            try {
              // Auto-derive required backend fields that we no longer collect directly.
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
              const schedulePeriodsValue = Number(form.schedulePeriods); if (Number.isFinite(schedulePeriodsValue) && schedulePeriodsValue > 0) liPayload.schedulePeriods = schedulePeriodsValue
              if (form.commissionStartDate) liPayload.commissionStartDate = form.commissionStartDate

              const attachRes = await fetch(`/api/opportunities/${opportunityId}/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(liPayload) })
              if (!attachRes.ok) {
                const ep = await attachRes.json().catch(()=>null)
                throw new Error(ep?.error ?? 'Failed to add line item')
              }
              showSuccess('Line item added', createRes.status === 409 ? 'Existing product matched and added.' : 'New product created and added.')
              await onSuccess?.(); onClose()
            } catch (err: any) {
              console.error(err)
              showError('Unable to add product', err?.message ?? 'Please try again later.')
            } finally {
              setLoading(false)
            }
          }}>
            <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {/* Left: Product fields */}
              <div className="relative">
                <label className={labelCls}>Distributor Name</label>
                <input value={distributorInput} onChange={e=>{ setDistributorInput(e.target.value); setSelectedDistributorId("") }} placeholder="Type distributor name" className={inputCls} />
                {distributorInput && distributorOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {distributorOptions.filter(o=>o.label.toLowerCase().includes(distributorInput.toLowerCase())).map(opt=> (
                      <button key={opt.value} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50" onClick={()=>{ setDistributorInput(opt.label); setSelectedDistributorId(opt.value) }}>
                        <div className="font-medium text-gray-900">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className={labelCls}>Vendor Name</label>
                <input value={vendorInput} onChange={e=>{ setVendorInput(e.target.value); setSelectedVendorId("") }} placeholder="Type vendor name" className={inputCls} />
                {vendorInput && vendorOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {vendorOptions.filter(o=>o.label.toLowerCase().includes(vendorInput.toLowerCase())).map(opt=> (
                      <button key={opt.value} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50" onClick={()=>{ setVendorInput(opt.label); setSelectedVendorId(opt.value) }}>
                        <div className="font-medium text-gray-900">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className={labelCls}>Product Family - Vendor<span className="ml-1 text-red-500">*</span></label>
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
              <div>
                <label className={labelCls}>Product Name - Vendor</label>
                <input value={productNameVendor} onChange={e=> setProductNameVendor(e.target.value)} placeholder="Vendor-facing product name" className={inputCls} disabled={!productFamilyVendorInput.trim()} />
              </div>
              {/* Removed per spec: Product Name (House) & Vendor Part Number */}
              <div>
                <label className={labelCls}>Opportunity ID</label>
                <input
                  value={orderIdHouse ?? opportunityId}
                  readOnly
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Quantity<span className="ml-1 text-red-500">*</span></label>
                <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e=>setForm(prev=>({...prev, quantity: e.target.value}))} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Price Each</label>
                <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={e=>setForm(prev=>({...prev, unitPrice: e.target.value}))} onBlur={e=>{ const n = Number(e.target.value); if (Number.isFinite(n)) setForm(prev=>({...prev, unitPrice: n.toFixed(2)})) }} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Expected Commission Rate %</label>
                <input type="number" min="0" max="100" step="0.01" value={form.commissionPercent} onChange={e=>setForm(prev=>({...prev, commissionPercent: e.target.value}))} onBlur={e=>{ const n = Number(e.target.value); if (Number.isFinite(n)) setForm(prev=>({...prev, commissionPercent: n.toFixed(2)})) }} className={inputCls} placeholder="e.g., 10.00" />
              </div>

              {/* Right: Line item details */}
              <div>
                <label className={labelCls}>Revenue Schedule Periods</label>
                <input type="number" min="1" step="1" value={form.schedulePeriods} onChange={e=>setForm(prev=>({...prev, schedulePeriods: e.target.value}))} className={inputCls} placeholder="e.g., 12" />
              </div>
              <div>
                <label className={labelCls}>Revenue Schedule Estimated Start Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={form.commissionStartDate}
                    onChange={e=>setForm(prev=>({...prev, commissionStartDate: e.target.value}))}
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-datetime-edit]:focus:opacity-100"
                    style={{ colorScheme: 'light' }}
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-900">
                    {form.commissionStartDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                  </span>
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




