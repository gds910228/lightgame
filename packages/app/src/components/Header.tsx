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
        className={`sticky top-0 z-10 bg-white transition-all duration-300 ${
          isScrolled ? 'shadow-md' : ''
        }`}
      >
        {/* Mobile Header */}
        <div className="md:hidden container-custom py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <Link to="/" className="flex items-center group flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                <i className="fas fa-gamepad text-white text-base"></i>
              </div>
            </Link>

            {/* Search button */}
            <SearchBar onSearch={handleSearch} compact />

            {/* Favorites */}
            <button
              onClick={() => navigate('/?favorites=true')}
              className="relative p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"
              title="View favorites"
            >
              <i className="fas fa-heart text-red-500 text-lg"></i>
              {favoritesCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {favoritesCount}
                </span>
              )}
            </button>

            {/* Menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"
              aria-label="Open menu"
            >
              <i className="fas fa-bars text-xl text-gray-700"></i>
            </button>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block container-custom py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center group flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-12">
                <i className="fas fa-gamepad text-white text-xl"></i>
              </div>
              <div className="ml-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  <span className="text-primary-500">Light</span>
                  <span className="text-secondary-500">Game</span>
                </h1>
                <div className="text-xs text-gray-500 -mt-1">Instant fun, anytime</div>
              </div>
            </Link>

            {/* Search, Categories and Favorites */}
            <div className="flex items-center gap-4 flex-1 justify-end">
              <SearchBar onSearch={handleSearch} />
              <button
                onClick={() => navigate('/?favorites=true')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 hover:text-gray-900 flex-shrink-0"
                title="View favorites"
              >
                <i className="fas fa-heart text-red-500"></i>
                <span className="font-medium">Favorites</span>
                {favoritesCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
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
          <div className="md:hidden border-t border-gray-100">
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