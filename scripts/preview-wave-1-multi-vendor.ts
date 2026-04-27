import path from "node:path"
import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true })

const prisma = new PrismaClient()

async function loginAndGetSessionToken(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`)
  }

  const setCookie = response.headers.get("set-cookie") ?? ""
  const match = /session-token=([^;]+)/.exec(setCookie)
  if (!match) {
    throw new Error("Login succeeded but no session-token cookie was returned.")
  }

  return match[1]!
}

async function main() {
  const baseUrl = process.env.IMPORT_BASE_URL?.trim() || "http://127.0.0.1:3000"
  const email = process.env.PLAYWRIGHT_EMAIL?.trim() || "admin@commissable.test"
  const password = process.env.PLAYWRIGHT_PASSWORD?.trim() || "password123"

  const distributor = await prisma.account.findFirst({
    where: {
      accountName: { equals: "Telarus", mode: "insensitive" },
    },
    select: { id: true, accountName: true },
  })

  if (!distributor) {
    throw new Error("Distributor account Telarus not found.")
  }

  const sessionToken = await loginAndGetSessionToken(baseUrl, email, password)
  const response = await fetch(`${baseUrl}/api/reconciliation/templates/multi-vendor-preview`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `session-token=${sessionToken}`,
    },
    body: JSON.stringify({
      distributorAccountId: distributor.id,
      vendorNames: ["ACC Business", "Advantix", "AT&T", "Bigleaf"],
      options: { maxVendors: 20 },
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Preview failed: ${response.status} ${JSON.stringify(payload)}`)
  }

  console.log(
    JSON.stringify(
      {
        distributorAccountId: distributor.id,
        distributorAccountName: distributor.accountName,
        templatesUsed: payload?.data?.templatesUsed ?? [],
        missingVendors: payload?.data?.missingVendors ?? [],
        vendorsMissingTemplates: payload?.data?.vendorsMissingTemplates ?? [],
        warnings: payload?.data?.warnings ?? [],
      },
      null,
      2
    )
  )
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
