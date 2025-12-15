"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"
import { RevenueScheduleDetailsView, type RevenueScheduleDetailRecord } from "@/components/revenue-schedule-details-view"
import { useToasts } from "@/components/toast"
import { isRevenueScheduleDetailRedesignEnabled } from "@/lib/feature-flags"

export default function RevenueScheduleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setBreadcrumbs } = useBreadcrumbs()
  const { showError } = useToasts()

  const scheduleParam = useMemo(() => {
    const raw = params?.revenueScheduleId
    if (typeof raw === "string") return raw
    if (Array.isArray(raw) && raw.length > 0) return raw[0]
    return ""
  }, [params])

  const [schedule, setSchedule] = useState<RevenueScheduleDetailRecord | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Feature flag: redesigned Revenue Schedule Detail layout (Financial Summary + horizontal tabs).
  const enableRedesign = useMemo(
    () => isRevenueScheduleDetailRedesignEnabled(searchParams),
    [searchParams]
  )

  useEffect(() => {
    if (!scheduleParam) {
      router.replace("/revenue-schedules")
    }
  }, [router, scheduleParam])

  const fetchSchedule = useCallback(async () => {
    if (!scheduleParam) {
      setSchedule(null)
      setError("Revenue schedule id is missing")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/revenue-schedules/${encodeURIComponent(scheduleParam)}`, { cache: "no-store" })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error ?? "Unable to load revenue schedule"
        setSchedule(null)
        setError(message)
        return
      }

      const payload = await response.json().catch(() => null)
      const record = payload?.data ?? null
      setSchedule(record)
    } catch (err) {
      console.error("Failed to fetch revenue schedule", err)
      const message = err instanceof Error ? err.message : "Unable to load revenue schedule"
      setSchedule(null)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [scheduleParam])

  useEffect(() => {
    void fetchSchedule()
  }, [fetchSchedule])

  useEffect(() => {
    if (schedule) {
      const label = schedule.revenueScheduleName ?? schedule.revenueSchedule ?? `Schedule #${schedule.id}`
      setBreadcrumbs([
        { name: "Home", href: "/dashboard" },
        { name: "Revenue Schedules", href: "/revenue-schedules" },
        { name: "Details", href: `/revenue-schedules/${scheduleParam}` },
        { name: label, current: true }
      ])
    } else if (scheduleParam) {
      setBreadcrumbs([
        { name: "Home", href: "/dashboard" },
        { name: "Revenue Schedules", href: "/revenue-schedules" },
        { name: "Details", href: `/revenue-schedules/${scheduleParam}` },
        { name: error ? "Not Found" : "Loading", current: true }
      ])
    } else {
      setBreadcrumbs(null)
    }

    return () => {
      setBreadcrumbs(null)
    }
  }, [schedule, scheduleParam, error, setBreadcrumbs])

  useEffect(() => {
    if (scheduleParam && error) {
      showError("Revenue schedule not found", error)
    }
  }, [scheduleParam, error, showError])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <RevenueScheduleDetailsView
        schedule={schedule}
        loading={loading}
        error={error}
        scheduleKey={scheduleParam}
        onRefresh={fetchSchedule}
        supportingDetailsV2={enableRedesign}
      />
    </CopyProtectionWrapper>
  )
}
