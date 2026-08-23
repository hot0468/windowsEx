import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { entriesAt } from '../src/engine/store.js'

const slips = entriesAt(scenario.fs, ['문서', '개인', '급여명세서'])

// read the amount off the line that starts with a label. building the pattern
// from the label instead would need escaping the labels carry no room for.
const won = (body, label) => {
  const line = body.split(/\r?\n/).find((l) => l.trim().startsWith(label))
  const hit = line && line.match(/([\d,]+)원/)
  return hit ? Number(hit[1].replace(/,/g, '')) : null
}

describe('payslips', () => {
  it('files a year of them', () => {
    expect(slips).toHaveLength(12)
    expect(slips[0].name).toBe('급여명세서_202508.hwp')
    expect(slips[11].name).toBe('급여명세서_202607.hwp')
    for (const s of slips) expect(s.name.endsWith('.hwp')).toBe(true)
  })

  it('adds up, every month', () => {
    // a game about reading numbers off documents cannot ship documents whose
    // own numbers do not add up
    for (const s of slips) {
      const paid = won(s.content, '지급 합계')
      const cut = won(s.content, '공제 합계')
      const net = won(s.content, '■ 실지급액')
      expect([paid, cut, net].every(Number.isFinite)).toBe(true)
      expect(paid - cut).toBe(net)
      expect(net).toBeGreaterThan(0)
    }
  })

  it('never doubles as a hint sheet', () => {
    const answers = [
      ...[scenario.workMessenger, scenario.privateMessenger]
        .flatMap((m) => m.sections.flatMap((s) => s.threads))
        .flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)])
        .filter(Boolean).flatMap((a) => a.accept.flat()),
      ...scenario.days.flatMap((d) => d.asks ?? []).flatMap((a) => a.ask.accept.flat())
    ].filter((a) => a.length > 2)
    const paper = slips.map((s) => s.content).join('\n')
    for (const answer of new Set(answers)) expect(paper).not.toContain(answer)
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
