import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/ep1.json'
import { searchPlaces } from '../src/engine/store.js'

const places = scenario.places
const names = (q, grants) => searchPlaces(places, q, grants).map((p) => p.name)

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

  it('hides the pub until 지현 has been told its name', () => {
    const pub = scenario.places.find((p) => p.hiddenUntil === 'pub')
    expect(pub).toBeTruthy()
    // before: searching cannot hand over the answer she is asking for
    expect(searchPlaces(places, '맥주').map((p) => p.name)).not.toContain(pub.name)
    // after: it is listed, because now it has to be bookable
    expect(searchPlaces(places, '맥주', { pub: true }).map((p) => p.name)).toContain(pub.name)
  })

  it('still shows other pubs, so 맥주 is a real search', () => {
    expect(names('맥주').length).toBeGreaterThan(1)
  })
})
