import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { pathKnown } from '../src/engine/store.js'

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

  it('is reachable from the menu, or is the menu', () => {
    const menu = portal.pages['/hr'].menu.map((m) => m.path)
    for (const path of Object.keys(portal.pages)) {
      expect(path === '/hr' || menu.includes(path), path).toBe(true)
    }
    for (const path of menu) expect(pathKnown(portal, path), path).toBe(true)
  })
})
