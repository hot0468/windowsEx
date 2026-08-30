import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { fileFits, hintAfter, lineSets } from '../src/engine/store.js'

const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const asks = threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).filter(Boolean)

describe('lineSets', () => {
  it('wraps a single set so both data shapes read the same', () => {
    expect(lineSets(['a', 'b'])).toEqual([['a', 'b']])
    expect(lineSets([['a'], ['b']])).toEqual([['a'], ['b']])
  })
})

describe('hintAfter', () => {
  const ask = { no: [['first'], ['second'], ['last']] }

  it('starts with the gentlest nudge', () => {
    expect(hintAfter(ask, 0)).toEqual(['first'])
  })

  it('gets firmer with each wrong answer', () => {
    expect(hintAfter(ask, 1)).toEqual(['second'])
    expect(hintAfter(ask, 2)).toEqual(['last'])
  })

  it('stays on the clearest hint rather than running out', () => {
    expect(hintAfter(ask, 9)).toEqual(['last'])
  })

  it('repeats the only hint when a question has just one', () => {
    expect(hintAfter({ no: ['only'] }, 4)).toEqual(['only'])
  })
})

describe('every question guides the player', () => {
  it('answers a wrong guess and ends up pointing at the source', () => {
    expect(asks.length).toBeGreaterThan(0)
    for (const ask of asks) {
      const sets = lineSets(ask.no)
      expect(sets.length).toBeGreaterThan(0)
      for (const set of sets) expect(set.length).toBeGreaterThan(0)
      // the last hint should be concrete: it names where to look
      expect(hintAfter(ask, 99).join(' ').length).toBeGreaterThan(10)
    }
  })

  // 폰에서 갈 곳을 따로 적어 둔 요청(noPhone)은 PC 쪽과 같은 규칙을 지켜야
  // 한다 — 단계가 있고, 마지막이 자리를 지목하고, 답을 흘리지 않는다.
  it('폰용 힌트도 같은 규칙을 지킨다', () => {
    const withPhone = asks.filter((a) => a.noPhone)
    expect(withPhone.length).toBeGreaterThan(0)
    for (const ask of withPhone) {
      const sets = lineSets(ask.noPhone)
      expect(sets.length).toBe(lineSets(ask.no).length)
      for (const set of sets) expect(set.length).toBeGreaterThan(0)
      const all = sets.flat().join(' ')
      expect(all.length).toBeGreaterThan(10)
      // 폰에 없는 앱을 가리키면 그 요청은 폰에서 막다른 길이 된다
      expect(all).not.toMatch(/명령 프롬프트|ipconfig/)
      for (const answer of ask.accept ?? []) {
        for (const one of [answer].flat()) expect(all).not.toContain(one)
      }
    }
  })
})

describe('fileFits', () => {
  it('accepts any of the files a question names, and nothing for a typed question', () => {
    expect(fileFits({ files: ['a', 'b'] }, 'b')).toBe(true)
    expect(fileFits({ files: ['a', 'b'] }, 'c')).toBe(false)
    expect(fileFits({ accept: ['x'] }, 'a')).toBe(false)
    expect(fileFits(null, 'a')).toBe(false)
  })
})
