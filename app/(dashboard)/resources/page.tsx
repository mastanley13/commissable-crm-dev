import { BookOpen, LifeBuoy, Search } from "lucide-react"
import { ResourceBreadcrumbs } from "@/components/resources/resource-breadcrumbs"
import { ResourceSearch } from "@/components/resources/resource-search"
import { getPublishedResourceArticles } from "@/lib/resources/articles"

export default function ResourcesPage() {
  const articles = getPublishedResourceArticles()

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <ResourceBreadcrumbs />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700 ring-1 ring-primary-200">
                <BookOpen className="h-4 w-4" />
                Resource Center
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                Find the right guide while you work.
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                Search task-based help for CRM records, imports, deposit uploads, reconciliation, revenue schedules, and support tickets.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Search className="h-4 w-4 text-primary-700" />
                  Search
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">Find content by workflow, record, or blocker.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <BookOpen className="h-4 w-4 text-primary-700" />
                  Read
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">Use short guides built for in-app operators.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <LifeBuoy className="h-4 w-4 text-primary-700" />
                  Escalate
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">Open Tickets when the answer needs follow-up.</p>
              </div>
            </div>
          </div>
        </section>

        <ResourceSearch articles={articles} />
      </div>
    </div>
  )
}
