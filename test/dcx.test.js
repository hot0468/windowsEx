import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fileOpener, goalFor, searchSites } from '../src/engine/store.js'

const files = allFiles(scenario.fs)
const terms = files.find((f) => f.id === 'file_d_terms')
const goal = goalFor(scenario, 4)
const APPROVAL = 'DY-PR-260826'

describe('the partner document', () => {
  it('opens in its own viewer, not in 메모장', () => {
    expect(terms).toBeTruthy()
    expect(terms.name.endsWith('.dcx')).toBe(true)
    expect(fileOpener(terms).app).toBe('dcx')
  })

  it('arrives as an attachment on the D유통 mail', () => {
    const mail = scenario.days[3].mails[0]
    expect(mail.attach.fileId).toBe('file_d_terms')
    expect(mail.attach.name).toBe(terms.name)
    expect(terms.attached).toBe(true)
  })

  it('keeps the approval number out of everything written down in advance', () => {
    expect(terms.content).toContain(APPROVAL)
    const threads = [scenario.workMessenger, scenario.privateMessenger]
      .flatMap((m) => m.sections.flatMap((s) => s.threads))
    const beats = scenario.days.flatMap((d) => [d.opening, ...(d.asks ?? [])].filter(Boolean))
    const said = beats.flatMap((b) => b.lines ?? [])
    const hints = beats.flatMap((b) => (b.ask?.no ?? []).flat())
    const mails = [...scenario.mails, ...scenario.days.flatMap((d) => d.mails ?? [])]
    const others = files.filter((f) => f.id !== 'file_d_terms')
    const written = JSON.stringify({
      threads, said, hints, mails, others, sites: scenario.sites, news: scenario.news, qna: scenario.qna
    })
    expect(written).not.toContain(APPROVAL)
  })

  it('is what the day asks you to quote back', () => {
    expect(goal.requiredKeywords).toContain(APPROVAL)
    expect(goal.requiredKeywords).toContain('2,070,000')
  })
})

describe('the viewer that opens it', () => {
  const partner = scenario.sites.find((s) => s.url === 'partner.dyutong.co.kr')

  it('is handed out by the partner site, which you can find by searching', () => {
    expect(partner.layout).toBe('vendor')
    expect(partner.vendor.download.fileId).toBe('file_dyviewer')
    expect(searchSites(scenario.sites, 'D유통').map((s) => s.url)).toContain(partner.url)
  })

  it('is a program with a grant of its own', () => {
    const p = scenario.programs.dviewer
    expect(p.setup).toBe(partner.vendor.download.name)
    expect(p.grant).toBe('dviewer')
    expect(p.missing.lines.join(' ')).toContain(partner.url)
  })
})
