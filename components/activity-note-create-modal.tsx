"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Paperclip, X } from "lucide-react"
import { ActivityStatus, ActivityType } from "@prisma/client"
import { DEFAULT_OPEN_ACTIVITY_STATUS } from "@/lib/activity-status"
import { useToasts } from "@/components/toast"
import { useAuth } from "@/lib/auth-context"

interface SelectOption {
  value: string
  label: string
}

interface ActivityNoteFormState {
  activitySubject: string
  activityType: ActivityType
  activityStatus: ActivityStatus
  activityDate: string
  activityOwner: string
  createdById: string
  location: string
  activityDescription: string
  noteTitle: string
  noteBody: string
  shareWithTeam: boolean
}

interface PendingAttachment {
  id: string
  file: File
}

const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024 // 15MB
const MAX_ATTACHMENTS = 5

function generateAttachmentId() {
  const random = Math.random().toString(36).slice(2, 10)
  const timestamp = Date.now().toString(36)
  return `${timestamp}-${random}`
}
export interface ActivityNoteCreateModalProps {
  isOpen: boolean
  context: "account" | "contact"
  entityName?: string
  accountId?: string
  contactId?: string
  onClose: () => void
  onSuccess?: () => void
}

const TYPE_OPTIONS: SelectOption[] = Object.values(ActivityType).map(type => ({
  value: type,
  label: type.replace(/([A-Z])/g, " $1").trim()
}))

const STATUS_OPTIONS: SelectOption[] = Object.values(ActivityStatus).map(status => ({
  value: status,
  label: status.replace(/([A-Z])/g, " $1").trim()
}))

function todayLocalYMD() {
  const now = new Date()
  const tzOffsetMs = now.getTimezoneOffset() * 60000
  const local = new Date(now.getTime() - tzOffsetMs)
  return local.toISOString().split("T")[0]
}

const createInitialState = (): ActivityNoteFormState => ({
  activitySubject: "",
  activityType: ActivityType.Call,
  activityStatus: DEFAULT_OPEN_ACTIVITY_STATUS,
  activityDate: todayLocalYMD(),
  activityOwner: "",
  createdById: "",
  location: "",
  activityDescription: "",
  noteTitle: "",
  noteBody: "",
  shareWithTeam: true
})

