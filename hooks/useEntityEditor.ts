"use client"

import type { ChangeEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { cloneDeep, diffPatch, hasChanges } from "@/lib/diff"

type ErrorMap = Record<string, string>

type ExtractValue<T> = T extends infer U ? U : never

type Path = string

function getValueAtPath<T>(source: T, path: Path): unknown {
  if (!source) return undefined
  const segments = path.split(".")
  let current: any = source
  for (const segment of segments) {
    if (current == null) return undefined
    current = current[segment]
  }
  return current
}

function setValueAtPath<T>(source: T, path: Path, value: unknown): T {
  const result = cloneDeep(source)
  const segments = path.split(".")
  let cursor: any = result
  for (let index = 0; index < segments.length; index++) {
    const key = segments[index]
    if (index === segments.length - 1) {
      cursor[key] = value
      return result
    }
    if (cursor[key] == null || typeof cursor[key] !== "object") {
      cursor[key] = {}
    }
    cursor = cursor[key]
  }
  return result
}

function sanitisePath(path: string): string {
  return path.trim().replace(/\[(\d+)\]/g, ".$1")
}

export interface UseEntityEditorOptions<T> {
  initial: T | null
  /** optional synchronous validation that returns an error map keyed by path */
  validate?: (draft: T) => ErrorMap
  /** server submission handler, returns the updated entity */
  onSubmit?: (payload: Partial<T>, draft: T) => Promise<T>
}

export interface EntityEditor<T> {
  draft: T | null
  original: T | null
  setField: (path: Path, value: unknown) => void
  getField: (path: Path) => unknown
  register: (path: Path, options?: { defaultValue?: unknown }) => {
    value: unknown
    onChange: (eventOrValue: unknown) => void
    onBlur: () => void
  }
  reset: (next?: T | null) => void
  isDirty: boolean
  errors: ErrorMap
  setErrors: React.Dispatch<React.SetStateAction<ErrorMap>>
  submit: () => Promise<T | null>
  saving: boolean
  touched: Set<Path>
}

export function useEntityEditor<T>({ initial, validate, onSubmit }: UseEntityEditorOptions<T>): EntityEditor<T> {
  const [original, setOriginal] = useState<T | null>(initial ? cloneDeep(initial) : null)
  const [draft, setDraft] = useState<T | null>(initial ? cloneDeep(initial) : null)
  const [errors, setErrors] = useState<ErrorMap>({})
  const [saving, setSaving] = useState(false)
  const touchedRef = useRef<Set<Path>>(new Set())

  useEffect(() => {
    setOriginal(initial ? cloneDeep(initial) : null)
    setDraft(initial ? cloneDeep(initial) : null)
    setErrors({})
    touchedRef.current.clear()
  }, [initial])

  const setField = useCallback((path: Path, value: unknown) => {
    setDraft(current => {
      if (current == null) return current
      const normalised = sanitisePath(path)
      touchedRef.current.add(normalised)
      return setValueAtPath(current, normalised, value)
    })
  }, [])

  const getField = useCallback((path: Path) => {
    if (draft == null) return undefined
    return getValueAtPath(draft, sanitisePath(path))
  }, [draft])

  const register = useCallback(
    (path: Path, options?: { defaultValue?: unknown }) => {
      const normalised = sanitisePath(path)
      const value = getField(normalised)
      return {
        value: value ?? options?.defaultValue ?? "",
        onChange: (eventOrValue: unknown) => {
          let nextValue = eventOrValue
          if (eventOrValue && typeof eventOrValue === "object" && "target" in eventOrValue) {
            const target = (eventOrValue as ChangeEvent<HTMLInputElement>).target
            if (target.type === "checkbox") {
              nextValue = target.checked
            } else {
              nextValue = target.value
            }
          }
          setField(normalised, nextValue)
        },
        onBlur: () => {
          if (!validate || draft == null) return
          const nextErrors = validate(draft)
          setErrors(nextErrors)
        }
      }
    },
    [draft, getField, setField, validate]
  )

  const reset = useCallback((next?: T | null) => {
    const base = next ?? original
    setDraft(base ? cloneDeep(base) : null)
    setOriginal(base ? cloneDeep(base) : null)
    setErrors({})
    touchedRef.current.clear()
  }, [original])

  const isDirty = useMemo(() => hasChanges(original, draft), [original, draft])

  const submit = useCallback(async () => {
    if (draft == null) return null

    if (validate) {
      const validationErrors = validate(draft)
      setErrors(validationErrors)
      if (Object.keys(validationErrors).length > 0) {
        return null
      }
    }

    const patch = diffPatch(original, draft)
    const hasPatchChanges = Array.isArray(patch)
      ? patch.length > 0
      : Object.keys(patch as Record<string, unknown>).length > 0
    if (!hasPatchChanges) {
      return original
    }

    if (!onSubmit) {
      setOriginal(cloneDeep(draft))
      return draft
    }

    setSaving(true)
    try {
      const updated = await onSubmit(patch, draft)
      setOriginal(cloneDeep(updated))
      setDraft(cloneDeep(updated))
      setErrors({})
      touchedRef.current.clear()
      return updated
    } catch (error) {
      throw error
    } finally {
      setSaving(false)
    }
  }, [draft, original, onSubmit, validate])

  return {
    draft,
    original,
    setField,
    getField,
    register,
    reset,
    isDirty,
    errors,
    setErrors,
    submit,
    saving,
    touched: touchedRef.current
  }
}
