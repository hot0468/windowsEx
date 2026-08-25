import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { ipFits, resolveSite, siteView, useGame } from '../src/engine/store.js'

// A paper jam needs hands, and this office is only ever seen through a monitor.
// What a screen can fix is a PC the copier was never told about: the print is
// refused, and the player registers their own address on the copier's page.
const printer = scenario.printer
const site = () => resolveSite(scenario, {}, '192.168.10.9')
const web = () => site().printerweb
const wikiPage = Object.values(
  scenario.sites.find((s) => s.url === 'wiki.ar.co.kr').wiki.pages
).find((p) => p.title === '사무기기 안내')
const g = () => useGame.getState()

describe('getting the copier to print at all', () => {
  beforeEach(() => useGame.setState({ mfpFixed: false }))

  it('is reachable by typing the address, with no hosts edit', () => {
    expect(site().url).toBe('print.ar.local')
    expect(site().requiresHost).toBeUndefined()
    expect(siteView(site(), { grants: {}, unlocked: {}, resolves: false, vpn: false })).toBe('ready')
  })

  it('refuses the job because this PC is not registered', () => {
    expect(printer.error.code).toBe('E-12')
    expect(web().queue[0].state).toContain('거부')
    // and the neighbours plainly are registered, so the gap is visible
    expect(web().devices.length).toBeGreaterThan(1)
    expect(web().devices.some((d) => d.ip === scenario.network.ip)).toBe(false)
  })

  it('accepts this machine’s own address and nothing else', () => {
    expect(g().registerMfp('192.168.10.44')).toBe('bad')   // a colleague's PC
    expect(g().registerMfp('192.168.10.9')).toBe('bad')    // the copier itself
    expect(g().mfpFixed).toBe(false)
    expect(g().registerMfp(scenario.network.ip)).toBe('done')
    expect(g().mfpFixed).toBe(true)
  })

  it('forgives spacing, but not a different address', () => {
    expect(ipFits('192.168.10.47', ' 192.168.10.47 ')).toBe(true)
    expect(ipFits('192.168.10.47', '192.168.10.4')).toBe(false)
    expect(ipFits('192.168.10.47', '192.168.010.47')).toBe(false)
  })

  it('stays registered once registered', () => {
    g().registerMfp(scenario.network.ip)
    expect(g().registerMfp(scenario.network.ip)).toBe('taken')
    expect(g().mfpFixed).toBe(true)
  })

  it('says where the address comes from, without saying what it is', () => {
    const written = JSON.stringify({
      wiki: wikiPage, web: web(), remote: printer.remote,
      blocked: printer.blocked, error: printer.error
    })
    expect(written).toContain('ipconfig')            // how to find it
    expect(written).not.toContain(scenario.network.ip)  // never the answer itself
    expect(written).not.toContain(printer.receipt)      // nor the receipt
  })

  it('points the player at the copier instead of miming a pair of hands', () => {
    expect(printer.error.help).toContain('192.168.10.9')
    expect(wikiPage.intro).toContain('192.168.10.9')
    expect(wikiPage.table.rows.some((r) => r[0] === 'E-12')).toBe(true)
    // no sequence of physical steps survives anywhere
    expect(printer.steps).toBeUndefined()
    expect(printer.buttons).toBeUndefined()
    expect(wikiPage.list).toBeUndefined()
  })
})
