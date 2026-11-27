import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import GameCard from '../components/GameCard'
import { useAllGames } from '../hooks/useGames'
import { Game } from '../types'

const isDuelGame = (game: Game): boolean =>
  Array.isArray(game.category)
    ? game.category.some(category => category.toLowerCase() === 'duel')
    : game.category.toLowerCase() === 'duel'

const DuelsPage = () => {
  const { games, loading, error } = useAllGames()
  const duelGames = useMemo(() => {
    const filtered = games.filter(isDuelGame)
    return [...filtered].sort((a, b) => {
      if (a.id === 'duel-tank-arena') return -1
      if (b.id === 'duel-tank-arena') return 1
      return a.title.localeCompare(b.title)
    })
  }, [games])

  return (
    <div className="animate-fade-in">
      <SEO
        title="Duel Arena - Local & AI Battles | LightGame"
        description="Five handcrafted 1v1 duel games: tank arena, five-in-row, pong, western reaction trio and card battle. Play local two-player or challenge three AI tiers."
        url="https://games.misitebo.win/duels"
      />

      <section className="relative overflow-hidden rounded-2xl border border-neon-green/25 bg-gradient-to-br from-dark-card via-dark-bg to-dark-card px-5 py-10 sm:px-10 sm:py-14 md:py-16 mb-10">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-25" aria-hidden="true"></div>
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-neon-green/10 blur-3xl" aria-hidden="true"></div>
        <div className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-neon-blue/10 blur-3xl" aria-hidden="true"></div>

        <div className="relative max-w-4xl">
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-neon-green/40 bg-neon-green/10 text-neon-green text-xs font-semibold tracking-wider">
              <i className="fas fa-bolt" aria-hidden="true"></i>
              DUEL ARENA
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-neon-green/60 to-transparent"></span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            <span className="text-neon-green neon-text">DUEL ARENA</span>
            <br />
            <span>One Screen. One Winner.</span>
          </h1>
          <p className="text-base md:text-lg text-gray-300 max-w-2xl mb-7 leading-relaxed">
            Tanks, board classics, pong tables, western saloons and card tables — five versus games built
            for face-to-face play. Battle a friend on one screen or challenge three AI tiers.
            No downloads, instant play.
          </p>

          <div className="flex flex-wrap gap-3">
            <a href="#duel-games" className="btn btn-primary inline-flex items-center" style={{ background: 'linear-gradient(135deg, #39ff14 0%, #00f3ff 100%)', color: '#07121a' }}>
              <i className="fas fa-play mr-2" aria-hidden="true"></i>
              PICK YOUR BATTLE
            </a>
            <Link to="/duels/records" className="btn btn-secondary inline-flex items-center border-neon-green/60 text-neon-green">
              <i className="fas fa-chart-simple mr-2" aria-hidden="true"></i>
              Records Center
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-9 max-w-xl">
            <div className="rounded-xl border border-dark-border bg-dark-bg/70 px-3 py-3">
              <p className="text-2xl font-bold text-neon-green">{duelGames.length || 5}</p>
              <p className="text-xs text-gray-400 mt-1">Duel Games</p>
            </div>
            <div className="rounded-xl border border-dark-border bg-dark-bg/70 px-3 py-3">
              <p className="text-2xl font-bold text-neon-blue">2</p>
              <p className="text-xs text-gray-400 mt-1">Play Modes</p>
            </div>
            <div className="rounded-xl border border-dark-border bg-dark-bg/70 px-3 py-3">
              <p className="text-2xl font-bold text-neon-pink">3</p>
              <p className="text-xs text-gray-400 mt-1">AI Tiers</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h2 id="duel-games" className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3 scroll-mt-24">
            <i className="fas fa-bolt text-neon-green" aria-hidden="true"></i>
            THE LINEUP
          </h2>
          <p className="text-gray-400 text-sm">Every title supports local two-player on one screen plus three AI tiers — key bindings, touch zones and how-to-play overlays are ready in-game.</p>
        </div>
        <Link to="/duels/records" className="hidden sm:inline-flex items-center gap-2 text-sm text-neon-green hover:text-white transition-colors whitespace-nowrap">
          View Records
          <i className="fas fa-arrow-right text-xs" aria-hidden="true"></i>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-56">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-green"></div>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
          <p>The duel arena failed to load. Please try again later.</p>
        </div>
      ) : duelGames.length === 0 ? (
        <div className="bg-yellow-900/20 border border-yellow-500/30 text-yellow-400 px-4 py-3 rounded-lg">
          <p>No duel games found yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {duelGames.map((game, index) => (
            <div
              key={game.id}
              className="opacity-0 animate-fade-in"
              style={{ animationDelay: `${index * 90}ms`, animationFillMode: 'forwards' }}
            >
              <div className="relative">
                {game.id === 'duel-tank-arena' && (
                  <span className="absolute z-30 -top-2 left-3 px-2 py-1 rounded-md bg-neon-green text-dark-bg text-[10px] font-extrabold tracking-widest shadow-lg">
                    FLAGSHIP
                  </span>
                )}
                <GameCard game={game} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-10 sm:hidden">
        <Link to="/duels/records" className="btn btn-secondary inline-flex items-center text-neon-green border-neon-green/60">
          <i className="fas fa-chart-simple mr-2" aria-hidden="true"></i>
          Open Records Center
        </Link>
      </div>

      <section className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neon-blue/20 bg-dark-card p-5">
          <h3 className="text-white font-bold mb-2 flex items-center gap-2">
            <i className="fas fa-users text-neon-blue" aria-hidden="true"></i>
            Local Two-Player
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">One device, zero key conflicts — landscape mobile automatically splits the screen into left and right touch zones. Perfect for fast-paced face-to-face rematches.</p>
        </div>
        <div className="rounded-xl border border-neon-pink/20 bg-dark-card p-5">
          <h3 className="text-white font-bold mb-2 flex items-center gap-2">
            <i className="fas fa-robot text-neon-pink" aria-hidden="true"></i>
            Vs. AI
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">Every game ships with clearly labeled Rookie / Veteran / Ace AI tiers — reactions, predictions and tactics sharpen with each step, so you can train solo anytime.</p>
        </div>
      </section>
    </div>
  )
}

export default DuelsPage
