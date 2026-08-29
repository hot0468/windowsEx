import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { gameClock } from '../src/engine/store.js'

// 화면의 시계가 실제 시각을 그대로 걸면, 토요일 밤에 플레이하는 사람이 게임
// 속에서도 주말 야근을 하고 있는 것처럼 보인다. 화면과 게임이 다른 이야기를
// 하는 셈이다.
describe('게임 안의 시계', () => {
  const min = 60_000

  it('날짜는 그날 것을 쓴다', () => {
    for (let d = 1; d <= scenario.days.length; d++) {
      expect(gameClock(scenario, { day: d }).date).toBe(scenario.days[d - 1].date)
    }
  })

  it('아침에 출근해서 논 만큼 흐른다', () => {
    const at = 1_000_000
    expect(gameClock(scenario, { day: 1, dayAt: at }, at).time).toBe('09:00')
    expect(gameClock(scenario, { day: 1, dayAt: at }, at + 10 * min).time).toBe('14:00')
  })

  it('퇴근 시각을 넘기지 않는다', () => {
    const at = 1_000_000
    expect(gameClock(scenario, { day: 1, dayAt: at }, at + 600 * min).time).toBe('18:00')
  })

  it('야근을 고른 날은 저녁부터 센다', () => {
    const at = 1_000_000
    const night = { day: 2, overtime: { 2: true }, dayAt: at }
    expect(gameClock(scenario, night, at).time).toBe('19:00')
    expect(gameClock(scenario, night, at + 600 * min).time).toBe('23:30')
  })

  it('아직 하루가 시작하지 않았어도 출근 시각을 보여준다', () => {
    expect(gameClock(scenario, { day: 1 }).time).toBe('09:00')
  })

  // 실제 시계를 그리는 곳이 남아 있으면 거기서 다시 어긋난다.
  it('화면 어디에도 실제 날짜를 걸지 않는다', () => {
    for (const f of ['src/shell/Taskbar.jsx', 'src/shell/Lock.jsx', 'src/shell/PhoneShell.jsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toContain('toLocaleDateString')
      expect(src, f).not.toContain('toLocaleTimeString')
      expect(src, f).toContain('gameClock')
    }
  })
})
