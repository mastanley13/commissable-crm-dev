import Link from "next/link"
import { ArrowLeft, Clock, ExternalLink, Route, Ticket } from "lucide-react"
import type { ResourceArticle } from "@/lib/resources/articles"
import { getRelatedResourceArticles } from "@/lib/resources/articles"
import { ResourceCard } from "@/components/resources/resource-card"
import { ResourceFeedback } from "@/components/resources/resource-feedback"

interface ResourceArticleLayoutProps {
  article: ResourceArticle
}

function sectionId(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export function ResourceArticleLayout({ article }: ResourceArticleLayoutProps) {
  const relatedArticles = getRelatedResourceArticles(article)

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/resources"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 transition hover:text-primary-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Resources
        </Link>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
                  {article.category}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  {article.readTimeMinutes} min read
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {article.title}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                {article.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>Updated {article.updatedAt}</span>
                <span>Owner: {article.owner}</span>
                {article.requiredPermissions?.length ? (
                  <span>Permission: {article.requiredPermissions.join(", ")}</span>
                ) : null}
              </div>
            </header>

            <div className="space-y-8 p-6">
              {article.body.map((section) => (
                <section key={section.heading} id={sectionId(section.heading)} className="scroll-mt-24">
                  <h2 className="text-xl font-semibold text-slate-950">{section.heading}</h2>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="mt-3 text-sm leading-7 text-slate-700">
                      {paragraph}
                    </p>
                  ))}
                  {section.steps?.length ? (
                    <ol className="mt-3 space-y-2">
                      {section.steps.map((step, index) => (
                        <li key={step} className="flex gap-3 text-sm leading-7 text-slate-700">
                          <span className="mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700 ring-1 ring-primary-200">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {section.callout ? (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                      {section.callout}
                    </div>
                  ) : null}
                </section>
              ))}

              <ResourceFeedback />

              <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-primary-950">Still need help?</h2>
                    <p className="mt-1 text-sm text-primary-800">
                      Create a support ticket and include this article title plus the record or workflow you were using.
                    </p>
                  </div>
                  <Link
                    href="/tickets"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800"
                  >
                    <Ticket className="h-4 w-4" />
                    Open Tickets
                  </Link>
                </div>
              </div>
            </div>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">On This Page</h2>
              <nav className="mt-3 space-y-2">
                {article.body.map((section) => (
                  <a
                    key={section.heading}
                    href={`#${sectionId(section.heading)}`}
                    className="block rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-primary-700"
                  >
                    {section.heading}
                  </a>
                ))}
              </nav>
            </div>

            {article.relatedRoutes.length ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <Route className="h-4 w-4" />
                  Related Routes
                </h2>
                <div className="mt-3 space-y-2">
                  {article.relatedRoutes.map((route) => (
                    <Link
                      key={route.href}
                      href={route.href}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-700"
                    >
                      {route.label}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {relatedArticles.length ? (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Related Articles</h2>
                <div className="space-y-3">
                  {relatedArticles.map((relatedArticle) => (
                    <ResourceCard key={relatedArticle.slug} article={relatedArticle} compact />
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  )
}
