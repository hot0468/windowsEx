import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { dayDone, endingFor, overtimeOffer, requestsOf, useGame, workedEveryNight } from '../src/engine/store.js'
import { grantsRaised, playDay } from './playDay.js'

const days = scenario.days.length
const every = Object.fromEntries(Array.from({ length: days }, (_, i) => [i + 1, true]))

describe('the offer to stay late', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ day: 1, overtime: {}, grants: {}, unlocked: {}, extraMessages: {}, pendingAsks: {}, locks: 1, ended: false, closing: false })
  })
  afterEach(() => vi.useRealTimers())

  it('offers every day three more requests, from the boss', () => {
    expect(scenario.overtime.stay && scenario.overtime.leave).toBeTruthy()
    for (let n = 1; n <= days; n++) {
      const extra = scenario.overtime.days[n]
      expect(extra, `day ${n}`).toBeTruthy()
      expect(extra.requests).toHaveLength(3)
      expect(extra.asks.filter((a) => a.ask).map((a) => a.ask.grants).sort())
        .toEqual([...extra.requests].sort())
      for (const id of extra.requests) expect(scenario.objectives.some((o) => o.id === id)).toBe(true)
    }
  })

  it('shows up only once the day is done, and only until it is answered', () => {
    expect(overtimeOffer(scenario, 1, {})).toBeTruthy()
    expect(overtimeOffer(scenario, 1, { 1: true })).toBeNull()
    expect(overtimeOffer(scenario, 1, { 1: false })).toBeNull()
  })

  it('adds tonight\'s work to the day, and asks it in the messenger', () => {
    const before = requestsOf(scenario, 1, {}).length
    useGame.getState().workLate()
    expect(requestsOf(scenario, 1, useGame.getState().overtime)).toHaveLength(before + 3)
    const grants = grantsRaised(playDay())
    for (const id of scenario.overtime.days[1].requests) expect(grants).toContain(id)
  })

  it('holds the day open until the extra work is done too', () => {
    const state = { grants: {}, unlocked: {}, overtime: { 1: true } }
    for (const o of requestsOf(scenario, 1, {})) {
      if (o.site) state.unlocked[o.site] = true
      else state.grants[o.grant] = true
    }
    expect(dayDone(scenario, 1, state)).toBe(false)
    for (const id of scenario.overtime.days[1].requests) state.grants[id] = true
    expect(dayDone(scenario, 1, state)).toBe(true)
  })

  it('stamps every message with the day it arrived, so the chat can date it', () => {
    useGame.setState({ day: 3 })
    useGame.getState().pushMessage('boss', { from: '박 팀장', text: '오늘은 셋째 날' })
    expect(useGame.getState().extraMessages.boss.at(-1)).toMatchObject({ day: 3, text: '오늘은 셋째 날' })
  })

  // 마칠 때 그날 밤 부름이 먼저 도착하고 결과는 잠시 뒤에 뜬다. 그 사이를
  // 건너뛰어야 결과 화면을 볼 수 있다.
  const clockOff = () => {
    useGame.getState().closeDay()
    vi.advanceTimersByTime(3000)
  }

  it('waits for the player to clock off, and asks again after a late night', () => {
    vi.useFakeTimers()
    try {
      expect(useGame.getState().closing).toBe(false)
      clockOff()
      expect(useGame.getState().closing).toBe(true)
      useGame.getState().workLate()
      expect(useGame.getState().closing).toBe(false)
      clockOff()
      useGame.getState().restart()
      expect(useGame.getState().closing).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('lets going home close the offer without adding anything', () => {
    useGame.getState().goHome()
    expect(useGame.getState().overtime[1]).toBe(false)
    expect(requestsOf(scenario, 1, useGame.getState().overtime))
      .toHaveLength(requestsOf(scenario, 1, {}).length)
  })
})

describe('five nights out of five', () => {
  it('counts only a full week of overtime', () => {
    expect(workedEveryNight(every, days)).toBe(true)
    expect(workedEveryNight({ ...every, 3: false }, days)).toBe(false)
    expect(workedEveryNight({ 1: true, 2: true }, days)).toBe(false)
  })

  it('earns the overwork ending on its own, even with the screen locked', () => {
    expect(endingFor(scenario.ending, { grants: {}, locks: 9, overtime: every, days })).toBe('overwork')
    expect(endingFor(scenario.ending, { grants: {}, locks: 9, overtime: { ...every, 5: false }, days })).toBe('plain')
  })

  it('still loses to the truth and to the ticket', () => {
    expect(endingFor(scenario.ending, { grants: { lotto: true }, locks: 0, overtime: every, days })).toBe('lotto')
    expect(endingFor(scenario.ending, { grants: { clue_obituary: true }, locks: 0, overtime: every, days })).toBe('true')
  })
})
