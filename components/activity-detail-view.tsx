"use client"

import Link from "next/link"
import { ArrowLeft, Calendar, Clock, Loader2, MapPin, Paperclip, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export interface ActivityAttachmentSummary {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  uploadedAt?: string | Date
  uploadedByName?: string
}

export interface ActivityContextLink {
  id: string
  entityType: string
  entityId: string
  isPrimary: boolean
}

export interface ActivityDetailRecord {
  id: string
  subject: string
  description: string | null
  dueDate: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
  status: string
  type: string
  location: string | null
  accountId: string | null
  accountName: string | null
  contactId: string | null
  contactName: string | null
  opportunityId: string | null
  opportunityName: string | null
  revenueScheduleId: string | null
  revenueScheduleNumber: string | null
  assigneeId: string | null
  assigneeName: string | null
  creatorName: string
  attachments: ActivityAttachmentSummary[]
  active: boolean
  links: ActivityContextLink[]
}

interface ActivityDetailViewProps {
  activity: ActivityDetailRecord | null
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
}

const STATUS_STYLES: Record<string, string> = {
  Open: "bg-blue-50 text-blue-700 border border-blue-200",
  InProgress: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Cancelled: "bg-rose-50 text-rose-700 border border-rose-200",
  Deferred: "bg-amber-50 text-amber-700 border border-amber-200"
}

function formatDate(value?: string | Date | null, withTime = false) {
  if (!value) return "--"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  const options: Intl.DateTimeFormatOptions = withTime
    ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric" }
  return new Intl.DateTimeFormat("en-US", options).format(date)
}

function formatFileSize(bytes: number) {
  if (!bytes) return "--"
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${bytes} B`
}

function AttachmentList({ activityId, attachments }: { activityId: string; attachments: ActivityAttachmentSummary[] }) {
  if (!attachments?.length) {
    return <p className="text-sm text-gray-500">No attachments uploaded for this activity.</p>
  }

  return (
    <div className="grid gap-3">
      {attachments.map(attachment => (
        <div
          key={attachment.id}
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Paperclip className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900" title={attachment.fileName}>
                {attachment.fileName}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(attachment.fileSize)} - Uploaded {formatDate(attachment.uploadedAt, true)}
                {attachment.uploadedByName ? ` - ${attachment.uploadedByName}` : ""}
              </p>
            </div>
          </div>
          <a
            href={`/api/activities/${activityId}/attachments/${attachment.id}`}
            className="rounded-full border border-primary-200 px-3 py-1 text-sm font-medium text-primary-600 transition hover:border-primary-300 hover:bg-primary-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </a>
        </div>
      ))}
    </div>
  )
}

function ContextLinks({ activity }: { activity: ActivityDetailRecord }) {
  const contexts: Array<{ label: string; value: string | null; href?: string }> = [
    {
      label: "Account",
      value: activity.accountName,
      href: activity.accountId ? `/accounts/${activity.accountId}` : undefined
    },
    {
      label: "Contact",
      value: activity.contactName,
      href: activity.contactId ? `/contacts/${activity.contactId}` : undefined
    },
    {
      label: "Opportunity",
      value: activity.opportunityName,
      href: activity.opportunityId ? `/opportunities/${activity.opportunityId}` : undefined
    },
    {
      label: "Revenue Schedule",
      value: activity.revenueScheduleNumber,
      href: activity.revenueScheduleId ? `/revenue-schedules/${activity.revenueScheduleId}` : undefined
    }
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">Linked Records</h3>
        <p className="text-xs text-gray-500">Entities associated with this activity.</p>
      </div>
      <dl className="grid gap-4 px-6 py-5">
        {contexts.map(({ label, value, href }) => (
          <div key={label} className="grid gap-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="text-sm text-gray-900">
              {value ? (
                href ? (
                  <Link href={href} className="text-primary-600 transition hover:text-primary-700">
                    {value}
                  </Link>
                ) : (
                  value
                )
              ) : (
                <span className="text-gray-400">Not linked</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function ActivityDetailView({ activity, loading, error, onRefresh }: ActivityDetailViewProps) {
  const router = useRouter()

  const handleBack = () => {
    router.push("/activities")
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        <span className="ml-2 text-sm text-gray-500">Loading activity…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={onRefresh}
          className="rounded-full border border-primary-300 px-4 py-1.5 text-sm font-medium text-primary-600 hover:border-primary-400 hover:bg-primary-50"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-sm text-gray-500">
        Activity details are not available.
      </div>
    )
  }

  const statusStyle = STATUS_STYLES[activity.status] ?? "bg-gray-100 text-gray-700 border border-gray-200"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:text-primary-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Activities
        </button>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn("rounded-full px-3 py-1 font-semibold", statusStyle)}>{activity.status}</span>
          <span className="rounded-full border border-gray-200 px-3 py-1 text-gray-600">{activity.type}</span>
          <span className="rounded-full border border-gray-200 px-3 py-1 text-gray-600">
            {activity.active ? "Active" : "Completed"}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <h1 className="text-xl font-semibold text-gray-900">{activity.subject}</h1>
          <p className="mt-1 text-sm text-gray-500">Created {formatDate(activity.createdAt, true)} by {activity.creatorName}</p>
        </div>
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Activity Summary</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>Due {formatDate(activity.dueDate || activity.createdAt, true)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <User className="h-4 w-4 text-gray-500" />
                  <span>Assigned to {activity.assigneeName ?? "Unassigned"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span>Updated {formatDate(activity.updatedAt, true)}</span>
                </div>
                {activity.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span>{activity.location}</span>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Description</h2>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {activity.description ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">{activity.description}</pre>
                ) : (
                  <span className="text-gray-500">No description provided.</span>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Attachments</h2>
              <AttachmentList activityId={activity.id} attachments={activity.attachments} />
            </section>
          </div>

          <div className="space-y-6">
            <ContextLinks activity={activity} />
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-sm font-semibold text-gray-900">Audit</h3>
                <p className="text-xs text-gray-500">Key lifecycle events for this activity.</p>
              </div>
              <dl className="grid gap-4 px-6 py-5">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-900">{formatDate(activity.createdAt, true)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Updated</dt>
                  <dd className="text-sm text-gray-900">{formatDate(activity.updatedAt, true)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Created By</dt>
                  <dd className="text-sm text-gray-900">{activity.creatorName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned To</dt>
                  <dd className="text-sm text-gray-900">{activity.assigneeName ?? "Unassigned"}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

