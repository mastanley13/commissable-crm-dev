"use client"

import { useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { DepositReconciliationDetailView } from "@/components/deposit-reconciliation-detail-view"
import {
  depositDetailMetadataMock,
  depositLineItemsMock,
  suggestedScheduleMatchesMock
} from "@/lib/mock-data"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"

export default function DepositReconciliationDetailPage() {
  const params = useParams()
  const { setBreadcrumbs } = useBreadcrumbs()

  const depositParam = useMemo(() => {
    const raw = params?.depositId
    if (typeof raw === "string") return raw
    if (Array.isArray(raw) && raw.length > 0) return raw[0]!
    return ""
  }, [params])

  const metadata = useMemo(() => {
    return {
      ...depositDetailMetadataMock,
      id: depositParam || depositDetailMetadataMock.id
    }
  }, [depositParam])

  useEffect(() => {
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Reconciliation", href: "/reconciliation" },
      {
        name: "Deposit Detail",
        href: depositParam ? `/reconciliation/${depositParam}` : "/reconciliation"
      },
      { name: metadata.depositName, current: true }
    ])

    return () => {
      setBreadcrumbs(null)
    }
  }, [depositParam, metadata.depositName, setBreadcrumbs])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <DepositReconciliationDetailView
        metadata={metadata}
        lineItems={depositLineItemsMock}
        schedules={suggestedScheduleMatchesMock}
      />
    </CopyProtectionWrapper>
  )
}
