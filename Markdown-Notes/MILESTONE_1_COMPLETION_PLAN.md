# Milestone 1 Completion Plan - Commissable CRM
*Contract-Compliant Implementation of Core Foundation Specifications*

## Executive Summary

This document provides the complete implementation roadmap for **Milestone 1 (Weeks 1-2)** of the Commissable CRM project, as defined in the Core Foundation Specifications. Milestone 1 delivers **140+ fields across two modules** (Accounts: 70+ fields, Contacts: 65+ fields) with dynamic table framework, role-based access control, and complete audit logging.

**Contract Value**: 25% of total contract value  
**Timeline**: 2 weeks  
**Deliverables**: Accounts Module, Contacts Module, Dynamic Tables, RBAC, Audit Logging  
**Acceptance Criteria**: Per vendor proposal specifications with written sign-off required

## Contract Requirements Analysis

### **Milestone 1 Specifications Summary**
- **Purpose**: Build foundation with customer and contact management
- **Field Count**: 140+ fields across two modules
- **Timeline**: Weeks 1-2 of 8-week project
- **Payment Trigger**: 25% upon completion with written sign-off

### **Required Modules**

#### **Module 1: ACCOUNTS (Fields 01.XX.XXX - 70+ fields)**
- **Account List View** (01.01.000 - 01.01.008): Main customer list with dynamic columns
- **Account Creation** (01.02.000 - 01.02.020): 20+ fields including required/optional data
- **Account Detail Page** (01.03.XXX - 01.09.XXX): Complete account information with tabs
  - Left Column: Basic information with inline editing
  - Right Column: Address information with map integration
  - Contacts Tab: Related contacts with popup creation
  - Opportunities Tab: Sales opportunities
  - Groups Tab: Account organization
  - Activities Tab: Complete timeline

#### **Module 2: CONTACTS (Fields 02.XX.XXX - 65+ fields)**
- **Contact List View** (02.01.000 - 02.01.007): All contacts across accounts
- **Contact Creation** (02.02.000 - 02.02.012): Required/optional fields with auto-population
- **Contact Detail Page** (02.03.XXX - 02.09.XXX): Complete contact information with tabs
  - Main Information: Contact details and account relationship
  - Activities Tab: History and task management
  - Opportunities Tab: Sales involvement
  - Groups Tab: Membership management

### **Required Core Features**

#### **Dynamic Table System** (Contract Requirement)
- **Column Management**: Show/Hide checkboxes, drag-drop reordering, resize (80-400px)
- **User Preferences**: Per-user column settings, sort preferences, filter combinations
- **Performance**: Load 1,000 records < 2 seconds, column operations < 300ms

#### **Role-Based Access Control (4 Roles)**
1. **Salesperson**: View/edit assigned accounts only, no delete/export
2. **Sales Management**: Full control, bulk operations, import/export
3. **Accounting**: Read-only access, no export, copy protection
4. **Admin**: System control, user management, full access

#### **Audit Logging** (Contract Requirement)
- Capture all create/update/delete operations
- Track user actions across all modules
- Required for payment release

### **Current Implementation Status**

#### ✅ **Completed Components**
- **Frontend Structure**: Next.js 14 App Router with all page components
- **UI Framework**: Complete with `DynamicTable`, `ListHeader`, `Sidebar`, `Topbar`
- **Mock Data**: Comprehensive test data matching contract specifications
- **Environment**: `.env` configured with `DATABASE_URL`
- **Documentation**: Contract specifications and implementation guides

#### ❌ **Missing Contract Requirements**

##### **Critical Blockers**
- **Database Schema**: No implementation of contract-specified table structure
- **API Layer**: No backend endpoints for CRUD operations
- **Authentication**: No role-based access control implementation
- **Audit System**: No logging framework
- **Cloud SQL Connection**: Proxy not configured

##### **Specific Contract Gaps**
- **Field Validation**: Email format, phone format (xxx-xxx-xxxx), URL validation
- **Data Relationships**: Contact Type inheritance, address auto-population
- **Performance Requirements**: Load times, search speeds not tested
- **Export/Import**: Role-dependent capabilities not implemented

## Contract-Compliant Implementation Plan

### **Phase 1: Database Foundation** 
*Priority: Critical | Timeline: Days 1-3*

#### Task 1.1: Contract-Specified Database Schema
**Objective**: Implement exact database structure from contract specifications

**Implementation Steps**:
1. **Update Prisma Schema** with contract-specified structure:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Contract-specified Account Table (Lines 199-249)
model Account {
  // Core Fields
  id                String   @id @default(uuid()) @db.Uuid
  tenantId          String   @map("tenant_id") @db.Uuid
  accountName       String   @map("account_name") @db.VarChar(255)
  accountLegalName  String?  @map("account_legal_name") @db.VarChar(255)
  accountTypeId     String   @map("account_type_id") @db.Uuid
  active            Boolean  @default(true)
  accountOwner      String   @map("account_owner") @db.Uuid
  
  // Business Info
  parentAccount     String?  @map("parent_account") @db.Uuid
  industry          String?  @db.VarChar(255)
  websiteUrl        String?  @map("website_url") @db.VarChar(255)
  description       String?  @db.Text
  
  // Shipping Address (Contract Required)
  shippingStreet    String?  @map("shipping_street") @db.VarChar(255)
  shippingStreet2   String?  @map("shipping_street_2") @db.VarChar(255)
  shippingCity      String?  @map("shipping_city") @db.VarChar(100)
  shippingState     String?  @map("shipping_state") @db.VarChar(10)
  shippingZip       String?  @map("shipping_zip") @db.VarChar(12)
  shippingCountry   String?  @map("shipping_country") @db.VarChar(100)
  
  // Billing Address (Contract Required)
  billingStreet     String?  @map("billing_street") @db.VarChar(255)
  billingStreet2    String?  @map("billing_street_2") @db.VarChar(255)
  billingCity       String?  @map("billing_city") @db.VarChar(100)
  billingState      String?  @map("billing_state") @db.VarChar(10)
  billingZip        String?  @map("billing_zip") @db.VarChar(12)
  billingCountry    String?  @map("billing_country") @db.VarChar(100)
  
  // System Fields
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  createdBy         String   @map("created_by") @db.Uuid
  updatedBy         String?  @map("updated_by") @db.Uuid
  
  // Relationships
  contacts          Contact[]
  owner             User     @relation("AccountOwner", fields: [accountOwner], references: [id])
  creator           User     @relation("AccountCreator", fields: [createdBy], references: [id])
  updater           User?    @relation("AccountUpdater", fields: [updatedBy], references: [id])
  
  @@map("accounts")
  @@index([accountName])
  @@index([accountTypeId])
  @@index([tenantId])
}

