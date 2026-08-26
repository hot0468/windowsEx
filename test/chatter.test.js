import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { CHATTER_A_DAY, chatterFor, useGame } from '../src/engine/store.js'

const chatter = scenario.chatter
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const answers = [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))),
  ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => steps(a.ask))),
  ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask)),
  // the caller's questions are questions too
  ...steps(scenario.summons?.beat?.ask)
].filter((a) => a?.accept).flatMap((a) => a.accept.flat()).filter((a) => a.length > 2)

describe('small talk', () => {
  it('has enough of it, each piece in a real conversation, asking nothing', () => {
    expect(chatter.length).toBeGreaterThanOrEqual(20)
    expect(new Set(chatter.map((c) => c.id)).size).toBe(chatter.length)
    for (const c of chatter) {
      expect(threads.some((t) => t.id === c.beat.thread), c.id).toBe(true)
      expect(['workMessenger', 'privateMessenger']).toContain(c.beat.source)
      expect(c.beat.from, c.id).toBeTruthy()
      expect(c.beat.lines.length, c.id).toBeGreaterThan(0)
      expect(c.beat.ask, c.id).toBeUndefined()
      for (const d of c.days ?? []) expect(d).toBeGreaterThanOrEqual(2)
      if (c.after) expect(scenario.objectives.some((o) => o.id === c.after), c.id + ' waits on ' + c.after).toBe(true)
    }
  })

  it('reacts to what the player did, and drops hints, without ever saying an answer', () => {
    expect(chatter.filter((c) => c.after).length).toBeGreaterThanOrEqual(6)
    const said = JSON.stringify(chatter)
    for (const a of new Set(answers)) expect(said, a).not.toContain(a)
    expect(said).not.toMatch(/ㅋㅋ/)
  })

  it('brings the reaction waiting on a deed, and idle talk every other deed until the day is full', () => {
    const reaction = chatter.find((c) => c.after)
    const state = { day: 2, grants: {}, chatted: {} }
    expect(chatterFor(scenario, reaction.after, state)).toBe(reaction)
    // once said, never again
    expect(chatterFor(scenario, reaction.after, { ...state, chatted: { [reaction.id]: 2 } })).not.toBe(reaction)
    // idle talk comes on even-numbered deeds only
    expect(chatterFor(scenario, 'x', { ...state, grants: { x: true } })).toBeNull()
    const idle = chatterFor(scenario, 'x', { ...state, grants: { x: true, y: true } }, () => 0)
    expect(idle).toBeTruthy()
    expect(idle.after).toBeUndefined()
    // and stops for the day once the quota is spent
    const full = Object.fromEntries(chatter.slice(0, CHATTER_A_DAY).map((c) => [c.id, 2]))
    expect(chatterFor(scenario, 'x', { ...state, grants: { x: true, y: true }, chatted: full })).toBeNull()
  })

  it('lands in the messenger after a grant and is remembered', () => {
    vi.useFakeTimers()
    const reaction = chatter.find((c) => c.after)
    useGame.setState({ day: 2, grants: {}, chatted: {}, extraMessages: {}, toast: null })
    useGame.getState().grant(reaction.after)
    vi.runAllTimers()
    const s = useGame.getState()
    expect(s.chatted[reaction.id]).toBe(2)
    expect(s.extraMessages[reaction.beat.thread].map((m) => m.text)).toEqual(reaction.beat.lines)
    vi.useRealTimers()
  })
})
