## Local Dev Runbook: Start Backend (Cloud SQL Proxy) and Frontend

- **Project root**: `Commissable CRM`
- **DB instance**: `commissable-sql`
- **Project ID**: `groovy-design-471709-d1`
- **Region**: `us-central1`

### 0) Prerequisites (one-time per machine)
- **Install** Google Cloud CLI and sign in: `gcloud init`
- **Authenticate ADC** (libraries use these creds):
```powershell
gcloud auth application-default login
```
- Ensure Node.js/npm are installed.

### 1) Start Cloud SQL Proxy (Terminal 1)
Run from the project root. Leave this terminal open.
```powershell
cloud-sql-proxy groovy-design-471709-d1:us-central1:commissable-sql --port 5432
```
- You should see: “Listening on 127.0.0.1:5432” and “ready for new connections”.

### 2) Verify/Set DATABASE_URL
- The app reads `.env.local` or `.env` automatically. Ensure it points to the proxy on localhost.
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/commissable_crm"
```
- If you change the schema or env, (re)generate the Prisma client:
```powershell
npx prisma generate
```

### 3) Start Next.js frontend (Terminal 2)
Run from the project root in a new terminal.
```powershell
npm run dev
```
- Open `http://localhost:3000`.

### 4) Open Prisma Studio (optional, Terminal 3)
```powershell
npx prisma studio
```
- Browse at `http://localhost:5555`.

### 5) Quick verification (optional)
```powershell
netstat -an | findstr 5432   # proxy should be LISTENING
netstat -an | findstr 3000   # app should be LISTENING
```
```powershell
curl http://localhost:3000     # should return 200 OK
curl http://localhost:5555     # Studio should return 200 OK
```

### 6) Troubleshooting
- **DB errors in app or Studio**: ensure Terminal 1 (proxy) is running.
- **Prisma errors after schema/env changes**: `npx prisma generate`.
- **Cannot connect using `gcloud sql connect`**: use the proxy command above (IPv6/policy limitations).
- **Next.js config warning** about `experimental.appDir`: safe to ignore or remove that key from `next.config.mjs`.

### 7) Stop services
- In each terminal where a service is running, press `Ctrl + C`.
- Close the proxy last to avoid transient DB errors in the app.

### Notes
- All commands are intended to be run from the project root.
- The proxy secures a local TCP port (5432) to your Cloud SQL instance; no public DB port exposure required.

