'use client'

import Link from 'next/link'
import { ListHeader } from '@/components/list-header'
import { 
  Upload, 
  Download, 
  Database, 
  Archive, 
  RefreshCw, 
  Shield,
  FileText,
  HardDrive,
  Cloud,
  Trash2,
  BarChart,
  PieChart,
  LineChart,
  TrendingUp
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

const dataManagementOptions = [
  {
    title: 'Import & Export Data',
    description: 'Import data from CSV/Excel files or export existing data',
    href: '/import-export-demo',
    icon: Upload,
    color: 'bg-blue-500',
    category: 'Data Transfer',
    permissions: ['accounts.import', 'accounts.export', 'contacts.import', 'contacts.export']
  },
  {
    title: 'Data Backup',
    description: 'Create and manage system backups',
    href: '#',
    icon: Archive,
    color: 'bg-green-500',
    category: 'Backup & Recovery',
    permissions: ['admin.backup']
  },
  {
    title: 'Data Restore',
    description: 'Restore data from previous backups',
    href: '#',
    icon: RefreshCw,
    color: 'bg-orange-500',
    category: 'Backup & Recovery',
    permissions: ['admin.restore']
  },
  {
    title: 'Data Cleanup',
    description: 'Clean up old or unused data',
    href: '#',
    icon: Trash2,
    color: 'bg-red-500',
    category: 'Maintenance',
    permissions: ['admin.cleanup']
  },
  {
    title: 'Database Maintenance',
    description: 'Optimize and maintain database performance',
    href: '#',
    icon: Database,
    color: 'bg-purple-500',
    category: 'Maintenance',
    permissions: ['admin.database']
  },
  {
    title: 'Data Migration',
    description: 'Migrate data between systems or versions',
    href: '#',
    icon: HardDrive,
    color: 'bg-indigo-500',
    category: 'Migration',
    permissions: ['admin.migration']
  },
  {
    title: 'Data Validation',
    description: 'Validate data integrity and consistency',
    href: '#',
    icon: Shield,
    color: 'bg-yellow-500',
    category: 'Quality Assurance',
    permissions: ['admin.validate']
  },
  {
    title: 'Report Generation',
    description: 'Generate system reports and analytics',
    href: '#',
    icon: FileText,
    color: 'bg-teal-500',
    category: 'Reporting',
    permissions: ['admin.reports']
  },
  {
    title: 'Cloud Sync',
    description: 'Synchronize data with cloud services',
    href: '#',
    icon: Cloud,
    color: 'bg-cyan-500',
    category: 'Integration',
    permissions: ['admin.cloud']
  }
]

const categories = [
  'Data Transfer',
  'Backup & Recovery', 
  'Maintenance',
  'Migration',
  'Quality Assurance',
  'Reporting',
  'Integration'
]

export default function DataManagementPage() {
  const { hasAnyPermission, hasPermission } = useAuth()
  
  // Check if user has access to data management
  const canAccessDataManagement = hasPermission('admin.data_management') || hasPermission('admin.data_management.view')

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Data Transfer':
        return 'border-blue-200 bg-blue-50'
      case 'Backup & Recovery':
        return 'border-green-200 bg-green-50'
      case 'Maintenance':
        return 'border-red-200 bg-red-50'
      case 'Migration':
        return 'border-indigo-200 bg-indigo-50'
      case 'Quality Assurance':
        return 'border-yellow-200 bg-yellow-50'
      case 'Reporting':
        return 'border-teal-200 bg-teal-50'
      case 'Integration':
        return 'border-cyan-200 bg-cyan-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Data Transfer':
        return Upload
      case 'Backup & Recovery':
        return Archive
      case 'Maintenance':
        return Database
      case 'Migration':
        return HardDrive
      case 'Quality Assurance':
        return Shield
      case 'Reporting':
        return FileText
      case 'Integration':
        return Cloud
      default:
        return Database
    }
  }

  const filteredOptions = dataManagementOptions.filter(option => 
    hasAnyPermission(option.permissions)
  )

  const groupedOptions = categories.reduce((acc, category) => {
    const options = filteredOptions.filter(option => option.category === category)
    if (options.length > 0) {
      acc[category] = options
    }
    return acc
  }, {} as Record<string, typeof dataManagementOptions>)

  return (
    <div className="h-full flex flex-col">
      <ListHeader
        title="Data Management"
        searchPlaceholder="Search data management options..."
        showCreateButton={false}
      />
      
      <div className="flex-1 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Data Management Center</h1>
          <p className="text-gray-600">
            Manage your data with powerful import/export tools, backup solutions, and maintenance utilities
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">1,234</div>
                <div className="text-sm text-gray-600">Total Records</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Archive className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">12</div>
                <div className="text-sm text-gray-600">Backups</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Upload className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">5</div>
                <div className="text-sm text-gray-600">Recent Imports</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Download className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">8</div>
                <div className="text-sm text-gray-600">Recent Exports</div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Import & Export Section */}
        {canAccessDataManagement && (hasPermission('accounts.import') || hasPermission('contacts.import') || hasPermission('accounts.export') || hasPermission('contacts.export')) && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-500 rounded-lg">
                  <Upload className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Import & Export Data</h2>
                  <p className="text-gray-600">Quick access to data transfer tools</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/import-export-demo">
                  <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-shadow cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500 rounded-lg group-hover:scale-110 transition-transform">
                        <Upload className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          Import & Export Center
                        </h3>
                        <p className="text-sm text-gray-600">
                          Import data from CSV/Excel files or export existing data
                        </p>
                      </div>
                      <div className="text-blue-600 group-hover:text-blue-800">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
                
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Quick Actions</h3>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Link href="/import-export-demo">
                      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                        <Upload className="h-4 w-4" />
                        <span className="font-medium">Open Import & Export Demo</span>
                      </button>
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      {hasPermission('accounts.import') && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Import Accounts</span>
                      )}
                      {hasPermission('contacts.import') && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Import Contacts</span>
                      )}
                      {hasPermission('accounts.export') && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Export Accounts</span>
                      )}
                      {hasPermission('contacts.export') && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Export Contacts</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Management Options by Category */}
        {canAccessDataManagement && Object.entries(groupedOptions).map(([category, options]) => {
          const CategoryIcon = getCategoryIcon(category)
          return (
            <div key={category} className="mb-8">
              <div className={`rounded-lg border p-4 mb-4 ${getCategoryColor(category)}`}>
                <div className="flex items-center gap-3">
                  <CategoryIcon className="h-5 w-5 text-gray-700" />
                  <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
                  <span className="text-sm text-gray-600">({options.length} options)</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {options.map((option, index) => {
                  const Icon = option.icon
                  const isAvailable = option.href !== '#'
                  
                  return (
                    <Link key={index} href={option.href}>
                      <div className={`bg-white rounded-lg border border-gray-200 p-6 transition-all duration-200 ${
                        isAvailable 
                          ? 'hover:shadow-lg cursor-pointer group' 
                          : 'opacity-60 cursor-not-allowed'
                      }`}>
                        <div className="flex items-start space-x-4">
                          <div className={`${option.color} rounded-lg p-3 ${
                            isAvailable ? 'group-hover:scale-110 transition-transform' : ''
                          }`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className={`text-lg font-semibold ${
                                isAvailable 
                                  ? 'text-gray-900 group-hover:text-blue-600 transition-colors' 
                                  : 'text-gray-500'
                              }`}>
                                {option.title}
                              </h3>
                              {!isAvailable && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                  Coming Soon
                                </span>
                              )}
                            </div>
                            <p className={`text-sm ${
                              isAvailable ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              {option.description}
                            </p>
                            {isAvailable && (
                              <div className="mt-3">
                                <span className="inline-flex items-center text-xs text-blue-600 font-medium">
                                  Access Tool →
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* No Permissions Message */}
        {!canAccessDataManagement && (
          <div className="text-center py-12">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 max-w-md mx-auto">
              <Shield className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                Access Restricted
              </h3>
              <p className="text-yellow-800 text-sm">
                You don't have permission to access the Data Management Center. 
                Please contact your administrator for access.
              </p>
            </div>
          </div>
        )}

        {/* Show content only if user has access */}
        {canAccessDataManagement && filteredOptions.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 max-w-md mx-auto">
              <Database className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                No Tools Available
              </h3>
              <p className="text-blue-800 text-sm">
                You have access to the Data Management Center, but no specific tools are available with your current permissions.
              </p>
            </div>
          </div>
        )}

        {/* Data Analytics Section with Mock Graphs */}
        {canAccessDataManagement && (
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-900">Data Analytics</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
              {/* Bar Chart */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900">Data Distribution</h3>
                  <BarChart className="h-5 w-5 text-gray-400" />
                </div>
                <div className="h-64 flex items-end justify-between gap-2 pb-6 pt-4 border-b border-gray-200">
                  <div className="flex flex-col items-center">
                    <div className="w-12 bg-blue-500 rounded-t-md" style={{ height: '30%' }}></div>
                    <span className="text-xs text-gray-600 mt-2">Mon</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 bg-blue-500 rounded-t-md" style={{ height: '60%' }}></div>
                    <span className="text-xs text-gray-600 mt-2">Tue</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 bg-blue-500 rounded-t-md" style={{ height: '45%' }}></div>
                    <span className="text-xs text-gray-600 mt-2">Wed</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 bg-blue-500 rounded-t-md" style={{ height: '80%' }}></div>
                    <span className="text-xs text-gray-600 mt-2">Thu</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 bg-blue-500 rounded-t-md" style={{ height: '65%' }}></div>
                    <span className="text-xs text-gray-600 mt-2">Fri</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-500">Weekly Imports</div>
                  <div className="text-sm font-medium text-gray-900">1,245 records</div>
                </div>
              </div>
              
              {/* Pie Chart */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900">Data Types</h3>
                  <PieChart className="h-5 w-5 text-gray-400" />
                </div>
                <div className="h-64 flex items-center justify-center">
                  <div className="relative w-48 h-48">
                    {/* Mock Pie Chart */}
                    <div className="absolute inset-0 rounded-full border-8 border-transparent" 
                         style={{ 
                           background: 'conic-gradient(#3B82F6 0% 45%, #10B981 45% 65%, #F59E0B 65% 85%, #6366F1 85% 100%)',
                           clipPath: 'circle(50%)'
                         }}>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white rounded-full w-24 h-24 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-900">1,234 total</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-gray-600">Accounts (45%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-600">Contacts (20%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    <span className="text-xs text-gray-600">Products (20%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                    <span className="text-xs text-gray-600">Other (15%)</span>
                  </div>
                </div>
              </div>
              
              {/* Line Chart */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900">Data Growth</h3>
                  <LineChart className="h-5 w-5 text-gray-400" />
                </div>
                <div className="h-64 relative">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pb-6">
                    <div className="border-b border-gray-100 h-0"></div>
                    <div className="border-b border-gray-100 h-0"></div>
                    <div className="border-b border-gray-100 h-0"></div>
                    <div className="border-b border-gray-100 h-0"></div>
                    <div className="border-b border-gray-200 h-0"></div>
                  </div>
                  
                  {/* Line Chart */}
                  <div className="absolute inset-0 flex items-end pt-6 pb-6">
                    <svg className="w-full h-full" viewBox="0 0 300 200" preserveAspectRatio="none">
                      {/* Blue line - Accounts */}
                      <path 
                        d="M0,180 L50,160 L100,140 L150,100 L200,80 L250,50 L300,30" 
                        fill="none" 
                        stroke="#3B82F6" 
                        strokeWidth="2"
                      />
                      {/* Green line - Contacts */}
                      <path 
                        d="M0,190 L50,180 L100,170 L150,150 L200,120 L250,100 L300,70" 
                        fill="none" 
                        stroke="#10B981" 
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  
                  {/* X-axis labels */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
                    <span className="text-xs text-gray-500">Jan</span>
                    <span className="text-xs text-gray-500">Feb</span>
                    <span className="text-xs text-gray-500">Mar</span>
                    <span className="text-xs text-gray-500">Apr</span>
                    <span className="text-xs text-gray-500">May</span>
                    <span className="text-xs text-gray-500">Jun</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-1 bg-blue-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Accounts</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-1 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Contacts</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-900">+28% growth</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {canAccessDataManagement && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Upload className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Accounts Import Completed</p>
                    <p className="text-xs text-gray-500">150 records imported successfully • 2 hours ago</p>
                  </div>
                  <span className="text-xs text-green-600 font-medium">Success</span>
                </div>
                
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Download className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Contacts Export Generated</p>
                    <p className="text-xs text-gray-500">CSV file with 89 contacts • 4 hours ago</p>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">Ready</span>
                </div>
                
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Archive className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">System Backup Created</p>
                    <p className="text-xs text-gray-500">Full database backup • 1 day ago</p>
                  </div>
                  <span className="text-xs text-orange-600 font-medium">Completed</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
