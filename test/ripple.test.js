import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { hintAfter, requestsOf, rippleHolds, ripplesFor, useGame } from '../src/engine/store.js'

const ripple = (id) => scenario.ripples.find((r) => r.id === id)
const base = { overtime: {}, locks: 3, slips: 0, mining: false, cleaned: false, roomQuestions: 0, ripples: {} }

describe('what yesterday leaves behind', () => {
  it('keys only off deeds the game can actually reach', () => {
    // A consequence that watches a grant nothing ever awards is dead code, and
    // hand-built test state would never catch it.
    const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
    const threads = [scenario.workMessenger, scenario.privateMessenger]
      .flatMap((m) => m.sections.flatMap((s) => s.threads))
    const granted = new Set([
      ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)])
        .flatMap(steps).map((a) => a.grants),
      ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))).map((a) => a.grants),
      ...scenario.days.map((d) => d.goal?.grants),
      ...Object.values(scenario.overtime.days)
        .flatMap((d) => d.asks.flatMap((a) => steps(a.ask))).map((a) => a.grants),
      ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask)).map((a) => a.grants),
      ...threads.flatMap((t) => (t.reactions ?? []).map((r) => r.grants)),
      // 게시판 글에 남긴 답도 하나의 deed다 — 나눔을 받겠다고 자리를 밝히는 일
      ...scenario.sites.flatMap((s) => s.board?.posts ?? [])
        .flatMap((p) => p.picks ?? []).map((p) => p.grant),
      ...scenario.sites.flatMap((s) => s.printerweb?.queue ?? []).map((q) => q.grants),
      'cleanpc',   // the antivirus awards this one by cleaning the machine
      'router_broke', 'router_secured'   // the router's admin page awards these
    ].filter(Boolean))

    for (const r of scenario.ripples) {
      for (const key of [r.when.grant, r.when.notGrant, r.effect?.extraRequest]) {
        if (key) expect(granted.has(key), `${r.id} watches ${key}, which nothing grants`).toBe(true)
      }
    }
  })

  it('gives every consequence a condition and something to say', () => {
    expect(scenario.ripples.length).toBeGreaterThan(4)
    const ids = scenario.ripples.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of scenario.ripples) {
      expect(Object.keys(r.when).length).toBeGreaterThan(0)
      expect(r.beat.lines.length).toBeGreaterThan(1)
      expect(r.beat.thread && r.beat.from && r.beat.source).toBeTruthy()
      // it speaks through someone the player actually knows
      const threads = [scenario.workMessenger, scenario.privateMessenger]
        .flatMap((m) => m.sections.flatMap((s) => s.threads))
      expect(threads.some((t) => t.id === r.beat.thread), r.id).toBe(true)
      // a consequence never asks a question, so it can never be a dead end
      expect(r.beat.ask).toBeUndefined()
      // buttons are fine, as long as the thread knows how to answer each one
      for (const c of r.beat.choices ?? []) {
        expect(threads.find((t) => t.id === r.beat.thread).reactions.some((x) => x.choice === c), `${r.id}: ${c}`).toBe(true)
      }
    }
  })

  it('never lands on the first morning', () => {
    for (const r of scenario.ripples) {
      expect(rippleHolds(r.when, 1, { ...base, overtime: { 1: true }, locks: 0, slips: 99, mining: true, roomQuestions: 99 }), r.id).toBe(false)
    }
  })

  it('follows a late night with a lighter morning', () => {
    const when = ripple('tired').when
    expect(rippleHolds(when, 3, { ...base, overtime: { 2: true } })).toBe(true)
    expect(rippleHolds(when, 3, { ...base, overtime: { 1: true } })).toBe(false)
    expect(ripple('tired').effect.hintMercy).toBe(true)
  })

  it('notices three nights in a row, and a friend says so', () => {
    const when = ripple('grinding').when
    expect(rippleHolds(when, 5, { ...base, overtime: { 2: true, 3: true, 4: true } })).toBe(true)
    expect(rippleHolds(when, 5, { ...base, overtime: { 2: true, 4: true } })).toBe(false)
    expect(ripple('grinding').beat.thread).toBe('jihyun')
  })

  it('chases an unclean machine, and stops once it is clean', () => {
    const when = ripple('mining_left').when
    expect(rippleHolds(when, 3, { ...base, mining: true })).toBe(true)
    expect(rippleHolds(when, 3, { ...base, mining: false })).toBe(false)
    expect(rippleHolds(when, 3, { ...base, mining: true, cleaned: true })).toBe(false)
  })

  it('reads a week of wrong answers, and a week without them', () => {
    expect(rippleHolds(ripple('sloppy').when, 4, { ...base, slips: 12 })).toBe(true)
    expect(rippleHolds(ripple('sloppy').when, 4, { ...base, slips: 11 })).toBe(false)
    expect(rippleHolds(ripple('clean_week').when, 4, { ...base, slips: 2 })).toBe(true)
    expect(rippleHolds(ripple('clean_week').when, 4, { ...base, slips: 3 })).toBe(false)
    expect(rippleHolds(ripple('clean_week').when, 3, { ...base, slips: 0 })).toBe(false)  // not before day 4
  })

  it('notices the player has been asking around', () => {
    const when = ripple('asked_around').when
    expect(rippleHolds(when, 3, { ...base, roomQuestions: 5 })).toBe(true)
    expect(rippleHolds(when, 3, { ...base, roomQuestions: 4 })).toBe(false)
  })

  it('lands each consequence once, however long it stays true', () => {
    const state = { ...base, overtime: { 2: true } }
    const landing = ripplesFor(scenario, 3, state)
    expect(landing.map((r) => r.id)).toContain('tired')
    const after = { ...state, ripples: Object.fromEntries(landing.map((r) => [r.id, 3])) }
    expect(ripplesFor(scenario, 3, after).map((r) => r.id)).not.toContain('tired')
  })
})

