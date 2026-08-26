import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { hostAddresses, resolveSite, searchSites, siteView, specialPage } from '../src/engine/store.js'

const chain = (a) => (a ? [a, ...chain(a.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const asks = [
  ...threads.flatMap((t) => [...chain(t.ask), ...(t.reactions ?? []).flatMap((r) => chain(r.ask))]),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask))),
  ...scenario.pool.requests.flatMap((r) => chain(r.beat.ask)),
  // the caller's questions are questions too
  ...chain(scenario.summons?.beat?.ask),
  ...Object.values(scenario.overtime?.days ?? {}).flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask)))
].filter(Boolean)

const site = () => resolveSite(scenario, {}, '127.0.0.1')

describe('what is still running on this machine', () => {
  it('answers on both names for the machine itself', () => {
    // it used to refuse the connection; something is listening now
    expect(specialPage('127.0.0.1')).toBeNull()
    expect(site().layout).toBe('notes')
    expect(resolveSite(scenario, {}, 'localhost').url).toBe('127.0.0.1')
  })

  it('reaches it past the ::1 line that wins the name', () => {
    // hosts lists localhost twice; the later line takes the name, so a lookup
    // that only reads the winner never finds the v4 address anything serves on
    expect(hostAddresses(scenario, {}, 'localhost')).toContain('127.0.0.1')
    expect(hostAddresses(scenario, {}, 'localhost').length).toBeGreaterThan(1)
  })

  it('opens with no approval, tunnel or login in the way', () => {
    expect(siteView(site(), { grants: {}, unlocked: {}, resolves: true, vpn: false })).toBe('ready')
  })

  it('is reachable only by typing the address', () => {
    for (const q of ['메모', 'localhost', '127', '노트']) {
      expect(searchSites(scenario.sites, q).map((s) => s.url)).not.toContain('127.0.0.1')
    }
    expect(scenario.bookmarks.some((b) => b.url === '127.0.0.1')).toBe(false)
    expect(scenario.history.some((h) => h.url === '127.0.0.1')).toBe(false)
  })

  it('is left by someone, and stops mid-sentence', () => {
    const n = site().notes
    expect(n.entries.length).toBeGreaterThan(3)
    for (const e of n.entries) expect(e.lines.length).toBeGreaterThan(0)
    expect(n.entries.at(-1).cut).toBe(true)
    expect(n.uptime).toBeTruthy()
  })

  it('is lore, not a hint: it answers nothing and names no address', () => {
    const blob = JSON.stringify(site().notes)
    const leaks = asks.flatMap((a) => (a.accept ?? []).flatMap((e) => (Array.isArray(e) ? e : [e])))
      .filter((p) => String(p).length >= 3 && blob.includes(String(p)))
    expect(leaks).toEqual([])
    expect(blob).not.toContain(scenario.floor8.ip)
    expect(blob).not.toContain(scenario.floor8.host)
  })
})
