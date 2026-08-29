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
    useGame.setState({ extraMessages: {}, toast: null, sealed: false, ended: null, windows: [] })
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
        extraMessages: {}, toast: null, sealed: false, frozen: null, ended: null,
        grants: {}, beatQueue: [{ thread: 'boss', lines: ['x'] }], beatAsk: 'boss',
        pendingAsks: { boss: { text: 'x' } }, openThread: {},
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
      expect(s.frozen).toBe(2)
      expect(s.windows.map((w) => w.id)).toEqual([2])
      expect(s.screens).toEqual(['win:2'])
    })

    it('남은 요청은 사라지고 플레이어는 아무것도 못 연다', () => {
      seal()
      expect(useGame.getState().beatQueue).toEqual([])
      expect(useGame.getState().beatAsk).toBe(null)
      expect(useGame.getState().pendingAsks).toEqual({})
      useGame.getState().openWindow('explorer')
      useGame.getState().closeWindow(2)
      expect(useGame.getState().windows.map((w) => w.id)).toEqual([2])
    })

    // 마지막 말은 사라지는 알림이 아니라 대화창에 온다 — 그 창은 장면이
    // 스스로 띄운다.
    it('말하는 사람마다 그 메신저를 띄우고 그 대화를 연다', () => {
      seal()
      vi.runAllTimers()
      const s = useGame.getState()
      for (const say of [ending.event, ...ending.last, ending.explain]) {
        expect(s.windows.some((w) => w.app === (say.source === 'privateMessenger' ? 'chat' : 'messenger'))).toBe(true)
        expect(s.extraMessages[say.thread].map((m) => m.text)).toEqual(say.lines)
      }
      // 마지막에 연 대화가 앞에 있다
      expect(s.openThread[ending.explain.source]).toBe(ending.explain.thread)
    })

    it('마지막 말들 사이에 사고 기사를 띄운다', () => {
      seal()
      vi.runAllTimers()
      const shown = useGame.getState().windows
        .find((w) => w.app === 'browser' && w.props?.start)
      expect(shown?.props.start).toEqual({ kind: 'news', id: ending.article })
      expect(scenario.news.some((n) => n.id === ending.article)).toBe(true)
      // 굳은 창은 그것대로 남아 있다
      expect(useGame.getState().frozen).toBe(2)
    })

    it('다 오고 나면 엔딩으로 넘어간다', () => {
      seal()
      expect(useGame.getState().ended).toBe(null)
      vi.runAllTimers()
      expect(useGame.getState().ended).toBe('true')
    })

    // 이 화면이 생기기 전의 세이브에는 부고를 본 표식만 있고 굳은 자국이
    // 없다. 표식을 보고 돌아서면 그런 판은 다시 열어도 아무 일이 없다.
    it('부고를 이미 본 세이브도 다시 열면 굳는다', () => {
      seal()
      useGame.setState({ sealed: false, windows: [{ id: 9, app: 'browser', key: 'b', z: 1 }] })
      useGame.getState().witness()
      expect(useGame.getState().sealed).toBe(true)
      vi.runAllTimers()
      expect(useGame.getState().ended).toBe('true')
    })

    it('띄운 창을 못 찾아도 화면을 비우지는 않는다', () => {
      seal()
      useGame.setState({ sealed: false, windows: [{ id: 4, app: 'explorer', key: 'e', z: 1 }] })
      useGame.getState().witness()
      expect(useGame.getState().windows.some((w) => w.id === 4)).toBe(true)
      expect(useGame.getState().frozen).toBe(null)
    })

    it('굳은 채로 저장된 판을 다시 켜도 갇히지 않는다', () => {
      seal()
      // 새로고침: 타이머는 사라지고 저장된 상태만 남는다
      useGame.setState({ booted: false, ended: null })
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

    // 설명은 계정의 몫이고, 부고와 기사를 다 본 뒤에만 온다. 여기서까지
    // 말을 아끼면 닷새가 무엇이었는지 아무도 말해 주지 않는다.
    it('계정은 마지막에 진실을 말한다', () => {
      expect(ending.explain.thread).toBe(scenario.summons.thread)
      const said = ending.explain.lines.join(' ')
      expect(said).toContain('공항')
      expect(said).toContain('제주도')
      expect(said).toContain('병상')
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

// wake 엔딩은 "닷새 내내 모니터 소리인 줄 알았던 것은 심박계였습니다"로
// 끝난다. 그 소리가 게임 안에서 한 번도 난 적이 없으면, 그 줄은 없던 것을
// 되짚는 셈이 된다.
describe('심박계 소리는 미리 들려 둔다', () => {
  const beeps = scenario.chatter.filter((c) => c.egg?.includes('심박계'))

  it('wake가 그 소리를 되짚는다', () => {
    expect(JSON.stringify(ending.wake.scenes)).toContain('삐')
  })

  it('주 내내 여러 번 난다', () => {
    expect(beeps.length).toBeGreaterThanOrEqual(3)
    for (const c of beeps) expect(JSON.stringify(c.beat.lines)).toMatch(/소리|삐/)
  })

  it('그중 하나는 운에 맡기지 않는다', () => {
    // 한가한 잡담은 무작위로 뽑힌다. 하나는 1일차의 고정 요청에 붙여, 어느
    // 판에서든 반드시 한 번은 들리게 해 둔다.
    const sure = beeps.find((c) => c.after)
    expect(sure, '고정 요청에 붙은 것이 없다').toBeTruthy()
    expect(scenario.days[0].requests).toContain(sure.after)
  })

  it('아무도 그 소리를 같이 듣지는 않는다', () => {
    // 남이 들어 버리면 그것은 진짜 기계 소리가 되고, 엔딩이 뒤집을 것이 없다.
    for (const c of beeps) {
      expect(JSON.stringify(c.beat.lines), c.id).not.toMatch(/나도 들|들리는데$/)
    }
  })
})

// 성실하게 일만 한 플레이어도 균열을 지나가야 한다. 5일차의 고정 요청이
// 부고가 실린 바로 그 글로 보내고, 답만 집어 돌아선 사람은 그 직후의
// 반응이 글 아래쪽으로 다시 끌어당긴다.
describe('일이 균열을 지나간다', () => {
  it('결혼식장 요청의 답은 부고가 실린 글 위쪽에 있다', () => {
    expect(scenario.pool.fixed['5']).toContain('wedding_venue')
    const ask = scenario.days[4].asks.find((a) => a.ask.grants === 'wedding_venue').ask
    const post = obituary()
    const above = post.sections.filter((s) => !s.mine)
    expect(JSON.stringify(above)).toContain(ask.accept[0])
    expect(JSON.stringify(post.sections.find((s) => s.mine))).not.toContain(ask.accept[0])
  })

  it('답만 집어 돌아선 사람을 다시 끌어당긴다', () => {
    const pull = scenario.chatter.find((c) => c.after === 'wedding_venue')
    expect(pull, 'wedding_venue 뒤에 오는 반응이 없다').toBeTruthy()
    expect(JSON.stringify(pull.beat.lines)).toMatch(/아래/)
  })

  it('근태 요청은 쉬운 곡선에 있고, 목표가 있다', () => {
    expect(scenario.pool.before.overtime_pay).toBe(3)
    expect(scenario.objectives.some((o) => o.id === 'overtime_pay')).toBe(true)
  })

  it('5일차에는 어긋남이 셋 이상 있다', () => {
    const off = scenario.chatter.filter((c) =>
      c.egg?.includes('어긋남') && (c.days?.includes(5) || c.after === 'wedding_venue'))
    expect(off.length).toBeGreaterThanOrEqual(3)
  })
})
