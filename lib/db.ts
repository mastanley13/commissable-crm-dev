import { dirname } from 'path'
import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { ensureCloudSqlProxy, shutdownCloudSqlProxy } from './cloudsql'

function usingCloudSqlConnector(): boolean {
  if (process.env.USE_CLOUD_SQL_CONNECTOR === 'true') return true
  if (process.env.USE_CLOUD_SQL_CONNECTOR === 'false') return false
  return Boolean(process.env.CLOUD_SQL_CONNECTION_NAME && process.env.GCP_SA_KEY)
}

let prismaPromise: Promise<PrismaClient> | null = null

async function createPrismaClient(): Promise<PrismaClient> {
  const logLevels: Prisma.LogLevel[] = process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error']

  if (usingCloudSqlConnector()) {
    const dbUser = process.env.DB_USER
    const dbPassword = process.env.DB_PASSWORD
    const dbName = process.env.DB_NAME

    if (!dbUser || !dbPassword || !dbName) {
      throw new Error('DB_USER, DB_PASSWORD, and DB_NAME must be set when using the Cloud SQL connector')
    }

    const { socketPath } = await ensureCloudSqlProxy()
    const socketDir = dirname(socketPath)

    const url = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@localhost/${encodeURIComponent(dbName)}?host=${encodeURIComponent(socketDir)}&port=5432`

    return new PrismaClient({
      datasources: { db: { url } },
      log: logLevels,
    })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set when Cloud SQL connector is disabled')
  }

  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: logLevels,
  })
}

export async function getPrisma(): Promise<PrismaClient> {
  if (!prismaPromise) {
    prismaPromise = createPrismaClient()
  }
  return prismaPromise
}

function createPrismaProxy<T extends object>(factory: () => Promise<T>): T {
  const cache = new Map<PropertyKey, any>()

  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return undefined
      }

      if (cache.has(prop)) {
        return cache.get(prop)
      }

      const proxied = createPrismaProxy(async () => {
        const actual = await factory()
        const value = actual[prop as keyof typeof actual]
        if (typeof value === 'function') {
          return value.bind(actual)
        }
        return value
      })

      cache.set(prop, proxied)
      return proxied
    },
    apply(_target, _thisArg, argArray) {
      return factory().then(actual => {
        if (typeof actual !== 'function') {
          throw new TypeError('Attempted to call a non-function Prisma property.')
        }
        return (actual as any).apply(actual, argArray)
      })
    }
  }

  return new Proxy(function () {}, handler) as unknown as T
}

export const prisma = createPrismaProxy(getPrisma)

export async function withRetry<T>(
  operation: (client: PrismaClient) => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  const client = await getPrisma()

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation(client)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')

      if (attempt === maxRetries) {
        throw lastError
      }

      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, lastError.message)
      await new Promise(resolve => setTimeout(resolve, delay))
      delay *= 2
    }
  }

  throw lastError || new Error('Operation failed after all retries')
}

export async function testConnection() {
  try {
    await withRetry(prisma => prisma.$connect())
    console.log('Database connection successful')
    return { status: 'healthy', timestamp: new Date() }
  } catch (error) {
    console.error('Database connection failed:', error)
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date() }
  }
}

export async function checkDatabaseHealth() {
  try {
    await withRetry(prisma => prisma.$queryRaw`SELECT 1`)
    return { status: 'healthy', timestamp: new Date() }
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date() }
  }
}

export async function disconnect() {
  if (!prismaPromise) return
  const client = await prismaPromise
  await client.$disconnect()
  if (usingCloudSqlConnector()) {
    shutdownCloudSqlProxy()
  }
  prismaPromise = null
}

