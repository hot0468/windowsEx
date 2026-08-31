import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { bookFits, fmtRange, overlaps, parseRange, roomClash, roomKey, useGame } from '../src/engine/store.js'

// 회의실 예약. 팀장이 내일 3시 대회의실을 부탁하는데 그 시간은 영업2팀이 잡고
// 있다. 당사자와 톡으로 딜을 해서 양보받거나, 팀장이 허락한 2시로 잡는다.
// 여기서 깨지는 방식: 겹침을 못 잡거나, 양보받았는데도 막히거나, 엉뚱한
// 예약에 요청이 닫히거나, 딜 선택지가 아무에게나(또는 아무에게도) 열리는 것.

const scenario = JSON.parse(
  readFileSync(new URL('../src/scenarios/workday.json', import.meta.url), 'utf8'))
const steps = (a) => (a ? [a, ...steps(a.then)] : [])
const portal = scenario.sites.find((s) => s.layout === 'portal').portal
const rows = portal.rooms
const objective = scenario.objectives.find((o) => o.id === 'book_room')
const spec = objective.book
const soy = scenario.workMessenger.sections.flatMap((x) => x.threads).find((t) => t.id === 'soyoung')

describe('시간 겹침', () => {
  it('현황표의 한 줄을 분으로 읽는다', () => {
    expect(parseRange('15:00 ~ 16:00')).toEqual([900, 960])
    expect(fmtRange('14:30', 90)).toBe('14:30 ~ 16:00')
  })

  it('맞닿은 시간은 겹치지 않는다', () => {
    expect(overlaps([900, 960], [960, 1020])).toBe(false)
    expect(overlaps([900, 960], [930, 990])).toBe(true)
    expect(overlaps([900, 960], [840, 900])).toBe(false)
  })

  it('같은 방 같은 날에만 겹친다', () => {
    const want = { room: '대회의실', date: spec.date, start: '15:00', minutes: 60 }
    expect(roomClash(rows, {}, want)?.who).toContain('한소영')
    expect(roomClash(rows, {}, { ...want, room: '회의실2' })).toBe(null)
    expect(roomClash(rows, {}, { ...want, date: scenario.days[1].date })).toBe(null)
    expect(roomClash(rows, {}, { ...want, start: '14:00' })).toBe(null)
  })

  it('양보받은 줄은 비운 것으로 본다', () => {
    const want = { room: '대회의실', date: spec.date, start: '15:00', minutes: 60 }
    expect(roomClash(rows, {}, want, { room_yield: true })).toBe(null)
  })

  it('내 예약끼리도 겹친다', () => {
    const mine = { [roomKey({ room: '회의실1', date: 'd', start: '10:00' })]: { room: '회의실1', date: 'd', start: '10:00', minutes: 60 } }
    expect(roomClash([], mine, { room: '회의실1', date: 'd', start: '10:30', minutes: 30 })).toBeTruthy()
    expect(roomClash([], mine, { room: '회의실1', date: 'd', start: '11:00', minutes: 30 })).toBe(null)
  })
})

describe('부탁받은 그 예약', () => {
  it('3시도 2시도 되고, 다른 방·다른 날·짧은 시간은 안 된다', () => {
    const base = { room: '대회의실', date: spec.date, minutes: 60 }
    expect(bookFits(spec, { ...base, start: '15:00' })).toBe(true)
    expect(bookFits(spec, { ...base, start: '14:00' })).toBe(true)
    expect(bookFits(spec, { ...base, start: '16:00' })).toBe(false)
    expect(bookFits(spec, { ...base, start: '15:00', room: '회의실2' })).toBe(false)
    expect(bookFits(spec, { ...base, start: '15:00', minutes: 30 })).toBe(false)
    expect(bookFits(spec, { ...base, start: '15:00', date: scenario.days[1].date })).toBe(false)
  })

  // 그날 현황에 3시는 막혀 있고 2시는 비어 있어야 한다 — 딜 없이도 풀리는 길.
  it('부탁의 날에 한 시각은 막혀 있고 한 시각은 비어 있다', () => {
    const clashes = spec.starts.map((start) => roomClash(rows, {}, { room: spec.room, date: spec.date, start, minutes: spec.minutes }))
    expect(clashes.some(Boolean)).toBe(true)
    expect(clashes.some((c) => !c)).toBe(true)
    // 막힌 쪽은 양보를 구할 수 있는 줄이다
    expect(clashes.find(Boolean).yieldOn).toBe('room_yield')
  })

  it('요청 목록과 그날에 올라 있다', () => {
    const beat = scenario.days[1].asks.find((a) => steps(a.ask).some((x) => x.deed === 'book_room'))
    expect(beat).toBeTruthy()
    expect(steps(beat.ask).pop().grants).toBe('book_room')
    expect(scenario.days[1].requests).toContain('book_room')
    expect(scenario.pool.fixed['2']).toContain('book_room')
    // 부탁의 날짜는 부탁한 다음 날이다
    expect(spec.date).toBe(scenario.days[2].date)
  })
})

