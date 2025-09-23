**Status**: Connector wiring is now in place (lib/cloudsql.ts, lib/db.ts). Follow the steps below to finish service-account provisioning and env configuration.

Option A – Keep Vercel, drop Accelerate, and use Cloud SQL Node.js Connector with Prisma (works without Authorized Networks)

What this does: The Cloud SQL Node.js Connector opens a secure, IAM-authenticated TLS tunnel to your instance over its public IP and does not require Authorized Networks (no IP allow-listing). It’s designed for serverless environments. Prisma can use it via the connector’s Local Proxy (Unix socket) mode. 
Google Cloud
+2
Google Cloud
+2

Step-by-step

Create a service account for the app

Roles: at least Cloud SQL Client (add Cloud SQL Admin only if you run migrations from the app).

Download the JSON key (store it as a Vercel env var, not in git).
This account lets the connector obtain ephemeral certificates; no Authorized Network entries needed. 
GitHub

Add env vars in Vercel ? Project ? Settings ? Environment Variables

CLOUD_SQL_CONNECTION_NAME = PROJECT_ID:REGION:INSTANCE

DB_USER / DB_PASSWORD / DB_NAME

GCP_SA_KEY = entire service-account JSON (paste as a single line)

(Important) Do not set DATABASE_URL for runtime; we’ll pass it programmatically.

Install deps

npm i @google-cloud/cloud-sql-connector google-auth-library


(Prisma is already in your project.)

Create a tiny connector bootstrap (e.g., lib/cloudsql.ts)

// lib/cloudsql.ts
import { Connector } from '@google-cloud/cloud-sql-connector'
import { GoogleAuth } from 'google-auth-library'

const SOCKET_DIR = '/tmp' // writable on Vercel
const SOCKET_FILE = `${SOCKET_DIR}/.s.PGSQL.5432`

let started = false
let connector: Connector | null = null

export async function ensureCloudSqlSocket() {
  if (started) return { socketDir: SOCKET_DIR }
  const key = process.env.GCP_SA_KEY
  if (!key) throw new Error('Missing GCP_SA_KEY')

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/sqlservice.admin'],
    // Feed credentials directly (no file needed)
    credentials: JSON.parse(key),
  })

  connector = new Connector({ auth })
  await connector.startLocalProxy({
    instanceConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME!,
    // The connector will create a Unix domain socket here:
    listenOptions: { path: SOCKET_FILE },
  })

  started = true
  return { socketDir: SOCKET_DIR }
}

export function closeCloudSqlSocket() {
  connector?.close()
}


This “local proxy” mode is explicitly provided for unsupported drivers such as Prisma, using a Unix socket. It avoids IP allow-listing entirely. 
GitHub

Ensure your Prisma client uses that socket (e.g., lib/prisma.ts)

// lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { ensureCloudSqlSocket } from './cloudsql'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export async function getPrisma() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  const { socketDir } = await ensureCloudSqlSocket()

  const datasourceUrl =
    `postgresql://${encodeURIComponent(process.env.DB_USER!)}:${encodeURIComponent(process.env.DB_PASSWORD!)}@localhost/${process.env.DB_NAME!}?host=${encodeURIComponent(socketDir)}`

  const prisma = new PrismaClient({
    datasources: { db: { url: datasourceUrl } }, // override at runtime
  })

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
  return prisma
}


Prisma supports overriding the datasource URL at runtime via the PrismaClient constructor, so you can point it to the Unix socket path. 
Prisma

Use Node.js runtime (not Edge) for any route that hits the DB
In your Next.js Route Handlers/API routes, add:

export const runtime = 'nodejs'


Then:

// example: app/api/__dbcheck/route.ts
import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const prisma = await getPrisma()
  await prisma.$queryRaw`SELECT 1`
  return NextResponse.json({ ok: true })
}


Deploy ? test

Hit /api/__dbcheck on your Vercel URL – you should get { ok: true }.
Cloud SQL Connectors explicitly support connecting over public IP without configuring Authorized Networks. 
Google Cloud

Why this works: The connector handles authorization and TLS (ephemeral certs & IAM) and removes the need to manage firewalls/IP allowlists for public-IP connections. It doesn’t require a new network path; Vercel’s normal egress to the internet is enough. 
GitHub
+1

Caveats & tips

Use Node runtime only (the connector is not for Edge).

Create the connector once per cold start (as above).

Keep the socket in /tmp (the only writable directory on Vercel).

Keep your existing RBAC/middleware; nothing changes there.
