import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'

const p = scenario.printer

// How the copier is brought back to life now lives in mfp.test.js — the jam
// sequence it used to have was a pair of hands the game does not have. What
// belongs here is the rule that outlived it.
describe('the copier', () => {
  it('keeps the receipt on the machine, never in a file', () => {
    expect(JSON.stringify(scenario.fs)).not.toContain(p.receipt)
  })

  it('reports an error a screen can actually answer', () => {
    expect(p.error.code).toBeTruthy()
    expect(p.error.text).toBeTruthy()
    expect(p.error.help).toBeTruthy()
    expect(p.blocked.length).toBeGreaterThan(0)
  })
})
