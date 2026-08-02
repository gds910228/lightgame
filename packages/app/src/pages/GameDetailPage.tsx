import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getGameById, getAllGames } from '../services/gameService'
import { Game } from '../types'
import SEO from '../components/SEO'
import Breadcrumb from '../components/Breadcrumb'
import FavoriteButton from '../components/FavoriteButton'
import ShareButton from '../components/ShareButton'
import ToastNotification from '../components/ToastNotification'
import GameProgressCard from '../components/GameProgressCard'
import { usePerformance } from '../contexts/PerformanceContext'
import { useProgress } from '../contexts/ProgressContext'
import { useAchievements } from '../contexts/AchievementsContext'
import { getAchievementById } from '../services/achievementEngine'
import AchievementIcon from '../components/AchievementIcon'
import { isLightGameReportMessage, parseReportMessage, buildReadyMessage } from '../services/gameMessageProtocol'

// Typed Fullscreen API helpers (avoid `as any` for vendor prefixes)
interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
  msRequestFullscreen?: () => Promise<void>
}
interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null
  msFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
  msExitFullscreen?: () => Promise<void>
}

function requestFullscreen(el: HTMLElement): void {
  const fe = el as FullscreenElement
  if (el.requestFullscreen) {
    void el.requestFullscreen()
  } else if (fe.webkitRequestFullscreen) {
    void fe.webkitRequestFullscreen()
  } else if (fe.msRequestFullscreen) {
    void fe.msRequestFullscreen()
  }
}

function getFullscreenElement(): Element | null {
  const d = document as FullscreenDocument
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? d.msFullscreenElement ?? null
}

function exitFullscreenApi(): void {
  const d = document as FullscreenDocument
  if (document.exitFullscreen) {
    void document.exitFullscreen()
  } else if (d.webkitExitFullscreen) {
    void d.webkitExitFullscreen()
  } else if (d.msExitFullscreen) {
    void d.msExitFullscreen()
  }
}

