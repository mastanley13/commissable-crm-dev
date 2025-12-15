## Commissable CRM – General Security Review (December 14, 2025)

This report covers additional security findings beyond the React/Next.js RSC/App Router advisory, focusing on third‑party dependencies and application-level controls.

---

### 1. Dependency Vulnerability Summary (npm Audit)

Audit command: `npm audit --production`

- **glob**
  - Advisory: Command injection via `glob` CLI `-c/--cmd` options (`GHSA-5j98-mcp5-4vw2`).
  - Installed: `glob` in the `10.2.0–10.4.5` range (transitive dependency).
  - Risk: High in theory, but this project does not invoke the `glob` CLI with user-controlled patterns; usage is tooling-oriented. Exploitability in production appears low.
  - Recommended actions:
    - Keep `npm audit` in CI and apply `npm audit fix` when a patched `glob` (or patched parent package) is released.
    - Avoid adding scripts that shell out to `glob` with untrusted user input.

- **jws**
  - Advisory: Improper HMAC signature verification in `auth0/node-jws` (`GHSA-869p-cjfg-cm3x`).
  - Installed: `jws@4.0.0` (transitive dependency).
  - Risk: High at the library level, but this app does not use JWTs in its own code; authentication relies on opaque session tokens stored in Prisma (`userSession`) and a secure cookie.
  - Recommended actions:
    - Allow `npm audit fix` to bump `jws` or its parent package once a fixed version is published.
    - Avoid introducing new JWT-based features that depend on `jws` until the advisory is resolved.

- **xlsx**
  - Advisory: Prototype pollution and ReDoS in SheetJS (`GHSA-4r6h-8v6p-xvw6`, `GHSA-5pgg-2g8v-p4x9`).
  - Installed: `xlsx@0.18.5` (direct dependency).
  - Risk: High. The app relies on spreadsheet import/export flows; user-supplied `.xlsx` files are realistic inputs. The library is known to have prototype pollution and potential regex-based DoS vectors when parsing untrusted files.
  - Recommended actions:
    - Treat spreadsheet uploads as untrusted input; keep processing in controlled workers with timeouts and resource limits.
    - Add explicit size and rate limits to any endpoints that accept `.xlsx` files.
    - Track SheetJS for a patched release and upgrade `xlsx` as soon as a fixed version is available.

**Dependency status verdict:**  
- **Severity:** High (due to `xlsx` and the open advisories on `glob`/`jws`).  
- **Mitigation:** Partially mitigated by usage patterns (no direct `glob` CLI usage, no local JWT handling), but requires ongoing monitoring and upgrade work.

---

### 2. Authentication, Sessions, and Authorization

- **Session model**
  - Sessions use opaque, randomly generated tokens (`crypto.randomBytes(32)` in `lib/auth.ts`) stored in `userSession` and set as a `session-token` cookie.
  - Passwords are hashed with bcrypt (`SALT_ROUNDS = 12`), which is appropriate for this CRM use case.

- **Cookie configuration**
  - `setSessionCookie` sets:
    - `httpOnly: true`
    - `secure: process.env.NODE_ENV === 'production'`
    - `sameSite: 'none'` in production, `'lax'` in non-production
    - `path: '/'`
  - This is generally sound; if cross-site embedding is not required, `sameSite` could be tightened in production to `'lax'` or `'strict'` to reduce CSRF risk.

- **Global access control**
  - `middleware.ts` enforces presence of a `session-token` cookie for all routes except `/login`, `/register`, and specific auth endpoints. Unauthenticated page requests are redirected to `/login`; API calls receive a 401 JSON response.
  - App Router APIs consistently wrap handlers with `withAuth`, `withPermissions`, or `withRole` from `lib/api-auth.ts`, centralizing permission checks.

- **CSRF posture**
  - There is no explicit CSRF token mechanism for mutating HTTP endpoints.
  - CSRF risk is partially mitigated by cookie settings, but state-changing routes (auth, admin, data mutations) should have explicit CSRF protections.

**Auth/authorization status verdict:**  
- **Strengths:** Opaque sessions, proper password hashing, centralized permission checks, and global middleware enforcement.  
- **Gaps:** No CSRF tokens and reliance on `sameSite: 'none'` in production if cross-site embedding is not actually needed.

