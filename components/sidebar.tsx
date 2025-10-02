'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { navigation } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Settings, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { user, logout } = useAuth()

  return (
    <div className={cn(
      // Sidebar container with subtle gradient and overlap above content - allows highlight overflow
      "relative z-20 bg-gradient-to-b from-primary-900 to-primary-800 text-white transition-all duration-300 flex flex-col h-screen",
      collapsed ? "w-16" : "w-64"
    )}
    style={{ overflow: 'visible' }}
    >
      {/* Header */}
      <div id="sidebar-header" className="relative p-4 pb-6 border-b border-sidebar-dark rounded-br-[40px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center p-1">
              <Image 
                src="/commissable-logo.png" 
                alt="Commissable Logo" 
                width={24} 
                height={24}
                className="object-contain"
                style={{ width: 'auto', height: 'auto' }}
              />
            </div>
            {!collapsed && (
              <span className="font-semibold text-lg">COMMISSABLE</span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white hover:bg-sidebar-dark p-1.5 rounded transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
        {/* Header notch removed in favor of a cleaner continuous rail */}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-visible">
        <ul className="relative space-y-3 overflow-visible">
          {navigation.map((item) => {
            // Enhanced active state detection - highlights module even on detail pages
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
            const Icon = item.icon

            return (
              <li key={item.name} className="relative z-10 group">
                {/* Fluid highlight background that flows toward content area */}
                {isActive ? (
                  <>
                    {/* Main highlight base - active state */}
                    <div className="absolute inset-y-0 left-0 right-0 bg-white transition-all duration-300 ease-out z-[5]"
                         style={{
                           boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.12), 0 4px 10px -3px rgba(0, 0, 0, 0.08)'
                         }} />
                    {/* Fluid extension that appears to flow into content */}
                    <div className="absolute inset-y-1 right-0 w-8 bg-white transition-all duration-300 ease-out z-[6]"
                         style={{
                           clipPath: 'polygon(0% 0%, 75% 10%, 95% 30%, 100% 50%, 95% 70%, 75% 90%, 0% 100%)',
                           filter: 'drop-shadow(3px 0 6px rgba(0, 0, 0, 0.08))'
                         }} />
                    {/* Subtle inner glow for depth */}
                    <div className="absolute inset-y-0 left-0 right-0 transition-opacity duration-300 z-[7]"
                         style={{
                           background: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 60%, rgba(59,130,246,0.12) 85%, rgba(59,130,246,0.18) 100%)'
                         }} />
                  </>
                ) : (
                  /* Subtle hover preview of fluid effect */
                  <div className="absolute inset-y-0 left-0 right-0 bg-white/0 group-hover:bg-white/8 transition-all duration-300 ease-out opacity-0 group-hover:opacity-100"
                       style={{
                         boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.05)'
                       }} />
                )}
                <Link
                  href={item.href}
                  className={cn(
                    // Fluid highlight styling - clean interaction states with no conflicting backgrounds
                    "relative flex items-center px-6 py-2.5 text-sm transition-all duration-200 z-10",
                    isActive
                      ? "text-sidebar font-medium"
                      : "text-blue-100 hover:text-white",
                    collapsed && "justify-center"
                  )}
                  data-nav-active={isActive ? 'true' : undefined}
                  title={collapsed ? item.name : undefined}
                >
                  {/* Icon */}
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0",
                    !collapsed && "mr-3",
                    isActive ? "text-sidebar" : "text-blue-200 group-hover:text-white"
                  )} />
                  {!collapsed && (
                    <span className="truncate">{item.name}</span>
                  )}

                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="relative p-4 border-t border-sidebar-dark">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center hover:bg-sidebar-dark rounded-lg p-2 transition-colors"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-medium">
              {user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'A'}
            </span>
          </div>
          {!collapsed && user && (
            <div className="ml-3 text-left">
              <p className="text-sm font-medium text-white">{user.fullName}</p>
              <p className="text-xs text-blue-200">{user.role?.name}</p>
            </div>
          )}
        </button>

        {showUserMenu && (
          <div className="absolute bottom-full left-4 right-4 mb-2 rounded-md border border-gray-200 bg-white py-1 shadow-lg z-50">
            {user && (
              <>
                <div className="border-b border-gray-100 px-4 py-2">
                  <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                  <div className="text-xs text-gray-400">{user.role?.name}</div>
                </div>
                <Link
                  href="/settings"
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    logout()
                  }}
                  className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

