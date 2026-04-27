"use client"

import { useState } from "react"
import { CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react"

type FeedbackValue = "helpful" | "not-helpful" | null

export function ResourceFeedback() {
  const [feedback, setFeedback] = useState<FeedbackValue>(null)

  if (feedback) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        Feedback captured for this preview.
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-semibold text-slate-800">Was this helpful?</span>
      <button
        type="button"
        onClick={() => setFeedback("helpful")}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
      >
        <ThumbsUp className="h-4 w-4" />
        Helpful
      </button>
      <button
        type="button"
        onClick={() => setFeedback("not-helpful")}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
      >
        <ThumbsDown className="h-4 w-4" />
        Not helpful
      </button>
    </div>
  )
}