---

### 3. Input Validation, Storage, and Matching Logic

- **API payloads and database access**
  - App Router handlers use `await request.json()` and typically validate types and required fields before use.
  - All database operations go through Prisma; there is no raw SQL string concatenation, which significantly reduces SQL injection risk.

- **Code patterns**
  - No uses of `eval`, `new Function`, or `dangerouslySetInnerHTML` were found.
  - Matching logic and reporting features operate over typed Prisma data and do not dynamically execute user-supplied code.

- **File storage**
  - `lib/storage.ts`:
    - Sanitizes filenames (`safeFileName`) using a restrictive regex and a random suffix.
    - Uses `resolveStoragePath` to ensure paths remain within the configured storage root, mitigating path traversal attacks.

- **Filtering and search**
  - Dashboard pages sanitize filter definitions before sending them to the server.
  - Server-side filters are applied within Prisma queries rather than by building raw query strings.

- **Matching engine**
  - Deposit matching logic (`lib/matching/deposit-matcher.ts`) is feature-flagged via `HIERARCHICAL_MATCHING_ENABLED` / `NEXT_PUBLIC_HIERARCHICAL_MATCHING` and produces debug output only when explicitly enabled.
  - Debug logging focuses on IDs and scoring, not secrets, and is controlled via environment variables.

**Application logic status verdict:**  
- **Strengths:** Strong use of Prisma, good filename/path hygiene, careful filter handling, and no obvious code execution or XSS primitives.  
- **Gaps:** Potential DoS from heavy spreadsheet imports (see `xlsx`) and absence of systematic validation middleware for all endpoints (though many handlers perform ad-hoc checks).

---

### 4. Configuration, Secrets, and Headers

- **Secrets management**
  - `.env` / `.env.local` contain `DATABASE_URL`, `DB_PASSWORD`, and a placeholder `NEXTAUTH_SECRET`; these appear intended for local/dev use.
  - For production, these values should live in a secret manager or platform-managed environment variables and never in committed `.env` files.

- **Transport and headers**
  - `next.config.mjs` does not define security headers or CORS policies; these may be enforced at the edge (e.g., Vercel, Cloud Load Balancing), but are not visible in this repo.
  - Recommended baseline headers:
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `X-Frame-Options: DENY` (unless framing is required)
    - An application-appropriate `Content-Security-Policy`
  - HTTPS with HSTS should be enforced at the ingress layer for production environments.

**Config/headers status verdict:**  
- **Strengths:** Clear local configuration, secure session cookie flags when deployed correctly over HTTPS.  
- **Gaps:** Lack of explicit security headers/CSP and no in-repo CORS configuration.

---

### 5. Consolidated Recommendations (Non-React/Next)

1. **Dependencies**
   - Integrate `npm audit --production` into CI.
   - Apply `npm audit fix` regularly; prioritize updates for dependencies bringing in `glob` and `jws` once patched versions are released.
   - Monitor SheetJS for a fixed `xlsx` version and plan to upgrade as soon as possible; in the meantime, restrict and monitor spreadsheet imports.

2. **CSRF and Cookies**
   - Add CSRF protection for state-changing routes (auth, admin, reconciliation, revenue schedules, etc.).
   - If you do not require third-party embedding, tighten `sameSite` to `'lax'` or `'strict'` in production.

3. **Headers and Transport**
   - Add security headers via Next middleware or `headers()` in `next.config.mjs`.
   - Ensure production deployments are HTTPS-only with HSTS at the edge.

4. **Operational Controls**
   - Consider a dedicated job or pipeline step that exercises the main API flows (login, core CRUD operations) after deployments, using the existing `scripts/test-*` TS scripts as a base.
   - Log import usage (especially `.xlsx` uploads) and alert on unusual volume or size patterns.

---

### 6. Overall General Security Verdict

- Dependency posture: **High attention required**, primarily due to `xlsx` and pending fixes for `glob` and `jws`.
- Application design: **Solid foundation** (opaque sessions, bcrypt, centralized authorization, Prisma ORM, path-safe file storage), with no obvious code execution or injection primitives identified.
- Gaps: **CSRF protection, security headers/CSP, and unpatched third-party advisories**.