const GameDetailPage = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const { recordGameLoad, recordGamePlay, recordLoadError } = usePerformance()
  const { recordPlayStart, recordPlayEnd, recordScore, recordProgress, recordEvent } = useProgress()
  const startTimeRef = useRef(Date.now())

  const [game, setGame] = useState<Game | null>(null)
  const [relatedGames, setRelatedGames] = useState<Game[]>([])
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

  // Record game play event (performance page-view metric)
  useEffect(() => {
    if (gameId) {
      recordGamePlay(gameId);
    }
  }, [gameId, recordGamePlay]);

  // Fetch related games
  useEffect(() => {
    const fetchRelatedGames = async () => {
      if (!game) return

      try {
        const allGames = await getAllGames()

        // Filter related games by category and exclude current game
        const gameCategory = Array.isArray(game.category) ? game.category[0] : game.category
        const related = allGames
          .filter(g =>
            g.id !== game.id &&
            (Array.isArray(g.category) ? g.category.includes(gameCategory) : g.category === gameCategory)
          )
          .slice(0, 4) // Get max 4 related games

        setRelatedGames(related)
      } catch (err) {
        console.error('Error fetching related games:', err)
      }
    }

    fetchRelatedGames()
  }, [game])

  // Exit fullscreen mode (ends the play session and accrues duration)
  const exitFullScreen = useCallback(() => {
    setIsFullScreen(false)
    setIframeLoaded(false)

    // Accrue the play session duration
    recordPlayEnd()

    // Exit browser fullscreen if still active (e.g. ESC triggers this via the change event)
    if (getFullscreenElement()) {
      exitFullscreenApi()
    }
  }, [recordPlayEnd])

  // Enter fullscreen mode
  const enterFullScreen = useCallback(() => {
    if (!game) return;

    setIsFullScreen(true);
    setIframeLoaded(false);

    // Record a play session for progress tracking
    recordPlayStart(game.id);

    // Request fullscreen on the container
    const container = fullscreenContainerRef.current;
    if (container) {
      requestFullscreen(container);
    }
  }, [game, recordPlayStart]);

  // Subscribe to fullscreen change events while in fullscreen mode.
  // When the browser leaves fullscreen (ESC / vendor gesture), end our session.
  useEffect(() => {
    if (!isFullScreen) return;
    const handleChange = () => {
      if (!getFullscreenElement()) {
        exitFullScreen();
      }
    };
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    document.addEventListener('mozfullscreenchange', handleChange);
    document.addEventListener('MSFullscreenChange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
      document.removeEventListener('mozfullscreenchange', handleChange);
      document.removeEventListener('MSFullscreenChange', handleChange);
    };
  }, [isFullScreen, exitFullScreen]);

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
  }, [isFullScreen, exitFullScreen]);

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

  // Dispatch a validated lightgame protocol payload to progress tracking
  const handleReportPayload = useCallback((payload: ReturnType<typeof parseReportMessage>) => {
    if (!payload || !gameId) return;
    switch (payload.kind) {
      case 'score':
        recordScore(gameId, payload.score);
        break;
      case 'gameOver':
        if (typeof payload.score === 'number') {
          recordScore(gameId, payload.score);
        }
        if (payload.progress) {
          recordProgress(gameId, payload.progress);
        }
        break;
      case 'complete':
        if (typeof payload.score === 'number') {
          recordScore(gameId, payload.score);
        }
        recordEvent(gameId, 'complete');
        break;
      case 'progress':
        recordProgress(gameId, payload.data);
        break;
      case 'event':
        recordEvent(gameId, payload.event, payload.data);
        break;
    }
  }, [gameId, recordScore, recordProgress, recordEvent]);

  // Listen for messages from the game iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // New lightgame protocol: only trust messages from the current game iframe
      if (iframeRef.current && event.source === iframeRef.current.contentWindow) {
        if (isLightGameReportMessage(event.data)) {
          const payload = parseReportMessage(event.data);
          handleReportPayload(payload);
          return;
        }
      }

      // Backward-compatible legacy message types
      if (event.data?.type === 'SHARE_GAME') {
        const { score } = event.data.data;
        handleShare(score);
      } else if (event.data.type === 'NAVIGATE_TO_HOME' || event.data.action === 'navigateHome') {
        // Navigate to home page
        window.location.href = '/';
      }
    };

    window.addEventListener('message', handleMessage);

    // Also expose the share function directly for backward compatibility
    (window as unknown as { handleGlobalShare?: (score?: number) => Promise<void> }).handleGlobalShare = handleShare;

    return () => {
      window.removeEventListener('message', handleMessage);
      delete (window as unknown as { handleGlobalShare?: (score?: number) => Promise<void> }).handleGlobalShare;
    };
  }, [handleShare, handleReportPayload]);

  // 确保退出按钮始终在最上层并可点击
  useEffect(() => {
    const button = exitButtonRef.current;
    if (isFullScreen && button) {
      // 确保按钮在iframe之上
      button.style.pointerEvents = 'auto';

      // 添加点击事件监听器
      const handleExitClick = () => exitFullScreen();
      button.addEventListener('click', handleExitClick);

      return () => {
        button.removeEventListener('click', handleExitClick);
      };
    }
  }, [isFullScreen, exitFullScreen]);

  // 添加iframe加载事件处理
  const handleIframeLoad = () => {
    const loadTime = Date.now() - startTimeRef.current
    recordGameLoad(loadTime)

    // 尝试访问iframe内容以检查是否成功加载
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        // 设置iframe为已加载状态
        setIframeLoaded(true);

        // Send ready handshake to the game (non-sensitive; targetOrigin '*' for cross-origin iframe games)
        if (gameId) {
          iframe.contentWindow.postMessage(buildReadyMessage(gameId), '*');
        }
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
      <SEO
        title={`${game.title} - Play Free Online | LightGame`}
        description={`${game.description} Play this ${Array.isArray(game.category) ? game.category.join(', ') : game.category} game online for free. No downloads, no registration required.`}
        image={game.image}
        url={`https://games.misitebo.win/game/${game.id}`}
        type="game"
        game={{
          name: game.title,
          category: Array.isArray(game.category) ? game.category.join(', ') : game.category,
          description: game.description,
          thumbnail: game.image
        }}
      />
      {showToast && (
        <ToastNotification
          message="Link copied to clipboard!"
          onClose={() => setShowToast(false)}
        />
      )}
      {/* Normal view */}
      <div className={`animate-fade-in ${isFullScreen ? 'hidden' : ''}`}>
        {/* Breadcrumb */}
        <Breadcrumb />

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

              {/* Progress card */}
              <GameProgressCard gameId={game.id} />

              {/* Play button */}
              <button
                onClick={enterFullScreen}
                className="btn btn-primary w-full flex items-center justify-center group mt-6"
              >
                <i className="fas fa-play mr-2 group-hover:animate-pulse"></i>
                Play Game
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Related Games Section */}
      {relatedGames.length > 0 && (
        <div className="mt-12 max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            <i className="fas fa-gamepad text-primary-500 mr-2"></i>
            You May Also Like
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedGames.map((relatedGame) => (
              <Link
                key={relatedGame.id}
                to={`/game/${relatedGame.id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow group"
              >
                <div className="relative h-32 overflow-hidden">
                  <img
                    src={relatedGame.image}
                    alt={relatedGame.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <span className="absolute bottom-2 left-2 text-white text-sm font-medium">
                    {Array.isArray(relatedGame.category) ? relatedGame.category[0] : relatedGame.category}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
                    {relatedGame.title}
                  </h3>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {relatedGame.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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

            {/* Achievement toast rendered inside fullscreen so it isn't covered by the browser fullscreen layer */}
            <div className="absolute bottom-4 right-4 z-[10000] pointer-events-none">
              <FullscreenAchievementToast />
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default GameDetailPage

// Achievement toast rendered inside the fullscreen container so it remains visible
// above the browser fullscreen layer (which would otherwise cover z-indexed elements).
const FullscreenAchievementToast: React.FC = () => {
  const { queue, dismissUnlock } = useAchievements();
  const current = queue[0];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!current) return;
    timerRef.current = setTimeout(() => dismissUnlock(current.id), 4000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, dismissUnlock]);

  if (!current) return null;
  const def = getAchievementById(current.id);
  if (!def) return null;

  return (
    <div className="animate-slide-in bg-dark-card/95 backdrop-blur-md border-2 border-neon-yellow/50 rounded-xl px-5 py-4 shadow-2xl shadow-neon-yellow/20 flex items-center gap-4 min-w-[280px] max-w-[90vw]">
      <AchievementIcon icon={def.icon} unlocked size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-neon-yellow text-xs font-semibold uppercase tracking-wider">Achievement Unlocked!</p>
        <p className="text-white font-bold text-base truncate">{def.title}</p>
        <p className="text-gray-300 text-sm truncate">{def.description}</p>
      </div>
      <button
        onClick={() => dismissUnlock(current.id)}
        className="text-gray-300 hover:text-white transition-colors pointer-events-auto p-1"
        aria-label="Dismiss"
      >
        <i className="fas fa-times text-lg"></i>
      </button>
    </div>
  );
};
