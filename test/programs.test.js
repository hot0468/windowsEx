import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fileOpener, installedShortcuts, useGame } from '../src/engine/store.js'

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
