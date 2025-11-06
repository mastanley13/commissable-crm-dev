"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ProductDetailsView, ProductDetailRecord } from "@/components/product-details-view"
import { useToasts } from "@/components/toast"

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>() as { productId?: string | string[] } | null
  const { showError } = useToasts()
  const [product, setProduct] = useState<ProductDetailRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // productId comes from the dynamic route segment; ensure string
  const productId = params?.productId
  const pid = Array.isArray(productId) ? (productId[0] ?? "") : (productId ?? "")

  const loadProduct = useCallback(async () => {
    if (!pid) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/products/${pid}`, {
        cache: "no-store"
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Failed to load product")
      }

      const payload = await response.json()
      setProduct(payload.data)
    } catch (err) {
      console.error("Failed to load product:", err)
      const message = err instanceof Error ? err.message : "Unable to load product"
      setError(message)
      showError("Failed to load product", message)
    } finally {
      setLoading(false)
    }
  }, [pid, showError])

  useEffect(() => {
    void loadProduct()
  }, [loadProduct])

  const handleRefresh = async () => {
    await loadProduct()
  }

  return (
    <ProductDetailsView
      product={product}
      loading={loading}
      error={error}
      onRefresh={handleRefresh}
    />
  )
}
