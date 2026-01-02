"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Info, Loader2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useToasts } from "@/components/toast"
import { formatCurrencyDisplay, formatDecimalToFixed, formatPercentDisplay, normalizeDecimalInput } from "@/lib/number-format"

import type {
  OpportunityLineItemRecord,
  OpportunityRevenueScheduleRecord
} from "./opportunity-types"
import { ConfirmDialog } from "./confirm-dialog"

type ModalTab = "create" | "rates" | "split" | "status" | "undo"
type ManageScope = "selection" | "series"
type AmountMode = "auto" | "manual"

interface CommissionSplitDefaults {
  house?: number | null
  houseRep?: number | null
  subagent?: number | null
}

interface DepositMatchRecord {
  id: string
  scheduleId: string
  scheduleNumber?: string | null
  depositId?: string | null
  depositReference?: string | null
  depositDate?: string | null
  amount?: number | null
}

interface RevenueScheduleCreateModalProps {
  isOpen: boolean
  opportunityId: string
  opportunityName: string
  lineItems: OpportunityLineItemRecord[]
  schedules: OpportunityRevenueScheduleRecord[]
  defaultCommissionSplits?: CommissionSplitDefaults
  /**
   * Optional initial selection of schedule ids for the Deactivate/Delete tab.
   * When provided, the Status tab will pre-select these schedules on first open.
   */
  initialStatusSelection?: string[]
  onClose: () => void
  onSuccess?: () => void | Promise<void>
}

const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
const inputCls = "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:border-primary-500 focus:outline-none"
const selectCls = "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:border-primary-500 focus:outline-none"
const textAreaCls = "min-h-[84px] w-full resize-y border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs leading-5 focus:border-primary-500 focus:outline-none"

const CADENCE_OPTIONS = [
  { label: "Monthly", value: "Monthly" as const },
  { label: "Quarterly", value: "Quarterly" as const },
  { label: "One-time", value: "OneTime" as const }
]

const TAB_DEFINITIONS: Array<{ id: ModalTab; label: string }> = [
  { id: "create", label: "Create Schedules" },
  { id: "rates", label: "Change Commission Rate" },
  { id: "split", label: "Change Commission Split" },
  { id: "status", label: "Deactivate / Delete" },
  { id: "undo", label: "Undo Deposit Match" }
]

function parseNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return ""
  return value.toFixed(digits)
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addCadence(start: Date, cadence: "Monthly" | "Quarterly" | "OneTime", index: number) {
  if (cadence === "OneTime") return start
  const result = new Date(start.getTime())
  const increment = cadence === "Monthly" ? index : index * 3
  result.setMonth(result.getMonth() + increment)
  return result
}

