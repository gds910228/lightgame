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
        <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-12 md:py-20 mb-12 overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-10 left-10 w-20 h-20 md:w-32 md:h-32 animate-float opacity-20">
              <div className="w-full h-full border-4 border-neon-blue rotate-45"></div>
            </div>
            <div className="absolute top-20 right-20 w-16 h-16 md:w-24 md:h-24 animate-float opacity-20" style={{ animationDelay: '1s' }}>
              <div className="w-full h-full border-4 border-neon-pink rounded-full"></div>
            </div>
            <div className="absolute bottom-10 left-1/4 w-12 h-12 md:w-20 md:h-20 animate-float opacity-20" style={{ animationDelay: '2s' }}>
              <div className="w-full h-full border-4 border-neon-green rotate-12"></div>
            </div>
            <div className="absolute bottom-20 right-1/3 w-8 h-8 md:w-16 md:h-16 animate-float opacity-20" style={{ animationDelay: '0.5s' }}>
              <div className="w-full h-full bg-neon-yellow rotate-45"></div>
            </div>
          </div>

          {/* Main hero content */}
          <div className="relative max-w-4xl">
            {/* Pixel art decorative elements */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 md:w-20 md:h-20 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-neon-blue to-neon-pink rotate-45 animate-pulse-slow"></div>
                <div className="absolute inset-2 bg-dark-bg flex items-center justify-center">
                  <i className="fas fa-gamepad text-3xl md:text-4xl neon-text"></i>
                </div>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-neon-blue to-transparent"></div>
            </div>

            {/* Main heading with pixel font */}
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-6 leading-tight">
              <span className="text-neon-blue neon-text">LEVEL UP</span>
              <br />
              <span className="text-white">YOUR BREAK</span>
            </h1>

            {/* Subtitle with glitch effect */}
            <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl">
              <span className="inline-block hover:text-neon-pink transition-colors">⚡ Instant play</span>
              {' · '}
              <span className="inline-block hover:text-neon-green transition-colors">🎮 No downloads</span>
              {' · '}
              <span className="inline-block hover:text-neon-blue transition-colors">🚀 Pure fun</span>
            </p>

            {/* Description */}
            <p className="text-base md:text-lg text-gray-400 mb-8 max-w-2xl">
              Dive into a curated collection of retro-inspired games. From puzzle classics to arcade thrills,
              your next gaming adventure is one click away.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 mb-8">
              <a href="#games-grid" className="btn btn-primary group relative overflow-hidden">
                <span className="relative z-10 flex items-center">
                  <i className="fas fa-play mr-2 group-hover:animate-pulse"></i>
                  START PLAYING
                </span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </a>
              <a href="#about-us" className="btn btn-secondary group relative overflow-hidden">
                <span className="relative z-10 flex items-center">
                  <i className="fas fa-info-circle mr-2 group-hover:rotate-12 transition-transform"></i>
                  ABOUT
                </span>
              </a>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 md:gap-12 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-neon-green animate-pulse"></div>
                <span className="text-gray-400">40+ Games</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-neon-blue animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                <span className="text-gray-400">Zero Lag</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-neon-pink animate-pulse" style={{ animationDelay: '1s' }}></div>
                <span className="text-gray-400">Free Forever</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page title */}
      <h2 className="text-2xl md:text-3xl font-bold mb-8 text-white" id="games-grid">
        {getPageTitle()}
      </h2>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-blue"></div>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
          <p>{error}</p>
        </div>
      ) : games.length === 0 ? (
        <div className="bg-yellow-900/20 border border-yellow-500/30 text-yellow-400 px-4 py-3 rounded-lg">
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
        <div id="about-us" className="py-16 bg-dark-card -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 scroll-mt-20 mt-16 border-y border-dark-border">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block mb-6">
              <div className="w-16 h-16 md:w-20 md:h-20 relative">
                <div className="absolute inset-0 border-4 border-neon-blue rotate-45"></div>
                <div className="absolute inset-2 bg-dark-bg flex items-center justify-center">
                  <i className="fas fa-rocket text-2xl md:text-3xl neon-text"></i>
                </div>
              </div>
            </div>

            <h2 className="text-2xl md:text-4xl font-bold mb-4 text-white neon-text">ABOUT LIGHTGAME</h2>
            <p className="text-gray-400 text-lg mb-12">
              Discover a world of free games on LightGame, a retro-inspired platform offering the best casual gaming experience. Enjoy instant play with no strings attached!
            </p>
            <div className="text-left bg-dark-bg p-8 rounded-lg border border-dark-border glow-border">
              <h3 className="text-xl md:text-2xl font-bold mb-3 text-neon-blue">Welcome To The Arcade</h3>
              <p className="text-gray-300 mb-6">
                LightGame features the best range of free games online and provides the most enjoyable experience for playing games with no interruptions. Our goal is to develop the most comprehensive online playground. Free and accessible to all players. We feature the best range of free online games and provide the most enjoyable experience for playing games by yourself or with others. All of our games are available for instant play with no downloads, logins, pop-ups, or other interruptions. Our games are accessible on desktop, tablet, and mobile devices, allowing you to play them at home or while traveling.
              </p>
              <h3 className="text-xl md:text-2xl font-bold mb-3 text-neon-pink neon-text-pink">Completely Free Of Charge</h3>
              <p className="text-gray-300">
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