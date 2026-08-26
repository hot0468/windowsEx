import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { appOf, requestsOf, useGame, watchingThread } from '../src/engine/store.js'

const chat = { from: '차민혁', text: '보냈습니다', app: 'messenger', source: 'workMessenger', thread: 'boss' }

beforeEach(() => useGame.setState({ toast: null, windows: [], openThread: {}, day: 1 }))

describe('a notification for a conversation already on screen', () => {
  it('does not ring while that thread is the one open', () => {
    useGame.setState({ windows: [{ id: 1, app: 'messenger', minimized: false }], openThread: { workMessenger: 'boss' } })
    useGame.getState().showToast(chat)
    expect(useGame.getState().toast).toBe(null)
  })

  it('rings when the window is showing a different thread', () => {
    useGame.setState({ windows: [{ id: 1, app: 'messenger', minimized: false }], openThread: { workMessenger: 'jihyun' } })
    useGame.getState().showToast(chat)
    expect(useGame.getState().toast?.thread).toBe('boss')
  })

  it('rings when the window is minimized', () => {
    useGame.setState({ windows: [{ id: 1, app: 'messenger', minimized: true }], openThread: { workMessenger: 'boss' } })
    useGame.getState().showToast(chat)
    expect(useGame.getState().toast?.thread).toBe('boss')
  })

  it('rings when the other messenger is the one open', () => {
    useGame.setState({ windows: [{ id: 1, app: 'chat', minimized: false }], openThread: { workMessenger: 'boss' } })
    useGame.getState().showToast(chat)
    expect(useGame.getState().toast?.thread).toBe('boss')
  })

  it('leaves toasts that are not about a conversation alone', () => {
    useGame.setState({ windows: [{ id: 1, app: 'messenger', minimized: false }] })
    expect(watchingThread(useGame.getState(), { from: '다운로드 완료', text: '저장했습니다', app: 'explorer' })).toBe(false)
  })
})

// ── which app a toast opens ──────────────────────────────────────────────

const beatsOf = (source) => [
  ...(scenario.chatter ?? []).map((c) => c.beat),
  ...scenario.pool.requests.map((r) => r.beat),
  ...scenario.days.flatMap((d) => [d.opening, ...(d.asks ?? [])])
].filter((b) => b?.source === source)

const privateThreads = new Set(
  scenario.privateMessenger.sections.flatMap((s) => s.threads.map((t) => t.id))
)

describe('a toast opens the app it came from', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ toast: null, chatted: {}, day: 5, extraMessages: {} })
  })
  afterEach(() => vi.useRealTimers())

  it('maps each messenger to its own app', () => {
    expect(appOf('privateMessenger')).toBe('chat')
    expect(appOf('workMessenger')).toBe('messenger')
    expect(appOf(undefined)).toBe('messenger')   // the safe default
  })

  it('has beats on both messengers to route', () => {
    expect(beatsOf('privateMessenger').length).toBeGreaterThan(10)
    expect(beatsOf('workMessenger').length).toBeGreaterThan(10)
  })

  it('agrees with where each beat’s thread actually lives', () => {
    for (const b of beatsOf('privateMessenger')) {
      expect(privateThreads.has(b.thread), b.thread).toBe(true)
    }
    for (const b of beatsOf('workMessenger')) {
      expect(privateThreads.has(b.thread), b.thread).toBe(false)
    }
  })

  it('sends a 톡톡 beat to 톡톡, not to AR톡', () => {
    const g = () => useGame.getState()
    // spend the work-thread small talk so a private one is drawn
    const used = {}
    for (const c of scenario.chatter) if (c.beat?.source !== 'privateMessenger') used[c.id] = 1
    useGame.setState({ chatted: used })

    for (let i = 0; i < 30; i++) {
      useGame.setState({ toast: null })
      g().chat('any')
      vi.runAllTimers()
      const t = g().toast
      if (t?.source === 'privateMessenger') {
        expect(t.app).toBe('chat')
        expect(privateThreads.has(t.thread)).toBe(true)
        return
      }
    }
    throw new Error('no 톡톡 chatter fired in 30 draws')
  })
})

describe('day one hands the conversations over in order', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({
      day: 1, grants: {}, unlocked: {}, sheetEdits: {}, overtime: {}, drawn: {}, ripples: {},
      toast: null, extraMessages: {}, chatted: {}, msgCount: 0, windows: [], openThread: {}
    })
  })
  afterEach(() => vi.useRealTimers())

  it('rings for 엄마 and 지현 instead of leaving them sitting there unseen', () => {
    // both start the day held back, so the player would otherwise only find
    // them by opening 톡톡 on a hunch
    const rung = []
    for (const o of requestsOf(scenario, 1, {}, {}, {})) {
      useGame.setState({ toast: null })
      useGame.getState().grant(o.grant ?? o.id)
      vi.runAllTimers()
      const t = useGame.getState().toast
      if (t?.thread) rung.push(t)
    }
    const mom = rung.find((t) => t.thread === 'mom')
    const jihyun = rung.find((t) => t.thread === 'jihyun')
    expect(mom, '엄마 never announced herself').toBeTruthy()
    expect(jihyun, '지현 never announced herself').toBeTruthy()
    // and clicking either one has to land in 톡톡, not AR톡
    expect(mom.app).toBe('chat')
    expect(jihyun.app).toBe('chat')
    // 엄마 comes before 지현, the order the day is written in
    expect(rung.indexOf(mom)).toBeLessThan(rung.indexOf(jihyun))
  })
})
