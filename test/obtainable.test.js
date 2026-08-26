import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles } from '../src/engine/store.js'

// The old check only walked the messenger threads, so the request pool — where
// most of the game's questions actually live — was never held to this at all.
const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))

const asks = [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))),
  ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => steps(a.ask))),
  ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask)),
  // the caller's questions are questions too
  ...steps(scenario.summons?.beat?.ask)
].filter((a) => a?.accept)

// everything the player can read: a file, a photo's description, a site, a
// mail, ipconfig, a listing, the booking form, the printer's receipt
const world = JSON.stringify({
  files: allFiles(scenario.fs),
  sites: scenario.sites,
  network: scenario.network,
  places: scenario.places,
  booking: scenario.booking,
  printer: scenario.printer,
  mails: [...scenario.mails, ...scenario.days.flatMap((d) => d.mails ?? [])],
  // the portal's front page changes with the day, and the VPN client shows a
  // session id that exists nowhere else
  notices: scenario.days.map((d) => d.portal),
  vpn: scenario.vpn
})

// A couple of answers are worked out rather than read off: how many buses 22
// people need, and what ping prints from network.pingMs.
const WORKED_OUT = new Set(['3대', '평균 = 2ms'])

describe('every question the game asks', () => {
  it('covers the pool, not just the threads', () => {
    expect(asks.length).toBeGreaterThan(100)
  })

  it('has an answer the player can actually find', () => {
    const unfindable = []
    for (const ask of asks) {
      // alternate wordings are fine as long as one whole entry is findable
      const findable = ask.accept.some((entry) =>
        (Array.isArray(entry) ? entry : [entry])
          .every((part) => world.includes(part) || WORKED_OUT.has(part)))
      if (!findable) unfindable.push(ask.placeholder + ' :: ' + JSON.stringify(ask.accept))
    }
    expect(unfindable).toEqual([])
  })
})
