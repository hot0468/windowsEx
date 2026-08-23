import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { quickSets } from '../src/engine/store.js'

const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const bots = threads.filter((t) => t.bot)

// everything the player ever has to type in, wherever the question lives
const accepted = (ask) => ask?.accept?.flat() ?? []
const answers = [
  ...threads.flatMap((t) => [
    ...accepted(t.ask), ...(t.reactions ?? []).flatMap((r) => accepted(r.ask))
  ]),
  ...scenario.days.flatMap((d) => d.asks ?? []).flatMap((a) => accepted(a.ask))
]

describe('톡톡 noise', () => {
  it('carries the clutter a real phone has', () => {
    expect(bots.length).toBeGreaterThan(3)
    for (const t of bots) expect(t.messages.length).toBeGreaterThan(1)
  })

  it('never lets a card alert or an ad give an answer away', () => {
    const noise = JSON.stringify(bots)
    for (const answer of new Set(answers)) expect(noise).not.toContain(answer)
  })

  it('answers back when the player taps the one reply it offers', () => {
    // a notification channel still can't have a button that does nothing
    for (const t of bots) {
      const offered = quickSets(t).flat()
      expect(offered.length).toBeGreaterThan(0)
      for (const choice of offered) {
        const hit = (t.reactions ?? []).find((r) => r.choice === choice)
        expect(hit).toBeTruthy()
        expect(hit.reply.length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps the street number the player must look up off the shop listings', () => {
    const mom = threads.find((t) => t.id === 'mom')
    const street = mom.ask.accept[0]
    for (const place of scenario.places) expect(place.address).not.toContain(street)
  })
})
