import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const CATEGORIES = ['All', 'Puzzle', 'Action', 'Strategy', 'Casual', 'Quiz', 'Arcade', 'Classic', 'Creative', 'Racing']

const CategoryFilter = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeCategory, setActiveCategory] = useState('All')
  
  // Extract category from URL when component mounts or URL changes
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const categoryParam = params.get('category')
    if (categoryParam && CATEGORIES.includes(categoryParam)) {
      setActiveCategory(categoryParam)
    } else {
      setActiveCategory('All')
    }
  }, [location.search])
  
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
      {CATEGORIES.map((category) => (
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