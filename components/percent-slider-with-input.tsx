'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

function getStepPrecision(step: number) {
  if (!Number.isFinite(step)) return 0
  const [, decimals = ''] = String(step).split('.')
  return decimals.length
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function snapToStep(value: number, min: number, step: number) {
  if (!Number.isFinite(value)) return value
  if (!Number.isFinite(step) || step <= 0) return value
  const snapped = Math.round((value - min) / step) * step + min
  const precision = getStepPrecision(step)
  return Number(snapped.toFixed(precision))
}

function formatForInput(value: number, step: number) {
  if (!Number.isFinite(value)) return ''
  const precision = getStepPrecision(step)
  const fixed = precision > 0 ? value.toFixed(precision) : String(Math.round(value))
  return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.0+$/, '').replace(/\.$/, '')
}

export type PercentSliderWithInputProps = {
  label: string
  helpText?: string
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  step: number
  sliderMaxWidthClassName?: string
}

export function PercentSliderWithInput({
  label,
  helpText,
  value,
  onChange,
  min,
  max,
  step,
  sliderMaxWidthClassName = 'max-w-[560px]',
}: PercentSliderWithInputProps) {
  const reactId = useId()
  const labelId = useMemo(() => `percent-setting-label-${reactId}`, [reactId])
  const sliderId = useMemo(() => `percent-setting-slider-${reactId}`, [reactId])
  const inputId = useMemo(() => `percent-setting-input-${reactId}`, [reactId])

  const isEditingRef = useRef(false)
  const [inputText, setInputText] = useState(() => formatForInput(value, step))

  useEffect(() => {
    if (isEditingRef.current) return
    setInputText(formatForInput(value, step))
  }, [value, step])

  const commit = (next: number) => {
    if (!Number.isFinite(next)) return
    const clamped = clamp(next, min, max)
    const snapped = snapToStep(clamped, min, step)
    onChange(clamp(snapped, min, max))
  }

  const handleSliderChange = (rawValue: string) => {
    const next = Number(rawValue)
    if (!Number.isFinite(next)) return
    commit(next)
  }

  const handleInputChange = (rawValue: string) => {
    setInputText(rawValue)
    const next = Number(rawValue)
    if (!Number.isFinite(next)) return
    commit(next)
  }

  const handleInputBlur = () => {
    isEditingRef.current = false
    const next = Number(inputText)
    if (!Number.isFinite(next)) {
      setInputText(formatForInput(value, step))
      return
    }
    const clamped = clamp(next, min, max)
    const snapped = snapToStep(clamped, min, step)
    setInputText(formatForInput(snapped, step))
    onChange(clamp(snapped, min, max))
  }

  const handleInputFocus = () => {
    isEditingRef.current = true
  }

  return (
    <div className="space-y-2">
      <label id={labelId} htmlFor={inputId} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`w-full flex-1 ${sliderMaxWidthClassName}`}>
          <input
            id={sliderId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => handleSliderChange(e.target.value)}
            aria-labelledby={labelId}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={inputText}
            onChange={e => handleInputChange(e.target.value)}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm text-slate-700 tabular-nums focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <span className="text-sm text-slate-700">%</span>
        </div>
      </div>
      {helpText ? <p className="text-xs text-slate-500">{helpText}</p> : null}
    </div>
  )
}

