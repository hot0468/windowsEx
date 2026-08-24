import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { CLUE, awareOf, endingFor, latestNews, useGame } from '../src/engine/store.js'

const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const player = scenario.player.name
const ending = scenario.ending
const last = scenario.days.length
const rumour = () => scenario.sites.find((s) => s.layout === 'board').board.posts.find((p) => p.id === 'b11')
const article = () => scenario.news.find((n) => n.id === 'n_accident')
const obituary = () => scenario.mails.find((m) => m.id === ending.clues.mail)

describe('the two endings', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ ended: false, day: 1, booted: true, grants: {}, locks: 1 })
  })
  afterEach(() => vi.useRealTimers())

  it('each tells its story in scenes that say something', () => {
    for (const kind of ['true', 'plain', 'overwork']) {
      expect(ending[kind].scenes.length).toBeGreaterThan(1)
      for (const sc of ending[kind].scenes) {
        expect(sc.style).toBeTruthy()
        expect(sc.lines.length).toBeGreaterThan(0)
      }
      expect(ending[kind].end.button).toBeTruthy()
    }
  })

  it('comes after the last day, not after any other', () => {
    useGame.getState().finishDay()
    vi.runAllTimers()
    expect(useGame.getState().ended).toBe(false)
    expect(useGame.getState().day).toBe(2)
  })

  it('sends a player who never noticed into an ordinary weekend', () => {
    useGame.setState({ day: last })
    useGame.getState().finishDay()
    expect(useGame.getState().ended).toBe('plain')
  })

  it('tells the truth only to a player who opened their own obituary', () => {
    expect(awareOf(ending, {})).toBe(false)
    expect(awareOf(ending, { [CLUE.mail]: true })).toBe(true)
    useGame.getState().witness()
    useGame.setState({ day: last })
    useGame.getState().finishDay()
    expect(useGame.getState().ended).toBe('true')
  })

  it('sends a player who never once locked the screen into overtime', () => {
    useGame.setState({ day: last, locks: 0 })
    useGame.getState().finishDay()
    expect(useGame.getState().ended).toBe('overwork')
  })

  it('counts every lock, and lets the truth outrank overwork', () => {
    useGame.setState({ locks: 0 })
    useGame.getState().lock()
    useGame.getState().lock()
    expect(useGame.getState().locks).toBe(2)
    expect(endingFor(ending, { grants: {}, locks: 0 })).toBe('overwork')
    expect(endingFor(ending, { grants: {}, locks: 1 })).toBe('plain')
    expect(endingFor(ending, { grants: { [CLUE.mail]: true }, locks: 0 })).toBe('true')
  })

  it('puts the accident on the search portal front page', () => {
    const front = latestNews(scenario.news)
    expect(front.map((a) => a.id)).toContain('n_accident')
    for (let i = 1; i < front.length; i++) expect(front[i - 1].date >= front[i].date).toBe(true)
  })

  it('has the obituary sitting in the inbox under an unremarkable subject, naming the player', () => {
    const m = obituary()
    expect(m).toBeTruthy()
    expect(m.subject).not.toContain('부고')
    expect(m.body).toContain('부고')
    expect(m.body).toContain(player)
  })

  it('answers the opened obituary with the boss, once, and counts it as no work done', () => {
    useGame.setState({ extraMessages: {}, toast: null })
    useGame.getState().witness()
    useGame.getState().witness()
    expect(useGame.getState().grants[CLUE.mail]).toBe(true)
    expect(scenario.objectives.some((o) => o.grant === CLUE.mail)).toBe(false)
    vi.runAllTimers()
    const ev = ending.event
    expect(useGame.getState().extraMessages[ev.thread].map((m) => m.text)).toEqual(ev.lines)
    expect(useGame.getState().toast.thread).toBe(ev.thread)
  })

  it('keeps the article and the rumour as hints that name no one', () => {
    expect(article()).toBeTruthy()
    expect(rumour()).toBeTruthy()
    expect(JSON.stringify(article())).not.toContain(player)
    expect(JSON.stringify(rumour())).not.toContain(player)
  })
})

describe('the easter eggs', () => {
  const said = (text) => JSON.stringify({ days: scenario.days, pool: scenario.pool, messenger: scenario.messenger, threads })
    .split(text).length - 1

  it('has the office tell the player to take it easy, day after day', () => {
    expect(said('쉬엄쉬엄')).toBeGreaterThanOrEqual(scenario.days.length)
    const closings = scenario.days.map((d) => d.closing.join(' '))
    expect(closings.filter((c) => /쉬엄쉬엄|무리하지|쉬어도/.test(c)).length).toBeGreaterThanOrEqual(3)
  })

  it('has mother keep sending food and money, and the bank keep noticing', () => {
    const mom = threads.find((t) => t.id === 'mom')
    expect(JSON.stringify(mom)).toMatch(/상 차리는/)
    const card = threads.find((t) => t.id === 'card')
    expect(card.messages.filter((m) => m.text.includes('입금') && m.text.includes('엄마')).length).toBeGreaterThanOrEqual(2)
  })

  it('lets death be true only once it is known: no other ending hints at it', () => {
    for (const kind of ['plain', 'overwork', 'lotto']) {
      expect(JSON.stringify(ending[kind])).not.toMatch(/2026-07-23|7월 23일|별세|부고|나타날 수 없|노잣돈|제사|상 차/)
    }
    expect(JSON.stringify(ending.true)).toMatch(/2026-07-23/)
  })

  it('dates the last clock-in before the holiday, everywhere it is mentioned', () => {
    expect(JSON.stringify(rumour())).toContain('7월 23일')
    expect(JSON.stringify(ending.true)).toContain('2026-07-23')
  })
})
