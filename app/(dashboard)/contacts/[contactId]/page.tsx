"use client"

import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react"
import { useParams, useRouter } from "next/navigation"
import { ContactDetailsView, ContactDetail } from "@/components/contact-details-view"
import { ContactEditModal } from "@/components/contact-edit-modal"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const contactId = useMemo(() => {
    const value = params?.contactId
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return value[0]
    return ""
  }, [params])

  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [contactForEdit, setContactForEdit] = useState<ComponentProps<typeof ContactEditModal>["contact"]>(null)
  const { setBreadcrumbs } = useBreadcrumbs()

  const fetchContact = useCallback(
    async (signal?: AbortSignal) => {
      if (!contactId) {
        setContact(null)
        setError("Contact id is missing")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/contacts/${contactId}`, {
          signal,
          cache: "no-store"
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = payload?.error ?? "Unable to load contact details"
          throw new Error(message)
        }

        const payload = await response.json().catch(() => null)
        const detail = payload?.data ?? null
        setContact(detail)
      } catch (err) {
        if (signal?.aborted) return
        console.error(err)
        const message = err instanceof Error ? err.message : "Unable to load contact details"
        setContact(null)
        setError(message)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [contactId]
  )

  useEffect(() => {
    if (!contactId) {
      setContact(null)
      setLoading(false)
      setError("Contact id is missing")
      return
    }

    const controller = new AbortController()
    fetchContact(controller.signal)

    return () => {
      controller.abort()
    }
  }, [contactId, fetchContact])

  useEffect(() => {
    if (contact) {
      setBreadcrumbs([
        { name: 'Home', href: '/dashboard' },
        { name: 'Contacts', href: '/contacts' },
        { name: 'Contact Details', href: `/contacts/${contact.id}` },
        { name: contact.firstName ? `${contact.firstName} ${contact.lastName}`.trim() : contact.accountName || 'Contact', current: true }
      ])
    } else {
      setBreadcrumbs(null)
    }

    return () => {
      setBreadcrumbs(null)
    }
  }, [contact, setBreadcrumbs])


  const handleContactUpdated = (updatedContact: ContactDetail) => {
    setContact(updatedContact)
  }

  const composeFullName = useCallback((detail: ContactDetail) => {
    const first = detail.firstName?.trim() ?? ""
    const last = detail.lastName?.trim() ?? ""
    const combined = [first, last].filter(Boolean).join(" ")
    return combined || detail.accountName || ""
  }, [])

  const handleOpenEdit = useCallback((detail: ContactDetail) => {
    setContactForEdit({
      id: detail.id,
      suffix: detail.suffix ?? "",
      fullName: composeFullName(detail),
      jobTitle: detail.jobTitle ?? "",
      mobile: detail.mobilePhone ?? "",
      workPhone: detail.workPhone ?? "",
      emailAddress: detail.emailAddress ?? "",
      extension: detail.workPhoneExt ?? "",
      accountId: detail.accountId ?? "",
      accountName: detail.accountName ?? "",
      isPrimary: detail.isPrimary ?? false,
      active: detail.active
    })
    setShowEditModal(true)
  }, [composeFullName])

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false)
  }, [])

  const handleEditSuccess = useCallback(async () => {
    setShowEditModal(false)
    await fetchContact()
  }, [fetchContact])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <ContactDetailsView
        contact={contact}
        loading={loading}
        error={error}
        onEdit={handleOpenEdit}
        onContactUpdated={handleContactUpdated}
        onRefresh={fetchContact}
      />

      <ContactEditModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        onSuccess={handleEditSuccess}
        contact={contactForEdit}
      />
    </CopyProtectionWrapper>
  )
}
