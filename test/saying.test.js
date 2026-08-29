import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { sourceOf, useGame } from '../src/engine/store.js'
import scenario from '../src/scenarios/workday.json'

// 한 사람이 잇달아 여러 줄을 말할 때, 그 줄들이 한 프레임에 전부 튀어나오면
// 사람이 친 말로 읽히지 않는다. 대화를 열어 놓고 보고 있으면 한 줄씩 오게
// 하되, 안 보고 있으면 그냥 넣는다 — 어차피 열었을 때 함께 읽는다.
const LINES = ['첫째 줄입니다', '둘째 줄입니다', '셋째 줄입니다']

const countIn = (threadId) => (useGame.getState().extraMessages[threadId] ?? []).length

describe('여러 줄이 도착하는 방식', () => {
  const thread = 'boss'
  const source = sourceOf(scenario, thread)

  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ extraMessages: {}, typing: {}, openThread: {}, windows: [] })
  })
  afterEach(() => vi.useRealTimers())

  const watch = () => useGame.setState({
    openThread: { [source]: thread },
    windows: [{ id: 1, app: 'messenger', minimized: false }]
  })

  it('업무 대화는 업무 메신저의 것으로 본다', () => {
    expect(source).toBe('workMessenger')
    expect(sourceOf(scenario, 'jihyun')).toBe('privateMessenger')
  })

  it('보고 있으면 한 줄씩 온다', () => {
    watch()
    useGame.getState().saying(thread, '박 팀장', LINES)
    expect(countIn(thread)).toBe(0)
    vi.advanceTimersByTime(1200)
    expect(countIn(thread)).toBe(1)
    vi.advanceTimersByTime(1500)
    expect(countIn(thread)).toBe(2)
  })

  it('보고 있어도 결국 전부 도착한다 — 한 줄도 잃지 않는다', () => {
    watch()
    useGame.getState().saying(thread, '박 팀장', LINES)
    vi.advanceTimersByTime(60000)
    const said = useGame.getState().extraMessages[thread].map((m) => m.text)
    expect(said).toEqual(LINES)
    expect(useGame.getState().typing[thread]).toBe(false)
  })

  it('안 보고 있으면 한꺼번에 넣는다', () => {
    useGame.getState().saying(thread, '박 팀장', LINES)
    expect(countIn(thread)).toBe(LINES.length)
  })

  it('창을 내려 두었으면 보고 있는 것이 아니다', () => {
    useGame.setState({
      openThread: { [source]: thread },
      windows: [{ id: 1, app: 'messenger', minimized: true }]
    })
    useGame.getState().saying(thread, '박 팀장', LINES)
    expect(countIn(thread)).toBe(LINES.length)
  })

  it('다른 대화를 열어 두었으면 보고 있는 것이 아니다', () => {
    useGame.setState({
      openThread: { [source]: 'junho' },
      windows: [{ id: 1, app: 'messenger', minimized: false }]
    })
    useGame.getState().saying(thread, '박 팀장', LINES)
    expect(countIn(thread)).toBe(LINES.length)
  })
})

// 이 결함은 한 군데가 아니라 열 군데였다 — beat, 잡담, 나비효과, 독촉, 부고,
// 라우터 복구까지 전부 같은 줄을 복사해 쓰고 있었다. 한 곳만 고치면 나머지는
// 그대로 남고, 새 beat 종류를 넣는 사람이 다시 같은 줄을 복사한다.
describe('여러 줄을 밀어 넣는 자리는 한 곳뿐이다', () => {
  it('store 안에 줄을 한꺼번에 쏟는 코드가 saying 말고는 없다', () => {
    const src = readFileSync('src/engine/store.js', 'utf8')
    // saying 자신은 안 보고 있을 때 실제로 한꺼번에 넣는다. 그 한 줄만 빼고 본다.
    const at = src.indexOf('  saying: (threadId, from, lines, gap) => {')
    expect(at, 'saying 이 없어졌다').toBeGreaterThan(-1)
    const outside = src.slice(0, at) + src.slice(src.indexOf('  },', at))
    const burst = outside.split('\n').filter((l) =>
      l.includes('.forEach(') && l.includes('pushMessage(') && l.includes('text }'))
    expect(burst, 'saying() 을 쓰세요').toEqual([])
  })
})
