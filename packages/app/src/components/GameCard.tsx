import { Link } from 'react-router-dom'
import { Game } from '../types'
import { useEffect, useRef, useState } from 'react'
import FavoriteButton from './FavoriteButton'

interface GameCardProps {
  game: Game;
}

const GameCard = ({ game }: GameCardProps) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined)
  const [imageError, setImageError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    // Use Intersection Observer for lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(game.image)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before visible
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [game.image])

  const handleImageError = () => {
    setImageError(true)
    console.error(`Failed to load image for game ${game.id}:`, game.image)
  }

  return (
    <Link
      to={`/game/${game.id}`}
      className="card group relative block"
      // Touch feedback for mobile
      onTouchStart={(e) => {
        e.currentTarget.classList.add('scale-95', 'opacity-80')
      }}
      onTouchEnd={(e) => {
        setTimeout(() => {
          e.currentTarget.classList.remove('scale-95', 'opacity-80')
        }, 150)
      }}
    >
      {/* Game Image */}
      <div className="relative h-40 sm:h-48 overflow-hidden">
        {/* Fallback background */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-card to-dark-bg flex items-center justify-center">
          <i className="fas fa-gamepad text-neon-blue/30 text-4xl animate-pulse-slow"></i>
        </div>

        {/* Actual game image with lazy loading */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt={game.title}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-500 group-hover:scale-110 ${
            imageError ? 'hidden' : ''
          }`}
          onError={handleImageError}
        />

        {/* Neon glow overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-neon-blue/20 to-transparent z-15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

        {/* Category badge */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 bg-dark-bg/90 backdrop-blur-sm border border-neon-blue/30 px-2 py-1 sm:px-3 rounded-full text-xs font-medium text-neon-blue shadow-lg">
          {Array.isArray(game.category) ? game.category[0] : game.category}
        </div>

        {/* Favorite button with larger touch area */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20">
          <div className="p-1">
            <FavoriteButton
              gameId={game.id}
              size="small"
              className="bg-dark-bg/90 backdrop-blur-sm hover:bg-dark-card border border-neon-pink/30"
            />
          </div>
        </div>

        {/* Play overlay with neon effect */}
        <div className="absolute inset-0 bg-black/40 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <div className="relative">
            <div className="absolute inset-0 bg-neon-blue blur-xl opacity-50 animate-pulse"></div>
            <div className="relative bg-dark-bg border-2 border-neon-blue rounded-full w-12 h-12 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
              <i className="fas fa-play text-neon-blue text-lg ml-1"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Game Info */}
      <div className="p-3 sm:p-4">
        <h3 className="text-base sm:text-lg font-bold text-white mb-1 group-hover:text-neon-blue transition-colors line-clamp-1">
          {game.title}
        </h3>
        <p className="text-sm text-gray-400 line-clamp-2">{game.description}</p>
      </div>

      {/* Neon border effect */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink opacity-20 blur-sm"></div>
      </div>
    </Link>
  )
}

export default GameCard 