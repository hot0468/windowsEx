import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { agendaOf } from '../src/apps/Calendar.jsx'

// 폰에서는 달력 격자 대신 일정 목록으로 본다. 390px 에서 7열 격자는 한 칸이
// 55px 라 일정 제목이 들어가지 않는다 — 날짜만 보이고 무슨 일이 있는지는
// 안 보이는 달력은 달력이 아니다.

const scenario = JSON.parse(
  readFileSync(new URL('../src/scenarios/workday.json', import.meta.url), 'utf8'))
const cal = scenario.sites.find((s) => s.layout === 'calendar').calendar

describe('일정 목록', () => {
  it('일정이 있는 날만 나온다', () => {
    const rows = agendaOf(cal, 23)
    expect(rows.length).toBe(new Set(cal.events.map((e) => e.day)).size)
    for (const r of rows) expect(r.events.length).toBeGreaterThan(0)
  })

  it('날짜 순으로 온다', () => {
    const days = agendaOf(cal, 23).map((r) => r.day)
    expect([...days].sort((a, b) => a - b)).toEqual(days)
  })

  it('오늘을 표시한다', () => {
    const rows = agendaOf(cal, 23)
    const today = rows.find((r) => r.day === 23)
    expect(today?.today).toBe(true)
    expect(rows.filter((r) => r.today).length).toBe(1)
  })

  // 오늘이 일정 없는 날이면 today 표시는 아무 줄에도 붙지 않는다.
  it('오늘 일정이 없으면 아무 줄도 오늘이 아니다', () => {
    const rows = agendaOf(cal, 2)
    expect(rows.some((r) => r.today)).toBe(false)
  })

  it('지난 날인지 알려 준다', () => {
    const rows = agendaOf(cal, 23)
    expect(rows.find((r) => r.day === 1)?.past).toBe(true)
    expect(rows.find((r) => r.day === 31)?.past).toBe(false)
    // 오늘은 지난 날이 아니다
    expect(rows.find((r) => r.day === 23)?.past).toBe(false)
  })

  it('요일을 붙인다', () => {
    for (const r of agendaOf(cal, 23)) {
      expect(r.weekday, String(r.day)).toMatch(/^[일월화수목금토]$/)
    }
  })

  // 게임 달력은 실제 2026년과 다르다. 8월 1일이 일요일이고, 복귀 첫날인
  // 8월 23일은 월요일 — days[0].date 의 '8월 23일 (월)' 과 맞아야 한다.
  it('요일이 게임 달력과 맞는다', () => {
    const rows = agendaOf(cal, 23)
    expect(rows.find((r) => r.day === 1)?.weekday).toBe('일')
    expect(rows.find((r) => r.day === 23)?.weekday).toBe('월')
    expect(rows.find((r) => r.day === 29)?.weekday).toBe('일')
    expect(rows.find((r) => r.day === 31)?.weekday).toBe('화')
  })

  it('시간이 있는 일정은 시간을 들고 온다', () => {
    const rows = agendaOf(cal, 23)
    const five = rows.find((r) => r.day === 5)
    expect(five.events[0].time).toBe('18:30')
  })
})
