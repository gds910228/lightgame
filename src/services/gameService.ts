import { Game, GamesData } from '../types';

// Cache the games data to avoid repeated fetches
let gamesCache: Game[] | null = null;

// Get base URL for assets
const getBaseUrl = (): string => {
  // 本地开发环境
  if (import.meta.env.DEV) {
    return '';
  }
  
  // 生产环境 - 使用相对路径
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
    
    const data: GamesData = await response.json();
    
    // 处理游戏路径，确保它们包含正确的基础URL
    const processedGames = data.games.map((game: Game) => ({
      ...game,
      path: `${baseUrl}${game.path}`,
      image: `${baseUrl}${game.image}`
    }));
    
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
  return category === 'All' 
    ? games 
    : games.filter(game => game.category === category);
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