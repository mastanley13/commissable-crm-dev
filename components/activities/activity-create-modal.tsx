"use client"

import { useEffect, useMemo, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { ActivityStatus, ActivityType } from '@prisma/client'
import { DEFAULT_OPEN_ACTIVITY_STATUS } from '@/lib/activity-status'
import { useToasts } from '@/components/toast'

interface Option {
  value: string
  label: string
}

interface ActivityCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (activityId: string) => void
  defaultAccountId?: string
  defaultAccountName?: string
}

interface FormState {
  subject: string
  type: ActivityType
  dueDate: string
  assigneeId: string
  description: string
  location: string
  accountId: string
  accountName: string
  contactId: string
  contactName: string
  status: ActivityStatus
}

function buildInitialActivityForm(defaultAccountId?: string, defaultAccountName?: string): FormState {
  return {
    subject: '',
    type: ActivityType.Call,
    dueDate: '',
    assigneeId: '',
    description: '',
    location: '',
    accountId: defaultAccountId ?? '',
    accountName: defaultAccountName ?? '',
    contactId: '',
    contactName: '',
    status: DEFAULT_OPEN_ACTIVITY_STATUS
  }
}

interface SearchResult {
  id: string
  title: string
  subtitle: string
}

const TYPE_OPTIONS: Option[] = Object.values(ActivityType).map(type => ({
  value: type,
  label: type
}))

