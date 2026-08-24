import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { beatsFor, drawFor, requestsOf, shuffle, useGame } from '../src/engine/store.js'

const pool = scenario.pool
const days = scenario.days.map((d) => d.n)
// one full week, drawn the way the game draws it
const week = (pick = Math.random) => {
  const drawn = {}
  for (const n of days) drawn[n] = drawFor(scenario, n, drawn, pick)
  return drawn
}

describe('the pool', () => {
  it('holds about twice what a single week needs', () => {
    const needed = days.reduce((n, d) => n + pool.sizes[d] - (pool.fixed[d] ?? []).length, 0)
    expect(pool.requests.length).toBeGreaterThanOrEqual(needed * 2 - needed * 0.15)
  })

  it('gives every pooled request a real objective and a beat that grants it', () => {
    const ids = new Set(pool.requests.map((r) => r.id))
    expect(ids.size).toBe(pool.requests.length)
    // A request may take several steps; the last one is what completes it, so
    // that is the step that has to carry the grant.
    const lastStep = (ask) => (ask.then ? lastStep(ask.then) : ask)
    for (const r of pool.requests) {
      expect(scenario.objectives.some((o) => o.id === r.id), r.id).toBe(true)
      expect(lastStep(r.beat.ask).grants, r.id).toBe(r.id)
      expect(r.beat.lines.length).toBeGreaterThan(0)
    }
  })

  it('makes a multi-step request grant nothing until its last step', () => {
    const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
    for (const r of pool.requests) {
      const all = steps(r.beat.ask)
      // an early step that grants would end the request halfway through
      for (const step of all.slice(0, -1)) expect(step.grants, r.id).toBeUndefined()
    }
  })

  it('never pools a request some day already pins', () => {
    const pinned = new Set(Object.values(pool.fixed).flat())
    for (const r of pool.requests) expect(pinned.has(r.id), r.id).toBe(false)
    for (const d of scenario.days) {
      expect([...d.requests].sort()).toEqual([...pool.fixed[d.n]].sort())
    }
  })
})

describe('drawing a week', () => {
  it('leaves day one exactly as written', () => {
    expect(drawFor(scenario, 1, {})).toEqual([])
    expect(requestsOf(scenario, 1, {}, week()).map((o) => o.id).sort())
      .toEqual([...scenario.days[0].requests].sort())
  })

  it('fills every later day to its size, without repeating a request', () => {
    for (let run = 0; run < 200; run++) {
      const drawn = week()
      const seen = new Set()
      for (const n of days) {
        expect(requestsOf(scenario, n, {}, drawn), `day ${n}`).toHaveLength(pool.sizes[n])
        for (const id of drawn[n]) {
          expect(seen.has(id), `${id} drawn twice`).toBe(false)
          seen.add(id)
        }
      }
    }
  })

  it('holds a request back until the day its document exists', () => {
    for (const [id, earliest] of Object.entries(pool.after)) {
      for (let run = 0; run < 50; run++) {
        const drawn = week()
        for (const n of days) if (drawn[n].includes(id)) expect(n).toBeGreaterThanOrEqual(earliest)
      }
    }
  })

  it('brings a different week almost every time', () => {
    const runs = new Set(Array.from({ length: 30 }, () => JSON.stringify(week())))
    expect(runs.size).toBeGreaterThan(25)
  })

  it('is a fair shuffle that keeps every element', () => {
    const list = [1, 2, 3, 4, 5]
    expect([...shuffle(list)].sort()).toEqual(list)
    expect(shuffle(list, () => 0)).toHaveLength(5)
    expect(list).toEqual([1, 2, 3, 4, 5])   // the source is left alone
  })
})

describe('the day that arrives', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ drawn: {}, pendingAsks: {}, extraMessages: {}, extraMails: [], grants: {} })
  })
  afterEach(() => vi.useRealTimers())

  it('draws once and remembers it', () => {
    useGame.getState().startDay(2)
    const first = useGame.getState().drawn[2]
    expect(first).toHaveLength(pool.sizes[2] - pool.fixed[2].length)
    useGame.getState().startDay(2)
    expect(useGame.getState().drawn[2]).toEqual(first)
  })

  it('asks everything it drew, in the messenger', () => {
    useGame.getState().startDay(3)
    vi.runAllTimers()
    const chain = (a) => (a ? [a, ...chain(a.then)] : [])
    const asked = Object.values(useGame.getState().pendingAsks).flatMap(chain).map((a) => a.grants)
    for (const id of useGame.getState().drawn[3]) expect(asked, id).toContain(id)
  })

  it('finds a beat for every id it draws', () => {
    const drawn = week()
    for (const n of days.slice(1)) {
      expect(beatsFor(scenario, drawn[n])).toHaveLength(drawn[n].length)
    }
  })
})
