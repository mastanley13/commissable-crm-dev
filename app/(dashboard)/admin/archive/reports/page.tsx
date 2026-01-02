'use client'

import Link from 'next/link'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { useAuth } from '@/lib/auth-context'

export default function AdminArchivedReportsPage() {
  const { hasPermission, user } = useAuth()
  const canManageArchive = hasPermission('accounts.manage') || hasPermission('admin.audit.access')

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Reports</h1>
        <p className="mt-2 text-sm text-gray-600">Access denied. You do not have permission to view archived reports.</p>
        {user?.role?.name ? <p className="mt-2 text-xs text-gray-500">Role: {user.role.name}</p> : null}
      </div>
    )
  }

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Reports</h1>
        <p className="mt-2 text-sm text-gray-600">
          Reports are currently served from in-memory mock data and do not support archive/restore yet.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/reports" className="text-blue-600 hover:underline">
            Go to Reports
          </Link>
        </p>
      </div>
    </CopyProtectionWrapper>
  )
}

