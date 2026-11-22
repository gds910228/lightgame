import { Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import GameDetailPage from './pages/GameDetailPage'
import AchievementsPage from './pages/AchievementsPage'
import AboutPage from './pages/AboutPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import ContactUs from './pages/ContactUs'
import NotFoundPage from './pages/NotFoundPage'
import { FavoritesProvider } from './contexts/FavoritesContext'
import { PerformanceProvider } from './contexts/PerformanceContext'
import { ProgressProvider } from './contexts/ProgressContext'
import { AchievementsProvider } from './contexts/AchievementsContext'
import AchievementUnlockToast from './components/AchievementUnlockToast'
import ScrollToTop from './components/ScrollToTop'

function App() {
  return (
    <HelmetProvider>
      <PerformanceProvider>
        <ProgressProvider>
          <FavoritesProvider>
            <AchievementsProvider>
              <ScrollToTop />
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="game/:gameId" element={<GameDetailPage />} />
                  <Route path="achievements" element={<AchievementsPage />} />
                  <Route path="about" element={<AboutPage />} />
                  <Route path="privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="terms-of-service" element={<TermsOfService />} />
                  <Route path="contact" element={<ContactUs />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              <AchievementUnlockToast />
            </AchievementsProvider>
          </FavoritesProvider>
        </ProgressProvider>
      </PerformanceProvider>
    </HelmetProvider>
  )
}

export default App
