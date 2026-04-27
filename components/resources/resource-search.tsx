"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Ticket } from "lucide-react"
import {
  RESOURCE_CATEGORIES,
  type ResourceArticle,
  type ResourceCategory
} from "@/lib/resources/articles"
import { filterResourceArticles } from "@/lib/resources/search"
import { ResourceCard } from "@/components/resources/resource-card"

interface ResourceSearchProps {
  articles: ResourceArticle[]
}

type CategoryFilter = ResourceCategory | "All"

export function ResourceSearch({ articles }: ResourceSearchProps) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<CategoryFilter>("All")

  const featuredArticles = useMemo(
    () => articles.filter((article) => article.featured).slice(0, 4),
    [articles]
  )

  const filteredArticles = useMemo(
    () => filterResourceArticles(articles, { query, category }),
    [articles, category, query]
  )

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by workflow, record, error, or keyword"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="text-sm font-medium text-slate-600">
            {filteredArticles.length} article{filteredArticles.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {(["All", ...RESOURCE_CATEGORIES] as CategoryFilter[]).map((nextCategory) => {
            const selected = category === nextCategory
            return (
              <button
                key={nextCategory}
                type="button"
                onClick={() => setCategory(nextCategory)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  selected
                    ? "bg-primary-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {nextCategory}
              </button>
            )
          })}
        </div>
      </section>

      {!query.trim() && category === "All" ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Start Here</h2>
              <p className="text-sm text-slate-600">High-friction workflows most users need first.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredArticles.map((article) => (
              <ResourceCard key={article.slug} article={article} compact />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">All Resources</h2>
            <p className="text-sm text-slate-600">Task-based guides for daily CRM, import, and reconciliation work.</p>
          </div>
          <Link
            href="/tickets"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary-300 hover:text-primary-700"
          >
            <Ticket className="h-4 w-4" />
            Need support
          </Link>
        </div>

        {filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredArticles.map((article) => (
              <ResourceCard key={article.slug} article={article} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="text-base font-semibold text-slate-950">No matching resources</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Try a different keyword or create a support ticket with the workflow, record, expected result, and actual result.
            </p>
            <Link
              href="/tickets"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800"
            >
              <Ticket className="h-4 w-4" />
              Open Tickets
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
