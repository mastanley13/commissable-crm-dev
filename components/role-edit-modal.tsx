'use client'

import { useState, useEffect } from 'react'
import { Shield, Users, Building, FileText, DollarSign, Activity, Ticket, Settings, Database, Eye, Edit, Trash, Download, Upload, UserCheck, Lock, Info, CheckCircle } from 'lucide-react'

export interface RolePermission {
  id: string
  code: string
  name: string
  category: string
  description?: string
}

export interface Role {
  id: string
  code: string
  name: string
  description?: string
  scope: string
  isDefault: boolean
  userCount: number
  permissions: RolePermission[]
  createdAt: string
  updatedAt: string
}

interface RoleEditModalProps {
  isOpen: boolean
  role: Role | null
  loading?: boolean
  error?: string | null
  onClose: () => void
  onSave: (roleId: string, updates: any) => Promise<void>
}

// Define permission categories and their specific permissions
const PERMISSION_CATEGORIES = {
  Accounts: {
    icon: Building,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    permissions: [
      { code: 'accounts.view.assigned', name: 'View assigned accounts only', description: 'Can only view accounts assigned to them' },
      { code: 'accounts.view.all', name: 'View all accounts', description: 'Can view all accounts in the system' },
      { code: 'accounts.create', name: 'Create new accounts', description: 'Can create new account records' },
      { code: 'accounts.edit.assigned', name: 'Edit assigned accounts', description: 'Can edit accounts assigned to them' },
      { code: 'accounts.edit.all', name: 'Edit all accounts', description: 'Can edit any account in the system' },
      { code: 'accounts.delete', name: 'Delete accounts', description: 'Can delete account records' },
      { code: 'accounts.export', name: 'Export account lists', description: 'Can export account data' },
      { code: 'accounts.bulk', name: 'Bulk operations', description: 'Can perform bulk operations on accounts' },
      { code: 'accounts.reassign', name: 'User reassignment', description: 'Can reassign accounts to other users' }
    ]
  },
  Contacts: {
    icon: Users,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    permissions: [
      { code: 'contacts.view.assigned', name: 'View contacts at assigned accounts', description: 'Can view contacts only at assigned accounts' },
      { code: 'contacts.view.all', name: 'View all contacts', description: 'Can view all contacts in the system' },
      { code: 'contacts.create', name: 'Create new contacts', description: 'Can create new contact records' },
      { code: 'contacts.edit.assigned', name: 'Edit contacts at assigned accounts', description: 'Can edit contacts at assigned accounts' },
      { code: 'contacts.edit.all', name: 'Edit all contacts', description: 'Can edit any contact in the system' },
      { code: 'contacts.delete', name: 'Delete contacts', description: 'Can delete contact records' },
      { code: 'contacts.export', name: 'Export contact lists', description: 'Can export contact data' },
      { code: 'contacts.bulk', name: 'Bulk operations', description: 'Can perform bulk operations on contacts' }
    ]
  },
  Opportunities: {
    icon: FileText,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    permissions: [
      { code: 'opportunities.view.assigned', name: 'View assigned opportunities', description: 'Can view opportunities assigned to them' },
      { code: 'opportunities.view.all', name: 'View all opportunities', description: 'Can view all opportunities in the system' },
      { code: 'opportunities.create', name: 'Create opportunities', description: 'Can create new opportunity records' },
      { code: 'opportunities.edit.assigned', name: 'Edit assigned opportunities', description: 'Can edit opportunities assigned to them' },
      { code: 'opportunities.edit.all', name: 'Edit all opportunities', description: 'Can edit any opportunity in the system' },
      { code: 'opportunities.delete', name: 'Delete opportunities', description: 'Can delete opportunity records' },
      { code: 'opportunities.export', name: 'Export opportunities', description: 'Can export opportunity data' }
    ]
  },
  Finance: {
    icon: DollarSign,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    permissions: [
      { code: 'finance.view.reconciliation', name: 'Access for reconciliation', description: 'Can access reconciliation features' },
      { code: 'finance.view.all', name: 'View all financial data', description: 'Can view all financial information' },
      { code: 'finance.edit', name: 'Modify financial records', description: 'Can modify financial records' },
      { code: 'finance.export', name: 'Export financial data', description: 'Can export financial data' },
      { code: 'finance.copy_protection', name: 'Copy protection enabled', description: 'Copy protection is enforced for this role' }
    ]
  },
  Activities: {
    icon: Activity,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    permissions: [
      { code: 'activities.view.assigned', name: 'View assigned activities', description: 'Can view activities assigned to them' },
      { code: 'activities.view.all', name: 'View all activities', description: 'Can view all activities in the system' },
      { code: 'activities.create', name: 'Create activities', description: 'Can create new activity records' },
      { code: 'activities.edit.assigned', name: 'Edit assigned activities', description: 'Can edit activities assigned to them' },
      { code: 'activities.edit.all', name: 'Edit all activities', description: 'Can edit any activity in the system' },
      { code: 'activities.delete', name: 'Delete activities', description: 'Can delete activity records' }
    ]
  },
  Tickets: {
    icon: Ticket,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    permissions: [
      { code: 'tickets.view.assigned', name: 'View assigned tickets', description: 'Can view tickets assigned to them' },
      { code: 'tickets.view.all', name: 'View all tickets', description: 'Can view all tickets in the system' },
      { code: 'tickets.create', name: 'Create tickets', description: 'Can create new ticket records' },
      { code: 'tickets.edit.assigned', name: 'Edit assigned tickets', description: 'Can edit tickets assigned to them' },
      { code: 'tickets.edit.all', name: 'Edit all tickets', description: 'Can edit any ticket in the system' },
      { code: 'tickets.delete', name: 'Delete tickets', description: 'Can delete ticket records' }
    ]
  },
  Admin: {
    icon: Settings,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    permissions: [
      { code: 'admin.users.manage', name: 'User management', description: 'Can manage system users' },
      { code: 'admin.roles.manage', name: 'Role management', description: 'Can manage user roles and permissions' },
      { code: 'admin.system.config', name: 'System configuration', description: 'Can configure system settings' },
      { code: 'admin.audit.access', name: 'Audit log access', description: 'Can access audit logs' },
      { code: 'admin.import_export', name: 'Full import/export rights', description: 'Can import and export all data' }
    ]
  },
  System: {
    icon: Database,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    permissions: [
      { code: 'system.all_modules', name: 'All modules and features', description: 'Access to all system modules' },
      { code: 'system.backup', name: 'System backup', description: 'Can perform system backups' },
      { code: 'system.maintenance', name: 'System maintenance', description: 'Can perform system maintenance tasks' }
    ]
  }
}

