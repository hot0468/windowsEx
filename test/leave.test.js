import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles } from '../src/engine/store.js'

const portal = scenario.sites.find((s) => s.url === 'portal.ar.co.kr')
const me = portal.portal.me
const rows = portal.pages['/hr/attendance'].attendance
const days = (cell) => Number(String(cell).replace(/[^\d]/g, '')) || 0
const num = (s) => Number(String(s).match(/\d+/)[0])

// 근속 10년차 with 15 days of leave was the tell: that is a first-year figure.
// 근로기준법 제60조 — 15 days from one year, one more every two years from the
// third, capped at 25.
const owed = (years) => Math.min(25, 15 + Math.max(0, Math.floor((years - 1) / 2)))

describe('the leave the company owes him', () => {
  it('matches how long he has been there', () => {
    const tenure = num(me.tenure)          // 근속 N년차 — the Nth year, so N-1 full years
    expect(owed(tenure - 1)).toBe(num(me.leaveTotal))
  })

  it('adds up against what the attendance record says he used', () => {
    const used = rows.rows.reduce((n, r) => n + days(r[rows.columns.indexOf('연차 사용')]), 0)
    expect(used).toBeGreaterThan(0)
    expect(num(me.leaveTotal) - used).toBe(num(me.leaveLeft))
  })

  it('leaves the one the accounts team asks for alone', () => {
    // 남은 연차 is an answer; the total is not, which is why the total moved
    expect(me.leaveLeft).toBe('3일 0시간')
  })

  it('agrees with the vacation he actually took', () => {
    const form = allFiles(scenario.fs).find((f) => f.name === '휴가신청서_사본.hwp')
    const july = days(rows.rows.find((r) => r[0] === '2026-07')[rows.columns.indexOf('연차 사용')])
    // the month off is the bulk of it, and it cannot be more than he had
    expect(form.content).toContain('연차 소진')
    expect(july).toBeLessThanOrEqual(num(me.leaveTotal))
    expect(july).toBeGreaterThan(num(me.leaveTotal) / 2)
  })
})
