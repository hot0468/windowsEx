import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/ep1.json'
import { allFiles, entriesAt, fileOpener, quickSets, searchSites } from '../src/engine/store.js'
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
    const wiki = JSON.stringify(scenario.sites.find((s) => s.layout === 'wiki'))
    for (const k of scenario.goal.requiredKeywords) expect(wiki).toContain(k)
  })

  it('both intranet sites are behind the company account', () => {
    for (const site of scenario.sites) {
      expect(site.login.password).toBeTruthy()
      expect(site.login.hint).toBeTruthy()
    }
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
      .toEqual([scenario.sites.find((s) => s.layout === 'wiki').url])
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
    // only the page body — credentials live outside it and are what gets checked
    const portal = JSON.stringify(scenario.sites.find((s) => s.layout === 'portal').portal)
    const wiki = scenario.sites.find((s) => s.layout === 'wiki')
    for (const keyword of scenario.goal.requiredKeywords) expect(portal).not.toContain(keyword)
    expect(portal).not.toContain(wiki.login.password)
    expect(portal).not.toContain('입사일')   // the hire date belongs on the ID card scan
  })

  it('offers every thread at least one usable set of reply choices', () => {
    for (const t of threads) {
      const sets = quickSets(t)
      expect(sets.length).toBeGreaterThan(0)
      for (const set of sets) {
        expect(set.length).toBeGreaterThan(0)
        for (const line of set) expect(typeof line).toBe('string')
      }
    }
  })

  it('walks the briefing thread through changing choices', () => {
    const boss = threads.find((t) => t.live)
    expect(quickSets(boss).length).toBeGreaterThan(1)
  })

  it('answers every scripted reaction, whether it keys on a file or a reply', () => {
    const known = new Set(files.map((f) => f.id))
    const reacting = threads.filter((t) => t.reactions)
    expect(reacting.length).toBeGreaterThan(0)
    for (const t of reacting) {
      for (const r of t.reactions) {
        expect(r.reply.length).toBeGreaterThan(0)
        expect(Boolean(r.files) !== Boolean(r.choice)).toBe(true)   // one trigger, not both
        for (const id of r.files ?? []) expect(known.has(id)).toBe(true)
        // a reply-triggered reaction must be reachable from that thread's choices
        if (r.choice) expect(quickSets(t).flat()).toContain(r.choice)
      }
    }
  })

  it('puts the office address 엄마 asks for somewhere findable', () => {
    const mom = threads.find((t) => t.id === 'mom')
    const asked = mom.reactions.find((r) => r.choice && r.reply.length > 1).choice
    const portal = scenario.sites.find((s) => s.layout === 'portal').portal
    expect(portal.footer.address).toBe(asked)
  })

  it('keeps the phone gallery reachable as its own drive', () => {
    const gallery = entriesAt(scenario.fs, ['휴대폰', '갤러리'])
    expect(gallery.length).toBeGreaterThan(0)
    for (const photo of gallery) expect(fileImage(photo.image)).toBeTruthy()
  })

  it('file ids are unique', () => {
    const ids = files.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