// Contract-specified Contact Table (Lines 252-287)
model Contact {
  // Core Fields
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  accountId    String   @map("account_id") @db.Uuid
  
  // Name Fields (Contract specifies auto-concatenation)
  suffix       String?  @db.VarChar(10)
  firstName    String   @map("first_name") @db.VarChar(100)
  lastName     String   @map("last_name") @db.VarChar(100)
  fullName     String   @map("full_name") @db.VarChar(255) // Generated field
  
  // Contact Info
  jobTitle     String?  @map("job_title") @db.VarChar(100)
  workPhone    String?  @map("work_phone") @db.VarChar(20)
  extension    String?  @db.VarChar(10)
  mobile       String?  @db.VarChar(20)
  emailAddress String?  @map("email_address") @db.VarChar(255)
  
  // System Fields
  active       Boolean  @default(true)
  description  String?  @db.Text
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  
  // Relationships
  account      Account  @relation(fields: [accountId], references: [id])
  
  @@map("contacts")
  @@index([accountId])
  @@index([fullName])
  @@index([emailAddress])
}

// User model for RBAC (Contract specifies 4 roles)
model User {
  id                String    @id @default(uuid()) @db.Uuid
  tenantId          String    @map("tenant_id") @db.Uuid
  username          String    @unique @db.VarChar(100)
  fullName          String    @map("full_name") @db.VarChar(255)
  email             String    @unique @db.VarChar(255)
  passwordHash      String    @map("password_hash") @db.VarChar(255)
  role              UserRole  @default(Salesperson)
  active            Boolean   @default(true)
  lastLogin         DateTime? @map("last_login") @db.Timestamptz
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  
  // Relationships for audit trail
  ownedAccounts     Account[] @relation("AccountOwner")
  createdAccounts   Account[] @relation("AccountCreator")
  updatedAccounts   Account[] @relation("AccountUpdater")
  tablePreferences  TablePreference[]
  auditLogs         AuditLog[]
  
  @@map("users")
  @@index([email])
  @@index([tenantId])
}

// Contract requires 4 specific roles
enum UserRole {
  Admin
  SalesManagement  @map("Sales Management")
  Salesperson
  Accounting
}

// Table Preferences (Contract requirement for persistent user settings)
model TablePreference {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  pageType      String   @map("page_type") @db.VarChar(50)
  columnOrder   String   @map("column_order") @db.Text // JSON array
  columnWidths  String   @map("column_widths") @db.Text // JSON object
  hiddenColumns String?  @map("hidden_columns") @db.Text // JSON array
  sortSettings  String?  @map("sort_settings") @db.Text // JSON object
  filterSettings String? @map("filter_settings") @db.Text // JSON object
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, pageType])
  @@map("table_preferences")
}

