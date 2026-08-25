import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { resolveSite, siteView, useGame } from '../src/engine/store.js'

// You only ever see this office through a monitor, so the paper jam is cleared
// from the copier's web page — remote maintenance — and not by clicking
// "open the rear cover" in a print dialog.
const printer = scenario.printer
const site = () => resolveSite(scenario, {}, '192.168.10.9')
const wikiPage = Object.values(
  scenario.sites.find((s) => s.url === 'wiki.ar.co.kr').wiki.pages
).find((p) => p.title === '사무기기 안내')
const g = () => useGame.getState()

describe('clearing the jam from the copier itself', () => {
  beforeEach(() => useGame.setState({ mfpStep: 0, mfpFixed: false }))

  it('is reachable by typing the address, with no hosts edit', () => {
    expect(site().url).toBe('print.ar.local')
    expect(site().requiresHost).toBeUndefined()
    expect(siteView(site(), { grants: {}, unlocked: {}, resolves: false, vpn: false })).toBe('ready')
  })

  it('clears when the commands go in the order the wiki gives', () => {
    for (const id of printer.steps) g().sendMfp(id)
    expect(g().mfpFixed).toBe(true)
    expect(g().mfpStep).toBe(printer.steps.length)
  })

  it('jams again on a command out of order', () => {
    g().sendMfp(printer.steps[0])
    expect(g().mfpStep).toBe(1)
    g().sendMfp('toner')            // a real button, wrong moment
    expect(g().mfpStep).toBe(0)
    expect(g().mfpFixed).toBe(false)
  })

  it('stays fixed once fixed', () => {
    for (const id of printer.steps) g().sendMfp(id)
    g().sendMfp('toner')
    expect(g().mfpFixed).toBe(true)
  })

  it('says the same sequence on the wiki as the page offers', () => {
    const labels = printer.steps.map((id) => printer.buttons.find((b) => b.id === id).label)
    expect(wikiPage.list).toEqual(labels)
    // and the decoys are offered but never in the sequence
    const decoys = printer.buttons.filter((b) => !printer.steps.includes(b.id))
    expect(decoys.length).toBeGreaterThan(0)
    for (const d of decoys) expect(wikiPage.list).not.toContain(d.label)
  })

  it('sends the player to the address instead of miming a pair of hands', () => {
    expect(printer.error.help).toContain('192.168.10.9')
    expect(printer.blocked.join(' ')).toBeTruthy()
    expect(wikiPage.intro).toContain('192.168.10.9')
  })

  it('keeps the receipt out of everything written down in advance', () => {
    // the number only exists once the queue actually reprints
    const written = JSON.stringify({
      wiki: wikiPage, web: site().printerweb, blocked: printer.blocked, remote: printer.remote
    })
    expect(written).not.toContain(printer.receipt)
  })
})
