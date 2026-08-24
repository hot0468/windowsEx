import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, findFile, hostResolves, useGame } from '../src/engine/store.js'

const HOSTS = findFile(scenario.fs, scenario.hosts.file)
const files = allFiles(scenario.fs)
const line = `${scenario.hosts.required['vpn.ar.local']} vpn.ar.local`

describe('the VPN client', () => {
  it('will not connect until hosts knows the server', () => {
    expect(hostResolves(scenario, {}, 'vpn.ar.local')).toBe(false)
    expect(hostResolves(scenario, { [HOSTS.id]: `${HOSTS.content}\n${line}` }, 'vpn.ar.local')).toBe(true)
  })

  it('refuses an address that is close but wrong', () => {
    const wrong = { [HOSTS.id]: `${HOSTS.content}\n192.168.10.6 vpn.ar.local` }
    expect(hostResolves(scenario, wrong, 'vpn.ar.local')).toBe(false)
  })

  it('keeps the session id out of every line of the script', () => {
    const text = JSON.stringify({ ...scenario, vpn: null })
    expect(text).not.toContain(scenario.vpn.session)
  })

  it('puts the hosts line in the guide, where a stuck player can find it', () => {
    const guide = files.find((f) => f.id === 'file_vpn_guide')
    expect(guide).toBeTruthy()
    expect(guide.content).toContain(scenario.hosts.required['vpn.ar.local'])
    expect(guide.content).toContain('vpn.ar.local')
  })
})

describe('the VPN switch', () => {
  beforeEach(() => useGame.setState({ vpn: false }))

  it('turns on and off, and a restart drops it', () => {
    useGame.getState().setVpn(true)
    expect(useGame.getState().vpn).toBe(true)
    useGame.getState().restart()
    expect(useGame.getState().vpn).toBe(false)
  })
})