// Audit Logging (Contract requirement)
model AuditLog {
  id          String    @id @default(uuid()) @db.Uuid
  tenantId    String    @map("tenant_id") @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  action      String    @db.VarChar(50) // CREATE, UPDATE, DELETE
  tableName   String    @map("table_name") @db.VarChar(100)
  recordId    String    @map("record_id") @db.Uuid
  oldValues   String?   @map("old_values") @db.Text // JSON
  newValues   String?   @map("new_values") @db.Text // JSON
  ipAddress   String?   @map("ip_address") @db.VarChar(45)
  userAgent   String?   @map("user_agent") @db.Text
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  
  user User @relation(fields: [userId], references: [id])
  
  @@map("audit_logs")
  @@index([tableName])
  @@index([recordId])
  @@index([userId])
  @@index([createdAt])
}
```

2. **Database Connection Setup**
   ```typescript
   // lib/db.ts
   import { PrismaClient } from '../generated/prisma'
   
   const globalForPrisma = globalThis as unknown as {
     prisma: PrismaClient | undefined
   }
   
   export const prisma = globalForPrisma.prisma ?? new PrismaClient({
     log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
   })
   
   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
   ```

3. **Cloud SQL Proxy Setup**
   ```bash
   # Download Windows binary
   curl -o cloud_sql_proxy.exe https://dl.google.com/cloudsql/cloud_sql_proxy.windows.amd64
   
   # Start proxy with your instance details
   .\cloud_sql_proxy.exe -instances=PROJECT:REGION:INSTANCE=tcp:5432
   ```

**Success Criteria**: 
- Database schema matches contract specifications exactly
- All 140+ fields implemented across both modules
- Cloud SQL connection established
- Migration runs successfully

#### Task 1.2: Contract Validation & Migration
**Objective**: Ensure database implementation meets contract acceptance criteria

**Implementation Steps**:
1. **Run Database Migration**
   ```bash
   npx prisma migrate dev --name milestone_1_foundation
   npx prisma generate
   ```

2. **Create Contract-Compliant Seed Data**
   ```typescript
   // prisma/seed.ts
   import { PrismaClient } from '../generated/prisma'
   import { accountsData, contactsData } from '../lib/mock-data'
   
   const prisma = new PrismaClient()
   
   async function main() {
     console.log('🌱 Seeding Milestone 1 data...')
     
     // Create tenant (multi-tenant requirement)
     const tenant = await prisma.tenant.create({
       data: {
         name: 'Commissable',
         slug: 'commissable'
       }
     })
     
     // Create admin user (required for account ownership)
     const adminUser = await prisma.user.create({
       data: {
         tenantId: tenant.id,
         username: 'admin',
         fullName: 'System Administrator',
         email: 'admin@commissable.com',
         passwordHash: 'hashed_password', // Implement proper hashing
         role: 'Admin'
       }
     })
     
     // Seed accounts with contract-specified fields
     for (const accountData of accountsData) {
       const account = await prisma.account.create({
         data: {
           tenantId: tenant.id,
           accountName: accountData.accountName,
           accountLegalName: accountData.accountLegalName,
           accountTypeId: 'customer-type-id', // Create account types
           accountOwner: adminUser.id,
           createdBy: adminUser.id,
           // Address fields as specified in contract
           shippingStreet: accountData.shippingStreet,
           shippingCity: accountData.shippingCity,
           shippingState: accountData.shippingState,
           shippingZip: accountData.shippingZip,
           // Auto-populate billing from shipping (contract requirement)
           billingStreet: accountData.shippingStreet,
           billingCity: accountData.shippingCity,
           billingState: accountData.shippingState,
           billingZip: accountData.shippingZip,
         }
       })
       
       // Seed contacts with auto-concatenated full names
       const relatedContacts = contactsData.filter(c => 
         c.accountName === accountData.accountName
       )
       
       for (const contactData of relatedContacts) {
         await prisma.contact.create({
           data: {
             tenantId: tenant.id,
             accountId: account.id,
             suffix: contactData.suffix,
             firstName: contactData.fullName.split(' ')[0],
             lastName: contactData.fullName.split(' ').slice(1).join(' '),
             fullName: contactData.fullName, // Contract requires auto-concatenation
             jobTitle: contactData.jobTitle,
             workPhone: contactData.workPhone,
             extension: contactData.extension,
             mobile: contactData.mobile,
             emailAddress: contactData.emailAddress,
           }
         })
       }
     }
     
     console.log('✅ Milestone 1 seed data complete')
   }
   ```

3. **Validation Testing**
   ```typescript
   // scripts/validate-contract-compliance.ts
   import { prisma } from '../lib/db'
   
   async function validateMilestone1() {
     console.log('🔍 Validating Milestone 1 contract compliance...')
     
     // Test 1: Verify field count (140+ fields)
     const accountFields = Object.keys(prisma.account.fields).length
     const contactFields = Object.keys(prisma.contact.fields).length
     console.log(`Account fields: ${accountFields}, Contact fields: ${contactFields}`)
     
     // Test 2: Verify required relationships
     const accountWithContacts = await prisma.account.findFirst({
       include: { contacts: true }
     })
     console.log(`Account-Contact relationship: ${accountWithContacts?.contacts.length} contacts`)
     
     // Test 3: Performance requirements (< 2 seconds for 1,000 records)
     const startTime = Date.now()
     const accounts = await prisma.account.findMany({ take: 1000 })
     const loadTime = Date.now() - startTime
     console.log(`Load time for 1,000 accounts: ${loadTime}ms (Required: < 2000ms)`)
     
     console.log('✅ Contract validation complete')
   }
   ```

**Success Criteria**:
- All 140+ fields accessible via Prisma client
- Seed data populates successfully
- Performance requirements met
- Contract field relationships working

### **Phase 2: Role-Based Access Control** 
*Priority: Critical | Timeline: Days 4-6*

#### Task 2.1: Authentication System Implementation
**Objective**: Implement 4-tier role system as specified in contract

**Implementation Steps**:
1. **Install Authentication Dependencies**
   ```bash
   npm install next-auth @auth/prisma-adapter bcryptjs jsonwebtoken
   npm install -D @types/bcryptjs @types/jsonwebtoken
   ```

2. **NextAuth Configuration** (Contract-compliant roles)
   ```typescript
   // app/api/auth/[...nextauth]/route.ts
   import NextAuth from 'next-auth'
   import CredentialsProvider from 'next-auth/providers/credentials'
   import { PrismaAdapter } from '@auth/prisma-adapter'
   import { prisma } from '@/lib/db'
   import bcrypt from 'bcryptjs'
   
   const handler = NextAuth({
     adapter: PrismaAdapter(prisma),
     providers: [
       CredentialsProvider({
         name: 'credentials',
         credentials: {
           username: { label: 'Username', type: 'text' },
           password: { label: 'Password', type: 'password' }
         },
         async authorize(credentials) {
           if (!credentials?.username || !credentials?.password) {
             return null
           }
   
           const user = await prisma.user.findUnique({
             where: { username: credentials.username }
           })
   
           if (!user || !user.active) {
             return null
           }
   
           const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
           if (!isValid) {
             return null
           }
   
           // Update last login (contract audit requirement)
           await prisma.user.update({
             where: { id: user.id },
             data: { lastLogin: new Date() }
           })
   
           return {
             id: user.id,
             name: user.fullName,
             email: user.email,
             role: user.role
           }
         }
       })
     ],
     session: { strategy: 'jwt' },
     callbacks: {
       async jwt({ token, user }) {
         if (user) {
           token.role = user.role
           token.tenantId = user.tenantId
         }
         return token
       },
       async session({ session, token }) {
         if (token) {
           session.user.id = token.sub
           session.user.role = token.role
           session.user.tenantId = token.tenantId
         }
         return session
       }
     }
   })
   
   export { handler as GET, handler as POST }
   ```

3. **Role-Based Middleware** (Contract access controls)
   ```typescript
   // lib/rbac.ts
   import { UserRole } from '../generated/prisma'
   
   export const rolePermissions = {
     Admin: {
       accounts: { read: true, create: true, update: true, delete: true, export: true },
       contacts: { read: true, create: true, update: true, delete: true, export: true },
       allAccounts: true,
       systemConfig: true,
       auditLogs: true
     },
     SalesManagement: {
       accounts: { read: true, create: true, update: true, delete: true, export: true },
       contacts: { read: true, create: true, update: true, delete: true, export: true },
       allAccounts: true,
       bulkOperations: true,
       userReassignment: true
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
       copyProtection: true
     }
   }
   
   export function hasPermission(role: UserRole, resource: string, action: string): boolean {
     const permissions = rolePermissions[role]
     return permissions?.[resource]?.[action] === true
   }
   
   export function canAccessAccount(role: UserRole, userId: string, accountOwnerId: string): boolean {
     if (role === 'Admin' || role === 'SalesManagement' || role === 'Accounting') {
       return true
     }
     if (role === 'Salesperson') {
       return userId === accountOwnerId
     }
     return false
   }
   ```

**Success Criteria**:
- All 4 contract roles implemented
- Access restrictions working per contract specifications  
- Session management functional
- Audit trail for login/logout

## Contract Acceptance Criteria & Payment Release

### **Milestone 1 Payment Trigger Requirements (25% of contract value)**

The contract specifies that Milestone 1 payment releases when ALL of the following are completed with written sign-off:

#### ✅ **Core Deliverables**
1. **Accounts & Contacts Fully Functional** - 140+ database-driven fields
2. **Dynamic Tables** - Persistent user preferences across sessions  
3. **Detail Pages** - All tabs operational with inline editing
4. **RBAC Enforced** - All 4 roles (Admin, Sales Management, Salesperson, Accounting)
5. **Audit Logging** - All create/update/delete operations captured

#### ✅ **Performance Requirements**
- Load 1,000 records < 2 seconds
- Column operations < 300ms  
- Search results < 500ms
- Form saves < 3 seconds

#### ✅ **Contract-Specific Features**
- Contact Type inherits from Account Type
- Addresses auto-populate to contacts
- Full Name auto-concatenation
- Export restrictions for Salesperson role
- Copy protection for Accounting role

### **Implementation Priority Order (Per Contract)**
1. Set up database schema first
2. Build dynamic table framework (reusable)
3. Implement RBAC foundation
4. Create account module  
5. Create contact module
6. Add audit logging
7. Test with all four roles

This comprehensive plan ensures 100% contract compliance and successful Milestone 1 completion within the 2-week timeline, with all 140+ fields, dynamic tables, role-based access, and audit logging fully functional per the specifications.
1. **Update Prisma Schema** with comprehensive models:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Enums
enum AccountType { Customer Distributor Vendor House HouseRep Prospect Others }
enum ActivityType { Call Email Meeting Task }
enum ReportStatus { Pending Completed Failed }
enum UserRole { SuperAdmin SalesManager FinanceUser User }

// Core Models
model User {
  id         String   @id @default(cuid())
  active     Boolean  @default(true)
  username   String   @unique
  fullName   String
  email      String   @unique
  role       UserRole @default(User)
  lastLogin  DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // Relationships
  ownedAccounts     Account[] @relation("AccountOwner")
  assignedActivities Activity[] @relation("ActivityAssignee")
  ownedOpportunities Opportunity[] @relation("OpportunityOwner")
  tablePreferences  TablePreference[]

  @@index([email])
  @@index([username])
}

model Account {
  id                String      @id @default(cuid())
  active            Boolean     @default(true)
  accountName       String
  accountLegalName  String?
  accountType       AccountType
  shippingStreet    String?
  shippingCity      String?
  shippingState     String?
  shippingZip       String?
  ownerId           String?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  // Relationships
  owner             User?       @relation("AccountOwner", fields: [ownerId], references: [id])
  contacts          Contact[]
  opportunities     Opportunity[] @relation("AccountOpportunities")
  distributorOpportunities Opportunity[] @relation("DistributorOpportunities")
  vendorOpportunities Opportunity[] @relation("VendorOpportunities")
  revenueSchedules  RevenueSchedule[]
  tickets           Ticket[] @relation("TicketDistributor")
  vendorTickets     Ticket[] @relation("TicketVendor")
  activities        Activity[]
  distributorProducts Product[] @relation("ProductDistributor")
  vendorProducts    Product[] @relation("ProductVendor")

  @@index([accountName])
  @@index([accountType])
  @@index([ownerId])
}

model Contact {
  id           String   @id @default(cuid())
  active       Boolean  @default(true)
  suffix       String?
  fullName     String
  jobTitle     String?
  contactType  String?
  mobile       String?
  workPhone    String?
  emailAddress String?
  extension    String?
  accountId    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relationships
  account      Account? @relation(fields: [accountId], references: [id])
  activities   Activity[]

  @@index([accountId])
  @@index([fullName])
  @@index([emailAddress])
}

model Product {
  id                     String   @id @default(cuid())
  productNameHouse       String
  productNameVendor      String?
  productDescriptionHouse String?
  distributorAccountId   String?
  vendorAccountId        String?
  revenueType            String?
  commissionPercent      Decimal? @db.Decimal(5,2)
  priceEachPercent       Decimal? @db.Decimal(12,2)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  // Relationships
  distributor            Account? @relation("ProductDistributor", fields: [distributorAccountId], references: [id])
  vendor                 Account? @relation("ProductVendor", fields: [vendorAccountId], references: [id])
  opportunities          Opportunity[]
  revenueSchedules       RevenueSchedule[]

  @@index([productNameHouse])
  @@index([distributorAccountId])
  @@index([vendorAccountId])
}

model Opportunity {
  id                         String   @id @default(cuid())
  active                     Boolean  @default(true)
  estimatedCloseDate         DateTime?
  orderIdHouse               String?
  opportunityName            String
  accountId                  String?
  distributorAccountId       String?
  vendorAccountId            String?
  productId                  String?
  expectedUsageGrossTotal    Decimal? @db.Decimal(12,2)
  expectedCommissionGrossTotal Decimal? @db.Decimal(12,2)
  opportunityOwnerId         String?
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt

  // Relationships
  account                    Account? @relation("AccountOpportunities", fields: [accountId], references: [id])
  distributor                Account? @relation("DistributorOpportunities", fields: [distributorAccountId], references: [id])
  vendor                     Account? @relation("VendorOpportunities", fields: [vendorAccountId], references: [id])
  product                    Product? @relation(fields: [productId], references: [id])
  opportunityOwner           User?    @relation("OpportunityOwner", fields: [opportunityOwnerId], references: [id])
  revenueSchedules           RevenueSchedule[]
  tickets                    Ticket[]

  @@index([accountId])
  @@index([opportunityName])
  @@index([opportunityOwnerId])
}

model RevenueSchedule {
  id                 String   @id @default(cuid())
  active             Boolean  @default(true)
  checkbox           Boolean? @default(false)
  opportunityId      String?
  accountId          String?
  productId          String?
  vendorAccountId    String?
  revenueScheduleDate DateTime?
  revenueSchedule    String?
  distributorId      String?
  orderIdHouse       String?
  expectedUsage      Decimal? @db.Decimal(12,2)
  usageAdjustment    Decimal? @db.Decimal(12,2)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  // Relationships
  opportunity        Opportunity? @relation(fields: [opportunityId], references: [id])
  account            Account? @relation(fields: [accountId], references: [id])
  product            Product? @relation(fields: [productId], references: [id])

  @@index([opportunityId])
  @@index([accountId])
  @@index([revenueScheduleDate])
}

model Ticket {
  id               String   @id @default(cuid())
  active           Boolean  @default(true)
  distributorId    String?
  vendorId         String?
  issue            String
  revenueSchedule  String?
  opportunityId    String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  // Relationships
  distributor      Account? @relation("TicketDistributor", fields: [distributorId], references: [id])
  vendor           Account? @relation("TicketVendor", fields: [vendorId], references: [id])
  opportunity      Opportunity? @relation(fields: [opportunityId], references: [id])

  @@index([distributorId])
  @@index([vendorId])
  @@index([opportunityId])
}

model Activity {
  id          String       @id @default(cuid())
  activityType ActivityType
  subject     String
  contactId   String?
  accountId   String?
  dueDate     DateTime?
  status      String?
  assignedToId String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  // Relationships
  contact     Contact?     @relation(fields: [contactId], references: [id])
  account     Account?     @relation(fields: [accountId], references: [id])
  assignedTo  User?        @relation("ActivityAssignee", fields: [assignedToId], references: [id])

  @@index([accountId])
  @@index([assignedToId])
  @@index([dueDate])
}

model Report {
  id         String       @id @default(cuid())
  reportName String
  reportType String
  status     ReportStatus @default(Pending)
  lastRun    DateTime?
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  @@index([reportName])
  @@index([status])
}

model Group {
  id          String   @id @default(cuid())
  active      Boolean  @default(true)
  groupName   String
  groupType   String
  memberCount Int      @default(0)
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([groupName])
  @@index([groupType])
}

model Reconciliation {
  id              String   @id @default(cuid())
  active          Boolean  @default(true)
  reconciled      Boolean  @default(false)
  accountName     String
  month           String
  totalRevenue    Decimal  @db.Decimal(12,2)
  totalCommissions Decimal @db.Decimal(12,2)
  status          String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([accountName])
  @@index([month])
  @@index([status])
}

// Table Customization System
model TablePreference {
  id            String   @id @default(cuid())
  userId        String
  pageType      String   // 'accounts', 'contacts', 'opportunities', etc.
  columnOrder   String   // JSON array of column IDs
  columnWidths  String   // JSON object mapping column ID to width
  hiddenColumns String?  // JSON array of hidden column IDs
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, pageType])
}
```

