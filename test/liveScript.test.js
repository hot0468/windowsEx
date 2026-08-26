import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { scriptLeft, useGame } from '../src/engine/store.js'

const script = scenario.messenger

// Clocking off reboots the machine, and the app arms the timed script on every
// boot. Armed whole, it toasted the first morning's messages again on day two.
describe('the timed script', () => {
  beforeEach(() => useGame.setState({ msgCount: 0, day: 1 }))

  it('is the first morning, and has something to say', () => {
    expect(script.length).toBeGreaterThan(0)
    expect(scriptLeft(script, 0)).toHaveLength(script.length)
  })

  it('says nothing again once it has all been said', () => {
    expect(scriptLeft(script, script.length)).toEqual([])
  })

  it('picks up where it left off rather than starting over', () => {
    expect(scriptLeft(script, 2)).toEqual(script.slice(2))
  })

  it('is all delivered by the time the day is over', () => {
    for (let i = 0; i < script.length; i++) useGame.getState().deliverMessage()
    expect(useGame.getState().msgCount).toBe(script.length)
    // and one more clock tick cannot push it past the end
    useGame.getState().deliverMessage()
    expect(scriptLeft(script, useGame.getState().msgCount)).toEqual([])
  })

  it('counts what it has said where a reboot can still see it', () => {
    // the count only survives clocking off because it is on the saved list;
    // drop it from there and tomorrow arms the whole script again
    const src = readFileSync('src/engine/store.js', 'utf8')
    const progress = src.slice(src.indexOf('const PROGRESS = ['), src.indexOf(']', src.indexOf('const PROGRESS = [')))
    expect(progress).toContain("'msgCount'")
  })
})
