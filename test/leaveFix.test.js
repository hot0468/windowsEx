import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles } from '../src/engine/store.js'

const portal = scenario.sites.find((s) => s.url === 'portal.ar.co.kr')
const page = portal.pages['/hr/leave']
const v = page.leave
const beat = scenario.days[1].asks.find((a) => a.ask?.grants === 'leave_fix')
const form = allFiles(scenario.fs).find((f) => f.name === '휴가신청서_사본.hwp')

describe('re-registering the vacation dates', () => {
  it('comes in on day two, every time', () => {
    expect(scenario.days[1].requests).toContain('leave_fix')
    expect(scenario.pool.fixed['2']).toContain('leave_fix')
    expect(scenario.objectives.find((o) => o.id === 'leave_fix')?.grant).toBe('leave_fix')
    expect(beat?.thread).toBe('payroll')
  })

  it('sends the player through 인사관리, which is on the menu bar', () => {
    expect(portal.portal.nav).toContain('인사관리')
    expect(portal.pages['/hr'].menu.some((m) => m.path === '/hr/leave')).toBe(true)
    expect(beat.lines.join(' ')).toContain('인사관리')
  })

  it('wants the period the approved form actually says', () => {
    expect(form.content).toContain(`${v.answer.from} ~ ${v.answer.to}`)
    // and the one already on record is a different one, or there is nothing to fix
    expect(v.current.period).not.toBe(`${v.answer.from} ~ ${v.answer.to}`)
    expect(v.from).toContain(v.answer.from)
    expect(v.to).toContain(v.answer.to)
  })

  it('offers wrong dates that are wrong, so submitting blind does not work', () => {
    const pairs = v.from.flatMap((f) => v.to.map((t) => [f, t]))
    const right = pairs.filter(([f, t]) => f === v.answer.from && t === v.answer.to)
    expect(right).toHaveLength(1)
    expect(pairs.length).toBeGreaterThan(4)
  })

  it('keeps the receipt off every page the player can read without submitting', () => {
    const readable = JSON.stringify({
      pages: Object.fromEntries(Object.entries(portal.pages)
        .map(([k, p]) => [k, { ...p, leave: p.leave ? { ...p.leave, receipt: null } : undefined }])),
      threads: [scenario.workMessenger, scenario.privateMessenger],
      mails: scenario.mails,
      files: allFiles(scenario.fs)
    })
    expect(readable).not.toContain(v.receipt)
    // the question's own hints may name the prefix, never the number
    expect(beat.ask.no.flat().join(' ')).not.toContain(v.receipt)
  })

  it('does not answer, or get answered by, the first vacation question', () => {
    const leave = scenario.workMessenger.sections.flatMap((s) => s.threads)
      .find((t) => t.id === 'payroll').reactions.find((r) => r.ask?.grants === 'leave').ask
    for (const a of leave.accept) expect(v.receipt).not.toContain(a)
    for (const a of beat.ask.accept) expect(leave.accept).not.toContain(a)
  })
})
