import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Enhanced Prisma client configuration with connection pooling and retry logic
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Retry mechanism for database operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, lastError.message)
      await new Promise(resolve => setTimeout(resolve, delay))
      delay *= 2 // Exponential backoff
    }
  }
  
  throw lastError || new Error('Operation failed after all retries')
}

// Connection testing utility
export async function testConnection() {
  try {
    await withRetry(async () => {
      await prisma.$connect()
    })
    console.log('✅ Database connection successful')
    return { status: 'healthy', timestamp: new Date() }
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date() }
  }
}

// Health check function
export async function checkDatabaseHealth() {
  try {
    await withRetry(async () => {
      await prisma.$queryRaw`SELECT 1`
    })
    return { status: 'healthy', timestamp: new Date() }
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date() }
  }
}

// Graceful shutdown
export async function disconnect() {
  await prisma.$disconnect()
}
