"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useToasts } from "@/components/toast"
import { OpportunityProductDetailsView, type OpportunityProductDetailRecord } from "@/components/opportunity-product-details-view"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"

type RouteParams = {
  opportunityId?: string | string[]
  lineItemId?: string | string[]
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "")
}

export default function OpportunityProductDetailPage() {
  const params = useParams<RouteParams>() as RouteParams | null
  const opportunityId = firstParam(params?.opportunityId)
  const lineItemId = firstParam(params?.lineItemId)
  const { showError } = useToasts()
  const { setBreadcrumbs } = useBreadcrumbs()

  const [lineItem, setLineItem] = useState<OpportunityProductDetailRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLineItem = useCallback(async () => {
    if (!lineItemId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/opportunities/line-items/${encodeURIComponent(lineItemId)}`, {
        cache: "no-store"
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Failed to load opportunity product")
      }

      const payload = await response.json().catch(() => null)
      const record = (payload?.data ?? null) as OpportunityProductDetailRecord | null
      setLineItem(record)

      if (record) {
        const opportunityName = record.opportunity?.name || "Opportunity"
        const title = record.productNameHouse || record.productNameVendor || "Opportunity Product"
        setBreadcrumbs([
          { name: "Home", href: "/dashboard" },
          { name: "Opportunities", href: "/opportunities" },
          { name: "Details", href: `/opportunities/${record.opportunity.id}?tab=products` },
          { name: opportunityName, href: `/opportunities/${record.opportunity.id}?tab=products` },
          { name: title, current: true }
        ])
      } else {
        setBreadcrumbs(null)
      }
    } catch (err) {
      console.error("Failed to load opportunity product:", err)
      const message = err instanceof Error ? err.message : "Unable to load opportunity product"
      setError(message)
      showError("Failed to load opportunity product", message)
      setBreadcrumbs(null)
    } finally {
      setLoading(false)
    }
  }, [lineItemId, setBreadcrumbs, showError])

  useEffect(() => {
    void loadLineItem()
    return () => setBreadcrumbs(null)
  }, [loadLineItem, setBreadcrumbs])

  useEffect(() => {
    if (!lineItem) return
    if (!opportunityId) return
    if (lineItem.opportunity?.id && lineItem.opportunity.id !== opportunityId) {
      setError("Opportunity product does not belong to this opportunity.")
    }
  }, [lineItem, opportunityId])

  const effectiveError = useMemo(() => error, [error])

  return (
    <OpportunityProductDetailsView
      lineItem={lineItem}
      loading={loading}
      error={effectiveError}
      onRefresh={loadLineItem}
    />
  )
}

