export interface Game {
  id: string;
  title: string;
  category: string | string[];  // 支持单个分类或多个分类数组
  image: string;
  description: string;
  controls: string;
  path: string;
  author?: string;
  version?: string;
  features?: string[];
  cover?: string;
}

export interface GamesData {
  games: Game[];
} 