"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Loader2,
  RefreshCw,
  Send,
  Settings,
  Shield,
  Ticket,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react"

type ChatRole = "user" | "assistant"

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  localOnly?: boolean
  variant?: "intro" | "degraded" | "crm-readonly"
}

type BotStatus = {
  liveOpenClawGateway: boolean
  crmReadOnlyFallback: boolean
  label: string
}

type TopicGroup = {
  role: string
  description: string
  icon: LucideIcon
  topics: TopicItem[]
}

type TopicItem = {
  label: string
  prompt: string
}

const CHAT_ENDPOINT = "/api/openclaw/chat"
const STATUS_ENDPOINT = "/api/openclaw/status"

const topicGroups: TopicGroup[] = [
  {
    role: "Demo",
    description: "Safe meeting prompts",
    icon: ClipboardList,
    topics: [
      {
        label: "top usage",
        prompt: "What are the top 5 usage accounts for March 2026?",
      },
      {
        label: "failed imports",
        prompt: "What recent imports failed?",
      },
      {
        label: "ticket draft",
        prompt: "Draft a support ticket for this failed revenue schedule import: rows failed validation and need accounting review.",
      },
      {
        label: "handoff draft",
        prompt: "Draft a reconciliation handoff for this unmatched payment: vendor amount does not clearly match the expected schedule balance.",
      },
      {
        label: "match preview",
        prompt: "Preview the match review for this deposit line before applying it: compare account, vendor, usage, commission, and rate.",
      },
    ],
  },
  {
    role: "Sales",
    description: "Pipeline and customer motion",
    icon: Building2,
    topics: [
      {
        label: "accounts",
        prompt: "Look up account context for ACC Business.",
      },
      {
        label: "opportunities",
        prompt: "Look up account context for ACC Business and summarize related opportunity counts.",
      },
      {
        label: "reporting",
        prompt: "What are the top 5 usage accounts for March 2026?",
      },
    ],
  },
  {
    role: "Accounting",
    description: "Cash, matching, and schedules",
    icon: CircleDollarSign,
    topics: [
      {
        label: "deposits",
        prompt: "Find deposits for ACC Business.",
      },
      {
        label: "reconciliation",
        prompt: "Give me a reconciliation summary.",
      },
      {
        label: "revenue schedules",
        prompt: "Find revenue schedules for ACC Business.",
      },
    ],
  },
  {
    role: "Management",
    description: "Visibility and operating rhythm",
    icon: BarChart3,
    topics: [
      {
        label: "dashboards",
        prompt: "Give me a reconciliation summary.",
      },
      {
        label: "reports",
        prompt: "What are the top 5 usage accounts for March 2026?",
      },
      {
        label: "team activity",
        prompt: "Draft a client follow-up note about the current reconciliation review status.",
      },
    ],
  },
  {
    role: "Admin",
    description: "Configuration and controls",
    icon: Shield,
    topics: [
      {
        label: "imports",
        prompt: "Draft an import correction plan for failed account rows that need a corrected CSV re-upload.",
      },
      {
        label: "users",
        prompt: "Draft a support ticket for this user access issue: a user cannot see reconciliation summaries.",
      },
      {
        label: "settings",
        prompt: "Draft a support ticket for this settings issue: import mapping needs admin review.",
      },
    ],
  },
  {
    role: "Support",
    description: "Issues and follow-up",
    icon: Ticket,
    topics: [
      {
        label: "tickets",
        prompt: "Draft a support ticket for this CRM issue: describe the problem, evidence needed, and next step.",
      },
      {
        label: "customer follow-up",
        prompt: "Draft a client follow-up note about the current import cleanup review.",
      },
    ],
  },
]

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createConversationId() {
  return createId()
}

function initialMessage(): ChatMessage {
  return {
    id: createId(),
    role: "assistant",
    content:
      "Commissable Bot is ready. Choose a role and topic on the left, or type a question to start.",
    localOnly: true,
    variant: "intro",
  }
}

