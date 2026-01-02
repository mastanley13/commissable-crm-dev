'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users, Shield, LogIn, UserPlus,
  Building2, Contact, Target, Package,
  DollarSign, AlertCircle, Receipt, FileX,
  Ticket, AlertTriangle, Clock, History,
  RefreshCw
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AdminOverviewMetrics } from '@/app/api/admin/overview/route'

interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: number
  href?: string
  loading?: boolean
  highlight?: boolean
}

interface MetricGroupProps {
  title: string
  colorClass: string
  metrics: MetricCardProps[]
  loading?: boolean
}

function MetricCard({ icon: Icon, label, value, href, loading, highlight }: MetricCardProps) {
  const content = (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${highlight ? 'bg-amber-50' : 'bg-gray-50'} ${href ? 'hover:bg-gray-100 transition-colors cursor-pointer' : ''}`}>
      <Icon className={`h-4 w-4 ${highlight ? 'text-amber-600' : 'text-gray-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 truncate">{label}</div>
        {loading ? (
          <div className="h-5 w-10 bg-gray-200 animate-pulse rounded mt-0.5" />
        ) : (
          <div className={`text-lg font-semibold ${highlight ? 'text-amber-700' : 'text-gray-900'}`}>
            {value.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

function MetricGroup({ title, colorClass, metrics, loading }: MetricGroupProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className={`${colorClass} px-4 py-2`}>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        {metrics.map((metric, idx) => (
          <MetricCard key={idx} {...metric} loading={loading} />
        ))}
      </div>
    </div>
  )
}

export function AdminSystemOverview() {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/overview')
      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }
      const result = await response.json()
      if (result.error) {
        throw new Error(result.error)
      }
      setMetrics(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  const userAccessMetrics: MetricCardProps[] = [
    { icon: Users, label: 'Active Users', value: metrics?.userAccess.activeUsers ?? 0, href: '/admin/users?status=Active' },
    { icon: Shield, label: 'Total Roles', value: metrics?.userAccess.totalRoles ?? 0, href: '/admin/roles' },
    { icon: LogIn, label: 'Recent Logins (7d)', value: metrics?.userAccess.recentLogins ?? 0 },
    { icon: UserPlus, label: 'Invited Users', value: metrics?.userAccess.invitedUsers ?? 0, href: '/admin/users?status=Invited' }
  ]

  const crmDataMetrics: MetricCardProps[] = [
    { icon: Building2, label: 'Total Accounts', value: metrics?.crmData.totalAccounts ?? 0, href: '/accounts' },
    { icon: Contact, label: 'Total Contacts', value: metrics?.crmData.totalContacts ?? 0, href: '/contacts' },
    { icon: Target, label: 'Open Opportunities', value: metrics?.crmData.openOpportunities ?? 0, href: '/opportunities?status=Open' },
    { icon: Package, label: 'Active Products', value: metrics?.crmData.activeProducts ?? 0, href: '/catalog' }
  ]

  const revenueFinanceMetrics: MetricCardProps[] = [
    { icon: DollarSign, label: 'Revenue Schedules', value: metrics?.revenueFinance.totalRevenueSchedules ?? 0, href: '/revenue-schedules' },
    { icon: AlertCircle, label: 'Unreconciled', value: metrics?.revenueFinance.unreconciledSchedules ?? 0, href: '/revenue-schedules?status=Unreconciled', highlight: (metrics?.revenueFinance.unreconciledSchedules ?? 0) > 0 },
    { icon: Receipt, label: 'Total Deposits', value: metrics?.revenueFinance.totalDeposits ?? 0, href: '/reconciliation' },
    { icon: FileX, label: 'Unmatched Items', value: metrics?.revenueFinance.unmatchedItems ?? 0, highlight: (metrics?.revenueFinance.unmatchedItems ?? 0) > 0 }
  ]

  const activityTasksMetrics: MetricCardProps[] = [
    { icon: Ticket, label: 'Open Tickets', value: metrics?.activityTasks.openTickets ?? 0, href: '/tickets?status=Open' },
    { icon: AlertTriangle, label: 'High Priority', value: metrics?.activityTasks.highPriorityTickets ?? 0, href: '/tickets?priority=High', highlight: (metrics?.activityTasks.highPriorityTickets ?? 0) > 0 },
    { icon: Clock, label: 'Overdue Activities', value: metrics?.activityTasks.overdueActivities ?? 0, href: '/activities', highlight: (metrics?.activityTasks.overdueActivities ?? 0) > 0 },
    { icon: History, label: 'Audit Actions (24h)', value: metrics?.activityTasks.recentAuditActions ?? 0 }
  ]

  if (error) {
    return (
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-red-700">{error}</div>
            <button
              onClick={fetchMetrics}
              className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">System Overview</h2>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          title="Refresh metrics"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricGroup
          title="User & Access"
          colorClass="bg-blue-500"
          metrics={userAccessMetrics}
          loading={loading}
        />
        <MetricGroup
          title="CRM Data"
          colorClass="bg-green-500"
          metrics={crmDataMetrics}
          loading={loading}
        />
        <MetricGroup
          title="Revenue & Finance"
          colorClass="bg-purple-500"
          metrics={revenueFinanceMetrics}
          loading={loading}
        />
        <MetricGroup
          title="Activity & Tasks"
          colorClass="bg-amber-500"
          metrics={activityTasksMetrics}
          loading={loading}
        />
      </div>
    </div>
  )
}
