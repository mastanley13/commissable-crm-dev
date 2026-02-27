# RB-ADM-002 — User Invite → Accept → Activate (Implementation Plan)

Ticket: `RB-ADM-002` (P1)  
Source: `docs/tasks/rob_email_feedback_tickets_2026-01-25.xlsx - Tickets.csv`  
Date: 2026-02-27

## 1) Summary

We need a real invitation workflow where:

- Admin creates a user → user is **not Active yet**.
- System emails an invite link to the user.
- User opens link, sets password (or otherwise confirms), and only then becomes **Active**.
- We record an audit log entry when activation occurs.

Today the app has `UserStatus` values `Active | Invited | Suspended | Disabled` and no invitation token/email acceptance flow. The UI also exposes a status option that doesn’t exist in the schema (`Inactive`) and contains copy that implies invites are already implemented.

## 2) Current State (Gap Analysis)

### Data model
- `User.status` defaults to `Invited` (`prisma/schema.prisma`), which is the closest equivalent to “Inactive”.
- There is no `Inactive` enum value (so “Inactive user” is currently not a valid user state).
- There is no “invite token” or “invite acceptance” persistence (no token table/fields in Prisma).

### Admin create user flow
- `POST /api/admin/users` can create a user and optionally set a password, but does not:
  - generate an invite token
  - send an email
  - provide an acceptance endpoint/link
- The create-user modal says leaving password blank will send an invite, but that behavior is not implemented.
- The create-user modal includes an `Inactive` status option, which is not a valid `UserStatus` value.

### Authentication behavior
- Login currently allows `Invited` users to authenticate (if they have a password).
- This conflicts with “becomes Active only after acceptance”, unless we redefine “acceptance” as “first successful login”.

## 3) Definitions / Product Decisions (Must Confirm)

To implement cleanly, we should confirm these decisions up front:

1) **Terminology**
   - Recommended: treat `Invited` as the “inactive/pending acceptance” state (do not add a new `Inactive` status).

2) **What counts as “acceptance”?**
   - Recommended: acceptance = user visits invite link and sets their password (and optionally signs in).

3) **Can admins set passwords directly?**
   - Option A (recommended for clarity): admin cannot set password; user must accept invite to set password.
   - Option B: keep admin-set password for edge cases; if admin sets password, user may be set `Active` immediately (and we should not claim an email invite is sent).

4) **Invite expiration**
   - Recommended default: 7 days (configurable via env var).

5) **Resend behavior**
   - Recommended: resending invalidates previous tokens and issues a new token with new expiry.

## 4) Target Behavior (Acceptance Criteria Mapping)

Acceptance criteria from ticket:

- **“New user status = Inactive post-create”**
  - Implementation: `User.status = Invited` immediately after create (server-enforced).

- **“Becomes Active only after acceptance”**
  - Implementation: only the invite acceptance flow can transition `Invited → Active`.

- **“Audit log entry recorded”**
  - Implementation: create an audit entry on invite acceptance/activation (separate from the “Create user” audit log).

## 5) Technical Design

### 5.1 Data model additions (Prisma)

Add a new model to support invitation tokens and resends without overloading the `User` record:

**Model: `UserInvite`**
- `id` (uuid)
- `tenantId`
- `userId` (FK)
- `emailSnapshot` (string) — capture what email we invited at send time
- `tokenHash` (string) — store a hash, never the raw token
- `sentAt` (datetime)
- `expiresAt` (datetime)
- `acceptedAt` (datetime, nullable)
- `revokedAt` (datetime, nullable) — for resend/disable flows
- `createdById` (FK) — admin who created/sent invite

Indexes:
- `(tenantId, userId)`
- `(tenantId, tokenHash)` unique
- `(tenantId, expiresAt)`

Rationale:
- Supports multiple invites over time (history/auditability).
- Supports resend + revoke semantics cleanly.
- Avoids storing raw tokens.

### 5.2 Token format and security

- Generate a cryptographically secure random token (e.g., 32+ bytes) and encode as URL-safe base64.
- Store only a hash in DB (e.g., SHA-256) and compare hashes server-side.
- One-time use:
  - on acceptance: set `acceptedAt`
  - reject if `acceptedAt` is already set
  - reject if `revokedAt` is set
- Expiration:
  - reject if `now > expiresAt`
- Rate limiting:
  - add basic per-IP/per-email throttling for accept endpoint to reduce brute-force risk.

### 5.3 Email delivery abstraction

Create a small internal mailer module so we can swap providers:

- `lib/email/mailer.ts`
  - `sendUserInviteEmail({ to, inviteUrl, expiresAt, invitedByName, tenantName })`

Provider options (choose one):
- Resend (simple API)
- Postmark (transactional focus)
- SendGrid
- AWS SES (more ops overhead)

Dev/test behavior:
- If provider env vars are missing, log the invite URL to server logs (so local/dev can still test acceptance).

### 5.4 Invite URL + acceptance UX

Invite link shape (example):
- `https://<app-host>/accept-invite?token=<rawToken>&tenant=<tenantIdOrSlug>`

