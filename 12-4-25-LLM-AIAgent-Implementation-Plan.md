High‑level approach

Keep the current deterministic engine as the source of truth and safety net.
Add an LLM layer on top that:
Consumes the same line + candidate data the engine already computes.
Produces classification / ranking / actions.
Introduce it in phases: suggestions only → human‑confirmed actions → limited auto‑actions under tight guardrails.
Phase 1 – LLM‑assisted suggestions (no writes)

Goal: get value fast with low risk by letting the LLM “think” but not change data.

New service: lib/matching/llm-advisor.ts
API like getLLMRecommendations(lineItem, candidates, context): Promise<LLMRecommendation[]>.
Called from the candidates route:
app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts.
Inputs to the LLM (JSON):
A compact version of the line item (amounts, dates, account/vendor IDs, names, PO, etc.).
Top N rule‑based candidates from matchDepositLine (existing fields: confidence, reasons, balances).
Tenant settings (variance tolerance, engine mode) and any business rules you want it to respect.
Outputs:
For each candidate: llmScore, llmExplanation, and llmDecision ∈ {auto_match_ok, suggest_only, avoid}.
Optional llmGlobalDecision: “no good match – leave unmatched”.
UI integration:
Surface llmScore and llmExplanation in the per‑line suggestions table as “AI opinion”.
Still require manual click to apply matches.
Benefits:
No schema changes to the auto‑match endpoints.
You can log LLM recommendations alongside human decisions to build an offline evaluation set.
Phase 2 – LLM agent for targeted auto‑actions

Goal: allow the LLM to take constrained actions via tools, on top of your existing APIs.

New API route: e.g. POST /api/reconciliation/deposits/[depositId]/ai-agent-run
Kicks off an “agent run” over one deposit (or a subset of line IDs).
Orchestrates a tool‑using LLM loop server‑side.
Tools exposed to the LLM (backend functions, not public HTTP):
getDepositContext(depositId) – metadata + high‑level totals.
getLine(lineId) – full line + current matches.
getCandidates(lineId) – reuse matchDepositLine (no extra DB queries).
applyMatch(lineId, scheduleId, mode) – wraps existing apply‑match endpoint / Prisma code.
unmatch(lineId) – wraps unmatch.
finalizeDeposit(depositId) – optional, behind a strict flag.
Agent loop (pseudo):
For each unmatched line: call LLM with transcript so far + line + candidates.
LLM either calls tools (e.g. applyMatch) or says “skip”.
Backend executes the tool call, appends result to the conversation, and continues until:
No more tool calls, or
Line budget reached.
Guardrails:
Hard constraints the LLM cannot override:
Do not allow it to touch lines where your Pass A exact match already exists and is consistent.
Refuse tool calls that violate variance or obvious numeric invariants (double‑check in code).
Limit scope:
Start with “AI can only auto‑match lines where engine confidence ≥ X and LLM says auto_match_ok”.
Everything else remains manual or suggestion‑only.
Phase 3 – Integrate with existing Run AI Matching UX

Goal: users can choose between “rule‑only” vs “rule + LLM” workflows, without breaking existing behavior.

Extend the preview flow (/auto-match/preview) to support a mode flag:
mode: "rules_only" | "rules_plus_llm".
In rules_plus_llm:
Still compute rule‑based Pass A preview as you do now.
Additionally call llm-advisor (Phase 1) or the agent (Phase 2) to:
Confirm rule‑based auto‑matches.
Optionally propose extra matches under slightly looser conditions.
UI changes:
Add a checkbox: “Use experimental AI reasoning (beta)” on the preview modal.
Show separate counts: autoMatchByRules, autoMatchExtraByLLM, LLM‑suggested only.
Keep the existing /auto-match route as‑is; for LLM‑driven auto‑matches:
Either add a parallel route (easiest to reason about), or
Pass a source = "LLM" into applyAutoMatch and log it distinctly.
Data, prompts, and safety

Prompt design:
Start with a system prompt that restates your business rules in natural language: variance, never match obviously wrong accounts, never override “perfect” ID matches, etc.
Ask the LLM to:
Explain in 1–2 sentences why it chose or rejected a candidate.
Always return structured JSON; do NOT let it construct SQL or free‑form commands.
PII & minimization:
Send only the fields needed for reasoning: hashed IDs are fine; keep names but omit unrelated PII.
Truncate long descriptions and notes; the engine’s numeric and ID signals do most of the work.
Observability:
Add a small MatchingAIAction table (or extend your audit metadata) with:
lineId, scheduleId, engineConfidence, llmScore, decision, explanation, timestamp, model version.
This is crucial for debugging and for proving that the LLM respected thresholds.
Rollout plan

Implement Phase 1 (advisor only) and log its decisions without changing user behavior.
Compare:
LLM “auto_match_ok” vs human decisions over a few real deposits.
Once you’re satisfied with precision, enable Phase 2 for a tiny subset:
e.g., only run the agent on lines where engine confidence ≥ 0.9 and variance very small.
Expand scope gradually; keep “rules‑only” Run AI Matching as a safe fallback forever.