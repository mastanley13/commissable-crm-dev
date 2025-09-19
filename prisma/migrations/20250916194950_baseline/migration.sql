-- CreateEnum
CREATE TYPE "public"."TenantStatus" AS ENUM ('Active', 'Suspended', 'Archived');

-- CreateEnum
CREATE TYPE "public"."TenantPlan" AS ENUM ('Pilot', 'Standard', 'Enterprise');

-- CreateEnum
CREATE TYPE "public"."RoleScope" AS ENUM ('System', 'Tenant');

-- CreateEnum
CREATE TYPE "public"."PermissionCategory" AS ENUM ('Accounts', 'Contacts', 'Opportunities', 'Products', 'Finance', 'Activities', 'Tickets', 'Admin', 'System');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('Active', 'Invited', 'Suspended', 'Disabled');

-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('Password', 'Google', 'AzureAD');

-- CreateEnum
CREATE TYPE "public"."AccountStatus" AS ENUM ('Active', 'Inactive', 'Prospect', 'Archived');

-- CreateEnum
CREATE TYPE "public"."AssignmentRole" AS ENUM ('PrimaryOwner', 'SalesSupport', 'Finance', 'ReadOnly');

-- CreateEnum
CREATE TYPE "public"."ContactMethod" AS ENUM ('Email', 'Phone', 'SMS', 'None');

-- CreateEnum
CREATE TYPE "public"."OpportunityStage" AS ENUM ('Qualification', 'Discovery', 'Proposal', 'Negotiation', 'ClosedWon', 'ClosedLost');

-- CreateEnum
CREATE TYPE "public"."OpportunityStatus" AS ENUM ('Open', 'Won', 'Lost', 'OnHold');

-- CreateEnum
CREATE TYPE "public"."OpportunityType" AS ENUM ('NewBusiness', 'Renewal', 'Upsell');

-- CreateEnum
CREATE TYPE "public"."LeadSource" AS ENUM ('Referral', 'Inbound', 'Outbound', 'Partner', 'Other');

-- CreateEnum
CREATE TYPE "public"."RevenueType" AS ENUM ('NRC_PerItem', 'NRC_FlatFee', 'MRC_PerItem', 'MRC_FlatFee');

-- CreateEnum
CREATE TYPE "public"."RevenueScheduleType" AS ENUM ('OneTime', 'Recurring', 'TrueUp');

-- CreateEnum
CREATE TYPE "public"."RevenueScheduleStatus" AS ENUM ('Projected', 'Invoiced', 'Paid', 'Cancelled');

-- CreateEnum
CREATE TYPE "public"."ReconciliationStatus" AS ENUM ('Pending', 'InReview', 'Completed', 'Disputed');

-- CreateEnum
CREATE TYPE "public"."GroupType" AS ENUM ('SalesTeam', 'AccountGroup', 'SupportTeam', 'Management');

-- CreateEnum
CREATE TYPE "public"."GroupVisibility" AS ENUM ('Private', 'Shared', 'Public');

-- CreateEnum
CREATE TYPE "public"."GroupMemberType" AS ENUM ('Account', 'Contact', 'User');

-- CreateEnum
CREATE TYPE "public"."ActivityType" AS ENUM ('Call', 'Meeting', 'Email', 'Task', 'Note');

-- CreateEnum
CREATE TYPE "public"."ActivityStatus" AS ENUM ('Scheduled', 'InProgress', 'Completed', 'Cancelled', 'Deferred');

