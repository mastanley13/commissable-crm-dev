import type { ReactNode } from "react"
import { fieldLabelClass } from "./shared"

export interface FieldRowProps {
  label: string
  value: ReactNode
  labelExtra?: ReactNode
}

export function FieldRow({ label, value, labelExtra }: FieldRowProps) {
  return (
    <div className="grid items-start gap-2 sm:grid-cols-[140px,minmax(0,1fr)]">
      {labelExtra ? (
        <div className="flex flex-col gap-1">
          <span className={`${fieldLabelClass} flex items-center min-h-[28px]`}>{label}</span>
          {labelExtra}
        </div>
      ) : (
        <span className={`${fieldLabelClass} flex items-center min-h-[28px]`}>{label}</span>
      )}
      <div className="min-w-0">{value}</div>
    </div>
  )
}

export default FieldRow
