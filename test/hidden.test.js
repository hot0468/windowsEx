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
const answers = [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))),
  ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask))
].filter((a) => a?.accept).flatMap((a) => a.accept.flat()).filter((a) => a.length > 2)

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

  it('never hides an answer a request needs', () => {
    // the switch is off by default, so anything behind it is a soft-lock
    const behind = JSON.stringify(hidden)
    for (const answer of new Set(answers)) expect(behind).not.toContain(answer)
  })

  it('saves the switch with the rest of the game', () => {
    expect(useGame.getState().showHidden).toBe(false)
    useGame.getState().toggleHidden()
    expect(useGame.getState().showHidden).toBe(true)
    useGame.getState().toggleHidden()
  })
})
