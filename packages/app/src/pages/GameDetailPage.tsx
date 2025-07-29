import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getGameById } from '../services/gameService'
import { Game } from '../types'
import FavoriteButton from '../components/FavoriteButton'
import ShareButton from '../components/ShareButton'
import ToastNotification from '../components/ToastNotification'
import { usePerformance } from '../contexts/PerformanceContext'

const GameDetailPage = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const { recordGameLoad, recordGamePlay, recordLoadError } = usePerformance()
  const startTimeRef = useRef(Date.now())
  
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [showToast, setShowToast] = useState(false)
  
  const fullscreenContainerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const exitButtonRef = useRef<HTMLButtonElement>(null)
  
  // Fetch game details
  useEffect(() => {
    const fetchGameDetails = async () => {
      if (!gameId) {
        setError('Game ID is missing')
        setLoading(false)
        return
      }
      
      try {
        const gameData = await getGameById(gameId)
        
        if (!gameData) {
          setError('Game not found')
        } else {
          setGame(gameData)
        }
      } catch (err) {
        console.error('Error fetching game details:', err)
        setError('Failed to load game details. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchGameDetails()
  }, [gameId])

  // Record game play event
  useEffect(() => {
    if (gameId) {
      recordGamePlay(gameId);
    }
  }, [gameId, recordGamePlay]);
  
  // Handle fullscreen mode
  const enterFullScreen = () => {
    if (!game) return;
    
    setIsFullScreen(true);
    setIframeLoaded(false);
    
    // Request fullscreen on the container
    const container = fullscreenContainerRef.current;
    if (container) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        (container as any).mozRequestFullScreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
    }
    
    // Listen for fullscreen change events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  };
  
  // Handle fullscreen change events
  const handleFullscreenChange = () => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    )
    
    if (!isCurrentlyFullscreen && isFullScreen) {
      exitFullScreen()
    }
  }
  
  // Exit fullscreen mode
  const exitFullScreen = () => {
    setIsFullScreen(false)
    setIframeLoaded(false)
    
    // Remove event listeners
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    
    // Exit fullscreen if needed
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen()
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen()
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen()
    }
  }
  
  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  // Handle keyboard events for the iframe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullScreen && iframeRef.current) {
        // 将键盘事件传递给iframe
        const iframe = iframeRef.current;
        const iframeWindow = iframe.contentWindow;
        if (iframeWindow) {
          iframeWindow.focus();
        }
      }
      
      // 处理ESC键退出全屏
      if (e.key === 'Escape' && isFullScreen) {
        exitFullScreen();
      }
    };

    if (isFullScreen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullScreen]);

  const handleShare = useCallback(async (score?: number) => {
    if (!game) return;

    let shareText;
    if (score !== undefined) {
      // Special message for Beat the Cat game with score
      if (game.title.includes('神经猫') || game.title.includes('Beat the Cat')) {
        shareText = `我打爆了${score}只神经猫，不服来挑战！！！`;
      } else {
        shareText = `I scored ${score} in ${game.title}! Can you beat me?`;
      }
    } else {
      shareText = `Check out this game: ${game.title}`;
    }

    const shareData = {
      title: game.title,
      text: shareText,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        console.log('Game shared successfully');
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      // Fallback for browsers that do not support the Web Share API
      navigator.clipboard.writeText(`${shareText} ${shareData.url}`).then(() => {
        setShowToast(true);
      });
    }
  }, [game, setShowToast]);

  // Listen for messages from the game iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SHARE_GAME') {
        const { score } = event.data.data;
        handleShare(score);
      } else if (event.data.type === 'NAVIGATE_TO_HOME' || event.data.action === 'navigateHome') {
        // Navigate to home page
        window.location.href = '/';
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Also expose the share function directly for backward compatibility
    (window as any).handleGlobalShare = handleShare;
    
    return () => {
      window.removeEventListener('message', handleMessage);
      delete (window as any).handleGlobalShare;
    };
  }, [handleShare]);
  
  // 确保退出按钮始终在最上层并可点击
  useEffect(() => {
    if (isFullScreen && exitButtonRef.current) {
      // 确保按钮在iframe之上
      exitButtonRef.current.style.pointerEvents = 'auto';
      
      // 添加点击事件监听器
      const handleExitClick = () => exitFullScreen();
      exitButtonRef.current.addEventListener('click', handleExitClick);
      
      return () => {
        if (exitButtonRef.current) {
          exitButtonRef.current.removeEventListener('click', handleExitClick);
        }
      };
    }
  }, [isFullScreen]);
  
  // 添加iframe加载事件处理
  const handleIframeLoad = () => {
    const loadTime = Date.now() - startTimeRef.current
    recordGameLoad(loadTime)
    console.log(`iframe loaded in ${loadTime}ms:`, game?.path)
    
    // 尝试访问iframe内容以检查是否成功加载
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        // 设置iframe为已加载状态
        setIframeLoaded(true);
        console.log('iframe content window accessible');
      }
    } catch (err) {
      console.error('Error accessing iframe content:', err);
    }
  };

  // 添加iframe错误处理
  const handleIframeError = () => {
    recordLoadError()
    console.error('iframe failed to load:', game?.path);
    setError('游戏加载失败，请刷新页面重试');
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }
  
  if (error || !game) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p>{error || 'Game not found'}</p>
        <Link to="/" className="mt-4 inline-block text-primary-600 hover:underline">
          &larr; Back to all games
        </Link>
      </div>
    )
  }
  
  return (
    <>
      {showToast && (
        <ToastNotification
          message="Link copied to clipboard!"
          onClose={() => setShowToast(false)}
        />
      )}
      {/* Normal view */}
      <div className={`animate-fade-in ${isFullScreen ? 'hidden' : ''}`}>
        {/* Back button */}
        <Link to="/" className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-6 group">
          <i className="fas fa-arrow-left mr-2 transition-transform group-hover:-translate-x-1"></i>
          Back to all games
        </Link>
        
        {/* Game details */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden max-w-6xl mx-auto">
          <div className="lg:flex">
            {/* Game image */}
            <div className="lg:flex-shrink-0 lg:w-2/5 h-64 lg:h-auto relative">
              {/* Fallback image */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-primary-300 flex items-center justify-center">
                <i className="fas fa-gamepad text-primary-600 text-5xl animate-pulse-slow"></i>
              </div>
              
              {/* Actual game image */}
              <img 
                src={game.image} 
                alt={game.title}
                className="absolute inset-0 w-full h-full object-cover z-10"
                onError={(e) => {
                  // Hide the image on error, showing the fallback
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              
              {/* Category badge */}
              <div className="absolute top-4 right-4 z-20 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-gray-800">
                {game.category}
              </div>
            </div>
            
            {/* Game info */}
            <div className="p-6 lg:p-8 lg:w-3/5">
              <div className="flex items-center mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{game.title}</h1>
                <div className="ml-auto flex gap-2">
                  <FavoriteButton 
                    gameId={game.id} 
                    size="large"
                    className="bg-gray-100 hover:bg-gray-200 transition-colors"
                  />
                  <ShareButton onClick={handleShare} />
                </div>
              </div>
              
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Description</h2>
                <p className="text-gray-700">{game.description}</p>
              </div>
              
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-2">Controls</h2>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200 font-mono text-sm">
                  {game.controls}
                </p>
              </div>
              
              
              {/* Play button */}
              <button
                onClick={enterFullScreen}
                className="btn btn-primary w-full flex items-center justify-center group"
              >
                <i className="fas fa-play mr-2 group-hover:animate-pulse"></i>
                Play Game
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Fullscreen container */}
      <div 
        ref={fullscreenContainerRef}
        className={`fixed inset-0 bg-black z-50 ${isFullScreen ? 'block' : 'hidden'}`}
      >
        {/* Game iframe */}
        {isFullScreen && (
          <>
            {/* 添加一个预加载指示器 - 修改为在iframe加载完成后隐藏 */}
            <div className={`absolute inset-0 flex items-center justify-center bg-black transition-opacity duration-300 ${iframeLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div className="text-white text-lg">游戏加载中...</div>
            </div>
            
            <iframe
              ref={iframeRef}
              src={game.path}
              className="w-full h-full border-0"
              title={game.title}
              sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-popups allow-modals"
              allow="fullscreen; gamepad; keyboard; accelerometer; autoplay"
              loading="eager"
              referrerPolicy="no-referrer"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              style={{ backgroundColor: '#000' }}
            ></iframe>
            
            {/* Exit button - 使用绝对定位确保始终在最上层 */}
            <button
              ref={exitButtonRef}
              onClick={exitFullScreen}
              className="absolute top-4 right-4 bg-red-600 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors z-[9999]"
              style={{ 
                cursor: 'pointer',
                pointerEvents: 'auto',
                boxShadow: '0 0 10px rgba(0,0,0,0.5)'
              }}
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </>
        )}
      </div>
    </>
  )
}

export default GameDetailPage 