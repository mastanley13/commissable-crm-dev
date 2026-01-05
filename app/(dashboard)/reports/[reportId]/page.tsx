"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"

type ReportDetail = {
  id: string
  reportName: string
  reportType: string
  createdDate: string
  lastRun: string | null
  status: string
  description?: string | null
  active: boolean
}

export default function ReportDetailPage() {
  const params = useParams()
  const { setBreadcrumbs } = useBreadcrumbs()

  const reportId = useMemo(() => {
    const value = (params as any)?.reportId
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return value[0]
    return ""
  }, [params])

  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(
    async (signal?: AbortSignal) => {
      if (!reportId) {
        setReport(null)
        setError("Report id is missing")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/reports/${reportId}`, {
          cache: "no-store",
          signal,
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? "Unable to load report details")
        }

        const payload = await response.json().catch(() => null)
        const detail: ReportDetail | null = payload?.data ?? null
        setReport(detail)
      } catch (err) {
        if (signal?.aborted) return
        console.error(err)
        setReport(null)
        setError(err instanceof Error ? err.message : "Unable to load report details")
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [reportId],
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchReport(controller.signal)
    return () => controller.abort()
  }, [fetchReport])

  useEffect(() => {
    if (report) {
      setBreadcrumbs([
        { name: "Home", href: "/dashboard" },
        { name: "Reports", href: "/reports" },
        { name: report.reportName || "Report", current: true },
      ])
    } else if (reportId) {
      setBreadcrumbs([
        { name: "Home", href: "/dashboard" },
        { name: "Reports", href: "/reports" },
        { name: loading ? "Loading" : error ? "Not Found" : "Report", current: true },
      ])
    } else {
      setBreadcrumbs(null)
    }

    return () => {
      setBreadcrumbs(null)
    }
  }, [error, loading, report, reportId, setBreadcrumbs])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-900">{report?.reportName || "Report Details"}</h1>
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">
            Back to Reports
          </Link>
        </div>

        {loading ? (
          <div className="mt-4 rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">Loading report…</div>
        ) : error ? (
          <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : report ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Report Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.reportType || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.status || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.active ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Created Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.createdDate || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last Run</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.lastRun || "-"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{report.description || "-"}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </CopyProtectionWrapper>
  )
}

