import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkContacts() {
  try {
    console.log('Checking contacts in database...')
    
    // Get all contacts
    const allContacts = await prisma.contact.findMany({
      select: {
        id: true,
        fullName: true,
        accountId: true,
        deletedAt: true,
        createdAt: true,
        account: {
          select: {
            accountName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 25
    })
    
    console.log(`Found ${allContacts.length} contacts:`)
    allContacts.forEach((contact, index) => {
      console.log(`${index + 1}. ${contact.fullName} (Account: ${contact.account.accountName}) - Created: ${contact.createdAt.toISOString()} - Deleted: ${contact.deletedAt ? 'YES' : 'NO'}`)
    })
    
    // Check for contacts without deletedAt
    const activeContacts = allContacts.filter(c => !c.deletedAt)
    console.log(`\nActive contacts (not deleted): ${activeContacts.length}`)
    
    // Check for contacts with deletedAt
    const deletedContacts = allContacts.filter(c => c.deletedAt)
    console.log(`Deleted contacts: ${deletedContacts.length}`)
    
  } catch (error) {
    console.error('Error checking contacts:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkContacts()