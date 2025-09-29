"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { ActivityDetailView, ActivityDetailRecord } from "@/components/activity-detail-view"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"

export default function ActivityDetailPage() {
  const params = useParams()
  const router = useRouter()

  const activityId = useMemo(() => {
    const value = params?.activityId
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return value[0]
    return ""
  }, [params])

  const [activity, setActivity] = useState<ActivityDetailRecord | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { setBreadcrumbs } = useBreadcrumbs()

  const fetchActivity = useCallback(
    async (signal?: AbortSignal) => {
      if (!activityId) {
        setActivity(null)
        setError("Activity id is missing")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/activities/${activityId}`, {
          cache: "no-store",
          signal
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = payload?.error ?? "Unable to load activity"
          throw new Error(message)
        }

        const payload = await response.json().catch(() => null)
        setActivity(payload?.data ?? null)
      } catch (err) {
        if (signal?.aborted) {
          return
        }
        console.error(err)
        const message = err instanceof Error ? err.message : "Unable to load activity"
        setActivity(null)
        setError(message)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
  },
  [activityId]
)

useEffect(() => {
    const controller = new AbortController()
    fetchActivity(controller.signal)
    return () => controller.abort()
  }, [fetchActivity])

  const handleBack = () => {
    router.push("/activities")
  }

  useEffect(() => {
    if (activity) {
      setBreadcrumbs([
        { name: 'Home', href: '/dashboard' },
        { name: 'Activities', href: '/activities' },
        { name: activity.subject || 'Activity', current: true }
      ])
    } else {
      setBreadcrumbs(null)
    }

    return () => {
      setBreadcrumbs(null)
    }
  }, [activity, setBreadcrumbs])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <ActivityDetailView
          activity={activity}
          loading={loading}
          error={error}
          onBack={handleBack}
          onRefresh={() => fetchActivity()}
        />
      </div>
    </CopyProtectionWrapper>
  )
}
