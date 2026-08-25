import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { requestsOf } from '../src/engine/store.js'

// A request can need a step somewhere else — a tracking number in 톡톡, a cell
// in a sheet. That step is work the player has to do, so it belongs on the
// day's list; an objective the list never mentions is one nobody can be asked
// to notice.
const listed = (id) => new Set(
  requestsOf(scenario, 5, {}, { 5: [id] }, {}).map((o) => o.id)
)

describe('a request with a step of its own', () => {
  it('puts every objective on some list', () => {
    const anywhere = new Set([
      ...scenario.days.flatMap((d) => d.requests),
      ...scenario.pool.requests.map((r) => r.id),
      ...Object.values(scenario.overtime.days).flatMap((d) => d.requests),
      ...(scenario.ripples ?? []).map((r) => r.effect?.extraRequest).filter(Boolean)
    ])
    // either it is asked for in its own right, or it hangs off one that is
    const orphans = scenario.objectives
      .filter((o) => !anywhere.has(o.id) && !anywhere.has(o.partOf))
      .map((o) => o.id)
    expect(orphans).toEqual([])
  })

  it('lists the 톡톡 side of the registry request with the request', () => {
    expect(listed('c_registry')).toContain('c_registry_track')
  })

  it('lists the sheet cell the expense request is settled in', () => {
    expect(listed('c_expense')).toContain('c_expense_cell')
  })

  it('brings a step in only when its request is on the day', () => {
    const alone = requestsOf(scenario, 5, {}, { 5: [] }, {}).map((o) => o.id)
    expect(alone).not.toContain('c_registry_track')
    expect(alone).not.toContain('c_expense_cell')
  })

  it('names a request that exists, for every step that claims one', () => {
    const ids = new Set(scenario.objectives.map((o) => o.id))
    for (const o of scenario.objectives) {
      if (o.partOf) expect(ids, o.id).toContain(o.partOf)
    }
  })
})
