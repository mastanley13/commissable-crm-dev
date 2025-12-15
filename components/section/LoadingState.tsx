interface LoadingStateProps {
  label?: string
}

export function LoadingState({ label = "Loading..." }: LoadingStateProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
      {label}
    </div>
  )
}