export function ActivityCreateModal({ isOpen, onClose, onCreated, defaultAccountId, defaultAccountName }: ActivityCreateModalProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialActivityForm(defaultAccountId, defaultAccountName))
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [userOptions, setUserOptions] = useState<Option[]>([])
  const [accountResults, setAccountResults] = useState<SearchResult[]>([])
  const [contactResults, setContactResults] = useState<SearchResult[]>([])
  const [accountQuery, setAccountQuery] = useState('')
  const [contactQuery, setContactQuery] = useState('')

  const { showSuccess, showError } = useToasts()

  useEffect(() => {
    if (!isOpen) return
    async function loadUsers() {
      try {
        const response = await fetch('/api/admin/users?limit=50', { cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json()
        if (Array.isArray(payload?.data?.users)) {
          setUserOptions(
            payload.data.users.map((user: any) => ({
              value: user.id,
              label: user.fullName || user.email
            }))
          )
        }
      } catch (error) {
        console.warn('Failed to fetch user options', error)
      }
    }
    loadUsers()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setAccountQuery('')
      setContactQuery('')
      setAccountResults([])
      setContactResults([])
      setAttachmentFiles([])
      return
    }

    setForm(buildInitialActivityForm(defaultAccountId, defaultAccountName))
    setAccountQuery('')
    setContactQuery('')
    setAccountResults([])
    setContactResults([])
    setAttachmentFiles([])
  }, [isOpen, defaultAccountId, defaultAccountName])

  useEffect(() => {
    const controller = new AbortController()
    async function searchAccounts() {
      if (!accountQuery || accountQuery.length < 2) {
        setAccountResults([])
        return
      }
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(accountQuery)}&limit=5`, { signal: controller.signal })
        if (!response.ok) return
        const payload = await response.json()
        if (Array.isArray(payload?.suggestions)) {
          const accounts = payload.suggestions.filter((entry: any) => entry.type === 'Account')
          setAccountResults(accounts)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.warn('Account search failed', error)
      }
    }
    searchAccounts()
    return () => controller.abort()
  }, [accountQuery])

  useEffect(() => {
    const controller = new AbortController()
    async function searchContacts() {
      if (!contactQuery || contactQuery.length < 2) {
        setContactResults([])
        return
      }
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(contactQuery)}&limit=5`, { signal: controller.signal })
        if (!response.ok) return
        const payload = await response.json()
        if (Array.isArray(payload?.suggestions)) {
          const contacts = payload.suggestions.filter((entry: any) => entry.type === 'Contact')
          setContactResults(contacts)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.warn('Contact search failed', error)
      }
    }
    searchContacts()
    return () => controller.abort()
  }, [contactQuery])

  const isValid = useMemo(() => form.subject.trim().length > 0, [form.subject])

  function resetForm() {
    setForm(buildInitialActivityForm(defaultAccountId, defaultAccountName))
    setAttachmentFiles([])
    setAccountQuery('')
    setContactQuery('')
    setAccountResults([])
    setContactResults([])
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValid) {
      showError('Validation error', 'Subject is required')
      return
    }

    setLoading(true)
    try {
      const payload = {
        subject: form.subject.trim(),
        type: form.type,
        dueDate: form.dueDate || null,
        assigneeId: form.assigneeId || null,
        description: form.description || null,
        location: form.location || null,
        status: form.status,
        accountId: form.accountId || null,
        contactId: form.contactId || null
      }

      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? 'Failed to create activity')
      }

      const { data } = await response.json()
      const activityId: string | undefined = data?.id

      if (!activityId) {
        throw new Error("Activity creation failed - no activity ID returned")
      }

      if (attachmentFiles.length > 0) {
        const formData = new FormData()
        attachmentFiles.forEach(file => formData.append('files', file))
        await fetch(`/api/activities/${activityId}/attachments`, {
          method: 'POST',
          body: formData
        })
      }

      showSuccess('Activity created', 'The activity has been created successfully.')
      resetForm()
      onCreated(activityId)
      onClose()
    } catch (error) {
      console.error('Failed to create activity', error)
      showError('Unable to create activity', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-5xl h-[900px] flex flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Create Activity</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 px-6 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Subject<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.subject}
                onChange={event => setForm(prev => ({ ...prev, subject: event.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Activity Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={event => setForm(prev => ({ ...prev, dueDate: event.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Activity Type</label>
              <select
                value={form.type}
                onChange={event => setForm(prev => ({ ...prev, type: event.target.value as ActivityType }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Owner</label>
              <select
                value={form.assigneeId}
                onChange={event => setForm(prev => ({ ...prev, assigneeId: event.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Unassigned</option>
                {userOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Description</label>
              <textarea
                value={form.description}
                onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={event => setForm(prev => ({ ...prev, location: event.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</label>
              <select
                value={form.status}
                onChange={event => setForm(prev => ({ ...prev, status: event.target.value as ActivityStatus }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {Object.values(ActivityStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Account</label>
              <input
                type="text"
                value={accountQuery || form.accountName}
                onChange={event => {
                  setAccountQuery(event.target.value)
                  setForm(prev => ({ ...prev, accountId: '', accountName: '' }))
                }}
                placeholder="Search accounts..."
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {accountResults.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white shadow">
                  {accountResults.map(result => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, accountId: result.id, accountName: result.title }))
                        setAccountQuery(result.title)
                        setAccountResults([])
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                    >
                      <div className="font-medium text-gray-900">{result.title}</div>
                      {result.subtitle && <div className="text-xs text-gray-500">{result.subtitle}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Contact</label>
              <input
                type="text"
                value={contactQuery || form.contactName}
                onChange={event => {
                  setContactQuery(event.target.value)
                  setForm(prev => ({ ...prev, contactId: '', contactName: '' }))
                }}
                placeholder="Search contacts..."
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {contactResults.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white shadow">
                  {contactResults.map(result => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, contactId: result.id, contactName: result.title }))
                        setContactQuery(result.title)
                        setContactResults([])
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                    >
                      <div className="font-medium text-gray-900">{result.title}</div>
                      {result.subtitle && <div className="text-xs text-gray-500">{result.subtitle}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Attachments</label>
              <input
                type="file"
                multiple
                onChange={event => setAttachmentFiles(event.target.files ? Array.from(event.target.files) : [])}
                className="mt-1 w-full text-sm text-gray-600"
              />
              {attachmentFiles.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">{attachmentFiles.length} file(s) selected.</p>
              )}
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
              onClick={() => { resetForm(); onClose() }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              disabled={loading || !isValid}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Activity
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