export function ActivityNoteCreateModal({ isOpen, context, entityName, accountId, contactId, onClose, onSuccess }: ActivityNoteCreateModalProps) {
  const [form, setForm] = useState<ActivityNoteFormState>(() => createInitialState())
  const [loading, setLoading] = useState(false)
  const [ownerOptions, setOwnerOptions] = useState<SelectOption[]>([])
  const [ownersLoading, setOwnersLoading] = useState(false)
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { showError, showSuccess } = useToasts()
  const { user } = useAuth()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm(createInitialState())
    setAttachments([])
  }, [isOpen])

  // Default Created By to current user when options/auth are available
  useEffect(() => {
    if (!isOpen) return
    if (!user?.id) return
    setForm(prev => (prev.createdById ? prev : { ...prev, createdById: user.id }))
  }, [isOpen, user?.id])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let cancelled = false

    async function loadOwners() {
      setOwnersLoading(true)
      try {
        const response = await fetch("/api/admin/users?limit=100", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Request failed")
        }
        const payload = await response.json().catch(() => null)
        const users: any[] = Array.isArray(payload?.data?.users) ? payload.data.users : []
        if (cancelled) return
        const options = users.map(user => ({
          value: user.id,
          label: user.fullName || user.email
        }))
        setOwnerOptions(options)
        setForm(prev => (prev.activityOwner || !options[0]
          ? prev
          : { ...prev, activityOwner: options[0].value }))
      } catch (error) {
        if (!cancelled) {
          setOwnerOptions([])
        }
      } finally {
        if (!cancelled) {
          setOwnersLoading(false)
        }
      }
    }

    loadOwners()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }
    if (bytes >= 1024) {
      return `${Math.round(bytes / 1024)} KB`
    }
    return `${bytes} B`
  }

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) {
      return
    }

    const existingKeys = new Set(attachments.map(item => `${item.file.name}:${item.file.size}`))
    const next: PendingAttachment[] = []
    const rejected: string[] = []
    let limitReached = false

    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        rejected.push(`${file.name} (${formatFileSize(file.size)})`)
        continue
      }

      if (attachments.length + next.length >= MAX_ATTACHMENTS) {
        limitReached = true
        break
      }

      const key = `${file.name}:${file.size}`
      if (existingKeys.has(key)) {
        continue
      }

      next.push({ id: generateAttachmentId(), file })
    }

    if (rejected.length) {
      showError("Attachment too large", `The following files exceed the ${formatFileSize(MAX_ATTACHMENT_SIZE)} limit: ${rejected.join(", ")}`)
    }

    if (limitReached) {
      showError("Attachment limit reached", `You can upload up to ${MAX_ATTACHMENTS} files per activity.`)
    }

    if (next.length) {
      setAttachments(prev => [...prev, ...next])
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(item => item.id !== id))
  }

  const headerTitle = context === "account" ? "Log Activity / Note for Account" : "Log Activity / Note for Contact"
  const subtitle = entityName ? `${context === "account" ? "Account" : "Contact"}: ${entityName}` : undefined

  const canSubmit = useMemo(() => {
    if (!form.activitySubject.trim()) return false
    if (!accountId && context === "account") return false
    if (!contactId && context === "contact") return false
    return true
  }, [accountId, contactId, context, form.activitySubject])

  const handleClose = () => {
    setForm(createInitialState())
    setAttachments([])
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      showError("Missing information", "Please complete the required fields before saving.")
      return
    }

    const descriptionSegments: string[] = []
    if (form.activityDescription.trim()) {
      descriptionSegments.push(form.activityDescription.trim())
    }
    if (form.noteTitle.trim() || form.noteBody.trim()) {
      const noteLines: string[] = []
      if (form.noteTitle.trim()) {
        noteLines.push(`Note: ${form.noteTitle.trim()}`)
      }
      if (form.noteBody.trim()) {
        noteLines.push(form.noteBody.trim())
      }
      if (!form.shareWithTeam) {
        noteLines.push("Visibility: Private to owner")
      }
      descriptionSegments.push(noteLines.join("\n"))
    }

    const payload = {
      subject: form.activitySubject.trim(),
      type: form.activityType,
      status: form.activityStatus,
      dueDate: form.activityDate || null,
      assigneeId: form.activityOwner || null,
      location: form.location.trim() || null,
      description: descriptionSegments.length ? descriptionSegments.join("\n\n") : null,
      accountId: accountId ?? null,
      contactId: contactId ?? null,
      creatorId: form.createdById || null
    }

    setLoading(true)
    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      const responsePayload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = responsePayload?.error ?? "Unable to create activity"
        throw new Error(message)
      }

      const activityId: string | undefined = responsePayload?.data?.id

      let attachmentError: string | null = null

      if (attachments.length > 0) {
        if (!activityId) {
          attachmentError = "Activity identifier missing; attachments were not uploaded"
        } else {
          const formData = new FormData()
          attachments.forEach(item => {
            formData.append("files", item.file)
          })

          const uploadResponse = await fetch(`/api/activities/${activityId}/attachments`, {
            method: "POST",
            body: formData
          })

          if (!uploadResponse.ok) {
            const uploadPayload = await uploadResponse.json().catch(() => null)
            attachmentError = uploadPayload?.error ?? "Attachments failed to upload"
          }
        }
      }

      if (attachmentError) {
        showSuccess("Activity logged", context === "account" ? "The activity has been added to this account." : "The activity has been added for this contact.")
        showError("Attachments not uploaded", `${attachmentError}. The activity was saved without files.`)
      } else {
        const successMessage = attachments.length > 0
          ? "The activity and attachments have been saved."
          : (context === "account"
            ? "The activity has been added to this account."
            : "The activity has been added for this contact.")
        showSuccess("Activity logged", successMessage)
      }

      onSuccess?.()
      handleClose()
    } catch (error) {
      console.error("Failed to create activity", error)
      showError("Unable to create activity", error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Create Activity & Note</p>
            <h2 className="text-lg font-semibold text-gray-900">{headerTitle}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Activity Details</h3>
                <p className="text-xs text-gray-500">Capture the interaction details you want to log.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Subject<span className="ml-1 text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.activitySubject}
                    onChange={(event) => setForm(prev => ({ ...prev, activitySubject: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Discovery follow-up"
                    required
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Activity Type</label>
                    <select
                      value={form.activityType}
                      onChange={event => setForm(prev => ({ ...prev, activityType: event.target.value as ActivityType }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {TYPE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={form.activityStatus}
                      onChange={event => setForm(prev => ({ ...prev, activityStatus: event.target.value as ActivityStatus }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Activity Date</label>
                    <input
                      type="date"
                      value={form.activityDate}
                      onChange={event => setForm(prev => ({ ...prev, activityDate: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Assigned Owner</label>
                    <select
                      value={form.activityOwner}
                      onChange={event => setForm(prev => ({ ...prev, activityOwner: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={ownersLoading}
                    >
                      <option value="">{ownersLoading ? "Loading owners..." : "Select owner"}</option>
                      {ownerOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Created By</label>
                  <select
                    value={form.createdById}
                    onChange={event => setForm(prev => ({ ...prev, createdById: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={ownersLoading}
                  >
                    <option value="">{ownersLoading ? "Loading users..." : (user?.id ? "Current user" : "Select user")}</option>
                    {ownerOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={event => setForm(prev => ({ ...prev, location: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Virtual call"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={3}
                    value={form.activityDescription}
                    onChange={event => setForm(prev => ({ ...prev, activityDescription: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Share any relevant details discussed."
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Note Details</h3>
                <p className="text-xs text-gray-500">Use notes to capture follow-ups or customer context.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Note Title</label>
                  <input
                    type="text"
                    value={form.noteTitle}
                    onChange={event => setForm(prev => ({ ...prev, noteTitle: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Next steps or summary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Note Details</label>
                  <textarea
                    rows={8}
                    value={form.noteBody}
                    onChange={event => setForm(prev => ({ ...prev, noteBody: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Document key discussion points, blockers, or commitments."
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.shareWithTeam}
                    onChange={event => setForm(prev => ({ ...prev, shareWithTeam: event.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>Share note with the broader team</span>
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Attachments</label>
                  <span className="text-xs text-gray-500">{attachments.length}/{MAX_ATTACHMENTS} attached</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelection}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-full border border-dashed border-primary-300 px-4 py-2 text-sm font-medium text-primary-600 transition hover:border-primary-400 hover:text-primary-700"
                  disabled={loading || attachments.length >= MAX_ATTACHMENTS}
                >
                  <Paperclip className="h-4 w-4" />
                  {attachments.length >= MAX_ATTACHMENTS ? "Attachment limit reached" : "Add attachments"}
                </button>
                <p className="text-xs text-gray-500">Up to {MAX_ATTACHMENTS} files, {formatFileSize(MAX_ATTACHMENT_SIZE)} max each.</p>

                {attachments.length > 0 && (
                  <ul className="space-y-2">
                    {attachments.map(item => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
                          <Paperclip className="h-4 w-4 flex-shrink-0 text-primary-500" />
                          <span className="truncate" title={item.file.name}>{item.file.name}</span>
                          <span className="flex-shrink-0 text-xs text-gray-500">{formatFileSize(item.file.size)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(item.id)}
                          className="rounded-full p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                          aria-label={`Remove ${item.file.name}`}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
              disabled={loading || !canSubmit}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Activity & Note
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


