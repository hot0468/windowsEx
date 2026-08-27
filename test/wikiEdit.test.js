import { beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { PROGRESS, useGame, wikiPage } from '../src/engine/store.js'

const edit = scenario.wikiEdit
const wikis = scenario.sites.filter((s) => s.layout === 'wiki')

const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const answers = [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))),
  ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => steps(a.ask))),
  ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask))
].filter((a) => a?.accept).flatMap((a) => a.accept.flat()).filter((a) => a.length > 2)

beforeEach(() => useGame.setState({ wikiEdits: {}, day: 1, grants: {} }))

describe('위키를 고치면 되돌아온다', () => {
  it('편집할 수 있는 문서에는 정답이 하나도 없다', () => {
    // 위키 대부분은 퍼즐의 정답지다. 편집 대상이 거기 끼면 공략이 깨진다.
    for (const key of edit.pages) {
      for (const site of wikis) {
        const page = site.wiki.pages[key]
        if (!page) continue
        const text = JSON.stringify(page)
        for (const a of new Set(answers)) {
          expect(text, `${key}에 정답 "${a}"이 있다`).not.toContain(a)
        }
      }
    }
  })

  it('정답이 든 문서는 편집 목록에 없다', () => {
    for (const site of wikis) {
      for (const [key, page] of Object.entries(site.wiki.pages)) {
        const text = JSON.stringify(page)
        const holds = [...new Set(answers)].some((a) => text.includes(a))
        if (holds) expect(edit.pages, `${key}는 정답을 갖고 있다`).not.toContain(key)
      }
    }
  })

  it('고치면 최종 수정자가 내 이름이 된다', () => {
    useGame.setState({ day: 2 })
    useGame.getState().editWiki('account', '계정 잠금은 5회부터입니다')
    const page = wikiPage(scenario, useGame.getState(), 'account')
    expect(page.author).toBe(edit.author)
    expect(page.notes.some((n) => n.includes('계정 잠금은 5회부터입니다'))).toBe(true)
  })

  it('다음 날이면 되돌아와 있다', () => {
    useGame.setState({ day: 2 })
    useGame.getState().editWiki('account', '내가 고친 줄')

    useGame.setState({ day: 3 })
    const page = wikiPage(scenario, useGame.getState(), 'account')
    // 원래 승인본으로 돌아가고, 되돌린 사람 이름이 남는다
    expect(page.author).toBe(edit.revertedBy)
    expect(page.notes.some((n) => n.includes('내가 고친 줄'))).toBe(false)
    expect(page.notes.some((n) => n.includes(edit.reverted))).toBe(true)
  })

  it('안 고친 문서는 그대로다', () => {
    const before = wikiPage(scenario, useGame.getState(), 'q3')
    const raw = wikis.map((s) => s.wiki.pages.q3).find(Boolean)
    expect(before.author).toBe(raw.author)
    expect(before.notes).toEqual(raw.notes)
  })

  it('세 번 고치면 찾아온다', () => {
    const g = () => useGame.getState()
    expect(edit.nagAfter).toBe(3)
    useGame.setState({ day: 2 })
    g().editWiki('account', 'ㄱ')
    g().editWiki('q3', 'ㄴ')
    expect(g().wikiEdits.nagged).toBeFalsy()
    g().editWiki('owner', 'ㄷ')
    expect(g().wikiEdits.nagged).toBe(true)
  })

  it('찾아와서 하는 말에 정답이 없다', () => {
    const said = JSON.stringify(edit.nag)
    for (const a of new Set(answers)) expect(said, a).not.toContain(a)
  })

  it('무엇을 고쳐도 아무것도 열리지 않는다', () => {
    for (const key of edit.pages) {
      useGame.setState({ wikiEdits: {}, grants: {}, day: 2 })
      useGame.getState().editWiki(key, '아무 말')
      expect(useGame.getState().grants, key).toEqual({})
    }
  })

  it('편집은 저장에 실린다', () => {
    expect(PROGRESS).toContain('wikiEdits')
  })
})

describe('세 번째 편집 뒤 차민혁', () => {
  it('실제로 말을 걸어온다', () => {
    vi.useFakeTimers()
    try {
      useGame.setState({ wikiEdits: {}, day: 3, extraMessages: {}, toast: null })
      const g = () => useGame.getState()
      g().editWiki('account', 'ㄱ')
      g().editWiki('q3', 'ㄴ')
      g().editWiki('owner', 'ㄷ')
      vi.runAllTimers()
      const nag = scenario.wikiEdit.nag
      expect(useGame.getState().extraMessages[nag.thread].map((m) => m.text)).toEqual(nag.lines)
    } finally {
      vi.useRealTimers()
    }
  })
})
