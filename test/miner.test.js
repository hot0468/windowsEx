import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { APPS } from '../src/apps/registry.jsx'
import { opensWhileMining, processList, useGame } from '../src/engine/store.js'

const miner = scenario.miner
const av = scenario.antivirus

describe('the miner that came bundled', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ mining: false, cleaned: false, windows: [], grants: {}, extraMessages: {}, toast: null })
  })
  afterEach(() => vi.useRealTimers())

  it('rides along with the security plugin the government site demands', () => {
    expect(scenario.programs.anysign.bundles).toBe('miner')
    // and nothing else on the machine brings it
    const bundling = Object.values(scenario.programs).filter((p) => p.bundles)
    expect(bundling).toHaveLength(1)
  })

  it('starts once, and not after the machine has been cleaned', () => {
    useGame.getState().startMining()
    expect(useGame.getState().mining).toBe(true)
    useGame.setState({ mining: false, cleaned: true })
    useGame.getState().startMining()
    expect(useGame.getState().mining).toBe(false)
  })

  it('shuts any window the player opens, except the two ways out', () => {
    useGame.getState().startMining()
    for (const app of Object.keys(APPS)) {
      useGame.setState({ windows: [] })
      useGame.getState().openWindow(app)
      const opened = useGame.getState().windows.length === 1
      expect(opened, app).toBe(opensWhileMining(app))
    }
    expect(opensWhileMining('taskmgr') && opensWhileMining('antivirus')).toBe(true)
  })

  it('lets windows open again once the task is ended', () => {
    useGame.getState().startMining()
    useGame.getState().killMiner()
    useGame.setState({ windows: [] })
    useGame.getState().openWindow('browser')
    expect(useGame.getState().windows).toHaveLength(1)
  })
})

describe('the task manager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ mining: false, cleaned: false, grants: {}, extraMessages: {}, toast: null })
  })
  afterEach(() => vi.useRealTimers())

  it('lists the miner only while it runs, and hottest first', () => {
    expect(processList(miner, false).some((r) => r.miner)).toBe(false)
    const rows = processList(miner, true)
    expect(rows[0].miner).toBe(true)
    expect(rows[0].cpu).toBeGreaterThan(Math.max(...miner.processes.map((p) => p.cpu)))
    // it hides behind a system-looking name
    expect(rows[0].name).toMatch(/svchost/)
    expect(rows[0].detail).toMatch(/Windows/)
  })

  it('marks every other row as one Windows will not let you end', () => {
    for (const p of miner.processes) expect(p.system).toBe(true)
  })

  it('quiets the machine, then the security team explains it is not gone', () => {
    useGame.getState().startMining()
    useGame.getState().killMiner()
    expect(useGame.getState().mining).toBe(false)
    vi.runAllTimers()
    const said = useGame.getState().extraMessages[miner.after.thread].map((m) => m.text)
    expect(said).toEqual(miner.after.lines)
    expect(said.join(' ')).toMatch(/백신/)
    // and killing it is not what completes the request
    expect(useGame.getState().grants.cleanpc).toBeFalsy()
  })
})

describe('the antivirus', () => {
  beforeEach(() => useGame.setState({ mining: true, cleaned: false, grants: { anysign: true }, toast: null }))

  it('walks real places and names what it finds', () => {
    expect(av.targets.length).toBeGreaterThan(3)
    expect(av.found.name).toMatch(/Miner/i)
    expect(av.found.path).toMatch(/svchost32/)
    expect(av.found.note).toMatch(/시작 프로그램|재부팅/)
  })

  it('removes it for good and finishes the job', () => {
    useGame.getState().cleanPc()
    expect(useGame.getState().cleaned).toBe(true)
    expect(useGame.getState().mining).toBe(false)
    expect(useGame.getState().grants.cleanpc).toBe(true)
  })

  it('cleans only once', () => {
    useGame.getState().cleanPc()
    useGame.setState({ grants: {} })
    useGame.getState().cleanPc()
    expect(useGame.getState().grants.cleanpc).toBeFalsy()
  })
})