2. **Run Database Migration**
   ```bash
   npx prisma migrate dev --name init_crm_schema
   npx prisma generate
   ```

**Success Criteria**:
- All CRM models defined and migrated
- Database schema matches frontend requirements
- Prisma client generated successfully

#### Task 1.3: Data Seeding System
**Objective**: Populate database with initial data for testing

**Implementation Steps**:
1. **Create Seed Script**
   ```typescript
   // prisma/seed.ts
   import { PrismaClient } from '../generated/prisma'
   import { accountsData, contactsData, opportunitiesData, productsData } from '../lib/mock-data'
   
   const prisma = new PrismaClient()
   
   async function main() {
     console.log('🌱 Starting database seed...')
     
     // Create admin user
     const adminUser = await prisma.user.create({
       data: {
         username: 'admin',
         fullName: 'System Administrator',
         email: 'admin@commissable.com',
         role: 'SuperAdmin'
       }
     })
     
     // Seed accounts
     for (const account of accountsData) {
       await prisma.account.create({
         data: {
           accountName: account.accountName,
           accountLegalName: account.accountLegalName,
           accountType: account.accountType as any,
           shippingStreet: account.shippingStreet,
           shippingCity: account.shippingCity,
           shippingState: account.shippingState,
           shippingZip: account.shippingZip,
           ownerId: adminUser.id
         }
       })
     }
     
     console.log('✅ Database seeded successfully')
   }
   
   main()
     .catch((e) => {
       console.error(e)
       process.exit(1)
     })
     .finally(async () => {
       await prisma.$disconnect()
     })
   ```

