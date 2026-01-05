"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useToasts } from "@/components/toast"

interface SelectOption {
  value: string
  label: string
}

interface UserCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (userId: string) => void
}

interface UserFormState {
  email: string
  password: string
  firstName: string
  lastName: string
  jobTitle: string
  department: string
  roleId: string
  status: string
}

const statusOptions: SelectOption[] = [
  { value: "Invited", label: "Invited" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Suspended", label: "Suspended" }
]

export function UserCreateModal({ isOpen, onClose, onCreated }: UserCreateModalProps) {
  const [form, setForm] = useState<UserFormState>({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    jobTitle: "",
    department: "",
    roleId: "",
    status: "Invited"
  })
  const [roles, setRoles] = useState<SelectOption[]>([])
  const [roleQuery, setRoleQuery] = useState("")
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [submitMode, setSubmitMode] = useState<"save" | "saveAndNew">("save")
  const { showError, showSuccess } = useToasts()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      jobTitle: "",
      department: "",
      roleId: "",
      status: "Invited"
    })
    setRoleQuery("")
    setSubmitMode("save")

    setOptionsLoading(true)
    fetch("/api/admin/roles", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load roles")
        }
        const payload = await response.json()
        const items = Array.isArray(payload?.data?.roles) ? payload.data.roles : []
        const roleOptions: SelectOption[] = items.map((roleItem: any) => ({
          value: roleItem.id,
          label: roleItem.name || roleItem.code
        }))
        setRoles(roleOptions)
        // Set first role as default if available
        if (roleOptions.length > 0) {
          setForm(prev => ({ ...prev, roleId: roleOptions[0].value }))
          setRoleQuery(roleOptions[0].label)
        }
      })
      .catch(() => {
        setRoles([])
        showError("Unable to load roles", "Please try again later")
      })
      .finally(() => setOptionsLoading(false))
  }, [isOpen, showError])

  const canSubmit = useMemo(() =>
    form.email.trim().length > 0 &&
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0,
    [form.email, form.firstName, form.lastName]
  )

  const filteredRoles = useMemo(() => {
    if (!roleQuery.trim()) return roles
    const q = roleQuery.toLowerCase()
    return roles.filter(r => r.label.toLowerCase().includes(q))
  }, [roles, roleQuery])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      showError("Missing information", "Email, first name, and last name are required.")
      return
    }

    setLoading(true)
    try {
      const payload: any = {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        status: form.status
      }

      if (form.password) {
        payload.password = form.password
      }

      if (form.jobTitle) {
        payload.jobTitle = form.jobTitle.trim()
      }

      if (form.department) {
        payload.department = form.department.trim()
      }

      if (form.roleId) {
        payload.roleId = form.roleId
      }

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? "Failed to create user")
      }

      const data = await response.json().catch(() => null)
      const userId: string | undefined = data?.data?.user?.id
      showSuccess("User created", "The user has been created successfully.")
      onCreated?.(userId ?? "")

      if (submitMode === "saveAndNew") {
        setForm(prev => ({
          ...prev,
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          jobTitle: "",
          department: ""
        }))
        setSubmitMode("save")
      } else {
        onClose()
      }
    } catch (error) {
      console.error("Failed to create user", error)
      showError(
        "Unable to create user",
        error instanceof Error ? error.message : "Unknown error"
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Create User</p>
            <h2 className="text-lg font-semibold text-gray-900">New User</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">First Name<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.firstName}
                onChange={event => setForm(prev => ({ ...prev, firstName: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Enter first name"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Last Name<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.lastName}
                onChange={event => setForm(prev => ({ ...prev, lastName: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Enter last name"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Email<span className="ml-1 text-red-500">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={event => setForm(prev => ({ ...prev, email: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Enter email address"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={event => setForm(prev => ({ ...prev, password: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Leave blank to send invitation"
                minLength={8}
              />
              <p className="mt-1 text-[10px] text-gray-500">If blank, user will receive an invitation email to set their password</p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Job Title</label>
              <input
                type="text"
                value={form.jobTitle}
                onChange={event => setForm(prev => ({ ...prev, jobTitle: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Enter job title"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={event => setForm(prev => ({ ...prev, department: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Enter department"
              />
            </div>
            <div className="relative">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Role</label>
              <input
                type="text"
                value={roleQuery}
                onChange={e => {
                  setRoleQuery(e.target.value)
                  setShowRoleDropdown(true)
                }}
                onFocus={() => setShowRoleDropdown(true)}
                onBlur={() => setTimeout(() => setShowRoleDropdown(false), 200)}
                placeholder="Type to search roles..."
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                disabled={optionsLoading}
              />
              {showRoleDropdown && roleQuery.length > 0 && filteredRoles.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredRoles.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, roleId: option.value }))
                        setRoleQuery(option.label)
                        setShowRoleDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</label>
              <select
                value={form.status}
                onChange={event => setForm(prev => ({ ...prev, status: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={() => setSubmitMode("saveAndNew")}
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-full border border-primary-600 px-6 py-2 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-primary-300 disabled:text-primary-300"
            >
              {loading && submitMode === "saveAndNew" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save & New
            </button>
            <button
              type="submit"
              onClick={() => setSubmitMode("save")}
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {loading && submitMode === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
