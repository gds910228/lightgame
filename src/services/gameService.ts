import { Game, GamesData } from '../types';

// Cache the games data to avoid repeated fetches
let gamesCache: Game[] | null = null;

// Get base URL for assets
const getBaseUrl = () => {
  // 在开发环境中使用相对路径，在生产环境中使用绝对路径
  return import.meta.env.DEV ? '' : import.meta.env.BASE_URL || '';
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
    const processedGames = data.games.map(game => ({
      ...game,
      path: `${baseUrl}${game.path}`,
      image: `${baseUrl}${game.image}`
    }));
    
    gamesCache = processedGames;
    return processedGames;
  } catch (error) {
    console.error('Error fetching games:', error);
    return [];
  }
}

/**
 * Get a specific game by ID
 */
export async function getGameById(id: string): Promise<Game | undefined> {
  const games = await getAllGames();
  return games.find(game => game.id === id);
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