import React, { useState } from 'react';
import { useFavorites } from '../contexts/FavoritesContext';

interface FavoriteButtonProps {
  gameId: string;
  className?: string;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({ 
  gameId, 
  className = '', 
  showText = false,
  size = 'medium'
}) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const [showToast, setShowToast] = useState(false);
  const isGameFavorite = isFavorite(gameId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    toggleFavorite(gameId);
    
    // Add heart beat animation
    const button = e.currentTarget;
    button.classList.add('animate-heart-beat');
    setTimeout(() => {
      button.classList.remove('animate-heart-beat');
    }, 600);
    
    // Show toast notification
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-6 h-6 text-sm';
      case 'large':
        return 'w-10 h-10 text-xl';
      default:
        return 'w-8 h-8 text-base';
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`
          ${getSizeClasses()}
          flex items-center justify-center
          rounded-full
          transition-all duration-200
          hover:scale-110
          focus:outline-none focus:ring-2 focus:ring-neon-pink/50
          ${isGameFavorite
            ? 'text-neon-pink hover:text-neon-pink/80'
            : 'text-gray-400 hover:text-neon-pink'
          }
          ${className}
        `}
        title={isGameFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={isGameFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <svg
          className="w-full h-full"
          fill={isGameFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={isGameFavorite ? 0 : 2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        {showText && (
          <span className="ml-2">
            {isGameFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </span>
        )}
      </button>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-bounce-in">
          <div className={`
            px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium
            ${isGameFavorite
              ? 'bg-neon-green text-dark-bg'
              : 'bg-dark-card border border-neon-pink/30 text-neon-pink'
            }
          `}>
            {isGameFavorite
              ? 'Game added to favorites!'
              : 'Game removed from favorites!'
            }
          </div>
        </div>
      )}
    </>
  );
};

export default FavoriteButton;