import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { answerFits, siteView } from '../src/engine/store.js'

const site = scenario.sites.find((s) => s.layout === 'calendar')
// not every beat a day brings raises a question, so reach for one carefully
const beat = scenario.days.flatMap((d) => d.asks ?? []).find((a) => a.ask?.then?.grants === 'wedding')

describe('다온 calendar and the wedding question', () => {
  it('is an outside site anyone can open', () => {
    expect(siteView(site, { grants: {}, unlocked: {} })).toBe('ready')
    expect(site.calendar.events.length).toBeGreaterThan(3)
  })

  it('puts the wedding on a day the calendar already has plans for', () => {
    const post = scenario.days.flatMap((d) => d.portal.news).find((n) => n.title.includes('결혼'))
    const day = +post.body.join(' ').match(/8월 (\d+)일/)[1]
    const plans = site.calendar.events.filter((e) => e.day === day)
    expect(plans.length).toBeGreaterThan(0)
    // the follow-up wants that plan, and only that plan, by name
    for (const a of beat.ask.then.accept) {
      expect(plans.some((e) => e.title.includes(a))).toBe(true)
      expect(site.calendar.events.filter((e) => e.title.includes(a))).toHaveLength(1)
    }
  })

  it('takes "can\'t make it" in its usual forms and refuses "sure"', () => {
    for (const yes of ['못 가', '못 갈 것 같아', '안 가', '그날은 어려울 것 같아', '힘들 듯']) {
      expect(answerFits(beat.ask, yes)).toBe(true)
    }
    for (const no of ['갈 수 있어', '응 갈게', '당연하지']) expect(answerFits(beat.ask, no)).toBe(false)
  })
})
