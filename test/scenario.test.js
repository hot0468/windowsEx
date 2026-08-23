import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/ep1.json'
import { allFiles, entriesAt, fileOpener, searchSites } from '../src/engine/store.js'
import { fileImage } from '../src/assets/photos.js'

const files = allFiles(scenario.fs)
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))

describe('ep1 scenario integrity', () => {
  it('goal attachment file exists in the filesystem', () => {
    expect(files.some((f) => f.id === scenario.goal.requiredAttachment)).toBe(true)
  })

  it('goal reply mail exists and is replyable', () => {
    const m = scenario.mails.find((m) => m.id === scenario.goal.replyToMail)
    expect(m?.canReply).toBe(true)
  })

  it('the locked wiki still carries every keyword the reply needs', () => {
    const wiki = JSON.stringify(scenario.sites.find((s) => s.password))
    for (const k of scenario.goal.requiredKeywords) expect(wiki).toContain(k)
  })

  it('every messenger thread has either live delivery or its own messages', () => {
    for (const t of threads) expect(t.live || t.messages.length > 0).toBeTruthy()
  })

  it('messenger thread ids are unique', () => {
    const ids = threads.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the one live thread is backed by the timed messenger script', () => {
    expect(threads.filter((t) => t.live)).toHaveLength(1)
    expect(scenario.messenger.length).toBeGreaterThan(0)
  })

  it('walks nested folders to reach a buried file', () => {
    const deep = entriesAt(scenario.fs, ['문서', '업무자료', '2026', 'A상사'])
    expect(deep.map((e) => e.id)).toContain(scenario.goal.requiredAttachment)
  })

  it('every folder entry has a name and every file an id', () => {
    const walk = (entries) => entries.forEach((e) => {
      expect(e.name).toBeTruthy()
      if (e.children) walk(e.children)
      else expect(e.id).toBeTruthy()
    })
    Object.values(scenario.fs).forEach(walk)
  })

  it('portal search finds a site by name', () => {
    expect(searchSites(scenario.sites, '위키').map((s) => s.url))
      .toEqual([scenario.sites.find((s) => s.password).url])
  })

  it('portal search never leaks a locked page, keeping the password gate meaningful', () => {
    for (const keyword of scenario.goal.requiredKeywords) {
      expect(searchSites(scenario.sites, keyword)).toEqual([])
    }
  })

  it('every file carries either text or a picture', () => {
    for (const f of files) expect(Boolean(f.content) || Boolean(f.image)).toBe(true)
  })

  it('every scanned file resolves to a bundled image and opens in the viewer', () => {
    const scans = files.filter((f) => f.image)
    expect(scans.length).toBeGreaterThan(0)
    for (const f of scans) {
      expect(fileImage(f.image)).toBeTruthy()
      expect(fileOpener(f).app).toBe('viewer')
    }
  })

  it('routes each file to the app its extension implies', () => {
    const apps = Object.fromEntries(files.map((f) => [f.name, fileOpener(f).app]))
    expect(apps['견적서_최종_진짜최종.hwp']).toBe('hwp')
    expect(apps['휴가신청서_사본.hwp']).toBe('hwp')
    expect(apps['메모.txt']).toBe('notepad')
    expect(apps['사원증_스캔.jpg']).toBe('viewer')
  })

  it('every paperwork file is .hwp and every scribble .txt', () => {
    for (const f of files) {
      if (f.image) continue
      expect(f.name).toMatch(/\.(hwp|txt)$/)
    }
  })

  it('the intranet portal never states what the puzzle makes you look up', () => {
    const portal = JSON.stringify(scenario.sites.find((s) => s.layout === 'portal'))
    const wiki = scenario.sites.find((s) => s.password)
    for (const keyword of scenario.goal.requiredKeywords) expect(portal).not.toContain(keyword)
    expect(portal).not.toContain(wiki.password)
    expect(portal).not.toContain('입사일')   // the hire date belongs on the ID card scan
  })

  it('file ids are unique', () => {
    const ids = files.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
