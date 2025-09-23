"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ContactDetailsView, ContactDetail } from "@/components/contact-details-view"
import { CopyProtectionWrapper } from "@/components/copy-protection"

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

  useEffect(() => {
    if (!contactId) {
      setContact(null)
      setLoading(false)
      setError("Contact id is missing")
      return
    }

    const controller = new AbortController()

    async function loadContactDetail() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/contacts/${contactId}`, {
          signal: controller.signal,
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
        if (controller.signal.aborted) return
        console.error(err)
        const message = err instanceof Error ? err.message : "Unable to load contact details"
        setContact(null)
        setError(message)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadContactDetail()

    return () => {
      controller.abort()
    }
  }, [contactId])

  const handleBack = () => {
    router.push("/contacts")
  }

  const handleContactUpdated = (updatedContact: ContactDetail) => {
    setContact(updatedContact)
  }

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <ContactDetailsView 
        contact={contact} 
        loading={loading} 
        error={error} 
        onBack={handleBack}
        onContactUpdated={handleContactUpdated}
      />
    </CopyProtectionWrapper>
  )
}
