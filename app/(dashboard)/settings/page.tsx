'use client'

import { useState } from 'react'
import { Settings, User, Bell, Shield, Mail, Globe, Database, Palette, BarChart3 } from 'lucide-react'
import { ReconciliationSettingsForm } from '@/components/reconciliation-settings-form'

type SettingsSection = {
  id: string
  title: string
  icon: any
  description: string
}

const settingsSections: SettingsSection[] = [
  {
    id: 'profile',
    title: 'Profile Settings',
    icon: User,
    description: 'Manage your personal profile information'
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Bell,
    description: 'Configure email and system notifications'
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    icon: Shield,
    description: 'Password, two-factor authentication, and privacy settings'
  },
  {
    id: 'email',
    title: 'Email Configuration',
    icon: Mail,
    description: 'Email server settings and templates'
  },
  {
    id: 'general',
    title: 'General Settings',
    icon: Settings,
    description: 'Application-wide settings and preferences'
  },
  {
    id: 'reconciliation',
    title: 'Reconciliation Settings',
    icon: BarChart3,
    description: 'Configure reconciliation matching and processing defaults'
  },
  {
    id: 'localization',
    title: 'Localization',
    icon: Globe,
    description: 'Language, timezone, and regional settings'
  },
  {
    id: 'integrations',
    title: 'Integrations',
    icon: Database,
    description: 'Third-party integrations and API settings'
  },
  {
    id: 'appearance',
    title: 'Appearance',
    icon: Palette,
    description: 'Theme, layout, and display preferences'
  }
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile')

  const renderSettingsContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md" defaultValue="Administrator User" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-md" defaultValue="admin@commissable.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" className="w-full px-3 py-2 border border-gray-300 rounded-md" defaultValue="+1-555-123-4567" />
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Save Changes</button>
            </div>
          </div>
        )
      case 'notifications':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Email Notifications</h4>
                  <p className="text-sm text-gray-600">Receive email notifications for important updates</p>
                </div>
                <input type="checkbox" className="h-4 w-4" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">System Alerts</h4>
                  <p className="text-sm text-gray-600">Get notified about system maintenance and updates</p>
                </div>
                <input type="checkbox" className="h-4 w-4" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">New User Registration</h4>
                  <p className="text-sm text-gray-600">Notify when new users register in the system</p>
                </div>
                <input type="checkbox" className="h-4 w-4" />
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Save Settings</button>
            </div>
          </div>
        )
      case 'general':
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">General Application Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md" defaultValue="Commissable" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Save Settings</button>
            </div>
          </div>
        )
      case 'reconciliation':
        return <ReconciliationSettingsForm />
      default:
        return (
          <div className="text-center py-12">
            <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Settings Section</h3>
            <p className="text-gray-600">This settings section will be implemented soon.</p>
          </div>
        )
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex">
        {/* Settings Navigation */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
          <nav className="space-y-1">
            {settingsSections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="h-4 w-4 mr-3" />
                    <span>{section.title}</span>
                  </div>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {renderSettingsContent()}
          </div>
        </div>
      </div>
    </div>
  )
}