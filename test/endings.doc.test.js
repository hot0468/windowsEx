import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { endingFor } from '../src/engine/store.js'

// docs/endings.md describes the priority ladder in prose. Prose drifts; this
// keeps it honest by asserting the same ladder against the real decision.
const E = scenario.ending
const doc = readFileSync('docs/endings.md', 'utf8')

const base = { grants: {}, locks: 3, overtime: {}, days: 5, digging: {}, rumor: {} }
const dug = { asked: true, found: true, entered: true }
const chose = (how) => ({ heard: true, traced: true, acted: how })
const aware = { clue_mail: true }
const everyNight = { 1: true, 2: true, 3: true, 4: true, 5: true }

describe('the ladder the doc describes', () => {
  it('falls through to an ordinary weekend', () => {
    expect(endingFor(E, base)).toBe('plain')
  })

  it('counts a week without one locked screen, or five nights, as overwork', () => {
    expect(endingFor(E, { ...base, locks: 0 })).toBe('overwork')
    expect(endingFor(E, { ...base, overtime: everyNight })).toBe('overwork')
  })

  it('puts a confirmed ticket above overwork', () => {
    expect(endingFor(E, { ...base, locks: 0, grants: { lotto: true } })).toBe('lotto')
  })

  it('lets the obituary outrank the ticket — the dead do not collect', () => {
    expect(endingFor(E, { ...base, grants: { ...aware, lotto: true } })).toBe('true')
  })

  it('lets a choice made about the rumour outrank the truth', () => {
    expect(endingFor(E, { ...base, grants: aware, rumor: chose('told') })).toBe('rumor_told')
    expect(endingFor(E, { ...base, grants: aware, rumor: chose('buried') })).toBe('rumor_buried')
  })

  it('lets walking into the eighth floor outrank everything', () => {
    expect(endingFor(E, {
      ...base, grants: { ...aware, lotto: true }, rumor: chose('told'), digging: dug
    })).toBe('missing')
  })

  it('needs the whole trail before either of those counts', () => {
    expect(endingFor(E, { ...base, digging: { asked: true, found: true } })).toBe('plain')
    expect(endingFor(E, { ...base, rumor: { heard: true, traced: true } })).toBe('plain')
  })
})

describe('the doc matches the data it describes', () => {
  it('names every ending that exists', () => {
    const named = ['missing', 'rumor_told', 'rumor_buried', 'true', 'lotto', 'overwork', 'plain']
    for (const id of named) {
      expect(E[id], id).toBeTruthy()
      expect(doc, id).toContain(id)
    }
    expect(E.layoff.choices.map((c) => c.id).sort()).toEqual(['fired', 'quit'])
  })

  it('quotes the layoff threshold correctly', () => {
    expect(doc).toContain(`ratio: ${E.layoff.ratio}`)
  })

  it('lists the scene styles the renderer actually draws', () => {
    const styles = new Set()
    for (const [k, v] of Object.entries(E)) {
      if (v?.scenes) v.scenes.forEach((s) => styles.add(s.style))
      if (k === 'layoff') v.choices.forEach((c) => c.scenes.forEach((s) => styles.add(s.style)))
    }
    for (const s of styles) expect(doc, s).toContain(s)
  })

  it('keeps death out of every ending but the one that earns it', () => {
    // the rule the whole design rests on, restated where it can be checked
    for (const [id, v] of Object.entries(E)) {
      if (id === 'true' || !v?.scenes) continue
      const said = JSON.stringify(v.scenes)
      expect(said, id).not.toContain('숨졌')
      expect(said, id).not.toContain('부고')
    }
  })
})
