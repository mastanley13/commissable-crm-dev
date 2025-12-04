"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SourceScheduleData {
  scheduleNumber: string | null
  scheduleDate: string | null
  quantity: number | null
  unitPrice: number | null
  usageAdjustment: number | null
}

export interface CloneParameters {
  effectiveDate: string
  months: number
  scheduleNumber?: string
  quantity?: number
  unitPrice?: number
  usageAdjustment?: number
}

interface RevenueScheduleCloneModalProps {
  isOpen: boolean
  defaultDate?: string
  submitting?: boolean
  sourceSchedule?: SourceScheduleData
  onConfirm: (params: CloneParameters) => void
  onCancel: () => void
}

const labelCls = "mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
const inputUnderlineCls =
  "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
const errorTextCls = "text-[11px] text-rose-600"

export function RevenueScheduleCloneModal({
  isOpen,
  defaultDate = "",
  submitting = false,
  sourceSchedule,
  onConfirm,
  onCancel,
}: RevenueScheduleCloneModalProps) {
  const [effectiveDate, setEffectiveDate] = useState(defaultDate)
  const [months, setMonths] = useState<string>("1")
  const [scheduleNumber, setScheduleNumber] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [usageAdjustment, setUsageAdjustment] = useState("")

  useEffect(() => {
    if (!isOpen) return
    setEffectiveDate(defaultDate)
    setMonths("1")

    if (sourceSchedule) {
      const rawName = sourceSchedule.scheduleNumber ?? ""
      const trimmedName = rawName.trim()
      const hasCopySuffix = trimmedName.toLowerCase().endsWith("(copy)")
      const nameWithCopy =
        trimmedName.length === 0 ? "(Copy)" : hasCopySuffix ? trimmedName : `${trimmedName} (Copy)`
      setScheduleNumber(nameWithCopy)

      setQuantity(sourceSchedule.quantity !== null ? String(sourceSchedule.quantity) : "")
      setUnitPrice(sourceSchedule.unitPrice !== null ? String(sourceSchedule.unitPrice) : "")
      setUsageAdjustment(
        sourceSchedule.usageAdjustment !== null ? String(sourceSchedule.usageAdjustment) : "0",
      )
    } else {
      setScheduleNumber("")
      setQuantity("")
      setUnitPrice("")
      setUsageAdjustment("0")
    }
  }, [defaultDate, isOpen, sourceSchedule])

  if (!isOpen) {
    return null
  }

  const parsedMonths = Number.parseInt(months, 10)
  const monthsValid = Number.isFinite(parsedMonths) && parsedMonths >= 1 && parsedMonths <= 60

  const parsedQuantity = quantity ? Number.parseFloat(quantity) : null
  const quantityValid =
    quantity === "" || (parsedQuantity !== null && Number.isFinite(parsedQuantity) && parsedQuantity > 0)

  const parsedUnitPrice = unitPrice ? Number.parseFloat(unitPrice) : null
  const unitPriceValid =
    unitPrice === "" || (parsedUnitPrice !== null && Number.isFinite(parsedUnitPrice) && parsedUnitPrice >= 0)

  const parsedUsageAdjustment = usageAdjustment ? Number.parseFloat(usageAdjustment) : null
  const usageAdjustmentValid =
    usageAdjustment === "" ||
    (parsedUsageAdjustment !== null && Number.isFinite(parsedUsageAdjustment))

  const scheduleNumberValid = scheduleNumber.trim().length > 0

  const disabled =
    submitting ||
    !effectiveDate ||
    !monthsValid ||
    !quantityValid ||
    !unitPriceValid ||
    !usageAdjustmentValid ||
    !scheduleNumberValid

  const handleConfirm = () => {
    const params: CloneParameters = {
      effectiveDate,
      months: parsedMonths,
      scheduleNumber: scheduleNumber.trim() || undefined,
      quantity: parsedQuantity ?? undefined,
      unitPrice: parsedUnitPrice ?? undefined,
      usageAdjustment: parsedUsageAdjustment ?? undefined,
    }
    onConfirm(params)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Clone Revenue Schedule</h2>
          </div>
          <button
            type="button"
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {/* Schedule Number */}
          <div className="space-y-1">
            <label className={labelCls} htmlFor="clone-schedule-number">
              Revenue Schedule Name
            </label>
            <input
              id="clone-schedule-number"
              type="text"
              className={cn(inputUnderlineCls, !scheduleNumberValid && "border-rose-500 focus:border-rose-500")}
              value={scheduleNumber}
              onChange={event => setScheduleNumber(event.target.value)}
              disabled={submitting}
              placeholder="Enter schedule name"
            />
            {!scheduleNumberValid && <p className={errorTextCls}>Schedule name is required</p>}
          </div>

          {/* Three column layout for Quantity, Price, Usage */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className={labelCls} htmlFor="clone-quantity">
                Quantity
              </label>
              <input
                id="clone-quantity"
                type="number"
                step="any"
                min="0"
                className={cn(inputUnderlineCls, !quantityValid && "border-rose-500 focus:border-rose-500")}
                value={quantity}
                onChange={event => setQuantity(event.target.value)}
                disabled={submitting}
                placeholder="0"
              />
              {!quantityValid && <p className={errorTextCls}>Quantity must be greater than 0</p>}
            </div>

            <div className="space-y-1">
              <label className={labelCls} htmlFor="clone-unit-price">
                Price Per Unit
              </label>
              <div className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  id="clone-unit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  className={cn(
                    inputUnderlineCls,
                    "pl-4",
                    !unitPriceValid && "border-rose-500 focus:border-rose-500",
                  )}
                  value={unitPrice}
                  onChange={event => setUnitPrice(event.target.value)}
                  disabled={submitting}
                  placeholder="0.00"
                />
              </div>
              {!unitPriceValid && <p className={errorTextCls}>Price cannot be negative</p>}
            </div>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="clone-usage-adjustment">
                Usage Adjustment
              </label>
              <div className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  id="clone-usage-adjustment"
                  type="number"
                  step="0.01"
                  className={cn(
                    inputUnderlineCls,
                    "pl-4",
                    !usageAdjustmentValid && "border-rose-500 focus:border-rose-500",
                  )}
                  value={usageAdjustment}
                  onChange={event => setUsageAdjustment(event.target.value)}
                  disabled={submitting}
                  placeholder="0.00"
                />
              </div>
              {!usageAdjustmentValid && <p className={errorTextCls}>Enter a valid adjustment</p>}
            </div>
          </div>

          {/* Two column layout for Date and Months */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={labelCls} htmlFor="clone-effective-date">
                Start Date
              </label>
              <input
                id="clone-effective-date"
                type="date"
                className={cn(
                  inputUnderlineCls,
                  "pr-8 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-1 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-datetime-edit]:focus:opacity-100",
                  !effectiveDate && "text-gray-400",
                )}
                value={effectiveDate}
                onChange={event => setEffectiveDate(event.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1">
              <label className={labelCls} htmlFor="clone-months">
                Number of Months
              </label>
              <input
                id="clone-months"
                type="number"
                min={1}
                max={60}
                className={cn(inputUnderlineCls, !monthsValid && "border-rose-500 focus:border-rose-500")}
                value={months}
                onChange={event => setMonths(event.target.value)}
                disabled={submitting}
              />
              {!monthsValid && <p className={errorTextCls}>Must be between 1 and 60</p>}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 px-6 pb-6">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={handleConfirm}
            disabled={disabled}
          >
            {submitting ? "Cloning..." : "Clone Schedule"}
          </button>
        </div>
      </div>
    </div>
  )
}
