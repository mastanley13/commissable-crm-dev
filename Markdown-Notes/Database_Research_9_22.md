***Update (Connector)***: Accelerate has been replaced with the Cloud SQL Node.js connector. See local_accelerate_workflow.md for the new env variables and runtime flow. The historical Accelerate notes remain below for reference.\n\n## TL;DR (what you’ll actually do)

1. **Enable Prisma Accelerate** in the Prisma Data Platform and pick a region near your Cloud SQL DB.
2. **(Recommended)** Turn on **Static IP** for Accelerate and **allowlist those IPs** on your Cloud SQL instance. Otherwise, temporarily allow public access while you test. ([Prisma][1])
3. Set `DATABASE_URL` on Vercel to the **prisma Accelerate URL** (`prisma+postgres://…` or `prisma://…`) and keep a **direct** Postgres URL in `DIRECT_DATABASE_URL` if you prefer that pattern. ([Prisma][2])
4. Install and wire **`@prisma/extension-accelerate`** and **extend Prisma Client** in your code. ([Prisma][2])
5. Deploy; run migrations using **Accelerate** (with `prisma+postgres://` you can migrate without a direct URL), or use `DIRECT_DATABASE_URL` if you choose the two‑URL method. ([Prisma][2])
6. Validate with a simple `/api/__dbcheck` route.

Everything below spells this out step‑by‑step.

---

## Phase A — Prep on Google Cloud SQL (once)

1. **Confirm a Public IP exists** for your Cloud SQL instance (PostgreSQL).
   *Cloud SQL → Instance → Connections → Networking → Public IP.* ([Google Cloud][3])

2. **Add Authorized Networks** for Accelerate to reach your DB:

   * **Best**: enable *Static IP* in Prisma Accelerate, then add those static IPv4/IPv6 addresses to **Authorized networks**.
   * **Okay for testing**: add a broader range or temporary `0.0.0.0/0` (remove it later).
     *Cloud SQL → Instance → Connections → Authorized networks.* ([Prisma][1])

3. **Enforce TLS** on Cloud SQL and use `sslmode=require` in any direct URL you keep.
   *Cloud SQL recommends enforcing SSL/TLS for public IP connections.* ([Google Cloud][4])

---

## Phase B — Enable Prisma Accelerate (Data Proxy)

1. **Open Prisma Data Platform** → your project → **Enable Accelerate** for the *production* environment. Provide your **direct Postgres connection string** and **select the region nearest your DB**. ([Prisma][2])

2. **(Recommended)** Toggle **Static IP** on that environment. Copy the **static IP list** and add them to Cloud SQL authorized networks (Phase A‑2). *(Static IP requires Pro/Business plan.)* ([Prisma][1])

3. Copy the generated **Accelerate connection string**. For PostgreSQL, prefer the **`prisma+postgres://…`** form because **Migrate/Introspection works with it** (no `directUrl` needed). Alternatively, use `prisma://…` plus a separate `DIRECT_DATABASE_URL`. ([Prisma][2])

---

## Phase C — Code changes (Prisma + Next.js)

> If you already use Accelerate, sanity‑check these files match the patterns below.

1. **Install / update packages**

   ```bash
   npm i @prisma/client@latest @prisma/extension-accelerate prisma@latest
   ```

   ([Prisma][2])

