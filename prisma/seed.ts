import { PrismaClient, RevenueScheduleStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function clearDatabase() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.importError.deleteMany(),
    prisma.importJob.deleteMany(),
    prisma.exportJob.deleteMany(),
    prisma.tablePreference.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.reconciliationItem.deleteMany(),
    prisma.reconciliation.deleteMany(),
    prisma.deposit.deleteMany(),
    prisma.revenueSchedule.deleteMany(),
    prisma.opportunityProduct.deleteMany(),
    prisma.opportunity.deleteMany(),
    prisma.contactPreference.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.accountAssignment.deleteMany(),
    prisma.accountNote.deleteMany(),
    prisma.groupMember.deleteMany(),
    prisma.group.deleteMany(),
    prisma.product.deleteMany(),
    prisma.account.deleteMany(),
    prisma.address.deleteMany(),
    prisma.industry.deleteMany(),
    prisma.accountType.deleteMany(),
    prisma.userSession.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.user.deleteMany(),
    prisma.fieldDefinition.deleteMany(),
    prisma.systemSetting.deleteMany(),
    prisma.tenant.deleteMany(),
  ])
}

async function seed() {
  await clearDatabase()

  console.log("Database cleared. Seeding base data...")

  const defaultPassword = "password123"
  const defaultPasswordHash = await bcrypt.hash(defaultPassword, 12)

  const tenant = await prisma.tenant.create({
    data: {
      name: "Commissable Demo Tenant",
      slug: "commissable-demo",
      planType: "Pilot",
    },
  })

  const roles = await prisma.$transaction([
    prisma.role.create({
      data: {
        tenantId: tenant.id,
        code: "ADMIN",
        name: "Administrator",
        description: "Full system control",
        scope: "Tenant",
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        tenantId: tenant.id,
        code: "SALES_MGMT",
        name: "Sales Management",
        description: "Manage all accounts and contacts",
        scope: "Tenant",
        isDefault: true,
      },
    }),
    prisma.role.create({
      data: {
        tenantId: tenant.id,
        code: "SALES_REP",
        name: "Salesperson",
        description: "Work assigned accounts",
        scope: "Tenant",
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        tenantId: tenant.id,
        code: "ACCOUNTING",
        name: "Accounting",
        description: "Finance and reconciliation access",
        scope: "Tenant",
        isDefault: false,
      },
    }),
  ])

  const permissions = await prisma.$transaction([
    // Accounts (granular)
    prisma.permission.create({ data: { code: "accounts.read", name: "Read Accounts", category: "Accounts" } }),
    prisma.permission.create({ data: { code: "accounts.create", name: "Create Accounts", category: "Accounts" } }),
    prisma.permission.create({ data: { code: "accounts.update", name: "Update Accounts", category: "Accounts" } }),
    prisma.permission.create({ data: { code: "accounts.delete", name: "Delete Accounts", category: "Accounts" } }),
    prisma.permission.create({ data: { code: "accounts.export", name: "Export Accounts", category: "Accounts" } }),
    prisma.permission.create({ data: { code: "accounts.bulk", name: "Bulk Account Actions", category: "Accounts" } }),
    prisma.permission.create({ data: { code: "accounts.reassign", name: "Reassign Accounts", category: "Accounts" } }),
    // Legacy/compat for existing guards
    prisma.permission.create({ data: { code: "accounts.manage", name: "Manage Accounts (legacy)", category: "Accounts" } }),

    // Contacts (granular)
    prisma.permission.create({ data: { code: "contacts.read", name: "Read Contacts", category: "Contacts" } }),
    prisma.permission.create({ data: { code: "contacts.create", name: "Create Contacts", category: "Contacts" } }),
    prisma.permission.create({ data: { code: "contacts.update", name: "Update Contacts", category: "Contacts" } }),
    prisma.permission.create({ data: { code: "contacts.delete", name: "Delete Contacts", category: "Contacts" } }),
    prisma.permission.create({ data: { code: "contacts.export", name: "Export Contacts", category: "Contacts" } }),
    // Legacy/compat for existing guards
    prisma.permission.create({ data: { code: "contacts.manage", name: "Manage Contacts (legacy)", category: "Contacts" } }),

    // Finance / Reconciliation
    prisma.permission.create({ data: { code: "finance.view", name: "View Finance", category: "Finance" } }),
    prisma.permission.create({ data: { code: "reconciliation.view", name: "View Reconciliation", category: "Finance" } }),
    prisma.permission.create({ data: { code: "reconciliation.manage", name: "Manage Reconciliation", category: "Finance" } }),
    prisma.permission.create({ data: { code: "revenue-schedules.manage", name: "Manage Revenue Schedules", category: "Finance" } }),

    // System / Settings
    prisma.permission.create({ data: { code: "tables.customize", name: "Customize Tables", category: "System" } }),
    prisma.permission.create({ data: { code: "system.settings.read", name: "Read System Settings", category: "System" } }),
    prisma.permission.create({ data: { code: "system.settings.write", name: "Write System Settings", category: "System" } }),

    // Admin permissions
    prisma.permission.create({ data: { code: "admin.roles.read", name: "Read Roles", category: "Admin" } }),
    prisma.permission.create({ data: { code: "admin.roles.create", name: "Create Roles", category: "Admin" } }),
    prisma.permission.create({ data: { code: "admin.roles.update", name: "Update Roles", category: "Admin" } }),
    prisma.permission.create({ data: { code: "admin.roles.delete", name: "Delete Roles", category: "Admin" } }),
    prisma.permission.create({ data: { code: "admin.permissions.read", name: "Read Permissions", category: "Admin" } }),
    prisma.permission.create({ data: { code: "admin.users.read", name: "Read Users", category: "Admin" } }),
    prisma.permission.create({ data: { code: "admin.users.create", name: "Create Users", category: "Admin" } }),
    prisma.permission.create({ data: { code: "admin.users.update", name: "Update Users", category: "Admin" } }),
    prisma.permission.create({ data: { code: "admin.users.delete", name: "Delete Users", category: "Admin" } }),
    prisma.permission.create({ data: { code: "admin.data_settings.manage", name: "Manage Data Settings", category: "Admin" } }),

    // Activities (granular)
    prisma.permission.create({ data: { code: "activities.read", name: "Read Activities", category: "Activities" } }),
    prisma.permission.create({ data: { code: "activities.create", name: "Create Activities", category: "Activities" } }),
    prisma.permission.create({ data: { code: "activities.update", name: "Update Activities", category: "Activities" } }),
    prisma.permission.create({ data: { code: "activities.delete", name: "Delete Activities", category: "Activities" } }),
    prisma.permission.create({ data: { code: "activities.export", name: "Export Activities", category: "Activities" } }),
    // Legacy/compat for existing guards
    prisma.permission.create({ data: { code: "activities.manage", name: "Manage Activities (legacy)", category: "Activities" } }),
  ])

  const [adminRole, salesMgmtRole, salesRepRole, accountingRole] = roles

  const grants = [
    {
      roleId: adminRole.id,
      codes: [
        // Accounts
        "accounts.read", "accounts.create", "accounts.update", "accounts.delete", "accounts.export", "accounts.bulk", "accounts.reassign", "accounts.manage",
        // Contacts
        "contacts.read", "contacts.create", "contacts.update", "contacts.delete", "contacts.export", "contacts.manage",
        // Finance/System
        "finance.view", "reconciliation.view", "reconciliation.manage", "revenue-schedules.manage", "tables.customize", "system.settings.read", "system.settings.write",
        // Activities
        "activities.read", "activities.create", "activities.update", "activities.delete", "activities.export", "activities.manage",
        // Admin
        "admin.roles.read", "admin.roles.create", "admin.roles.update", "admin.roles.delete",
        "admin.permissions.read",
        "admin.users.read", "admin.users.create", "admin.users.update", "admin.users.delete",
        "admin.data_settings.manage",
      ]
    },
    {
      roleId: salesMgmtRole.id,
      codes: [
        // Full control on accounts/contacts incl. export per spec
        "accounts.read", "accounts.create", "accounts.update", "accounts.delete", "accounts.export", "accounts.bulk", "accounts.reassign", "accounts.manage",
        "contacts.read", "contacts.create", "contacts.update", "contacts.delete", "contacts.export", "contacts.manage",
        // Activities
        "activities.read", "activities.create", "activities.update", "activities.delete", "activities.export", "activities.manage",
        "revenue-schedules.manage",
        "tables.customize"
      ]
    },
    {
      roleId: salesRepRole.id,
      codes: [
        // Limited - use manage for compatibility; granular read/create/update
        "accounts.read", "accounts.create", "accounts.update", "accounts.manage",
        "contacts.read", "contacts.create", "contacts.update", "contacts.manage",
        // Activities
        "activities.read", "activities.create", "activities.update", "activities.manage",
        "tables.customize"
      ]
    },
    {
      roleId: accountingRole.id,
      codes: [
        // Read-only Accounts/Contacts + Finance view and reconciliation
        "accounts.read",
        "contacts.read",
        "activities.read",
        "finance.view",
        "reconciliation.view",
        "reconciliation.manage",
        "tables.customize",
      ]
    },
  ]

  for (const grant of grants) {
    for (const code of grant.codes) {
      const permission = permissions.find((perm: any) => perm.code === code)
      if (!permission) continue
      await prisma.rolePermission.create({
        data: {
          tenantId: tenant.id,
          roleId: grant.roleId,
          permissionId: permission.id,
        },
      })
    }
  }

  const users = await prisma.$transaction([
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        roleId: adminRole.id,
        email: "admin@commissable.test",
        passwordHash: defaultPasswordHash,
        passwordChangedAt: new Date(),
        firstName: "Avery",
        lastName: "Admin",
        fullName: "Avery Admin",
        status: "Active",
        authProvider: "Password",
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        roleId: salesMgmtRole.id,
        email: "manager@commissable.test",
        passwordHash: defaultPasswordHash,
        passwordChangedAt: new Date(),
        firstName: "Morgan",
        lastName: "Manager",
        fullName: "Morgan Manager",
        status: "Active",
        authProvider: "Password",
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        roleId: salesRepRole.id,
        email: "sales@commissable.test",
        passwordHash: defaultPasswordHash,
        passwordChangedAt: new Date(),
        firstName: "Riley",
        lastName: "Sales",
        fullName: "Riley Sales",
        status: "Active",
        authProvider: "Password",
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        roleId: accountingRole.id,
        email: "finance@commissable.test",
        passwordHash: defaultPasswordHash,
        passwordChangedAt: new Date(),
        firstName: "Finley",
        lastName: "Finance",
        fullName: "Finley Finance",
        status: "Active",
        authProvider: "Password",
      },
    }),
  ])

  const [adminUser, managerUser, salesUser, financeUser] = users

  console.log(`Created demo users with default password: ${defaultPassword}`)

  const accountTypes = await prisma.$transaction([
    prisma.accountType.create({
      data: {
        tenantId: tenant.id,
        code: "CUSTOMER",
        name: "Customer",
        description: "Customer Account: Accounts that have successfully contracted with the House Agency.",
        isAssignableToContacts: true,
        isActive: true,
        isSystem: true,
        displayOrder: 10,
      },
    }),
    prisma.accountType.create({
      data: {
        tenantId: tenant.id,
        code: "DISTRIBUTOR",
        name: "Distributor",
        description: "Distributor Account: Companies that provide a central pathway to order from multiple vendors.",
        isAssignableToContacts: true,
        isActive: true,
        isSystem: true,
        displayOrder: 20,
      },
    }),
    prisma.accountType.create({
      data: {
        tenantId: tenant.id,
        code: "HOUSE_REP",
        name: "House",
        description: "House Rep Account: Employees working on behalf of the House Agency who earn profit or commission.",
        isAssignableToContacts: true,
        isActive: true,
        isSystem: true,
        displayOrder: 30,
      },
    }),
    prisma.accountType.create({
      data: {
        tenantId: tenant.id,
        code: "OTHER",
        name: "Other",
        description: "Other Account: For records that do not fit a defined account type.",
        isAssignableToContacts: true,
        isActive: true,
        isSystem: true,
        displayOrder: 40,
      },
    }),
    prisma.accountType.create({
      data: {
        tenantId: tenant.id,
        code: "PROSPECT",
        name: "Prospect",
        description: "Prospect Account: Accounts that have not yet transacted with the House Agency.",
        isAssignableToContacts: true,
        isActive: true,
        isSystem: true,
        displayOrder: 50,
      },
    }),
    prisma.accountType.create({
      data: {
        tenantId: tenant.id,
        code: "SUBAGENT",
        name: "Subagent",
        description: "Subagent Account: Independent partners (1099) that provide leads and services for a share of profits or commissions.",
        isAssignableToContacts: true,
        isActive: true,
        isSystem: true,
        displayOrder: 60,
      },
    }),
    prisma.accountType.create({
      data: {
        tenantId: tenant.id,
        code: "VENDOR",
        name: "Vendor",
        description: "Vendor Account: Organizations that manufacture goods or deliver services.",
        isAssignableToContacts: true,
        isActive: true,
        isSystem: true,
        displayOrder: 70,
      },
    }),
  ])

  const industries = await prisma.$transaction([
    prisma.industry.create({
      data: { tenantId: tenant.id, name: "Technology", isDefault: true, displayOrder: 1 },
    }),
    prisma.industry.create({
      data: { tenantId: tenant.id, name: "Manufacturing", isDefault: false, displayOrder: 2 },
    }),
  ])

  const [customerType, distributorType, houseRepType] = accountTypes
  const [techIndustry] = industries

  // Seed master data for product families
  await prisma.$transaction([
    prisma.productFamily.create({
      data: {
        tenantId: tenant.id,
        code: "AI_SERVICES",
        name: "AI Services",
        description: "AI-based services such as automation, assistants, and intelligent analytics.",
        isActive: true,
        isSystem: true,
        displayOrder: 10,
      },
    }),
    prisma.productFamily.create({
      data: {
        tenantId: tenant.id,
        code: "INTERNET_VOICE",
        name: "Internet & Voice Connectivity",
        description: "Core internet, voice, and connectivity services.",
        isActive: true,
        isSystem: true,
        displayOrder: 20,
      },
    }),
    prisma.productFamily.create({
      data: {
        tenantId: tenant.id,
        code: "CYBERSECURITY",
        name: "Cybersecurity Services",
        description: "Security offerings including threat protection and monitoring.",
        isActive: true,
        isSystem: true,
        displayOrder: 30,
      },
    }),
    prisma.productFamily.create({
      data: {
        tenantId: tenant.id,
        code: "DATA_PROTECTION",
        name: "Data Protection",
        description: "Backup, archiving, and data protection solutions.",
        isActive: true,
        isSystem: true,
        displayOrder: 40,
      },
    }),
    prisma.productFamily.create({
      data: {
        tenantId: tenant.id,
        code: "HARDWARE",
        name: "Hardware Products",
        description: "Physical devices, infrastructure, and related equipment.",
        isActive: true,
        isSystem: true,
        displayOrder: 50,
      },
    }),
    prisma.productFamily.create({
      data: {
        tenantId: tenant.id,
        code: "INSTALLATION",
        name: "Installation Services",
        description: "Implementation, installation, and turn-up services.",
        isActive: true,
        isSystem: true,
        displayOrder: 60,
      },
    }),
    prisma.productFamily.create({
      data: {
        tenantId: tenant.id,
        code: "MAINTENANCE",
        name: "Maintenance Products",
        description: "Maintenance contracts and support entitlements.",
        isActive: true,
        isSystem: true,
        displayOrder: 70,
      },
    }),
    prisma.productFamily.create({
      data: {
        tenantId: tenant.id,
        code: "SOFTWARE",
        name: "Software Products",
        description: "Software licenses, subscriptions, and SaaS products.",
        isActive: true,
        isSystem: true,
        displayOrder: 80,
      },
    }),
  ])

  // Seed master data for product subtypes (not yet wired to specific families)
  await prisma.$transaction([
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "BACKUP_SERVICES",
        name: "Backup Services",
        description: "Backup services for data protection and recovery.",
        isActive: true,
        isSystem: true,
        displayOrder: 10,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "CABLE",
        name: "Cable",
        description: "Cable-based connectivity services.",
        isActive: true,
        isSystem: true,
        displayOrder: 20,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "CCAAS",
        name: "CCaaS (Call Center as a Service)",
        description: "Hosted contact center and CCaaS offerings.",
        isActive: true,
        isSystem: true,
        displayOrder: 30,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "ETHERNET",
        name: "Ethernet",
        description: "Layer 2 ethernet transport services.",
        isActive: true,
        isSystem: true,
        displayOrder: 40,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "FIBER",
        name: "Fiber",
        description: "Fiber-based connectivity services.",
        isActive: true,
        isSystem: true,
        displayOrder: 50,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "MAINTENANCE_SERVICES",
        name: "Maintenance Services",
        description: "Service and maintenance engagements.",
        isActive: true,
        isSystem: true,
        displayOrder: 60,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "MANAGED_SERVICES",
        name: "Managed Services",
        description: "Managed services and ongoing support.",
        isActive: true,
        isSystem: true,
        displayOrder: 70,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "NETWORKING",
        name: "Networking",
        description: "Networking infrastructure and services.",
        isActive: true,
        isSystem: true,
        displayOrder: 80,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "POTS",
        name: "POTS (Plain Old Telephone Service)",
        description: "Traditional POTS voice lines.",
        isActive: true,
        isSystem: true,
        displayOrder: 90,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "SATELLITE",
        name: "Satellite",
        description: "Satellite connectivity services.",
        isActive: true,
        isSystem: true,
        displayOrder: 100,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "SERVERS_STORAGE",
        name: "Servers & Storage",
        description: "Server and storage infrastructure offerings.",
        isActive: true,
        isSystem: true,
        displayOrder: 110,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "UCAAS",
        name: "UCaaS (Unified Communications as a Service)",
        description: "Hosted UCaaS platforms and services.",
        isActive: true,
        isSystem: true,
        displayOrder: 120,
      },
    }),
    prisma.productSubtype.create({
      data: {
        tenantId: tenant.id,
        code: "WIFI",
        name: "WiFi",
        description: "Wireless networking and WiFi services.",
        isActive: true,
        isSystem: true,
        displayOrder: 130,
      },
    }),
  ])

  const shippingAddress = await prisma.address.create({
    data: {
      tenantId: tenant.id,
      line1: "123 Market Street",
      city: "Atlanta",
      state: "GA",
      postalCode: "30303",
      country: "USA",
    },
  })

  const billingAddress = await prisma.address.create({
    data: {
      tenantId: tenant.id,
      line1: "500 Finance Ave",
      city: "Atlanta",
      state: "GA",
      postalCode: "30308",
      country: "USA",
    },
  })

  // Parent agency account for system-level contacts (e.g., "No House Rep")
  const agencyAccount = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      accountTypeId: houseRepType.id,
      industryId: techIndustry.id,
      ownerId: managerUser.id,
      createdById: adminUser.id,
      updatedById: adminUser.id,
      shippingAddressId: shippingAddress.id,
      billingAddressId: billingAddress.id,
      accountNumber: "AGENCY-0001",
      accountName: "Agency Parent Account",
      accountLegalName: "Agency Parent Account",
      status: "Active",
      description: "Parent agency account used for system-level contacts such as the \"No House Rep\" dummy contact.",
    },
  })

  const account = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      accountTypeId: customerType.id,
      industryId: techIndustry.id,
      ownerId: managerUser.id,
      createdById: adminUser.id,
      updatedById: adminUser.id,
      shippingAddressId: shippingAddress.id,
      billingAddressId: billingAddress.id,
      accountNumber: "ACC-1001",
      accountName: "Algave LLC",
      accountLegalName: "Algave Holdings LLC",
      status: "Active",
      websiteUrl: "https://algave.example",
      supportEmail: "support@algave.example",
      phone: "404-555-0110",
      description: "Flagship enterprise customer",
    },
  })

  await prisma.accountAssignment.createMany({
    data: [
      {
        tenantId: tenant.id,
        accountId: account.id,
        userId: managerUser.id,
        assignmentRole: "PrimaryOwner",
        isPrimary: true,
        assignedById: adminUser.id,
      },
      {
        tenantId: tenant.id,
        accountId: account.id,
        userId: salesUser.id,
        assignmentRole: "SalesSupport",
        assignedById: managerUser.id,
      },
    ],
  })

  await prisma.accountNote.create({
    data: {
      tenantId: tenant.id,
      accountId: account.id,
      authorId: salesUser.id,
      note: "Kick-off call scheduled for next week.",
    },
  })

  // Create additional sample accounts from mock data
  const additionalAccounts = [
    {
      accountName: "Customer Account 1",
      accountLegalName: "Customer Account 1 LLC",
      accountType: "Customer",
      ownerId: managerUser.id,
      shippingState: "OR",
      shippingCity: "Bend",
      shippingZip: "234234",
      shippingStreet: "1 Main Street",
      phone: "555-0123",
      description: "Sample customer account"
    },
    {
      accountName: "Testing Account 1",
      accountLegalName: "Distributor Test Account",
      accountType: "Distributor",
      ownerId: salesUser.id,
      shippingState: "CA",
      shippingCity: "Rio Linda",
      shippingZip: "92242",
      shippingStreet: "23 ABC Street",
      phone: "555-0124",
      description: "Sample distributor account"
    },
    {
      accountName: "Vendor Account",
      accountLegalName: "Vendor Account LLC",
      accountType: "Vendor",
      ownerId: managerUser.id,
      shippingState: "NY",
      shippingCity: "Accord",
      shippingZip: "12404",
      shippingStreet: "65 UVW Street",
      phone: "555-0125",
      description: "Sample vendor account"
    },
    {
      accountName: "selva test account",
      accountLegalName: "test legal data",
      accountType: "Customer",
      ownerId: salesUser.id,
      shippingState: "TN",
      shippingCity: "trichy",
      shippingZip: "60252",
      shippingStreet: "1 nehru street",
      phone: "555-0126",
      description: "Sample test account"
    }
  ]

  for (const accountData of additionalAccounts) {
    const accountType = await prisma.accountType.findFirst({
      where: { tenantId: tenant.id, code: accountData.accountType.toUpperCase() }
    })

    if (accountType) {
      const additionalAccount = await prisma.account.create({
        data: {
          tenantId: tenant.id,
          accountTypeId: accountType.id,
          industryId: techIndustry.id,
          ownerId: accountData.ownerId,
          createdById: adminUser.id,
          updatedById: adminUser.id,
          accountName: accountData.accountName,
          accountLegalName: accountData.accountLegalName,
          status: "Active",
          phone: accountData.phone,
          description: accountData.description,
          shippingAddressId: shippingAddress.id, // Reuse the same address for simplicity
          billingAddressId: billingAddress.id
        }
      })

      // Create account assignments
      await prisma.accountAssignment.createMany({
        data: [
          {
            tenantId: tenant.id,
            accountId: additionalAccount.id,
            userId: accountData.ownerId,
            assignmentRole: "PrimaryOwner",
            isPrimary: true,
            assignedById: adminUser.id
          }
        ]
      })
    }
  }

  const contactAddress = await prisma.address.create({
    data: {
      tenantId: tenant.id,
      line1: "321 Market Street",
      city: "Atlanta",
      state: "GA",
      postalCode: "30303",
      country: "USA",
    },
  })

  const contact = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      accountId: account.id,
      accountTypeId: customerType.id,
      ownerId: salesUser.id,
      createdById: salesUser.id,
      updatedById: salesUser.id,
      mailingAddressId: contactAddress.id,
      firstName: "Jordan",
      lastName: "Cole",
      fullName: "Jordan Cole",
      jobTitle: "Director of IT",
      workPhone: "404-555-0198",
      emailAddress: "jordan.cole@algave.example",
      preferredContactMethod: "Email",
      isPrimary: true,
      isDecisionMaker: true,
      description: "Primary stakeholder for rollout",
    },
  })

  // "No House Rep" dummy contact associated with the agency parent account
  const noHouseRepContact = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      accountId: agencyAccount.id,
      accountTypeId: houseRepType.id,
      ownerId: managerUser.id,
      createdById: adminUser.id,
      updatedById: adminUser.id,
      firstName: "No House",
      lastName: "Rep",
      fullName: "No House Rep",
      preferredContactMethod: "Email",
      isPrimary: false,
      isDecisionMaker: false,
      description: "System dummy contact with 0% commission share when the House receives commissions and no individual rep is assigned.",
    },
  })

  await prisma.contactPreference.createMany({
    data: [
      {
        tenantId: tenant.id,
        contactId: contact.id,
        channel: "Email",
        enabled: true,
        consentCapturedAt: new Date(),
        consentCapturedById: salesUser.id,
      },
      {
        tenantId: tenant.id,
        contactId: contact.id,
        channel: "Phone",
        enabled: true,
        consentCapturedAt: new Date(),
        consentCapturedById: salesUser.id,
      },
    ],
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: tenant.id,
      accountId: account.id,
      ownerId: salesUser.id,
      createdById: salesUser.id,
      updatedById: salesUser.id,
      name: "Algave Cloud Migration",
      stage: "Proposal",
      status: "Open",
      type: "NewBusiness",
      leadSource: "Referral",
      amount: 125000,
      expectedCommission: 15000,
      probability: 65,
      estimatedCloseDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15),
      nextStep: "Finalize pricing with finance",
    },
  })

  const product = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      productCode: "PROD-VOIP",
      productNameHouse: "VoIP Service Bundle",
      productNameVendor: "Algave Voice Enterprise",
      description: "Unified communications package",
      revenueType: "MRC_ThirdParty",
      commissionPercent: 12.5,
      priceEach: 899,
      vendorAccountId: account.id,
      createdById: adminUser.id,
      updatedById: adminUser.id,
    },
  })

  const opportunityProduct = await prisma.opportunityProduct.create({
    data: {
      tenantId: tenant.id,
      opportunityId: opportunity.id,
      productId: product.id,
      quantity: 50,
      unitPrice: 899,
      expectedUsage: 5000,
      expectedRevenue: 44950,
      expectedCommission: 5618.75,
      revenueStartDate: new Date(),
    },
  })

  const revenueSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: tenant.id,
      opportunityId: opportunity.id,
      opportunityProductId: opportunityProduct.id,
      accountId: account.id,
      productId: product.id,
      scheduleNumber: "RS-10001",
      scheduleDate: new Date(),
      scheduleType: "Recurring",
      expectedUsage: 5000,
      expectedCommission: 5618.75,
      status: RevenueScheduleStatus.Unreconciled,
      createdById: financeUser.id,
      updatedById: financeUser.id,
    },
  })

  await prisma.reconciliation.create({
    data: {
      tenantId: tenant.id,
      accountId: account.id,
      month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      totalRevenue: 44950,
      totalCommissions: 5618.75,
      status: "Pending",
    },
  })

  // Seed sample deposits for Reconciliation list
  await prisma.deposit.createMany({
    data: [
      {
        tenantId: tenant.id,
        accountId: account.id,
        month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        totalRevenue: 2543.76,
        totalCommissions: 127.19,
        status: "Pending",
        reconciled: false,
        depositName: "2025-08 Telarus_Lingo_Deposit",
        paymentDate: new Date(new Date().getFullYear(), new Date().getMonth(), 23),
        paymentType: "ACH",
        totalItems: 10,
        totalReconciledItems: 5,
        totalUsage: 500,
        usageAllocated: 500,
        usageUnallocated: 0,
        commissionAllocated: 127.19,
        commissionUnallocated: 0,
        itemsReconciled: 5,
        itemsUnreconciled: 5,
        distributorAccountId: account.id,
        vendorAccountId: account.id,
        createdByUserId: financeUser.id,
      },
      {
        tenantId: tenant.id,
        accountId: account.id,
        month: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        totalRevenue: 1876.42,
        totalCommissions: 93.82,
        status: "Completed",
        reconciled: true,
        reconciledAt: new Date(),
        depositName: "2025-07 Telarus_Lingo_Deposit",
        paymentDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 20),
        paymentType: "Wire",
        totalItems: 8,
        totalReconciledItems: 8,
        totalUsage: 420,
        usageAllocated: 420,
        usageUnallocated: 0,
        commissionAllocated: 93.82,
        commissionUnallocated: 0,
        itemsReconciled: 8,
        itemsUnreconciled: 0,
        distributorAccountId: account.id,
        vendorAccountId: account.id,
        createdByUserId: financeUser.id,
      },
    ],
  })

  const teamGroup = await prisma.group.create({
    data: {
      tenantId: tenant.id,
      name: "Enterprise Accounts",
      groupType: "AccountGroup",
      visibility: "Shared",
      ownerId: managerUser.id,
      description: "Strategic enterprise customers",
    },
  })

  const advisoryGroup = await prisma.group.create({
    data: {
      tenantId: tenant.id,
      name: "Customer Success Council",
      groupType: "SalesTeam",
      visibility: "Public",
      ownerId: salesUser.id,
      description: "Customer-facing leads collaborating on renewals",
    },
  })

  await prisma.groupMember.createMany({
    data: [
      {
        tenantId: tenant.id,
        groupId: teamGroup.id,
        memberType: "Account",
        accountId: account.id,
        addedById: managerUser.id,
      },
      {
        tenantId: tenant.id,
        groupId: teamGroup.id,
        memberType: "Contact",
        contactId: contact.id,
        addedById: managerUser.id,
      },
      {
        tenantId: tenant.id,
        groupId: teamGroup.id,
        memberType: "User",
        userId: salesUser.id,
        addedById: managerUser.id,
      },
      {
        tenantId: tenant.id,
        groupId: advisoryGroup.id,
        memberType: "Account",
        accountId: account.id,
        addedById: managerUser.id,
      },
      {
        tenantId: tenant.id,
        groupId: advisoryGroup.id,
        memberType: "Contact",
        contactId: contact.id,
        addedById: managerUser.id,
      },
      {
        tenantId: tenant.id,
        groupId: advisoryGroup.id,
        memberType: "User",
        userId: managerUser.id,
        addedById: managerUser.id,
      },
    ],
    skipDuplicates: true,
  })

  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      accountId: account.id,
      contactId: contact.id,
      opportunityId: opportunity.id,
      creatorId: salesUser.id,
      assigneeId: salesUser.id,
      activityType: "Call",
      subject: "Discovery follow-up",
      description: "Discussed integration requirements and pricing tiers.",
      dueDate: new Date(),
      status: "Open",
      priority: "High",
    },
  })

  await prisma.ticket.create({
    data: {
      tenantId: tenant.id,
      accountId: account.id,
      opportunityId: opportunity.id,
      revenueScheduleId: revenueSchedule.id,
      contactId: contact.id,
      assignedToId: financeUser.id,
      createdById: managerUser.id,
      issue: "Billing address verification",
      status: "Open",
      priority: "Medium",
      severity: "Minor",
    },
  })

  await prisma.tablePreference.create({
    data: {
      tenantId: tenant.id,
      userId: salesUser.id,
      pageKey: "accounts:list",
      columnOrder: ["accountName", "accountType", "status", "owner"],
      columnWidths: { accountName: 280, accountType: 160, status: 120, owner: 180 },
      hiddenColumns: ["sicCode", "taxId"],
      sortState: { field: "accountName", direction: "asc" },
      filters: { status: ["Active"], ownerId: [salesUser.id] },
      viewMode: "Grid",
    },
  })

  await prisma.fieldDefinition.createMany({
    data: [
      {
        tenantId: tenant.id,
        module: "Accounts",
        fieldCode: "01.01.001",
        label: "Account Name",
        columnName: "accountName",
        dataType: "Text",
        inputType: "Text",
        isRequired: true,
        displayOrder: 1,
      },
      {
        tenantId: tenant.id,
        module: "Accounts",
        fieldCode: "01.01.002",
        label: "Account Type",
        columnName: "accountTypeId",
        dataType: "Enum",
        inputType: "Dropdown",
        isRequired: true,
        displayOrder: 2,
      },
      {
        tenantId: tenant.id,
        module: "Contacts",
        fieldCode: "02.01.001",
        label: "Full Name",
        columnName: "fullName",
        dataType: "Text",
        inputType: "Text",
        isRequired: true,
        displayOrder: 1,
      },
      {
        tenantId: tenant.id,
        module: "Contacts",
        fieldCode: "02.01.002",
        label: "Work Phone",
        columnName: "workPhone",
        dataType: "Text",
        inputType: "Phone",
        displayOrder: 2,
      },
      {
        tenantId: tenant.id,
        module: "Opportunities",
        fieldCode: "03.01.001",
        label: "Opportunity Name",
        columnName: "name",
        dataType: "Text",
        inputType: "Text",
        isRequired: true,
        displayOrder: 1,
      },
    ],
  })

  await prisma.systemSetting.createMany({
    data: [
      {
        tenantId: tenant.id,
        key: "accounting.copyProtection",
        value: { enabled: true },
        description: "Enforce copy protection for accounting role",
      },
      {
        tenantId: tenant.id,
        key: "ui.defaultTimezone",
        value: { timezone: "America/New_York" },
      },
      {
        tenantId: tenant.id,
        key: "revenueTypes.enabledCodes",
        value: [
          "NRC_PerItem",
          "NRC_Percent",
          "NRC_FlatFee",
          "NRC_Resale",
          "MRC_ThirdParty",
          "MRC_House",
        ],
        description: "List of revenue type codes that are enabled for selection.",
      },
    ],
  })

  console.log("Seed data created successfully!")
}

seed()
  .catch((error) => {
    console.error("? Seed failed", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })














