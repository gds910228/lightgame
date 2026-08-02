import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// 路由切换时将页面滚动位置重置到顶部。
// 避免从长列表（如首页）进入较短页面（如游戏详情页）时，
// 旧的 scrollY 超出新页面可滚动高度而被钳制到底部。
const ScrollToTop = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

export default ScrollToTop
