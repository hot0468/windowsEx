import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { endingFor, fileFits, seenEndings, useGame } from '../src/engine/store.js'

// 테스트는 node 에서 돈다 — 브라우저의 저장소 흉내를 하나 둔다
const store = {}
globalThis.localStorage ??= {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: (k) => { delete store[k] },
  clear: () => { for (const k in store) delete store[k] }
}

const steps = (a) => (a ? [a, ...steps(a.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger].flatMap((m) => m.sections.flatMap((x) => x.threads))
const accepts = [...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]), ...scenario.pool.requests.map((r) => r.beat.ask)]
  .filter(Boolean).flatMap(steps).flatMap((a) => (a.accept ?? []).flat()).filter((v) => typeof v === 'string' && v.length > 2)

// 엔딩을 한 번 본 사람의 첫날은 첫 번째와 한 줄 다르다. 그 한 줄이 루프라는
// 것을 게임이 안다는 유일한 신호다 — 그래서 더는 말하지 않는다.
describe('두 번째 첫날', () => {
  const again = scenario.again

  it('팀장이 한마디 하고 만다', () => {
    expect(again.thread).toBe('boss')
    expect(again.lines.join(' ')).toContain('또 첫날')
    expect(again.ask).toBeUndefined()
    for (const v of accepts) expect(again.lines.join(' ')).not.toContain(v)
    // 죽음을 말하지 않는다 — 진실 엔딩 밖의 어떤 것도 그러면 안 된다
    expect(again.lines.join(' ')).not.toMatch(/죽|부고|병원|사고|꿈/)
  })

  it('본 엔딩을 새 게임 너머까지 기억한다', () => {
    localStorage.clear()
    expect(seenEndings()).toEqual([])
    useGame.getState().endGame('plain')
    useGame.getState().endGame('plain')
    useGame.getState().layOff('quit')
    expect(seenEndings()).toEqual(['plain', 'layoff:quit'])
    useGame.setState({ ended: null })
    localStorage.clear()
  })

  it('기억이 있을 때만 첫날 맨 앞에 온다', () => {
    vi.useFakeTimers()
    const fresh = () => useGame.setState({ ended: null, day: 1, drawn: {}, beatQueue: [], beatAsk: null, ripples: {}, overtime: {}, grants: {}, extraMails: [] })
    localStorage.clear()
    fresh()
    useGame.getState().startDay(1)
    expect(useGame.getState().beatQueue[0]).not.toBe(again)
    useGame.getState().endGame('overwork')
    fresh()
    useGame.getState().startDay(1)
    expect(useGame.getState().beatQueue[0]).toBe(again)
    // 둘째 날부터는 아무 말 없다
    fresh()
    useGame.getState().startDay(2)
    expect(useGame.getState().beatQueue).not.toContain(again)
    vi.useRealTimers()
    localStorage.clear()
  })
})

// 엔딩 화면은 열 갈래 중 몇 번째인지 말한다. 보지 못한 것이 있다는 것을
// 아는 사람만 다시 출근한다.
describe('열 갈래의 번호', () => {
  const order = scenario.ending.order

  it('열 개이고 겹치지 않는다', () => {
    expect(order).toHaveLength(10)
    expect(new Set(order).size).toBe(10)
  })

  it('전부 실제로 나올 수 있는 엔딩이다', () => {
    const real = (k) => {
      const [name, pick] = k.split(':')
      return name === 'layoff' ? scenario.ending.layoff.choices.find((c) => c.id === pick) : scenario.ending[name]
    }
    for (const k of order) expect(real(k)?.end?.title, k).toBeTruthy()
    const base = { grants: {}, locks: 1, overtime: {}, digging: {}, rumor: {} }
    for (const st of [base, { ...base, locks: 0 }, { ...base, grants: { lotto: true } }, { ...base, digging: { asked: 1, found: 1, entered: 1 } }]) {
      expect(order).toContain(endingFor(scenario.ending, st))
    }
  })

  it('화면에 적힌다', () => {
    const src = readFileSync('src/shell/Ending.jsx', 'utf8')
    expect(src).toContain('end-no')
    expect(src).toContain('order.indexOf(String(kind))')
  })
})

// 화면 캡처로 푸는 질문. 캡처는 찍는 순간 생기는 파일이라 id 로 고를 수 없고,
// 무엇을 찍었는지로 본다.
describe('캡처로 답한다', () => {
  const ask = { shot: { app: 'devtools' } }

  it('그 창을 찍은 캡처만 맞는다', () => {
    expect(fileFits(ask, { id: 'shot_1', shot: { title: 'devtools', at: '10:00', day: 4 } })).toBe(true)
    expect(fileFits(ask, { id: 'shot_2', shot: { title: 'browser', at: '10:00', day: 4 } })).toBe(false)
    expect(fileFits(ask, { id: 'file_qc' })).toBe(false)
    // 파일로 답하는 질문은 예전처럼 id 로도, 파일로도 맞는다
    expect(fileFits({ files: ['file_qc'] }, 'file_qc')).toBe(true)
    expect(fileFits({ files: ['file_qc'] }, { id: 'file_qc' })).toBe(true)
  })

  it('찍을 창이 실제로 있고, 캡처하는 법을 힌트가 말한다', () => {
    const shots = scenario.pool.requests.flatMap((r) => steps(r.beat.ask).map((a) => [r, a])).filter(([, a]) => a.shot)
    expect(shots.length).toBeGreaterThan(0)
    const registry = readFileSync('src/apps/registry.jsx', 'utf8')
    for (const [r, a] of shots) {
      expect(registry.includes('  ' + a.shot.app + ':'), a.shot.app).toBe(true)
      expect(a.placeholder && a.ok?.length && a.no?.length === 3, r.id).toBeTruthy()
      expect(a.accept ?? a.files, r.id).toBeUndefined()
      expect(a.no.flat().join(' '), r.id).toMatch(/Print Screen/)
    }
  })

  it('찍은 캡처가 그 질문에 맞는다', () => {
    vi.useFakeTimers()
    useGame.setState({ windows: [{ id: 1, app: 'devtools', z: 9, minimized: false }], shots: [], locked: false, crashed: false, day: 4, dayAt: 0, overtime: {} })
    const shot = useGame.getState().capture()
    expect(shot.shot.title).toBe('devtools')
    expect(fileFits(ask, shot)).toBe(true)
    vi.useRealTimers()
  })
})
