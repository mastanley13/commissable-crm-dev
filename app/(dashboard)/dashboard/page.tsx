'use client'

import { useCallback, useEffect, useMemo, useState, ChangeEvent } from 'react'
import Link from 'next/link'
import {
  Building2,
  Users,
  Target,
  Package,
  FileText,
  CalendarRange,
  TrendingUp,
  Wallet,
  BellRing,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DashboardMetrics, DashboardReconciliationMetrics } from '@/lib/dashboard-metrics'

const quickStats = [
  { name: 'Total Accounts', metricKey: 'totalAccounts', icon: Building2, href: '/accounts', color: 'bg-blue-500' },
  { name: 'Total Contacts', metricKey: 'totalContacts', icon: Users, href: '/contacts', color: 'bg-green-500' },
  { name: 'Active Opportunities', metricKey: 'activeOpportunities', icon: Target, href: '/opportunities', color: 'bg-purple-500' },
  { name: 'Active Catalog', metricKey: 'activeProducts', icon: Package, href: '/products', color: 'bg-orange-500' }
] as const

const emptyReconciliationMetrics: DashboardReconciliationMetrics = {
  totalUsage: 0,
  totalCommissions: 0,
  totalPastDueSchedules: 0,
}

type DisplayDateRange = {
  from: string
  to: string
}

