import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface SearchBarProps {
  onSearch: (query: string) => void
  compact?: boolean // For mobile: show button only
}

const SearchBar = ({ onSearch, compact = false }: SearchBarProps) => {
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  // Extract search query from URL when component mounts or URL changes
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const searchParam = params.get('search')
    if (searchParam) {
      setSearchTerm(searchParam)
    }
  }, [location.search])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchTerm)
    if (compact) {
      setIsExpanded(false)
    }
  }

  // Compact mode for mobile: shows search icon button
  if (compact) {
    if (isExpanded) {
      return (
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            placeholder="Search games..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            className="w-48 sm:w-64 pl-10 pr-10 py-2 rounded-full border-2 border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <button
            type="submit"
            className="absolute left-0 top-0 h-full px-3 flex items-center text-primary-600"
            aria-label="Search"
          >
            <i className="fas fa-search"></i>
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </form>
      )
    }

    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Search"
      >
        <i className="fas fa-search text-gray-600 text-lg"></i>
      </button>
    )
  }

  // Full search bar (desktop)
  return (
    <form onSubmit={handleSubmit} className="relative w-full md:w-64">
      <input
        type="text"
        placeholder="Search games..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
      />
      <button
        type="submit"
        className="absolute left-0 top-0 h-full px-3 flex items-center text-gray-500 hover:text-primary-600"
        aria-label="Search"
      >
        <i className="fas fa-search"></i>
      </button>
    </form>
  )
}

export default SearchBar 