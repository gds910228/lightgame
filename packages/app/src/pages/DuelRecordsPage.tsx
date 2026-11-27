import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { useAllGames } from '../hooks/useGames'
import { loadDuelRecords, summarizeDuelRecords, DuelRecordView } from '../services/duelRecords'

const GAME_ICONS: Record<string, string> = {
  'duel-tank-arena': 'fa-crosshairs',
  'five-in-row-master': 'fa-circle-dot',
  'pong-duel-plus': 'fa-table-tennis-paddle-ball',
  'western-showdown-trio': 'fa-bolt',
  'card-duel-arena': 'fa-layer-group',
}

const formatPercent = (part: number, total: number): string =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : '—'

const RecordCard = ({ record, image }: { record: DuelRecordView; image?: string }) => {
  const aRate = record.matches > 0 ? Math.round((record.sideAWins / record.matches) * 100) : 0
  const aLeads = record.sideAWins > record.sideBWins
  const bLeads = record.sideBWins > record.sideAWins

  return (
    <article className="overflow-hidden rounded-xl border border-dark-border bg-dark-card transition-colors hover:border-white/20">
      <div className="relative h-24 sm:h-28 overflow-hidden bg-dark-bg">
        {image ? (
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35" loading="lazy" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-card via-dark-card/55 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-bold leading-tight line-clamp-1">{record.title}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{record.matches > 0 ? `${record.matches} matches recorded` : 'No matches yet'}</p>
          </div>
          <span
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border"
            style={{ borderColor: `${record.accent}66`, color: record.accent, backgroundColor: `${record.accent}14` }}
          >
            <i className={`fas ${GAME_ICONS[record.gameId] || 'fa-gamepad'} text-sm`} aria-hidden="true"></i>
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className={`text-center rounded-lg py-2 border ${aLeads ? 'border-neon-green/40 bg-neon-green/10' : 'border-transparent bg-dark-bg/60'}`}>
            <p className="text-[11px] text-gray-400 mb-1">{record.sideAName}</p>
            <p className={`text-3xl font-bold ${aLeads ? 'text-neon-green' : 'text-white'}`}>{record.sideAWins}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{formatPercent(record.sideAWins, record.matches)}</p>
          </div>
          <div className="text-center px-1">
            <p className="text-[10px] tracking-[0.3em] text-gray-600 font-bold">VS</p>
          </div>
          <div className={`text-center rounded-lg py-2 border ${bLeads ? 'border-neon-pink/40 bg-neon-pink/10' : 'border-transparent bg-dark-bg/60'}`}>
            <p className="text-[11px] text-gray-400 mb-1">{record.sideBName}</p>
            <p className={`text-3xl font-bold ${bLeads ? 'text-neon-pink' : 'text-white'}`}>{record.sideBWins}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{formatPercent(record.sideBWins, record.matches)}</p>
          </div>
        </div>

        <div className="mt-3 h-2 rounded-full bg-dark-bg overflow-hidden flex" aria-hidden="true">
          <span className="h-full bg-gradient-to-r from-neon-blue to-neon-green" style={{ width: `${aRate}%` }}></span>
          <span className="h-full bg-gradient-to-r from-neon-pink to-neon-purple flex-1"></span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-gray-500">
            {record.metricLabel || 'Record'}:
            <b className="text-gray-300 font-semibold"> {record.metricValue}</b>
          </span>
          <Link to={`/game/${record.gameId}`} className="inline-flex items-center gap-1.5 text-neon-blue hover:text-white transition-colors whitespace-nowrap">
            Play Match
            <i className="fas fa-arrow-right text-[10px]" aria-hidden="true"></i>
          </Link>
        </div>
      </div>
    </article>
  )
}

const DuelRecordsPage = () => {
  const { games } = useAllGames()
  const [records, setRecords] = useState<DuelRecordView[]>(() => loadDuelRecords())

  const refresh = useCallback(() => {
    setRecords(loadDuelRecords())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  const imageById = useMemo(() => {
    const map = new Map<string, string>()
    games.forEach(game => {
      const categories = Array.isArray(game.category) ? game.category : [game.category]
      if (categories.some(category => category.toLowerCase() === 'duel')) map.set(game.id, game.image)
    })
    return map
  }, [games])

  const summary = useMemo(() => summarizeDuelRecords(records), [records])

  return (
    <div className="animate-fade-in">
      <SEO
        title="Duel Records - Local Battle Stats | LightGame"
        description="Your local Duel Arena record book: wins, losses and best performances across tank, gomoku, pong, western showdown and card duels. Stored only in your browser."
        url="https://games.misitebo.win/duels/records"
      />

      <section className="relative overflow-hidden rounded-2xl border border-neon-green/25 bg-gradient-to-br from-dark-card via-dark-bg to-dark-card px-5 py-9 sm:px-9 sm:py-12 mb-8">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-20" aria-hidden="true"></div>
        <div className="absolute -top-20 right-8 h-48 w-48 rounded-full bg-neon-green/10 blur-3xl" aria-hidden="true"></div>
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-neon-green/40 bg-neon-green/10 text-neon-green text-xs font-semibold tracking-wider">
                <i className="fas fa-chart-simple" aria-hidden="true"></i>
                LOCAL RECORDS
              </span>
              <span className="h-px w-16 bg-gradient-to-r from-neon-green/60 to-transparent"></span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">
              Records Center
            </h1>
            <p className="text-gray-400 max-w-2xl text-sm sm:text-base leading-relaxed">
              Your win-loss book across all five duel games, stored locally. Data lives only in this
              browser — switching devices or clearing site data starts a fresh record.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={refresh}
              className="px-4 py-2 rounded-lg border border-neon-green/30 bg-dark-bg/70 text-neon-green text-sm hover:border-neon-green/60 transition-colors"
            >
              <i className="fas fa-rotate mr-2" aria-hidden="true"></i>
              Refresh
            </button>
            <Link to="/duels" className="px-4 py-2 rounded-lg border border-dark-border bg-dark-card text-gray-300 text-sm hover:border-white/30 hover:text-white transition-colors">
              <i className="fas fa-arrow-left mr-2" aria-hidden="true"></i>
              Duel Arena
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <p className="text-2xl sm:text-3xl font-bold text-white">{summary.matches}</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">Matches Played</p>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <p className="text-2xl sm:text-3xl font-bold text-neon-green">{summary.sideAWins}</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">Side A Wins</p>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <p className="text-2xl sm:text-3xl font-bold text-neon-pink">{summary.sideBWins}</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">Side B Wins</p>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <p className="text-2xl sm:text-3xl font-bold text-neon-blue">{summary.activeGames}<span className="text-base text-gray-500 font-medium"> / 5</span></p>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">Games With Records</p>
        </div>
      </div>

      {summary.matches === 0 && (
        <div className="mb-6 rounded-xl border border-neon-blue/20 bg-neon-blue/5 px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-white font-semibold mb-1">Your record book is empty</p>
            <p className="text-sm text-gray-400">Head to the arena and start a match — results land here automatically once a game ends.</p>
          </div>
          <Link to="/duels" className="btn btn-primary inline-flex items-center whitespace-nowrap">
            <i className="fas fa-play mr-2" aria-hidden="true"></i>
            Start Playing
          </Link>
        </div>
      )}

      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-book-open text-neon-green" aria-hidden="true"></i>
            Per-Game Records
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Side A / Side B follow each game's characters or turn order; matches = wins on both sides combined.</p>
        </div>
        <span className="hidden sm:inline text-xs text-gray-600">localStorage · on-device</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-10">
        {records.map(record => (
          <RecordCard key={record.gameId} record={record} image={imageById.get(record.gameId)} />
        ))}
      </div>

      <div className="text-center">
        <Link to="/duels" className="btn btn-secondary inline-flex items-center text-neon-green border-neon-green/60">
          <i className="fas fa-bolt mr-2" aria-hidden="true"></i>
          Back to Duel Arena
        </Link>
      </div>
    </div>
  )
}

export default DuelRecordsPage