2. **Update package.json**
   ```json
   {
     "scripts": {
       "db:seed": "tsx prisma/seed.ts",
       "db:reset": "prisma migrate reset --force && npm run db:seed"
     }
   }
   ```

**Success Criteria**:
- Seed data successfully imported
- Database populated with test records
- All relationships properly established

### **Phase 2: API Layer Implementation**
*Priority: Critical | Timeline: Week 2*

#### Task 2.1: Core API Routes
**Objective**: Implement RESTful API endpoints for all CRM entities

**Implementation Steps**:
1. **Create API Route Structure**
   ```
   app/api/
   ├── accounts/
   │   ├── route.ts
   │   └── [id]/route.ts
   ├── contacts/
   │   ├── route.ts
   │   └── [id]/route.ts
   ├── opportunities/
   │   ├── route.ts
   │   └── [id]/route.ts
   ├── products/
   │   ├── route.ts
   │   └── [id]/route.ts
   ├── revenue-schedules/
   │   ├── route.ts
   │   └── [id]/route.ts
   ├── tickets/
   │   ├── route.ts
   │   └── [id]/route.ts
   ├── activities/
   │   ├── route.ts
   │   └── [id]/route.ts
   ├── reports/
   │   ├── route.ts
   │   └── [id]/route.ts
   ├── admin/
   │   ├── users/
   │   │   ├── route.ts
   │   │   └── [id]/route.ts
   │   └── roles/
   │       ├── route.ts
   │       └── [id]/route.ts
   └── table-preferences/
       └── [pageType]/route.ts
   ```

