import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { MainNav } from '@/components/main-nav'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { BreadcrumbProvider } from '@/lib/breadcrumb-context'
import { isTopNavigationExperimentEnabled } from '@/lib/feature-flags'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const useTopNav = isTopNavigationExperimentEnabled()

  const mainContent = (
    <div
      id="main-content-root"
      className="relative z-10 flex-1 flex flex-col overflow-hidden min-h-0"
    >
      <BreadcrumbProvider>
        {/* Horizontal navigation (experiment) */}
        {useTopNav && <MainNav />}

        {/* Top bar (includes breadcrumb) */}
        <Topbar />

        {/* Page content */}
        <main className="flex-1 min-h-0 overflow-hidden relative">
          {children}
        </main>
      </BreadcrumbProvider>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-1">
        <div className="flex items-center justify-center">
          <p className="text-xs text-gray-500">Ac 2024 Commissable</p>
        </div>
      </footer>
    </div>
  )

  return (
    <ProtectedRoute>
      {useTopNav ? (
        <div className="flex flex-col h-screen bg-gray-50">
          {mainContent}
        </div>
      ) : (
        <div className="flex h-screen bg-gray-50">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content */}
          {mainContent}
        </div>
      )}
    </ProtectedRoute>
  )
}
