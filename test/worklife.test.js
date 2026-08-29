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
    // the month before the holiday is the worst of the recorded ones; the
    // row after it is this month, and this month is the crack (below)
    expect(Math.max(...overtime)).toBe(overtime.at(-2))
    expect(att.attendance.flags.length).toBeGreaterThan(1)
    expect(att.attendance.last).toMatch(/야간 출입/)
  })

  // 지금 '일하고 있는' 8월이 표에서 비어 있다 — 게이트가 이번 주의
  // 김한별을 한 번도 찍지 못했다. 행이 아예 없으면 '표가 지난달까지만
  // 보여 주나 보다'로 읽히고 만다. 빈 행이 있어야 이상함이 된다.
  it('keeps an August row, and keeps it empty', () => {
    const aug = att.attendance.rows.at(-1)
    expect(aug[0]).toBe('2026-08')
    expect(aug.slice(1).every((c) => c === '-')).toBe(true)
    expect(att.attendance.flags.join(' ')).toContain('기록 없음')
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
    // 통보서는 줄글이 아니라 서식이다. 어느 칸에 적혔든 이 사실들이 남아야
    // 한다 — 경계 판정, 수면 문진, 그리고 끝내 잡지 않은 재검.
    const written = JSON.stringify(health)
    expect(written).toContain('경계')
    expect(written).toContain('수면')
    expect(written).toContain('재검 예약')
    expect(written).toContain('이력 없음')
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

  // 예전에는 이 화면이 아무 질문에도 답하지 않았다 — 아무도 열 이유가
  // 없어서, 빈 8월도 아무도 못 봤다. 이제 요청 하나(overtime_pay)가 정당한
  // 이유로 여기를 지나간다. 답은 그 하나뿐이어야 한다.
  it('answers exactly the one question that walks the player here', () => {
    const mine = scenario.pool.requests.find((r) => r.id === 'overtime_pay').beat.ask.accept
    const found = wholeAnswers.filter((a) => a.length >= 3 && JSON.stringify(att).includes(a))
    expect(found).toEqual(mine)
  })

  it('says none of it in a way that answers a question', () => {
    const surfaces = [
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
