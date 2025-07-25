import { useState, useEffect } from 'react'
import { useFavorites } from '../contexts/FavoritesContext'
import { getGames } from '../services/gameService'
import { Game } from '../types'
import GameCard from '../components/GameCard'
import { Link } from 'react-router-dom'

const FavoritesPage = () => {
  const { favorites } = useFavorites()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoading(true)
        const gamesData = await getGames()
        setGames(gamesData)
      } catch (err) {
        setError('Failed to load games')
        console.error('Error loading games:', err)
      } finally {
        setLoading(false)
      }
    }

    loadGames()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading favorite games...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
          <p className="text-gray-600 mb-4">Error loading favorite games</p>
          <Link to="/" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  // Filter favorite games
  const favoriteGames = games.filter((game: Game) => favorites.includes(game.id))

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          <i className="fas fa-heart text-red-500 mr-3"></i>
          My Favorites
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Here are all your favorite games, ready to play anytime!
        </p>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600 mb-1">
              {favorites.length}
            </div>
            <div className="text-gray-600 text-sm">
              Favorite Games
            </div>
          </div>
        </div>
      </div>

      {/* Games Grid */}
      {favoriteGames.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favoriteGames.map((game: Game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="mb-6">
            <i className="fas fa-heart-broken text-gray-300 text-6xl mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No favorite games yet
            </h3>
            <p className="text-gray-500 mb-6">
              Browse games and click the heart icon to add them to your favorites!
            </p>
          </div>
          <Link 
            to="/" 
            className="btn btn-primary inline-flex items-center"
          >
            <i className="fas fa-gamepad mr-2"></i>
            Browse Games
          </Link>
        </div>
      )}

      {/* Back to Home */}
      <div className="text-center mt-12">
        <Link 
          to="/" 
          className="btn btn-outline inline-flex items-center"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back to Home
        </Link>
      </div>
    </div>
  )
}

export default FavoritesPage