import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { CALLER_DELAY, useGame, appOf, sourceOf } from '../src/engine/store.js'

// 하루 끝에 이름 없는 계정이 말을 건다. 그 말은 지나가는 알림이 아니라 하루를
// 붙잡고 서 있는 것이다 — 깨지는 방식은 둘. 알림이 스스로 사라져 무슨 말이었는지
// 못 보거나, 반대로 영영 안 사라져 하루가 끝나지 않거나.

const su = scenario.summons
const NIGHT = Number(Object.keys(su.nights)[0])
const APP = appOf(sourceOf(scenario, su.thread))

const fresh = (day) => useGame.setState({
  day, grants: {}, closing: false, awaitingCaller: null, windows: [],
  beatQueue: [], beatAsk: null, toast: null, extraMessages: {}, chatted: {}, pendingAsks: {}
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('부름이 오는 밤', () => {
  it('퇴근을 눌러도 마감 화면이 곧바로 오지 않는다', () => {
    fresh(NIGHT)
    useGame.getState().closeDay()
    vi.runAllTimers()
    expect(useGame.getState().closing).toBe(false)
    expect(useGame.getState().awaitingCaller).toBe(su.thread)
  })

  it('그 알림은 스스로 사라지지 않는다', () => {
    fresh(NIGHT)
    useGame.getState().closeDay()
    vi.runAllTimers()
    const { toast } = useGame.getState()
    expect(toast?.thread).toBe(su.thread)
    expect(toast.sticky).toBe(true)
  })

  it('잡담 알림이 그 위를 덮지 않는다 — 덮이면 무슨 말이었는지 못 본다', () => {
    fresh(NIGHT)
    useGame.getState().closeDay()
    vi.runAllTimers()
    useGame.getState().showToast({ from: '최민서', text: '먼저 들어가 볼게요', app: 'messenger' })
    expect(useGame.getState().toast.thread).toBe(su.thread)
  })

  it('그 대화를 닫으면 그때 저녁이 온다', () => {
    fresh(NIGHT)
    useGame.getState().closeDay()
    vi.runAllTimers()
    useGame.setState({ windows: [{ id: 7, key: APP, app: APP, z: 1 }] })
    useGame.getState().closeWindow(7)
    expect(useGame.getState().closing).toBe(true)
    expect(useGame.getState().awaitingCaller).toBe(null)
    expect(useGame.getState().toast).toBe(null)
  })

  it('다른 창을 닫는 것으로는 하루가 끝나지 않는다', () => {
    fresh(NIGHT)
    useGame.getState().closeDay()
    vi.runAllTimers()
    useGame.setState({ windows: [{ id: 8, key: 'browser', app: 'browser', z: 1 }] })
    useGame.getState().closeWindow(8)
    expect(useGame.getState().closing).toBe(false)
    expect(useGame.getState().awaitingCaller).toBe(su.thread)
  })

  it('다시 눌러도 하루는 끝나지 않는다 — 읽고 닫는 것만이 끝낸다', () => {
    // 버튼은 죽어 있지만, 죽은 버튼을 우회해 부르는 길이 있어도 같아야 한다.
    fresh(NIGHT)
    useGame.getState().closeDay()
    vi.runAllTimers()
    expect(useGame.getState().closing).toBe(false)
    useGame.getState().closeDay()
    expect(useGame.getState().closing).toBe(false)
    expect(useGame.getState().awaitingCaller).toBe(su.thread)
  })

  it('말은 버튼이 죽고 살짝 뒤에 온다 — 곧바로 오면 버튼이 부른 것처럼 읽힌다', () => {
    fresh(NIGHT)
    useGame.getState().closeDay()
    expect(useGame.getState().awaitingCaller).toBe(su.thread)
    expect(useGame.getState().toast).toBe(null)
    vi.advanceTimersByTime(CALLER_DELAY - 1)
    expect(useGame.getState().toast).toBe(null)
    vi.advanceTimersByTime(1)
    expect(useGame.getState().toast?.thread).toBe(su.thread)
  })
})

describe('부름이 없는 밤', () => {
  const quiet = scenario.days.map((_, i) => i + 1).find((d) => !su.nights[d])

  it('그런 날이 있다', () => expect(quiet).toBeTruthy())

  it('퇴근을 누르면 곧바로 닫힌다', () => {
    fresh(quiet)
    useGame.getState().closeDay()
    expect(useGame.getState().closing).toBe(true)
    expect(useGame.getState().awaitingCaller).toBe(null)
  })
})
