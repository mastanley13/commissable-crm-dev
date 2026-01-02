"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Shield, User as UserIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { FieldRow } from "./detail/FieldRow"
import { fieldBoxClass } from "./detail/shared"
import { EditableField } from "./editable-field"
import { AuditHistoryTab } from "./audit-history-tab"
import { TabDescription } from "@/components/section/TabDescription"
import { useEntityEditor } from "@/hooks/useEntityEditor"
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt"
import { useToasts } from "@/components/toast"

export interface UserPermissionRecord {
  id: string
  code: string
  name: string
  category: string
}

export interface UserRoleRecord {
  id: string
  code: string
  name: string
  permissions: UserPermissionRecord[]
}

export interface UserSessionRecord {
  id: string
  ipAddress: string | null
  userAgent: string | null
  lastSeenAt: string | null
  createdAt: string
  expiresAt: string
}

export interface UserDetailRecord {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  jobTitle: string | null
  department: string | null
  mobilePhone: string | null
  workPhone: string | null
  status: "Active" | "Invited" | "Suspended" | "Disabled"
  lastLoginAt: string | null
  passwordChangedAt: string | null
  authProvider: string | null
  createdAt: string
  updatedAt: string
  role: UserRoleRecord | null
  activeSessions: UserSessionRecord[]
}

export interface UserDetailsViewProps {
  user: UserDetailRecord | null
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
}

interface SelectOption {
  value: string
  label: string
}

interface UserInlineForm {
  email: string
  firstName: string
  lastName: string
  jobTitle: string
  department: string
  mobilePhone: string
  workPhone: string
  status: UserDetailRecord["status"]
  roleId: string
  password: string
}

type TabKey = "sessions" | "permissions" | "history"

const TABS: { id: TabKey; label: string }[] = [
  { id: "sessions", label: "Sessions" },
  { id: "permissions", label: "Permissions" },
  { id: "history", label: "History" }
]

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  sessions: "Active sessions for this user, including last-seen activity and expiration.",
  permissions: "Role assignment and effective permissions granted to this user.",
  history: "Audit log of changes made to this user record."
}

const USER_HISTORY_TABLE_HEIGHT = 360

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString()
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function createUserInlineForm(user: UserDetailRecord | null): UserInlineForm | null {
  if (!user) return null
  return {
    email: user.email ?? "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    jobTitle: user.jobTitle ?? "",
    department: user.department ?? "",
    mobilePhone: user.mobilePhone ?? "",
    workPhone: user.workPhone ?? "",
    status: user.status ?? "Invited",
    roleId: user.role?.id ?? "",
    password: ""
  }
}

function validateUserForm(form: UserInlineForm): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.email.trim()) {
    errors.email = "Email is required."
  }
  if (!form.firstName.trim()) {
    errors.firstName = "First name is required."
  }
  if (!form.lastName.trim()) {
    errors.lastName = "Last name is required."
  }
  return errors
}

function buildUserPayload(patch: Partial<UserInlineForm>, draft: UserInlineForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if ("email" in patch) {
    payload.email = draft.email.toLowerCase().trim()
  }

  if ("firstName" in patch) {
    payload.firstName = draft.firstName.trim()
  }

  if ("lastName" in patch) {
    payload.lastName = draft.lastName.trim()
  }

  if ("jobTitle" in patch) {
    const value = draft.jobTitle.trim()
    payload.jobTitle = value.length > 0 ? value : null
  }

  if ("department" in patch) {
    const value = draft.department.trim()
    payload.department = value.length > 0 ? value : null
  }

  if ("mobilePhone" in patch) {
    const value = draft.mobilePhone.trim()
    payload.mobilePhone = value.length > 0 ? value : null
  }

  if ("workPhone" in patch) {
    const value = draft.workPhone.trim()
    payload.workPhone = value.length > 0 ? value : null
  }

  if ("status" in patch) {
    payload.status = draft.status
  }

  if ("roleId" in patch) {
    payload.roleId = draft.roleId ? draft.roleId : null
  }

  if ("password" in patch) {
    const value = draft.password.trim()
    if (value.length > 0) {
      payload.password = value
    }
  }

  return payload
}

