import { beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { useGame } from '../src/engine/store.js'

// 요청의 86%가 '찾아서 타이핑'이었다. 행동으로 푸는 요청은 ask가 텍스트
// 대신 grant를 기다린다 — 그 행동이 일어나면 창이 닫혀 있어도 답이 온다.
const DEED = { deed: 'orders', placeholder: '시트를 고쳐 저장하면 확인됩니다', ok: ['고쳤네요, 감사합니다.'], no: [['a'], ['b'], ['c']], next: [] }

describe('행동을 기다리는 질문', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ grants: {}, pendingAsks: {}, extraMessages: {}, windows: [], openThread: {}, beatQueue: [], beatAsk: null, branches: {}, day: 2 })
  })

  it('그 grant가 켜지면 ok를 말하고 질문이 닫힌다', () => {
    useGame.setState({ pendingAsks: { boss: DEED } })
    useGame.getState().grant('orders')
    vi.runAllTimers()
    expect(useGame.getState().pendingAsks.boss).toBe(null)
    expect(useGame.getState().extraMessages.boss.map((m) => m.text)).toEqual(DEED.ok)
  })

  it('다른 grant에는 꿈쩍하지 않는다', () => {
    useGame.setState({ pendingAsks: { boss: DEED } })
    useGame.getState().grant('wifi')
    vi.runAllTimers()
    expect(useGame.getState().pendingAsks.boss).toBe(DEED)
    expect(useGame.getState().extraMessages.boss).toBeUndefined()
  })

  it('체인 가운데의 행동은 다음 질문으로 넘긴다', () => {
    const next = { placeholder: '다음', accept: ['x'], ok: ['끝'], no: [['a'], ['b'], ['c']], next: [] }
    useGame.setState({ pendingAsks: { boss: { ...DEED, then: next } } })
    useGame.getState().grant('orders')
    vi.runAllTimers()
    expect(useGame.getState().pendingAsks.boss).toBe(next)
  })

  it('마지막 단계의 grants도 같이 켠다', () => {
    useGame.setState({ pendingAsks: { boss: { ...DEED, grants: 'orders' } } })
    useGame.getState().grant('orders')
    vi.runAllTimers()
    expect(useGame.getState().grants.orders).toBe(true)
    // 두 번 켜지지 않는다 — ok 대사가 두 번 오면 그게 증거다
    expect(useGame.getState().extraMessages.boss.map((m) => m.text)).toEqual(DEED.ok)
  })
})
