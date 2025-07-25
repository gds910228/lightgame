import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FavoritesContextType {
  favorites: string[];
  addToFavorites: (gameId: string) => void;
  removeFromFavorites: (gameId: string) => void;
  isFavorite: (gameId: string) => boolean;
  toggleFavorite: (gameId: string) => void;
  getFavoritesCount: () => number;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const FAVORITES_STORAGE_KEY = 'lightgame_favorites';

interface FavoritesProviderProps {
  children: ReactNode;
}

export const FavoritesProvider: React.FC<FavoritesProviderProps> = ({ children }) => {
  const [favorites, setFavorites] = useState<string[]>([]);

  // 从localStorage加载收藏数据
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (savedFavorites) {
        const parsedFavorites = JSON.parse(savedFavorites);
        if (Array.isArray(parsedFavorites)) {
          setFavorites(parsedFavorites);
        }
      }
    } catch (error) {
      console.error('Error loading favorites from localStorage:', error);
    }
  }, []);

  // 保存收藏数据到localStorage
  const saveFavorites = (newFavorites: string[]) => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Error saving favorites to localStorage:', error);
    }
  };

  // 添加到收藏
  const addToFavorites = (gameId: string) => {
    if (!favorites.includes(gameId)) {
      const newFavorites = [...favorites, gameId];
      saveFavorites(newFavorites);
      
      // 显示成功提示
      showNotification(`游戏已添加到收藏夹！`, 'success');
    }
  };

  // 从收藏中移除
  const removeFromFavorites = (gameId: string) => {
    const newFavorites = favorites.filter(id => id !== gameId);
    saveFavorites(newFavorites);
    
    // 显示成功提示
    showNotification(`游戏已从收藏夹移除！`, 'info');
  };

  // 检查是否已收藏
  const isFavorite = (gameId: string) => {
    return favorites.includes(gameId);
  };

  // 切换收藏状态
  const toggleFavorite = (gameId: string) => {
    if (isFavorite(gameId)) {
      removeFromFavorites(gameId);
    } else {
      addToFavorites(gameId);
    }
  };

  // 获取收藏数量
  const getFavoritesCount = () => {
    return favorites.length;
  };

  // 简单的通知函数
  const showNotification = (message: string, type: 'success' | 'info' | 'error') => {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white font-medium transition-all duration-300 transform translate-x-full`;
    
    // 根据类型设置样式
    switch (type) {
      case 'success':
        notification.className += ' bg-green-500';
        break;
      case 'info':
        notification.className += ' bg-blue-500';
        break;
      case 'error':
        notification.className += ' bg-red-500';
        break;
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 100);
    
    // 3秒后自动消失
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  };

  const value: FavoritesContextType = {
    favorites,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    toggleFavorite,
    getFavoritesCount,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};