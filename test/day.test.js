import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { useGame } from '../src/engine/store.js'

const chain = (ask) => (ask ? [ask, ...chain(ask.then)] : [])
const grantsOf = (asks) => asks.flatMap(chain).map((a) => a.grants).filter(Boolean)

// The day's beats land on timers, one after another. Two of them can pick the
// same conversation, which is the case worth pinning down: the later question
// has to wait its turn rather than write over the earlier one.
describe('a day arriving', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ pendingAsks: {}, extraMessages: {}, extraMails: [], grants: {} })
  })
  afterEach(() => vi.useRealTimers())

  it('leaves every question it raises still answerable', () => {
    for (const day of scenario.days.filter((d) => d.asks)) {
      useGame.setState({ pendingAsks: {}, extraMessages: {}, extraMails: [] })
      useGame.getState().startDay(day.n)
      vi.runAllTimers()
      const waiting = grantsOf(Object.values(useGame.getState().pendingAsks))
      for (const wanted of grantsOf(day.asks.map((b) => b.ask))) {
        expect(waiting).toContain(wanted)
      }
    }
  })

  it('opens each conversation on the question that came first', () => {
    const day = scenario.days.find((d) => d.n === 2)
    useGame.getState().startDay(2)
    vi.runAllTimers()
    const first = {}
    for (const beat of day.asks) {
      if (beat.ask && !(beat.thread in first)) first[beat.thread] = beat.ask.placeholder
    }
    for (const [thread, placeholder] of Object.entries(first)) {
      expect(useGame.getState().pendingAsks[thread].placeholder).toBe(placeholder)
    }
  })

  it('brings the day its own mail', () => {
    useGame.setState({ extraMails: [] })
    useGame.getState().startDay(2)
    vi.runAllTimers()
    expect(useGame.getState().extraMails.map((m) => m.id))
      .toEqual(scenario.days[1].mails.map((m) => m.id))
  })
})
