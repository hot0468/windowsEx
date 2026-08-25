import { describe, it, expect } from 'vitest'
import { APPS, startMenuApps } from '../src/apps/registry.jsx'

const names = (grants) => startMenuApps(grants).map(([key]) => key)

describe('the start menu', () => {
  it('leaves out what nothing on this PC launches from a menu', () => {
    expect(names({})).not.toContain('devtools')
    expect(names({})).not.toContain('installer')
    // still openable — the browser and a setup file open them by name
    expect(APPS.devtools && APPS.installer).toBeTruthy()
  })

  it('leaves out a program that has not been installed yet', () => {
    expect(names({})).not.toContain('dcx')
    expect(names({})).not.toContain('vpn')
    expect(names({})).not.toContain('hwp')
  })

  it('lists it once it is installed', () => {
    expect(names({ dviewer: true })).toContain('dcx')
    expect(names({ vpnInstalled: true })).toContain('vpn')
    expect(names({ hangul: true })).toContain('hwp')
  })

  it('still lists the programs that come with the PC', () => {
    expect(names({})).toContain('explorer')
    expect(names({})).toContain('browser')
  })

  it('names a grant that some program actually issues', async () => {
    const scenario = JSON.parse(
      await import('node:fs').then((fs) => fs.readFileSync('src/scenarios/workday.json', 'utf8'))
    )
    const issued = Object.values(scenario.programs).map((p) => p.grant)
    for (const [key, a] of Object.entries(APPS)) {
      if (a.grant) expect(issued, `${key}`).toContain(a.grant)
    }
  })
})
