import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fileOpener, installedShortcuts, useGame } from '../src/engine/store.js'
import { showsSuccess } from '../src/apps/Installer.jsx'

const files = allFiles(scenario.fs)
const programs = Object.entries(scenario.programs)

describe('the program dictionary', () => {
  it('gives every program a wizard with something to show', () => {
    expect(programs.length).toBeGreaterThan(0)
    for (const [id, p] of programs) {
      expect(p.product, id).toBeTruthy()
      expect(p.publisher, id).toBeTruthy()
      expect(p.setup.endsWith('.exe'), id).toBe(true)
      expect(p.intro.length, id).toBeGreaterThan(0)
      expect(p.steps.length, id).toBeGreaterThan(2)
      for (const screen of [p.done, p.already]) {
        expect(screen.title.length, id).toBeGreaterThan(0)
        expect(screen.lines.length, id).toBeGreaterThan(0)
      }
      expect(p.grant, id).toBeTruthy()
    }
  })

  it('lets each setup file name the program it installs', () => {
    for (const [id, p] of programs) {
      const setup = files.find((f) => f.name === p.setup)
      expect(setup, id).toBeTruthy()
      expect(setup.program, id).toBe(id)
      expect(fileOpener(setup).app, id).toBe('installer')
    }
  })

  it('only asks for approval where it has a refusal screen to show', () => {
    for (const [id, p] of programs) {
      if (!p.needs) continue
      expect(p.blocked.title, id).toBeTruthy()
      expect(p.blocked.lines.length, id).toBeGreaterThan(0)
    }
  })
})

describe('a program that turns out to be malware', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ grants: {}, extraMessages: {}, crashed: false, crashSource: null })
  })
  afterEach(() => vi.useRealTimers())

  it('names its own aftermath instead of the phishing mail one', () => {
    for (const [id, p] of programs) {
      if (!p.danger) continue
      expect(p.aftermath.thread, id).toBeTruthy()
      expect(p.aftermath.lines.length, id).toBeGreaterThan(0)
      expect(p.aftermath.from, id).toBeTruthy()
    }
    expect(programs.some(([, p]) => p.danger)).toBe(true)
  })

  it('sends the program its own warning after the reboot', () => {
    const [id, p] = programs.find(([, x]) => x.danger)
    useGame.getState().crash(id)
    expect(useGame.getState().crashed).toBe(true)
    useGame.getState().reboot()
    const said = (useGame.getState().extraMessages[p.aftermath.thread] ?? []).map((m) => m.text)
    expect(said).toEqual(p.aftermath.lines)
    expect(useGame.getState().grants.infected).toBe(true)
  })

  it('still falls back to the phishing aftermath when no program is named', () => {
    useGame.getState().crash()
    useGame.getState().reboot()
    const after = scenario.malware.aftermath
    const said = (useGame.getState().extraMessages[after.thread] ?? []).map((m) => m.text)
    expect(said).toEqual(after.lines)
  })

  it('does not repeat the same source’s lines on a second infection from it', () => {
    const [id, p] = programs.find(([, x]) => x.danger)
    useGame.getState().crash(id)
    useGame.getState().reboot()
    useGame.getState().crash(id)
    useGame.getState().reboot()
    const said = (useGame.getState().extraMessages[p.aftermath.thread] ?? []).map((m) => m.text)
    expect(said).toEqual(p.aftermath.lines)
  })

  it('delivers both warnings, each once, when infected from both sources in one playthrough', () => {
    const [id, p] = programs.find(([, x]) => x.danger)
    const mailAfter = scenario.malware.aftermath

    // Infect via the fake-viewer install first, then via the phishing mail.
    useGame.getState().crash(id)
    useGame.getState().reboot()
    useGame.getState().crash()
    vi.runOnlyPendingTimers()
    useGame.getState().reboot()

    const said = (useGame.getState().extraMessages[p.aftermath.thread] ?? []).map((m) => m.text)
    expect(said).toEqual([...p.aftermath.lines, ...mailAfter.lines])
    expect(useGame.getState().grants.infected).toBe(true)

    // The toast fired after the second reboot must quote a line that is
    // actually present in the thread it opens.
    vi.runOnlyPendingTimers()
    const toast = useGame.getState().toast
    expect(toast).toBeTruthy()
    expect(said).toContain(toast.text)
  })

  it('delivers both warnings when the phishing mail comes first', () => {
    const [id, p] = programs.find(([, x]) => x.danger)
    const mailAfter = scenario.malware.aftermath

    useGame.getState().crash()
    useGame.getState().reboot()
    useGame.getState().crash(id)
    vi.runOnlyPendingTimers()
    useGame.getState().reboot()

    const said = (useGame.getState().extraMessages[p.aftermath.thread] ?? []).map((m) => m.text)
    expect(said).toEqual([...mailAfter.lines, ...p.aftermath.lines])

    vi.runOnlyPendingTimers()
    const toast = useGame.getState().toast
    expect(toast).toBeTruthy()
    expect(said).toContain(toast.text)
  })
})

describe('the installer panel a finished run shows', () => {
  it('never shows the success panel for a program that crashes the machine', () => {
    const [, danger] = programs.find(([, p]) => p.danger)
    expect(showsSuccess(true, danger)).toBe(false)
  })

  it('still shows the success panel for an ordinary finished install', () => {
    const [, safe] = programs.find(([, p]) => !p.danger)
    expect(showsSuccess(true, safe)).toBe(true)
  })

  it('shows nothing before the install has actually finished', () => {
    const [, danger] = programs.find(([, p]) => p.danger)
    const [, safe] = programs.find(([, p]) => !p.danger)
    expect(showsSuccess(false, danger)).toBe(false)
    expect(showsSuccess(false, safe)).toBe(false)
  })
})

describe('shortcuts a program leaves behind', () => {
  it('shows none before the install and one after', () => {
    const withIcon = programs.find(([, p]) => p.shortcut)
    expect(withIcon, 'no program has a shortcut').toBeTruthy()
    const [id, p] = withIcon
    expect(installedShortcuts(scenario.programs, {})).toEqual([])
    expect(installedShortcuts(scenario.programs, { [p.grant]: true }))
      .toEqual([p.shortcut])
  })
})

describe('everything a site offers to download', () => {
  const byId = new Map(allFiles(scenario.fs).map((f) => [f.id, f]))
  const offers = scenario.sites
    .filter((s) => s.vendor?.download)
    .map((s) => ({ where: s.url, item: s.vendor.download }))

  it('offers at least one download somewhere', () => {
    expect(offers.length).toBeGreaterThan(0)
  })

  it('hands out files that exist and stay hidden until saved', () => {
    for (const { where, item } of offers) {
      const file = byId.get(item.fileId)
      expect(file, where).toBeTruthy()
      expect(file.name, where).toBe(item.name)
      expect(file.attached, where).toBe(true)
    }
  })

  it('gives every vendor page something to say', () => {
    for (const s of scenario.sites.filter((x) => x.layout === 'vendor')) {
      expect(s.vendor.brand, s.url).toBeTruthy()
      expect(s.vendor.lines.length, s.url).toBeGreaterThan(0)
      expect(['corp', 'spam']).toContain(s.vendor.theme)
    }
  })
})
