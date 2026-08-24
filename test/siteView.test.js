import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { siteView } from '../src/engine/store.js'

const wiki = scenario.sites.find((s) => s.layout === 'wiki')
const none = { grants: {}, unlocked: {} }
const approved = { grants: { ip: true }, unlocked: {} }
const inside = { grants: { ip: true }, unlocked: { [wiki.url]: true } }

describe('siteView', () => {
  it('reports an unknown address as an error', () => {
    expect(siteView(undefined, none)).toBe('error')
  })

  it('blocks an unapproved machine before it can even log in', () => {
    expect(siteView(wiki, none)).toBe('blocked')
  })

  it('asks for credentials once the IP is approved', () => {
    expect(siteView(wiki, approved)).toBe('login')
  })

  it('shows the page only after both gates', () => {
    expect(siteView(wiki, inside)).toBe('ready')
  })

  it('opens a site that needs neither gate straight away', () => {
    expect(siteView({ url: 'x' }, none)).toBe('ready')
  })

  it('lands on exactly one state for every site in every situation', () => {
    const states = ['error', 'blocked', 'vpn', 'login', 'ready']
    for (const site of scenario.sites) {
      for (const world of [none, approved, inside]) {
        expect(states).toContain(siteView(site, world))
      }
    }
  })
})
