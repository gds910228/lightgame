import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import MobileBottomNav from './MobileBottomNav'
import BackToTop from './BackToTop'
import PerformanceIcon from './icons/PerformanceIcon'
import PerformanceDashboard from './PerformanceDashboard'

const Layout = () => {
  const [isDashboardOpen, setIsDashboardOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="flex-grow container-custom py-4 sm:py-8">
        <Outlet />
      </main>
      <Footer />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Back to Top Button */}
      <BackToTop />

      {/* Performance Dashboard Button - Adjusted for mobile */}
      <button
        onClick={() => setIsDashboardOpen(true)}
        className="fixed bottom-20 sm:bottom-5 right-5 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-300 z-50"
        aria-label="Open Performance Dashboard"
      >
        <PerformanceIcon />
      </button>

      <PerformanceDashboard
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
      />
    </div>
  )
}

export default Layout
