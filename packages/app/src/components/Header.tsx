import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import SearchBar from './SearchBar'
import CategoryFilter from './CategoryFilter'
import { useFavorites } from '../contexts/FavoritesContext'

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false)
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
    <header 
      className={`sticky top-0 z-10 bg-white transition-all duration-300 ${
        isScrolled ? 'shadow-md' : ''
      }`}
    >
      <div className="container-custom py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center group">
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
        <div className="flex flex-col md:flex-row items-center gap-4">
          {isHomePage && <CategoryFilter />}
          <SearchBar onSearch={handleSearch} />
          
          {/* Favorites button */}
          <button
            onClick={() => navigate('/?favorites=true')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 hover:text-gray-900"
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
    </header>
  )
}

export default Header 