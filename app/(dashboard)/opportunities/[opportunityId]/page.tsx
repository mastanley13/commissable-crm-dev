"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { OpportunityDetailsView } from "@/components/opportunity-details-view"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"
import { useToasts } from "@/components/toast"
import { OpportunityDetailRecord } from "@/components/opportunity-types"

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false
  return UUID_REGEX.test(value.trim())
}

export default function OpportunityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setBreadcrumbs } = useBreadcrumbs()
  const { showError } = useToasts()

  const opportunityId = useMemo(() => {
    const value = params?.opportunityId
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return value[0]
    return ""
  }, [params])

  const [opportunity, setOpportunity] = useState<OpportunityDetailRecord | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOpportunity = useCallback(
    async (signal?: AbortSignal) => {
      if (!opportunityId) {
        setOpportunity(null)
        setError("Opportunity id is missing")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/opportunities/${opportunityId}`, {
          cache: "no-store",
          signal
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = payload?.error ?? "Unable to load opportunity details"
          if (response.status === 404) {
            setOpportunity(null)
            setError("Opportunity not found")
          } else {
            setError(message)
          }
          if (response.status !== 404) {
            showError("Failed to load opportunity", message)
          }
          return
        }

        const payload = await response.json().catch(() => null)
        const data = payload?.data
        let detail = data?.detail as OpportunityDetailRecord | undefined
        if (!detail) {
          setOpportunity(null)
          setError("Opportunity details unavailable")
          return
        }

        if (isUuid(detail.referredBy)) {
          try {
            const contactResponse = await fetch(`/api/contacts/${detail.referredBy}`, {
              cache: "no-store",
              signal
            })

            if (contactResponse.ok) {
              const contactPayload = await contactResponse.json().catch(() => null)
              const fullName = contactPayload?.data?.fullName
              if (typeof fullName === "string" && fullName.trim().length > 0) {
                detail = {
                  ...detail,
                  referredBy: fullName.trim()
                }
              }
            }
          } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError")) {
              console.error("Failed to resolve referred by contact", error)
            }
          }
        }

        const expectedUsageGross = typeof data?.expectedUsageGrossTotal === "number"
          ? data.expectedUsageGrossTotal
          : detail.totals.expectedUsageTotal
        const expectedCommissionGross = typeof data?.expectedCommissionGrossTotal === "number"
          ? data.expectedCommissionGrossTotal
          : detail.totals.expectedCommissionTotal

        const summaryMetrics = {
          expectedUsageGrossTotal: expectedUsageGross,
          expectedUsageAdjustmentsGrossTotal: typeof data?.expectedUsageAdjustmentsGrossTotal === "number"
            ? data.expectedUsageAdjustmentsGrossTotal
            : 0,
          actualUsageGrossTotal: typeof data?.actualUsageGrossTotal === "number" ? data.actualUsageGrossTotal : 0,
          actualUsageAdjustmentsGrossTotal: typeof data?.actualUsageAdjustmentsGrossTotal === "number"
            ? data.actualUsageAdjustmentsGrossTotal
            : 0,
          remainingUsageGrossTotal: Math.max(
            expectedUsageGross - (typeof data?.actualUsageGrossTotal === "number" ? data.actualUsageGrossTotal : 0),
            0
          ),
          remainingUsageAdjustmentsGrossTotal: 0,
          expectedCommissionGrossTotal: expectedCommissionGross,
          expectedCommissionAdjustmentsGrossTotal: typeof data?.expectedCommissionAdjustmentsGrossTotal === "number"
            ? data.expectedCommissionAdjustmentsGrossTotal
            : 0,
          actualCommissionGrossTotal: typeof data?.actualCommissionGrossTotal === "number"
            ? data.actualCommissionGrossTotal
            : 0,
          actualCommissionAdjustmentsGrossTotal: typeof data?.actualCommissionAdjustmentsGrossTotal === "number"
            ? data.actualCommissionAdjustmentsGrossTotal
            : 0,
          remainingCommissionGrossTotal: Math.max(
            expectedCommissionGross -
              (typeof data?.actualCommissionGrossTotal === "number" ? data.actualCommissionGrossTotal : 0),
            0
          ),
          remainingCommissionAdjustmentsGrossTotal: 0,
          expectedCommissionHouseRepTotal: typeof data?.expectedCommissionHouseRepTotal === "number"
            ? data.expectedCommissionHouseRepTotal
            : undefined,
          expectedCommissionSubAgentTotal: typeof data?.expectedCommissionSubAgentTotal === "number"
            ? data.expectedCommissionSubAgentTotal
            : undefined,
          expectedCommissionHouseTotal: typeof data?.expectedCommissionHouseTotal === "number"
            ? data.expectedCommissionHouseTotal
            : undefined,
          actualCommissionHouseRepTotal: typeof data?.actualCommissionHouseRepTotal === "number"
            ? data.actualCommissionHouseRepTotal
            : undefined,
          actualCommissionSubAgentTotal: typeof data?.actualCommissionSubAgentTotal === "number"
            ? data.actualCommissionSubAgentTotal
            : undefined,
          actualCommissionHouseTotal: typeof data?.actualCommissionHouseTotal === "number"
            ? data.actualCommissionHouseTotal
            : undefined,
          remainingCommissionHouseRepTotal: typeof data?.remainingCommissionHouseRepTotal === "number"
            ? data.remainingCommissionHouseRepTotal
            : undefined,
          remainingCommissionSubAgentTotal: typeof data?.remainingCommissionSubAgentTotal === "number"
            ? data.remainingCommissionSubAgentTotal
            : undefined,
          remainingCommissionHouseTotal: typeof data?.remainingCommissionHouseTotal === "number"
            ? data.remainingCommissionHouseTotal
            : undefined
        }

        const identifiers = {
          accountIdHouse: data?.accountIdHouse ?? detail.account?.id ?? null,
          accountIdVendor: data?.accountIdVendor ?? null,
          accountIdDistributor: data?.accountIdDistributor ?? null,
          customerIdHouse: data?.customerIdHouse ?? null,
          customerIdVendor: data?.customerIdVendor ?? null,
          customerIdDistributor: data?.customerIdDistributor ?? null,
          locationId: data?.locationId ?? null,
          orderIdHouse: data?.orderIdHouse ?? null,
          orderIdVendor: data?.orderIdVendor ?? null,
          orderIdDistributor: data?.orderIdDistributor ?? null,
          customerPurchaseOrder: data?.customerPurchaseOrder ?? null
        }

        setOpportunity({
          ...detail,
          summaryMetrics,
          identifiers
        })
        setError(null)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return
        }
        console.error(err)
        const message = err instanceof Error ? err.message : "Unable to load opportunity details"
        setOpportunity(null)
        setError(message)
        showError("Failed to load opportunity", message)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [opportunityId, showError]
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchOpportunity(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchOpportunity])

  useEffect(() => {
    if (opportunity) {
      const ctx = (searchParams?.get('ctx') || '').toLowerCase()
      const ctxId = searchParams?.get('ctxId') || undefined
      const ctxName = searchParams?.get('ctxName') || undefined

      const via = (searchParams?.get('via') || '').toLowerCase()
      const viaId = searchParams?.get('viaId') || undefined
      const viaName = searchParams?.get('viaName') || undefined

      // Accounts -> Contact -> Opportunity path
      if (ctx === 'accounts' && via === 'contacts' && ctxId && viaId) {
        setBreadcrumbs([
          { name: 'Home', href: '/dashboard' },
          { name: 'Accounts', href: '/accounts' },
          { name: 'Account Details', href: `/accounts/${ctxId}` },
          { name: ctxName || opportunity.account?.accountName || 'Account', href: `/accounts/${ctxId}` },
          { name: 'Contacts', href: `/accounts/${ctxId}?tab=contacts` },
          { name: 'Contact Details', href: `/contacts/${viaId}?ctx=accounts&ctxId=${encodeURIComponent(ctxId)}${ctxName ? `&ctxName=${encodeURIComponent(ctxName)}` : ''}` },
          { name: viaName || 'Contact', href: `/contacts/${viaId}?ctx=accounts&ctxId=${encodeURIComponent(ctxId)}${ctxName ? `&ctxName=${encodeURIComponent(ctxName)}` : ''}` },
          { name: 'Opportunity Details', href: `/opportunities/${opportunity.id}?ctx=accounts&ctxId=${encodeURIComponent(ctxId)}${ctxName ? `&ctxName=${encodeURIComponent(ctxName)}` : ''}&via=contacts&viaId=${encodeURIComponent(viaId)}${viaName ? `&viaName=${encodeURIComponent(viaName)}` : ''}` },
          { name: opportunity.name || 'Opportunity', current: true }
        ])
        return
      }

      // Contacts -> Opportunity path
      if (ctx === 'contacts' && ctxId) {
        setBreadcrumbs([
          { name: 'Home', href: '/dashboard' },
          { name: 'Contacts', href: '/contacts' },
          { name: 'Contact Details', href: `/contacts/${ctxId}` },
          { name: ctxName || 'Contact', href: `/contacts/${ctxId}` },
          { name: 'Opportunity Details', href: `/opportunities/${opportunity.id}?ctx=contacts&ctxId=${encodeURIComponent(ctxId)}${ctxName ? `&ctxName=${encodeURIComponent(ctxName)}` : ''}` },
          { name: opportunity.name || 'Opportunity', current: true }
        ])
        return
      }

      // Accounts -> Opportunity path
      if (ctx === 'accounts' && ctxId) {
        setBreadcrumbs([
          { name: 'Home', href: '/dashboard' },
          { name: 'Accounts', href: '/accounts' },
          { name: 'Account Details', href: `/accounts/${ctxId}` },
          { name: ctxName || opportunity.account?.accountName || 'Account', href: `/accounts/${ctxId}` },
          { name: 'Opportunities', href: `/accounts/${ctxId}?tab=opportunities` },
          { name: 'Details', href: `/opportunities/${opportunity.id}?ctx=accounts&ctxId=${encodeURIComponent(ctxId)}${ctxName ? `&ctxName=${encodeURIComponent(ctxName)}` : ''}` },
          { name: opportunity.name || 'Opportunity', current: true }
        ])
        return
      }

      // Default Opportunities module path
      setBreadcrumbs([
        { name: 'Home', href: '/dashboard' },
        { name: 'Opportunities', href: '/opportunities' },
        { name: 'Details', href: `/opportunities/${opportunity.id}` },
        { name: opportunity.name || 'Opportunity', current: true }
      ])
    } else {
      setBreadcrumbs(null)
    }

    return () => {
      setBreadcrumbs(null)
    }
  }, [opportunity, setBreadcrumbs, searchParams])

  const handleRefresh = useCallback(async () => {
    await fetchOpportunity()
  }, [fetchOpportunity])

  useEffect(() => {
    if (!opportunityId) {
      router.replace("/opportunities")
    }
  }, [opportunityId, router])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <OpportunityDetailsView
        opportunity={opportunity}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
      />
    </CopyProtectionWrapper>
  )
}
