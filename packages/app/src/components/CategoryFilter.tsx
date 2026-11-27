import { useState, useEffect, useMemo, useRef } from 'react'
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
  'Duel': 'fa-bolt',
}

// 热门分类：按收录游戏数取前 N 个固定展示，其余收进 More 下拉
const POPULAR_COUNT = 8

// 一些游戏的分类是 "A,B" 组合串，统一拆成单标签
const splitCategory = (cat: unknown): string[] =>
  typeof cat === 'string'
    ? cat.split(',').map(part => part.trim()).filter(Boolean)
    : []

const CategoryFilter = ({ onItemClick }: CategoryFilterProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeCategory, setActiveCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>(['All'])
  const [popular, setPopular] = useState<string[]>([])
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // Load categories dynamically from games data
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const games = await getAllGames()
        const categorySet = new Set<string>(['All'])
        const counts = new Map<string, number>()

        games.forEach(game => {
          const cats = Array.isArray(game.category)
            ? game.category.flatMap(splitCategory)
            : splitCategory(game.category)
          cats.forEach(cat => {
            categorySet.add(cat)
            counts.set(cat, (counts.get(cat) || 0) + 1)
          })
        })

        const sortedCategories = Array.from(categorySet).sort((a, b) => {
          if (a === 'All') return -1
          if (b === 'All') return 1
          return a.localeCompare(b)
        })
        setCategories(sortedCategories)

        // 按游戏数取热门分类（并列时字母序），All 固定第一
        const popularSorted = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, POPULAR_COUNT)
          .map(([cat]) => cat)
        setPopular(popularSorted)
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

  // Close the More dropdown on outside click or Escape
  useEffect(() => {
    if (!moreOpen) return
    const onPointerDown = (e: { target: unknown }) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [moreOpen])

  const handleCategoryClick = (category: string) => {
    setActiveCategory(category)
    setMoreOpen(false)

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

  // 固定栏：All + 热门分类；当前选中的分类若在 More 里则提升到固定栏，保证可见
  const fixedCategories = useMemo(() => {
    const fixed = ['All', ...popular]
    if (activeCategory !== 'All' && categories.length && !fixed.includes(activeCategory) && categories.includes(activeCategory)) {
      fixed.push(activeCategory)
    }
    return fixed
  }, [popular, activeCategory, categories])

  // More 面板：其余全部分类（字母序）
  const moreCategories = useMemo(
    () => categories.filter(cat => cat !== 'All' && !fixedCategories.includes(cat)),
    [categories, fixedCategories],
  )

  const chipClass = (category: string) => `
    inline-flex items-center gap-2
    px-4 py-2 rounded-full text-sm font-medium
    transition-all duration-300 border whitespace-nowrap
    ${activeCategory === category
      ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white shadow-lg shadow-neon-blue/30 border-neon-blue scale-105'
      : 'bg-dark-card text-gray-300 border-dark-border hover:bg-dark-border hover:border-neon-blue/50'
    }
  `

  const renderChip = (category: string) => {
    const icon = categoryIcons[category]
    return (
      <button
        key={category}
        onClick={() => handleCategoryClick(category)}
        className={chipClass(category)}
        style={{ minHeight: '44px' }}
      >
        {icon && <i className={`fas ${icon} text-xs`}></i>}
        <span>{category}</span>
      </button>
    )
  }

  return (
    <div className="relative">
      {/* Mobile: Horizontal scroll */}
      <div className="flex md:hidden gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {categories.map(renderChip)}
      </div>

      {/* Mobile scroll indicator */}
      <div className="flex justify-end mt-0 md:hidden">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <i className="fas fa-arrows-alt-h"></i>
          Swipe for more
        </span>
      </div>

      {/* Desktop: Popular categories in one row + More dropdown for the rest */}
      <div className="hidden md:flex flex-wrap items-center gap-2">
        {fixedCategories.map(renderChip)}

        {moreCategories.length > 0 && (
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(open => !open)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              className={`
                inline-flex items-center gap-2
                px-4 py-2 rounded-full text-sm font-medium
                transition-all duration-300 border
                ${moreOpen
                  ? 'bg-dark-border text-white border-neon-blue/60'
                  : 'bg-dark-card text-gray-300 border-dark-border hover:bg-dark-border hover:border-neon-blue/50'}
              `}
              style={{ minHeight: '44px' }}
            >
              <i className="fas fa-layer-group text-xs"></i>
              <span>More</span>
              <i className={`fas fa-chevron-down text-[10px] transition-transform duration-300 ${moreOpen ? 'rotate-180' : ''}`}></i>
            </button>

            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 z-30 w-[min(620px,85vw)] rounded-xl border border-dark-border bg-dark-card/95 backdrop-blur-md shadow-2xl shadow-black/50 p-4">
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                  <i className="fas fa-tags"></i>
                  All categories
                </p>
                <div className="flex flex-wrap gap-2 max-h-[56vh] overflow-y-auto pr-1">
                  {moreCategories.map(category => {
                    const icon = categoryIcons[category]
                    return (
                      <button
                        key={category}
                        onClick={() => handleCategoryClick(category)}
                        className={`
                          inline-flex items-center gap-1.5
                          px-3 py-1.5 rounded-full text-sm
                          transition-all duration-200 border
                          ${activeCategory === category
                            ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white border-neon-blue'
                            : 'bg-dark-bg/60 text-gray-300 border-dark-border hover:bg-dark-border hover:border-neon-blue/50'}
                        `}
                      >
                        {icon && <i className={`fas ${icon} text-[10px]`}></i>}
                        <span>{category}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CategoryFilter
