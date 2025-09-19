import { PrismaClient } from "@prisma/client"
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
  ])

  const [adminRole, salesMgmtRole, salesRepRole, accountingRole] = roles

  const grants = [
    {
      roleId: adminRole.id,
      codes: [
        // Accounts
        "accounts.read", "accounts.create", "accounts.update", "accounts.delete", "accounts.export", "accounts.manage",
        // Contacts
        "contacts.read", "contacts.create", "contacts.update", "contacts.delete", "contacts.export", "contacts.manage",
        // Finance/System
        "finance.view", "reconciliation.view", "tables.customize", "system.settings.read", "system.settings.write",
        // Admin
        "admin.roles.read", "admin.roles.create", "admin.roles.update", "admin.roles.delete",
        "admin.permissions.read",
        "admin.users.read", "admin.users.create", "admin.users.update", "admin.users.delete",
      ]
    },
    {
      roleId: salesMgmtRole.id,
      codes: [
        // Full control on accounts/contacts incl. export per spec
        "accounts.read", "accounts.create", "accounts.update", "accounts.delete", "accounts.export", "accounts.manage",
        "contacts.read", "contacts.create", "contacts.update", "contacts.delete", "contacts.export", "contacts.manage",
        "tables.customize"
      ]
    },
    {
      roleId: salesRepRole.id,
      codes: [
        // Limited - use manage for compatibility; granular read/create/update
        "accounts.read", "accounts.create", "accounts.update", "accounts.manage",
        "contacts.read", "contacts.create", "contacts.update", "contacts.manage",
        "tables.customize"
      ]
    },
    {
      roleId: accountingRole.id,
      codes: [
        // Read-only Accounts/Contacts + Finance view and reconciliation
        "accounts.read", "contacts.read", "finance.view", "reconciliation.view", "tables.customize"
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
        description: "Direct customers",
        displayOrder: 1,
      },
    }),
    prisma.accountType.create({
      data: {
        tenantId: tenant.id,
        code: "HOUSE",
        name: "House",
        description: "House accounts",
        displayOrder: 2,
      },
    }),
    prisma.accountType.create({
      data: {
        tenantId: tenant.id,
        code: "VENDOR",
        name: "Vendor",
        description: "Vendors and suppliers",
        displayOrder: 3,
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

  const [customerType] = accountTypes
  const [techIndustry] = industries

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
      revenueType: "MRC_PerItem",
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
      status: "Projected",
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
        memberType: "User",
        userId: salesUser.id,
        addedById: managerUser.id,
      },
    ],
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
      status: "Scheduled",
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














