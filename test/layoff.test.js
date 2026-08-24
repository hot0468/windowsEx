import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { laidOff, requestsOf, useGame } from '../src/engine/store.js'

const layoff = scenario.ending.layoff
const every = Object.fromEntries(scenario.days.map((d) => [d.n, true]))
const asked = (overtime = {}) =>
  scenario.days.reduce((n, d, i) => n + requestsOf(scenario, i + 1, overtime).length, 0)

describe('the layoff', () => {
  beforeEach(() => useGame.setState({ slips: 0, misses: 0, overtime: {}, ended: false, grants: {} }))

  it('offers exactly two ways out, each with its own ending', () => {
    expect(layoff.choices.map((c) => c.id)).toEqual(['quit', 'fired'])
    for (const c of layoff.choices) {
      expect(c.label && c.note).toBeTruthy()
      expect(c.scenes.length).toBeGreaterThan(1)
      for (const sc of c.scenes) expect(sc.lines.length).toBeGreaterThan(0)
      expect(c.end.button).toBeTruthy()
    }
    expect(layoff.choices[0].note).toMatch(/퇴직금|위로금/)
    expect(layoff.choices[1].note).toMatch(/실업급여/)
    expect(layoff.notice.lines.length).toBeGreaterThan(2)
  })

  it('falls at nine wrong answers in ten requests, not before', () => {
    const n = asked()
    expect(laidOff(layoff, { slips: 0 }, scenario)).toBe(false)
    expect(laidOff(layoff, { slips: Math.ceil(n * layoff.ratio) - 1 }, scenario)).toBe(false)
    expect(laidOff(layoff, { slips: Math.ceil(n * layoff.ratio) }, scenario)).toBe(true)
  })

  it('measures against the week the player actually worked, overtime included', () => {
    const plain = Math.ceil(asked() * layoff.ratio)
    expect(laidOff(layoff, { slips: plain, overtime: {} }, scenario)).toBe(true)
    // the same slips against a longer week are not yet enough
    if (asked(every) > asked()) {
      expect(laidOff(layoff, { slips: plain, overtime: every }, scenario)).toBe(false)
    }
  })

  it('counts a wrong answer without ever showing the count', () => {
    useGame.getState().slip()
    useGame.getState().slip()
    expect(useGame.getState().slips).toBe(2)
    // the number lives in the store and nowhere the player can read it
    const ui = ['src/App.jsx', 'src/shell/Progress.jsx']
      .map((f) => require('fs').readFileSync(f, 'utf8')).join('\n')
    expect(ui).not.toMatch(/\{\s*slips\s*\}/)
    expect(ui).not.toMatch(/재작업/)
  })

  it('remembers which way out was chosen', () => {
    useGame.getState().layOff('fired')
    expect(useGame.getState().ended).toBe('layoff:fired')
    useGame.getState().layOff('quit')
    expect(useGame.getState().ended).toBe('layoff:quit')
  })
})
