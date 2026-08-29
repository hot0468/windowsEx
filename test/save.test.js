import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { freshenAsks } from '../src/engine/store.js'

// The store reads storage at import time, so each case stubs it, then imports.
const mem = () => {
  const m = new Map()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  }
}

beforeEach(() => {
  globalThis.localStorage = mem()
  globalThis.sessionStorage = mem()
  vi.resetModules()
})

const freshStore = async () => (await import('../src/engine/store.js')).useGame
// autosave is debounced by 400ms
const settle = () => new Promise((r) => setTimeout(r, 450))

describe('save / load', () => {
  it('carries progress into the next session', async () => {
    const useGame = await freshStore()
    useGame.setState({ unlocked: { 'wiki.ar.co.kr': true }, msgCount: 3, scratch: '입사일 0412', readMails: { mail_client: true } })
    useGame.getState().openWindow('browser')
    useGame.getState().saveGame()

    globalThis.sessionStorage.setItem('windowsEx.pendingLoad', '1')
    vi.resetModules()
    const next = (await freshStore()).getState()

    expect(next.unlocked['wiki.ar.co.kr']).toBe(true)
    expect(next.msgCount).toBe(3)
    expect(next.scratch).toBe('입사일 0412')
    expect(next.readMails).toEqual({ mail_client: true })
    expect(next.windows.map((w) => w.app)).toEqual(['browser'])
  })

  it('펼쳐 둔 이전 메시지는 다시 켜도 펼쳐져 있다', async () => {
    const useGame = await freshStore()
    useGame.getState().openHistory('mom', 2)
    useGame.getState().saveGame()

    globalThis.sessionStorage.setItem('windowsEx.pendingLoad', '1')
    vi.resetModules()
    const next = (await freshStore()).getState()

    expect(next.openedHistory.mom).toBe(2)
  })

  it('이 필드가 없던 옛 저장도 읽힌다', async () => {
    // 예전 세이브에는 openedHistory 자체가 없다.
    globalThis.localStorage.setItem('windowsEx.save',
      JSON.stringify({ at: 1, windows: [], nextZ: 10, day: 1 }))
    globalThis.sessionStorage.setItem('windowsEx.pendingLoad', '1')
    vi.resetModules()
    const next = (await freshStore()).getState()

    expect(next.openedHistory).toEqual({})
  })

  it('picks the autosave up again after a plain refresh', async () => {
    const useGame = await freshStore()
    useGame.setState({ unlocked: { 'wiki.ar.co.kr': true }, scratch: '메모' })
    await settle()

    vi.resetModules()
    const next = (await freshStore()).getState()
    expect(next.unlocked['wiki.ar.co.kr']).toBe(true)
    expect(next.scratch).toBe('메모')
  })

  it('drops the autosave when a new game starts', async () => {
    const useGame = await freshStore()
    useGame.setState({ unlocked: { 'wiki.ar.co.kr': true } })
    await settle()
    globalThis.location = { reload() {} }
    useGame.getState().newGame()

    vi.resetModules()
    expect((await freshStore()).getState().unlocked).toEqual({})
  })

  it('prefers the explicit checkpoint over the autosave', async () => {
    const useGame = await freshStore()
    useGame.setState({ msgCount: 1 })
    useGame.getState().saveGame()          // checkpoint at 1
    useGame.setState({ msgCount: 4 })
    await settle()                          // autosave at 4

    globalThis.sessionStorage.setItem('windowsEx.pendingLoad', '1')
    vi.resetModules()
    expect((await freshStore()).getState().msgCount).toBe(1)
  })

  it('ignores a corrupt save instead of crashing', async () => {
    globalThis.localStorage.setItem('windowsEx.save', '{ not json')
    globalThis.sessionStorage.setItem('windowsEx.pendingLoad', '1')
    const state = (await freshStore()).getState()

    expect(state.unlocked).toEqual({})
    expect(state.windows).toEqual([])
  })

  it('says so when there is nothing to load', async () => {
    const useGame = await freshStore()
    useGame.getState().loadGame()
    expect(useGame.getState().toast.text).toContain('저장된 게임이 없습니다')
  })
})

// The save is the whole of PROGRESS and nothing else. A field restored on boot
// but left out of the list comes back as its default every time the page
// reloads — the kind of loss that reads as "the game forgot", not as a crash.
describe('what survives a reload', () => {
  const src = readFileSync('src/engine/store.js', 'utf8')
  const listed = src.match(/export const PROGRESS = \[([\s\S]*?)\]/)[1]
    .match(/'[^']+'/g).map((s) => s.slice(1, -1))
  // 값을 그대로 되살리기도 하고(restored?.x ?? {}) 손을 봐서 되살리기도 한다
  // (freshenAsks(scenario, restored?.x)). 어느 쪽이든 되살리는 것은 맞다.
  const restoredOnBoot = [...src.matchAll(/^ {2}(\w+): [^\n]*restored\?\./gm)].map((m) => m[1])

  it('saves every field the store restores on boot', () => {
    expect(restoredOnBoot.filter((f) => !listed.includes(f))).toEqual([])
  })

  it('restores every field it saves', () => {
    expect(listed.filter((f) => !restoredOnBoot.includes(f))).toEqual([])
  })

  it('carries the week: the day, the grants, and what was witnessed', () => {
    for (const k of ['day', 'grants', 'dreamt', 'drawn', 'overtime', 'digging', 'rumor']) {
      expect(listed, k).toContain(k)
    }
  })
})

