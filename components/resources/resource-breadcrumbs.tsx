"use client"

import { useEffect } from "react"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"

interface ResourceBreadcrumbsProps {
  articleTitle?: string
}

export function ResourceBreadcrumbs({ articleTitle }: ResourceBreadcrumbsProps) {
  const { setBreadcrumbs } = useBreadcrumbs()

  useEffect(() => {
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Resources", href: articleTitle ? "/resources" : undefined, current: !articleTitle },
      ...(articleTitle ? [{ name: articleTitle, current: true }] : [])
    ])

    return () => setBreadcrumbs(null)
  }, [articleTitle, setBreadcrumbs])

  return null
}
