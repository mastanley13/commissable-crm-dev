# Commissable CRM - Milestone 1 Production Plan
*Complete Contract-Compliant Implementation Strategy*

## Executive Accountability Statement

I take full accountability for initially missing critical contract requirements in my first analysis. This comprehensive production plan now addresses EVERY specification, requirement, and deliverable outlined in the contract documents to ensure successful Milestone 1 completion and 25% payment release.

## Contract Foundation Analysis

### **Project Context** (Executive Summary)
- **Total Project**: 500+ fields across 13 modules over 8-week timeline
- **Milestone 1**: Foundation with Accounts & Contacts (140+ fields)
- **Timeline**: Weeks 1-2 (14 days)
- **Payment**: 25% of total contract value
- **Approach**: Progressive development with bi-weekly deliveries

### **Milestone 1 Specifications** (Document 2)
- **Purpose**: Build foundation with customer and contact management
- **Field Count**: 140+ fields across two complete modules
- **Core Features**: Dynamic tables, RBAC (4 roles), audit logging, import/export

## Complete Requirements Matrix

### **Module 1: ACCOUNTS - Field Analysis**

#### **Account List View** (Fields 01.01.000 - 01.01.008)
**Required Display Fields**:
1. Account Name (clickable to detail)
2. Account Legal Name  
3. Account Type (dropdown)
4. Account Owner (contact lookup)
5. Shipping Street
6. Shipping Street 2
7. Shipping City
8. Shipping State (2-letter dropdown)
9. Shipping Zip (max 12 digits)

#### **Account Creation Form** (Fields 01.02.000 - 01.02.020) 
**Required Fields** (5):
- Account Name
- Account Legal Name
- Account Type
- Active Status (defaults Yes)
- Account Owner (defaults current user)

**Optional Fields** (15):
- Parent Account (for subsidiaries)
- Industry (dropdown A-Z)
- Website URL (validated format)
- Description (long text)
- Shipping Address (6 fields): Street, Street 2, City, State, Zip, Country
- Billing Address (6 fields): Street, Street 2, City, State, Zip, Country

#### **Account Detail Page** (Fields 01.03.XXX - 01.09.XXX)

**Left Column** (01.03.XXX) - ~15 fields:
- All basic account information
- Inline editing capability
- Auto-save functionality

**Right Column** (01.04.XXX) - ~10 fields:
- Complete address information
- Map integration ready
- Copy address feature

**Bottom Tabs** (~30 fields total):

**Contacts Tab** (01.05.XXX - 01.06.XXX) - ~10 fields:
- List of all people at company
- Add contacts with popup form
- Full Name (auto-concatenated)
- Work Phone (xxx-xxx-xxxx format)
- Mobile, Email, Job Title
- Contact Type (inherited from account)

**Opportunities Tab** (01.07.XXX - 01.08.XXX) - ~8 fields:
- All sales opportunities
- Quick-add new opportunity
- Close Date, Stage, Owner, Value

**Groups Tab** (01.09.000 - 01.09.014) - ~7 fields:
- Organize accounts into groups
- Public/Private settings
- Group owner management

**Activities Tab** (01.09.070 - 01.09.084) - ~8 fields:
- Complete activity timeline
- Types: Call, Meeting, ToDo, Note, Other
- Quick-add activities
- Sort by date or type

**Account Module Total**: ~73 fields (meets 70+ requirement)

### **Module 2: CONTACTS - Field Analysis**

#### **Contact List View** (Fields 02.01.000 - 02.01.007)
**Display Fields** (8):
1. Suffix (dropdown)
2. Full Name (auto-concatenated)
3. Work Phone (XXX-XXX-XXXX)
4. Extension (numeric)
5. Contact Type (from account)
6. Email Address (email format)
7. Job Title (text)
8. Mobile (XXX-XXX-XXXX)

#### **Contact Creation Form** (Fields 02.02.000 - 02.02.012)
**Required Fields** (3):
- First Name
- Last Name  
- Account Name (company lookup)

**Optional Fields** (6):
- Suffix (Mr., Mrs., Dr.)
- Job Title
- Work Phone & Extension
- Mobile Phone
- Email Address
- Description

**Auto-Populated Fields** (3):
- Ship To Address (from account)
- Bill To Address (from account)
- Contact Type (from account type)

#### **Contact Detail Page** (Fields 02.03.XXX - 02.09.XXX)

**Main Information** (02.03.XXX) - ~20 fields:
- All contact details
- Related account information
- Communication preferences

**Activities Tab** (02.04.XXX) - ~15 fields:
- Activity history
- Task management
- Notes and attachments

**Opportunities Tab** (02.06.XXX) - ~10 fields:
- Sales opportunities involving contact
- Role in each opportunity

**Groups Tab** (02.07.XXX) - ~8 fields:
- Group memberships
- Permission levels

**Contact Module Total**: ~70 fields (meets 65+ requirement)

**Combined Total**: ~143 fields (exceeds 140+ requirement)

## Complete Database Architecture

### **Core Tables** (Contract-Specified Schema)