2. **Implement Accounts API** (Template for other entities):
   ```typescript
   // app/api/accounts/route.ts
   import { NextRequest, NextResponse } from 'next/server'
   import { prisma } from '@/lib/db'
   import { z } from 'zod'
   
   const createAccountSchema = z.object({
     accountName: z.string().min(1),
     accountLegalName: z.string().optional(),
     accountType: z.enum(['Customer', 'Distributor', 'Vendor', 'House', 'HouseRep', 'Prospect', 'Others']),
     shippingStreet: z.string().optional(),
     shippingCity: z.string().optional(),
     shippingState: z.string().optional(),
     shippingZip: z.string().optional(),
     ownerId: z.string().optional()
   })
   
   export async function GET(req: NextRequest) {
     try {
       const { searchParams } = new URL(req.url)
       const q = searchParams.get('q') ?? ''
       const page = Number(searchParams.get('page') ?? 1)
       const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 20), 100)
       const skip = (page - 1) * pageSize
   
       const where = q ? {
         OR: [
           { accountName: { contains: q, mode: 'insensitive' } },
           { accountLegalName: { contains: q, mode: 'insensitive' } }
         ]
       } : {}
   
       const [items, total] = await Promise.all([
         prisma.account.findMany({
           where,
           include: { 
             owner: { select: { fullName: true } }, 
             _count: { 
               select: { 
                 contacts: true, 
                 opportunities: true 
               } 
             } 
           },
           orderBy: { createdAt: 'desc' },
           skip,
           take: pageSize,
         }),
         prisma.account.count({ where }),
       ])
   
       return NextResponse.json({ 
         items, 
         total, 
         page, 
         pageSize,
         totalPages: Math.ceil(total / pageSize)
       })
     } catch (error) {
       console.error('Accounts GET error:', error)
       return NextResponse.json(
         { error: 'Failed to fetch accounts' }, 
         { status: 500 }
       )
     }
   }
   
   export async function POST(req: NextRequest) {
     try {
       const body = await req.json()
       const validatedData = createAccountSchema.parse(body)
       
       const account = await prisma.account.create({
         data: validatedData,
         include: { 
           owner: { select: { fullName: true } },
           _count: { 
             select: { 
               contacts: true, 
               opportunities: true 
             } 
           }
         }
       })
   
       return NextResponse.json(account, { status: 201 })
     } catch (error) {
       console.error('Accounts POST error:', error)
       
       if (error instanceof z.ZodError) {
         return NextResponse.json(
           { error: 'Validation failed', details: error.errors }, 
           { status: 400 }
         )
       }
       
       return NextResponse.json(
         { error: 'Failed to create account' }, 
         { status: 500 }
       )
     }
   }
   ```

3. **Create Error Handling Middleware**
   ```typescript
   // lib/api-utils.ts
   import { NextResponse } from 'next/server'
   import { z } from 'zod'
   import { Prisma } from '../generated/prisma'
   
   export function handleApiError(error: unknown) {
     console.error('API Error:', error)
     
     if (error instanceof z.ZodError) {
       return NextResponse.json(
         { error: 'Validation failed', details: error.errors },
         { status: 400 }
       )
     }
     
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
       if (error.code === 'P2002') {
         return NextResponse.json(
           { error: 'A record with this information already exists' },
           { status: 409 }
         )
       }
       if (error.code === 'P2025') {
         return NextResponse.json(
           { error: 'Record not found' },
           { status: 404 }
         )
       }
     }
     
     return NextResponse.json(
       { error: 'Internal server error' },
       { status: 500 }
     )
   }
   ```

**Success Criteria**:
- All CRUD endpoints implemented
- Proper error handling and validation
- Pagination and search functionality
- API routes tested and functional

#### Task 2.2: Authentication System
**Objective**: Implement basic user authentication and session management

**Implementation Steps**:
1. **Install Authentication Dependencies**
   ```bash
   npm install next-auth @auth/prisma-adapter bcryptjs
   npm install -D @types/bcryptjs
   ```

2. **Configure NextAuth**
   ```typescript
   // app/api/auth/[...nextauth]/route.ts
   import NextAuth from 'next-auth'
   import CredentialsProvider from 'next-auth/providers/credentials'
   import { PrismaAdapter } from '@auth/prisma-adapter'
   import { prisma } from '@/lib/db'
   import bcrypt from 'bcryptjs'
   
   const handler = NextAuth({
     adapter: PrismaAdapter(prisma),
     providers: [
       CredentialsProvider({
         name: 'credentials',
         credentials: {
           username: { label: 'Username', type: 'text' },
           password: { label: 'Password', type: 'password' }
         },
         async authorize(credentials) {
           if (!credentials?.username || !credentials?.password) {
             return null
           }
   
           const user = await prisma.user.findUnique({
             where: { username: credentials.username }
           })
   
           if (!user || !user.active) {
             return null
           }
   
           // For now, use simple password comparison
           // In production, use bcrypt.compare()
           if (credentials.password === 'admin123') {
             return {
               id: user.id,
               name: user.fullName,
               email: user.email,
               role: user.role
             }
           }
   
           return null
         }
       })
     ],
     session: { strategy: 'jwt' },
     callbacks: {
       async jwt({ token, user }) {
         if (user) {
           token.role = user.role
         }
         return token
       },
       async session({ session, token }) {
         if (token) {
           session.user.id = token.sub
           session.user.role = token.role
         }
         return session
       }
     },
     pages: {
       signIn: '/auth/signin'
     }
   })
   
   export { handler as GET, handler as POST }
   ```

3. **Create Authentication Components**
   ```typescript
   // components/auth/signin-form.tsx
   'use client'
   
   import { useState } from 'react'
   import { signIn } from 'next-auth/react'
   import { useRouter } from 'next/navigation'
   
   export function SignInForm() {
     const [username, setUsername] = useState('')
     const [password, setPassword] = useState('')
     const [loading, setLoading] = useState(false)
     const router = useRouter()
   
     const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault()
       setLoading(true)
   
       const result = await signIn('credentials', {
         username,
         password,
         redirect: false
       })
   
       if (result?.ok) {
         router.push('/dashboard')
       } else {
         alert('Invalid credentials')
       }
       setLoading(false)
     }
   
     return (
       <form onSubmit={handleSubmit} className="space-y-4">
         <div>
           <label className="block text-sm font-medium text-gray-700">
             Username
           </label>
           <input
             type="text"
             value={username}
             onChange={(e) => setUsername(e.target.value)}
             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
             required
           />
         </div>
         <div>
           <label className="block text-sm font-medium text-gray-700">
             Password
           </label>
           <input
             type="password"
             value={password}
             onChange={(e) => setPassword(e.target.value)}
             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
             required
           />
         </div>
         <button
           type="submit"
           disabled={loading}
           className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
         >
           {loading ? 'Signing in...' : 'Sign In'}
         </button>
       </form>
     )
   }
   ```

