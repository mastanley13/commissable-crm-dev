'use client'

import { useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { navigation } from '@/lib/nav'
import { useBreadcrumbs } from '@/lib/breadcrumb-context'
import { mergeHistoryWithTrail, pushFromBreadcrumbs } from '@/lib/breadcrumb-history'

export interface BreadcrumbItem {
  name: string
  href?: string
  current?: boolean
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  className?: string
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Always start with Home
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/dashboard' }
  ]

  // Handle root dashboard
  if (pathname === '/dashboard' || pathname === '/' || pathname === '') {
    breadcrumbs[0].current = true
    return breadcrumbs
  }

  // Split path and filter out empty segments
  const segments = pathname.split('/').filter(Boolean)
  
  // Build breadcrumbs based on path segments
  let currentPath = ''
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    currentPath += `/${segment}`
    
    // Skip the dashboard segment as we already have Home
    if (segment === 'dashboard') continue
    
    // Find navigation item for this path
    const navItem = navigation.find(nav => nav.href === currentPath)
    
    if (navItem) {
      // Main navigation item
      breadcrumbs.push({
        name: navItem.name,
        href: currentPath,
        current: i === segments.length - 1
      })
    } else {
      // Handle special cases
      if (segment === 'admin') {
        breadcrumbs.push({
          name: 'Admin',
          href: '/admin',
          current: i === segments.length - 1
        })
      } else if (currentPath.startsWith('/admin/')) {
        // Admin sub-pages
        const adminPages: Record<string, string> = {
          'users': 'Users',
          'roles': 'Roles', 
          'settings': 'Settings',
          'data-management': 'Data Management'
        }
        
        if (adminPages[segment]) {
          breadcrumbs.push({
            name: adminPages[segment],
            href: currentPath,
            current: i === segments.length - 1
          })
        } else {
          // Unknown admin page - use capitalized segment name
          breadcrumbs.push({
            name: capitalizeSegment(segment),
            href: currentPath,
            current: i === segments.length - 1
          })
        }
      } else {
        // Handle dynamic routes (detail pages)
        const parentSegment = segments[i - 1]
        
        // Check if this is a detail page (has parent module)
        const parentNav = navigation.find(nav => nav.href === `/${parentSegment}`)
        if (parentNav && isDetailPageId(segment)) {
          // This is likely a detail page - try to get entity name
          breadcrumbs.push({
            name: getDetailPageName(parentSegment, segment),
            current: i === segments.length - 1
            // No href for detail pages to make them non-clickable
          })
        } else {
          // Unknown segment - use capitalized segment name
          breadcrumbs.push({
            name: capitalizeSegment(segment),
            href: currentPath,
            current: i === segments.length - 1
          })
        }
      }
    }
  }

  return breadcrumbs
}

function isDetailPageId(segment: string): boolean {
  // Check if segment looks like an ID (UUID, numeric, etc.)
  return /^[a-zA-Z0-9-_]{8,}$/.test(segment) || /^\d+$/.test(segment)
}

function getDetailPageName(module: string, id: string): string {
  // Map module names to singular forms for detail pages
  const moduleNames: Record<string, string> = {
    'accounts': 'Account',
    'contacts': 'Contact',
    'opportunities': 'Opportunity',
    'products': 'Product',
    'groups': 'Group',
    'tickets': 'Ticket',
    'activities': 'Activity',
    'revenue-schedules': 'Revenue Schedule',
    'reports': 'Report'
  }
  
  const entityName = moduleNames[module] || capitalizeSegment(module)
  
  // For now, just show the entity type. In the future, this could be enhanced
  // to fetch the actual entity name from an API
  return `${entityName} Details`
}

function capitalizeSegment(segment: string): string {
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  const pathname = usePathname() || '/'
  const { items: contextItems } = useBreadcrumbs()

  const baseItems = useMemo(() => {
    return items
      ? items
      : (contextItems && contextItems.length > 0)
        ? contextItems
        : generateBreadcrumbs(pathname)
  }, [items, contextItems, pathname])

  // Push current page into history using computed crumbs
  useEffect(() => {
    pushFromBreadcrumbs(baseItems, pathname)
  }, [baseItems, pathname])

  // Merge with session history so cross‑module visits appear consistently
  const breadcrumbItems = useMemo(() => {
    return mergeHistoryWithTrail(baseItems, pathname)
  }, [baseItems, pathname])

  return (
    <nav
      className={`flex items-center space-x-1 text-[11px] ${className}`}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-1">
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight
                className="h-3 w-3 text-gray-400 mx-1"
                aria-hidden="true"
              />
            )}

            {index === 0 ? (
              // Home icon for first item
              item.href && !item.current ? (
                <Link
                  href={item.href}
                  className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="Home"
                >
                  <Home className="h-3 w-3" />
                </Link>
              ) : (
                <span
                  className="flex items-center text-gray-900 font-medium"
                  aria-current={item.current ? 'page' : undefined}
                >
                  <Home className="h-3 w-3" />
                </span>
              )
            ) : (
              // Regular breadcrumb items
              item.href && !item.current ? (
                <Link
                  href={item.href}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  className="text-gray-900 font-medium"
                  aria-current={item.current ? 'page' : undefined}
                >
                  {item.name}
                </span>
              )
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
