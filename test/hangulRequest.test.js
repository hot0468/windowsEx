import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { missingKey, useGame } from '../src/engine/store.js'

const security = scenario.workMessenger.sections
  .flatMap((s) => s.threads).find((t) => t.id === 'security')
const COMPLAINT = '한글 문서가 안 열리는데요'
// what the messenger offers out of a branch, given what the player has seen
const offerable = (list, grants) =>
  list.filter((c) => !security.gate?.[c] || grants[security.gate[c]])

describe('telling 정보보안팀 that 한글 will not open', () => {
  beforeEach(() => useGame.setState({ grants: {} }))

  it('is the line that earns the install approval', () => {
    const r = security.reactions.find((x) => x.choice === COMPLAINT)
    expect(r?.grants).toBe('hangulOk')
    expect(scenario.programs.hangul.needs).toBe('hangulOk')
  })

  it('cannot be said before the player has watched 한글 fail to open', () => {
    expect(security.gate[COMPLAINT]).toBe(missingKey('hangul'))
    // the branch that hands it over is still there; the line just isn't sayable
    const branch = security.reactions.find((x) => x.next?.includes(COMPLAINT)).next
    expect(offerable(branch, {})).toEqual([])
    expect(offerable(branch, { [missingKey('hangul')]: true })).toEqual([COMPLAINT])
  })

  it('opens up once the document, or the wizard, says no', () => {
    useGame.getState().sawMissing('hangul')
    expect(useGame.getState().grants[missingKey('hangul')]).toBe(true)
    // saying it twice is the same state, not a second one
    const before = useGame.getState().grants
    useGame.getState().sawMissing('hangul')
    expect(useGame.getState().grants).toBe(before)
  })

  // `branch` lives in the messenger window, so closing it drops the line the
  // last reply handed over. The complaint has to survive that: the player is
  // meant to leave and go open a document before making it.
  it('is still there after the player closes the messenger and comes back', () => {
    const fresh = security.quick
    expect(offerable(fresh, {})).not.toContain(COMPLAINT)
    expect(offerable(fresh, { [missingKey('hangul')]: true })).toContain(COMPLAINT)
  })

  it('leaves the ungated lines alone', () => {
    for (const r of security.reactions) {
      for (const c of r.next ?? []) {
        if (c !== COMPLAINT) expect(offerable([c], {})).toEqual([c])
      }
    }
  })
})
