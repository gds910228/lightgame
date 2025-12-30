import { Link, useLocation } from 'react-router-dom'
import { useFavorites } from '../contexts/FavoritesContext'

interface NavItem {
  path: string
  icon: string
  label: string
}

const MobileBottomNav = () => {
  const location = useLocation()
  const { getFavoritesCount } = useFavorites()
  const favoritesCount = getFavoritesCount()

  const navItems: NavItem[] = [
    { path: '/', icon: 'fa-home', label: 'Home' },
    { path: '/?favorites=true', icon: 'fa-heart', label: 'Favorites' },
    { path: '#', icon: 'fa-search', label: 'Search' }, // Search button triggers Header's search
    { path: '/about', icon: 'fa-info-circle', label: 'About' },
  ]

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' && !location.search.includes('favorites')
    }
    if (path.includes('favorites')) {
      return location.search.includes('favorites')
    }
    return location.pathname === path
  }

  const handleSearchClick = () => {
    // Find and click the compact search button in Header
    const searchButton = document.querySelector('button[aria-label="Search"]') as HTMLButtonElement
    if (searchButton) {
      searchButton.click()
      // Focus on the input after a short delay to allow the search to expand
      setTimeout(() => {
        const searchInput = document.querySelector('input[placeholder="Search games..."]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }, 100)
    }
  }

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const active = isActive(item.path)
          const badge = item.icon === 'fa-heart' && favoritesCount > 0 ? favoritesCount : 0

          // Special handling for search button
          if (item.icon === 'fa-search') {
            return (
              <button
                key={item.path}
                onClick={handleSearchClick}
                className={`
                  flex flex-col items-center justify-center
                  min-w-[64px] py-2 px-3 rounded-lg
                  transition-all duration-200
                  text-gray-500 hover:text-gray-700
                `}
                style={{ minHeight: '56px' }}
              >
                <i className={`fas ${item.icon} text-xl mb-1`}></i>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center justify-center
                min-w-[64px] py-2 px-3 rounded-lg
                transition-all duration-200
                ${active
                  ? 'text-primary-500'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
              style={{ minHeight: '56px' }}
            >
              <div className="relative">
                <i className={`fas ${item.icon} text-xl mb-1`}></i>
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileBottomNav
