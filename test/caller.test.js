import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { callerNight, useGame } from '../src/engine/store.js'

// 이름 없는 계정은 하룻밤에 몰아 묻지 않고 며칠 저녁에 나눠 묻는다. 하루를
// 마칠 때, 결과가 뜨기 전에 그날 몫이 도착한다. 첫 밤에 물리면 그 뒤로는
// 아무 밤도 오지 않는다 — 부름을 못 받으니 그 엔딩도 닫힌다.
const nights = Object.keys(scenario.summons.nights).map(Number).sort((a, b) => a - b)
const state = (over = {}) => ({ scenario, grants: {}, day: 1, ...over })

describe('밤마다 오는 부름', () => {
  beforeEach(() => useGame.setState({ grants: {}, day: 1, closing: false, beatQueue: [], beatAsk: null , awaitingCaller: null }))

  it('밤이 정해진 날에만 온다', () => {
    for (const d of [1, 2, 3, 4, 5]) {
      const due = Boolean(callerNight(state({ day: d })))
      expect(due, d + '일차').toBe(nights.includes(d))
    }
  })

  it('한 밤은 한 번만 온다', () => {
    const s = state({ day: nights[0] })
    expect(callerNight(s)).toBeTruthy()
    expect(callerNight({ ...s, grants: { ['called:' + nights[0]]: true } })).toBe(null)
  })

  it('물리면 그 뒤로 아무 밤도 오지 않는다', () => {
    const off = { [scenario.summons.off]: true }
    for (const d of nights) expect(callerNight(state({ day: d, grants: off })), d + '일차').toBe(null)
  })

  it('마칠 때 결과보다 먼저 도착한다', () => {
    vi.useFakeTimers()
    try {
      useGame.setState({ day: nights[0] })
      useGame.getState().closeDay()
      // 아직 결과 화면이 아니다 — 먼저 말이 온다.
      expect(useGame.getState().closing).toBe(false)
      expect(useGame.getState().beatQueue.length).toBeGreaterThan(0)
      vi.advanceTimersByTime(3000)
      // 시간이 지나도 덮이지 않는다 — 무슨 말을 했는지 읽을 틈을 준다.
      expect(useGame.getState().closing).toBe(false)
      // 그 대화를 닫는 것이(또는 퇴근을 다시 누르는 것이) 저녁을 부른다.
      useGame.getState().closeDay()
      expect(useGame.getState().closing).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('올 밤이 없으면 곧바로 결과가 뜬다', () => {
    useGame.setState({ day: 5 })
    useGame.getState().closeDay()
    expect(useGame.getState().closing).toBe(true)
  })

  // 부름을 받아야 열리는 엔딩이 있다. 물린 사람은 그 열쇠를 못 받는다.
  it('부름의 열쇠는 마지막 밤에만 걸려 있다', () => {
    const last = scenario.summons.nights[nights[nights.length - 1]]
    const steps = (a) => (a ? [a, ...steps(a.then)] : [])
    const granting = nights.flatMap((d) => steps(scenario.summons.nights[d].ask))
      .filter((a) => a.grants === scenario.summons.grant)
    expect(granting).toHaveLength(1)
    expect(steps(last.ask)).toContain(granting[0])
  })
})

// 계정은 플레이어가 본 것을 안다. 근태의 빈 8월을 연 적이 있으면 그날 밤
// 그 말부터 시작한다 — 안 본 사람에게는 꺼내지 않는다.
describe('본 것만 짚는다', () => {
  const night = Object.entries(scenario.summons.nights).find(([, b]) => b.seen)

  it('본 사람에게는 그 말부터 시작한다', () => {
    expect(night, 'seen 이 달린 밤이 없다').toBeTruthy()
    const [day, beat] = night
    const s = { scenario, day: Number(day), grants: { [beat.seen.grant]: true } }
    expect(callerNight(s).lines.slice(0, beat.seen.lines.length)).toEqual(beat.seen.lines)
  })

  it('안 본 사람에게는 꺼내지 않는다', () => {
    const [day, beat] = night
    expect(callerNight({ scenario, day: Number(day), grants: {} }).lines).toEqual(beat.lines)
  })

  it('그 표식은 실제로 그 화면이 준다', () => {
    // Portal 의 근태 화면이 notice('saw_gap') 을 부른다. 화면 쪽이 이름을
    // 바꾸면 부름이 영영 조용해지니, 소스에서 직접 확인한다.
    const src = readFileSync('src/apps/Portal.jsx', 'utf8')
    expect(src).toContain("notice('" + night[1].seen.grant + "')")
  })
})
