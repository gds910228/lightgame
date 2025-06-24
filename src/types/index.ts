export interface Game {
  id: string;
  title: string;
  category: string;
  image: string;
  description: string;
  controls: string;
  path: string;
}

export interface GamesData {
  games: Game[];
} 