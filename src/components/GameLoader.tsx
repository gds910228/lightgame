import React, { useState, useEffect, useRef } from 'react';
import { Game } from '../types';
import performanceService from '../services/performanceService';

interface GameLoaderProps {
  game: Game;
  onClose: () => void;
}

interface GameLoadingState {
  status: 'loading' | 'loaded' | 'error';
  progress: number;
  error?: string;
}

const GameLoader: React.FC<GameLoaderProps> = ({ game, onClose }) => {
  const [loadingState, setLoadingState] = useState<GameLoadingState>({
    status: 'loading',
    progress: 0
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Only load the game once when the component mounts or when the game changes
    loadGame();
    
    // Add message event listener for communication with iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GAME_ERROR') {
        console.error('Game error:', event.data.message);
        setLoadingState({
          status: 'error',
          progress: 0,
          error: `Game error: ${event.data.message}`
        });
      } else if (event.data && event.data.type === 'SNAKE_GAME_LOADED') {
        console.log('Snake game loaded message received:', event.data.message);
        // The game is loaded, ensure it's in loaded state
        setLoadingState({ status: 'loaded', progress: 100 });
      } else if (event.data && event.data.type === 'SNAKE_GAME_DEBUG') {
        console.log('Snake game debug:', event.data.message);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Add keyboard event listener to forward key presses to the iframe
    const handleKeyDown = (e: KeyboardEvent) => {
      if (iframeRef.current && loadingState.status === 'loaded' && game.id === 'snake') {
        // Forward key events to the iframe
        try {
          const direction = e.key.toLowerCase().replace('arrow', '');
          if (['up', 'down', 'left', 'right'].includes(direction)) {
            iframeRef.current.contentWindow?.postMessage({
              type: 'SNAKE_GAME_CONTROL',
              direction: direction
            }, '*');
            console.log('Forwarded key event to iframe:', direction);
          }
        } catch (error) {
          console.error('Error forwarding key event to iframe:', error);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [game.id]); // Only re-run when game.id changes

  const loadGame = async () => {
    try {
      // Start performance tracking
      performanceService.startGameLoad(game.id);
      
      setLoadingState({ status: 'loading', progress: 10 });
      
      // Simulate progressive loading
      const progressInterval = setInterval(() => {
        setLoadingState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 200);

      // Special handling for Snake game
      if (game.id === 'snake') {
        console.log('Loading Snake game with special handling');
        // Force the path to be absolute
        game.path = window.location.origin + '/games/snake/index.html';
        console.log('Updated Snake game path:', game.path);
      }

      // Set to loaded state to trigger iframe rendering
      setTimeout(() => {
        clearInterval(progressInterval);
        setLoadingState({ status: 'loaded', progress: 100 });
        
        // Complete performance tracking
        performanceService.completeGameLoad(game.id);
      }, 1000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Game loading error:', errorMessage);
      
      // Record error in performance tracking
      performanceService.recordGameError(game.id, errorMessage);
      
      setLoadingState({
        status: 'error',
        progress: 0,
        error: errorMessage
      });
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen && iframeRef.current) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen();
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    console.log('Iframe loaded successfully:', e);
    console.log('Iframe src:', iframeRef.current?.src);
    setLoadingState({ status: 'loaded', progress: 100 });
    
    // Focus the iframe to ensure keyboard events work
    setTimeout(() => {
      if (iframeRef.current) {
        iframeRef.current.focus();
        console.log('Iframe focused');
      }
    }, 500);
  };

  const handleIframeError = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    console.error('Iframe error:', e);
    setLoadingState({
      status: 'error',
      progress: 0,
      error: 'Failed to load game content'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-gray-900">{game.title}</h2>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              {game.category}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Toggle Fullscreen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close Game"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Game Content */}
        <div className="flex-1 relative">
          {loadingState.status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 mb-2">Loading {game.title}...</p>
                <div className="w-64 bg-gray-200 rounded-full h-2 mx-auto">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${loadingState.progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{loadingState.progress}%</p>
              </div>
            </div>
          )}

          {loadingState.status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-800 font-medium mb-2">Failed to load game</p>
                <p className="text-gray-600 text-sm mb-4">{loadingState.error}</p>
                <button
                  onClick={loadGame}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {loadingState.status === 'loaded' && (
            <iframe
              key={game.id} // Add a key to prevent re-rendering when state changes
              ref={iframeRef}
              src={game.id === 'snake' ? window.location.origin + '/games/snake/index.html' : game.path}
              className="w-full h-full border-0"
              title={game.title}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              allow="fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
              tabIndex={0}
            />
          )}
        </div>

        {/* Footer with game info */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Controls: {game.controls}</span>
            </div>
            <div className="flex items-center space-x-2">
              {game.author && <span>by {game.author}</span>}
              {game.version && <span>v{game.version}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLoader;