"use client"

import { useEffect, useMemo, useState } from "react"
import { ActivityStatus, ActivityType } from "@prisma/client"
import { DEFAULT_OPEN_ACTIVITY_STATUS } from "@/lib/activity-status"
import { Loader2 } from "lucide-react"
import { useToasts } from "@/components/toast"
import { ModalHeader } from "@/components/ui/modal-header"

interface SelectOption {
  value: string
  label: string
}

interface ActivityNoteEditModalProps {
  isOpen: boolean
  activityId: string | null
  accountId?: string | null
  contactId?: string | null
  opportunityId?: string | null
  onClose: () => void
  onSuccess?: () => void
}

interface ActivityEditFormState {
  subject: string
  type: ActivityType
  status: ActivityStatus
  dueDate: string
  assigneeId: string
  location: string
  description: string
}

const TYPE_OPTIONS: SelectOption[] = Object.values(ActivityType).map(type => ({
  value: type,
  label: type.replace(/([A-Z])/g, " $1").trim()
}))

const STATUS_OPTIONS: SelectOption[] = Object.values(ActivityStatus).map(status => ({
  value: status,
  label: status.replace(/([A-Z])/g, " $1").trim()
}))

const createInitialForm = (): ActivityEditFormState => ({
  subject: "",
  type: ActivityType.Call,
  status: DEFAULT_OPEN_ACTIVITY_STATUS,
  dueDate: "",
  assigneeId: "",
  location: "",
  description: ""
})

export function ActivityNoteEditModal({ isOpen, activityId, accountId, contactId, opportunityId, onClose, onSuccess }: ActivityNoteEditModalProps) {
  const [form, setForm] = useState<ActivityEditFormState>(() => createInitialForm())
  const [owners, setOwners] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const { showError, showSuccess } = useToasts()

  useEffect(() => {
    if (!isOpen) {
      setForm(createInitialForm())
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    fetch("/api/admin/users?limit=100&status=Active", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load owners")
        }
        const payload = await response.json().catch(() => null)
        const items = Array.isArray(payload?.data?.users) ? payload.data.users : []
        setOwners(items.map((user: any) => ({ value: user.id, label: user.fullName || user.email })))
      })
      .catch(() => {
        setOwners([])
        showError("Unable to load owners", "Please try again later")
      })
  }, [isOpen, showError])

  useEffect(() => {
    if (!isOpen || !activityId) {
      return
    }

    setFetching(true)
    fetch(`/api/activities/${activityId}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = payload?.error ?? "Failed to load activity details"
          throw new Error(message)
        }
        const payload = await response.json().catch(() => null)
        const data = payload?.data
        if (!data) {
          throw new Error("Activity data unavailable")
        }

        const dueDateValue = data.dueDate ? new Date(data.dueDate) : null
        const formattedDate = dueDateValue && !Number.isNaN(dueDateValue.getTime())
          ? dueDateValue.toISOString().slice(0, 10)
          : ""

        setForm({
          subject: data.subject || "",
          type: (data.type as ActivityType) || ActivityType.Call,
          status: (data.status as ActivityStatus) || DEFAULT_OPEN_ACTIVITY_STATUS,
          dueDate: formattedDate,
          assigneeId: data.assigneeId || "",
          location: data.location || "",
          description: data.description || ""
        })
      })
      .catch(error => {
        console.error(error)
        showError("Unable to load activity", error instanceof Error ? error.message : "Please try again later")
        onClose()
      })
      .finally(() => setFetching(false))
  }, [isOpen, activityId, onClose, showError])

  const canSubmit = useMemo(() => form.subject.trim().length > 0, [form.subject])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activityId || !canSubmit) {
      return
    }

    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        subject: form.subject.trim(),
        type: form.type,
        status: form.status,
        location: form.location.trim() || null,
        assigneeId: form.assigneeId.trim() || null,
        description: form.description.trim() || null,
        accountId: accountId ?? null,
        contactId: contactId ?? null,
        opportunityId: opportunityId ?? null
      }

      if (form.dueDate) {
        payload.dueDate = form.dueDate
      } else {
        payload.dueDate = null
      }

      const response = await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        const message = errorPayload?.error ?? "Failed to update activity"
        throw new Error(message)
      }

      showSuccess("Activity updated", "The activity changes have been saved.")
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error("Failed to update activity", error)
      showError("Unable to update activity", error instanceof Error ? error.message : "Please try again later")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl">
        <ModalHeader kicker="Edit Activity" title="Update Activity & Note" />

        {fetching ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            <p className="text-sm text-gray-500">Loading activity details...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Subject<span className="ml-1 text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={event => setForm(prev => ({ ...prev, subject: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Activity Type</label>
                <select
                  value={form.type}
                  onChange={event => setForm(prev => ({ ...prev, type: event.target.value as ActivityType }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  disabled={loading}
                >
                  {TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={form.status}
                  onChange={event => setForm(prev => ({ ...prev, status: event.target.value as ActivityStatus }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  disabled={loading}
                >
                  {STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Activity Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={event => setForm(prev => ({ ...prev, dueDate: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Owner</label>
                <select
                  value={form.assigneeId}
                  onChange={event => setForm(prev => ({ ...prev, assigneeId: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  disabled={loading}
                >
                  <option value="">Unassigned</option>
                  {owners.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={event => setForm(prev => ({ ...prev, location: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Description & Notes</label>
              <textarea
                value={form.description}
                onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                className="h-32 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Add activity notes or updates"
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
