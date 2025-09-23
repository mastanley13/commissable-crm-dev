"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AccountDetailsView, AccountDetail } from "@/components/account-details-view"
import { CopyProtectionWrapper } from "@/components/copy-protection"

export default function AccountDetailPage() {
  const params = useParams()
  const router = useRouter()
  const accountId = useMemo(() => {
    const value = params?.accountId
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return value[0]
    return ""
  }, [params])

  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId) {
      setAccount(null)
      setLoading(false)
      setError("Account id is missing")
      return
    }

    const controller = new AbortController()

    async function loadAccountDetail() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/accounts/${accountId}`, {
          signal: controller.signal,
          cache: "no-store"
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = payload?.error ?? "Unable to load account details"
          throw new Error(message)
        }

        const payload = await response.json().catch(() => null)
        const detail = payload?.data ?? null
        setAccount(detail)
      } catch (err) {
        if (controller.signal.aborted) return
        console.error(err)
        const message = err instanceof Error ? err.message : "Unable to load account details"
        setAccount(null)
        setError(message)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadAccountDetail()

    return () => {
      controller.abort()
    }
  }, [accountId])

  const handleBack = () => {
    router.push("/accounts")
  }

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <AccountDetailsView account={account} loading={loading} error={error} onBack={handleBack} />
    </CopyProtectionWrapper>
  )
}
