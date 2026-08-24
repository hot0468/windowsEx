import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { contentOf, findFile, hostNames, hostResolves, siteView, useGame } from '../src/engine/store.js'

const hosts = findFile(scenario.fs, scenario.hosts.file)
const drive = scenario.sites.find((s) => s.url === 'drive.ar.local')
const sotong = scenario.sites.find((s) => s.url === 'sotong.ar.local')
const written = (url) => `${scenario.hosts.required[url] ?? '192.168.10.21'}\t${url}`

describe('the hosts file', () => {
  beforeEach(() => useGame.setState({ edits: {}, unlocked: {}, grants: {} }))

  it('sits where Windows keeps it, and can be typed into', () => {
    expect(hosts).toBeTruthy()
    expect(hosts.editable).toBe(true)
    expect(hosts.name).toBe('hosts')
    const walk = (entries, trail) => entries.flatMap((e) =>
      e.children ? walk(e.children, [...trail, e.name]) : e.id === hosts.id ? [trail] : [])
    const [path] = Object.entries(scenario.fs).flatMap(([root, es]) => walk(es, [root]))
    expect(path.join('/')).toContain('Windows/System32/drivers/etc')
  })

  it('reads an address per name, ignoring comments and blank lines', () => {
    const names = hostNames(hosts.content)
    expect(names['localhost']).toBeTruthy()   // ::1 overwrites 127.0.0.1, as it would
    expect(names['rhino.acme.com']).toBeUndefined()   // commented out
    expect(Object.keys(names)).not.toContain('#')
  })

  it('ships with someone else\'s room already in it', () => {
    expect(hostNames(hosts.content)['sotong.ar.local']).toBeTruthy()
    expect(scenario.hosts.required['sotong.ar.local']).toBeUndefined()
  })

  it('leaves the drive unnamed until the player adds the line', () => {
    expect(hostNames(hosts.content)['drive.ar.local']).toBeUndefined()
    expect(hostResolves(scenario, {}, 'drive.ar.local')).toBe(false)
    const edits = { [hosts.id]: hosts.content + '\n' + written('drive.ar.local') }
    expect(hostResolves(scenario, edits, 'drive.ar.local')).toBe(true)
    // the address has to be the one the request named
    const wrong = { [hosts.id]: hosts.content + '\n10.0.0.1  drive.ar.local' }
    expect(hostResolves(scenario, wrong, 'drive.ar.local')).toBe(false)
  })

  it('keeps a host-only site unreachable until then', () => {
    expect(siteView(drive, { grants: {}, unlocked: {}, resolves: false, vpn: true })).toBe('error')
    expect(siteView(drive, { grants: {}, unlocked: {}, resolves: true, vpn: true })).toBe('ready')
    expect(siteView(sotong, { grants: {}, unlocked: {}, resolves: true })).toBe('ready')
  })

  it('remembers what the player saved', () => {
    const text = hosts.content + '\n192.168.10.21  drive.ar.local'
    useGame.getState().editFile(hosts.id, text)
    expect(contentOf(hosts, useGame.getState().edits)).toBe(text)
    expect(hostResolves(scenario, useGame.getState().edits, 'drive.ar.local')).toBe(true)
  })
})

describe('what the hosts file leads to', () => {
  it('makes the drive a request the player can finish by getting in', () => {
    const objective = scenario.objectives.find((o) => o.id === 'drive')
    expect(objective.site).toBe(drive.url)
    expect(scenario.days.some((d) => d.requests.includes('drive'))).toBe(true)
    const beat = scenario.days.flatMap((d) => d.asks ?? [])
      .find((a) => a.lines.some((l) => l.includes('hosts')))
    expect(beat.thread).toBe('security')
    expect(beat.lines.join(' ')).toContain(scenario.hosts.required[drive.url])
    expect(beat.lines.join(' ')).toContain(drive.url)
  })

  it('hides an anonymous room nobody advertises', () => {
    expect(sotong.board.posts.length).toBeGreaterThan(2)
    for (const post of sotong.board.posts) {
      expect(post.body.length).toBeGreaterThan(0)
      for (const c of post.comments) expect(c.author && c.text).toBeTruthy()
    }
    // it is not on any bookmark bar or search result, only in the hosts file
    expect(scenario.bookmarks.some((b) => b.url === sotong.url)).toBe(false)
    expect(scenario.history.some((h) => h.url === sotong.url)).toBe(false)
  })

  it('never lets either hidden page give a puzzle answer away', () => {
    const chain = (a) => (a ? [a, ...chain(a.then)] : [])
    const threads = [scenario.workMessenger, scenario.privateMessenger]
      .flatMap((m) => m.sections.flatMap((s) => s.threads))
    const answers = [
      ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(chain),
      ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => chain(a.ask))),
      ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => chain(a.ask)))
    ].flatMap((a) => a?.accept?.flat() ?? [])
    // the page contents, not the addresses — the DNS suffix is an answer of its own
    const pages = JSON.stringify({ drive: drive.wiki, sotong: sotong.board })
    for (const answer of new Set(answers)) expect(pages).not.toContain(answer)
  })
})
