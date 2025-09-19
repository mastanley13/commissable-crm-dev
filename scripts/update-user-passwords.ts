import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const DEMO_USER_EMAILS = [
  'admin@commissable.test',
  'manager@commissable.test',
  'sales@commissable.test',
  'finance@commissable.test'
]

const prisma = new PrismaClient()

async function updateUserPasswords() {
  const requestedPassword = process.argv[2]?.trim()
  const defaultPassword = requestedPassword || process.env.DEMO_USER_PASSWORD || 'password123'

  if (defaultPassword.length < 8) {
    throw new Error('Demo password must be at least 8 characters long')
  }

  console.log('Updating demo user passwords...')

  const hashedPassword = await bcrypt.hash(defaultPassword, 12)
  const passwordChangedAt = new Date()

  let totalUpdated = 0

  for (const email of DEMO_USER_EMAILS) {
    const result = await prisma.user.updateMany({
      where: { email: email.toLowerCase() },
      data: {
        passwordHash: hashedPassword,
        passwordChangedAt,
        status: 'Active'
      }
    })
    totalUpdated += result.count
    if (result.count === 0) {
      console.warn(`- No user record found for ${email}`)
    }
  }

  if (totalUpdated === 0) {
    console.warn('No demo users were updated. Verify your DATABASE_URL and that the demo users exist.')
  } else {
    console.log(`Updated ${totalUpdated} demo user${totalUpdated === 1 ? '' : 's'}`)
    console.log(`All demo users now use password: ${defaultPassword}`)
  }

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: DEMO_USER_EMAILS
      }
    },
    select: {
      email: true,
      status: true,
      passwordHash: true,
      passwordChangedAt: true
    }
  })

  console.log('\nDemo user state:')
  users.forEach(user => {
    console.log(`- ${user.email} | status=${user.status} | passwordChangedAt=${user.passwordChangedAt?.toISOString()}`)
  })
}

updateUserPasswords()
  .catch((error) => {
    console.error('Error updating passwords:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })