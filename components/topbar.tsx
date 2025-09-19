'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus, RotateCcw, MessageSquare, Settings, ChevronLeft, Bell, LogOut, User } from 'lucide-react'
import { getPageTitle } from '@/lib/nav'
import { useAuth } from '@/lib/auth-context'

export function Topbar() {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const pageTitle = getPageTitle(pathname)
  const { user, logout } = useAuth()

  return (
    <div className="relative z-40 bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Breadcrumb and Back button */}
        <div className="flex items-center space-x-4">
          <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <nav className="flex items-center space-x-2 text-sm">
            <Link 
              href="/" 
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Home
            </Link>
            <span className="text-gray-400">|</span>
            <span className="text-gray-900 font-medium">{pageTitle}</span>
          </nav>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-3">
          {/* Add button */}
          <button className="inline-flex items-center px-3 py-1.5 bg-primary-900 text-white text-sm font-medium rounded-lg hover:bg-primary-800 transition-colors">
            <Plus className="h-4 w-4 mr-1.5" />
            Add
          </button>

          {/* Refresh button */}
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Messages button */}
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors relative">
            <MessageSquare className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
          </button>

          {/* Notifications button */}
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <Bell className="h-4 w-4" />
          </button>

          {/* Settings button */}
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <Settings className="h-4 w-4" />
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              {user && (
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium">{user.fullName}</div>
                  <div className="text-xs text-gray-500">{user.role?.name}</div>
                </div>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                {user && (
                  <>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      <div className="text-xs text-gray-400">{user.role?.name}</div>
                    </div>
                    <Link
                      href="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        logout()
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
