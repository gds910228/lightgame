import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar = ({ onSearch }: SearchBarProps) => {
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  
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
  }
  
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
      >
        <i className="fas fa-search"></i>
      </button>
    </form>
  )
}

export default SearchBar 