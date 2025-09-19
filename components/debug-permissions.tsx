'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect } from 'react'

export function DebugPermissions() {
  const { hasAnyPermission, hasPermission, user, refreshAuth } = useAuth()
  
  useEffect(() => {
    console.log('🔍 PERMISSION DEBUG:')
    console.log('===================')
    console.log('User:', user)
    console.log('User Role:', user?.role)
    console.log('User Permissions:', user?.role?.permissions)
    console.log('Total Permissions:', user?.role?.permissions?.length || 0)
    
    // Check specific permissions
    const hasDataMgmt = hasPermission('admin.data_management')
    const hasDataMgmtView = hasPermission('admin.data_management.view')
    
    console.log('Permission Checks:')
    console.log('  admin.data_management:', hasDataMgmt)
    console.log('  admin.data_management.view:', hasDataMgmtView)
    
    // List all admin permissions
    const adminPerms = user?.role?.permissions?.filter(p => p.code.startsWith('admin.')) || []
    console.log('All Admin Permissions:')
    adminPerms.forEach(p => {
      console.log('  ✓', p.code, '-', p.name)
    })
    
    // Check for data management permissions specifically
    const dataMgmtPerms = user?.role?.permissions?.filter(p => 
      p.code.includes('data_management') || 
      p.code.includes('admin.backup') ||
      p.code.includes('admin.restore')
    ) || []
    console.log('Data Management Permissions:')
    dataMgmtPerms.forEach(p => {
      console.log('  ✓', p.code, '-', p.name)
    })
    
  }, [user, hasPermission])
  
  return (
    <div className="bg-yellow-100 border border-yellow-400 p-4 m-4 rounded">
      <h3 className="font-bold text-yellow-800">🔍 Permission Debug Info</h3>
      <div className="text-sm text-yellow-700">
        <p>User: {user?.fullName || 'Not loaded'}</p>
        <p>Role: {user?.role?.name || 'Not loaded'}</p>
        <p>Total Permissions: {user?.role?.permissions?.length || 0}</p>
        <p>Has admin.data_management: {hasPermission('admin.data_management') ? '✅' : '❌'}</p>
        <p>Has admin.data_management.view: {hasPermission('admin.data_management.view') ? '✅' : '❌'}</p>
        <p>Can Access Data Management: {(hasPermission('admin.data_management') || hasPermission('admin.data_management.view')) ? '✅' : '❌'}</p>
        
        <div className="mt-3">
          <button 
            onClick={() => {
              console.log('🔄 Forcing auth refresh...')
              refreshAuth()
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium"
          >
            🔄 Refresh Auth Data
          </button>
        </div>
      </div>
    </div>
  )
}
