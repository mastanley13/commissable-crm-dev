import { Prisma, PrismaClient } from "@prisma/client"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

export type ResolvedDepositLineAccount = {
  id: string
  accountName: string | null
  accountLegalName: string | null
}

function normalizeLookupName(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function uniqueExcludedIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value))))
}

export async function resolveUniqueDepositLineAccountsByName(
  client: PrismaClientOrTx,
  params: {
    tenantId: string
    rawNames: Array<string | null | undefined>
    excludeAccountIds?: Array<string | null | undefined>
  },
): Promise<Map<string, ResolvedDepositLineAccount>> {
  const names = Array.from(
    new Set(
      params.rawNames
        .map(value => value?.trim() ?? "")
        .filter(Boolean),
    ),
  )

  const resolved = new Map<string, ResolvedDepositLineAccount>()
  if (names.length === 0) {
    return resolved
  }

  const excludedIds = uniqueExcludedIds(params.excludeAccountIds ?? [])
  const matches = await client.account.findMany({
    where: {
      tenantId: params.tenantId,
      ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
      OR: names.flatMap(name => [
        { accountName: { equals: name, mode: "insensitive" as const } },
        { accountLegalName: { equals: name, mode: "insensitive" as const } },
      ]),
    },
    select: {
      id: true,
      accountName: true,
      accountLegalName: true,
    },
  })

  const candidatesByName = new Map<string, ResolvedDepositLineAccount[]>()
  for (const account of matches) {
    for (const key of [normalizeLookupName(account.accountName), normalizeLookupName(account.accountLegalName)]) {
      if (!key) continue
      const existing = candidatesByName.get(key) ?? []
      if (!existing.some(candidate => candidate.id === account.id)) {
        existing.push({
          id: account.id,
          accountName: account.accountName ?? null,
          accountLegalName: account.accountLegalName ?? null,
        })
        candidatesByName.set(key, existing)
      }
    }
  }

  for (const rawName of names) {
    const key = normalizeLookupName(rawName)
    const candidates = candidatesByName.get(key) ?? []
    if (candidates.length === 1) {
      resolved.set(key, candidates[0]!)
    }
  }

  return resolved
}

export async function resolveUniqueDepositLineAccount(
  client: PrismaClientOrTx,
  params: {
    tenantId: string
    persistedAccountId?: string | null
    accountNameRaw?: string | null
    distributorAccountId?: string | null
    vendorAccountId?: string | null
  },
): Promise<ResolvedDepositLineAccount | null> {
  const persistedAccountId = params.persistedAccountId?.trim() ?? ""
  if (persistedAccountId) {
    const account = await client.account.findFirst({
      where: {
        tenantId: params.tenantId,
        id: persistedAccountId,
      },
      select: {
        id: true,
        accountName: true,
        accountLegalName: true,
      },
    })

    if (account) {
      return {
        id: account.id,
        accountName: account.accountName ?? null,
        accountLegalName: account.accountLegalName ?? null,
      }
    }
  }

  const rawName = params.accountNameRaw?.trim() ?? ""
  if (!rawName) {
    return null
  }

  const resolved = await resolveUniqueDepositLineAccountsByName(client, {
    tenantId: params.tenantId,
    rawNames: [rawName],
    excludeAccountIds: [params.distributorAccountId, params.vendorAccountId],
  })

  return resolved.get(normalizeLookupName(rawName)) ?? null
}
