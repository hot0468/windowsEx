import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import scenario from '../src/scenarios/workday.json'
import {
  allFiles, parseAddress, pathKnown, resolveSite, searchSites, specialPage
} from '../src/engine/store.js'
import Router from '../src/apps/Router.jsx'
import PrinterWeb from '../src/apps/PrinterWeb.jsx'
import Phish from '../src/apps/Phish.jsx'
import Wiki from '../src/apps/Wiki.jsx'
import Portal from '../src/apps/Portal.jsx'

const site = (url) => scenario.sites.find((s) => s.url === url)
const wiki = site('wiki.ar.co.kr')
const portal = site('portal.ar.co.kr')
const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const acceptsOf = (id) => steps(scenario.pool.requests.find((r) => r.id === id).beat.ask).flatMap((a) => a.accept.flat())

describe('reading the address bar', () => {
  it('splits host and path, forgiving protocol, case and a trailing slash', () => {
    expect(parseAddress(' HTTPS://Wiki.AR.co.kr/Asset/ ')).toEqual({ host: 'wiki.ar.co.kr', path: '/asset' })
    expect(parseAddress('portal.ar.co.kr')).toEqual({ host: 'portal.ar.co.kr', path: '' })
    expect(parseAddress('192.168.10.9/')).toEqual({ host: '192.168.10.9', path: '' })
    expect(parseAddress('')).toEqual({ host: '', path: '' })
  })

  it('finds a site by name, or by the address its name points at', () => {
    expect(resolveSite(scenario, {}, 'print.ar.local').url).toBe('print.ar.local')
    expect(resolveSite(scenario, {}, '192.168.10.9').url).toBe('print.ar.local')
    expect(resolveSite(scenario, {}, scenario.hosts.required['drive.ar.local']).url).toBe('drive.ar.local')
    expect(resolveSite(scenario, {}, '192.168.10.1').url).toBe('192.168.10.1')
    expect(resolveSite(scenario, {}, '10.0.0.1')).toBeNull()
    expect(resolveSite(scenario, {}, 'nope.example')).toBeNull()
  })

  it('treats a blank tab as its own page', () => {
    expect(specialPage('about:blank')).toBe('blank')
    expect(specialPage('wiki.ar.co.kr')).toBeNull()
  })

  it('still has something listening on the machine itself', () => {
    // the last occupant left a notes server running; both ways of naming
    // this machine reach it, and the hosts file is what ties them together
    expect(specialPage('127.0.0.1')).toBeNull()
    expect(resolveSite(scenario, {}, '127.0.0.1').layout).toBe('notes')
    expect(resolveSite(scenario, {}, 'localhost').url).toBe('127.0.0.1')
  })

  it('knows which paths exist on a site and 404s the rest', () => {
    expect(pathKnown(wiki, '')).toBe(true)
    expect(pathKnown(wiki, '/asset')).toBe(true)
    expect(pathKnown(wiki, '/nothing')).toBe(false)
    expect(pathKnown(portal, '/hr/events')).toBe(true)
    expect(pathKnown(portal, '/hr')).toBe(true)
    expect(pathKnown(portal, '/hr/nothing')).toBe(false)
    expect(pathKnown(site('toegeun.kr'), '/x')).toBe(false)
  })
})

describe('what the addresses lead to', () => {
  it('keeps the hidden wiki page off the sidebar and explains the rule on a 404', () => {
    const listed = wiki.wiki.nav.flatMap((s) => s.pages.map((p) => p.id))
    expect(listed).not.toContain('asset')
    expect(wiki.wiki.pages.asset.title).toBeTruthy()
    expect(wiki.notFound).toContain('/asset')
  })

  it('lists the router, the phishing page and the parked domain nowhere', () => {
    for (const url of ['192.168.10.1', 'ar-security.co.kr', 'emart-corp.co.kr']) {
      const s = site(url)
      expect(s.unlisted, url).toBe(true)
      expect(scenario.bookmarks.some((b) => b.url === url)).toBe(false)
      expect(scenario.history.some((h) => h.url === url)).toBe(false)
      expect(searchSites(scenario.sites, url.split('.')[0])).not.toContain(s)
    }
  })

  it('gives every client a site the search results can link to', () => {
    for (const c of scenario.companies.filter((c) => c.url)) {
      // 회사 페이지로 그려지기만 하면 된다. C테크는 한 장짜리 vendor 대신
      // 층이 있는 corp 화면을 쓴다 — 검색 결과가 가리키는 곳이 실제로 열리고
      // 회사 페이지로 보이는가가 이 검사의 요지다.
      expect(['vendor', 'corp'], c.url).toContain(site(c.url)?.layout)
    }
    expect(scenario.companies.filter((c) => c.url).length).toBeGreaterThanOrEqual(3)
  })

  it('shows the machine the player is sitting at on the router', () => {
    const r = site('192.168.10.1').router
    const me = r.devices.find((d) => d.ip === scenario.network.ip)
    expect(me.name).toBe(scenario.network.host)
    expect(me.mac).toBe(scenario.network.mac)
  })

  it('never puts the print receipt on the printer web page', () => {
    expect(JSON.stringify(site('print.ar.local'))).not.toContain(scenario.printer.receipt)
  })

  it('keeps each new answer in exactly the one place its request points at', () => {
    const files = JSON.stringify(allFiles(scenario.fs))
    const only = (id, url) => {
      const here = JSON.stringify(site(url))
      const elsewhere = JSON.stringify(scenario.sites.filter((s) => s.url !== url))
      for (const a of acceptsOf(id)) {
        expect(here, `${id}: ${a} on ${url}`).toContain(a)
        expect(elsewhere, `${id}: ${a} leaks to another site`).not.toContain(a)
        expect(files, `${id}: ${a} leaks to a file`).not.toContain(a)
      }
    }
    only('aaddr', 'asangsa.co.kr')
    only('cfax', 'ctech.co.kr')
    only('assetno', 'wiki.ar.co.kr')
    only('rsvp', 'portal.ar.co.kr')
  })

  it('points the asset request at the path, since nothing else does', () => {
    const r = scenario.pool.requests.find((r) => r.id === 'assetno')
    expect(r.beat.lines.join(' ')).toContain('/asset')
  })

  it('makes the phishing page pay off with a telling-off, not a login', () => {
    const p = site('ar-security.co.kr')
    expect(p.login).toBeUndefined()
    expect(p.phish.after.thread).toBe('security')
    expect(p.phish.after.lines.length).toBeGreaterThan(1)
  })
})

describe('the new pages render', () => {
  const html = (el) => renderToString(el)
  it('router, printer, phishing, hidden wiki page and the events form', () => {
    expect(html(createElement(Router, { site: site('192.168.10.1') }))).toContain(scenario.network.host)
    expect(html(createElement(PrinterWeb, { site: site('print.ar.local') }))).toContain(scenario.printer.error.code)
    expect(html(createElement(Phish, { site: site('ar-security.co.kr') }))).toContain('비밀번호')
    expect(html(createElement(Wiki, { site: wiki, path: '/asset' }))).toContain(wiki.wiki.pages.asset.title)
    expect(html(createElement(Portal, { site: portal, path: '/hr/events' }))).toContain(portal.pages['/hr/events'].title)
  })
})
