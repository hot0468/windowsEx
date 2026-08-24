import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { answerFits, siteView } from '../src/engine/store.js'

const site = scenario.sites.find((s) => s.down)
const request = scenario.pool.requests.find((r) => r.id === site.down)

describe('the site that answers 500 until 보안팀 fixes it', () => {
  it('is down with the IP approved and up once the error has been reported', () => {
    expect(siteView(site, { grants: { ip: true }, unlocked: {} })).toBe('down')
    expect(siteView(site, { grants: { ip: true, [site.down]: true }, unlocked: {} })).toBe('ready')
  })

  it('shows the error the security team wants, in red, in the console', () => {
    const errors = site.console.filter((l) => l.level === 'error')
    expect(errors.length).toBeGreaterThan(0)
    for (const a of request.beat.ask.accept) {
      expect(errors.some((l) => l.text.includes(a))).toBe(true)
      // the fix must not be readable off the page that is down
      expect(site.content).not.toContain(a)
    }
  })

  it('takes the console line pasted whole, and refuses the page error', () => {
    const line = site.console.find((l) => l.level === 'error')
    expect(answerFits(request.beat.ask, `${line.text} ${line.at}`)).toBe(true)
    expect(answerFits(request.beat.ask, 'HTTP ERROR 500')).toBe(false)
  })

  it('cannot be drawn before the IP approval day is over', () => {
    expect(scenario.pool.after[request.id]).toBeGreaterThanOrEqual(2)
    expect(request.beat.thread).toBe('security')
  })
})

describe('the developer tools window', () => {
  it('opens beside the browser as a window of its own, and shows what the browser logged', async () => {
    const { APPS } = await import('../src/apps/registry.jsx')
    const { useGame } = await import('../src/engine/store.js')
    expect(APPS.devtools).toBeTruthy()
    useGame.setState({ windows: [], mining: false })
    useGame.getState().openWindow('browser')
    useGame.getState().openWindow('devtools')
    expect(useGame.getState().windows.map((w) => w.app)).toEqual(['browser', 'devtools'])
    useGame.getState().setBrowserDev({ console: site.console, network: [] })
    expect(useGame.getState().browserDev.console).toBe(site.console)
  })

  it('shows the broken site answering 500 in the network tab', async () => {
    const { networkRows } = await import('../src/apps/Browser.jsx')
    const page = { kind: 'site', url: site.url, path: '' }
    expect(networkRows(page, site, 'down').find((r) => r.type === 'document').status).toBe(500)
    expect(networkRows(page, site, 'ready').find((r) => r.type === 'document').status).toBe(200)
    expect(networkRows(page, null, 'error').find((r) => r.type === 'document').status).toBe('(failed)')
  })
})
