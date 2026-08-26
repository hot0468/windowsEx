import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles } from '../src/engine/store.js'

const chain = (a) => (a ? [a, ...chain(a.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const asks = [
  ...threads.flatMap((t) => [...chain(t.ask), ...(t.reactions ?? []).flatMap((r) => chain(r.ask))]),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask))),
  ...scenario.pool.requests.flatMap((r) => chain(r.beat.ask)),
  // the caller's questions are questions too
  ...chain(scenario.summons?.beat?.ask),
  ...Object.values(scenario.overtime?.days ?? {}).flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask)))
].filter(Boolean)

// A compound accept needs every part, so one part appearing gives nothing away.
// A whole answer standing on its own does.
const wholeAnswers = [...new Set(
  asks.flatMap((a) => (a.accept ?? []).filter((e) => !Array.isArray(e))).map(String)
)]

const portal = scenario.sites.find((s) => s.url === 'portal.ar.co.kr')
const att = portal.pages['/hr/attendance']
const files = allFiles(scenario.fs)
const thread = (id) => threads.find((t) => t.id === id)

describe('the week that was already on record', () => {
  it('keeps an attendance page the portal links to', () => {
    expect(att).toBeTruthy()
    expect(portal.pages['/hr'].menu.some((m) => m.path === '/hr/attendance')).toBe(true)
    expect(att.attendance.rows.length).toBeGreaterThan(3)
    for (const row of att.attendance.rows) {
      expect(row).toHaveLength(att.attendance.columns.length)
    }
  })

  it('shows overtime climbing and leave going unused', () => {
    const hours = (cell) => Number(String(cell).replace(/[^\d]/g, '')) || 0
    const overtime = att.attendance.rows.map((r) => hours(r[2]))
    // the month before the holiday is the worst of them
    expect(Math.max(...overtime)).toBe(overtime.at(-1))
    expect(att.attendance.flags.length).toBeGreaterThan(1)
    expect(att.attendance.last).toMatch(/야간 출입/)
  })

  it('does not contradict the last clock-out the ending reads out', () => {
    // the whole game agrees she left at 18:42 on 2026-07-23; the gate log
    // shows the nights before that, and never puts her on the eighth floor
    const blob = JSON.stringify(att)
    expect(blob).not.toContain('23:51')
    expect(blob).not.toContain('8층')
    expect(scenario.ending.true.scenes[0].lines.join(' ')).toContain('18:42')
  })

  it('has the body keeping its own score', () => {
    const health = files.find((f) => f.name.includes('건강검진'))
    expect(health.content).toContain('경계')
    expect(health.content).toMatch(/수면/)
    expect(health.content).toContain('재검 예약 이력 없음')
    const run = files.find((f) => f.name === '운동_기록.txt')
    expect(run.content).toContain('그 뒤로 안 씀')
  })

  it('has people saying it out loud, before the holiday', () => {
    const said = (id) => thread(id).messages.map((m) => m.text).join(' ')
    expect(said('junho')).toMatch(/새벽|게이트/)      // the colleague who covered
    expect(said('soyoung')).toMatch(/얼굴|걱정/)       // the one outside the team
    expect(said('jihyun')).toMatch(/야근|응급실/)      // the friend cancelled on
    expect(said('mom')).toMatch(/몸부터|회사에서 잤/)   // and her mother
  })

  it('says none of it in a way that answers a question', () => {
    const surfaces = [
      JSON.stringify(att),
      JSON.stringify(['junho', 'soyoung', 'jihyun', 'mom'].map((id) => thread(id).messages))
    ]
    for (const blob of surfaces) {
      expect(wholeAnswers.filter((a) => a.length >= 3 && blob.includes(a))).toEqual([])
    }
  })

  it('leaves the payroll puzzle its one figure', () => {
    // the August overtime line is the answer; the attendance page explains
    // where those hours came from without ever printing the amount
    const slip = files.find((f) => f.name === '급여명세서_202608.hwp')
    expect(slip.content).toContain('1,240,000')
    expect(JSON.stringify(att)).not.toContain('1,240,000')
  })
})
