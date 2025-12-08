"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { GroupDetailsView, type GroupDetailRecord } from "@/components/group-details-view"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"

export default function GroupDetailPage() {
  const params = useParams()
  const groupId = useMemo(() => {
    const value = (params as any)?.groupId
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return value[0]
    return ""
  }, [params])

  const [group, setGroup] = useState<GroupDetailRecord | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { setBreadcrumbs } = useBreadcrumbs()

  const fetchGroup = useCallback(
    async (signal?: AbortSignal) => {
      if (!groupId) {
        setGroup(null)
        setError("Group id is missing")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/groups/${groupId}`, {
          cache: "no-store",
          signal
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = payload?.error ?? "Unable to load group details"
          throw new Error(message)
        }

        const payload = await response.json().catch(() => null)
        const detail = payload?.data ?? null
        setGroup(detail)
      } catch (err) {
        if (signal?.aborted) {
          return
        }
        console.error(err)
        const message = err instanceof Error ? err.message : "Unable to load group details"
        setGroup(null)
        setError(message)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [groupId]
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchGroup(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchGroup])

  useEffect(() => {
    if (group) {
      setBreadcrumbs([
        { name: "Home", href: "/dashboard" },
        { name: "Groups", href: "/groups" },
        { name: "Group Details", href: `/groups/${group.id}` },
        { name: group.name || "Group", current: true }
      ])
    } else {
      setBreadcrumbs(null)
    }

    return () => {
      setBreadcrumbs(null)
    }
  }, [group, setBreadcrumbs])

  const handleRefresh = useCallback(async () => {
    await fetchGroup()
  }, [fetchGroup])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <GroupDetailsView
        group={group}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
      />
    </CopyProtectionWrapper>
  )
}
