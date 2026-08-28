import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allThreads, drawFor, heldThreads, hostThreads, objectiveDone, requestsOf } from '../src/engine/store.js'

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

  // Day two draws most of its work from the pool, and the draw is where this
  // went wrong: one of the six it drew was the boss's, holding the thread the
  // morning speaks through, and the day opened with nobody saying anything.
  const drawnWeek = () => {
    const drawn = {}
    for (const n of [1, 2]) drawn[n] = drawFor(scenario, n, drawn)
    return drawn
  }
  const live = allThreads(scenario).find((t) => t.live).id

  it('never holds the conversation the day speaks through, whatever it drew', () => {
    for (let run = 0; run < 60; run++) {
      const drawn = drawnWeek()
      for (const day of [1, 2]) {
        const ids = requestsOf(scenario, day, {}, drawn, {}).map((o) => o.id)
        for (let n = 0; n <= ids.length; n++) {
          const state = { ...after(day, ids.slice(0, n)), drawn }
          expect(heldThreads(scenario, day, state).has(live), `day ${day} after ${n}`).toBe(false)
        }
      }
    }
  })

  it('opens the day with somebody actually saying something', () => {
    for (let run = 0; run < 60; run++) {
      const drawn = drawnWeek()
      for (const day of [1, 2]) {
        const held = heldThreads(scenario, day, { ...base, drawn })
        const speaking = allThreads(scenario).filter((t) => !held.has(t.id) && (
          t.live || (t.messages ?? []).some((m) => m.day === day)
        ))
        expect(speaking.map((t) => t.id), `day ${day}`).not.toEqual([])
      }
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

// The easing-in counts how many requests are done, but unlocks conversations by
// their position in the list. Finish them out of order — which the player is
// free to do, since every request for the day is on screen at once — and the
// count falls behind the position, leaving later conversations shut for good.
describe('finishing the first day out of order', () => {
  const speaks = (day, state) => {
    const held = heldThreads(scenario, day, state)
    return allThreads(scenario)
      .filter((t) => (t.messages ?? []).some((m) => m.day === day))
      .filter((t) => !held.has(t.id)).map((t) => t.id)
  }

  // What the player actually hit: the wiki left for later, everything after it
  // answered, and 지현 and 이준호 sitting there with nothing to say — their
  // requests on the list and no way to raise them.
  it('opens 지현 and 이준호 with only the wiki left', () => {
    const held = heldThreads(scenario, 1, after(1, ['ip', 'reply', 'wifi', 'leave', 'address']))
    expect(held.has('jihyun')).toBe(false)
    expect(held.has('junho')).toBe(false)
  })

  it('opens the next conversation even when an earlier request is skipped', () => {
    const ids = dayRequests(1).map((o) => o.id)
    // everything except the second request, the way a player who went hunting
    // through the wiki last would have it
    const skipped = ids.filter((id) => id !== ids[1])
    const state = after(1, skipped)
    // the ones whose requests are already answered may stay quiet; the one
    // holding the unanswered request may not
    for (const id of skipped) {
      const o = dayRequests(1).find((x) => x.id === id)
      expect(objectiveDone(o, state), id).toBe(true)
    }
    expect(speaks(1, state).length, 'every remaining conversation is shut').toBeGreaterThan(0)
  })

  // The one that matters: whichever request is still open, the conversation
  // that raises it has to be able to speak. Otherwise the player is looking at
  // a list they have no way to finish.
  it('always leaves the unanswered request reachable', () => {
    const host = hostThreads(scenario)
    for (const day of [1, scenario.tutorialDays]) {
      const ids = dayRequests(day).map((o) => o.id)
      for (let skip = 0; skip < ids.length; skip++) {
        const held = heldThreads(scenario, day, after(day, ids.filter((_, i) => i !== skip)))
        const open = ids[skip]
        expect(held.has(host[open]), `day ${day}: ${open} left unreachable`).toBe(false)
      }
    }
  })
})

// 위 검사는 하나만 남기고 전부 끝낸 상태를 본다 — 그 자리에서는 진행도가 이미
// 끝까지 가 있어 아무 대화도 닫히지 않으므로, 순서 때문에 생기는 잠김은 잡히지
// 않는다. 실제로 멈추는 자리는 하루의 중간이다: 2일차는 풀에서 더 뽑아 10건이
// 되고, 그러면 한 대화가 요청을 둘 이상 맡는다 — 정보보안팀이 VPN 세션 ID와
// 복합기 등록 IP를 함께 묻는 식이다. 뒤엣것의 차례로 대화를 닫아 버리면 이미
// 차례가 온 앞엣것까지 잠겨 하루가 거기서 멈춘다.
describe('a conversation that carries two of the day\u2019s requests', () => {
  const seeded = (seed) => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const day = scenario.tutorialDays

  it('opens on the earliest of them, not the last', () => {
    const host = hostThreads(scenario)
    let sawDouble = false
    for (let seed = 1; seed <= 40; seed++) {
      const drawn = { [day]: drawFor(scenario, day, {}, seeded(seed)) }
      const list = requestsOf(scenario, day, {}, drawn, {})
      const hosts = list.map((o) => host[o.id]).filter(Boolean)
      if (new Set(hosts).size < hosts.length) sawDouble = true
      // 하루를 순서대로 걸어 내려간다. 앞의 k건을 끝냈으면 그다음 것을 꺼낼
      // 대화가 열려 있어야 한다 — 하루가 멈추는 자리는 여기다.
      const state = { ...base, grants: {}, unlocked: {}, drawn }
      for (const next of list) {
        const held = heldThreads(scenario, day, state)
        expect(held.has(host[next.id]),
          `seed ${seed}: ${next.id} unreachable after ${Object.keys(state.grants).length} done`).toBe(false)
        if (next.site) state.unlocked[next.site] = true
        else state.grants[next.grant] = true
      }
    }
    // 검사가 실제로 그 조합을 밟았는지 — 안 밟았으면 위 단언은 빈 검사다.
    expect(sawDouble, 'no draw ever gave one thread two requests').toBe(true)
  })
})