export function RevenueScheduleCreateModal({
  isOpen,
  opportunityId,
  opportunityName,
  lineItems,
  schedules,
  defaultCommissionSplits,
  initialStatusSelection,
  onClose,
  onSuccess
}: RevenueScheduleCreateModalProps) {
  const { showError, showSuccess } = useToasts()

  const [activeTab, setActiveTab] = useState<ModalTab>("create")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState({
    productId: "",
    seriesName: "",
    startDate: "",
    cadence: "Monthly" as "Monthly" | "Quarterly" | "OneTime",
    occurrences: "12",
    quantity: "1",
    priceEach: "",
    amountMode: "auto" as AmountMode,
    manualAmount: "",
    commissionRate: "",
    splitHouse: "",
    splitHouseRep: "",
    splitSubagent: "",
    isChargeback: false,
    chargebackReason: "",
    notes: ""
  })

  const [rateForm, setRateForm] = useState({
    selectedIds: [] as string[],
    effectiveDate: "",
    ratePercent: "",
    scope: "selection" as ManageScope
  })

  const [splitForm, setSplitForm] = useState({
    selectedIds: [] as string[],
    effectiveDate: "",
    scope: "selection" as ManageScope,
    house: "",
    houseRep: "",
    subagent: ""
  })

  const [statusForm, setStatusForm] = useState({
    selectedIds: [] as string[],
    scope: "selection" as ManageScope,
    action: "deactivate" as "deactivate" | "delete",
    reason: ""
  })
  const [statusPrefillApplied, setStatusPrefillApplied] = useState(false)

  const [depositMatches, setDepositMatches] = useState<DepositMatchRecord[]>([])
  const [depositSelection, setDepositSelection] = useState<string[]>([])
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositError, setDepositError] = useState<string | null>(null)
  const [priceEachFocused, setPriceEachFocused] = useState(false)
  const [manualAmountFocused, setManualAmountFocused] = useState(false)
  const [commissionRateFocused, setCommissionRateFocused] = useState(false)
  const [splitHouseFocused, setSplitHouseFocused] = useState(false)
  const [splitHouseRepFocused, setSplitHouseRepFocused] = useState(false)
  const [splitSubagentFocused, setSplitSubagentFocused] = useState(false)
  const [ratePercentFocused, setRatePercentFocused] = useState(false)
  const [splitFormHouseFocused, setSplitFormHouseFocused] = useState(false)
  const [splitFormHouseRepFocused, setSplitFormHouseRepFocused] = useState(false)
  const [splitFormSubagentFocused, setSplitFormSubagentFocused] = useState(false)
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)
  const [ineligibleReasons, setIneligibleReasons] = useState<Record<string, string>>({})

  const productOptions = useMemo(() => {
    return lineItems.map(item => ({
      value: item.id,
      label: item.productName || "Opportunity Product",
      quantity: item.quantity,
      priceEach: item.unitPrice,
      expectedRevenue: item.expectedRevenue,
      expectedCommission: item.expectedCommission
    }))
  }, [lineItems])

  const scheduleOptions = useMemo(() => {
    return schedules.map(schedule => ({
      id: schedule.id,
      label: schedule.scheduleNumber || schedule.productNameVendor || `Schedule ${schedule.id.slice(0, 6)}`,
      scheduleDate: schedule.scheduleDate ? schedule.scheduleDate.slice(0, 10) : null,
      commissionRate: schedule.expectedCommissionRatePercent ?? 0,
      productNameVendor: schedule.productNameVendor ?? null,
      distributorName: schedule.distributorName ?? null,
      vendorName: schedule.vendorName ?? null,
      opportunityName: schedule.opportunityName ?? null
    }))
  }, [schedules])

  const handleDecimalChangeRate = (field: keyof typeof rateForm) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const normalized = normalizeDecimalInput(event.target.value)
    setRateForm(prev => ({ ...prev, [field]: normalized }))
  }

  const handleDecimalBlurRate = (field: keyof typeof rateForm) => () => {
    setRateForm(prev => ({ ...prev, [field]: formatDecimalToFixed(String(prev[field] ?? "")) }))
  }

  const handleDecimalChangeSplit = (field: keyof typeof splitForm) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const normalized = normalizeDecimalInput(event.target.value)
    setSplitForm(prev => ({ ...prev, [field]: normalized }))
  }

  const handleDecimalBlurSplit = (field: keyof typeof splitForm) => () => {
    setSplitForm(prev => ({ ...prev, [field]: formatDecimalToFixed(String(prev[field] ?? "")) }))
  }

  const displayRatePercent = useMemo(() => {
    const raw = rateForm.ratePercent.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (ratePercentFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [rateForm.ratePercent, ratePercentFocused])

  const displaySplitFormHouse = useMemo(() => {
    const raw = splitForm.house.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (splitFormHouseFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [splitForm.house, splitFormHouseFocused])

  const displaySplitFormHouseRep = useMemo(() => {
    const raw = splitForm.houseRep.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (splitFormHouseRepFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [splitForm.houseRep, splitFormHouseRepFocused])

  const displaySplitFormSubagent = useMemo(() => {
    const raw = splitForm.subagent.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (splitFormSubagentFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [splitForm.subagent, splitFormSubagentFocused])

  const eligibleStatusIds = useMemo(() => {
    const ids = new Set<string>()
    schedules.forEach(schedule => {
      const actualUsage = typeof schedule.actualUsage === "number" ? schedule.actualUsage : 0
      const actualCommission = typeof schedule.actualCommission === "number" ? schedule.actualCommission : 0
      const hasUsage = Math.abs(actualUsage) > 0.0001
      const hasCommission = Math.abs(actualCommission) > 0.0001
      if (!hasUsage && !hasCommission) {
        ids.add(schedule.id)
      }
    })
    return ids
  }, [schedules])

  const getIneligibilityReason = useCallback(
    (id: string): string | undefined => {
      if (ineligibleReasons[id]) {
        return ineligibleReasons[id]
      }
      if (!eligibleStatusIds.has(id)) {
        return "Cannot deactivate or delete this schedule because it has usage or commission applied."
      }
      return undefined
    },
    [eligibleStatusIds, ineligibleReasons]
  )

  const statusScheduleOptions = useMemo(() => {
    if (!statusForm.selectedIds.length) {
      return []
    }
    const selectedSet = new Set(statusForm.selectedIds)
    return scheduleOptions.filter(option => selectedSet.has(option.id))
  }, [scheduleOptions, statusForm.selectedIds])

  const handleDecimalChangeCreate = (field: keyof typeof createForm) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const normalized = normalizeDecimalInput(event.target.value)
    setCreateForm(prev => ({ ...prev, [field]: normalized }))
  }

  const handleDecimalBlurCreate = (field: keyof typeof createForm) => () => {
    setCreateForm(prev => ({ ...prev, [field]: formatDecimalToFixed(String(prev[field] ?? "")) }))
  }

  const displayPriceEach = useMemo(() => {
    const raw = createForm.priceEach.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (priceEachFocused) {
      return raw
    }

    // When not focused, show formatted currency
    return formatCurrencyDisplay(raw, { alwaysSymbol: true })
  }, [createForm.priceEach, priceEachFocused])

  const displayManualAmount = useMemo(() => {
    const raw = createForm.manualAmount.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (manualAmountFocused) {
      return raw
    }

    // When not focused, show formatted currency
    return formatCurrencyDisplay(raw, { alwaysSymbol: true })
  }, [createForm.manualAmount, manualAmountFocused])

  const displayCommissionRate = useMemo(() => {
    const raw = createForm.commissionRate.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (commissionRateFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [createForm.commissionRate, commissionRateFocused])

  const displaySplitHouse = useMemo(() => {
    const raw = createForm.splitHouse.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (splitHouseFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [createForm.splitHouse, splitHouseFocused])

  const displaySplitHouseRep = useMemo(() => {
    const raw = createForm.splitHouseRep.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (splitHouseRepFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [createForm.splitHouseRep, splitHouseRepFocused])

  const displaySplitSubagent = useMemo(() => {
    const raw = createForm.splitSubagent.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (splitSubagentFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [createForm.splitSubagent, splitSubagentFocused])

  useEffect(() => {
    if (!isOpen) return

    const firstProduct = productOptions[0]
    const defaultHouse = defaultCommissionSplits?.house ?? null
    const defaultHouseRep = defaultCommissionSplits?.houseRep ?? null
    const defaultSubagent = defaultCommissionSplits?.subagent ?? null

    const inferredRate = firstProduct?.expectedRevenue && firstProduct.expectedCommission
      ? (firstProduct.expectedCommission / firstProduct.expectedRevenue) * 100
      : null

    setActiveTab("create")
    setError(null)
    setCreateForm({
      productId: firstProduct?.value ?? "",
      seriesName: firstProduct?.label ?? "",
      startDate: "",
      cadence: "Monthly",
      occurrences: "12",
      quantity: formatNumber(firstProduct?.quantity ?? null, 2) || "1",
      priceEach: formatNumber(firstProduct?.priceEach ?? null, 2),
      amountMode: "auto",
      manualAmount: "",
      commissionRate: formatNumber(inferredRate, 2),
      splitHouse: formatNumber(defaultHouse, 2),
      splitHouseRep: formatNumber(defaultHouseRep, 2),
      splitSubagent: formatNumber(defaultSubagent, 2),
      isChargeback: false,
      chargebackReason: "",
      notes: ""
    })

    setRateForm({ selectedIds: [], effectiveDate: "", ratePercent: "", scope: "selection" })
    setSplitForm({
      selectedIds: [],
      effectiveDate: "",
      scope: "selection",
      house: formatNumber(defaultHouse, 2),
      houseRep: formatNumber(defaultHouseRep, 2),
      subagent: formatNumber(defaultSubagent, 2)
    })
    setStatusForm({ selectedIds: [], scope: "selection", action: "deactivate", reason: "" })
    setDepositSelection([])
    setDepositError(null)

    let cancelled = false
    async function loadDepositMatches() {
      setDepositLoading(true)
      try {
        const response = await fetch(`/api/opportunities/${opportunityId}/revenue-schedules/deposit-matches`, { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Unable to load deposit matches")
        }
        const payload = await response.json().catch(() => null)
        const rows: DepositMatchRecord[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.matches)
            ? payload.matches
            : []
        if (!cancelled) {
          setDepositMatches(rows)
          setDepositError(rows.length === 0 ? "No matched deposits found." : null)
        }
      } catch (err) {
        if (!cancelled) {
          setDepositMatches([])
          setDepositError(err instanceof Error ? err.message : "Unable to load deposit matches")
        }
      } finally {
        if (!cancelled) {
          setDepositLoading(false)
        }
      }
    }

    loadDepositMatches()
    return () => {
      cancelled = true
    }
  }, [defaultCommissionSplits?.house, defaultCommissionSplits?.houseRep, defaultCommissionSplits?.subagent, isOpen, opportunityId, productOptions])

  const occurrencesNumber = useMemo(() => {
    if (createForm.cadence === "OneTime") return 1
    const parsed = Number.parseInt(createForm.occurrences.trim() || "0", 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }, [createForm.cadence, createForm.occurrences])

  const quantityNumber = useMemo(() => parseNumber(createForm.quantity) ?? 0, [createForm.quantity])
  const priceEachNumber = useMemo(() => parseNumber(createForm.priceEach) ?? 0, [createForm.priceEach])
  const manualAmountNumber = useMemo(() => parseNumber(createForm.manualAmount), [createForm.manualAmount])
  const commissionRateNumber = useMemo(() => parseNumber(createForm.commissionRate), [createForm.commissionRate])

  const autoAmountPerSchedule = useMemo(() => {
    if (createForm.amountMode === "manual") {
      return manualAmountNumber ?? null
    }
    if (!occurrencesNumber) return null
    const total = quantityNumber * priceEachNumber
    if (!Number.isFinite(total)) return null
    const perSchedule = total / occurrencesNumber
    return Number.isFinite(perSchedule) ? perSchedule : null
  }, [createForm.amountMode, manualAmountNumber, occurrencesNumber, priceEachNumber, quantityNumber])

  const amountPerSchedule = useMemo(() => {
    const raw = createForm.amountMode === "manual" ? manualAmountNumber : autoAmountPerSchedule
    if (raw === null || raw === undefined) return null
    return createForm.isChargeback ? raw * -1 : raw
  }, [autoAmountPerSchedule, createForm.amountMode, createForm.isChargeback, manualAmountNumber])

  const schedulePreview = useMemo(() => {
    if (!createForm.startDate || amountPerSchedule === null || !occurrencesNumber) return [] as Array<{ index: number; date: string; amount: number }>
    const start = new Date(createForm.startDate)
    if (Number.isNaN(start.getTime())) return []
    const rows: Array<{ index: number; date: string; amount: number }> = []
    for (let index = 0; index < occurrencesNumber; index += 1) {
      const effectiveDate = addCadence(start, createForm.cadence, index)
      rows.push({ index: index + 1, date: formatDate(effectiveDate), amount: Number(amountPerSchedule.toFixed(2)) })
      if (index === 23) break
    }
    return rows
  }, [amountPerSchedule, createForm.cadence, createForm.startDate, occurrencesNumber])

  const schedulePreviewTotal = useMemo(() => {
    if (!schedulePreview.length) return null
    return schedulePreview.reduce((sum, row) => sum + row.amount, 0)
  }, [schedulePreview])

  const splitTotals = useMemo(() => {
    const house = parseNumber(createForm.splitHouse) ?? 0
    const houseRep = parseNumber(createForm.splitHouseRep) ?? 0
    const subagent = parseNumber(createForm.splitSubagent) ?? 0
    return { house, houseRep, subagent, sum: house + houseRep + subagent }
  }, [createForm.splitHouse, createForm.splitHouseRep, createForm.splitSubagent])

  const splitSumValid = Math.abs(splitTotals.sum - 100) < 0.01
  const commissionRateValid = commissionRateNumber !== null && commissionRateNumber >= 0 && commissionRateNumber <= 100

  const canSubmitCreate = Boolean(
    createForm.productId &&
    createForm.startDate &&
    occurrencesNumber > 0 &&
    amountPerSchedule !== null &&
    commissionRateValid &&
    splitSumValid &&
    (!createForm.isChargeback || createForm.chargebackReason.trim().length > 0)
  )

  const canSubmitRates = Boolean(
    rateForm.selectedIds.length > 0 &&
    rateForm.effectiveDate.trim().length > 0 &&
    parseNumber(rateForm.ratePercent) !== null
  )

  const splitFormTotals = useMemo(() => {
    const house = parseNumber(splitForm.house) ?? 0
    const houseRep = parseNumber(splitForm.houseRep) ?? 0
    const subagent = parseNumber(splitForm.subagent) ?? 0
    return { house, houseRep, subagent, total: house + houseRep + subagent }
  }, [splitForm.house, splitForm.houseRep, splitForm.subagent])

  const canSubmitSplits = Boolean(
    splitForm.selectedIds.length > 0 &&
    splitForm.effectiveDate.trim().length > 0 &&
    Math.abs(splitFormTotals.total - 100) < 0.01
  )

  const eligibleSelectedCount = useMemo(
    () =>
      statusForm.selectedIds.filter(id => !getIneligibilityReason(id)).length,
    [getIneligibilityReason, statusForm.selectedIds]
  )

  const ineligibleSelectedCount = statusForm.selectedIds.length - eligibleSelectedCount

  const canSubmitStatus = Boolean(
    eligibleSelectedCount > 0 &&
    statusForm.reason.trim().length > 0
  )

  const canSubmitUndo = depositSelection.length > 0
  // When opening the modal from the Opportunity Revenue Schedules tab,
  // seed the Status tab selection from any pre-selected schedules.
  useEffect(() => {
    if (!isOpen) {
      setStatusPrefillApplied(false)
      return
    }

    if (statusPrefillApplied) {
      return
    }

    if (!initialStatusSelection || initialStatusSelection.length === 0) {
      return
    }

    setStatusForm(prev => ({
      ...prev,
      selectedIds: Array.from(new Set([...prev.selectedIds, ...initialStatusSelection]))
    }))
    setStatusPrefillApplied(true)
  }, [initialStatusSelection, isOpen, statusPrefillApplied])

  const primaryLabel = activeTab === "create"
    ? "Create"
    : activeTab === "rates"
      ? "Update Rates"
      : activeTab === "split"
        ? "Update Split"
        : activeTab === "status"
          ? statusForm.action === "delete" ? "Delete" : "Deactivate"
          : "Undo Match"

  const primaryDisabled = submitting || (
    activeTab === "create"
      ? !canSubmitCreate
      : activeTab === "rates"
        ? !canSubmitRates
        : activeTab === "split"
          ? !canSubmitSplits
          : activeTab === "status"
            ? !canSubmitStatus
            : !canSubmitUndo
  )

  const handleClose = useCallback(() => {
    if (submitting) return
    onClose()
  }, [onClose, submitting])

  const handleCreateSubmit = useCallback(async () => {
    if (!canSubmitCreate || amountPerSchedule === null || !commissionRateValid) {
      return
    }

    const payload = {
      productId: createForm.productId,
      seriesName: createForm.seriesName.trim() || null,
      startDate: createForm.startDate,
      cadence: createForm.cadence,
      occurrences: createForm.cadence === "OneTime" ? 1 : occurrencesNumber,
      quantity: quantityNumber,
      priceEach: priceEachNumber,
      amountMode: createForm.amountMode,
      amountPerSchedule,
      commissionRatePercent: commissionRateNumber,
      commissionSplit: {
        house: parseNumber(createForm.splitHouse),
        houseRep: parseNumber(createForm.splitHouseRep),
        subagent: parseNumber(createForm.splitSubagent)
      },
      isChargeback: createForm.isChargeback,
      chargebackReason: createForm.isChargeback ? createForm.chargebackReason.trim() : null,
      notes: createForm.notes.trim() || null
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/revenue-schedules/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message = body?.error ?? "Unable to create revenue schedules"
        throw new Error(message)
      }

      showSuccess("Revenue schedules created", "The schedule series was created successfully.")
      await onSuccess?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create revenue schedules"
      setError(message)
      showError("Revenue schedule create failed", message)
    } finally {
      setSubmitting(false)
    }
  }, [amountPerSchedule, canSubmitCreate, commissionRateNumber, commissionRateValid, createForm.amountMode, createForm.cadence, createForm.chargebackReason, createForm.isChargeback, createForm.notes, createForm.productId, createForm.seriesName, createForm.splitHouse, createForm.splitHouseRep, createForm.splitSubagent, createForm.startDate, onClose, onSuccess, occurrencesNumber, opportunityId, priceEachNumber, quantityNumber, showError, showSuccess])

  const handleRateSubmit = useCallback(async () => {
    if (!canSubmitRates) return

    const payload = {
      scheduleIds: rateForm.selectedIds,
      effectiveDate: rateForm.effectiveDate,
      ratePercent: parseNumber(rateForm.ratePercent),
      scope: rateForm.scope
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/revenue-schedules/bulk/update-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message = body?.error ?? "Unable to update commission rates"
        throw new Error(message)
      }

      showSuccess("Commission rates updated", "Rate changes will apply going forward.")
      await onSuccess?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update commission rates"
      setError(message)
      showError("Rate update failed", message)
    } finally {
      setSubmitting(false)
    }
  }, [canSubmitRates, onClose, onSuccess, rateForm.effectiveDate, rateForm.ratePercent, rateForm.scope, rateForm.selectedIds, showError, showSuccess])

  const handleSplitSubmit = useCallback(async () => {
    if (!canSubmitSplits) return

    const payload = {
      scheduleIds: splitForm.selectedIds,
      effectiveDate: splitForm.effectiveDate,
      splits: {
        house: parseNumber(splitForm.house),
        houseRep: parseNumber(splitForm.houseRep),
        subagent: parseNumber(splitForm.subagent)
      },
      scope: splitForm.scope
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/revenue-schedules/bulk/update-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message = body?.error ?? "Unable to update commission splits"
        throw new Error(message)
      }

      showSuccess("Commission splits updated", "Selected schedules now use the updated splits.")
      await onSuccess?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update commission splits"
      setError(message)
      showError("Split update failed", message)
    } finally {
      setSubmitting(false)
    }
  }, [canSubmitSplits, onClose, onSuccess, showError, showSuccess, splitForm.effectiveDate, splitForm.house, splitForm.houseRep, splitForm.scope, splitForm.selectedIds, splitForm.subagent])

  const handleStatusSubmit = useCallback(async () => {
    if (!canSubmitStatus) return

    const ids = statusForm.selectedIds.filter(id => !getIneligibilityReason(id))
    if (!ids || ids.length === 0) {
      const message = "No eligible schedules selected to update."
      setError(message)
      showError("Schedule update failed", message)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
        if (statusForm.action === "delete") {
          const results = await Promise.allSettled(
            ids.map(async id => {
              const deleteUrl = new URL(
                `/api/revenue-schedules/${encodeURIComponent(id)}`,
                window.location.origin
              )
              if (statusForm.reason.trim()) {
                deleteUrl.searchParams.set("reason", statusForm.reason.trim())
              }
              const response = await fetch(deleteUrl.toString(), { method: "DELETE" })

            if (!response.ok) {
              const body = await response.json().catch(() => null)
              const message = body?.error ?? "Unable to delete revenue schedule"
              throw new Error(message)
            }

            return id
          })
        )

        const successfulIds: string[] = []
        const failedResults: Array<{ id: string; error: string }> = []

        results.forEach((result, index) => {
          const id = ids[index]
          if (result.status === "fulfilled") {
            successfulIds.push(result.value)
          } else {
            const errorMessage =
              result.reason instanceof Error ? result.reason.message : String(result.reason)
            failedResults.push({ id, error: errorMessage })
          }
        })

        const deletedCount = successfulIds.length
        const failedCount = failedResults.length

        if (deletedCount > 0) {
          showSuccess(
            `Deleted ${deletedCount} schedule${deletedCount === 1 ? "" : "s"}`,
            "Selected schedules were removed."
          )
        }

        if (failedCount > 0) {
          const nextReasons: Record<string, string> = {}
          failedResults.forEach(({ id, error }) => {
            nextReasons[id] = error
          })
          setIneligibleReasons(prev => ({ ...prev, ...nextReasons }))

          const detailMessages = failedResults.map(result => result.error).join("; ")
          const summary =
            deletedCount > 0
              ? `${deletedCount} schedule${deletedCount === 1 ? "" : "s"} deleted; ${failedCount} could not be deleted.`
              : `${failedCount} schedule${failedCount === 1 ? "" : "s"} could not be deleted.`

          const combinedDetail = detailMessages ? `${summary} ${detailMessages}` : summary

          setError(combinedDetail)
          showError("Some schedules could not be deleted", combinedDetail)

          if (deletedCount === 0) {
            // Nothing succeeded; keep modal open for review
            return
          }
        }

        await onSuccess?.()
        onClose()
      } else {
        const response = await fetch("/api/revenue-schedules/bulk/deactivate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleIds: ids,
            reason: statusForm.reason.trim() || null,
            scope: statusForm.scope
          })
        })

        const body = await response.json().catch(() => null)
        if (!response.ok) {
          const message = body?.error ?? "Unable to deactivate schedules"
          throw new Error(message)
        }

        const updatedCount: number = typeof body?.updated === "number" ? body.updated : ids.length
        const failed: string[] = Array.isArray(body?.failed) ? body.failed : []

        if (updatedCount > 0) {
          showSuccess(
            `Deactivated ${updatedCount} schedule${updatedCount === 1 ? "" : "s"}`,
            "Selected schedules were marked inactive."
          )
        }

        if (failed.length > 0) {
          const errors = body?.errors as Record<string, string> | undefined
          if (errors && typeof errors === "object") {
            setIneligibleReasons(prev => ({ ...prev, ...errors }))
          }
          const detail = failed
            .map(id => errors?.[id])
            .filter(Boolean)
            .join("; ")
          if (detail) {
            setError(detail)
            showError("Some schedules could not be deactivated", detail)
          }
        }

        if (updatedCount > 0) {
          await onSuccess?.()
          onClose()
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update schedules"
      setError(message)
      showError("Schedule update failed", message)
    } finally {
      setSubmitting(false)
    }
  }, [
    canSubmitStatus,
    getIneligibilityReason,
    onClose,
    onSuccess,
    showError,
    showSuccess,
    statusForm.action,
    statusForm.selectedIds,
    statusForm.reason,
    statusForm.scope
  ])

  const submitBulkRateUpdate = useCallback(async () => {
    if (!canSubmitRates) return

    const payload = {
      scheduleIds: rateForm.selectedIds,
      effectiveDate: rateForm.effectiveDate,
      ratePercent: parseNumber(rateForm.ratePercent),
      scope: rateForm.scope
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/revenue-schedules/bulk/update-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const message = body?.error ?? "Unable to update commission rates"
        throw new Error(message)
      }

      const updatedCount: number =
        typeof body?.updated === "number" ? body.updated : rateForm.selectedIds.length
      const failedIds: string[] = Array.isArray(body?.failed) ? body.failed : []
      const errors = (body?.errors ?? null) as Record<string, string> | null

      if (updatedCount === 0) {
        const message =
          failedIds.length > 0
            ? "No commission rates were updated. Some schedules may be ineligible for changes."
            : "No commission rates were updated."
        setError(message)
        showError("Rate update failed", message)
        return
      }

      if (failedIds.length > 0 && errors && typeof errors === "object") {
        const detail = failedIds
          .map(id => errors[id])
          .filter(Boolean)
          .join("; ")
        if (detail) {
          setError(detail)
          showError("Some commission rates could not be updated", detail)
        }
      }

      showSuccess(
        `Commission rates updated for ${updatedCount} product${updatedCount === 1 ? "" : "s"}.`,
        "Rate changes will apply going forward."
      )
      await onSuccess?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update commission rates"
      setError(message)
      showError("Rate update failed", message)
    } finally {
      setSubmitting(false)
    }
  }, [
    canSubmitRates,
    onClose,
    onSuccess,
    rateForm.effectiveDate,
    rateForm.ratePercent,
    rateForm.scope,
    rateForm.selectedIds,
    showError,
    showSuccess
  ])

  const submitBulkSplitUpdate = useCallback(async () => {
    if (!canSubmitSplits) return

    const payload = {
      scheduleIds: splitForm.selectedIds,
      effectiveDate: splitForm.effectiveDate,
      splits: {
        house: parseNumber(splitForm.house),
        houseRep: parseNumber(splitForm.houseRep),
        subagent: parseNumber(splitForm.subagent)
      },
      scope: splitForm.scope
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/revenue-schedules/bulk/update-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const message = body?.error ?? "Unable to update commission splits"
        throw new Error(message)
      }

      const updatedCount: number =
        typeof body?.updated === "number" ? body.updated : splitForm.selectedIds.length
      const failedIds: string[] = Array.isArray(body?.failed) ? body.failed : []
      const errors = (body?.errors ?? null) as Record<string, string> | null

      if (updatedCount === 0) {
        const message =
          failedIds.length > 0
            ? "No commission splits were updated. Some opportunities may be ineligible for changes."
            : "No commission splits were updated."
        setError(message)
        showError("Split update failed", message)
        return
      }

      if (failedIds.length > 0 && errors && typeof errors === "object") {
        const detail = failedIds
          .map(id => errors[id])
          .filter(Boolean)
          .join("; ")
        if (detail) {
          setError(detail)
          showError("Some commission splits could not be updated", detail)
        }
      }

      showSuccess(
        `Commission splits updated for ${updatedCount} opportunit${updatedCount === 1 ? "y" : "ies"}.`,
        "Selected schedules now use the updated splits."
      )
      await onSuccess?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update commission splits"
      setError(message)
      showError("Split update failed", message)
    } finally {
      setSubmitting(false)
    }
  }, [
    canSubmitSplits,
    onClose,
    onSuccess,
    showError,
    showSuccess,
    splitForm.effectiveDate,
    splitForm.house,
    splitForm.houseRep,
    splitForm.scope,
    splitForm.selectedIds,
    splitForm.subagent
  ])

  const handleUndoSubmit = useCallback(async () => {
    if (!canSubmitUndo) return

    const payload = {
      matchIds: depositSelection
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/revenue-schedules/bulk/undo-deposit-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const message = body?.error ?? "Unable to undo deposit matches"
        throw new Error(message)
      }

      const updatedCount: number =
        typeof body?.updated === "number" ? body.updated : depositSelection.length
      const failedIds: string[] = Array.isArray(body?.failed) ? body.failed : []
      const errors = (body?.errors ?? null) as Record<string, string> | null

      if (updatedCount === 0) {
        const message =
          failedIds.length > 0
            ? "No deposit matches were undone. Some lines may be ineligible for changes."
            : "No deposit matches were undone."
        setError(message)
        showError("Undo match failed", message)
        return
      }

      if (failedIds.length > 0 && errors && typeof errors === "object") {
        const detail = failedIds
          .map(id => errors[id])
          .filter(Boolean)
          .join("; ")
        if (detail) {
          setError(detail)
          showError("Some deposit matches could not be undone", detail)
        }
      }

      showSuccess(
        `Deposit matches undone for ${updatedCount} line${updatedCount === 1 ? "" : "s"}.`,
        "Selected deposit matches were reversed."
      )
      await onSuccess?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to undo deposit matches"
      setError(message)
      showError("Undo match failed", message)
    } finally {
      setSubmitting(false)
    }
  }, [canSubmitUndo, depositSelection, onClose, onSuccess, showError, showSuccess])

  const handlePrimary = useCallback(() => {
    if (activeTab === "create") {
      handleCreateSubmit()
    } else if (activeTab === "rates") {
      submitBulkRateUpdate()
    } else if (activeTab === "split") {
      submitBulkSplitUpdate()
    } else if (activeTab === "status") {
      if (!canSubmitStatus) return
      setShowStatusConfirm(true)
    } else {
      handleUndoSubmit()
    }
  }, [
    activeTab,
    canSubmitStatus,
    handleCreateSubmit,
    handleUndoSubmit,
    submitBulkRateUpdate,
    submitBulkSplitUpdate
  ])

  const handleStatusConfirm = useCallback(() => {
    setShowStatusConfirm(false)
    void handleStatusSubmit()
  }, [handleStatusSubmit])

  const handleStatusCancel = useCallback(() => {
    if (submitting) {
      return
    }
    setShowStatusConfirm(false)
  }, [submitting])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="flex h-[900px] w-full max-w-[1024px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">
              {activeTab === "create"
                ? "Create Schedules"
                : activeTab === "rates"
                  ? "Change Commission Rate"
                  : activeTab === "split"
                    ? "Change Commission Split"
                    : activeTab === "status"
                      ? "Deactivate or Delete"
                      : "Undo Deposit Match"}
            </p>
            <h2 className="text-lg font-semibold text-gray-900">Manage Revenue Schedules for {opportunityName}</h2>
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

        <div className="border-b border-gray-200 px-6 pt-4">
          <div className="flex flex-wrap gap-2">
            {TAB_DEFINITIONS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-semibold shadow-sm transition",
                  activeTab === tab.id
                    ? "border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                    : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:from-blue-200 hover:to-blue-300 hover:border-blue-400"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "create" ? (
            <div className="space-y-5">
              <div className="space-y-5">
                <div className="space-y-4">
                  <div className="grid gap-x-12 gap-y-4 sm:grid-cols-2" data-section="create-schedules-two-col">
                    <div className="sm:col-start-1">
                    <label className={labelCls}>Opportunity Product<span className="ml-1 text-red-500">*</span></label>
                    <select
                      value={createForm.productId}
                      onChange={event => {
                        const nextValue = event.target.value
                        const product = productOptions.find(option => option.value === nextValue)
                        setCreateForm(prev => ({
                          ...prev,
                          productId: nextValue,
                          seriesName: product?.label ?? prev.seriesName,
                          quantity: formatNumber(product?.quantity ?? null, 2) || prev.quantity,
                          priceEach: formatNumber(product?.priceEach ?? null, 2)
                        }))
                      }}
                      className={selectCls}
                    >
                      <option value="">Select a product</option>
                      {productOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-start-2">
                    <label className={labelCls}>Schedule Series Name</label>
                    <input
                      type="text"
                      value={createForm.seriesName}
                      onChange={event => setCreateForm(prev => ({ ...prev, seriesName: event.target.value }))}
                      className={inputCls}
                      placeholder="Product Name – Vendor"
                    />
                  </div>

                  <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Start Date<span className="ml-1 text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type="date"
                          value={createForm.startDate}
                          onChange={event => setCreateForm(prev => ({ ...prev, startDate: event.target.value }))}
                          className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:outline-none focus:border-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0"
                          style={{ colorScheme: "light" }}
                        />
                        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">
                          {createForm.startDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Cadence</label>
                      <select
                        value={createForm.cadence}
                        onChange={event => setCreateForm(prev => ({ ...prev, cadence: event.target.value as typeof prev.cadence }))}
                        className={selectCls}
                      >
                        {CADENCE_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                    {createForm.cadence !== "OneTime" ? (
                      <div>
                        <label className={labelCls}>Number of Schedules<span className="ml-1 text-red-500">*</span></label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={createForm.occurrences}
                          onChange={event => setCreateForm(prev => ({ ...prev, occurrences: event.target.value }))}
                          className={inputCls}
                          placeholder="12"
                        />
                      </div>
                    ) : null}

                    <div>
                      <label className={labelCls}>Quantity</label>
                      <input
                        type="number"
                        step="0.01"
                        value={createForm.quantity}
                        onChange={event => setCreateForm(prev => ({ ...prev, quantity: event.target.value }))}
                        className={inputCls}
                        placeholder="1.00"
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Price Each</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={displayPriceEach}
                        onChange={handleDecimalChangeCreate("priceEach")}
                        onFocus={() => setPriceEachFocused(true)}
                        onBlur={() => {
                          setPriceEachFocused(false)
                          handleDecimalBlurCreate("priceEach")()
                        }}
                        className={inputCls}
                        placeholder="$100.00"
                      />
                    </div>
                  </div>

                  </div>

                  <div className="grid gap-4 sm:grid-cols-4">
                    <div>
                      <label className={labelCls}>Commission Rate %<span className="ml-1 text-red-500">*</span></label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={displayCommissionRate}
                        onChange={handleDecimalChangeCreate("commissionRate")}
                        onFocus={() => setCommissionRateFocused(true)}
                        onBlur={() => {
                          setCommissionRateFocused(false)
                          handleDecimalBlurCreate("commissionRate")()
                        }}
                        className={inputCls}
                        placeholder="10.00%"
                      />
                      {!commissionRateValid ? (
                        <p className="mt-1 text-[11px] text-rose-600">Enter a value between 0 and 100.</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelCls}>House %</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={displaySplitHouse}
                        onChange={handleDecimalChangeCreate("splitHouse")}
                        onFocus={() => setSplitHouseFocused(true)}
                        onBlur={() => {
                          setSplitHouseFocused(false)
                          handleDecimalBlurCreate("splitHouse")()
                        }}
                        className={inputCls}
                        placeholder="20.00%"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>House Rep %</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={displaySplitHouseRep}
                        onChange={handleDecimalChangeCreate("splitHouseRep")}
                        onFocus={() => setSplitHouseRepFocused(true)}
                        onBlur={() => {
                          setSplitHouseRepFocused(false)
                          handleDecimalBlurCreate("splitHouseRep")()
                        }}
                        className={inputCls}
                        placeholder="30.00%"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Subagent %</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={displaySplitSubagent}
                        onChange={handleDecimalChangeCreate("splitSubagent")}
                        onFocus={() => setSplitSubagentFocused(true)}
                        onBlur={() => {
                          setSplitSubagentFocused(false)
                          handleDecimalBlurCreate("splitSubagent")()
                        }}
                        className={inputCls}
                        placeholder="50.00%"
                      />
                    </div>
                  </div>
                  {!splitSumValid ? (
                    <p className="text-[11px] text-rose-600">Commission split must total 100%.</p>
                  ) : (
                    <p className="text-[11px] text-gray-500">Current total: {splitTotals.sum.toFixed(2)}%</p>
                  )}

                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea
                      value={createForm.notes}
                      onChange={event => setCreateForm(prev => ({ ...prev, notes: event.target.value }))}
                      className={textAreaCls}
                      placeholder="Share any relevant details for this schedule series"
                    />
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-2">
                      <label className={labelCls}>Chargeback</label>
                      <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={createForm.isChargeback}
                          onChange={event => setCreateForm(prev => ({ ...prev, isChargeback: event.target.checked }))}
                        />
                        Mark as chargeback (amount becomes negative)
                      </label>
                      {createForm.isChargeback ? (
                        <textarea
                          value={createForm.chargebackReason}
                          onChange={event => setCreateForm(prev => ({ ...prev, chargebackReason: event.target.value }))}
                          className={textAreaCls}
                          placeholder="Provide context for this chargeback"
                        />
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className={labelCls}>Amount Per Schedule</label>
                      <div className="flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="amount-mode"
                            checked={createForm.amountMode === "auto"}
                            onChange={() => setCreateForm(prev => ({ ...prev, amountMode: "auto" }))}
                          />
                          Auto calculate
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="amount-mode"
                            checked={createForm.amountMode === "manual"}
                            onChange={() => setCreateForm(prev => ({ ...prev, amountMode: "manual" }))}
                          />
                          Manual entry
                        </label>
                      </div>
                      {createForm.amountMode === "manual" ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={displayManualAmount}
                          onChange={handleDecimalChangeCreate("manualAmount")}
                          onFocus={() => setManualAmountFocused(true)}
                          onBlur={() => {
                            setManualAmountFocused(false)
                            handleDecimalBlurCreate("manualAmount")()
                          }}
                          className={inputCls}
                          placeholder="$0.00"
                        />
                      ) : (
                        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          {autoAmountPerSchedule !== null ? (
                            <span>
                              Estimated per schedule:{" "}
                              <span className="font-semibold text-gray-900">${autoAmountPerSchedule.toFixed(2)}</span>
                            </span>
                          ) : (
                            <span>Enter quantity and price to calculate the per-schedule amount.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Schedule Preview</h3>
                    {!schedulePreview.length ? (
                      <p className="mt-3 text-xs text-gray-600">Enter the series details to preview upcoming schedules.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <table className="w-full text-left text-xs">
                          <thead className="text-gray-500">
                            <tr>
                              <th className="py-1 font-semibold">#</th>
                              <th className="py-1 font-semibold">Schedule Date</th>
                              <th className="py-1 text-right font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedulePreview.map(row => (
                              <tr key={row.index} className="border-t border-gray-100">
                                <td className="py-1 text-gray-600">{row.index}</td>
                                <td className="py-1 text-gray-800">{row.date}</td>
                                <td className="py-1 text-right text-gray-800">${row.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-700">
                          <p>Total schedules previewed: <span className="font-semibold text-gray-900">{schedulePreview.length}</span></p>
                          {schedulePreviewTotal !== null ? (
                            <p>Total projected amount: <span className="font-semibold text-gray-900">${schedulePreviewTotal.toFixed(2)}</span></p>
                          ) : null}
                          <p>Commission rate: <span className="font-semibold text-gray-900">{commissionRateNumber?.toFixed(2) ?? "--"}%</span></p>
                          <p>Split: <span className="font-semibold text-gray-900">House {splitTotals.house.toFixed(2)}% · House Rep {splitTotals.houseRep.toFixed(2)}% · Subagent {splitTotals.subagent.toFixed(2)}%</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "rates" ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Select schedules</h3>
                {!scheduleOptions.length ? (
                  <p className="mt-2 text-xs text-gray-600">No schedules available yet.</p>
                ) : (
                  <div className="mt-3 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-3">
                    {scheduleOptions.map(option => (
                      <label key={option.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm">
                        <span>
                          <span className="block font-semibold text-gray-900">{option.label}</span>
                          <span className="block text-[11px] text-gray-500">{option.scheduleDate ?? "Date pending"}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={rateForm.selectedIds.includes(option.id)}
                          onChange={event => {
                            const checked = event.target.checked
                            setRateForm(prev => ({
                              ...prev,
                              selectedIds: checked
                                ? [...prev.selectedIds, option.id]
                                : prev.selectedIds.filter(id => id !== option.id)
                            }))
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Effective Date<span className="ml-1 text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="date"
                      value={rateForm.effectiveDate}
                      onChange={event => setRateForm(prev => ({ ...prev, effectiveDate: event.target.value }))}
                      className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:outline-none focus:border-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0"
                      style={{ colorScheme: "light" }}
                    />
                    <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">
                      {rateForm.effectiveDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                    </span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>New Commission Rate %<span className="ml-1 text-red-500">*</span></label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={displayRatePercent}
                    onChange={handleDecimalChangeRate("ratePercent")}
                    onFocus={() => setRatePercentFocused(true)}
                    onBlur={() => {
                      setRatePercentFocused(false)
                      handleDecimalBlurRate("ratePercent")()
                    }}
                    className={inputCls}
                    placeholder="10.00%"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Apply To</label>
                <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                  <span>Selected schedules (updates underlying product rate).</span>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "split" ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Select schedules</h3>
                {!scheduleOptions.length ? (
                  <p className="mt-2 text-xs text-gray-600">No schedules available yet.</p>
                ) : (
                  <div className="mt-3 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-3">
                    {scheduleOptions.map(option => (
                      <label key={option.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm">
                        <span>
                          <span className="block font-semibold text-gray-900">{option.label}</span>
                          <span className="block text-[11px] text-gray-500">Current rate {option.commissionRate.toFixed(2)}%</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={splitForm.selectedIds.includes(option.id)}
                          onChange={event => {
                            const checked = event.target.checked
                            setSplitForm(prev => ({
                              ...prev,
                              selectedIds: checked
                                ? [...prev.selectedIds, option.id]
                                : prev.selectedIds.filter(id => id !== option.id)
                            }))
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Effective Date<span className="ml-1 text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="date"
                      value={splitForm.effectiveDate}
                      onChange={event => setSplitForm(prev => ({ ...prev, effectiveDate: event.target.value }))}
                      className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:outline-none focus:border-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0"
                      style={{ colorScheme: "light" }}
                    />
                    <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">
                      {splitForm.effectiveDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                    </span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Apply To</label>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                    <span>Selected schedules (overrides the opportunity&apos;s default splits for these schedules only).</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>House %</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={displaySplitFormHouse}
                    onChange={handleDecimalChangeSplit("house")}
                    onFocus={() => setSplitFormHouseFocused(true)}
                    onBlur={() => {
                      setSplitFormHouseFocused(false)
                      handleDecimalBlurSplit("house")()
                    }}
                    className={inputCls}
                    placeholder="20.00%"
                  />
                </div>
                <div>
                  <label className={labelCls}>House Rep %</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={displaySplitFormHouseRep}
                    onChange={handleDecimalChangeSplit("houseRep")}
                    onFocus={() => setSplitFormHouseRepFocused(true)}
                    onBlur={() => {
                      setSplitFormHouseRepFocused(false)
                      handleDecimalBlurSplit("houseRep")()
                    }}
                    className={inputCls}
                    placeholder="30.00%"
                  />
                </div>
                <div>
                  <label className={labelCls}>Subagent %</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={displaySplitFormSubagent}
                    onChange={handleDecimalChangeSplit("subagent")}
                    onFocus={() => setSplitFormSubagentFocused(true)}
                    onBlur={() => {
                      setSplitFormSubagentFocused(false)
                      handleDecimalBlurSplit("subagent")()
                    }}
                    className={inputCls}
                    placeholder="50.00%"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-500">Current total: {splitFormTotals.total.toFixed(2)}%</p>
              {Math.abs(splitFormTotals.total - 100) >= 0.01 ? (
                <p className="text-[11px] text-rose-600">Splits must total 100%.</p>
              ) : null}
            </div>
          ) : null}

          {activeTab === "status" ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Select schedules</h3>
                {!statusScheduleOptions.length ? (
                  <p className="mt-2 text-xs text-gray-600">No schedules available yet.</p>
                ) : (
                  <div className="mt-3 h-56 overflow-y-auto rounded-lg border border-gray-200">
                    <div className="min-w-[880px]">
                      <div className="grid grid-cols-[auto_minmax(0,2.1fr)_minmax(0,2.1fr)_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,2.2fr)_minmax(0,1.4fr)] border-b bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        <div className="text-center">Selected</div>
                        <div>Revenue Schedule</div>
                        <div>Vendor - Product Name</div>
                        <div>Distributor</div>
                        <div>Vendor</div>
                        <div>Opportunity</div>
                        <div>Schedule Date</div>
                      </div>
                      {statusScheduleOptions.map(option => {
                        const ineligibilityReason = getIneligibilityReason(option.id)
                        const isEligible = !ineligibilityReason
                        const checked = statusForm.selectedIds.includes(option.id)

                        return (
                          <label
                            key={option.id}
                            title={ineligibilityReason}
                            className={cn(
                              "grid grid-cols-[auto_minmax(0,2.1fr)_minmax(0,2.1fr)_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,2.2fr)_minmax(0,1.4fr)] items-center border-b px-3 py-2 text-xs last:border-b-0",
                              isEligible ? "text-gray-700" : "cursor-not-allowed bg-gray-50 text-gray-400"
                            )}
                          >
                            <div className="flex items-center justify-center gap-2 pr-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-400 text-primary-600 accent-primary-600 disabled:opacity-60"
                                checked={checked}
                                disabled={!isEligible}
                                onChange={event => {
                                  if (!isEligible) return
                                  const checkedInput = event.target.checked
                                  setStatusForm(prev => ({
                                    ...prev,
                                    selectedIds: checkedInput
                                      ? [...prev.selectedIds, option.id]
                                      : prev.selectedIds.filter(id => id !== option.id)
                                  }))
                                }}
                              />
                              {ineligibilityReason ? (
                                <span
                                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] text-gray-500"
                                  title={ineligibilityReason}
                                >
                                  <Info className="h-3 w-3" aria-hidden="true" />
                                </span>
                              ) : null}
                            </div>
                            <div className="truncate font-semibold text-gray-900">{option.label}</div>
                            <div className="truncate">{option.productNameVendor || "--"}</div>
                            <div className="truncate">{option.distributorName || "--"}</div>
                            <div className="truncate">{option.vendorName || "--"}</div>
                            <div className="truncate">{option.opportunityName || "Opportunity"}</div>
                            <div className="truncate">{option.scheduleDate || "--"}</div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Reason<span className="ml-1 text-red-500">*</span></label>
                  <textarea
                    value={statusForm.reason}
                    onChange={event => setStatusForm(prev => ({ ...prev, reason: event.target.value }))}
                    className={textAreaCls}
                    placeholder="Provide the reason for this change"
                  />
                </div>
                <div>
                  <label className={labelCls}>Action</label>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-gray-600">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        className="h-4 w-4 text-primary-600 accent-primary-600"
                        name="status-action"
                        checked={statusForm.action === "deactivate"}
                        onChange={() => setStatusForm(prev => ({ ...prev, action: "deactivate" }))}
                      />
                      Deactivate
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        className="h-4 w-4 text-primary-600 accent-primary-600"
                        name="status-action"
                        checked={statusForm.action === "delete"}
                        onChange={() => setStatusForm(prev => ({ ...prev, action: "delete" }))}
                      />
                      Delete
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "undo" ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <p>Undo a deposit match to reopen the schedule for reconciliation.</p>
                <p className="mt-2 text-xs text-gray-500">
                  Selected deposit lines will be reset and any matches on those lines will be removed so balances return
                  to outstanding and can be re-matched.
                </p>
              </div>

              {depositLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-600" /> Loading deposit matches…
                </div>
              ) : null}

              {depositError ? (
                <div className="rounded-md border border-dashed border-gray-300 bg-white px-4 py-3 text-xs text-gray-600">
                  {depositError}
                </div>
              ) : null}

              {depositMatches.length > 0 ? (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="px-3 py-2">Select</th>
                        <th className="px-3 py-2">Deposit</th>
                        <th className="px-3 py-2">Schedule</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depositMatches.map(match => (
                        <tr key={match.id} className="border-t border-gray-100 text-gray-700">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={depositSelection.includes(match.id)}
                              onChange={event => {
                                const checked = event.target.checked
                                setDepositSelection(prev => (
                                  checked ? [...prev, match.id] : prev.filter(id => id !== match.id)
                                ))
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-semibold text-gray-900">{match.depositReference ?? match.depositId ?? "Deposit"}</span>
                            <span className="block text-[11px] text-gray-500">{match.depositDate ?? "--"}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-semibold text-gray-900">{match.scheduleNumber ?? "Schedule"}</span>
                          </td>
                          <td className="px-3 py-2 text-right">{match.amount !== null && match.amount !== undefined ? `$${match.amount.toFixed(2)}` : "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mx-6 mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {activeTab === "status" ? (
          <div
            className="mx-6 mb-3 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-600"
            title="Schedules that have usage or commission applied cannot be deleted or modified."
          >
            <Info className="mt-0.5 h-4 w-4 text-gray-400" aria-hidden="true" />
            <p>
              <span className="font-semibold text-gray-700">Legend:</span>{" "}
              Schedules that have usage or commission applied cannot be deleted or modified.
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={primaryDisabled}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed",
              activeTab === "status"
                ? "bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                : "bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300"
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {primaryLabel}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showStatusConfirm}
        title={statusForm.action === "delete" ? "Delete revenue schedules" : "Deactivate revenue schedules"}
        description={
          statusForm.action === "delete"
            ? `Delete ${eligibleSelectedCount} schedule${eligibleSelectedCount === 1 ? "" : "s"}? This action cannot be undone.${ineligibleSelectedCount > 0 ? ` ${ineligibleSelectedCount} selected schedule${ineligibleSelectedCount === 1 ? " is" : "s are"} ineligible and will be skipped.` : ""}`
            : `Deactivate ${eligibleSelectedCount} schedule${eligibleSelectedCount === 1 ? "" : "s"}? Deactivated schedules stop billing but remain in history.${ineligibleSelectedCount > 0 ? ` ${ineligibleSelectedCount} selected schedule${ineligibleSelectedCount === 1 ? " is" : "s are"} ineligible and will be skipped.` : ""}`
        }
        confirmLabel={statusForm.action === "delete" ? "Delete" : "Deactivate"}
        cancelLabel="Cancel"
        onConfirm={handleStatusConfirm}
        onCancel={handleStatusCancel}
        loading={submitting}
        error={null}
      />
    </div>
  )
}