describe('a consequence that costs you something', () => {
  it('puts the cleanup on the day it nags about', () => {
    const forced = requestsOf(scenario, 3, {}, {}, { mining_left: 3 }).map((o) => o.id)
    expect(forced).toContain('cleanpc')
    expect(requestsOf(scenario, 3, {}, {}, {}).map((o) => o.id)).not.toContain('cleanpc')
    // and it does not double up if the day already had it
    const twice = requestsOf(scenario, 3, {}, { 3: ['cleanpc'] }, { mining_left: 3 }).map((o) => o.id)
    expect(twice.filter((id) => id === 'cleanpc')).toHaveLength(1)
  })

  it('forgives one wrong answer on a forgiven morning', () => {
    const ask = { no: [['first'], ['second'], ['last']] }
    expect(hintAfter(ask, 0)).toEqual(['first'])
    expect(hintAfter(ask, 0, true)).toEqual(['second'])
    expect(hintAfter(ask, 9, true)).toEqual(['last'])
  })
})

describe('the morning it all arrives', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({
      day: 1, drawn: {}, ripples: {}, mercy: false, overtime: {}, locks: 3, slips: 0,
      mining: false, cleaned: false, roomQuestions: 0, extraMessages: {}, pendingAsks: {}, extraMails: [], grants: {}
    })
  })
  afterEach(() => vi.useRealTimers())

  it('speaks yesterday\'s consequence before today\'s work', () => {
    useGame.setState({ overtime: { 1: true } })
    useGame.getState().startDay(2)
    vi.runAllTimers()
    const said = useGame.getState().extraMessages.boss ?? []
    expect(said.map((m) => m.text)).toEqual(expect.arrayContaining(ripple('tired').beat.lines))
    expect(useGame.getState().mercy).toBe(true)
    expect(useGame.getState().ripples.tired).toBe(2)
  })

  it('leaves a quiet week quiet', () => {
    useGame.setState({ locks: 3 })
    useGame.getState().startDay(2)
    expect(useGame.getState().mercy).toBe(false)
  })

  it('counts every question the room is asked', () => {
    useGame.getState().askedRoom()
    useGame.getState().askedRoom()
    expect(useGame.getState().roomQuestions).toBe(2)
  })
})

describe('the four that cost you', () => {
  it('escalates a machine left mining two days running', () => {
    const when = ripple('mining_two_days').when
    expect(rippleHolds(when, 4, { ...base, mining: true, minedSince: 2 })).toBe(true)
    expect(rippleHolds(when, 3, { ...base, mining: true, minedSince: 2 })).toBe(false)
    expect(rippleHolds(when, 4, { ...base, mining: false, minedSince: 2 })).toBe(false)
    expect(ripple('mining_two_days').effect.slipPenalty).toBeGreaterThan(0)
  })

  it('waits two days before the unreported forgery does its damage', () => {
    const when = ripple('forgery_unreported').when
    const seen = { ...base, grants: { c_forgery_seen: true }, ripples: { _c_forgery_seen: 2 } }
    expect(rippleHolds(when, 4, seen)).toBe(true)
    expect(rippleHolds(when, 3, seen)).toBe(false)
    // reporting it in time calls the whole thing off
    expect(rippleHolds(when, 4, { ...seen, grants: { ...seen.grants, c_forgery: true } })).toBe(false)
  })

  it('has a friend waiting at a table nobody cancelled', () => {
    const when = ripple('ghost_booking').when
    expect(rippleHolds(when, 3, { ...base, bookedFor: 2, overtime: { 2: true } })).toBe(true)
    expect(rippleHolds(when, 3, { ...base, bookedFor: 2 })).toBe(false)           // you actually went
    expect(rippleHolds(when, 3, { ...base, overtime: { 2: true } })).toBe(false)  // no table booked
  })

  it('charges the cost to the record the player never sees', () => {
    useGame.setState({
      day: 3, drawn: {}, ripples: { _c_forgery_seen: 2 }, slips: 0,
      grants: { c_forgery_seen: true },
      overtime: {}, locks: 3, mining: false, cleaned: false, roomQuestions: 0,
      extraMessages: {}, pendingAsks: {}, extraMails: []
    })
    useGame.getState().startDay(4)
    expect(useGame.getState().slips).toBe(ripple('forgery_unreported').effect.slipPenalty)
  })

  it('stamps the day a watched deed happened, once', () => {
    useGame.setState({ day: 2, ripples: {}, grants: {} })
    useGame.getState().grant('c_forgery_seen')
    expect(useGame.getState().ripples._c_forgery_seen).toBe(2)
    useGame.setState({ day: 5 })
    useGame.getState().grant('c_forgery_seen')
    expect(useGame.getState().ripples._c_forgery_seen).toBe(2)
  })

  it('remembers a booking as belonging to the day it was made', () => {
    useGame.setState({ day: 2, bookings: {}, bookedFor: null })
    useGame.getState().book('어딘가', { time: '19:00' })
    expect(useGame.getState().bookedFor).toBe(2)
  })
})