describe('당사자와의 딜', () => {
  const deal = soy.quick.find((c) => soy.gate?.[c])

  it('겹친 것을 본 사람에게만 말이 열린다', () => {
    expect(deal).toBeTruthy()
    expect(soy.gate[deal]).toBe('room_clash')
  })

  it('어느 길로 가든 양보에 닿고, 대화는 끝난다', () => {
    const byChoice = Object.fromEntries(soy.reactions.map((r) => [r.choice, r]))
    const seen = new Set()
    const walk = (choice, depth = 0) => {
      expect(depth).toBeLessThan(8)
      const r = byChoice[choice]
      expect(r, choice).toBeTruthy()
      seen.add(choice)
      if (r.grants === 'room_yield') return true
      return (r.next ?? []).some((n) => walk(n, depth + 1))
    }
    // 첫 갈림의 두 길 모두 결국 양보에 닿는다
    const first = byChoice[deal]
    for (const n of first.next) expect(walk(n), n).toBe(true)
    // 양보 뒤의 말은 끝난다
    const yields = soy.reactions.filter((r) => r.grants === 'room_yield')
    for (const y of yields) for (const n of y.next) expect(byChoice[n].next).toEqual([])
  })

  it('무례한 길은 한 번 거절당한다', () => {
    const first = soy.reactions.find((r) => r.choice === deal)
    const refused = first.next.map((n) => soy.reactions.find((r) => r.choice === n)).find((r) => !r.grants)
    expect(refused).toBeTruthy()
    expect(refused.next.length).toBeGreaterThan(0)
  })
})

describe('예약 액션', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ grants: {}, bookings: {}, pendingAsks: {}, extraMessages: {}, windows: [], day: 2, chatted: {} })
  })
  afterEach(() => vi.useRealTimers())
  const want = { room: '대회의실', date: spec.date, start: '15:00', minutes: 60, note: '' }

  it('겹치면 예약되지 않고, 겹친 것을 봤다는 사실만 남는다', () => {
    const r = useGame.getState().bookRoom(want)
    expect(r.clash?.who).toContain('한소영')
    expect(Object.keys(useGame.getState().bookings)).toEqual([])
    expect(useGame.getState().grants.room_clash).toBe(true)
    expect(useGame.getState().grants.book_room).toBeUndefined()
  })

  it('양보받은 뒤에는 그 시간이 잡히고 요청이 닫힌다', () => {
    useGame.setState({ grants: { room_yield: true } })
    const r = useGame.getState().bookRoom(want)
    expect(r.ok).toBe(true)
    expect(useGame.getState().grants.book_room).toBe(true)
  })

  it('2시로 잡아도 요청이 닫힌다', () => {
    const r = useGame.getState().bookRoom({ ...want, start: '14:00' })
    expect(r.ok).toBe(true)
    expect(useGame.getState().grants.book_room).toBe(true)
  })

  it('엉뚱한 예약은 되긴 하지만 요청은 그대로다', () => {
    const r = useGame.getState().bookRoom({ ...want, room: '회의실2' })
    expect(r.ok).toBe(true)
    expect(useGame.getState().grants.book_room).toBeUndefined()
    // 취소하면 자리가 비고, 요청은 여전히 그대로
    const [key] = Object.keys(useGame.getState().bookings)
    useGame.getState().cancelRoom(key)
    expect(useGame.getState().bookings).toEqual({})
  })

  it('행동 질문이 열려 있으면 예약하는 순간 답이 온다', () => {
    const beat = scenario.days[1].asks.find((a) => steps(a.ask).some((x) => x.deed === 'book_room'))
    useGame.getState().setAsk('boss', beat.ask)
    useGame.getState().bookRoom({ ...want, start: '14:00' })
    vi.runAllTimers()
    expect(useGame.getState().pendingAsks.boss).toBe(null)
    const said = (useGame.getState().extraMessages.boss ?? []).map((m) => m.text)
    expect(said).toContain(beat.ask.ok[0])
  })
})
