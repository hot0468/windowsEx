import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/ep1.json'
import { complaintFor } from '../src/engine/store.js'

const goal = scenario.goal
const c = goal.complain

describe('complaintFor', () => {
  it('scolds about the actual mistake on the first slip', () => {
    const first = complaintFor(goal, 'attachment', 1)
    expect(first.spent).toBe(false)
    expect(first.lines).toEqual(c.attachment)
  })

  it('tells a different story when the figure was the problem', () => {
    expect(complaintFor(goal, 'keyword', 1).lines).toEqual(c.keyword)
  })

  it('warns that the next one is the last', () => {
    const second = complaintFor(goal, 'keyword', goal.attempts - 1)
    expect(second.spent).toBe(false)
    expect(second.lines.at(-1)).toBe(c.lastChance)
  })

  it('takes the account away on the last strike', () => {
    const last = complaintFor(goal, 'attachment', goal.attempts)
    expect(last.spent).toBe(true)
    expect(last.lines).toEqual(c.final)
  })

  it('stays over once the limit is passed', () => {
    expect(complaintFor(goal, 'keyword', goal.attempts + 3).spent).toBe(true)
  })
})

describe('failure screen', () => {
  it('has something to say when the game ends badly', () => {
    expect(goal.attempts).toBeGreaterThan(1)
    expect(goal.failure.title).toBeTruthy()
    expect(goal.failure.lines.length).toBeGreaterThan(0)
  })
})
