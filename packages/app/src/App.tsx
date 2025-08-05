import { Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import GameDetailPage from './pages/GameDetailPage'
import NotFoundPage from './pages/NotFoundPage'
import { FavoritesProvider } from './contexts/FavoritesContext'
import { PerformanceProvider } from './contexts/PerformanceContext'

function App() {
  return (
    <PerformanceProvider>
      <FavoritesProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="game/:gameId" element={<GameDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        <Analytics />
      </FavoritesProvider>
    </PerformanceProvider>
  )
}

export default App