2. **Prisma schema (`prisma/schema.prisma`)**

   **Option A (recommended for Postgres): single URL**

   ```prisma
   datasource db {
     provider = "postgresql"
     // Works for both runtime and prisma migrate with Postgres:
     url      = env("DATABASE_URL")
   }
   ```

   Set `DATABASE_URL` to the **`prisma+postgres://…`** Accelerate URL. ([Prisma][2])

   **Option B (two URLs):** use Accelerate for runtime + direct URL for CLI

   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")          // prisma://accelerate…
     directUrl = env("DIRECT_DATABASE_URL")   // postgresql://user:pass@host:5432/db?sslmode=require
   }
   ```

   Use this if you want migrations to **always** bypass the proxy. ([Prisma][2])

3. **Prisma client bootstrap (e.g., `lib/prisma.ts`)**

   ```ts
   import { PrismaClient } from '@prisma/client'
   import { withAccelerate } from '@prisma/extension-accelerate'

   const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

   export const prisma =
     globalForPrisma.prisma ??
     new PrismaClient().$extends(withAccelerate())

   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
   ```

   *If you deploy any **Edge** functions, switch import to `@prisma/client/edge` in those files.* ([Prisma][2])

4. **(Optional) Per‑query caching**
   You can add cache on read queries later:

   ```ts
   await prisma.user.findMany({
     where: { email: { contains: 'alice@prisma.io' } },
     cacheStrategy: { swr: 60, ttl: 60 }, // example
   })
   ```

   *(Leave off while you wire up connectivity; add after smoke tests.)* ([Prisma][2])

5. **Generate client**
   In serverless/edge, Prisma recommends smaller bundles:

   ```bash
   npx prisma generate --no-engine
   ```

   (Add `"postinstall": "prisma generate --no-engine"` to `package.json`.) ([Prisma][2])

---

## Phase D — Environment variables

### Vercel → Project → Settings → Environment Variables (Production)

* **Option A (single URL)**

  * `DATABASE_URL` = **Accelerate** connection string, e.g.
    `prisma+postgres://accelerate.prisma-data.net/?api_key=…`
  * *(No direct URL required with Postgres; migrations work with this string.)* ([Prisma][2])

* **Option B (two URLs)**

  * `DATABASE_URL`           = `prisma://accelerate.prisma-data.net/?api_key=…`
  * `DIRECT_DATABASE_URL`    = `postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require`
    *(HOST is your Cloud SQL public IP or hostname; include `sslmode=require`.)* ([Prisma][2])

> Keep your **local `.env`** pointing to a local DB or to Cloud SQL via proxy as you do now. For production, Vercel’s envs override.

---

## Phase E — Migrations & Deploy

**Pick one path** and use it consistently:

* **Path 1 (simplest with Postgres):**
  Use **Option A** above. On deploy, run:

  ```bash
  npx prisma migrate deploy
  ```

  This works **with the `prisma+postgres://` URL** through Accelerate. You can trigger it via a one‑off Vercel deploy command, a CI step, or run it locally pointing `DATABASE_URL` to the same `prisma+postgres://` URL. ([Prisma][2])

* **Path 2 (two URLs):**
  Keep `DATABASE_URL` = Accelerate and run:

  ```bash
  npx prisma migrate deploy --schema=prisma/schema.prisma
  ```

  Prisma will use `directUrl` for Migrate and connect directly to Cloud SQL. **Ensure the machine running this command is allowlisted** in Cloud SQL (your local IP, a GitHub Action runner with a static egress, or a bastion). ([Prisma][5])

> **Avoid** putting `migrate deploy` in every Vercel build if multiple parallel deploys can race. Instead, run migrations as a **separate, controlled step** (manual, CI job, or a single “primary” deploy hook).

Then **deploy to Vercel** normally (Build → Output → Go live).

---

## Phase F — Connectivity smoke test

Add a quick health route (server‑only):

