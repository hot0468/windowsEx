import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { siteView } from '../src/engine/store.js'

const site = scenario.sites.find((s) => s.layout === 'board')
const chain = (ask) => (ask ? [ask, ...chain(ask.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))

describe('퇴근길 board', () => {
  it('is an outside site: no approval, no login', () => {
    expect(siteView(site, { grants: {}, unlocked: {} })).toBe('ready')
    expect(scenario.bookmarks.some((b) => b.url === site.url)).toBe(true)
  })

  it('every post is complete and every comment has a voice', () => {
    expect(site.board.posts.length).toBeGreaterThan(5)
    const ids = site.board.posts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of site.board.posts) {
      expect(p.title && p.company && p.author && p.time).toBeTruthy()
      expect(p.body.length).toBeGreaterThan(0)
      for (const c of p.comments) expect(c.author && c.text && c.time).toBeTruthy()
    }
  })

  it('never gives a puzzle answer away', () => {
    const board = JSON.stringify(site.board)
    const answers = [
      ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(chain),
      ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask)))
    ].flatMap((a) => a.accept?.flat() ?? [])
    const secrets = [
      ...answers,
      ...scenario.days.flatMap((d) => d.goal.requiredKeywords),
      ...scenario.sites.filter((s) => s.login).map((s) => s.login.password),
      scenario.printer.receipt
    ]
    for (const s of secrets) expect(board).not.toContain(s)
  })
})
