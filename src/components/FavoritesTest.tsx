import { useFavorites } from '../contexts/FavoritesContext';

const FavoritesTest = () => {
  const { favorites, toggleFavorite, getFavoritesCount } = useFavorites();

  const handleTestClick = () => {
    console.log('Test button clicked');
    toggleFavorite('test-game');
  };

  return (
    <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg z-50">
      <h3 className="font-bold mb-2">Favorites Test</h3>
      <p>Count: {getFavoritesCount()}</p>
      <p>Favorites: {JSON.stringify(favorites)}</p>
      <button 
        onClick={handleTestClick}
        className="bg-white text-blue-500 px-2 py-1 rounded mt-2"
      >
        Test Toggle
      </button>
    </div>
  );
};

export default FavoritesTest;