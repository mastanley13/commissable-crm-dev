import { reportsData } from "@/lib/mock-data"

export type ReportRecord = {
  id: string
  reportName: string
  reportType: string
  createdDate: string
  lastRun: string | null
  status: string
  description?: string | null
  active: boolean
}

let inMemoryReports: ReportRecord[] = reportsData.map(report => ({
  id: String((report as any).id),
  reportName: (report as any).reportName ?? "",
  reportType: (report as any).reportType ?? "",
  createdDate: (report as any).createdDate ?? "",
  lastRun: (report as any).lastRun ?? null,
  status: (report as any).status ?? "Completed",
  description: (report as any).description ?? null,
  active: typeof (report as any).active === "boolean" ? (report as any).active : true,
}))

export function listReports(): ReportRecord[] {
  return [...inMemoryReports]
}

export function getReportById(reportId: string): ReportRecord | null {
  const id = String(reportId ?? "").trim()
  if (!id) return null
  return inMemoryReports.find(report => report.id === id) ?? null
}

export function createReport(input: { reportName: string; reportType: string; description?: string | null }): ReportRecord {
  const now = new Date()
  const createdDate = now.toISOString().slice(0, 10)
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}`

  const report: ReportRecord = {
    id,
    reportName: input.reportName,
    reportType: input.reportType,
    createdDate,
    lastRun: null,
    status: "Draft",
    description: input.description ?? null,
    active: true,
  }

  inMemoryReports = [report, ...inMemoryReports]
  return report
}

export function updateReport(
  reportId: string,
  patch: Partial<Pick<ReportRecord, "reportName" | "reportType" | "status" | "description" | "lastRun" | "active">>
): ReportRecord | null {
  const id = String(reportId ?? "").trim()
  if (!id) return null

  let updated: ReportRecord | null = null

  inMemoryReports = inMemoryReports.map(report => {
    if (report.id !== id) return report
    const next: ReportRecord = { ...report, ...patch }

    if (typeof patch.active === "boolean" && typeof patch.status !== "string") {
      const isInactiveStatus = String(next.status ?? "").toLowerCase() === "inactive"
      if (patch.active === false && !isInactiveStatus) {
        next.status = "Inactive"
      } else if (patch.active === true && isInactiveStatus) {
        next.status = "Completed"
      }
    }

    updated = next
    return next
  })

  return updated
}

export function deleteReport(reportId: string): boolean {
  const id = String(reportId ?? "").trim()
  if (!id) return false
  const before = inMemoryReports.length
  inMemoryReports = inMemoryReports.filter(report => report.id !== id)
  return inMemoryReports.length !== before
}

