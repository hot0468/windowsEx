import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { CLUE, awareOf, endingFor, latestNews, useGame, visibleByDay } from '../src/engine/store.js'

const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const player = scenario.player.name
const ending = scenario.ending
const last = scenario.days.length
const rumour = () => scenario.sites.find((s) => s.layout === 'board').board.posts.find((p) => p.id === 'b11')
const article = () => scenario.news.find((n) => n.id === 'n_accident')
const portal = scenario.sites.find((s) => s.url === 'portal.ar.co.kr')
const board = () => portal.pages[ending.clues.obituary]?.board
const obituary = () => board()?.posts.find((p) => p.obituary)

describe('the two endings', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ ended: false, day: 1, booted: true, grants: {}, locks: 1 })
  })
  afterEach(() => vi.useRealTimers())

  it('each tells its story in scenes that say something', () => {
    for (const kind of ['true', 'plain', 'overwork', 'wake']) {
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
    expect(awareOf(ending, { [CLUE.obituary]: true })).toBe(true)
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
    expect(endingFor(ending, { grants: { [CLUE.obituary]: true }, locks: 0 })).toBe('true')
  })

  it('puts the accident on the search portal front page', () => {
    // the crash itself is a month old by the time the week opens, so what the
    // front page carries is the follow-up — and it has to still be there, or
    // the week starts with no hint at all
    const front = latestNews(visibleByDay(scenario.news, 1))
    expect(front.map((a) => a.id)).toContain('n_accident2')
    expect(JSON.stringify(front.find((a) => a.id === 'n_accident2'))).toMatch(/의식/)
    // and the original is still there to be found by anyone who searches
    expect(visibleByDay(scenario.news, 1).map((a) => a.id)).toContain('n_accident')
    for (let i = 1; i < front.length; i++) expect(front[i - 1].date >= front[i].date).toBe(true)
  })

  it('is on the portal and nowhere in the inbox, so nobody reads it by accident', () => {
    const post = obituary()
    expect(post).toBeTruthy()
    const said = JSON.stringify(post)
    expect(said).toContain('부고')
    expect(said).toContain(player)
    // nothing that lands in the inbox on its own says any of it
    for (const word of ['부고', '별세', '빈소', '경조사']) {
      expect(scenario.mails.some((m) => `${m.subject} ${m.body}`.includes(word)), word).toBe(false)
    }
  })

  it('reads like every other week, and says it last', () => {
    const post = obituary()
    // a wedding, then somebody else's grandmother, then the player
    expect(post.sections.length).toBeGreaterThan(2)
    expect(post.sections[0].kind).not.toBe('부고')
    const mine = post.sections.findIndex((sec) => JSON.stringify(sec).includes(player))
    expect(mine).toBe(post.sections.length - 1)
    // and the weeks around it are ordinary notices with nothing in them
    const others = board().posts.filter((p) => !p.obituary)
    expect(others.length).toBeGreaterThan(0)
    for (const p of others) expect(JSON.stringify(p)).not.toContain(player)
  })

  it('marks the entry the reader has to scroll to, and only that one', () => {
    const post = obituary()
    const marked = post.sections.filter((sec) => sec.mine)
    expect(marked).toHaveLength(1)
    // it is the player's own, and it is the last thing on the page
    expect(JSON.stringify(marked[0])).toContain(player)
    expect(post.sections.at(-1).mine).toBe(true)
    // no other week has anything to scroll to
    for (const p of board().posts.filter((x) => !x.obituary)) {
      expect(p.sections.some((sec) => sec.mine)).toBe(false)
    }
  })

  it('is one row on a list, not the page itself', () => {
    expect(board().posts.length).toBeGreaterThan(2)
    expect(board().columns.length).toBeGreaterThan(1)
  })

  it('sits behind a menu that has to be opened on purpose', () => {
    const menu = portal.pages['/hr']?.menu
    expect(menu?.some((m) => m.path === ending.clues.obituary)).toBe(true)
    // and the menu itself is on the bar the portal draws
    expect(portal.portal.nav).toContain('인사관리')
    expect(portal.portal.navLinks['인사관리']).toBe('/hr')
  })

  it('answers the opened obituary with the boss, once, and counts it as no work done', () => {
    useGame.setState({ extraMessages: {}, toast: null, sealed: false, sealedSaid: [], ended: null })
    useGame.getState().witness()
    useGame.getState().witness()
    expect(useGame.getState().grants[CLUE.obituary]).toBe(true)
    expect(scenario.objectives.some((o) => o.grant === CLUE.obituary)).toBe(false)
    vi.runAllTimers()
    const ev = ending.event
    expect(useGame.getState().extraMessages[ev.thread].map((m) => m.text)).toEqual(ev.lines)
  })

  // 부고를 본 순간 그 주는 멈춘다. 남은 요청을 계속 처리하게 두면 방금 읽은
  // 것이 아무 일도 아니게 된다.
  describe('그 주가 멈춘다', () => {
    const seal = () => {
      useGame.setState({
        extraMessages: {}, toast: null, sealed: false, sealedSaid: [], ended: null,
        grants: {}, beatQueue: [{ thread: 'boss', lines: ['x'] }], beatAsk: 'boss',
        pendingAsks: { boss: { text: 'x' } },
        windows: [
          { id: 1, app: 'explorer', key: 'a', z: 5 },
          { id: 2, app: 'browser', key: 'b', z: 7 },
          { id: 3, app: 'browser', key: 'c', z: 6 }
        ],
        screens: ['app:browser', 'win:2']
      })
      useGame.getState().witness()
    }

    it('부고를 띄운 창만 남기고 다 닫는다', () => {
      seal()
      const s = useGame.getState()
      expect(s.sealed).toBe(true)
      expect(s.windows.map((w) => w.id)).toEqual([2])
      expect(s.screens).toEqual(['win:2'])
    })

    it('남은 요청은 사라지고 새 창도 열리지 않는다', () => {
      seal()
      expect(useGame.getState().beatQueue).toEqual([])
      expect(useGame.getState().beatAsk).toBe(null)
      expect(useGame.getState().pendingAsks).toEqual({})
      useGame.getState().openWindow('explorer')
      useGame.getState().closeWindow(2)
      expect(useGame.getState().windows.map((w) => w.id)).toEqual([2])
    })

    it('마지막 말들이 한 줄씩 쌓이고, 다 오면 엔딩으로 넘어간다', () => {
      seal()
      const lines = [ending.event, ...ending.last].flatMap((s) => s.lines)
      expect(useGame.getState().sealedSaid).toEqual([])
      vi.runAllTimers()
      expect(useGame.getState().sealedSaid.map((m) => m.text)).toEqual(lines)
      expect(useGame.getState().ended).toBe('true')
    })

    it('마지막 말들은 대화에도 남는다', () => {
      seal()
      vi.runAllTimers()
      for (const say of ending.last) {
        expect(useGame.getState().extraMessages[say.thread].map((m) => m.text)).toEqual(say.lines)
      }
    })

    it('굳은 채로 저장된 판을 다시 켜도 갇히지 않는다', () => {
      seal()
      // 새로고침: 타이머는 사라지고 저장된 상태만 남는다
      useGame.setState({ booted: false, ended: null, sealedSaid: [] })
      vi.clearAllTimers()
      useGame.getState().setBooted()
      vi.runAllTimers()
      expect(useGame.getState().ended).toBe('true')
    })

    it('마지막 말은 그 주를 대신 설명하지 않는다', () => {
      const said = JSON.stringify(ending.last)
      for (const word of ['부고', '사망', '죽', '사고', '혼수', '병원']) {
        expect(said).not.toContain(word)
      }
    })
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
    // she says it once the address has been given, not on the first morning:
    // day one opens her thread for everyone, and this line only works on a
    // reader who already suspects something
    const hers = scenario.chatter.filter((c) => c.beat.thread === 'mom')
    expect(JSON.stringify(hers)).toMatch(/상 차리는/)
    const card = threads.find((t) => t.id === 'card')
    expect(card.messages.filter((m) => m.text.includes('입금') && m.text.includes('엄마')).length).toBeGreaterThanOrEqual(2)
  })

  it('lets death be true only once it is known: no other ending hints at it', () => {
    for (const kind of ['plain', 'overwork', 'lotto', 'wake']) {
      expect(JSON.stringify(ending[kind])).not.toMatch(/2026-07-23|7월 23일|별세|부고|나타날 수 없|노잣돈|제사|상 차/)
    }
    expect(JSON.stringify(ending.true)).toMatch(/2026-07-23/)
  })

  it('dates the last clock-in before the holiday, everywhere it is mentioned', () => {
    expect(JSON.stringify(rumour())).toContain('7월 23일')
    expect(JSON.stringify(ending.true)).toContain('2026-07-23')
  })
})
