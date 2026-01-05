"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { formatCurrencyDisplay, formatDecimalToFixed, normalizeDecimalInput } from "@/lib/number-format"
import { ModalHeader } from "./ui/modal-header"

export interface SourceScheduleData {
  scheduleNumber: string | null
  scheduleDate: string | null
  quantity: number | null
  unitPrice: number | null
  usageAdjustment: number | null
  commissionRatePercent?: number | null
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
  const [unitPriceFocused, setUnitPriceFocused] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setEffectiveDate(defaultDate)
    setMonths("1")

    if (sourceSchedule) {
      const rawName = sourceSchedule.scheduleNumber ?? ""
      const trimmedName = rawName.trim()
      setScheduleNumber(trimmedName)

      setQuantity(sourceSchedule.quantity !== null ? String(sourceSchedule.quantity) : "")
      setUnitPrice(sourceSchedule.unitPrice !== null ? String(sourceSchedule.unitPrice) : "")
    } else {
      setScheduleNumber("")
      setQuantity("")
      setUnitPrice("")
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

  const scheduleNumberValid = scheduleNumber.trim().length > 0

  const disabled =
    submitting ||
    !effectiveDate ||
    !monthsValid ||
    !quantityValid ||
    !unitPriceValid ||
    !scheduleNumberValid

  const handleConfirm = () => {
    const params: CloneParameters = {
      effectiveDate,
      months: parsedMonths,
      scheduleNumber: scheduleNumber.trim() || undefined,
      quantity: parsedQuantity ?? undefined,
      unitPrice: parsedUnitPrice ?? undefined,
    }
    onConfirm(params)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
        <ModalHeader kicker="Revenue Schedule" title="Copy/Extend Revenue Schedule" />

        <div className="space-y-4 px-6 py-4">
          {sourceSchedule && (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-[11px] text-gray-700">
              <div className="mb-1 font-semibold text-gray-800">Source Schedule</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Name
                  </div>
                  <div className="truncate text-[11px] text-gray-900">
                    {sourceSchedule.scheduleNumber?.trim() || "Untitled schedule"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Usage Net
                  </div>
                  <div className="text-[11px] text-gray-900">
                    {(() => {
                      const qty = sourceSchedule.quantity ?? null
                      const price = sourceSchedule.unitPrice ?? null
                      const adj = sourceSchedule.usageAdjustment ?? 0
                      if (qty === null || price === null) return "--"
                      const net = qty * price + adj
                      if (!Number.isFinite(net)) return "--"
                      try {
                        return new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(net)
                      } catch {
                        return `$${net.toFixed(2)}`
                      }
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Expected Rate
                  </div>
                  <div className="text-[11px] text-gray-900">
                    {(() => {
                      const rate = sourceSchedule.commissionRatePercent
                      if (rate === null || rate === undefined || !Number.isFinite(rate)) return "--"
                      try {
                        return new Intl.NumberFormat("en-US", {
                          style: "percent",
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(rate / 100)
                      } catch {
                        return `${rate.toFixed(2)}%`
                      }
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

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

          {/* Layout for Quantity, Price */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <input
                  id="clone-unit-price"
                  type="text"
                  inputMode="decimal"
                  className={cn(
                    inputUnderlineCls,
                    !unitPriceValid && "border-rose-500 focus:border-rose-500",
                  )}
                  value={unitPrice ? (unitPriceFocused ? unitPrice : formatCurrencyDisplay(unitPrice, { alwaysSymbol: true })) : ""}
                  onChange={event => {
                    const normalized = normalizeDecimalInput(event.target.value)
                    setUnitPrice(normalized)
                  }}
                  onFocus={() => setUnitPriceFocused(true)}
                  onBlur={() => {
                    setUnitPriceFocused(false)
                    setUnitPrice(prev => formatDecimalToFixed(prev))
                  }}
                  disabled={submitting}
                  placeholder="$0.00"
                />
              </div>
              {!unitPriceValid && <p className={errorTextCls}>Price cannot be negative</p>}
            </div>
          </div>

          {/* Two column layout for Date and Months */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={labelCls} htmlFor="clone-effective-date">
                Revenue Schedule Date
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
                Number of Schedules to Create
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
            {submitting ? "Copying..." : "Copy & Extend"}
          </button>
        </div>
      </div>
    </div>
  )
}
