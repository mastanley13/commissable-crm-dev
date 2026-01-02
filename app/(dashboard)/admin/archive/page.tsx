'use client'

import Link from 'next/link'
import { Archive, Building2 } from 'lucide-react'

export default function AdminArchivePage() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Archive</h1>
          <p className="text-gray-600">Review recently deleted records and restore them if needed.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/archive/accounts">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer group">
              <div className="flex items-start space-x-4">
                <div className="bg-slate-600 rounded-lg p-3 group-hover:scale-110 transition-transform">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    Archived Accounts
                  </h3>
                  <p className="text-gray-600 text-sm">
                    View and restore accounts that were deleted (archived) from the Accounts module.
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-8 flex items-center gap-2 text-xs text-gray-500">
          <Archive className="h-4 w-4" aria-hidden="true" />
          <span>Archive stores soft-deleted records until they are permanently deleted.</span>
        </div>
      </div>
    </div>
  )
}

