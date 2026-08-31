import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { appOf, requestsOf, useGame, watchingThread } from '../src/engine/store.js'

const chat = { from: '차민혁', text: '보냈습니다', app: 'messenger', source: 'workMessenger', thread: 'boss' }

beforeEach(() => useGame.setState({ toast: null, queuedToasts: [], windows: [], openThread: {}, day: 1 }))

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

describe('a conversation that opens says all of it', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({
      day: 1, toast: null, extraMessages: {}, msgCount: 0,
      windows: [], openThread: {}, typing: {}
    })
  })
  afterEach(() => vi.useRealTimers())

  const rungBy = (threadId) => {
    const seen = []
    const real = useGame.getState().showToast
    useGame.setState({ showToast: (t) => { seen.push(t); real(t) } })
    useGame.getState().nudge(threadId)
    vi.runAllTimers()
    useGame.setState({ showToast: real })
    return seen
  }

  it('rings once per line rather than only for the last one', () => {
    // 지현 opens the first day with eight lines — her birthday, the lottery
    // serial, the password hint. Only the last used to raise a toast.
    const lines = scenario.privateMessenger.sections
      .flatMap((s) => s.threads).find((t) => t.id === 'jihyun')
      .messages.filter((m) => m.day === 1 && !m.me)
    expect(lines.length).toBeGreaterThan(3)

    const rung = rungBy('jihyun')
    expect(rung).toHaveLength(lines.length)
    expect(rung.map((t) => t.text)).toEqual(lines.map((m) => m.text))
  })

  it('keeps every line of a thread pointed at its own messenger', () => {
    for (const t of rungBy('jihyun')) {
      expect(t.app).toBe('chat')
      expect(t.thread).toBe('jihyun')
    }
    for (const t of rungBy('security')) expect(t.app).toBe('messenger')
  })

  it('says nothing for a thread with nothing to say today', () => {
    useGame.setState({ day: 4 })
    expect(rungBy('jihyun')).toHaveLength(0)
  })
})

// ── 알림은 줄을 선다 ─────────────────────────────────────────────────────
//
// 화면의 알림 칸은 하나뿐이고 4.5초를 산다. 그런데 대화가 열리며 쏟아지는
// 줄들은 2.2초 간격으로 오고(NUDGE_GAP), 1일차 팀장의 네 마디는 그보다도
// 촘촘하다 — 덮어쓰면 실제로 읽히는 것은 마지막 하나뿐이다.
describe('두 알림이 겹치면', () => {
  const second = { ...chat, text: '하나 더' }

  beforeEach(() => useGame.setState({ toast: null, queuedToasts: [], windows: [], openThread: {}, day: 1 }))

  it('앞엣것을 덮지 않고 뒤에 세운다', () => {
    const g = () => useGame.getState()
    g().showToast(chat)
    g().showToast(second)
    expect(g().toast.text).toBe(chat.text)
    expect(g().queuedToasts).toHaveLength(1)
    g().clearToast()
    expect(g().toast.text).toBe(second.text)
    g().clearToast()
    expect(g().toast).toBe(null)
  })

  it('한 대화가 여덟 줄을 쏟아내도 마지막 하나만 남지 않는다', () => {
    const g = () => useGame.getState()
    const lines = Array.from({ length: 8 }, (_, i) => ({ ...chat, text: '줄 ' + i }))
    for (const l of lines) g().showToast(l)
    const shown = []
    while (g().toast) { shown.push(g().toast.text); g().clearToast() }
    expect(shown.length).toBeGreaterThan(1)
    expect(shown[0]).toBe('줄 0')
  })

  it('밀린 로그가 되도록 무한정 쌓지는 않는다', () => {
    const g = () => useGame.getState()
    for (let i = 0; i < 40; i++) g().showToast({ ...chat, text: '줄 ' + i })
    expect(g().queuedToasts.length).toBeLessThanOrEqual(5)
    // 버릴 때는 오래된 것부터 — 가장 새로운 말이 줄 끝에 남는다
    expect(g().queuedToasts.at(-1).text).toBe('줄 39')
  })

  it('기다리는 사이에 그 대화를 열었으면 그 알림은 버린다', () => {
    const g = () => useGame.getState()
    g().showToast({ ...chat, thread: 'jihyun', source: 'privateMessenger', app: 'chat' })
    g().showToast(chat)   // boss, 줄에 선다
    useGame.setState({
      windows: [{ id: 1, app: 'messenger', minimized: false }],
      openThread: { workMessenger: 'boss' }
    })
    g().clearToast()
    expect(g().toast).toBe(null)
  })

  it('잠금·크래시·엔딩은 줄까지 걷어낸다', () => {
    const g = () => useGame.getState()
    g().showToast(chat)
    g().showToast({ ...chat, text: '하나 더' })
    g().lock()
    expect(g().toast).toBe(null)
    expect(g().queuedToasts).toEqual([])
    useGame.setState({ locked: false })
  })
})
