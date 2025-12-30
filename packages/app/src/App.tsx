import { Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Analytics } from '@vercel/analytics/react'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import GameDetailPage from './pages/GameDetailPage'
import AboutPage from './pages/AboutPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import ContactUs from './pages/ContactUs'
import NotFoundPage from './pages/NotFoundPage'
import { FavoritesProvider } from './contexts/FavoritesContext'
import { PerformanceProvider } from './contexts/PerformanceContext'

function App() {
  return (
    <HelmetProvider>
      <PerformanceProvider>
        <FavoritesProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="game/:gameId" element={<GameDetailPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="privacy-policy" element={<PrivacyPolicy />} />
              <Route path="terms-of-service" element={<TermsOfService />} />
              <Route path="contact" element={<ContactUs />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          <Analytics />
        </FavoritesProvider>
      </PerformanceProvider>
    </HelmetProvider>
  )
}

export default App
