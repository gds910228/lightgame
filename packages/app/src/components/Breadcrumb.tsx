import { Link, useLocation } from 'react-router-dom'

interface BreadcrumbItem {
  name: string
  path: string
}

const Breadcrumb = () => {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter(x => x)

  // 生成面包屑数据
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [
      { name: 'Home', path: '/' }
    ]

    // 如果是根路径，只返回Home
    if (pathnames.length === 0) {
      return [{ name: 'Home', path: '/' }]
    }

    // 处理游戏详情页
    if (pathnames[0] === 'game' && pathnames.length === 2) {
      breadcrumbs.push({ name: 'Games', path: '/' })
      breadcrumbs.push({ name: 'Game Details', path: location.pathname })
      return breadcrumbs
    }

    // 处理法律页面
    if (pathnames[0] === 'privacy-policy') {
      breadcrumbs.push({ name: 'Privacy Policy', path: location.pathname })
      return breadcrumbs
    }

    if (pathnames[0] === 'terms-of-service') {
      breadcrumbs.push({ name: 'Terms of Service', path: location.pathname })
      return breadcrumbs
    }

    if (pathnames[0] === 'contact') {
      breadcrumbs.push({ name: 'Contact Us', path: location.pathname })
      return breadcrumbs
    }

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  // 如果只有Home且在首页，不显示面包屑
  if (breadcrumbs.length === 1 && location.pathname === '/') {
    return null
  }

  return (
    <>
      {/* Breadcrumb Structured Data for SEO */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": breadcrumbs.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "item": `https://games.misitebo.win${item.path}`
          }))
        })}
      </script>

      {/* Visual Breadcrumb */}
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2 text-sm">
          {breadcrumbs.map((breadcrumb, index) => {
            const isLast = index === breadcrumbs.length - 1

            return (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <i className="fas fa-chevron-right text-gray-400 mx-2 text-xs"></i>
                )}

                {isLast ? (
                  <span className="text-gray-700 font-medium">
                    {breadcrumb.name}
                  </span>
                ) : (
                  <Link
                    to={breadcrumb.path}
                    className="text-gray-500 hover:text-primary-600 transition-colors"
                  >
                    {index === 0 ? (
                      <i className="fas fa-home"></i>
                    ) : (
                      <span>{breadcrumb.name}</span>
                    )}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}

export default Breadcrumb