// Predefined role templates
const ROLE_TEMPLATES = {
  Salesperson: {
    name: 'Salesperson',
    description: 'Work assigned accounts',
    permissions: [
      'accounts.view.assigned',
      'accounts.create',
      'accounts.edit.assigned',
      'contacts.view.assigned',
      'contacts.create',
      'contacts.edit.assigned',
      'opportunities.view.assigned',
      'opportunities.create',
      'opportunities.edit.assigned',
      'activities.view.assigned',
      'activities.create',
      'activities.edit.assigned',
      'tickets.view.assigned',
      'tickets.create',
      'tickets.edit.assigned'
    ]
  },
  'Sales Management': {
    name: 'Sales Management',
    description: 'Manage all accounts and contacts',
    permissions: [
      'accounts.view.all',
      'accounts.create',
      'accounts.edit.all',
      'accounts.delete',
      'accounts.export',
      'accounts.bulk',
      'accounts.reassign',
      'contacts.view.all',
      'contacts.create',
      'contacts.edit.all',
      'contacts.delete',
      'contacts.export',
      'contacts.bulk',
      'opportunities.view.all',
      'opportunities.create',
      'opportunities.edit.all',
      'opportunities.delete',
      'opportunities.export',
      'activities.view.all',
      'activities.create',
      'activities.edit.all',
      'activities.delete',
      'tickets.view.all',
      'tickets.create',
      'tickets.edit.all',
      'tickets.delete'
    ]
  },
  Accounting: {
    name: 'Accounting',
    description: 'Finance and reconciliation access',
    permissions: [
      'accounts.view.all',
      'contacts.view.all',
      'opportunities.view.all',
      'finance.view.reconciliation',
      'finance.view.all',
      'finance.copy_protection'
    ]
  },
  Administrator: {
    name: 'Administrator',
    description: 'Full system control',
    permissions: Object.values(PERMISSION_CATEGORIES).flatMap(category => 
      category.permissions.map(perm => perm.code)
    )
  }
}

