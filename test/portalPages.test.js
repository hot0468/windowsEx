import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { pathKnown, portalFeed } from '../src/engine/store.js'

const portal = scenario.sites.find((s) => s.url === 'portal.ar.co.kr')
const jsx = readFileSync('src/apps/Portal.jsx', 'utf8')
// the one table that decides which view a path gets
const table = jsx.slice(jsx.indexOf('const SUBPAGES'), jsx.indexOf(']\n', jsx.indexOf('const SUBPAGES')))
const shapes = [...table.matchAll(/'([a-z]+)'/g)].map((m) => m[1])

// Renaming a page's data field used to leave it matching nothing and falling
// through to whichever view came last, which crashed on the wrong fields.
describe('every page the portal can be sent to', () => {
  it('knows more than one shape, and reads them off one table', () => {
    expect(shapes.length).toBeGreaterThan(3)
  })

  it('carries exactly one shape the portal draws', () => {
    for (const [path, page] of Object.entries(portal.pages)) {
      const hit = shapes.filter((k) => page[k])
      expect(hit, `${path} — ${Object.keys(page)}`).toHaveLength(1)
    }
  })

  // 예전에는 인사관리 하나만 살아 있어서 "/hr 메뉴에 있는가"로 충분했다.
  // 이제 상단 메뉴 다섯이 모두 어딘가를 열므로, 닿는 길을 전부 모아서 본다.
  const linked = () => {
    const out = new Set(Object.values(portal.portal.navLinks ?? {}))
    for (const page of Object.values(portal.pages)) {
      for (const m of page.menu ?? []) out.add(m.path)
      for (const l of page.profile?.links ?? []) out.add(l.path)
    }
    return out
  }

  it('is reachable from the top menu, or from a page the top menu opens', () => {
    for (const path of Object.keys(portal.pages)) expect(linked().has(path), path).toBe(true)
  })

  it('never sends the player somewhere that is not there', () => {
    for (const path of linked()) expect(pathKnown(portal, path), path).toBe(true)
  })
})

// 상단 메뉴 다섯 개 중 넷이 링크 없이 <span>으로 그려져 눌리지 않았다.
describe('the portal top menu', () => {
  const p = portal.portal

  it('leaves no menu dead', () => {
    for (const label of p.nav) expect(p.navLinks?.[label], label).toBeTruthy()
  })

  it('opens sections the portal actually carries', () => {
    for (const [path, page] of Object.entries(portal.pages)) {
      if (!page.list) continue
      expect(Array.isArray(p[page.list]), `${path} → ${page.list}`).toBe(true)
    }
  })

  // 이 작업의 목적 그 자체. 홈이 이미 전부를 그리면 메뉴 페이지는 같은 화면을
  // 한 번 더 그리는 것뿐이고, 메뉴를 살린 의미가 없다.
  // 두 수는 Portal.jsx의 HOME_ROWS · HOME_NEWS에서 읽는다 — 홈이 자르는 수가
  // 바뀌면 이 검사도 같이 따라와야 하므로 베껴 적지 않는다.
  const numberIn = (name) => Number(jsx.match(new RegExp('const ' + name + ' = ([0-9]+)'))[1])

  it('keeps something the home page does not already show', () => {
    const rows = numberIn('HOME_ROWS')
    const news = numberIn('HOME_NEWS')
    expect(p.docs.length).toBeGreaterThan(rows)
    expect(p.tasks.length).toBeGreaterThan(rows)
    // 소식은 날짜에 따라 쌓인다. 1일차에는 적을 수 있으므로 마지막 날로 본다.
    expect(portalFeed(scenario, p, scenario.days.length).length).toBeGreaterThan(news)
  })

  it('cuts the home page down to the newest', () => {
    for (const rows of [p.docs, p.tasks]) {
      const dates = rows.map((r) => r.date)
      expect([...dates].sort().reverse()).toEqual(dates)
    }
  })
})
