"use client"

import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react"
import { useParams, useRouter } from "next/navigation"
import { AccountDetailsView, AccountDetail } from "@/components/account-details-view"
import { AccountEditModal } from "@/components/account-edit-modal"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"

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
  const [showEditModal, setShowEditModal] = useState(false)
  const [accountForEdit, setAccountForEdit] = useState<ComponentProps<typeof AccountEditModal>["account"]>(null)
  const { setBreadcrumbs } = useBreadcrumbs()

  const fetchAccount = useCallback(
    async (signal?: AbortSignal) => {
      if (!accountId) {
        setAccount(null)
        setError("Account id is missing")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/accounts/${accountId}`, {
          cache: "no-store",
          signal
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
        if (signal?.aborted) {
          return
        }
        console.error(err)
        const message = err instanceof Error ? err.message : "Unable to load account details"
        setAccount(null)
        setError(message)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [accountId]
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchAccount(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchAccount])

  useEffect(() => {
    if (account) {
      setBreadcrumbs([
        { name: 'Home', href: '/dashboard' },
        { name: 'Accounts', href: '/accounts' },
        { name: 'Account Details', href: `/accounts/${account.id}` },
        { name: account.accountName || 'Account', current: true }
      ])
    } else {
      setBreadcrumbs(null)
    }

    return () => {
      setBreadcrumbs(null)
    }
  }, [account, setBreadcrumbs])

  const handleRefresh = useCallback(async () => {
    await fetchAccount()
  }, [fetchAccount])

  const handleOpenEdit = useCallback(() => {
    if (!account) return

    setAccountForEdit({
      id: account.id,
      active: account.active,
      accountName: account.accountName ?? "",
      accountLegalName: account.accountLegalName ?? "",
      accountType: account.accountType ?? "",
      accountOwner: account.accountOwner ?? "",
      shippingState: account.shippingAddress?.state ?? "",
      shippingCity: account.shippingAddress?.city ?? "",
      shippingZip: account.shippingAddress?.postalCode ?? "",
      shippingStreet: account.shippingAddress?.line1 ?? "",
      shippingStreet2: account.shippingAddress?.shippingStreet2 ?? account.shippingAddress?.line2 ?? ""
    })
    setShowEditModal(true)
  }, [account])

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false)
  }, [])

  const handleEditSuccess = useCallback(() => {
    setShowEditModal(false)
    fetchAccount().catch(err => console.error(err))
  }, [fetchAccount])


  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <AccountDetailsView
        account={account}
        loading={loading}
        error={error}
        onEdit={handleOpenEdit}
        onRefresh={handleRefresh}
      />

      <AccountEditModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        onSuccess={handleEditSuccess}
        account={accountForEdit}
      />
    </CopyProtectionWrapper>
  )
}
