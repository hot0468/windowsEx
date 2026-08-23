import { describe, expect, it } from 'vitest'
import { printerStep } from '../src/engine/store.js'
import scenario from '../src/scenarios/workday.json'

const p = scenario.printer

describe('printer repair', () => {
  it('advances on the right button and resets on a wrong one', () => {
    expect(printerStep(['a', 'b'], 0, 'a')).toBe(1)
    expect(printerStep(['a', 'b'], 1, 'a')).toBe(0)
    expect(printerStep(['a', 'b'], 1, 'b')).toBe(2)
  })

  it('finishes only by pressing the wiki order end to end', () => {
    let done = 0
    for (const id of p.steps) done = printerStep(p.steps, done, id)
    expect(done).toBe(p.steps.length)
  })

  it('every step is a real button and the wiki lists them in order', () => {
    const ids = new Set(p.buttons.map((b) => b.id))
    for (const id of p.steps) expect(ids.has(id)).toBe(true)
    const wiki = scenario.sites.find((s) => s.layout === 'wiki').wiki.pages.office
    const labels = p.steps.map((id) => p.buttons.find((b) => b.id === id).label)
    expect(wiki.list).toEqual(labels)
  })

  it('the receipt only exists on the printer, never in a file', () => {
    expect(JSON.stringify(scenario.fs)).not.toContain(p.receipt)
  })
})