export function RoleEditModal({ isOpen, role, loading = false, error, onClose, onSave }: RoleEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('basic')
  const [showTemplatePreview, setShowTemplatePreview] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [templateApplied, setTemplateApplied] = useState<string | null>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        permissions: role.permissions.map(p => p.code)
      })
      
      // Check if current role matches any template
      const currentPermissions = role.permissions.map(p => p.code)
      for (const [templateName, template] of Object.entries(ROLE_TEMPLATES)) {
        if (JSON.stringify(template.permissions.sort()) === JSON.stringify(currentPermissions.sort())) {
          setTemplateApplied(templateName)
          break
        }
      }
    }
  }, [role])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePermissionToggle = (permissionCode: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionCode)
        ? prev.permissions.filter(p => p !== permissionCode)
        : [...prev.permissions, permissionCode]
    }))
  }

  const handleTemplateSelect = (templateName: string) => {
    const template = ROLE_TEMPLATES[templateName as keyof typeof ROLE_TEMPLATES]
    if (template) {
      setFormData(prev => ({
        ...prev,
        name: template.name,
        description: template.description,
        permissions: template.permissions
      }))
      setSelectedTemplate(templateName)
      setTemplateApplied(templateName)
      setShowTemplatePreview(null)
      setShowSuccessMessage(true)
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccessMessage(false)
      }, 3000)
    }
  }

  const getTemplatePermissions = (templateName: string) => {
    const template = ROLE_TEMPLATES[templateName as keyof typeof ROLE_TEMPLATES]
    if (!template) return []
    
    return template.permissions.map(permissionCode => {
      // Find the permission details from all categories
      for (const category of Object.values(PERMISSION_CATEGORIES)) {
        const permission = category.permissions.find(p => p.code === permissionCode)
        if (permission) {
          return {
            ...permission,
            category: Object.keys(PERMISSION_CATEGORIES).find(key => 
              PERMISSION_CATEGORIES[key as keyof typeof PERMISSION_CATEGORIES] === category
            ) || 'Unknown'
          }
        }
      }
      return null
    }).filter(Boolean)
  }

  const handleSave = async () => {
    if (!role) return
    
    try {
      setSaving(true)
      await onSave(role.id, {
        name: formData.name,
        description: formData.description,
        permissionIds: formData.permissions
      })
      onClose()
    } catch (err) {
      console.error('Error saving role:', err)
    } finally {
      setSaving(false)
    }
  }

  const getPermissionIcon = (permissionCode: string) => {
    if (permissionCode.includes('view')) return <Eye className="h-4 w-4" />
    if (permissionCode.includes('edit')) return <Edit className="h-4 w-4" />
    if (permissionCode.includes('delete')) return <Trash className="h-4 w-4" />
    if (permissionCode.includes('export')) return <Download className="h-4 w-4" />
    if (permissionCode.includes('import')) return <Upload className="h-4 w-4" />
    if (permissionCode.includes('audit')) return <UserCheck className="h-4 w-4" />
    if (permissionCode.includes('copy_protection')) return <Lock className="h-4 w-4" />
    return <Shield className="h-4 w-4" />
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl">
        <div className="flex h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Role Management</p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                {role ? `Edit Role: ${role.name}` : 'Edit Role'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {role ? `${role.userCount} user${role.userCount !== 1 ? 's' : ''} assigned` : ''}
              </p>
              {templateApplied && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                    <CheckCircle className="h-3 w-3 inline mr-1" />
                    {ROLE_TEMPLATES[templateApplied as keyof typeof ROLE_TEMPLATES]?.name} Template Applied
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={onClose}
                className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-600 hover:border-primary-400 hover:text-primary-600"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {showSuccessMessage && templateApplied && (
            <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-md animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-green-700 font-medium">
                  ✅ {ROLE_TEMPLATES[templateApplied as keyof typeof ROLE_TEMPLATES]?.name} template applied successfully!
                </p>
              </div>
              <p className="text-green-600 text-sm mt-1">
                Role name, description, and {ROLE_TEMPLATES[templateApplied as keyof typeof ROLE_TEMPLATES]?.permissions.length} permissions have been updated.
              </p>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full">
              {/* Sidebar Navigation */}
              <div className="w-64 border-r border-gray-200 bg-gray-50 p-4">
                <nav className="space-y-2">
                  <button
                    onClick={() => setActiveTab('basic')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'basic' 
                        ? 'bg-primary-100 text-primary-700' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Basic Information
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('templates')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'templates' 
                        ? 'bg-primary-100 text-primary-700' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Role Templates
                    </div>
                  </button>
                  {Object.entries(PERMISSION_CATEGORIES).map(([categoryName, category]) => {
                    const Icon = category.icon
                    return (
                      <button
                        key={categoryName}
                        onClick={() => setActiveTab(categoryName.toLowerCase())}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === categoryName.toLowerCase() 
                            ? 'bg-primary-100 text-primary-700' 
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {categoryName}
                        </div>
                      </button>
                    )
                  })}
                </nav>
              </div>

              {/* Main Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'basic' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Role Name
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Enter role name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                          </label>
                          <textarea
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Enter role description"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'templates' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Templates</h3>
                      <p className="text-sm text-gray-600 mb-6">
                        Select a predefined template to quickly configure common role permissions.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(ROLE_TEMPLATES).map(([templateName, template]) => {
                          const isApplied = templateApplied === templateName
                          const isSelected = selectedTemplate === templateName
                          
                          return (
                            <div
                              key={templateName}
                              className={`relative p-4 border-2 rounded-lg transition-all duration-200 ${
                                isApplied 
                                  ? 'border-green-300 bg-green-50 shadow-md' 
                                  : isSelected
                                  ? 'border-primary-300 bg-primary-50 shadow-sm'
                                  : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                              }`}
                            >
                              {/* Applied Badge */}
                              {isApplied && (
                                <div className="absolute -top-2 -right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                                  Applied
                                </div>
                              )}
                              
                              <button
                                onClick={() => handleTemplateSelect(templateName)}
                                className="w-full text-left"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className={`font-semibold ${isApplied ? 'text-green-800' : 'text-gray-900'}`}>
                                    {template.name}
                                  </h4>
                                  {isApplied && (
                                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                                  )}
                                </div>
                                <p className={`text-sm mb-3 ${isApplied ? 'text-green-700' : 'text-gray-600'}`}>
                                  {template.description}
                                </p>
                                <div className="flex items-center justify-between">
                                  <div className={`flex items-center text-xs ${isApplied ? 'text-green-600' : 'text-gray-500'}`}>
                                    <Shield className="h-3 w-3 mr-1" />
                                    {template.permissions.length} permissions
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowTemplatePreview(showTemplatePreview === templateName ? null : templateName)
                                    }}
                                    className={`text-xs flex items-center gap-1 transition-colors ${
                                      isApplied 
                                        ? 'text-green-600 hover:text-green-800' 
                                        : 'text-primary-600 hover:text-primary-800'
                                    }`}
                                  >
                                    <Info className="h-3 w-3" />
                                    {showTemplatePreview === templateName ? 'Hide' : 'Preview'}
                                  </button>
                                </div>
                              </button>
                              
                              {/* Template Preview */}
                              {showTemplatePreview === templateName && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    Included Permissions
                                  </h5>
                                  <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {getTemplatePermissions(templateName).map((permission, index) => (
                                      <div key={index} className="flex items-start gap-2 text-sm">
                                        <div className="flex-shrink-0 mt-0.5">
                                          {permission && getPermissionIcon(permission.code)}
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-medium text-gray-900">{permission?.name}</div>
                                          <div className="text-xs text-gray-500">{permission?.category}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <button
                                      onClick={() => handleTemplateSelect(templateName)}
                                      className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                        isApplied
                                          ? 'bg-green-600 text-white hover:bg-green-700'
                                          : 'bg-primary-600 text-white hover:bg-primary-700'
                                      }`}
                                    >
                                      {isApplied ? (
                                        <div className="flex items-center justify-center gap-2">
                                          <CheckCircle className="h-4 w-4" />
                                          Template Applied
                                        </div>
                                      ) : (
                                        'Apply This Template'
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {Object.entries(PERMISSION_CATEGORIES).map(([categoryName, category]) => {
                  if (activeTab !== categoryName.toLowerCase()) return null
                  
                  const Icon = category.icon
                  return (
                    <div key={categoryName} className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${category.bgColor}`}>
                          <Icon className={`h-6 w-6 ${category.color}`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{categoryName} Permissions</h3>
                          <p className="text-sm text-gray-600">
                            Configure access controls for {categoryName.toLowerCase()} module
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {category.permissions.map((permission) => {
                          const isSelected = formData.permissions.includes(permission.code)
                          return (
                            <div
                              key={permission.code}
                              className={`p-4 border rounded-lg transition-colors ${
                                isSelected 
                                  ? 'border-primary-200 bg-primary-50' 
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handlePermissionToggle(permission.code)}
                                  className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? 'bg-primary-600 border-primary-600 text-white'
                                      : 'border-gray-300 hover:border-primary-400'
                                  }`}
                                >
                                  {isSelected && (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {getPermissionIcon(permission.code)}
                                    <h4 className="font-medium text-gray-900">{permission.name}</h4>
                                  </div>
                                  <p className="text-sm text-gray-600">{permission.description}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
