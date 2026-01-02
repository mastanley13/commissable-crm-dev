'use client'

import Link from 'next/link'
import { Shield, Users, Settings, Key, Database, UserCheck, Beaker, Shuffle, Archive } from 'lucide-react'
import { AdminSystemOverview } from '@/components/admin-system-overview'

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
    title: 'Data Settings',
    description: 'Manage master data and allowed values',
    href: '/admin/data-settings',
    icon: Database,
    color: 'bg-green-500'
  },
  {
    title: 'Archive',
    description: 'Review and restore deleted records',
    href: '/admin/archive',
    icon: Archive,
    color: 'bg-slate-600'
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminSections.map((section, index) => {
            const Icon = section.icon
            return (
              <Link key={index} href={section.href}>
                <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="flex items-start space-x-3">
                    <div className={`${section.color} rounded-lg p-2 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
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

        <AdminSystemOverview />
      </div>
    </div>
  )
}
