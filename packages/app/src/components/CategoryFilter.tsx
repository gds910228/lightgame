import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getAllGames } from '../services/gameService'

const CategoryFilter = () => {
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
    // Update URL with the selected category
    const params = new URLSearchParams(location.search)
    
    if (category === 'All') {
      params.delete('category')
    } else {
      params.set('category', category)
    }
    
    navigate(`/?${params.toString()}`)
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => handleCategoryClick(category)}
          className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
            activeCategory === category
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  )
}

export default CategoryFilter