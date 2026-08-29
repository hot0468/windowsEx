import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fileOpener, goalFor, searchAds, searchSites } from '../src/engine/store.js'

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
  // 뷰어를 페이지의 어느 절에 실어 두든, 파트너 사이트가 그것을 내주기만 하면
  // 된다 — 자료실이든 한 줄짜리 안내든. 화면 모양이 아니라 그 사실을 본다.
  const downloadsOf = (site) => {
    const out = []
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (n && typeof n === 'object') {
        if (n.download?.fileId) out.push(n.download)
        Object.values(n).forEach(walk)
      }
    }
    walk(site)
    return out
  }
  const viewer = downloadsOf(partner).find((d) => d.fileId === 'file_dyviewer')

  it('is handed out by the partner site, which you can find by searching', () => {
    expect(viewer, '파트너 사이트가 뷰어를 안 내준다').toBeTruthy()
    expect(searchSites(scenario.sites, 'D유통').map((s) => s.url)).toContain(partner.url)
  })

  it('is a program with a grant of its own', () => {
    const p = scenario.programs.dviewer
    expect(p.setup).toBe(viewer.name)
    expect(p.grant).toBe('dviewer')
    expect(p.missing.lines.join(' ')).toContain(partner.url)
  })
})

describe('the ad at the top of the results', () => {
  const spam = scenario.sites.find((s) => s.url === 'hwpviewer-free.com')

  it('turns up when a stuck player searches for a 한글 viewer', () => {
    const hits = searchAds(scenario.ads, '한글 뷰어')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].url).toBe(spam.url)
  })

  it('never turns up as an ordinary site result', () => {
    for (const q of ['한글', '뷰어', 'hwp', '무료']) {
      expect(searchSites(scenario.sites, q).map((s) => s.url)).not.toContain(spam.url)
    }
  })

  it('hands out a program that takes the machine down', () => {
    const p = scenario.programs.fakeviewer
    expect(spam.vendor.download.name).toBe(p.setup)
    expect(spam.vendor.theme).toBe('spam')
    expect(p.danger).toBe(true)
    expect(p.aftermath.thread).toBe('security')
    expect(p.aftermath.lines.join(' ')).toContain(spam.url)
  })
})
