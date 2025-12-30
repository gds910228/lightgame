import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import GameCard from '../components/GameCard'
import SEO from '../components/SEO'
import { Game } from '../types'
import { getAllGames, getGamesByCategory, searchGames } from '../services/gameService'
import { useFavorites } from '../contexts/FavoritesContext'

const HomePage = () => {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const location = useLocation()
  const { favorites } = useFavorites()
  
  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const params = new URLSearchParams(location.search)
        const categoryParam = params.get('category')
        const searchParam = params.get('search')
        const favoritesParam = params.get('favorites')
        
        let fetchedGames: Game[]
        
        if (favoritesParam === 'true') {
          // Show only favorite games
          const allGames = await getAllGames()
          fetchedGames = allGames.filter(game => favorites.includes(game.id))
        } else if (searchParam) {
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
    const favoritesParam = params.get('favorites')

    if (favoritesParam === 'true') {
      return 'My Favorite Games'
    } else if (searchParam) {
      return `Search results for "${searchParam}"`
    } else if (categoryParam) {
      return `${categoryParam} Games`
    } else {
      return 'All Games'
    }
  }

  // Generate SEO metadata based on current page state
  const getSEOMetadata = () => {
    const params = new URLSearchParams(location.search)
    const categoryParam = params.get('category')
    const searchParam = params.get('search')
    const favoritesParam = params.get('favorites')

    if (favoritesParam === 'true') {
      return {
        title: 'My Favorite Games - LightGame',
        description: 'Your personal collection of favorite games. Save and quickly access your most-loved games on LightGame.'
      }
    } else if (searchParam) {
      return {
        title: `Search: "${searchParam}" - LightGame`,
        description: `Search results for "${searchParam}". Find the best free online games matching your interests.`
      }
    } else if (categoryParam) {
      return {
        title: `${categoryParam} Games - Play Free Online | LightGame`,
        description: `Play free ${categoryParam} games online. No downloads, no registrations. Instant ${categoryParam} gaming fun!`
      }
    } else {
      return {
        title: 'LightGame - Quick Games for Quick Breaks',
        description: 'Play free online games instantly! No downloads, no registrations. 40+ puzzle, action, and arcade games perfect for your break.'
      }
    }
  }

  const seoMetadata = getSEOMetadata()

  return (
    <div className="animate-fade-in overflow-x-hidden">
      <SEO
        title={seoMetadata.title}
        description={seoMetadata.description}
        url={`https://games.misitebo.win/${location.search}`}
      />
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
              <a href="#about-us" className="btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-200">
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

      {/* About Us Section */}
      {!location.search && (
        <div id="about-us" className="py-16 bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 scroll-mt-20 mt-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">About QuickGames</h2>
            <p className="text-gray-600 text-lg mb-12">
              Discover a world of free games on QuickGames, a multi-genre platform offering the latest and greatest games. Enjoy a wide array of online games completely free of charge!
            </p>
            <div className="text-left bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-3 text-primary-500">Welcome To QuickGames</h3>
              <p className="text-gray-700 mb-6">
                QuickGames features the best range of free games online and provides the most enjoyable experience for playing games with no interruptions. Our goal is to develop the most comprehensive online playground. Free and accessible to all players. We feature the best range of free online games and provide the most enjoyable experience for playing games by yourself or with others. All of our games are available for instant play with no downloads, logins, pop-ups, or other interruptions. Our games are accessible on desktop, tablet, and mobile devices, allowing you to play them at home or while traveling.
              </p>
              <h3 className="text-2xl font-bold mb-3 text-primary-500">Completely Free Of Charge</h3>
              <p className="text-gray-700">
                This website is suitable for families. Our objective in selecting and developing these games was to provide a positive, age-appropriate experience. In-game payments have become commonplace in free games. This matter is easily recognized through actions such as withholding material or aggravating you in an effort to induce you to purchase power-ups in those games. It appears that the catch for playing free games is that they will use the opportunity to pay—frequently many times more than you would pay for the game outright. This method is effective, and some individuals unknowingly spend enormous amounts of money on their favorite games over time. There are no in-game purchases whatsoever in any of our games. All of our games and their materials are completely free, with no exceptions!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage 