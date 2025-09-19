import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <div id="main-content-root" className="relative z-10 flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <Topbar />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto relative">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 px-6 py-3">
            <div className="flex items-center justify-center">
              <p className="text-sm text-gray-500">© 2024 Commissable</p>
            </div>
          </footer>
        </div>
      </div>
    </ProtectedRoute>
  )
}
