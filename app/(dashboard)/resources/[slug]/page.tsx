import { notFound } from "next/navigation"
import { ResourceBreadcrumbs } from "@/components/resources/resource-breadcrumbs"
import { ResourceArticleLayout } from "@/components/resources/resource-article-layout"
import { getPublishedResourceArticles, getResourceArticle } from "@/lib/resources/articles"

interface ResourceArticlePageProps {
  params: {
    slug: string
  }
}

export function generateStaticParams() {
  return getPublishedResourceArticles().map((article) => ({
    slug: article.slug
  }))
}

export default function ResourceArticlePage({ params }: ResourceArticlePageProps) {
  const article = getResourceArticle(params.slug)

  if (!article) {
    notFound()
  }

  return (
    <>
      <ResourceBreadcrumbs articleTitle={article.title} />
      <ResourceArticleLayout article={article} />
    </>
  )
}
