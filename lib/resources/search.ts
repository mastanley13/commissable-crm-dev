import type { ResourceArticle, ResourceCategory } from "@/lib/resources/articles"

export interface ResourceSearchOptions {
  query: string
  category: ResourceCategory | "All"
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

export function buildResourceSearchText(article: ResourceArticle): string {
  const bodyText = article.body
    .flatMap((section) => [
      section.heading,
      ...(section.paragraphs || []),
      ...(section.steps || []),
      section.callout || ""
    ])
    .join(" ")

  return normalizeSearchText([
    article.title,
    article.description,
    article.category,
    article.tags.join(" "),
    article.excerpt,
    bodyText
  ].join(" "))
}

export function filterResourceArticles(
  articles: ResourceArticle[],
  options: ResourceSearchOptions
): ResourceArticle[] {
  const normalizedQuery = normalizeSearchText(options.query)

  return articles
    .filter((article) => options.category === "All" || article.category === options.category)
    .filter((article) => {
      if (!normalizedQuery) return true
      return buildResourceSearchText(article).includes(normalizedQuery)
    })
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1
      return a.title.localeCompare(b.title)
    })
}
