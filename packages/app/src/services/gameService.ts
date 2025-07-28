import { Game, GamesData } from '../types';

// Cache the games data to avoid repeated fetches
let gamesCache: Game[] | null = null;

// Get base URL for assets
const getBaseUrl = (): string => {
  // 本地开发环境
  if (import.meta.env.DEV) {
    console.log('Running in DEV mode, using empty base URL');
    return '';
  }
  
  // 检查是否在Vercel环境中
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    // 使用完整的基础URL，确保游戏资源能正确加载
    console.log('Running in Vercel environment, using full origin as base URL:', window.location.origin);
    return window.location.origin;
  }
  
  // 其他生产环境 - 使用相对路径
  console.log('Running in production environment, using empty base URL');
  return '';
};

/**
 * Fetch all games from the games.json file
 */
export async function getAllGames(): Promise<Game[]> {
  // Return cached data if available
  if (gamesCache) {
    return gamesCache;
  }
  
  try {
    const baseUrl = getBaseUrl();
    console.log(`Fetching games.json from: ${baseUrl}/games.json`);
    
    const response = await fetch(`${baseUrl}/games.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}`);
    }
    
    const data: Game[] = await response.json();
    console.log('Fetched games data:', data);
    
    // 处理游戏路径，确保它们包含正确的基础URL
    const processedGames = data.map((game: any) => {
      // Convert the JSON format to our expected Game format
      const processedGame: Game = {
        id: game.id,
        title: game.title,
        description: game.description,
        category: game.category,
        controls: game.controls || 'No control information available',
        tags: game.tags || [],
        path: `${baseUrl}${game.url}`, // Convert 'url' to 'path'
        image: game.thumbnail ? `${baseUrl}${game.thumbnail}` : `${baseUrl}/images/thumbnails/${game.id}.svg` // Convert 'thumbnail' to 'image'
      };
      
      console.log(`Processed game ${game.id}:`, {
        originalUrl: game.url,
        processedPath: processedGame.path,
        originalThumbnail: game.thumbnail,
        processedImage: processedGame.image
      });
      
      return processedGame;
    });
    
    gamesCache = processedGames;
    return processedGames;
  } catch (error) {
    console.error('Error fetching games:', error);
    throw error;
  }
}

/**
 * Get a specific game by ID
 */
export async function getGameById(gameId: string): Promise<Game | null> {
  try {
    const games = await getAllGames();
    return games.find(game => game.id === gameId) || null;
  } catch (error) {
    console.error(`Error fetching game with ID ${gameId}:`, error);
    throw error;
  }
}

/**
 * Get games by category
 */
export async function getGamesByCategory(category: string): Promise<Game[]> {
  const games = await getAllGames();
  
  if (category === 'All') {
    return games;
  }
  
  return games.filter(game => {
    if (Array.isArray(game.category)) {
      // 如果游戏有多个分类，检查是否包含所选分类
      return game.category.includes(category);
    }
    // 向后兼容单个分类的情况
    return game.category === category;
  });
}

/**
 * Search games by query (searches in title and description)
 */
export async function searchGames(query: string): Promise<Game[]> {
  if (!query.trim()) {
    return getAllGames();
  }
  
  const games = await getAllGames();
  const lowerQuery = query.toLowerCase();
  
  return games.filter(game => 
    game.title.toLowerCase().includes(lowerQuery) || 
    game.description.toLowerCase().includes(lowerQuery)
  );
} 