"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ProductDetailsView, ProductDetailRecord } from "@/components/product-details-view"
import { useToasts } from "@/components/toast"

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { showError } = useToasts()
  const [product, setProduct] = useState<ProductDetailRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const productId = params.productId as string

  const loadProduct = async () => {
    if (!productId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/products/${productId}`, {
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
  }

  useEffect(() => {
    loadProduct()
  }, [productId])

  const handleEdit = () => {
    // TODO: Open edit modal or navigate to edit page
    console.log("Edit product:", productId)
  }

  const handleRefresh = async () => {
    await loadProduct()
  }

  return (
    <ProductDetailsView
      product={product}
      loading={loading}
      error={error}
      onEdit={handleEdit}
      onRefresh={handleRefresh}
    />
  )
}