**`app/api/__dbcheck/route.ts` (Next App Router)**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'error' }, { status: 500 })
  }
}
```

Deploy and hit `/api/__dbcheck` on the **Vercel URL**. You should get `{ ok: true }`. If not:

* **“Accelerate was not able to connect”** → fix allowlist / credentials / region selection in Accelerate. ([GitHub][6])
* **TLS / auth errors** → confirm `sslmode=require` on any direct URL and that Cloud SQL enforces SSL. ([Google Cloud][4])

---

## Phase G — Security hardening (after it works)

1. **Restrict Cloud SQL exposure**

   * Prefer **Accelerate Static IP allowlisting** over broad IP ranges. Remove any temporary `0.0.0.0/0`. ([Prisma][1])
2. **Enforce SSL/TLS** on Cloud SQL and verify all direct URLs use `?sslmode=require`. ([Google Cloud][4])
3. **Minimum‑privilege DB user** for the app (no superuser rights).
4. **RBAC stays app‑level:** your existing Next.js middleware and permission checks continue to guard routes; Accelerate only changes the transport.
5. **Observability:** watch Vercel logs and Prisma Accelerate dashboard (cache hits, pool metrics). ([Prisma][7])

---

## Phase H — Performance (optional, after green lights)

* **Enable per‑query caching** for read‑heavy queries (list/search screens). Start small with `ttl/swr` of 30–60s; add **cache tags** and invalidate on writes where freshness matters. *(Invalidate requires a paid plan.)* ([Prisma][2])
* Keep queries **server‑side only**. Do **not** import server files (that use Prisma) into client components—this is a common cause of runtime errors in Next.js. ([GitHub][6])

---

## Rollback plan (quick)

* Flip Vercel `DATABASE_URL` back to your **direct Postgres URL** (with `sslmode=require`) and remove the Accelerate extension from the client bootstrap. Re‑deploy. *(Not ideal for serverless scale, but useful as a safety hatch.)*

---

## Copy‑paste checklists

**Cloud SQL**

* [ ] Public IP enabled (or was already). ([Google Cloud][3])
* [ ] Authorized networks include **Accelerate static IPs** (or temporarily a broader range). ([Prisma][1])
* [ ] TLS enforced; direct URLs include `sslmode=require`. ([Google Cloud][4])

**Prisma / Code**

* [ ] `@prisma/client` + `@prisma/extension-accelerate` installed. ([Prisma][2])
* [ ] `schema.prisma` uses `url = env("DATABASE_URL")` (and `directUrl` if you chose two‑URL mode). ([Prisma][2])
* [ ] Prisma client extended with `withAccelerate()`; single instance pattern. ([Prisma][2])
* [ ] `postinstall` runs `prisma generate --no-engine`. ([Prisma][2])

**Vercel**

* [ ] `DATABASE_URL` = `prisma+postgres://…` (or `prisma://…`). ([Prisma][2])
* [ ] `DIRECT_DATABASE_URL` set **only** if you chose two‑URL mode.
* [ ] Deploy → run `prisma migrate deploy` (once per release, controlled). ([Prisma][2])
* [ ] `/api/__dbcheck` returns `{ ok: true }`.

---

## Notes on your RBAC

Your login + role/permission checks stay exactly as they are. Accelerate only changes **how** the server reaches the DB; it doesn’t expose the DB to the browser or bypass your authorization. Keep enforcing permissions **in API routes** (not just in UI).

---

If you want, I can tailor these steps to your code structure (e.g., exact file paths, how to gate migrations in CI) — but the plan above is everything you need to get production working on Vercel with Prisma Accelerate and Cloud SQL.

[1]: https://www.prisma.io/docs/accelerate/static-ip "Enable Static IP for Prisma Accelerate | Prisma Documentation"
[2]: https://www.prisma.io/docs/accelerate/getting-started "Getting started with Prisma Accelerate | Prisma Documentation"
[3]: https://cloud.google.com/sql/docs/postgres/configure-ip?utm_source=chatgpt.com "Configure public IP | Cloud SQL for PostgreSQL"
[4]: https://cloud.google.com/sql/docs/postgres/configure-ssl-instance?utm_source=chatgpt.com "Configure SSL/TLS certificates | Cloud SQL for PostgreSQL"
[5]: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management?utm_source=chatgpt.com "Database connections | Prisma Documentation"
[6]: https://github.com/prisma/prisma/discussions/22375?utm_source=chatgpt.com "Accelerate was not able to connect to your database. The ..."
[7]: https://www.prisma.io/docs/accelerate "Prisma Accelerate | Prisma Documentation"

