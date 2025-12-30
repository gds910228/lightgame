import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getAllGames } from '../services/gameService'

interface CategoryFilterProps {
  onItemClick?: (category: string) => void
}

const categoryIcons: Record<string, string> = {
  'All': 'fa-globe',
  'Puzzle': 'fa-puzzle-piece',
  'Action': 'fa-bolt',
  'Adventure': 'fa-compass',
  'Strategy': 'fa-chess',
  'Sports': 'fa-futbol',
  'Arcade': 'fa-ghost',
  'Racing': 'fa-car',
  'Multiplayer': 'fa-users',
}

const CategoryFilter = ({ onItemClick }: CategoryFilterProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeCategory, setActiveCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>(['All'])

  // Load categories dynamically from games data
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const games = await getAllGames()
        const categorySet = new Set<string>(['All'])

        games.forEach(game => {
          if (Array.isArray(game.category)) {
            game.category.forEach(cat => categorySet.add(cat))
          } else if (game.category) {
            categorySet.add(game.category)
          }
        })

        const sortedCategories = Array.from(categorySet).sort((a, b) => {
          if (a === 'All') return -1
          if (b === 'All') return 1
          return a.localeCompare(b)
        })

        setCategories(sortedCategories)
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }

    loadCategories()
  }, [])

  // Extract category from URL when component mounts or URL changes
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const categoryParam = params.get('category')
    if (categoryParam && categories.includes(categoryParam)) {
      setActiveCategory(categoryParam)
    } else {
      setActiveCategory('All')
    }
  }, [location.search, categories])

  const handleCategoryClick = (category: string) => {
    setActiveCategory(category)

    // If onItemClick callback is provided, use it (for mobile menu)
    if (onItemClick) {
      onItemClick(category)
      return
    }

    // Otherwise, update URL (default behavior)
    const params = new URLSearchParams(location.search)

    if (category === 'All') {
      params.delete('category')
    } else {
      params.set('category', category)
    }

    navigate(`/?${params.toString()}`)
  }

  return (
    <div className="relative">
      {/* Mobile: Horizontal scroll */}
      <div className="flex md:hidden gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {categories.map((category) => {
          const icon = categoryIcons[category]
          return (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={`
                flex-shrink-0 flex items-center gap-2
                px-4 py-2 rounded-full text-sm font-medium
                transition-all duration-300 whitespace-nowrap
                snap-start
                ${activeCategory === category
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-md'
                }
              `}
              style={{ minHeight: '44px' }}
            >
              {icon && <i className={`fas ${icon} text-xs`}></i>}
              <span>{category}</span>
            </button>
          )
        })}
      </div>

      {/* Mobile scroll indicator */}
      <div className="flex justify-end mt-0 md:hidden">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <i className="fas fa-arrows-alt-h"></i>
          滑动查看更多
        </span>
      </div>

      {/* Desktop: Auto wrap to multiple lines */}
      <div className="hidden md:flex flex-wrap gap-2">
        {categories.map((category) => {
          const icon = categoryIcons[category]
          return (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={`
                inline-flex items-center gap-2
                px-4 py-2 rounded-full text-sm font-medium
                transition-all duration-300
                ${activeCategory === category
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-md'
                }
              `}
            >
              {icon && <i className={`fas ${icon} text-xs`}></i>}
              <span>{category}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default CategoryFilter