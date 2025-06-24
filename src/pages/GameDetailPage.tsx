import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getGameById } from '../services/gameService'
import { Game } from '../types'

const GameDetailPage = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fullscreenContainerRef = useRef<HTMLDivElement>(null)
  
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
  
  // Handle fullscreen mode
  const enterFullScreen = () => {
    if (!game) return
    
    setIsFullScreen(true)
    
    // Request fullscreen on the container
    const container = fullscreenContainerRef.current
    if (container) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        (container as any).mozRequestFullScreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
    }
    
    // Listen for fullscreen change events
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)
  }
  
  // Handle fullscreen change events
  const handleFullscreenChange = () => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    )
    
    if (!isCurrentlyFullscreen && isFullScreen) {
      exitFullScreen()
    }
  }
  
  // Exit fullscreen mode
  const exitFullScreen = () => {
    setIsFullScreen(false)
    
    // Remove event listeners
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    
    // Exit fullscreen if needed
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen()
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen()
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen()
    }
  }
  
  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])
  
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
      {/* Normal view */}
      <div className={`animate-fade-in ${isFullScreen ? 'hidden' : ''}`}>
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
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              
              {/* Category badge */}
              <div className="absolute top-4 right-4 z-20 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-gray-800">
                {game.category}
              </div>
            </div>
            
            {/* Game info */}
            <div className="p-6 md:p-8 md:w-2/3">
              <div className="flex items-center mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{game.title}</h1>
                <div className="ml-auto flex gap-2">
                  <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                    <i className="fas fa-heart text-gray-500"></i>
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
              
              {/* Play button */}
              <button
                onClick={enterFullScreen}
                className="btn btn-primary w-full flex items-center justify-center group"
              >
                <i className="fas fa-play mr-2 group-hover:animate-pulse"></i>
                Play Game
              </button>
            </div>
          </div>
        </div>
        
        {/* Related games section could go here */}
      </div>
      
      {/* Fullscreen container */}
      <div 
        ref={fullscreenContainerRef}
        className={`fixed inset-0 bg-black z-50 ${isFullScreen ? 'block' : 'hidden'}`}
      >
        {/* Game iframe */}
        {isFullScreen && (
          <>
            <iframe
              ref={iframeRef}
              src={game.path}
              className="w-full h-full border-0"
              title={game.title}
              sandbox="allow-scripts allow-same-origin"
            ></iframe>
            
            {/* Exit button */}
            <button
              onClick={exitFullScreen}
              className="absolute top-4 right-4 bg-black/50 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
          </>
        )}
      </div>
    </>
  )
}

export default GameDetailPage 