// 세이브에 담기는 것은 그때 열려 있던 질문의 사본이다. 시나리오의 대사를
// 고쳐도 이미 열린 질문은 옛 사본 그대로라, 파일에는 새 말이 보이는데 대화는
// 옛 말을 한다 — 만드는 동안 플레이하면 이것이 버그처럼 보인다. 켤 때
// 시나리오의 같은 질문으로 갈아 끼운다.
describe('열려 있던 질문을 켤 때 새로 읽는다', () => {
  // 부름은 밤마다 나뉘어 온다. 물음이 있는 첫 밤을 쓴다.
  const first = scenario.summons.nights[2].ask

  it('옛 사본을 들고 있으면 시나리오 것으로 바꾼다', () => {
    const stale = { placeholder: first.placeholder, accept: first.accept, ok: ['옛날 말'] }
    const out = freshenAsks(scenario, { caller: stale })
    expect(out.caller.ok).toEqual(first.ok)
    expect(out.caller.ok).not.toContain('옛날 말')
  })

  it('이어지는 질문도 제 단계로 찾아간다', () => {
    const step2 = first.then
    const stale = { placeholder: step2.placeholder, accept: step2.accept, ok: ['옛날 말'] }
    expect(freshenAsks(scenario, { caller: stale }).caller.ok).toEqual(step2.ok)
  })

  it('시나리오에 없는 질문은 그대로 둔다', () => {
    // 한 대화에 질문이 둘 겹치면 그 자리에서 합쳐진 것이 저장된다.
    const merged = { placeholder: '합쳐진 질문', accept: ['x'], ok: ['그대로'] }
    expect(freshenAsks(scenario, { boss: merged }).boss).toBe(merged)
  })

  it('아무것도 안 열려 있으면 아무 일도 없다', () => {
    expect(freshenAsks(scenario, {})).toEqual({})
    expect(freshenAsks(scenario, undefined)).toEqual({})
  })
})

// 대사가 바뀌었을 때는 묻는 말과 정답으로 짝을 찾을 수 있었지만, 정답 자체가
// 바뀌면 그 방법으로는 짝을 잃는다 — 입사년을 옮기던 날 부름이 옛 정답을
// 계속 요구했다. 자리표로 찾으면 대사도 정답도 바뀐 질문을 알아본다.
describe('정답이 바뀐 질문도 켤 때 새로 읽는다', () => {
  // 부름은 밤마다 나뉘어 온다. 물음이 있는 첫 밤을 쓴다.
  const first = scenario.summons.nights[2].ask
  const step = first.then               // 이어지는 자리

  it('시나리오의 질문마다 자리표가 찍혀 있다', () => {
    freshenAsks(scenario, {})
    // 자리표는 세이브에 같이 실려야 다음에 켤 때 짚을 수 있다.
    expect(step.__at, '자리표가 없다').toBeTruthy()
    expect(JSON.parse(JSON.stringify(step)).__at).toBe(step.__at)
  })

  it('대사도 정답도 바뀐 사본을 알아본다', () => {
    const stale = { ...step, accept: ['옛날 정답'], ok: ['옛날 말'] }
    const out = freshenAsks(scenario, { caller: stale })
    expect(out.caller.accept).toEqual(step.accept)
    expect(out.caller.ok).toEqual(step.ok)
  })

  it('자리표가 없던 옛 세이브는 묻는 말과 정답으로 찾는다', () => {
    const old = { placeholder: step.placeholder, accept: step.accept, ok: ['옛날 말'] }
    expect(freshenAsks(scenario, { caller: old }).caller.ok).toEqual(step.ok)
  })

  it('시나리오에 없는 질문은 그대로 둔다', () => {
    const merged = { placeholder: '합쳐진 질문', accept: ['x'], ok: ['그대로'] }
    expect(freshenAsks(scenario, { boss: merged }).boss).toBe(merged)
  })
})

// 되짚기가 남의 대화 질문을 끌어다 꽂은 적이 있다. 대화가 끝나면 그 자리에
// null 이 남는데, 그 열쇠가 부름의 마지막 빈칸 질문(묻는 말도 정답도 없는
// 것)과 같아서 — 지현이가 부름의 마지막 대사를 말했다.
describe('되짚기가 남의 대화를 끌어오지 않는다', () => {
  it('끝난 대화 자리는 빈 채로 둔다', () => {
    const out = freshenAsks(scenario, { jihyun: null })
    expect(out.jihyun).toBe(null)
  })

  it('묻는 말이 같아도 다른 대화의 질문은 가져오지 않는다', () => {
    const caller = scenario.summons.nights[2].ask
    const stale = { placeholder: caller.placeholder, accept: caller.accept, ok: ['옛날 말'] }
    // 같은 열쇠라도 대화가 다르면 그대로 둔다.
    expect(freshenAsks(scenario, { jihyun: stale }).jihyun).toBe(stale)
    // 제 대화에서는 갈아 끼운다.
    expect(freshenAsks(scenario, { caller: stale }).caller.ok).toEqual(caller.ok)
  })
})