const fetchDashboardMetrics = async (params?: URLSearchParams): Promise<DashboardMetrics> => {
  const query = params?.toString()
  const response = await fetch(`/api/dashboard/metrics${query ? `?${query}` : ''}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Failed to load dashboard metrics')
  }

  const result = await response.json()
  if (result.error) {
    throw new Error(result.error)
  }

  return result.data as DashboardMetrics
}

const buildDateRangeForPreset = (
  preset: DateRangePreset,
  customDateRange: CustomDateRange,
): DisplayDateRange => {
  if (preset === 'custom') {
    return {
      from: customDateRange.from || '',
      to: customDateRange.to || '',
    }
  }

  const today = new Date()
  let fromDate: Date

  if (preset === 'ytd') {
    fromDate = new Date(today.getFullYear(), 0, 1)
  } else {
    fromDate = new Date(today)
    fromDate.setMonth(today.getMonth() - 6)
  }

  return {
    from: formatDateYYYYMMDD(fromDate),
    to: formatDateYYYYMMDD(today),
  }
}

function DashboardSummaryPanels() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const numberFormatter = useMemo(() => new Intl.NumberFormat('en-US'), [])

  useEffect(() => {
    let cancelled = false

    const loadMetrics = async () => {
      setLoading(true)
      setError(null)
      try {
        const nextMetrics = await fetchDashboardMetrics()
        if (!cancelled) {
          setMetrics(nextMetrics)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMetrics()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map(stat => {
          const Icon = stat.icon
          const value = metrics?.crmData[stat.metricKey] ?? 0

          return (
            <Link
              key={stat.name}
              href={stat.href}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {loading ? (
                      <span className="block h-8 w-12 animate-pulse rounded bg-slate-200" />
                    ) : (
                      numberFormatter.format(value)
                    )}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-200 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-3/4 rounded bg-slate-200 animate-pulse" />
                    <div className="mt-2 h-3 w-1/3 rounded bg-slate-100 animate-pulse" />
                  </div>
                </div>
              ))
            ) : metrics?.recentActivity.length ? (
              metrics.recentActivity.map(activity => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {activity.time} - by {activity.user}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No recent activity found.</p>
            )}
          </div>
          <Link
            href="/activities"
            className="block mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {"View all activities ->"}
          </Link>
        </div>

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
    </>
  )
}

type DateRangePreset = 'ytd' | 'last6Months' | 'custom'

type CustomDateRange = {
  from: string | null
  to: string | null
}

type MetricCardProps = {
  icon: LucideIcon
  label: string
  value: string
  loading: boolean
}

const formatDateYYYYMMDD = (value: string | Date | null | undefined): string => {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return String(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const MetricCard = ({ icon: Icon, label, value, loading }: MetricCardProps) => (
  <div className="bg-gray-50 rounded-lg p-4">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      {label}
    </div>
    <div className="mt-2 text-xl font-semibold text-slate-900">
      {loading ? <span className="block h-7 w-24 animate-pulse rounded bg-slate-200" /> : value}
    </div>
  </div>
)

function ReconciliationSummarySection() {
  const [summaryMetrics, setSummaryMetrics] = useState<DashboardReconciliationMetrics>(emptyReconciliationMetrics)
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('ytd')
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>({ from: null, to: null })

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }),
    [],
  )
  const numberFormatter = useMemo(() => new Intl.NumberFormat('en-US'), [])

  const fetchSummaryMetrics = useCallback(async (range: DisplayDateRange) => {
    setSummaryLoading(true)
    setSummaryError(null)

    try {
      const params = new URLSearchParams()
      if (range.from) params.set('from', range.from)
      if (range.to) params.set('to', range.to)

      const nextMetrics = await fetchDashboardMetrics(params)
      setSummaryMetrics(nextMetrics.reconciliation)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to load reconciliation summary')
      setSummaryMetrics(emptyReconciliationMetrics)
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSummaryMetrics(buildDateRangeForPreset('ytd', { from: null, to: null }))
  }, [fetchSummaryMetrics])

  const handlePresetChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextPreset = event.target.value as DateRangePreset
      setSummaryError(null)
      setDateRangePreset(nextPreset)

      if (nextPreset !== 'custom') {
        const nextCustomRange = { from: null, to: null }
        setCustomDateRange(nextCustomRange)
        void fetchSummaryMetrics(buildDateRangeForPreset(nextPreset, nextCustomRange))
      }
    },
    [fetchSummaryMetrics],
  )

  const handleCustomDateChange = useCallback((field: keyof CustomDateRange) => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value.trim()
      if (!value) {
        setCustomDateRange(prev => ({ ...prev, [field]: null }))
        return
      }
      const datePattern = /^\d{4}-\d{2}-\d{2}$/
      if (datePattern.test(value)) {
        const date = new Date(value)
        if (!Number.isNaN(date.getTime())) {
          setCustomDateRange(prev => ({ ...prev, [field]: value }))
          return
        }
      }
      setCustomDateRange(prev => ({ ...prev, [field]: value }))
    }
  }, [])

  const handleApplyCustomDateRange = useCallback(() => {
    const from = customDateRange.from
    const to = customDateRange.to

    if (!from || !to) {
      setSummaryError('Please select both a start date and end date.')
      return
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (!datePattern.test(from) || !datePattern.test(to)) {
      setSummaryError('Please enter dates in YYYY-MM-DD format.')
      return
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      setSummaryError('Please enter valid dates.')
      return
    }

    if (fromDate > toDate) {
      setSummaryError('Start date must be before end date.')
      return
    }

    setSummaryError(null)
    setDateRangePreset('custom')
    void fetchSummaryMetrics({ from, to })
  }, [customDateRange.from, customDateRange.to, fetchSummaryMetrics])

  const isApplyDisabled =
    dateRangePreset !== 'custom' ||
    !customDateRange.from ||
    !customDateRange.to ||
    summaryLoading

  const displayDateRange = useMemo(
    () => buildDateRangeForPreset(dateRangePreset, customDateRange),
    [dateRangePreset, customDateRange],
  )

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Reconciliation Summary</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="flex items-center gap-1 font-semibold uppercase tracking-wide text-[11px] text-slate-500">
            <CalendarRange className="h-4 w-4 text-primary-600" />
            Date Range
          </span>
          <select
            value={dateRangePreset}
            onChange={handlePresetChange}
            className="border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 focus:border-primary-500 focus:outline-none rounded"
          >
            <option value="ytd">Year to Date</option>
            <option value="last6Months">Last 6 Months</option>
            <option value="custom">Custom</option>
          </select>
          <input
            type="text"
            value={displayDateRange.from}
            onChange={handleCustomDateChange('from')}
            disabled={dateRangePreset !== 'custom'}
            readOnly={dateRangePreset !== 'custom'}
            placeholder="YYYY-MM-DD"
            className="border border-slate-300 bg-white px-3 py-1 text-sm focus:border-primary-500 focus:outline-none rounded disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
          <span className="text-xs font-medium text-slate-500">to</span>
          <input
            type="text"
            value={displayDateRange.to}
            onChange={handleCustomDateChange('to')}
            disabled={dateRangePreset !== 'custom'}
            readOnly={dateRangePreset !== 'custom'}
            placeholder="YYYY-MM-DD"
            className="border border-slate-300 bg-white px-3 py-1 text-sm focus:border-primary-500 focus:outline-none rounded disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleApplyCustomDateRange}
            disabled={isApplyDisabled}
            className="bg-primary-600 px-4 py-1 text-sm font-semibold text-white rounded transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
          >
            Apply Range
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={TrendingUp}
          label="Total Usage"
          value={currencyFormatter.format(summaryMetrics.totalUsage)}
          loading={summaryLoading}
        />
        <MetricCard
          icon={Wallet}
          label="Total Commissions"
          value={currencyFormatter.format(summaryMetrics.totalCommissions)}
          loading={summaryLoading}
        />
        <MetricCard
          icon={BellRing}
          label="Total Past Due Schedules"
          value={numberFormatter.format(summaryMetrics.totalPastDueSchedules)}
          loading={summaryLoading}
        />
      </div>

      {summaryError && (
        <div className="mt-4 text-sm text-red-600">{summaryError}</div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Commissable CRM</h1>
        <p className="text-gray-600">
          Manage your customer relationships, track opportunities, and grow your business.
        </p>
      </div>

      <DashboardSummaryPanels />

      <ReconciliationSummarySection />

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h2>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">Charts and analytics will be displayed here</p>
        </div>
      </div>
    </div>
  )
}

