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
            className="w-48 sm:w-64 pl-10 pr-10 py-2 rounded-full border-2 border-neon-blue bg-dark-bg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-blue/50 focus:shadow-neon-blue"
          />
          <button
            type="submit"
            className="absolute left-0 top-0 h-full px-3 flex items-center text-neon-blue hover:text-neon-purple transition-colors"
            aria-label="Search"
          >
            <i className="fas fa-search"></i>
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
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
        className="p-2 rounded-full hover:bg-dark-card transition-colors"
        aria-label="Search"
      >
        <i className="fas fa-search text-gray-300 text-lg"></i>
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
        className="w-full pl-10 pr-4 py-2 rounded-full border border-dark-border bg-dark-card text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-blue/50 focus:border-neon-blue transition-all"
      />
      <button
        type="submit"
        className="absolute left-0 top-0 h-full px-3 flex items-center text-gray-400 hover:text-neon-blue transition-colors"
        aria-label="Search"
      >
        <i className="fas fa-search"></i>
      </button>
    </form>
  )
}

export default SearchBar 