# Dev Prisma `prisma:query` “spam” (continuous logs) — Investigation + Plan

Date: 2026-03-02

## Problem statement

When running `npm run dev`, the terminal shows continuous `prisma:query` output that appears to never stop while a browser tab is open. The HTTP access log shows repeated `200` responses, commonly including:

- `GET /api/admin/users?limit=100&status=Active`
- `GET /api/accounts/<accountId>`

There are no obvious `ERROR` / `WARN` lines; the noise is caused by *volume* (requests × Prisma queries per request).

## What we confirmed in the repo

### Prisma query logging is enabled by default in development

`lib/db.ts:15` sets Prisma client `log` levels to include `query` whenever `NODE_ENV === 'development'`:

- Dev: `['query', 'error', 'warn']`
- Non-dev: `['error']`

So any repeated request pattern will look like “relentless SQL spam” in dev.

### Session “heartbeat” writes on every authenticated request

`lib/auth.ts:122` (`getAuthenticatedUser`) performs:

- `prisma.userSession.findFirst(...)`
- then **always** `prisma.userSession.update({ data: { lastSeenAt: new Date() } })` (`lib/auth.ts:144`)

This creates write amplification (and extra query logs) for any endpoint behind auth/session lookup.

### The two “spammed” endpoints have multiple frontend call sites

`GET /api/accounts/<accountId>` call sites include:

- `app/(dashboard)/accounts/[accountId]/page.tsx` (`fetchAccount`, called in a `useEffect` on mount)
- `components/account-opportunity-create-modal.tsx:118` (loads account detail when opening the create-opportunity modal)
- `components/contact-opportunity-create-modal.tsx:108` (checks account type when opening the create-opportunity modal)
- plus other pages/modals (account edit modal, admin archive pages, accounts list actions)

`GET /api/admin/users?limit=100&status=Active` call sites include:

- `components/account-details-view.tsx:1898`
- `app/(dashboard)/opportunities/page.tsx:597` (runs once via `useEffect(..., [])`)
- `components/opportunity-details-view.tsx:2136`
- `components/account-opportunity-create-modal.tsx:150`
- `components/opportunity-create-modal.tsx:325`
- `components/opportunity-edit-modal.tsx:111`
- `components/activity-note-create-modal.tsx:133`
- `components/activity-note-edit-modal.tsx:73`
- `components/group-edit-modal.tsx:98`

### A concrete “refetch loop” footgun exists in several modals: `onClose` in effect deps

Example: `components/account-opportunity-create-modal.tsx:86` loads options (including `/api/accounts/<id>` and `/api/admin/users?...`) when the modal opens:

- The effect depends on `[isOpen, accountId, onClose, showError]` (`components/account-opportunity-create-modal.tsx:194`).

If the parent re-renders while the modal is open and passes a *new* `onClose` function reference each time, that effect re-runs, re-fetching owners + account detail again and again.

Similar patterns exist in:

- `components/contact-opportunity-create-modal.tsx:98` (deps include `onClose`)
- `components/opportunity-edit-modal.tsx:109` (deps include `onClose`)

This is a high-likelihood explanation for “continuous” requests *when a modal is open*, even if you didn’t intentionally add polling.

## What we have *not* yet proven (and how to prove it quickly)

### Which specific view is generating the continuous requests

Because the endpoints are called from multiple places, the fastest way to pinpoint the actual request origin is in the browser:

1. Open DevTools → Network.
2. Enable “Preserve log”.
3. Filter by `users?limit=100` and `api/accounts/`.
4. Use the “Initiator” / stack trace to identify the originating file/component.

If the initiator points at a modal file (ex: `account-opportunity-create-modal.tsx`), focus on “modal open” + effect dependency behavior.

If the initiator points at `app/(dashboard)/accounts/[accountId]/page.tsx`, then something is re-triggering `fetchAccount()` (e.g., repeated remounts or repeated `onRefresh` calls).

## Action plan (recommended order)

### 1) Identify the *single* hottest source of repeated requests

- Use DevTools initiator to identify the component(s) responsible.
- Confirm the repeat pattern: constant stream vs. once-per-focus vs. interval-based.

Deliverable: a short list like “Requests originate from X.tsx effect Y; repeats every ~N ms.”

### 2) Stop unnecessary refetch loops in the UI

Apply whichever matches what DevTools shows:

- If a modal effect re-runs due to `onClose` being unstable:
  - Make `onClose` stable in the parent (`useCallback`) **or**
  - Remove `onClose` from the dependency list by storing it in a ref (only if it’s not logically part of the fetch inputs) **and**
  - Ensure the effect only runs on open transitions (or only when `accountId` changes while open).
- If a page calls `/api/accounts/<id>` repeatedly:
  - Confirm whether the page component is remounting (React DevTools “Highlight updates”, or add temporary `console.count`).
  - Look for a state update loop (layout measurement, timers, continuous `setState` in render path, etc.).

### 3) Reduce session write amplification

If the volume is expected (you *do* want frequent API calls), reduce the DB writes from auth:

- Change `getAuthenticatedUser` so `lastSeenAt` only updates if it’s older than a threshold (ex: 30–120 seconds).
- Optionally skip `lastSeenAt` updates for “read-only background” endpoints.

This keeps auth semantics but cuts the “UPDATE UserSession” spam dramatically.

### 4) Make Prisma logging opt-in in development

Current behavior is “always log queries in dev” (`lib/db.ts:15`).

Proposed change:

- Default dev logs to `['warn', 'error']`.
- Add an env flag to re-enable query logs when actively debugging SQL (ex: `PRISMA_LOG_QUERIES=true`).

This turns the terminal back into a signal channel while keeping query logs available on demand.

### 5) Optional: audit the API handlers for query count and N+1 patterns

Once request frequency is fixed/throttled, check whether each request is doing more Prisma work than needed:

- `app/api/accounts/[accountId]/route.ts` (account detail hydration is usually large)
- `app/api/admin/users/route.ts` (ensure it isn’t over-including relations)

Even if requests become infrequent, optimizing “queries per request” improves perceived performance and reduces dev noise.

## Quick checklist for reproduction notes (to add when confirmed)

- Page/route open in browser:
- Whether any modal is open:
- Approx request rate observed (requests/minute):
- DevTools initiator for `/api/admin/users?...`:
- DevTools initiator for `/api/accounts/<id>`:
- Whether requests stop when tab is backgrounded:

