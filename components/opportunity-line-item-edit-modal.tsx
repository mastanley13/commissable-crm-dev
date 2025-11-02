"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Search, X } from "lucide-react"
import { useToasts } from "@/components/toast"
import { OpportunityLineItemRecord } from "./opportunity-types"

interface ProductOption {
  id: string
  name: string
  vendorName?: string | null
  distributorName?: string | null
  productCode?: string | null
  revenueType?: string | null
  priceEach?: number | null
}

interface OpportunityLineItemEditModalProps {
  isOpen: boolean
  opportunityId: string
  lineItem: OpportunityLineItemRecord | null
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
}

const EMPTY_FORM: LineItemFormState = {
  productId: "",
  quantity: "",
  unitPrice: "",
  expectedUsage: "",
  expectedRevenue: "",
  expectedCommission: "",
  revenueStartDate: "",
  revenueEndDate: ""
}

export function OpportunityLineItemEditModal({
  isOpen,
  opportunityId,
  lineItem,
  onClose,
  onSuccess
}: OpportunityLineItemEditModalProps) {
  const [form, setForm] = useState<LineItemFormState>(EMPTY_FORM)
  const [expectedRevenueDirty, setExpectedRevenueDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [productQuery, setProductQuery] = useState("")
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [productLoading, setProductLoading] = useState(false)
  const { showError, showSuccess } = useToasts()

  const fetchProducts = useCallback(
    async (query?: string) => {
      try {
        setProductLoading(true)
        const params = new URLSearchParams({
          page: "1",
          pageSize: "25"
        })
        if (query && query.trim().length > 0) {
          params.set("q", query.trim())
        }

        const response = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Failed to load products")
        }

        const payload = await response.json().catch(() => null)
        const items = Array.isArray(payload?.data) ? payload.data : []
        const mapped: ProductOption[] = items.map((item: any) => ({
          id: item.id,
          name: item.productNameHouse || item.productNameVendor || "Product",
          vendorName: item.vendorName,
          distributorName: item.distributorName,
          productCode: item.partNumberVendor,
          revenueType: item.revenueType,
          priceEach: typeof item.priceEach === "number" ? item.priceEach : null
        }))

        setProductOptions(mapped)
      } catch (error) {
        console.error(error)
        setProductOptions([])
        showError("Unable to load products", "Please try searching again later.")
      } finally {
        setProductLoading(false)
      }
    },
    [showError]
  )

  useEffect(() => {
    if (!isOpen || !lineItem) {
      return
    }

    const nextForm: LineItemFormState = {
      productId: lineItem.productId,
      quantity: lineItem.quantity != null ? String(lineItem.quantity) : "",
      unitPrice: lineItem.unitPrice != null ? String(lineItem.unitPrice) : "",
      expectedUsage: lineItem.expectedUsage != null ? String(lineItem.expectedUsage) : "",
      expectedRevenue: lineItem.expectedRevenue != null ? String(lineItem.expectedRevenue) : "",
      expectedCommission:
        lineItem.expectedCommission != null ? String(lineItem.expectedCommission) : "",
      revenueStartDate: lineItem.revenueStartDate
        ? lineItem.revenueStartDate.slice(0, 10)
        : "",
      revenueEndDate: lineItem.revenueEndDate ? lineItem.revenueEndDate.slice(0, 10) : ""
    }

    setForm(nextForm)
    setExpectedRevenueDirty(false)
    setProductQuery("")

    fetchProducts().catch(() => null)
  }, [fetchProducts, isOpen, lineItem])

  useEffect(() => {
    if (!isOpen || !lineItem) {
      return
    }

    setProductOptions(current => {
      if (!lineItem) {
        return current
      }

      const exists = current.some(option => option.id === lineItem.productId)
      if (exists) {
        return current
      }

      const fallback: ProductOption = {
        id: lineItem.productId,
        name: lineItem.productName,
        vendorName: lineItem.vendorName,
        distributorName: lineItem.distributorName,
        productCode: lineItem.productCode,
        revenueType: lineItem.revenueType,
        priceEach: lineItem.priceEach
      }

      return [fallback, ...current]
    })
  }, [isOpen, lineItem])

  useEffect(() => {
    if (expectedRevenueDirty) {
      return
    }

    const quantity = Number(form.quantity)
    const unitPrice = Number(form.unitPrice)

    if (Number.isFinite(quantity) && Number.isFinite(unitPrice)) {
      const computed = quantity * unitPrice
      if (!Number.isNaN(computed)) {
        setForm(prev => ({
          ...prev,
          expectedRevenue: computed.toFixed(2)
        }))
      }
    }
  }, [expectedRevenueDirty, form.quantity, form.unitPrice])

  const selectedProduct = useMemo(
    () => productOptions.find(option => option.id === form.productId) ?? null,
    [form.productId, productOptions]
  )

  const handleSearch = async () => {
    await fetchProducts(productQuery)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.productId) {
      showError("Missing product", "Select a product before saving.")
      return
    }

    const quantityValue = Number(form.quantity)
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      showError("Invalid quantity", "Quantity must be greater than zero.")
      return
    }

    const payload: Record<string, unknown> = {
      productId: form.productId,
      quantity: quantityValue
    }

    const unitPriceValue = Number(form.unitPrice)
    if (Number.isFinite(unitPriceValue)) {
      payload.unitPrice = unitPriceValue
    }

    const expectedUsageValue = Number(form.expectedUsage)
    if (Number.isFinite(expectedUsageValue)) {
      payload.expectedUsage = expectedUsageValue
    }

    const expectedRevenueValue = Number(form.expectedRevenue)
    if (Number.isFinite(expectedRevenueValue)) {
      payload.expectedRevenue = expectedRevenueValue
    }

    const expectedCommissionValue = Number(form.expectedCommission)
    if (Number.isFinite(expectedCommissionValue)) {
      payload.expectedCommission = expectedCommissionValue
    }

    if (form.revenueStartDate) {
      payload.revenueStartDate = form.revenueStartDate
    } else {
      payload.revenueStartDate = null
    }

    if (form.revenueEndDate) {
      payload.revenueEndDate = form.revenueEndDate
    } else {
      payload.revenueEndDate = null
    }

    setLoading(true)
    try {
      if (!lineItem) {
        throw new Error("Line item context missing")
      }

      const response = await fetch(`/api/opportunities/line-items/${lineItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? "Failed to update line item")
      }

      showSuccess("Line item updated", "The opportunity product has been updated.")
      await onSuccess?.()
      onClose()
    } catch (error) {
      console.error(error)
      showError(
        "Unable to update line item",
        error instanceof Error ? error.message : "Please try again later."
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !lineItem) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
              Edit Line Item
            </p>
            <h2 className="text-lg font-semibold text-gray-900">Update Opportunity Product</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="max-h-[80vh] overflow-y-auto px-6 py-6" onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Product</label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={productQuery}
                      onChange={event => setProductQuery(event.target.value)}
                      placeholder="Search products"
                      className="w-48 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <Search className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700"
                  >
                    Search
                  </button>
                </div>
              </div>

              <div className="mt-3">
                {productLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 py-6 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                    Loading products...
                  </div>
                ) : productOptions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    No products found. Try a different search term.
                  </div>
                ) : (
                  <select
                    value={form.productId}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        productId: event.target.value
                      }))
                    }
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                    required
                  >
                    {productOptions.map(option => {
                      const details: string[] = []
                      if (option.productCode) details.push(option.productCode)
                      if (option.vendorName) details.push(option.vendorName)
                      return (
                        <option key={option.id} value={option.id}>
                          {option.name}
                          {details.length > 0 ? ` • ${details.join(" • ")}` : ""}
                        </option>
                      )
                    })}
                  </select>
                )}

                {selectedProduct ? (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    <p className="font-medium text-gray-900">{selectedProduct.name}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                      {selectedProduct.vendorName ? <span>Vendor: {selectedProduct.vendorName}</span> : null}
                      {selectedProduct.distributorName ? (
                        <span>Distributor: {selectedProduct.distributorName}</span>
                      ) : null}
                      {selectedProduct.revenueType ? <span>Type: {selectedProduct.revenueType}</span> : null}
                      {Number.isFinite(selectedProduct.priceEach) ? (
                        <span>Price: ${selectedProduct.priceEach?.toFixed(2)}</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Quantity<span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantity}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      quantity: event.target.value
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Unit Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      unitPrice: event.target.value
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Expected Usage</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.expectedUsage}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      expectedUsage: event.target.value
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Expected Revenue</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.expectedRevenue}
                  onChange={event => {
                    setExpectedRevenueDirty(true)
                    setForm(current => ({
                      ...current,
                      expectedRevenue: event.target.value
                    }))
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Expected Commission</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.expectedCommission}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      expectedCommission: event.target.value
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Start Date</label>
                <input
                  type="date"
                  value={form.revenueStartDate}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      revenueStartDate: event.target.value
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">End Date</label>
                <input
                  type="date"
                  value={form.revenueEndDate}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      revenueEndDate: event.target.value
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