-- CreateEnum
CREATE TYPE "public"."ActivityPriority" AS ENUM ('Low', 'Normal', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('Open', 'InProgress', 'Waiting', 'Resolved', 'Closed');

-- CreateEnum
CREATE TYPE "public"."TicketPriority" AS ENUM ('Low', 'Medium', 'High', 'Urgent');

-- CreateEnum
CREATE TYPE "public"."TicketSeverity" AS ENUM ('Informational', 'Minor', 'Major', 'Critical');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('Create', 'Update', 'Delete', 'Import', 'Export', 'Login');

-- CreateEnum
CREATE TYPE "public"."TableViewMode" AS ENUM ('Grid', 'List');

-- CreateEnum
CREATE TYPE "public"."FieldModule" AS ENUM ('Accounts', 'Contacts', 'Opportunities');

-- CreateEnum
CREATE TYPE "public"."FieldDataType" AS ENUM ('Text', 'Number', 'Boolean', 'Date', 'Enum', 'Json');

-- CreateEnum
CREATE TYPE "public"."FieldInputType" AS ENUM ('Text', 'Textarea', 'Dropdown', 'Phone', 'Email', 'Url', 'Number', 'Currency');

-- CreateEnum
CREATE TYPE "public"."ImportExportSource" AS ENUM ('UI', 'API');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('Pending', 'Processing', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "public"."DataEntity" AS ENUM ('Accounts', 'Contacts', 'Opportunities', 'Products', 'RevenueSchedules', 'Reconciliations', 'Activities', 'Tickets', 'Users');

-- CreateEnum
CREATE TYPE "public"."SystemSettingScope" AS ENUM ('Tenant', 'Global');

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "public"."TenantStatus" NOT NULL DEFAULT 'Active',
    "planType" "public"."TenantPlan" NOT NULL DEFAULT 'Pilot',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "public"."RoleScope" NOT NULL DEFAULT 'Tenant',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permission" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."PermissionCategory" NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RolePermission" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "grantedById" UUID,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "roleId" UUID,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "mobilePhone" TEXT,
    "workPhone" TEXT,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'Invited',
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "authProvider" "public"."AuthProvider" NOT NULL DEFAULT 'Password',
    "avatarUrl" TEXT,
    "timeZone" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountType" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isAssignableToContacts" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Industry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Address" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "latitude" DECIMAL(10,6),
    "longitude" DECIMAL(10,6),
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountTypeId" UUID NOT NULL,
    "industryId" UUID,
    "parentAccountId" UUID,
    "ownerId" UUID,
    "shippingAddressId" UUID,
    "billingAddressId" UUID,
    "createdById" UUID,
    "updatedById" UUID,
    "accountNumber" TEXT,
    "accountName" TEXT NOT NULL,
    "accountLegalName" TEXT,
    "status" "public"."AccountStatus" NOT NULL DEFAULT 'Active',
    "websiteUrl" TEXT,
    "supportEmail" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "annualRevenue" DECIMAL(16,2),
    "employeeCount" INTEGER,
    "sicCode" TEXT,
    "taxId" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "shippingSyncBilling" BOOLEAN NOT NULL DEFAULT false,
    "mapPlaceId" TEXT,
    "mapUrl" TEXT,
    "copyProtected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountAssignment" (
    "accountId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "assignmentRole" "public"."AssignmentRole" NOT NULL DEFAULT 'PrimaryOwner',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" UUID,

    CONSTRAINT "AccountAssignment_pkey" PRIMARY KEY ("accountId","userId")
);

-- CreateTable
CREATE TABLE "public"."AccountNote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contact" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "accountTypeId" UUID,
    "ownerId" UUID,
    "reportsToContactId" UUID,
    "mailingAddressId" UUID,
    "createdById" UUID,
    "updatedById" UUID,
    "suffix" TEXT,
    "prefix" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "contactType" TEXT,
    "workPhone" TEXT,
    "workPhoneExt" TEXT,
    "mobilePhone" TEXT,
    "otherPhone" TEXT,
    "fax" TEXT,
    "emailAddress" TEXT,
    "alternateEmail" TEXT,
    "preferredContactMethod" "public"."ContactMethod" NOT NULL DEFAULT 'Email',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isDecisionMaker" BOOLEAN NOT NULL DEFAULT false,
    "assistantName" TEXT,
    "assistantPhone" TEXT,
    "linkedinUrl" TEXT,
    "websiteUrl" TEXT,
    "birthdate" TIMESTAMP(3),
    "anniversary" TIMESTAMP(3),
    "description" TEXT,
    "notes" TEXT,
    "syncAddressWithAccount" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContactPreference" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "channel" "public"."ContactMethod" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "consentCapturedAt" TIMESTAMP(3),
    "consentCapturedById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Opportunity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "ownerId" UUID,
    "createdById" UUID,
    "updatedById" UUID,
    "name" TEXT NOT NULL,
    "stage" "public"."OpportunityStage" NOT NULL DEFAULT 'Qualification',
    "status" "public"."OpportunityStatus" NOT NULL DEFAULT 'Open',
    "type" "public"."OpportunityType" NOT NULL DEFAULT 'NewBusiness',
    "leadSource" "public"."LeadSource" NOT NULL DEFAULT 'Referral',
    "amount" DECIMAL(16,2),
    "expectedCommission" DECIMAL(16,2),
    "probability" DECIMAL(5,2),
    "forecastCategory" TEXT,
    "estimatedCloseDate" TIMESTAMP(3),
    "actualCloseDate" TIMESTAMP(3),
    "nextStep" TEXT,
    "competitors" TEXT,
    "lossReason" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OpportunityProduct" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" DECIMAL(16,2),
    "unitPrice" DECIMAL(16,2),
    "expectedUsage" DECIMAL(16,2),
    "expectedRevenue" DECIMAL(16,2),
    "expectedCommission" DECIMAL(16,2),
    "revenueStartDate" TIMESTAMP(3),
    "revenueEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productCode" TEXT NOT NULL,
    "productNameHouse" TEXT NOT NULL,
    "productNameVendor" TEXT,
    "description" TEXT,
    "revenueType" "public"."RevenueType" NOT NULL,
    "commissionPercent" DECIMAL(5,2),
    "priceEach" DECIMAL(16,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "vendorAccountId" UUID,
    "distributorAccountId" UUID,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RevenueSchedule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "opportunityId" UUID,
    "opportunityProductId" UUID,
    "accountId" UUID NOT NULL,
    "productId" UUID,
    "distributorAccountId" UUID,
    "vendorAccountId" UUID,
    "scheduleNumber" TEXT,
    "scheduleDate" TIMESTAMP(3),
    "scheduleType" "public"."RevenueScheduleType" NOT NULL DEFAULT 'Recurring',
    "expectedUsage" DECIMAL(16,2),
    "usageAdjustment" DECIMAL(16,2),
    "actualUsage" DECIMAL(16,2),
    "expectedCommission" DECIMAL(16,2),
    "actualCommission" DECIMAL(16,2),
    "orderIdHouse" TEXT,
    "distributorOrderId" TEXT,
    "status" "public"."RevenueScheduleStatus" NOT NULL DEFAULT 'Projected',
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reconciliation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "totalRevenue" DECIMAL(16,2),
    "totalCommissions" DECIMAL(16,2),
    "status" "public"."ReconciliationStatus" NOT NULL DEFAULT 'Pending',
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "reconciledById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReconciliationItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "reconciliationId" UUID NOT NULL,
    "revenueScheduleId" UUID NOT NULL,
    "variance" DECIMAL(16,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Group" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "groupType" "public"."GroupType" NOT NULL,
    "visibility" "public"."GroupVisibility" NOT NULL DEFAULT 'Private',
    "ownerId" UUID,
    "description" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GroupMember" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "memberType" "public"."GroupMemberType" NOT NULL,
    "accountId" UUID,
    "contactId" UUID,
    "userId" UUID,
    "addedById" UUID,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Activity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID,
    "contactId" UUID,
    "opportunityId" UUID,
    "creatorId" UUID NOT NULL,
    "assigneeId" UUID,
    "activityType" "public"."ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "dueDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "public"."ActivityStatus" NOT NULL DEFAULT 'Scheduled',
    "priority" "public"."ActivityPriority" NOT NULL DEFAULT 'Normal',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ticket" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID,
    "opportunityId" UUID,
    "revenueScheduleId" UUID,
    "contactId" UUID,
    "distributorAccountId" UUID,
    "vendorAccountId" UUID,
    "assignedToId" UUID,
    "createdById" UUID,
    "issue" TEXT NOT NULL,
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'Open',
    "priority" "public"."TicketPriority" NOT NULL DEFAULT 'Medium',
    "severity" "public"."TicketSeverity" NOT NULL DEFAULT 'Minor',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TablePreference" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "pageKey" TEXT NOT NULL,
    "columnOrder" JSONB,
    "columnWidths" JSONB,
    "hiddenColumns" JSONB,
    "sortState" JSONB,
    "filters" JSONB,
    "viewMode" "public"."TableViewMode" NOT NULL DEFAULT 'Grid',
    "persistedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TablePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "action" "public"."AuditAction" NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestId" TEXT,
    "changedFields" JSONB,
    "previousValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FieldDefinition" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "module" "public"."FieldModule" NOT NULL,
    "fieldCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "columnName" TEXT NOT NULL,
    "dataType" "public"."FieldDataType" NOT NULL,
    "inputType" "public"."FieldInputType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isVisibleByDefault" BOOLEAN NOT NULL DEFAULT true,
    "enumOptions" JSONB,
    "helpText" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportJob" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "createdById" UUID,
    "entity" "public"."DataEntity" NOT NULL,
    "source" "public"."ImportExportSource" NOT NULL DEFAULT 'UI',
    "status" "public"."JobStatus" NOT NULL DEFAULT 'Pending',
    "fileName" TEXT NOT NULL,
    "storageUrl" TEXT,
    "totalRows" INTEGER,
    "processedRows" INTEGER,
    "successCount" INTEGER,
    "errorCount" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "filters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportError" (
    "id" UUID NOT NULL,
    "importJobId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "fieldName" TEXT,
    "message" TEXT NOT NULL,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExportJob" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "createdById" UUID,
    "entity" "public"."DataEntity" NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'Pending',
    "fileName" TEXT,
    "downloadUrl" TEXT,
    "filters" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalRows" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemSetting" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "description" TEXT,
    "scope" "public"."SystemSettingScope" NOT NULL DEFAULT 'Tenant',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_code_key" ON "public"."Role"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "public"."Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "public"."RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "User_tenantId_roleId_idx" ON "public"."User"("tenantId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "public"."User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_sessionToken_key" ON "public"."UserSession"("sessionToken");

-- CreateIndex
CREATE INDEX "UserSession_tenantId_userId_idx" ON "public"."UserSession"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "UserSession_tenantId_expiresAt_idx" ON "public"."UserSession"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountType_tenantId_code_key" ON "public"."AccountType"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Industry_tenantId_name_key" ON "public"."Industry"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Account_tenantId_accountTypeId_idx" ON "public"."Account"("tenantId", "accountTypeId");

-- CreateIndex
CREATE INDEX "Account_tenantId_ownerId_idx" ON "public"."Account"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "Account_tenantId_status_idx" ON "public"."Account"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Account_tenantId_accountName_key" ON "public"."Account"("tenantId", "accountName");

-- CreateIndex
CREATE INDEX "AccountAssignment_tenantId_userId_idx" ON "public"."AccountAssignment"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AccountAssignment_tenantId_assignmentRole_idx" ON "public"."AccountAssignment"("tenantId", "assignmentRole");

-- CreateIndex
CREATE INDEX "AccountNote_tenantId_accountId_idx" ON "public"."AccountNote"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "Contact_tenantId_accountId_idx" ON "public"."Contact"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "Contact_tenantId_ownerId_idx" ON "public"."Contact"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "Contact_tenantId_lastName_firstName_idx" ON "public"."Contact"("tenantId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "Contact_tenantId_emailAddress_idx" ON "public"."Contact"("tenantId", "emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ContactPreference_contactId_channel_key" ON "public"."ContactPreference"("contactId", "channel");

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_accountId_idx" ON "public"."Opportunity"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_ownerId_idx" ON "public"."Opportunity"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_stage_idx" ON "public"."Opportunity"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_estimatedCloseDate_idx" ON "public"."Opportunity"("tenantId", "estimatedCloseDate");

-- CreateIndex
CREATE INDEX "OpportunityProduct_tenantId_opportunityId_idx" ON "public"."OpportunityProduct"("tenantId", "opportunityId");

-- CreateIndex
CREATE INDEX "Product_tenantId_isActive_idx" ON "public"."Product"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_productCode_key" ON "public"."Product"("tenantId", "productCode");

-- CreateIndex
CREATE INDEX "RevenueSchedule_tenantId_accountId_idx" ON "public"."RevenueSchedule"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "RevenueSchedule_tenantId_opportunityId_idx" ON "public"."RevenueSchedule"("tenantId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_tenantId_accountId_month_key" ON "public"."Reconciliation"("tenantId", "accountId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationItem_reconciliationId_revenueScheduleId_key" ON "public"."ReconciliationItem"("reconciliationId", "revenueScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_tenantId_name_key" ON "public"."Group"("tenantId", "name");

-- CreateIndex
CREATE INDEX "GroupMember_tenantId_groupId_idx" ON "public"."GroupMember"("tenantId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_memberType_accountId_contactId_userId_key" ON "public"."GroupMember"("groupId", "memberType", "accountId", "contactId", "userId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_accountId_idx" ON "public"."Activity"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_assigneeId_status_idx" ON "public"."Activity"("tenantId", "assigneeId", "status");

-- CreateIndex
CREATE INDEX "Activity_tenantId_dueDate_idx" ON "public"."Activity"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_accountId_idx" ON "public"."Ticket"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_status_idx" ON "public"."Ticket"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_assignedToId_idx" ON "public"."Ticket"("tenantId", "assignedToId");

-- CreateIndex
CREATE INDEX "TablePreference_tenantId_pageKey_idx" ON "public"."TablePreference"("tenantId", "pageKey");

-- CreateIndex
CREATE UNIQUE INDEX "TablePreference_userId_pageKey_key" ON "public"."TablePreference"("userId", "pageKey");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entityName_entityId_idx" ON "public"."AuditLog"("tenantId", "entityName", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "public"."AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FieldDefinition_tenantId_module_fieldCode_key" ON "public"."FieldDefinition"("tenantId", "module", "fieldCode");

-- CreateIndex
CREATE INDEX "ImportJob_tenantId_entity_idx" ON "public"."ImportJob"("tenantId", "entity");

-- CreateIndex
CREATE INDEX "ImportJob_tenantId_status_idx" ON "public"."ImportJob"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ImportError_importJobId_rowNumber_idx" ON "public"."ImportError"("importJobId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_tenantId_key_key" ON "public"."SystemSetting"("tenantId", "key");

-- AddForeignKey
ALTER TABLE "public"."Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSession" ADD CONSTRAINT "UserSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountType" ADD CONSTRAINT "AccountType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Industry" ADD CONSTRAINT "Industry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Address" ADD CONSTRAINT "Address_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_accountTypeId_fkey" FOREIGN KEY ("accountTypeId") REFERENCES "public"."AccountType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "public"."Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "public"."Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "public"."Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountAssignment" ADD CONSTRAINT "AccountAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountAssignment" ADD CONSTRAINT "AccountAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountAssignment" ADD CONSTRAINT "AccountAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountAssignment" ADD CONSTRAINT "AccountAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountNote" ADD CONSTRAINT "AccountNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountNote" ADD CONSTRAINT "AccountNote_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountNote" ADD CONSTRAINT "AccountNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_accountTypeId_fkey" FOREIGN KEY ("accountTypeId") REFERENCES "public"."AccountType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_reportsToContactId_fkey" FOREIGN KEY ("reportsToContactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_mailingAddressId_fkey" FOREIGN KEY ("mailingAddressId") REFERENCES "public"."Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContactPreference" ADD CONSTRAINT "ContactPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContactPreference" ADD CONSTRAINT "ContactPreference_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContactPreference" ADD CONSTRAINT "ContactPreference_consentCapturedById_fkey" FOREIGN KEY ("consentCapturedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpportunityProduct" ADD CONSTRAINT "OpportunityProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpportunityProduct" ADD CONSTRAINT "OpportunityProduct_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpportunityProduct" ADD CONSTRAINT "OpportunityProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_vendorAccountId_fkey" FOREIGN KEY ("vendorAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_distributorAccountId_fkey" FOREIGN KEY ("distributorAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueSchedule" ADD CONSTRAINT "RevenueSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueSchedule" ADD CONSTRAINT "RevenueSchedule_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueSchedule" ADD CONSTRAINT "RevenueSchedule_opportunityProductId_fkey" FOREIGN KEY ("opportunityProductId") REFERENCES "public"."OpportunityProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueSchedule" ADD CONSTRAINT "RevenueSchedule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueSchedule" ADD CONSTRAINT "RevenueSchedule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueSchedule" ADD CONSTRAINT "RevenueSchedule_distributorAccountId_fkey" FOREIGN KEY ("distributorAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueSchedule" ADD CONSTRAINT "RevenueSchedule_vendorAccountId_fkey" FOREIGN KEY ("vendorAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueSchedule" ADD CONSTRAINT "RevenueSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevenueSchedule" ADD CONSTRAINT "RevenueSchedule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reconciliation" ADD CONSTRAINT "Reconciliation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reconciliation" ADD CONSTRAINT "Reconciliation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reconciliation" ADD CONSTRAINT "Reconciliation_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "public"."Reconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_revenueScheduleId_fkey" FOREIGN KEY ("revenueScheduleId") REFERENCES "public"."RevenueSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Group" ADD CONSTRAINT "Group_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Group" ADD CONSTRAINT "Group_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_revenueScheduleId_fkey" FOREIGN KEY ("revenueScheduleId") REFERENCES "public"."RevenueSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_distributorAccountId_fkey" FOREIGN KEY ("distributorAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_vendorAccountId_fkey" FOREIGN KEY ("vendorAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TablePreference" ADD CONSTRAINT "TablePreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TablePreference" ADD CONSTRAINT "TablePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FieldDefinition" ADD CONSTRAINT "FieldDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportJob" ADD CONSTRAINT "ImportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportError" ADD CONSTRAINT "ImportError_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "public"."ImportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExportJob" ADD CONSTRAINT "ExportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExportJob" ADD CONSTRAINT "ExportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SystemSetting" ADD CONSTRAINT "SystemSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
