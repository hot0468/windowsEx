import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import {
  allFiles, codeFits, fileOpener, findFile, fsView, searchSites, siteView, smsFor, useGame
} from '../src/engine/store.js'

const site = scenario.sites.find((s) => s.layout === 'gov')
const gov = site.gov
const files = allFiles(scenario.fs)
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))

describe('정부25', () => {
  it('is a public site the search portal can find', () => {
    expect(siteView(site, { grants: {}, unlocked: {} })).toBe('ready')
    expect(searchSites(scenario.sites, '정부25').map((s) => s.url)).toEqual([site.url])
  })

  it('issues real pdf files that stay hidden until saved', () => {
    expect(gov.services.length).toBeGreaterThan(1)
    for (const svc of gov.services) {
      const file = findFile(scenario.fs, svc.fileId)
      expect(file, svc.title).toBeTruthy()
      expect(file.name.endsWith('.pdf')).toBe(true)
      expect(file.attached).toBe(true)
      expect(findFile(fsView(scenario.fs), svc.fileId)).toBeNull()
      expect(findFile(fsView(scenario.fs, { restored: { [svc.fileId]: true } }), svc.fileId)).toBeTruthy()
    }
  })

  it('opens a pdf in the pdf viewer', () => {
    const pdf = files.find((f) => f.name.endsWith('.pdf'))
    expect(fileOpener(pdf)).toEqual({ app: 'pdf', icon: 'pdf' })
  })

  it('checks the name against the player, not an empty string', () => {
    expect(gov.verify.name).toBe(scenario.workMessenger.me.name)
  })

  it('hands the accounting team the certificate the site issues', () => {
    const beat = scenario.days.flatMap((d) => d.asks ?? [])
      .find((a) => a.ask?.grants === 'insurance')
    expect(beat.thread).toBe('payroll')
    const issued = gov.services.map((s) => s.fileId)
    for (const id of beat.ask.files) expect(issued).toContain(id)
    expect(scenario.objectives.some((o) => o.grant === 'insurance')).toBe(true)
    expect(scenario.days[3].requests).toContain('insurance')
  })
})

describe('본인확인', () => {
  beforeEach(() => useGame.setState({ extraMessages: {}, toast: null }))

  it('texts the code to the phone, into a thread that exists', () => {
    const thread = threads.find((t) => t.id === gov.verify.thread)
    expect(thread?.bot).toBe(true)
    useGame.getState().sendCode(gov)
    const texts = useGame.getState().extraMessages[gov.verify.thread].map((m) => m.text)
    expect(texts).toEqual([smsFor(gov.verify)])
    expect(texts[0]).toContain(gov.verify.code)
    expect(useGame.getState().toast.app).toBe('chat')
  })

  it('accepts the code with spaces forgiven, and nothing else', () => {
    expect(codeFits(gov.verify, ` ${gov.verify.code} `)).toBe(true)
    expect(codeFits(gov.verify, '000000')).toBe(false)
    expect(codeFits(gov.verify, '')).toBe(false)
  })

  it('keeps the code out of everything written down in advance', () => {
    const written = JSON.stringify({ threads, board: scenario.sites.filter((s) => s.layout === 'board'), files })
    expect(written).not.toContain(gov.verify.code)
  })

  it('makes you install the keyboard security program first', () => {
    const gov = scenario.sites.find((s) => s.url === 'gov25.go.kr').gov
    expect(gov.security.download.fileId).toBe('file_anysign')
    expect(gov.security.download.name).toBe(scenario.programs.anysign.setup)
    expect(gov.security.lines.length).toBeGreaterThan(0)
    expect(gov.security.recheck).toBeTruthy()
    expect(gov.security.notReady).toBeTruthy()
  })

  it('hides that installer until the site hands it over', () => {
    const setup = allFiles(scenario.fs).find((f) => f.id === 'file_anysign')
    expect(setup).toBeTruthy()
    expect(setup.attached).toBe(true)
    expect(setup.program).toBe('anysign')
  })
})