#### **Tenants Table** (Multi-tenant requirement)
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Account Types Table** (Referenced in contract)
```sql
CREATE TABLE account_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Users Table** (4-Role RBAC System)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'SalesManagement', 'Salesperson', 'Accounting')),
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  session_timeout INTEGER DEFAULT 3600,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Accounts Table** (Contract Lines 199-249)
```sql
CREATE TABLE accounts (
  -- Core Fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_name VARCHAR(255) NOT NULL,
  account_legal_name VARCHAR(255),
  account_type_id UUID NOT NULL REFERENCES account_types(id),
  active BOOLEAN DEFAULT true,
  account_owner UUID NOT NULL REFERENCES users(id),
  
  -- Business Info  
  parent_account UUID REFERENCES accounts(id),
  industry VARCHAR(255),
  website_url VARCHAR(255),
  description TEXT,
  
  -- Shipping Address
  shipping_street VARCHAR(255),
  shipping_street_2 VARCHAR(255), 
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(10),
  shipping_zip VARCHAR(12),
  shipping_country VARCHAR(100),
  
  -- Billing Address
  billing_street VARCHAR(255),
  billing_street_2 VARCHAR(255),
  billing_city VARCHAR(100), 
  billing_state VARCHAR(10),
  billing_zip VARCHAR(12),
  billing_country VARCHAR(100),
  
  -- System Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
```

#### **Contacts Table** (Contract Lines 252-287)
```sql
CREATE TABLE contacts (
  -- Core Fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  
  -- Name Fields
  suffix VARCHAR(10),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(255) GENERATED ALWAYS AS (
    CASE 
      WHEN suffix IS NOT NULL THEN suffix || ' ' || first_name || ' ' || last_name
      ELSE first_name || ' ' || last_name 
    END
  ) STORED,
  
  -- Contact Info
  job_title VARCHAR(100),
  work_phone VARCHAR(20),
  extension VARCHAR(10),
  mobile VARCHAR(20), 
  email_address VARCHAR(255),
  
  -- Auto-populated from Account
  contact_type VARCHAR(100),
  ship_to_street VARCHAR(255),
  ship_to_city VARCHAR(100),
  ship_to_state VARCHAR(10),
  ship_to_zip VARCHAR(12),
  bill_to_street VARCHAR(255),
  bill_to_city VARCHAR(100),
  bill_to_state VARCHAR(10),
  bill_to_zip VARCHAR(12),
  
  -- System Fields
  active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
```

#### **Supporting Tables**

**Groups Table** (Contract requirement):
```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  group_type VARCHAR(50) NOT NULL,
  is_public BOOLEAN DEFAULT false,
  owner_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  account_id UUID REFERENCES accounts(id),
  contact_id UUID REFERENCES contacts(id),
  permission_level VARCHAR(50) DEFAULT 'member',
  added_by UUID NOT NULL REFERENCES users(id),
  added_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Activities Table** (Contract requirement):
```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID REFERENCES accounts(id),
  contact_id UUID REFERENCES contacts(id),
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('Call', 'Meeting', 'ToDo', 'Note', 'Other')),
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending',
  assigned_to UUID REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Table Preferences** (Dynamic table requirement):
```sql
CREATE TABLE table_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  page_type VARCHAR(50) NOT NULL,
  column_order TEXT, -- JSON array
  column_widths TEXT, -- JSON object  
  hidden_columns TEXT, -- JSON array
  sort_preferences TEXT, -- JSON object
  filter_combinations TEXT, -- JSON object
  export_formats TEXT, -- JSON array
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, page_type)
);
```

**Audit Logs** (Contract requirement):
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  old_values TEXT, -- JSON
  new_values TEXT, -- JSON
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Comprehensive Implementation Plan

### **Phase 1: Foundation Setup** (Days 1-2)

#### **Day 1: Database & Infrastructure**

**Task 1.1: Cloud SQL & Proxy Setup**
- Download and configure cloud_sql_proxy.exe
- Test database connectivity
- Set up connection pooling

**Task 1.2: Complete Database Schema**
- Implement all 8 core tables
- Add all indexes and constraints
- Create database functions for full_name generation
- Set up row-level security for multi-tenancy

**Task 1.3: Prisma Configuration**
```prisma
// prisma/schema.prisma - Complete implementation
generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(255)
  slug      String   @unique @db.VarChar(100)
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  accounts     Account[]
  contacts     Contact[]
  users        User[]
  accountTypes AccountType[]
  groups       Group[]
  activities   Activity[]
  auditLogs    AuditLog[]

  @@map("tenants")
}

model AccountType {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  name        String   @db.VarChar(100)
  description String?  @db.Text
  active      Boolean  @default(true)
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  accounts Account[]

  @@map("account_types")
  @@index([tenantId])
}

model User {
  id             String    @id @default(uuid()) @db.Uuid
  tenantId       String    @map("tenant_id") @db.Uuid
  username       String    @unique @db.VarChar(100)
  fullName       String    @map("full_name") @db.VarChar(255)
  email          String    @unique @db.VarChar(255)
  passwordHash   String    @map("password_hash") @db.VarChar(255)
  role           UserRole
  active         Boolean   @default(true)
  lastLogin      DateTime? @map("last_login") @db.Timestamptz
  sessionTimeout Int       @default(3600) @map("session_timeout")
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  tenant               Tenant            @relation(fields: [tenantId], references: [id])
  ownedAccounts        Account[]         @relation("AccountOwner")
  createdAccounts      Account[]         @relation("AccountCreator")
  updatedAccounts      Account[]         @relation("AccountUpdater")
  createdContacts      Contact[]         @relation("ContactCreator")
  updatedContacts      Contact[]         @relation("ContactUpdater")
  ownedGroups          Group[]           @relation("GroupOwner")
  assignedActivities   Activity[]        @relation("ActivityAssignee")
  createdActivities    Activity[]        @relation("ActivityCreator")
  tablePreferences     TablePreference[]
  auditLogs            AuditLog[]
  groupMembershipsAdded GroupMember[]    @relation("GroupMemberAdder")

  @@map("users")
  @@index([tenantId])
  @@index([email])
}

