export interface DuelRecordView {
  gameId: string
  title: string
  sideAName: string
  sideBName: string
  sideAWins: number
  sideBWins: number
  matches: number
  metricLabel: string | null
  metricValue: string
  accent: string
}

interface DuelGameRecordConfig {
  id: string
  title: string
  sideAName: string
  sideBName: string
  accent: string
  read: () => { a: number; b: number; metricLabel: string | null; metricValue: string }
}

const safeInt = (value: string | null): number => {
  const parsed = parseInt(value || '0', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const safeGet = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const readNumber = (key: string): number => safeInt(safeGet(key))

const readDuelTank = () => {
  let p1 = 0
  let p2 = 0
  try {
    const raw = JSON.parse(safeGet('dta.rec') || '{}') as { p1?: unknown; p2?: unknown }
    if (typeof raw.p1 === 'number' && Number.isFinite(raw.p1)) p1 = Math.max(0, Math.floor(raw.p1))
    if (typeof raw.p2 === 'number' && Number.isFinite(raw.p2)) p2 = Math.max(0, Math.floor(raw.p2))
  } catch {
    // A corrupt record should not take down the records page.
  }
  const best = parseFloat(safeGet('dta.best') || '0')
  return {
    a: p1,
    b: p2,
    metricLabel: 'Fastest Title Win',
    metricValue: Number.isFinite(best) && best > 0 ? `${best.toFixed(1)}s` : '—',
  }
}

const readFiveInRow = () => ({
  a: readNumber('frm.wins.black'),
  b: readNumber('frm.wins.white'),
  metricLabel: 'Forbidden Rules',
  metricValue: safeGet('frm.forbidden') === '1' ? 'On' : 'Off',
})

const readPong = () => {
  const rally = readNumber('pdp.bestRally')
  return {
    a: readNumber('pdp.winsP1'),
    b: readNumber('pdp.winsP2'),
    metricLabel: 'Longest Rally',
    metricValue: rally > 0 ? `${rally} hits` : '—',
  }
}

const readWestern = () => {
  const best = readNumber('wst.bestScore')
  return {
    a: readNumber('wst.matchWins'),
    b: readNumber('wst.matchLosses'),
    metricLabel: 'Best Round Score',
    metricValue: best > 0 ? `${best} pts` : '—',
  }
}

const readCard = () => {
  const best = readNumber('cda.best')
  return {
    a: readNumber('cda.wins'),
    b: readNumber('cda.losses'),
    metricLabel: 'Best Score',
    metricValue: best > 0 ? `${best}` : '—',
  }
}

const CONFIG: DuelGameRecordConfig[] = [
  { id: 'duel-tank-arena', title: 'Duel Tank Arena', sideAName: 'P1', sideBName: 'P2', accent: '#39ff14', read: readDuelTank },
  { id: 'five-in-row-master', title: 'Five in Row Master', sideAName: 'Black', sideBName: 'White', accent: '#ffd98e', read: readFiveInRow },
  { id: 'pong-duel-plus', title: 'Pong Duel Plus', sideAName: 'P1', sideBName: 'P2', accent: '#8fd8ff', read: readPong },
  { id: 'western-showdown-trio', title: 'Western Showdown Trio', sideAName: 'P1 / You', sideBName: 'P2 / Opponent', accent: '#ffb98e', read: readWestern },
  { id: 'card-duel-arena', title: 'Card Duel Arena', sideAName: 'You', sideBName: 'AI', accent: '#9be7c4', read: readCard },
]

export function loadDuelRecords(): DuelRecordView[] {
  if (typeof window === 'undefined') return []
  return CONFIG.map(config => {
    const record = config.read()
    return {
      gameId: config.id,
      title: config.title,
      sideAName: config.sideAName,
      sideBName: config.sideBName,
      sideAWins: record.a,
      sideBWins: record.b,
      matches: record.a + record.b,
      metricLabel: record.metricLabel,
      metricValue: record.metricValue,
      accent: config.accent,
    }
  })
}

export function summarizeDuelRecords(records: DuelRecordView[]) {
  return records.reduce(
    (sum, record) => ({
      matches: sum.matches + record.matches,
      sideAWins: sum.sideAWins + record.sideAWins,
      sideBWins: sum.sideBWins + record.sideBWins,
      activeGames: sum.activeGames + (record.matches > 0 ? 1 : 0),
    }),
    { matches: 0, sideAWins: 0, sideBWins: 0, activeGames: 0 },
  )
}
