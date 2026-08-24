import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { quickSets } from '../src/engine/store.js'

const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const bots = threads.filter((t) => t.bot)

// everything the player ever has to type in, wherever the question lives —
// including the later steps of a question that takes several
const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const accepted = (ask) => steps(ask).flatMap((a) => a.accept?.flat() ?? [])
const answers = [
  ...threads.flatMap((t) => [
    ...accepted(t.ask), ...(t.reactions ?? []).flatMap((r) => accepted(r.ask))
  ]),
  ...scenario.days.flatMap((d) => d.asks ?? []).flatMap((a) => accepted(a.ask))
]

// A bot that asks a question of its own has to be allowed to state the answer
// it is waiting for; what it must never do is give away someone else's.
const ownAnswers = (t) => new Set([
  ...accepted(t.ask), ...(t.reactions ?? []).flatMap((r) => accepted(r.ask))
])

describe('톡톡 noise', () => {
  it('carries the clutter a real phone has', () => {
    expect(bots.length).toBeGreaterThan(3)
    for (const t of bots) expect(t.messages.length).toBeGreaterThan(1)
  })

  it('never lets a card alert or an ad give an answer away', () => {
    for (const bot of bots) {
      const noise = JSON.stringify(bot)
      const mine = ownAnswers(bot)
      for (const answer of new Set(answers)) {
        if (!mine.has(answer)) expect(noise, `${bot.id} leaks ${answer}`).not.toContain(answer)
      }
    }
  })

  it('keeps a bot from answering its own question in its standing messages', () => {
    for (const bot of bots) {
      const idle = JSON.stringify({ messages: bot.messages, quick: bot.quick })
      for (const answer of ownAnswers(bot)) {
        expect(idle, `${bot.id} states ${answer} before it is asked`).not.toContain(answer)
      }
    }
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
