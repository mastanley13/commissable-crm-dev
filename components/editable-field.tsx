"use client"

import { cloneElement, forwardRef, isValidElement, useId } from "react"
import { cn } from "@/lib/utils"

interface EditableFieldProps {
  label: React.ReactNode
  children: React.ReactNode
  required?: boolean
  description?: React.ReactNode
  error?: string
  className?: string
  inputWrapperClassName?: string
  labelClassName?: string
  descriptionClassName?: string
  errorClassName?: string
  /** Optional id for the control. If omitted, a stable id is generated. */
  inputId?: string
}

function EditableFieldBase({
  label,
  children,
  required,
  description,
  error,
  className,
  inputWrapperClassName,
  labelClassName,
  descriptionClassName,
  errorClassName,
  inputId
}: EditableFieldProps) {
  const generatedId = useId()
  const fieldId = inputId ?? generatedId
  const descriptionId = description ? `${fieldId}-description` : undefined
  const errorId = error ? `${fieldId}-error` : undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: fieldId,
        "aria-describedby": [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : undefined
      })
    : children

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={fieldId}
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide text-gray-500",
          labelClassName
        )}
      >
        {label}
        {required ? <span className="text-red-500">*</span> : null}
      </label>
      <div className={cn("flex flex-col", inputWrapperClassName)}>
        {control}
      </div>
      {description ? (
        <p id={descriptionId} className={cn("text-[10px] text-gray-500", descriptionClassName)}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={cn("text-[10px] text-red-600", errorClassName)}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface EditableInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const EditableTextInput = forwardRef<HTMLInputElement, EditableInputProps>(
  ({ className, invalid, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "w-full rounded-lg border-2 border-gray-400 bg-white px-2 py-0.5 text-xs text-gray-900 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
          invalid && "border-red-500 focus:border-red-500 focus:ring-red-200",
          props.disabled && "cursor-not-allowed opacity-70",
          className
        )}
        {...props}
      />
    )
  }
)
EditableTextInput.displayName = "EditableTextInput"

interface EditableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const EditableTextarea = forwardRef<HTMLTextAreaElement, EditableTextareaProps>(
  ({ className, invalid, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-lg border-2 border-gray-400 bg-white px-2 py-1 text-xs text-gray-900 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
        invalid && "border-red-500 focus:border-red-500 focus:ring-red-200",
        props.disabled && "cursor-not-allowed opacity-70",
        className
      )}
      {...props}
    />
  )
)
EditableTextarea.displayName = "EditableTextarea"

interface EditableSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const EditableSelect = forwardRef<HTMLSelectElement, EditableSelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-lg border-2 border-gray-400 bg-white px-2 py-1 text-xs text-gray-900 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
        invalid && "border-red-500 focus:border-red-500 focus:ring-red-200",
        props.disabled && "cursor-not-allowed opacity-70",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
EditableSelect.displayName = "EditableSelect"

interface EditableSwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const EditableSwitch = forwardRef<HTMLInputElement, EditableSwitchProps>(
  ({ className, invalid, checked, onChange, disabled, ...props }, ref) => {
    return (
      <label className={cn("inline-flex items-center gap-2", disabled && "opacity-70")}
        data-invalid={invalid ? true : undefined}
      >
        <input
          ref={ref}
          type="checkbox"
          className="sr-only"
          checked={Boolean(checked)}
          onChange={onChange}
          disabled={disabled}
          {...props}
        />
        <span
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full border-2 border-transparent transition-colors",
            checked ? "bg-primary-600" : "bg-gray-300",
            invalid && "ring-2 ring-red-300"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              checked ? "translate-x-4" : "translate-x-0"
            )}
          />
        </span>
      </label>
    )
  }
)
EditableSwitch.displayName = "EditableSwitch"

interface EditableFieldComponent extends React.FC<EditableFieldProps> {
  Input: typeof EditableTextInput
  Textarea: typeof EditableTextarea
  Select: typeof EditableSelect
  Switch: typeof EditableSwitch
}

export const EditableField: EditableFieldComponent = Object.assign(EditableFieldBase, {
  Input: EditableTextInput,
  Textarea: EditableTextarea,
  Select: EditableSelect,
  Switch: EditableSwitch
})

