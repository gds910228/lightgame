import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import GameCard from '../components/GameCard'
import { Game } from '../types'
import { getAllGames, getGamesByCategory, searchGames } from '../services/gameService'

const HomePage = () => {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const location = useLocation()
  
  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const params = new URLSearchParams(location.search)
        const categoryParam = params.get('category')
        const searchParam = params.get('search')
        
        let fetchedGames: Game[]
        
        if (searchParam) {
          // Search has priority over category
          fetchedGames = await searchGames(searchParam)
        } else if (categoryParam) {
          // Filter by category
          fetchedGames = await getGamesByCategory(categoryParam)
        } else {
          // Get all games
          fetchedGames = await getAllGames()
        }
        
        setGames(fetchedGames)
      } catch (err) {
        console.error('Error fetching games:', err)
        setError('Failed to load games. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchGames()
  }, [location.search])
  
  // Determine page title based on search parameters
  const getPageTitle = () => {
    const params = new URLSearchParams(location.search)
    const categoryParam = params.get('category')
    const searchParam = params.get('search')
    
    if (searchParam) {
      return `Search results for "${searchParam}"`
    } else if (categoryParam) {
      return `${categoryParam} Games`
    } else {
      return 'All Games'
    }
  }
  
  return (
    <div className="animate-fade-in">
      {/* Hero section (only on main page without filters) */}
      {!location.search && (
        <div className="bg-gradient-to-r from-primary-50 to-secondary-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-10 mb-10 rounded-lg shadow-sm">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-primary-500">Quick Games</span> for 
              <span className="text-secondary-500"> Quick Breaks</span>
            </h1>
            <p className="text-gray-700 text-lg mb-6">
              Instant fun without commitment. Perfect for your coffee break or whenever you need a moment of joy.
            </p>
            <div className="flex gap-3">
              <a href="#games-grid" className="btn btn-primary">
                <i className="fas fa-gamepad mr-2"></i>
                Browse Games
              </a>
              <a href="#" className="btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-200">
                <i className="fas fa-info-circle mr-2"></i>
                Learn More
              </a>
            </div>
          </div>
        </div>
      )}
      
      {/* Page title */}
      <h2 className="text-3xl font-bold mb-8" id="games-grid">
        {getPageTitle()}
      </h2>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      ) : games.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <p>No games found. Try a different search or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {games.map((game, index) => (
            <div 
              key={game.id} 
              className="opacity-0 animate-fade-in" 
              style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
            >
              <GameCard game={game} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default HomePage 