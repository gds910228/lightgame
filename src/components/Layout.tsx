import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import PerformanceDashboard from './PerformanceDashboard'

const Layout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container-custom py-8">
        <Outlet />
      </main>
      <Footer />
      <PerformanceDashboard />
    </div>
  )
}

export default Layout