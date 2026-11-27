import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadDuelRecords, summarizeDuelRecords } from '../duelRecords'

const store = new Map<string, string>()

const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
}

describe('duelRecords', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('window', { localStorage: localStorageMock })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns all five duel games with zeroed records when storage is empty', () => {
    const records = loadDuelRecords()
    expect(records).toHaveLength(5)
    expect(records.every(record => record.matches === 0 && record.sideAWins === 0 && record.sideBWins === 0)).toBe(true)
    expect(summarizeDuelRecords(records)).toEqual({ matches: 0, sideAWins: 0, sideBWins: 0, activeGames: 0 })
  })

  it('aggregates records from each game and formats best metrics', () => {
    store.set('dta.rec', JSON.stringify({ p1: 4, p2: 2, matches: 6 }))
    store.set('dta.best', '82.4')
    store.set('frm.wins.black', '7')
    store.set('frm.wins.white', '3')
    store.set('frm.forbidden', '1')
    store.set('pdp.winsP1', '5')
    store.set('pdp.winsP2', '6')
    store.set('pdp.bestRally', '21')
    store.set('wst.matchWins', '3')
    store.set('wst.matchLosses', '2')
    store.set('wst.bestScore', '300')
    store.set('cda.wins', '9')
    store.set('cda.losses', '4')
    store.set('cda.best', '1880')

    const records = loadDuelRecords()
    const byId = Object.fromEntries(records.map(record => [record.gameId, record]))

    expect(byId['duel-tank-arena']).toMatchObject({ sideAName: 'P1', sideAWins: 4, sideBWins: 2, matches: 6, metricValue: '82.4s' })
    expect(byId['five-in-row-master']).toMatchObject({ sideAName: 'Black', sideAWins: 7, sideBWins: 3, matches: 10, metricValue: 'On' })
    expect(byId['pong-duel-plus']).toMatchObject({ sideAWins: 5, sideBWins: 6, matches: 11, metricValue: '21 hits' })
    expect(byId['western-showdown-trio']).toMatchObject({ sideAName: 'P1 / You', sideAWins: 3, sideBWins: 2, matches: 5, metricValue: '300 pts' })
    expect(byId['card-duel-arena']).toMatchObject({ sideAName: 'You', sideBWins: 4, matches: 13, metricValue: '1880' })

    expect(summarizeDuelRecords(records)).toEqual({ matches: 45, sideAWins: 28, sideBWins: 17, activeGames: 5 })
  })

  it('survives corrupt records and clamps negative values', () => {
    store.set('dta.rec', '{not-json')
    store.set('dta.best', 'nope')
    store.set('frm.wins.black', '-5')
    store.set('pdp.winsP1', '3')
    store.set('wst.matchWins', 'abc')
    store.set('cda.losses', '2.9')

    const records = loadDuelRecords()
    const byId = Object.fromEntries(records.map(record => [record.gameId, record]))

    expect(byId['duel-tank-arena'].matches).toBe(0)
    expect(byId['duel-tank-arena'].metricValue).toBe('—')
    expect(byId['five-in-row-master'].sideAWins).toBe(0)
    expect(byId['pong-duel-plus'].matches).toBe(3)
    expect(byId['western-showdown-trio'].matches).toBe(0)
    expect(byId['card-duel-arena'].sideBWins).toBe(2)
  })

  it('does not throw when localStorage is unavailable', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('blocked')
      },
    })
    expect(() => loadDuelRecords()).not.toThrow()
    expect(loadDuelRecords()).toHaveLength(5)
  })
})
