import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, useGame } from '../src/engine/store.js'

describe('lock screen', () => {
  it('has a password the player can read off the ID card they already found', () => {
    const card = allFiles(scenario.fs).find((f) => f.id === 'file_idcard')
    expect(card.alt).toContain(scenario.lock.password)
    expect(scenario.lock.hint).toBeTruthy()
    expect(scenario.lock.idleMs).toBeGreaterThan(60_000)
  })

  it('locks and unlocks', () => {
    useGame.setState({ locked: false, toast: { id: 1, text: 'x' } })
    useGame.getState().lock()
    expect(useGame.getState().locked).toBe(true)
    expect(useGame.getState().toast).toBeNull()
    useGame.getState().unlock()
    expect(useGame.getState().locked).toBe(false)
  })
})
