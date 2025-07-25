import { Link } from 'react-router-dom'
import { Game } from '../types'
import { useFavorites } from '../contexts/FavoritesContext'
import { useEffect } from 'react'

interface GameCardProps {
  game: Game;
}

const GameCard = ({ game }: GameCardProps) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const isGameFavorite = isFavorite(game.id);

  useEffect(() => {
    // 在组件挂载时打印图片URL，帮助调试
    console.log(`Game ${game.id} image URL:`, game.image);
  }, [game]);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault(); // 阻止Link导航
    e.stopPropagation(); // 阻止事件冒泡
    toggleFavorite(game.id);
  };

  return (
    <Link to={`/game/${game.id}`} className="card group">
      {/* Game Image */}
      <div className="relative h-48 overflow-hidden">
        {/* Fallback image if the game image fails to load */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-primary-300 flex items-center justify-center">
          <i className="fas fa-gamepad text-primary-600 text-4xl animate-pulse-slow"></i>
        </div>
        
        {/* Actual game image */}
        <img 
          src={game.image} 
          alt={game.title}
          className="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            // 打印错误信息
            console.error(`Failed to load image for game ${game.id}:`, game.image);
            // Hide the image on error, showing the fallback
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        
        {/* Category badge */}
        <div className="absolute top-2 right-2 z-20 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-gray-800 transition-transform duration-300 group-hover:scale-105 group-hover:bg-white/90">
          {game.category}
        </div>

        {/* Favorite button */}
        <button
          onClick={handleFavoriteClick}
          className={`absolute top-2 left-2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
            isGameFavorite 
              ? 'bg-red-500 text-white shadow-lg' 
              : 'bg-white/80 backdrop-blur-sm text-gray-600 hover:bg-white/90 hover:text-red-500'
          }`}
          title={isGameFavorite ? '取消收藏' : '添加到收藏'}
        >
          <i className={`fas fa-heart text-sm ${isGameFavorite ? 'animate-pulse' : ''}`}></i>
        </button>
        
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/30 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="bg-white/90 rounded-full w-12 h-12 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
            <i className="fas fa-play text-primary-500 text-lg"></i>
          </div>
        </div>
      </div>
      
      {/* Game Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors flex-1">{game.title}</h3>
          {isGameFavorite && (
            <i className="fas fa-heart text-red-500 text-sm ml-2 mt-1"></i>
          )}
        </div>
        <p className="text-gray-600 text-sm line-clamp-2">{game.description}</p>
      </div>
    </Link>
  )
}

export default GameCard