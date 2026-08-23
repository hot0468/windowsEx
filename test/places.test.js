import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/ep1.json'
import { searchPlaces } from '../src/engine/store.js'

const places = scenario.places
const names = (q) => searchPlaces(places, q).map((p) => p.name)

describe('portal place search', () => {
  it('answers the two terms the player is most likely to try', () => {
    expect(names('맛집').length).toBeGreaterThan(0)
    expect(names('맥주').length).toBeGreaterThan(0)
  })

  it('finds a place by its name', () => {
    expect(names('강남면옥')).toEqual(['강남면옥'])
  })

  it('finds places by category', () => {
    expect(names('카페')).toContain('카페 다온')
  })

  it('returns nothing for a blank or unknown term', () => {
    expect(searchPlaces(places, '  ')).toEqual([])
    expect(searchPlaces(places, '우주선')).toEqual([])
  })

  it('never lists the pub they went to — that answer lives on the receipt', () => {
    const pub = scenario.privateMessenger.sections
      .flatMap((s) => s.threads)
      .flatMap((t) => (t.reactions ?? []).map((r) => r.ask))
      .find((a) => a?.grants === 'pub')
    const listed = JSON.stringify(scenario.places)
    for (const accepted of pub.accept) expect(listed).not.toContain(accepted)
  })

  it('still shows other pubs, so 맥주 is a real search', () => {
    expect(names('맥주').length).toBeGreaterThan(1)
  })
})