**Success Criteria**:
- User authentication working
- Session management implemented
- Protected routes functional
- Login/logout flow complete

### **Phase 3: Frontend Integration**
*Priority: High | Timeline: Week 3*

#### Task 3.1: API Integration
**Objective**: Replace mock data with real API calls

**Implementation Steps**:
1. **Create API Client Utilities**
   ```typescript
   // lib/api-client.ts
   interface ApiResponse<T> {
     items?: T[]
     data?: T
     total?: number
     page?: number
     pageSize?: number
     totalPages?: number
   }
   
   class ApiClient {
     private baseUrl = '/api'
   
     async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
       const url = new URL(endpoint, window.location.origin)
       if (params) {
         Object.entries(params).forEach(([key, value]) => {
           url.searchParams.append(key, value)
         })
       }
   
       const response = await fetch(url.toString())
       if (!response.ok) {
         throw new Error(`API Error: ${response.statusText}`)
       }
       return response.json()
     }
   
     async post<T>(endpoint: string, data: any): Promise<T> {
       const response = await fetch(endpoint, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(data)
       })
       if (!response.ok) {
         throw new Error(`API Error: ${response.statusText}`)
       }
       return response.json()
     }
   
     async put<T>(endpoint: string, data: any): Promise<T> {
       const response = await fetch(endpoint, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(data)
       })
       if (!response.ok) {
         throw new Error(`API Error: ${response.statusText}`)
       }
       return response.json()
     }
   
     async delete(endpoint: string): Promise<void> {
       const response = await fetch(endpoint, { method: 'DELETE' })
       if (!response.ok) {
         throw new Error(`API Error: ${response.statusText}`)
       }
     }
   }
   
   export const apiClient = new ApiClient()
   ```

2. **Update Page Components** (Example: Accounts):
   ```typescript
   // app/(dashboard)/accounts/page.tsx
   'use client'
   
   import { useState, useEffect } from 'react'
   import { ListHeader } from '@/components/list-header'
   import { DynamicTable } from '@/components/dynamic-table'
   import { apiClient } from '@/lib/api-client'
   
   export default function AccountsPage() {
     const [accounts, setAccounts] = useState([])
     const [loading, setLoading] = useState(true)
     const [searchQuery, setSearchQuery] = useState('')
     const [currentPage, setCurrentPage] = useState(1)
     const [totalPages, setTotalPages] = useState(1)
   
     const fetchAccounts = async (page = 1, search = '') => {
       try {
         setLoading(true)
         const params: Record<string, string> = {
           page: page.toString(),
           pageSize: '20'
         }
         if (search) {
           params.q = search
         }
   
         const response = await apiClient.get('/api/accounts', params)
         setAccounts(response.items || [])
         setTotalPages(response.totalPages || 1)
         setCurrentPage(page)
       } catch (error) {
         console.error('Failed to fetch accounts:', error)
         // Show error notification
       } finally {
         setLoading(false)
       }
     }
   
     useEffect(() => {
       fetchAccounts()
     }, [])
   
     const handleSearch = (query: string) => {
       setSearchQuery(query)
       fetchAccounts(1, query)
     }
   
     const handlePageChange = (page: number) => {
       fetchAccounts(page, searchQuery)
     }
   
     const handleCreateAccount = async (accountData: any) => {
       try {
         await apiClient.post('/api/accounts', accountData)
         fetchAccounts(currentPage, searchQuery) // Refresh data
       } catch (error) {
         console.error('Failed to create account:', error)
       }
     }
   
     return (
       <div className="h-full flex flex-col">
         <ListHeader
           searchPlaceholder="Search accounts..."
           onSearch={handleSearch}
           onCreateClick={() => {/* Open create modal */}}
         />
         <div className="flex-1 p-6">
           <DynamicTable
             columns={accountColumns}
             data={accounts}
             loading={loading}
             emptyMessage="No accounts found"
             pageType="accounts"
           />
         </div>
       </div>
     )
   }
   ```

**Success Criteria**:
- All pages connected to real APIs
- Loading states implemented
- Error handling in place
- CRUD operations functional

#### Task 3.2: Table Customization Integration
**Objective**: Implement user-specific table preferences

**Implementation Steps**:
1. **Create Table Preferences Hooks**
   ```typescript
   // hooks/useTablePreferences.ts
   import { useState, useEffect, useCallback } from 'react'
   import { useSession } from 'next-auth/react'
   import { apiClient } from '@/lib/api-client'
   
   export interface TablePreferences {
     columnOrder: string[]
     columnWidths: Record<string, number>
     hiddenColumns: string[]
   }
   
   export function useTablePreferences(pageType: string) {
     const { data: session } = useSession()
     const [preferences, setPreferences] = useState<TablePreferences | null>(null)
     const [loading, setLoading] = useState(true)
     const [saving, setSaving] = useState(false)
   
     useEffect(() => {
       if (session?.user) {
         loadPreferences()
       }
     }, [pageType, session])
   
     const loadPreferences = async () => {
       try {
         const response = await apiClient.get(`/api/table-preferences/${pageType}`)
         setPreferences(response.data)
       } catch (error) {
         console.error('Failed to load preferences:', error)
       } finally {
         setLoading(false)
       }
     }
   
     const updatePreferences = useCallback(async (updates: Partial<TablePreferences>) => {
       if (!preferences || !session?.user) return
   
       const newPreferences = { ...preferences, ...updates }
       setPreferences(newPreferences)
   
       try {
         setSaving(true)
         await apiClient.post(`/api/table-preferences/${pageType}`, newPreferences)
       } catch (error) {
         console.error('Failed to save preferences:', error)
         // Revert on error
         setPreferences(preferences)
       } finally {
         setSaving(false)
       }
     }, [preferences, pageType, session])
   
     return {
       preferences,
       loading,
       saving,
       updatePreferences
     }
   }
   ```

