"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { TicketDetailsView, type TicketDetailRecord } from "@/components/ticket-details-view"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"

export default function TicketDetailPage() {
  const params = useParams()

  const ticketId = useMemo(() => {
    const value = (params as any)?.ticketId
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return value[0]
    return ""
  }, [params])

  const [ticket, setTicket] = useState<TicketDetailRecord | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { setBreadcrumbs } = useBreadcrumbs()

  const fetchTicket = useCallback(
    async (signal?: AbortSignal) => {
      if (!ticketId) {
        setTicket(null)
        setError("Ticket id is missing")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
          cache: "no-store",
          signal
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = payload?.error ?? "Unable to load ticket details"
          throw new Error(message)
        }

        const payload = await response.json().catch(() => null)
        const detail: TicketDetailRecord | null = payload?.data ?? null
        setTicket(detail)
      } catch (err) {
        if (signal?.aborted) {
          return
        }
        console.error(err)
        const message = err instanceof Error ? err.message : "Unable to load ticket details"
        setTicket(null)
        setError(message)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [ticketId]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchTicket(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchTicket])

  useEffect(() => {
    if (ticket) {
      const label = ticket.ticketNumber || ticket.issue || "Ticket"
      setBreadcrumbs([
        { name: "Home", href: "/dashboard" },
        { name: "Tickets", href: "/tickets" },
        { name: "Ticket Details", href: `/tickets/${ticket.id}` },
        { name: label, current: true }
      ])
    } else if (ticketId) {
      setBreadcrumbs([
        { name: "Home", href: "/dashboard" },
        { name: "Tickets", href: "/tickets" },
        { name: "Ticket Details", href: `/tickets/${ticketId}` },
        { name: error ? "Not Found" : "Loading", current: true }
      ])
    } else {
      setBreadcrumbs(null)
    }

    return () => {
      setBreadcrumbs(null)
    }
  }, [ticket, ticketId, error, setBreadcrumbs])

  const handleRefresh = useCallback(async () => {
    await fetchTicket()
  }, [fetchTicket])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <TicketDetailsView
        ticket={ticket}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
      />
    </CopyProtectionWrapper>
  )
}

