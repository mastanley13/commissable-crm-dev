# Role Edit Modal Testing Guide

## Overview
This document outlines the testing procedures for the new Role Edit Modal functionality in the Admin > Role Management section.

## Features Implemented

### 1. Role Edit Modal Component (`components/role-edit-modal.tsx`)
- **Comprehensive Permission Categories**: 8 categories with 50+ specific permissions
- **Role Templates**: Predefined templates for Salesperson, Sales Management, Accounting, and Administrator
- **Interactive UI**: Tabbed interface with sidebar navigation
- **Permission Management**: Checkbox-based permission selection with descriptions
- **Visual Feedback**: Icons and color coding for different permission types

### 2. Updated Roles Page (`app/(dashboard)/admin/roles/page.tsx`)
- **Edit Button Integration**: Click edit button to open modal
- **Modal State Management**: Proper loading and error handling
- **API Integration**: Fetches role details and saves changes

### 3. API Endpoints
- **GET /api/admin/roles/[id]**: Fetch individual role with permissions
- **PUT /api/admin/roles/[id]**: Update role name, description, and permissions
- **GET /api/admin/permissions**: List all available permissions
- **POST /api/admin/permissions**: Create new permissions

### 4. Database Seeding Scripts
- **scripts/seed-permissions.ts**: Populates permissions table with all defined permissions
- **scripts/update-role-permissions.ts**: Updates existing roles with template-based permissions

## Permission Categories

### Accounts (9 permissions)
- View assigned/all accounts
- Create, edit, delete accounts
- Export, bulk operations, user reassignment

### Contacts (8 permissions)
- View assigned/all contacts
- Create, edit, delete contacts
- Export, bulk operations

### Opportunities (7 permissions)
- View assigned/all opportunities
- Create, edit, delete opportunities
- Export opportunities

### Finance (5 permissions)
- Reconciliation access
- View all financial data
- Edit financial records
- Export financial data
- Copy protection

### Activities (6 permissions)
- View assigned/all activities
- Create, edit, delete activities

### Tickets (6 permissions)
- View assigned/all tickets
- Create, edit, delete tickets

### Admin (5 permissions)
- User management
- Role management
- System configuration
- Audit log access
- Import/export rights

### System (3 permissions)
- All modules access
- System backup
- System maintenance

## Role Templates

### Salesperson
- **Description**: Work assigned accounts
- **Permissions**: 15 permissions focused on assigned accounts/contacts only
- **Restrictions**: Cannot delete, export, or access other users' data

### Sales Management
- **Description**: Manage all accounts and contacts
- **Permissions**: 25 permissions with full control over sales data
- **Features**: Bulk operations, import/export, user reassignment

### Accounting
- **Description**: Finance and reconciliation access
- **Permissions**: 6 read-only permissions
- **Features**: Copy protection enabled, reconciliation access

### Administrator
- **Description**: Full system control
- **Permissions**: All 49 permissions across all categories
- **Features**: Complete system access and management

## Testing Procedures

### 1. Setup Testing
```bash
# Run permission seeding
npx tsx scripts/seed-permissions.ts

# Update existing roles with templates
npx tsx scripts/update-role-permissions.ts
```

### 2. UI Testing
1. Navigate to Admin > Role Management
2. Click the edit (pencil) icon for any role
3. Verify modal opens with role information
4. Test tab navigation (Basic Info, Templates, Permission Categories)
5. Test permission selection/deselection
6. Test template selection
7. Test save functionality
8. Verify changes are reflected in the table

### 3. API Testing
```bash
# Test role details endpoint
curl -X GET "http://localhost:3000/api/admin/roles/[role-id]?includePermissions=true"

# Test role update endpoint
curl -X PUT "http://localhost:3000/api/admin/roles/[role-id]" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Role","description":"New description","permissionIds":["perm1","perm2"]}'

# Test permissions endpoint
curl -X GET "http://localhost:3000/api/admin/permissions"
```

### 4. Permission Validation Testing
1. Test that only valid permission IDs are accepted
2. Test that invalid permission IDs are rejected
3. Test that permission changes are properly saved
4. Test that role updates are audited

### 5. Error Handling Testing
1. Test with invalid role ID
2. Test with missing required fields
3. Test with network errors
4. Test with permission denied scenarios

## Expected Behavior

### Salesperson Role
- ✅ Can view/edit assigned accounts only
- ✅ Can create new accounts
- ❌ Cannot delete accounts
- ❌ Cannot export account lists
- ❌ Cannot see all accounts
- ✅ Can view/edit contacts at assigned accounts
- ✅ Can create new contacts
- ❌ Cannot access other accounts' contacts
- ❌ Cannot export contact lists

### Sales Management Role
- ✅ Full control over all accounts and contacts
- ✅ Bulk operations
- ✅ Import/export capabilities
- ✅ User reassignment
- ✅ Delete permissions

### Accounting Role
- ✅ Read-only access to all accounts and contacts
- ✅ Access for reconciliation
- ❌ Cannot modify records
- ❌ Cannot export data
- ✅ Copy protection enabled

### Administrator Role
- ✅ All modules and features
- ✅ User/role management
- ✅ System configuration
- ✅ Audit log access
- ✅ Full import/export rights

## Security Considerations

1. **Permission Validation**: All permission IDs are validated against the database
2. **Audit Logging**: All role changes are logged with old/new values
3. **Tenant Isolation**: Roles are scoped to tenants
4. **Access Control**: API endpoints require appropriate permissions
5. **Input Validation**: All inputs are validated and sanitized

## Performance Considerations

1. **Lazy Loading**: Role details are only fetched when edit is clicked
2. **Efficient Queries**: Optimized database queries with proper includes
3. **Caching**: Consider implementing caching for frequently accessed permissions
4. **Batch Operations**: Permission updates are batched for efficiency

## Future Enhancements

1. **Permission Inheritance**: Allow roles to inherit from other roles
2. **Conditional Permissions**: Context-based permission evaluation
3. **Permission Groups**: Group related permissions for easier management
4. **Role Templates**: Allow custom role templates
5. **Bulk Role Operations**: Update multiple roles simultaneously