**Final rating (general security): Needs Attention**  
The project is structurally sound and follows good practices in many areas, but it should not yet be considered fully hardened for internet-facing production until dependency advisories are resolved, CSRF defenses are added, and baseline security headers are enforced.

---

### 7. Remediation Plan & Phasing

This section turns the above findings into an actionable plan. Phases are ordered by security impact and implementation effort.

#### Phase 1 – Immediate Risk Reduction (This Week)

1. **Lock in framework fix**
   - Confirm all environments run `next@14.2.35` and `eslint-config-next@14.2.35`.
   - Block deployments on `next` versions `< 14.2.35` via CI (simple version check script).

2. **Harden spreadsheet imports around `xlsx`**
   - Add explicit payload limits on `.xlsx` uploads (file size, number of rows/sheets).
   - Enforce rate limiting on import endpoints (per IP / per tenant) using existing middleware or edge configuration.
   - Update ops runbooks to treat XLSX imports as a potential DoS vector and include them in incident playbooks.

3. **Tighten session cookies (if cross-site embedding is not required)**
   - For production, change `setSessionCookie` to use `sameSite: 'lax'` (or `'strict'` if compatible with your flows).
   - Verify login/logout, multi-tab, and deep-link behavior still function correctly in staging.

#### Phase 2 – Dependency Governance (Next 2–3 Weeks)

4. **Formalize dependency monitoring**
   - Add `npm audit --production` (and optionally a third-party SCA tool) to CI, failing builds on new high/critical issues in `dependencies`.
   - Configure Dependabot (or equivalent) to open PRs for security-related version bumps, especially for packages bringing in `glob` and `jws`.

5. **Plan for `xlsx` upgrade**
   - Track SheetJS advisories for patched releases and create a backlog item to:
     - Upgrade `xlsx` to the first fixed version.
     - Re-run import/export regression tests (happy-path imports, malformed files, and large files).
   - If migration requires API changes, capture them in a small design doc before upgrading.

#### Phase 3 – CSRF & Header Hardening (Next 3–4 Weeks)

6. **Introduce CSRF protection for state-changing routes**
   - Choose a CSRF strategy (e.g., double-submit cookie or token tied to `session-token`).
   - Implement middleware or helper utilities that:
     - Issue a CSRF token to authenticated users (e.g., on initial HTML load or via a `/api/auth/csrf` endpoint).
     - Require and validate the token on mutating APIs: auth (`/api/auth/login`, `/api/auth/register`), admin, reconciliation, revenue-schedule, ticket, and account/opportunity endpoints.
   - Roll out behind an environment flag to allow gradual enabling and staged rollout.

7. **Add baseline security headers**
   - Implement a small header layer (middleware or `headers()` in `next.config.mjs`) that sets:
     - `X-Content-Type-Options: nosniff`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `X-Frame-Options: DENY` (unless framing is needed)
     - A conservative CSP tuned for this app’s scripts, styles, and images.
   - Validate headers using browser dev tools and a basic security scanner (e.g., Observatory/ZAP against staging).

8. **Validate HTTPS and HSTS at the edge**
   - Confirm all production endpoints terminate over HTTPS only.
   - Ensure HSTS is enabled at the load balancer/CDN layer with an appropriate max-age and subdomain policy.

#### Phase 4 – Operationalization & Regression Guardrails (Ongoing)

9. **Automated smoke checks after deploys**
   - Wrap existing TS scripts in a simple CI job (or a small Node test harness) that:
     - Performs login, basic CRUD operations, and a sample import on staging.
     - Fails the pipeline if critical endpoints (auth, core dashboards, key APIs) return non-2xx responses.

10. **Security review cadence**
    - Schedule a lightweight quarterly review to:
      - Re-run audits (`npm audit`, SCA tool) and update this document.
      - Re-check cookie, CSRF, and header configurations against current browser and platform guidance.
      - Ensure new features follow the same auth/permissions and input-handling patterns documented here.

**Plan status:** Pending implementation  
This plan is intended as the working checklist for closing the gaps flagged in sections 1–6 and should be updated as dependencies are patched and controls are rolled out.
