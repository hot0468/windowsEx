import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { entriesAt } from '../src/engine/store.js'

const slips = entriesAt(scenario.fs, ['문서', '개인', '급여명세서'])
const august = slips.find((s) => s.name.includes('202608'))
const payroll = [...scenario.days.flatMap((d) => d.asks ?? []), ...scenario.pool.requests.map((r) => r.beat)]
  .find((a) => a.ask?.grants === 'payroll').ask

// read the amount off the line that starts with a label. building the pattern
// from the label instead would need escaping the labels carry no room for.
const won = (body, label) => {
  const line = body.split(/\r?\n/).find((l) => l.trim().startsWith(label))
  const hit = line && line.match(/([\d,]+)원/)
  return hit ? Number(hit[1].replace(/,/g, '')) : null
}

// a day's briefing may carry no ask at all, and an ask may be answered by
// something other than typing — neither shape has an accept list
const everyAnswer = () => [
  ...[scenario.workMessenger, scenario.privateMessenger]
    .flatMap((m) => m.sections.flatMap((s) => s.threads))
    .flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]),
  ...scenario.days.flatMap((d) => d.asks ?? []).map((a) => a.ask)
].filter((a) => a?.accept).flatMap((a) => a.accept.flat()).filter((a) => a.length > 2)

describe('payslips', () => {
  it('files a year of them, plus the month under review', () => {
    expect(slips).toHaveLength(13)
    expect(slips[0].name).toBe('급여명세서_202508.hwp')
    expect(august.name).toBe('급여명세서_202608.hwp')
    for (const s of slips) expect(s.name.endsWith('.hwp')).toBe(true)
  })

  it('adds up, every month', () => {
    // a game about reading numbers off documents cannot ship documents whose
    // own numbers do not add up — August included, since its error is a wrong
    // figure, not broken arithmetic
    for (const s of slips) {
      const paid = won(s.content, '지급 합계')
      const cut = won(s.content, '공제 합계')
      const net = won(s.content, '■ 실지급액')
      expect([paid, cut, net].every(Number.isFinite)).toBe(true)
      expect(paid - cut).toBe(net)
      expect(net).toBeGreaterThan(0)
    }
  })

  it('never doubles as a hint sheet for another puzzle', () => {
    const mine = new Set(payroll.accept.flat())
    const paper = slips.map((s) => s.content).join('\n')
    for (const answer of new Set(everyAnswer())) {
      if (!mine.has(answer)) expect(paper).not.toContain(answer)
    }
  })

  it('reads like the rest of the paperwork in this world', () => {
    // the page is set in 바탕, a proportional face, so padded columns would
    // come out ragged — these documents use an em dash instead
    for (const s of slips) {
      expect(s.content).not.toMatch(/ {4}/)
      expect(s.content).toContain(' — ')
    }
  })
})

describe('the payroll error', () => {
  const overtime = (slip) => won(slip.content, '연장근로수당') ?? 0

  it('stands out from every other month, or there is nothing to spot', () => {
    const rest = slips.filter((s) => s !== august)
    expect(overtime(august)).toBeGreaterThan(Math.max(...rest.map(overtime)) * 4)
  })

  it('is an overpayment, which is the part worth reporting', () => {
    const july = slips.find((s) => s.name.includes('202607'))
    expect(won(august.content, '■ 실지급액'))
      .toBeGreaterThan(won(july.content, '■ 실지급액'))
  })

  it('lets only August satisfy the answer', () => {
    // 연장근로수당 is a line on every slip; what names the error is the item
    // together with its figure, so no other month may match a whole wording
    for (const slip of slips.filter((s) => s !== august)) {
      for (const wording of payroll.accept) {
        expect(wording.every((p) => slip.content.includes(p))).toBe(false)
      }
    }
  })

  it('accepts a wording the document actually supports', () => {
    expect(payroll.accept.some((w) => w.every((p) => august.content.includes(p)))).toBe(true)
  })

  it('makes the player compare before it tells them anything', () => {
    // the first nudge must not name the item; the last may all but say it
    expect(payroll.no[0].join(' ')).not.toContain('연장근로')
    expect(payroll.no.length).toBeGreaterThan(2)
  })
})
