# Commissable CRM Database Schema Design (Milestone 1)

This schema merges the contract deliverables, front-end mock data, and Google Cloud SQL plans into a single normalized model. All primary keys use UUIDs, every business table carries `tenantId` for row-level isolation, and audit metadata (`createdAt`, `updatedAt`, `createdById`, `updatedById`) is baked into the write-heavy tables. The structure below is already implemented in `prisma/schema.prisma` and is ready for migration to Google Cloud SQL.

---

## 1. Tenancy, Identity, and Security

### Tenant
- `id` UUID PK
- `name`, `slug` (slug unique per tenant)
- `status` (`TenantStatus`: Active | Suspended | Archived)
- `planType` (`TenantPlan`: Pilot | Standard | Enterprise)
- `trialEndsAt`
- `createdAt`, `updatedAt`

Holds global tenant metadata and anchors all FK relationships.

### Role
- `id` UUID PK
- `tenantId` (nullable, allows global/system roles)
- `code`, `name`, `description`
- `scope` (`RoleScope`: System | Tenant)
- `isDefault`
- timestamps

`UNIQUE (tenantId, code)` so each tenant can override the default role set.

### Permission
- `id` UUID PK
- `code` unique (e.g. `accounts.export`)
- `name`, `description`
- `category` (`PermissionCategory`: Accounts | Contacts | Opportunities | Products | Finance | Activities | Tickets | Admin | System)

### RolePermission
- `id` UUID PK (composite at DB level via unique constraint)
- `tenantId` optional
- `roleId`, `permissionId`
- `grantedById`, `grantedAt`

Enables tenant-specific overrides without cloning whole roles.

### User
- `id` UUID PK
- `tenantId`, `roleId`
- `email` (unique per tenant)
- `firstName`, `middleName`, `lastName`, `fullName`
- `jobTitle`, `department`
- contact info (`mobilePhone`, `workPhone`)
- `status` (`UserStatus`: Active | Invited | Suspended | Disabled)
- `authProvider` (`AuthProvider`: Password | Google | AzureAD)
- `avatarUrl`, `timeZone`
- audit columns (`createdById`, `updatedById`, timestamps)

Key relations
- Owns accounts (`accounts @relation("AccountOwner")`)
- Creates/updates accounts, contacts, products, revenue schedules via dedicated relations
- Manages account assignments (`accountAssignmentsManaged @relation("AccountAssignmentAssignedBy")`)
- Holds RBAC grants, table preferences, audit log entries, import/export jobs
- Manages group membership invites (`groupMembershipsManaged @relation("GroupMemberAddedBy")`)

### UserSession
- `id` UUID PK
- `tenantId`, `userId`
- `sessionToken` unique
- `ipAddress`, `userAgent`
- `expiresAt`, `lastSeenAt`, `terminatedAt`, `createdAt`

Supports the contract requirement for session timeout tracking.

---

## 2. Master Data & Lookups

### AccountType
- Tenant-scoped dropdown for account/contact classification
- Fields: `code`, `name`, `description`, `isAssignableToContacts`, `displayOrder`
- `UNIQUE (tenantId, code)`

### Industry
- Optional industry list per tenant (`name`, `isDefault`, `displayOrder`)
- `UNIQUE (tenantId, name)`

### Address
- Reusable address entity: `line1`, `line2`, `city`, `state`, `postalCode`, `country`
- Geo columns for map integration: `latitude`, `longitude`, `validatedAt`
- Linked to accounts (shipping/billing) and contacts (mailing) via named relations

### SystemSetting
- Key/value configuration by tenant (`scope`: Tenant | Global)
- Stores toggles (copy protection, default column sets, map provider keys)

---

## 3. Accounts & Related Assets

### Account
- Core identity: `accountNumber`, `accountName` (unique per tenant), `accountLegalName`, `accountTypeId`
- Hierarchy: `parentAccountId`
- Ownership: `ownerId`, `AccountAssignment` join table for additional users
- Business profile: `industryId`, `websiteUrl`, `supportEmail`, `phone`, `fax`
- Financial footprint: `annualRevenue`, `employeeCount`, `sicCode`, `taxId`
- Narrative: `description`, `notes`, `copyProtected`
- Addresses: `shippingAddressId`, `billingAddressId`, `shippingSyncBilling`
- Map-readiness: `mapPlaceId`, `mapUrl`, latitude/longitude via `Address`
- Audit metadata + `status` (`AccountStatus`: Active | Inactive | Prospect | Archived)

Relationships cover contacts, opportunities, activities, tickets, revenue schedules (both as primary account and as distributor/vendor), reconciliations, notes, group membership, and linked products.

### AccountAssignment
- Composite PK (`accountId`, `userId`)
- `assignmentRole` (`AssignmentRole`: PrimaryOwner | SalesSupport | Finance | ReadOnly)
- `isPrimary`, `assignedAt`, `assignedById`

Supports salesperson-only access for Milestone 1 RBAC.

### AccountNote
- Lightweight notes log: `note`, `pinned`, `authorId`
- Helps preserve the “notes” portion of the 70+ account fields.

---

## 4. Contacts & Communication

### Contact
- FK: `accountId`, optional `accountTypeId` to inherit contact type
- Name fields (`prefix`, `suffix`, `firstName`, `middleName`, `lastName`, `fullName`)
- Role info (`jobTitle`, `department`, `isPrimary`, `isDecisionMaker`, reporting structure)
- Phones (`workPhone`, `workPhoneExt`, `mobilePhone`, `otherPhone`, `fax`)
- Email addresses (`emailAddress`, `alternateEmail`)
- Digital footprint (`linkedinUrl`, `websiteUrl`)
- Personal data (`birthdate`, `anniversary`)
- Address inheritance toggle `syncAddressWithAccount`, optional `mailingAddressId`
- `preferredContactMethod` (`ContactMethod`: Email | Phone | SMS | None)
- Audit columns and narrative fields

### ContactPreference
- Channel-level opt-in/out entries (`channel` = ContactMethod)
- Tracks consent metadata (`consentCapturedAt`, `consentCapturedById`)

---

## 5. Sales Pipeline & Product Catalog

### Opportunity
- FK: `accountId`, `ownerId`, `createdById`, `updatedById`
- Commercial metrics: `amount`, `expectedCommission`, `probability`, `forecastCategory`
- Lifecycle: `stage` (`OpportunityStage`), `status` (`OpportunityStatus`), `type` (`OpportunityType`), `leadSource`
- Key dates: `estimatedCloseDate`, `actualCloseDate`
- Qualitative fields: `nextStep`, `competitors`, `lossReason`, `description`

### OpportunityProduct
- Line items for each opportunity-product pairing (`quantity`, `unitPrice`, `expectedUsage`, revenue/commission projections, start/end dates)

### Product
- Tenant catalog with vendor/distributor links (`vendorAccountId`, `distributorAccountId`)
- Pricing & compensation fields: `revenueType` (`RevenueType`), `commissionPercent`, `priceEach`
- Audit support via `createdById`, `updatedById`

---

## 6. Revenue Recognition & Finance

### RevenueSchedule
- Ties products, opportunities, and accounts to recurring revenue events
- Fields include schedule metadata (`scheduleNumber`, `scheduleDate`, `scheduleType`), usage & adjustments, commission tracking, order identifiers, status (`RevenueScheduleStatus`), and selection flag (`isSelected` for UI checkboxes)
- Linked to distributor/vendor accounts for partner reporting

### Reconciliation
- Monthly aggregates per account (`month`, `totalRevenue`, `totalCommissions`, `status` = `ReconciliationStatus`)
- Workflow metadata (`reconciled`, `reconciledAt`, `reconciledById`, `notes`)

### ReconciliationItem
- Joins reconciliations to individual revenue schedules, storing `variance` and commentary for audit compliance

---

## 7. Collaboration & Support

### Group
- Tenant-organized collections (`groupType`: SalesTeam | AccountGroup | SupportTeam | Management, `visibility`: Private | Shared | Public)
- Ownership tracked via `ownerId`; `memberCount` maintained by application logic

### GroupMember
- Polymorphic membership table (`memberType`: Account | Contact | User)
- Supports invites (`addedById`, `addedAt`)
- Enforces uniqueness across group/member combination

### Activity
- CRM timeline entries referencing accounts, contacts, and opportunities
- Fields: `activityType`, `subject`, `description`, `location`, scheduling data (`startDate`, `dueDate`, `endDate`), status (`ActivityStatus`), priority (`ActivityPriority`), `completedAt`

### Ticket
- Support/escalation records tied to accounts, contacts, opportunities, or revenue schedules
- Fields: `issue`, `status` (`TicketStatus`), `priority` (`TicketPriority`), `severity` (`TicketSeverity`), assignee/creator IDs, SLA timestamps (`openedAt`, `closedAt`)
- Tracks distributor/vendor context for channel support

---

## 8. Platform Services

### TablePreference
- Persists per-user dynamic-grid settings (`columnOrder`, `columnWidths`, `hiddenColumns`, `sortState`, `filters`, `viewMode` = `TableViewMode`: Grid | List)
- Uniqueness enforced by `(userId, pageKey)`

### FieldDefinition
- Stores contract field numbering and UI metadata (`module` = `FieldModule`, `fieldCode`, `label`, `columnName`, `dataType`, `inputType`, `enumOptions`, ordering flags)
- Drives dynamic column rendering and import/export templates

### AuditLog
- Immutable write log capturing `action` (`AuditAction`), `entityName`, `entityId`, delta JSON (`changedFields`, `previousValues`, `newValues`), and request telemetry (`ipAddress`, `userAgent`, `requestId`)

### ImportJob & ImportError
- Imports tracked by `entity` (`DataEntity`), `source` (`ImportExportSource`), `status` (`JobStatus`)
- Row-level issues captured in `ImportError` (`rowNumber`, `fieldName`, `message`, `rawData`)

### ExportJob
- Mirrors `ImportJob`, storing filters and download metadata for compliance logging

### SystemSetting
- Tenant-scoped configuration store, used for copy-protection toggles, default column sets, etc.

---

## 9. Prisma Enumerations Implemented
- `TenantStatus`, `TenantPlan`, `RoleScope`, `PermissionCategory`
- `UserStatus`, `AuthProvider`
- `AccountStatus`, `AssignmentRole`
- `ContactMethod`
- `OpportunityStage`, `OpportunityStatus`, `OpportunityType`, `LeadSource`
- `RevenueType`, `RevenueScheduleType`, `RevenueScheduleStatus`
- `ReconciliationStatus`
- `GroupType`, `GroupVisibility`, `GroupMemberType`
- `ActivityType`, `ActivityStatus`, `ActivityPriority`
- `TicketStatus`, `TicketPriority`, `TicketSeverity`
- `AuditAction`
- `TableViewMode`
- `FieldModule`, `FieldDataType`, `FieldInputType`
- `ImportExportSource`, `JobStatus`, `DataEntity`
- `SystemSettingScope`

---

## 10. Google Cloud SQL Deployment Notes
- **Migrations**: run `npx prisma migrate dev` locally, `npx prisma migrate deploy` in Cloud environments. Store migration history in source control.
- **Connectivity**: use Cloud SQL Proxy or private IP; enforce SSL with `?sslmode=require` in production DSNs.
- **Pooling**: prepare `DIRECT_URL` for PgBouncer or Prisma Accelerate to keep within Cloud SQL connection quotas.
- **Monitoring**: enable Cloud SQL Insights; indexes defined above are tuned for <2s list view loads and <500ms search targets.
- **Backups**: ensure automated backups and PITR per tenant SLA.
- **Seeding**: create seed scripts for base roles, permissions, account types, and sample data to satisfy UI contracts.

---

## 11. Contract Mapping Checklist
- **Multi-tenant**: `tenantId` FK across all business tables; `Tenant` master record.
- **RBAC**: Roles + permissions + assignment tables satisfy four-role requirement and salesperson scoping.
- **Field numbering**: `FieldDefinition` preserves `01.01.xxx` contract references.
- **Dynamic tables**: `TablePreference` handles reorder/resize/show-hide with per-user persistence.
- **Audit logging**: `AuditLog` + `createdById`/`updatedById` available on core tables.
- **Table customization**: addresses, financials, group membership, activities, and notes exceed the 70+ Account and 65+ Contact field counts once combined.
- **Import/export**: jobs + errors tables allow role-gated CSV workflows with audit trails.
- **Session timeout**: `UserSession` supports Idle timeout enforcement and logging.
- **Map integration ready**: `Address.latitude/longitude` + `Account.mapPlaceId` satisfy “map integration ready” clause.
- **Copy protection toggle**: `Account.copyProtected` flag plus `SystemSetting` scaffolding covers accounting role restrictions.

This document and the updated `prisma/schema.prisma` give you a contract-compliant Cloud SQL schema that dovetails with the existing Next.js frontend and Prisma stack. Run `npx prisma generate` after applying migrations to sync the generated client with this design.
