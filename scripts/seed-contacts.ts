import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const firstNames = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "William",
  "Mia", "James", "Charlotte", "Benjamin", "Amelia", "Lucas", "Harper", "Henry", "Evelyn", "Alexander"
]

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"
]

const jobTitles = [
  "Software Engineer",
  "Product Manager",
  "Marketing Director",
  "Sales Executive",
  "Operations Manager",
  "Chief Technology Officer",
  "VP of Engineering",
  "Business Analyst",
  "Account Manager",
  "Customer Success Manager",
  "Senior Developer",
  "UX Designer",
  "Data Scientist",
  "IT Director",
  "Finance Manager",
  "HR Manager",
  "Project Manager",
  "Quality Assurance Lead",
  "DevOps Engineer",
  "Strategy Consultant"
]

const domains = ["algave.example", "algave.com", "algave.net"]

async function seedContacts() {
  console.log("Starting to seed 20 contacts for Algave LLC...")

  // Find the Algave LLC account
  const account = await prisma.account.findFirst({
    where: {
      accountName: "Algave LLC"
    }
  })

  if (!account) {
    console.error("Algave LLC account not found. Please run the main seed first.")
    return
  }

  // Get account type
  const accountType = await prisma.accountType.findFirst({
    where: {
      tenantId: account.tenantId,
      code: "CUSTOMER"
    }
  })

  // Get a user to assign as owner
  const salesUser = await prisma.user.findFirst({
    where: {
      tenantId: account.tenantId,
      email: "sales@commissable.test"
    }
  })

  if (!salesUser || !accountType) {
    console.error("Required data not found. Please run the main seed first.")
    return
  }

  // Create contact address (reuse for simplicity)
  const contactAddress = await prisma.address.create({
    data: {
      tenantId: account.tenantId,
      line1: "123 Market Street",
      city: "Atlanta",
      state: "GA",
      postalCode: "30303",
      country: "USA",
    },
  })

  const contacts = []

  for (let i = 0; i < 20; i++) {
    const firstName = firstNames[i % firstNames.length]
    const lastName = lastNames[i % lastNames.length]
    const fullName = `${firstName} ${lastName}`
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domains[i % domains.length]}`
    const jobTitle = jobTitles[i % jobTitles.length]
    const phoneExtension = String(2000 + i).padStart(4, '0')
    const workPhone = `252-626-${phoneExtension}`

    const contact = await prisma.contact.create({
      data: {
        tenantId: account.tenantId,
        accountId: account.id,
        accountTypeId: accountType.id,
        ownerId: salesUser.id,
        createdById: salesUser.id,
        updatedById: salesUser.id,
        mailingAddressId: contactAddress.id,
        firstName,
        lastName,
        fullName,
        jobTitle,
        workPhone,
        emailAddress: email,
        preferredContactMethod: i % 2 === 0 ? "Email" : "Phone",
        isPrimary: false,
        isDecisionMaker: i < 5, // First 5 are decision makers
        description: `Contact ${i + 1} for Algave LLC`,
      },
    })

    // Add contact preferences
    await prisma.contactPreference.createMany({
      data: [
        {
          tenantId: account.tenantId,
          contactId: contact.id,
          channel: "Email",
          enabled: true,
          consentCapturedAt: new Date(),
          consentCapturedById: salesUser.id,
        },
        {
          tenantId: account.tenantId,
          contactId: contact.id,
          channel: "Phone",
          enabled: true,
          consentCapturedAt: new Date(),
          consentCapturedById: salesUser.id,
        },
      ],
    })

    contacts.push(contact)
    console.log(`✓ Created contact ${i + 1}/20: ${fullName}`)
  }

  console.log(`\n✅ Successfully created ${contacts.length} contacts for Algave LLC!`)
}

seedContacts()
  .catch((error) => {
    console.error("❌ Seed failed", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