2. **Update DynamicTable Component**
   - Add `pageType` prop
   - Integrate `useTablePreferences` hook
   - Add column customization UI
   - Implement drag-and-drop reordering
   - Add column resize functionality

**Success Criteria**:
- Table customization fully functional
- User preferences persist across sessions
- Column reordering, resizing, and hiding work
- Settings sync across devices

### **Phase 4: Testing and Optimization**
*Priority: Medium | Timeline: Week 4*

#### Task 4.1: Comprehensive Testing
**Objective**: Ensure all functionality works correctly

**Implementation Steps**:
1. **Database Connection Testing**
   - Verify Cloud SQL Proxy connectivity
   - Test all CRUD operations
   - Validate data integrity

2. **API Endpoint Testing**
   - Test all endpoints with various inputs
   - Verify error handling
   - Check pagination and filtering

3. **Frontend Integration Testing**
   - Test all page functionality
   - Verify loading states
   - Check error handling

4. **User Authentication Testing**
   - Test login/logout flow
   - Verify protected routes
   - Check session persistence

**Success Criteria**:
- All tests passing
- No critical bugs identified
- Performance meets requirements

#### Task 4.2: Performance Optimization
**Objective**: Optimize application performance

**Implementation Steps**:
1. **Database Optimization**
   - Add proper indexes
   - Optimize queries
   - Implement connection pooling

2. **Frontend Optimization**
   - Implement data caching
   - Add loading skeletons
   - Optimize bundle size

3. **API Optimization**
   - Add response caching
   - Implement rate limiting
   - Optimize database queries

**Success Criteria**:
- Page load times under 2 seconds
- API response times under 500ms
- Smooth user experience

### **Phase 5: Documentation and Deployment Preparation**
*Priority: Low | Timeline: Week 5*

#### Task 5.1: Documentation
**Objective**: Create comprehensive documentation

**Implementation Steps**:
1. **API Documentation**
   - Document all endpoints
   - Provide example requests/responses
   - Include authentication details

2. **Deployment Documentation**
   - Document deployment process
   - Include environment setup
   - Provide troubleshooting guide

3. **User Documentation**
   - Create user guide
   - Document table customization features
   - Provide admin instructions

**Success Criteria**:
- Complete API documentation
- Deployment guide ready
- User documentation available

#### Task 5.2: Deployment Preparation
**Objective**: Prepare for production deployment

**Implementation Steps**:
1. **Environment Configuration**
   - Set up production environment variables
   - Configure Cloud SQL for production
   - Set up monitoring and logging

2. **Security Hardening**
   - Implement proper authentication
   - Add input validation
   - Configure CORS and security headers

3. **Performance Monitoring**
   - Set up error tracking
   - Configure performance monitoring
   - Add health check endpoints

**Success Criteria**:
- Production environment ready
- Security measures in place
- Monitoring configured

## Risk Assessment and Mitigation

### **High Risk Items**

1. **Database Connectivity Issues**
   - *Risk*: Cloud SQL Proxy connection failures
   - *Mitigation*: Implement connection retry logic and fallback mechanisms
   - *Contingency*: Use direct IP connection as backup

2. **Authentication Complexity**
   - *Risk*: Complex authentication requirements
   - *Mitigation*: Start with simple username/password, enhance later
   - *Contingency*: Implement temporary bypass for development

3. **Data Migration Challenges**
   - *Risk*: Existing data compatibility issues
   - *Mitigation*: Thorough testing with seed data
   - *Contingency*: Manual data cleanup scripts

### **Medium Risk Items**

1. **Performance Issues**
   - *Risk*: Slow API responses with large datasets
   - *Mitigation*: Implement pagination and indexing
   - *Contingency*: Add caching layer

2. **Table Customization Complexity**
   - *Risk*: Complex user preferences system
   - *Mitigation*: Implement in phases, start simple
   - *Contingency*: Defer to post-MVP if needed

## Success Metrics

### **Technical Metrics**
- ✅ All API endpoints functional
- ✅ Database connectivity stable (99%+ uptime)
- ✅ Page load times < 2 seconds
- ✅ API response times < 500ms
- ✅ Zero critical security vulnerabilities

### **Functional Metrics**
- ✅ All CRM entities (Accounts, Contacts, etc.) fully functional
- ✅ User authentication working
- ✅ Table customization operational
- ✅ Search and filtering working
- ✅ CRUD operations complete

### **User Experience Metrics**
- ✅ Intuitive navigation
- ✅ Responsive design
- ✅ Error handling user-friendly
- ✅ Loading states implemented
- ✅ Data persistence reliable

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Backend Infrastructure | Week 1 | Database connection, models, seeding |
| Phase 2: API Implementation | Week 2 | All API endpoints, authentication |
| Phase 3: Frontend Integration | Week 3 | API integration, table customization |
| Phase 4: Testing & Optimization | Week 4 | Comprehensive testing, performance |
| Phase 5: Documentation & Deployment | Week 5 | Documentation, deployment prep |

## Next Steps

1. **Immediate Actions** (This Week):
   - Set up database connection (`lib/db.ts`)
   - Install and configure Cloud SQL Proxy
   - Define Prisma schema with all models

2. **Week 1 Priorities**:
   - Complete database migration
   - Implement seed data system
   - Test database connectivity

3. **Week 2 Focus**:
   - Build core API endpoints
   - Implement authentication system
   - Create error handling framework

4. **Ongoing Considerations**:
   - Regular testing and validation
   - Performance monitoring
   - Security best practices
   - Documentation updates

## Conclusion

This comprehensive plan provides a clear roadmap to complete Milestone 1 of the Commissable CRM project. With the solid frontend foundation already in place, the focus shifts to backend implementation, API development, and integration. Following this phased approach will ensure a robust, scalable, and user-friendly CRM platform.

The plan balances technical requirements with practical implementation considerations, providing flexibility for adjustments while maintaining focus on core deliverables. Regular checkpoints and success metrics will help track progress and ensure milestone completion within the projected timeline.
