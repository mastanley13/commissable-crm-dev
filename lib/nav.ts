import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  Calendar,
  Package,
  GitCompare,
  Users2,
  FileText,
  Ticket,
  Activity,
  Shield,
  Settings,
  BarChart3,
} from 'lucide-react'

export interface NavItem {
  name: string
  href: string
  icon: any
  current?: boolean
}

export const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Accounts', href: '/accounts', icon: Building2 },
  { name: 'Contacts', href: '/contacts', icon: Building2 },
  { name: 'Opportunities', href: '/opportunities', icon: Target },
  { name: 'Revenue Schedules', href: '/revenue-schedules', icon: Calendar },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Reconciliation', href: '/reconciliation', icon: GitCompare },
  { name: 'Groups', href: '/groups', icon: Users2 },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Tickets', href: '/tickets', icon: Ticket },
  { name: 'Activities', href: '/activities', icon: Activity },
  { name: 'Admin', href: '/admin', icon: Shield },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function getPageTitle(pathname: string): string {
  const item = navigation.find(nav => nav.href === pathname)
  return item?.name || 'Dashboard'
}
