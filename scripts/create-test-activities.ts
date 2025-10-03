import { PrismaClient, ActivityType, ActivityStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find Algave LLC account
  const account = await prisma.account.findFirst({
    where: { accountName: { contains: 'Algave' } }
  })

  if (!account) {
    console.error('Algave LLC account not found')
    process.exit(1)
  }

  console.log('Found account:', account.accountName, 'ID:', account.id)

  // Get a user to assign activities to
  const user = await prisma.user.findFirst({
    where: { tenantId: account.tenantId }
  })

  if (!user) {
    console.error('No user found in tenant')
    process.exit(1)
  }

  const activityTypes: ActivityType[] = ['Call', 'Meeting', 'ToDo', 'Note', 'Other']
  const activityStatuses: ActivityStatus[] = ['Open', 'Completed']

  const descriptions = [
    'Discovery follow-up',
    'Quarterly business review preparation',
    'Contract renewal discussion',
    'Product demo walkthrough',
    'Technical requirements gathering',
    'Budget approval meeting',
    'Implementation planning session',
    'Training session scheduled',
    'Support ticket follow-up',
    'Strategic planning discussion'
  ]

  const activities = []

  for (let i = 0; i < 10; i++) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 30) - 10) // Random date +/- 10 days

    const activity = await prisma.activity.create({
      data: {
        tenantId: account.tenantId,
        subject: descriptions[i],
        description: `Detailed notes for ${descriptions[i]}`,
        activityType: activityTypes[Math.floor(Math.random() * activityTypes.length)],
        status: activityStatuses[Math.floor(Math.random() * activityStatuses.length)],
        dueDate,
        creatorId: user.id,
        assigneeId: user.id,
        accountId: account.id
      }
    })

    activities.push(activity)
    console.log(`Created activity ${i + 1}:`, activity.subject)
  }

  console.log(`\nSuccessfully created ${activities.length} activities for ${account.accountName}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
