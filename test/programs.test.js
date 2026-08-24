import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, fileOpener } from '../src/engine/store.js'

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
