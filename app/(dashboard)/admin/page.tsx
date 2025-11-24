'use client'

import Link from 'next/link'
import { Shield, Users, Settings, Key, Database, UserCheck, Beaker, Shuffle } from 'lucide-react'

const adminSections = [
  {
    title: 'User Management',
    description: 'Manage system users and their access',
    href: '/admin/users',
    icon: Users,
    color: 'bg-blue-500'
  },
  {
    title: 'User Reassignment',
    description: 'Reassign accounts from a departing user to a new owner',
    href: '/admin/user-reassignment',
    icon: Shuffle,
    color: 'bg-emerald-500'
  },
  {
    title: 'Role Management',
    description: 'Configure user roles and permissions',
    href: '/admin/roles',
    icon: Shield,
    color: 'bg-indigo-500'
  },
  {
    title: 'System Settings',
    description: 'Configure global system settings',
    href: '/settings',
    icon: Settings,
    color: 'bg-gray-500'
  },
  {
    title: 'Security Settings',
    description: 'Manage authentication and security policies',
    href: '#',
    icon: Key,
    color: 'bg-red-500'
  },
  // {
  //   title: 'Data Management',
  //   description: 'Import/export data and manage backups',
  //   href: '/admin/data-management',
  //   icon: Database,
  //   color: 'bg-green-500'
  // },
  {
    title: 'Audit Logs',
    description: 'View system activity and user actions',
    href: '#',
    icon: UserCheck,
    color: 'bg-purple-500'
  },
  {
    title: 'Prototype Playground',
    description: 'Explore in-progress prototype pages',
    href: '/admin/prototypes',
    icon: Beaker,
    color: 'bg-amber-500'
  }
]

export default function AdminPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Administration Panel</h1>
          <p className="text-gray-600">Manage users, roles, and system configurations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminSections.map((section, index) => {
            const Icon = section.icon
            return (
              <Link key={index} href={section.href}>
                <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="flex items-start space-x-4">
                    <div className={`${section.color} rounded-lg p-3 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {section.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Quick Stats */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">System Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-2xl font-bold text-blue-600 mb-1">3</div>
              <div className="text-sm text-gray-600">Active Users</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-2xl font-bold text-indigo-600 mb-1">3</div>
              <div className="text-sm text-gray-600">User Roles</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-2xl font-bold text-green-600 mb-1">99.9%</div>
              <div className="text-sm text-gray-600">System Uptime</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-2xl font-bold text-purple-600 mb-1">1,234</div>
              <div className="text-sm text-gray-600">Total Records</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
