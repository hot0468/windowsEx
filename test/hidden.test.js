import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { useGame, visible } from '../src/engine/store.js'

const walk = (node) => (Array.isArray(node)
  ? node.flatMap((e) => (e.children ? [e, ...walk(e.children)] : [e]))
  : Object.values(node).flatMap(walk))
const hidden = walk(scenario.fs).filter((e) => e.hidden)

const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const asks = [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))),
  ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask))
].filter((a) => a?.accept)
const answers = asks.flatMap((a) => a.accept.flat()).filter((a) => a.length > 2)

describe('hidden items', () => {
  it('keeps them out of a listing until asked for', () => {
    const entries = [{ name: 'a' }, { name: 'b', hidden: true }]
    expect(visible(entries, false).map((e) => e.name)).toEqual(['a'])
    expect(visible(entries, true).map((e) => e.name)).toEqual(['a', 'b'])
  })

  it('leaves a listing with nothing hidden alone', () => {
    const entries = [{ name: 'a' }, { name: 'b' }]
    expect(visible(entries, false)).toHaveLength(2)
  })

  it('has something to find behind the switch', () => {
    expect(hidden.length).toBeGreaterThan(2)
    for (const f of hidden) expect(f.name.length).toBeGreaterThan(0)
  })

  it('hides everything inside a hidden folder too', () => {
    // search walks the tree and only looks at each file's own flag, so a plain
    // file inside a hidden folder would still surface with the switch off
    const inside = (node) => (node.children ?? []).flatMap(
      (e) => [e, ...(e.children ? inside(e) : [])])
    for (const folder of walk(scenario.fs).filter((e) => e.hidden && e.children)) {
      for (const child of inside(folder)) {
        expect(child.hidden, folder.name + ' > ' + child.name).toBe(true)
      }
    }
  })

  it('never hides an answer a request needs, unless the request says where the switch is', () => {
    // the switch is off by default, so anything behind it is a soft-lock —
    // except when the last hint tells the player to turn it on
    const behind = JSON.stringify(hidden)
    let puzzles = 0
    for (const ask of asks) {
      for (const answer of ask.accept.flat()) {
        if (answer.length <= 2 || !behind.includes(answer)) continue
        puzzles++
        expect([ask.no.at(-1)].flat().join(' '), answer).toContain('숨긴 항목')
      }
    }
    expect(puzzles).toBeGreaterThan(0)
    expect(answers.length).toBeGreaterThan(100)
  })

  it('saves the switch with the rest of the game', () => {
    expect(useGame.getState().showHidden).toBe(false)
    useGame.getState().toggleHidden()
    expect(useGame.getState().showHidden).toBe(true)
    useGame.getState().toggleHidden()
  })
})
