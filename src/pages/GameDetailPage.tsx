import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getGameById } from '../services/gameService'
import { Game } from '../types'
import GameLoader from '../components/GameLoader'
import { useFavorites } from '../contexts/FavoritesContext'

const GameDetailPage = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const { isFavorite, toggleFavorite } = useFavorites()
  
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGameLoader, setShowGameLoader] = useState(false)
  
  // Fetch game details
  useEffect(() => {
    const fetchGameDetails = async () => {
      if (!gameId) {
        setError('Game ID is missing')
        setLoading(false)
        return
      }
      
      try {
        const gameData = await getGameById(gameId)
        
        if (!gameData) {
          setError('Game not found')
        } else {
          setGame(gameData)
        }
      } catch (err) {
        console.error('Error fetching game details:', err)
        setError('Failed to load game details. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchGameDetails()
  }, [gameId])
  
  const handlePlayGame = () => {
    setShowGameLoader(true);
  };

  const handleCloseGame = () => {
    setShowGameLoader(false);
  };

  const handleFavoriteClick = () => {
    if (game) {
      console.log('Favorite button clicked in GameDetailPage for game:', game.id);
      toggleFavorite(game.id);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }
  
  if (error || !game) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p>{error || 'Game not found'}</p>
        <Link to="/" className="mt-4 inline-block text-primary-600 hover:underline">
          &larr; Back to all games
        </Link>
      </div>
    )
  }
  
  return (
    <>
      {/* Game Details View */}
      <div className="animate-fade-in">
        {/* Back button */}
        <Link to="/" className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-6 group">
          <i className="fas fa-arrow-left mr-2 transition-transform group-hover:-translate-x-1"></i>
          Back to all games
        </Link>
        
        {/* Game details */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="md:flex">
            {/* Game image */}
            <div className="md:flex-shrink-0 md:w-1/3 h-64 md:h-auto relative">
              {/* Fallback image */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-primary-300 flex items-center justify-center">
                <i className="fas fa-gamepad text-primary-600 text-5xl animate-pulse-slow"></i>
              </div>
              
              {/* Actual game image */}
              <img 
                src={game.image} 
                alt={game.title}
                className="absolute inset-0 w-full h-full object-cover z-10"
                onError={(e) => {
                  // Hide the image on error, showing the fallback
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              
              {/* Category badge */}
              <div className="absolute top-4 right-4 z-20 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-gray-800">
                {Array.isArray(game.category) ? game.category.join(', ') : game.category}
              </div>
            </div>
            
            {/* Game info */}
            <div className="p-6 md:p-8 md:w-2/3">
              <div className="flex items-center mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{game.title}</h1>
                <div className="ml-auto flex gap-2">
                  <button 
                    onClick={handleFavoriteClick}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
                      isFavorite(game.id)
                        ? 'bg-red-500 text-white shadow-lg' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-red-500'
                    }`}
                    title={isFavorite(game.id) ? '取消收藏' : '添加到收藏'}
                  >
                    <i className={`fas fa-heart ${isFavorite(game.id) ? 'animate-pulse' : ''}`}></i>
                  </button>
                  <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                    <i className="fas fa-share text-gray-500"></i>
                  </button>
                </div>
              </div>
              
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Description</h2>
                <p className="text-gray-700">{game.description}</p>
              </div>
              
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-2">Controls</h2>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200 font-mono text-sm">
                  {game.controls}
                </p>
              </div>
              
              {/* Game Features */}
              {game.features && game.features.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-2">Features</h2>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {game.features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Game Info */}
              <div className="mb-6 flex flex-wrap gap-4 text-sm text-gray-600">
                {game.author && (
                  <div className="flex items-center">
                    <i className="fas fa-user mr-2"></i>
                    <span>by {game.author}</span>
                  </div>
                )}
                {game.version && (
                  <div className="flex items-center">
                    <i className="fas fa-tag mr-2"></i>
                    <span>v{game.version}</span>
                  </div>
                )}
              </div>
              
              {/* Play button */}
              <button
                onClick={handlePlayGame}
                className="btn btn-primary w-full flex items-center justify-center group"
              >
                <i className="fas fa-play mr-2 group-hover:animate-pulse"></i>
                Play Game
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Game Loader Modal */}
      {showGameLoader && game && (
        <GameLoader game={game} onClose={handleCloseGame} />
      )}
    </>
  )
}

export default GameDetailPage