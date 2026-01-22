import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import SearchBar from './SearchBar'
import CategoryFilter from './CategoryFilter'
import MobileMenu from './MobileMenu'
import { useFavorites } from '../contexts/FavoritesContext'

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const isHomePage = location.pathname === '/'
  const { getFavoritesCount } = useFavorites()
  const favoritesCount = getFavoritesCount()

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Handle search submit
  const handleSearch = (query: string) => {
    if (isHomePage) {
      // Use URL parameters for search on home page
      const searchParams = new URLSearchParams(location.search)
      searchParams.set('search', query)
      navigate(`/?${searchParams.toString()}`)
    } else {
      // Navigate to home page with search query
      navigate(`/?search=${encodeURIComponent(query)}`)
    }
  }

  return (
    <>
      <header
        className={`sticky top-0 z-10 bg-dark-bg/95 backdrop-blur-md transition-all duration-300 border-b ${
          isScrolled ? 'border-neon-blue/30 shadow-lg shadow-neon-blue/10' : 'border-transparent'
        }`}
      >
        {/* Mobile Header */}
        <div className="md:hidden container-custom py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <Link to="/" className="flex items-center group flex-shrink-0">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 bg-gradient-to-br from-neon-blue to-neon-purple rounded-lg rotate-45"></div>
                <div className="absolute inset-1 bg-dark-bg rounded-md flex items-center justify-center">
                  <i className="fas fa-gamepad text-neon-blue text-base"></i>
                </div>
              </div>
            </Link>

            {/* Search button */}
            <SearchBar onSearch={handleSearch} compact />

            {/* Favorites */}
            <button
              onClick={() => navigate('/?favorites=true')}
              className="relative p-2 rounded-lg hover:bg-dark-card flex-shrink-0 transition-colors"
              title="View favorites"
            >
              <i className="fas fa-heart text-neon-pink text-lg"></i>
              {favoritesCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-neon-pink text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {favoritesCount}
                </span>
              )}
            </button>

            {/* Menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-dark-card flex-shrink-0 transition-colors"
              aria-label="Open menu"
            >
              <i className="fas fa-bars text-xl text-gray-300"></i>
            </button>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block container-custom py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center group flex-shrink-0">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 bg-gradient-to-br from-neon-blue to-neon-purple rounded-lg rotate-45 transition-transform group-hover:rotate-90 group-hover:scale-110"></div>
                <div className="absolute inset-1.5 bg-dark-bg rounded-md flex items-center justify-center">
                  <i className="fas fa-gamepad text-neon-blue text-xl"></i>
                </div>
              </div>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-white">
                  <span className="text-neon-blue">LIGHT</span>
                  <span className="text-neon-pink">GAME</span>
                </h1>
                <div className="text-xs text-gray-400 -mt-1">Instant fun, anytime</div>
              </div>
            </Link>

            {/* Search, Categories and Favorites */}
            <div className="flex items-center gap-4 flex-1 justify-end">
              <SearchBar onSearch={handleSearch} />
              <button
                onClick={() => navigate('/?favorites=true')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-card border border-neon-pink/30 hover:bg-dark-border hover:border-neon-pink/50 transition-all flex-shrink-0 group"
                title="View favorites"
              >
                <i className="fas fa-heart text-neon-pink group-hover:animate-heart-beat"></i>
                <span className="font-medium text-gray-300">Favorites</span>
                {favoritesCount > 0 && (
                  <span className="bg-neon-pink text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center font-bold">
                    {favoritesCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Desktop: Category filter below header (only on home page) - auto wrap */}
          {isHomePage && (
            <div className="hidden md:block mt-4">
              <CategoryFilter />
            </div>
          )}
        </div>

        {/* Mobile: Category filter below header (only on home page) - horizontal scroll */}
        {isHomePage && (
          <div className="md:hidden border-t border-dark-border">
            <div className="container-custom py-3">
              <CategoryFilter />
            </div>
          </div>
        )}
      </header>

      {/* Mobile Menu Drawer */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
    </>
  )
}

export default Header 