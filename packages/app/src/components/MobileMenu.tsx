import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useFavorites } from '../contexts/FavoritesContext'
import CategoryFilter from './CategoryFilter'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

const MobileMenu = ({ isOpen, onClose }: MobileMenuProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { getFavoritesCount } = useFavorites()
  const favoritesCount = getFavoritesCount()

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Handle category click
  const handleCategoryClick = (category: string) => {
    const params = new URLSearchParams(location.search)

    if (category === 'All') {
      params.delete('category')
    } else {
      params.set('category', category)
    }

    navigate(`/?${params.toString()}`)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 md:hidden"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"></div>

      {/* Menu Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-dark-card shadow-2xl border-l border-dark-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-dark-card border-b border-dark-border px-4 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">菜单</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-dark-border transition-colors"
            aria-label="Close menu"
          >
            <i className="fas fa-times text-xl text-gray-400"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Categories Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center">
              <i className="fas fa-th-large mr-2"></i>
              Game Categories
            </h3>
            <div className="space-y-2">
              <CategoryFilter onItemClick={handleCategoryClick} />
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center">
              <i className="fas fa-compass mr-2"></i>
              Quick Links
            </h3>
            <nav className="space-y-1">
              <Link
                to="/"
                onClick={onClose}
                className="flex items-center px-4 py-3 rounded-lg hover:bg-dark-border transition-colors"
              >
                <i className="fas fa-home text-neon-blue w-6"></i>
                <span className="ml-3 font-medium text-gray-300">Home</span>
              </Link>
              <Link
                to="/?favorites=true"
                onClick={onClose}
                className="flex items-center px-4 py-3 rounded-lg hover:bg-dark-border transition-colors"
              >
                <i className="fas fa-heart text-neon-pink w-6"></i>
                <span className="ml-3 font-medium text-gray-300">My Favorites</span>
                {favoritesCount > 0 && (
                  <span className="ml-auto bg-neon-pink/20 text-neon-pink border border-neon-pink/30 text-xs font-medium px-2 py-1 rounded-full">
                    {favoritesCount}
                  </span>
                )}
              </Link>
            </nav>
          </div>

          {/* Info Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center">
              <i className="fas fa-info-circle mr-2"></i>
              Information
            </h3>
            <nav className="space-y-1">
              <Link
                to="/about"
                onClick={onClose}
                className="flex items-center px-4 py-3 rounded-lg hover:bg-dark-border transition-colors"
              >
                <i className="fas fa-info-circle text-neon-blue w-6"></i>
                <span className="ml-3 font-medium text-gray-300">About Us</span>
              </Link>
              <Link
                to="/privacy-policy"
                onClick={onClose}
                className="flex items-center px-4 py-3 rounded-lg hover:bg-dark-border transition-colors"
              >
                <i className="fas fa-shield-alt text-neon-green w-6"></i>
                <span className="ml-3 font-medium text-gray-300">Privacy Policy</span>
              </Link>
              <Link
                to="/terms-of-service"
                onClick={onClose}
                className="flex items-center px-4 py-3 rounded-lg hover:bg-dark-border transition-colors"
              >
                <i className="fas fa-file-contract text-neon-yellow w-6"></i>
                <span className="ml-3 font-medium text-gray-300">Terms of Service</span>
              </Link>
              <Link
                to="/contact"
                onClick={onClose}
                className="flex items-center px-4 py-3 rounded-lg hover:bg-dark-border transition-colors"
              >
                <i className="fas fa-envelope text-neon-purple w-6"></i>
                <span className="ml-3 font-medium text-gray-300">Contact Us</span>
              </Link>
            </nav>
          </div>

          {/* Footer Info */}
          <div className="pt-4 border-t border-dark-border">
            <p className="text-xs text-gray-500 text-center">
              <i className="fas fa-gamepad text-neon-blue mr-1"></i>
              LightGame - Instant fun, anytime
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileMenu
