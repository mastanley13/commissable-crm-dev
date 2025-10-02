"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search, Plus, RotateCcw, MessageSquare, Settings, ChevronLeft, Bell, Loader2 } from "lucide-react"
import { Breadcrumb } from "@/components/breadcrumb"

type SearchSuggestion = {
  id: string
  type: string
  title: string
  subtitle?: string
  href: string
}

export function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const suggestionsAbortController = useRef<AbortController | null>(null)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)

  const resetSuggestions = useCallback(() => {
    setSuggestions([])
    setShowSuggestions(false)
    setHighlightedIndex(-1)
  }, [])

  const handleSuggestionSelect = useCallback(
    (suggestion: SearchSuggestion) => {
      resetSuggestions()
      setSearchQuery("")
      router.push(suggestion.href)
    },
    [resetSuggestions, router]
  )

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (suggestionsAbortController.current) {
        suggestionsAbortController.current.abort()
      }

      const trimmed = query.trim()
      if (trimmed.length === 0) {
        if (suggestionsAbortController.current) {
          suggestionsAbortController.current = null
        }
        resetSuggestions()
        setLoadingSuggestions(false)
        return
      }

      const controller = new AbortController()
      suggestionsAbortController.current = controller
      setLoadingSuggestions(true)

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=8`, {
          signal: controller.signal,
          cache: "no-store"
        })

        if (!response.ok) {
          throw new Error("Failed to fetch suggestions")
        }

        const payload = await response.json()
        const nextSuggestions: SearchSuggestion[] = Array.isArray(payload?.suggestions)
          ? payload.suggestions
          : []

        setSuggestions(nextSuggestions)
        setShowSuggestions(nextSuggestions.length > 0)
        setHighlightedIndex(nextSuggestions.length > 0 ? 0 : -1)
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Search suggestions failed", error)
        }
      } finally {
        setLoadingSuggestions(false)
      }
    },
    [resetSuggestions]
  )

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
  }

  const handleSearchFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setShowSuggestions(true)
      setHighlightedIndex(previous => {
        if (suggestions.length === 0) {
          return -1
        }
        const next = previous + 1
        return next >= suggestions.length ? 0 : next
      })
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      if (suggestions.length === 0) {
        return
      }
      setShowSuggestions(true)
      setHighlightedIndex(previous => {
        if (previous <= 0) {
          return suggestions.length - 1
        }
        return previous - 1
      })
    } else if (event.key === "Enter") {
      if (showSuggestions && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        event.preventDefault()
        handleSuggestionSelect(suggestions[highlightedIndex])
      }
    } else if (event.key === "Escape") {
      if (showSuggestions) {
        event.preventDefault()
        resetSuggestions()
      }
    }
  }

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    const trimmed = searchQuery.trim()

    if (trimmed.length === 0) {
      if (suggestionsAbortController.current) {
        suggestionsAbortController.current.abort()
        suggestionsAbortController.current = null
      }
      resetSuggestions()
      setLoadingSuggestions(false)
      return
    }

    searchDebounceRef.current = setTimeout(() => {
      fetchSuggestions(trimmed)
    }, 250)

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [searchQuery, fetchSuggestions, resetSuggestions])

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
      if (suggestionsAbortController.current) {
        suggestionsAbortController.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleBack = () => {
    if (pathname.includes("/accounts/") && pathname !== "/accounts") {
      router.push("/accounts")
    } else if (pathname.includes("/contacts/") && pathname !== "/contacts") {
      router.push("/contacts")
    } else if (pathname.startsWith("/admin/") && pathname !== "/admin") {
      router.push("/admin")
    } else {
      router.back()
    }
  }

  return (
    <div className="relative z-40 bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Breadcrumb />
        </div>

        <div
          ref={searchContainerRef}
          className="relative flex-1 min-w-[240px] max-w-xl"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={handleSearchFocus}
            placeholder="Search accounts, contacts..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          />
          {loadingSuggestions && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
              <ul className="max-h-72 divide-y divide-gray-100">
                {suggestions.map((suggestion, index) => {
                  const isActive = index === highlightedIndex
                  return (
                    <li key={`${suggestion.type}-${suggestion.id}`}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition ${
                          isActive ? "bg-primary-50 text-primary-900" : "text-gray-700 hover:bg-gray-50"
                        }`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{suggestion.title}</span>
                          <span className="text-xs text-gray-500">
                            {suggestion.subtitle || suggestion.type}
                          </span>
                        </div>
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                          {suggestion.type}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center space-x-3">
          <button className="inline-flex items-center rounded-lg bg-primary-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-800">
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </button>

          <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <RotateCcw className="h-4 w-4" />
          </button>

          <button className="relative rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <MessageSquare className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500"></span>
          </button>

          <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <Bell className="h-4 w-4" />
          </button>

          <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