export function UserDetailsView({ user, loading, error, onRefresh }: UserDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("sessions")
  const { showError, showSuccess } = useToasts()
  const [roleOptions, setRoleOptions] = useState<SelectOption[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)

  const inlineInitialForm = useMemo(() => (user ? createUserInlineForm(user) : null), [user])

  const submitUser = useCallback(
    async (patch: Partial<UserInlineForm>, draft: UserInlineForm) => {
      if (!user?.id) {
        throw new Error("User ID is required")
      }

      const payload = buildUserPayload(patch, draft)
      if (Object.keys(payload).length === 0) {
        return { ...draft, password: "" }
      }

      try {
        const response = await fetch(`/api/admin/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })

        const body = await response.json().catch(() => null)

        if (!response.ok) {
          const message = body?.error ?? "Failed to update user"
          showError("Unable to update user", message)
          throw new Error(message)
        }

        showSuccess("User updated", "Changes saved.")
        await onRefresh?.()
        return { ...draft, password: "" }
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error("Failed to update user")
      }
    },
    [onRefresh, showError, showSuccess, user?.id]
  )

  const editor = useEntityEditor<UserInlineForm>({
    initial: inlineInitialForm,
    validate: user ? draft => validateUserForm(draft) : undefined,
    onSubmit: user ? submitUser : undefined
  })

  const { confirmNavigation } = useUnsavedChangesPrompt(editor.isDirty)

  const handleSaveInline = useCallback(async () => {
    if (!user) return
    try {
      await editor.submit()
    } catch {
      // handled by submitUser toast + thrown error
    }
  }, [editor, user])

  useEffect(() => {
    if (!user) return

    let cancelled = false
    const loadRoles = async () => {
      try {
        setRolesLoading(true)
        const response = await fetch("/api/admin/roles", { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load roles")
        }
        if (cancelled) return
        const roles: SelectOption[] = Array.isArray(payload?.data?.roles)
          ? payload.data.roles.map((roleItem: any) => ({
              value: String(roleItem.id),
              label: roleItem.name || roleItem.code
            }))
          : []
        setRoleOptions(roles)
      } catch {
        if (!cancelled) setRoleOptions([])
      } finally {
        if (!cancelled) setRolesLoading(false)
      }
    }

    void loadRoles()
    return () => {
      cancelled = true
    }
  }, [user])

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { value: "Invited", label: "Invited" },
      { value: "Active", label: "Active" },
      { value: "Suspended", label: "Suspended" },
      { value: "Disabled", label: "Disabled" }
    ],
    []
  )

  const permissionGroups = useMemo(() => {
    const permissions = user?.role?.permissions ?? []
    const grouped = new Map<string, UserPermissionRecord[]>()
    for (const permission of permissions) {
      const key = permission.category || "Other"
      const current = grouped.get(key) ?? []
      current.push(permission)
      grouped.set(key, current)
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [user?.role?.permissions])

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
          <span>Loading user profile...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Unable to load user profile</p>
            <p className="mt-1 text-xs text-red-700">{error}</p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!user || !editor.draft) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
        User profile is not available.
      </div>
    )
  }

  const emailField = editor.register("email")
  const firstNameField = editor.register("firstName")
  const lastNameField = editor.register("lastName")
  const jobTitleField = editor.register("jobTitle")
  const departmentField = editor.register("department")
  const mobilePhoneField = editor.register("mobilePhone")
  const workPhoneField = editor.register("workPhone")
  const statusField = editor.register("status")
  const roleField = editor.register("roleId")
  const passwordField = editor.register("password")

  const canSave = editor.isDirty && Object.keys(editor.errors).length === 0 && !editor.saving

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden gap-4 pt-3 pb-4">
          <div className="rounded-2xl bg-gray-100 p-3 shadow-sm h-[320px] overflow-y-auto">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <UserIcon className="h-4 w-4 text-primary-600 shrink-0" />
                <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600 truncate">
                  User Profile
                </p>
                <span
                  className={cn(
                    "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    user.status === "Active"
                      ? "bg-green-100 text-green-800"
                      : user.status === "Invited"
                        ? "bg-yellow-100 text-yellow-800"
                        : user.status === "Suspended"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-gray-200 text-gray-800"
                  )}
                >
                  {user.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {onRefresh ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await confirmNavigation()) {
                        onRefresh()
                      }
                    }}
                    className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 border border-gray-200"
                  >
                    Refresh
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleSaveInline}
                  disabled={!canSave}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-white transition",
                    canSave ? "bg-primary-600 hover:bg-primary-700" : "bg-primary-600/60 cursor-not-allowed"
                  )}
                >
                  {editor.saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Update
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1">
                <FieldRow
                  label="Email"
                  value={
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md">
                        <EditableField.Input
                          value={emailField.value as string}
                          onChange={emailField.onChange}
                          onBlur={emailField.onBlur}
                          disabled={editor.saving}
                        />
                      </div>
                      {editor.errors.email ? (
                        <p className="text-[10px] text-red-600">{editor.errors.email}</p>
                      ) : null}
                    </div>
                  }
                />
                <FieldRow
                  label="First Name"
                  value={
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md">
                        <EditableField.Input
                          value={firstNameField.value as string}
                          onChange={firstNameField.onChange}
                          onBlur={firstNameField.onBlur}
                          disabled={editor.saving}
                        />
                      </div>
                      {editor.errors.firstName ? (
                        <p className="text-[10px] text-red-600">{editor.errors.firstName}</p>
                      ) : null}
                    </div>
                  }
                />
                <FieldRow
                  label="Last Name"
                  value={
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md">
                        <EditableField.Input
                          value={lastNameField.value as string}
                          onChange={lastNameField.onChange}
                          onBlur={lastNameField.onBlur}
                          disabled={editor.saving}
                        />
                      </div>
                      {editor.errors.lastName ? (
                        <p className="text-[10px] text-red-600">{editor.errors.lastName}</p>
                      ) : null}
                    </div>
                  }
                />
                <FieldRow
                  label="Job Title"
                  value={
                    <div className="max-w-md">
                      <EditableField.Input
                        value={jobTitleField.value as string}
                        onChange={jobTitleField.onChange}
                        onBlur={jobTitleField.onBlur}
                        disabled={editor.saving}
                      />
                    </div>
                  }
                />
                <FieldRow
                  label="Department"
                  value={
                    <div className="max-w-md">
                      <EditableField.Input
                        value={departmentField.value as string}
                        onChange={departmentField.onChange}
                        onBlur={departmentField.onBlur}
                        disabled={editor.saving}
                      />
                    </div>
                  }
                />
                <FieldRow
                  label="Status"
                  value={
                    <div className="max-w-md">
                      <EditableField.Select
                        value={statusField.value as string}
                        onChange={statusField.onChange}
                        onBlur={statusField.onBlur}
                        disabled={editor.saving}
                      >
                        {statusOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </EditableField.Select>
                    </div>
                  }
                />
              </div>

              <div className="space-y-1">
                <FieldRow
                  label="Role"
                  value={
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md">
                        <EditableField.Select
                          value={roleField.value as string}
                          onChange={roleField.onChange}
                          onBlur={roleField.onBlur}
                          disabled={editor.saving || rolesLoading || roleOptions.length === 0}
                        >
                          <option value="">No Role</option>
                          {roleOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </EditableField.Select>
                      </div>
                      {roleOptions.length === 0 ? (
                        <p className="text-[10px] text-gray-500">Role options unavailable.</p>
                      ) : null}
                    </div>
                  }
                />
                <FieldRow
                  label="Work Phone"
                  value={
                    <div className="max-w-md">
                      <EditableField.Input
                        value={workPhoneField.value as string}
                        onChange={workPhoneField.onChange}
                        onBlur={workPhoneField.onBlur}
                        disabled={editor.saving}
                      />
                    </div>
                  }
                />
                <FieldRow
                  label="Mobile Phone"
                  value={
                    <div className="max-w-md">
                      <EditableField.Input
                        value={mobilePhoneField.value as string}
                        onChange={mobilePhoneField.onChange}
                        onBlur={mobilePhoneField.onBlur}
                        disabled={editor.saving}
                      />
                    </div>
                  }
                />
                <FieldRow
                  label="New Password"
                  value={
                    <div className="flex flex-col gap-1">
                      <div className="max-w-md">
                        <EditableField.Input
                          type="password"
                          value={passwordField.value as string}
                          onChange={passwordField.onChange}
                          onBlur={passwordField.onBlur}
                          placeholder="Leave blank to keep unchanged"
                          disabled={editor.saving}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500">Minimum 8 characters.</p>
                    </div>
                  }
                />
                <FieldRow
                  label="Last Login"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate">{formatShortDate(user.lastLoginAt) || "Never"}</span>
                    </div>
                  }
                />
                <FieldRow
                  label="Auth Provider"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate">{user.authProvider ?? "--"}</span>
                    </div>
                  }
                />
                <FieldRow
                  label="Created At"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate">{formatDate(user.createdAt) || "--"}</span>
                    </div>
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex flex-wrap gap-1 border-x border-t border-gray-200 bg-gray-100 pt-2 px-3 pb-0">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-semibold transition rounded-t-md border shadow-sm",
                    activeTab === tab.id
                      ? "relative -mb-[1px] z-10 border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden border-x border-b border-gray-200 bg-white px-3 pt-3">
              <TabDescription>{TAB_DESCRIPTIONS[activeTab]}</TabDescription>

              {activeTab === "sessions" && (
                <div className="space-y-2">
                  {user.activeSessions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                      No active sessions.
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[420px] rounded-lg border border-gray-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                              IP Address
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                              User Agent
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                              Last Seen
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                              Expires
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {user.activeSessions.map(session => (
                            <tr key={session.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-[11px] text-gray-800">
                                {session.ipAddress ?? "--"}
                              </td>
                              <td
                                className="px-3 py-2 text-[11px] text-gray-800 max-w-[520px] truncate"
                                title={session.userAgent ?? ""}
                              >
                                {session.userAgent ?? "--"}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-gray-800">
                                {formatDate(session.lastSeenAt) || "--"}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-gray-800">
                                {formatDate(session.expiresAt) || "--"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "permissions" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-indigo-600" />
                    <span className="font-semibold text-gray-900">
                      {user.role ? user.role.name : "No Role Assigned"}
                    </span>
                    {user.role ? (
                      <span className="text-[11px] text-gray-500">({user.role.code})</span>
                    ) : null}
                  </div>

                  {user.role && user.role.permissions.length > 0 ? (
                    <div className="space-y-3 max-h-[420px] overflow-auto pr-2">
                      {permissionGroups.map(([category, permissions]) => (
                        <div key={category} className="rounded-lg border border-gray-200">
                          <div className="bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                            {category}
                          </div>
                          <ul className="divide-y divide-gray-100">
                            {permissions
                              .slice()
                              .sort((a, b) => a.code.localeCompare(b.code))
                              .map(permission => (
                                <li key={permission.id} className="px-3 py-2">
                                  <div className="text-[11px] font-semibold text-gray-900">
                                    {permission.name}
                                  </div>
                                  <div className="text-[11px] text-gray-500">{permission.code}</div>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                      No permissions found for this user.
                    </div>
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <AuditHistoryTab
                  entityName={"User" as any}
                  entityId={user.id}
                  tableBodyMaxHeight={USER_HISTORY_TABLE_HEIGHT}
                  description={TAB_DESCRIPTIONS.history}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserDetailsView

