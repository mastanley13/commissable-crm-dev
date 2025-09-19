# RBAC & Admin Guide

## Overview

This guide covers the Role-Based Access Control (RBAC) system and Administration Panel for the Commissable CRM. The system implements granular permissions with four primary roles aligned with Milestone 1 specifications.

## Table of Contents

1. [Role Structure](#role-structure)
2. [Permission System](#permission-system)
3. [Admin Panel Access](#admin-panel-access)
4. [User Management](#user-management)
5. [Role Management](#role-management)
6. [Permission Management](#permission-management)
7. [API Endpoints](#api-endpoints)
8. [Troubleshooting](#troubleshooting)

## Role Structure

### Primary Roles

| Role Code | Role Name | Description | Default |
|-----------|-----------|-------------|---------|
| `ADMIN` | Administrator | Full system control, user/role management | No |
| `SALES_MGMT` | Sales Management | Manage all accounts and contacts, bulk operations | Yes |
| `SALES_REP` | Salesperson | Work assigned accounts only, limited permissions | No |
| `ACCOUNTING` | Accounting | Read-only access for reconciliation, copy protection | No |

### Role Hierarchy & Access Levels

```
Admin (Full Control)
├── All modules and features
├── User/role management
├── System configuration
├── Audit log access
└── Full import/export rights

Sales Management (Full Business Control)
├── All accounts and contacts
├── Bulk operations
├── Import/export capabilities
├── User reassignment
└── Delete permissions

Salesperson (Limited Access)
├── View/edit assigned accounts only
├── Create new accounts/contacts
├── Cannot delete accounts
├── Cannot export account lists
└── Cannot see all accounts

Accounting (Read-Only)
├── View all accounts and contacts
├── Access for reconciliation
├── Cannot modify records
├── Cannot export data
└── Copy protection enabled
```

## Permission System

### Permission Categories

Permissions are organized into categories for better management:

- **Accounts**: Account management operations
- **Contacts**: Contact management operations  
- **Finance**: Financial data access
- **System**: System settings and table customization
- **Admin**: Administrative functions

### Granular Permissions

#### Accounts Permissions
- `accounts.read` - View accounts
- `accounts.create` - Create new accounts
- `accounts.update` - Modify existing accounts
- `accounts.delete` - Delete accounts
- `accounts.export` - Export account data
- `accounts.manage` - Legacy permission (full account management)

#### Contacts Permissions
- `contacts.read` - View contacts
- `contacts.create` - Create new contacts
- `contacts.update` - Modify existing contacts
- `contacts.delete` - Delete contacts
- `contacts.export` - Export contact data
- `contacts.manage` - Legacy permission (full contact management)

#### Finance Permissions
- `finance.view` - View financial data
- `reconciliation.view` - Access reconciliation features

#### System Permissions
- `tables.customize` - Customize table columns and preferences
- `system.settings.read` - Read system settings
- `system.settings.write` - Modify system settings

#### Admin Permissions
- `admin.roles.read` - View roles
- `admin.roles.create` - Create new roles
- `admin.roles.update` - Modify existing roles
- `admin.roles.delete` - Delete roles
- `admin.permissions.read` - View permissions
- `admin.users.read` - View users
- `admin.users.create` - Create new users
- `admin.users.update` - Modify existing users
- `admin.users.delete` - Delete users

### Permission Grants by Role

#### Admin Role
```json
{
  "accounts": ["read", "create", "update", "delete", "export", "manage"],
  "contacts": ["read", "create", "update", "delete", "export", "manage"],
  "finance": ["view"],
  "reconciliation": ["view"],
  "system": ["tables.customize", "settings.read", "settings.write"],
  "admin": ["roles.read", "roles.create", "roles.update", "roles.delete", "permissions.read", "users.read", "users.create", "users.update", "users.delete"]
}
```

#### Sales Management Role
```json
{
  "accounts": ["read", "create", "update", "delete", "export", "manage"],
  "contacts": ["read", "create", "update", "delete", "export", "manage"],
  "system": ["tables.customize"]
}
```

#### Salesperson Role
```json
{
  "accounts": ["read", "create", "update", "manage"],
  "contacts": ["read", "create", "update", "manage"],
  "system": ["tables.customize"]
}
```

#### Accounting Role
```json
{
  "accounts": ["read"],
  "contacts": ["read"],
  "finance": ["view"],
  "reconciliation": ["view"],
  "system": ["tables.customize"]
}
```

## Admin Panel Access

### Access Requirements

To access the Administration Panel, users must have one of the following permissions:
- Any `admin.*` permission
- `accounts.manage` (legacy compatibility)

### Admin Panel Sections

1. **User Management** (`/admin/users`)
   - View, create, edit, and delete users
   - Assign roles to users
   - Manage user status and permissions

2. **Role Management** (`/admin/roles`)
   - View, create, edit, and delete roles
   - Assign permissions to roles
   - View role usage statistics

3. **System Settings** (`/settings`)
   - Configure global system settings
   - Manage copy protection settings
   - Audit log retention settings

## User Management

### Creating Users

1. Navigate to **Admin Panel** → **User Management**
2. Click **Create User**
3. Fill in required fields:
   - Email (unique per tenant)
   - First Name
   - Last Name
   - Role assignment
   - Status (Active, Invited, Suspended, Disabled)

### User Status Management

- **Active**: User can log in and access the system
- **Invited**: User has been created but hasn't logged in yet
- **Suspended**: Temporary access restriction
- **Disabled**: Permanent access restriction (soft delete)

### Role Assignment

Users can be assigned to any role within their tenant. Role changes take effect immediately and affect all user permissions.

## Role Management

### Creating Custom Roles

1. Navigate to **Admin Panel** → **Role Management**
2. Click **Create Role**
3. Define role properties:
   - Code (unique identifier)
   - Name (display name)
   - Description
   - Permissions to grant

### Role Permissions

When creating or editing roles, you can assign any combination of available permissions. The system will validate that all assigned permissions exist.

### Role Usage

The system tracks how many users are assigned to each role, helping administrators understand role usage patterns.

## Permission Management

### Viewing Permissions

Permissions are automatically created during database seeding and are organized by category. You can view all available permissions through the Admin Panel.

### Permission Categories

- **Accounts**: Account-related operations
- **Contacts**: Contact-related operations
- **Finance**: Financial data access
- **System**: System configuration and customization
- **Admin**: Administrative functions

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/register` - User registration

### Admin Endpoints

#### Users
- `GET /api/admin/users` - List users (requires `admin.users.read` or `accounts.manage`)
- `POST /api/admin/users` - Create user (requires `admin.users.create` or `accounts.manage`)
- `GET /api/admin/users/[userId]` - Get user details
- `PUT /api/admin/users/[userId]` - Update user (requires `admin.users.update` or `accounts.manage`)
- `DELETE /api/admin/users/[userId]` - Delete user (requires `admin.users.delete`)

#### Roles
- `GET /api/admin/roles` - List roles (requires `admin.roles.read` or `accounts.manage`)
- `POST /api/admin/roles` - Create role (requires `admin.roles.create`)
- `GET /api/admin/roles?includePermissions=true` - List roles with permissions

#### Permissions
- `GET /api/admin/permissions` - List permissions (requires `admin.permissions.read` or `admin.roles.read`)

### System Settings
- `GET /api/system-settings` - Get system settings (requires `system.settings.read`)
- `POST /api/system-settings` - Update system settings (requires `system.settings.write`)

## Troubleshooting

### Common Issues

#### 403 Forbidden Errors

**Problem**: Users getting 403 errors when accessing system settings or admin functions.

**Solution**: 
1. Check if the required permissions exist in the database
2. Verify the user's role has the necessary permissions
3. Re-run the database seed to ensure all permissions are created:
   ```bash
   npx prisma migrate reset --force --skip-generate --skip-seed
   npx ts-node prisma/seed.ts
   ```

#### Permission Not Found

**Problem**: API returns "Permission not found" errors.

**Solution**:
1. Ensure the permission exists in the database
2. Check the permission code spelling
3. Verify the permission is assigned to the user's role

#### Role Assignment Issues

**Problem**: Users not getting expected permissions after role assignment.

**Solution**:
1. Verify the role has the correct permissions
2. Check if the user's session needs to be refreshed
3. Ensure the role assignment was saved correctly

### Database Seeding

To reset and reseed the database with all permissions and roles:

```bash
# Reset database (WARNING: This will delete all data)
npx prisma migrate reset --force --skip-generate --skip-seed

# Seed with default data
npx ts-node prisma/seed.ts
```

### Default Login Credentials

After seeding, use these credentials to log in as admin:

- **Email**: admin@commissable.test
- **Password**: password123

### Permission Checking in Code

#### Frontend Components

```tsx
import { PermissionGate } from '@/components/auth/permission-gate'

// Require any of these permissions
<PermissionGate permissions={['admin.users.read', 'accounts.manage']}>
  <UserManagementComponent />
</PermissionGate>

// Require all permissions
<PermissionGate permissions={['admin.users.read', 'admin.users.create']} requireAll>
  <CreateUserComponent />
</PermissionGate>
```

#### API Endpoints

```typescript
import { withPermissions } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['admin.users.read', 'accounts.manage'], // Any of these permissions
    async (req) => {
      // Handler logic here
    }
  )
}
```

### Best Practices

1. **Principle of Least Privilege**: Only grant permissions that are absolutely necessary
2. **Regular Audits**: Periodically review user roles and permissions
3. **Role-Based Design**: Design features around roles rather than individual permissions
4. **Permission Granularity**: Use specific permissions rather than broad "manage" permissions where possible
5. **Documentation**: Keep this guide updated when adding new permissions or roles

### Security Considerations

1. **Session Management**: User sessions expire after the configured duration
2. **Permission Caching**: Permissions are loaded with user data and cached in the session
3. **API Protection**: All admin endpoints require proper authentication and authorization
4. **Audit Logging**: All administrative actions are logged for security auditing

## Migration Notes

### From Legacy to Granular Permissions

The system maintains backward compatibility with legacy permissions (`accounts.manage`, `contacts.manage`) while supporting granular permissions. When updating API endpoints:

1. Add granular permission checks alongside legacy ones
2. Test with different role assignments
3. Remove legacy permissions only after all endpoints are updated

### Adding New Permissions

1. Add permission to the seed file (`prisma/seed.ts`)
2. Assign to appropriate roles
3. Update API endpoint guards
4. Update frontend permission gates
5. Test with different user roles

---

*Last updated: [Current Date]*
*Version: 1.0*
