import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'game'
  game?: {
    name: string
    category: string
    description: string
    thumbnail: string
  }
}

const SEO = ({
  title = 'LightGame - Quick Games for Quick Breaks',
  description = 'Play free online games instantly! No downloads, no registrations. 40+ puzzle, action, and arcade games perfect for your break.',
  image = '/og-image.jpg',
  url = 'https://games.misitebo.win/',
  type = 'website',
  game
}: SEOProps) => {

  // 构建结构化数据
  const buildStructuredData = () => {
    if (game) {
      // 游戏页面结构化数据
      return {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": game.name,
        "genre": Array.isArray(game.category) ? game.category.join(', ') : game.category,
        "description": game.description,
        "image": game.thumbnail,
        "url": url,
        "playMode": "SinglePlayer",
        "publisher": {
          "@type": "Organization",
          "name": "LightGame",
          "url": "https://games.misitebo.win"
        },
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.5",
          "ratingCount": "89"
        }
      }
    } else {
      // 首页结构化数据
      return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "LightGame",
        "alternateName": "QuickGames",
        "url": "https://games.misitebo.win/",
        "description": "Play free online games instantly without downloads",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://games.misitebo.win/?search={search_term_string}",
          "query-input": "required name=search_term_string"
        },
        "publisher": {
          "@type": "Organization",
          "name": "LightGame",
          "url": "https://games.misitebo.win"
        }
      }
    }
  }

  const structuredData = buildStructuredData()

  return (
    <Helmet>
      {/* 基础Meta标签 */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content="free online games, puzzle games, arcade games, tetris, snake, pacman, browser games, no download games, quick games" />
      <meta name="author" content="LightGame" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:site_name" content="LightGame" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* 结构化数据 */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  )
}

export default SEO
