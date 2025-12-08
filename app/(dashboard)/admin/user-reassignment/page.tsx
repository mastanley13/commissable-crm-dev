"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Users, ArrowRight, ChevronRight, AlertTriangle, Calendar } from "lucide-react"
import { CopyProtectionWrapper } from "@/components/copy-protection"

type WizardStep = "selectUsers" | "configure" | "confirm"
type CommissionOption = "transferToNewRep" | "transferToHouse"

interface AdminUser {
  id: string
  fullName: string
  email: string
  status: string
}

interface EntityCounts {
  accounts: number
  contacts: number
  groups: number
  products: number
  opportunities: number
  tasks: number
  tickets: number
  activities: number
  notes: number
  revenueSchedules: number
}

interface ReassignmentSummary {
  accountsUpdated: number
  contactsUpdated: number
  groupsUpdated: number
  productsUpdated: number
  opportunitiesUpdated: number
  tasksUpdated: number
  ticketsUpdated: number
  activitiesUpdated: number
  notesUpdated: number
  revenueSchedulesUpdated: number
  commissionSplitsAdjusted: number
  counts: EntityCounts
  commissionOption: CommissionOption
  noHouseRepContactId?: string | null
}

function getDefaultEffectiveDate(): Date {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (now.getDate() === 1) {
    return new Date(year, month, 1)
  }
  return new Date(year, month + 1, 1)
}