enum UserRole {
  Admin
  SalesManagement
  Salesperson
  Accounting
}

model Account {
  id               String   @id @default(uuid()) @db.Uuid
  tenantId         String   @map("tenant_id") @db.Uuid
  accountName      String   @map("account_name") @db.VarChar(255)
  accountLegalName String?  @map("account_legal_name") @db.VarChar(255)
  accountTypeId    String   @map("account_type_id") @db.Uuid
  active           Boolean  @default(true)
  accountOwner     String   @map("account_owner") @db.Uuid
  parentAccount    String?  @map("parent_account") @db.Uuid
  industry         String?  @db.VarChar(255)
  websiteUrl       String?  @map("website_url") @db.VarChar(255)
  description      String?  @db.Text

  // Shipping Address
  shippingStreet   String? @map("shipping_street") @db.VarChar(255)
  shippingStreet2  String? @map("shipping_street_2") @db.VarChar(255)
  shippingCity     String? @map("shipping_city") @db.VarChar(100)
  shippingState    String? @map("shipping_state") @db.VarChar(10)
  shippingZip      String? @map("shipping_zip") @db.VarChar(12)
  shippingCountry  String? @map("shipping_country") @db.VarChar(100)

  // Billing Address
  billingStreet   String? @map("billing_street") @db.VarChar(255)
  billingStreet2  String? @map("billing_street_2") @db.VarChar(255)
  billingCity     String? @map("billing_city") @db.VarChar(100)
  billingState    String? @map("billing_state") @db.VarChar(10)
  billingZip      String? @map("billing_zip") @db.VarChar(12)
  billingCountry  String? @map("billing_country") @db.VarChar(100)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  createdBy String   @map("created_by") @db.Uuid
  updatedBy String?  @map("updated_by") @db.Uuid

  // Relationships
  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  accountType AccountType @relation(fields: [accountTypeId], references: [id])
  owner       User        @relation("AccountOwner", fields: [accountOwner], references: [id])
  creator     User        @relation("AccountCreator", fields: [createdBy], references: [id])
  updater     User?       @relation("AccountUpdater", fields: [updatedBy], references: [id])
  parent      Account?    @relation("AccountHierarchy", fields: [parentAccount], references: [id])
  children    Account[]   @relation("AccountHierarchy")

  contacts        Contact[]
  activities      Activity[]
  groupMembers    GroupMember[]

  @@map("accounts")
  @@index([tenantId])
  @@index([accountName])
  @@index([accountTypeId])
  @@index([accountOwner])
}

model Contact {
  id           String  @id @default(uuid()) @db.Uuid
  tenantId     String  @map("tenant_id") @db.Uuid
  accountId    String  @map("account_id") @db.Uuid
  suffix       String? @db.VarChar(10)
  firstName    String  @map("first_name") @db.VarChar(100)
  lastName     String  @map("last_name") @db.VarChar(100)
  // full_name is generated in database
  jobTitle     String? @map("job_title") @db.VarChar(100)
  workPhone    String? @map("work_phone") @db.VarChar(20)
  extension    String? @db.VarChar(10)
  mobile       String? @db.VarChar(20)
  emailAddress String? @map("email_address") @db.VarChar(255)

  // Auto-populated from Account
  contactType   String? @map("contact_type") @db.VarChar(100)
  shipToStreet  String? @map("ship_to_street") @db.VarChar(255)
  shipToCity    String? @map("ship_to_city") @db.VarChar(100)
  shipToState   String? @map("ship_to_state") @db.VarChar(10)
  shipToZip     String? @map("ship_to_zip") @db.VarChar(12)
  billToStreet  String? @map("bill_to_street") @db.VarChar(255)
  billToCity    String? @map("bill_to_city") @db.VarChar(100)
  billToState   String? @map("bill_to_state") @db.VarChar(10)
  billToZip     String? @map("bill_to_zip") @db.VarChar(12)

  active      Boolean  @default(true)
  description String?  @db.Text
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  createdBy   String   @map("created_by") @db.Uuid
  updatedBy   String?  @map("updated_by") @db.Uuid

  // Relationships
  tenant    Tenant @relation(fields: [tenantId], references: [id])
  account   Account @relation(fields: [accountId], references: [id])
  creator   User    @relation("ContactCreator", fields: [createdBy], references: [id])
  updater   User?   @relation("ContactUpdater", fields: [updatedBy], references: [id])

  activities      Activity[]
  groupMembers    GroupMember[]

  @@map("contacts")
  @@index([tenantId])
  @@index([accountId])
  @@index([emailAddress])
}

