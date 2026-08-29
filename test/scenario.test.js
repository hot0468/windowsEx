import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { docTitle } from '../src/apps/docLayout.js'
import { allFiles, entriesAt, fileOpener, objectiveDone, quickSets, searchSites , goalFor } from '../src/engine/store.js'
import { fileImage } from '../src/assets/photos.js'

const files = allFiles(scenario.fs)
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))

// every question that expects typed input, and every line the player can click
const chain = (ask) => (ask ? [ask, ...chain(ask.then)] : [])
const asksOf = (t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)].flatMap(chain)
const offeredBy = (t) => [
  ...quickSets(t).flat(),
  ...(t.reactions ?? []).flatMap((r) => r.next ?? []),
  ...asksOf(t).flatMap((a) => a.next ?? []),
  // a consequence may hand the thread buttons of its own the next morning
  ...(scenario.ripples ?? []).filter((r) => r.beat.thread === t.id).flatMap((r) => r.beat.choices ?? []),
  // 하루를 마칠 때 오는 밤도 그 대화에 버튼을 건넨다
  ...Object.values(scenario.summons?.nights ?? {})
    .filter((b) => b.thread === t.id).flatMap((b) => b.choices ?? [])
]

describe('scenario integrity', () => {
  it('goal attachment file exists in the filesystem', () => {
    expect(files.some((f) => f.id === goalFor(scenario, 1).requiredAttachment)).toBe(true)
  })

  it('goal reply mail exists and is replyable', () => {
    const m = scenario.mails.find((m) => m.id === goalFor(scenario, 1).replyToMail)
    expect(m?.canReply).toBe(true)
  })

  it('the locked wiki still carries every keyword the reply needs', () => {
    const wiki = JSON.stringify(scenario.sites.find((s) => s.layout === 'wiki'))
    for (const k of goalFor(scenario, 1).requiredKeywords) expect(wiki).toContain(k)
  })

  it('both intranet sites are behind the company account', () => {
    for (const site of scenario.sites.filter((s) => s.login)) {
      expect(site.login.password).toBeTruthy()
      expect(site.login.hint).toBeTruthy()
    }
  })

  it('every messenger thread has either live delivery or its own messages', () => {
    // the caller has neither: the conversation does not exist until it speaks,
    // and the list only draws threads that have something in them
    const silent = scenario.summons ? [scenario.summons.thread] : []
    for (const t of threads) {
      if (silent.includes(t.id)) { expect(t.messages).toHaveLength(0); continue }
      expect(t.live || t.messages.length > 0, t.id).toBeTruthy()
    }
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
    expect(deep.map((e) => e.id)).toContain(goalFor(scenario, 1).requiredAttachment)
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
    for (const keyword of goalFor(scenario, 1).requiredKeywords) {
      expect(searchSites(scenario.sites, keyword)).toEqual([])
    }
  })

  it('describes every picture, so what it shows is not lost', () => {
    for (const f of files.filter((f) => f.image)) {
      expect(f.alt?.length).toBeGreaterThan(5)
    }
  })

  it('every file carries text, a picture, slides, sheets, a form, or a receipt', () => {
    for (const f of files) {
      // 통보서·증명서는 줄글이 아니라 칸으로 적히고(form), 카드 전표는 좁은
      // 종이에 줄로 적힌다(receipt) — 둘 다 Pdf 가 그린다.
      expect(Boolean(f.content) || Boolean(f.image) || Boolean(f.slides)
        || Boolean(f.sheets) || Boolean(f.form) || Boolean(f.receipt), f.name).toBe(true)
    }
  })

  // PDF 로 열리는 문서는 셋 중 한 모양이다: 줄글 · 서식 · 전표. 뷰어가 제목을
  // 제 손으로 골라 읽으면 새 모양이 생겼을 때 없는 곳을 읽는다 — 전자영수증을
  // 전표로 바꾸며 content 를 지웠더니 제목을 뽑다가 터졌고, 렌더 도중이라
  // 뷰어 하나가 아니라 화면 전체가 내려갔다. 규칙은 docLayout 한 곳에 있고
  // 뷰어와 이 검사가 같이 쓴다.
  it('every pdf has a title the viewer can find', () => {
    const pdfs = files.filter((f) => fileOpener(f).app === 'pdf')
    expect(pdfs.length).toBeGreaterThan(3)
    for (const f of pdfs) expect(docTitle(f), f.name).toBeTruthy()
  })

  it('opens every workbook in the spreadsheet app with square rows', () => {
    const books = files.filter((f) => f.sheets)
    expect(books.length).toBeGreaterThan(0)
    for (const b of books) {
      expect(fileOpener(b).app).toBe('sheet')
      for (const sh of b.sheets) {
        expect(sh.name).toBeTruthy()
        expect(sh.columns.length).toBeGreaterThan(0)
        // every row has to line up with the header, or the grid goes ragged
        for (const row of sh.rows) expect(row.length).toBe(sh.columns.length)
      }
    }
  })

  it('opens every deck in the slide viewer with real slides', () => {
    const decks = files.filter((f) => f.slides)
    expect(decks.length).toBeGreaterThan(0)
    for (const d of decks) {
      expect(fileOpener(d).app).toBe('slides')
      expect(d.slides.length).toBeGreaterThan(0)
      for (const s of d.slides) expect(s.title).toBeTruthy()
    }
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
    expect(apps['한글2024_설치.exe']).toBe('installer')
    expect(apps['사원증_스캔.jpg']).toBe('viewer')
  })

  it('every paperwork file is .hwp, every scribble .txt, every certificate .pdf', () => {
    for (const f of files) {
      if (f.image) continue
      // hosts is a system file: Windows gives it no extension, and neither do we
      if (f.name === 'hosts') continue
      expect(f.name).toMatch(/\.(hwp|txt|pptx|xlsx|exe|pdf|dcx)$/)
    }
  })

  it('the intranet portal never states what the puzzle makes you look up', () => {
    // only the page body — credentials live outside it and are what gets checked
    const portal = JSON.stringify(scenario.sites.find((s) => s.layout === 'portal').portal)
    const wiki = scenario.sites.find((s) => s.layout === 'wiki')
    for (const keyword of goalFor(scenario, 1).requiredKeywords) expect(portal).not.toContain(keyword)
    expect(portal).not.toContain(wiki.login.password)
    expect(portal).not.toContain('입사일')   // the hire date belongs on the ID card scan
  })

  it('every portal board post opens onto something worth reading', () => {
    const portal = scenario.sites.find((s) => s.layout === 'portal').portal
    for (const post of [portal.notice, ...portal.news]) {
      expect(post.title.length).toBeGreaterThan(5)
      expect(post.author).toBeTruthy()
      expect(post.date).toMatch(/^\d{4}\.\d{2}\.\d{2}$/)
      expect(post.body.length).toBeGreaterThan(1)
    }
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
        // no dead dialogue: a reply trigger has to be something the thread can
        // actually offer, up front or as a follow-up
        if (r.choice) expect(offeredBy(t)).toContain(r.choice)
      }
    }
  })

  it('makes every typed answer obtainable somewhere in the game', () => {
    // Everything the player can read off or produce: file text, a photo's
    // description, a site, ipconfig output, a listing, the booking form, or
    // the printer's receipt.
    const world = JSON.stringify({
      files, sites: scenario.sites, network: scenario.network,
      places: scenario.places, booking: scenario.booking, printer: scenario.printer
    })
    // a question answered by dropping a file in has nothing to type
    const asks = threads.flatMap(asksOf).filter((a) => a.accept)
    expect(asks.length).toBeGreaterThan(0)
    for (const a of asks) {
      expect(a.accept.length).toBeGreaterThan(0)
      // an entry may be several parts that all have to appear in the answer
      for (const entry of a.accept.flat()) expect(world).toContain(entry)
    }
  })

  it('every question wants either typed text or a real file, never neither', () => {
    const known = new Set(files.map((f) => f.id))
    const asks = [...threads.flatMap(asksOf), ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask)))]
    expect(asks.some((a) => a.files)).toBe(true)
    for (const a of asks) {
      expect(Boolean(a.accept?.length) !== Boolean(a.files?.length)).toBe(true)
      for (const id of a.files ?? []) expect(known.has(id)).toBe(true)
    }
  })

  it('gates the intranet on an IP approval exactly one thread can grant', () => {
    for (const site of scenario.sites.filter((s) => s.login)) expect(site.requiresIp).toBe(true)
    const granting = threads.flatMap(asksOf).filter((a) => a.grants === 'ip')
    expect(granting).toHaveLength(1)
    expect(granting[0].accept).toContain(scenario.network.ip)
  })

  it('always lets a conversation end instead of looping', () => {
    for (const t of threads) {
      const reactions = t.reactions ?? []
      // choices handed out by a branch are only offered again if that branch
      // never changes — so any reaction answering one must move the state on
      const branched = new Set([
        ...reactions.flatMap((r) => r.next ?? []),
        ...asksOf(t).flatMap((a) => a.next ?? [])
      ])
      for (const r of reactions) {
        if (r.choice && branched.has(r.choice)) {
          expect(Array.isArray(r.next)).toBe(true)
        }
      }
    }
  })

  it('never hands a typed answer over as a clickable choice', () => {
    for (const t of threads) {
      for (const a of asksOf(t)) {
        for (const accepted of a.accept ?? []) {
          expect(offeredBy(t).some((c) => c.includes(accepted))).toBe(false)
        }
      }
    }
  })

  it('ties every objective to a state the game can actually reach', () => {
    const urls = new Set(scenario.sites.map((s) => s.url))
    // five ways to earn a grant: a chat question, a day's mail brief, a
    // question a day raises on arrival, a document fetched by mail, or
    // fixing the cell an objective names
    const granted = new Set([
      ...threads.flatMap(asksOf).map((a) => a.grants),
      ...scenario.days.map((d) => d.goal?.grants),
      ...Object.values(scenario.overtime?.days ?? {})
        .flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask))).map((a) => a.grants),
      ...(scenario.pool?.requests ?? []).flatMap((r) => chain(r.beat.ask)).map((a) => a.grants),
      // the antivirus grants this one by cleaning the machine, not by asking
      'cleanpc',
      ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask))).map((a) => a.grants),
      ...scenario.days.map((d) => d.fetch?.grants),
      ...scenario.objectives.filter((o) => o.cell).map((o) => o.grant)
    ].filter(Boolean))
    expect(scenario.objectives.length).toBeGreaterThan(0)
    for (const o of scenario.objectives) {
      expect(o.title).toBeTruthy()
      if (o.site) expect(urls.has(o.site)).toBe(true)
      if (o.grant) expect(granted.has(o.grant)).toBe(true)
      if (o.cell) {
        const sheet = files.find((f) => f.id === o.cell.file)?.sheets?.find((s) => s.name === o.cell.sheet)
        expect(sheet?.rows[o.cell.row]?.[o.cell.col]).toBeTruthy()
      }
      expect(Boolean(o.site) || Boolean(o.grant)).toBe(true)
    }
  })

  it('gives every day a brief, requests that exist, and a way to clock off', () => {
    const ids = new Set(scenario.objectives.map((o) => o.id))
    expect(scenario.days.length).toBeGreaterThan(1)
    scenario.days.forEach((d, i) => {
      expect(d.n).toBe(i + 1)
      expect(d.label && d.date).toBeTruthy()
      expect(d.requests.length).toBeGreaterThan(0)
      for (const r of d.requests) expect(ids.has(r)).toBe(true)
      expect(d.closing.length).toBeGreaterThan(0)
      expect(d.portal.notice.text).toBeTruthy()
      expect(d.portal.news.length).toBeGreaterThan(0)
    })
  })

  it('runs five days, growing from five requests to twenty-odd', () => {
    expect(scenario.days.map((d) => d.n)).toEqual([1, 2, 3, 4, 5])
    const sizes = scenario.days.map((d) => scenario.pool.sizes[d.n])
    expect(sizes[0]).toBe(scenario.days[0].requests.length)   // day one is fixed whole
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1])
    // every day can actually be filled: fixed core plus what the pool can offer
    scenario.days.slice(1).forEach((d) => {
      const ready = scenario.pool.requests.filter((r) => (scenario.pool.after[r.id] ?? 0) <= d.n)
      expect(d.requests.length).toBe(scenario.pool.fixed[d.n].length)
      expect(ready.length).toBeGreaterThanOrEqual(scenario.pool.sizes[d.n] - d.requests.length)
    })
  })

  it('never asks for the same request on two different days', () => {
    const all = scenario.days.flatMap((d) => d.requests)
    expect(new Set(all).size).toBe(all.length)
  })

  it('gives each day its own client, file and figure to reply with', () => {
    const files = new Set(allFiles(scenario.fs).map((f) => f.id))
    const inbox = new Set([
      ...scenario.mails.map((m) => m.id),
      ...scenario.days.flatMap((d) => (d.mails ?? []).map((m) => m.id))
    ])
    scenario.days.forEach((d, i) => {
      const g = goalFor(scenario, i + 1)
      expect(inbox.has(g.replyToMail)).toBe(true)
      expect(files.has(g.requiredAttachment)).toBe(true)
      expect(g.requiredKeywords.length).toBeGreaterThan(0)
      expect(g.grants).toBeTruthy()
    })
  })

  it('moves the notice board on as the days pass', () => {
    const boards = scenario.days.map((d) => JSON.stringify(d.portal))
    expect(new Set(boards).size).toBe(boards.length)
  })

  it('counts nothing solved at the start and everything at the end', () => {
    const fresh = { grants: {}, unlocked: {}, cleared: false }
    expect(scenario.objectives.filter((o) => objectiveDone(o, fresh))).toEqual([])

    const finished = {
      cleared: true,
      grants: Object.fromEntries(scenario.objectives.filter((o) => o.grant).map((o) => [o.grant, true])),
      unlocked: Object.fromEntries(scenario.objectives.filter((o) => o.site).map((o) => [o.site, true]))
    }
    expect(scenario.objectives.every((o) => objectiveDone(o, finished))).toBe(true)
  })

  it('has the boss complain about every way the reply can be wrong', () => {
    const c = scenario.goal.complain
    const boss = threads.find((t) => t.id === c.thread)
    expect(boss).toBeTruthy()
    expect(c.from).toBe(boss.name)
    for (const reason of ['attachment', 'keyword']) {
      expect(c[reason].length).toBeGreaterThan(0)
    }
  })

  it('file ids are unique', () => {
    const ids = files.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
