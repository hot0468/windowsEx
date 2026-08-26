import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { offerable, quickSets } from '../src/engine/store.js'

const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const boss = threads.find((t) => t.live)
const security = threads.find((t) => t.id === 'security')
const last = quickSets(boss).at(-1)

// The live thread speaks all day — every pool request the boss hosts pushes
// lines into it — and each time it did, the last set of canned replies came
// back and 오늘 중으로 회신하겠습니다 could be sent again.
describe('what a conversation offers to say', () => {
  it('drops a line the player has already used', () => {
    const said = new Set([last[0]])
    expect(offerable(last, { said })).toEqual(last.slice(1))
  })

  it('offers nothing once the set is used up, rather than starting over', () => {
    expect(offerable(last, { said: new Set(last) })).toEqual([])
  })

  it('leaves a fresh conversation alone', () => {
    expect(offerable(last)).toEqual(last)
    for (const t of threads) {
      const set = quickSets(t)[0]
      expect(offerable(set, { gate: t.gate, grants: {} }).length, t.id).toBeLessThanOrEqual(set.length)
    }
  })

  it('still keeps a gated line shut until it is earned', () => {
    const line = Object.keys(security.gate)[0]
    const grant = security.gate[line]
    expect(offerable(security.quick, { gate: security.gate, grants: {} })).not.toContain(line)
    expect(offerable(security.quick, { gate: security.gate, grants: { [grant]: true } })).toContain(line)
  })

  it('gates and used lines both apply, not one or the other', () => {
    const line = Object.keys(security.gate)[0]
    const grant = security.gate[line]
    const open = { gate: security.gate, grants: { [grant]: true }, said: new Set([line]) }
    expect(offerable(security.quick, open)).not.toContain(line)
  })

  it('gives the live thread enough to say to get through its sets', () => {
    // each set has to hold more than one line, or using one empties the bar
    for (const set of quickSets(boss)) expect(set.length).toBeGreaterThan(1)
  })
})