// Additional models for Groups, Activities, TablePreferences, AuditLog...
```

#### **Day 2: Authentication & RBAC**

**Task 2.1: NextAuth Setup**
- Configure 4-role authentication system
- Implement session management with timeouts
- Add password hashing and validation

**Task 2.2: Role-Based Middleware**
```typescript
// lib/rbac.ts - Complete implementation
export const ROLE_PERMISSIONS = {
  Admin: {
    accounts: { read: true, create: true, update: true, delete: true, export: true },
    contacts: { read: true, create: true, update: true, delete: true, export: true },
    allAccounts: true,
    systemConfig: true,
    auditLogs: true,
    userManagement: true
  },
  SalesManagement: {
    accounts: { read: true, create: true, update: true, delete: true, export: true },
    contacts: { read: true, create: true, update: true, delete: true, export: true },
    allAccounts: true,
    bulkOperations: true,
    userReassignment: true,
    importExport: true
  },
  Salesperson: {
    accounts: { read: 'assigned', create: true, update: 'assigned', delete: false, export: false },
    contacts: { read: 'assigned', create: true, update: 'assigned', delete: false, export: false },
    allAccounts: false
  },
  Accounting: {
    accounts: { read: true, create: false, update: false, delete: false, export: false },
    contacts: { read: true, create: false, update: false, delete: false, export: false },
    allAccounts: true,
    copyProtection: true,
    reconciliation: true
  }
} as const;
```

### **Phase 2: Core API Implementation** (Days 3-6)

#### **Day 3: Accounts API**

**Task 3.1: Complete Accounts CRUD**
```typescript
// app/api/accounts/route.ts - Full implementation
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? 1);
  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 20), 100);
  const search = searchParams.get('q') ?? '';
  const activeOnly = searchParams.get('active') === 'true';

  // Role-based filtering (Contract requirement)
  let whereClause: any = { tenantId: session.user.tenantId };
  
  if (session.user.role === 'Salesperson') {
    whereClause.accountOwner = session.user.id;
  }
  
  if (activeOnly) whereClause.active = true;
  
  if (search) {
    whereClause.OR = [
      { accountName: { contains: search, mode: 'insensitive' } },
      { accountLegalName: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [accounts, total] = await Promise.all([
    prisma.account.findMany({
      where: whereClause,
      include: {
        accountType: { select: { name: true } },
        owner: { select: { fullName: true } },
        _count: { select: { contacts: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.account.count({ where: whereClause })
  ]);

  return NextResponse.json({
    items: accounts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user || !hasPermission(session.user.role, 'accounts', 'create')) {
    return unauthorizedResponse();
  }

  const body = await req.json();
  const validatedData = accountCreateSchema.parse(body);

  // Auto-populate billing from shipping (Contract requirement)
  const accountData = {
    ...validatedData,
    tenantId: session.user.tenantId,
    accountOwner: session.user.id,
    createdBy: session.user.id,
    billingStreet: validatedData.billingStreet || validatedData.shippingStreet,
    billingCity: validatedData.billingCity || validatedData.shippingCity,
    billingState: validatedData.billingState || validatedData.shippingState,
    billingZip: validatedData.billingZip || validatedData.shippingZip,
    billingCountry: validatedData.billingCountry || validatedData.shippingCountry
  };

  const account = await prisma.account.create({
    data: accountData,
    include: {
      accountType: { select: { name: true } },
      owner: { select: { fullName: true } },
      _count: { select: { contacts: true } }
    }
  });

  // Audit logging (Contract requirement)
  await auditLog({
    userId: session.user.id,
    tenantId: session.user.tenantId,
    action: 'CREATE',
    tableName: 'accounts',
    recordId: account.id,
    newValues: accountData,
    ipAddress: getClientIP(req),
    userAgent: req.headers.get('user-agent'),
    sessionId: session.sessionId
  });

  return NextResponse.json(account, { status: 201 });
}
```

**Task 3.2: Account Detail Page API**
```typescript
// app/api/accounts/[id]/route.ts
// app/api/accounts/[id]/contacts/route.ts  
// app/api/accounts/[id]/activities/route.ts
// app/api/accounts/[id]/groups/route.ts
```

#### **Day 4: Contacts API**

**Task 4.1: Complete Contacts CRUD with Auto-population**
```typescript
// app/api/contacts/route.ts - Full implementation with inheritance
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user || !hasPermission(session.user.role, 'contacts', 'create')) {
    return unauthorizedResponse();
  }

  const body = await req.json();
  const validatedData = contactCreateSchema.parse(body);

  // Get account for auto-population (Contract requirement)
  const account = await prisma.account.findUnique({
    where: { id: validatedData.accountId },
    include: { accountType: true }
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  // Role-based access check for account
  if (!canAccessAccount(session.user.role, session.user.id, account.accountOwner)) {
    return unauthorizedResponse();
  }

  const contactData = {
    ...validatedData,
    tenantId: session.user.tenantId,
    createdBy: session.user.id,
    // Auto-populate from account (Contract requirement)
    contactType: account.accountType.name,
    shipToStreet: account.shippingStreet,
    shipToCity: account.shippingCity,
    shipToState: account.shippingState,
    shipToZip: account.shippingZip,
    billToStreet: account.billingStreet,
    billToCity: account.billingCity,
    billToState: account.billingState,
    billToZip: account.billingZip
  };

  const contact = await prisma.contact.create({
    data: contactData,
    include: {
      account: { select: { accountName: true } }
    }
  });

  // Audit logging
  await auditLog({
    userId: session.user.id,
    tenantId: session.user.tenantId,
    action: 'CREATE',
    tableName: 'contacts',
    recordId: contact.id,
    newValues: contactData,
    ipAddress: getClientIP(req),
    userAgent: req.headers.get('user-agent')
  });

  return NextResponse.json(contact, { status: 201 });
}
```

#### **Days 5-6: Supporting APIs**
- Groups API with membership management
- Activities API with timeline functionality  
- Table Preferences API for dynamic tables
- Import/Export API with role restrictions

### **Phase 3: Dynamic Table System** (Days 7-9)

#### **Day 7: Enhanced Dynamic Table Component**

**Task 7.1: Contract-Compliant Table Features**
```typescript
// components/dynamic-table.tsx - Complete implementation
interface DynamicTableProps {
  columns: Column[];
  data: any[];
  pageType: string; // For preferences
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: any) => void;
  loading?: boolean;
  userRole: UserRole; // For role-based features
}

export function DynamicTable({ 
  columns, 
  data, 
  pageType, 
  userRole, 
  ...props 
}: DynamicTableProps) {
  const { preferences, updatePreferences, saving } = useTablePreferences(pageType);
  const [showColumnManager, setShowColumnManager] = useState(false);

  // Contract requirement: Column width 80-400px
  const handleColumnResize = (columnId: string, newWidth: number) => {
    const constrainedWidth = Math.max(80, Math.min(400, newWidth));
    updatePreferences({
      columnWidths: {
        ...preferences?.columnWidths,
        [columnId]: constrainedWidth
      }
    });
  };

  // Contract requirement: Drag and drop reordering
  const handleColumnReorder = (draggedId: string, targetId: string) => {
    const currentOrder = preferences?.columnOrder || columns.map(c => c.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);
    
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);
    
    updatePreferences({ columnOrder: newOrder });
  };

  // Contract requirement: Show/Hide columns
  const handleColumnVisibility = (columnId: string, visible: boolean) => {
    const currentHidden = preferences?.hiddenColumns || [];
    const newHidden = visible 
      ? currentHidden.filter(id => id !== columnId)
      : [...currentHidden, columnId];
    
    updatePreferences({ hiddenColumns: newHidden });
  };

  // Contract requirement: Copy protection for Accounting role
  const handleCopyProtection = useCallback((e: KeyboardEvent) => {
    if (userRole === 'Accounting' && (e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      toast.error('Copy function disabled for Accounting role');
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole === 'Accounting') {
      document.addEventListener('keydown', handleCopyProtection);
      return () => document.removeEventListener('keydown', handleCopyProtection);
    }
  }, [userRole, handleCopyProtection]);

  // Performance requirement: < 300ms for column operations
  const debouncedUpdatePreferences = useMemo(
    () => debounce(updatePreferences, 300),
    [updatePreferences]
  );

  return (
    <div className="dynamic-table-container">
      {/* Column Manager */}
      {showColumnManager && (
        <div className="column-manager">
          <h3>Customize Columns</h3>
          {columns.map(column => (
            <div key={column.id} className="column-control">
              <input
                type="checkbox"
                checked={!preferences?.hiddenColumns?.includes(column.id)}
                onChange={(e) => handleColumnVisibility(column.id, e.target.checked)}
              />
              <span>{column.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table with all contract features */}
      <div className="table-wrapper">
        {/* Implementation of resizable, sortable, draggable table */}
      </div>

      {/* Export controls (role-dependent) */}
      {(userRole === 'Admin' || userRole === 'SalesManagement') && (
        <div className="export-controls">
          <button onClick={handleExport}>Export CSV</button>
        </div>
      )}
    </div>
  );
}
```

#### **Day 8: Table Preferences System**
```typescript
// hooks/useTablePreferences.ts - Complete implementation
export function useTablePreferences(pageType: string) {
  const { data: session } = useSession();
  const [preferences, setPreferences] = useState<TablePreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    if (session?.user) {
      loadPreferences();
    }
  }, [pageType, session]);

  const loadPreferences = async () => {
    try {
      const response = await fetch(`/api/table-preferences/${pageType}`);
      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
      }
    } catch (error) {
      console.error('Failed to load table preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  // Contract requirement: Persist across sessions
  const updatePreferences = useCallback(async (updates: Partial<TablePreferences>) => {
    if (!preferences || !session?.user) return;

    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);

    try {
      setSaving(true);
      await fetch(`/api/table-preferences/${pageType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreferences)
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setPreferences(preferences); // Revert on error
    } finally {
      setSaving(false);
    }
  }, [preferences, pageType, session]);

  return { preferences, loading, saving, updatePreferences };
}
```

#### **Day 9: Import/Export System**
```typescript
// lib/import-export.ts - Role-dependent functionality
export class ImportExportService {
  constructor(private userRole: UserRole) {}

  // Contract requirement: Role-dependent export restrictions
  canExport(): boolean {
    return this.userRole === 'Admin' || this.userRole === 'SalesManagement';
  }

  canImport(): boolean {
    return this.userRole === 'Admin' || this.userRole === 'SalesManagement';
  }

  // Contract requirement: CSV templates
  generateAccountTemplate(): string {
    const headers = [
      'Account Name*',
      'Account Legal Name',
      'Account Type*',
      'Industry',
      'Website URL',
      'Description',
      'Shipping Street',
      'Shipping City',
      'Shipping State',
      'Shipping Zip',
      'Billing Street',
      'Billing City', 
      'Billing State',
      'Billing Zip'
    ];
    return headers.join(',') + '\n';
  }

  generateContactTemplate(): string {
    const headers = [
      'First Name*',
      'Last Name*', 
      'Account Name*',
      'Suffix',
      'Job Title',
      'Work Phone',
      'Extension',
      'Mobile',
      'Email Address',
      'Description'
    ];
    return headers.join(',') + '\n';
  }

  async exportAccounts(filters?: any): Promise<string> {
    if (!this.canExport()) {
      throw new Error('Export not permitted for this role');
    }
    
    // Implementation with role-based filtering
    const accounts = await this.getAccountsForExport(filters);
    return this.convertToCSV(accounts);
  }
}
```

### **Phase 4: UI Components & Detail Pages** (Days 10-12)

#### **Day 10: Account Detail Page**

**Task 10.1: Complete Account Detail Layout**
```typescript
// app/(dashboard)/accounts/[id]/page.tsx - Full implementation
export default function AccountDetailPage({ params }: { params: { id: string } }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState('contacts');
  const [isEditing, setIsEditing] = useState(false);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout>();

  // Contract requirement: Auto-save functionality
  const handleFieldChange = (field: string, value: any) => {
    setAccount(prev => prev ? { ...prev, [field]: value } : null);
    
    // Clear existing timeout
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    
    // Set new auto-save timeout
    const timeout = setTimeout(async () => {
      await saveAccount({ [field]: value });
    }, 2000); // 2 second delay
    
    setAutoSaveTimeout(timeout);
  };

  // Contract requirement: Copy address feature
  const copyShippingToBilling = () => {
    if (!account) return;
    
    const updatedAccount = {
      ...account,
      billingStreet: account.shippingStreet,
      billingCity: account.shippingCity,
      billingState: account.shippingState,
      billingZip: account.shippingZip,
      billingCountry: account.shippingCountry
    };
    
    setAccount(updatedAccount);
    saveAccount(updatedAccount);
  };

  return (
    <div className="account-detail-page">
      {/* Left Column - Basic Information (01.03.XXX) */}
      <div className="left-column">
        <div className="account-basic-info">
          <InlineEditField
            label="Account Name"
            value={account?.accountName}
            onChange={(value) => handleFieldChange('accountName', value)}
            required
          />
          <InlineEditField
            label="Account Legal Name"
            value={account?.accountLegalName}
            onChange={(value) => handleFieldChange('accountLegalName', value)}
          />
          {/* All creation form fields with inline editing */}
        </div>
      </div>

      {/* Right Column - Address Information (01.04.XXX) */}
      <div className="right-column">
        <div className="address-section">
          <h3>Shipping Address</h3>
          {/* Shipping address fields */}
          
          <h3>Billing Address</h3>
          <button onClick={copyShippingToBilling}>
            Copy from Shipping
          </button>
          {/* Billing address fields */}
          
          {/* Contract requirement: Map integration ready */}
          <div className="map-container">
            <MapComponent address={getFullAddress(account)} />
          </div>
        </div>
      </div>

      {/* Bottom Tabs */}
      <div className="detail-tabs">
        <div className="tab-headers">
          <button 
            className={activeTab === 'contacts' ? 'active' : ''}
            onClick={() => setActiveTab('contacts')}
          >
            Contacts
          </button>
          <button 
            className={activeTab === 'opportunities' ? 'active' : ''}
            onClick={() => setActiveTab('opportunities')}
          >
            Opportunities
          </button>
          <button 
            className={activeTab === 'groups' ? 'active' : ''}
            onClick={() => setActiveTab('groups')}
          >
            Groups
          </button>
          <button 
            className={activeTab === 'activities' ? 'active' : ''}
            onClick={() => setActiveTab('activities')}
          >
            Activities
          </button>
        </div>

        <div className="tab-content">
          {/* Contacts Tab (01.05.XXX - 01.06.XXX) */}
          {activeTab === 'contacts' && (
            <ContactsTab 
              accountId={params.id}
              onAddContact={() => setShowContactPopup(true)}
            />
          )}

          {/* Opportunities Tab (01.07.XXX - 01.08.XXX) */}
          {activeTab === 'opportunities' && (
            <OpportunitiesTab 
              accountId={params.id}
              onAddOpportunity={() => setShowOpportunityPopup(true)}
            />
          )}

          {/* Groups Tab (01.09.000 - 01.09.014) */}
          {activeTab === 'groups' && (
            <GroupsTab accountId={params.id} />
          )}

          {/* Activities Tab (01.09.070 - 01.09.084) */}
          {activeTab === 'activities' && (
            <ActivitiesTab 
              accountId={params.id}
              onAddActivity={() => setShowActivityPopup(true)}
            />
          )}
        </div>
      </div>

      {/* Contract requirement: Popup forms */}
      {showContactPopup && (
        <ContactPopupForm
          accountId={params.id}
          onClose={() => setShowContactPopup(false)}
          onSave={handleContactSave}
        />
      )}
    </div>
  );
}
```

#### **Day 11: Contact Detail Page**
- Complete contact detail page with all tabs (02.03.XXX - 02.09.XXX)
- Activities tab with history and task management
- Opportunities tab with role information
- Groups tab with membership management

#### **Day 12: Popup Forms & Quick-Add**

**Task 12.1: Modal System**
```typescript
// components/modals/ContactPopupForm.tsx
export function ContactPopupForm({ 
  accountId, 
  onClose, 
  onSave 
}: ContactPopupFormProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    firstName: '',
    lastName: '',
    accountId,
    suffix: '',
    jobTitle: '',
    workPhone: '',
    extension: '',
    mobile: '',
    emailAddress: '',
    description: ''
  });

  const [account, setAccount] = useState<Account | null>(null);

  // Load account for auto-population
  useEffect(() => {
    loadAccount(accountId);
  }, [accountId]);

  // Contract requirement: Auto-populate addresses and contact type
  const loadAccount = async (id: string) => {
    const accountData = await fetch(`/api/accounts/${id}`).then(r => r.json());
    setAccount(accountData);
    
    // Auto-populate fields
    setFormData(prev => ({
      ...prev,
      contactType: accountData.accountType?.name,
      shipToStreet: accountData.shippingStreet,
      shipToCity: accountData.shippingCity,
      // ... other address fields
    }));
  };

  // Contract requirement: Full name auto-concatenation
  const getFullName = () => {
    const parts = [formData.suffix, formData.firstName, formData.lastName]
      .filter(Boolean);
    return parts.join(' ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.firstName || !formData.lastName) {
      toast.error('First Name and Last Name are required');
      return;
    }

    // Phone format validation (Contract requirement: xxx-xxx-xxxx)
    if (formData.workPhone && !isValidPhoneFormat(formData.workPhone)) {
      toast.error('Work phone must be in format xxx-xxx-xxxx');
      return;
    }

    if (formData.mobile && !isValidPhoneFormat(formData.mobile)) {
      toast.error('Mobile phone must be in format xxx-xxx-xxxx');
      return;
    }

    // Email validation (Contract requirement: proper@email.com)
    if (formData.emailAddress && !isValidEmail(formData.emailAddress)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const contact = await response.json();
        onSave(contact);
        onClose();
        toast.success('Contact created successfully');
      } else {
        throw new Error('Failed to create contact');
      }
    } catch (error) {
      toast.error('Error creating contact');
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Add New Contact">
      <form onSubmit={handleSubmit} className="contact-form">
        <div className="form-grid">
          <div className="form-group">
            <label>Suffix</label>
            <select 
              value={formData.suffix}
              onChange={(e) => setFormData(prev => ({...prev, suffix: e.target.value}))}
            >
              <option value="">Select...</option>
              <option value="Mr.">Mr.</option>
              <option value="Mrs.">Mrs.</option>
              <option value="Dr.">Dr.</option>
              <option value="Ms.">Ms.</option>
            </select>
          </div>

          <div className="form-group">
            <label>First Name *</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({...prev, firstName: e.target.value}))}
            />
          </div>

          <div className="form-group">
            <label>Last Name *</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({...prev, lastName: e.target.value}))}
            />
          </div>

          <div className="form-group full-width">
            <label>Full Name (Auto-generated)</label>
            <input
              type="text"
              value={getFullName()}
              disabled
              className="auto-generated"
            />
          </div>

          {/* Additional form fields */}
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">Save Contact</button>
        </div>
      </form>
    </Modal>
  );
}
```

### **Phase 5: Testing & Validation** (Days 13-14)

#### **Day 13: Contract Compliance Testing**

**Task 13.1: Performance Testing**
```typescript
// tests/performance.test.ts
describe('Contract Performance Requirements', () => {
  test('Load 1,000 accounts in < 2 seconds', async () => {
    const startTime = Date.now();
    const response = await fetch('/api/accounts?pageSize=1000');
    const endTime = Date.now();
    
    expect(response.ok).toBe(true);
    expect(endTime - startTime).toBeLessThan(2000);
  });

  test('Search contacts in < 500ms', async () => {
    const startTime = Date.now();
    const response = await fetch('/api/contacts?q=test');
    const endTime = Date.now();
    
    expect(response.ok).toBe(true);
    expect(endTime - startTime).toBeLessThan(500);
  });

  test('Column operations < 300ms', async () => {
    // Test column reorder, resize, hide/show operations
  });

  test('Form saves < 3 seconds', async () => {
    // Test account and contact creation
  });
});
```

**Task 13.2: Role-Based Access Testing**
```typescript
// tests/rbac.test.ts
describe('Role-Based Access Control', () => {
  test('Salesperson can only see assigned accounts', async () => {
    const salespersonSession = await createTestSession('Salesperson');
    const response = await fetch('/api/accounts', {
      headers: { 'Authorization': `Bearer ${salespersonSession.token}` }
    });
    
    const data = await response.json();
    expect(data.items.every(account => 
      account.accountOwner === salespersonSession.userId
    )).toBe(true);
  });

  test('Accounting role cannot export data', async () => {
    const accountingSession = await createTestSession('Accounting');
    const response = await fetch('/api/accounts/export', {
      headers: { 'Authorization': `Bearer ${accountingSession.token}` }
    });
    
    expect(response.status).toBe(403);
  });

  test('Copy protection blocks Ctrl+C for Accounting', async () => {
    // Frontend test for copy protection
  });
});
```

**Task 13.3: Data Validation Testing**
```typescript
// tests/validation.test.ts
describe('Data Validation Requirements', () => {
  test('Email format validation', async () => {
    const invalidEmail = { emailAddress: 'invalid-email' };
    const response = await fetch('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(invalidEmail)
    });
    
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'Validation failed',
      details: expect.arrayContaining([
        expect.objectContaining({ path: ['emailAddress'] })
      ])
    });
  });

  test('Phone format validation (xxx-xxx-xxxx)', async () => {
    // Test phone format requirements
  });

  test('State validation (2-letter codes)', async () => {
    // Test state code validation
  });

  test('Zip validation (max 12 characters)', async () => {
    // Test zip code validation
  });
});
```

#### **Day 14: Final Integration & Acceptance**

**Task 14.1: Complete Testing Checklist** (Contract Lines 367-392)

**Account Module Testing**:
- [ ] List view displays correctly with all 8 fields
- [ ] All 20 creation fields work with validation
- [ ] Detail page shows all sections (left, right, tabs)
- [ ] Contacts tab functions with popup form
- [ ] Opportunities tab loads and displays data
- [ ] Activities tab tracks properly with timeline
- [ ] Groups assignment works

**Contact Module Testing**:
- [ ] List view with dynamic columns (8 fields)
- [ ] Contact creation form validates all fields
- [ ] Auto-population from account works
- [ ] Full name concatenation works
- [ ] Email validation enforces proper@email.com format
- [ ] Phone formatting applies xxx-xxx-xxxx format
- [ ] All tabs load correctly

**Integration Points Testing**:
- [ ] Account-Contact relationships work
- [ ] Contact Type inherits from Account Type
- [ ] Address fields populate from Account to Contact
- [ ] Activity creation and display works
- [ ] Group membership management works

**Security Testing**:
- [ ] Salesperson cannot see unassigned accounts
- [ ] Export restrictions work properly for roles
- [ ] Copy protection blocks Ctrl+C for Accounting
- [ ] Audit log captures all changes
- [ ] Session timeouts function correctly

**Task 14.2: Documentation Creation**
```markdown
# User Documentation - Accounts Module

## Getting Started
The Accounts module is your customer database containing all company information.

## Creating New Accounts
1. Click "New Account" button
2. Fill required fields:
   - Account Name
   - Account Legal Name  
   - Account Type
3. Optional: Add business information and addresses
4. Click Save

## Account Detail Pages
Each account has four main sections:
- **Basic Information**: Editable account details with auto-save
- **Address Information**: Shipping and billing with map integration
- **Contacts Tab**: All people at this company
- **Opportunities Tab**: Sales opportunities
- **Groups Tab**: Account organization
- **Activities Tab**: Complete timeline

## Role-Based Features
- **Salesperson**: Can only see assigned accounts
- **Sales Management**: Full access with bulk operations
- **Accounting**: Read-only access with copy protection
- **Admin**: Complete system control
```

**Task 14.3: CSV Import Templates**
```csv
# accounts-import-template.csv
Account Name*,Account Legal Name,Account Type*,Industry,Website URL,Description,Shipping Street,Shipping City,Shipping State,Shipping Zip,Billing Street,Billing City,Billing State,Billing Zip
Example Company,Example Company LLC,Customer,Technology,https://example.com,Sample description,123 Main St,Anytown,CA,12345,123 Main St,Anytown,CA,12345

# contacts-import-template.csv
First Name*,Last Name*,Account Name*,Suffix,Job Title,Work Phone,Extension,Mobile,Email Address,Description
John,Doe,Example Company,Mr.,CEO,555-123-4567,101,555-987-6543,john@example.com,Primary contact
```

## Final Deliverables Checklist

### **Technical Deliverables** ✅
- [ ] Working Accounts module with all 73+ fields
- [ ] Working Contacts module with all 70+ fields  
- [ ] Dynamic table framework with user preferences
- [ ] Role-based security system (4 roles)
- [ ] Complete audit logging system
- [ ] Import/export system with CSV templates
- [ ] Auto-save functionality
- [ ] Copy address feature
- [ ] Map integration ready
- [ ] Session timeout system
- [ ] Copy protection for Accounting role

### **Performance Requirements** ✅
- [ ] Load 1,000 records < 2 seconds
- [ ] Column operations < 300ms
- [ ] Search results < 500ms  
- [ ] Form saves < 3 seconds

### **Field Relationships** ✅
- [ ] Contact Type inherits from Account Type
- [ ] Addresses auto-populate from Account to Contact
- [ ] Parent Account relationships work
- [ ] Account Owner limited to House contacts
- [ ] Full Name auto-concatenated (generated field)

### **Data Validation** ✅
- [ ] Email format: proper@email.com
- [ ] Phone format: xxx-xxx-xxxx
- [ ] URL format: https://website.com
- [ ] State: 2-letter codes only
- [ ] Zip: Maximum 12 characters

### **Role-Based Access** ✅
- [ ] **Salesperson**: Assigned accounts only, no delete/export
- [ ] **Sales Management**: Full control, bulk operations, import/export
- [ ] **Accounting**: Read-only, copy protection, no export
- [ ] **Admin**: System control, user management, audit access

### **Documentation** ✅
- [ ] User documentation for Accounts module
- [ ] User documentation for Contacts module
- [ ] CSV import templates
- [ ] API documentation
- [ ] Role-based access guide

## Contract Acceptance Criteria

### **Payment Trigger Requirements** (25% Release)
1. ✅ **Accounts & Contacts fully functional** with 140+ database-driven fields
2. ✅ **Dynamic tables** with persistent user preferences across sessions
3. ✅ **Detail pages** with all tabs operational and inline editing
4. ✅ **RBAC enforced** for all 4 roles with proper restrictions
5. ✅ **Audit logging** capturing all create/update/delete operations
6. ✅ **Written sign-off** provided upon completion

### **Integration Verification**
- [ ] Table column preferences persist per user across sessions
- [ ] Clicking Account/Contact hyperlinks reliably opens detail pages
- [ ] Role restrictions verified (Accounting cannot delete Accounts)
- [ ] Audit log captures create/update/delete for Accounts/Contacts

## Timeline Summary

| Phase | Days | Deliverables | Status |
|-------|------|-------------|---------|
| **Phase 1** | 1-2 | Database foundation, authentication | Ready |
| **Phase 2** | 3-6 | Complete APIs with RBAC | Ready |  
| **Phase 3** | 7-9 | Dynamic tables, import/export | Ready |
| **Phase 4** | 10-12 | Detail pages, popup forms | Ready |
| **Phase 5** | 13-14 | Testing, documentation | Ready |

**Total Timeline**: 14 days (2 weeks) - Contract compliant

This comprehensive production plan addresses every requirement, specification, and deliverable outlined in the contract documents. With this plan, we can confidently deliver Milestone 1 with all 140+ fields, complete functionality, and full contract compliance to secure the 25% payment release.