export default function UserReassignmentPage() {
  const router = useRouter()

  const [step, setStep] = useState<WizardStep>("selectUsers")
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingCounts, setLoadingCounts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [users, setUsers] = useState<AdminUser[]>([])
  const [previousUserId, setPreviousUserId] = useState<string>("")
  const [newOwnerId, setNewOwnerId] = useState<string>("")

  const [effectiveDate, setEffectiveDate] = useState<Date>(() => getDefaultEffectiveDate())
  const [commissionOption, setCommissionOption] = useState<CommissionOption>("transferToNewRep")
  const [counts, setCounts] = useState<EntityCounts>({
    accounts: 0,
    contacts: 0,
    groups: 0,
    products: 0,
    opportunities: 0,
    tasks: 0,
    tickets: 0,
    activities: 0,
    notes: 0,
    revenueSchedules: 0
  })
  const [noHouseRepContactId, setNoHouseRepContactId] = useState<string | null>(null)
  const [submitSummary, setSubmitSummary] = useState<ReassignmentSummary | null>(null)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoadingUsers(true)
        setError(null)

        const response = await fetch("/api/admin/users?status=Active&limit=200", {
          cache: "no-store"
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? "Failed to load users")
        }

        const payload = await response.json().catch(() => null)
        const items: any[] = payload?.data?.users ?? payload?.users ?? []

        const normalizedUsers = items.map(item => ({
          id: item.id,
          fullName: item.fullName || `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim(),
          email: item.email,
          status: item.status
        }))

        setUsers(normalizedUsers)

        if (!newOwnerId && normalizedUsers.length > 0) {
          setNewOwnerId(normalizedUsers[0].id)
        }
      } catch (err) {
        console.error("Failed to load users for reassignment wizard", err)
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load users. Please try again or contact an administrator."
        )
      } finally {
        setLoadingUsers(false)
      }
    }

    loadUsers()
  }, [newOwnerId])

  useEffect(() => {
    if (previousUserId && previousUserId === newOwnerId) {
      const fallback = users.find(u => u.id !== previousUserId)
      setNewOwnerId(fallback?.id ?? "")
    }
  }, [previousUserId, newOwnerId, users])

  const previousUser = useMemo(
    () => users.find(user => user.id === previousUserId) ?? null,
    [users, previousUserId]
  )

  const newOwnerUser = useMemo(
    () => users.find(user => user.id === newOwnerId) ?? null,
    [users, newOwnerId]
  )

  const stepIndex: Record<WizardStep, number> = {
    selectUsers: 1,
    configure: 2,
    confirm: 3
  }

  const canProceedFromSelect =
    !!previousUserId && !!newOwnerId && previousUserId !== newOwnerId && !loadingUsers

  const loadCounts = async () => {
    if (!previousUserId) return
    try {
      setLoadingCounts(true)
      setError(null)
      const params = new URLSearchParams({
        previousUserId,
        effectiveDate: effectiveDate.toISOString()
      })
      const response = await fetch(`/api/admin/user-reassignment?${params.toString()}`, {
        cache: "no-store"
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? "Failed to load reassignment preview")
      }
      const payload = await response.json().catch(() => null)
      if (payload?.counts) {
        setCounts(payload.counts as EntityCounts)
      }
      if (payload?.noHouseRepContactId) {
        setNoHouseRepContactId(payload.noHouseRepContactId)
      }
    } catch (err) {
      console.error("Failed to load reassignment preview", err)
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load reassignment preview. Please try again."
      )
    } finally {
      setLoadingCounts(false)
    }
  }

  const goToConfigure = async () => {
    if (!canProceedFromSelect) return
    await loadCounts()
    setStep("configure")
  }

  const goToConfirm = () => {
    setStep("confirm")
  }

  const handleSubmit = async () => {
    if (!previousUserId || !newOwnerId) return
    setSubmitting(true)
    setError(null)
    setSubmitSummary(null)
    try {
      const response = await fetch("/api/admin/user-reassignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousUserId,
          newUserId: newOwnerId,
          effectiveDate: effectiveDate.toISOString(),
          commissionOption
        })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error ?? "Failed to apply user reassignment"
        throw new Error(message)
      }

      const payload = await response.json().catch(() => null)
      if (payload?.summary) {
        setSubmitSummary(payload.summary as ReassignmentSummary)
      }
    } catch (err) {
      console.error("User reassignment operation failed", err)
      setError(
        err instanceof Error
          ? err.message
          : "User reassignment failed. Please review selections and try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const renderStepBadge = (label: string, index: number, value: WizardStep) => {
    const active = step === value
    const completed = stepIndex[step] > index + 1
    return (
      <div key={value} className="flex items-center gap-2">
        <div
          className={[
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
            active
              ? "bg-blue-600 text-white"
              : completed
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-700"
          ].join(" ")}
        >
          {index + 1}
        </div>
        <span className={["text-sm font-medium", active ? "text-blue-700" : "text-gray-700"].join(" ")}>
          {label}
        </span>
        {index < 2 && <ChevronRight className="h-4 w-4 text-gray-300" aria-hidden="true" />}
      </div>
    )
  }

  const summaryCounts = [
    { label: "Accounts", value: counts.accounts },
    { label: "Contacts", value: counts.contacts },
    { label: "Opportunities", value: counts.opportunities },
    { label: "Tasks", value: counts.tasks },
    { label: "Tickets", value: counts.tickets },
    { label: "Activities", value: counts.activities },
    { label: "Notes", value: counts.notes },
    { label: "Groups", value: counts.groups },
    { label: "Future Revenue Schedules", value: counts.revenueSchedules },
    { label: "Products", value: counts.products }
  ]

  return (
    <CopyProtectionWrapper className="h-full flex flex-col">
      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Reassignment (Admin)</h1>
            <p className="mt-1 text-sm text-gray-600">
              Centralized, admin-only reassignment workflow. All associated records move with the reassignment and a commission adjustment is required.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/accounts")}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Go to Accounts
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6 flex items-center gap-4">
          {renderStepBadge("Select Users", 0, "selectUsers")}
          {renderStepBadge("Configure", 1, "configure")}
          {renderStepBadge("Confirm & Apply", 2, "confirm")}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {step === "selectUsers" && (
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">1. Choose users</h2>
            <p className="mb-4 text-sm text-gray-600">
              Pick the departing user and the new owner. New owner is defaulted; the selection is required.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Departing user *
                </label>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <select
                    value={previousUserId}
                    onChange={e => setPreviousUserId(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loadingUsers}
                  >
                    <option value="">Select departing user</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.fullName} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  New owner (radio, defaulted) *
                </label>
                <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-2 space-y-2">
                  {users.length === 0 && (
                    <p className="text-xs text-gray-500">No active users available.</p>
                  )}
                  {users.map(user => (
                    <label key={user.id} className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="radio"
                        name="newOwner"
                        value={user.id}
                        checked={newOwnerId === user.id}
                        onChange={() => setNewOwnerId(user.id)}
                        disabled={loadingUsers}
                      />
                      <span className="flex flex-col">
                        <span className="font-medium">{user.fullName}</span>
                        <span className="text-xs text-gray-500">{user.email}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {previousUserId && newOwnerId && previousUserId === newOwnerId && (
                  <p className="mt-2 text-xs text-red-600">Users must be different.</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={goToConfigure}
                disabled={!canProceedFromSelect || loadingCounts}
                className={[
                  "inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white",
                  !canProceedFromSelect || loadingCounts
                    ? "cursor-not-allowed bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                ].join(" ")}
              >
                {loadingCounts ? "Loading preview..." : "Next: Configure"}
                <ChevronRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === "configure" && (
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">2. Configure & preview</h2>
            <p className="mb-4 text-sm text-gray-600">
              All associated records will move. Commission adjustment is required.
            </p>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Effective date *
                  </label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={effectiveDate.toISOString().slice(0, 10)}
                      onChange={e => {
                        const value = e.target.value
                        if (!value) return
                        const parsed = new Date(value)
                        if (!Number.isNaN(parsed.getTime())) {
                          setEffectiveDate(parsed)
                        }
                      }}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Use the 1st of the removal month; changes apply from this date forward.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Commission adjustment (required)
                  </label>
                  <fieldset className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="commissionOption"
                        value="transferToNewRep"
                        checked={commissionOption === "transferToNewRep"}
                        onChange={() => setCommissionOption("transferToNewRep")}
                      />
                      <span>
                        <span className="font-semibold text-gray-900">Transfer to New Owner</span>
                        <p className="text-xs text-gray-600">
                          Full commission follows the new owner for in-flight items.
                        </p>
                      </span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="commissionOption"
                        value="transferToHouse"
                        checked={commissionOption === "transferToHouse"}
                        onChange={() => setCommissionOption("transferToHouse")}
                      />
                      <span>
                        <span className="font-semibold text-gray-900">Transfer to House</span>
                        <p className="text-xs text-gray-600">
                          Previous user’s commission portion moves to House from the effective date forward.
                        </p>
                      </span>
                    </label>
                    {commissionOption === "transferToHouse" && noHouseRepContactId && (
                      <p className="text-xs text-gray-500">
                        Using “No House Rep” contact for house-only scenarios (ID: {noHouseRepContactId}).
                      </p>
                    )}
                  </fieldset>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-600">Departing user</span>
                    <span className="font-semibold text-gray-900">{previousUser?.fullName ?? "—"}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm text-gray-600">New owner</span>
                    <span className="font-semibold text-gray-900">{newOwnerUser?.fullName ?? "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summaryCounts.map(item => (
                    <div key={item.label} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">{item.label}</p>
                      <p className="text-lg font-semibold text-gray-900">{item.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("selectUsers")}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to user selection
              </button>
              <button
                type="button"
                onClick={goToConfirm}
                disabled={loadingCounts || !commissionOption}
                className={[
                  "inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white",
                  loadingCounts || !commissionOption
                    ? "cursor-not-allowed bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                ].join(" ")}
              >
                Next: Confirm
                <ChevronRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">3. Confirm & apply</h2>
            <p className="mb-4 text-sm text-gray-600">
              Review selections and apply the reassignment. All associated records move with the accounts.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Summary</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-800">
                  <li>
                    <span className="text-gray-600">From:</span>{" "}
                    <span className="font-medium">{previousUser?.fullName ?? "—"}</span>
                  </li>
                  <li>
                    <span className="text-gray-600">To:</span>{" "}
                    <span className="font-medium">{newOwnerUser?.fullName ?? "—"}</span>
                  </li>
                  <li>
                    <span className="text-gray-600">Effective date:</span>{" "}
                    <span className="font-medium">{effectiveDate.toISOString().slice(0, 10)}</span>
                  </li>
                  <li>
                    <span className="text-gray-600">Commission adjustment:</span>{" "}
                    <span className="font-medium">
                      {commissionOption === "transferToHouse" ? "Transfer to House" : "Transfer to New Owner"}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Counts to move</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-800">
                  {summaryCounts.map(item => (
                    <li key={item.label} className="flex justify-between">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-semibold">{item.value.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("configure")}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to configure
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || loadingCounts || !commissionOption}
                className={[
                  "inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white",
                  submitting || loadingCounts || !commissionOption
                    ? "cursor-not-allowed bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                ].join(" ")}
              >
                {submitting ? "Applying reassignment..." : "Reassign now"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>

            {submitSummary && (
              <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                <p className="font-semibold">Reassignment complete.</p>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  <li>{submitSummary.accountsUpdated} accounts updated</li>
                  <li>{submitSummary.contactsUpdated} contacts updated</li>
                  <li>{submitSummary.opportunitiesUpdated} opportunities updated</li>
                  <li>{submitSummary.tasksUpdated} tasks updated</li>
                  <li>{submitSummary.ticketsUpdated} tickets updated</li>
                  <li>{submitSummary.activitiesUpdated} activities updated</li>
                  <li>{submitSummary.notesUpdated} notes touched</li>
                  <li>{submitSummary.groupsUpdated} groups updated</li>
                  <li>{submitSummary.productsUpdated} products updated</li>
                  <li>{submitSummary.revenueSchedulesUpdated} revenue schedules adjusted</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </CopyProtectionWrapper>
  )
}
