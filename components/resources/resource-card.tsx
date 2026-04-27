import Link from "next/link"
import { ArrowRight, Clock, Tag } from "lucide-react"
import type { ResourceArticle, ResourceCategory } from "@/lib/resources/articles"

const CATEGORY_STYLES: Record<ResourceCategory, string> = {
  "Getting Started": "bg-sky-50 text-sky-800 ring-sky-200",
  "CRM Basics": "bg-indigo-50 text-indigo-800 ring-indigo-200",
  "Data Import / Admin": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "Deposit Upload": "bg-cyan-50 text-cyan-800 ring-cyan-200",
  Reconciliation: "bg-amber-50 text-amber-900 ring-amber-200",
  "Revenue Schedules": "bg-violet-50 text-violet-800 ring-violet-200",
  "Tickets / Support": "bg-rose-50 text-rose-800 ring-rose-200",
  Troubleshooting: "bg-slate-100 text-slate-800 ring-slate-200"
}

interface ResourceCardProps {
  article: ResourceArticle
  compact?: boolean
}

export function ResourceCard({ article, compact = false }: ResourceCardProps) {
  return (
    <Link
      href={`/resources/${article.slug}`}
      className="group flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${CATEGORY_STYLES[article.category]}`}>
          {article.category}
        </span>
        {article.featured ? (
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
            Start here
          </span>
        ) : null}
      </div>

      <h3 className="text-base font-semibold leading-6 text-slate-950 group-hover:text-primary-700">
        {article.title}
      </h3>
      <p className={`mt-2 text-sm leading-6 text-slate-600 ${compact ? "line-clamp-2" : ""}`}>
        {article.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {article.tags.slice(0, compact ? 2 : 3).map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
            <Tag className="h-3 w-3" />
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {article.readTimeMinutes} min read
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-primary-700">
          Open
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}
