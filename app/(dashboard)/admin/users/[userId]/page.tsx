"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { PermissionGate } from "@/components/auth/permission-gate"
import { UserDetailsView, type UserDetailRecord } from "@/components/user-details-view"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"

export default function AdminUserProfilePage() {
  const params = useParams()
  const userId = useMemo(() => {
    const value = (params as any)?.userId
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return value[0]
    return ""
  }, [params])

  const [user, setUser] = useState<UserDetailRecord | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { setBreadcrumbs } = useBreadcrumbs()

  const fetchUser = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) {
        setUser(null)
        setError("User id is missing")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          cache: "no-store",
          signal
        })

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          const message = payload?.error ?? "Unable to load user profile"
          throw new Error(message)
        }

        const detail = payload?.data?.user ?? null
        setUser(detail)
      } catch (err) {
        if (signal?.aborted) {
          return
        }
        console.error(err)
        const message = err instanceof Error ? err.message : "Unable to load user profile"
        setUser(null)
        setError(message)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [userId]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchUser(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchUser])

  useEffect(() => {
    if (user) {
      setBreadcrumbs([
        { name: "Home", href: "/dashboard" },
        { name: "Admin", href: "/admin" },
        { name: "Users", href: "/admin/users" },
        { name: "User Profile", href: `/admin/users/${user.id}` },
        { name: user.fullName || user.email || "User", current: true }
      ])
    } else {
      setBreadcrumbs(null)
    }

    return () => {
      setBreadcrumbs(null)
    }
  }, [setBreadcrumbs, user])

  const handleRefresh = useCallback(async () => {
    await fetchUser()
  }, [fetchUser])

  return (
    <PermissionGate
      permissions={["admin.users.read", "accounts.manage"]}
      fallback={
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don&apos;t have permission to view users.</p>
          </div>
        </div>
      }
    >
      <CopyProtectionWrapper className="min-h-screen bg-slate-50">
        <UserDetailsView user={user} loading={loading} error={error} onRefresh={handleRefresh} />
      </CopyProtectionWrapper>
    </PermissionGate>
  )
}