Acceptance page:
- `app/accept-invite/page.tsx` (or similar)
  - form: set password + confirm password
  - submit to API endpoint with token + password

Acceptance API:
- `POST /api/auth/accept-invite`
  - Input: `{ token, password, tenantId? }`
  - Steps:
    1) hash token, find matching `UserInvite` for tenant
    2) validate not accepted/revoked/expired
    3) set user password + `passwordChangedAt`
    4) transition `User.status` to `Active` (only if currently `Invited`)
    5) set `UserInvite.acceptedAt = now`
    6) write audit log: action `Update` (or `Activate`) on `User` with changed fields including `status` and `passwordChangedAt`
    7) (optional) auto-login: create session + set cookie (product decision)

### 5.5 Enforcing status rules

To ensure the app always meets the ticket requirement:

- In `POST /api/admin/users`:
  - if `password` is not provided:
    - force `status = Invited` regardless of client-provided status
    - create `UserInvite`
    - send invite email
  - if `password` is provided:
    - follow the chosen product decision:
      - Option A: disallow setting password here (return 400, instruct to use invite)
      - Option B: allow password + set status `Active` (or allow admin to choose `Active`, but avoid any “invite sent” copy)

- In login:
  - Recommended: only allow `Active` users to log in after this feature ships.
  - If we must allow `Invited` logins, then we need a clear semantics for “acceptance” (but it will conflict with the ticket language).

### 5.6 Admin UI updates

Admin users list:
- Status display: ensure `Invited` is visually distinct and described as “Pending acceptance”.
- Actions:
  - Add `Resend invite` action for `Invited` users.
  - Add `Copy invite link` (admin convenience), guarded by permission.

Create user modal:
- Remove invalid `Inactive` option.
- If password is blank:
  - show “Invitation will be emailed” confirmation
  - do not allow setting status to `Active` (or hide status field entirely)
- If password is provided (if kept):
  - adjust copy to indicate “User can sign in immediately; no invite email is sent”.

User detail page:
- Show invitation status info:
  - latest invite `sentAt`, `expiresAt`, `acceptedAt` (if available)
  - resend button

## 6) Implementation Steps (Suggested Sequencing)

### Phase 0 — Requirements lock (1 short meeting)
- Confirm decisions in §3 (terminology, acceptance meaning, admin password behavior, expiry, resend).
- Confirm email provider choice and “from” address/domain.

### Phase 1 — Data model + migrations
- Add `UserInvite` model and migrate DB.
- Add any necessary permissions (e.g., `admin.users.invite.resend`) if desired.

### Phase 2 — Server-side invite creation + email sending
- Update `POST /api/admin/users`:
  - enforce `Invited` for invite path
  - create invite token record
  - send email via `lib/email/mailer.ts`
- Add `POST /api/admin/users/:id/resend-invite` (or `POST /api/admin/users/resend-invite`) endpoint:
  - revoke existing active invites
  - create new invite + send
  - audit log: “Invite resent”

### Phase 3 — Invite acceptance flow
- Add acceptance API `POST /api/auth/accept-invite`.
- Add acceptance page/form.
- Add audit log on successful acceptance.
- Decide and implement post-accept behavior:
  - auto-login vs “go to login page”.

### Phase 4 — Auth tightening
- Update login to reject non-`Active` statuses (recommended).
- Improve error messaging for `Invited` (“Please check your invite email / request a new invite”).

### Phase 5 — Admin UI alignment
- Fix create-user modal status options and copy.
- Add resend/copy invite link actions in users list and/or user details.
- Optionally add a status filter query param support (if desired).

### Phase 6 — Tests + QA scripts
- Add API-level tests for:
  - create invited user (password blank) → status `Invited`, invite created, email send invoked
  - accept invite → status `Active`, invite acceptedAt set, audit log created
  - expired token → 400/410 style error
  - revoked token (resend) → error
  - reuse token → error
- Add a minimal manual QA checklist:
  - Create user (no password) → receives email → accepts → can login
  - Resend invite → old link fails, new link works
  - Login blocked for `Invited` (if we enforce Active-only)

## 7) Rollout / Ops Considerations

- Env vars needed (example names; finalize with provider choice):
  - `EMAIL_PROVIDER`
  - `EMAIL_FROM`
  - `EMAIL_API_KEY`
  - `INVITE_TOKEN_TTL_DAYS` (default 7)
  - `APP_BASE_URL` (for absolute invite links)
- Logging:
  - log invite send success/failure (do not log raw tokens)
  - in dev, optionally log the invite URL
- Deliverability:
  - ensure SPF/DKIM/DMARC are configured for the sending domain
- Backward compatibility:
  - existing `Invited` users without invites: allow admin to “Send invite” to generate first invite record

## 8) Open Questions / Risks

- If self-registration (`/register`) remains enabled, it may conflict with “invite-only onboarding”.
- If any flows currently rely on `Invited` users being able to log in, tightening login may be a breaking change.
- UI currently conflates generic “Active/Inactive” toggles with user `status` enums; ensure user status changes are explicit and validated.

