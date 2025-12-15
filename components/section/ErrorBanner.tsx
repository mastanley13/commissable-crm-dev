import type { ReactNode } from "react"

interface ErrorBannerProps {
  message: string
  action?: ReactNode
}

export function ErrorBanner({ message, action }: ErrorBannerProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
      <p className="font-semibold">{message}</p>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

