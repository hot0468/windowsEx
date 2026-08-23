import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/ep1.json'
import { answerFits, searchPlaces } from '../src/engine/store.js'

const chain = (ask) => (ask ? [ask, ...chain(ask.then)] : [])
const jihyun = scenario.privateMessenger.sections
  .flatMap((s) => s.threads).find((t) => t.id === 'jihyun')
const asks = jihyun.reactions.flatMap((r) => chain(r.ask))
const bookAsk = asks.find((a) => a.grants === 'booking')
const form = scenario.booking

const ticket = (place, time, party = '2명') => form.template
  .replace('{place}', place).replace('{date}', form.date)
  .replace('{time}', time).replace('{party}', party).replace('{code}', 'RV-1234')

describe('answerFits', () => {
  it('forgives spacing and case', () => {
    expect(answerFits({ accept: ['테헤란로 122'] }, '  서울 테헤란로122  ')).toBe(true)
  })

  it('needs every part of a composed answer, not just one', () => {
    const ask = { accept: [['가게', '19:00']] }
    expect(answerFits(ask, '가게 19:00 예약')).toBe(true)
    expect(answerFits(ask, '가게만 적음')).toBe(false)
    expect(answerFits(ask, '19:00만 적음')).toBe(false)
  })
})

describe('the booking 지현 asks for', () => {
  it('is asked only after she has been told the name', () => {
    const pubAsk = asks.find((a) => a.grants === 'pub')
    expect(pubAsk.then).toBe(bookAsk)
  })

  it('accepts the confirmation the booking screen produces', () => {
    const pub = scenario.places.find((p) => p.hiddenUntil === 'pub')
    expect(answerFits(bookAsk, ticket(pub.name, '19:00'))).toBe(true)
  })

  it('rejects a booking at the wrong time', () => {
    const pub = scenario.places.find((p) => p.hiddenUntil === 'pub')
    expect(answerFits(bookAsk, ticket(pub.name, '21:00'))).toBe(false)
  })

  it('rejects a booking at the wrong place', () => {
    expect(answerFits(bookAsk, ticket('호프 한잔', '19:00'))).toBe(false)
  })

  it('offers that time on the booking form', () => {
    expect(form.times).toContain('19:00')
  })

  it('lets you reach the pub page once you know the name', () => {
    const pub = scenario.places.find((p) => p.hiddenUntil === 'pub')
    expect(pub.bookable).toBe(true)
    expect(searchPlaces(scenario.places, pub.name, { pub: true })).toHaveLength(1)
  })
})
