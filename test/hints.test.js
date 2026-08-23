import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { hintAfter, lineSets } from '../src/engine/store.js'

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
})
