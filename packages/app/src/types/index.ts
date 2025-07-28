export interface Game {
  id: string;
  title: string;
  category: string | string[];  // 支持单个分类或多个分类数组
  image: string;
  description: string;
  controls: string;
  path: string;
  tags: string[];
}

export interface GamesData {
  games: Game[];
} 