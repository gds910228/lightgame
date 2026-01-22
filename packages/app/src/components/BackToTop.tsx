import { useState, useEffect } from 'react'

const BackToTop = () => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      // Mobile: show after 300px, Desktop: show after 500px
      const threshold = window.innerWidth < 640 ? 300 : 500
      if (window.pageYOffset > threshold) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility, { passive: true })
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  return (
    <button
      onClick={scrollToTop}
      className={`
        fixed bottom-20 sm:bottom-20 right-4 z-40
        bg-gradient-to-br from-neon-blue to-neon-purple text-white
        w-12 h-12 sm:w-14 sm:h-14
        rounded-full shadow-lg
        flex items-center justify-center
        transition-all duration-300
        ${isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-10 scale-75 pointer-events-none'
        }
        hover:shadow-neon-blue hover:scale-110
        active:scale-95
      `}
      aria-label="Back to top"
    >
      <i className="fas fa-arrow-up text-lg"></i>
    </button>
  )
}

export default BackToTop
