import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { useGame } from '../src/engine/store.js'
import { askChain as chain, grantsRaised, playDay } from './playDay.js'

const grantsOf = (asks) => asks.flatMap(chain).map((a) => a.grants).filter(Boolean)

// The day's beats land one at a time, each waiting for the last one's question
// to be answered. Two of them can pick the same conversation, which is the case
// worth pinning down: the later question has to wait its turn rather than write
// over the earlier one.
describe('a day arriving', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ pendingAsks: {}, extraMessages: {}, extraMails: [], grants: {} })
  })
  afterEach(() => vi.useRealTimers())

  it('raises every question it has, once the ones before are answered', () => {
    for (const day of scenario.days.filter((d) => d.asks)) {
      useGame.setState({ pendingAsks: {}, extraMessages: {}, extraMails: [] })
      useGame.getState().startDay(day.n)
      const asked = grantsRaised(playDay())
      for (const wanted of grantsOf(day.asks.map((b) => b.ask))) {
        expect(asked, `day ${day.n}`).toContain(wanted)
      }
    }
  })

  it('opens each conversation on the question that came first', () => {
    const day = scenario.days.find((d) => d.n === 2)
    useGame.getState().startDay(2)
    const raised = playDay()
    const first = {}
    for (const beat of day.asks) {
      if (beat.ask && !(beat.thread in first)) first[beat.thread] = beat.ask.placeholder
    }
    for (const [thread, placeholder] of Object.entries(first)) {
      const mine = raised.filter((r) => r.thread === thread)
      expect(mine[0]?.ask.placeholder, thread).toBe(placeholder)
    }
  })

  it('holds the next thing it has to say until the question is answered', () => {
    useGame.setState({ pendingAsks: {}, extraMessages: {}, extraMails: [], beatQueue: [], beatAsk: null })
    useGame.getState().startDay(2)
    vi.runAllTimers()
    // one question open, and the rest of the day still waiting behind it
    expect(useGame.getState().beatAsk).toBeTruthy()
    expect(useGame.getState().beatQueue.length).toBeGreaterThan(0)
    const held = useGame.getState().beatQueue.length
    vi.runAllTimers()
    expect(useGame.getState().beatQueue).toHaveLength(held)
    useGame.getState().setAsk(useGame.getState().beatAsk, null)
    vi.runAllTimers()
    expect(useGame.getState().beatQueue.length).toBeLessThan(held)
  })

  it('brings the day its own mail', () => {
    useGame.setState({ extraMails: [] })
    useGame.getState().startDay(2)
    vi.runAllTimers()
    expect(useGame.getState().extraMails.map((m) => m.id))
      .toEqual(scenario.days[1].mails.map((m) => m.id))
  })
})
