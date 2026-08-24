import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { findFile, rippleHolds, siteView, useGame } from '../src/engine/store.js'

const ripple = (id) => scenario.ripples.find((r) => r.id === id)
const threads = [scenario.workMessenger, scenario.privateMessenger].flatMap((m) => m.sections.flatMap((s) => s.threads))
const base = { overtime: {}, locks: 3, slips: 0, mining: false, cleaned: false, roomQuestions: 0, ripples: {}, grants: {} }

describe('a file nobody asked for', () => {
  it('gets a puzzled reply from everyone, and never a typed answer', () => {
    const steps = (a) => (a ? [a, ...steps(a.then)] : [])
    const accepts = threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)])
      .flatMap(steps).filter(Boolean).flatMap((a) => a.accept ?? []).flat()
    for (const m of [scenario.workMessenger, scenario.privateMessenger]) {
      expect(m.shrug.length).toBeGreaterThan(0)
      for (const t of m.sections.flatMap((s) => s.threads)) {
        const lines = (t.shrug ?? m.shrug).flat()
        expect(lines.length, t.id).toBeGreaterThan(0)
        for (const a of accepts) for (const l of lines) expect(l.includes(a), `${t.id} leaks ${a}`).toBe(false)
      }
    }
  })
})

describe('a synced memo, rewritten', () => {
  const file = findFile(scenario.fs, 'file_asangsa_req')

  it('can actually be rewritten, and only a real change counts', () => {
    expect(file.editable).toBe(true)
    const when = ripple('edited_shared').when
    expect(rippleHolds(when, 2, { ...base, edits: { file_asangsa_req: file.content + '\n- 납기 4주' } })).toBe(true)
    expect(rippleHolds(when, 2, { ...base, edits: { file_asangsa_req: file.content } })).toBe(false)
    expect(rippleHolds(when, 2, { ...base, edits: {} })).toBe(false)
  })

  it('offers two answers, and only the lie comes back to bite', () => {
    const junho = threads.find((t) => t.id === 'junho')
    const [own, deny] = ripple('edited_shared').beat.choices.map((c) => junho.reactions.find((r) => r.choice === c))
    expect(own.grants).toBe('edit_owned')
    expect(ripple('edit_denied').when.grant).toBe(deny.grants)
    expect(ripple('edit_denied').effect.slipPenalty).toBeGreaterThan(0)
    expect(scenario.ripples.some((r) => r.when.grant === 'edit_owned')).toBe(false)
  })
})

describe('the copier queue', () => {
  it('holds one document that prints, names the missing employee, and costs something the next day', () => {
    const jobs = scenario.sites.find((s) => s.layout === 'printerweb').printerweb.queue.filter((q) => q.printable)
    expect(jobs).toHaveLength(1)
    const [job] = jobs
    expect(job.found).toBe(true)
    expect(job.pages.join('\n')).toContain('AR-1877')
    expect(ripple(job.grants).effect.slipPenalty).toBeGreaterThan(0)
  })
})

describe('the router, touched', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ day: 2, routerDown: false, grants: {}, extraMessages: {}, ripples: {}, extraMails: [], chatted: {} })
  })
  afterEach(() => vi.useRealTimers())

  it('drops the floor off the network until it is put back', () => {
    const { outage } = scenario.sites.find((s) => s.layout === 'router').router
    useGame.getState().breakRouter()
    vi.runAllTimers()
    const g = useGame.getState()
    expect(g.routerDown).toBe(true)
    expect(g.grants.router_broke).toBe(true)
    expect(g.extraMessages[outage.thread].map((m) => m.text)).toEqual(expect.arrayContaining(outage.down))
    expect(siteView(scenario.sites[0], { grants: {}, unlocked: {}, offline: true })).toBe('offline')
    useGame.getState().fixRouter()
    vi.runAllTimers()
    expect(useGame.getState().routerDown).toBe(false)
    expect(useGame.getState().extraMessages[outage.thread].map((m) => m.text)).toEqual(expect.arrayContaining(outage.up))
  })

  it('thanks a changed password, unless the floor went down too', () => {
    expect(rippleHolds(ripple('router_secured').when, 3, { ...base, grants: { router_secured: true } })).toBe(true)
    expect(rippleHolds(ripple('router_secured').when, 3, { ...base, grants: { router_secured: true, router_broke: true } })).toBe(false)
    expect(rippleHolds(ripple('router_broke').when, 3, { ...base, grants: { router_broke: true } })).toBe(true)
  })
})
