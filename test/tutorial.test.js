import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allThreads, heldThreads, objectiveDone, requestsOf } from '../src/engine/store.js'

const base = { grants: {}, unlocked: {}, overtime: {}, drawn: {}, ripples: {} }
const dayRequests = (day) => requestsOf(scenario, day, {}, {}, {})
// An objective is met by the state it names: a grant for most, an unlocked site
// for the wiki. Stamping the id in both places left the wiki forever unfinished,
// so the day never reached its last step.
const after = (day, ids) => {
  const state = { ...base, grants: {}, unlocked: {} }
  for (const o of dayRequests(day)) {
    if (!ids.includes(o.id)) continue
    if (o.site) state.unlocked[o.site] = true
    else state.grants[o.grant] = true
  }
  return state
}

describe('the days that ease the player in', () => {
  it('eases in the first two days and no others', () => {
    expect(scenario.tutorialDays).toBe(2)
    expect(heldThreads(scenario, scenario.tutorialDays + 1, base)).toBeNull()
  })

  // The whole point: the morning is one conversation, not eight.
  it('starts the first day with only the first request open', () => {
    const held = heldThreads(scenario, 1, base)
    const speaking = allThreads(scenario)
      .filter((t) => (t.messages ?? []).some((m) => m.day === 1) && !held.has(t.id))
      .map((t) => t.id)
    expect(speaking.length).toBeLessThan(3)
    expect(speaking).toContain(allThreads(scenario).find((t) => t.live).id)
  })

  // A thread held past the end of the day is a softlock: its request can never
  // be answered, so the day can never be finished.
  it('opens every conversation by the time the day is done', () => {
    for (const day of [1, 2]) {
      const ids = dayRequests(day).map((o) => o.id)
      expect(heldThreads(scenario, day, after(day, ids)).size, `day ${day}`).toBe(0)
    }
  })

  it('opens one more conversation with every request finished', () => {
    for (const day of [1, 2]) {
      const ids = dayRequests(day).map((o) => o.id)
      let last = heldThreads(scenario, day, base).size
      for (let n = 1; n <= ids.length; n++) {
        const now = heldThreads(scenario, day, after(day, ids.slice(0, n))).size
        expect(now, `day ${day} after ${n}`).toBeLessThanOrEqual(last)
        last = now
      }
    }
  })

  // The gate may only stage what the day itself lines up. A bank alert or a
  // verification code is not part of the queue and must always get through.
  it('never holds a conversation the day does not line up', () => {
    for (const day of [1, 2]) {
      const staged = new Set(dayRequests(day).map((o) => o.id))
      for (const id of heldThreads(scenario, day, base)) {
        const t = allThreads(scenario).find((x) => x.id === id)
        expect((t.messages ?? []).some((m) => m.day === day) || staged.size > 0, id).toBe(true)
        expect(t.live, id).toBeFalsy()
      }
    }
  })

  it('holds nothing back once a request is done that was never gated', () => {
    // objectiveDone is what the gate counts with; keep them reading the same state
    const [first] = dayRequests(1)
    expect(objectiveDone(first, after(1, [first.id]))).toBe(true)
  })
})
