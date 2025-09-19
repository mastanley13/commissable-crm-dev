import Link from 'next/link'
import { Building2, Users, Target, Calendar, Package, GitCompare, Users2, FileText } from 'lucide-react'

const quickStats = [
  {
    name: 'Total Accounts',
    value: '11',
    icon: Building2,
    href: '/accounts',
    color: 'bg-blue-500'
  },
  {
    name: 'Total Contacts',
    value: '17',
    icon: Building2,
    href: '/contacts',
    color: 'bg-green-500'
  },
  {
    name: 'Opportunities',
    value: '23',
    icon: Target,
    href: '/opportunities',
    color: 'bg-purple-500'
  },
  {
    name: 'Products',
    value: '45',
    icon: Package,
    href: '/products',
    color: 'bg-orange-500'
  }
]

const recentActivity = [
  {
    id: 1,
    type: 'account',
    description: 'New account "Tech Corp" was created',
    time: '2 hours ago',
    user: 'John Doe'
  },
  {
    id: 2,
    type: 'contact',
    description: 'Contact "Jane Smith" was updated',
    time: '4 hours ago',
    user: 'Sarah Wilson'
  },
  {
    id: 3,
    type: 'opportunity',
    description: 'Opportunity "Q1 Sales Deal" moved to closing',
    time: '6 hours ago',
    user: 'Mike Johnson'
  },
  {
    id: 4,
    type: 'task',
    description: 'Follow-up call scheduled with ABC Company',
    time: '1 day ago',
    user: 'Lisa Brown'
  }
]

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Commissable CRM</h1>
        <p className="text-gray-600">
          Manage your customer relationships, track opportunities, and grow your business.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.time} • by {activity.user}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/activities"
            className="block mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all activities →
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/accounts"
              className="flex items-center p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Building2 className="h-5 w-5 text-primary-600 mr-3" />
              <span className="text-sm font-medium text-gray-900">New Account</span>
            </Link>
            <Link
              href="/contacts"
              className="flex items-center p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Users className="h-5 w-5 text-primary-600 mr-3" />
              <span className="text-sm font-medium text-gray-900">New Contact</span>
            </Link>
            <Link
              href="/opportunities"
              className="flex items-center p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Target className="h-5 w-5 text-primary-600 mr-3" />
              <span className="text-sm font-medium text-gray-900">New Opportunity</span>
            </Link>
            <Link
              href="/reports"
              className="flex items-center p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FileText className="h-5 w-5 text-primary-600 mr-3" />
              <span className="text-sm font-medium text-gray-900">Generate Report</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h2>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">Charts and analytics will be displayed here</p>
        </div>
      </div>
    </div>
  )
}