import { Game } from '../types';

// Raw game shape as produced by build-games-list.js (games.json)
interface RawGameMeta {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  controls?: unknown;
  tags?: unknown;
  path?: unknown;
  image?: unknown;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter(isString) : [];
}

// Cache the games data to avoid repeated fetches
let gamesCache: Game[] | null = null;

// Get base URL for assets
const getBaseUrl = (): string => {
  // 本地开发环境
  if (import.meta.env.DEV) {
    return '';
  }

  // 检查是否在Vercel环境中
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    // 使用完整的基础URL，确保游戏资源能正确加载
    return window.location.origin;
  }

  // 其他生产环境 - 使用相对路径
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

    const response = await fetch(`${baseUrl}/games.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}`);
    }

    const jsonData = await response.json();

    // Extract games array from the JSON structure
    const data: Game[] = jsonData.games || jsonData;

    // 处理游戏路径，确保它们包含正确的基础URL
    const processedGames = data.map((raw: RawGameMeta): Game => {
      const id = isString(raw.id) ? raw.id : '';
      return {
        id,
        title: isString(raw.title) ? raw.title : id,
        description: isString(raw.description) ? raw.description : '',
        category: (isString(raw.category) || Array.isArray(raw.category)) ? (raw.category as string | string[]) : 'Uncategorized',
        controls: isString(raw.controls) ? raw.controls : 'No control information available',
        tags: toStringArray(raw.tags),
        path: isString(raw.path) ? `${baseUrl}${raw.path}` : `${baseUrl}/games/${id}/index.html`,
        image: isString(raw.image) ? `${baseUrl}${raw.image}` : `${baseUrl}/images/thumbnails/${id}.svg`,
      };
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