function buildLocalFallbackReply(message: string): string {
  const firstLine = message.split("\n").find(line => line.trim())?.trim() || "your request"

  return [
    "Live Commissable Bot is currently unavailable.",
    "",
    "No live CRM answer was returned for this message.",
    "",
    `Question captured: ${firstLine.slice(0, 180)}`,
    "",
    "Try again in a few minutes. If this keeps happening, contact your CRM administrator or support team.",
  ].join("\n")
}

function buildUserFacingError(message: string): string {
  if (/not configured/i.test(message) || /unable to reach openclaw/i.test(message)) {
    return "Commissable Bot could not reach the live service. No live answer was returned."
  }

  if (/did not respond before the request timed out/i.test(message) || /timed out/i.test(message)) {
    return "Commissable Bot timed out while waiting for a live response. No live answer was returned."
  }

  if (/gateway returned an error/i.test(message) || /empty response/i.test(message)) {
    return "Commissable Bot is temporarily unavailable. No live answer was returned."
  }

  return "Commissable Bot is temporarily unavailable. No live answer was returned."
}

export function CommissableBotChat() {
  const [conversationId, setConversationId] = useState(createConversationId)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [initialMessage()])
  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const canSend = useMemo(() => draft.trim().length > 0 && !isSending, [draft, isSending])
  const hasUserMessages = useMemo(() => messages.some(message => message.role === "user"), [messages])

  useEffect(() => {
    const node = transcriptRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, isSending])

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      try {
        const response = await fetch(STATUS_ENDPOINT, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })
        const payload = await response.json().catch(() => null)
        const modes = payload?.data?.responseModes
        if (!cancelled && modes) {
          const liveOpenClawGateway = modes.liveOpenClawGateway === true
          const crmReadOnlyFallback = modes.crmReadOnlyFallback === true
          setBotStatus({
            liveOpenClawGateway,
            crmReadOnlyFallback,
            label: liveOpenClawGateway
              ? "Live OpenClaw"
              : crmReadOnlyFallback
                ? "CRM read-only"
                : "Offline fallback",
          })
        }
      } catch {
        if (!cancelled) {
          setBotStatus({
            liveOpenClawGateway: false,
            crmReadOnlyFallback: true,
            label: "CRM read-only",
          })
        }
      }
    }

    void loadStatus()

    return () => {
      cancelled = true
    }
  }, [])

  async function sendMessage(content: string) {
    const trimmed = content.trim()
    if (!trimmed || isSending) return

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    }
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setDraft("")
    setError(null)
    setIsSending(true)

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          conversationId,
          messages: nextMessages
            .filter(message => !message.localOnly)
            .map(message => ({
              role: message.role,
              content: message.content,
            })),
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "OpenClaw chat failed.")
      }

      const reply = payload?.data?.message?.content
      if (typeof reply !== "string" || !reply.trim()) {
        throw new Error("OpenClaw returned an empty response.")
      }

      const responseSource = typeof payload?.data?.source === "string" ? payload.data.source : null

      setMessages(current => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: reply.trim(),
          variant: responseSource === "crm_readonly_fallback" ? "crm-readonly" : undefined,
        },
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : "OpenClaw chat failed."
      setError(buildUserFacingError(message))
      setMessages(current => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: buildLocalFallbackReply(trimmed),
          localOnly: true,
          variant: "degraded",
        },
      ])
    } finally {
      setIsSending(false)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSend) {
      void sendMessage(draft)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      if (canSend) {
        void sendMessage(draft)
      }
    }
  }

  function handleClear() {
    setConversationId(createConversationId())
    setMessages([initialMessage()])
    setDraft("")
    setError(null)
    setSelectedTopic(null)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleTopicSelect(role: string, topic: TopicItem) {
    setSelectedTopic(`${role}:${topic.label}`)
    setDraft(topic.prompt)
    setError(null)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-900 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-950">Commissable Bot</h1>
              <p className="truncate text-sm text-slate-600">
                In-app assistant shell for sales, accounting, management, admin, and support workflows.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {botStatus && (
              <div
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
                  botStatus.liveOpenClawGateway
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-sky-200 bg-sky-50 text-sky-800"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {botStatus.label}
              </div>
            )}
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <Shield className="h-4 w-4" />
              Safe shell: no demo customer data
            </div>
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <Settings className="h-4 w-4" />
              {CHAT_ENDPOINT}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 px-4 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Roles and topics</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Select a topic to load a starter prompt into the chat input.
            </p>
          </div>

          <nav className="space-y-3 p-4" aria-label="Bot role and topic navigation">
            {topicGroups.map(group => {
              const GroupIcon = group.icon

              return (
                <section key={group.role} className="rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-start gap-3 border-b border-slate-200 px-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-primary-800 ring-1 ring-slate-200">
                      <GroupIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-950">{group.role}</h3>
                      <p className="mt-0.5 text-xs leading-5 text-slate-600">{group.description}</p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200 bg-white">
                    {group.topics.map(topic => {
                      const topicKey = `${group.role}:${topic.label}`
                      const isSelected = selectedTopic === topicKey

                      return (
                        <button
                          key={topic.label}
                          type="button"
                          onClick={() => handleTopicSelect(group.role, topic)}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition ${
                            isSelected
                              ? "bg-primary-50 text-primary-900"
                              : "text-slate-700 hover:bg-slate-50 hover:text-primary-800"
                          }`}
                          aria-pressed={isSelected}
                        >
                          <span className="min-w-0 truncate font-medium capitalize">{topic.label}</span>
                          {isSelected ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-700" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-h-0 flex-col bg-white">
          <div ref={transcriptRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
              {!hasUserMessages && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-800">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-950">Start with a workflow question</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        This shell is safe for business-user prompts. Use the left rail to load a starter, then edit it before sending.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {messages.map(message => {
                const isUser = message.role === "user"
                const Icon = isUser ? User : Bot
                const isDegradedAssistant = !isUser && message.variant === "degraded"
                const isCrmReadOnlyAssistant = !isUser && message.variant === "crm-readonly"

                return (
                  <div key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-primary-900 shadow-sm ring-1 ring-slate-200">
                        <Icon className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[min(720px,85%)] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
                        isUser
                          ? "bg-primary-900 text-white"
                          : isDegradedAssistant
                            ? "border border-amber-300 bg-amber-50 text-amber-950"
                            : isCrmReadOnlyAssistant
                              ? "border border-sky-200 bg-sky-50 text-slate-900"
                            : "border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      {isDegradedAssistant && (
                        <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Offline Fallback
                        </div>
                      )}
                      {isCrmReadOnlyAssistant && (
                        <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-sky-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sky-900">
                          <Shield className="h-3.5 w-3.5" />
                          CRM Read-Only Mode
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                      {message.localOnly && !isUser && message.variant === "degraded" && (
                        <div className={`mt-2 text-xs font-medium ${isDegradedAssistant ? "text-amber-900" : "text-slate-500"}`}>
                          {isDegradedAssistant ? "No live CRM answer returned" : "Local only"}
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-900 text-white shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                )
              })}

              {isSending && (
                <div className="flex justify-start gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-primary-900 shadow-sm ring-1 ring-slate-200">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex max-w-[min(720px,85%)] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="mx-auto w-full max-w-4xl">
              {error && (
                <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="break-words">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder="Message Commissable Bot"
                  className="max-h-40 min-h-12 flex-1 resize-none rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-700 focus:ring-2 focus:ring-primary-100"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary-900 text-white transition hover:bg-primary-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  title="Send"
                  aria-label="Send"
                >
                  {isSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                If the live service is unavailable, this chat shows a clearly marked offline fallback instead of a live CRM answer.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </section>
  )
}
