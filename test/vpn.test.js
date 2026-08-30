import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, findFile, hostResolves, siteView, useGame } from '../src/engine/store.js'

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

  it('keeps the session id out of everything written down in advance', () => {
    const threads = [scenario.workMessenger, scenario.privateMessenger]
      .flatMap((m) => m.sections.flatMap((s) => s.threads))
    const beats = scenario.days.flatMap((d) => [d.opening, ...(d.asks ?? [])].filter(Boolean))
    const said = beats.flatMap((b) => b.lines ?? [])
    const hints = beats.flatMap((b) => (b.ask?.no ?? []).flat())
    const written = JSON.stringify({
      threads, said, hints, files, sites: scenario.sites, news: scenario.news, qna: scenario.qna
    })
    expect(written).not.toContain(scenario.vpn.session)
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

  // 클라이언트 창과 트레이 팝오버가 같은 길(dialVpn)을 쓴다. 어느 쪽에서든
  // hosts 에 이름이 없으면 못 붙고, 붙는 데는 시간이 걸린다.
  describe('dialing from anywhere', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      useGame.setState({ vpn: false, vpnDialing: false, edits: {} })
    })
    afterEach(() => vi.useRealTimers())

    it('refuses while hosts does not know the server, and touches nothing', () => {
      expect(useGame.getState().dialVpn()).toBe(false)
      expect(useGame.getState().vpnDialing).toBe(false)
      vi.runAllTimers()
      expect(useGame.getState().vpn).toBe(false)
    })

    it('connects after a moment once the name resolves', () => {
      useGame.setState({ edits: { [HOSTS.id]: `${HOSTS.content}
${line}` } })
      expect(useGame.getState().dialVpn()).toBe(true)
      expect(useGame.getState().vpnDialing).toBe(true)
      expect(useGame.getState().vpn).toBe(false)
      vi.advanceTimersByTime(1800)
      expect(useGame.getState().vpn).toBe(true)
      expect(useGame.getState().vpnDialing).toBe(false)
    })

    it('drops from the tray the same way the client does', () => {
      useGame.setState({ vpn: true })
      useGame.getState().dropVpn()
      expect(useGame.getState().vpn).toBe(false)
    })

    it('dialing twice does not start two timers', () => {
      useGame.setState({ edits: { [HOSTS.id]: `${HOSTS.content}
${line}` } })
      useGame.getState().dialVpn()
      const pending = vi.getTimerCount()
      useGame.getState().dialVpn()
      expect(vi.getTimerCount()).toBe(pending)
    })
  })
})

const site = (url) => scenario.sites.find((s) => s.url === url)
const hostsWith = (...lines) => ({ [HOSTS.id]: [HOSTS.content, ...lines].join('\n') })

describe('the drive behind the tunnel', () => {
  const drive = () => site('drive.ar.local')
  const ok = hostsWith('192.168.10.21 drive.ar.local')

  it('asks for the VPN before it complains about the name', () => {
    expect(siteView(drive(), { grants: {}, unlocked: {}, resolves: true, vpn: false })).toBe('vpn')
  })

  it('opens once the tunnel is up and the name resolves', () => {
    expect(hostResolves(scenario, ok, 'drive.ar.local')).toBe(true)
    expect(siteView(drive(), { grants: {}, unlocked: {}, resolves: true, vpn: true })).toBe('ready')
  })

  it('still fails on the name when the tunnel is up but hosts is empty', () => {
    expect(siteView(drive(), { grants: {}, unlocked: {}, resolves: false, vpn: true })).toBe('error')
  })

  it('leaves the anonymous room outside the tunnel', () => {
    expect(siteView(site('sotong.ar.local'), { grants: {}, unlocked: {}, resolves: true, vpn: false }))
      .toBe('ready')
  })
})

describe('the day that asks for a session id', () => {
  const day = scenario.days.find((d) => d.requests.includes('vpn'))

  it('is the second day, and its core matches the pool', () => {
    expect(day.n).toBe(2)
    expect([...day.requests].sort()).toEqual([...scenario.pool.fixed[2]].sort())
  })

  it('accepts the session id and nothing else', () => {
    const beat = day.asks.find((a) => a.thread === 'security')
    expect(beat.ask.grants).toBe('vpn')
    expect(beat.ask.accept).toEqual([scenario.vpn.session])
    expect(beat.ask.no.length).toBeGreaterThan(2)
  })

  it('has an objective the progress list can show', () => {
    expect(scenario.objectives.find((o) => o.id === 'vpn').grant).toBe('vpn')
  })

  it('puts the installer in the portal 자료실, not in the folder tree', () => {
    const shelf = site('portal.ar.co.kr').files
    expect(shelf.some((f) => f.download.fileId === 'file_vpn_setup')).toBe(true)
    for (const f of shelf) {
      const file = files.find((x) => x.id === f.download.fileId)
      expect(file, f.download.fileId).toBeTruthy()
      expect(file.attached, f.download.fileId).toBe(true)
    }
  })
})
