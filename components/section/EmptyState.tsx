interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
      <p className="font-semibold">{title}</p>
      {description ? <p className="mt-0.5 text-slate-500">{description}</p> : null}
    </div>
  )
}

