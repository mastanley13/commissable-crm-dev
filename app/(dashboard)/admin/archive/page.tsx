'use client'

import Link from 'next/link'
import { Archive, Activity, BarChart3, Building2, Calendar, DollarSign, Grid3X3, Layers, Ticket, Users } from 'lucide-react'

const archiveSections = [
  {
    title: 'Archived Accounts',
    description: 'View and restore accounts that were deleted (archived) from the Accounts module.',
    href: '/admin/archive/accounts',
    icon: Building2,
    color: 'bg-slate-600',
  },
  {
    title: 'Archived Contacts',
    description: 'View and restore contacts that were deleted from the Contacts module.',
    href: '/admin/archive/contacts',
    icon: Users,
    color: 'bg-blue-600',
  },
  {
    title: 'Archived Opportunities',
    description: 'Review inactive opportunities and permanently delete or restore them.',
    href: '/admin/archive/opportunities',
    icon: DollarSign,
    color: 'bg-emerald-600',
  },
  {
    title: 'Archived Revenue Schedules',
    description: 'View and restore deleted revenue schedules.',
    href: '/admin/archive/revenue-schedules',
    icon: Calendar,
    color: 'bg-indigo-600',
  },
  {
    title: 'Archived Catalog / Products',
    description: 'Review inactive products and restore or permanently delete them.',
    href: '/admin/archive/products',
    icon: Grid3X3,
    color: 'bg-amber-600',
  },
  {
    title: 'Archived Groups',
    description: 'Review inactive groups and restore or permanently delete them.',
    href: '/admin/archive/groups',
    icon: Layers,
    color: 'bg-purple-600',
  },
  {
    title: 'Archived Reports',
    description: 'Review inactive reports and restore them if needed.',
    href: '/admin/archive/reports',
    icon: BarChart3,
    color: 'bg-gray-700',
  },
  {
    title: 'Archived Tickets',
    description: 'Review closed tickets and reopen or permanently delete them.',
    href: '/admin/archive/tickets',
    icon: Ticket,
    color: 'bg-rose-600',
  },
  {
    title: 'Archived Activities',
    description: 'Review completed activities and reopen or permanently delete them.',
    href: '/admin/archive/activities',
    icon: Activity,
    color: 'bg-teal-600',
  },
] as const

export default function AdminArchivePage() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Archive</h1>
          <p className="text-gray-600">Review recently deleted records and restore them if needed.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {archiveSections.map((section) => {
            const Icon = section.icon
            return (
              <Link key={section.href} href={section.href}>
                <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="flex items-start space-x-4">
                    <div className={`${section.color} rounded-lg p-3 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {section.title}
                      </h3>
                      <p className="text-gray-600 text-sm">{section.description}</p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-8 flex items-center gap-2 text-xs text-gray-500">
          <Archive className="h-4 w-4" aria-hidden="true" />
          <span>Archive stores soft-deleted records until they are permanently deleted.</span>
        </div>
      </div>
    </div>
  )
}
